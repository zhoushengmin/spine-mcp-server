/**
 * Phase 4 自测：29 个高级工具。
 * 修改类在临时副本执行，并回读验证项目未被破坏。
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { allTools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");
const { exportProject } = require("d:/cocos/spine-mcp-server/dist/spine/export-service");
const { ensureDir, createTempDir, removeDir } = require("d:/cocos/spine-mcp-server/dist/utils/file-utils");

const GOBLINS = "D:/cocos/SpinePro3.8.75/examples/goblins/goblins-pro.spine";
const HERO = "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine";
const STRETCHY = "D:/cocos/SpinePro3.8.75/examples/stretchyman/stretchyman-pro.spine";
const SPINEBOY = "D:/cocos/SpinePro3.8.75/examples/spineboy/spineboy-ess.spine";

let ok = 0, fail = 0;
const results = [];
function report(name, cond, detail = "") {
  if (cond) { ok++; results.push(`✅ ${name}`); }
  else { fail++; results.push(`❌ ${name} ${detail}`); }
}

const findTool = (name) => allTools.find((t) => t.name === name);
const call = (name, args) => findTool(name).execute(args);

/** 在临时副本执行修改，成功后回读验证 */
async function withCopy(src, modifyFn) {
  const t = createTempDir("p4-");
  const copy = path.join(t, path.basename(src));
  fs.copyFileSync(src, copy);
  try {
    const success = await modifyFn(copy);
    const e = path.join(t, "verify"); ensureDir(e);
    const files = await exportProject(copy, e, { format: "json" });
    return { valid: success && files.some((f) => f.endsWith(".json")) };
  } finally {
    removeDir(t);
  }
}

