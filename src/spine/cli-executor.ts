/**
 * CLI 执行器：封装 child_process 调用 Spine.com。
 * 特性：超时控制（默认 60s）、stdout/stderr 采集、退出码检测、统一错误码。
 */
import { spawn } from "child_process";
import { configManager } from "../config-manager";
import { logger } from "../logger";
import { ErrorCode, SpineError } from "../utils/error-codes";

/** CLI 执行结果 */
export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** 实际耗时（毫秒） */
  durationMs: number;
}

/** 执行选项 */
export interface CliExecOptions {
  /** 参数数组，如 ["-i", "path.spine"] */
  args: string[];
  /** 自定义超时（毫秒），缺省用配置值 */
  timeoutMs?: number;
  /** 工作目录（可选） */
  cwd?: string;
  /** 是否允许非零退出码而不抛错（默认 false：非零则抛 E_CLI_EXEC_FAILED） */
  allowNonZero?: boolean;
  /** 额外环境变量 */
  env?: Record<string, string>;
}

class CliExecutor {
  /**
   * 同步等待方式执行 Spine.com 并返回结果。
   * 使用 Promise 封装 spawn，避免 shell 注入问题（参数以数组传递）。
   */
  async exec(options: CliExecOptions): Promise<CliResult> {
    const cfg = configManager.assertSpineExists();
    const timeoutMs = options.timeoutMs ?? cfg.cliTimeoutMs;

    return new Promise<CliResult>((resolve, reject) => {
      const startedAt = Date.now();
      logger.debug(`CLI 执行: ${cfg.spineExe} ${options.args.join(" ")}`);

      let child;
      try {
        child = spawn(cfg.spineExe, options.args, {
          cwd: options.cwd,
          env: options.env ? { ...process.env, ...options.env } : process.env,
          windowsHide: true,
        });
      } catch (err) {
        reject(
          new SpineError(
            ErrorCode.SPINE_NOT_FOUND,
            `无法启动 Spine CLI：${err instanceof Error ? err.message : String(err)}`,
            "请检查 SPINE_EXE 路径是否有效。"
          )
        );
        return;
      }

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        logger.warn(`CLI 执行超时(${timeoutMs}ms)，正在终止进程: ${cfg.spineExe}`);
        try {
          child.kill();
        } catch {
          // ignore
        }
        reject(
          new SpineError(
            ErrorCode.CLI_TIMEOUT,
            `Spine CLI 执行超时（超过 ${timeoutMs}ms）。可能是项目过大或工具卡住。`,
            "可适当调大 CLI_TIMEOUT_MS，或检查项目文件是否有损坏。"
          )
        );
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(
          new SpineError(
            ErrorCode.SPINE_NOT_FOUND,
            `Spine CLI 启动失败：${err.message}`,
            "请确认 SPINE_EXE 指向有效的 Spine.com 文件，且许可证已激活。"
          )
        );
      });

      child.on("close", (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const result: CliResult = {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? -1,
          durationMs: Date.now() - startedAt,
        };
        logger.debug(
          `CLI 完成 exit=${result.exitCode} 耗时=${result.durationMs}ms` +
            (result.stderr ? ` stderr: ${result.stderr.slice(0, 300)}` : "")
        );

        if (!options.allowNonZero && result.exitCode !== 0) {
          reject(
            new SpineError(
              ErrorCode.CLI_EXEC_FAILED,
              `Spine CLI 执行失败（退出码 ${result.exitCode}）${result.stderr ? "：" + result.stderr.slice(0, 500) : ""}`,
              "请检查参数是否正确、项目是否兼容 3.8.75。可在 debug 日志中查看完整输出。"
            )
          );
          return;
        }
        resolve(result);
      });
    });
  }

  /**
   * 便捷方法：执行并返回 stdout（非零退出码即抛错）。
   */
  async execToString(args: string[], options: Partial<CliExecOptions> = {}): Promise<string> {
    const result = await this.exec({ args, ...options });
    return result.stdout;
  }
}

/** 全局单例 */
export const cliExecutor = new CliExecutor();
