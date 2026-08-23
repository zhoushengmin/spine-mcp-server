/**
 * Phase 5 自测：split_atlas / repack_atlas / render_preview / build_skeleton / validate_references
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { allTools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");
const { exportProject } = require("d:/cocos/spine-mcp-server/dist/spine/export-service");
const { ensureDir, createTempDir, removeDir } = require("d:/cocos/spine-mcp-server/dist/utils/file-utils");
const sharp = require("sharp");

const GOBLINS_ATLAS = "D:/cocos/SpinePro3.8.75/examples/goblins/export/goblins.atlas";
const GOBLINS_PNG = "D:/cocos/SpinePro3.8.75/examples/goblins/export/goblins.png";
const HERO = "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine";

let ok = 0, fail = 0;
const results = [];
function report(name, cond, detail = "") {
  if (cond) { ok++; results.push(`✅ ${name}`); }
  else { fail++; results.push(`❌ ${name} ${detail}`); }
}
const call = (name, args) => allTools.find((t) => t.name === name).execute(args);

(async () => {
  // ===== 1. split_atlas =====
  const splitDir = path.join(os.tmpdir(), "p5-split-" + Date.now());
  let r = await call("spine_split_atlas", { atlasPath: GOBLINS_ATLAS, imagePath: GOBLINS_PNG, outputDir: splitDir, mode: "region" });
  report("split_atlas(region)", r.success && r.data.parts.length >= 30, `${r.data?.parts?.length} 个`);
  const firstPng = r.data?.parts?.[0]?.file;
  if (firstPng) {
    const meta = await sharp(firstPng).metadata();
    report("split_atlas 输出有效 png", meta.width > 0 && meta.height > 0, `${meta.width}x${meta.height}`);
  }

  const splitDir2 = path.join(os.tmpdir(), "p5-split2-" + Date.now());
  r = await call("spine_split_atlas", { atlasPath: GOBLINS_ATLAS, imagePath: GOBLINS_PNG, outputDir: splitDir2, mode: "split", minSize: 30 });
  report("split_atlas(split 连通域)", r.success && r.data.parts.length > 30, `${r.data?.parts?.length} 个`);

  // ===== 2. repack_atlas =====
  const repackDir = path.join(os.tmpdir(), "p5-repack-" + Date.now());
  const sampleParts = fs.readdirSync(splitDir).filter((f) => f.endsWith(".png")).slice(0, 8).map((f) => ({ name: f.replace(/\.png$/, ""), file: path.join(splitDir, f) }));
  r = await call("spine_repack_atlas", { images: sampleParts, outputDir: repackDir, atlasName: "test" });
  report("repack_atlas", r.success && fs.existsSync(r.data.atlasPath) && fs.existsSync(r.data.imagePath), r.message);
  if (r.success) {
    const atlasTxt = fs.readFileSync(r.data.atlasPath, "utf8");
    report("repack_atlas 格式正确", atlasTxt.includes("size:") && atlasTxt.includes("filter:") && sampleParts.every((p) => atlasTxt.includes(p.name)), "region 名应全部包含");
    const meta = await sharp(r.data.imagePath).metadata();
    report("repack_atlas 图集有效", meta.width > 0 && meta.height > 0, `${meta.width}x${meta.height}`);
  }

  // ===== 3. render_preview =====
  const expDir = createTempDir("p5-exp-");
  const files = await exportProject(HERO, expDir, { format: "json" });
  const heroJson = files.find((f) => f.endsWith(".json"));
  const heroAtlas = "D:/cocos/SpinePro3.8.75/examples/hero/export/hero.atlas";
  const heroPng = "D:/cocos/SpinePro3.8.75/examples/hero/export/hero.png";
  const renderOut = path.join(os.tmpdir(), "p5-render-" + Date.now() + ".png");
  r = await call("spine_render_preview", { skeletonJson: heroJson, atlasPath: heroAtlas, imagePath: heroPng, animationName: "idle", time: 0.2, outputPath: renderOut, width: 512, height: 512 });
  report("render_preview(idle)", r.success && fs.existsSync(renderOut), r.message);
  if (fs.existsSync(renderOut)) {
    const meta = await sharp(renderOut).metadata();
    report("render_preview 输出有效 png", meta.width === 512 && meta.height === 512, `${meta.width}x${meta.height}`);
  }

  // ===== 4. build_skeleton =====
  const skelJson = path.join(os.tmpdir(), "p5-skel-" + Date.now() + ".json");
  r = await call("spine_build_skeleton", { partsDir: splitDir, outputJsonPath: skelJson, skeletonName: "test", layout: "grid" });
  report("build_skeleton", r.success && r.data.bones > 1 && r.data.slots === r.data.attachments, r.message);
  if (r.success) {
    const j = JSON.parse(fs.readFileSync(skelJson, "utf8"));
    report("build_skeleton JSON 合法", j.skeleton?.spine === "3.8.75" && Array.isArray(j.bones) && Array.isArray(j.slots) && j.skins?.length === 1, "spine 版本/骨骼/插槽/皮肤");
  }
  // 导入生成 .spine 项目
  const skelSpine = path.join(os.tmpdir(), "p5-skel-" + Date.now() + ".spine");
  r = await call("spine_build_skeleton", { partsDir: splitDir, outputJsonPath: skelJson, importToProject: skelSpine, skeletonName: "test" });
  report("build_skeleton 导入 .spine", r.success && fs.existsSync(skelSpine), r.message);

  // ===== 5. validate_references =====
  r = await call("spine_validate_references", { projectPath: HERO });
  report("validate_references(hero 合法)", r.success && r.data.valid === true, r.message);
  const badJson = path.join(os.tmpdir(), "p5-bad-" + Date.now() + ".json");
  fs.writeFileSync(badJson, JSON.stringify({ skeleton: { spine: "3.8.75" }, bones: [{ name: "a", parent: "ghost" }], slots: [{ name: "s1", bone: "nope" }], skins: [{ name: "default", attachments: { "ghost-slot": {} } }], animations: {} }));
  r = await call("spine_validate_references", { projectPath: badJson });
  report("validate_references(发现问题)", r.success === false && r.data.issues.length >= 3, `${r.data?.issues?.length} 个问题`);

  // 清理
  removeDir(expDir);

  console.log("\n===== Phase 5 自测结果 =====");
  results.forEach((l) => console.log(l));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
