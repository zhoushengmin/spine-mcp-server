/**
 * 散件切割服务：把一张透明 PNG（部件互不重叠、随机位置）按连通域切成独立部件，
 * 并生成「编号蒙太奇图 + partsMeta.json」。
 * - partsMeta.json：记录每个部件的 id / 文件名 / 尺寸 / 在源图中的位置（供 AI 客户端对照蒙太奇编号）
 * - 蒙太奇图：源图 + 每个部件的彩色编号框，供有视觉能力的 AI 客户端看图输出装配索引
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { cleanAlpha, findComponents } from "./split-atlas-service";
import { ErrorCode, SpineError } from "../utils/error-codes";
import { ensureDir } from "../utils/file-utils";

export interface CutPart {
  id: number;
  name: string; // part-N
  file: string; // 切割后 PNG 绝对路径
  width: number;
  height: number;
  x: number; // 部件包围盒在源图中的 x
  y: number; // 部件包围盒在源图中的 y
  centroidX: number; // 质心（源图坐标）
  centroidY: number;
  area: number; // 不透明像素数
}

export interface CutOptions {
  alphaThreshold?: number; // 0-255，默认 16
  minSize?: number; // 最小不透明像素数，默认 16
}

export interface CutResult {
  imagePath: string;
  outputDir: string;
  sourceSize: { w: number; h: number };
  parts: CutPart[];
  montageFile: string;
  metaFile: string;
}

/** 蒙太奇编号框调色板（与部件 id 循环对应，便于 AI 对照） */
const PALETTE = [
  "#ff3b30", "#34c759", "#007aff", "#ff9500", "#af52de",
  "#ff2d55", "#00c7be", "#ffcc00", "#5856d6", "#64d2ff",
];

/**
 * 从单张透明 PNG 中按连通域切割出互不重叠的散件部件。
 * @param imagePath 透明 PNG（部件互不重叠）
 * @param outputDir 输出目录（部件 PNG + 蒙太奇 + partsMeta.json）
 */
export async function cutParts(imagePath: string, outputDir: string, options: CutOptions = {}): Promise<CutResult> {
  if (!fs.existsSync(imagePath)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `图片不存在：${imagePath}`);
  }
  const threshold = options.alphaThreshold ?? 16;
  const minSize = options.minSize ?? 16;
  ensureDir(outputDir);

  const meta = await sharp(imagePath).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w <= 0 || h <= 0) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `无法读取图片尺寸：${imagePath}`);
  }

  const raw = cleanAlpha(await sharp(imagePath).ensureAlpha().raw().toBuffer(), w, h, threshold);
  const components = findComponents(raw, w, h, minSize);
  if (!components.length) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `未检测到任何不透明部件（alphaThreshold=${threshold}, minSize=${minSize}）`);
  }

  // 逐个部件裁剪并写出
  const parts: CutPart[] = [];
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    let cx0 = w, cy0 = h, cx1 = -1, cy1 = -1;
    let sx = 0, sy = 0;
    for (const [px, py] of comp.points) {
      if (px < cx0) cx0 = px;
      if (px > cx1) cx1 = px;
      if (py < cy0) cy0 = py;
      if (py > cy1) cy1 = py;
      sx += px;
      sy += py;
    }
    const cw = cx1 - cx0 + 1, ch = cy1 - cy0 + 1;
    const compRaw = Buffer.alloc(cw * ch * 4);
    for (const [px, py] of comp.points) {
      const srcIdx = (py * w + px) * 4;
      const dstIdx = ((py - cy0) * cw + (px - cx0)) * 4;
      compRaw[dstIdx] = raw[srcIdx];
      compRaw[dstIdx + 1] = raw[srcIdx + 1];
      compRaw[dstIdx + 2] = raw[srcIdx + 2];
      compRaw[dstIdx + 3] = raw[srcIdx + 3];
    }
    const name = `part-${i}`;
    const file = path.join(outputDir, `${name}.png`);
    await sharp(compRaw, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(file);
    const n = comp.points.length;
    parts.push({
      id: i,
      name,
      file,
      width: cw,
      height: ch,
      x: cx0,
      y: cy0,
      centroidX: Math.round(sx / n),
      centroidY: Math.round(sy / n),
      area: n,
    });
  }

  // 生成编号蒙太奇图（源图 + 彩色编号框）
  const montageFile = path.join(outputDir, "parts-montage.png");
  const svg = buildMontageSvg(w, h, parts);
  await sharp(imagePath).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(montageFile);

  // 写出 partsMeta.json
  const metaFile = path.join(outputDir, "partsMeta.json");
  fs.writeFileSync(
    metaFile,
    JSON.stringify(
      {
        sourceSize: { w, h },
        baseDir: outputDir,
        parts: parts.map((p) => ({
          id: p.id,
          name: p.name,
          file: path.basename(p.file),
          width: p.width,
          height: p.height,
          x: p.x,
          y: p.y,
          centroidX: p.centroidX,
          centroidY: p.centroidY,
          area: p.area,
        })),
      },
      null,
      2
    ),
    "utf8"
  );

  return { imagePath, outputDir, sourceSize: { w, h }, parts, montageFile, metaFile };
}

/** 生成蒙太奇 SVG：每个部件一个彩色边框 + 编号标签 */
function buildMontageSvg(w: number, h: number, parts: CutPart[]): string {
  const rects: string[] = [];
  const labels: string[] = [];
  for (const p of parts) {
    const color = PALETTE[p.id % PALETTE.length];
    rects.push(
      `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="none" stroke="${color}" stroke-width="2"/>`
    );
    // 标签：优先放包围盒上方，空间不足则放内部
    const labelW = 16 + String(p.id).length * 11;
    const labelH = 22;
    let lx = p.x;
    let ly = p.y - labelH - 2;
    if (ly < 2) ly = p.y + 2;
    if (p.y < labelH + 4) ly = p.y + 2;
    labels.push(
      `<rect x="${lx}" y="${ly}" width="${labelW}" height="${labelH}" fill="${color}" rx="4"/>`,
      `<text x="${lx + 8}" y="${ly + 16}" font-size="16" font-family="Arial, sans-serif" font-weight="bold" fill="#ffffff">${p.id}</text>`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${rects.join("")}${labels.join("")}</svg>`;
}
