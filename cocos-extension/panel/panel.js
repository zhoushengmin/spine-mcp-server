/**
 * Spine MCP Server — Cocos Creator 扩展面板
 * Cocos 3.8 面板：template + style + methods（Vue 编译）
 */
'use strict';

const template = `
<div id="spine-mcp-panel" class="sm-root">
  <!-- 顶部状态栏 -->
  <header class="sm-header">
    <div class="sm-title">
      <span class="sm-logo">🦴</span>
      <span>Spine MCP Server</span>
      <span class="sm-version">v1.0.0</span>
    </div>
    <div class="sm-status-row">
      <span class="sm-dot" :class="statusClass"></span>
      <span>{{ statusText }}</span>
      <button class="sm-btn sm-btn-primary" @click="startServer" :disabled="isRunning">启动服务</button>
      <button class="sm-btn" @click="stopServer" :disabled="!isRunning">停止服务</button>
    </div>
  </header>

  <!-- 新手引导（三步） -->
  <section class="sm-guide" v-if="showGuide">
    <div class="sm-guide-title">📋 三步上手</div>
    <div class="sm-guide-steps">
      <div class="sm-step" :class="{ 'sm-step-done': guideStep1 }">
        <span class="sm-step-ic">{{ guideStep1 ? '✅' : '1️⃣' }}</span> 配置 Spine 路径
      </div>
      <div class="sm-step" :class="{ 'sm-step-done': guideStep2 }">
        <span class="sm-step-ic">{{ guideStep2 ? '✅' : '2️⃣' }}</span> 启动服务
      </div>
      <div class="sm-step" :class="{ 'sm-step-done': guideStep3 }">
        <span class="sm-step-ic">{{ guideStep3 ? '✅' : '3️⃣' }}</span> 复制配置到 AI
      </div>
    </div>
  </section>

  <!-- 基本配置 -->
  <section class="sm-section">
    <div class="sm-section-title">⚙️ 基本配置</div>
    <div class="sm-field">
      <label>Spine 路径</label>
      <input v-model="config.spineExe" placeholder="D:/cocos/SpinePro3.8.75/Spine.com" />
      <button class="sm-btn" @click="browseSpine">浏览</button>
    </div>
    <div class="sm-field">
      <label>Server 路径</label>
      <input v-model="config.serverPath" placeholder="D:/cocos/spine-mcp-server" />
    </div>
    <div class="sm-field">
      <label>工作区</label>
      <input v-model="config.workspace" placeholder="扫描 .spine 的目录（如 Cocos 项目 assets）" />
      <button class="sm-btn" @click="browseWorkspace">浏览</button>
      <button class="sm-btn" @click="saveConfig">保存</button>
    </div>
    <div class="sm-field" v-if="!spineExeExists" style="color:#f56c6c">
      ⚠️ Spine.exe 不存在，请检查路径
    </div>
  </section>

  <!-- AI 客户端配置 -->
  <section class="sm-section">
    <div class="sm-section-title">🤖 AI 客户端配置</div>
    <textarea class="sm-json" rows="10" readonly v-model="aiConfigText"></textarea>
    <div class="sm-row">
      <button class="sm-btn sm-btn-primary" @click="generateConfig">生成配置</button>
      <button class="sm-btn" @click="copyConfig">{{ copied ? '已复制！✓' : '一键复制' }}</button>
    </div>
  </section>

  <!-- 项目列表 -->
  <section class="sm-section">
    <div class="sm-section-title">📦 Spine 项目（{{ projects.length }}）
      <button class="sm-btn sm-btn-sm" @click="scanProjects">刷新</button>
    </div>
    <div class="sm-project-list">
      <div class="sm-project" v-for="p in projects" :key="p.path" @click="selectProject(p.path)" :class="{ 'sm-project-active': p.path === selectedProject }">
        <span class="sm-project-name">{{ p.name }}</span>
        <span class="sm-project-path">{{ p.path }}</span>
      </div>
      <div v-if="!projects.length" class="sm-empty">暂无项目，配置工作区后点击刷新</div>
    </div>
    <div class="sm-field" v-if="selectedProject">
      <label>选中</label>
      <input :value="selectedProject" readonly />
      <button class="sm-btn" @click="getInfo">查看信息</button>
    </div>
  </section>

  <!-- 快速工具 -->
  <section class="sm-section">
    <div class="sm-section-title">🔧 快速工具</div>
    <div class="sm-field">
      <label>工具</label>
      <select v-model="quickTool">
        <option v-for="t in toolNames" :key="t" :value="t">{{ t }}</option>
      </select>
      <button class="sm-btn sm-btn-primary" @click="runQuickTool">执行</button>
    </div>
  </section>

  <!-- 操作日志 -->
  <section class="sm-section">
    <div class="sm-section-title">📋 操作日志 <button class="sm-btn sm-btn-sm" @click="logs = []">清空</button></div>
    <div class="sm-log">
      <div v-for="(log, i) in logs" :key="i" :class="'sm-log-' + log.level">{{ log.text }}</div>
    </div>
  </section>
</div>
`;

