/**
 * 日志系统：支持级别控制 + 控制台彩色输出 + 可选写入文件
 * 级别：error(0) < warn(1) < info(2) < debug(3)
 */
import * as fs from "fs";
import * as path from "path";
import { LogLevel, DEFAULT_LOG_LEVEL } from "./constants";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
};

// 控制台颜色（非 TTY 环境自动禁用）
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  error: COLORS.red,
  warn: COLORS.yellow,
  info: COLORS.green,
  debug: COLORS.gray,
};

/** 日志器配置 */
export interface LoggerOptions {
  level?: LogLevel;
  /** 可选：日志文件绝对路径（写入追加模式） */
  filePath?: string;
}

class Logger {
  private level: LogLevel;
  private filePath?: string;
  private useColor: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? DEFAULT_LOG_LEVEL;
    this.filePath = options.filePath;
    this.useColor = typeof process !== "undefined" && !!process.stdout?.isTTY;
  }

  /** 设置日志级别 */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /** 设置输出文件 */
  setFile(path: string): void {
    this.filePath = path;
  }

  /** 获取当前级别 */
  getLevel(): LogLevel {
    return this.level;
  }

  private formatTimestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private write(level: LogLevel, msg: string): void {
    if (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[this.level]) {
      return;
    }
    const ts = this.formatTimestamp();
    const label = LEVEL_LABEL[level];
    let line = `[${ts}] ${label} ${msg}`;
    if (this.useColor) {
      line = `${LEVEL_COLOR[level]}${line}${COLORS.reset}`;
    }
    // 控制台输出：
    // - MCP 场景（非 TTY 子进程）：全部走 stderr，保证 stdout 纯净（stdout 是 MCP 协议通道）
    // - 交互式 CLI（TTY）：info/warn/debug 走 stdout，error 走 stderr
    if (level === "error") {
      process.stderr.write(line + "\n");
    } else if (this.useColor) {
      process.stdout.write(line + "\n");
    } else {
      process.stderr.write(line + "\n");
    }
    // 文件（不含颜色）
    if (this.filePath) {
      try {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        fs.appendFileSync(this.filePath, `[${ts}] ${label} ${msg}\n`, "utf8");
      } catch {
        // 文件写入失败不阻塞主流程
      }
    }
  }

  error(msg: string): void {
    this.write("error", msg);
  }

  warn(msg: string): void {
    this.write("warn", msg);
  }

  info(msg: string): void {
    this.write("info", msg);
  }

  debug(msg: string): void {
    this.write("debug", msg);
  }
}

/** 全局单例日志器 */
export const logger = new Logger();

/** 依据字符串创建/配置日志器（用于 config-manager 联动） */
export function configureLogger(level: LogLevel, filePath?: string): void {
  logger.setLevel(level);
  if (filePath) {
    logger.setFile(filePath);
  }
}
