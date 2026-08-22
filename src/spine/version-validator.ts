/**
 * 版本校验器：识别项目/文件的 Spine 版本。
 *
 * 实现策略（已实测验证）：
 * - .json 文件：直接读取 JSON 中的 skeleton.spine 字段
 * - .spine 项目（二进制）：调用 `Spine.com -i <path>`（Info 命令），
 *   从 stdout 解析 `Spine version: x.y.z`
 */
import * as fs from "fs";
import * as path from "path";
import { cliExecutor } from "./cli-executor";
import { logger } from "../logger";
import { SUPPORTED_SPINE_VERSION } from "../constants";
import { ErrorCode, SpineError } from "../utils/error-codes";

/** 版本检测结果 */
export interface VersionResult {
  version: string;
  /** 文件是否为 .json（数据文件） */
  isJson: boolean;
  /** 是否为目标版本 3.8.75 */
  isSupported: boolean;
  /** 若版本存在但非 3.8.75，附带友好警告 */
  warning?: string;
}

/** 从 JSON 内容中提取 spine 版本 */
function versionFromJson(raw: string): string | undefined {
  try {
    const data = JSON.parse(raw);
    return data?.skeleton?.spine;
  } catch {
    return undefined;
  }
}

/** 从 Info 命令 stdout 中解析项目版本，如 `Spine version: 3.8.55` */
function versionFromInfoOutput(stdout: string): string | undefined {
  const m = stdout.match(/Spine version:\s*([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    return m[1];
  }
  // 兜底：Launcher 首行 `Spine Launcher 3.8.75` 或 `Spine 3.8.75 Professional`
  const m2 = stdout.match(/Spine(?: Launcher)?\s+([0-9]+\.[0-9]+\.[0-9]+)/i);
  return m2 ? m2[1] : undefined;
}

class VersionValidator {
  /**
   * 检测文件版本。
   * @param filePath .spine 项目文件或 .json 数据文件
   */
  async detect(filePath: string): Promise<VersionResult> {
    if (!fs.existsSync(filePath)) {
      throw new SpineError(
        ErrorCode.INVALID_ARGUMENT,
        `文件不存在：${filePath}`,
        "请传入有效的绝对路径。"
      );
    }
    const ext = path.extname(filePath).toLowerCase();
    const isJson = ext === ".json";
    let version: string | undefined;

    if (isJson) {
      // JSON 数据文件：直接读取
      const raw = fs.readFileSync(filePath, "utf8");
      version = versionFromJson(raw);
      if (!version) {
        // 可能是导出设置类 JSON，无 skeleton.spine
        return {
          version: "unknown",
          isJson: true,
          isSupported: false,
          warning: "该 JSON 不是 Spine 数据文件（缺少 skeleton.spine 字段）。",
        };
      }
    } else {
      // 二进制 .spine：走 Info 命令
      const stdout = await cliExecutor.execToString(["-i", filePath]);
      version = versionFromInfoOutput(stdout);
      if (!version) {
        throw new SpineError(
          ErrorCode.CLI_EXEC_FAILED,
          "无法从 Spine CLI 输出中识别版本号。",
          "请确认该文件是有效的 Spine 项目文件。"
        );
      }
    }

    const isSupported = version === SUPPORTED_SPINE_VERSION;
    const warning = isSupported
      ? undefined
      : `检测到当前 Spine 项目版本为 ${version}，本服务器主要针对 ${SUPPORTED_SPINE_VERSION} 优化，部分功能（如骨骼控制、JSON 导入导出）在非 ${SUPPORTED_SPINE_VERSION} 版本上可能无法正常工作或存在未知兼容性问题。建议使用 Spine ${SUPPORTED_SPINE_VERSION} 以获得最佳体验。`;

    if (warning) {
      logger.warn(warning);
    } else {
      logger.info(`项目版本 ${version}，与开发基准 ${SUPPORTED_SPINE_VERSION} 一致`);
    }

    return { version, isJson, isSupported, warning };
  }

  /** 快速比较版本是否为 3.8.75 */
  isSupported(version: string): boolean {
    return version === SUPPORTED_SPINE_VERSION;
  }
}

/** 全局单例 */
export const versionValidator = new VersionValidator();
