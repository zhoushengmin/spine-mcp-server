/**
 * 工具：spine_export_video — 导出动画为视频（GIF / MP4 / WebM）
 *
 * 实现：JS Spine 运行时逐帧渲染（renderAnimationFrames）→ 合成：
 * - GIF：纯 JS 编码器（零依赖，任意环境可用）
 * - MP4/WebM：调用 ffmpeg（环境变量 FFMPEG_PATH 或 PATH），不存在则回退 GIF
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { renderAnimationFrames } from "../spine/render-service";
import { exportProject } from "../spine/export-service";
import { ensureDir, createTempDir, removeDir } from "../utils/file-utils";
import { encodeGif } from "../utils/gif-encoder";
import { execFileSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/** 定位项目同名 atlas/png（同目录 + export 子目录，基础名匹配去掉 -pro/-ess 后缀） */
function findAtlasPng(project: string): { atlas: string; png: string } | null {
  const base = path.dirname(project);
  const nameBase = path.basename(project).replace(/\.spine$/i, "");
  const bare = nameBase.replace(/-(pro|ess|skeleton)$/i, "");
  const found: { atlas: string; png: string }[] = [];
  for (const dir of [base, path.join(base, "export")]) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (!f.endsWith(".atlas")) continue;
      const b = f.replace(/\.atlas$/i, "").toLowerCase();
      if (b === nameBase.toLowerCase() || b === bare.toLowerCase() || nameBase.toLowerCase().includes(b) || b.includes(nameBase.toLowerCase())) {
        const png = path.join(dir, f.replace(/\.atlas$/i, ".png"));
        if (fs.existsSync(png)) found.push({ atlas: path.join(dir, f), png });
      }
    }
  }
  if (!found.length) return null;
  // 优先精确匹配
  found.sort((a, b) => {
    const score = (x: { atlas: string }) => {
      const b2 = path.basename(x.atlas).replace(/\.atlas$/i, "").toLowerCase();
      if (b2 === nameBase.toLowerCase()) return 100;
      if (b2 === bare.toLowerCase()) return 90;
      return 50;
    };
    return score(b) - score(a);
  });
  return found[0];
}

/** 检测 ffmpeg 可执行路径 */
function findFfmpeg(): string | null {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    const r = spawnSync("ffmpeg", ["-version"], { encoding: "utf8", timeout: 5000, windowsHide: true });
    if (r.status === 0) return "ffmpeg";
  } catch {
    /* ignore */
  }
  return null;
}

export class ExportVideoTool extends BaseTool {
  name = "spine_export_video";
  description = "导出动画为视频：JS 运行时逐帧渲染（含 mesh 顶点变形），默认输出 GIF（纯 JS 编码，零依赖）；检测到 ffmpeg 时可输出 MP4/WebM。";
  inputSchema = z.object({
    projectPath: z.string().optional().describe(".spine 项目（自动导出 JSON 并定位 atlas/png）"),
    skeletonJson: z.string().optional().describe("导出的骨架 JSON（替代 projectPath，需配合 atlasPath/imagePath）"),
    atlasPath: z.string().optional(),
    imagePath: z.string().optional(),
    animationName: z.string().optional().describe("动画名（缺省用第一个）"),
    outputPath: z.string().describe("输出文件（.gif/.mp4/.webm）"),
    fps: z.number().int().min(1).max(60).optional(),
    width: z.number().int().min(16).max(4096).optional(),
    height: z.number().int().min(16).max(4096).optional(),
    format: z.enum(["auto", "gif", "mp4", "webm"]).optional().describe("auto：默认 gif，检测到 ffmpeg 时按输出后缀；缺省 gif"),
  });

