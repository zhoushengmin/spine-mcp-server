/**
 * 工具：spine_duplicate_animation — 复制动画
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { duplicateAnimation } from "../spine/json-handler";

export class DuplicateAnimationTool extends BaseTool {
  name = "spine_duplicate_animation";
  description = "复制现有动画为副本，作为二次编辑的起点。";
  inputSchema = z.object({
    projectPath: z.string(),
    sourceName: z.string(),
    newName: z.string(),
  });

  async run(args: { projectPath: string; sourceName: string; newName: string }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => {
      duplicateAnimation(json, args.sourceName, args.newName);
    });
    return {
      success: true,
      message: `动画 "${args.sourceName}" 已复制为 "${args.newName}"`,
      data: { sourceName: args.sourceName, newName: args.newName, backupPath: result.backupPath },
    };
  }
}
