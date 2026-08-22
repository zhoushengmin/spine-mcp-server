/**
 * 工具：spine_scale_project — 整体缩放项目
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { scaleProjectJson } from "../spine/json-handler";

export class ScaleProjectTool extends BaseTool {
  name = "spine_scale_project";
  description = "整体缩放项目（骨骼位置/长度、附件变换/尺寸、网格顶点、位移时间轴、骨架尺寸）。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
    scale: z.number().positive().describe("缩放比例，如 0.5 / 2.0"),
  });

  async run(args: { projectPath: string; scale: number }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => scaleProjectJson(json, args.scale));
    return { success: true, message: `项目已缩放 ${args.scale}x`, data: { scale: args.scale, backupPath: result.backupPath } };
  }
}
