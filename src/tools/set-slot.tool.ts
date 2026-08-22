/**
 * 工具：spine_set_slot — 设置插槽 Setup 属性
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { setSlotSetup } from "../spine/json-handler";

export class SetSlotTool extends BaseTool {
  name = "spine_set_slot";
  description = "设置插槽 Setup 属性：颜色（RRGGBBAA）/ 混合模式（normal|additive|multiply|screen）/ 默认附件。";
  inputSchema = z.object({
    projectPath: z.string(),
    slotName: z.string(),
    color: z.string().optional().describe("RRGGBBAA"),
    blend: z.enum(["normal", "additive", "multiply", "screen"]).optional(),
    attachment: z.string().optional().describe("默认附件名（空串隐藏）"),
  });

  async run(args: any): Promise<any> {
    const { projectPath, slotName } = args;
    const props: Record<string, any> = {};
    if (args.color !== undefined) props.color = args.color;
    if (args.blend !== undefined) props.blend = args.blend;
    if (args.attachment !== undefined) props.attachment = args.attachment;
    if (Object.keys(props).length === 0) {
      return { success: false, message: "至少需要提供一个属性。", errorCode: "E_INVALID_ARGUMENT" };
    }
    const result = await modifyProject(projectPath, (json) => setSlotSetup(json, slotName, props));
    return { success: true, message: `插槽 "${slotName}" Setup 属性已更新`, data: { slotName, props, backupPath: result.backupPath } };
  }
}
