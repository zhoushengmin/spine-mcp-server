/**
 * Info 服务：调用 `Spine.com -i <path>`（Info 命令）并解析 stdout 为结构化数据。
 * 输出示例（已实测）：
 *   Project info: D:\...\spineboy.spine
 *     Spine version: 3.8.55
 *     Dopesheet FPS: 30
 *     Skeleton: spineboy-ess
 *       Size: 470.72 x 731.57
 *       Bones (18): root, hip, ...
 *       Slots (20): ...
 *       Skins (2): ...
 *       Events (1): footstep
 *       Animations (7): death, hit, ...
 *   Complete.
 */
import { cliExecutor } from "./cli-executor";
import { logger } from "../logger";
import { SpineInfoData } from "../types";

/** 解析一行 "Key (N): value1, value2" 形式的列表 */
function parseCountedList(line: string): string[] {
  const m = line.match(/\((\d+)\):\s*(.*)$/i);
  if (!m) {
    return [];
  }
  return m[2]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 解析 Info 命令 stdout */
export function parseInfoOutput(stdout: string): SpineInfoData {
  const lines = stdout.split("\n").map((l) => l.trim());
  const pick = (key: RegExp): string | undefined => {
    const line = lines.find((l) => key.test(l));
    return line ? line.match(key)?.[1] : undefined;
  };

  const projectPath = pick(/^Project info:\s*(.+)$/i) ?? "";
  const version = pick(/^Spine version:\s*([0-9.]+)/i) ?? "";
  const fpsRaw = pick(/^Dopesheet FPS:\s*(\d+)/i);
  const skeletonName = pick(/^Skeleton:\s*(\S+)/i) ?? "";
  const sizeMatch = lines.find((l) => /^Size:\s*/.test(l))?.match(/^Size:\s*([\d.]+)\s*x\s*([\d.]+)/i);
  const bonesLine = lines.find((l) => /^Bones\s*\(/.test(l));
  const slotsLine = lines.find((l) => /^Slots\s*\(/.test(l));
  const skinsLine = lines.find((l) => /^Skins\s*\(/.test(l));
  const eventsLine = lines.find((l) => /^Events\s*\(/.test(l));
  const animLine = lines.find((l) => /^Animations\s*\(/.test(l));

  return {
    projectPath,
    version,
    fps: fpsRaw ? parseInt(fpsRaw, 10) : 30,
    skeletonName,
    size: sizeMatch ? { width: parseFloat(sizeMatch[1]), height: parseFloat(sizeMatch[2]) } : { width: 0, height: 0 },
    bones: bonesLine ? parseCountedList(bonesLine) : [],
    slots: slotsLine ? parseCountedList(slotsLine) : [],
    skins: skinsLine ? parseCountedList(skinsLine) : [],
    events: eventsLine ? parseCountedList(eventsLine) : [],
    animations: animLine ? parseCountedList(animLine) : [],
  };
}

/** 获取项目的 Info 结构化数据 */
export async function getProjectInfo(projectPath: string): Promise<SpineInfoData> {
  const stdout = await cliExecutor.execToString(["-i", projectPath]);
  const data = parseInfoOutput(stdout);
  if (!data.skeletonName) {
    logger.warn(`Info 输出未能解析出骨架名：${projectPath}`);
  }
  return data;
}

/** 仅获取骨架名 */
export async function getSkeletonName(projectPath: string): Promise<string> {
  const info = await getProjectInfo(projectPath);
  if (!info.skeletonName) {
    throw new Error(`无法从项目中解析骨架名：${projectPath}`);
  }
  return info.skeletonName;
}
