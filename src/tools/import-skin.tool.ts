/**
 * 工具：spine_import_skin — 新贴图换装通道（把一组贴图做成可切换皮肤）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { importSkin } from "../spine/skin-import-service";

export class ImportSkinTool extends BaseTool {
  name = "spine_import_skin";
  description =
    "把一组新贴图做成可切换的皮肤（换装通道）：imagesDir 内 PNG 文件名 = 插槽名（如 body.png / arm_r.png），或显式传 imageMap。新贴图复制进项目 images 目录，Spine 重打包图集。生成后用 spine_apply_effect(switch-skin) 或 spine_set_skin 切换。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目路径"),
    skinName: z.string().describe("新皮肤名（唯一）"),
    imagesDir: z.string().optional().describe("贴图目录（文件名=插槽名）"),
    imageMap: z.record(z.string(), z.string()).optional().describe('显式映射：{"body":"D:/outfit/body_new.png"}'),
    setDefault: z.boolean().optional().describe("是否同时设为默认皮肤，默认 false"),
  });

  async run(args: any): Promise<any> {
    const result = await importSkin(args.projectPath, {
      skinName: args.skinName,
      imagesDir: args.imagesDir,
      imageMap: args.imageMap,
      setDefault: args.setDefault,
    });
    return {
      success: true,
      message: `已创建皮肤 "${result.skinName}"（${result.slots.length} 个插槽换装）${result.setDefault ? "，并设为默认" : ""}`,
      data: { ...result },
    };
  }
}
