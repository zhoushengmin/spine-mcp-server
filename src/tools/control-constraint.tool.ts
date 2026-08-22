/**
 * 工具：spine_control_constraint — 约束时间轴关键帧（ik/transform/path 的 mix 等）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject, getFps } from "../spine/modify-service";
import { updateConstraintKeyframe, frameToTime } from "../spine/json-handler";

export class ControlConstraintTool extends BaseTool {
  name = "spine_control_constraint";
  description = "在动画指定帧写约束时间轴关键帧（type=ik: mix；transform: rotateMix/translateMix/scaleMix/shearMix；path: positionMix/translateMix/rotateMix/position/spacing/rotate）。";
  inputSchema = z.object({
    projectPath: z.string(),
    type: z.enum(["ik", "transform", "path"]),
    name: z.string().describe("约束名"),
    animationName: z.string(),
    frameIndex: z.number().int().min(0),
    mix: z.number().optional(),
    rotateMix: z.number().optional(),
    translateMix: z.number().optional(),
    scaleMix: z.number().optional(),
    shearMix: z.number().optional(),
    positionMix: z.number().optional(),
    position: z.number().optional(),
    spacing: z.number().optional(),
    rotate: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, type, name, animationName, frameIndex } = args;
    const changes: Record<string, any> = {};
    const keys = type === "ik" ? ["mix"] : type === "transform" ? ["rotateMix", "translateMix", "scaleMix", "shearMix"] : ["positionMix", "translateMix", "rotateMix", "position", "spacing", "rotate"];
    for (const k of keys) {
      if (args[k] !== undefined) changes[k] = args[k];
    }
    if (Object.keys(changes).length === 0) {
      return { success: false, message: `type=${type} 需要提供相应关键帧值。`, errorCode: "E_INVALID_ARGUMENT" };
    }
    const fps = await getFps(projectPath);
    const time = frameToTime(frameIndex, fps);
    const result = await modifyProject(projectPath, (json) => {
      updateConstraintKeyframe(json, type, animationName, name, time, changes);
    });
    return { success: true, message: `约束 "${name}"（${type}）动画 "${animationName}" 第 ${frameIndex} 帧已写入`, data: { type, name, animationName, frameIndex, changes, backupPath: result.backupPath } };
  }
}
