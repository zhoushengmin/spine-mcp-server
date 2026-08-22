/**
 * 工具：spine_set_transform — 修改变换约束 / 写时间轴关键帧
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject, getFps } from "../spine/modify-service";
import { setConstraintSetup, updateConstraintKeyframe, frameToTime } from "../spine/json-handler";

export class SetTransformTool extends BaseTool {
  name = "spine_set_transform";
  description = "修改变换约束：mode=setup 改属性（offset*/mix*）；mode=animation 写动画时间轴关键帧。";
  inputSchema = z.object({
    projectPath: z.string(),
    name: z.string(),
    mode: z.enum(["setup", "animation"]).default("setup"),
    rotateMix: z.number().optional(),
    translateMix: z.number().optional(),
    scaleMix: z.number().optional(),
    shearMix: z.number().optional(),
    offsetRotation: z.number().optional(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional(),
    animationName: z.string().optional(),
    frameIndex: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, name, mode } = args;
    if (mode === "setup") {
      const props: Record<string, any> = {};
      const map: Record<string, string> = { offsetRotation: "rotation", offsetX: "x", offsetY: "y" };
      for (const [k, v] of Object.entries(map)) {
        if (args[k] !== undefined) props[v] = args[k];
      }
      for (const k of ["rotateMix", "translateMix", "scaleMix", "shearMix"]) {
        if (args[k] !== undefined) props[k] = args[k];
      }
      const result = await modifyProject(projectPath, (json) => setConstraintSetup(json, "transform", name, props));
      return { success: true, message: `变换约束 "${name}" Setup 属性已更新`, data: { name, props, backupPath: result.backupPath } };
    }
    if (!args.animationName || args.frameIndex === undefined) {
      return { success: false, message: "animation 模式需要 animationName / frameIndex / 至少一个 mix。", errorCode: "E_INVALID_ARGUMENT" };
    }
    const changes: Record<string, any> = {};
    for (const k of ["rotateMix", "translateMix", "scaleMix", "shearMix"]) {
      if (args[k] !== undefined) changes[k] = args[k];
    }
    const fps = await getFps(projectPath);
    const time = frameToTime(args.frameIndex, fps);
    const result = await modifyProject(projectPath, (json) => updateConstraintKeyframe(json, "transform", args.animationName, name, time, changes));
    return { success: true, message: `变换约束 "${name}" 动画关键帧已写入`, data: { name, backupPath: result.backupPath } };
  }
}
