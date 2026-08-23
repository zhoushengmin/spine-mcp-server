/**
 * 渲染服务：JS 运行时渲染 Spine 动画帧。
 * - 解析骨架 JSON + .atlas + 图集 png
 * - 计算骨骼世界变换（含关键帧线性插值）
 * - 软件三角形光栅化：region 附件（2 三角）与 mesh 附件（真实顶点变形，含加权/非加权 + deform FFD）
 * - 提供单帧 PNG / RGBA Buffer / 多帧序列（供视频导出）三类接口
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { parseAtlas, findRegion, ParsedAtlas, AtlasRegion } from "./atlas-utils";
import { ErrorCode, SpineError } from "../utils/error-codes";

interface BoneSetup {
  name: string;
  parent?: string;
  length: number;
  x: number; y: number; rotation: number;
  scaleX: number; scaleY: number;
  shearX: number; shearY: number;
  children: BoneSetup[];
}

interface BoneWorld {
  name: string;
  worldX: number; worldY: number;
  a: number; b: number; c: number; d: number;
}

export interface RenderOptions {
  animationName?: string;
  time?: number;
  frameIndex?: number;
  fps?: number;
  width?: number;
  height?: number;
}

interface FrameContext {
  width: number;
  height: number;
  ox: number;      // 骨架原点 x（画布中心偏移）
  oy: number;      // 骨架原点 y
  texCache: Map<string, { buf: Buffer; w: number; h: number }>;
  frame: Uint8ClampedArray;
}

/** 世界坐标 (x,y) → 像素坐标 */
function toPx(ctx: FrameContext, x: number, y: number): [number, number] {
  return [x + ctx.ox, ctx.oy - y];
}

/** 从图集图片中抠出 region 子图为 RGBA Buffer（含 rotate 处理） */
async function extractRegionBuffer(imagePath: string, region: AtlasRegion): Promise<{ buf: Buffer; w: number; h: number }> {
  const rw = region.rotate ? region.height : region.width;
  const rh = region.rotate ? region.width : region.height;
  const { data, info } = await sharp(imagePath)
    .extract({ left: region.x, top: region.y, width: rw, height: rh })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { buf: data, w: info.width, h: info.height };
}

/** 双线性采样 RGBA（预乘 alpha 图集，直接 src-over 叠加） */
function sampleTex(tex: { buf: Buffer; w: number; h: number }, u: number, v: number, out: number[]): void {
  const w = tex.w, h = tex.h;
  const fx = u * w - 0.5, fy = v * h - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const x1 = x0 + 1, y1 = y0 + 1;
  const clamp = (i: number, n: number) => Math.max(0, Math.min(n - 1, i));
  const xa = clamp(x0, w), xb = clamp(x1, w), ya = clamp(y0, h), yb = clamp(y1, h);
  let r = 0, g = 0, b = 0, a = 0;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const xx = dx === 0 ? xa : xb;
      const yy = dy === 0 ? ya : yb;
      const wgt = (dx === 0 ? 1 - tx : tx) * (dy === 0 ? 1 - ty : ty);
      const off = (yy * w + xx) * 4;
      r += tex.buf[off] * wgt; g += tex.buf[off + 1] * wgt;
      b += tex.buf[off + 2] * wgt; a += tex.buf[off + 3] * wgt;
    }
  }
  out[0] = r; out[1] = g; out[2] = b; out[3] = a;
}

