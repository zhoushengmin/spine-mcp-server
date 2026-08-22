/**
 * 工具：spine_delete_transform — 删除变换约束
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { deleteConstraint } from "../spine/json-handler";

export class DeleteTransformTool extends BaseTool {
  name = "spine_delete_transform";
  description = "删除变换约束（同时移除动画中的 transform 时间轴）。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
    name: z.string(),
  });

  async run(args: { projectPath: string; name: string }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => deleteConstraint(json, "transform", args.name));
    return { success: true, message: `变换约束 "${args.name}" 已删除`, data: { name: args.name, backupPath: result.backupPath } };
  }
}
