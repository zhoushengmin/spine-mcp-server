/**
 * 工具：spine_delete_slot — 删除插槽
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { deleteSlot } from "../spine/json-handler";

export class DeleteSlotTool extends BaseTool {
  name = "spine_delete_slot";
  description = "删除插槽，同时移除皮肤 / 动画时间轴 / 网格变形中的引用。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
    slotName: z.string(),
  });

  async run(args: { projectPath: string; slotName: string }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => {
      deleteSlot(json, args.slotName);
    });
    return { success: true, message: `插槽 "${args.slotName}" 已删除`, data: { slotName: args.slotName, backupPath: result.backupPath } };
  }
}
