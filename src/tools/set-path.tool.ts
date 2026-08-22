/**
 * 工具：spine_set_path — 修改路径约束 / 写时间轴关键帧
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject, getFps } from "../spine/modify-service";
import { setConstraintSetup, updateConstraintKeyframe, frameToTime } from "../spine/json-handler";

export class SetPathTool extends BaseTool {
  name = "spine_set_path";
  description = "修改路径约束：mode=setup 改属性；mode=animation 写动画时间轴关键帧。";
  inputSchema = z.object({
    projectPath: z.string(),
    name: z.string(),
    mode: z.enum(["setup", "animation"]).default("setup"),
    positionMix: z.number().optional(),
    translateMix: z.number().optional(),
    rotateMix: z.number().optional(),
    position: z.number().optional(),
    spacing: z.number().optional(),
    rotate: z.number().optional(),
    animationName: z.string().optional(),
    frameIndex: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, name, mode } = args;
    if (mode === "setup") {
      const props: Record<string, any> = {};
      for (const k of ["positionMix", "translateMix", "rotateMix", "position", "spacing", "rotate"]) {
        if (args[k] !== undefined) props[k] = args[k];
      }
      const result = await modifyProject(projectPath, (json) => setConstraintSetup(json, "path", name, props));
      return { success: true, message: `路径约束 "${name}" Setup 属性已更新`, data: { name, props, backupPath: result.backupPath } };
    }
    if (!args.animationName || args.frameIndex === undefined) {
      return { success: false, message: "animation 模式需要 animationName / frameIndex。", errorCode: "E_INVALID_ARGUMENT" };
    }
    const changes: Record<string, any> = {};
    for (const k of ["positionMix", "translateMix", "rotateMix", "position", "spacing", "rotate"]) {
      if (args[k] !== undefined) changes[k] = args[k];
    }
    const fps = await getFps(projectPath);
    const time = frameToTime(args.frameIndex, fps);
    const result = await modifyProject(projectPath, (json) => updateConstraintKeyframe(json, "path", args.animationName, name, time, changes));
    return { success: true, message: `路径约束 "${name}" 动画关键帧已写入`, data: { name, backupPath: result.backupPath } };
  }
}
