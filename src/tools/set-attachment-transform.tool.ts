/**
 * 工具：spine_set_attachment_transform — 设置附件变换
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { setAttachmentTransform } from "../spine/json-handler";

export class SetAttachmentTransformTool extends BaseTool {
  name = "spine_set_attachment_transform";
  description = "设置附件在插槽内的变换：x/y/rotation/scaleX/scaleY/color/width/height。";
  inputSchema = z.object({
    projectPath: z.string(),
    slotName: z.string(),
    attachmentName: z.string(),
    skinName: z.string().default("default"),
    x: z.number().optional(),
    y: z.number().optional(),
    rotation: z.number().optional(),
    scaleX: z.number().optional(),
    scaleY: z.number().optional(),
    color: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, slotName, attachmentName, skinName } = args;
    const props: Record<string, any> = {};
    for (const k of ["x", "y", "rotation", "scaleX", "scaleY", "color", "width", "height"]) {
      if (args[k] !== undefined) props[k] = args[k];
    }
    const result = await modifyProject(projectPath, (json) => setAttachmentTransform(json, slotName, attachmentName, props, skinName));
    return {
      success: true,
      message: `附件 "${attachmentName}" 变换已更新`,
      data: { attachmentName, props, backupPath: result.backupPath },
    };
  }
}
