/**
 * 效果配方服务：把「用户想要的效果」映射为可执行的操作序列（Recipe）。
 * - 动画类：复用 generateAnimation 模板（idle/breath/walk/run/wave/attack/jump）
 * - 皮肤类：切换默认皮肤（换装）
 * - 组合类：动作 + 事件触发点（供引擎播粒子/音效）
 * 提供 listEffects（目录）与 applyEffect（一句话执行）两类入口。
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { modifyProject, readJsonForExport } from "./modify-service";
import { generateAnimation, TEMPLATES } from "./animation-generate-service";
import { setDefaultSkin, addEventKeyframe, addEvent } from "./json-handler";
import { renderFrameToRgba } from "./render-service";
import { parseAtlas } from "./atlas-utils";
import { ensureDir } from "../utils/file-utils";
import { ErrorCode, SpineError } from "../utils/error-codes";

export interface EffectParam {
  name: string;
  label: string;
  type: "string" | "number" | "boolean";
  default?: any;
  desc: string;
}

export interface EffectDef {
  name: string;
  label: string;
  desc: string;
  type: "animation" | "skin" | "combo";
  template?: string;
  combo?: { animation: string; event?: { name: string; timeRatio: number } };
  defaultDuration?: number;
  params: EffectParam[];
}

const TEMPLATE_LABELS: Record<string, string> = {
  idle: "待机", breath: "呼吸", walk: "走路", run: "跑步", wave: "挥手", attack: "攻击", jump: "跳跃",
};

/** 全部效果配方（动画类动态来自模板表） */
export function listEffects(): EffectDef[] {
  const animEffects: EffectDef[] = Object.entries(TEMPLATES).map(([template, tpl]) => ({
    name: template,
    label: TEMPLATE_LABELS[template] ?? template,
    desc: `生成 "${TEMPLATE_LABELS[template] ?? template}" 动作动画（自动匹配骨骼角色，含贝塞尔平滑曲线）`,
    type: "animation",
    template,
    defaultDuration: tpl.defaultDuration,
    params: [],
  }));
  return [
    ...animEffects,
    {
      name: "switch-skin",
      label: "切换皮肤(换装)",
      desc: "把项目默认皮肤切换到指定皮肤（皮肤需已存在，可用 spine_set_skin 创建）",
      type: "skin",
      params: [{ name: "skinName", label: "皮肤名", type: "string", desc: "目标皮肤名" }],
    },
    {
      name: "attack-impact",
      label: "攻击+命中特效",
      desc: "生成攻击动作，并在挥击时刻埋 impact 事件（供引擎播粒子/音效）",
      type: "combo",
      combo: { animation: "attack", event: { name: "impact", timeRatio: 0.45 } },
      defaultDuration: 0.6,
      params: [],
    },
    {
      name: "jump-land",
      label: "跳跃+落地特效",
      desc: "生成跳跃动作，并在落地时刻埋 land 事件",
      type: "combo",
      combo: { animation: "jump", event: { name: "land", timeRatio: 0.8 } },
      defaultDuration: 0.8,
      params: [],
    },
  ];
}

export function findEffect(name: string): EffectDef | undefined {
  return listEffects().find((e) => e.name === name);
}

export interface ApplyOptions {
  animationName?: string;
  duration?: number;
  skinName?: string;
  eventTime?: number;
  preview?: { atlasPath: string; imagePath: string; frames?: number; width?: number; height?: number; outputPath: string };
}

export interface ApplyResult {
  effect: string;
  steps: Array<{ step: string; detail: string }>;
  animationName?: string;
  warnings: string[];
  backupPath?: string;
  previewPath?: string;
}

