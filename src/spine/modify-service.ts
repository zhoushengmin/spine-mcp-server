/**
 * 修改服务：封装「导出 → 修改 JSON → 原地导入替换」的标准 Round-Trip 流程。
 * 所有修改类工具（control_bone/rename/set_attachment 等）复用此服务。
 */
import * as fs from "fs";
import * as path from "path";
import { exportProject } from "./export-service";
import { importJsonInPlace } from "./import-service";
import { getSkeletonName, getProjectInfo } from "./info-service";
import { readJsonFile, writeJsonFile, createTempDir, removeDir, ensureDir } from "../utils/file-utils";
import { ErrorCode, SpineError } from "../utils/error-codes";
import { validateJsonReferences } from "./validate-service";

export interface ModifyResult {
  /** 备份文件路径 */
  backupPath?: string;
  /** 骨架名 */
  skeletonName: string;
  /** fps（Info 命令） */
  fps: number;
  /** 修改后自动引用校验发现的问题（空数组 = 无问题） */
  warnings: string[];
}

/**
 * 对 .spine 项目执行一次 Round-Trip 修改。
 * @param projectPath  .spine 项目
 * @param modifyFn     修改函数，接收解析后的 JSON 对象，直接原地修改
 * @param skeletonName 骨架名（可选，自动获取）
 */
export async function modifyProject(
  projectPath: string,
  modifyFn: (json: any) => void,
  skeletonName?: string
): Promise<ModifyResult> {
  if (!fs.existsSync(projectPath)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `项目文件不存在：${projectPath}`);
  }
  const tempDir = createTempDir("spine-modify-");
  try {
    // 1. 导出 JSON
    const exportDir = path.join(tempDir, "export");
    ensureDir(exportDir);
    const files = await exportProject(projectPath, exportDir, { format: "json" });
    const jsonFile = files.find((f) => f.endsWith(".json"));
    if (!jsonFile) {
      throw new SpineError(ErrorCode.CLI_EXEC_FAILED, "导出未产生 JSON 文件。");
    }

    // 2. 修改 + 自动引用校验（安全网：提前暴露悬空引用）
    const json = readJsonFile(jsonFile);
    modifyFn(json);
    const warnings = validateJsonReferences(json);
    writeJsonFile(jsonFile, json);

    // 3. 骨架名 + fps
    const info = await getProjectInfo(projectPath);
    const name = skeletonName ?? info.skeletonName;
    if (!name) {
      throw new SpineError(ErrorCode.CLI_EXEC_FAILED, "无法解析骨架名。");
    }

    // 4. 原地导入替换（自动备份）
    const result = await importJsonInPlace(projectPath, jsonFile, name);
    return { backupPath: result.backupPath, skeletonName: name, fps: info.fps || 30, warnings };
  } finally {
    removeDir(tempDir);
  }
}

/** 便捷：导出项目 JSON 并读取为对象（只读工具用，自动清理临时目录） */
export async function readJsonForExport(projectPath: string): Promise<any> {
  const tempDir = createTempDir("spine-read-");
  const exportDir = path.join(tempDir, "export");
  ensureDir(exportDir);
  try {
    const files = await exportProject(projectPath, exportDir, { format: "json" });
    const jsonFile = files.find((f) => f.endsWith(".json"));
    if (!jsonFile) {
      throw new SpineError(ErrorCode.CLI_EXEC_FAILED, "导出未产生 JSON 文件。");
    }
    return readJsonFile(jsonFile);
  } finally {
    removeDir(tempDir);
  }
}

/** 便捷：获取 fps（供 frameToTime 使用） */
export async function getFps(projectPath: string): Promise<number> {
  const info = await getProjectInfo(projectPath);
  return info.fps || 30;
}
