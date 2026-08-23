/**
 * Spine MCP Server — Web GUI 服务器
 * Node 内置 http：静态服务 + /api/* 复用 55 个 MCP 工具。
 * 用法：node webgui/server.js [端口]（默认 3000）
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PREVIEW_DIR = path.join(PUBLIC_DIR, 'preview');
const PORT = parseInt(process.argv[2] || process.env.WEBGUI_PORT || '3000', 10);

let toolRegistry = null;
function getTools() {
  if (!toolRegistry) {
    const registry = path.join(ROOT, 'dist', 'tools', 'registry.js');
    if (!fs.existsSync(registry)) throw new Error('未找到 dist/tools/registry.js，请先 npm run build');
    toolRegistry = require(registry);
  }
  return toolRegistry;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------------- 动态文件服务（拆分部件等输出目录） ----------------
const servedDirs = new Map(); // key -> absDir
let serveSeq = 0;

function registerServedDir(dir) {
  if (!dir || typeof dir !== 'string' || !fs.existsSync(dir)) return null;
  for (const [k, v] of servedDirs) {
    if (path.resolve(v) === path.resolve(dir)) return k;
  }
  const key = 'out' + (++serveSeq);
  servedDirs.set(key, path.resolve(dir));
  return key;
}

function serveFile(req, res, urlPath) {
  // /files/<key>/<rel>
  const m = urlPath.match(/^\/files\/([^/]+)\/(.+)$/);
  if (!m) return false;
  const dir = servedDirs.get(m[1]);
  if (!dir) {
    res.writeHead(404).end('Not Found');
    return true;
  }
  const rel = decodeURIComponent(m[2]);
  const file = path.join(dir, rel);
  if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('Not Found');
    return true;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
  return true;
}

// ---------------- 静态文件 ----------------
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel.includes('..')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  const file = path.join(PUBLIC_DIR, rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('Not Found');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// ---------------- API ----------------
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/** 把工具返回中的本地路径映射为可访问 URL（若在 public 可服务目录内） */
function mapFileUrls(data, baseDir) {
  // 对返回对象做浅层映射：找出 string 型路径字段
  const walk = (obj, key) => {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string' && /^[A-Za-z]:[\\/]/.test(v) && fs.existsSync(v)) {
        // 仅映射到 preview/ 与 webgui 可访问目录（安全：不暴露任意盘符）
        const rel = path.relative(PUBLIC_DIR, v);
        if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
          obj[k] = '/preview/' + rel.split(path.sep).join('/');
        }
      } else if (Array.isArray(v) || (v && typeof v === 'object')) {
        walk(v, k);
      }
    }
  };
  walk(data, '');
  return data;
}

