/**
 * 工具：spine_assemble — 根据切割产物 + AI 装配索引生成层级骨架并拼接还原
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { assembleParts } from "../spine/assemble-service";
import { importJson } from "../spine/import-service";

export class AssembleTool extends BaseTool {
  name = "spine_assemble";
  description =
    "读取 spine_cut_parts 输出的 partsMeta.json + AI 装配索引（partsIndex.json），生成 Spine 3.8 层级骨架 JSON 与拼接还原预览图，可选直接导入 .spine 项目。装配索引格式：{ parts: { 'part-N': { name, parent, x, y, pivotX?, pivotY?, order? } } }。";
  inputSchema = z.object({
    partsMetaPath: z.string().describe("spine_cut_parts 输出的 partsMeta.json 路径"),
    assembleIndexPath: z.string().describe("AI 装配索引 JSON 路径（{ parts: { 'part-N': { name, parent, x, y, pivotX?, pivotY?, order? } } }）"),
    outputJsonPath: z.string().describe("输出的骨架 JSON 路径"),
    skeletonName: z.string().default("skeleton").describe("骨架名"),
    outputPreview: z.string().optional().describe("拼接还原预览图路径（默认 JSON 同名 .png）"),
    importToProject: z.string().optional().describe("若提供 .spine 路径，将骨架导入生成项目"),
  });

  async run(args: any): Promise<any> {
    const result = await assembleParts(args.partsMetaPath, args.assembleIndexPath, args.outputJsonPath, {
      skeletonName: args.skeletonName,
      outputPreview: args.outputPreview,
    });
    let importResult: any = null;
    if (args.importToProject) {
      importResult = await importJson(args.importToProject, args.outputJsonPath, {
        skeletonName: args.skeletonName,
        backup: false,
      });
    }
    return {
      success: true,
      message: `已生成骨架（${result.bones} 骨骼 / ${result.slots} 插槽 / ${result.attachments} 附件）${importResult ? `，并导入 ${importResult.skeletonName}` : ""}`,
      data: {
        jsonPath: result.jsonPath,
        previewFile: result.previewFile,
        bones: result.bones,
        slots: result.slots,
        attachments: result.attachments,
        imagesDir: result.imagesDir,
        imported: importResult?.projectPath,
      },
    };
  }
}
