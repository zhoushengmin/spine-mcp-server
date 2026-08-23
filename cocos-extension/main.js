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
function loadConfig() {
  const cfg = { ...DEFAULT_CONFIG };
  try {
    const saved = Editor.Profile.getConfig('spine-mcp', 'config') || {};
    Object.assign(cfg, saved);
  } catch (e) {
    // 容错
  }
  // 环境变量优先
  if (process.env.SPINE_EXE) cfg.spineExe = process.env.SPINE_EXE;
  return cfg;
}

function saveConfig(cfg) {
  Editor.Profile.setConfig('spine-mcp', 'config', cfg);
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

// ---------------- 服务生命周期 ----------------
function startServer() {
  if (mcpProcess) return { ok: true, status: 'running' };
  const cfg = loadConfig();
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
  const cfg = loadConfig();
  const serverPath = resolveServerPath(cfg.serverPath);
  const tools = requireTools(serverPath);
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
function listProjects(workspace) {
  const dir = workspace || loadConfig().workspace;
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, error: `工作区不存在：${dir}`, projects: [] };
  }
  const scanner = require(path.join(resolveServerPath(loadConfig().serverPath), 'dist', 'spine', 'asset-scanner.js'));
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
    const cfg = loadConfig();
    return { ok: true, config: cfg, spineExeExists: !!resolveSpineExe(cfg.spineExe) };
  },
  'spine:set-config': async (cfg) => {
    const merged = { ...loadConfig(), ...(cfg || {}) };
    saveConfig(merged);
    return { ok: true, config: merged };
  },
  'spine:list-projects': async (workspace) => listProjects(workspace),
  'spine:get-info': async (projectPath) => runTool('spine_get_project_info', { projectPath }),
  'spine:run-tool': async ({ tool, args }) => runTool(tool, args),
  'spine:list-tools': async () => {
    try {
      const serverPath = resolveServerPath(loadConfig().serverPath);
      const tools = requireTools(serverPath);
      return { ok: true, tools: tools.allTools.map((t) => ({ name: t.name, description: t.description })) };
    } catch (e) {
      return { ok: false, error: String(e), tools: [] };
    }
  },
  'spine:get-cli-config': async () => {
    // 生成 AI 客户端配置片段
    const cfg = loadConfig();
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
