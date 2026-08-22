/**
 * 工具：spine_set_bone — 设置骨骼 Setup 姿态属性
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { setBone } from "../spine/json-handler";

export class SetBoneTool extends BaseTool {
  name = "spine_set_bone";
  description = "设置骨骼 Setup 姿态属性（位置/旋转/缩放/切变/长度/transformMode/颜色）。影响默认姿态，非动画关键帧。";
  inputSchema = z.object({
    projectPath: z.string(),
    boneName: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
    rotation: z.number().optional(),
    scaleX: z.number().optional(),
    scaleY: z.number().optional(),
    shearX: z.number().optional(),
    shearY: z.number().optional(),
    length: z.number().optional(),
    transformMode: z.enum(["normal", "onlyTranslation", "noRotationOrReflection", "noScale", "noScaleOrReflection"]).optional(),
    color: z.string().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, boneName } = args;
    const props: Record<string, any> = {};
    for (const k of ["x", "y", "rotation", "scaleX", "scaleY", "shearX", "shearY", "length", "transformMode", "color"]) {
      if (args[k] !== undefined) props[k] = args[k];
    }
    if (Object.keys(props).length === 0) {
      return { success: false, message: "至少需要提供一个属性。", errorCode: "E_INVALID_ARGUMENT" };
    }
    const result = await modifyProject(projectPath, (json) => setBone(json, boneName, props));
    return { success: true, message: `骨骼 "${boneName}" Setup 属性已更新`, data: { boneName, props, backupPath: result.backupPath } };
  }
}
