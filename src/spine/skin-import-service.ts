/**
 * 换装导入服务：把一组新贴图（按插槽）做成一个可切换的皮肤（skin）。
 * - imagesDir：PNG 目录，文件名 = 插槽名（如 body.png / arm_r.png）
 * - imageMap：显式 { slotName: png绝对路径 }
 * - 新贴图会复制到项目 images 目录并引用，导入时由 Spine 重新打包进图集
 * - 生成后可用 spine_apply_effect(switch-skin) 或 spine_set_skin 切换
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { modifyProject } from "./modify-service";
import { ensureSkin, ensureSkinAttachments, setDefaultSkin } from "./json-handler";
import { ensureDir } from "../utils/file-utils";
import { ErrorCode, SpineError } from "../utils/error-codes";

export interface SkinImportOptions {
  skinName: string;
  imagesDir?: string;
  imageMap?: Record<string, string>;
  setDefault?: boolean;
}

export interface SkinImportResult {
  skinName: string;
  slots: string[];
  copied: Array<{ slot: string; file: string }>;
  setDefault: boolean;
  backupPath?: string;
}

export async function importSkin(projectPath: string, options: SkinImportOptions): Promise<SkinImportResult> {
  if (!options.skinName) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "需要 skinName。", '示例：{ skinName:"armor", imagesDir:"D:/outfit" }');
  }
  // 1) 解析 slot → png 映射
  const map: Record<string, string> = {};
  if (options.imagesDir) {
    if (!fs.existsSync(options.imagesDir)) {
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `贴图目录不存在：${options.imagesDir}`);
    }
    for (const f of fs.readdirSync(options.imagesDir)) {
      if (!/\.png$/i.test(f)) continue;
      map[f.replace(/\.png$/i, "")] = path.join(options.imagesDir, f);
    }
  }
  for (const [slot, png] of Object.entries(options.imageMap ?? {})) {
    if (!fs.existsSync(png)) {
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `贴图不存在：${png}`);
    }
    map[slot] = png;
  }
  if (!Object.keys(map).length) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "没有可导入的贴图。", "提供 imagesDir（文件名=插槽名）或 imageMap。");
  }

  const projectDir = path.dirname(projectPath);
  const imagesDir = path.join(projectDir, "images");
  ensureDir(imagesDir);

  // 2) 复制贴图 + 记录尺寸（同步供回调使用）
  const copied: Array<{ slot: string; file: string; width: number; height: number }> = [];
  for (const [slot, png] of Object.entries(map)) {
    const meta = await sharp(png).metadata();
    if (!meta.width || !meta.height) {
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `无法读取贴图尺寸：${png}`);
    }
    const copiedName = `sk_${options.skinName}_${slot}.png`;
    fs.copyFileSync(png, path.join(imagesDir, copiedName));
    copied.push({ slot, file: copiedName, width: meta.width, height: meta.height });
  }

  // 3) 建皮肤 + 写附件（round-trip 让 Spine 重打包图集）
  const result = await modifyProject(projectPath, (json) => {
    ensureSkin(json, options.skinName);
    const atts = ensureSkinAttachments(json, options.skinName);
    const defaultSkinAtts = Array.isArray(json.skins)
      ? (json.skins.find((s: any) => s.name === "default")?.attachments ?? {})
      : (json.skins?.default ?? {});
    for (const c of copied) {
      // 插槽解析：精确名优先，其次容忍 "slot-" 前缀（build_skeleton 生成的插槽名为 slot-<部件>）
      const slot = (json.slots ?? []).some((s: any) => s.name === c.slot) ? c.slot : (json.slots ?? []).some((s: any) => s.name === `slot-${c.slot}`) ? `slot-${c.slot}` : null;
      if (!slot) {
        throw new SpineError(ErrorCode.INVALID_ARGUMENT, `插槽 "${c.slot}" 不存在于项目。`, `可用 spine_get_attachments 查看插槽。`);
      }
      // 附件名沿用该插槽默认皮肤的附件名（若无则用插槽名）
      const existing = Object.keys(defaultSkinAtts[slot] ?? {});
      const attName = existing[0] ?? slot;
      atts[slot] = {
        [attName]: {
          type: "region",
          path: `images/${c.file}`,
          x: 0,
          y: 0,
          width: c.width,
          height: c.height,
        },
      };
    }
    if (options.setDefault) setDefaultSkin(json, options.skinName);
  });

  return {
    skinName: options.skinName,
    slots: copied.map((c) => c.slot),
    copied: copied.map((c) => ({ slot: c.slot, file: c.file })),
    setDefault: !!options.setDefault,
    backupPath: result.backupPath,
  };
}
