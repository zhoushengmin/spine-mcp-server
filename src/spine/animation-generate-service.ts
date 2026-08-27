/**
 * 动画生成服务：多骨骼模板 → 关键帧写入。
 * - 模板 = 角色(PoseFn) 映射，t01 ∈ [0,1]（一个完整动作周期）
 * - 循环模板(idle/breath/walk/run/wave) 用正弦/相位/位相组合
 * - 一次性模板(attack/jump) 用姿势关键帧插值
 * - 骨骼按名称自动匹配角色（支持 _l/_r/left/right/数字1/2 惯例），可用 roleMap 显式指定
 */
import { ErrorCode, SpineError } from "../utils/error-codes";
import { updateBoneKeyframe } from "./json-handler";

export type Role =
  | "root" | "torso" | "head" | "neck"
  | "armL" | "armR" | "forearmL" | "forearmR" | "handL" | "handR"
  | "legL" | "legR" | "shinL" | "shinR" | "footL" | "footR";

export interface BoneTransform {
  rotation?: number;
  x?: number;
  y?: number;
  scaleY?: number;
}

/** 模板函数：t01(0-1) → 各角色变换 */
export type PoseFn = (t01: number) => Partial<Record<Role, BoneTransform>>;

export interface GenerateOptions {
  animationName?: string;
  duration?: number;
  fps?: number;
  /** 骨骼名 → 角色 手动指定（覆盖自动匹配） */
  roleMap?: Record<string, Role>;
}

export interface GenerateResult {
  animationName: string;
  template: string;
  duration: number;
  bones: number;
  keyframes: number;
  curves: number;
  matched: string[];
  roles: string[];
}

const TAU = Math.PI * 2;
const sine = (amp: number, phase = 0): ((t: number) => number) => (t) => amp * Math.sin(TAU * t + phase);
const bob = (amp: number, phase = 0): ((t: number) => number) => (t) => -Math.abs(Math.sin(TAU * t + phase)) * amp;
const pos = (amp: number, phase = 0): ((t: number) => number) => (t) => Math.max(0, Math.sin(TAU * t + phase)) * amp;

/** 缓入缓出贝塞尔曲线（Spine 3.8 JSON 对象形式：curve=cx1, c2=cy1, c3=cx2, c4=cy2） */
const EASE = { curve: 0.33, c2: 0.33, c3: 0.67, c4: 0.67 };

/** 为动画骨骼时间轴所有"非末帧"写入默认贝塞尔曲线，使动作平滑 */
export function applyEaseCurves(anim: any): number {
  let n = 0;
  const boneTls = anim.bones ?? {};
  for (const tl of Object.values(boneTls) as any[]) {
    if (!tl || typeof tl !== "object") continue;
    for (const key of ["rotate", "translate", "scale", "shear"]) {
      const frames = tl[key];
      if (!Array.isArray(frames) || frames.length < 2) continue;
      for (let i = 0; i < frames.length - 1; i++) {
        if (frames[i].curve === undefined) {
          frames[i].curve = EASE.curve;
          frames[i].c2 = EASE.c2;
          frames[i].c3 = EASE.c3;
          frames[i].c4 = EASE.c4;
          n++;
        }
      }
    }
  }
  return n;
}

/** 姿势关键帧 → 线性插值 PoseFn */
function interpolate(poses: Array<{ t: number; b: Partial<Record<Role, BoneTransform>> }>): PoseFn {
  return (t01: number) => {
    if (t01 <= poses[0].t) return poses[0].b;
    const last = poses[poses.length - 1];
    if (t01 >= last.t) return last.b;
    for (let i = 0; i < poses.length - 1; i++) {
      const a = poses[i], c = poses[i + 1];
      if (t01 >= a.t && t01 <= c.t) {
        const k = c.t === a.t ? 0 : (t01 - a.t) / (c.t - a.t);
        const out: Partial<Record<Role, BoneTransform>> = {};
        const roles = [...new Set([...Object.keys(a.b), ...Object.keys(c.b)])] as Role[];
        for (const role of roles) {
          const A = a.b[role] ?? {};
          const C = c.b[role] ?? {};
          const bt: BoneTransform = {};
          const keys = [...new Set([...Object.keys(A), ...Object.keys(C)])] as Array<keyof BoneTransform>;
          for (const key of keys) {
            const av = A[key] ?? (key === "scaleY" ? 1 : 0);
            const cv = C[key] ?? (key === "scaleY" ? 1 : 0);
            bt[key] = av + (cv - av) * k;
          }
          out[role] = bt;
        }
        return out;
      }
    }
    return poses[0].b;
  };
}

