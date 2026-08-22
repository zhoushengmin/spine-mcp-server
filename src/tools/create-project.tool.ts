/**
 * 工具：spine_create_project — 创建空 Spine 项目
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { importJson } from "../spine/import-service";
import { ensureDir, createTempDir, removeDir } from "../utils/file-utils";
import { writeJsonFile } from "../utils/file-utils";
import * as fs from "fs";
import * as path from "path";

export class CreateProjectTool extends BaseTool {
  name = "spine_create_project";
  description = "创建一个空的 Spine 3.8.75 项目文件（含 root 骨骼）。";
  inputSchema = z.object({
    outputPath: z.string().describe("输出的 .spine 文件路径"),
    skeletonName: z.string().default("skeleton").describe("骨架名，默认 skeleton"),
    width: z.number().optional(),
    height: z.number().optional(),
  });

  async run(args: { outputPath: string; skeletonName?: string; width?: number; height?: number }): Promise<any> {
    const skeletonName = args.skeletonName ?? "skeleton";
    if (fs.existsSync(args.outputPath)) {
      return { success: false, message: `目标文件已存在：${args.outputPath}`, errorCode: "E_INVALID_ARGUMENT" };
    }
    // 生成最小骨架 JSON
    const skeleton: any = { spine: "3.8.75" };
    if (args.width) skeleton.width = args.width;
    if (args.height) skeleton.height = args.height;
    const templateJson = { skeleton, bones: [{ name: "root" }] };

    const tempDir = createTempDir("spine-create-");
    const jsonPath = path.join(tempDir, "skeleton.json");
    writeJsonFile(jsonPath, templateJson);
    try {
      ensureDir(path.dirname(args.outputPath));
      const result = await importJson(args.outputPath, jsonPath, { skeletonName, backup: false });
      return { success: true, message: `项目已创建：${args.outputPath}（骨架 ${result.skeletonName}）`, data: { projectPath: args.outputPath, skeletonName } };
    } finally {
      removeDir(tempDir);
    }
  }
}
