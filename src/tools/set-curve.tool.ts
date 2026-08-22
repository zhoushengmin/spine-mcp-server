/**
 * 工具：spine_set_curve — 设置关键帧插值曲线
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { setCurve } from "../spine/json-handler";

export class SetCurveTool extends BaseTool {
  name = "spine_set_curve";
  description = "设置某关键帧的插值曲线：linear（默认）/ stepped（阶跃）/ bezier（贝塞尔，需 c1x/c1y/c2x/c2y）。timelinePath 形如 bones.torso.rotate。";
  inputSchema = z.object({
    projectPath: z.string(),
    animationName: z.string(),
    timeline: z.string().describe("时间轴路径，如 bones.torso.rotate / slots.head.attachment"),
    keyframeIndex: z.number().int().min(0),
    curve: z.enum(["linear", "stepped", "bezier"]).default("linear"),
    c1x: z.number().optional(),
    c1y: z.number().optional(),
    c2x: z.number().optional(),
    c2y: z.number().optional(),
  });

  async run(args: any): Promise<any> {
    const { projectPath, animationName, timeline, keyframeIndex, curve } = args;
    const result = await modifyProject(projectPath, (json) => {
      setCurve(json, animationName, timeline, keyframeIndex, curve, {
        c1x: args.c1x, c1y: args.c1y, c2x: args.c2x, c2y: args.c2y,
      } as any);
    });
    return { success: true, message: `时间轴 "${timeline}" 第 ${keyframeIndex} 帧曲线已设为 ${curve}`, data: { animationName, timeline, keyframeIndex, curve, backupPath: result.backupPath } };
  }
}
