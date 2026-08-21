# Spine-MCP-Server 商业化产品规划

## 一、产品定位

**Spine-MCP-Server** — 一款面向 Cocos Creator 开发者的本地 MCP 服务工具，通过 AI 助手（Claude/Cursor/Trae）自动化完成 Spine 角色动画工作流：**图片切割 → 骨骼绑定 → 动画生成 → 导出游戏可用格式**。

### 核心价值主张

> 让独立游戏开发者**无需打开 Spine 编辑器**，仅通过对话即可完成角色动画。

### 目标用户

- Cocos Creator 独立开发者（已有 Spine 3.8.75 许可证）
- 需要快速原型验证的小团队
- 想用 AI 辅助加速动画制作的开发者

---

## 二、技术架构

```
┌─────────────────────────────────────────────────┐
│                   AI 助手端                        │
│    (Claude Desktop / Cursor / Trae / Codex)      │
│         ↓  MCP 协议 (stdio)                       │
├─────────────────────────────────────────────────┤
│              Spine-MCP-Server                     │
│                                                   │
│   ┌─────────────────────────────────────────┐    │
│   │         工具层 (Tools)                    │    │
│   │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ │    │
│   │  │切割  │ │骨骼  │ │动画  │ │导出    │ │    │
│   │  │图片  │ │生成  │ │生成  │ │导出    │ │    │
│   │  └──────┘ └──────┘ └──────┘ └────────┘ │    │
│   └─────────────────────────────────────────┘    │
│                                                   │
│   ┌─────────────────────────────────────────┐    │
│   │         服务层 (Services)                 │    │
│   │  ┌──────────┐ ┌──────────┐ ┌────────┐  │    │
│   │  │Spine CLI │ │图片处理  │ │动画计算 │  │    │
│   │  │桥接器    │ │(Sharp)   │ │引擎    │  │    │
│   │  └──────────┘ └──────────┘ └────────┘  │    │
│   └─────────────────────────────────────────┘    │
│                                                   │
│   ┌─────────────────────────────────────────┐    │
│   │         Web GUI 管理面板 (可选)           │    │
│   │  (http://localhost:PORT)                 │    │
│   └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│              用户环境                             │
│  ├─ Spine 3.8.75 Professional (用户自有)        │
│  ├─ Cocos Creator 项目                          │
│  └─ 角色拆分图 PNG                              │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│               输出产物                            │
│  ├─ .spine 项目文件                             │
│  ├─ JSON + Atlas + PNG (可直接用于游戏引擎)     │
│  └─ Cocos Creator 预制体 (可选)                  │
└─────────────────────────────────────────────────┘
```

---

## 三、功能清单

### 3.1 核心工具（MCP Tools）

| 工具名 | 功能 | 输入 | 输出 |
|--------|------|------|------|
| `spine_slice_image` | **自动切割图片** | 图片路径 | 部件列表 + 切割后的 PNG |
| `spine_build_skeleton` | **自动生成骨骼** | 部件列表 + 类型标记 | Spine JSON 骨骼文件 |
| `spine_analyze_json` | 分析 JSON 结构 | JSON 路径 | 骨骼/插槽/附件分析报告 |
| `spine_generate_animation` | 生成动画 | JSON + 自然语言描述 | 动画 JSON |
| `spine_control_bones` | 精细骨骼控制 | 骨骼名 + 参数 | 动画 JSON |
| `spine_build_animation_from_json` | 一键动画管线 | JSON + 图片 | 完整 .spine + 导出文件 |
| `spine_export` | 导出项目 | .spine + 设置 | 游戏用 JSON + Atlas + PNG |
| `spine_import_json` | 导入 JSON | JSON | .spine 项目文件 |
| `spine_info` | 查看项目信息 | .spine 路径 | 元数据 |

### 3.2 新增：图片切割工具 `spine_slice_image`

**这是当前项目缺失的核心功能**，需要新增。

```
spine_slice_image:
  input:
    imagePath: string          # 角色拆分图路径
    minSize?: number = 4       # 过滤噪点
    padding?: number = 0       # 切割内边距
    method?: "auto" | "contour" | "projection" = "auto"
    outputDir?: string         # 输出目录
  output:
    parts: Part[]              # 每个部件的信息
      ├── name: string         # 自动命名
      ├── bbox: {x,y,w,h}     # 包围盒
      ├── size: {w,h}         # 实际尺寸
      └── path: string        # 切割后的 PNG 路径
    total: number              # 部件总数
    preview: string            # 预览图 base64（可选）
```

### 3.3 新增：骨骼生成工具 `spine_build_skeleton`

