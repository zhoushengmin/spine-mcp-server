/**
 * 工具：spine_render_preview — 渲染动画帧为 PNG 预览
 *
 * ⚠️ 说明（Phase 3）：Spine 3.8.75 CLI 的图片导出（class=images）schema 在 CLI 上
 * 不可直接使用（官方示例也只导 json/binary/atlas）。本工具当前尝试 CLI 图片导出，
 * 若失败会返回明确提示；完整渲染方案（JS Spine 运行时）在 Phase 4 实现。
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { exportProject } from "../spine/export-service";
import { ensureDir } from "../utils/file-utils";

export class RenderPreviewTool extends BaseTool {
  name = "spine_render_preview";
  description = "渲染动画为 PNG 图片序列预览（依赖 Spine CLI 图片导出）。当前版本为 Phase 3 占位，完整渲染方案在 Phase 4 提供。";
  inputSchema = z.object({
    projectPath: z.string(),
    outputDir: z.string(),
    animationName: z.string().optional(),
    frameIndex: z.number().optional(),
  });

  async run(args: { projectPath: string; outputDir: string; animationName?: string; frameIndex?: number }): Promise<any> {
    ensureDir(args.outputDir);
    try {
      const files = await exportProject(args.projectPath, args.outputDir, {
        format: "texture",
        frameCount: args.frameIndex !== undefined ? args.frameIndex + 1 : undefined,
      });
      return { success: true, message: `渲染完成：${files.length} 个文件`, data: { files } };
    } catch (err) {
      return {
        success: false,
        message: "渲染预览依赖 Spine CLI 的图片导出能力，当前版本 3.8.75 的 CLI 图片导出 schema 不可直接使用。",
        errorCode: "E_CLI_EXEC_FAILED",
        data: { suggestion: "该功能将在 Phase 4 通过 JS Spine 运行时实现（导出 JSON + 图集后在前端渲染）。", detail: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}
