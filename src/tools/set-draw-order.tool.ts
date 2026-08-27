/**
 * 工具：spine_set_draw_order — 设置绘制顺序关键帧
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { setDrawOrder } from "../spine/json-handler";

export class SetDrawOrderTool extends BaseTool {
  name = "spine_set_draw_order";
  description = "在动画指定时间设置插槽绘制顺序关键帧。slots 为按新顺序排列的插槽名数组。示例：{ projectPath, animationName:\"idle\", time:0, slots:[\"back\",\"body\",\"front\"] } → 前后层次重排。";
  inputSchema = z.object({
    projectPath: z.string(),
    animationName: z.string(),
    time: z.number().min(0).describe("时间（秒）"),
    slots: z.array(z.string()).describe("按新绘制顺序排列的插槽名"),
  });

  async run(args: { projectPath: string; animationName: string; time: number; slots: string[] }): Promise<any> {
    const result = await modifyProject(args.projectPath, (json) => setDrawOrder(json, args.animationName, args.time, args.slots));
    return { success: true, message: `动画 "${args.animationName}" @${args.time}s 绘制顺序已设置`, data: { animationName: args.animationName, time: args.time, slots: args.slots, backupPath: result.backupPath } };
  }
}