/** 光栅化一个三角形（顶点已映射为像素坐标，UV 0~1） */
function rasterizeTriangle(
  ctx: FrameContext,
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
  ua: number, va: number, ub: number, vb: number, uc: number, vc: number,
  tex: { buf: Buffer; w: number; h: number }
): void {
  const W = ctx.width, H = ctx.height;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
  if (minX > maxX || minY > maxY) return;

  const d00 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(d00) < 1e-9) return;

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const f = px + 0.5, g = py + 0.5;
      const d1 = (bx - ax) * (g - ay) - (by - ay) * (f - ax);
      const d2 = (cx - bx) * (g - by) - (cy - by) * (f - bx);
      const d3 = (ax - cx) * (g - cy) - (ay - cy) * (f - cx);
      if (d1 < 0 || d2 < 0 || d3 < 0) continue;
      const w1 = d2 / d00, w2 = d3 / d00, w0 = 1 - w1 - w2;
      const u = ua * w0 + ub * w1 + uc * w2;
      const v = va * w0 + vb * w1 + vc * w2;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const t: number[] = [0, 0, 0, 0];
      sampleTex(tex, u, v, t);
      if (t[3] <= 0.5) continue;
      const off = (py * W + px) * 4;
      const invA = 1 - t[3];
      ctx.frame[off] = t[0] + ctx.frame[off] * invA;
      ctx.frame[off + 1] = t[1] + ctx.frame[off + 1] * invA;
      ctx.frame[off + 2] = t[2] + ctx.frame[off + 2] * invA;
      ctx.frame[off + 3] = t[3] + ctx.frame[off + 3] * (1 - t[3]);
    }
  }
}

/** 构建骨骼树 */
function buildBoneTree(json: any): Map<string, BoneSetup> {
  const map = new Map<string, BoneSetup>();
  for (const b of json.bones ?? []) {
    map.set(b.name, {
      name: b.name, parent: b.parent, length: b.length ?? 0,
      x: b.x ?? 0, y: b.y ?? 0, rotation: b.rotation ?? 0,
      scaleX: b.scaleX ?? 1, scaleY: b.scaleY ?? 1,
      shearX: b.shearX ?? 0, shearY: b.shearY ?? 0,
      children: [],
    });
  }
  for (const bone of map.values()) {
    if (bone.parent && map.has(bone.parent)) map.get(bone.parent)!.children.push(bone);
  }
  return map;
}

/** 线性插值关键帧（time 处值；无帧用默认值） */
function sampleTimeline(frames: any[], time: number, defaultValue: number): number {
  if (!frames || frames.length === 0) return defaultValue;
  let prev = frames[0];
  for (const f of frames) {
    if ((f.time ?? 0) <= time + 1e-6) prev = f;
    else break;
  }
  const next = frames.find((f) => (f.time ?? 0) > time + 1e-6);
  if (!next) return prev.angle ?? prev.value ?? defaultValue;
  const t0 = prev.time ?? 0;
  const t1 = next.time ?? t0;
  if (t1 === t0) return next.angle ?? next.value ?? defaultValue;
  const k = Math.min(1, Math.max(0, (time - t0) / (t1 - t0)));
  const v0 = prev.angle ?? prev.value ?? prev.x ?? defaultValue;
  const v1 = next.angle ?? next.value ?? next.x ?? defaultValue;
  return v0 + (v1 - v0) * k;
}

/** 采样骨骼局部变换 */
function sampleBoneTimelines(anim: any, boneName: string, time: number, setup: BoneSetup): { x: number; y: number; rotation: number; scaleX: number; scaleY: number; shearX: number; shearY: number } {
  const tl = anim?.bones?.[boneName] ?? {};
  return {
    x: sampleTimeline(tl.translate, time, setup.x),
    y: sampleTimeline(tl.translate, time, setup.y),
    rotation: sampleTimeline(tl.rotate, time, setup.rotation),
    scaleX: sampleTimeline(tl.scale, time, setup.scaleX),
    scaleY: sampleTimeline(tl.scale, time, setup.scaleY),
    shearX: sampleTimeline(tl.shear, time, setup.shearX),
    shearY: sampleTimeline(tl.shear, time, setup.shearY),
  };
}