(async () => {
  // ===== 1. 高级信息查询（只读）=====
  let r = await call("spine_list_events", { projectPath: SPINEBOY });
  report("spine_list_events", r.success && r.data.events.some((e) => e.name === "footstep"), r.message);

  r = await call("spine_list_constraints", { projectPath: STRETCHY });
  report("spine_list_constraints(stretchyman)", r.success && r.data.constraints.length >= 4, `${r.data?.constraints?.length} 个`);

  r = await call("spine_get_attachments", { projectPath: GOBLINS, skinName: "goblin" });
  report("spine_get_attachments", r.success && Object.keys(r.data.attachments).length > 0, r.message);

  r = await call("spine_get_animation_detail", { projectPath: HERO, animationName: "attack" });
  report("spine_get_animation_detail", r.success && r.data.detail.deform !== undefined, r.message);

  // ===== 2. Setup 属性 =====
  let v = await withCopy(GOBLINS, async (copy) => {
    r = await call("spine_set_bone", { projectPath: copy, boneName: "root", x: 5, y: 10 });
    report("spine_set_bone", r.success, r.message);
    r = await call("spine_set_slot", { projectPath: copy, slotName: "head", blend: "additive" });
    report("spine_set_slot", r.success, r.message);
    return r.success;
  });
  report("set-bone/slot 后项目可回读", v.valid);

  // ===== 3. 附件 =====
  v = await withCopy(GOBLINS, async (copy) => {
    r = await call("spine_add_attachment", { projectPath: copy, slotName: "head", name: "hat", type: "region", path: "goblin/head", width: 100, height: 100 });
    report("spine_add_attachment", r.success, r.message);
    if (!r.success) return false;
    r = await call("spine_set_attachment_transform", { projectPath: copy, slotName: "head", attachmentName: "hat", x: 10, y: 20 });
    report("spine_set_attachment_transform", r.success, r.message);
    r = await call("spine_delete_attachment", { projectPath: copy, slotName: "head", attachmentName: "hat" });
    report("spine_delete_attachment", r.success, r.message);
    return r.success;
  });
  report("附件操作后项目可回读", v.valid);

  // ===== 4. 网格 =====
  v = await withCopy(GOBLINS, async (copy) => {
    r = await call("spine_edit_mesh", { projectPath: copy, slotName: "head", attachmentName: "head", skinName: "goblin", mode: "setup", width: 60, height: 60 });
    report("spine_edit_mesh(setup)", r.success, r.message);
    return r.success;
  });
  report("edit_mesh(setup) 后项目可回读", v.valid);

  v = await withCopy(HERO, async (copy) => {
    r = await call("spine_edit_mesh", { projectPath: copy, slotName: "body", attachmentName: "body", mode: "deform", animationName: "attack", frameIndex: 0, deformVertices: [0, 0, 1, 1] });
    report("spine_edit_mesh(deform)", r.success, r.message);
    return r.success;
  });
  report("edit_mesh(deform) 后项目可回读", v.valid);

  // ===== 5. 约束 =====
  v = await withCopy(HERO, async (copy) => {
    r = await call("spine_add_ik", { projectPath: copy, name: "test-ik", bone: "thigh1", bone2: "shin1", target: "left-ankle" });
    report("spine_add_ik", r.success, r.message);
    if (!r.success) return false;
    r = await call("spine_set_ik", { projectPath: copy, name: "test-ik", mode: "setup", mix: 0.5 });
    report("spine_set_ik(setup)", r.success, r.message);
    r = await call("spine_set_ik", { projectPath: copy, name: "test-ik", mode: "animation", animationName: "idle", frameIndex: 5, mix: 0.8 });
    report("spine_set_ik(animation)", r.success, r.message);
    r = await call("spine_delete_ik", { projectPath: copy, name: "test-ik" });
    report("spine_delete_ik", r.success, r.message);
    return r.success;
  });
  report("IK 操作后项目可回读", v.valid);

  v = await withCopy(HERO, async (copy) => {
    r = await call("spine_add_transform", { projectPath: copy, name: "test-tf", bone: "thigh1", target: "left-ankle", translateMix: 0.5 });
    report("spine_add_transform", r.success, r.message);
    if (!r.success) return false;
    r = await call("spine_set_transform", { projectPath: copy, name: "test-tf", mode: "setup", translateMix: 0.9 });
    report("spine_set_transform(setup)", r.success, r.message);
    r = await call("spine_delete_transform", { projectPath: copy, name: "test-tf" });
    report("spine_delete_transform", r.success, r.message);
    return r.success;
  });
  report("变换约束后项目可回读", v.valid);

  v = await withCopy(STRETCHY, async (copy) => {
    r = await call("spine_add_path", { projectPath: copy, name: "test-path", bones: ["back-arm1", "back-arm2"], target: "back-arm-path" });
    report("spine_add_path", r.success, r.message);
    if (!r.success) return false;
    r = await call("spine_set_path", { projectPath: copy, name: "test-path", mode: "setup", position: 0.5 });
    report("spine_set_path(setup)", r.success, r.message);
    r = await call("spine_delete_path", { projectPath: copy, name: "test-path" });
    report("spine_delete_path", r.success, r.message);
    return r.success;
  });
  report("路径约束后项目可回读", v.valid);

  // ===== 6. 动画高级 =====
  v = await withCopy(GOBLINS, async (copy) => {
    r = await call("spine_control_slot", { projectPath: copy, animationName: "walk", slotName: "right-hand", frameIndex: 0, attachment: "right-hand" });
    report("spine_control_slot", r.success, r.message);
    return r.success;
  });
  report("control_slot 后项目可回读", v.valid);

  v = await withCopy(HERO, async (copy) => {
    r = await call("spine_control_constraint", { projectPath: copy, type: "ik", name: "left-leg", animationName: "idle", frameIndex: 0, mix: 0.6 });
    report("spine_control_constraint", r.success, r.message);
    return r.success;
  });
  report("control_constraint 后项目可回读", v.valid);

  v = await withCopy(GOBLINS, async (copy) => {
    r = await call("spine_add_event_keyframe", { projectPath: copy, animationName: "walk", time: 0.5, eventName: "footstep", intValue: 1 });
    report("spine_add_event_keyframe", r.success, r.message);
    r = await call("spine_set_draw_order", { projectPath: copy, animationName: "walk", time: 0.3, slots: ["head", "torso", "left-arm"] });
    report("spine_set_draw_order", r.success, r.message);
    r = await call("spine_set_curve", { projectPath: copy, animationName: "walk", timeline: "bones.torso.rotate", keyframeIndex: 0, curve: "stepped" });
    report("spine_set_curve", r.success, r.message);
    r = await call("spine_set_animation_settings", { projectPath: copy, animationName: "walk", duration: 2.0 });
    report("spine_set_animation_settings", r.success, r.message);
    return r.success;
  });
  report("事件/绘制/曲线/时长后项目可回读", v.valid);

  // ===== 7. 项目级 =====
  const newProj = path.join(os.tmpdir(), "p4-create.spine");
  if (fs.existsSync(newProj)) fs.rmSync(newProj, { force: true });
  r = await call("spine_create_project", { outputPath: newProj, skeletonName: "test-skel", width: 100, height: 100 });
  report("spine_create_project", r.success && fs.existsSync(newProj), r.message);

  v = await withCopy(GOBLINS, async (copy) => {
    r = await call("spine_scale_project", { projectPath: copy, scale: 0.5 });
    report("spine_scale_project", r.success, r.message);
    return r.success;
  });
  report("scale_project 后项目可回读", v.valid);

  v = await withCopy(GOBLINS, async (copy) => {
    r = await call("spine_add_attachment", { projectPath: copy, slotName: "head", name: "hat", type: "region", path: "goblin/head", width: 100, height: 100 });
    if (!r.success) return false;
    r = await call("spine_import_image", { projectPath: copy, imagePath: "goblin/torso", slotName: "head", attachmentName: "hat" });
    report("spine_import_image", r.success, r.message);
    return r.success;
  });
  report("import_image 后项目可回读", v.valid);

  // ===== 8. export_video（占位提示）=====
  r = await call("spine_export_video", { projectPath: GOBLINS, outputPath: path.join(os.tmpdir(), "p4-vid") });
  report("spine_export_video(占位)", !r.success, r.message);

  // ===== 9. delete_bone 权重网格重排（Phase 3 守卫解除验证）=====
  v = await withCopy(GOBLINS, async (copy) => {
    r = await call("spine_delete_bone", { projectPath: copy, boneName: "spear1" });
    report("delete_bone(权重网格项目·重排)", r.success, r.message);
    return r.success;
  });
  report("delete_bone 权重网格后项目可回读", v.valid);

  console.log("\n===== Phase 4 自测结果 =====");
  results.forEach((l) => console.log(l));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
