/**
 * Spine MCP Server — Cocos Creator 扩展面板
 * Cocos 3.8 面板（Editor.Panel.define）：
 *  - 纯 HTML/CSS/JS，不依赖 Vue 编译，保证所有版本兼容
 *  - 深色高对比设计，暗色/亮色主题下文字均清晰可读
 */
'use strict';

/** 复制文本到剪贴板：navigator.clipboard → Editor.Clipboard → execCommand 兜底 */
async function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof Editor !== 'undefined' && Editor.Clipboard && typeof Editor.Clipboard.write === 'function') {
    await Editor.Clipboard.write(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
  if (!ok) throw new Error('execCommand copy failed');
}

const template = `
<div id="sm-root" class="sm-root">
  <!-- 顶部状态栏 -->
  <header class="sm-header">
    <div class="sm-title">
      <span class="sm-logo">🦴</span>
      <span>Spine MCP Server</span>
      <span class="sm-version">v1.0.0</span>
    </div>
    <div class="sm-status-row">
      <span id="sm-dot" class="sm-dot"></span>
      <span id="sm-status" class="sm-status-text">未知</span>
      <button id="sm-btn-start" class="sm-btn sm-btn-primary">启动服务</button>
      <button id="sm-btn-stop" class="sm-btn">停止服务</button>
    </div>
  </header>

  <!-- 配置进度 -->
  <section class="sm-guide">
    <div class="sm-guide-steps">
      <div class="sm-step"><span id="sm-g1" class="sm-step-ic">①</span>配置 Spine 路径</div>
      <div class="sm-step"><span id="sm-g2" class="sm-step-ic">②</span>启动服务</div>
      <div class="sm-step"><span id="sm-g3" class="sm-step-ic">③</span>复制配置到 AI</div>
    </div>
  </section>

  <!-- 基本配置 -->
  <section class="sm-section">
    <div class="sm-section-title">⚙️ 基本配置</div>
    <div class="sm-field">
      <label>Spine 路径</label>
      <input id="sm-spine" class="sm-input" placeholder="D:/cocos/SpinePro3.8.75/Spine.com" />
      <button id="sm-browse-spine" class="sm-btn">浏览</button>
    </div>
    <div class="sm-field">
      <label>Server 路径</label>
      <input id="sm-server" class="sm-input" placeholder="D:/cocos/spine-mcp-server" />
      <button id="sm-browse-server" class="sm-btn">浏览</button>
    </div>
    <div class="sm-field">
      <label>工作区</label>
      <input id="sm-workspace" class="sm-input" placeholder="扫描 .spine 的目录（如 Cocos 项目 assets）" />
      <button id="sm-browse-ws" class="sm-btn">浏览</button>
    </div>
    <div class="sm-field">
      <span id="sm-spine-warn" class="sm-warn" style="display:none">⚠️ Spine.exe 不存在，请检查路径</span>
    </div>
    <div class="sm-field">
      <button id="sm-save" class="sm-btn sm-btn-primary">保存配置</button>
      <button id="sm-scan" class="sm-btn">刷新项目</button>
    </div>
  </section>

  <!-- AI 客户端配置 -->
  <section class="sm-section">
    <div class="sm-section-title">🤖 AI 客户端配置</div>
    <textarea id="sm-ai-config" class="sm-json" rows="6" readonly></textarea>
    <div class="sm-row">
      <button id="sm-copy-config" class="sm-btn sm-btn-primary">一键复制</button>
    </div>
  </section>

  <!-- 项目列表 -->
  <section class="sm-section">
    <div class="sm-section-title">📦 Spine 项目 <span id="sm-proj-count" class="sm-count"></span></div>
    <div id="sm-projects" class="sm-project-list"></div>
    <div class="sm-field" style="margin-top:6px">
      <label>选中</label>
      <input id="sm-selected" class="sm-input" readonly placeholder="点击上方项目" />
      <button id="sm-info" class="sm-btn">查看信息</button>
    </div>
  </section>

  <!-- 快速工具 -->
  <section class="sm-section">
    <div class="sm-section-title">🔧 快速工具</div>
    <div class="sm-field">
      <label>工具</label>
      <select id="sm-tool" class="sm-input"></select>
      <button id="sm-run" class="sm-btn sm-btn-primary">执行</button>
    </div>
  </section>

  <!-- 操作日志 -->
  <section class="sm-section">
    <div class="sm-section-title">📋 操作日志 <button id="sm-clear-log" class="sm-btn sm-btn-sm">清空</button></div>
    <div id="sm-log" class="sm-log"></div>
  </section>
</div>
`;

const style = `
.sm-root { padding: 12px 16px; font-size: 13px; color: #e8e8e8; background: #1e1e1e; display: flex; flex-direction: column; gap: 12px; overflow: auto; height: 100%; box-sizing: border-box; }
.sm-header { border-bottom: 1px solid #3a3a3a; padding-bottom: 10px; }
.sm-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: #ffffff; }
.sm-logo { font-size: 18px; }
.sm-version { color: #8a8a8a; font-size: 11px; font-weight: 400; }
.sm-status-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.sm-dot { width: 10px; height: 10px; border-radius: 50%; background: #6b6b6b; display: inline-block; flex-shrink: 0; }
.sm-dot.running { background: #4caf50; box-shadow: 0 0 6px #4caf50; }
.sm-dot.stopped { background: #6b6b6b; }
.sm-dot.error { background: #f44336; }
.sm-status-text { color: #c8c8c8; min-width: 90px; }
.sm-btn { background: #333; color: #e8e8e8; border: 1px solid #4a4a4a; border-radius: 4px; padding: 5px 12px; font-size: 12px; cursor: pointer; transition: background .15s; }
.sm-btn:hover { background: #3d3d3d; }
.sm-btn:disabled { opacity: .5; cursor: not-allowed; }
.sm-btn-primary { background: #2f6fd0; border-color: #2f6fd0; color: #fff; }
.sm-btn-primary:hover { background: #3b7be0; }
.sm-btn-sm { padding: 2px 8px; font-size: 11px; }
.sm-guide { background: #262626; border: 1px solid #3a3a3a; border-radius: 6px; padding: 10px 12px; }
.sm-guide-steps { display: flex; gap: 16px; flex-wrap: wrap; }
.sm-step { display: flex; align-items: center; gap: 6px; color: #9d9d9d; font-size: 12px; }
.sm-step-ic { font-size: 14px; }
.sm-step.done { color: #6ec96e; }
.sm-section { border: 1px solid #3a3a3a; border-radius: 6px; padding: 10px 12px; background: #232323; }
.sm-section-title { font-weight: 600; margin-bottom: 8px; color: #ffffff; display: flex; align-items: center; gap: 8px; }
.sm-count { color: #8a8a8a; font-size: 11px; font-weight: 400; }
.sm-field { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sm-field label { width: 88px; flex-shrink: 0; color: #b0b0b0; }
.sm-input { flex: 1; background: #2c2c2c; color: #e8e8e8; border: 1px solid #4a4a4a; border-radius: 4px; padding: 5px 8px; font-size: 12px; min-width: 0; }
.sm-input:focus { outline: none; border-color: #2f6fd0; }
.sm-input::placeholder { color: #6b6b6b; }
.sm-warn { color: #ffb74d; font-size: 12px; }
.sm-json { width: 100%; background: #1a1a1a; color: #9ece6a; border: 1px solid #4a4a4a; border-radius: 4px; font-family: Consolas, Menlo, monospace; font-size: 11px; resize: vertical; box-sizing: border-box; padding: 6px; }
.sm-row { display: flex; gap: 8px; margin-top: 8px; }
.sm-project-list { max-height: 180px; overflow: auto; border: 1px solid #3a3a3a; border-radius: 4px; background: #1a1a1a; }
.sm-project { padding: 6px 10px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; border-bottom: 1px solid #2a2a2a; }
.sm-project:last-child { border-bottom: none; }
.sm-project:hover { background: #2e2e2e; }
.sm-project.active { background: #1f3a5f; }
.sm-project-name { font-weight: 600; color: #e8e8e8; }
.sm-project-path { color: #8a8a8a; font-size: 11px; word-break: break-all; }
.sm-empty { color: #8a8a8a; padding: 10px; font-size: 12px; }
.sm-log { max-height: 160px; overflow: auto; background: #141414; border: 1px solid #3a3a3a; border-radius: 4px; padding: 8px; font-family: Consolas, Menlo, monospace; font-size: 11px; line-height: 1.6; }
.sm-log div { white-space: pre-wrap; word-break: break-all; }
.sm-log .info { color: #c8c8c8; }
.sm-log .warn { color: #e6c07b; }
.sm-log .error { color: #f07178; }
.sm-log .success { color: #9ece6a; }
`;

const methods = {
  // 初始化渲染（ready 中调用）
  _renderStatus() {
    const dot = this.el.querySelector('#sm-dot');
    const txt = this.el.querySelector('#sm-status');
    dot.className = 'sm-dot ' + (this._s.status || 'stopped');
    const map = { running: '运行中', stopped: '已停止', starting: '启动中', error: '异常' };
    txt.textContent = map[this._s.status] || this._s.status || '未知';
    this.el.querySelector('#sm-btn-start').disabled = this._s.status === 'running';
    this.el.querySelector('#sm-btn-stop').disabled = this._s.status !== 'running';
    const g2 = this.el.querySelector('#sm-g2');
    g2.textContent = this._s.status === 'running' ? '✅' : '②';
    g2.parentElement.classList.toggle('done', this._s.status === 'running');
  },
  _renderConfig() {
    this.el.querySelector('#sm-spine').value = this._s.config.spineExe || '';
    this.el.querySelector('#sm-server').value = this._s.config.serverPath || '';
    this.el.querySelector('#sm-workspace').value = this._s.config.workspace || '';
    const warn = this.el.querySelector('#sm-spine-warn');
    warn.style.display = this._s.spineExeExists ? 'none' : 'block';
    const g1 = this.el.querySelector('#sm-g1');
    g1.textContent = this._s.config.spineExe ? '✅' : '①';
    g1.parentElement.classList.toggle('done', !!this._s.config.spineExe);
  },
  _renderProjects() {
    const list = this.el.querySelector('#sm-projects');
    this.el.querySelector('#sm-proj-count').textContent = '(' + this._s.projects.length + ')';
    if (!this._s.projects.length) {
      list.innerHTML = '<div class="sm-empty">暂无项目，配置工作区后点击「刷新项目」</div>';
      return;
    }
    list.innerHTML = this._s.projects.map((p) => {
      const active = p.path === this._s.selectedProject ? ' active' : '';
      return `<div class="sm-project${active}" data-path="${p.path.replace(/"/g, '&quot;')}">
        <span class="sm-project-name">${p.name || '?'}</span>
        <span class="sm-project-path">${(p.path || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('.sm-project').forEach((el) => {
      el.addEventListener('click', () => {
        this._s.selectedProject = el.getAttribute('data-path');
        this.el.querySelector('#sm-selected').value = this._s.selectedProject;
        this._renderProjects();
      });
    });
    this.el.querySelector('#sm-selected').value = this._s.selectedProject || '';
  },
  _renderTools() {
    const sel = this.el.querySelector('#sm-tool');
    const tools = this._s.tools || [];
    sel.innerHTML = tools.map((t) => `<option value="${t.name}">${t.label || t.name}</option>`).join('');
    if (this._s.quickTool && tools.some((t) => t.name === this._s.quickTool)) sel.value = this._s.quickTool;
  },
  _renderAiConfig() {
    this.el.querySelector('#sm-ai-config').value = this._s.aiConfigText || '';
    const g3 = this.el.querySelector('#sm-g3');
    g3.textContent = this._s.aiConfigText ? '✅' : '③';
    g3.parentElement.classList.toggle('done', !!this._s.aiConfigText);
  },
  _pushLogDom(text, level) {
    const box = this.el.querySelector('#sm-log');
    const div = document.createElement('div');
    div.className = level || 'info';
    div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + text;
    box.appendChild(div);
    while (box.children.length > 200) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  },

  // ---------- 功能 ----------
  async refreshAll() {
    await this.loadConfig();
    await this.refreshStatus();
    await this.generateConfig();
    await this.scanProjects();
    await this.loadTools();
    this._renderConfig();
    this._renderStatus();
    this._renderProjects();
    this._renderTools();
    this._renderAiConfig();
  },
  async loadConfig() {
    try {
      const r = await Editor.Message.request('spine-mcp-panel', 'spine:get-config');
      if (r && r.ok) {
        this._s.config = r.config || {};
        this._s.spineExeExists = r.spineExeExists !== false;
        this._renderConfig();
      } else {
        this._pushLogDom('读取配置失败：' + ((r && r.error) || '未知错误'), 'error');
      }
    } catch (e) {
      console.error('[spine-mcp] get-config 异常:', e);
      this._pushLogDom('读取配置异常，请查看控制台', 'error');
    }
  },
  async saveConfig() {
    const cfg = {
      spineExe: this.el.querySelector('#sm-spine').value.trim(),
      serverPath: this.el.querySelector('#sm-server').value.trim(),
      workspace: this.el.querySelector('#sm-workspace').value.trim(),
    };
    const r = await Editor.Message.request('spine-mcp-panel', 'spine:set-config', cfg);
    if (r && r.ok) {
      this._s.config = r.config || cfg;
      this._pushLogDom('配置已保存', 'success');
      await this.loadConfig();
      await this.generateConfig();
      await this.scanProjects();
    } else {
      this._pushLogDom('保存失败：' + (r && r.error), 'error');
    }
  },
  // 兼容解析 Dialog.select 返回值（{canceled,filePaths} / 数组 / 字符串）
  _dialogPaths(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res.filter((x) => typeof x === 'string');
    if (Array.isArray(res.filePaths)) return res.filePaths;
    if (Array.isArray(res.paths)) return res.paths;
    if (typeof res.filePath === 'string') return [res.filePath];
    if (typeof res === 'string') return [res];
    return [];
  },
  // 选择对话框统一处理：返回 [paths] 或 null（null 表示取消/失败，已提示）
  async _pick(options, cancelMsg) {
    try {
      const res = await Editor.Dialog.select(options);
      if (res && res.canceled) { this._pushLogDom(cancelMsg || '已取消选择', 'warn'); return null; }
      const paths = this._dialogPaths(res);
      if (!paths.length) { this._pushLogDom('未选择任何路径，请重试', 'warn'); return null; }
      return paths;
    } catch (e) {
      // 原始错误仅输出到扩展控制台，不直接展示给用户
      console.error('[spine-mcp] Dialog.select 失败:', e);
      this._pushLogDom('打开选择对话框失败，请重试', 'error');
      return null;
    }
  },
  async browseSpine() {
    const paths = await this._pick({ title: '选择 Spine 可执行文件', type: 'file', filters: [{ name: 'Spine', extensions: ['exe', 'bat', 'com'] }] });
    if (!paths) return;
    this.el.querySelector('#sm-spine').value = paths[0];
    this._pushLogDom('已选择 Spine：' + paths[0], 'info');
    await this.saveConfig();
  },
  async browseServer() {
    const paths = await this._pick({ title: '选择 spine-mcp-server 目录', type: 'directory' });
    if (!paths) return;
    this.el.querySelector('#sm-server').value = paths[0];
    this._pushLogDom('已选择 Server：' + paths[0], 'info');
    await this.saveConfig();
  },
  async browseWorkspace() {
    const paths = await this._pick({ title: '选择工作区（扫描 .spine 的目录）', type: 'directory' });
    if (!paths) return;
    this.el.querySelector('#sm-workspace').value = paths[0];
    this._pushLogDom('已选择工作区：' + paths[0], 'info');
    await this.saveConfig();
  },
  async refreshStatus() {
    try {
      const r = await Editor.Message.request('spine-mcp-panel', 'spine:status');
      this._s.status = (r && r.status) || 'stopped';
      this._renderStatus();
    } catch (e) {
      console.error('[spine-mcp] status 异常:', e);
      this._s.status = 'error';
      this._renderStatus();
      this._pushLogDom('获取服务状态异常，请查看控制台', 'error');
    }
  },
  async startServer() {
    const r = await Editor.Message.request('spine-mcp-panel', 'spine:start');
    if (r && r.ok) {
      this._pushLogDom('MCP 服务已启动（pid ' + r.pid + '）', 'success');
    } else {
      this._pushLogDom('启动失败：' + (r && r.error), 'error');
    }
    await this.refreshStatus();
  },
  async stopServer() {
    const r = await Editor.Message.request('spine-mcp-panel', 'spine:stop');
    if (r && r.ok) this._pushLogDom('MCP 服务已停止', 'warn');
    await this.refreshStatus();
  },
  async generateConfig() {
    try {
      const r = await Editor.Message.request('spine-mcp-panel', 'spine:get-cli-config');
      if (r && r.ok && r.config) {
        this._s.aiConfigText = JSON.stringify(r.config, null, 2);
        this._renderAiConfig();
        return r.config;
      }
      this._s.aiConfigText = '';
      this._renderAiConfig();
      this._pushLogDom('生成 AI 配置失败：' + ((r && r.error) || '未知错误'), 'warn');
      return null;
    } catch (e) {
      console.error('[spine-mcp] get-cli-config 异常:', e);
      this._pushLogDom('生成 AI 配置异常，请查看控制台', 'error');
      return null;
    }
  },
  async copyConfig() {
    if (!this._s.aiConfigText) await this.generateConfig();
    const text = this._s.aiConfigText || '';
    if (!text) { this._pushLogDom('配置为空，请先保存配置后再复制', 'warn'); return; }
    try {
      await copyText(text);
      const btn = this.el.querySelector('#sm-copy-config');
      if (btn) { btn.textContent = '已复制 ✓'; setTimeout(() => { btn.textContent = '一键复制'; }, 2000); }
      this._pushLogDom('配置已复制到剪贴板', 'success');
    } catch (e) {
      console.error('[spine-mcp] 复制失败:', e);
      this._pushLogDom('复制失败，请手动选中文本框后 Ctrl+C 复制', 'warn');
    }
  },
  async scanProjects() {
    const ws = this.el.querySelector('#sm-workspace').value.trim() || (this._s.config && this._s.config.workspace);
    if (!ws) {
      this._s.projects = [];
      this._renderProjects();
      this._pushLogDom('未配置工作区，请先填写「工作区」目录并保存', 'warn');
      return;
    }
    this._pushLogDom('正在扫描：' + ws + ' ...', 'info');
    try {
      const r = await Editor.Message.request('spine-mcp-panel', 'spine:list-projects', ws);
      if (r && r.ok) {
        this._s.projects = r.projects || [];
        if (this._s.projects.length && !this._s.selectedProject) {
          this._s.selectedProject = this._s.projects[0].path;
        }
        this._pushLogDom('扫描完成：' + this._s.projects.length + ' 个项目', 'info');
      } else {
        this._s.projects = [];
        this._pushLogDom('扫描失败：' + ((r && r.error) || '未知错误'), 'error');
      }
    } catch (e) {
      this._s.projects = [];
      console.error('[spine-mcp] list-projects 异常:', e);
      this._pushLogDom('扫描异常，请查看控制台', 'error');
    }
    this._renderProjects();
  },
  async getInfo() {
    if (!this._s.selectedProject) {
      if (!this._s.projects.length) {
        this._pushLogDom('暂无项目，请先在「工作区」填写目录并点击「刷新项目」', 'warn');
      } else {
        this._pushLogDom('请先在项目列表中点击选中一个项目', 'warn');
      }
      return;
    }
    try {
      const r = await Editor.Message.request('spine-mcp-panel', 'spine:get-info', this._s.selectedProject);
      if (r && r.ok && r.result && r.result.data) {
        const d = r.result.data;
        this._pushLogDom(`[${d.skeletonName || '骨架'}] ${(d.bones || []).length} 骨骼 / ${(d.slots || []).length} 插槽 / ${(d.skins || []).length} 皮肤 / ${(d.animations || []).length} 动画`, 'success');
      } else {
        this._pushLogDom('读取信息失败：' + ((r && r.result && r.result.message) || (r && r.error) || '未知'), 'error');
      }
    } catch (e) {
      console.error('[spine-mcp] get-info 异常:', e);
      this._pushLogDom('读取信息异常，请查看控制台', 'error');
    }
  },
  async loadTools() {
    try {
      const r = await Editor.Message.request('spine-mcp-panel', 'spine:list-tools');
      if (r && r.ok) {
        this._s.tools = r.tools || [];
        this._s.quickTool = this._s.tools[0] ? this._s.tools[0].name : '';
        this._renderTools();
        if (!this._s.tools.length) this._pushLogDom('未获取到工具列表（请检查 Server 路径与 npm run build）', 'warn');
      } else {
        this._pushLogDom('加载工具失败：' + ((r && r.error) || '未知错误'), 'error');
      }
    } catch (e) {
      console.error('[spine-mcp] list-tools 异常:', e);
      this._pushLogDom('加载工具异常，请查看控制台', 'error');
    }
  },
  async runQuickTool() {
    const sel = this.el.querySelector('#sm-tool');
    const tool = sel.value || this._s.quickTool;
    if (!tool) {
      this._pushLogDom('未加载到工具列表', 'warn');
      return;
    }
    const args = {};
    if (this._s.selectedProject) args.projectPath = this._s.selectedProject;
    this._pushLogDom(`调用 ${tool} ...`, 'info');
    const r = await Editor.Message.request('spine-mcp-panel', 'spine:run-tool', { tool, args });
    if (r && r.ok && r.result) {
      const msg = r.result.message || JSON.stringify(r.result).slice(0, 300);
      this._pushLogDom(msg, r.result.success ? 'success' : 'warn');
    } else {
      this._pushLogDom('调用失败：' + (r && r.error), 'error');
    }
  },
};

const panelDef = {
  template,
  style,
  // 官方 DOM 快捷选择器：渲染后由编辑器挂到 this.$（基于 document.querySelector）
  $: {
    root: '#sm-root',
    btnStart: '#sm-btn-start',
    btnStop: '#sm-btn-stop',
    btnSave: '#sm-save',
    btnScan: '#sm-scan',
    btnBrowseSpine: '#sm-browse-spine',
    btnBrowseServer: '#sm-browse-server',
    btnBrowseWs: '#sm-browse-ws',
    btnCopyConfig: '#sm-copy-config',
    btnInfo: '#sm-info',
    btnRun: '#sm-run',
    btnClearLog: '#sm-clear-log',
    log: '#sm-log',
  },
  methods,
  async ready() {
    const vm = this;
    // 优先使用官方 $ 选择器；兜底尝试 document 查找
    vm.el = vm.$.root || (typeof document !== 'undefined' && document.getElementById('sm-root'));
    vm._s = {
      config: {},
      status: 'stopped',
      spineExeExists: true,
      aiConfigText: '',
      projects: [],
      selectedProject: '',
      tools: [],
      quickTool: '',
    };
    if (!vm.el) {
      // 极端兜底：构建最小 DOM
      vm.el = document.createElement('div');
      vm.el.innerHTML = '<div class="sm-root" style="padding:16px;color:#eee;background:#1e1e1e;height:100%">面板初始化失败（DOM 未找到）</div>';
      return;
    }
    const $ = vm.el.querySelector.bind(vm.el);
    // 事件绑定
    (vm.$.btnStart || $('#sm-btn-start')).addEventListener('click', () => vm.startServer());
    (vm.$.btnStop || $('#sm-btn-stop')).addEventListener('click', () => vm.stopServer());
    (vm.$.btnSave || $('#sm-save')).addEventListener('click', () => vm.saveConfig());
    (vm.$.btnScan || $('#sm-scan')).addEventListener('click', () => vm.scanProjects());
    (vm.$.btnBrowseSpine || $('#sm-browse-spine')).addEventListener('click', () => vm.browseSpine());
    (vm.$.btnBrowseServer || $('#sm-browse-server')).addEventListener('click', () => vm.browseServer());
    (vm.$.btnBrowseWs || $('#sm-browse-ws')).addEventListener('click', () => vm.browseWorkspace());
    (vm.$.btnCopyConfig || $('#sm-copy-config')).addEventListener('click', () => vm.copyConfig());
    (vm.$.btnInfo || $('#sm-info')).addEventListener('click', () => vm.getInfo());
    (vm.$.btnRun || $('#sm-run')).addEventListener('click', () => vm.runQuickTool());
    (vm.$.btnClearLog || $('#sm-clear-log')).addEventListener('click', () => { $('#sm-log').innerHTML = ''; });
    await vm.refreshAll();
  },
  close() {
    // 面板关闭时无需停服务（服务可被 AI 客户端复用）
  },
};

// Cocos Creator 3.8 面板：Editor.Panel.define 定义；非 Cocos 环境（自测）直接导出普通对象
module.exports = typeof Editor !== 'undefined' && Editor.Panel && Editor.Panel.define ? Editor.Panel.define(panelDef) : panelDef;
