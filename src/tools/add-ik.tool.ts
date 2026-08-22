/**
 * 工具：spine_add_ik — 新增 IK 约束
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { addIk } from "../spine/json-handler";

export class AddIkTool extends BaseTool {
  name = "spine_add_ik";
  description = "新增 IK（反向动力学）约束：让骨骼链跟随目标骨骼。bones 为 2 根骨骼的链。";
  inputSchema = z.object({
    projectPath: z.string(),
    name: z.string().describe("约束名（唯一）"),
    bone: z.string().describe("受约束骨骼"),
    bone2: z.string().optional().describe("链上第二根骨骼（可选）"),
    target: z.string().describe("目标骨骼"),
    bendPositive: z.boolean().optional(),
    mix: z.number().optional().describe("强度 0-1，默认 1"),
  });

  async run(args: any): Promise<any> {
    const bones = args.bone2 ? [args.bone, args.bone2] : [args.bone];
    const result = await modifyProject(args.projectPath, (json) => {
      addIk(json, args.name, bones, args.target, { bendPositive: args.bendPositive, mix: args.mix });
    });
    return { success: true, message: `IK 约束 "${args.name}" 已创建`, data: { name: args.name, bones, target: args.target, backupPath: result.backupPath } };
  }
}
