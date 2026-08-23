/**
 * 工具：spine_split_atlas — 图集按部件拆分
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { splitAtlas } from "../spine/split-atlas-service";

export class SplitAtlasTool extends BaseTool {
  name = "spine_split_atlas";
  description = "把图集拆分为独立部件 PNG：region 模式按图集区域提取并清理透明；split 模式额外做连通域分析，把重叠贴合的部件拆开。";
  inputSchema = z.object({
    atlasPath: z.string().describe(".atlas 文件路径"),
    imagePath: z.string().describe("图集 png 路径"),
    outputDir: z.string(),
    mode: z.enum(["region", "split"]).default("region"),
    alphaThreshold: z.number().int().min(0).max(255).optional().describe("透明阈值（0-255），默认 16"),
    minSize: z.number().int().optional().describe("连通域最小像素数，默认 16"),
  });

  async run(args: any): Promise<any> {
    const result = await splitAtlas(args.atlasPath, args.imagePath, args.outputDir, {
      mode: args.mode,
      alphaThreshold: args.alphaThreshold,
      minSize: args.minSize,
    });
    return {
      success: true,
      message: `图集 "${result.atlasName}" 已拆分：${result.parts.length} 个部件（模式 ${result.mode}）`,
      data: { parts: result.parts, outputDir: result.outputDir, mode: result.mode },
    };
  }
}
