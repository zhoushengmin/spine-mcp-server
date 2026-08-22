/**
 * 工具：spine_delete_animation — 删除动画
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { deleteAnimation } from "../spine/json-handler";

export class DeleteAnimationTool extends BaseTool {
  name = "spine_delete_animation";
  description = "删除指定动画。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
    animationName: z.string(),
  });

  async run(args: { projectPath: string; animationName: string }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => {
      deleteAnimation(json, args.animationName);
    });
    return {
      success: true,
      message: `动画 "${args.animationName}" 已删除`,
      data: { animationName: args.animationName, backupPath: result.backupPath },
    };
  }
}
