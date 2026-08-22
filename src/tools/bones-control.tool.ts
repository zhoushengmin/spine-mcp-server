/**
 * 工具：spine_control_bone ⭐ — 修改骨骼在动画指定帧的变换（Round-Trip）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject, getFps } from "../spine/modify-service";
import { updateBoneKeyframe, frameToTime } from "../spine/json-handler";
import { BoneKeyframeChange } from "../types";

export class BonesControlTool extends BaseTool {
  name = "spine_control_bone";
  description =
    "修改指定骨骼在动画特定帧的变换（旋转/位移/缩放/切变）。通过 导出→改关键帧→原地导入 完成，导入前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
    animationName: z.string(),
    boneName: z.string().describe("骨骼名称（大小写敏感）"),
    frameIndex: z.number().int().min(0).describe("帧序号（从 0 开始）"),
    x: z.number().optional(),
    y: z.number().optional(),
    rotation: z.number().optional().describe("旋转角度（度）"),
    scaleX: z.number().optional(),
    scaleY: z.number().optional(),
    shearX: z.number().optional(),
    shearY: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, animationName, boneName, frameIndex } = args;
    const changes: BoneKeyframeChange = {};
    for (const k of ["x", "y", "rotation", "scaleX", "scaleY", "shearX", "shearY"] as const) {
      if (args[k] !== undefined) {
        changes[k] = args[k];
      }
    }
    if (Object.keys(changes).length === 0) {
      return { success: false, message: "至少需要提供一个变换值（x/y/rotation/scaleX/scaleY/shearX/shearY）。", errorCode: "E_INVALID_ARGUMENT" };
    }
    const fps = await getFps(projectPath);
    const time = frameToTime(frameIndex, fps);
    const result = await modifyProject(projectPath, (json) => {
      const affected = updateBoneKeyframe(json, animationName, boneName, time, changes);
      if (affected === 0) {
        throw new Error(`未对动画 "${animationName}" 骨骼 "${boneName}" 产生任何关键帧修改。`);
      }
    });
    return {
      success: true,
      message: `骨骼 "${boneName}" 第 ${frameIndex} 帧（time=${time.toFixed(3)}s）变换已修改`,
      data: { animationName, boneName, frameIndex, time, changes, backupPath: result.backupPath },
    };
  }
}
