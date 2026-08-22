/**
 * 工具：spine_get_animation_detail — 动画时间轴完整结构
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { readJsonForExport } from "../spine/modify-service";
import { readJsonFile } from "../utils/file-utils";
import * as path from "path";

export class GetAnimationDetailTool extends BaseTool {
  name = "spine_get_animation_detail";
  description = "返回单个动画的完整时间轴结构（骨骼/插槽/约束/事件/绘制顺序/变形各时间轴的关键帧数与曲线）。";
  inputSchema = z.object({
    projectPath: z.string().describe(".spine 项目或 .json 文件的绝对路径"),
    animationName: z.string(),
  });

  async run(args: { projectPath: string; animationName: string }): Promise<any> {
    const { projectPath, animationName } = args;
    const isJson = path.extname(projectPath).toLowerCase() === ".json";
    const json = isJson ? readJsonFile(projectPath) : await readJsonForExport(projectPath);
    const anim = json.animations?.[animationName];
    if (!anim) {
      return { success: false, message: `动画 "${animationName}" 不存在。`, errorCode: "E_INVALID_ARGUMENT" };
    }
    const summarize = (obj: any): any => {
      if (Array.isArray(obj)) {
        return { frames: obj.length, first: obj[0] ?? null };
      }
      if (obj && typeof obj === "object") {
        const out: Record<string, any> = {};
        for (const k of Object.keys(obj)) out[k] = summarize(obj[k]);
        return out;
      }
      return obj;
    };
    const detail = summarize(anim);
    return { success: true, message: `动画 "${animationName}" 时间轴已读取`, data: { animationName, detail } };
  }
}
