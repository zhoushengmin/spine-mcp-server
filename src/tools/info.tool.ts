/**
 * 工具：spine_get_project_info — 获取项目结构化信息
 */
import { z } from "zod";
import * as fs from "fs";
import { BaseTool } from "./base.tool";
import { readProjectJson, parseProjectJson } from "../spine/project-reader";
import { getProjectInfo } from "../spine/info-service";
import { readJsonForExport } from "../spine/modify-service";
import { ErrorCode, SpineError } from "../utils/error-codes";
import * as path from "path";

export class GetProjectInfoTool extends BaseTool {
  name = "spine_get_project_info";
  description =
    "读取 .spine 项目或导出 JSON，返回结构化信息：版本/骨架名/尺寸/骨骼树/插槽/皮肤/动画/事件/纹理路径。非 3.8.75 版本附带兼容性警告。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 或 .json 文件的绝对路径"),
  });

  async run(args: { projectPath: string }): Promise<any> {
    const { projectPath } = args;
    if (!fs.existsSync(projectPath)) {
      throw new SpineError(ErrorCode.INVALID_ARGUMENT, `文件不存在：${projectPath}`, "请传入有效的绝对路径。");
    }
    const ext = path.extname(projectPath).toLowerCase();
    if (ext === ".json") {
      const info = readProjectJson(projectPath);
      return { success: true, message: "项目信息读取成功", data: info, warning: info.compatibilityWarning };
    }
    // .spine：导出 JSON + Info 命令合并
    const infoData = await getProjectInfo(projectPath);
    const json = await readJsonForExport(projectPath);
    const info = parseProjectJson(json, {
      skeletonName: infoData.skeletonName,
      size: infoData.size,
      fps: infoData.fps,
    });
    return { success: true, message: "项目信息读取成功", data: info, warning: info.compatibilityWarning };
  }
}
