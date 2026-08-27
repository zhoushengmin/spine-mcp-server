/**
 * 引用完整性校验服务：纯函数，输入骨架 JSON 返回问题列表。
 * 供 spine_validate_references 工具与 modify-service 修改后自动校验复用。
 */
export function validateJsonReferences(json: any): string[] {
  const issues: string[] = [];
  const boneNames = new Set((json.bones ?? []).map((b: any) => b.name));
  const slotNames = new Set((json.slots ?? []).map((s: any) => s.name));

  // 骨骼 parent 引用
  for (const b of json.bones ?? []) {
    if (b.parent && !boneNames.has(b.parent)) issues.push(`骨骼 "${b.name}" 的父骨骼 "${b.parent}" 不存在`);
  }
  // 插槽绑定的骨骼
  for (const s of json.slots ?? []) {
    if (s.bone && !boneNames.has(s.bone)) issues.push(`插槽 "${s.name}" 绑定的骨骼 "${s.bone}" 不存在`);
  }
  // 约束
  for (const type of ["ik", "transform", "path"] as const) {
    for (const c of json[type] ?? []) {
      for (const b of c.bones ?? []) {
        if (!boneNames.has(b)) issues.push(`${type}约束 "${c.name}" 引用的骨骼 "${b}" 不存在`);
      }
      if (c.target && (type === "ik" || type === "transform") && !boneNames.has(c.target)) {
        issues.push(`${type}约束 "${c.name}" 的目标 "${c.target}" 不存在`);
      }
    }
  }
  // 皮肤附件插槽引用
  const skins: any[] = Array.isArray(json.skins) ? json.skins : Object.entries(json.skins ?? {}).map(([name, v]) => ({ name, attachments: v }));
  for (const skin of skins) {
    for (const slotName of Object.keys(skin.attachments ?? {})) {
      if (!slotNames.has(slotName)) issues.push(`皮肤 "${skin.name}" 的附件插槽 "${slotName}" 不存在`);
    }
  }
  // 动画中的骨骼/插槽引用
  for (const [animName, anim] of Object.entries<any>(json.animations ?? {})) {
    for (const boneName of Object.keys(anim.bones ?? {})) {
      if (!boneNames.has(boneName)) issues.push(`动画 "${animName}" 时间轴骨骼 "${boneName}" 不存在`);
    }
    for (const slotName of Object.keys(anim.slots ?? {})) {
      if (!slotNames.has(slotName)) issues.push(`动画 "${animName}" 时间轴插槽 "${slotName}" 不存在`);
    }
  }
  // 事件
  const eventDefs = new Set(Object.keys(json.events ?? {}));
  for (const [animName, anim] of Object.entries<any>(json.animations ?? {})) {
    for (const f of anim.events ?? []) {
      if (f.name && !eventDefs.has(f.name)) issues.push(`动画 "${animName}" 使用了未定义事件 "${f.name}"`);
    }
  }
  return issues;
}
