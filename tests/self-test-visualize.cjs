/**
 * 自测：spine_describe（看懂骨架）+ render_preview 可视化（sequence 序列 + wireframe 线框）
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");
const { allTools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");

const HERO = "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine";
const HERO_JSON = "D:/cocos/SpinePro3.8.75/examples/hero/export/hero-pro.json";
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
  const work = path.join(os.tmpdir(), "visualize-" + Date.now());
  fs.mkdirSync(work, { recursive: true });

  // ===== 1. spine_describe（.spine 项目）=====
  let r = await call("spine_describe", { projectPath: HERO });
  report("describe 项目成功", r.success, r.message);
  const d = r.data ?? {};
  report("describe 骨骼层级树", Array.isArray(d.bones?.tree) && d.bones.tree.length === d.bones.count, `count=${d.bones?.count}`);
  report("describe 角色建议", d.bones?.roleSuggestions?.thigh1 === "legL" && d.bones?.roleSuggestions?.head === "head", `thigh1=${d.bones?.roleSuggestions?.thigh1}`);
  report("describe 未映射骨骼", Array.isArray(d.bones?.unmapped) && d.bones.unmapped.length > 0, `unmapped=${d.bones?.unmapped?.join(",")}`);
  report("describe 插槽/皮肤/动画", d.slots.length > 0 && d.skins.length > 0 && d.animations.length >= 8, `slots=${d.slots.length}, skins=${d.skins.length}, anims=${d.animations.length}`);

  // ===== 2. spine_describe（导出 JSON）=====
  r = await call("spine_describe", { skeletonJson: HERO_JSON });
  report("describe JSON 成功", r.success && r.data?.bones?.count > 0, r.message);

  // ===== 3. render_preview sequence（官方 runtime）=====
  const seqOut = path.join(work, "seq.png");
  r = await call("spine_render_preview", { skeletonJson: HERO_JSON, atlasPath: HERO_ATLAS, imagePath: HERO_PNG, animationName: "walk", mode: "sequence", frames: 8, spriteColumns: 4, width: 160, height: 160, outputPath: seqOut });
  report("sequence 渲染成功", r.success && fs.existsSync(seqOut), r.message);
  if (fs.existsSync(seqOut)) {
    const meta = await sharp(seqOut).metadata();
    report("sequence 精灵图尺寸", meta.width === 4 * 160 && meta.height === 2 * 160, `${meta.width}x${meta.height}`);
  }

  // ===== 4. render_preview wireframe（frame 单帧 + 线框）=====
  const wfOut = path.join(work, "wf.png");
  r = await call("spine_render_preview", { skeletonJson: HERO_JSON, atlasPath: HERO_ATLAS, imagePath: HERO_PNG, animationName: "walk", time: 0.3, wireframe: true, outputPath: wfOut });
  report("wireframe 单帧", r.success && fs.existsSync(wfOut) && r.data?.wireframe === true, r.message);

  // ===== 5. render_preview sequence + wireframe =====
  const wfsOut = path.join(work, "wfs.png");
  r = await call("spine_render_preview", { skeletonJson: HERO_JSON, atlasPath: HERO_ATLAS, imagePath: HERO_PNG, animationName: "walk", mode: "sequence", frames: 4, wireframe: true, width: 160, height: 160, outputPath: wfsOut });
  report("sequence+wireframe", r.success && fs.existsSync(wfsOut), r.message);

  console.log("\n===== describe + 可视化自测结果 =====");
  results.forEach((l) => console.log(l));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
