/**
 * 工具：spine_list_constraints — 列出全部约束
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { readJsonForExport } from "../spine/modify-service";
import { readJsonFile } from "../utils/file-utils";
import * as path from "path";

export class ListConstraintsTool extends BaseTool {
  name = "spine_list_constraints";
  description = "列出项目全部约束（IK / 变换 / 路径）及其骨骼、目标。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目或 .json 文件的绝对路径"),
  });

  async run(args: { projectPath: string }): Promise<any> {
    const { projectPath } = args;
    const isJson = path.extname(projectPath).toLowerCase() === ".json";
    const json = isJson ? readJsonFile(projectPath) : await readJsonForExport(projectPath);
    const read = (type: string) => (json[type] ?? []).map((c: any) => ({ type, name: c.name, bones: c.bones, target: c.target }));
    const constraints = [...read("ik"), ...read("transform"), ...read("path")];
    return { success: true, message: `共 ${constraints.length} 个约束`, data: { constraints } };
  }
}
