/**
 * Phase 3 自测：直接调用 21 个工具 handler。
 * 修改类工具在临时副本上执行，且每次修改后重新导出验证项目未被破坏。
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { allTools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");
const { exportProject } = require("d:/cocos/spine-mcp-server/dist/spine/export-service");
const { ensureDir, createTempDir, removeDir } = require("d:/cocos/spine-mcp-server/dist/utils/file-utils");

const GOBLINS = "D:/cocos/SpinePro3.8.75/examples/goblins/goblins-pro.spine";
const HERO = "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine";
const SRC = "D:/cocos/SpinePro3.8.75/examples/spineboy/spineboy-ess.spine";

let ok = 0, fail = 0;
const results = [];
function report(name, cond, detail = "") {
  if (cond) { ok++; results.push(`✅ ${name}`); }
  else { fail++; results.push(`❌ ${name} ${detail}`); }
}

/** 在临时副本上执行修改类工具，并回读验证项目完好（工具成功且可回读才算通过） */
async function withCopy(modifyFn) {
  const t = createTempDir("p3-");
  const copy = path.join(t, path.basename(GOBLINS));
  fs.copyFileSync(GOBLINS, copy);
  try {
    const success = await modifyFn(copy);
    // 回读验证：重新导出应成功
    const e = path.join(t, "verify");
    ensureDir(e);
    const files = await exportProject(copy, e, { format: "json" });
    return { valid: success && files.some((f) => f.endsWith(".json")), copy };
  } finally {
    removeDir(t);
  }
}

