/**
 * 工具：spine_apply_effect — 一句话执行效果配方
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { applyEffect } from "../spine/effect-service";

export class ApplyEffectTool extends BaseTool {
  name = "spine_apply_effect";
  description =
    "一句话执行效果配方：根据效果名自动编排操作（生成动画 / 切换皮肤 / 动作+事件触发点），执行前自动备份，执行后返回引用校验警告。效果清单见 spine_list_effects。可选渲染动画序列预览精灵图（需提供 atlasPath/imagePath/previewPath）。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目路径"),
    effect: z.string().describe("效果名（见 spine_list_effects，如 walk / attack-impact / switch-skin）"),
    animationName: z.string().optional().describe("生成的动画名（不填自动生成）"),
    duration: z.number().positive().optional().describe("动画时长（秒），缺省用效果默认值"),
    skinName: z.string().optional().describe("switch-skin 的目标皮肤名"),
    eventTime: z.number().min(0).optional().describe("自定义事件触发时间（秒），缺省用配方默认"),
    previewPath: z.string().optional().describe("若提供，渲染动画序列精灵图到该路径（需同时给 atlasPath/imagePath）"),
    atlasPath: z.string().optional().describe(".atlas 路径（用于预览）"),
    imagePath: z.string().optional().describe("图集 png 路径（用于预览）"),
    frames: z.number().int().min(2).max(32).optional().describe("预览帧数，默认 8"),
  });

  async run(args: any): Promise<any> {
    const result = await applyEffect(args.projectPath, args.effect, {
      animationName: args.animationName,
      duration: args.duration,
      skinName: args.skinName,
      eventTime: args.eventTime,
      preview: args.previewPath ? { atlasPath: args.atlasPath, imagePath: args.imagePath, frames: args.frames, outputPath: args.previewPath } : undefined,
    });
    return {
      success: true,
      message: `已执行效果 "${args.effect}"${result.warnings?.length ? `（引用校验 ${result.warnings.length} 条警告）` : ""}`,
      data: result,
    };
  }
}
