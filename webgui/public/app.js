/**
 * Spine MCP Web GUI — Vue 3 应用逻辑
 */
const { createApp } = Vue;

createApp({
  data() {
    return {
      tab: 'projects',
      tabs: [
        { id: 'projects', label: '项目' },
        { id: 'split', label: '拆图' },
        { id: 'bones', label: '骨骼' },
        { id: 'preview', label: '预览' },
        { id: 'export', label: '导出' },
      ],
      serverOk: false,
      toolCount: 0,
      spineExe: '',
      // 项目页
      workspace: '',
      projects: [],
      selectedProject: '',
      info: null,
      animations: [],
      previewAnim: '',
      // 拆图
      split: { atlasPath: '', imagePath: '', outputDir: '', mode: 'region' },
      splitParts: [],
      splitError: '',
      // 骨骼
      bonesProject: '',
      bones: [],
      bonesSel: '',
      bonesAnim: '',
      bonesFrame: 0,
      bonesRotation: 0,
      bonesMsg: '',
      // 预览
      previewProject: '',
      previewTime: 0,
      previewMax: 2,
      previewImg: '',
      previewError: '',
      // 导出
      expSource: '',
      expTarget: '',
      expMsg: '',
      expError: '',
      busy: false,
    };
  },
  computed: {
    infoStats() {
      if (!this.info) return {};
      return {
        骨骼: this.info.bones ? this.info.bones.length : 0,
        插槽: this.info.slots ? this.info.slots.length : 0,
        皮肤: this.info.skins ? this.info.skins.length : 0,
        动画: this.info.animations ? this.info.animations.length : 0,
      };
    },
  },
  methods: {
    async api(path, opts) {
      const res = await fetch(path, opts);
      return res.json();
    },
    /** 一键填入 hero 示例路径（按真实存在素材预填） */
    fillExample() {
      const hero = 'D:/cocos/SpinePro3.8.75/examples/hero';
      this.workspace = 'D:/cocos/SpinePro3.8.75/examples';
      this.split.atlasPath = hero + '/export/hero.atlas';
      this.split.imagePath = hero + '/export/hero.png';
      this.split.outputDir = 'D:/cocos/spine-mcp-server/out/web-split';
      this.bonesProject = hero + '/hero-pro.spine';
      this.bonesAnim = 'idle';
      this.previewProject = hero + '/hero-pro.spine';
      this.previewAnim = 'idle';
      this.expSource = hero + '/hero-pro.spine';
      this.expTarget = 'D:/cocos/spine-mcp-server/out/web-export';
      this._flash('已填入 hero 示例路径，可按顶部 5 步操作（先扫描项目）');
    },
    _flash(msg) {
      const old = document.getElementById('wg-toast');
      if (old) old.remove();
      const d = document.createElement('div');
      d.id = 'wg-toast';
      d.className = 'wg-toast';
      d.textContent = msg;
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 3000);
    },
    async refreshStatus() {
      try {
        const r = await this.api('/api/status');
        this.serverOk = !!r.serverOk;
        this.toolCount = r.toolCount || 0;
        this.spineExe = r.spineExe || '';
      } catch (e) {
        this.serverOk = false;
      }
    },
    async scanProjects() {
      if (!this.workspace) return;
      const r = await this.api('/api/projects?dir=' + encodeURIComponent(this.workspace));
      if (r.ok) this.projects = r.projects || [];
      else this.projects = [];
    },
    async loadInfo() {
      if (!this.selectedProject) return;
      const r = await this.api('/api/info?project=' + encodeURIComponent(this.selectedProject));
      if (r.ok && r.result && r.result.data) {
        this.info = r.result.data;
        this.animations = r.result.data.animations || [];
        this.bonesProject = this.selectedProject;
        this.previewProject = this.selectedProject;
        if (this.animations.length) {
          this.previewAnim = this.animations[0].name;
          this.previewMax = this.animations[0].duration || 2;
          this.previewTime = 0;
        }
      }
    },
    async runSplit() {
      this.busy = true;
      this.splitError = '';
      try {
        const r = await this.api('/api/tool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'spine_split_atlas', args: { atlasPath: this.split.atlasPath, imagePath: this.split.imagePath, outputDir: this.split.outputDir, mode: this.split.mode } }),
        });
        if (r.ok && r.result.success) {
          const parts = (r.result.result?.data?.parts || []).map((p) => ({ ...p, url: p.url || '' }));
          this.splitParts = parts;
        } else {
          this.splitError = (r.result && r.result.message) || r.error || '拆分失败';
        }
      } catch (e) {
        this.splitError = String(e);
      } finally {
        this.busy = false;
      }
    },
    async loadBones() {
      if (!this.bonesProject) return;
      const r = await this.api('/api/info?project=' + encodeURIComponent(this.bonesProject));
      if (r.ok && r.result && r.result.data) {
        this.bones = r.result.data.bones || [];
      }
    },
    async applyBone() {
      if (!this.bonesProject || !this.bonesSel || !this.bonesAnim) return;
      const r = await this.api('/api/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'spine_control_bone', args: { projectPath: this.bonesProject, animationName: this.bonesAnim, boneName: this.bonesSel, frameIndex: this.bonesFrame, rotation: this.bonesRotation } }),
      });
      this.bonesMsg = r.ok && r.result ? r.result.message : '写入失败';
    },
    animChanged() {
      const a = this.animations.find((x) => x.name === this.previewAnim);
      if (a) this.previewMax = a.duration || 2;
    },
    async renderPreview() {
      if (!this.previewProject || !this.previewAnim) return;
      this.previewError = '';
      const name = 'frame_' + Date.now();
      const r = await this.api(`/api/preview?project=${encodeURIComponent(this.previewProject)}&animation=${encodeURIComponent(this.previewAnim)}&time=${this.previewTime}&name=${name}`);
      if (r.ok && r.image) this.previewImg = r.image;
      else this.previewError = r.error || '渲染失败（项目可能未导出图片）';
    },
    async exportCopy() {
      if (!this.expSource || !this.expTarget) return;
      this.expMsg = '';
      this.expError = '';
      const r = await this.api('/api/export-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: this.expSource, target: this.expTarget }),
      });
      if (r.ok) this.expMsg = `已复制 ${r.copied} 个文件到 ${this.expTarget}`;
      else this.expError = r.error || '复制失败';
    },
  },
  mounted() {
    this.refreshStatus();
  },
}).mount('#app');
