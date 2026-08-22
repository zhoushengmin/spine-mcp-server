/**
 * 工具：spine_delete_path — 删除路径约束
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { deleteConstraint } from "../spine/json-handler";

export class DeletePathTool extends BaseTool {
  name = "spine_delete_path";
  description = "删除路径约束（同时移除动画中的 path 时间轴）。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
    name: z.string(),
  });

  async run(args: { projectPath: string; name: string }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => deleteConstraint(json, "path", args.name));
    return { success: true, message: `路径约束 "${args.name}" 已删除`, data: { name: args.name, backupPath: result.backupPath } };
  }
}