/** 计算全部骨骼世界变换（Spine Bone.update 矩阵算法） */
function computeWorld(bones: Map<string, BoneSetup>, local: Map<string, { x: number; y: number; rotation: number; scaleX: number; scaleY: number; shearX: number; shearY: number }>): Map<string, BoneWorld> {
  const world = new Map<string, BoneWorld>();
  const roots = [...bones.values()].filter((b) => !b.parent || !bones.has(b.parent));
  const compute = (bone: BoneSetup): void => {
    const l = local.get(bone.name)!;
    const parent = bone.parent && bones.has(bone.parent) ? world.get(bone.parent) : undefined;
    const rad = (l.rotation * Math.PI) / 180;
    const radX = (l.shearX * Math.PI) / 180;
    const cosR = Math.cos(rad), sinR = Math.sin(rad), cosS = Math.cos(radX), sinS = Math.sin(radX);
    let worldX: number, worldY: number;
    if (parent) {
      const pa = parent.a, pb = parent.b, pc = parent.c, pd = parent.d;
      worldX = pa * l.x * l.scaleX + pb * l.y * l.scaleY + parent.worldX;
      worldY = pc * l.x * l.scaleX + pd * l.y * l.scaleY + parent.worldY;
    } else {
      worldX = l.x * l.scaleX;
      worldY = l.y * l.scaleY;
    }
    const a = cosR * cosS * l.scaleX;
    const b = sinR * cosS * l.scaleX;
    const c = cosR * sinS * l.scaleY - sinR * cosS * l.scaleY;
    const d = sinR * sinS * l.scaleY + cosR * cosS * l.scaleY;
    world.set(bone.name, { name: bone.name, worldX, worldY, a, b, c, d });
    for (const child of bone.children) compute(child);
  };
  for (const root of roots) compute(root);
  return world;
}

/** 获取 time 处插槽绘制顺序 */
function computeDrawOrder(json: any, anim: any, time: number, slots: any[]): string[] {
  const base = slots.map((s) => s.name);
  const frames = anim?.draworder ?? [];
  if (!frames.length) return base;
  let frame = frames[0];
  for (const f of frames) {
    if ((f.time ?? 0) <= time + 1e-6) frame = f;
    else break;
  }
  if ((frame.time ?? 0) > time + 1e-6) return base;
  const offsets: any[] = frame.offsets ?? [];
  const result = [...base];
  for (const off of offsets) {
    const idx = base.indexOf(off.slot);
    if (idx < 0) continue;
    result.splice(result.indexOf(off.slot), 1);
    const target = Math.min(Math.max(off.offset, 0), result.length);
    result.splice(target, 0, off.slot);
  }
  return result;
}

/** 获取插槽在 time 处的活动附件名 */
function activeAttachment(json: any, anim: any, slotName: string, time: number): string | undefined {
  const slot = (json.slots ?? []).find((s: any) => s.name === slotName);
  const frames = anim?.slots?.[slotName]?.attachment ?? [];
  if (frames.length) {
    let name = frames[0].name;
    for (const f of frames) {
      if ((f.time ?? 0) <= time + 1e-6) name = f.name;
      else break;
    }
    return name;
  }
  return slot?.attachment;
}

/** 采样 deform 帧（最近前一帧），返回完整 deform 数组（长度=顶点数*2，未受影响为 0） */
function sampleDeform(anim: any, skinName: string, slotName: string, attName: string, vertexCount: number, time: number): number[] {
  const out = new Array<number>(vertexCount * 2).fill(0);
  const frames = anim?.deform?.[skinName]?.[slotName]?.[attName];
  if (!frames || !frames.length) return out;
  let frame = frames[0];
  for (const f of frames) {
    if ((f.time ?? 0) <= time + 1e-6) frame = f;
    else break;
  }
  if ((frame.time ?? 0) > time + 1e-6) return out;
  const offset = frame.offset ?? 0;
  const verts = frame.vertices ?? [];
  for (let i = 0; i < verts.length; i++) {
    const idx = (offset + i) % (vertexCount * 2);
    out[idx] = verts[i];
  }
  return out;
}

/**
 * 计算 mesh 附件的世界顶点（含加权蒙皮与 deform FFD）。
 * 返回像素空间顶点数组 [x0,y0,x1,y1,...]。
 */
