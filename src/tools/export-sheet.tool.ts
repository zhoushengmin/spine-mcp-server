/**
 * 工具：spine_export_sheet — 导出动画为动作序列精灵表（游戏动画资源）+ 帧元数据
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { renderAnimationFrames } from "../spine/render-service";
import { exportProject } from "../spine/export-service";
import { findProjectAtlas } from "../spine/check-service";
import { ensureDir, createTempDir, removeDir } from "../utils/file-utils";
import { writeJsonFile } from "../utils/file-utils";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

export class ExportSheetTool extends BaseTool {
  name = "spine_export_sheet";
  description =
    "把动画逐帧渲染为动作序列精灵表（网格 PNG）+ framesMeta.json（每帧 time/x/y/w/h），供游戏动画资源使用。需项目图集（atlasPath/imagePath 或自动定位）。";
  inputSchema = z.object({
    projectPath: z.string().optional().describe(".spine 项目（自动导出 JSON 并定位 atlas/png）"),
    skeletonJson: z.string().optional().describe("导出的骨架 JSON（替代 projectPath）"),
    atlasPath: z.string().optional(),
    imagePath: z.string().optional(),
    animationName: z.string().optional().describe("动画名（缺省第一个）"),
    outputPath: z.string().describe("输出精灵表 PNG 路径"),
    fps: z.number().int().min(1).max(60).optional().describe("帧率，默认 30"),
    width: z.number().int().min(16).max(4096).optional(),
    height: z.number().int().min(16).max(4096).optional(),
    columns: z.number().int().min(1).max(16).optional().describe("每行列数，默认自适应"),
  });

  async run(args: any): Promise<any> {
    const temp = createTempDir("spine-sheet-");
    try {
      let skeletonJson = args.skeletonJson;
      let atlasPath = args.atlasPath;
      let imagePath = args.imagePath;
      if (!skeletonJson) {
        if (!args.projectPath) return { success: false, message: "需要 skeletonJson 或 projectPath。", errorCode: "E_INVALID_ARGUMENT" };
        const files = await exportProject(args.projectPath, temp, { format: "json" });
        skeletonJson = files.find((f) => f.endsWith(".json"));
        if (!skeletonJson) return { success: false, message: "导出 JSON 失败。", errorCode: "E_CLI_EXEC_FAILED" };
      }
      if (!atlasPath || !imagePath) {
        const found = args.projectPath ? findProjectAtlas(args.projectPath) : null;
        if (!found) return { success: false, message: "未找到项目同名 atlas/png。", errorCode: "E_INVALID_ARGUMENT" };
        atlasPath = found.atlas;
        imagePath = found.png;
      }
      const json = JSON.parse(fs.readFileSync(skeletonJson, "utf8"));
      const animationName = args.animationName ?? Object.keys(json.animations ?? {})[0];
      if (!animationName) return { success: false, message: "项目没有动画。", errorCode: "E_INVALID_ARGUMENT" };

      const fps = args.fps ?? 30;
      const frames = await renderAnimationFrames(skeletonJson, atlasPath, imagePath, animationName, {
        fps,
        width: args.width,
        height: args.height,
      });
      if (!frames.length) return { success: false, message: "渲染帧为空。", errorCode: "E_CLI_EXEC_FAILED" };

      const fw = Math.round(Math.sqrt(frames[0].buffer.length / 4));
      const fh = Math.round(frames[0].buffer.length / 4 / fw);
      const n = frames.length;
      const cols = args.columns ?? Math.min(8, Math.ceil(Math.sqrt(n)));
      const rows = Math.ceil(n / cols);

      ensureDir(path.dirname(args.outputPath) || ".");
      const canvas = sharp({ create: { width: cols * fw, height: rows * fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
      await canvas
        .composite(frames.map((f, i) => ({ input: f.buffer, raw: { width: fw, height: fh, channels: 4 as const }, left: (i % cols) * fw, top: Math.floor(i / cols) * fh })))
        .png()
        .toFile(args.outputPath);

      // 帧元数据
      const metaPath = args.outputPath.replace(/\.png$/i, ".frames.json");
      writeJsonFile(metaPath, {
        animationName,
        frameWidth: fw,
        frameHeight: fh,
        columns: cols,
        rows,
        fps,
        frames: frames.map((f, i) => ({ index: i, time: f.time, x: (i % cols) * fw, y: Math.floor(i / cols) * fh, w: fw, h: fh })),
      });
      return {
        success: true,
        message: `已导出动画 "${animationName}" 精灵表（${n} 帧 @${fps}fps，${cols}x${rows}，${fw}x${fh}/帧）`,
        data: { outputPath: args.outputPath, metaPath, frames: n, columns: cols, rows, frameWidth: fw, frameHeight: fh, animationName, fps },
      };
    } finally {
      removeDir(temp);
    }
  }
}
