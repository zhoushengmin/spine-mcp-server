/**
 * 工具：spine_clean_animation — 清理未使用关键帧（CLI -m）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { cleanProject } from "../spine/cleanup-service";
import { backupFile } from "../utils/file-utils";
import { logger } from "../logger";

export class CleanAnimationTool extends BaseTool {
  name = "spine_clean_animation";
  description = "清理项目中未使用的关键帧（对应 Spine CLI 的 -m），执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
  });

  async run(args: { projectPath: string }): Promise<any> {
    // 先备份，再原地清理（-m 会保存项目）
    const backupPath = backupFile(args.projectPath);
    logger.info(`已自动备份：${backupPath}`);
    const result = await cleanProject(args.projectPath);
    return {
      success: true,
      message: `清理完成：移除 ${result.removedKeys} 个未使用关键帧`,
      data: { skeletonName: result.skeletonName, removedKeys: result.removedKeys, backupPath },
    };
  }
}