/** 侧向判定：_l/-l/left/数字奇数 → L；_r/-r/right/数字偶数 → R（hero 用 1/2 惯例） */
export function sideOf(name: string): "L" | "R" | null {
  const n = name.toLowerCase();
  if (/(^|[-_ ])(l|left)($|[-_ ])/.test(n) || /left/.test(n) || /_l$|-l$| l$/.test(n) || /^l[-_]/.test(n)) return "L";
  if (/(^|[-_ ])(r|right)($|[-_ ])/.test(n) || /right/.test(n) || /_r$|-r$| r$/.test(n) || /^r[-_]/.test(n)) return "R";
  const m = n.match(/(\d+)$/);
  if (m) {
    return parseInt(m[1], 10) % 2 === 1 ? "L" : "R";
  }
  return null;
}

/** 骨骼名 → 角色自动匹配 */
export function detectRole(name: string): Role | null {
  const n = name.toLowerCase();
  if (n === "root" || /(^|[-_ ])root$/.test(n)) return "root";
  if (n.includes("forearm") || n.includes("lowerarm") || n.includes("lower_arm") || n.includes("elbow")) {
    return sideOf(name) === "L" ? "forearmL" : "forearmR";
  }
  if (n.includes("upperarm") || n.includes("upper_arm") || n.includes("arm")) {
    return sideOf(name) === "L" ? "armL" : "armR";
  }
  if (n.includes("hand")) return sideOf(name) === "L" ? "handL" : "handR";
  if (n.includes("thigh")) return sideOf(name) === "L" ? "legL" : "legR";
  if (n.includes("shin") || n.includes("calf") || n.includes("lowerleg") || n.includes("lower_leg")) {
    return sideOf(name) === "L" ? "shinL" : "shinR";
  }
  if (n.includes("foot") || n.includes("ankle")) return sideOf(name) === "L" ? "footL" : "footR";
  if (n.includes("leg")) return sideOf(name) === "L" ? "legL" : "legR";
  if (n.includes("head")) return "head";
  if (n.includes("neck")) return "neck";
  if (n.includes("torso") || n.includes("spine") || n.includes("chest") || n.includes("body") || n.includes("hip") || n.includes("pelvis") || n.includes("belly") || n.includes("waist")) {
    return "torso";
  }
  return null;
}

/** 全部模板（循环用正弦，一次性用姿势插值） */
export const TEMPLATES: Record<string, { fn: PoseFn; oneShot?: boolean; defaultDuration: number }> = {
  idle: {
    fn: (t) => ({
      root: { rotation: sine(1)(t) },
      torso: { rotation: sine(1.5)(t), scaleY: 1 + 0.015 * Math.sin(TAU * t) },
      head: { rotation: sine(2)(t) },
      neck: { rotation: sine(1)(t) },
      armL: { rotation: sine(3)(t) },
      armR: { rotation: sine(3, Math.PI)(t) },
      forearmL: { rotation: sine(2)(t) },
      forearmR: { rotation: sine(2, Math.PI)(t) },
      legL: { rotation: sine(1.5)(t) },
      legR: { rotation: sine(1.5, Math.PI)(t) },
    }),
    defaultDuration: 2,
  },
  breath: {
    fn: (t) => ({
      torso: { scaleY: 1 + 0.04 * Math.sin(TAU * t), y: -1.5 * Math.sin(TAU * t) },
      head: { y: -0.8 * Math.sin(TAU * t) },
    }),
    defaultDuration: 2,
  },
  walk: {
    fn: (t) => ({
      root: { y: bob(6)(t), rotation: sine(2)(t) },
      legL: { rotation: sine(28)(t) },
      legR: { rotation: sine(28, Math.PI)(t) },
      shinL: { rotation: pos(35)(t) },
      shinR: { rotation: pos(35, Math.PI)(t) },
      armL: { rotation: sine(18, Math.PI)(t) },
      armR: { rotation: sine(18)(t) },
      forearmL: { rotation: pos(15, Math.PI)(t) },
      forearmR: { rotation: pos(15)(t) },
      torso: { rotation: sine(2)(t), y: bob(3)(t) },
      head: { rotation: sine(1.5)(t) },
    }),
    defaultDuration: 1,
  },
  run: {
    fn: (t) => ({
      root: { y: bob(10)(t), rotation: sine(3)(t) },
      legL: { rotation: sine(45)(t) },
      legR: { rotation: sine(45, Math.PI)(t) },
      shinL: { rotation: pos(55)(t) },
      shinR: { rotation: pos(55, Math.PI)(t) },
      armL: { rotation: sine(35, Math.PI)(t) },
      armR: { rotation: sine(35)(t) },
      forearmL: { rotation: pos(40, Math.PI)(t) },
      forearmR: { rotation: pos(40)(t) },
      torso: { rotation: sine(4)(t), y: bob(5)(t) },
      head: { rotation: sine(2)(t) },
    }),
    defaultDuration: 0.8,
  },
  wave: {
    fn: (t) => ({
      armR: { rotation: 70 + sine(12)(t) },
      forearmR: { rotation: 30 + sine(18)(t) },
      head: { rotation: sine(5)(t) },
      torso: { rotation: sine(3)(t) },
      root: { y: bob(3)(t) },
    }),
    defaultDuration: 2,
  },
  attack: {
    fn: interpolate([
      { t: 0.0, b: { armR: { rotation: -20 }, forearmR: { rotation: -30 }, torso: { rotation: 0 }, legR: { rotation: 10 }, root: { y: 0 } } },
      { t: 0.25, b: { armR: { rotation: -90 }, forearmR: { rotation: -60 }, torso: { rotation: -8 }, legR: { rotation: 30 }, root: { y: -4 } } },
      { t: 0.45, b: { armR: { rotation: 70 }, forearmR: { rotation: 80 }, torso: { rotation: 6 }, legR: { rotation: -15 }, root: { y: -8 } } },
      { t: 0.7, b: { armR: { rotation: 25 }, forearmR: { rotation: 35 }, torso: { rotation: 0 }, legR: { rotation: 0 }, root: { y: -3 } } },
      { t: 1.0, b: { armR: { rotation: 0 }, forearmR: { rotation: 0 }, torso: { rotation: 0 }, legR: { rotation: 0 }, root: { y: 0 } } },
    ]),
    oneShot: true,
    defaultDuration: 0.6,
  },
  jump: {
    fn: interpolate([
      { t: 0.0, b: { root: { y: 0 }, legL: { rotation: 0 }, legR: { rotation: 0 }, armL: { rotation: -20 }, armR: { rotation: -20 } } },
      { t: 0.15, b: { root: { y: 0 }, legL: { rotation: -25 }, legR: { rotation: -25 }, armL: { rotation: -40 }, armR: { rotation: -40 } } },
      { t: 0.4, b: { root: { y: -90 }, legL: { rotation: 45 }, legR: { rotation: 45 }, armL: { rotation: 50 }, armR: { rotation: 50 } } },
      { t: 0.6, b: { root: { y: -40 }, legL: { rotation: 20 }, legR: { rotation: 20 }, armL: { rotation: 20 }, armR: { rotation: 20 } } },
      { t: 0.75, b: { root: { y: -6 }, legL: { rotation: -30 }, legR: { rotation: -30 }, armL: { rotation: -30 }, armR: { rotation: -30 } } },
      { t: 1.0, b: { root: { y: 0 }, legL: { rotation: 0 }, legR: { rotation: 0 }, armL: { rotation: -20 }, armR: { rotation: -20 } } },
    ]),
    oneShot: true,
    defaultDuration: 0.8,
  },
};

