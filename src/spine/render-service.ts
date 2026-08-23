/**
 * 渲染服务：JS 运行时渲染 Spine 动画单帧为 PNG。
 * - 解析骨架 JSON + .atlas + 图集 png
 * - 计算骨骼世界变换（含关键帧线性插值）
 * - 按绘制顺序合成 region 附件
 * ⚠️ 简化：mesh 附件按未变形 region 近似绘制（不做顶点扭曲）；shear 参与矩阵计算。
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { parseAtlas, findRegion } from "./atlas-utils";
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
  worldRot: number; // 弧度
  worldScaleX: number; worldScaleY: number;
  a: number; b: number; c: number; d: number;
}

export interface RenderOptions {
  animationName?: string;
  time?: number;
  frameIndex?: number;
  fps?: number;
  width?: number;
  height?: number;
  scale?: number;
}

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

/** 线性插值关键帧（返回 [{time,...}] 数组在 time 处的值；无帧用默认值） */
function sampleTimeline(frames: any[], time: number, defaultValue: number): number {
  if (!frames || frames.length === 0) return defaultValue;
  // 找出 time 落在哪两帧之间
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

/** 采样骨骼在 time 的局部变换（rotate/translate/scale/shear 均线性插值） */
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
    world.set(bone.name, {
      name: bone.name, worldX, worldY,
      worldRot: Math.atan2(d, c) - Math.atan2(b, a),
      worldScaleX: Math.hypot(a, b), worldScaleY: Math.hypot(c, d),
      a, b, c, d,
    });
    for (const child of bone.children) compute(child);
  };
  for (const root of roots) compute(root);
  return world;
}

/** 获取 time 处插槽的绘制顺序 */
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

/**
 * 渲染一帧
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
  const anim = json.animations?.[animName];
  const fps = options.fps ?? 30;
  const time = options.time ?? (options.frameIndex !== undefined ? options.frameIndex / fps : 0);

  const bones = buildBoneTree(json);
  const local = new Map<string, any>();
  for (const b of bones.values()) {
    local.set(b.name, sampleBoneTimelines(anim, b.name, time, b));
  }
  const world = computeWorld(bones, local);
  const slots = json.slots ?? [];
  const drawOrder = computeDrawOrder(json, anim, time, slots);
  const defaultSkin = json.skins?.find((s: any) => s.name === "default") ?? json.skins?.[0] ?? { attachments: {} };

  // 收集合成项
  const composites: any[] = [];
  for (const slotName of drawOrder) {
    const slot = slots.find((s: any) => s.name === slotName);
    if (!slot || !slot.bone) continue;
    const boneW = world.get(slot.bone);
    if (!boneW) continue;
    const attName = activeAttachment(json, anim, slotName, time);
    if (!attName) continue;
    const att = defaultSkin.attachments?.[slotName]?.[attName];
    if (!att) continue;
    if (att.type === "region" || att.type === "mesh") {
      const region = findRegion(atlas, att.path ?? att.name ?? attName);
      if (!region) continue;
      // 读取 region 子图
      const rw = region.rotate ? region.height : region.width;
      const rh = region.rotate ? region.width : region.height;
      let sub = await sharp(imagePath).extract({ left: region.x, top: region.y, width: rw, height: rh }).png().toBuffer();
      const rot = boneW.worldRot + ((att.rotation ?? 0) * Math.PI) / 180;
      const sx = boneW.worldScaleX * (att.scaleX ?? 1);
      const sy = boneW.worldScaleY * (att.scaleY ?? 1);
      const dx = att.x ?? 0, dy = att.y ?? 0;
      // 附件在骨骼坐标系中的世界位置（用骨骼矩阵）
      const wx = boneW.a * dx + boneW.b * dy + boneW.worldX;
      const wy = boneW.c * dx + boneW.d * dy + boneW.worldY;
      let img = sharp(sub);
      if (Math.abs(sx - 1) > 1e-4 || Math.abs(sy - 1) > 1e-4) {
        img = img.resize({ width: Math.max(1, Math.round(rw * sx)), height: Math.max(1, Math.round(rh * sy)) });
      }
      if (Math.abs(rot) > 1e-4) {
        img = img.rotate((-rot * 180) / Math.PI);
      }
      const meta = await img.metadata();
      composites.push({
        input: await img.png().toBuffer(),
        left: Math.round(wx - (meta.width ?? 0) / 2),
        top: Math.round(wy - (meta.height ?? 0) / 2),
      });
    }
  }

  // 画布尺寸
  const skel = json.skeleton ?? {};
  let width = options.width ?? Math.max(1, Math.ceil(skel.width ?? 256));
  let height = options.height ?? Math.max(1, Math.ceil(skel.height ?? 256));
  // 居中
  const canvas = sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  const ox = skel.x ?? 0, oy = skel.y ?? 0;
  const shifted = composites.map((c) => ({ ...c, left: c.left + Math.round(width / 2 - ox), top: c.top + Math.round(height / 2 - oy) }));
  await canvas.composite(shifted).png().toFile(outputPath);

  return { width, height, animationName: animName, time, slots: composites.length };
}
