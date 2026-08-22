/**
 * 工具：spine_export_animation — 导出 JSON / 二进制
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { exportProject } from "../spine/export-service";
import { ExportFormat } from "../types";

export class ExportAnimationTool extends BaseTool {
  name = "spine_export_animation";
  description = "将 .spine 项目导出为 JSON 或二进制（.skel），返回输出文件路径列表。";
  inputSchema = z.object({
    projectPath: z.string(),
    outputDir: z.string().describe("导出目录（自动创建）"),
    format: z.enum(["json", "binary"]).default("json").describe("导出格式，默认 json"),
  });

  async run(args: { projectPath: string; outputDir: string; format: string }): Promise<any> {
    const files = await exportProject(args.projectPath, args.outputDir, {
      format: args.format as ExportFormat,
    });
    return {
      success: true,
      message: `导出完成：${files.length} 个文件`,
      data: { files },
    };
  }
}
