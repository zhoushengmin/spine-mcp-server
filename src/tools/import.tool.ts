/**
 * 工具：spine_import_animation — 导入修改后的 JSON 回项目
 */
import { z } from "zod";
import * as fs from "fs";
import { BaseTool } from "./base.tool";
import { importJsonInPlace, importJson } from "../spine/import-service";

export class ImportAnimationTool extends BaseTool {
  name = "spine_import_animation";
  description = "将修改后的 JSON 导入（替换）回 .spine 项目，导入前自动备份；目标不存在时创建新项目。v1.0 仅支持全量替换。";
  inputSchema = z.object({
    projectPath: z.string().describe("目标 .spine 项目（不存在则创建）"),
    jsonPath: z.string().describe("要导入的 JSON 文件"),
    mergeMode: z.enum(["replace", "update"]).default("replace").describe("replace=全量替换（默认）；update 为 v1.1 功能"),
    skeletonName: z.string().optional().describe("骨架名（不填自动获取）"),
  });

  async run(args: { projectPath: string; jsonPath: string; mergeMode?: string; skeletonName?: string }): Promise<any> {
    if (args.mergeMode === "update") {
      return {
        success: false,
        message: "update（差异合并）模式为 v1.1 功能，当前仅支持 replace 全量替换。",
        errorCode: "E_INVALID_ARGUMENT",
        data: { suggestion: "请使用 mergeMode=replace。" },
      };
    }
    const targetExists = fs.existsSync(args.projectPath);
    const result = targetExists
      ? await importJsonInPlace(args.projectPath, args.jsonPath, args.skeletonName)
      : await importJson(args.projectPath, args.jsonPath, { skeletonName: args.skeletonName });
    return {
      success: true,
      message: `导入成功（骨架 ${result.skeletonName}，${targetExists ? "原地替换" : "创建新项目"}）`,
      data: { projectPath: result.projectPath, backupPath: result.backupPath },
    };
  }
}
