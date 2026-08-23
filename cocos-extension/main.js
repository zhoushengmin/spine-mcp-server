/**
 * Spine MCP Server — Cocos Creator 扩展主进程
 * 职责：
 *  - 桥接面板与 MCP 工具（直接 require dist 调用，无需额外协议层）
 *  - 管理 MCP stdio 子进程的启动/停止/状态
 *  - 配置持久化（SPINE_EXE / serverPath / 工作区）
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_CONFIG = {
  serverPath: 'D:/cocos/spine-mcp-server',
  spineExe: 'D:/cocos/SpinePro3.8.75/Spine.com',
  workspace: '',
  logLevel: 'info',
};

let mcpProcess = null;
let mcpStatus = 'stopped'; // stopped | starting | running | error

// ---------------- 配置 ----------------
// ⚠️ Editor.Profile.getConfig/setConfig 为 async（返回 Promise），必须 await；
//    第一个参数必须是扩展名 packageJSON.name（spine-mcp-panel）。
async function loadConfig() {
  const cfg = { ...DEFAULT_CONFIG };
  try {
    const saved = (await Editor.Profile.getConfig('spine-mcp-panel', 'config')) || {};
    Object.assign(cfg, saved);
  } catch (e) {
    // 容错
  }
  // 环境变量仅作兜底：用户未保存非空 spineExe 时使用
  // （避免系统 SPINE_EXE 环境变量覆盖面板手动选择的路径）
  if (!cfg.spineExe && process.env.SPINE_EXE) cfg.spineExe = process.env.SPINE_EXE;
  return cfg;
}

async function saveConfig(cfg) {
  await Editor.Profile.setConfig('spine-mcp-panel', 'config', cfg);
}

function resolveServerPath(serverPath) {
  const p = serverPath || DEFAULT_CONFIG.serverPath;
  return path.resolve(p);
}

function resolveSpineExe(spineExe) {
  const exe = spineExe || DEFAULT_CONFIG.spineExe;
  if (fs.existsSync(exe)) return exe;
  return null;
}

/**
 * 解析 Node 可执行文件。
 * ⚠️ 不能用 process.execPath：Cocos 扩展主进程运行在 Electron 里，
 * process.execPath 指向 Cocos Creator 的可执行文件（Electron），
 * 用它启动 MCP 脚本会输出大量 "Load profile failed" 且服务无法正确运行。
 * 优先 SPINE_MCP_NODE 环境变量，否则用 PATH 中的 node。
 */
function resolveNode() {
  if (process.env.SPINE_MCP_NODE && fs.existsSync(process.env.SPINE_MCP_NODE)) {
    return process.env.SPINE_MCP_NODE;
  }
  return 'node';
}

// ---------------- MCP stdio 客户端（用于回退调用，避免本进程加载 sharp） ----------------
// Cocos 扩展主进程运行在 Electron 中，无法加载用系统 Node 编译的 sharp 原生模块；
// 因此执行工具时优先本地 require（某些环境可用），失败则回退到 MCP 子进程（系统 node 运行，sharp 正常）。
let mcpBuf = '';
let mcpReqSeq = 1;
const mcpPending = new Map(); // id -> { resolve, reject, timer }

function handleMcpData(chunk) {
  mcpBuf += chunk.toString();
  let idx;
  while ((idx = mcpBuf.indexOf('\n')) >= 0) {
    const line = mcpBuf.slice(0, idx).trim();
    mcpBuf = mcpBuf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg && msg.id != null && mcpPending.has(msg.id)) {
        const { resolve, reject, timer } = mcpPending.get(msg.id);
        mcpPending.delete(msg.id);
        clearTimeout(timer);
        if (msg.error) reject(new Error(msg.error.message || 'MCP 错误'));
        else resolve(msg.result);
      }
    } catch (e) {
      // 忽略非 JSON 行
    }
  }
}

