/**
 * 工具：spine_render_preview — JS 运行时渲染动画单帧为 PNG
 * 需要项目导出产物：骨架 JSON + .atlas + 图集 png。
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { renderFrame } from "../spine/render-service";
import { renderRuntimeFrameToPng, isRuntimeRenderAvailable } from "../spine/render-runtime";
import { exportProject } from "../spine/export-service";
import { ensureDir, createTempDir, removeDir } from "../utils/file-utils";
import * as fs from "fs";
import * as path from "path";

export class RenderPreviewTool extends BaseTool {
  name = "spine_render_preview";
  description = "用 JS 运行时渲染 Spine 动画指定帧为 PNG 预览。提供 atlasPath+imagePath 时优先使用官方 Spine runtime（IK/权重/曲线/变形与游戏内一致，所见即所得）；未提供图集时用内置软件光栅化（region 与 mesh 附件，含加权蒙皮与 deform FFD）。可传产物路径，或传 .spine 项目自动导出。";
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
      // 优先官方 Spine runtime 渲染（真实效果）；仅当未提供图集或官方渲染不可用时回退自研
      if (args.atlasPath && args.imagePath) {
        try {
          if (isRuntimeRenderAvailable()) {
            const r = await renderRuntimeFrameToPng({
              skeletonJsonPath: skeletonJson,
              atlasPath: args.atlasPath,
              imagePath: args.imagePath,
              animationName: args.animationName,
              time: args.time,
              width: args.width,
              height: args.height,
              outputPath: args.outputPath,
            });
            return {
              success: true,
              message: `已渲染 "${r.animationName}" @${r.time}s → ${args.outputPath}（${r.width}x${r.height}，官方 Spine runtime）`,
              data: { outputPath: args.outputPath, width: r.width, height: r.height, animationName: r.animationName, time: r.time, renderer: "spine-runtime" },
            };
          }
        } catch (e) {
          // 官方渲染失败（如 node-canvas 不可用）→ 回退自研
          console.warn("[render-preview] 官方 runtime 渲染失败，回退内置渲染：", (e as Error).message);
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