  async run(args: any): Promise<any> {
    const outputPath = args.outputPath;
    ensureDir(path.dirname(outputPath) || ".");
    const temp = createTempDir("spine-video-");
    try {
      // 1) 定位渲染产物（骨架 JSON + atlas + png）
      let skeletonJson = args.skeletonJson;
      let atlasPath = args.atlasPath;
      let imagePath = args.imagePath;
      if (!skeletonJson && !args.projectPath) {
        return { success: false, message: "需要 skeletonJson（或 atlasPath+imagePath）或 projectPath。", errorCode: "E_INVALID_ARGUMENT" };
      }
      if (!skeletonJson) {
        const files = await exportProject(args.projectPath, temp, { format: "json" });
        skeletonJson = files.find((f) => f.endsWith(".json"));
        if (!skeletonJson) return { success: false, message: "导出 JSON 失败。", errorCode: "E_CLI_EXEC_FAILED" };
      }
      if (!atlasPath || !imagePath) {
        const found = args.projectPath ? findAtlasPng(args.projectPath) : null;
        if (!found) {
          return { success: false, message: "未找到项目同名 atlas/png（需先导出过图片，或显式传 atlasPath/imagePath）。", errorCode: "E_INVALID_ARGUMENT" };
        }
        atlasPath = found.atlas;
        imagePath = found.png;
      }
      for (const [label, p] of [["骨架 JSON", skeletonJson], ["图集", atlasPath], ["图集图片", imagePath]] as const) {
        if (!fs.existsSync(p)) return { success: false, message: `${label}不存在：${p}`, errorCode: "E_INVALID_ARGUMENT" };
      }

      // 2) 动画名（缺省第一个）
      const json = JSON.parse(fs.readFileSync(skeletonJson, "utf8"));
      const animationName = args.animationName ?? Object.keys(json.animations ?? {})[0];
      if (!animationName) return { success: false, message: "项目没有动画。", errorCode: "E_INVALID_ARGUMENT" };

      // 3) 逐帧渲染
      const fps = args.fps ?? 30;
      const frames = await renderAnimationFrames(skeletonJson, atlasPath, imagePath, animationName, {
        fps,
        width: args.width,
        height: args.height,
      });

      // 4) 合成输出
      const ext = path.extname(outputPath).toLowerCase().replace(".", "");
      const format = args.format ?? (ext === "mp4" || ext === "webm" ? ext : "gif");
      const ffmpeg = findFfmpeg();

      if (format === "mp4" || format === "webm") {
        if (!ffmpeg) {
          return { success: false, message: `格式 ${format} 需要 ffmpeg：设置环境变量 FFMPEG_PATH 或加入 PATH。可改用 .gif 输出。`, errorCode: "E_FFMPEG_NOT_FOUND", data: { suggestion: "输出 GIF（纯 JS 编码）" } };
        }
        return this.encodeWithFfmpeg(frames, fps, format, outputPath, ffmpeg, animationName);
      }

      // GIF（默认）
      const frameW = frames[0].buffer.length ? Math.round(Math.sqrt(frames[0].buffer.length / 4)) : 0;
      const frameH = frames[0].buffer.length ? Math.round(frames[0].buffer.length / 4 / frameW) : 0;
      const gif = encodeGif(frames.map((f) => ({ width: frameW, height: frameH, rgba: f.buffer, delayMs: 1000 / fps })));
      fs.writeFileSync(outputPath, gif);
      return {
        success: true,
        message: `已导出动画 "${animationName}" → ${outputPath}（GIF，${frames.length} 帧 @${fps}fps，${frameW}x${frameH}）`,
        data: { outputPath, format: "gif", frames: frames.length, fps, width: frameW, height: frameH, animationName },
      };
    } finally {
      removeDir(temp);
    }
  }

  /** 用 ffmpeg 合成 MP4/WebM（输入为 PNG 帧序列） */
  private async encodeWithFfmpeg(frames: { index: number; buffer: Buffer }[], fps: number, format: string, outputPath: string, ffmpeg: string, animationName: string): Promise<any> {
    const work = createTempDir("spine-video-ffmpeg-");
    try {
      const w = Math.round(Math.sqrt(frames[0].buffer.length / 4));
      const h = Math.round(frames[0].buffer.length / 4 / w);
      for (const f of frames) {
        fs.writeFileSync(path.join(work, `frame_${String(f.index).padStart(4, "0")}.png`), await this.rgbaToPng(f.buffer, w, h));
      }
      const inputPattern = path.join(work, "frame_%04d.png");
      const args = ["-y", "-framerate", String(fps), "-i", inputPattern];
      if (format === "mp4") {
        args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
      } else {
        args.push("-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30");
      }
      args.push(outputPath);
      const out = execFileSync(ffmpeg, args, { encoding: "utf8", timeout: 120000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      return {
        success: true,
        message: `已导出动画 "${animationName}" → ${outputPath}（${format.toUpperCase()}，${frames.length} 帧 @${fps}fps，${w}x${h}）`,
        data: { outputPath, format, frames: frames.length, fps, width: w, height: h, animationName },
      };
    } catch (err) {
      return { success: false, message: "ffmpeg 合成失败。", errorCode: "E_FFMPEG_EXEC_FAILED", data: { detail: err instanceof Error ? err.message : String(err) } };
    } finally {
      removeDir(work);
    }
  }

  private async rgbaToPng(rgba: Buffer, w: number, h: number): Promise<Buffer> {
    const sharp = (await import("sharp")).default;
    return sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  }
}
