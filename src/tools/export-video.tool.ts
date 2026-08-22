/**
 * 工具：spine_export_video — 导出动画为视频
 *
 * ⚠️ 说明：Spine 3.8.75 CLI 的视频导出 schema 在 CLI 上不可直接使用（与图片导出相同限制），
 * 完整渲染/视频方案在后续阶段通过 JS Spine 运行时实现。当前返回明确提示。
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { exportProject } from "../spine/export-service";
import { ensureDir } from "../utils/file-utils";

export class ExportVideoTool extends BaseTool {
  name = "spine_export_video";
  description = "导出动画为视频（MP4/WebM/GIF）。当前版本受 Spine 3.8.75 CLI 限制，返回提示；完整视频导出由 JS 渲染方案提供。";
  inputSchema = z.object({
    projectPath: z.string(),
    animationName: z.string().optional(),
    outputPath: z.string(),
    fps: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    ensureDir(args.outputPath);
    try {
      const files = await exportProject(args.projectPath, args.outputPath, {
        format: "video",
        fps: args.fps,
        width: args.width,
        height: args.height,
      });
      return { success: true, message: `视频导出完成：${files.length} 个文件`, data: { files } };
    } catch (err) {
      return {
        success: false,
        message: "视频导出依赖 Spine CLI 的视频导出能力，3.8.75 的 CLI 视频导出 schema 不可直接使用。",
        errorCode: "E_CLI_EXEC_FAILED",
        data: { suggestion: "完整视频导出将通过 JS Spine 运行时实现（后续阶段）。", detail: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}
