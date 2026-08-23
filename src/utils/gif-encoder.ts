/**
 * 纯 JS GIF89a 编码器（零依赖）：
 * - 逐帧颜色量化（中位切分，含透明色）
 * - LZW 压缩
 * - 输出可播放的动画 GIF
 */

export interface GifFrameInput {
  width: number;
  height: number;
  rgba: Buffer | Uint8Array; // RGBA 原始像素
  /** 帧间隔（毫秒） */
  delayMs?: number;
}

/* ---------------- 中位切分量化 ---------------- */

interface Box {
  pixels: number[]; // 该盒内颜色索引（全局色表索引）
}

/** 收集不透明颜色并量化到 <= maxColors 色，返回调色板与像素索引 */
function quantize(rgba: Uint8Array, w: number, h: number, maxColors: number, transparentIndex: number): { palette: [number, number, number][]; indices: Uint8Array } {
  // 1) 收集颜色计数
  const counts = new Map<number, number>();
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3];
    if (a < 128) continue; // 透明 → transparentIndex
    const key = ((rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]) >>> 0;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const colorKeys = [...counts.keys()];
  const colors: [number, number, number][] = colorKeys.map((k) => [k >> 16 & 255, k >> 8 & 255, k & 255]);
  const countArr = colorKeys.map((k) => counts.get(k)!);

  // 颜色数不超过上限 → 直接使用
  let palette: [number, number, number][];
  if (colors.length <= maxColors) {
    palette = colors;
  } else {
    palette = medianCut(colors, countArr, maxColors);
  }

  // 2) 生成调色板查找表
  const index = (r: number, g: number, b: number): number => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const dr = r - palette[i][0], dg = g - palette[i][1], db = b - palette[i][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = i; }
      if (d === 0) break;
    }
    return best;
  };

  // 3) 像素索引
  const indices = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3];
    if (a < 128) { indices[i] = transparentIndex; continue; }
    indices[i] = index(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  }
  return { palette, indices };
}

/** 中位切分：把颜色集合切到 target 个盒子，取每盒平均色 */
function medianCut(colors: [number, number, number][], counts: number[], target: number): [number, number, number][] {
  // 每个盒子 = 颜色索引列表
  let boxes: number[][] = [colors.map((_, i) => i)];
  const boxAvg = (box: number[]): [number, number, number] => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const i of box) { const c = colors[i]; r += c[0]; g += c[1]; b += c[2]; n++; }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  };

  while (boxes.length < target) {
    // 找最"大"（跨距最大）的盒子切分
    let bestIdx = -1, bestRange = -1, bestDim = 0;
    boxes.forEach((box, bi) => {
      if (box.length < 2) return;
      const rMin = Math.min(...box.map((i) => colors[i][0]));
      const rMax = Math.max(...box.map((i) => colors[i][0]));
      const gMin = Math.min(...box.map((i) => colors[i][1]));
      const gMax = Math.max(...box.map((i) => colors[i][1]));
      const bMin = Math.min(...box.map((i) => colors[i][2]));
      const bMax = Math.max(...box.map((i) => colors[i][2]));
      const ranges = [rMax - rMin, gMax - gMin, bMax - bMin];
      const dim = ranges.indexOf(Math.max(...ranges));
      if (ranges[dim] > bestRange) { bestRange = ranges[dim]; bestIdx = bi; bestDim = dim; }
    });
    if (bestIdx < 0) break;
    const box = boxes[bestIdx];
    box.sort((a, b) => colors[a][bestDim] - colors[b][bestDim]);
    const mid = Math.floor(box.length / 2);
    boxes[bestIdx] = box.slice(0, mid);
    boxes.push(box.slice(mid));
  }

  return boxes.map((box) => boxAvg(box));
}

/* ---------------- LZW 压缩 ---------------- */

/** 导出用于往返自测 */
export function encodeLZW(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;

  // 字典：key = prefix * 4096 + k（GIF 最多 4096 个码）
  const dict = new Map<number, number>();
  const resetDict = () => {
    dict.clear();
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  };
  resetDict();

  const bitBuf: number[] = [];
  let cur = 0, curBits = 0;
  const pushCode = (code: number, size: number) => {
    cur |= code << curBits;
    curBits += size;
    while (curBits >= 8) {
      bitBuf.push(cur & 255);
      cur >>= 8;
      curBits -= 8;
    }
  };

  pushCode(clearCode, codeSize);
  let prefix = indices[0];
  const keyOf = (p: number, k: number) => p * 4096 + k;

  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = keyOf(prefix, k);
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
    } else {
      pushCode(prefix, codeSize);
      if (nextCode < 4096) {
        dict.set(key, nextCode);
        nextCode++;
        // GIF 约定：nextCode 越过当前码宽上限时增宽（与解码端 dict.length 达 2^codeSize 对齐）
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        // 字典满：发 clear 重置
        pushCode(clearCode, codeSize);
        resetDict();
      }
      prefix = k;
    }
  }
  pushCode(prefix, codeSize);
  pushCode(endCode, codeSize);
  if (curBits > 0) bitBuf.push(cur & 255);

  return Uint8Array.from(bitBuf);
}

