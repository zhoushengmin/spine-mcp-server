/**
 * 工具：spine_rename_animation — 重命名动画
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { renameAnimation } from "../spine/json-handler";

export class RenameAnimationTool extends BaseTool {
  name = "spine_rename_animation";
  description = "重命名动画。";
  inputSchema = z.object({
    projectPath: z.string(),
    oldName: z.string(),
    newName: z.string(),
  });

  async run(args: { projectPath: string; oldName: string; newName: string }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => {
      renameAnimation(json, args.oldName, args.newName);
    });
    return {
      success: true,
      message: `动画 "${args.oldName}" 已重命名为 "${args.newName}"`,
      data: { oldName: args.oldName, newName: args.newName, backupPath: result.backupPath },
    };
  }
}
