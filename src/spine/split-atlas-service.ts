/**
 * 图集拆分服务：把图集按部件拆分为独立 PNG。
 * - region 模式：按 atlas region 提取子图 + 透明清理 + 裁剪
 * - split 模式：额外做连通域分析，把相互重叠/贴合的部件按不透明区域拆开
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { parseAtlas, ParsedAtlas, AtlasRegion } from "./atlas-utils";
import { ErrorCode, SpineError } from "../utils/error-codes";
import { ensureDir } from "../utils/file-utils";

export interface SplitOptions {
  mode?: "region" | "split";
  alphaThreshold?: number; // 0-255，默认 16
  minSize?: number; // 拆分后最小像素数，默认 16
}

export interface SplitPart {
  name: string;
  file: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface SplitResult {
  atlasName: string;
  parts: SplitPart[];
  mode: string;
  outputDir: string;
}

/** 从图集页 png 中提取 region 子图（raw RGBA），处理 rotate */
async function extractRegionPixels(image: sharp.Sharp, region: AtlasRegion): Promise<Buffer> {
  const w = region.rotate ? region.height : region.width;
  const h = region.rotate ? region.width : region.height;
  const raw = await image.clone().extract({ left: region.x, top: region.y, width: w, height: h }).raw().toBuffer();
  if (region.rotate) {
    // 逆时针旋转 90°：Spine atlas 的 rotate=true 表示图片顺时针旋转 90° 存储，还原时需逆时针转
    const srcW = region.height;
    const srcH = region.width;
    const dst = Buffer.alloc(raw.length);
    const ch = 4;
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = (y * srcW + x) * ch;
        // 逆时针：dst(x', y') = src(y', W-1-x')
        const dx = srcH - 1 - y;
        const dy = x;
        const dstIdx = (dy * srcH + dx) * ch;
        dst[dstIdx] = raw[srcIdx];
        dst[dstIdx + 1] = raw[srcIdx + 1];
        dst[dstIdx + 2] = raw[srcIdx + 2];
        dst[dstIdx + 3] = raw[srcIdx + 3];
      }
    }
    return dst;
  }
  return raw;
}

/** 透明清理：低于阈值 alpha 的像素置为全透明；返回 {buffer, width, height} */
export function cleanAlpha(raw: Buffer, width: number, height: number, threshold: number): Buffer {
  const out = Buffer.from(raw);
  for (let i = 3; i < out.length; i += 4) {
    if (out[i] < threshold) {
      out[i - 3] = 0;
      out[i - 2] = 0;
      out[i - 1] = 0;
      out[i] = 0;
    }
  }
  return out;
}

/** 计算非透明包围盒 */
export function bbox(raw: Buffer, width: number, height: number): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (raw[(y * width + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

/** 连通域分析：把不透明像素分成若干独立区域（BFS 洪水填充） */
export function findComponents(raw: Buffer, width: number, height: number, minSize: number): Array<{ points: Array<[number, number]> }> {
  const visited = new Uint8Array(width * height);
  const components: Array<{ points: Array<[number, number]> }> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || raw[idx * 4 + 3] <= 0) continue;
      // BFS
      const points: Array<[number, number]> = [];
      const queue: Array<[number, number]> = [[x, y]];
      visited[idx] = 1;
      while (queue.length) {
        const [cx, cy] = queue.pop()!;
        points.push([cx, cy]);
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]] as const) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (!visited[nIdx] && raw[nIdx * 4 + 3] > 0) {
            visited[nIdx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
      if (points.length >= minSize) {
        components.push({ points });
      }
    }
  }
  return components;
}

/**
 * 拆分图集
 * @param atlasPath  .atlas 文件路径
 * @param imagePath  图集 png 路径
 * @param outputDir  输出目录
 */
export async function splitAtlas(atlasPath: string, imagePath: string, outputDir: string, options: SplitOptions = {}): Promise<SplitResult> {
  if (!fs.existsSync(atlasPath)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `图集文件不存在：${atlasPath}`);
  }
  if (!fs.existsSync(imagePath)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `图集图片不存在：${imagePath}`);
  }
  const mode = options.mode ?? "region";
  const threshold = options.alphaThreshold ?? 16;
  const minSize = options.minSize ?? 16;
  ensureDir(outputDir);

  const atlas: ParsedAtlas = parseAtlas(fs.readFileSync(atlasPath, "utf8"));
  const image = sharp(imagePath);
  const parts: SplitPart[] = [];

  for (const region of atlas.regions) {
    const regionW = region.rotate ? region.height : region.width;
    const regionH = region.rotate ? region.width : region.height;
    let raw = await extractRegionPixels(image, region);
    raw = cleanAlpha(raw, regionW, regionH, threshold);
    let box = bbox(raw, regionW, regionH);
    if (box.x1 < 0) {
      continue; // 全透明
    }
    const regionName = sanitize(region.name);

    if (mode === "split") {
      const components = findComponents(raw, regionW, regionH, minSize);
      if (components.length > 1) {
        let ci = 0;
        for (const comp of components) {
          let cx0 = regionW, cy0 = regionH, cx1 = -1, cy1 = -1;
          for (const [px, py] of comp.points) {
            if (px < cx0) cx0 = px;
            if (px > cx1) cx1 = px;
            if (py < cy0) cy0 = py;
            if (py > cy1) cy1 = py;
          }
          const cw = cx1 - cx0 + 1, ch = cy1 - cy0 + 1;
          const compRaw = Buffer.alloc(cw * ch * 4);
          for (const [px, py] of comp.points) {
            const srcIdx = (py * regionW + px) * 4;
            const dstIdx = ((py - cy0) * cw + (px - cx0)) * 4;
            compRaw[dstIdx] = raw[srcIdx];
            compRaw[dstIdx + 1] = raw[srcIdx + 1];
            compRaw[dstIdx + 2] = raw[srcIdx + 2];
            compRaw[dstIdx + 3] = raw[srcIdx + 3];
          }
          const file = path.join(outputDir, `${regionName}_${ci}.png`);
          await sharp(compRaw, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(file);
          parts.push({ name: `${regionName}_${ci}`, file, width: cw, height: ch, x: cx0, y: cy0 });
          ci++;
        }
        continue;
      }
    }

    // 单一部件：裁剪包围盒
    const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
    const cropRaw = Buffer.alloc(bw * bh * 4);
    for (let y = box.y0; y <= box.y1; y++) {
      for (let x = box.x0; x <= box.x1; x++) {
        const srcIdx = (y * regionW + x) * 4;
        const dstIdx = ((y - box.y0) * bw + (x - box.x0)) * 4;
        cropRaw[dstIdx] = raw[srcIdx];
        cropRaw[dstIdx + 1] = raw[srcIdx + 1];
        cropRaw[dstIdx + 2] = raw[srcIdx + 2];
        cropRaw[dstIdx + 3] = raw[srcIdx + 3];
      }
    }
    const file = path.join(outputDir, `${regionName}.png`);
    await sharp(cropRaw, { raw: { width: bw, height: bh, channels: 4 } }).png().toFile(file);
    parts.push({ name: regionName, file, width: bw, height: bh, x: box.x0, y: box.y0 });
  }

  return { atlasName: path.basename(atlasPath), parts, mode, outputDir };
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\.png$/i, "");
}
