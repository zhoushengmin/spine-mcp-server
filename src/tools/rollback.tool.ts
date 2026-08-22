/**
 * 工具：spine_rollback — 列出备份 / 一键回滚
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { listBackups } from "../utils/file-utils";
import { ErrorCode, SpineError } from "../utils/error-codes";
import * as fs from "fs";
import * as path from "path";

export class RollbackTool extends BaseTool {
  name = "spine_rollback";
  description = "列出某项目全部历史备份；传入 backupId 则回滚到该备份（保留最近 10 次）。";
  inputSchema = z.object({
    projectPath: z.string(),
    backupId: z.string().optional().describe("备份文件名（不填则只列出备份）"),
  });

  async run(args: { projectPath: string; backupId?: string }): Promise<any> {
    const backups = listBackups(args.projectPath);
    if (!args.backupId) {
      return { success: true, message: `找到 ${backups.length} 个备份`, data: { backups } };
    }
    const backupPath = path.join(path.dirname(args.projectPath), args.backupId);
    if (!fs.existsSync(backupPath)) {
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `备份不存在：${args.backupId}`, "可用 spine_rollback 列出全部备份。");
    }
    // 回滚前再备份当前版本，保证可再回退
    fs.copyFileSync(args.projectPath, path.join(path.dirname(args.projectPath), `${path.basename(args.projectPath)}.pre-rollback.bak`));
    fs.copyFileSync(backupPath, args.projectPath);
    return { success: true, message: `已回滚到备份 ${args.backupId}`, data: { restored: args.backupId } };
  }
}
