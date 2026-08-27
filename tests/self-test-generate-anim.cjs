/**
 * 自测：spine_generate_animation（多骨骼模板自动生成动画）
 * 覆盖：hero 自动角色匹配(walk)、一次性模板(attack)、roleMap 显式映射、无匹配报错、未知模板、渲染验证、清理还原
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");
const { allTools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");
const { exportProject } = require("d:/cocos/spine-mcp-server/dist/spine/export-service");
const { createTempDir, removeDir } = require("d:/cocos/spine-mcp-server/dist/utils/file-utils");

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
  const work = path.join(os.tmpdir(), "gen-anim-" + Date.now());
  fs.mkdirSync(work, { recursive: true });
  try {
    await run(work);
  } finally {
    // 无论成功/异常，都清理 hero 上残留的 test-* 动画
    const { allTools: tools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");
    const r = await tools.find((t) => t.name === "spine_list_animations").execute({ projectPath: HERO });
    const junk = (r?.data?.animations ?? []).filter((a) => a.name.startsWith("test-"));
    for (const a of junk) {
      await tools.find((t) => t.name === "spine_delete_animation").execute({ projectPath: HERO, animationName: a.name });
    }
  }
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

async function run(work) {
  // ===== A. hero 自动角色匹配：walk =====
  let r = await call("spine_generate_animation", { projectPath: HERO, template: "walk", animationName: "test-walk", duration: 1 });
  report("generate walk 成功", r.success, r.message);
  const a = r.data ?? {};
  report("walk 驱动多骨骼", a.bones >= 6, `bones=${a.bones}`);
  report("walk 角色含左右腿", a.roles?.includes("legL") && a.roles?.includes("legR"), `roles=${a.roles?.join(",")}`);
  report("walk 关键帧充足", a.keyframes > 50, `keyframes=${a.keyframes}`);
  report("walk 关键帧写入贝塞尔曲线", a.curves > 0, `curves=${a.curves}`);

  // 读回 + 渲染验证
  r = await call("spine_list_animations", { projectPath: HERO });
  report("walk 已写入项目", r.data.animations.some((x) => x.name === "test-walk"), "");
  const expDir = createTempDir("gen-exp-");
  const files = await exportProject(HERO, expDir, { format: "json" });
  const heroJson = files.find((f) => f.endsWith(".json"));
  const renderOut = path.join(work, "walk.png");
  r = await call("spine_render_preview", { skeletonJson: heroJson, atlasPath: HERO_ATLAS, imagePath: HERO_PNG, animationName: "test-walk", time: 0.3, outputPath: renderOut, width: 256, height: 256 });
  report("walk 渲染帧", r.success && fs.existsSync(renderOut), r.message);
  removeDir(expDir);

  // ===== B. 一次性 attack（含 armR 挥砍）=====
  r = await call("spine_generate_animation", { projectPath: HERO, template: "attack", animationName: "test-attack", duration: 0.6 });
  report("attack 一次性生成", r.success && r.data?.roles?.includes("armR"), r.message);

  // ===== C1. 无匹配报错（服务层：无 root 且无角色关键字的骨架）=====
  const { generateAnimation } = require("d:/cocos/spine-mcp-server/dist/spine/animation-generate-service");
  let threw = false, errMsg = "";
  try {
    generateAnimation({ bones: [{ name: "bone-a" }, { name: "bone-b" }], animations: {} }, "idle");
  } catch (e) {
    threw = true;
    errMsg = e && e.message ? e.message : String(e);
  }
  report("无匹配报错", threw && /未匹配到任何骨骼/.test(errMsg), errMsg);

  // ===== C2. roleMap 显式映射（build_skeleton 的非标准骨骼名）=====
  const partsDir = path.join(work, "parts");
  fs.mkdirSync(partsDir, { recursive: true });
  const shapes = [["head", 40, 40, "#ff8fa3"], ["torso", 60, 90, "#ffb3c1"], ["arm_l", 24, 70, "#bde0fe"], ["leg_l", 28, 80, "#a2d2ff"]];
  for (const [n, w, h, c] of shapes) {
    await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${c}"/></svg>`), left: 0, top: 0 }])
      .png().toFile(path.join(partsDir, `${n}.png`));
  }
  const skelJson = path.join(work, "skel.json");
  const skelSpine = path.join(work, "skel.spine");
  r = await call("spine_build_skeleton", { partsDir, outputJsonPath: skelJson, importToProject: skelSpine, skeletonName: "test" });
  report("build_skeleton 造项目", r.success && fs.existsSync(skelSpine), r.message);

  r = await call("spine_generate_animation", { projectPath: skelSpine, template: "idle", roleMap: { "bone-0": "head", "bone-1": "torso", "bone-2": "armL", "bone-3": "legL" } });
  report("roleMap 显式映射", r.success && r.data?.bones >= 4 && r.data?.matched?.includes("bone-2"), `bones=${r.data?.bones}`);

  // ===== D. 负例：未知模板 =====
  r = await call("spine_generate_animation", { projectPath: HERO, template: "fly" });
  report("未知模板报错", r.success === false && /未知动画模板/.test(r.message), r.message);

  console.log("\n===== generate_animation 自测结果 =====");
  results.forEach((l) => console.log(l));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
}
