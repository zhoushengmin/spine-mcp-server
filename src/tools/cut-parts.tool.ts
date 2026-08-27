/**
 * 工具：spine_cut_parts — 从透明 PNG（散件互不重叠）按连通域切割独立部件
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { cutParts } from "../spine/cut-parts-service";

export class CutPartsTool extends BaseTool {
  name = "spine_cut_parts";
  description =
    "从一张透明 PNG（人物部件已拆开、随机位置、互不重叠）按连通域切割出独立部件，并生成编号蒙太奇图（parts-montage.png）+ partsMeta.json，供 AI 客户端看图后输出装配索引。";
  inputSchema = z.object({
    imagePath: z.string().describe("透明 PNG 路径（部件互不重叠）"),
    outputDir: z.string().describe("输出目录（部件 PNG + parts-montage.png + partsMeta.json）"),
    alphaThreshold: z.number().int().min(0).max(255).optional().describe("透明阈值（0-255），默认 16"),
    minSize: z.number().int().min(1).optional().describe("最小部件不透明像素数，默认 16"),
  });

  async run(args: any): Promise<any> {
    const result = await cutParts(args.imagePath, args.outputDir, {
      alphaThreshold: args.alphaThreshold,
      minSize: args.minSize,
    });
    return {
      success: true,
      message: `已切割出 ${result.parts.length} 个部件`,
      data: {
        outputDir: result.outputDir,
        sourceSize: result.sourceSize,
        parts: result.parts.map((p) => ({
          id: p.id,
          name: p.name,
          file: p.file,
          width: p.width,
          height: p.height,
          x: p.x,
          y: p.y,
          centroidX: p.centroidX,
          centroidY: p.centroidY,
        })),
        montageFile: result.montageFile,
        metaFile: result.metaFile,
      },
    };
  }
}
