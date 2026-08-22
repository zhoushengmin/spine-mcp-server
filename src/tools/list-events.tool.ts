/**
 * 工具：spine_list_events — 列出事件定义
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { readJsonForExport } from "../spine/modify-service";
import { readJsonFile } from "../utils/file-utils";
import * as path from "path";

export class ListEventsTool extends BaseTool {
  name = "spine_list_events";
  description = "列出项目中定义的所有事件（名称及 int/float/string 类型）。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目或 .json 文件的绝对路径"),
  });

  async run(args: { projectPath: string }): Promise<any> {
    const { projectPath } = args;
    const isJson = path.extname(projectPath).toLowerCase() === ".json";
    const json = isJson ? readJsonFile(projectPath) : await readJsonForExport(projectPath);
    const events = Object.entries(json.events ?? {}).map(([name, def]: [string, any]) => ({
      name,
      int: def?.int,
      float: def?.float,
      string: def?.string,
    }));
    return { success: true, message: `共 ${events.length} 个事件`, data: { events } };
  }
}
