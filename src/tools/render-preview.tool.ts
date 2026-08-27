/**
 * 工具：spine_render_preview — JS 运行时渲染动画为 PNG / 序列精灵图
 * - mode=frame：渲染单帧 PNG（默认）
 * - mode=sequence：把动画渲染成 N 帧精灵图（网格），一次"看"完整动作
 * - wireframe=true：叠加骨骼线框 + 关节点，便于 AI 核对绑骨/枢轴
 * 需要项目导出产物：骨架 JSON + .atlas + 图集 png。
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { renderFrameToRgba } from "../spine/render-service";
import { renderRuntimeFrameToPng, renderRuntimeFrame, isRuntimeRenderAvailable } from "../spine/render-runtime";
import { parseAtlas } from "../spine/atlas-utils";
import { overlayBonesOnFrame, rgbaToClamped, clampedToPng } from "../spine/render-visualize-service";
import { exportProject } from "../spine/export-service";
import { ensureDir, createTempDir, removeDir } from "../utils/file-utils";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

export class RenderPreviewTool extends BaseTool {
  name = "spine_render_preview";
  description =
    "用 JS 运行时渲染 Spine 动画为 PNG 预览。提供 atlasPath+imagePath 时优先使用官方 Spine runtime（IK/权重/曲线/变形与游戏内一致，所见即所得）；未提供图集时用内置软件光栅化。支持 mode=frame（单帧）/mode=sequence（多帧精灵图，一次看完整动作）；wireframe=true 叠加骨骼线框与关节点以核对绑骨/枢轴。可传产物路径，或传 .spine 项目自动导出。";
  inputSchema = z.object({
    skeletonJson: z.string().optional().describe("导出的骨架 JSON 路径"),
    atlasPath: z.string().optional().describe(".atlas 路径"),
    imagePath: z.string().optional().describe("图集 png 路径"),
    projectPath: z.string().optional().describe(".spine 项目（未提供产物时自动导出 JSON）"),
    animationName: z.string().optional(),
    time: z.number().min(0).optional().describe("时间（秒），仅 frame 模式"),
    frameIndex: z.number().int().min(0).optional(),
    fps: z.number().int().optional(),
    mode: z.enum(["frame", "sequence"]).optional().describe("frame=单帧（默认）；sequence=多帧精灵图"),
    frames: z.number().int().min(2).max(32).optional().describe("sequence 帧数，默认 8"),
    spriteColumns: z.number().int().min(1).max(8).optional().describe("sequence 精灵图列数，默认自适应"),
    wireframe: z.boolean().optional().describe("叠加骨骼线框 + 关节点"),
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
      const json = JSON.parse(fs.readFileSync(skeletonJson, "utf8"));
      const animName = args.animationName ?? Object.keys(json.animations ?? {})[0];
      if (!animName) return { success: false, message: "项目没有动画。", errorCode: "E_INVALID_ARGUMENT" };

      const official = !!(args.atlasPath && args.imagePath) && isRuntimeRenderAvailable();
      const skel = json.skeleton ?? {};
      const width = args.width ?? Math.max(1, Math.ceil(skel.width ?? 256));
      const height = args.height ?? Math.max(1, Math.ceil(skel.height ?? 256));

      // 渲染必须要有图集（官方与内置渲染器都依赖 region 纹理）
      if (!args.atlasPath || !args.imagePath) {
        return {
          success: false,
          message: "需要图集 atlasPath 与图集图片 imagePath 才能渲染。传 .spine 项目时请先确保项目图集已导出（或显式提供 export 产物路径）。",
          errorCode: "E_INVALID_ARGUMENT",
        };
      }

      if (args.mode === "sequence") {
        return await this.renderSequence({ ...args, skeletonJson, json, animName, official, width, height });
      }
      return await this.renderSingle({ ...args, skeletonJson, json, animName, official, width, height });
    } finally {
      cleanup.forEach((d) => removeDir(d));
    }
  }

  /** 单帧渲染（frame 模式） */
  private async renderSingle(args: any): Promise<any> {
    const { json, animName, official, width, height } = args;
    const time = args.time ?? (args.frameIndex !== undefined ? args.frameIndex / (args.fps ?? 30) : 0);

    if (official) {
      try {
        const r = await renderRuntimeFrameToPng({
          skeletonJsonPath: args.skeletonJson,
          atlasPath: args.atlasPath,
          imagePath: args.imagePath,
          animationName: animName,
          time,
          width,
          height,
          wireframe: args.wireframe,
          outputPath: args.outputPath,
        });
        return {
          success: true,
          message: `已渲染 "${animName}" @${time}s → ${args.outputPath}（${r.width}x${r.height}，官方 Spine runtime${args.wireframe ? "，含骨骼线框" : ""}）`,
          data: { outputPath: args.outputPath, width: r.width, height: r.height, animationName: animName, time, renderer: "spine-runtime", wireframe: !!args.wireframe },
        };
      } catch (e) {
        console.warn("[render-preview] 官方 runtime 渲染失败，回退内置渲染：", (e as Error).message);
      }
    }
    const atlas = args.atlasPath ? parseAtlas(fs.readFileSync(args.atlasPath, "utf8")) : undefined;
    const meta = { slots: 0 };
    const buf = await renderFrameToRgba(json, atlas as any, args.imagePath, animName, time, width, height, meta);
    const frame = rgbaToClamped(buf, width, height);
    if (args.wireframe) overlayBonesOnFrame(frame, width, height, { skeletonJson: json, animationName: animName, time, width, height });
    await clampedToPng(frame, width, height, args.outputPath);
    return {
      success: true,
      message: `已渲染 "${animName}" @${time}s → ${args.outputPath}（${width}x${height}，${meta.slots} 个附件${args.wireframe ? "，含骨骼线框" : ""}）`,
      data: { outputPath: args.outputPath, width, height, animationName: animName, time, slots: meta.slots, renderer: "builtin", wireframe: !!args.wireframe },
    };
  }

  /** 多帧精灵图渲染（sequence 模式） */
  private async renderSequence(args: any): Promise<any> {
    const { json, animName, width, height } = args;
    let official = args.official;
    const n = args.frames ?? 8;
    const cols = args.spriteColumns ?? Math.min(4, Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    const duration = json.animations?.[animName]?.duration ?? 1;
    const atlas = args.atlasPath ? parseAtlas(fs.readFileSync(args.atlasPath, "utf8")) : undefined;
    const rgbs: Buffer[] = [];

    for (let i = 0; i < n; i++) {
      const t = duration * (i / n);
      if (official) {
        try {
          const r = await renderRuntimeFrame({
            skeletonJsonPath: args.skeletonJson,
            atlasPath: args.atlasPath,
            imagePath: args.imagePath,
            animationName: animName,
            time: t,
            width,
            height,
            wireframe: args.wireframe,
          });
          rgbs.push(r.rgba);
          continue;
        } catch (e) {
          console.warn("[render-preview] 官方 runtime 渲染失败，回退内置渲染：", (e as Error).message);
          official = false;
        }
      }
      const meta = { slots: 0 };
      const buf = await renderFrameToRgba(json, atlas as any, args.imagePath, animName, t, width, height, meta);
      const frame = rgbaToClamped(buf, width, height);
      if (args.wireframe) overlayBonesOnFrame(frame, width, height, { skeletonJson: json, animationName: animName, time: t, width, height });
      rgbs.push(Buffer.from(frame.buffer, frame.byteOffset, frame.length));
    }

    const canvas = sharp({
      create: { width: cols * width, height: rows * height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    });
    const composites = rgbs.map((b, i) => ({
      input: b,
      raw: { width, height, channels: 4 as const },
      left: (i % cols) * width,
      top: Math.floor(i / cols) * height,
    }));
    await canvas.composite(composites).png().toFile(args.outputPath);
    return {
      success: true,
      message: `已渲染 "${animName}" ${n} 帧精灵图 → ${args.outputPath}（${cols}x${rows}，${width}x${height}/帧${args.wireframe ? "，含骨骼线框" : ""}）`,
      data: { outputPath: args.outputPath, mode: "sequence", frames: n, cols, rows, width, height, animationName: animName, duration, renderer: official ? "spine-runtime" : "builtin", wireframe: !!args.wireframe },
    };
  }
}
