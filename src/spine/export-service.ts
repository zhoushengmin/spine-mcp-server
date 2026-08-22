/**
 * 导出服务：生成导出设置 JSON 并调用 CLI 导出。
 * 关键点（已实测）：`-e` 接收的是导出设置 JSON 文件，而非直接输出路径。
 */
import * as fs from "fs";
import * as path from "path";
import { cliExecutor } from "./cli-executor";
import { ExportOptions } from "../types";
import { ErrorCode, SpineError } from "../utils/error-codes";
import { ensureDir, createTempDir, removeDir } from "../utils/file-utils";

/** 各格式默认扩展名 */
const DEFAULT_EXT: Record<string, string> = {
  json: ".json",
  binary: ".skel",
  texture: ".png",
  video: ".mp4",
};

/**
 * 依据导出选项生成 CLI 导出设置 JSON 对象。
 * json/binary 格式已实测验证；texture/video 按 CLI 约定构造。
 */
export function generateExportSettings(options: ExportOptions): Record<string, any> {
  const ext = options.extension ?? DEFAULT_EXT[options.format];
  switch (options.format) {
    case "json":
      return {
        class: "json",
        extension: ext,
        format: "JSON",
        nonessential: options.nonessential ?? true,
        prettyPrint: options.prettyPrint ?? true,
      };
    case "binary":
      return {
        class: "binary",
        extension: ext,
        nonessential: options.nonessential ?? true,
      };
    case "texture":
      // 注意：图片导出类名为 "images"（3.8.75 实测，非 "texture"）。
      // 完整 schema 需在 Phase 4 render_preview 时对照 Spine 编辑器预设确认。
      return {
        class: "images",
        extension: ext,
        nonessential: options.nonessential ?? true,
        ...(options.fps ? { fps: options.fps } : {}),
        ...(options.frameCount ? { frameCount: options.frameCount } : {}),
      };
    case "video":
      return {
        class: "video",
        extension: ext,
        nonessential: options.nonessential ?? true,
        ...(options.fps ? { fps: options.fps } : {}),
        ...(options.loop !== undefined ? { loop: options.loop } : {}),
        ...(options.width ? { width: options.width } : {}),
        ...(options.height ? { height: options.height } : {}),
      };
    default:
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `不支持的导出格式：${options.format}`, "支持 json|binary|texture|video。");
  }
}

/**
 * 执行导出。
 * @param projectPath  .spine 项目路径
 * @param outputDir    输出目录（不存在则创建）
 * @param options      导出选项
 * @returns 输出目录中生成的文件绝对路径列表
 */
export async function exportProject(projectPath: string, outputDir: string, options: ExportOptions): Promise<string[]> {
  ensureDir(outputDir);
  const settings = generateExportSettings(options);

  // 导出设置写入临时文件
  const tempDir = createTempDir("spine-export-");
  const settingsPath = path.join(tempDir, "settings.json");
  fs.writeFileSync(settingsPath, JSON.stringify(settings), "utf8");

  try {
    await cliExecutor.exec({ args: ["-i", projectPath, "-o", outputDir, "-e", settingsPath] });
    // 收集输出目录中新增的文件
    return fs.readdirSync(outputDir).map((f) => path.join(outputDir, f));
  } finally {
    removeDir(tempDir);
  }
}

/** 便捷：导出 JSON */
export function exportJson(projectPath: string, outputDir: string): Promise<string[]> {
  return exportProject(projectPath, outputDir, { format: "json" });
}

/** 便捷：导出二进制 */
export function exportBinary(projectPath: string, outputDir: string): Promise<string[]> {
  return exportProject(projectPath, outputDir, { format: "binary" });
}
