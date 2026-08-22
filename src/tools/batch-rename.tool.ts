/**
 * 工具：spine_batch_rename — 批量重命名（正则）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { batchRename } from "../spine/json-handler";

export class BatchRenameTool extends BaseTool {
  name = "spine_batch_rename";
  description = "按正则表达式批量重命名骨骼或插槽，返回重命名明细。";
  inputSchema = z.object({
    projectPath: z.string(),
    pattern: z.string().describe("正则表达式，如 ^arm_ 或 _L$"),
    replacement: z.string().describe("替换文本，如 arm 或 _Left"),
    targetType: z.enum(["bone", "slot"]),
  });

  async run(args: { projectPath: string; pattern: string; replacement: string; targetType: "bone" | "slot" }): Promise<any> {
    let renamedList: string[] = [];
    const result = await modifyProject(args.projectPath, (json) => {
      renamedList = batchRename(json, args.pattern, args.replacement, args.targetType);
    });
    return {
      success: true,
      message: `批量重命名完成：${renamedList.length} 项`,
      data: { renamed: renamedList, backupPath: result.backupPath },
    };
  }
}
