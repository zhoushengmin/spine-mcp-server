/**
 * 姿势→动画服务：把一组姿势关键帧（AI/用户给定）插值成平滑动画。
 * 每个姿势 = { time, bones: { 骨骼名: { rotation?, x?, y?, scaleY? } } }。
 * 逐骨骼按时间写入关键帧，非末帧加缓入缓出贝塞尔曲线。
 * 说明：同一骨骼在各姿势间请保持一致的轴，未提到的轴保持 Setup 姿态。
 */
import { ErrorCode, SpineError } from "../utils/error-codes";
import { updateBoneKeyframe } from "./json-handler";
import { applyEaseCurves } from "./animation-generate-service";

export interface PoseBone {
  rotation?: number;
  x?: number;
  y?: number;
  scaleY?: number;
}

export interface PoseFrame {
  time: number;
  bones: Record<string, PoseBone>;
}

export interface PoseOptions {
  animationName?: string;
  loop?: boolean;
}

export interface PoseResult {
  animationName: string;
  poses: number;
  bones: number;
  keyframes: number;
  curves: number;
  duration: number;
}

/** 姿势序列 → 动画（原地修改 json） */
export function poseToAnimation(json: any, poses: PoseFrame[], options: PoseOptions = {}): PoseResult {
  if (!Array.isArray(poses) || poses.length < 2) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "姿势序列至少需要 2 帧。", '格式：[{time:0,bones:{arm_r:{rotation:10}}},{time:0.3,bones:{arm_r:{rotation:-40}}}]');
  }
  for (const p of poses) {
    if (typeof p.time !== "number" || p.time < 0 || !p.bones || typeof p.bones !== "object") {
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `姿势帧缺少有效 time/bones：${JSON.stringify(p)}`);
    }
  }
  const sorted = [...poses].sort((a, b) => a.time - b.time);
  const duration = sorted[sorted.length - 1].time;

  // 动画名
  let name = options.animationName ?? "pose-anim";
  const existing = Object.keys(json.animations ?? {});
  if (existing.includes(name)) {
    let i = 1;
    while (existing.includes(`${name}-${i}`)) i++;
    name = `${name}-${i}`;
  }
  json.animations ??= {};
  json.animations[name] = {};

  // 收集每根骨骼的时间轴帧
  const boneFrames = new Map<string, Array<{ time: number; t: PoseBone }>>();
  for (const p of sorted) {
    for (const [bone, t] of Object.entries(p.bones)) {
      if (!(json.bones ?? []).some((b: any) => b.name === bone)) {
        throw new SpineError(ErrorCode.BONE_NOT_FOUND, `骨骼 "${bone}" 不存在。`, "可用 spine_get_project_info 查看骨骼名。");
      }
      if (!boneFrames.has(bone)) boneFrames.set(bone, []);
      boneFrames.get(bone)!.push({ time: p.time, t });
    }
  }
  if (!boneFrames.size) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "姿势序列中没有骨骼变换。");
  }

  let keyframes = 0;
  for (const [bone, frames] of boneFrames) {
    for (const f of frames) {
      keyframes += updateBoneKeyframe(json, name, bone, f.time, f.t);
    }
  }
  // 若需要循环，末帧补到等于首帧（time=duration）
  if (options.loop) {
    const first = sorted[0];
    for (const [bone, t] of Object.entries(first.bones)) {
      if (boneFrames.has(bone)) {
        keyframes += updateBoneKeyframe(json, name, bone, duration, t);
      }
    }
  }
  const curves = applyEaseCurves(json.animations[name]);

  return { animationName: name, poses: sorted.length, bones: boneFrames.size, keyframes, curves, duration };
}
