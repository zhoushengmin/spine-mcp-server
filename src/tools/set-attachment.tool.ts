/**
 * 工具：spine_set_attachment ⭐ — 切换插槽附件（换装）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { setAttachment } from "../spine/json-handler";

export class SetAttachmentTool extends BaseTool {
  name = "spine_set_attachment";
  description = "设置/切换指定插槽的附件（换装/换武器/换表情）。attachmentName 传空字符串表示隐藏该插槽。";
  inputSchema = z.object({
    projectPath: z.string(),
    slotName: z.string(),
    attachmentName: z.string().describe("目标附件名（空串=隐藏该插槽）"),
    skinName: z.string().default("default").describe("作用于哪个皮肤，默认 default"),
  });

  async run(args: { projectPath: string; slotName: string; attachmentName: string; skinName?: string }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => {
      setAttachment(json, args.slotName, args.attachmentName, args.skinName ?? "default");
    });
    const display = args.attachmentName === "" ? "隐藏" : `切换为 "${args.attachmentName}"`;
    return {
      success: true,
      message: `插槽 "${args.slotName}" 已${display}（皮肤 ${args.skinName ?? "default"}）`,
      data: { slotName: args.slotName, attachmentName: args.attachmentName, skinName: args.skinName, backupPath: result.backupPath },
    };
  }
}
