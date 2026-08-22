/**
 * 项目读取器：解析 Spine 3.8.75 导出 JSON → 结构化 SpineProjectInfo。
 * 骨架名/尺寸/帧率等仅存在于 .spine 项目的信息，可通过 info-service 补充传入。
 */
import * as fs from "fs";
import { BoneInfo, SlotInfo, SkinInfo, AnimationInfo, SpineProjectInfo } from "../types";
import { ErrorCode, SpineError } from "../utils/error-codes";
import { SUPPORTED_SPINE_VERSION } from "../constants";

/** 将原始 bone 对象映射为 BoneInfo */
function mapBone(raw: any): BoneInfo {
  return {
    name: raw.name,
    parent: raw.parent,
    length: raw.length ?? 0,
    x: raw.x ?? 0,
    y: raw.y ?? 0,
    rotation: raw.rotation ?? 0,
    scaleX: raw.scaleX ?? 1,
    scaleY: raw.scaleY ?? 1,
    shearX: raw.shearX ?? 0,
    shearY: raw.shearY ?? 0,
    transform: raw.transform,
    color: raw.color,
  };
}

/** 构建骨骼树（children 填充），返回顶层骨骼（无 parent） */
export function buildBoneTree(bones: BoneInfo[]): BoneInfo[] {
  const byName = new Map<string, BoneInfo>();
  bones.forEach((b) => byName.set(b.name, b));
  const roots: BoneInfo[] = [];
  bones.forEach((b) => {
    if (b.parent && byName.has(b.parent)) {
      const parent = byName.get(b.parent)!;
      (parent.children ??= []).push(b);
    } else {
      roots.push(b);
    }
  });
  return roots;
}

/** 计算动画时长与关键帧总数 */
function analyzeAnimation(anim: any): { duration: number; keyframeCount: number } {
  let duration = 0;
  let keyframeCount = 0;
  if (!anim || typeof anim !== "object") {
    return { duration, keyframeCount };
  }
  const walk = (obj: any): void => {
    if (Array.isArray(obj)) {
      // 时间轴数组，取最大 time
      for (const item of obj) {
        if (item && typeof item === "object") {
          if (typeof item.time === "number" && item.time > duration) {
            duration = item.time;
          }
          keyframeCount++;
        }
      }
      return;
    }
    if (obj && typeof obj === "object") {
      for (const k of Object.keys(obj)) {
        walk(obj[k]);
      }
    }
  };
  walk(anim);
  return { duration, keyframeCount };
}

/**
 * 解析 Spine 导出 JSON 内容。
 * @param json 已解析的 JSON 对象
 * @param extra 额外信息（骨架名/尺寸/fps，可选）
 */
export function parseProjectJson(
  json: any,
  extra: { skeletonName?: string; size?: { width: number; height: number }; fps?: number } = {}
): SpineProjectInfo {
  if (!json || typeof json !== "object") {
    throw new SpineError(ErrorCode.JSON_PARSE, "无效的 Spine JSON：内容不是对象。");
  }
  const version = json.skeleton?.spine ?? "unknown";

  const bones: BoneInfo[] = (json.bones ?? []).map(mapBone);

  const slots: SlotInfo[] = (json.slots ?? []).map((s: any) => ({
    name: s.name,
    bone: s.bone,
    attachment: s.attachment,
    color: s.color,
    blend: s.blend,
  }));

  // skins：Spine 3.8.75 导出为数组 [{name, attachments}]，兼容 keyed 对象格式
  const skins: SkinInfo[] = [];
  const collectSkin = (name: string, value: any): void => {
    const attachments: Record<string, string[]> = {};
    if (value && typeof value === "object") {
      for (const [slotName, slotAttachments] of Object.entries(value)) {
        attachments[slotName] = Object.keys((slotAttachments as any) ?? {});
      }
    }
    skins.push({ name, attachments });
  };
  if (Array.isArray(json.skins)) {
    for (const skin of json.skins) {
      if (skin && typeof skin === "object") {
        collectSkin(skin.name ?? "default", skin.attachments);
      }
    }
  } else if (json.skins && typeof json.skins === "object") {
    for (const [name, value] of Object.entries(json.skins)) {
      collectSkin(name, value);
    }
  }

  const animations: AnimationInfo[] = Object.entries(json.animations ?? {}).map(([name, anim]) => {
    const { duration, keyframeCount } = analyzeAnimation(anim);
    return { name, duration, keyframeCount };
  });

  const events: string[] = Object.keys(json.events ?? {});
  const images = json.skeleton?.images;

  const isSupported = version === SUPPORTED_SPINE_VERSION;
  const compatibilityWarning = isSupported
    ? undefined
    : `检测到当前 Spine 项目版本为 ${version}，本服务器主要针对 ${SUPPORTED_SPINE_VERSION} 优化，部分功能在非 ${SUPPORTED_SPINE_VERSION} 版本上可能无法正常工作。`;

  return {
    version,
    skeletonName: extra.skeletonName,
    bones,
    slots,
    skins,
    animations,
    events,
    images,
    size: extra.size,
    fps: extra.fps,
    compatibilityWarning,
  };
}

/** 读取 .json 文件并解析 */
export function readProjectJson(filePath: string, extra?: { skeletonName?: string }): SpineProjectInfo {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `无法读取文件：${filePath}`);
  }
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new SpineError(ErrorCode.JSON_PARSE, `JSON 解析失败：${filePath}`, "文件可能已损坏或不是有效 JSON。");
  }
  return parseProjectJson(json, extra);
}
