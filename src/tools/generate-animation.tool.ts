/**
 * 工具：spine_generate_animation — 多骨骼模板自动生成动画
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { generateAnimation, TEMPLATES } from "../spine/animation-generate-service";

export class GenerateAnimationTool extends BaseTool {
  name = "spine_generate_animation";
  description =
    `基于多骨骼模板自动生成整骨架动画，写入项目（自动备份）。模板：${Object.keys(TEMPLATES).join(" / ")}。` +
    "按骨骼名自动匹配角色（armL/legR/torso/head 等，支持 _l/_r/left/right/数字1/2 命名），可用 roleMap 手动指定骨骼→角色。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目路径"),
    template: z.enum(Object.keys(TEMPLATES) as [string, ...string[]]).describe("动作模板"),
    duration: z.number().positive().optional().describe("动画时长（秒），缺省用模板默认值"),
    animationName: z.string().optional().describe("动画名（不填自动生成）"),
    fps: z.number().int().min(2).max(60).optional().describe("关键帧采样密度，默认循环 8 / 一次性 12"),
    roleMap: z.record(z.string(), z.string()).optional().describe("骨骼名→角色，如 {\"arm_r\":\"armR\",\"head\":\"head\"}"),
  });

  async run(args: any): Promise<any> {
    let gen: any = null;
    const result = await modifyProject(args.projectPath, (json) => {
      gen = generateAnimation(json, args.template, {
        animationName: args.animationName,
        duration: args.duration,
        fps: args.fps,
        roleMap: args.roleMap,
      });
    });
    return {
      success: true,
      message: `已生成动画 "${gen.animationName}"（${gen.template}，${gen.duration}s，${gen.keyframes} 关键帧，驱动 ${gen.bones} 根骨骼）`,
      data: { ...gen, backupPath: result.backupPath },
    };
  }
}
