/**
 * 清理服务：执行 CLI 的 -m（Animation clean up）清理未使用关键帧。
 * 输出格式（已实测）：`Animation clean up (N): <name>`
 */
import { cliExecutor } from "./cli-executor";
import { logger } from "../logger";

export interface CleanResult {
  projectPath: string;
  /** 清理的骨架名 */
  skeletonName: string;
  /** 清理的关键帧数量（-1 表示未能从输出解析） */
  removedKeys: number;
}

/** 执行清理 */
export async function cleanProject(projectPath: string): Promise<CleanResult> {
  const stdout = await cliExecutor.execToString(["-i", projectPath, "-m"]);
  logger.debug(`清理输出：${stdout}`);

  // 匹配 "Animation clean up (N): name"
  const m = stdout.match(/Animation clean up\s*\((\d+)\)\s*:\s*(\S+)/i);
  return {
    projectPath,
    skeletonName: m ? m[2] : "",
    removedKeys: m ? parseInt(m[1], 10) : -1,
  };
}