const style = `
.sm-root { padding: 8px 12px; font-size: 13px; color: #333; display: flex; flex-direction: column; gap: 10px; overflow: auto; height: 100%; }
.sm-header { border-bottom: 1px solid #e4e4e4; padding-bottom: 8px; }
.sm-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.sm-version { color: #999; font-size: 11px; font-weight: 400; }
.sm-status-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.sm-dot { width: 10px; height: 10px; border-radius: 50%; background: #ccc; display: inline-block; }
.sm-dot-running { background: #67c23a; }
.sm-dot-stopped { background: #909399; }
.sm-dot-error { background: #f56c6c; }
.sm-btn { border: 1px solid #dcdfe6; background: #fff; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 12px; }
.sm-btn:hover { background: #f5f7fa; }
.sm-btn-primary { background: #409eff; color: #fff; border-color: #409eff; }
.sm-btn-primary:hover { background: #66b1ff; }
.sm-btn-sm { padding: 2px 8px; font-size: 11px; }
.sm-guide { background: #f0f9eb; border: 1px solid #e1f3d8; border-radius: 4px; padding: 8px; }
.sm-guide-title { font-weight: 600; margin-bottom: 6px; }
.sm-guide-steps { display: flex; gap: 12px; }
.sm-step { color: #999; }
.sm-step-done { color: #67c23a; }
.sm-section { border: 1px solid #e4e4e4; border-radius: 4px; padding: 8px; }
.sm-section-title { font-weight: 600; margin-bottom: 6px; }
.sm-field { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sm-field label { width: 80px; flex-shrink: 0; color: #666; }
.sm-field input, .sm-field select { flex: 1; border: 1px solid #dcdfe6; border-radius: 4px; padding: 4px 8px; font-size: 12px; }
.sm-json { width: 100%; border: 1px solid #dcdfe6; border-radius: 4px; font-family: monospace; font-size: 11px; background: #fafafa; }
.sm-row { display: flex; gap: 8px; margin-top: 6px; }
.sm-project-list { max-height: 180px; overflow: auto; border: 1px solid #ebeef5; border-radius: 4px; }
.sm-project { padding: 4px 8px; cursor: pointer; display: flex; flex-direction: column; }
.sm-project:hover { background: #f5f7fa; }
.sm-project-active { background: #ecf5ff; }
.sm-project-name { font-weight: 600; }
.sm-project-path { color: #909399; font-size: 11px; word-break: break-all; }
.sm-empty { color: #999; padding: 8px; }
.sm-log { max-height: 160px; overflow: auto; background: #1e1e1e; color: #ccc; border-radius: 4px; padding: 6px; font-family: monospace; font-size: 11px; }
.sm-log-info { color: #ccc; }
.sm-log-warn { color: #e6a23c; }
.sm-log-error { color: #f56c6c; }
.sm-log-success { color: #67c23a; }
`;

