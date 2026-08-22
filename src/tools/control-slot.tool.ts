/**
 * 工具：spine_control_slot — 插槽动画时间轴关键帧（附件切换/颜色）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject, getFps } from "../spine/modify-service";
import { updateSlotKeyframe, frameToTime } from "../spine/json-handler";

export class ControlSlotTool extends BaseTool {
  name = "spine_control_slot";
  description = "在动画指定帧设置插槽的附件（换装时间轴）或颜色。";
  inputSchema = z.object({
    projectPath: z.string(),
    animationName: z.string(),
    slotName: z.string(),
    frameIndex: z.number().int().min(0),
    attachment: z.string().optional().describe("目标附件名（空串=隐藏）"),
    color: z.string().optional().describe("颜色 RRGGBBAA"),
  });

  async run(args: any): Promise<any> {
    const { projectPath, animationName, slotName, frameIndex } = args;
    if (args.attachment === undefined && args.color === undefined) {
      return { success: false, message: "至少需要 attachment 或 color。", errorCode: "E_INVALID_ARGUMENT" };
    }
    const fps = await getFps(projectPath);
    const time = frameToTime(frameIndex, fps);
    const result = await modifyProject(projectPath, (json) => {
      updateSlotKeyframe(json, animationName, slotName, time, {
        attachment: args.attachment !== undefined ? args.attachment : undefined,
        color: args.color,
      });
    });
    return {
      success: true,
      message: `插槽 "${slotName}" 动画 "${animationName}" 第 ${frameIndex} 帧已设置`,
      data: { animationName, slotName, frameIndex, backupPath: result.backupPath },
    };
  }
}
