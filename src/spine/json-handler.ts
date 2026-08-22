/**
 * JSON 处理器：对 Spine 3.8.75 导出 JSON 进行深度操作。
 * 所有函数直接修改传入的 json 对象（调用方负责写回文件）。
 *
 * Spine 3.8 动画时间轴结构：
 *   animations.<name>.bones.<boneName>.rotate[]   每帧 { time, angle }
 *   animations.<name>.bones.<boneName>.translate[] 每帧 { time, x, y }
 *   animations.<name>.bones.<boneName>.scale[]     每帧 { time, x, y }
 *   animations.<name>.bones.<boneName>.shear[]     每帧 { time, x, y }
 *   animations.<name>.slots.<slotName>.attachment[] 每帧 { time, name }
 *   animations.<name>.slots.<slotName>.color[]     每帧 { time, color }
 */
import { BoneInfo, BoneKeyframeChange } from "../types";
import { ErrorCode, SpineError } from "../utils/error-codes";

/** 帧序号 → 时间（秒） */
export function frameToTime(frameIndex: number, fps: number): number {
  return frameIndex / fps;
}

/** 查找骨骼（返回原始对象） */
export function findBone(json: any, name: string): any {
  return (json.bones ?? []).find((b: any) => b.name === name);
}

/** 查找插槽（返回原始对象） */
export function findSlot(json: any, name: string): any {
  return (json.slots ?? []).find((s: any) => s.name === name);
}

