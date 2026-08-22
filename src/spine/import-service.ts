/**
 * 导入服务：将修改后的 JSON 导入回 .spine 项目。
 * 关键点（已实测）：使用 `-r` 参数导入；`-o` 指向目标项目文件。
 * 导入前自动备份。
 */
import * as fs from "fs";
import * as path from "path";
import { cliExecutor } from "./cli-executor";
import { getSkeletonName } from "./info-service";
import { ImportOptions } from "../types";
import { ErrorCode, SpineError } from "../utils/error-codes";
import { backupFile, createTempDir, removeDir } from "../utils/file-utils";
import { logger } from "../logger";

export interface ImportResult {
  /** 导入后的项目路径 */
  projectPath: string;
  /** 自动备份文件路径 */
  backupPath?: string;
  /** 使用的骨架名 */
  skeletonName: string;
}

/**
 * 将 JSON 数据导入（替换）到 .spine 项目。
 * @param projectPath 目标 .spine 项目
 * @param jsonPath    要导入的 JSON 数据文件
 * @param options     导入选项
 */
export async function importJson(
  projectPath: string,
  jsonPath: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  if (!fs.existsSync(jsonPath)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `要导入的 JSON 文件不存在：${jsonPath}`);
  }
  const targetExists = fs.existsSync(projectPath);
  // CLI 的 -o 支持"不存在则创建"，故不强制目标存在；仅在目标存在时自动备份
  let backupPath: string | undefined;
  if (options.backup !== false && targetExists) {
    backupPath = backupFile(projectPath);
    logger.info(`已自动备份：${backupPath}`);
  } else if (!targetExists) {
    logger.info(`目标项目不存在，将创建新项目：${projectPath}`);
  }

  // 骨架名：未提供时从 Info 命令获取（目标不存在则必须显式指定）
  let skeletonName = options.skeletonName;
  if (!skeletonName) {
    if (!targetExists) {
      throw new SpineError(
        ErrorCode.INVALID_ARGUMENT,
        `目标项目不存在且未指定骨架名：${projectPath}`,
        "创建新项目时必须传入 skeletonName 参数。"
      );
    }
    skeletonName = await getSkeletonName(projectPath);
  }
  logger.debug(`导入骨架 "${skeletonName}" 到 ${projectPath}`);

  await cliExecutor.exec({ args: ["-i", jsonPath, "-o", projectPath, "-r", skeletonName] });

  return { projectPath, backupPath, skeletonName };
}

/**
 * 原地替换导入（Round-Trip 专用，已实测验证）：
 * 导入 JSON 到**临时新项目文件**，再原子替换原项目。
 * 直接 `-o` 指向已存在项目会丢失修改，故必须先导入到新文件。
 * @param projectPath  目标 .spine 项目（必须存在）
 * @param jsonPath     修改后的 JSON
 * @param skeletonName 骨架名（不填自动获取）
 */
export async function importJsonInPlace(
  projectPath: string,
  jsonPath: string,
  skeletonName?: string
): Promise<ImportResult> {
  if (!fs.existsSync(projectPath)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `目标项目文件不存在：${projectPath}`);
  }
  if (!fs.existsSync(jsonPath)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `要导入的 JSON 文件不存在：${jsonPath}`);
  }

  // 1. 自动备份
  const backupPath = backupFile(projectPath);
  logger.info(`已自动备份：${backupPath}`);

  // 2. 骨架名
  const name = skeletonName ?? (await getSkeletonName(projectPath));

  // 3. 导入到临时新项目文件
  const tempDir = createTempDir("spine-inplace-");
  const tempProject = path.join(tempDir, path.basename(projectPath));
  try {
    await cliExecutor.exec({ args: ["-i", jsonPath, "-o", tempProject, "-r", name] });
    if (!fs.existsSync(tempProject)) {
      throw new SpineError(ErrorCode.CLI_EXEC_FAILED, "导入生成的新项目文件不存在，导入可能失败。");
    }
    // 4. 原子替换原项目
    fs.copyFileSync(tempProject, projectPath);
    logger.info(`已用导入结果替换原项目：${projectPath}`);
  } finally {
    removeDir(tempDir);
  }

  return { projectPath, backupPath, skeletonName: name };
}
