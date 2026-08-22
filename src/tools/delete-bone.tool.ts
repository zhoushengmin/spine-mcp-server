/**
 * 工具：spine_delete_bone — 删除骨骼（含子骨骼）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { deleteBone } from "../spine/json-handler";

export class DeleteBoneTool extends BaseTool {
  name = "spine_delete_bone";
  description = "删除骨骼及其全部子骨骼，同时移除绑定在该骨骼上的插槽与动画时间轴。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
    boneName: z.string(),
  });

  async run(args: { projectPath: string; boneName: string }): Promise<any> {
    let removed: string[] = [];
    const result = await modifyProject(args.projectPath, (json) => {
      removed = deleteBone(json, args.boneName).removed;
    });
    return {
      success: true,
      message: `已删除骨骼 ${removed.length} 个：${removed.join(", ")}`,
      data: { removed, backupPath: result.backupPath },
    };
  }
}
