/**
 * 渲染可视化叠加服务：在渲染帧的 RGBA 上叠加骨骼线框/关节标记。
 * - 复用 render-service 的骨骼世界变换计算（buildBoneTree/computeWorld/sampleBoneTimelines 相同算法）
 * - 与自研软件光栅化共享同一套坐标原点（skeleton.x/y 居中偏移），叠加结果像素级对齐
 */
import sharp from "sharp";
import { ErrorCode, SpineError } from "../utils/error-codes";

const BONE_COLOR = [255, 90, 60, 255]; // 骨骼线：暖橙红
const JOINT_COLOR = [120, 200, 255, 255]; // 关节点：亮蓝

// —— 与 render-service 相同的骨骼世界变换计算（保持坐标一致）——
interface B2 {
  name: string; parent?: string; length: number; x: number; y: number;
  rotation: number; scaleX: number; scaleY: number; shearX: number; shearY: number; children: B2[];
}
interface W2 { worldX: number; worldY: number; a: number; b: number; c: number; d: number; }

function buildTree(json: any): Map<string, B2> {
  const map = new Map<string, B2>();
  for (const b of json.bones ?? []) {
    map.set(b.name, {
      name: b.name, parent: b.parent, length: b.length ?? 0,
      x: b.x ?? 0, y: b.y ?? 0, rotation: b.rotation ?? 0,
      scaleX: b.scaleX ?? 1, scaleY: b.scaleY ?? 1, shearX: b.shearX ?? 0, shearY: b.shearY ?? 0,
      children: [],
    });
  }
  for (const b of map.values()) if (b.parent && map.has(b.parent)) map.get(b.parent)!.children.push(b);
  return map;
}

function sampleTl(frames: any[], time: number, def: number): number {
  if (!frames || !frames.length) return def;
  let prev = frames[0];
  for (const f of frames) if ((f.time ?? 0) <= time + 1e-6) prev = f; else break;
  const next = frames.find((f) => (f.time ?? 0) > time + 1e-6);
  if (!next) return prev.angle ?? prev.value ?? prev.x ?? def;
  const t0 = prev.time ?? 0, t1 = next.time ?? t0;
  if (t1 === t0) return next.angle ?? next.value ?? next.x ?? def;
  const k = Math.min(1, Math.max(0, (time - t0) / (t1 - t0)));
  const v0 = prev.angle ?? prev.value ?? prev.x ?? def;
  const v1 = next.angle ?? next.value ?? next.x ?? def;
  return v0 + (v1 - v0) * k;
}

function computeLocal(anim: any, bones: Map<string, B2>, time: number): Map<string, { x: number; y: number; rotation: number; scaleX: number; scaleY: number; shearX: number; shearY: number }> {
  const out = new Map<string, any>();
  for (const b of bones.values()) {
    const tl = anim?.bones?.[b.name] ?? {};
    out.set(b.name, {
      x: sampleTl(tl.translate, time, b.x),
      y: sampleTl(tl.translate, time, b.y),
      rotation: sampleTl(tl.rotate, time, b.rotation),
      scaleX: sampleTl(tl.scale, time, b.scaleX),
      scaleY: sampleTl(tl.scale, time, b.scaleY),
      shearX: sampleTl(tl.shear, time, b.shearX),
      shearY: sampleTl(tl.shear, time, b.shearY),
    });
  }
  return out;
}

function computeWorld(bones: Map<string, B2>, local: Map<string, any>): Map<string, W2> {
  const world = new Map<string, W2>();
  const roots = [...bones.values()].filter((b) => !b.parent || !bones.has(b.parent));
  const compute = (bone: B2): void => {
    const l = local.get(bone.name)!;
    const parent = bone.parent && bones.has(bone.parent) ? world.get(bone.parent) : undefined;
    const rad = (l.rotation * Math.PI) / 180;
    const radX = (l.shearX * Math.PI) / 180;
    const cosR = Math.cos(rad), sinR = Math.sin(rad), cosS = Math.cos(radX), sinS = Math.sin(radX);
    const worldX = parent ? parent.a * l.x * l.scaleX + parent.b * l.y * l.scaleY + parent.worldX : l.x * l.scaleX;
    const worldY = parent ? parent.c * l.x * l.scaleX + parent.d * l.y * l.scaleY + parent.worldY : l.y * l.scaleY;
    world.set(bone.name, {
      worldX, worldY,
      a: cosR * cosS * l.scaleX,
      b: sinR * cosS * l.scaleX,
      c: cosR * sinS * l.scaleY - sinR * cosS * l.scaleY,
      d: sinR * sinS * l.scaleY + cosR * cosS * l.scaleY,
    });
    for (const child of bone.children) compute(child);
  };
  for (const root of roots) compute(root);
  return world;
}