const methods = {
  async refreshAll() {
    await this.loadConfig();
    await this.refreshStatus();
    await this.generateConfig();
    await this.scanProjects();
    await this.loadTools();
  },
  async loadConfig() {
    const r = await Editor.Message.request('spine-mcp', 'spine:get-config');
    if (r && r.ok) {
      this.config = r.config || {};
      this.spineExeExists = r.spineExeExists;
    }
  },
  async saveConfig() {
    const r = await Editor.Message.request('spine-mcp', 'spine:set-config', this.config);
    if (r && r.ok) {
      this.pushLog('配置已保存', 'success');
      await this.loadConfig();
      await this.generateConfig();
    }
  },
  async browseSpine() {
    const file = await Editor.Dialog.select({ type: 'file', filters: [{ name: 'Spine', extensions: ['exe', 'bat', 'com'] }] });
    if (file && file.filePaths && file.filePaths.length) {
      this.config.spineExe = file.filePaths[0];
      await this.saveConfig();
    }
  },
  async browseWorkspace() {
    const dir = await Editor.Dialog.select({ type: 'directory' });
    if (dir && dir.filePaths && dir.filePaths.length) {
      this.config.workspace = dir.filePaths[0];
      await this.saveConfig();
    }
  },
  async refreshStatus() {
    const r = await Editor.Message.request('spine-mcp', 'spine:status');
    this.status = r.status || 'stopped';
    this.guideStep2 = this.status === 'running';
  },
  async startServer() {
    const r = await Editor.Message.request('spine-mcp', 'spine:start');
    if (r && r.ok) {
      this.pushLog('MCP 服务已启动（pid ' + r.pid + '）', 'success');
    } else {
      this.pushLog('启动失败：' + (r && r.error), 'error');
    }
    await this.refreshStatus();
  },
  async stopServer() {
    const r = await Editor.Message.request('spine-mcp', 'spine:stop');
    if (r && r.ok) this.pushLog('MCP 服务已停止', 'warn');
    await this.refreshStatus();
  },
  async generateConfig() {
    const r = await Editor.Message.request('spine-mcp', 'spine:get-cli-config');
    if (r && r.ok) {
      this.aiConfigText = JSON.stringify(r.config, null, 2);
      this.guideStep3 = !!r.config;
    }
  },
  async copyConfig() {
    const text = this.aiConfigText || (await this.generateConfig());
    try {
      await Editor.Clipboard.write(this.aiConfigText);
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 2000);
      this.pushLog('配置已复制到剪贴板', 'success');
    } catch (e) {
      this.pushLog('复制失败：' + String(e), 'error');
    }
  },
  async scanProjects() {
    if (!this.config.workspace) {
      this.projects = [];
      return;
    }
    const r = await Editor.Message.request('spine-mcp', 'spine:list-projects', this.config.workspace);
    if (r && r.ok) {
      this.projects = r.projects || [];
      this.guideStep1 = !!this.config.spineExe;
    } else {
      this.projects = [];
      this.pushLog('扫描失败：' + (r && r.error), 'error');
    }
  },
  selectProject(p) {
    this.selectedProject = p;
  },
  async getInfo() {
    if (!this.selectedProject) return;
    const r = await Editor.Message.request('spine-mcp', 'spine:get-info', this.selectedProject);
    if (r && r.ok && r.result) {
      const d = r.result.data || {};
      const bones = d.bones ? d.bones.length : 0;
      const slots = d.slots ? d.slots.length : 0;
      const anims = d.animations ? d.animations.length : 0;
      const skins = d.skins ? d.skins.length : 0;
      this.pushLog(`[${d.skeletonName || '骨架'}] ${bones} 骨骼 / ${slots} 插槽 / ${skins} 皮肤 / ${anims} 动画`, 'success');
    } else {
      this.pushLog('读取信息失败：' + ((r && r.result && r.result.message) || '未知'), 'error');
    }
  },
  async loadTools() {
    const r = await Editor.Message.request('spine-mcp', 'spine:list-tools');
    if (r && r.ok) {
      this.toolNames = (r.tools || []).map((t) => t.name);
      if (this.toolNames.length && !this.toolNames.includes(this.quickTool)) {
        this.quickTool = this.toolNames[0];
      }
    }
  },
  async runQuickTool() {
    if (!this.quickTool) return;
    let args = {};
    if (this.selectedProject) {
      args.projectPath = this.selectedProject;
    }
    this.pushLog(`调用 ${this.quickTool} ...`, 'info');
    const r = await Editor.Message.request('spine-mcp', 'spine:run-tool', { tool: this.quickTool, args });
    if (r && r.ok && r.result) {
      const msg = r.result.message || JSON.stringify(r.result).slice(0, 200);
      this.pushLog(msg, r.result.success ? 'success' : 'warn');
    } else {
      this.pushLog('调用失败：' + (r && r.error), 'error');
    }
  },
  pushLog(text, level) {
    this.logs.push({ text: '[' + new Date().toLocaleTimeString() + '] ' + text, level: level || 'info' });
    if (this.logs.length > 200) this.logs.splice(0, this.logs.length - 200);
  },
};

exports.template = template;
exports.style = style;
exports.methods = methods;

exports.ready = async function () {
  const vm = this;
  vm.status = 'stopped';
  vm.config = {};
  vm.spineExeExists = true;
  vm.showGuide = true;
  vm.guideStep1 = false;
  vm.guideStep2 = false;
  vm.guideStep3 = false;
  vm.aiConfigText = '';
  vm.copied = false;
  vm.projects = [];
  vm.selectedProject = '';
  vm.toolNames = [];
  vm.quickTool = '';
  vm.logs = [];
  await vm.refreshAll();
};

exports.close = function () {
  // 面板关闭时无需停服务（服务可被 AI 客户端复用）
};
