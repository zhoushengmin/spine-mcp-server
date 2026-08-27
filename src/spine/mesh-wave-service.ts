/**
 * 网格波动特效服务：给 mesh 附件写入 FFD 正弦变形动画（旗帜/布料/水波/触须摆动）。
 * 仅支持非加权（non-weighted）mesh；变形为顶点偏移（Spine deform = 相对 Setup 顶点的位移）。
 * 波动沿网格局部坐标传播：axis=y 时 dy = A·sin(2π·x/λ - 2π·cycles·t/T)。
 */
import { ErrorCode, SpineError } from "../utils/error-codes";

export interface WaveOptions {
  animationName?: string;
  duration?: number;
  amplitude?: number; // 波动幅度（像素）
  wavelength?: number; // 波长（像素）
  cycles?: number; // 一个时长内的波动周期数
  axis?: "x" | "y"; // 波动方向
  phase?: number; // 初始相位（弧度）
  fps?: number;
}

export interface WaveResult {
  animationName: string;
  slotName: string;
  attachmentName: string;
  vertexCount: number;
  keyframes: number;
}

const TAU = Math.PI * 2;

export function meshWave(json: any, slotName: string, attachmentName: string, options: WaveOptions = {}): WaveResult {
  // 1) 定位 mesh 附件（默认皮肤）
  const skins: any[] = Array.isArray(json.skins) ? json.skins : Object.values(json.skins ?? {});
  const defaultSkin = skins.find((s: any) => s.name === "default") ?? skins[0];
  const att = defaultSkin?.attachments?.[slotName]?.[attachmentName];
  if (!att) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `附件不存在：${slotName}/${attachmentName}`, "可用 spine_get_attachments 查看。");
  }
  if (att.type !== "mesh") {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `附件 "${attachmentName}" 不是 mesh（实际：${att.type}）。`, "波动特效仅支持网格附件。");
  }
  const v = att.vertices;
  if (!Array.isArray(v) || v.length < 2) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `mesh "${attachmentName}" 顶点数据无效。`);
  }
  if (Number.isInteger(v[0]) && v[0] >= 1) {
    throw new SpineError(ErrorCode.INVALID_ARGUMENT, `mesh "${attachmentName}" 为加权蒙皮网格，暂不支持波动特效。`);
  }

  const skinName = defaultSkin?.name ?? "default";
  const duration = options.duration ?? 1.5;
  const amplitude = options.amplitude ?? 6;
  const wavelength = Math.max(1, options.wavelength ?? 48);
  const cycles = options.cycles ?? 1;
  const axis = options.axis ?? "y";
  const phase = options.phase ?? 0;
  const fps = options.fps ?? 12;
  const vertexCount = Math.floor(v.length / 2);

  // 2) 生成动画名
  let name = options.animationName ?? `${attachmentName}-wave`;
  const existing = Object.keys(json.animations ?? {});
  if (existing.includes(name)) {
    let i = 1;
    while (existing.includes(`${name}-${i}`)) i++;
    name = `${name}-${i}`;
  }
  json.animations ??= {};
  json.animations[name] = {};
  const deformTl = (json.animations[name].deform ??= {});
  deformTl[skinName] ??= {};
  deformTl[skinName][slotName] ??= {};
  const tl = (deformTl[skinName][slotName][attachmentName] ??= []);

  // 3) 逐帧采样偏移
  const frames = Math.max(2, Math.round(duration * fps));
  for (let i = 0; i <= frames; i++) {
    const t = (i / frames) * duration;
    const offsets = new Array<number>(vertexCount * 2).fill(0);
    for (let k = 0; k < vertexCount; k++) {
      const lx = v[k * 2];
      const ly = v[k * 2 + 1];
      const along = axis === "y" ? lx : ly; // 传播方向取正交坐标
      const wave = Math.sin((TAU * along) / wavelength - TAU * cycles * (t / duration) + phase);
      if (axis === "y") offsets[k * 2 + 1] = amplitude * wave;
      else offsets[k * 2] = amplitude * wave;
    }
    tl.push({ time: t, offset: 0, vertices: offsets });
  }

  return { animationName: name, slotName, attachmentName, vertexCount, keyframes: frames + 1 };
}
