/**
 * 工具：spine_set_skin — 皮肤管理（create/rename/delete/setDefault）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { addSkin, renameSkin, deleteSkin, setDefaultSkin } from "../spine/json-handler";

export class SetSkinTool extends BaseTool {
  name = "spine_set_skin";
  description = "皮肤管理：create（新建）/ rename（重命名）/ delete（删除）/ setDefault（设置默认皮肤）。";
  inputSchema = z.object({
    projectPath: z.string(),
    action: z.enum(["create", "rename", "delete", "setDefault"]),
    skinName: z.string(),
    newName: z.string().optional().describe("rename 时的新皮肤名"),
  });

  async run(args: { projectPath: string; action: string; skinName: string; newName?: string }): Promise<any> {
    const { action, skinName, newName } = args;
    let result: any;
    switch (action) {
      case "create":
        result = await modifyProject(args.projectPath, (json) => addSkin(json, skinName));
        return { success: true, message: `皮肤 "${skinName}" 已创建`, data: { skinName, backupPath: result.backupPath } };
      case "rename":
        if (!newName) {
          return { success: false, message: "rename 需要提供 newName。", errorCode: "E_INVALID_ARGUMENT" };
        }
        result = await modifyProject(args.projectPath, (json) => renameSkin(json, skinName, newName!));
        return { success: true, message: `皮肤 "${skinName}" 已重命名为 "${newName}"`, data: { skinName, newName, backupPath: result.backupPath } };
      case "delete":
        result = await modifyProject(args.projectPath, (json) => deleteSkin(json, skinName));
        return { success: true, message: `皮肤 "${skinName}" 已删除`, data: { skinName, backupPath: result.backupPath } };
      case "setDefault":
        result = await modifyProject(args.projectPath, (json) => setDefaultSkin(json, skinName));
        return { success: true, message: `默认皮肤已设置为 "${skinName}"`, data: { skinName, backupPath: result.backupPath } };
      default:
        return { success: false, message: `未知操作：${action}`, errorCode: "E_INVALID_ARGUMENT" };
    }
  }
}