```
spine_build_skeleton:
  input:
    parts: Part[]              # 部件列表（来自切割结果）
    partTypes: {               # 用户标记的部件类型
      "part_01": "head",
      "part_02": "body",
      ...
    }
    characterType?: "quadruped" | "biped" | "other" = "biped"
    outputPath: string         # 输出 JSON 路径
  output:
    skeletonJson: string       # 生成的 Spine JSON
    boneCount: number
    slotCount: number
    preview: string            # 骨骼预览图 base64（可选）
```

### 3.4 新增：Web GUI 管理面板

**可选高级功能**，在 MCP Server 基础上启动一个本地 Web 服务器，提供可视化操作界面。

```
http://localhost:PORT/
├── /                   # 首页：项目列表
├── /slice              # 图片切割 + 部件标记
│   ├── 拖入图片
│   ├── 自动切割预览
│   ├── 手动合并/分割
│   └── 标记部件类型
├── /skeleton           # 骨骼编辑
│   ├── 骨骼树视图
│   ├── 拖拽调整位置
│   └── 预览
├── /animation          # 动画生成
│   ├── 选择预设
│   ├── 参数调整
│   └── 实时预览
├── /export             # 导出
│   └── 一键导出
└── /settings           # 配置
    └── SPINE_EXE 路径设置
```

---

## 四、开发路线图

### Phase 1: 核心功能完善（2-3 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 1.1 修复 `spine_slice_image` 作为独立 MCP Tool | 将切片脚本封装为 MCP 工具 | P0 |
| 1.2 实现 `spine_build_skeleton` 工具 | 自动骨骼生成 | P0 |
| 1.3 修复硬编码路径 | 替换 `DEFAULT_KNOWLEDGE_DIR` 硬编码 | P0 |
| 1.4 完善错误处理 | 统一的中文错误提示 | P1 |
| 1.5 编写单元测试 | 核心模块测试覆盖 | P1 |

### Phase 2: 用户体验优化（2-3 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 2.1 `spine_slice_image` 交互优化 | 支持多种切割算法自动选择 | P0 |
| 2.2 部件类型自动识别 | 根据尺寸/位置推断部件类型 | P1 |
| 2.3 骨骼布局算法优化 | 支持更多角色类型 | P1 |
| 2.4 动画预设库扩充 | 新增 5-10 种动画预设 | P1 |
| 2.5 安装向导脚本 | 一键检测环境 + 配置 SPINE_EXE | P1 |

### Phase 3: Web GUI + 发布准备（3-4 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 3.1 Web GUI 基础框架 | Express/Koa + React/Vue | P1 |
| 3.2 图片切割页面 | 可视化切割 + 部件标记 | P1 |
| 3.3 骨骼编辑页面 | 可视化骨骼树 + 拖拽 | P2 |
| 3.4 动画预览页面 | Canvas 实时动画预览 | P2 |
| 3.5 导出页面 | 一键导出到 Cocos 项目 | P1 |
| 3.6 文档完善 | 中文文档 + 视频教程 | P1 |
| 3.7 Cocos Store 上架 | 准备商品页 + 宣传素材 | P1 |

---

## 五、优化点（从当前项目出发）

### 5.1 代码质量优化

| 问题 | 当前 | 优化目标 |
|------|------|---------|
| 硬编码路径 | `DEFAULT_KNOWLEDGE_DIR = "G:\\spine-mcp\\knowledge"` | 根据项目路径动态计算 |
| 文件名 Bug | `auto_name_index` 生成 `part_0101` | 修复为 `part_01` |
| 缺少切片工具 | 切片在独立 Python 脚本 | 封装为 MCP Tool |
| 缺少骨骼生成工具 | 骨骼生成在独立 Python 脚本 | 封装为 MCP Tool |
| 无单元测试 | 只有冒烟测试 | 核心模块 Jest 测试 |
| 类型定义冗余 | 多处重复 | 抽取公共类型 |

### 5.2 架构优化

| 问题 | 当前 | 优化目标 |
|------|------|---------|
| 模块耦合 | 功能耦合 | 按领域拆分模块 |
| 配置管理 | 硬编码 + 环境变量 | 统一配置中心 |
| 错误处理 | 零散 | 统一错误码 + 中文提示 |
| 日志系统 | 无 | 分级日志 + 文件输出 |
| 性能监控 | 无 | 工具调用耗时统计 |
| 缓存机制 | 无 | 分析结果缓存 |

### 5.3 用户体验优化

| 问题 | 当前 | 优化目标 |
|------|------|---------|
| 操作方式 | 仅 CLI | CLI + MCP + Web GUI |
| 安装配置 | 手动设置环境变量 | 安装向导 + 自动检测 |
| 错误提示 | 英文 Java 错误 | 中文友好提示 |
| 反馈 | 无 | 进度条 + 实时日志 |
| 预览 | 无 | 部件预览 + 骨骼预览 + 动画预览 |

