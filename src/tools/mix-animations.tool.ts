/**
 * 工具：spine_mix_animations — 两动作交叉淡入过渡
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { mixAnimations } from "../spine/animation-mix-service";

export class MixAnimationsTool extends BaseTool {
  name = "spine_mix_animations";
  description =
    "把两个动画交叉淡入成过渡动画（如待机→攻击，避免跳变）。输出 t 时刻值 = from(t)·(1-k) + to(t)·k。执行前自动备份。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目路径"),
    fromAnimation: z.string().describe("源动画 A"),
    toAnimation: z.string().describe("目标动画 B"),
    duration: z.number().positive().optional().describe("过渡时长（秒），默认 0.5"),
    outputName: z.string().optional().describe("新动画名（不填 mix-<A>-<B>）"),
    fps: z.number().int().min(2).max(60).optional().describe("采样密度，默认 12"),
  });

  async run(args: any): Promise<any> {
    let gen: any = null;
    const result = await modifyProject(args.projectPath, (json) => {
      gen = mixAnimations(json, args.fromAnimation, args.toAnimation, {
        duration: args.duration,
        fps: args.fps,
        outputName: args.outputName,
      });
    });
    return {
      success: true,
      message: `已生成过渡动画 "${gen.animationName}"（${gen.duration}s，${gen.bones} 骨骼）`,
      data: { ...gen, backupPath: result.backupPath },
    };
  }
}
