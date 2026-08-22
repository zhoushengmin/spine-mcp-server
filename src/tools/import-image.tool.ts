/**
 * 工具：spine_import_image — 导入图片作为附件纹理
 */
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { setAttachmentTransform } from "../spine/json-handler";

export class ImportImageTool extends BaseTool {
  name = "spine_import_image";
  description = "导入图片作为附件纹理（更新附件 path）。imagePath 可为图集 region 名（如 goblin/head）或绝对路径；绝对路径需已存在于项目图集。";
  inputSchema = z.object({
    projectPath: z.string(),
    imagePath: z.string().describe("图集 region 名（推荐，如 goblin/head）或图片绝对路径"),
    slotName: z.string(),
    attachmentName: z.string(),
    skinName: z.string().default("default"),
  });

  async run(args: { projectPath: string; imagePath: string; slotName: string; attachmentName: string; skinName?: string }): Promise<any> {
    // 绝对路径才校验文件存在；图集 region 名（相对名）不做文件检查
    if (path.isAbsolute(args.imagePath) && !fs.existsSync(args.imagePath)) {
      return { success: false, message: `图片不存在：${args.imagePath}`, errorCode: "E_INVALID_ARGUMENT" };
    }
    const result = await modifyProject(args.projectPath, (json) => {
      setAttachmentTransform(json, args.slotName, args.attachmentName, { path: args.imagePath }, args.skinName ?? "default");
    });
    return {
      success: true,
      message: `附件 "${args.attachmentName}" 纹理已指向 ${args.imagePath}`,
      data: { attachmentName: args.attachmentName, imagePath: args.imagePath, backupPath: result.backupPath },
    };
  }
}
