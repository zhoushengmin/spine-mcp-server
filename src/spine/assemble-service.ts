/**
 * 装配绑骨服务：读 partsMeta.json（切割产物）+ AI 装配索引（partsIndex.json），
 * 生成 Spine 3.8 层级骨架 JSON，并把部件按目标位置合成一张「拼接还原」预览图。
 *
 * partsIndex.json（由 AI 客户端看图后输出）格式：
 * {
 *   "parts": {
 *     "part-0": {
 *       "name": "head",          // 骨骼/附件名（唯一）
 *       "parent": "neck",        // 父骨骼名（"root" 或无父部件）
 *       "x": 0, "y": 140,        // 部件枢轴在装配空间中的位置（Spine y 向上）
 *       "pivotX": 0.5, "pivotY": 0.8, // 枢轴在部件内的归一化位置（0-1，可选，默认 0.5/0.5）
 *       "order": 2               // 绘制顺序（越大越靠上，可选，默认 0）
 *     }
 *   }
 * }
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { ErrorCode, SpineError } from "../utils/error-codes";
import { ensureDir } from "../utils/file-utils";

export interface AssemblePart {
  name: string;
  parent: string;
  x: number;
  y: number;
  pivotX: number;
  pivotY: number;
  order: number;
}

export interface AssembleIndex {
  parts: Record<string, AssemblePart>;
}

export interface AssembleOptions {
  skeletonName?: string;
  imageDir?: string; // 附件 path 前缀（相对骨架 JSON），默认 "./images/"
}

export interface AssembleResult {
  jsonPath: string;
  previewFile: string;
  bones: number;
  slots: number;
  attachments: number;
  imagesDir: string;
}

/**
 * 装配：生成骨架 JSON + 拼接还原预览图。
 * @param partsMetaPath  切割产物 partsMeta.json（spine_cut_parts 输出）
 * @param assembleIndexPath AI 装配索引 partsIndex.json
 * @param outputJsonPath 输出的骨架 JSON 路径
 * @param outputPreview  拼接还原预览图路径（可选，默认输出 JSON 同名 .png）
 */
