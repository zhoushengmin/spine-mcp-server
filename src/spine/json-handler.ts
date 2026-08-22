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
 * ⚠️ Spine 导出对 time=0 的关键帧会省略 time 字段（视为 0），查找时需兼容。
 * @returns 影响的关键帧数量（新建或更新均为 1）
 */
function upsertTimelineFrame(
  timeline: any[],
  time: number,
  defaults: Record<string, any>,
  changes: Record<string, any>
): number {
  const existing = timeline.find((f) => Math.abs((f.time ?? 0) - time) < 1e-6);
  if (existing) {
    Object.assign(existing, changes);
    return 1;
  }
  const frame = { time, ...defaults, ...changes };
  timeline.push(frame);
  timeline.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
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
      // 4. 网格变形时间轴 deform（Spine 3.8 键名，实测）：deform.<皮肤名>.<插槽名>
      //    兼容旧键名 ffd
      for (const deformKey of ["deform", "ffd"]) {
        const deform = anim[deformKey];
        if (deform && typeof deform === "object") {
          for (const [skinName, slotsMap] of Object.entries<any>(deform)) {
            if (oldName in slotsMap) {
              slotsMap[newName] = slotsMap[oldName];
              delete slotsMap[oldName];
            }
          }
        }
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

/**
 * 判断附件是否为权重网格（weighted mesh）。
 * 加权网格 vertices 格式（实测）：每顶点 = [boneCount, (boneIndex,x,y,weight)×boneCount, ...]，
 * 即每顶点以整数影响数开头，后跟 4×count 个值。
 */
function isWeightedMesh(att: any, boneCount: number): boolean {
  if (!att || att.type !== "mesh" || !Array.isArray(att.vertices)) return false;
  const v = att.vertices;
  let i = 0;
  let okGroups = 0;
  let groups = 0;
  while (i < v.length) {
    const count = v[i];
    if (!Number.isInteger(count) || count < 1) break;
    const need = 1 + count * 4;
    if (i + need > v.length) break;
    let valid = true;
    for (let k = 0; k < count; k++) {
      const bi = v[i + 1 + k * 4];
      if (!Number.isInteger(bi) || bi < 0 || bi >= boneCount) {
        valid = false;
        break;
      }
    }
    if (valid) okGroups++;
    groups++;
    i += need;
  }
  return groups > 0 && okGroups >= groups * 0.5;
}

/**
 * 删除骨骼（含子骨骼递归；移除关联插槽绑定）。
 * ⚠️ 若项目存在权重网格（weighted mesh），删除任何骨骼都会使其顶点骨骼索引失效，
 * 需要自动重排索引（Phase 4/5 提供），当前返回明确错误。
 */
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

  // 权重网格守卫：任何加权网格存在时禁止删除骨骼（骨骼索引会移位）
  const boneCount = (json.bones ?? []).length;
  for (const skin of skinsList(json)) {
    for (const slotAtts of Object.values<any>(skin.attachments ?? {})) {
      for (const att of Object.values<any>(slotAtts ?? {})) {
        if (isWeightedMesh(att, boneCount)) {
          throw new SpineError(
            ErrorCode.PART_TYPE_INVALID,
            `无法删除骨骼 "${name}"：项目包含权重网格（weighted mesh）附件。`,
            "删除骨骼会导致权重网格顶点的骨骼索引失效，自动重排索引能力将在后续版本提供；请先在 Spine 编辑器中处理相关网格。"
          );
        }
      }
    }
  }

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

/** 获取皮肤列表（兼容数组/对象格式），统一返回 [{name, attachments}] */
function skinsList(json: any): Array<{ name: string; attachments: any }> {
  if (Array.isArray(json.skins)) {
    return json.skins;
  }
  return Object.entries(json.skins ?? {}).map(([name, v]) => ({ name, attachments: v }));
}

/**
 * 设置插槽附件（换装）。skinName 缺省为 default。
 * - 非空：更新插槽默认附件为该名，并确保皮肤中有定义（已存在则保留原数据，不覆盖）
 * - 空串：隐藏（移除插槽默认附件与皮肤映射）
 * 校验：若皮肤中该插槽已有附件定义，目标附件名必须是其中一员，避免生成非法项目。
 */
export function setAttachment(json: any, slotName: string, attachmentName: string, skinName = "default"): void {
  const slot = findSlot(json, slotName);
  if (!slot) {
    throw new SpineError(ErrorCode.SLOT_NOT_FOUND, `插槽 "${slotName}" 不存在。`);
  }

  if (attachmentName !== "") {
    // 附件名校验
    const available = getSlotAttachmentNames(json, slotName, skinName);
    if (available.length > 0 && !available.includes(attachmentName)) {
      throw new SpineError(
        ErrorCode.ATTACHMENT_NOT_FOUND,
        `插槽 "${slotName}" 在皮肤 "${skinName}" 中不存在附件 "${attachmentName}"。`,
        `该插槽可用的附件有：${available.join("、")}。可先用 spine_get_attachments 查看，或用 spine_add_attachment 新增。`
      );
    }
    // 更新插槽默认附件
    slot.attachment = attachmentName;
  } else {
    delete slot.attachment;
  }

  const skinAttachments = ensureSkinAttachments(json, skinName);
  if (attachmentName === "") {
    delete skinAttachments[slotName];
  } else if (!skinAttachments[slotName]) {
    // 插槽在皮肤中尚无映射：新建（空定义，后续用 add_attachment 补充数据）
    skinAttachments[slotName] = { [attachmentName]: {} };
  } else if (!skinAttachments[slotName][attachmentName]) {
    // 有映射但目标附件不在其中：仅当无任何已知附件（新场景）时补空定义，否则应已被校验拦截
    if (Object.keys(skinAttachments[slotName]).length === 0) {
      skinAttachments[slotName][attachmentName] = {};
    }
  }
}

/** 获取某插槽在指定皮肤（缺省 default 兜底）中已定义的附件名列表 */
export function getSlotAttachmentNames(json: any, slotName: string, skinName = "default"): string[] {
  const read = (name: string): string[] => {
    const skin = findSkin(json, name);
    const atts = skin?.attachments?.[slotName];
    return atts ? Object.keys(atts) : [];
  };
  let names = read(skinName);
  if (names.length === 0 && skinName !== "default") {
    names = read("default");
  }
  return names;
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

/** 重命名骨骼（同步更新所有引用：parent / slots.bone / 动画 bones 键 / 约束 bones+target） */
export function renameBone(json: any, oldName: string, newName: string): void {
  if (!findBone(json, oldName)) {
    throw new SpineError(ErrorCode.BONE_NOT_FOUND, `骨骼 "${oldName}" 不存在。`);
  }
  // 1. bones 数组：name + parent
  for (const b of json.bones ?? []) {
    if (b.name === oldName) {
      b.name = newName;
    } else if (b.parent === oldName) {
      b.parent = newName;
    }
  }
  // 2. slots.bone
  for (const s of json.slots ?? []) {
    if (s.bone === oldName) {
      s.bone = newName;
    }
  }
  // 3. 动画 bones 时间轴键
  if (json.animations) {
    for (const anim of Object.values<any>(json.animations)) {
      if (anim.bones && oldName in anim.bones) {
        anim.bones[newName] = anim.bones[oldName];
        delete anim.bones[oldName];
      }
    }
  }
  // 4. 约束引用（ik / transform / path）
  for (const key of ["ik", "transform", "path"]) {
    for (const c of json[key] ?? []) {
      if (Array.isArray(c.bones)) {
        c.bones = c.bones.map((n: string) => (n === oldName ? newName : n));
      } else if (c.bone === oldName) {
        c.bone = newName;
      }
      if (c.target === oldName) {
        c.target = newName;
      }
    }
  }
}

/** 新增插槽（绑定到骨骼；可指定绘制顺序 order） */
export function addSlot(json: any, slotName: string, boneName: string, order?: number): void {
  if (findSlot(json, slotName)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `插槽 "${slotName}" 已存在。`);
  }
  if (!findBone(json, boneName)) {
    throw new SpineError(ErrorCode.BONE_NOT_FOUND, `骨骼 "${boneName}" 不存在。`);
  }
  const slot: any = { name: slotName, bone: boneName };
  if (order !== undefined) {
    slot.order = order;
  }
  json.slots ??= [];
  json.slots.push(slot);
}

/** 删除插槽（同步移除 skins / animations.slots / deform 中的引用） */
export function deleteSlot(json: any, slotName: string): void {
  if (!findSlot(json, slotName)) {
    throw new SpineError(ErrorCode.SLOT_NOT_FOUND, `插槽 "${slotName}" 不存在。`);
  }
  json.slots = (json.slots ?? []).filter((s: any) => s.name !== slotName);
  // skins
  if (json.skins) {
    if (Array.isArray(json.skins)) {
      for (const skin of json.skins) {
        if (skin?.attachments) {
          delete skin.attachments[slotName];
        }
      }
    } else {
      for (const [skinName, slotsMap] of Object.entries<any>(json.skins)) {
        delete slotsMap[slotName];
      }
    }
  }
  // animations.slots + deform
  if (json.animations) {
    for (const anim of Object.values<any>(json.animations)) {
      if (anim.slots) {
        delete anim.slots[slotName];
      }
      for (const deformKey of ["deform", "ffd"]) {
        const deform = anim[deformKey];
        if (deform && typeof deform === "object") {
          for (const [skinName, slotsMap] of Object.entries<any>(deform)) {
            delete slotsMap[slotName];
          }
        }
      }
    }
  }
}

/**
 * 批量重命名（正则匹配）。
 * @param targetType bone | slot
 * @returns 重命名的旧名列表
 */
export function batchRename(json: any, pattern: string, replacement: string, targetType: "bone" | "slot"): string[] {
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `无效的正则表达式：${pattern}`);
  }
  const renamed: string[] = [];
  if (targetType === "bone") {
    const names = (json.bones ?? []).map((b: any) => b.name);
    for (const oldName of names) {
      if (re.test(oldName)) {
        const newName = oldName.replace(re, replacement);
        if (newName !== oldName) {
          renameBone(json, oldName, newName);
          renamed.push(`${oldName} → ${newName}`);
        }
      }
    }
  } else if (targetType === "slot") {
    const names = (json.slots ?? []).map((s: any) => s.name);
    for (const oldName of names) {
      if (re.test(oldName)) {
        const newName = oldName.replace(re, replacement);
        if (newName !== oldName) {
          renameSlot(json, oldName, newName);
          renamed.push(`${oldName} → ${newName}`);
        }
      }
    }
  } else {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `targetType 必须是 bone 或 slot。`);
  }
  return renamed;
}

