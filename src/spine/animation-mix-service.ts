/**
 * 动作混合服务：把两个动画交叉淡入成一个过渡动画（待机→攻击等，避免跳变）。
 * 输出动画在 t 时刻的值 = from(t)·(1-k) + to(t)·k，k = t/时长。
 */
import { ErrorCode, SpineError } from "../utils/error-codes";
import { updateBoneKeyframe } from "./json-handler";
import { applyEaseCurves } from "./animation-generate-service";

export interface MixOptions {
  duration?: number;
  fps?: number;
  outputName?: string;
}

export interface MixResult {
  animationName: string;
  from: string;
  to: string;
  duration: number;
  bones: number;
  keyframes: number;
}

interface Sample { x: number; y: number; rotation: number; scaleX: number; scaleY: number; shearX: number; shearY: number; }

function sampleTimeline(frames: any[], time: number, def: number): number {
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

function sampleBone(anim: any, bone: any, time: number): Sample {
  const tl = anim?.bones?.[bone.name] ?? {};
  return {
    x: sampleTimeline(tl.translate, time, bone.x ?? 0),
    y: sampleTimeline(tl.translate, time, bone.y ?? 0),
    rotation: sampleTimeline(tl.rotate, time, bone.rotation ?? 0),
    scaleX: sampleTimeline(tl.scale, time, bone.scaleX ?? 1),
    scaleY: sampleTimeline(tl.scale, time, bone.scaleY ?? 1),
    shearX: sampleTimeline(tl.shear, time, bone.shearX ?? 0),
    shearY: sampleTimeline(tl.shear, time, bone.shearY ?? 0),
  };
}

export function mixAnimations(json: any, fromName: string, toName: string, options: MixOptions = {}): MixResult {
  const from = json.animations?.[fromName];
  const to = json.animations?.[toName];
  if (!from) throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画 "${fromName}" 不存在。`);
  if (!to) throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画 "${toName}" 不存在。`);
  if (fromName === toName) throw new SpineError(ErrorCode.INVALID_ARGUMENT, "from 与 to 不能是同一个动画。");

  const duration = options.duration ?? 0.5;
  const fps = options.fps ?? 12;
  let output = options.outputName ?? `mix-${fromName}-${toName}`;
  const existing = Object.keys(json.animations ?? {});
  if (existing.includes(output)) {
    let i = 1;
    while (existing.includes(`${output}-${i}`)) i++;
    output = `${output}-${i}`;
  }
  json.animations ??= {};
  json.animations[output] = {};

  const bones = json.bones ?? [];
  const frames = Math.max(2, Math.round(duration * fps));
  let keyframes = 0;
  let boneCount = 0;
  for (const bone of bones) {
    let wrote = 0;
    for (let i = 0; i <= frames; i++) {
      const t = (i / frames) * duration;
      const k = i / frames;
      const a = sampleBone(from, bone, t);
      const b = sampleBone(to, bone, t);
      const blend = {
        rotation: a.rotation * (1 - k) + b.rotation * k,
        x: a.x * (1 - k) + b.x * k,
        y: a.y * (1 - k) + b.y * k,
        scaleX: a.scaleX * (1 - k) + b.scaleX * k,
        scaleY: a.scaleY * (1 - k) + b.scaleY * k,
        shearX: a.shearX * (1 - k) + b.shearX * k,
        shearY: a.shearY * (1 - k) + b.shearY * k,
      };
      wrote += updateBoneKeyframe(json, output, bone.name, t, blend);
    }
    if (wrote > 0) boneCount++;
    keyframes += wrote;
  }
  const curves = applyEaseCurves(json.animations[output]);

  return { animationName: output, from: fromName, to: toName, duration, bones: boneCount, keyframes };
}
