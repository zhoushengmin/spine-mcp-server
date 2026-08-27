/**
 * 自测：spine_pose_to_animation / spine_mirror_animation / spine_mix_animations / spine_check_project / spine_export_sheet / spine_pipeline
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");
const { allTools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");
const { exportProject } = require("d:/cocos/spine-mcp-server/dist/spine/export-service");
const { readJsonForExport } = require("d:/cocos/spine-mcp-server/dist/spine/modify-service");
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

async function makeRect(w, h, color, file) {
  await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${color}"/></svg>`), left: 0, top: 0 }])
    .png().toFile(file);
}

(async () => {
  const work = path.join(os.tmpdir(), "pipeplus-" + Date.now());
  fs.mkdirSync(work, { recursive: true });
  try {
    // ===== 1. spine_pose_to_animation（hero 上臂挥摆）=====
    let r = await call("spine_pose_to_animation", {
      projectPath: HERO,
      poses: [
        { time: 0, bones: { "upper-arm1": { rotation: 10 }, head: { rotation: 0 } } },
        { time: 0.4, bones: { "upper-arm1": { rotation: -60 }, head: { rotation: 5 } } },
        { time: 0.8, bones: { "upper-arm1": { rotation: 10 }, head: { rotation: 0 } } },
      ],
      animationName: "tst-pose", loop: true,
    });
    report("pose_to_animation 成功", r.success && r.data?.animationName === "tst-pose", r.message);
    report("pose 关键帧与曲线", r.data?.keyframes >= 3 && r.data?.curves > 0, JSON.stringify({ k: r.data?.keyframes, c: r.data?.curves }));

    // ===== 2. spine_mirror_animation（walk → 镜像版）=====
    await call("spine_generate_animation", { projectPath: HERO, template: "walk", animationName: "tst-walk", duration: 1 });
    r = await call("spine_mirror_animation", { projectPath: HERO, animationName: "tst-walk", outputName: "tst-walk-m" });
    report("mirror_animation 成功", r.success && r.data?.output === "tst-walk-m" && r.data?.bones > 0, r.message);
    // 校验镜像后角度取反
    const j = await readJsonForExport(HERO);
    const srcRot = j.animations["tst-walk"].bones["thigh1"]?.rotate?.[1]?.angle;
    const dstRot = j.animations["tst-walk-m"].bones["thigh2"]?.rotate?.[1]?.angle;
    report("mirror 角度取反", typeof srcRot === "number" && dstRot === -srcRot, `src=${srcRot} dst=${dstRot}`);

    // ===== 3. spine_mix_animations（idle → walk 过渡）=====
    r = await call("spine_mix_animations", { projectPath: HERO, fromAnimation: "idle", toAnimation: "tst-walk", duration: 0.4, outputName: "tst-mix" });
    report("mix_animations 成功", r.success && r.data?.animationName === "tst-mix" && r.data?.bones > 0, r.message);
    // 渲染验证
    const expDir = createTempDir("pipe-exp-");
    const files = await exportProject(HERO, expDir, { format: "json" });
    const heroJson = files.find((f) => f.endsWith(".json"));
    const mixOut = path.join(work, "mix.png");
    r = await call("spine_render_preview", { skeletonJson: heroJson, atlasPath: HERO_ATLAS, imagePath: HERO_PNG, animationName: "tst-mix", time: 0.2, outputPath: mixOut, width: 256, height: 256 });
    report("mix 渲染帧", r.success && fs.existsSync(mixOut), r.message);
    removeDir(expDir);

    // ===== 4. spine_check_project（项目体检）=====
    r = await call("spine_check_project", { projectPath: HERO });
    report("check_project 成功", r.success && r.data?.stats?.bones > 0, r.message);
    report("check 角色覆盖含模板", (r.data?.roleCoverage?.usableTemplates ?? []).includes("walk") && r.data?.roleCoverage?.mapped > 0, JSON.stringify(r.data?.roleCoverage));
    report("check atlas 找到", r.data?.atlas?.found === true, JSON.stringify(r.data?.atlas));
    report("check 无引用问题", r.data?.issues?.length === 0, JSON.stringify(r.data?.issues));

    // ===== 5. spine_export_sheet（精灵表）=====
    const sheetOut = path.join(work, "sheet.png");
    r = await call("spine_export_sheet", { projectPath: HERO, animationName: "idle", outputPath: sheetOut, fps: 12, width: 128, height: 128 });
    report("export_sheet 成功", r.success && fs.existsSync(sheetOut) && fs.existsSync(sheetOut.replace(/\.png$/, ".frames.json")), r.message);
    const sMeta = await sharp(sheetOut).metadata();
    const framesJson = JSON.parse(fs.readFileSync(sheetOut.replace(/\.png$/, ".frames.json"), "utf8"));
    report("export_sheet 尺寸/帧数", sMeta.width === framesJson.columns * framesJson.frameWidth && framesJson.frames.length >= 4, `${sMeta.width}x${sMeta.height}, frames=${framesJson.frames.length}`);

    // ===== 6. spine_pipeline（一键成片：散件PNG → 装配→镜像→walk→GIF）=====
    const scattered = path.join(work, "scattered.png");
    const svg = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="50" r="30" fill="#ff8fa3"/>
      <rect x="180" y="20" width="80" height="130" fill="#ffb3c1"/>
      <rect x="20" y="220" width="34" height="120" fill="#bde0fe"/>
      <rect x="110" y="260" width="90" height="120" fill="#a2d2ff"/>
      <rect x="300" y="180" width="30" height="100" fill="#cdb4db"/>
      <rect x="290" y="310" width="70" height="80" fill="#90e0ef"/>
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(scattered);
    const partsIndex = path.join(work, "partsIndex.json");
    fs.writeFileSync(partsIndex, JSON.stringify({
      parts: {
        "part-0": { name: "head", parent: "root", x: 0, y: 120, pivotX: 0.5, pivotY: 0.9, order: 3 },
        "part-1": { name: "torso", parent: "root", x: 0, y: 30, pivotX: 0.5, pivotY: 0.4, order: 2 },
        "part-2": { name: "arm_l", parent: "torso", x: -45, y: 55, pivotX: 0.5, pivotY: 0.9, order: 1 },
        "part-3": { name: "leg_l", parent: "torso", x: -12, y: -55, pivotX: 0.5, pivotY: 0.9, order: 1 },
        "part-4": { name: "forearm_l", parent: "arm_l", x: -15, y: -20, pivotX: 0.5, pivotY: 0.9, order: 1 },
        "part-5": { name: "shin_l", parent: "leg_l", x: 0, y: -110, pivotX: 0.5, pivotY: 0.9, order: 1 },
      },
    }));
    const proj = path.join(work, "pipeline.spine");
    const gifOut = path.join(work, "pipeline.gif");
    r = await call("spine_pipeline", { imagePath: scattered, partsIndexPath: partsIndex, effect: "walk", mirror: true, projectPath: proj, export: "gif", exportPath: gifOut, frames: 8, fps: 8, width: 160, height: 160 });
    report("pipeline 成功", r.success, r.message);
    const p = r.data ?? {};
    const stepNames = (p.steps ?? []).map((s) => s.step);
    report("pipeline 全流程", ["cut-parts", "assemble", "mirror", "generate-animation", "import", "export"].every((s) => stepNames.includes(s)), stepNames.join(","));
    report("pipeline 产出 .spine", fs.existsSync(proj), "");
    report("pipeline 产出 GIF", fs.existsSync(gifOut), "");
    if (fs.existsSync(gifOut)) {
      const gm = await sharp(gifOut).metadata();
      report("pipeline GIF 有效", gm.width > 0 && gm.pages >= 4, `pages=${gm.pages}`);
    }
    // 校验装配后的项目确实有动画
    r = await call("spine_list_animations", { projectPath: proj });
    report("pipeline 项目含动画", r.success && r.data.animations.length >= 1, JSON.stringify(r.data?.animations?.map((a) => a.name)));
  } finally {
    // 清理 hero 上的 tst-* 动画
    const r = await call("spine_list_animations", { projectPath: HERO });
    const junk = (r?.data?.animations ?? []).filter((a) => a.name.startsWith("tst-"));
    for (const a of junk) {
      await call("spine_delete_animation", { projectPath: HERO, animationName: a.name });
    }
  }

  console.log("\n===== pose/mirror/mix/check/sheet/pipeline 自测结果 =====");
  results.forEach((l) => console.log(l));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
