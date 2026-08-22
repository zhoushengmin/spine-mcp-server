/**
 * 工具：spine_set_ik — 修改 IK 约束 / 写 IK 时间轴关键帧
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject, getFps } from "../spine/modify-service";
import { setConstraintSetup, updateConstraintKeyframe, frameToTime } from "../spine/json-handler";

export class SetIkTool extends BaseTool {
  name = "spine_set_ik";
  description = "修改 IK 约束：mode=setup 改属性（mix/bendPositive）；mode=animation 写动画时间轴关键帧。";
  inputSchema = z.object({
    projectPath: z.string(),
    name: z.string().describe("IK 约束名"),
    mode: z.enum(["setup", "animation"]).default("setup"),
    mix: z.number().optional(),
    bendPositive: z.boolean().optional(),
    compress: z.boolean().optional(),
    stretch: z.boolean().optional(),
    animationName: z.string().optional(),
    frameIndex: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, name, mode } = args;
    if (mode === "setup") {
      const props: Record<string, any> = {};
      for (const k of ["mix", "bendPositive", "compress", "stretch"]) {
        if (args[k] !== undefined) props[k] = args[k];
      }
      const result = await modifyProject(projectPath, (json) => setConstraintSetup(json, "ik", name, props));
      return { success: true, message: `IK 约束 "${name}" Setup 属性已更新`, data: { name, props, backupPath: result.backupPath } };
    }
    if (!args.animationName || args.frameIndex === undefined || args.mix === undefined) {
      return { success: false, message: "animation 模式需要 animationName / frameIndex / mix。", errorCode: "E_INVALID_ARGUMENT" };
    }
    const fps = await getFps(projectPath);
    const time = frameToTime(args.frameIndex, fps);
    const result = await modifyProject(projectPath, (json) => {
      updateConstraintKeyframe(json, "ik", args.animationName, name, time, { mix: args.mix });
    });
    return { success: true, message: `IK "${name}" 动画 "${args.animationName}" 第 ${args.frameIndex} 帧已写入`, data: { name, backupPath: result.backupPath } };
  }
}
