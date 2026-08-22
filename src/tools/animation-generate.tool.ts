/**
 * 工具：spine_add_simple_animation — 基于模板生成简单动画
 */
import { z } from "zod";
import { BaseTool } from "./base.tool";
import { modifyProject } from "../spine/modify-service";
import { updateBoneKeyframe } from "../spine/json-handler";

/** 模板：输入 (t 秒, duration 秒) → 变换 */
type TemplateFn = (t: number, duration: number) => { rotation?: number; y?: number; scaleY?: number };

const TEMPLATES: Record<string, TemplateFn> = {
  idle: (t, d) => ({ rotation: Math.sin((t / d) * Math.PI * 2) * 3 }),
  breath: (t, d) => ({ scaleY: 1 + Math.sin((t / d) * Math.PI * 2) * 0.05 }),
  walk: (t, d) => ({ y: Math.abs(Math.sin((t / d) * Math.PI * 2)) * 15, rotation: Math.sin((t / d) * Math.PI * 2) * 8 }),
  jump: (t, d) => ({ y: -Math.sin((t / d) * Math.PI) * 60 }),
};

export class AddSimpleAnimationTool extends BaseTool {
  name = "spine_add_simple_animation";
  description = "基于预设模板（idle/breath/walk/jump）生成简单动画并写入项目，导入前自动备份。";
  inputSchema = z.object({
    projectPath: z.string(),
    template: z.enum(["idle", "breath", "walk", "jump"]),
    duration: z.number().positive().default(1.0).describe("动画时长（秒），默认 1.0"),
    boneName: z.string().default("root").describe("作用的目标骨骼，默认 root"),
    animationName: z.string().optional().describe("生成的动画名（不填自动生成）"),
  });

  async run(args: { projectPath: string; template: string; duration: number; boneName: string; animationName?: string }): Promise<any> {
    const template = TEMPLATES[args.template];
    if (!template) {
      return { success: false, message: `未知模板：${args.template}`, errorCode: "E_INVALID_ARGUMENT" };
    }
    const duration = args.duration;
    const boneName = args.boneName;
    let keyframes = 0;

    const result = await modifyProject(args.projectPath, (json) => {
      // 生成动画名（避免冲突）
      let name = args.animationName ?? `${args.template}-auto`;
      const existing = Object.keys(json.animations ?? {});
      if (existing.includes(name)) {
        let i = 1;
        while (existing.includes(`${name}-${i}`)) i++;
        name = `${name}-${i}`;
      }
      json.animations ??= {};
      json.animations[name] = {};

      // 采样关键帧
      const points = Math.max(2, Math.round(duration * 8));
      for (let i = 0; i <= points; i++) {
        const t = (i / points) * duration;
        keyframes += updateBoneKeyframe(json, name, boneName, t, template(t, duration));
      }
      // 记录生成名到闭包外部
      (json as any).__generatedName = name;
    });

    const genName = (result as any).__generatedName ?? args.animationName ?? `${args.template}-auto`;
    return {
      success: true,
      message: `已生成动画 "${genName}"（${args.template}，${duration}s，${keyframes} 关键帧）`,
      data: { animationName: genName, template: args.template, duration, keyframes, backupPath: result.backupPath },
    };
  }
}
