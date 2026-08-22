/**
 * 工具：spine_delete_attachment — 删除附件
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { deleteAttachment } from "../spine/json-handler";

export class DeleteAttachmentTool extends BaseTool {
  name = "spine_delete_attachment";
  description = "删除指定皮肤中某插槽的附件。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
    slotName: z.string(),
    attachmentName: z.string(),
    skinName: z.string().default("default"),
  });

  async run(args: { projectPath: string; slotName: string; attachmentName: string; skinName?: string }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => deleteAttachment(json, args.slotName, args.attachmentName, args.skinName ?? "default"));
    return {
      success: true,
      message: `附件 "${args.attachmentName}" 已从插槽 "${args.slotName}" 删除`,
      data: { attachmentName: args.attachmentName, slotName: args.slotName, backupPath: result.backupPath },
    };
  }
}
