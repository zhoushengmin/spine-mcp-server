/**
 * 资产扫描器：递归扫描目录下的 .spine 项目文件。
 * 供 MCP 工具 spine_list_cocos_assets 与 Cocos 扩展面板共用。
 */
import * as fs from "fs";
import * as path from "path";
import { ErrorCode, SpineError } from "../utils/error-codes";

export interface ScannedProject {
  path: string;
  name: string;
  size: number;
  modifiedTime: string;
}

export interface ScanOptions {
  recursive?: boolean;
  maxDepth?: number;
  limit?: number;
}

const DEFAULT_EXCLUDES = ["node_modules", ".git", "library", "temp", "build", "profiles", "local"];

/** 递归扫描目录，返回 .spine 文件列表 */
export function scanSpineProjects(rootDir: string, options: ScanOptions = {}): ScannedProject[] {
  if (!fs.existsSync(rootDir)) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `目录不存在：${rootDir}`);
  }
  if (!fs.statSync(rootDir).isDirectory()) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `路径不是目录：${rootDir}`);
  }
  const recursive = options.recursive ?? true;
  const maxDepth = options.maxDepth ?? 10;
  const limit = options.limit ?? 200;
  const results: ScannedProject[] = [];

  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth || results.length >= limit) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= limit) return;
      if (DEFAULT_EXCLUDES.includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".spine")) {
        let stat: fs.Stats;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        results.push({
          path: full,
          name: entry.name.replace(/\.spine$/i, ""),
          size: stat.size,
          modifiedTime: stat.mtime.toISOString(),
        });
      }
    }
  };
  walk(rootDir, 0);
  results.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
  return results;
}
