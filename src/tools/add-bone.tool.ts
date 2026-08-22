/**
 * 工具：spine_add_bone — 新增骨骼
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { addBone } from "../spine/json-handler";

export class AddBoneTool extends BaseTool {
  name = "spine_add_bone";
  description = "在指定父骨骼下新增骨骼。";
  inputSchema = z.object({
    projectPath: z.string(),
    name: z.string().describe("新骨骼名（唯一）"),
    parent: z.string().describe("父骨骼名"),
    x: z.number().optional(),
    y: z.number().optional(),
    length: z.number().optional(),
    rotation: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, name, parent } = args;
    const result = await modifyProject(projectPath, (json) => {
      addBone(json, name, parent, { x: args.x, y: args.y, length: args.length, rotation: args.rotation });
    });
    return { success: true, message: `骨骼 "${name}" 已添加到 "${parent}" 下`, data: { name, parent, backupPath: result.backupPath } };
  }
}
