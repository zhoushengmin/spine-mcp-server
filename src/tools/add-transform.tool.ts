/**
 * 工具：spine_add_transform — 新增变换约束
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { addTransform } from "../spine/json-handler";

export class AddTransformTool extends BaseTool {
  name = "spine_add_transform";
  description = "新增变换约束：让骨骼复制/跟随目标骨骼的变换（可混合）。";
  inputSchema = z.object({
    projectPath: z.string(),
    name: z.string().describe("约束名（唯一）"),
    bone: z.string().describe("受约束骨骼"),
    target: z.string().describe("目标骨骼"),
    local: z.boolean().optional(),
    relative: z.boolean().optional(),
    offsetRotation: z.number().optional(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional(),
    offsetScaleX: z.number().optional(),
    offsetScaleY: z.number().optional(),
    offsetShearY: z.number().optional(),
    rotateMix: z.number().optional(),
    translateMix: z.number().optional(),
    scaleMix: z.number().optional(),
    shearMix: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => {
      addTransform(json, args.name, [args.bone], args.target, {
        local: args.local, relative: args.relative,
        offsetRotation: args.offsetRotation, offsetX: args.offsetX, offsetY: args.offsetY,
        offsetScaleX: args.offsetScaleX, offsetScaleY: args.offsetScaleY, offsetShearY: args.offsetShearY,
        rotateMix: args.rotateMix, translateMix: args.translateMix, scaleMix: args.scaleMix, shearMix: args.shearMix,
      });
    });
    return { success: true, message: `变换约束 "${args.name}" 已创建`, data: { name: args.name, bone: args.bone, target: args.target, backupPath: result.backupPath } };
  }
}
