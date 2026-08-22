/**
 * 工具：spine_list_animations — 列出动画及关键帧统计
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { readProjectJson, parseProjectJson } from "../spine/project-reader";
import { readJsonForExport } from "../spine/modify-service";
import * as path from "path";

export class ListAnimationsTool extends BaseTool {
  name = "spine_list_animations";
  description = "列出项目中所有动画：名称、时长（秒）、关键帧总数。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目或 .json 文件的绝对路径"),
  });

  async run(args: { projectPath: string }): Promise<any> {
    const { projectPath } = args;
    const isJson = path.extname(projectPath).toLowerCase() === ".json";
    const info = isJson ? readProjectJson(projectPath, {}) : parseProjectJson(await readJsonForExport(projectPath), {});
    const animations = info.animations.map((a) => ({ name: a.name, duration: a.duration, keyframeCount: a.keyframeCount }));
    return { success: true, message: `共 ${animations.length} 个动画`, data: { animations } };
  }
}
