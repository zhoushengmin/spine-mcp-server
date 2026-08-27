/**
 * 一键成片管线服务：把 散件切割→装配绑骨→镜像补全→生成动作→导出 串成一次调用。
 * 用户只需：一张透明散件 PNG + AI 装配索引 + 想要的效果 → 直接得到动画项目与成片（GIF/精灵表/预览）。
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { cutParts } from "./cut-parts-service";
import { assembleParts } from "./assemble-service";
import { mirrorJson } from "./mirror-service";
import { generateAnimation } from "./animation-generate-service";
import { addEvent, addEventKeyframe } from "./json-handler";
import { findEffect } from "./effect-service";
import { validateJsonReferences } from "./validate-service";
import { repackAtlas } from "./repack-atlas-service";
import { renderAnimationFrames } from "./render-service";
import { encodeGif } from "../utils/gif-encoder";
import { importJson } from "./import-service";
import { createTempDir, ensureDir, writeJsonFile } from "../utils/file-utils";
import { ErrorCode, SpineError } from "../utils/error-codes";

export type PipelineExport = "gif" | "sheet" | "preview" | "none";

export interface PipelineOptions {
  imagePath: string; // 透明散件 PNG
  partsIndexPath: string; // AI 装配索引
  effect: string; // 效果名（动画/组合类）
  animationName?: string;
  duration?: number;
  mirror?: boolean; // 装配后镜像补全右半
  skeletonName?: string;
  outputDir?: string; // 中间产物目录（缺省临时）
  projectPath?: string; // 可选：导入生成 .spine
  export?: PipelineExport;
  exportPath?: string; // 导出输出路径
  frames?: number;
  fps?: number;
  width?: number;
  height?: number;
}

export interface PipelineResult {
  steps: Array<{ step: string; detail: string }>;
  parts: number;
  skeletonJson: string;
  projectPath?: string;
  animationName?: string;
  exportPath?: string;
  warnings: string[];
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const steps: Array<{ step: string; detail: string }> = [];
  const outputDir = options.outputDir ?? createTempDir("spine-pipeline-");
  ensureDir(outputDir);
  const skeletonName = options.skeletonName ?? "skeleton";
  const skeletonJson = path.join(outputDir, "skeleton.json");

  // 1) 切割
  const cutDir = path.join(outputDir, "cut");
  const cut = await cutParts(options.imagePath, cutDir, {});
  steps.push({ step: "cut-parts", detail: `${cut.parts.length} 个部件` });

  // 2) 装配绑骨
  const preview = path.join(outputDir, "assembled-preview.png");
  const assemble = await assembleParts(cut.metaFile, options.partsIndexPath, skeletonJson, { skeletonName, outputPreview: preview });
  steps.push({ step: "assemble", detail: `${assemble.bones} 骨骼 / ${assemble.slots} 插槽 / ${assemble.attachments} 附件` });

  // 3) 可选镜像补全
  const json = JSON.parse(fs.readFileSync(skeletonJson, "utf8"));
  if (options.mirror) {
    const m = mirrorJson(json, {});
    writeJsonFile(skeletonJson, json);
    steps.push({ step: "mirror", detail: `镜像 ${m.bones} 骨骼` });
  }

  // 4) 生成效果动画
  const effect = findEffect(options.effect);
  if (!effect) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `未知效果：${options.effect}`, `可用：${["idle", "breath", "walk", "run", "wave", "attack", "jump", "attack-impact", "jump-land"].join("、")}。`);
  }
  if (effect.type === "skin") {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "pipeline 暂不支持皮肤类效果（新骨架无皮肤）。", "请用动作/组合类效果。");
  }
  let animName: string | undefined;
  if (effect.type === "animation" && effect.template) {
    const r = generateAnimation(json, effect.template, { animationName: options.animationName, duration: options.duration });
    animName = r.animationName;
    steps.push({ step: "generate-animation", detail: `${effect.template} → ${animName}` });
  } else if (effect.type === "combo" && effect.combo) {
    const r = generateAnimation(json, effect.combo.animation, { animationName: options.animationName, duration: options.duration });
    animName = r.animationName;
    steps.push({ step: "generate-animation", detail: `${effect.combo.animation} → ${animName}` });
    if (effect.combo.event) {
      const dur = options.duration ?? effect.defaultDuration ?? 1;
      const t = effect.combo.event.timeRatio * dur;
      if (!json.events?.[effect.combo.event.name]) addEvent(json, effect.combo.event.name, {});
      addEventKeyframe(json, animName, t, effect.combo.event.name);
      steps.push({ step: "add-event", detail: `事件 ${effect.combo.event.name} @${t.toFixed(2)}s` });
    }
  }
  writeJsonFile(skeletonJson, json);

  // 5) 引用校验
  const warnings = validateJsonReferences(json);

  // 6) 可选导入 .spine
  let projectPath: string | undefined;
  if (options.projectPath) {
    await importJson(options.projectPath, skeletonJson, { skeletonName, backup: false });
    projectPath = options.projectPath;
    steps.push({ step: "import", detail: `导入 ${projectPath}` });
  }

  // 7) 导出
  let exportPath: string | undefined;
  const exp = options.export ?? "none";
  if (exp !== "none" && animName) {
    exportPath = await exportPipeline(outputDir, skeletonJson, animName, exp, options, steps);
  }

  return { steps, parts: cut.parts.length, skeletonJson, projectPath, animationName: animName, exportPath, warnings };
}

/** 导出 GIF / 精灵表 / 预览（先把部件打包成图集再逐帧渲染） */
async function exportPipeline(
  outputDir: string,
  skeletonJson: string,
  animName: string,
  exp: PipelineExport,
  options: PipelineOptions,
  steps: Array<{ step: string; detail: string }>
): Promise<string> {
  const cutDir = path.join(outputDir, "cut");
  const partFiles = fs.readdirSync(cutDir).filter((f) => f.endsWith(".png") && !f.startsWith("parts-montage")).map((f) => path.join(cutDir, f));
  // 图集 region 名 = 文件名（含扩展名），与 skeleton 附件 path 的 basename 匹配
  const atlasDir = path.join(outputDir, "atlas");
  const packed = await repackAtlas(partFiles.map((f) => ({ name: path.basename(f), file: f })), atlasDir, "pipeline");
  const json = JSON.parse(fs.readFileSync(skeletonJson, "utf8"));
  const duration = json.animations?.[animName]?.duration ?? 1;
  const width = options.width ?? 256;
  const height = options.height ?? 256;
  const fps = options.fps ?? 12;
  const frames = await renderAnimationFrames(skeletonJson, packed.atlasPath, packed.imagePath, animName, { fps, width, height });

  const outPath = options.exportPath ?? path.join(outputDir, `output.${exp === "gif" ? "gif" : "png"}`);
  ensureDir(path.dirname(outPath) || ".");

  if (exp === "gif") {
    const gif = encodeGif(frames.map((f) => ({ width, height, rgba: f.buffer, delayMs: 1000 / fps })));
    fs.writeFileSync(outPath, gif);
  } else if (exp === "sheet") {
    const n = frames.length;
    const cols = Math.min(8, Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    const canvas = sharp({ create: { width: cols * width, height: rows * height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
    await canvas
      .composite(frames.map((f, i) => ({ input: f.buffer, raw: { width, height, channels: 4 as const }, left: (i % cols) * width, top: Math.floor(i / cols) * height })))
      .png()
      .toFile(outPath);
  } else {
    // preview：精灵图（多帧序列）
    const n = Math.min(options.frames ?? 8, frames.length);
    const cols = Math.min(4, Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    const canvas = sharp({ create: { width: cols * width, height: rows * height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
    await canvas
      .composite(frames.slice(0, n).map((f, i) => ({ input: f.buffer, raw: { width, height, channels: 4 as const }, left: (i % cols) * width, top: Math.floor(i / cols) * height })))
      .png()
      .toFile(outPath);
  }
  steps.push({ step: "export", detail: `${exp} → ${outPath}` });
  return outPath;
}