function mcpRequest(method, params) {
  return new Promise((resolve, reject) => {
    if (!mcpProcess || !mcpProcess.stdin || mcpProcess.stdin.destroyed) {
      reject(new Error('MCP 服务未运行'));
      return;
    }
    const id = mcpReqSeq++;
    const timer = setTimeout(() => { mcpPending.delete(id); reject(new Error('MCP 请求超时')); }, 120000);
    mcpPending.set(id, { resolve, reject, timer });
    mcpProcess.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function initMcpClient() {
  if (!mcpProcess) return;
  mcpProcess.stdout.on('data', handleMcpData);
  mcpRequest('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'spine-mcp-panel', version: '1.0.0' } })
    .then(() => {
      mcpProcess.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
    })
    .catch((e) => console.error('[spine-mcp] MCP initialize 失败:', e.message));
}

/** 通过 MCP 子进程调用工具（还原工具 execute 结果对象） */
async function runToolViaMcp(toolName, args) {
  if (!mcpProcess || mcpProcess.exitCode !== null) {
    const r = await startServer();
    if (!r.ok) return { ok: false, error: r.error || 'MCP 服务启动失败' };
  }
  try {
    const resp = await mcpRequest('tools/call', { name: toolName, arguments: args || {} });
    const text = resp && resp.content && resp.content[0] && resp.content[0].text;
    if (text == null) return { ok: true, result: { success: false, message: '工具无返回结果' } };
    if (resp && resp.isError) return { ok: true, result: { success: false, message: text } };
    // server 端 text = message + "\n" + JSON.stringify(data)
    const nl = text.indexOf('\n');
    if (nl < 0) return { ok: true, result: { success: true, message: text } };
    const message = text.slice(0, nl);
    const rest = text.slice(nl + 1).replace(/\n建议：[\s\S]*$/, '').replace(/\n⚠️[\s\S]*$/, '').trim();
    let data = null;
    try { data = JSON.parse(rest); } catch (e) { data = rest; }
    return { ok: true, result: { success: true, message, data } };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

// ---------------- 服务生命周期 ----------------
async function startServer() {
  if (mcpProcess) return { ok: true, status: 'running' };
  const cfg = await loadConfig();
  const serverPath = resolveServerPath(cfg.serverPath);
  const entry = path.join(serverPath, 'dist', 'index.js');
  if (!fs.existsSync(entry)) {
    mcpStatus = 'error';
    return { ok: false, error: `未找到 MCP 入口：${entry}。请确认 serverPath 配置正确。` };
  }
  mcpStatus = 'starting';
  try {
    const env = { ...process.env, SPINE_EXE: cfg.spineExe, SPINE_MCP_LOG_LEVEL: cfg.logLevel };
    mcpProcess = spawn(resolveNode(), [entry, 'mcp'], {
      cwd: serverPath,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    mcpProcess.on('exit', () => {
      mcpProcess = null;
      mcpStatus = 'stopped';
    });
    mcpProcess.stderr.on('data', (d) => {
      const text = d.toString();
      // 过滤已知无害警告（Spine CLI / 渲染库），避免污染控制台
      if (/libpng warning|Load profile failed|Welcome data download failed|WARNING: Welcome/i.test(text)) return;
      console.error('[spine-mcp]', text.trim());
    });
    initMcpClient();
    mcpStatus = 'running';
    return { ok: true, status: 'running', pid: mcpProcess.pid };
  } catch (e) {
    mcpStatus = 'error';
    return { ok: false, error: String(e) };
  }
}

function stopServer() {
  if (mcpProcess) {
    try { mcpProcess.kill(); } catch (e) {}
    mcpProcess = null;
  }
  mcpStatus = 'stopped';
  return { ok: true, status: 'stopped' };
}

// ---------------- 工具调用（面板桥接） ----------------
function requireTools(serverPath) {
  const registry = path.join(serverPath, 'dist', 'tools', 'registry.js');
  if (!fs.existsSync(registry)) {
    throw new Error(`未找到工具注册表：${registry}。请确认 serverPath 配置正确且已 npm run build。`);
  }
  return require(registry);
}

async function runTool(toolName, args) {
  const cfg = await loadConfig();
  const serverPath = resolveServerPath(cfg.serverPath);
  let tools;
  try {
    tools = requireTools(serverPath);
  } catch (e) {
    // 本进程加载失败（sharp ABI 不匹配等）→ 回退 MCP 子进程（系统 node 运行）
    console.error('[spine-mcp] 本进程加载工具失败，回退 MCP 子进程:', e.message);
    return runToolViaMcp(toolName, args);
  }
  const tool = tools.allTools.find((t) => t.name === toolName);
  if (!tool) {
    return { ok: false, error: `未知工具：${toolName}`, errorCode: 'E_INVALID_ARGUMENT' };
  }
  try {
    const result = await tool.execute(args || {});
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

// ---------------- 扫描 ----------------
async function listProjects(workspace) {
  const dir = workspace || (await loadConfig()).workspace;
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, error: `工作区不存在：${dir}`, projects: [] };
  }
  const scanner = require(path.join(resolveServerPath((await loadConfig()).serverPath), 'dist', 'spine', 'asset-scanner.js'));
  try {
    return { ok: true, projects: scanner.scanSpineProjects(dir, { recursive: true, limit: 300 }) };
  } catch (e) {
    return { ok: false, error: String(e), projects: [] };
  }
}

// ---------------- 扩展生命周期 ----------------
function load() {}

function unload() {
  stopServer();
}

// ---------------- 消息方法 ----------------
const methods = {
  'open-panel': () => {
    Editor.Panel.open('spine-mcp-panel');
  },
  'spine:start': async () => startServer(),
  'spine:stop': async () => stopServer(),
  'spine:status': async () => ({ status: mcpStatus, pid: mcpProcess ? mcpProcess.pid : null }),
  'spine:get-config': async () => {
    const cfg = await loadConfig();
    return { ok: true, config: cfg, spineExeExists: !!resolveSpineExe(cfg.spineExe) };
  },
  'spine:set-config': async (cfg) => {
    const merged = { ...(await loadConfig()), ...(cfg || {}) };
    await saveConfig(merged);
    return { ok: true, config: merged };
  },
  'spine:list-projects': async (workspace) => listProjects(workspace),
  'spine:get-info': async (projectPath) => runTool('spine_get_project_info', { projectPath }),
  'spine:run-tool': async ({ tool, args }) => runTool(tool, args),
  'spine:list-tools': async () => {
    try {
      // 用 constants.js（不依赖 sharp）列出工具名，避免本进程加载 sharp 失败
      const consts = require(path.join(resolveServerPath((await loadConfig()).serverPath), 'dist', 'constants.js'));
      const names = Object.values(consts.TOOL_NAMES || {});
      return { ok: true, tools: names.map((n) => ({ name: n, description: '' })) };
    } catch (e) {
      return { ok: false, error: String(e), tools: [] };
    }
  },
  'spine:get-cli-config': async () => {
    // 生成 AI 客户端配置片段
    const cfg = await loadConfig();
    const serverPath = resolveServerPath(cfg.serverPath);
    return {
      ok: true,
      config: {
        mcpServers: {
          'spine-mcp': {
            command: 'node',
            args: [path.join(serverPath, 'dist', 'index.js'), 'mcp'],
            env: { SPINE_EXE: cfg.spineExe },
          },
        },
      },
    };
  },
};

module.exports = { load, unload, methods };