---

## 六、卖点分析

### 6.1 核心卖点

| 卖点 | 描述 | 对标痛点 |
|------|------|---------|
| **AI 驱动** | 通过自然语言对话即可生成动画 | 传统动画工具需要专业操作 |
| **全自动化管线** | 切图→绑骨→动画→导出 一条命令 | 手动流程涉及 4-5 个工具切换 |
| **零图形界面依赖** | 全程 CLI + AI 对话 | 无需打开 Spine 编辑器 |
| **MCP 标准协议** | 兼容所有 MCP 客户端 | 一次配置，随处可用 |
| **Spine 3.8.75 专版** | 精确定位，兼容性无忧 | 通用工具常有版本兼容问题 |
| **Cocos 友好** | 导出格式可直接用于 Cocos Creator | 无需额外格式转换 |

### 6.2 定价策略

| 版本 | 价格 | 内容 |
|------|------|------|
| **社区版** | ¥0 | 基础工具 + 每次加水印 |
| **专业版** | ¥99 | 全部工具 + 无水印 + 5 个动画预设 |
| **商业版** | ¥299 | 专业版 + 商用授权 + Web GUI + 技术支持 |

### 6.3 竞品对比

| 特性 | Spine-MCP-Server | Spine 编辑器 | DragonBones | 手动流程 |
|------|:-:|:-:|:-:|:-:|
| AI 对话驱动 | ✅ | ❌ | ❌ | ❌ |
| 自动切图 | ✅ | ❌ | ❌ | ❌ |
| 自动绑骨 | ✅ | ❌ | ❌ | ❌ |
| 自动动画 | ✅ | ❌ | ❌ | ❌ |
| 可视化编辑 | ✅ (GUI) | ✅ | ✅ | ✅ |
| 价格 | ¥0~299 | $299 | 免费 | 多工具费用 |
| 学习成本 | 低 | 高 | 中 | 高 |
| 批量处理 | ✅ | ✅ | ❌ | ❌ |

---

## 七、Cocos Store 上架流程

### 7.1 产品形态

以 **Cocos Creator 扩展包** 形式上架，包含：
- `spine-mcp-server/` — MCP 服务端程序
- `cocos-extension/` — Cocos Creator 扩展面板
  - 可视化操作界面
  - 一键启动 MCP Server
  - 一键导入导出

### 7.2 上架步骤

1. 注册 Cocos 开发者账号 → https://store.cocos.com
2. 准备商品资料：
   - 产品名：Spine 动画工坊 / Spine-MCP-Server
   - 图标：512x512 PNG
   - 截图：5-8 张功能截图
   - 视频：1-2 分钟演示视频
   - 描述：中文 + 英文
3. 定价设置
4. 提交审核（3-7 个工作日）
5. 上架后维护

### 7.3 合规注意事项

- **不包含 Spine 本体** — 用户需自备 Spine 3.8.75 许可证
- **不破解/修改 Spine** — 通过官方 CLI 调用
- **开源合规** — 遵守所用开源库的许可证
- **隐私政策** — 声明不上传用户数据

---

## 八、文件清单与重构计划

### 8.1 当前项目结构（需保留）

```
src/
├── index.ts                    # MCP 服务器入口
├── tools/                      # MCP 工具实现
│   ├── spine-info.ts
│   ├── spine-export.ts
│   ├── spine-import-json.ts
│   ├── spine-clean.ts
│   ├── spine-open-project.ts
│   ├── spine-analyze-json.ts
│   ├── spine-generate-animation-json.ts
│   ├── spine-add-simple-animation.ts
│   ├── spine-control-bones.ts
│   ├── spine-scan-corpus.ts
│   ├── spine-learn-from-corpus.ts
│   ├── spine-get-generation-guide.ts
│   ├── spine-recommend-animation-params.ts
│   ├── spine-build-animation.ts         ← 精简
│   ├── spine-build-animation-from-json.ts
│   └── spine-create-loading-animation.ts
├── services/                   # 服务层
│   ├── spine-cli.ts            # Spine CLI 调用封装
│   ├── json-analyzer.ts        # JSON 分析
│   └── animation-writer.ts     # 动画写入
├── models/                     # 类型定义
│   └── types.ts
├── utils/                      # 工具函数
│   ├── error-formatter.ts
│   ├── path-utils.ts
│   └── validation.ts
└── corpus/                     # 语料学习
    └── ...
```

### 8.2 需新增

