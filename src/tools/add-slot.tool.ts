/**
 * 工具：spine_add_slot — 新增插槽
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { addSlot } from "../spine/json-handler";

export class AddSlotTool extends BaseTool {
  name = "spine_add_slot";
  description = "在指定骨骼下新增插槽（用于后续绑定附件）。";
  inputSchema = z.object({
    projectPath: z.string(),
    slotName: z.string().describe("新插槽名（唯一）"),
    boneName: z.string().describe("绑定的骨骼"),
    order: z.number().optional().describe("绘制顺序（默认排最后）"),
  });

  async run(args: { projectPath: string; slotName: string; boneName: string; order?: number }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => {
      addSlot(json, args.slotName, args.boneName, args.order);
    });
    return {
      success: true,
      message: `插槽 "${args.slotName}" 已绑定到骨骼 "${args.boneName}"`,
      data: { slotName: args.slotName, boneName: args.boneName, backupPath: result.backupPath },
    };
  }
}
