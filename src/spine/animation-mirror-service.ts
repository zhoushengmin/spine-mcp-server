/**
 * 动作镜像服务：把已有动画的时间轴镜像成新动画（右利手挥砍 → 左利手等）。
 * - 骨骼：rotate 角度取反、translate x 取反，曲线原样复制
 * - 插槽：附件名镜像（如 arm_l 附件 → arm_r 附件名），颜色原样
 * - 绘制顺序：插槽名镜像
 * - 不处理 IK/变换/路径/变形（复杂度高，镜像动作通常用不到）
 */
import { ErrorCode, SpineError } from "../utils/error-codes";
import { mirrorName } from "./mirror-service";

export interface MirrorAnimOptions {
  outputName?: string;
}

export interface MirrorAnimResult {
  source: string;
  output: string;
  bones: number;
  slots: number;
}

export function mirrorAnimation(json: any, sourceAnim: string, options: MirrorAnimOptions = {}): MirrorAnimResult {
  const src = json.animations?.[sourceAnim];
  if (!src) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画 "${sourceAnim}" 不存在。`);
  }
  let output = options.outputName ?? `mirror-${sourceAnim}`;
  const existing = Object.keys(json.animations ?? {});
  if (existing.includes(output)) {
    let i = 1;
    while (existing.includes(`${output}-${i}`)) i++;
    output = `${output}-${i}`;
  }
  json.animations ??= {};
  json.animations[output] = {};

  let boneCount = 0, slotCount = 0;
  const dst = json.animations[output];

  // 骨骼时间轴
  for (const [bone, tl] of Object.entries<any>(src.bones ?? {})) {
    const mirrored = mirrorName(bone);
    const targetBone = mirrored ?? bone;
    const outTl: Record<string, any> = {};
    for (const [axis, frames] of Object.entries(tl)) {
      if (!Array.isArray(frames)) continue;
      outTl[axis] = frames.map((f: any) => {
        const copy = { ...f };
        if (axis === "rotate" && typeof copy.angle === "number") copy.angle = -copy.angle;
        if (axis === "translate") {
          if (typeof copy.x === "number") copy.x = -copy.x;
        }
        if (axis === "shear" && typeof copy.x === "number") copy.x = -copy.x;
        return copy;
      });
    }
    dst.bones ??= {};
    dst.bones[targetBone] = outTl;
    boneCount++;
  }

  // 插槽时间轴
  for (const [slot, tl] of Object.entries<any>(src.slots ?? {})) {
    const mirrored = mirrorName(slot);
    const targetSlot = mirrored ?? slot;
    const outTl: Record<string, any> = {};
    for (const [axis, frames] of Object.entries(tl)) {
      if (!Array.isArray(frames)) continue;
      outTl[axis] = frames.map((f: any) => {
        const copy = { ...f };
        if (axis === "attachment" && typeof copy.name === "string") {
          const mn = mirrorName(copy.name);
          if (mn) copy.name = mn;
        }
        return copy;
      });
    }
    dst.slots ??= {};
    dst.slots[targetSlot] = outTl;
    slotCount++;
  }

  // 绘制顺序（插槽名镜像）
  const draworder = src.draworder ?? [];
  if (draworder.length) {
    dst.draworder = draworder.map((f: any) => {
      const copy = { ...f, offsets: (f.offsets ?? []).map((o: any) => ({ ...o, slot: mirrorName(o.slot) ?? o.slot })) };
      return copy;
    });
  }

  // 事件与时长
  if (src.events) dst.events = src.events;
  if (src.duration) dst.duration = src.duration;

  return { source: sourceAnim, output, bones: boneCount, slots: slotCount };
}