export async function assembleParts(
  partsMetaPath: string,
  assembleIndexPath: string,
  outputJsonPath: string,
  options: AssembleOptions & { outputPreview?: string } = {}
): Promise<AssembleResult> {
  if (!fs.existsSync(partsMetaPath)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `partsMeta.json 不存在：${partsMetaPath}`);
  }
  if (!fs.existsSync(assembleIndexPath)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `装配索引 partsIndex.json 不存在：${assembleIndexPath}`);
  }

  const meta = JSON.parse(fs.readFileSync(partsMetaPath, "utf8"));
  const index: AssembleIndex = JSON.parse(fs.readFileSync(assembleIndexPath, "utf8"));
  const indexParts = index.parts ?? {};
  if (!Array.isArray(meta.parts) || !meta.parts.length) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "partsMeta.json 中无部件数据");
  }

  const skeletonName = options.skeletonName ?? "skeleton";
  const outDir = path.dirname(outputJsonPath);
  ensureDir(outDir);
  const imageDir = options.imageDir ?? "./images/";
  const imagesDir = path.join(outDir, imageDir.replace(/^\.\//, "").replace(/\/+$/, ""));
  ensureDir(imagesDir);

  // 1. 校验：每个部件都必须在装配索引中，且骨骼名唯一
  const missing = meta.parts.filter((p: any) => !(indexParts[p.name] || indexParts[String(p.id)]));
  if (missing.length) {
    throw new SpineError(
      ErrorCode.INVALID_ARGUMENT,
      `装配索引缺少以下部件：${missing.map((m: any) => m.name).join(", ")}`,
      "请让 AI 客户端在 partsIndex.json 中为这些部件补充 name/parent/x/y。"
    );
  }
  const byName = new Map<string, { part: any; cfg: AssemblePart; src: string }>();
  for (const p of meta.parts) {
    const cfg = indexParts[p.name] ?? indexParts[String(p.id)];
    if (!cfg || typeof cfg.name !== "string" || !cfg.name) {
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `部件 ${p.name} 缺少 name 字段`);
    }
    if (byName.has(cfg.name)) {
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `骨骼名 "${cfg.name}" 重复`);
    }
    // 解析部件源文件绝对路径
    const cand1 = meta.baseDir ? path.join(meta.baseDir, p.file) : p.file;
    const cand2 = path.join(path.dirname(partsMetaPath), p.file);
    const src = fs.existsSync(cand1) ? cand1 : cand2;
    if (!fs.existsSync(src)) {
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `部件图片不存在：${cand1}`);
    }
    byName.set(cfg.name, { part: p, cfg, src });
  }

  // 2. 拷贝部件 PNG 到 images 目录（若已在该目录则跳过）
  for (const { part, src } of byName.values()) {
    if (path.dirname(src) !== imagesDir) {
      fs.copyFileSync(src, path.join(imagesDir, part.file));
    }
  }

  // 3. 生成骨骼 / 插槽 / 附件
  const bones: any[] = [{ name: "root", x: 0, y: 0 }];
  const boneNames = new Set(["root"]);
  const slots: any[] = [];
  const attachments: Record<string, any> = {};
  for (const [boneName, { part, cfg }] of byName.entries()) {
    const parent = cfg.parent || "root";
    if (!boneNames.has(parent)) {
      throw new SpineError(
        ErrorCode.INVALID_ARGUMENT,
        `部件 ${part.name} 的父骨骼 "${parent}" 不存在`,
        "parent 必须是 " + [...boneNames].join(" / ") + " 之一。"
      );
    }
    bones.push({ name: boneName, parent, x: cfg.x ?? 0, y: cfg.y ?? 0 });
    boneNames.add(boneName);

    const slotName = `slot-${boneName}`;
    slots.push({ name: slotName, bone: boneName, order: cfg.order ?? 0 });
    const pivotX = clamp01(cfg.pivotX ?? 0.5);
    const pivotY = clamp01(cfg.pivotY ?? 0.5);
    attachments[slotName] = {
      [boneName]: {
        type: "region",
        path: imageDir + part.file,
        x: Math.round(part.width * (0.5 - pivotX) * 100) / 100,
        y: Math.round(part.height * (0.5 - pivotY) * 100) / 100,
        width: part.width,
        height: part.height,
      },
    };
  }

  const skeletonJson = {
    skeleton: { spine: "3.8.75", images: imageDir },
    bones,
    slots,
    skins: [{ name: "default", attachments }],
    animations: {},
  };
  fs.writeFileSync(outputJsonPath, JSON.stringify(skeletonJson, null, 2), "utf8");

  // 4. 生成拼接还原预览图（按目标位置合成）
  const previewFile = options.outputPreview ?? outputJsonPath.replace(/\.json$/i, ".png");
  await renderAssembledPreview(byName, previewFile);

  return {
    jsonPath: outputJsonPath,
    previewFile,
    bones: bones.length,
    slots: slots.length,
    attachments: byName.size,
    imagesDir,
  };
}

/** 拼接还原：把部件按 pivot 与目标坐标合成到一张透明 PNG（Spine y-up → 图片 y-down） */
async function renderAssembledPreview(byName: Map<string, { part: any; cfg: AssemblePart; src: string }>, outFile: string): Promise<void> {
  const rects: Array<{ part: any; cfg: AssemblePart; src: string; left: number; top: number; w: number; h: number }> = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { part, cfg, src } of byName.values()) {
    const w = part.width, h = part.height;
    const pivotX = clamp01(cfg.pivotX ?? 0.5);
    const pivotY = clamp01(cfg.pivotY ?? 0.5);
    const left = (cfg.x ?? 0) - pivotX * w;
    const bottom = (cfg.y ?? 0) - pivotY * h;
    const right = left + w;
    const top = bottom + h;
    if (left < minX) minX = left;
    if (bottom < minY) minY = bottom;
    if (right > maxX) maxX = right;
    if (top > maxY) maxY = top;
    rects.push({ part, cfg, src, left, top, w, h });
  }
  const pad = 2;
  const canvasW = Math.max(1, Math.ceil(maxX - minX) + pad * 2);
  const canvasH = Math.max(1, Math.ceil(maxY - minY) + pad * 2);

  const composites = rects.map(({ cfg, src, left, top }) => {
    const pivotX = clamp01(cfg.pivotX ?? 0.5);
    const pivotY = clamp01(cfg.pivotY ?? 0.5);
    // 部件顶点（y-up）→ 图片坐标（y-down）
    const imgX = Math.round(left - minX + pad);
    const imgY = Math.round(maxY - top + pad);
    return { input: src, left: imgX, top: imgY };
  });

  const canvas = sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  await canvas.composite(composites).png().toFile(outFile);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