function computeMeshWorldVertices(
  ctx: FrameContext,
  world: Map<string, BoneWorld>,
  json: any,
  slotBoneName: string,
  att: any,
  deformArr: number[],
  skinName: string
): number[] | null {
  const v = att.vertices;
  if (!Array.isArray(v) || v.length < 2) return null;
  const boneList = (json.bones ?? []).map((b: any) => b.name);
  const out: number[] = [];
  const boneByName = (name: string) => world.get(name);

  // 判断加权：首个元素为整数且为影响数
  const weighted = Number.isInteger(v[0]) && v[0] >= 1;
  let vi = 0; // 顶点序号
  if (weighted) {
    let i = 0;
    while (i < v.length) {
      const count = v[i];
      if (!Number.isInteger(count) || count < 1) break;
      i++;
      let wx = 0, wy = 0;
      for (let k = 0; k < count; k++) {
        if (i + 4 > v.length) break;
        const boneIndex = v[i], lx = v[i + 1], ly = v[i + 2], weight = v[i + 3];
        i += 4;
        let vx = lx, vy = ly;
        vx += deformArr[vi * 2] ?? 0;
        vy += deformArr[vi * 2 + 1] ?? 0;
        const bone = boneByName(boneList[boneIndex]);
        if (!bone) continue;
        wx += (bone.a * vx + bone.b * vy + bone.worldX) * weight;
        wy += (bone.c * vx + bone.d * vy + bone.worldY) * weight;
      }
      const [px, py] = toPx(ctx, wx, wy);
      out.push(px, py);
      vi++;
    }
  } else {
    for (let i = 0; i + 1 < v.length; i += 2) {
      let lx = v[i], ly = v[i + 1];
      lx += deformArr[vi * 2] ?? 0;
      ly += deformArr[vi * 2 + 1] ?? 0;
      const bone = boneByName(slotBoneName);
      if (!bone) return null;
      const wx = bone.a * lx + bone.b * ly + bone.worldX;
      const wy = bone.c * lx + bone.d * ly + bone.worldY;
      const [px, py] = toPx(ctx, wx, wy);
      out.push(px, py);
      vi++;
    }
  }
  return out;
}

