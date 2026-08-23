/**
 * 工具：spine_render_preview — JS 运行时渲染动画单帧为 PNG
 * 需要项目导出产物：骨架 JSON + .atlas + 图集 png。
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { renderFrame } from "../spine/render-service";
import { exportProject } from "../spine/export-service";
import { ensureDir, createTempDir, removeDir } from "../utils/file-utils";
import * as fs from "fs";
import * as path from "path";

export class RenderPreviewTool extends BaseTool {
  name = "spine_render_preview";
  description = "用 JS 运行时渲染 Spine 动画指定帧为 PNG 预览（软件三角形光栅化，region 与 mesh 附件，含加权蒙皮与 deform FFD 顶点变形）。可传产物路径，或传 .spine 项目自动导出。";
  inputSchema = z.object({
    skeletonJson: z.string().optional().describe("导出的骨架 JSON 路径"),
    atlasPath: z.string().optional().describe(".atlas 路径"),
    imagePath: z.string().optional().describe("图集 png 路径"),
    projectPath: z.string().optional().describe(".spine 项目（未提供产物时自动导出 JSON）"),
    animationName: z.string().optional(),
    time: z.number().min(0).optional().describe("时间（秒）"),
    frameIndex: z.number().int().min(0).optional(),
    fps: z.number().int().optional(),
    outputPath: z.string().describe("输出 png 路径"),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
  });

  async run(args: any): Promise<any> {
    let skeletonJson = args.skeletonJson;
    const cleanup: string[] = [];
    try {
      if (!skeletonJson) {
        if (!args.projectPath) {
          return { success: false, message: "需要 skeletonJson（或 atlasPath+imagePath）或 projectPath。", errorCode: "E_INVALID_ARGUMENT" };
        }
        const temp = createTempDir("spine-render-");
        cleanup.push(temp);
        const files = await exportProject(args.projectPath, temp, { format: "json" });
        skeletonJson = files.find((f) => f.endsWith(".json"));
        if (!skeletonJson) {
          return { success: false, message: "导出 JSON 失败。", errorCode: "E_CLI_EXEC_FAILED" };
        }
      }
      const result = await renderFrame(skeletonJson, args.atlasPath, args.imagePath, args.outputPath, {
        animationName: args.animationName,
        time: args.time,
        frameIndex: args.frameIndex,
        fps: args.fps,
        width: args.width,
        height: args.height,
      });
      return {
        success: true,
        message: `已渲染 "${result.animationName}" @${result.time}s → ${args.outputPath}（${result.width}x${result.height}，${result.slots} 个附件）`,
        data: { outputPath: args.outputPath, width: result.width, height: result.height, animationName: result.animationName, time: result.time, slots: result.slots },
      };
    } finally {
      cleanup.forEach((d) => removeDir(d));
    }
  }
}
