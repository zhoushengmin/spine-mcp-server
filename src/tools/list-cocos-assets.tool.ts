/**
 * 工具：spine_list_cocos_assets — 扫描目录/工作区中的 Spine 项目
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { scanSpineProjects } from "../spine/asset-scanner";

export class ListCocosAssetsTool extends BaseTool {
  name = "spine_list_cocos_assets";
  description = "扫描目录（如 Cocos 项目 assets 文件夹）中的全部 .spine 项目，返回路径/名称/大小/修改时间。";
  inputSchema = z.object({
    rootDir: z.string().describe("要扫描的目录"),
    recursive: z.boolean().default(true),
    maxDepth: z.number().int().min(1).max(20).default(10),
    limit: z.number().int().min(1).max(1000).default(200),
  });

  async run(args: { rootDir: string; recursive?: boolean; maxDepth?: number; limit?: number }): Promise<any> {
    const projects = scanSpineProjects(args.rootDir, {
      recursive: args.recursive,
      maxDepth: args.maxDepth,
      limit: args.limit,
    });
    return {
      success: true,
      message: `扫描到 ${projects.length} 个 .spine 项目`,
      data: { projects },
    };
  }
}
