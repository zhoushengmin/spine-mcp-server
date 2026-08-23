/**
 * Atlas 解析工具：解析 Spine .atlas 文本格式，提供 region 提取。
 * Spine 3.8 .atlas 文本格式：
 *   <页名>
 *   size: W,H
 *   format: RGBA8888
 *   filter: ...
 *   repeat: none
 *   <region名>
 *   rotate: true|false
 *   xy: X,Y
 *   size: W,H
 *   orig: OW,OH
 *   offset: OX,OY
 *   index: N
 */
export interface AtlasPage {
  name: string;
  size: { w: number; h: number };
  format?: string;
  filter?: string;
  repeat?: string;
}

export interface AtlasRegion {
  name: string;
  page: number;
  rotate: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  origWidth: number;
  origHeight: number;
  offsetX: number;
  offsetY: number;
  index: number;
}

export interface ParsedAtlas {
  pages: AtlasPage[];
  regions: AtlasRegion[];
  raw: string;
}

/** 解析 .atlas 文本 */
export function parseAtlas(text: string): ParsedAtlas {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const pages: AtlasPage[] = [];
  const regions: AtlasRegion[] = [];
  let currentPage: AtlasPage | null = null;
  let currentRegion: Partial<AtlasRegion> | null = null;
  let index = 0;

  const flushRegion = () => {
    if (currentRegion && currentRegion.name) {
      currentRegion.page = pages.length - 1;
      currentRegion.index = currentRegion.index ?? index++;
      regions.push(currentRegion as AtlasRegion);
    }
    currentRegion = null;
  };

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("size:")) {
      const [w, h] = line.slice(5).split(",").map((s) => parseFloat(s));
      if (currentRegion) {
        currentRegion.width = w;
        currentRegion.height = h;
      } else if (currentPage) {
        currentPage.size = { w, h };
      }
      continue;
    }
    if (line.startsWith("format:")) {
      if (currentPage) currentPage.format = line.slice(7).trim();
      continue;
    }
    if (line.startsWith("filter:")) {
      if (currentPage) currentPage.filter = line.slice(7).trim();
      continue;
    }
    if (line.startsWith("repeat:")) {
      if (currentPage) currentPage.repeat = line.slice(7).trim();
      continue;
    }
    if (line.startsWith("rotate:")) {
      if (currentRegion) currentRegion.rotate = line.slice(7).trim() === "true";
      continue;
    }
    if (line.startsWith("xy:")) {
      const [x, y] = line.slice(3).split(",").map((s) => parseInt(s));
      if (currentRegion) {
        currentRegion.x = x;
        currentRegion.y = y;
      }
      continue;
    }
    if (line.startsWith("orig:")) {
      const [w, h] = line.slice(5).split(",").map((s) => parseInt(s));
      if (currentRegion) {
        currentRegion.origWidth = w;
        currentRegion.origHeight = h;
      }
      continue;
    }
    if (line.startsWith("offset:")) {
      const [x, y] = line.slice(7).split(",").map((s) => parseInt(s));
      if (currentRegion) {
        currentRegion.offsetX = x;
        currentRegion.offsetY = y;
      }
      continue;
    }
    if (line.startsWith("index:")) {
      if (currentRegion) currentRegion.index = parseInt(line.slice(6));
      continue;
    }
    // 无前缀裸行：页面名（首个）或 region 名（后续）——当前 region 需先 flush
    if (!currentPage) {
      currentPage = { name: line, size: { w: 0, h: 0 } };
      pages.push(currentPage);
    } else {
      flushRegion();
      currentRegion = { name: line, page: 0, rotate: false, x: 0, y: 0, width: 0, height: 0, origWidth: 0, origHeight: 0, offsetX: 0, offsetY: 0, index: 0 };
    }
  }
  flushRegion();
  return { pages, regions, raw: text };
}

/** 查找 region（支持 文件名路径 与 region 名匹配） */
export function findRegion(atlas: ParsedAtlas, name: string): AtlasRegion | undefined {
  const base = name.replace(/\\/g, "/");
  const fileName = base.split("/").pop();
  return atlas.regions.find((r) => r.name === name || r.name === fileName || r.name === base);
}