async function handleApi(req, res, url) {
  const seg = url.pathname.split('/').filter(Boolean); // e.g. ["api","status"]
  try {
    if (seg[0] !== 'api') return false;
    const action = seg[1];

    if (req.method === 'GET' && action === 'status') {
      let toolCount = 0;
      let spineExe = '';
      let serverOk = true;
      try {
        const tools = getTools();
        toolCount = tools.allTools.length;
      } catch (e) {
        serverOk = false;
      }
      const cfg = require(path.join(ROOT, 'dist', 'config-manager.js'));
      sendJson(res, 200, { ok: true, server: 'running', toolCount, spineExe: cfg.getSpineExe ? cfg.getSpineExe() : '', serverOk });
      return true;
    }

    if (req.method === 'GET' && action === 'projects') {
      const dir = url.searchParams.get('dir') || '';
      if (!dir || !fs.existsSync(dir)) {
        sendJson(res, 200, { ok: false, error: `目录不存在：${dir}`, projects: [] });
        return true;
      }
      const scanner = require(path.join(ROOT, 'dist', 'spine', 'asset-scanner.js'));
      const projects = scanner.scanSpineProjects(dir, { recursive: true, limit: 300 });
      sendJson(res, 200, { ok: true, projects });
      return true;
    }

    if (req.method === 'GET' && action === 'preview') {
      // 渲染预览：GET /api/preview?project=...&animation=...&time=...
      const project = url.searchParams.get('project') || '';
      const animation = url.searchParams.get('animation') || '';
      const time = parseFloat(url.searchParams.get('time') || '0');
      const name = url.searchParams.get('name') || 'frame';
      if (!fs.existsSync(project)) {
        sendJson(res, 200, { ok: false, error: `项目不存在：${project}` });
        return true;
      }
      const { exportProject } = require(path.join(ROOT, 'dist', 'spine', 'export-service.js'));
      const { createTempDir, ensureDir, removeDir } = require(path.join(ROOT, 'dist', 'utils', 'file-utils.js'));
      const { renderFrame } = require(path.join(ROOT, 'dist', 'spine', 'render-service.js'));
      const temp = createTempDir('webgui-');
      try {
        const out = path.join(temp, 'e');
        ensureDir(out);
        const files = await exportProject(project, out, { format: 'json' });
        const json = files.find((f) => f.endsWith('.json'));
        // 定位 atlas：递归搜索项目目录（优先 export 子目录），匹配骨架名/项目名
        const base = path.dirname(project);
        const nameBase = path.basename(project).replace(/\.spine$/i, '');
        const bare = nameBase.replace(/-(pro|ess|skeleton)$/i, '');
        const atlasCandidates = [];
        const dirs = [path.join(base, 'export'), base];
        for (const dir of dirs) {
          if (!fs.existsSync(dir)) continue;
          for (const f of fs.readdirSync(dir)) {
            if (f.endsWith('.atlas')) atlasCandidates.push(path.join(dir, f));
          }
        }
        const score = (p) => {
          const b = path.basename(p).replace(/\.atlas$/i, '').toLowerCase();
          if (b === nameBase.toLowerCase()) return 100;
          if (b === bare.toLowerCase()) return 90;
          if (nameBase.toLowerCase().includes(b) || b.includes(nameBase.toLowerCase())) return 50;
          return 1;
        };
        atlasCandidates.sort((a, b) => score(b) - score(a));
        const atlas = atlasCandidates[0];
        const png = atlas ? atlas.replace(/\.atlas$/i, '.png') : '';
        if (!atlas || !fs.existsSync(png)) {
          sendJson(res, 200, { ok: false, error: '未找到该项目的 atlas/png（需先导出过图片）。可直接传 atlasPath/imagePath 渲染。', hasAtlas: false });
          return true;
        }
        const outFile = path.join(PREVIEW_DIR, `${name}.png`);
        ensureDir(PREVIEW_DIR);
        const r = await renderFrame(json, atlas, png, outFile, { animationName: animation, time, width: 512, height: 512 });
        sendJson(res, 200, { ok: true, image: '/preview/' + name + '.png', width: r.width, height: r.height, animation: r.animationName, time: r.time, slots: r.slots });
        return true;
      } finally {
        removeDir(temp);
      }
    }

    if (req.method === 'POST' && action === 'tool') {
      const body = await readBody(req);
      const { name, args } = body;
      const tools = getTools();
      const tool = tools.allTools.find((t) => t.name === name);
      if (!tool) {
        sendJson(res, 200, { ok: false, error: `未知工具：${name}`, errorCode: 'E_INVALID_ARGUMENT' });
        return true;
      }
      const result = await tool.execute(args || {});
      // 映射拆分/导出输出文件为可访问 URL
      const plain = JSON.parse(JSON.stringify(result));
      if (plain && plain.data && plain.data.outputDir) {
        const key = registerServedDir(plain.data.outputDir);
        if (key && Array.isArray(plain.data.parts)) {
          for (const p of plain.data.parts) {
            if (p && p.file && fs.existsSync(p.file)) {
              p.url = '/files/' + key + '/' + path.basename(p.file);
            }
          }
        }
      }
      sendJson(res, 200, { ok: true, result: plain });
      return true;
    }

    if (req.method === 'POST' && action === 'export-copy') {
      // 把源 .spine + 同目录 export/*.atlas/png 复制到目标 Cocos 目录
      const body = await readBody(req);
      const { source, target } = body;
      if (!source || !fs.existsSync(source)) {
        sendJson(res, 200, { ok: false, error: `源项目不存在：${source}` });
        return true;
      }
      if (!target || !fs.existsSync(target)) {
        sendJson(res, 200, { ok: false, error: `目标目录不存在：${target}` });
        return true;
      }
      const copied = [];
      const base = path.dirname(source);
      const nameBase = path.basename(source).replace(/\.spine$/i, '');
      const bare = nameBase.replace(/-(pro|ess|skeleton)$/i, '');
      const candidates = [source];
      // 同目录 + export 子目录下的 atlas/png（匹配项目名或去掉后缀的基础名）
      for (const dir of [base, path.join(base, 'export')]) {
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
          if (!(f.endsWith('.atlas') || f.endsWith('.png'))) continue;
          const b = f.replace(/\.(atlas|png)$/i, '').toLowerCase();
          if (b === nameBase.toLowerCase() || b === bare.toLowerCase()) {
            candidates.push(path.join(dir, f));
          }
        }
      }
      for (const c of candidates) {
        const dest = path.join(target, path.basename(c));
        fs.copyFileSync(c, dest);
        copied.push(path.basename(c));
      }
      sendJson(res, 200, { ok: true, copied: copied.length, files: copied, target });
      return true;
    }

    if (req.method === 'GET' && action === 'tools') {
      const tools = getTools();
      sendJson(res, 200, { ok: true, tools: tools.allTools.map((t) => ({ name: t.name, description: t.description })) });
      return true;
    }

    if (req.method === 'GET' && action === 'info') {
      const project = url.searchParams.get('project') || '';
      const tools = getTools();
      const tool = tools.allTools.find((t) => t.name === 'spine_get_project_info');
      const r = await tool.execute({ projectPath: project });
      sendJson(res, 200, { ok: true, result: r });
      return true;
    }

    return false;
  } catch (e) {
    sendJson(res, 200, { ok: false, error: e && e.message ? e.message : String(e) });
    return true;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (serveFile(req, res, url.pathname)) return;
    const handled = await handleApi(req, res, url);
    if (!handled) serveStatic(req, res, url.pathname);
  } catch (e) {
    sendJson(res, 500, { ok: false, error: String(e) });
  }
});

server.listen(PORT, () => {
  console.log(`Spine MCP Web GUI 已启动: http://localhost:${PORT}`);
  console.log(`静态目录: ${PUBLIC_DIR}`);
});

// 端口占用等启动错误友好提示（避免 Unhandled 'error' 崩溃）
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用。请换端口启动：node webgui/server.js <端口>`);
    console.error(`例如：node webgui/server.js 3100`);
    process.exit(1);
  }
  console.error(`Web GUI 服务器启动失败：${err && err.message ? err.message : String(err)}`);
  process.exit(1);
});