/** 渲染 region 附件（仿射变换后 2 三角形光栅化） */
async function rasterizeRegion(
  ctx: FrameContext,
  imagePath: string,
  texKey: string,
  region: AtlasRegion,
  boneW: BoneWorld,
  att: any
): Promise<void> {
  let tex = ctx.texCache.get(texKey);
  if (!tex) {
    tex = await extractRegionBuffer(imagePath, region);
    ctx.texCache.set(texKey, tex);
  }
  const hw = ((att.width ?? region.width) / 2) * (att.scaleX ?? 1);
  const hh = ((att.height ?? region.height) / 2) * (att.scaleY ?? 1);
  const rot = ((att.rotation ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  // 附件中心（局部偏移 att.x/att.y）经骨骼矩阵 → 世界
  const cx = boneW.a * (att.x ?? 0) + boneW.b * (att.y ?? 0) + boneW.worldX;
  const cy = boneW.c * (att.x ?? 0) + boneW.d * (att.y ?? 0) + boneW.worldY;
  // 4 个角点（局部，绕中心旋转后经骨骼矩阵）
  const corners = [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ].map(([sx, sy]) => {
    const lx = cosR * sx * hw - sinR * sy * hh;
    const ly = sinR * sx * hw + cosR * sy * hh;
    const wx = boneW.a * lx + boneW.b * ly + cx;
    const wy = boneW.c * lx + boneW.d * ly + cy;
    return toPx(ctx, wx, wy);
  });
  const uvs = [
    [0, 0], [1, 0], [0, 1], [1, 1],
  ];
  const [a, b, c, d] = corners;
  const [ua, va, ub, vb, uc, vc, ud, vd] = uvs.flat();
  // 三角形 (0,1,2) 与 (1,3,2)
  rasterizeTriangle(ctx, a[0], a[1], b[0], b[1], c[0], c[1], ua, va, ub, vb, uc, vc, tex);
  rasterizeTriangle(ctx, b[0], b[1], d[0], d[1], c[0], c[1], ub, vb, ud, vd, uc, vc, tex);
}

/** 渲染 mesh 附件（真实顶点变形 + triangles + uvs） */
async function rasterizeMesh(
  ctx: FrameContext,
  imagePath: string,
  texKey: string,
  region: AtlasRegion,
  world: Map<string, BoneWorld>,
  json: any,
  slotBoneName: string,
  att: any,
  deformArr: number[],
  skinName: string
): Promise<void> {
  let tex = ctx.texCache.get(texKey);
  if (!tex) {
    tex = await extractRegionBuffer(imagePath, region);
    ctx.texCache.set(texKey, tex);
  }
  const verts = computeMeshWorldVertices(ctx, world, json, slotBoneName, att, deformArr, skinName);
  if (!verts || !att.uvs || !att.triangles) return;
  const tris = att.triangles;
  for (let i = 0; i + 2 < tris.length; i += 3) {
    const i0 = tris[i] * 2, i1 = tris[i + 1] * 2, i2 = tris[i + 2] * 2;
    if (i2 + 1 >= verts.length) continue;
    rasterizeTriangle(
      ctx,
      verts[i0], verts[i0 + 1], verts[i1], verts[i1 + 1], verts[i2], verts[i2 + 1],
      att.uvs[i0], att.uvs[i0 + 1], att.uvs[i1], att.uvs[i1 + 1], att.uvs[i2], att.uvs[i2 + 1],
      tex
    );
  }
}

/**
 * 渲染一帧为 RGBA Buffer（原始像素，宽高已知）。
 * 供文件渲染与视频导出复用。
 */
export async function renderFrameToRgba(
  json: any,
  atlas: ParsedAtlas,
  imagePath: string,
  animName: string,
  time: number,
  width: number,
  height: number,
  meta?: { slots: number }
): Promise<Buffer> {
  const anim = json.animations?.[animName];
  if (!anim) throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画不存在：${animName}`);

  const bones = buildBoneTree(json);
  const local = new Map<string, any>();
  for (const b of bones.values()) local.set(b.name, sampleBoneTimelines(anim, b.name, time, b));
  const world = computeWorld(bones, local);
  const slots = json.slots ?? [];
  const drawOrder = computeDrawOrder(json, anim, time, slots);
  const defaultSkin = Array.isArray(json.skins)
    ? json.skins.find((s: any) => s.name === "default") ?? json.skins[0] ?? { name: "default", attachments: {} }
    : (json.skins?.["default"] ?? Object.values(json.skins ?? {})[0] ?? { name: "default", attachments: {} });
  const skinName = defaultSkin.name ?? "default";
  const attachments = defaultSkin.attachments ?? {};

  const skel = json.skeleton ?? {};
  const ctx: FrameContext = {
    width,
    height,
    ox: Math.round(width / 2 - (skel.x ?? 0)),
    oy: Math.round(height / 2 - (skel.y ?? 0)),
    texCache: new Map(),
    frame: new Uint8ClampedArray(width * height * 4),
  };

  for (const slotName of drawOrder) {
    const slot = slots.find((s: any) => s.name === slotName);
    if (!slot || !slot.bone) continue;
    const boneW = world.get(slot.bone);
    if (!boneW) continue;
    const attName = activeAttachment(json, anim, slotName, time);
    if (!attName) continue;
    const att = attachments?.[slotName]?.[attName];
    if (!att) continue;
    if (att.type !== "region" && att.type !== "mesh") continue;
    const region = findRegion(atlas, att.path ?? att.name ?? attName);
    if (!region) continue;
    if (meta) meta.slots++;
    const texKey = `${region.x},${region.y},${region.width},${region.height},${region.rotate ? 1 : 0}`;
    if (att.type === "region") {
      await rasterizeRegion(ctx, imagePath, texKey, region, boneW, att);
    } else {
      const deformArr = sampleDeform(anim, skinName, slotName, attName, att.uvs ? att.uvs.length / 2 : 0, time);
      await rasterizeMesh(ctx, imagePath, texKey, region, world, json, slot.bone, att, deformArr, skinName);
    }
  }

  return Buffer.from(ctx.frame.buffer);
}

/**
 * 渲染一帧并保存 PNG。
 * @param skeletonJsonPath 导出的骨架 JSON
 * @param atlasPath        .atlas
 * @param imagePath        图集 png
 * @param outputPath       输出 png
 */
export async function renderFrame(
  skeletonJsonPath: string,
  atlasPath: string,
  imagePath: string,
  outputPath: string,
  options: RenderOptions = {}
): Promise<{ width: number; height: number; animationName?: string; time?: number; slots: number }> {
  for (const [label, p] of [["骨架 JSON", skeletonJsonPath], ["图集", atlasPath], ["图集图片", imagePath]] as const) {
    if (!fs.existsSync(p)) throw new SpineError(ErrorCode.INVALID_ARGUMENT, `${label}不存在：${p}`);
  }
  const json = JSON.parse(fs.readFileSync(skeletonJsonPath, "utf8"));
  const atlas = parseAtlas(fs.readFileSync(atlasPath, "utf8"));
  const animName = options.animationName ?? Object.keys(json.animations ?? {})[0];
  if (!animName) throw new SpineError(ErrorCode.INVALID_ARGUMENT, "项目没有动画。");
  const fps = options.fps ?? 30;
  const time = options.time ?? (options.frameIndex !== undefined ? options.frameIndex / fps : 0);

  const skel = json.skeleton ?? {};
  const width = options.width ?? Math.max(1, Math.ceil(skel.width ?? 256));
  const height = options.height ?? Math.max(1, Math.ceil(skel.height ?? 256));

  const meta = { slots: 0 };
  const rgba = await renderFrameToRgba(json, atlas, imagePath, animName, time, width, height, meta);
  await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(outputPath);
  return { width, height, animationName: animName, time, slots: meta.slots };
}

/**
 * 渲染动画为多帧 RGBA 序列（供视频导出）。
 * @returns [{ index, time, buffer }]
 */
export async function renderAnimationFrames(
  skeletonJsonPath: string,
  atlasPath: string,
  imagePath: string,
  animationName: string,
  options: { fps?: number; width?: number; height?: number } = {}
): Promise<{ index: number; time: number; buffer: Buffer }[]> {
  for (const [label, p] of [["骨架 JSON", skeletonJsonPath], ["图集", atlasPath], ["图集图片", imagePath]] as const) {
    if (!fs.existsSync(p)) throw new SpineError(ErrorCode.INVALID_ARGUMENT, `${label}不存在：${p}`);
  }
  const json = JSON.parse(fs.readFileSync(skeletonJsonPath, "utf8"));
  const atlas = parseAtlas(fs.readFileSync(atlasPath, "utf8"));
  const anim = json.animations?.[animationName];
  if (!anim) throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画不存在：${animationName}`);

  const skel = json.skeleton ?? {};
  const width = options.width ?? Math.max(1, Math.ceil(skel.width ?? 256));
  const height = options.height ?? Math.max(1, Math.ceil(skel.height ?? 256));
  const fps = options.fps ?? 30;
  const duration = anim.duration ?? 1;
  const total = Math.max(1, Math.round(duration * fps));
  const frames: { index: number; time: number; buffer: Buffer }[] = [];
  for (let i = 0; i < total; i++) {
    const t = duration * (i / total);
    const buf = await renderFrameToRgba(json, atlas, imagePath, animationName, t, width, height);
    frames.push({ index: i, time: t, buffer: buf });
  }
  return frames;
}
