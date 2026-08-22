/**
 * 文件工具：临时目录、备份、路径处理
 */
import * as fs from "fs";
import * as path from "path";
import { MAX_BACKUPS } from "../constants";

/** 确保目录存在（递归创建） */
export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 创建唯一的临时目录 */
export function createTempDir(prefix = "spine-mcp-"): string {
  const base = path.join(require("os").tmpdir(), prefix + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
  return ensureDir(base);
}

/** 删除目录（忽略错误） */
export function removeDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * 备份文件：在项目同目录生成 {filename}.{timestamp}.bak，
 * 并清理超出 MAX_BACKUPS 数量的旧备份。
 * @returns 备份文件绝对路径
 */
export function backupFile(filePath: string): string {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = path.join(dir, `${base}.${ts}.bak`);
  fs.copyFileSync(filePath, backupPath);

  // 清理旧备份，保留最近 MAX_BACKUPS 个
  try {
    const backups = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(base + ".") && f.endsWith(".bak"))
      .sort()
      .reverse();
    for (const old of backups.slice(MAX_BACKUPS)) {
      fs.rmSync(path.join(dir, old), { force: true });
    }
  } catch {
    // ignore
  }
  return backupPath;
}

/** 列出某文件的所有备份 */
export function listBackups(filePath: string): string[] {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(base + ".") && f.endsWith(".bak"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** 读取 JSON 文件为对象（抛 E_JSON_PARSE 由调用方处理） */
export function readJsonFile(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** 写出 JSON 文件（可选格式化） */
export function writeJsonFile(filePath: string, data: any, pretty = true): void {
  fs.writeFileSync(filePath, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data), "utf8");
}