(async () => {
  const findTool = (name) => allTools.find((t) => t.name === name);
  const call = async (name, args) => {
    const tool = findTool(name);
    if (!tool) { report(`工具 ${name} 已注册`, false); return null; }
    return await tool.execute(args);
  };

  // ===== 1. 只读工具 =====
  let r = await call("spine_get_project_info", { projectPath: HERO });
  report("spine_get_project_info", r.success && r.data.bones?.length > 0 && r.data.slots?.length > 0, r.message);

  r = await call("spine_get_project_info", { projectPath: "Z:/nope.spine" });
  report("get_project_info 错误路径", !r.success && r.errorCode === "E_INVALID_ARGUMENT", JSON.stringify(r));

  r = await call("spine_inspect_json", { projectPath: HERO });
  report("spine_inspect_json", r.success && typeof r.data.tree === "string" && r.data.bones > 0, r.message);

  r = await call("spine_list_animations", { projectPath: HERO });
  report("spine_list_animations", r.success && r.data.animations.length === 8, r.message);

  // ===== 2. 导出/导入 =====
  const outDir = path.join(os.tmpdir(), "p3-export");
  r = await call("spine_export_animation", { projectPath: HERO, outputDir: outDir, format: "json" });
  report("spine_export_animation", r.success && r.data.files.length >= 1, r.message);
  const exportedJson = path.join(outDir, "hero-pro.json");

  const newProj = path.join(os.tmpdir(), "p3-import.spine");
  if (fs.existsSync(newProj)) fs.rmSync(newProj, { force: true });
  r = await call("spine_import_animation", { projectPath: newProj, jsonPath: exportedJson, skeletonName: "hero-pro" });
  report("spine_import_animation(新项目)", r.success && fs.existsSync(newProj), r.message);

  // ===== 3. 修改类（临时副本 + 回读验证）=====
  let v = await withCopy(async (copy) => {
    r = await call("spine_control_bone", { projectPath: copy, animationName: "walk", boneName: "root", frameIndex: 0, rotation: 15 });
    report("spine_control_bone", r.success && r.data.backupPath, r.message);
    return r.success;
  });
  report("control_bone 后项目可回读", v.valid);

  v = await withCopy(async (copy) => {
    r = await call("spine_add_simple_animation", { projectPath: copy, template: "walk", duration: 1.0, boneName: "root" });
    report("spine_add_simple_animation", r.success && r.data.animationName, r.message);
    return r.success;
  });
  report("add_simple_animation 后项目可回读", v.valid);

  v = await withCopy(async (copy) => {
    r = await call("spine_rename_slot", { projectPath: copy, oldName: "eyes", newName: "eyesX" });
    report("spine_rename_slot", r.success, r.message);
    return r.success;
  });
  report("rename_slot 后项目可回读", v.valid);

  v = await withCopy(async (copy) => {
    r = await call("spine_batch_rename", { projectPath: copy, pattern: "^left-", replacement: "L-", targetType: "bone" });
    report("spine_batch_rename", r.success && r.data.renamed.length > 0, r.message);
    return r.success;
  });
  report("batch_rename 后项目可回读", v.valid);

  // 用 spineboy（无权重网格）验证 add/delete_bone 正向
  {
    const t = createTempDir("p3-del-");
    const copy = path.join(t, "spineboy.spine");
    fs.copyFileSync(SRC, copy);
    try {
      r = await call("spine_add_bone", { projectPath: copy, name: "del-bone", parent: "root" });
      const added = r.success;
      r = await call("spine_delete_bone", { projectPath: copy, boneName: "del-bone" });
      report("spine_delete_bone(spineboy 正向)", added && r.success && r.data.removed.includes("del-bone"), r.message);
      // 回读
      const e = path.join(t, "verify"); ensureDir(e);
      const files = await exportProject(copy, e, { format: "json" });
      report("delete_bone 后 spineboy 可回读", files.some((f) => f.endsWith(".json")));
    } finally {
      removeDir(t);
    }
  }

  // 删除被权重网格引用的骨骼 → 应返回明确错误（文档化限制）
  v = await withCopy(async (copy) => {
    r = await call("spine_delete_bone", { projectPath: copy, boneName: "spear1" });
    report("delete_bone(权重网格守卫)", !r.success && r.data?.suggestion?.includes("权重网格"), r.message);
    return true; // 项目未被修改，回读应成功
  });
  report("守卫后项目可回读", v.valid);

  v = await withCopy(async (copy) => {
    r = await call("spine_add_slot", { projectPath: copy, slotName: "slot-new", boneName: "root" });
    report("spine_add_slot", r.success, r.message);
    return r.success;
  });
  report("add_slot 后项目可回读", v.valid);

  v = await withCopy(async (copy) => {
    r = await call("spine_delete_slot", { projectPath: copy, slotName: "eyes" });
    report("spine_delete_slot", r.success, r.message);
    return r.success;
  });
  report("delete_slot 后项目可回读", v.valid);

  // 换装：合法附件（right-hand 自身）成功；非法附件（dagger）明确报错
  v = await withCopy(async (copy) => {
    r = await call("spine_set_attachment", { projectPath: copy, slotName: "right-hand", attachmentName: "right-hand", skinName: "goblin" });
    report("spine_set_attachment(合法)", r.success, r.message);
    const ok1 = r.success;
    r = await call("spine_set_attachment", { projectPath: copy, slotName: "right-hand", attachmentName: "dagger", skinName: "goblin" });
    report("spine_set_attachment(非法名)", !r.success && r.errorCode === "E_ATTACHMENT_NOT_FOUND", r.message);
    return ok1;
  });
  report("set_attachment 后项目可回读", v.valid);

  v = await withCopy(async (copy) => {
    r = await call("spine_set_skin", { projectPath: copy, action: "create", skinName: "gold" });
    report("spine_set_skin(create)", r.success, r.message);
    r = await call("spine_set_skin", { projectPath: copy, action: "rename", skinName: "gold", newName: "platinum" });
    report("spine_set_skin(rename)", r.success, r.message);
    return r.success;
  });
  report("set_skin 后项目可回读", v.valid);

  v = await withCopy(async (copy) => {
    r = await call("spine_duplicate_animation", { projectPath: copy, sourceName: "walk", newName: "walk2" });
    report("spine_duplicate_animation", r.success, r.message);
    if (!r.success) return false;
    r = await call("spine_rename_animation", { projectPath: copy, oldName: "walk2", newName: "walk3" });
    report("spine_rename_animation", r.success, r.message);
    if (!r.success) return false;
    r = await call("spine_delete_animation", { projectPath: copy, animationName: "walk3" });
    report("spine_delete_animation", r.success, r.message);
    return r.success;
  });
  report("动画管理后项目可回读", v.valid);

  // ===== 4. clean（临时副本）=====
  v = await withCopy(async (copy) => {
    r = await call("spine_clean_animation", { projectPath: copy });
    report("spine_clean_animation", r.success, r.message);
    return r.success;
  });
  report("clean 后项目可回读", v.valid);

  // ===== 5. rollback（列备份）=====
  r = await call("spine_rollback", { projectPath: HERO });
  report("spine_rollback(列备份)", r.success, r.message);

  // ===== 6. render_preview（占位，应返回明确提示）=====
  r = await call("spine_render_preview", { projectPath: HERO, outputDir: path.join(os.tmpdir(), "p3-preview") });
  report("spine_render_preview(占位提示)", !r.success && r.data?.suggestion?.includes("Phase 4"), r.message);

  // ===== 7. 参数校验错误 =====
  r = await call("spine_control_bone", { projectPath: HERO, animationName: "walk", boneName: "root", frameIndex: -1 });
  report("参数校验(负数帧)", !r.success, r.message);

  console.log("\n===== 自测结果 =====");
  results.forEach((l) => console.log(l));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