/** 一句话执行效果配方 */
export async function applyEffect(projectPath: string, effectName: string, options: ApplyOptions = {}): Promise<ApplyResult> {
  const def = findEffect(effectName);
  if (!def) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `未知效果：${effectName}`, `可用效果：${listEffects().map((e) => e.name).join("、")}。`);
  }
  const steps: Array<{ step: string; detail: string }> = [];
  let genAnimationName: string | undefined;

  const result = await modifyProject(projectPath, (json) => {
    if (def.type === "animation" && def.template) {
      const r = generateAnimation(json, def.template, { animationName: options.animationName, duration: options.duration });
      genAnimationName = r.animationName;
      steps.push({ step: "generate-animation", detail: `${def.template} → ${r.animationName}（${r.keyframes} 关键帧 / ${r.curves} 曲线，驱动 ${r.bones} 骨骼）` });
    } else if (def.type === "skin") {
      if (!options.skinName) {
        throw new SpineError(ErrorCode.INVALID_ARGUMENT, "switch-skin 需要 skinName 参数。", '示例：{ effect:"switch-skin", skinName:"armor" }');
      }
      const skins = Array.isArray(json.skins) ? json.skins.map((s: any) => s?.name) : Object.keys(json.skins ?? {});
      if (!skins.includes(options.skinName)) {
        throw new SpineError(ErrorCode.INVALID_ARGUMENT, `皮肤 "${options.skinName}" 不存在。`, `当前皮肤：${skins.join("、") || "无"}。可先用 spine_set_skin 创建。`);
      }
      setDefaultSkin(json, options.skinName);
      steps.push({ step: "set-default-skin", detail: `默认皮肤 → ${options.skinName}` });
    } else if (def.type === "combo" && def.combo) {
      if (def.combo.animation) {
        const tpl = TEMPLATES[def.combo.animation];
        const r = generateAnimation(json, def.combo.animation, { animationName: options.animationName, duration: options.duration });
        genAnimationName = r.animationName;
        steps.push({ step: "generate-animation", detail: `${def.combo.animation} → ${r.animationName}（${r.keyframes} 关键帧）` });
      }
      if (def.combo.event && genAnimationName) {
        const t = options.eventTime ?? def.combo.event.timeRatio * (options.duration ?? TEMPLATES[def.combo.animation].defaultDuration);
        // 事件未定义则自动创建（Spine CLI 要求事件先在 json.events 定义）
        if (!json.events?.[def.combo.event.name]) {
          addEvent(json, def.combo.event.name, {});
        }
        addEventKeyframe(json, genAnimationName, t, def.combo.event.name);
        steps.push({ step: "add-event", detail: `事件 ${def.combo.event.name} @${t.toFixed(2)}s` });
      }
    }
  });

  let previewPath: string | undefined;
  if (options.preview?.outputPath && genAnimationName) {
    previewPath = await renderSequencePreview(projectPath, genAnimationName, options.preview);
    steps.push({ step: "render-preview", detail: `序列预览 → ${previewPath}` });
  }

  return { effect: effectName, steps, animationName: genAnimationName, warnings: result.warnings, backupPath: result.backupPath, previewPath };
}

/** 渲染动画序列精灵图（内置光栅化 + sharp 合成） */
async function renderSequencePreview(projectPath: string, animName: string, p: ApplyOptions["preview"] & { outputPath: string }): Promise<string> {
  if (!p.atlasPath || !p.imagePath) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, "预览需要 atlasPath 与 imagePath（项目图集）。", "可在 render_preview 中传产物路径，或先导出项目图集。");
  }
  ensureDir(path.dirname(p.outputPath) || ".");
  const json = await readJsonForExport(projectPath);
  const atlas = parseAtlas(fs.readFileSync(p.atlasPath, "utf8"));
  const duration = json.animations?.[animName]?.duration ?? 1;
  const width = p.width ?? 128, height = p.height ?? 128;
  const n = p.frames ?? 8;
  const cols = Math.min(4, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const rgbs: Buffer[] = [];
  for (let i = 0; i < n; i++) {
    rgbs.push(await renderFrameToRgba(json, atlas, p.imagePath, animName, duration * (i / n), width, height));
  }
  const canvas = sharp({
    create: { width: cols * width, height: rows * height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  await canvas
    .composite(rgbs.map((b, i) => ({ input: b, raw: { width, height, channels: 4 as const }, left: (i % cols) * width, top: Math.floor(i / cols) * height })))
    .png()
    .toFile(p.outputPath);
  return p.outputPath;
}
