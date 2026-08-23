/**
 * 图集重打包服务：把一组独立 PNG 打包为 Spine .atlas + png。
 * 使用简单的 Shelf 排布（按高度降序排排），生成 Spine 3.8 文本格式 .atlas。
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { ErrorCode, SpineError } from "../utils/error-codes";
import { ensureDir } from "../utils/file-utils";

export interface PackInput {
  name: string; // region 名
  file: string; // png 绝对路径
}

export interface RepackResult {
  atlasPath: string;
  imagePath: string;
  pageSize: { w: number; h: number };
  regions: Array<{ name: string; x: number; y: number; w: number; h: number }>;
}

const PADDING = 2;

/**
 * 打包图片为图集。
 * @param images    待打包图片 [{name, file}]
 * @param outputDir 输出目录
 * @param atlasName 图集名（不含扩展名），默认 "atlas"
 */
export async function repackAtlas(images: PackInput[], outputDir: string, atlasName = "atlas"): Promise<RepackResult> {
  if (!images.length) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "没有可打包的图片。");
  }
  ensureDir(outputDir);
  // 读取尺寸
  const metas = await Promise.all(
    images.map(async (img) => {
      if (!fs.existsSync(img.file)) {
        throw new SpineError(ErrorCode.INVALID_ARGUMENT, `图片不存在：${img.file}`);
      }
      const meta = await sharp(img.file).metadata();
      return { ...img, w: meta.width ?? 0, h: meta.height ?? 0 };
    })
  );
  // Shelf 打包：按高度降序，逐行放置
  const sorted = [...metas].sort((a, b) => b.h - a.h);
  const shelves: Array<{ y: number; h: number; x: number }> = [];
  const placed: Array<{ name: string; x: number; y: number; w: number; h: number; file: string }> = [];
  let pageW = 0;

  const place = (m: any): void => {
    // 尝试放入已有 shelf
    for (const shelf of shelves) {
      if (shelf.h >= m.h && shelf.x + m.w <= pageW) {
        placed.push({ name: m.name, x: shelf.x + PADDING, y: shelf.y + PADDING, w: m.w, h: m.h, file: m.file });
        shelf.x += m.w + PADDING * 2;
        return;
      }
    }
    // 新 shelf（置于所有 shelf 之上）
    const shelfY = shelves.length ? shelves.reduce((m2, s) => Math.max(m2, s.y + s.h), 0) + PADDING : PADDING;
    shelves.push({ y: shelfY, h: m.h, x: m.w + PADDING * 2 });
    pageW = Math.max(pageW, m.w + PADDING * 2);
    placed.push({ name: m.name, x: PADDING, y: shelfY + PADDING, w: m.w, h: m.h, file: m.file });
  };
  for (const m of sorted) place(m);

  const pageH = shelves.reduce((m, s) => Math.max(m, s.y + s.h), 0) + PADDING;
  const w = Math.max(pageW, 1);
  const h = Math.max(pageH, 1);

  // 合成图集图
  const canvas = sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  const composites = placed.map((p) => ({
    input: p.file,
    left: p.x,
    top: p.y,
  }));
  const pngName = `${atlasName}.png`;
  const imagePath = path.join(outputDir, pngName);
  await canvas.composite(composites).png().toFile(imagePath);

  // 生成 .atlas 文本
  const lines: string[] = [
    pngName,
    `size: ${w}, ${h}`,
    "format: RGBA8888",
    "filter: Linear, Linear",
    "repeat: none",
  ];
  for (const p of placed) {
    lines.push(
      p.name,
      "rotate: false",
      `xy: ${p.x}, ${p.y}`,
      `size: ${p.w}, ${p.h}`,
      `orig: ${p.w}, ${p.h}`,
      "offset: 0, 0",
      "index: -1"
    );
  }
  const atlasPath = path.join(outputDir, `${atlasName}.atlas`);
  fs.writeFileSync(atlasPath, lines.join("\n"), "utf8");

  return {
    atlasPath,
    imagePath,
    pageSize: { w, h },
    regions: placed.map((p) => ({ name: p.name, x: p.x, y: p.y, w: p.w, h: p.h })),
  };
}
