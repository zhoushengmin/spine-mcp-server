/**
 * 自测：spine_mirror_bones（镜像补全）+ spine_import_skin（新贴图换装）+ spine_mesh_wave（网格波动特效）
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

async function makePart(w, h, color, file) {
  await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${color}"/></svg>`), left: 0, top: 0 }])
    .png().toFile(file);
}

async function buildTempProject(work, names) {
  const partsDir = path.join(work, "parts");
  fs.mkdirSync(partsDir, { recursive: true });
  const index = {};
  for (const n of names) {
    await makePart(30, 50, "#ff8fa3", path.join(partsDir, `${n}.png`));
    index[n] = { bone: n };
  }
  fs.writeFileSync(path.join(partsDir, "partsIndex.json"), JSON.stringify(index));
  const proj = path.join(work, "t.spine");
  const r = await call("spine_build_skeleton", { partsDir, outputJsonPath: path.join(work, "t.json"), importToProject: proj, skeletonName: "test" });
  return { r, proj };
}

(async () => {
  const work = path.join(os.tmpdir(), "msw-" + Date.now());
  fs.mkdirSync(work, { recursive: true });

  // ===== 0. mirrorName 纯函数 =====
  const { mirrorName } = require("d:/cocos/spine-mcp-server/dist/spine/mirror-service");
  report("mirrorName 命名规则", mirrorName("arm_l") === "arm_r" && mirrorName("armL") === "armR" && mirrorName("thigh1") === "thigh2" && mirrorName("left-arm") === "right-arm", JSON.stringify([mirrorName("arm_l"), mirrorName("armL"), mirrorName("thigh1"), mirrorName("left-arm")]));

  // ===== 1. spine_mirror_bones（左半 → 补全右半）=====
  const mirror = await buildTempProject(work, ["head", "torso", "arm_l", "leg_l", "forearm_l", "shin_l"]);
  report("mirror 项目就绪", mirror.r.success && fs.existsSync(mirror.proj), mirror.r.message);
  let r = await call("spine_mirror_bones", { projectPath: mirror.proj });
  report("mirror_bones 成功", r.success && r.data?.mirrored?.length >= 4, JSON.stringify(r.data));
  const mirroredNames = r.data?.mirrored ?? [];
  report("mirror 补全右半", ["arm_r", "leg_r", "forearm_r", "shin_r"].every((n) => mirroredNames.includes(n)), mirroredNames.join(","));
  // 回读确认骨骼 + 插槽
  r = await call("spine_describe", { projectPath: mirror.proj });
  const d = r.data ?? {};
  const allBones = (d.bones?.tree ?? []).map((b) => b.name);
  report("mirror 骨骼已写入", allBones.includes("arm_r") && allBones.includes("leg_r"), "");
  const slotNames = (d.slots ?? []).map((s) => s.name);
  report("mirror 插槽已镜像", slotNames.includes("slot-arm_r"), slotNames.join(","));
  // 镜像后 generate_animation 自动匹配左右侧
  r = await call("spine_generate_animation", { projectPath: mirror.proj, template: "walk", animationName: "msw-walk" });
  report("mirror 后左右侧可驱动", r.success && r.data?.roles?.includes("armL") && r.data?.roles?.includes("armR") && r.data?.roles?.includes("legL") && r.data?.roles?.includes("legR"), `roles=${r.data?.roles?.join(",")}`);

  // ===== 2. spine_import_skin（新贴图换装）=====
  const skin = await buildTempProject(work, ["head", "torso", "arm_l", "leg_l"]);
  const outfit = path.join(work, "outfit");
  fs.mkdirSync(outfit, { recursive: true });
  await makePart(50, 80, "#123456", path.join(outfit, "torso.png")); // 新上衣贴图
  r = await call("spine_import_skin", { projectPath: skin.proj, skinName: "new", imagesDir: outfit });
  report("import_skin 成功", r.success && r.data?.slots?.includes("torso"), JSON.stringify(r.data));
  // 结构校验：新皮肤 + 附件引用 + 文件已复制
  const skinExpDir = createTempDir("msw-skin-exp-");
  const files = await exportProject(skin.proj, skinExpDir, { format: "json" });
  const j = JSON.parse(fs.readFileSync(files.find((f) => f.endsWith(".json")), "utf8"));
  const newSkin = (Array.isArray(j.skins) ? j.skins : Object.values(j.skins ?? {})).find((s) => s && s.name === "new");
  report("import_skin 皮肤已建", !!newSkin, "");
  // 附件引用：在任一插槽（精确名或 slot- 前缀）下找到指向新贴图的附件
  const refOk = Object.values(newSkin?.attachments ?? {}).some((atts) =>
    Object.values(atts).some((a) => /images\/sk_new_torso\.png/.test(a?.path ?? ""))
  );
  report("import_skin 附件引用", refOk, JSON.stringify(newSkin?.attachments));
  report("import_skin 贴图已复制", fs.existsSync(path.join(path.dirname(skin.proj), "images", "sk_new_torso.png")), "");
  removeDir(skinExpDir);
  // 换装切换
  r = await call("spine_apply_effect", { projectPath: skin.proj, effect: "switch-skin", skinName: "new" });
  report("import_skin 后切换皮肤", r.success, r.message);
  // 负例：插槽不存在
  fs.writeFileSync(path.join(outfit, "ghost.png"), fs.readFileSync(path.join(outfit, "torso.png")));
  r = await call("spine_import_skin", { projectPath: skin.proj, skinName: "bad", imagesDir: outfit });
  report("import_skin 未知插槽报错", r.success === false && /插槽 "ghost" 不存在/.test(r.message), r.message);

  // ===== 3. spine_mesh_wave（网格波动特效，hero 非加权网格 weapon/sword）=====
  r = await call("spine_mesh_wave", { projectPath: HERO, slotName: "weapon", attachmentName: "sword", animationName: "fx-wave", duration: 1, amplitude: 10 });
  report("mesh_wave 成功", r.success && r.data?.vertexCount === 4 && r.data?.animationName === "fx-wave", r.message);
  // 渲染验证（FFD 变形生效）
  const expDir = createTempDir("msw-exp-");
  const hfiles = await exportProject(HERO, expDir, { format: "json" });
  const heroJson = hfiles.find((f) => f.endsWith(".json"));
  const waveOut = path.join(work, "wave.png");
  r = await call("spine_render_preview", { skeletonJson: heroJson, atlasPath: HERO_ATLAS, imagePath: HERO_PNG, animationName: "fx-wave", time: 0.5, outputPath: waveOut, width: 256, height: 256 });
  report("mesh_wave 渲染帧", r.success && fs.existsSync(waveOut), r.message);
  removeDir(expDir);
  // 负例：非 mesh / 加权网格
  r = await call("spine_mesh_wave", { projectPath: HERO, slotName: "head", attachmentName: "head" });
  report("mesh_wave 加权网格报错", r.success === false && /加权/.test(r.message), r.message);

  // 清理 hero 上的 fx-wave 动画
  await call("spine_delete_animation", { projectPath: HERO, animationName: "fx-wave" });

  console.log("\n===== mirror + skin + wave 自测结果 =====");
  results.forEach((l) => console.log(l));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
