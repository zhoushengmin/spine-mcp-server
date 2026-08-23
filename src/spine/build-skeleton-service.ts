/**
 * 自动绑骨服务：根据拆分好的部件 PNG 生成 Spine 3.8 骨架 JSON。
 * - 每个部件创建一个骨骼 + 插槽 + region 附件
 * - 布局：grid（网格排布避免重叠，默认）或 list（纵向单列）
 * - 可选 partsIndex.json 指定每个部件的骨骼名（作为骨骼命名依据）
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { ErrorCode, SpineError } from "../utils/error-codes";

export interface BuildOptions {
  skeletonName?: string;
  layout?: "grid" | "list";
  spacing?: number;
  imageDir?: string; // 附件 path 前缀（相对骨架 JSON），默认 "./images/"
}

export interface BuildResult {
  jsonPath: string;
  bones: number;
  slots: number;
  attachments: number;
}

/** 生成骨架 JSON 并写入文件 */
export async function buildSkeleton(partsDir: string, outputJsonPath: string, options: BuildOptions = {}): Promise<BuildResult> {
  if (!fs.existsSync(partsDir)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `部件目录不存在：${partsDir}`);
  }
  const pngs = fs.readdirSync(partsDir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();

  // partsIndex.json（可选）：{ partName: { bone: "head", x, y } }
  const indexPath = path.join(partsDir, "partsIndex.json");
  let index: Record<string, { bone?: string; x?: number; y?: number }> = {};
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  }

  const layout = options.layout ?? "grid";
  const spacing = options.spacing ?? 10;
  const imageDir = options.imageDir ?? "./images/";
  const skeletonName = options.skeletonName ?? "skeleton";

  // 读取每个部件尺寸
  const parts: Array<{ name: string; w: number; h: number; bone?: string; x?: number; y?: number }> = [];
  for (const f of pngs) {
    const name = f.replace(/\.png$/i, "");
    const meta = await sharp(path.join(partsDir, f)).metadata();
    const idx = index[name] ?? {};
    parts.push({ name, w: meta.width ?? 0, h: meta.height ?? 0, bone: idx.bone, x: idx.x, y: idx.y });
  }
  if (!parts.length) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `目录中没有 PNG：${partsDir}`);
  }

  // 布局计算
  const cols = Math.max(1, Math.ceil(Math.sqrt(parts.length)));
  const bones: any[] = [{ name: "root", x: 0, y: 0 }];
  const slots: any[] = [];
  const attachments: Record<string, any> = {};
  parts.forEach((p, i) => {
    let x: number, y: number, boneName: string;
    if (p.bone && p.x !== undefined && p.y !== undefined) {
      boneName = p.bone;
      x = p.x;
      y = p.y;
    } else if (layout === "list") {
      boneName = `bone-${i}`;
      x = 0;
      y = -i * (p.h + spacing);
    } else {
      const col = i % cols;
      const row = Math.floor(i / cols);
      boneName = p.bone ?? `bone-${i}`;
      x = col * (p.w + spacing);
      y = -row * (p.h + spacing);
    }
    if (!bones.some((b) => b.name === boneName)) {
      bones.push({ name: boneName, parent: "root", x, y });
    }
    const slotName = `slot-${p.name}`;
    slots.push({ name: slotName, bone: boneName });
    attachments[slotName] = {
      [p.name]: { type: "region", path: imageDir + p.name + ".png", x: 0, y: 0, width: p.w, height: p.h },
    };
  });

  const skeletonJson = {
    skeleton: { spine: "3.8.75", images: imageDir },
    bones,
    slots,
    skins: [{ name: "default", attachments }],
    animations: {},
  };
  fs.writeFileSync(outputJsonPath, JSON.stringify(skeletonJson, null, 2), "utf8");

  return {
    jsonPath: outputJsonPath,
    bones: bones.length,
    slots: slots.length,
    attachments: parts.length,
  };
}
