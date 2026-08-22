/**
 * 工具：spine_rename_slot — 重命名插槽（同步所有引用）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { renameSlot } from "../spine/json-handler";

export class RenameSlotTool extends BaseTool {
  name = "spine_rename_slot";
  description = "重命名插槽，自动同步更新：slots 数组 / 皮肤引用 / 动画时间轴 / 网格变形(deform) 中的全部引用。";
  inputSchema = z.object({
    projectPath: z.string(),
    oldName: z.string(),
    newName: z.string(),
  });

  async run(args: { projectPath: string; oldName: string; newName: string }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => {
      renameSlot(json, args.oldName, args.newName);
    });
    return {
      success: true,
      message: `插槽 "${args.oldName}" 已重命名为 "${args.newName}"`,
      data: { oldName: args.oldName, newName: args.newName, backupPath: result.backupPath },
    };
  }
}
