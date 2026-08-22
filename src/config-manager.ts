/**
 * 配置管理器：统一管理 SPINE_EXE、日志级别、超时等配置，消除硬编码。
 * 加载优先级：.env 文件 < 进程环境变量 < 显式传入
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { ErrorCode, SpineError } from "./utils/error-codes";
import { configureLogger, logger } from "./logger";
import { LogLevel, DEFAULT_CLI_TIMEOUT_MS, DEFAULT_LOG_LEVEL, SPINE_EXE_NAME } from "./constants";

/** 运行时配置 */
export interface Config {
  /** Spine 命令行工具绝对路径 */
  spineExe: string;
  /** 日志级别 */
  logLevel: LogLevel;
  /** CLI 超时（毫秒） */
  cliTimeoutMs: number;
  /** Cocos 项目工作区路径（可选，Phase 6 使用） */
  cocosWorkspace?: string;
  /** 配置文件路径（如为 .env 加载则记录） */
  configSource: string;
}

/** 常见的 Spine 安装位置（Windows），用于自动检测 */
const SPINE_SEARCH_PATHS: string[] = [
  // 本机已知路径（实测）
  "D:/cocos/SpinePro3.8.75/Spine.com",
  // 官方默认安装
  "C:/Program Files/Spine/Spine.com",
  "C:/Program Files (x86)/Spine/Spine.com",
  "D:/Spine/Spine.com",
  "E:/Spine/Spine.com",
  // macOS（暂保留，供后期扩展）
  "/Applications/Spine/Spine.app/Contents/MacOS/Spine",
];

class ConfigManager {
  private config: Config | null = null;

  /** 加载 .env（若存在） */
  private loadDotEnv(): void {
    // 项目根目录 .env
    const projectRoot = path.resolve(__dirname, "..");
    const envPath = path.join(projectRoot, ".env");
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }

  /** 自动检测 Spine 可执行文件（找不到返回 undefined） */
  private detectSpineExe(): string | undefined {
    for (const p of SPINE_SEARCH_PATHS) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          return p;
        }
      } catch {
        // ignore
      }
    }
    // 尝试 PATH 中是否有 Spine.com
    try {
      const paths = (process.env.PATH ?? "").split(path.delimiter);
      for (const dir of paths) {
        if (!dir) continue;
        const candidate = path.join(dir, SPINE_EXE_NAME);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  /** 读取并解析配置（幂等，可重复调用） */
  load(overrides: Partial<Config> = {}): Config {
    if (this.config && Object.keys(overrides).length === 0) {
      return this.config;
    }
    this.loadDotEnv();

    // 1) 确定 spineExe
    let spineExe = overrides.spineExe ?? process.env.SPINE_EXE?.trim();
    let source = "SPINE_EXE 环境变量/.env";
    if (!spineExe) {
      spineExe = this.detectSpineExe();
      source = "自动检测";
    }

    // 2) 日志级别
    const rawLevel = overrides.logLevel ?? (process.env.LOG_LEVEL as LogLevel) ?? DEFAULT_LOG_LEVEL;
    const logLevel: LogLevel = (["error", "warn", "info", "debug"] as LogLevel[]).includes(rawLevel)
      ? rawLevel
      : DEFAULT_LOG_LEVEL;

    // 3) 超时
    const rawTimeout = overrides.cliTimeoutMs ?? Number(process.env.CLI_TIMEOUT_MS ?? DEFAULT_CLI_TIMEOUT_MS);
    const cliTimeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_CLI_TIMEOUT_MS;

    // 4) Cocos 工作区
    const cocosWorkspace = overrides.cocosWorkspace ?? process.env.COCOS_WORKSPACE?.trim();

    this.config = {
      spineExe: spineExe ?? "",
      logLevel,
      cliTimeoutMs,
      cocosWorkspace,
      configSource: source,
    };

    // 联动日志器
    configureLogger(this.config.logLevel);
    return this.config;
  }

  /** 获取已加载配置（未加载则先加载） */
  get(): Config {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }

  /** 校验 Spine CLI 是否存在，不存在则抛 E_SPINE_NOT_FOUND */
  assertSpineExists(): Config {
    const cfg = this.get();
    if (!cfg.spineExe) {
      throw new SpineError(
        ErrorCode.SPINE_NOT_FOUND,
        "未找到 Spine.com。请设置环境变量 SPINE_EXE 指向 Spine 命令行工具的绝对路径（例如 D:/cocos/SpinePro3.8.75/Spine.com）。",
        "可在项目根目录复制 .env.example 为 .env 并填写 SPINE_EXE。"
      );
    }
    if (!fs.existsSync(cfg.spineExe)) {
      throw new SpineError(
        ErrorCode.SPINE_NOT_FOUND,
        `配置的 SPINE_EXE 路径不存在：${cfg.spineExe}`,
        "请检查路径是否正确，或使用安装向导自动检测。"
      );
    }
    return cfg;
  }

  /** 打印当前配置摘要（check 命令使用） */
  summarize(): string {
    const cfg = this.assertSpineExists();
    const lines = [
      `Spine CLI : ${cfg.spineExe}  (来源: ${cfg.configSource})`,
      `日志级别  : ${cfg.logLevel}`,
      `CLI 超时  : ${cfg.cliTimeoutMs} ms`,
    ];
    if (cfg.cocosWorkspace) {
      lines.push(`Cocos 工作区: ${cfg.cocosWorkspace}`);
    }
    return lines.join("\n");
  }
}

/** 全局单例 */
export const configManager = new ConfigManager();