/** 确保皮肤存在（兼容数组/对象格式），返回 true=新建 */
export function ensureSkin(json: any, name: string): boolean {
  if (Array.isArray(json.skins)) {
    if (json.skins.some((s: any) => s?.name === name)) {
      return false;
    }
    json.skins.push({ name, attachments: {} });
    return true;
  }
  json.skins ??= {};
  if (json.skins[name]) {
    return false;
  }
  json.skins[name] = {};
  return true;
}

/** 新增皮肤 */
export function addSkin(json: any, name: string): void {
  if (!ensureSkin(json, name)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `皮肤 "${name}" 已存在。`);
  }
}

/** 重命名皮肤（同步更新 animations.deform 的皮肤键） */
export function renameSkin(json: any, oldName: string, newName: string): void {
  let exists = false;
  if (Array.isArray(json.skins)) {
    exists = json.skins.some((s: any) => s?.name === oldName);
  } else if (json.skins) {
    exists = oldName in json.skins;
  }
  if (!exists) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `皮肤 "${oldName}" 不存在。`);
  }
  if (Array.isArray(json.skins)) {
    const skin = json.skins.find((s: any) => s?.name === oldName);
    skin!.name = newName;
  } else {
    json.skins[newName] = json.skins[oldName];
    delete json.skins[oldName];
  }
  // 同步 deform 皮肤键
  if (json.animations) {
    for (const anim of Object.values<any>(json.animations)) {
      for (const deformKey of ["deform", "ffd"]) {
        const deform = anim[deformKey];
        if (deform && oldName in deform) {
          deform[newName] = deform[oldName];
          delete deform[oldName];
        }
      }
    }
  }
}

/** 删除皮肤（同步移除 animations.deform 引用） */
export function deleteSkin(json: any, name: string): void {
  if (name === "default") {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "不能删除 default 皮肤。");
  }
  let existed = false;
  if (Array.isArray(json.skins)) {
    const idx = json.skins.findIndex((s: any) => s?.name === name);
    if (idx >= 0) {
      json.skins.splice(idx, 1);
      existed = true;
    }
  } else if (json.skins && name in json.skins) {
    delete json.skins[name];
    existed = true;
  }
  if (!existed) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `皮肤 "${name}" 不存在。`);
  }
  if (json.animations) {
    for (const anim of Object.values<any>(json.animations)) {
      for (const deformKey of ["deform", "ffd"]) {
        const deform = anim[deformKey];
        if (deform && name in deform) {
          delete deform[name];
        }
      }
    }
  }
}

/** 设置默认皮肤：确保存在名为 default 的皮肤 */
export function setDefaultSkin(json: any, name = "default"): void {
  ensureSkin(json, name);
}
