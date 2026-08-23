/**
 * 工具：spine_build_skeleton — 从拆分部件自动生成骨架
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { buildSkeleton } from "../spine/build-skeleton-service";
import { importJson } from "../spine/import-service";
import { createTempDir, removeDir } from "../utils/file-utils";
import * as path from "path";

export class BuildSkeletonTool extends BaseTool {
  name = "spine_build_skeleton";
  description = "根据拆分部件 PNG（目录）自动生成 Spine 3.8 骨架 JSON，可选直接导入生成 .spine 项目。可配 partsIndex.json 指定部件骨骼/位置。";
  inputSchema = z.object({
    partsDir: z.string().describe("部件 PNG 目录"),
    outputJsonPath: z.string().describe("输出的骨架 JSON 路径"),
    skeletonName: z.string().default("skeleton"),
    layout: z.enum(["grid", "list"]).default("grid"),
    spacing: z.number().int().min(0).default(10),
    imageDir: z.string().default("./images/"),
    importToProject: z.string().optional().describe("若提供 .spine 路径，将骨架导入生成项目"),
  });

  async run(args: any): Promise<any> {
    const result = await buildSkeleton(args.partsDir, args.outputJsonPath, {
      skeletonName: args.skeletonName,
      layout: args.layout,
      spacing: args.spacing,
      imageDir: args.imageDir,
    });
    let importResult: any = null;
    if (args.importToProject) {
      const temp = createTempDir("build-skel-");
      try {
        importResult = await importJson(args.importToProject, args.outputJsonPath, { skeletonName: args.skeletonName, backup: false });
      } finally {
        removeDir(temp);
      }
    }
    return {
      success: true,
      message: `已生成骨架 JSON（${result.bones} 骨骼 / ${result.slots} 插槽 / ${result.attachments} 附件）${importResult ? `，并导入 ${importResult.skeletonName}` : ""}`,
      data: { jsonPath: result.jsonPath, bones: result.bones, slots: result.slots, attachments: result.attachments, imported: importResult?.projectPath },
    };
  }
}
