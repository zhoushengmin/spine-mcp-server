/**
 * 工具：spine_set_animation_settings — 设置动画时长（缩放全部时间轴）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { scaleAnimationDuration } from "../spine/json-handler";

export class SetAnimationSettingsTool extends BaseTool {
  name = "spine_set_animation_settings";
  description = "调整动画时长：按目标时长缩放全部时间轴关键帧的时间。示例：{ projectPath, animationName:\"attack\", duration:0.8 } → 把 attack 整体缩到 0.8 秒（加速/减速）。";
  inputSchema = z.object({
    projectPath: z.string(),
    animationName: z.string(),
    duration: z.number().positive().describe("目标时长（秒）"),
  });

  async run(args: { projectPath: string; animationName: string; duration: number }): Promise<any> {
    let newDuration = 0;
    const result = await modifyProject(args.projectPath, (json) => {
      newDuration = scaleAnimationDuration(json, args.animationName, args.duration);
    });
    return {
      success: true,
      message: `动画 "${args.animationName}" 时长已调整为 ${newDuration}s`,
      data: { animationName: args.animationName, newDuration, backupPath: result.backupPath },
    };
  }
}