```
src/
├── tools/
│   ├── spine-slice-image.ts       ← 新增：图片切割工具
│   └── spine-build-skeleton.ts    ← 新增：骨骼生成工具
├── services/
│   ├── image-processor.ts         ← 新增：图片处理服务
│   └── skeleton-builder.ts        ← 新增：骨骼构建服务
├── web-gui/                       ← 新增：Web GUI 面板
│   ├── server.ts                  ← Express 服务器
│   ├── public/                    ← 前端静态文件
│   │   ├── index.html
│   │   ├── slice.html
│   │   ├── skeleton.html
│   │   └── animation.html
│   └── src/                       ← 前端源码 (React/Vue)
│       ├── components/
│       ├── pages/
│       └── utils/
├── installer/                     ← 新增：安装向导
│   ├── setup.ts
│   └── detect-spine.ts
tests/                             ← 新增：测试
├── unit/
│   ├── image-processor.test.ts
│   ├── skeleton-builder.test.ts
│   └── animation-writer.test.ts
└── integration/
    └── full-pipeline.test.ts
scripts/
├── slice-sprites.py               ← 保留，但可被 TypeScript 替代
└── check-spine-env.py             ← 保留
```

---

## 九、关键技术决策

### 9.1 图片处理库

| 库 | 语言 | 优点 | 缺点 |
|----|------|------|------|
| **Sharp** | Node.js | 性能好、功能全、跨平台 | 需要编译 |
| Jimp | Node.js | 纯 JS、无编译 | 性能差 |
| **Canvas (node-canvas)** | Node.js | API 熟悉、支持像素操作 | 需要编译 |

**推荐：Sharp** — 用于图片缩放、裁剪、格式转换；配合 `get-pixels` 做像素级分析。

### 9.2 Web GUI 技术栈

| 方案 | 优点 | 缺点 |
|------|------|------|
| **React + Vite** | 生态丰富、组件库多 | 打包体积大 |
| **Vue 3 + Vite** | 轻量、上手快 | 生态略小 |
| **原生 HTML + vanilla JS** | 零依赖、体积小 | 开发效率低 |
| **Svelte** | 编译型、体积超小 | 小众 |

**推荐：Vue 3 + Vite** — 对独立开发者友好，开发效率高，体积控制好。

### 9.3 Canvas 动画预览

使用 **PixiJS** 或 **Canvas 2D** 在 Web GUI 中实时预览 Spine 动画。

---

## 十、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| Spine 3.8.75 CLI 兼容性问题 | 低 | 高 | 严格锁定版本，测试覆盖 |
| 图片切割算法不准确 | 中 | 中 | 提供手动调整接口 |
| 用户安装配置困难 | 高 | 高 | 安装向导 + 自动检测 |
| 竞品出现 | 中 | 低 | 快速迭代，建立口碑 |
| MCP 协议变更 | 低 | 高 | 关注官方更新，及时适配 |
| Cocos Creator 版本兼容 | 中 | 中 | 支持 LTS 版本 |

---

## 十一、营销与推广

### 11.1 推广渠道

- **Cocos Store** — 核心渠道
- **Cocos 中文论坛** — 发布教程帖
- **B站** — 视频教程 + 演示
- **GitHub** — 开源社区版，吸引核心用户
- **独立开发者社群** — 微信群/QQ 群

### 11.2 推广策略

| 阶段 | 策略 | 目标 |
|------|------|------|
| 预热 | 发布技术预览版，收集反馈 | 100+ 种子用户 |
| 上线 | Cocos Store 上架 + B站视频 | 首月 500+ 下载 |
| 增长 | 用户案例征集 + 教程 | 日活 100+ |
| 变现 | 专业版上线 | 转化率 5%+ |

---

## 十二、总结与行动清单

### 立即行动（本周）

- [ ] 修复 `auto_name_index` 文件名 Bug
- [ ] 修复 `DEFAULT_KNOWLEDGE_DIR` 硬编码路径
- [ ] 封装 `spine_slice_image` MCP Tool
- [ ] 封装 `spine_build_skeleton` MCP Tool
- [ ] 更新 `.env.example` 配置说明
- [ ] 完善 `check-spine-env.py` 检测脚本
- [ ] 更新版本号到 `1.0.0`

### 下一步（1-2 周）

- [ ] 编写核心模块单元测试
- [ ] 优化骨骼布局算法，支持更多角色类型
- [ ] 扩充动画预设库
- [ ] 实现安装向导脚本

### 中期（3-6 周）

- [ ] 搭建 Web GUI 基础框架
- [ ] 实现可视化切割 + 部件标记
- [ ] 实现可视化骨骼编辑
- [ ] 实现动画实时预览
- [ ] 准备 Cocos Store 上架资料

### 长期（6-12 周）

- [ ] Cocos Store 上架
- [ ] 社区版开源
- [ ] 持续迭代 + 用户反馈收集
- [ ] 专业版/商业版上线