/** 构建骨骼树（带 children） */
export function getBoneTree(json: any): BoneInfo[] {
  const bones: BoneInfo[] = (json.bones ?? []).map((b: any) => ({
    name: b.name,
    parent: b.parent,
    length: b.length ?? 0,
    x: b.x ?? 0,
    y: b.y ?? 0,
    rotation: b.rotation ?? 0,
    scaleX: b.scaleX ?? 1,
    scaleY: b.scaleY ?? 1,
    shearX: b.shearX ?? 0,
    shearY: b.shearY ?? 0,
  }));
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

/** 获取骨骼 Setup 姿态（缺省值来源） */
function getSetupBone(json: any, name: string): any {
  return findBone(json, name) ?? {};
}

/**
 * 在时间轴数组中 upsert 一帧：存在同 time 帧则合并，否则按默认值新建并插入。
 * @returns 影响的关键帧数量（新建或更新均为 1）
 */
function upsertTimelineFrame(
  timeline: any[],
  time: number,
  defaults: Record<string, any>,
  changes: Record<string, any>
): number {
  const existing = timeline.find((f) => Math.abs(f.time - time) < 1e-6);
  if (existing) {
    Object.assign(existing, changes);
    return 1;
  }
  const frame = { time, ...defaults, ...changes };
  timeline.push(frame);
  timeline.sort((a, b) => a.time - b.time);
  return 1;
}

/**
 * 更新指定骨骼在动画中某时刻的关键帧。
 * @param json        Spine JSON 对象
 * @param animationName 动画名
 * @param boneName    骨骼名
 * @param time        时间（秒）
 * @param changes     要修改的变换
 * @returns 受影响的关键帧数量
 */
export function updateBoneKeyframe(
  json: any,
  animationName: string,
  boneName: string,
  time: number,
  changes: BoneKeyframeChange
): number {
  if (!json.animations?.[animationName]) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画 "${animationName}" 不存在。`, `可用 spine_list_animations 查看全部动画。`);
  }
  if (!findBone(json, boneName)) {
    throw new SpineError(ErrorCode.BONE_NOT_FOUND, `骨骼 "${boneName}" 不存在。`, "请检查名称拼写，可用 spine_get_project_info 查看骨骼列表。");
  }
  const setup = getSetupBone(json, boneName);
  const anim = json.animations[animationName];
  anim.bones ??= {};
  const boneTimelines = (anim.bones[boneName] ??= {});

  let affected = 0;

  // 旋转 → rotate 时间轴（字段 angle）
  if (changes.rotation !== undefined) {
    (boneTimelines.rotate ??= []);
    affected += upsertTimelineFrame(boneTimelines.rotate, time, { angle: setup.rotation ?? 0 }, { angle: changes.rotation });
  }

  // 位移 → translate 时间轴（字段 x/y）
  if (changes.x !== undefined || changes.y !== undefined) {
    (boneTimelines.translate ??= []);
    affected += upsertTimelineFrame(
      boneTimelines.translate,
      time,
      { x: setup.x ?? 0, y: setup.y ?? 0 },
      { ...(changes.x !== undefined ? { x: changes.x } : {}), ...(changes.y !== undefined ? { y: changes.y } : {}) }
    );
  }

  // 缩放 → scale 时间轴
  if (changes.scaleX !== undefined || changes.scaleY !== undefined) {
    (boneTimelines.scale ??= []);
    affected += upsertTimelineFrame(
      boneTimelines.scale,
      time,
      { x: setup.scaleX ?? 1, y: setup.scaleY ?? 1 },
      { ...(changes.scaleX !== undefined ? { x: changes.scaleX } : {}), ...(changes.scaleY !== undefined ? { y: changes.scaleY } : {}) }
    );
  }

  // 切变 → shear 时间轴
  if (changes.shearX !== undefined || changes.shearY !== undefined) {
    (boneTimelines.shear ??= []);
    affected += upsertTimelineFrame(
      boneTimelines.shear,
      time,
      { x: setup.shearX ?? 0, y: setup.shearY ?? 0 },
      { ...(changes.shearX !== undefined ? { x: changes.shearX } : {}), ...(changes.shearY !== undefined ? { y: changes.shearY } : {}) }
    );
  }

  return affected;
}

/** 查找皮肤（兼容数组 [{name,attachments}] 与 keyed 对象两种格式） */
function findSkin(json: any, skinName: string): any {
  if (Array.isArray(json.skins)) {
    return json.skins.find((s: any) => s?.name === skinName);
  }
  return json.skins?.[skinName];
}

/** 确保皮肤存在并返回其 attachments 映射（兼容两种格式） */
function ensureSkinAttachments(json: any, skinName: string): Record<string, any> {
  if (Array.isArray(json.skins)) {
    let skin = json.skins.find((s: any) => s?.name === skinName);
    if (!skin) {
      skin = { name: skinName, attachments: {} };
      json.skins.push(skin);
    }
    skin.attachments ??= {};
    return skin.attachments;
  }
  json.skins ??= {};
  return (json.skins[skinName] ??= {});
}

/** 重命名插槽（同步更新 slots / skins / animations.slots） */
export function renameSlot(json: any, oldName: string, newName: string): void {
  if (!findSlot(json, oldName)) {
    throw new SpineError(ErrorCode.SLOT_NOT_FOUND, `插槽 "${oldName}" 不存在。`);
  }
  // 1. slots 数组
  const slot = findSlot(json, oldName);
  slot.name = newName;
  // 2. skins（数组或对象两种格式）
  if (json.skins) {
    if (Array.isArray(json.skins)) {
      for (const skin of json.skins) {
        const map = skin?.attachments;
        if (map && oldName in map) {
          map[newName] = map[oldName];
          delete map[oldName];
        }
      }
    } else {
      for (const [skinName, slotsMap] of Object.entries<any>(json.skins)) {
        if (oldName in slotsMap) {
          slotsMap[newName] = slotsMap[oldName];
          delete slotsMap[oldName];
        }
      }
    }
  }
  // 3. animations.slots
  if (json.animations) {
    for (const anim of Object.values<any>(json.animations)) {
      if (anim.slots && oldName in anim.slots) {
        anim.slots[newName] = anim.slots[oldName];
        delete anim.slots[oldName];
      }
    }
  }
}

/** 新增骨骼（追加到 bones 数组） */
export function addBone(json: any, name: string, parent?: string, props: Partial<BoneInfo> = {}): void {
  if (findBone(json, name)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `骨骼 "${name}" 已存在。`);
  }
  if (parent && !findBone(json, parent)) {
    throw new SpineError(ErrorCode.BONE_NOT_FOUND, `父骨骼 "${parent}" 不存在。`);
  }
  json.bones ??= [];
  json.bones.push({
    name,
    parent,
    length: props.length ?? 0,
    x: props.x ?? 0,
    y: props.y ?? 0,
    rotation: props.rotation ?? 0,
    scaleX: props.scaleX ?? 1,
    scaleY: props.scaleY ?? 1,
    shearX: props.shearX ?? 0,
    shearY: props.shearY ?? 0,
  });
}

/** 删除骨骼（含子骨骼递归；移除关联插槽绑定，操作简单化：仅删骨骼与子骨骼） */
export function deleteBone(json: any, name: string): { removed: string[] } {
  if (!findBone(json, name)) {
    throw new SpineError(ErrorCode.BONE_NOT_FOUND, `骨骼 "${name}" 不存在。`);
  }
  // 收集自身 + 全部子孙
  const removed: string[] = [];
  const collect = (boneName: string): void => {
    removed.push(boneName);
    (json.bones ?? [])
      .filter((b: any) => b.parent === boneName)
      .forEach((b: any) => collect(b.name));
  };
  collect(name);
  const removedSet = new Set(removed);

  json.bones = (json.bones ?? []).filter((b: any) => !removedSet.has(b.name));

  // 移除绑在这些骨骼上的插槽
  json.slots = (json.slots ?? []).filter((s: any) => !removedSet.has(s.bone));

  // 清理动画中这些骨骼的时间轴
  if (json.animations) {
    for (const anim of Object.values<any>(json.animations)) {
      if (anim.bones) {
        for (const r of removed) {
          delete anim.bones[r];
        }
      }
    }
  }
  return { removed };
}

/**
 * 设置插槽附件（换装）。skinName 缺省为 default。
 * attachmentName 传空字符串表示隐藏该插槽附件。
 */
export function setAttachment(json: any, slotName: string, attachmentName: string, skinName = "default"): void {
  if (!findSlot(json, slotName)) {
    throw new SpineError(ErrorCode.SLOT_NOT_FOUND, `插槽 "${slotName}" 不存在。`);
  }
  const skinAttachments = ensureSkinAttachments(json, skinName);
  if (attachmentName === "") {
    delete skinAttachments[slotName];
  } else {
    skinAttachments[slotName] = { [attachmentName]: {} };
  }
}

/** 重命名动画 */
export function renameAnimation(json: any, oldName: string, newName: string): void {
  if (!json.animations?.[oldName]) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画 "${oldName}" 不存在。`);
  }
  if (json.animations[newName]) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画 "${newName}" 已存在。`);
  }
  json.animations[newName] = json.animations[oldName];
  delete json.animations[oldName];
}

/** 复制动画 */
export function duplicateAnimation(json: any, sourceName: string, newName: string): void {
  if (!json.animations?.[sourceName]) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `源动画 "${sourceName}" 不存在。`);
  }
  if (json.animations[newName]) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画 "${newName}" 已存在。`);
  }
  json.animations[newName] = JSON.parse(JSON.stringify(json.animations[sourceName]));
}

/** 删除动画 */
export function deleteAnimation(json: any, name: string): void {
  if (!json.animations?.[name]) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `动画 "${name}" 不存在。`);
  }
  delete json.animations[name];
}
