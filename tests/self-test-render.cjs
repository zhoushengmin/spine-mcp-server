/**
 * 渲染/视频自测：mesh 顶点变形渲染 + GIF 编码 + export_video 工具
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { allTools } = require("d:/cocos/spine-mcp-server/dist/tools/registry");
const { exportProject } = require("d:/cocos/spine-mcp-server/dist/spine/export-service");
const { createTempDir, removeDir } = require("d:/cocos/spine-mcp-server/dist/utils/file-utils");
const { renderFrame, renderAnimationFrames } = require("d:/cocos/spine-mcp-server/dist/spine/render-service");
const { encodeGif, encodeLZW, decodeLZW } = require("d:/cocos/spine-mcp-server/dist/utils/gif-encoder");
const sharp = require("sharp");

const HERO = "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine";
const HERO_ATLAS = "D:/cocos/SpinePro3.8.75/examples/hero/export/hero.atlas";
const HERO_PNG = "D:/cocos/SpinePro3.8.75/examples/hero/export/hero.png";

let ok = 0, fail = 0;
const results = [];
function report(name, cond, detail = "") {
  if (cond) { ok++; results.push(`✅ ${name}`); }
  else { fail++; results.push(`❌ ${name} ${detail}`); }
}
const call = (name, args) => allTools.find((t) => t.name === name).execute(args);

/** 统计 RGBA buffer 非透明像素占比 */
function opaqueRatio(buf, w, h) {
  let n = 0;
  for (let i = 3; i < buf.length; i += 4) if (buf[i] > 16) n++;
  return n / (w * h);
}

(async () => {
  const temp = createTempDir("p5-render-");
  try {
    // 1) 导出 hero JSON
    const files = await exportProject(HERO, temp, { format: "json" });
    const heroJson = files.find((f) => f.endsWith(".json"));
    report("导出 hero JSON", !!heroJson, "缺少 JSON");

    // 2) mesh 渲染：idle 帧 PNG 有效且非空（hero 的 head/cape 是加权 mesh）
    const pngOut = path.join(temp, "idle.png");
    const r = await call("spine_render_preview", {
      skeletonJson: heroJson, atlasPath: HERO_ATLAS, imagePath: HERO_PNG,
      animationName: "idle", time: 0.2, outputPath: pngOut, width: 512, height: 512,
    });
    report("render_preview(idle) mesh 路径", r.success && fs.existsSync(pngOut), r.message);
    if (fs.existsSync(pngOut)) {
      const meta = await sharp(pngOut).metadata();
      const { data, info } = await sharp(pngOut).raw().toBuffer({ resolveWithObject: true });
      report("mesh 渲染非空白", meta.format === "png" && opaqueRatio(data, info.width, info.height) > 0.02, `${info.width}x${info.height} 占比 ${(opaqueRatio(data, info.width, info.height) * 100).toFixed(2)}%`);
    }

    // 3) 多帧渲染（视频基础）
    const frames = await renderAnimationFrames(heroJson, HERO_ATLAS, HERO_PNG, "idle", { fps: 8, width: 256, height: 256 });
    report("renderAnimationFrames 帧数", frames.length >= 8, `${frames.length} 帧`);
    report("帧序列非空", frames.length > 0 && opaqueRatio(frames[0].buffer, 256, 256) > 0.02, "首帧应为非空白");

    // 4) GIF LZW 往返
    const d1 = Array.from({ length: 512 }, (_, i) => i % 8);
    const d2 = Array.from({ length: 4096 }, (_, i) => i % 17);
    let seed = 42;
    const d3 = Array.from({ length: 3000 }, () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % 256; });
    const round = (data) => {
      const enc = encodeLZW(Uint8Array.from(data), 8);
      const dec = decodeLZW(enc, 8);
      return dec.length === data.length && dec.every((v, i) => v === data[i]);
    };
    report("GIF LZW 往返(pattern)", round(d1));
    report("GIF LZW 往返(pattern17/字典增长)", round(d2));
    report("GIF LZW 往返(random)", round(d3));

    // 5) GIF 结构可解码（sharp 读回动画）
    const gifOut = path.join(temp, "anim.gif");
    const gif = encodeGif(frames.map((f) => ({ width: 256, height: 256, rgba: f.buffer, delayMs: 125 })));
    fs.writeFileSync(gifOut, gif);
    report("GIF 头", gif.slice(0, 6).toString() === "GIF89a");
    const gMeta = await sharp(gifOut, { animated: true }).metadata();
    report("GIF 可解码(sharp)", gMeta.format === "gif" && (gMeta.pages ?? 1) === frames.length, `pages=${gMeta.pages}`);

    // 6) export_video 工具（projectPath → GIF）
    const vOut = path.join(temp, "video.gif");
    let rv = await call("spine_export_video", { projectPath: HERO, animationName: "idle", outputPath: vOut, fps: 8, width: 256, height: 256 });
    report("export_video(GIF)", rv.success && fs.existsSync(vOut) && fs.statSync(vOut).size > 1000, rv.message);
    if (rv.success) {
      const vm = await sharp(vOut, { animated: true }).metadata();
      report("export_video GIF 可解码", vm.format === "gif" && (vm.pages ?? 1) >= 8, `pages=${vm.pages}`);
    }

    // 7) export_video 错误路径（无 atlas）
    const bad = await call("spine_export_video", { projectPath: HERO, outputPath: path.join(temp, "x.gif"), atlasPath: "Z:/no.atlas", imagePath: "Z:/no.png" });
    report("export_video(缺产物提示)", bad.success === false && !!bad.message, bad.message);

    // 8) export_video 需要 ffmpeg 时返回提示（当前环境无 ffmpeg）
    const rv2 = await call("spine_export_video", { projectPath: HERO, outputPath: path.join(temp, "v.mp4"), fps: 8, width: 128, height: 128 });
    report("export_video(mp4 需 ffmpeg 提示)", rv2.success === false && (rv2.errorCode === "E_FFMPEG_NOT_FOUND" || rv2.errorCode === "E_FFMPEG_EXEC_FAILED"), `${rv2.errorCode ?? ""} ${rv2.message ?? ""}`);
  } finally {
    removeDir(temp);
  }

  console.log(`\n===== 渲染/视频自测结果 =====`);
  results.forEach((x) => console.log(x));
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail > 0 ? 1 : 0);
})();
