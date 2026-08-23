/**
 * 官方 Spine runtime 渲染器（spine-ts 3.8 canvas bundle + node-canvas）
 *
 * 与自研软件光栅化（render-service.ts）不同，本渲染器使用 Esoteric 官方算法：
 * IK 约束、权重蒙皮、曲线插值、FFD 变形、混合模式全部与游戏内一致 —— 预览即所见即所得。
 *
 * 依赖：vendor/spine-ts/spine-canvas.js（官方 bundle，已内嵌 spine-core）+ node-canvas。
 * 在无法加载 node-canvas 的环境（如 Cocos 扩展 Electron 主进程）会抛错，调用方应回退自研渲染。
 */
declare const require: any;

import * as fs from "fs";
import * as path from "path";

let spine: any = null;
let canvasMod: any = null;

/** 加载 spine-ts canvas bundle（全局脚本，挂到 globalThis.spine），只加载一次 */
function getSpine(): any {
  if (spine) return spine;
  const bundle = path.join(__dirname, "..", "..", "vendor", "spine-ts", "spine-canvas.js");
  if (!fs.existsSync(bundle)) throw new Error(`spine-ts bundle 不存在：${bundle}`);
  const vm = require("vm");
  vm.runInThisContext(fs.readFileSync(bundle, "utf8"), { filename: "spine-canvas.js" });
  spine = (globalThis as any).spine;
  if (!spine || !spine.canvas || !spine.canvas.SkeletonRenderer) {
    throw new Error("spine-ts canvas bundle 加载失败（缺少 spine.canvas.SkeletonRenderer）");
  }
  return spine;
}

/** 加载 node-canvas */
function getCanvas(): any {
  if (canvasMod) return canvasMod;
  try {
    canvasMod = require("canvas");
  } catch (e) {
    throw new Error("无法加载 node-canvas（官方渲染依赖）：" + ((e as Error).message || String(e)));
  }
  return canvasMod;
}

/** 官方渲染是否可用（环境具备 spine bundle + node-canvas） */
export function isRuntimeRenderAvailable(): boolean {
  try {
    getSpine();
    getCanvas();
    return true;
  } catch {
    return false;
  }
}

function loadImage(canvas: any, src: Buffer): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new canvas.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图集图片加载失败"));
    img.src = src;
  });
}

export interface RuntimeFrameOptions {
  skeletonJsonPath: string;
  atlasPath: string;
  imagePath: string;
  animationName?: string;
  time?: number;
  width?: number;
  height?: number;
}

export interface RuntimeFrameResult {
  width: number;
  height: number;
  rgba: Buffer;
  animationName: string;
  time: number;
}

/** 用官方 runtime 渲染动画指定时间点，返回 RGBA 帧数据 */
export async function renderRuntimeFrame(opts: RuntimeFrameOptions): Promise<RuntimeFrameResult> {
  const spineMod = getSpine();
  const canvas = getCanvas();
  const json = JSON.parse(fs.readFileSync(opts.skeletonJsonPath, "utf8"));
  const atlasText = fs.readFileSync(opts.atlasPath, "utf8");
  const img = await loadImage(canvas, fs.readFileSync(opts.imagePath));

  const texture = new spineMod.canvas.CanvasTexture(img);
  const atlas = new spineMod.TextureAtlas(atlasText, () => texture);
  const loader = new spineMod.AtlasAttachmentLoader(atlas);
  const skeletonJson = new spineMod.SkeletonJson(loader);
  const skeletonData = skeletonJson.readSkeletonData(json);
  const skeleton = new spineMod.Skeleton(skeletonData);
  const state = new spineMod.AnimationState(new spineMod.AnimationStateData(skeletonData));
  const animName = opts.animationName || (skeletonData.animations.length ? skeletonData.animations[0].name : "");
  const time = opts.time ?? 0;
  if (animName) state.setAnimation(0, animName, false);
  state.update(time);
  state.apply(skeleton);
  skeleton.updateWorldTransform();

  // 计算包围盒以自动缩放居中
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of skeleton.bones) {
    if (b.worldX < minX) minX = b.worldX;
    if (b.worldX > maxX) maxX = b.worldX;
    if (b.worldY < minY) minY = b.worldY;
    if (b.worldY > maxY) maxY = b.worldY;
  }

  const W = opts.width || 512;
  const H = opts.height || 512;
  const c = canvas.createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  const scale = Math.min((W * 0.8) / bw, (H * 0.8) / bh);
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, -scale);
  ctx.translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
  const renderer = new spineMod.canvas.SkeletonRenderer(ctx);
  renderer.draw(skeleton);

  return {
    width: W,
    height: H,
    rgba: Buffer.from(ctx.getImageData(0, 0, W, H).data),
    animationName: animName,
    time,
  };
}

/** 渲染单帧并写入 PNG 文件 */
export async function renderRuntimeFrameToPng(
  opts: RuntimeFrameOptions & { outputPath: string }
): Promise<{ width: number; height: number; animationName: string; time: number }> {
  const frame = await renderRuntimeFrame(opts);
  const canvas = getCanvas();
  const c = canvas.createCanvas(frame.width, frame.height);
  const ctx = c.getContext("2d");
  ctx.putImageData(new canvas.ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height), 0, 0);
  fs.writeFileSync(opts.outputPath, c.toBuffer("image/png"));
  return { width: frame.width, height: frame.height, animationName: frame.animationName, time: frame.time };
}
