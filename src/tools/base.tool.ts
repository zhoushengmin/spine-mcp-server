/**
 * 工具基类：统一错误捕获 → ToolResult 结构
 */
import { z } from "zod";
import { ToolResult } from "../types";
import { toSpineError } from "../utils/error-codes";

/** 工具定义接口 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (args: any) => Promise<ToolResult>;
}

export abstract class BaseTool implements ToolDefinition {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodTypeAny;

  /** 具体执行逻辑（抛错即可，execute 会统一捕获） */
  protected abstract run(args: any): Promise<ToolResult>;

  /** 统一入口：捕获异常 → 返回友好 ToolResult */
  async execute(args: any): Promise<ToolResult> {
    try {
      return await this.run(args);
    } catch (err) {
      const e = toSpineError(err);
      return {
        success: false,
        message: e.message,
        errorCode: e.code,
        data: { suggestion: e.suggestion },
      };
    }
  }
}
