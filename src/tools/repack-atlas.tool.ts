/**
 * 工具：spine_repack_atlas — 部件重打包为图集
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { repackAtlas } from "../spine/repack-atlas-service";

export class RepackAtlasTool extends BaseTool {
  name = "spine_repack_atlas";
  description = "把一组独立 PNG 打包为 Spine .atlas + png（自动排布）。images 为 [{name, file}] 或一个目录（目录内 PNG 文件名作为 region 名）。";
  inputSchema = z.object({
    images: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
    inputDir: z.string().optional().describe("目录：读取其中全部 .png 打包"),
    outputDir: z.string(),
    atlasName: z.string().default("atlas"),
  });

  async run(args: any): Promise<any> {
    let images = args.images ?? [];
    if (args.inputDir) {
      const fs = require("fs");
      const path = require("path");
      if (!fs.existsSync(args.inputDir)) {
        return { success: false, message: `目录不存在：${args.inputDir}`, errorCode: "E_INVALID_ARGUMENT" };
      }
      const pngs = fs.readdirSync(args.inputDir).filter((f: string) => f.toLowerCase().endsWith(".png"));
      images = pngs.map((f: string) => ({ name: f.replace(/\.png$/i, ""), file: path.join(args.inputDir, f) }));
    }
    if (!images.length) {
      return { success: false, message: "没有可打包的图片（需提供 images 或 inputDir）。", errorCode: "E_INVALID_ARGUMENT" };
    }
    const result = await repackAtlas(images, args.outputDir, args.atlasName);
    return {
      success: true,
      message: `已打包 ${result.regions.length} 张图为图集（${result.pageSize.w}x${result.pageSize.h}）`,
      data: { atlasPath: result.atlasPath, imagePath: result.imagePath, pageSize: result.pageSize, regions: result.regions },
    };
  }
}
