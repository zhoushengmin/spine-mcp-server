/**
 * 工具：spine_add_event_keyframe — 添加事件关键帧
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { addEvent, addEventKeyframe } from "../spine/json-handler";

export class AddEventKeyframeTool extends BaseTool {
  name = "spine_add_event_keyframe";
  description = "在动画指定时间添加事件关键帧（音效/触发点）。事件需已定义（可用 eventName 未定义时自动创建）。";
  inputSchema = z.object({
    projectPath: z.string(),
    animationName: z.string(),
    time: z.number().min(0).describe("时间（秒）"),
    eventName: z.string(),
    intValue: z.number().optional(),
    floatValue: z.number().optional(),
    stringValue: z.string().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, animationName, time, eventName } = args;
    const values: { int?: number; float?: number; string?: string } = {};
    if (args.intValue !== undefined) values.int = args.intValue;
    if (args.floatValue !== undefined) values.float = args.floatValue;
    if (args.stringValue !== undefined) values.string = args.stringValue;
    const result = await modifyProject(projectPath, (json) => {
      // 事件未定义则自动创建
      if (!json.events?.[eventName]) {
        addEvent(json, eventName, values);
      }
      addEventKeyframe(json, animationName, time, eventName, values);
    });
    return { success: true, message: `事件 "${eventName}" 关键帧已添加到动画 "${animationName}" @${time}s`, data: { eventName, animationName, time, backupPath: result.backupPath } };
  }
}