/** LZW 解码（仅用于自测验证） */
export function decodeLZW(data: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let bitPos = 0;
  const readCode = () => {
    let c = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = data[bitPos >> 3];
      if (byte === undefined) throw new Error("LZW EOF");
      c |= ((byte >> (bitPos & 7)) & 1) << i;
      bitPos++;
    }
    return c;
  };
  let dict: number[][] = [];
  const initDict = () => {
    dict = [];
    for (let i = 0; i < clearCode; i++) dict.push([i]);
    dict.push([]); // clear（占位）
    dict.push([]); // end（占位）
  };
  initDict();
  const result: number[] = [];
  let prev: number[] | null = null;
  let guard = 0;
  while (true) {
    if (++guard > 5000000) throw new Error("LZW 循环超限");
    const code = readCode();
    if (code === clearCode) { initDict(); codeSize = minCodeSize + 1; prev = null; continue; }
    if (code === endCode) break;
    let entry: number[];
    if (code < dict.length) entry = dict[code];
    else if (code === dict.length && prev) entry = [...prev, prev[0]];
    else throw new Error(`bad code ${code} dictLen=${dict.length}`);
    for (const v of entry) result.push(v);
    if (prev) {
      if (dict.length < 4096) {
        dict.push([...prev, entry[0]]);
        if (dict.length === (1 << codeSize) && codeSize < 12) codeSize++;
      }
    }
    prev = entry;
  }
  return result;
}

/* ---------------- GIF 组装 ---------------- */

/** 编码为 GIF89a Buffer */
export function encodeGif(frames: GifFrameInput[]): Buffer {
  if (!frames.length) throw new Error("至少需要 1 帧");
  const w = frames[0].width;
  const h = frames[0].height;
  const chunks: Buffer[] = [];

  chunks.push(Buffer.from("GIF89a", "ascii"));
  // Logical Screen Descriptor
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(w, 0);
  lsd.writeUInt16LE(h, 2);
  lsd[4] = 0x87; // 全局色表标志 + 色表大小 2^8（256 色）
  lsd[5] = 0;    // 背景色
  lsd[6] = 0;    // 像素纵横比
  chunks.push(lsd);
  // 全局色表（8 位 → 256 色）
  const globalPalette = Buffer.alloc(256 * 3);
  for (let i = 0; i < 256; i++) globalPalette[i * 3] = globalPalette[i * 3 + 1] = globalPalette[i * 3 + 2] = i;
  chunks.push(globalPalette);

  frames.forEach((frame) => {
    // Graphic Control Extension：21 F9 04 [packed] [delayLo] [delayHi] [transparent] 00
    const gce = Buffer.from([0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0xff, 0x00]);
    const delay = Math.max(0, Math.min(65535, Math.round((frame.delayMs ?? 100) / 10)));
    gce.writeUInt16LE(delay, 4);
    chunks.push(gce);

    // 量化
    const { palette, indices } = quantize(frame.rgba, w, h, 255, 255);
    // Image Descriptor
    const id = Buffer.alloc(10);
    id[0] = 0x2c;
    id.writeUInt16LE(0, 1); // left
    id.writeUInt16LE(0, 3); // top
    id.writeUInt16LE(w, 5);
    id.writeUInt16LE(h, 7);
    id[9] = 0x80 | 0x07; // 局部色表 + 256 色
    chunks.push(id);
    // Local Color Table（256 色，不足补黑）
    const lct = Buffer.alloc(256 * 3);
    for (let i = 0; i < 256; i++) {
      if (i < palette.length) {
        lct[i * 3] = palette[i][0];
        lct[i * 3 + 1] = palette[i][1];
        lct[i * 3 + 2] = palette[i][2];
      }
    }
    chunks.push(lct);
    // 图像数据
    const minCodeSize = 8;
    chunks.push(Buffer.from([minCodeSize]));
    const compressed = encodeLZW(indices, minCodeSize);
    for (let i = 0; i < compressed.length; i += 255) {
      const sub = compressed.subarray(i, i + 255);
      const header = Buffer.from([sub.length]);
      chunks.push(header, Buffer.from(sub));
    }
    chunks.push(Buffer.from([0x00]));
  });

  chunks.push(Buffer.from([0x3b])); // Trailer
  return Buffer.concat(chunks);
}
