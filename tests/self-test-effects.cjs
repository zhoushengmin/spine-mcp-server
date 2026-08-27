/**
 * 自测：spine_list_effects + spine_apply_effect（效果配方/一句话执行）+ 修改后自动引用校验
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { allTools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");
const { validateJsonReferences } = require("d:/cocos/spine-mcp-server/dist/spine/validate-service");
const { readJsonForExport } = require("d:/cocos/spine-mcp-server/dist/spine/modify-service");

const HERO = "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine";
const HERO_ATLAS = "D:/cocos/SpinePro3.8.75/examples/hero/export/hero.atlas";
const HERO_PNG = "D:/cocos/SpinePro3.8.75/examples/hero/export/hero.png";
const call = (name, args) => allTools.find((t) => t.name === name).execute(args);

let ok = 0, fail = 0;
const results = [];
function report(name, cond, detail = "") {
  if (cond) { ok++; results.push(`✅ ${name}`); }
  else { fail++; results.push(`❌ ${name} ${detail}`); }
}

(async () => {
  const work = path.join(os.tmpdir(), "effects-" + Date.now());
  fs.mkdirSync(work, { recursive: true });
  const junkAnim = [];
  try {
    // ===== 1. spine_list_effects 目录 =====
    let r = await call("spine_list_effects", {});
    report("list_effects 成功", r.success && Array.isArray(r.data?.effects), r.message);
    const names = (r.data?.effects ?? []).map((e) => e.name);
    report("目录含核心效果", ["walk", "attack", "idle", "switch-skin", "attack-impact", "jump-land"].every((n) => names.includes(n)), `names=${names.join(",")}`);
    report("目录含参数说明", r.data.effects.every((e) => Array.isArray(e.params)), "");

    // ===== 2. spine_apply_effect：动画 walk =====
    r = await call("spine_apply_effect", { projectPath: HERO, effect: "walk", animationName: "fx-walk", duration: 1 });
    junkAnim.push("fx-walk");
    report("apply walk 成功", r.success && r.data?.animationName === "fx-walk", r.message);
    report("apply 步骤记录", Array.isArray(r.data?.steps) && r.data.steps.some((s) => s.step === "generate-animation"), "");
    report("apply 自动校验无警告", Array.isArray(r.data?.warnings) && r.data.warnings.length === 0, `warnings=${r.data?.warnings?.join(",")}`);

    // ===== 3. spine_apply_effect：组合 attack-impact（含事件触发点）=====
    r = await call("spine_apply_effect", { projectPath: HERO, effect: "attack-impact", animationName: "fx-attack", duration: 0.6 });
    junkAnim.push("fx-attack");
    report("apply attack-impact 成功", r.success && r.data?.animationName === "fx-attack", r.message);
    report("组合含事件步骤", r.data?.steps?.some((s) => s.step === "add-event"), JSON.stringify(r.data?.steps));
    // 回读项目确认事件已写入
    const json = await readJsonForExport(HERO);
    const evts = json.animations?.["fx-attack"]?.events ?? [];
    report("事件 impact 已写入", evts.some((e) => e.name === "impact"), JSON.stringify(evts));

    // ===== 4. spine_apply_effect：换装 switch-skin =====
    r = await call("spine_apply_effect", { projectPath: HERO, effect: "switch-skin", skinName: "default" });
    report("apply switch-skin 成功", r.success && r.data?.steps?.some((s) => s.step === "set-default-skin"), r.message);
    // 负例：不存在的皮肤
    r = await call("spine_apply_effect", { projectPath: HERO, effect: "switch-skin", skinName: "no-such-skin" });
    report("switch-skin 未知皮肤报错", r.success === false && /皮肤 "no-such-skin" 不存在/.test(r.message), r.message);

    // ===== 5. 未知效果报错 =====
    r = await call("spine_apply_effect", { projectPath: HERO, effect: "fly" });
    report("未知效果报错", r.success === false && /未知效果/.test(r.message), r.message);

    // ===== 6. 预览（序列精灵图）=====
    const preview = path.join(work, "fx.png");
    r = await call("spine_apply_effect", { projectPath: HERO, effect: "walk", animationName: "fx-preview", duration: 0.5, previewPath: preview, atlasPath: HERO_ATLAS, imagePath: HERO_PNG, frames: 4 });
    junkAnim.push("fx-preview");
    report("apply 带预览成功", r.success && fs.existsSync(preview), r.message);

    // ===== 7. validate-service 纯函数 =====
    const bad = validateJsonReferences({
      bones: [{ name: "a", parent: "ghost" }],
      slots: [{ name: "s1", bone: "nope" }],
      skins: [{ name: "default", attachments: { "ghost-slot": {} } }],
      animations: { x: { bones: { a: {} }, slots: { ghost: {} }, events: [{ name: "e", time: 0 }] } },
      events: {},
    });
    report("validate 检出问题", bad.length >= 4, `issues=${bad.length}`);
    report("validate 干净骨架无问题", validateJsonReferences({ bones: [{ name: "root" }], slots: [], skins: [], animations: {} }).length === 0, "");
  } finally {
    // 清理 hero 上生成的 fx-* 动画
    const r = await call("spine_list_animations", { projectPath: HERO });
    const junk = (r?.data?.animations ?? []).filter((a) => a.name.startsWith("fx-"));
    for (const a of junk) {
      await call("spine_delete_animation", { projectPath: HERO, animationName: a.name });
    }
    // 清理测试自动创建的事件定义（无动画再引用时才删）
    const j = await readJsonForExport(HERO);
    const usedEvents = new Set();
    for (const anim of Object.values(j.animations ?? {})) {
      for (const e of anim.events ?? []) usedEvents.add(e.name);
    }
    for (const ev of ["impact", "land"]) {
      if (j.events?.[ev] !== undefined && !usedEvents.has(ev)) {
        delete j.events[ev];
      }
    }
    const { writeJsonFile, createTempDir, removeDir } = require("d:/cocos/spine-mcp-server/dist/utils/file-utils");
    const { exportProject } = require("d:/cocos/spine-mcp-server/dist/spine/export-service");
    const { importJsonInPlace } = require("d:/cocos/spine-mcp-server/dist/spine/import-service");
    const tmp = createTempDir("fx-clean-");
    try {
      const out = require("path").join(tmp, "export");
      require("fs").mkdirSync(out, { recursive: true });
      const files = await exportProject(HERO, out, { format: "json" });
      const jf = files.find((f) => f.endsWith(".json"));
      writeJsonFile(jf, j);
      await importJsonInPlace(HERO, jf, "test");
    } finally {
      removeDir(tmp);
    }
    const r2 = await call("spine_list_animations", { projectPath: HERO });
    const left = (r2?.data?.animations ?? []).filter((a) => a.name.startsWith("fx-")).length;
    report("清理后 hero 还原", left === 0, `left=${left}`);
  }

  console.log("\n===== effects 自测结果 =====");
  results.forEach((l) => console.log(l));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
