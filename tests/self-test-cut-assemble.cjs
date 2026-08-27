/**
 * 自测：spine_cut_parts + spine_assemble（随机位置散件 → 切割 → AI装配 → 骨架 + 拼接预览 + 导入）
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");
const { allTools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");

const call = (name, args) => allTools.find((t) => t.name === name).execute(args);

let ok = 0, fail = 0;
const results = [];
function report(name, cond, detail = "") {
  if (cond) { ok++; results.push(`✅ ${name}`); }
  else { fail++; results.push(`❌ ${name} ${detail}`); }
}

(async () => {
  const work = path.join(os.tmpdir(), "cut-assemble-" + Date.now());
  fs.mkdirSync(work, { recursive: true });

  // ===== 0. 合成"随机位置散件"透明 PNG（6 个互不重叠的彩色形状）=====
  const srcImage = path.join(work, "scattered.png");
  const svg = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="50" r="30" fill="#ff8fa3"/>
    <rect x="180" y="20" width="80" height="130" fill="#ffb3c1"/>
    <rect x="20" y="220" width="34" height="120" fill="#bde0fe"/>
    <rect x="300" y="180" width="30" height="100" fill="#cdb4db"/>
    <rect x="110" y="260" width="90" height="120" fill="#a2d2ff"/>
    <rect x="290" y="310" width="70" height="80" fill="#90e0ef"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(srcImage);

  // ===== 1. spine_cut_parts =====
  const cutDir = path.join(work, "cut");
  let r = await call("spine_cut_parts", { imagePath: srcImage, outputDir: cutDir });
  report("cut_parts 成功", r.success && r.data.parts.length === 6, `${r.data?.parts?.length} 个`);
  const parts = r.data?.parts ?? [];
  report("cut_parts 蒙太奇存在", fs.existsSync(path.join(cutDir, "parts-montage.png")), "");
  report("cut_parts partsMeta 存在", fs.existsSync(r.data?.metaFile), r.data?.metaFile);
  const meta = JSON.parse(fs.readFileSync(r.data.metaFile, "utf8"));
  report("partsMeta 结构", meta.baseDir === cutDir && meta.parts.length === 6, `baseDir=${meta.baseDir}`);
  // 每个部件 PNG 有效
  const partFiles = parts.filter((p) => fs.existsSync(p.file));
  report("cut_parts 部件 PNG 全部写出", partFiles.length === 6, `${partFiles.length}/6`);

  // ===== 2. 生成 AI 装配索引 partsIndex.json =====
  const index = {
    parts: {
      "part-0": { name: "head", parent: "root", x: 0, y: 120, pivotX: 0.5, pivotY: 0.9, order: 3 },
      "part-1": { name: "torso", parent: "root", x: 0, y: 30, pivotX: 0.5, pivotY: 0.4, order: 2 },
      "part-2": { name: "arm_l", parent: "torso", x: -45, y: 55, pivotX: 0.5, pivotY: 0.9, order: 1 },
      "part-3": { name: "forearm_l", parent: "arm_l", x: -15, y: -20, pivotX: 0.5, pivotY: 0.9, order: 1 },
      "part-4": { name: "thigh_l", parent: "torso", x: -12, y: -55, pivotX: 0.5, pivotY: 0.9, order: 1 },
      "part-5": { name: "calf_l", parent: "thigh_l", x: 0, y: -110, pivotX: 0.5, pivotY: 0.9, order: 1 },
    },
  };
  const indexPath = path.join(work, "partsIndex.json");
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  // ===== 3. spine_assemble（骨架 + 拼接预览）=====
  const skelJson = path.join(work, "assembled.json");
  const preview = path.join(work, "assembled-preview.png");
  r = await call("spine_assemble", {
    partsMetaPath: r.data.metaFile,
    assembleIndexPath: indexPath,
    outputJsonPath: skelJson,
    skeletonName: "test",
    outputPreview: preview,
  });
  report("assemble 成功", r.success, r.message);
  const a = r.data ?? {};
  report("assemble 骨架计数", a.bones === 7 && a.slots === 6 && a.attachments === 6, `${a.bones}/${a.slots}/${a.attachments}`);

  // 骨架 JSON 校验
  const j = JSON.parse(fs.readFileSync(skelJson, "utf8"));
  const boneNames = j.bones.map((b) => b.name);
  const slotNames = j.slots.map((s) => s.name);
  report("assemble JSON 层级", j.skeleton?.spine === "3.8.75" && j.bones.some((b) => b.name === "forearm_l" && b.parent === "arm_l"), "parent 层级");
  report("assemble slot 绑定 bone", j.slots.every((s) => boneNames.includes(s.bone)), "");
  const skinAtts = j.skins[0].attachments;
  report("assemble 附件齐全", Object.keys(skinAtts).length === 6 && j.slots.every((s) => skinAtts[s.name]), "");
  // 枢轴 → 附件偏移校验：head w=60,h=60,pivotY=0.9 → y=60*(0.5-0.9)=-24
  const headAtt = skinAtts["slot-head"]["head"];
  report("assemble 枢轴偏移", Math.abs(headAtt.y - (-24)) < 0.01 && Math.abs(headAtt.x) < 0.01, `x=${headAtt.x}, y=${headAtt.y}`);

  // 拼接预览图有效（有非透明像素）
  const pv = sharp(preview);
  const pvMeta = await pv.metadata();
  const pvRaw = await pv.removeAlpha().raw().toBuffer();
  let opaque = 0;
  for (let i = 0; i < pvRaw.length; i += 4) if (pvRaw[i + 3] > 0) opaque++;
  report("assemble 拼接预览有内容", pvMeta.width > 0 && opaque > 1000, `${pvMeta.width}x${pvMeta.height}, opaque=${opaque}`);

  // images 目录已拷贝部件
  const imgDir = path.join(work, "images");
  report("assemble images 目录", fs.existsSync(path.join(imgDir, "part-0.png")) && fs.readdirSync(imgDir).filter((f) => f.endsWith(".png")).length === 6, "");

  // ===== 4. 负例：缺少部件 =====
  const badIndex = path.join(work, "partsIndex-bad.json");
  const missing = { parts: { "part-0": index.parts["part-0"], "part-1": index.parts["part-1"] } };
  fs.writeFileSync(badIndex, JSON.stringify(missing));
  r = await call("spine_assemble", { partsMetaPath: r.data.metaFile || metaFileOf(work), assembleIndexPath: badIndex, outputJsonPath: path.join(work, "bad.json") });
  report("assemble 缺部件报错", r.success === false && /缺少以下部件/.test(r.message), r.message);

  // 负例：父骨骼不存在
  const badParent = path.join(work, "partsIndex-badparent.json");
  const bp = JSON.parse(JSON.stringify(index));
  bp.parts["part-2"].parent = "ghost";
  fs.writeFileSync(badParent, JSON.stringify(bp));
  r = await call("spine_assemble", { partsMetaPath: path.join(cutDir, "partsMeta.json"), assembleIndexPath: badParent, outputJsonPath: path.join(work, "bad2.json") });
  report("assemble 父骨骼不存在报错", r.success === false && /父骨骼/.test(r.message), r.message);

  // ===== 5. 导入 .spine（可选，Spine CLI 可用时）=====
  const spineExe = process.env.SPINE_EXE || "D:/cocos/SpinePro3.8.75/Spine.com";
  if (fs.existsSync(spineExe)) {
    const proj = path.join(work, "assembled.spine");
    r = await call("spine_assemble", {
      partsMetaPath: path.join(cutDir, "partsMeta.json"),
      assembleIndexPath: indexPath,
      outputJsonPath: skelJson,
      skeletonName: "test",
      importToProject: proj,
    });
    report("assemble 导入 .spine", r.success && fs.existsSync(proj), r.message);
  } else {
    results.push("⏭️ 跳过 .spine 导入（未找到 Spine CLI）");
  }

  console.log("\n===== cut_parts + assemble 自测结果 =====");
  results.forEach((l) => console.log(l));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

function metaFileOf(workDir) {
  return path.join(workDir, "cut", "partsMeta.json");
}