export interface OverlayOptions {
  skeletonJson: any;
  animationName: string;
  time: number;
  width: number;
  height: number;
}

/** 将骨骼线框/关节叠加到已渲染的 RGBA 帧上（原地修改 frame，骨骼终点=世界坐标 + 世界旋转派生） */
export function overlayBonesOnFrame(frame: Uint8ClampedArray, width: number, height: number, opts: OverlayOptions): { lines: [number, number, number, number][]; joints: [number, number][] } {
  if (!frame || !frame.length) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "缺少渲染帧数据，无法叠加骨骼。");
  }
  const anim = opts.skeletonJson.animations?.[opts.animationName];
  const bones = buildTree(opts.skeletonJson);
  const local = computeLocal(anim ?? {}, bones, opts.time);
  const world = computeWorld(bones, local);
  const skel = opts.skeletonJson.skeleton ?? {};
  const ox = Math.round(opts.width / 2 - (skel.x ?? 0));
  const oy = Math.round(opts.height / 2 - (skel.y ?? 0));
  const toPx = (x: number, y: number): [number, number] => [Math.round(x + ox), Math.round(oy - y)];

  const lines: [number, number, number, number][] = [];
  const joints: [number, number][] = [];
  for (const b of bones.values()) {
    const w = world.get(b.name)!;
    const [jx, jy] = toPx(w.worldX, w.worldY);
    joints.push([jx, jy]);

    // 骨骼线终点：沿骨骼局部 X 轴（世界 a/b 方向）延伸 length
    const ex = b.length > 0 ? w.worldX + (w.a + w.b) : w.worldX;
    const ey = b.length > 0 ? w.worldY + (w.c + w.d) : w.worldY;
    const [exPx, eyPx] = toPx(ex, ey);
    if (b.length > 0) lines.push([jx, jy, exPx, eyPx]);
  }

  // 绘制（线：整数 Bresenham；点：5x5 实心 + 1px 描边）
  for (const [x0, y0, x1, y1] of lines) drawLine(frame, width, height, x0, y0, x1, y1, BONE_COLOR);
  for (const [jx, jy] of joints) drawDot(frame, width, height, jx, jy, JOINT_COLOR);

  return { lines, joints };
}

/** 整数点算法（dx>dy 主方向逐点） */
function drawLine(frame: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, x1: number, y1: number, color: number[]): void {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  /* eslint-disable no-constant-condition */
  for (;;) {
    if (x0 >= 0 && x0 < w && y0 >= 0 && y0 < h) setPx(frame, w, x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function drawDot(frame: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, color: number[]): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < w && y >= 0 && y < h) setPx(frame, w, x, y, color);
    }
  }
}

function setPx(frame: Uint8ClampedArray, w: number, x: number, y: number, color: number[]): void {
  const off = (y * w + x) * 4;
  frame[off] = color[0]; frame[off + 1] = color[1]; frame[off + 2] = color[2]; frame[off + 3] = color[3];
}

/** 把 RGBA buffer 解码为 Uint8ClampedArray（raw 同尺寸） */
export function rgbaToClamped(buf: Buffer, width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(buf.buffer, buf.byteOffset, width * height * 4);
}

export async function clampedToPng(arr: Uint8ClampedArray, width: number, height: number, outputPath: string): Promise<void> {
  await sharp(Buffer.from(arr.buffer, arr.byteOffset, arr.length), { raw: { width, height, channels: 4 } }).png().toFile(outputPath);
}