/**
 * 向骨架 JSON 中生成指定模板动画。
 * @param json         骨架 JSON（原地修改）
 * @param templateName 模板名
 */
export function generateAnimation(json: any, templateName: string, options: GenerateOptions = {}): GenerateResult {
  const tpl = TEMPLATES[templateName];
  if (!tpl) {
    throw new SpineError(
      ErrorCode.INVALID_ARGUMENT,
      `未知动画模板：${templateName}`,
      `可用模板：${Object.keys(TEMPLATES).join("、")}。`
    );
  }
  const duration = options.duration ?? tpl.defaultDuration;
  const fps = options.fps ?? (tpl.oneShot ? 12 : 8);

  let name = options.animationName ?? `${templateName}-auto`;
  const existing = Object.keys(json.animations ?? {});
  if (existing.includes(name)) {
    let i = 1;
    while (existing.includes(`${name}-${i}`)) i++;
    name = `${name}-${i}`;
  }
  json.animations ??= {};
  json.animations[name] = {};

  // 骨骼 → 角色 匹配
  const bones = (json.bones ?? []).filter((b: any) => b && b.name);
  const mapping: Array<{ bone: string; role: Role }> = [];
  for (const b of bones) {
    const role = (options.roleMap && options.roleMap[b.name]) || detectRole(b.name);
    if (role) mapping.push({ bone: b.name, role });
  }
  if (!mapping.length) {
    throw new SpineError(
      ErrorCode.INVALID_ARGUMENT,
      `未匹配到任何骨骼，无法生成动画 "${name}"`,
      "可用 roleMap 显式指定骨骼→角色（如 {\"arm_r\":\"armR\"}），或使用标准命名的骨架（含 head/torso/arm/leg 等关键字）。"
    );
  }

  const frames = Math.max(2, Math.round(duration * fps));
  let keyframes = 0;
  const matchedBones = new Set<string>();
  const rolesUsed = new Set<string>();
  for (let i = 0; i <= frames; i++) {
    const t = (i / frames) * duration;
    const t01 = i / frames;
    const pose = tpl.fn(t01);
    for (const { bone, role } of mapping) {
      const bt = pose[role];
      if (bt) {
        keyframes += updateBoneKeyframe(json, name, bone, t, bt);
        matchedBones.add(bone);
        rolesUsed.add(role);
      }
    }
  }
  // 关键帧写入缓入缓出贝塞尔曲线，动作更自然
  const curves = applyEaseCurves(json.animations[name]);

  return {
    animationName: name,
    template: templateName,
    duration,
    bones: matchedBones.size,
    keyframes,
    curves,
    matched: [...matchedBones],
    roles: [...rolesUsed],
  };
}
