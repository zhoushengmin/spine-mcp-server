/**
 * 工具：spine_pipeline — 一键成片（散件切割→装配→镜像→动作→导出）
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { runPipeline } from "../spine/pipeline-service";

export class PipelineTool extends BaseTool {
  name = "spine_pipeline";
  description =
    "一键成片：输入透明散件 PNG + AI 装配索引 + 想要的效果 → 自动完成 切割→装配绑骨→(可选镜像补全)→生成动作→导入 .spine→导出成片(GIF/精灵表/预览)。效果用动作/组合类（idle/breath/walk/run/wave/attack/jump/attack-impact/jump-land）。";
  inputSchema = z.object({
    imagePath: z.string().describe("透明散件 PNG（部件互不重叠）"),
    partsIndexPath: z.string().describe("AI 装配索引 JSON（spine_assemble 格式）"),
    effect: z.string().describe("效果名（idle/breath/walk/run/wave/attack/jump/attack-impact/jump-land）"),
    animationName: z.string().optional(),
    duration: z.number().positive().optional(),
    mirror: z.boolean().optional().describe("装配后镜像补全右半，默认 false"),
    skeletonName: z.string().optional().describe("骨架名，默认 skeleton"),
    outputDir: z.string().optional().describe("中间产物目录（缺省临时）"),
    projectPath: z.string().optional().describe("可选：导入生成 .spine 到该路径"),
    export: z.enum(["gif", "sheet", "preview", "none"]).optional().describe("导出方式，默认 none"),
    exportPath: z.string().optional().describe("导出输出路径"),
    frames: z.number().int().min(2).max(32).optional(),
    fps: z.number().int().min(1).max(60).optional(),
    width: z.number().int().min(16).max(4096).optional(),
    height: z.number().int().min(16).max(4096).optional(),
  });

  async run(args: any): Promise<any> {
    const result = await runPipeline({
      imagePath: args.imagePath,
      partsIndexPath: args.partsIndexPath,
      effect: args.effect,
      animationName: args.animationName,
      duration: args.duration,
      mirror: args.mirror,
      skeletonName: args.skeletonName,
      outputDir: args.outputDir,
      projectPath: args.projectPath,
      export: args.export,
      exportPath: args.exportPath,
      frames: args.frames,
      fps: args.fps,
      width: args.width,
      height: args.height,
    });
    const steps = result.steps.map((s) => `${s.step}:${s.detail}`).join(" → ");
    return {
      success: true,
      message: `一键成片完成：${steps}${result.warnings?.length ? `（${result.warnings.length} 条引用警告）` : ""}`,
      data: result,
    };
  }
}
