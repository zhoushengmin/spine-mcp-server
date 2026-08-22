# spine-mcp-server 完全重构技术规格书 (v3.0 — 最终定稿)

> **文档用途**：本文档为 spine-mcp-server 项目的完整需求规格说明与技术方案，涵盖技术架构、功能清单、UI设计、开发路线图、商业化准备指南等全部内容。开发团队/AI 可据此进行独立原创开发。
>
> **开发基准 Spine 版本**：`3.8.75`（所有功能均以此版本设计、实现和测试）
> **目标 Cocos 版本**：`3.8.x`
> **目标运行环境**：`Windows 10/11`（后期可扩展 Mac，但当前不要求）
> **核心原则**：完全独立原创代码，不引用任何现有 MCP-Spine 开源项目的代码、LICENSE 或 NOTICE。
> **文档版本**：v3.0-final
> **最后更新**：2026-08-21


## 目录

1. [项目整体目标](#1-项目整体目标)
2. [市场分析与差异化定位](#2-市场分析与差异化定位)
3. [版本与环境锁定细则](#3-版本与环境锁定细则)
4. [技术架构](#4-技术架构)
5. [目录结构与文件职责](#5-目录结构与文件职责)
6. [核心数据结构定义](#6-核心数据结构定义)
7. [功能清单与工具详细设计](#7-功能清单与工具详细设计)
8. [Cocos 扩展面板 UI 设计](#8-cocos-扩展面板-ui-设计)
9. [核心工作流实现细节](#9-核心工作流实现细节)
10. [错误处理与日志标准](#10-错误处理与日志标准)
11. [开发任务拆分与路线图](#11-开发任务拆分与路线图)
12. [兼容性处理策略](#12-兼容性处理策略)
13. [给 AI 开发者的使用约束](#13-给-ai-开发者的使用约束)
14. [最终交付物清单](#14-最终交付物清单)
15. [商业化准备指南](#15-商业化准备指南)
16. [风险与应对](#16-风险与应对)
17. [附录：商业化检查清单](#17-附录商业化检查清单)


## 1. 项目整体目标

### 1.1 核心价值主张

> **让独立游戏开发者无需打开 Spine 编辑器，仅通过对话即可完成角色动画。**

构建一个运行在 **Cocos Creator 编辑器内部**的 MCP (Model Context Protocol) 服务器扩展插件。该插件通过调用用户本地的 `Spine.com` (Spine 3.8.75 的命令行工具)，让 AI 编程助手（Trae、Cursor、Claude Desktop）能够以自然语言的方式：

- 读取和分析 Cocos 项目中的 Spine 骨骼动画资源（`.spine` 项目文件或导出的 JSON）
- 修改骨骼动画数据（关键帧、骨骼变换、插槽重命名等）
- **将 AI 生成的角色立绘大图一键拆分为独立的部件图片（头、身体、手臂、腿等）**
- **自动生成骨骼绑定，生成可直接用于游戏引擎的 Spine JSON 文件**
- 校验 Spine 资产在 Cocos 场景中的引用完整性

### 1.2 目标用户

| 用户类型 | 特征 | 核心需求 |
|----------|------|---------|
| **Cocos Creator 独立开发者** | 已有 Spine 3.8.75 许可证，单人开发 | 降低动画制作门槛，节省时间 |
| **快速原型验证小团队** | 2-5 人，需要快速产出可玩 Demo | 跳过繁琐的动画制作流程 |
| **AI 辅助加速开发者** | 使用 Trae/Cursor 等 AI 编程工具 | 打通 AI 到游戏的动画管线 |

### 1.3 全自动化管线愿景

```
AI 对话描述角色 → 自动切图 → 自动绑骨 → 自动生成动画 → 导出游戏可用格式
```
一条命令/一次对话，完成传统需 4-5 个工具切换的手动流程。


## 2. 市场分析与差异化定位

### 2.1 现有竞品

| 项目 | 定位 | 特点 |
|------|------|------|
| **cocos-mcp-server** | Cocos 编辑器全功能控制 | 13 个工具类别，覆盖场景、节点、组件、预制体等 |
| **Funplay MCP for Cocos** | Cocos 编辑器嵌入式 MCP | 89+ 工具，`execute_javascript` 为核心 |
| **Asset Reference Checker** | 资源检查工具 | 支持 Spine 资源的联动检查 |
| **Spine 编辑器（原生）** | 专业 2D 骨骼动画工具 | $299，学习曲线陡峭，但功能最全 |
| **DragonBones** | 免费 2D 骨骼动画工具 | 免费但功能有限，Cocos 集成不如 Spine 原生 |

### 2.2 差异化定位

**spine-mcp-server 不做"大而全的编辑器控制"，而是做"Spine 资产在 Cocos 项目中的自动化专家"。**

| 对比维度 | 通用 Cocos MCP | **spine-mcp-server（本产品）** |
|----------|---------------|-------------------------------|
| 安装方式 | Cocos 扩展 | **Cocos 商店一键安装** |
| 配置方式 | 图形面板 | **图形化配置面板，新手引导** |
| AI 客户端连接 | 手动配 JSON | **一键生成配置，一键复制** |
| 核心能力 | 编辑器全控制 | **Spine 资产全生命周期管理 + 图片拆图 + 自动绑骨** |
| 使用门槛 | 中 | **低（开箱即用）** |
| 与 Cocos 集成 | 深 | **深（读取项目上下文，资产联动）** |
| 专精方向 | 通用 | **Spine 骨骼动画工作流** |

### 2.3 竞品功能对比矩阵

| 特性 | spine-mcp-server | Spine 编辑器 | DragonBones | 手动流程 |
|------|:-:|:-:|:-:|:-:|
| AI 对话驱动 | ✅ | ❌ | ❌ | ❌ |
| 自动切图 | ✅ | ❌ | ❌ | ❌ |
| 自动绑骨 | ✅ | ❌ | ❌ | ❌ |
| 自动动画 | ✅ | ❌ | ❌ | ❌ |
| 可视化编辑 | ✅ (GUI) | ✅ | ✅ | ✅ |
| 价格 | ¥0~299 | $299 | 免费 | 多工具费用 |
| 学习成本 | 低 | 高 | 中 | 高 |
| 批量处理 | ✅ | ✅ | ❌ | ❌ |

### 2.4 市场机会

Cocos 商店中 **尚无专门针对 Spine 工作流优化的 MCP 插件**，存在明确的市场空白。本产品抓住"AI 编程助手 + 游戏开发"交叉领域，以"AI 对话驱动动画制作"为核心差异点切入市场。


## 3. 版本与环境锁定细则

- **Spine 3.8.75 为开发基准版本**：所有工具的设计、测试均以 3.8.75 为准。对于其他版本，服务器会进行版本检测并给出友好提示（见第 12 节），但**不会主动拒绝执行**。若因版本差异导致 CLI 执行失败，错误信息会以标准格式返回给 AI，由 AI 决定后续操作。
- **CLI 行为特征（3.8.75，已在本机实测验证）**：
  - 信息命令：`Spine.com -i <project>` 直接输出版本/骨骼/插槽/事件/动画列表（`spine_get_project_info` 首选此方式，无需解析二进制文件头）
  - 导出命令：`Spine.com -i <project> -o <输出目录> -e <导出设置.json>`。注意 **`-e` 接收的是一个导出设置 JSON 文件**，不是直接输出路径：
    - JSON 导出设置：`{"class":"json","extension":".json","format":"JSON","nonessential":true,"prettyPrint":true}`
    - 二进制导出设置：`{"class":"binary","extension":".skel"}`
    - 注：`-b` 并非本版本有效参数（旧版本文档有误，已修正）
  - 导入命令：`Spine.com -i <导出的.json/.skel> -o <目标.spine> -r <骨架名>`（**`-r` 才是导入参数**；`-j` 是图集打包时"指定项目以确定 mesh 引用"的参数，不可用于导入，旧版本文档有误，已修正）
  - 清理命令：`Spine.com -i <project> -m`
  - JSON 格式特征：`"skeleton"` 对象中包含 `"spine"` 字段值为 `"3.8.75"`
- **Node.js 环境**：要求 `>=20.0.0`，使用 `child_process` 执行 CLI
- **Cocos 扩展**：需使用 Cocos Creator 3.8 的扩展接口（`Editor.Message` 等）


## 4. 技术架构

### 4.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI 助手端                                      │
│      (Claude Desktop / Cursor / Trae / Codex)                    │
│           ↓  MCP 协议 (stdio)                                     │
├─────────────────────────────────────────────────────────────────┤
│                    Cocos Creator 编辑器                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              spine-mcp-server (扩展插件)                    │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────┐  │  │
│  │  │   配置面板 UI     │  │   MCP 服务器      │  │工具注册 │  │  │
│  │  │   (Vue 3)        │  │   (stdio)         │  │表(15+) │  │  │
│  │  └──────────────────┘  └──────────────────┘  └────────┘  │  │
│  │                         │                   │             │  │
│  │                         ▼                   ▼             │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              Spine 自动化引擎                       │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │  │  │
│  │  │  │ CLI 封装  │  │JSON 处理  │  │ 图片拆分模块    │  │  │  │
│  │  │  └──────────┘  └──────────┘  └────────────────┘  │  │  │
│  │  │  ┌──────────┐  ┌──────────┐                      │  │  │
│  │  │  │骨骼构建   │  │安装向导   │                      │  │  │
│  │  │  └──────────┘  └──────────┘                      │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              本地 Spine CLI (Spine.com)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     输出产物                                       │
│  ├─ .spine 项目文件                                              │
│  ├─ JSON + Atlas + PNG (可直接用于游戏引擎)                       │
│  └─ Cocos Creator 预制体 (可选)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Web GUI 管理面板（可选高级功能）

在 MCP Server 基础上可额外启动一个本地 Web 服务器，提供可视化操作界面，作为 Cocos 扩展面板的补充。

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

### 4.3 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| **运行时** | Node.js 20+ | 轻量、跨平台 |
| **语言** | TypeScript | 类型安全，长期维护性好 |
| **MCP SDK** | `@modelcontextprotocol/sdk` | 官方标准 SDK |
| **Cocos 扩展** | Cocos Creator 扩展系统 (v3.8+) | 原生集成 |
| **UI 框架** | Vue 3 + Vite | 轻量，便于开发配置面板和 Web GUI |
| **图片处理** | `sharp`（首选） | 高性能 PNG 处理；备选 `jimp`（纯 JS 无需编译） |
| **Canvas 动画预览** | PixiJS 或 Canvas 2D | Web GUI 中实时预览 Spine 动画 |
| **测试** | Jest / Vitest | 单元测试 + 集成测试 |

### 4.4 关键技术决策

#### 图片处理库选型

| 库 | 语言 | 优点 | 缺点 |
|----|------|------|------|
| **Sharp** | Node.js | 性能好、功能全、跨平台 | 需要编译（node-gyp） |
| Jimp | Node.js | 纯 JS、无编译依赖 | 性能差，大图处理慢 |
| Canvas (node-canvas) | Node.js | API 熟悉、支持像素操作 | 需要编译 |

**推荐：Sharp** — 用于图片缩放、裁剪、格式转换；配合 `get-pixels` 做像素级分析。在 `package.json` 中锁定 Sharp 版本（如 `^0.33.0`），并注明 Windows 用户需安装 `windows-build-tools`。对于无法编译的用户，提供 Jimp 作为备选方案。

#### Web GUI 技术栈选型

| 方案 | 优点 | 缺点 |
|------|------|------|
| **React + Vite** | 生态丰富、组件库多 | 打包体积大 |
| **Vue 3 + Vite** | 轻量、上手快、与 Cocos 面板一致 | 生态略小 |
| 原生 HTML + vanilla JS | 零依赖、体积小 | 开发效率低 |
| Svelte | 编译型、体积超小 | 小众 |

**推荐：Vue 3 + Vite** — 与 Cocos 扩展面板使用同一技术栈，降低维护成本。


## 5. 目录结构与文件职责

```
spine-mcp-server/
├── package.json                  # 项目依赖：@modelcontextprotocol/sdk, typescript, vue, sharp
├── tsconfig.json                 # 编译输出到 ./dist
├── .env.example                  # 环境变量模版
├── README.md                     # 英文说明
├── README.zh-CN.md               # 中文说明
├── LICENSE                       # MIT 或 商业许可证
│
├── src/                          # 核心代码目录
│   ├── index.ts                  # 入口：解析启动参数，初始化 Server 或 Cocos 面板
│   ├── server.ts                 # MCP Server 主类，负责工具注册与请求路由
│   ├── config-manager.ts         # 管理配置（Spine.exe路径、工作区路径、日志级别）
│   ├── types.ts                  # 全局类型（SpineProject, Bone, Slot, Animation 等）
│   ├── constants.ts              # 常量（错误码、Spine版本号、工具名称列表）
│   ├── logger.ts                 # 日志系统（支持写入文件 + 控制台，带时间戳）
│   │
│   ├── spine/                    # 【核心层】所有与 Spine 3.8.75 交互的原创逻辑
│   │   ├── cli-executor.ts       # 封装 exec/spawn，专门跑 Spine.com，含超时控制（默认 60s）
│   │   ├── version-validator.ts  # 读取 .spine 项目头部，识别版本，返回版本号（含友好提示逻辑）
│   │   ├── project-reader.ts     # 提取骨骼树、插槽、动画列表
│   │   ├── json-handler.ts       # 深度操作 JSON（增删改骨骼关键帧、重命名插槽等）
│   │   ├── export-service.ts     # 调用 CLI 导出 JSON/Bin
│   │   ├── import-service.ts     # 调用 CLI 导入 JSON
│   │   └── cleanup-service.ts    # 调用 CLI 的 -m 参数清理未使用关键帧
│   │
│   ├── image/                    # 【新增】图片处理模块
│   │   ├── splitter.ts           # 核心拆分逻辑（透明区域检测 + 连通区域分析）
│   │   ├── region-detector.ts    # 自动检测部件边界
│   │   ├── naming-resolver.ts    # 智能命名（按位置推断 head/body/arm/leg）
│   │   └── export-helper.ts      # 裁剪输出 + 生成 _parts.json
│   │
│   ├── skeleton/                 # 【新增】骨骼构建模块
│   │   └── builder.ts            # 根据部件列表自动生成骨骼层级 + 绑定关系
│   │
│   ├── tools/                    # 【MCP 工具层】55 个工具，按 7.x 分类对应 TS 文件
│   │   ├── registry.ts           # 注册所有工具到 MCP Server
│   │   ├── base.tool.ts          # 抽象基类：定义 execute 方法，统一捕获错误为 MCP 错误码
│   │   │                          # —— 7.1 信息查询 ——
│   │   ├── info.tool.ts          # 获取项目基本信息（-i Info 命令）
│   │   ├── inspect.tool.ts       # 深度分析 JSON 层级（返回树形描述）
│   │   ├── list-animations.tool.ts   # 列出动画
│   │   ├── list-events.tool.ts   # 🆕 列出事件定义
│   │   ├── list-constraints.tool.ts  # 🆕 列出 IK/变换/路径约束
│   │   ├── get-attachments.tool.ts   # 🆕 列出插槽/皮肤附件
│   │   ├── get-animation-detail.tool.ts # 🆕 动画时间轴完整结构
│   │   ├── render-preview.tool.ts    # 渲染动画帧为 PNG 预览
│   │   │                          # —— 7.2 骨架结构 ——
│   │   ├── bones-control.tool.ts # 设置某骨骼在指定帧的 Transform（核心）
│   │   ├── add-bone.tool.ts      # 新增骨骼
│   │   ├── delete-bone.tool.ts   # 删除骨骼
│   │   ├── set-bone.tool.ts      # 🆕 设置骨骼 Setup 属性（含切变/transformMode）
│   │   ├── add-slot.tool.ts      # 新增插槽
│   │   ├── delete-slot.tool.ts   # 删除插槽
│   │   ├── set-slot.tool.ts      # 🆕 设置插槽属性（颜色/混合模式/默认附件）
│   │   ├── rename-slot.tool.ts   # 重命名插槽
│   │   ├── batch-rename.tool.ts  # 批量重命名（bone|slot）
│   │   │                          # —— 7.3 附件与皮肤 ——
│   │   ├── set-attachment.tool.ts   # 切换插槽附件（换装）
│   │   ├── add-attachment.tool.ts   # 🆕 新增附件（region/mesh/weightedmesh/bbox/path/point/clipping）
│   │   ├── delete-attachment.tool.ts # 🆕 删除附件
│   │   ├── set-attachment-transform.tool.ts # 🆕 附件变换
│   │   ├── edit-mesh.tool.ts     # 🆕 网格顶点/UV/权重/FFD 变形
│   │   ├── set-skin.tool.ts      # 皮肤管理
│   │   │                          # —— 7.4 约束 ——
│   │   ├── add-ik.tool.ts        # 🆕 新增 IK 约束
│   │   ├── set-ik.tool.ts        # 🆕 修改 IK / 写时间轴关键帧
│   │   ├── delete-ik.tool.ts     # 🆕 删除 IK
│   │   ├── add-transform.tool.ts # 🆕 新增变换约束
│   │   ├── set-transform.tool.ts # 🆕 修改变换约束
│   │   ├── delete-transform.tool.ts # 🆕 删除变换约束
│   │   ├── add-path.tool.ts      # 🆕 新增路径约束
│   │   ├── set-path.tool.ts      # 🆕 修改路径约束
│   │   ├── delete-path.tool.ts   # 🆕 删除路径约束
│   │   │                          # —— 7.5 动画 ——
│   │   ├── animation-generate.tool.ts  # 基于模板生成简单动画
│   │   ├── duplicate-animation.tool.ts # 复制动画
│   │   ├── delete-animation.tool.ts    # 删除动画
│   │   ├── rename-animation.tool.ts    # 重命名动画
│   │   ├── set-animation-settings.tool.ts # 🆕 时长/帧率
│   │   ├── control-slot.tool.ts # 🆕 插槽时间轴关键帧（附件/颜色）
│   │   ├── control-constraint.tool.ts # 🆕 约束时间轴关键帧
│   │   ├── add-event-keyframe.tool.ts # 🆕 事件关键帧
│   │   ├── set-draw-order.tool.ts     # 🆕 绘制顺序关键帧
│   │   ├── set-curve.tool.ts          # 🆕 关键帧曲线（linear/stepped/bezier）
│   │   │                          # —— 7.6 图片与图集 ——
│   │   ├── split-atlas.tool.ts   # 一键拆分人物部件图
│   │   ├── repack-atlas.tool.ts  # 部件重打包为图集
│   │   ├── import-image.tool.ts  # 🆕 导入图片纹理
│   │   ├── export-video.tool.ts  # 🆕 导出动画视频
│   │   │                          # —— 7.7 骨骼构建 ——
│   │   ├── build-skeleton.tool.ts # 自动生成骨骼绑定
│   │   │                          # —— 7.8 导入导出与项目 ——
│   │   ├── export.tool.ts        # 导出 JSON/Bin
│   │   ├── import.tool.ts        # 导入 JSON
│   │   ├── clean.tool.ts         # 清理
│   │   ├── create-project.tool.ts # 🆕 创建空项目
│   │   ├── scale-project.tool.ts # 🆕 整体缩放
│   │   │                          # —— 7.9 Cocos 集成与工具链 ——
│   │   ├── list-assets.tool.ts   # 扫描 Cocos 项目 assets 目录
│   │   ├── validate-refs.tool.ts # 检查 .spine 在 Cocos 场景中的引用是否丢失
│   │   └── rollback.tool.ts      # 备份列表与回滚
│   │
│   ├── cocos/                    # 【Cocos 集成层】
│   │   ├── extension-api.ts      # 封装 Editor.Message 调用
│   │   ├── asset-scanner.ts      # 递归读取 Cocos 项目文件夹，解析 .meta 文件
│   │   └── panel-bridge.ts       # 供前端 UI 面板调用的后端 API
│   │
│   ├── web-gui/                  # 【新增】Web GUI 管理面板（可选）
│   │   ├── server.ts             # Express 服务器
│   │   ├── routes/               # 路由
│   │   │   ├── slice.ts          # 图片切割路由
│   │   │   ├── skeleton.ts       # 骨骼编辑路由
│   │   │   ├── animation.ts      # 动画预览路由
│   │   │   └── export.ts         # 导出路由
│   │   └── public/               # 前端静态文件
│   │       ├── index.html
│   │       ├── slice.html
│   │       ├── skeleton.html
│   │       └── animation.html
│   │
│   ├── installer/                # 【新增】安装向导
│   │   ├── setup.ts              # 一键安装主流程
│   │   └── detect-spine.ts       # 自动检测 Spine.exe 位置
│   │
│   └── utils/                    # 【工具函数】
│       ├── file-utils.ts         # 递归创建目录、文件拷贝、备份（修改前自动备份 .bak）
│       ├── path-utils.ts         # 跨平台路径处理
│       ├── json-utils.ts         # 深拷贝、路径查找
│       ├── image-utils.ts        # PNG 读取/写入、格式转换工具
│       └── error-codes.ts        # 错误码枚举
│
├── panel/                        # 【Cocos 扩展 UI 面板】（Vue 3）
│   ├── index.html
│   ├── main.ts                   # Vue 挂载入口
│   ├── components/
│   │   ├── App.vue               # 主面板布局（状态栏 + 配置区域 + 日志区域）
│   │   ├── SpinePathSelector.vue # 文件选择器（调用 Cocos 原生对话框）
│   │   ├── ClientConfigGenerator.vue  # 下拉选择 AI 客户端，生成配置 JSON 并复制
│   │   ├── LogViewer.vue         # 滚动日志显示区
│   │   └── SetupWizard.vue       # 【新增】新手引导步骤条
│   └── styles/
│       └── main.css              # 面板样式（与 Cocos 设计语言一致）
│
├── tests/                        # 【新增】测试目录
│   ├── unit/
│   │   ├── cli-executor.test.ts
│   │   ├── json-handler.test.ts
│   │   ├── splitter.test.ts
│   │   ├── builder.test.ts
│   │   └── animation-writer.test.ts
│   └── integration/
│       └── full-pipeline.test.ts
│
└── scripts/
    ├── detect-spine-env.py        # 保留：Spine 环境检测脚本
    └── check-spine-env.py         # 保留
```


## 6. 核心数据结构定义

```typescript
// src/types.ts

/** Spine 3.8.75 项目的核心元数据 */
export interface SpineProjectInfo {
  version: string;               // 优先读取，若为 3.8.75 则正常返回，否则附带警告
  skeletonName: string;
  bones: BoneInfo[];
  slots: SlotInfo[];
  skins: SkinInfo[];
  animations: AnimationInfo[];
  images: string[];              // 引用的纹理列表
  /** 版本兼容性警告（非 3.8.75 时填充） */
  compatibilityWarning?: string;
}

export interface BoneInfo {
  name: string;
  parent?: string;
  length: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface SlotInfo {
  name: string;
  bone: string;                  // 绑定的骨骼名
  attachment?: string;
  color: string;
}

export interface AnimationInfo {
  name: string;
  duration: number;
  keyframeCount: number;
}

/** 拆分部件结果 */
export interface SplitPart {
  name: string;                  // 部件名称（如 head）
  file: string;                  // 输出文件名（如 head.png）
  width: number;
  height: number;
  x: number;                     // 在原图中的 X 坐标
  y: number;                     // 在原图中的 Y 坐标
  bbox: { x: number; y: number; w: number; h: number }; // 包围盒
  path: string;                  // 切割后的 PNG 绝对路径
  type?: string;                 // 推断的部件类型（head/body/arm/leg）
}

/** 骨骼构建输入 */
export interface BuildSkeletonInput {
  parts: SplitPart[];            // 部件列表（来自切割结果）
  partTypes: Record<string, string>;  // 部件类型标记（如 { "head": "head", "body": "body" }）
  characterType: "biped" | "quadruped" | "other";  // 角色类型
  outputPath: string;            // 输出 JSON 路径
}

/** 骨骼构建输出 */
export interface BuildSkeletonOutput {
  skeletonJson: string;          // 生成的 Spine JSON 路径
  boneCount: number;
  slotCount: number;
  skeletonHint: {
    boneHierarchy: string;       // 骨骼层级建议文本
    partToBone: Record<string, string>;  // 部件与骨骼对应关系
  };
}

/** MCP 工具调用的统一返回结构 */
export interface ToolResult {
  success: boolean;
  message: string;              // 人类可读描述
  data?: any;                   // 结构化数据
  warning?: string;             // 兼容性警告（非致命）
  errorCode?: string;           // 错误码
}

/** 🆕 约束信息（IK / 变换 / 路径共用） */
export interface ConstraintInfo {
  name: string;
  type: "ik" | "transform" | "path";
  bone?: string;                // 受约束骨骼（transform/path 可能多根）
  bones?: string[];
  target: string;               // 目标骨骼或路径附件
  mix?: number;                 // 强度（0-1）
  extra?: Record<string, number | boolean>;  // bendDirection/offset*/position/spacing 等
}

/** 🆕 附件信息 */
export interface AttachmentInfo {
  name: string;
  slot: string;
  skin: string;                 // 所属皮肤（default 表示 Setup）
  type: "region" | "mesh" | "weightedmesh" | "boundingbox" | "path" | "point" | "clipping";
  path?: string;                // 纹理路径
  width?: number;
  height?: number;
  vertices?: number[];          // 网格顶点 / 权重
  uvs?: number[];
  triangles?: number[];
  weights?: number[];           // weightedmesh 顶点权重
}

/** 🆕 时间轴关键帧描述（动画详情查询用） */
export interface TimelineFrame {
  time: number;                 // 秒
  curve?: "linear" | "stepped" | "bezier";  // 插值曲线
  value?: number | number[] | string | null;
}
```


## 7. 功能清单与工具详细设计

本服务器共提供 **55 个核心工具**，覆盖 Spine 3.8.75 的全部功能域（骨架、插槽、附件、网格、皮肤、IK/变换/路径约束、动画时间轴、事件、绘制顺序、曲线、图片图集、导入导出、Cocos 集成），分为九大类：

### 7.1 信息查询类（8 个）

#### 7.1.1 spine_get_project_info
**功能**：读取 .spine 项目文件或导出的 JSON，返回结构化的项目信息（版本/骨架名/尺寸/骨骼/插槽/皮肤/动画/事件/纹理引用）
**参数**：`projectPath` (string, required)
**返回**：SpineProjectInfo 对象。若版本非 3.8.75，compatibilityWarning 附带友好提示
**实现说明**：.spine 为二进制格式，**首选调用 `Spine.com -i {path}`（Info 命令）**，解析其 stdout 即可；如需完整 JSON 再走导出流程。

#### 7.1.2 spine_inspect_json
**功能**：深度分析 JSON 文件的骨骼层级结构，返回树形描述文本
**参数**：`jsonPath` (string, required)
**返回**：骨骼树文本描述 + 统计（骨骼/插槽/皮肤/约束/动画数）

#### 7.1.3 spine_list_animations
**功能**：列出所有动画片段及其关键帧统计
**参数**：`projectPath` (string, required)
**返回**：动画名称 + 时长 + 关键帧数量

#### 7.1.4 spine_list_events 🆕
**功能**：列出项目中定义的所有事件（名称/类型：int/float/string）
**参数**：`projectPath` (string, required)
**返回**：事件列表

#### 7.1.5 spine_list_constraints 🆕
**功能**：列出全部约束（IK / 变换 / 路径）及其目标、涉及骨骼
**参数**：`projectPath` (string, required)
**返回**：约束列表（按类型分组）

#### 7.1.6 spine_get_attachments 🆕
**功能**：列出指定插槽（或整个皮肤）可用的所有附件及类型
**参数**：`projectPath` (string, required)；`slotName` (string, optional)；`skinName` (string, optional，默认 default)
**返回**：附件名 + 类型（region/mesh/weightedmesh/bbox/path/point/clipping）

#### 7.1.7 spine_get_animation_detail 🆕
**功能**：返回单个动画的完整时间轴结构（骨骼/插槽/约束/事件/绘制顺序/FFD 各时间轴的关键帧、曲线类型）
**参数**：`projectPath` (string, required)；`animationName` (string, required)
**返回**：结构化时间轴描述

#### 7.1.8 spine_render_preview
**功能**：渲染指定动画/帧为 PNG 图片序列（供 AI 直观确认姿态）
**参数**：`projectPath` (string, required)；`animationName` (string, optional)；`frameIndex` (number, optional)；`outputDir` (string, required)
**实现说明**：图片导出设置 `{"class":"texture","extension":".png"}` + `frameInterval`/`frameCount` 参数。
**返回**：图片路径列表

### 7.2 骨架结构编辑类（9 个，含核心 spine_control_bone）

#### 7.2.1 spine_control_bone ⭐核心工具
**功能**：修改指定骨骼在动画特定帧的变换（旋转/位移/缩放/切变）
**参数**：`projectPath`；`animationName`；`boneName`；`frameIndex`；`x`/`y`/`rotation`/`scaleX`/`scaleY`/`shearX`/`shearY` (optional)
**实现逻辑**：导出 JSON → 修改关键帧 → `-r` 导入（Round-Trip，见 9.1）
**返回**：修改成功提示 + 影响的关键帧数

#### 7.2.2 spine_add_bone
**功能**：在指定父骨骼下新增骨骼
**参数**：`projectPath`；`name`；`parent`；`x`/`y`/`length`/`rotation` (optional)
**返回**：新增确认

#### 7.2.3 spine_delete_bone
**功能**：删除骨骼（处理子骨骼与关联插槽，操作前自动备份）
**参数**：`projectPath`；`boneName`
**返回**：删除确认 + 受影响列表

#### 7.2.4 spine_set_bone 🆕
**功能**：设置骨骼 Setup 姿态属性（非动画关键帧）：位置/旋转/缩放/**切变**/长度/transformMode/颜色
**参数**：`projectPath`；`boneName`；`x`/`y`/`rotation`/`scaleX`/`scaleY`/`shearX`/`shearY`/`length` (optional)；`transformMode` (optional: normal|onlyTranslation|noRotationOrReflection|noScale|noScaleOrReflection)
**返回**：设置确认

#### 7.2.5 spine_add_slot
**功能**：在指定骨骼下新增插槽
**参数**：`projectPath`；`slotName`；`boneName`；`order` (optional)
**返回**：新增确认

#### 7.2.6 spine_delete_slot
**功能**：删除插槽及其附件引用
**参数**：`projectPath`；`slotName`
**返回**：删除确认

#### 7.2.7 spine_set_slot 🆕
**功能**：设置插槽属性：颜色 / **混合模式**（normal|additive|multiply|screen）/ 默认附件
**参数**：`projectPath`；`slotName`；`color` (optional, RRGGBBAA)；`blend` (optional)；`attachment` (optional)
**返回**：设置确认

#### 7.2.8 spine_rename_slot
**功能**：重命名插槽（同步更新皮肤与动画中的引用）
**参数**：`projectPath`；`oldName`；`newName`
**返回**：重命名确认

#### 7.2.9 spine_batch_rename
**功能**：批量重命名骨骼/插槽（支持正则）
**参数**：`projectPath`；`pattern`；`replacement`；`targetType` (bone|slot)
**返回**：重命名数量 + 明细

### 7.3 附件与皮肤类（6 个）

#### 7.3.1 spine_set_attachment ⭐（换装核心）
**功能**：设置/切换某插槽的附件（换装/换武器/换表情；空串=隐藏）
**参数**：`projectPath`；`slotName`；`attachmentName`；`skinName` (optional, 默认 default)
**返回**：切换确认

#### 7.3.2 spine_add_attachment 🆕
**功能**：新增附件（支持类型：region / mesh / **weighted mesh** / bounding box / path / point / clipping）
**参数**：`projectPath`；`slotName`；`name`；`type`；`path` (纹理路径, region/mesh 需要)；`width`/`height` (optional)；`vertices`/`uvs`/`triangles` (mesh 用)
**返回**：新增确认

#### 7.3.3 spine_delete_attachment 🆕
**功能**：删除附件（从所有皮肤中移除）
**参数**：`projectPath`；`slotName`；`attachmentName`
**返回**：删除确认

#### 7.3.4 spine_set_attachment_transform 🆕
**功能**：设置附件在插槽内的变换：x/y/rotation/scaleX/scaleY/颜色
**参数**：`projectPath`；`slotName`；`attachmentName`；`skinName` (optional)；`x`/`y`/`rotation`/`scaleX`/`scaleY`/`color` (optional)
**返回**：设置确认

#### 7.3.5 spine_edit_mesh 🆕
**功能**：编辑网格附件：顶点坐标/UV/三角形/顶点权重；也可写动画 FFD 变形关键帧
**参数**：`projectPath`；`slotName`；`attachmentName`；`mode` (setup|deform)；`vertices`/`uvs`/`triangles`/`weights` (setup 用)；`animationName`/`frameIndex`/`deform` (deform 用)
**⚠️ 实测**：Spine 3.8 的 FFD 时间轴键名为 **`deform`**（结构 `animations.<名>.deform.<皮肤名>.<插槽名>.<附件名>`），非 4.x 的 `ffd`。json-handler 已按此读写。
**返回**：编辑确认 + 顶点数

#### 7.3.6 spine_set_skin
**功能**：皮肤管理（创建/重命名/删除/设置默认）
**参数**：`projectPath`；`action` (create|rename|delete|setDefault)；`skinName`；`newName` (rename 用)
**返回**：操作确认 + 皮肤列表

### 7.4 约束类（9 个）🆕 全部新增

> 约束系统是 Spine 高级骨骼能力的核心，JSON 中对应 `ik` / `transform` / `path` 三个数组，动画中对应同名时间轴。三类约束各提供 add/set/delete 三个工具。

#### 7.4.1 spine_add_ik
**功能**：新增 IK 约束（反向动力学）
**参数**：`projectPath`；`name`；`bone`（受约束骨骼）；`target`（目标骨骼）；`bendDirection`；`mix` (optional, 默认1)；`compress`/`stretch` (optional)；`order` (optional)；`skinName` (optional)
**返回**：新增确认

#### 7.4.2 spine_set_ik
**功能**：修改 IK 约束属性 或 写 IK 时间轴关键帧
**参数**：`projectPath`；`name`；`mode` (setup|animation)；`mix`/`bendDirection` (setup 用)；`animationName`/`frameIndex`/`mix` (animation 用)
**返回**：设置确认

#### 7.4.3 spine_delete_ik
**功能**：删除 IK 约束
**参数**：`projectPath`；`name`
**返回**：删除确认

#### 7.4.4 spine_add_transform
**功能**：新增变换约束（复制/跟随目标骨骼的变换，可混合）
**参数**：`projectPath`；`name`；`bone`；`target`；`local`；`relative`；`offsetRotation`/`offsetX`/`offsetY`/`offsetScaleX`/`offsetScaleY`/`offsetShearY`；`rotateMix`/`translateMix`/`scaleMix`/`shearMix` (optional)
**返回**：新增确认

#### 7.4.5 spine_set_transform
**功能**：修改变换约束属性或写时间轴关键帧
**参数**：`projectPath`；`name`；`mode` (setup|animation)；`*Mix`/`offset*` (setup 用)；`animationName`/`frameIndex`/`*Mix` (animation 用)
**返回**：设置确认

#### 7.4.6 spine_delete_transform
**功能**：删除变换约束
**参数**：`projectPath`；`name`
**返回**：删除确认

#### 7.4.7 spine_add_path
**功能**：新增路径约束（让骨骼沿路径移动/朝向）
**参数**：`projectPath`；`name`；`bones`；`target`（路径附件）；`positionMix`/`rotateMix`/`translateMix`；`position`/`spacing`/`rotate` (optional)
**返回**：新增确认

#### 7.4.8 spine_set_path
**功能**：修改路径约束属性或写时间轴关键帧
**参数**：`projectPath`；`name`；`mode` (setup|animation)；`*Mix`/`position`/`spacing`/`rotate`；`animationName`/`frameIndex` (animation 用)
**返回**：设置确认

#### 7.4.9 spine_delete_path
**功能**：删除路径约束
**参数**：`projectPath`；`name`
**返回**：删除确认

### 7.5 动画类（11 个，其中 spine_control_bone 与 7.2.1 共用）

#### 7.5.1 spine_add_simple_animation
**功能**：基于预设模板快速生成动画（idle|breath|walk|jump）
**参数**：`projectPath`；`template`；`duration` (optional, 默认1.0)；`boneName` (optional, 默认 root)
**返回**：生成的动画名 + 关键帧数

#### 7.5.2 spine_duplicate_animation
**功能**：复制动画为副本
**参数**：`projectPath`；`sourceName`；`newName`
**返回**：复制确认

#### 7.5.3 spine_delete_animation
**功能**：删除动画（操作前自动备份）
**参数**：`projectPath`；`animationName`
**返回**：删除确认

#### 7.5.4 spine_rename_animation
**功能**：重命名动画
**参数**：`projectPath`；`oldName`；`newName`
**返回**：重命名确认

#### 7.5.5 spine_set_animation_settings 🆕
**功能**：设置动画时长/帧率
**参数**：`projectPath`；`animationName`；`duration` (optional)；`fps` (optional)
**返回**：设置确认

#### 7.5.6 spine_control_bone（见 7.2.1，动画类共用）
**功能**：骨骼时间轴关键帧编辑（rotate/translate/scale/shear）

#### 7.5.7 spine_control_slot 🆕
**功能**：插槽时间轴关键帧编辑：附件切换/颜色变化
**参数**：`projectPath`；`animationName`；`slotName`；`frameIndex`；`attachment` (optional)；`color` (optional)
**返回**：修改确认 + 关键帧数

#### 7.5.8 spine_control_constraint 🆕
**功能**：约束时间轴关键帧编辑（ik/transform/path 的 mix 值变化）
**参数**：`projectPath`；`animationName`；`type` (ik|transform|path)；`name`；`frameIndex`；`mix`/`position`/`spacing`/`rotate` (optional)
**返回**：修改确认 + 关键帧数

#### 7.5.9 spine_add_event_keyframe 🆕
**功能**：在动画指定时间添加事件关键帧（音效/触发点），事件需先定义（int/float/string）
**参数**：`projectPath`；`animationName`；`time` (秒)；`eventName`；`intValue`/`floatValue`/`stringValue` (optional)
**返回**：添加确认

#### 7.5.10 spine_set_draw_order 🆕
**功能**：在动画指定时间设置插槽绘制顺序关键帧
**参数**：`projectPath`；`animationName`；`time`；`slots`（有序插槽名数组，空串表移除）
**返回**：设置确认

#### 7.5.11 spine_set_curve 🆕
**功能**：设置某关键帧的插值曲线类型（linear|stepped|bezier）
**参数**：`projectPath`；`animationName`；`timeline`（如 bones.torso.rotate）；`keyframeIndex`；`curve` (linear|stepped|bezier)；`c1x`/`c1y`/`c2x`/`c2y` (bezier 控制点, optional)
**返回**：设置确认

### 7.6 图片与图集类（4 个）

#### 7.6.1 spine_split_atlas ⭐大功能
**功能**：将 AI 生成的角色立绘大图一键拆分为独立部件图片
**参数**：`imagePath`；`outputDir`；`mode` (auto|manual|contour|projection)；`regions`；`naming`；`prefix`；`padding` (默认2)；`minSize` (默认4)
**自动拆分逻辑**：透明区域检测 → 连通区域分析（Flood Fill）→ 过滤杂点 → 按位置智能命名（head→body→leg，两侧 arm）→ 裁剪输出 + 生成 `_parts.json`
**返回**：拆分结果 + 部件列表 + skeletonHint

#### 7.6.2 spine_repack_atlas
**功能**：把部件图片重新打包成引擎图集（PNG + .atlas）
**参数**：`imageDir`；`outputDir`；`name` (默认 parts)；`padding` (默认2)
**实现说明**：调用 CLI 图集打包（`-p` 打包设置 JSON）
**返回**：图集 PNG + atlas 路径

#### 7.6.3 spine_import_image 🆕
**功能**：导入外部图片作为附件纹理（需先生成对应附件）
**参数**：`projectPath`；`imagePath`；`slotName`；`attachmentName`；`atlasPath` (optional)
**返回**：导入确认

#### 7.6.4 spine_export_video 🆕
**功能**：导出动画为视频（MP4/WebM/GIF）
**参数**：`projectPath`；`animationName`；`outputPath`；`fps`；`width`/`height` (optional)；`loop` (optional)
**实现说明**：CLI 视频导出设置（`{"class":"video",...}`）
**返回**：视频文件路径

### 7.7 骨骼构建类（1 个）

#### 7.7.1 spine_build_skeleton ⭐自动骨骼生成
**功能**：根据部件列表自动生成 Spine 骨骼绑定，输出可直接使用的 JSON
**参数**：`parts` (Part[])；`partTypes` (Record<string,string>)；`characterType` (biped|quadruped|other)；`outputPath`
**骨骼生成逻辑**：按部件类型推断层级（head→body→legs）→ 按位置/尺寸计算骨骼长度与方向 → 生成骨骼树 → 生成插槽与附件绑定 → 输出 Spine 兼容 JSON
**返回**：skeletonJson 路径 + boneCount/slotCount + skeletonHint

### 7.8 导入导出与项目类（5 个）

#### 7.8.1 spine_export_animation
**功能**：导出为 JSON 或二进制（.skel）
**参数**：`projectPath`；`outputDir`；`format` (json|binary, 默认 json)；`animationName` (optional)
**实现说明**：按目标格式生成导出设置 JSON（见第 3 节），执行 `Spine.com -i <project> -o <outputDir> -e <settings.json>`
**返回**：导出文件路径列表

#### 7.8.2 spine_import_animation
**功能**：将修改后的 JSON 导入回 .spine 项目
**参数**：`projectPath`；`jsonPath`；`mergeMode` (replace 默认|update v1.1)
**实现说明**：`Spine.com -i {jsonPath} -o {projectPath} -r <骨架名>`
**返回**：导入确认 + 备份路径
**注意**：v1.0 仅支持 replace；update 模式列 v1.1 路线图

#### 7.8.3 spine_clean_animation
**功能**：清理未使用的关键帧（CLI `-m`）
**参数**：`projectPath`
**返回**：清理报告（删除关键帧数）

#### 7.8.4 spine_create_project 🆕
**功能**：创建一个空的 Spine 项目文件
**参数**：`outputPath`（.spine）；`skeletonName`；`width`/`height` (optional)
**实现说明**：`Spine.com -i <空骨架.json> -o <outputPath> -r <skeletonName>`
**返回**：创建确认

#### 7.8.5 spine_scale_project 🆕
**功能**：整体缩放项目（导入时 `-s` 参数）
**参数**：`projectPath`；`scale`；`outputPath` (optional，默认覆盖)
**返回**：缩放确认

### 7.9 Cocos 集成与工具链类（3 个）

#### 7.9.1 spine_list_cocos_assets
**功能**：扫描当前 Cocos 项目中的全部 Spine 资产
**参数**：无（自动读取 Cocos 工作区）
**返回**：[{ name, path, metaPath, hasErrors }]

#### 7.9.2 spine_validate_references
**功能**：检查 Spine 资产在 Cocos 场景/预制体中的引用是否完整
**参数**：`assetPath`
**返回**：引用列表 + 缺失/错误项

#### 7.9.3 spine_rollback
**功能**：列出所有备份并一键回滚（配合 9.5 节备份机制，保留最近 10 次）
**参数**：`projectPath`；`backupId` (optional，不填则列出)
**返回**：备份列表 或 回滚确认

### 7.10 版本分层说明

| 免费版（4 个，可看不可改） | 专业版（51 个） |
|------|------|
| spine_get_project_info | 其余全部工具（含渲染预览、骨骼/插槽编辑、换装、皮肤、约束、动画管理、拆图、绑骨、打包、导入导出、回滚等） |
| spine_inspect_json | |
| spine_list_animations | |
| spine_list_cocos_assets | |

**免费版策略**：用户可"看"（查看项目信息、列出资产）但不能"改"（修改/导出/拆图/绑骨），有足够动力升级。

### 7.11 Spine 功能覆盖矩阵（完整能力对照）

| Spine 3.8.75 功能域 | 覆盖工具 | 状态 |
|------|------|:--:|
| 项目信息 / 版本 / 尺寸 | spine_get_project_info | ✅ |
| 骨骼树 / 层级分析 | spine_inspect_json | ✅ |
| 骨骼增删改（Setup） | add/delete/set_bone | ✅ |
| 骨骼动画关键帧（旋转/位移/缩放/切变） | spine_control_bone | ✅ |
| 插槽增删改（颜色/混合模式/默认附件） | add/delete/set_slot | ✅ |
| 插槽动画关键帧（附件/颜色） | spine_control_slot | ✅ |
| 附件（region/mesh/weightedmesh/bbox/path/point/clipping） | add/delete_attachment | ✅ |
| 附件变换 / 换装切换 | set_attachment_transform / set_attachment | ✅ |
| 网格顶点 / UV / 三角面 / 权重 / FFD 变形 | spine_edit_mesh | ✅ |
| 皮肤管理 | spine_set_skin | ✅ |
| IK 约束（增改删 + 关键帧） | add/set/delete_ik + control_constraint | ✅ |
| 变换约束（增改删 + 关键帧） | add/set/delete_transform + control_constraint | ✅ |
| 路径约束（增改删 + 关键帧） | add/set/delete_path + control_constraint | ✅ |
| 事件定义 / 事件关键帧 | list_events + add_event_keyframe | ✅ |
| 绘制顺序 | spine_set_draw_order | ✅ |
| 关键帧曲线（linear/stepped/bezier） | spine_set_curve | ✅ |
| 动画增删复制改名 / 时长帧率 | duplicate/delete/rename + set_animation_settings | ✅ |
| 模板动画生成 | spine_add_simple_animation | ✅ |
| 自动拆图（立绘→部件） | spine_split_atlas | ✅ |
| 自动绑骨（部件→骨架） | spine_build_skeleton | ✅ |
| 图集打包 | spine_repack_atlas | ✅ |
| 图片导入 | spine_import_image | ✅ |
| 导出 JSON / 二进制 | spine_export_animation | ✅ |
| 导入回写 | spine_import_animation | ✅ |
| 清理未用关键帧 | spine_clean_animation | ✅ |
| 图片序列 / 视频导出 | render_preview / export_video | ✅ |
| 创建项目 / 整体缩放 | create_project / scale_project | ✅ |
| Cocos 资产扫描 / 引用校验 | list_cocos_assets / validate_references | ✅ |
| 备份与回滚 | spine_rollback | ✅ |


## 8. Cocos 扩展面板 UI 设计

### 8.1 面板布局

```
┌─────────────────────────────────────────────────────────┐
│ 🦴 Spine MCP Server                   版本 v1.0.0     │
│ ├── 状态：● 运行中 (已连接 Spine 3.8.75)              │
│ ├── [停止服务]  [重启服务]                            │
├─────────────────────────────────────────────────────────┤
│ 📋 新手引导（首次打开）                                 │
│ ┌──────────────────────────────────────────────────┐   │
│ │ 步骤 1: 选择 Spine 路径  [⚪ 已完成]             │   │
│ │ 步骤 2: 启动服务          [⚪ 未开始]             │   │
│ │ 步骤 3: 复制配置到 AI 客户端  [⚪ 未开始]         │   │
│ └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ ⚙️ 基本配置                                           │
│ ├── Spine 路径： [E:\Spine\Spine.com   ] [浏览...]   │
│ ├── 工作区：   E:\CocosProjects\MyGame [刷新]       │
│ ├── 日志级别：  [信息 ▼]                              │
├─────────────────────────────────────────────────────────┤
│ 🤖 AI 客户端配置                                      │
│ ├── 选择客户端：[Trae ▼]                              │
│ ├── [生成配置]  [一键复制]                            │
│ └── ┌────────────────────────────────────┐            │
│     │ {                                  │            │
│     │   "mcpServers": {                  │            │
│     │     "spine-mcp": { ... }           │            │
│     │   }                                │            │
│     │ }                                  │            │
│     └────────────────────────────────────┘            │
├─────────────────────────────────────────────────────────┤
│ 📋 操作日志                                           │
│ ┌─────────────────────────────────────────────────┐   │
│ │ [10:32:15] INFO 服务已启动                     │   │
│ │ [10:32:20] INFO spine_get_project_info 调用   │   │
│ │ [10:32:25] WARN 检测到版本 4.0.00，部分功能   │   │
│ │              可能不兼容                       │   │
│ │ [10:33:01] ERROR 骨骼 "arm" 不存在            │   │
│ └─────────────────────────────────────────────────┘   │
│ [清空日志]                                            │
├─────────────────────────────────────────────────────────┤
│ 📚 快速上手 (点击展开)                                 │
│  1️⃣ 确认 Spine 路径正确                              │
│  2️⃣ 点击 "启动服务"                                  │
│  3️⃣ 复制配置到 AI 客户端                             │
│  4️⃣ 开始使用！                                       │
└─────────────────────────────────────────────────────────┘
```

### 8.2 新手引导流程（首次打开）

用户首次打开面板时，自动触发"三步上手"引导：

| 步骤 | 操作 | 状态指示 |
|------|------|---------|
| 第 1 步 | 选择 Spine.exe 路径 | ✅ 已完成 / ⚠️ 未设置 |
| 第 2 步 | 点击「启动服务」 | ✅ 已启动 / ⚠️ 未启动 |
| 第 3 步 | 点击「复制配置」粘贴到 AI 客户端 | ✅ 已复制 / ⚠️ 待操作 |

引导流程以横向进度条展示在面板顶部。

### 8.3 交互反馈规范

| 操作 | 反馈方式 |
|------|---------|
| 启动/停止服务 | 状态指示灯变化 + 日志输出 + Toast 提示 |
| 复制配置 | 按钮文字变为「已复制！✓」持续 2 秒后恢复 |
| 工具调用成功 | 日志中以绿色/灰色显示成功信息 |
| 工具调用失败 | 日志中以红色显示错误信息 + 错误码 |
| 长时间操作 | 进度条显示（如拆分大图时） |


## 9. 核心工作流实现细节

### 9.1 修改骨骼动画的标准流程（Round-Trip）

> ⚠️ **实测修正（重要）**：直接 `Spine.com -i {json} -o {已存在的项目} -r {骨架名}` 导入**会静默丢失修改**（已实测）。正确做法是：导入到**临时新项目文件**，再**原子替换**原项目。见下方步骤 g。

1. AI 调用 `spine_control_bone(projectPath, animName, boneName, frame, rotation=15)`
2. 服务端接收请求：
   a. 读取 projectPath 文件头，识别版本
   b. 若不是 3.8.75，在返回结果中附加 warning 字段，但继续执行
   c. 生成导出设置 JSON（`{"class":"json","extension":".json","format":"JSON","nonessential":true,"prettyPrint":true}`），调用 cli-executor 执行：`Spine.com -i {projectPath} -o {tempDir} -e {tempDir}/export-settings.json`
   d. 读取 `{tempDir}/{skeletonName}.json` 为 JS 对象
   e. 查找 `animations[animName].bones[boneName]`，修改 frame 数据
   f. 写回 `{tempDir}/{skeletonName}.json`
   g. **原地替换导入**：先 `backupFile(projectPath)` 备份原项目 → 执行 `Spine.com -i {tempDir}/{skeletonName}.json -o {tempDir}/new.spine -r {skeletonName}` 生成新项目 → 校验 `new.spine` 存在 → `fs.copyFileSync(new.spine, projectPath)` 原子替换原项目（代码已封装为 `importJsonInPlace`）
   h. 删除临时文件，返回成功
3. 若中间任何步骤失败，捕获 CLI 的 stderr，转换为友好的中文错误信息返回给 AI

> 补充（实测）：Spine 3.8.75 导出 JSON 中 `skins` 为**数组格式** `[{ "name", "attachments" }]`，`bones`/`slots` 为数组，`animations` 为按名称索引的对象；时间轴中 time=0 的关键帧导出时会省略 `time` 字段（视为 0）。json-handler 已全部兼容。

### 9.2 图片拆分工作流

1. AI 调用 `spine_split_atlas(imagePath, outputDir)`
2. 服务端接收请求：
   a. 使用 sharp 读取 PNG，提取像素数据
   b. 从四边扫描，识别非透明像素的边界
   c. 连通区域分析（Flood Fill 算法）→ 分组
   d. 过滤杂点（< minSize）
   e. 按位置排序 → 智能命名（head → body → legs → arms）
   f. 裁剪并输出为独立 PNG
   g. 生成 `_parts.json` 元数据文件
   h. 返回拆分结果 + 骨骼层级建议
3. 若拆分失败（如图片非 PNG、无透明通道），返回明确错误提示

### 9.3 骨骼构建工作流

1. AI 调用 `spine_build_skeleton(parts, partTypes, outputPath)`
2. 服务端接收请求：
   a. 根据 partTypes 推断骨骼层级关系（head 在上 → body 在中 → legs 在下）
   b. 根据部件位置/尺寸计算骨骼长度和方向角度
   c. 生成骨骼树：root → pelvis → spine → chest → neck → head
   d. 生成四肢骨骼：shoulder_l/r → arm_l/r → forearm_l/r
   e. 生成插槽（Slot）与附件（Attachment）绑定
   f. 输出为 Spine 3.8.75 兼容的 JSON 格式
   g. 返回骨骼统计 + 层级提示
3. 支持人形（biped）和四足（quadruped）两种角色类型骨架模板

### 9.4 一键动画管线工作流

将切图、绑骨、动画生成、导出串联为一条命令：

```
AI 一句话描述 → spine_split_atlas → spine_build_skeleton → 
spine_add_simple_animation → spine_export_animation → 完成
```

### 9.5 备份与回滚机制

- **自动备份**：每次执行任何修改类工具（`spine_import_animation`、`spine_control_bone`、`spine_add_bone`、`spine_delete_bone`、`spine_add_slot`、`spine_delete_slot`、`spine_rename_slot`、`spine_set_attachment`、`spine_set_skin`、`spine_delete_animation`、`spine_rename_animation` 等）前，自动在项目同目录下生成 `{filename}.{timestamp}.bak` 备份
- **回滚支持**：`spine_rollback` 工具（见 7.4.8），可列出所有备份并一键恢复
- **版本历史**：保留最近 10 次修改的备份


## 10. 错误处理与日志标准

### 10.1 错误码枚举

| 错误码 | 含义 | 触发场景 |
|--------|------|---------|
| E_SPINE_NOT_FOUND | 未找到 Spine.com | 路径配置错误或未安装 |
| E_VERSION_MISMATCH | 版本不匹配（作为 warning） | 目标文件不是 3.8.75 |
| E_CLI_TIMEOUT | CLI 执行超时 | 复杂项目导出耗时过长（>60s） |
| E_JSON_PARSE | JSON 解析失败 | 导出的 JSON 损坏或不符合规范 |
| E_BONE_NOT_FOUND | 骨骼不存在 | AI 传入了错误的骨骼名 |
| E_FRAME_OUT_OF_RANGE | 帧索引超出范围 | 动画总帧数不足 |
| E_IMAGE_READ_FAILED | 图片读取失败 | 文件不是 PNG 或已损坏 |
| E_IMAGE_NO_ALPHA | 图片无透明通道 | 拆图需要透明背景 |
| E_COCOS_PATH_INVALID | Cocos 项目路径无效 | 未检测到有效的 Cocos 项目 |
| E_CLI_EXEC_FAILED | CLI 执行失败 | Spine.com 返回非零退出码 |
| E_SLOT_NOT_FOUND | 插槽不存在 | 重命名/操作时插槽名错误 |
| E_PART_TYPE_INVALID | 部件类型无效 | 骨骼构建时部件类型标记错误 |

### 10.2 日志级别

| 级别 | 用途 | 颜色 |
|------|------|------|
| ERROR | 错误码和堆栈 | 🔴 红色 |
| WARN | 非致命问题（版本不兼容、纹理缺失） | 🟡 黄色 |
| INFO | 工具调用开始和结束 | ⚪ 白色 |
| DEBUG | CLI 原始输出（调试模式） | 🔘 灰色 |

### 10.3 错误信息规范（用户友好）

❌ 不推荐（程序员风格）：
```
TypeError: Cannot read property 'bones' of undefined at line 47...
```

✅ 推荐（用户友好）：
```
❌ 操作失败 (错误码: E_BONE_NOT_FOUND)
原因：在项目 "hero.spine" 中未找到名为 "arm_r" 的骨骼。
建议：请检查骨骼名称拼写是否正确。可用 spine_get_project_info 查看所有骨骼列表。
```


## 11. 开发任务拆分与路线图

### Phase 1: 基础设施（1-2 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 1.1 初始化 TypeScript 项目，配置 tsconfig | 项目骨架 | P0 |
| 1.2 安装 @modelcontextprotocol/sdk、@types/node、sharp | 依赖安装 | P0 |
| 1.3 实现 logger.ts 和 error-codes.ts | 日志与错误码 | P0 |
| 1.4 实现 cli-executor.ts，封装 exec | 能调用 Spine.com --help | P0 |
| 1.5 实现 version-validator.ts | 版本检测 | P0 |
| 1.6 实现 config-manager.ts | 统一配置中心，消除硬编码 | P0 |
| 1.7 修复 `auto_name_index` 文件名 Bug | `part_0101` → `part_01` | P0 |

### Phase 2: Spine 3.8.75 核心封装（1-2 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 2.1 实现 project-reader.ts | 解析导出 JSON 提取骨骼层级（骨架名/骨骼/插槽/皮肤/动画） | P0 |
| 2.2 实现 export-service.ts | 生成导出设置 JSON 并导出（json/binary/图片序列） | P0 |
| 2.3 实现 import-service.ts | 用 `-r` 导入 JSON 回 .spine 项目 | P0 |
| 2.4 实现 cleanup-service.ts | 执行 -m 清理 | P0 |
| 2.5 实现 info-service.ts | 解析 `Spine.com -i <path>` 的 Info 输出（版本/骨骼/插槽/动画） | P0 |
| 2.6 实现 json-handler.ts | 提供 findBone、updateKeyframe、renameSlot、addBone、deleteBone、setAttachment 等 | P0 |
| 2.7 完善错误处理 | 统一中文错误提示 | P1 |

### Phase 3: MCP 工具开发 - 基础工具（2 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 3.1 实现 server.ts 和 registry.ts | MCP 服务器框架 | P0 |
| 3.2 实现 info.tool.ts、inspect.tool.ts、list-animations.tool.ts | 信息查询（基于 Info 命令 + JSON 解析） | P0 |
| 3.3 实现 export.tool.ts 和 import.tool.ts | 导出导入 | P0 |
| 3.4 实现 bones-control.tool.ts（最核心） | 骨骼控制 | P0 |
| 3.5 实现 clean.tool.ts、animation-generate.tool.ts | 清理与动画生成 | P0 |
| 3.6 实现 rename-slot.tool.ts、batch-rename.tool.ts | 重命名工具 | P1 |
| 3.7 实现 add/delete-bone.tool.ts、add/delete-slot.tool.ts | 骨骼与插槽增删 | P1 |
| 3.8 实现 set-attachment.tool.ts、set-skin.tool.ts | 换装与皮肤管理 | P1 |
| 3.9 实现 duplicate/delete/rename-animation.tool.ts | 动画管理 | P1 |
| 3.10 实现 rollback.tool.ts | 备份列表与回滚 | P1 |
| 3.11 实现 render-preview.tool.ts | 动画帧渲染为 PNG 预览 | P1 |

### Phase 4: 高级骨骼模块 - 约束/网格/曲线/事件（2-3 周）🆕

> 本阶段是"全功能"与"基础版"的分水岭，难度最高，覆盖 Spine 高级能力。

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 4.1 实现 list-events / get-attachments / get-animation-detail / list-constraints.tool.ts | 高级信息查询 | P1 |
| 4.2 实现 set-bone.tool.ts、set-slot.tool.ts | Setup 属性（切变/transformMode/混合模式） | P1 |
| 4.3 实现 add/delete-attachment.tool.ts、set-attachment-transform.tool.ts | 附件完整管理（region/mesh/bbox/path/point/clipping） | P1 |
| 4.4 实现 edit-mesh.tool.ts | 网格顶点/UV/权重 + FFD 变形关键帧 | P1 |
| 4.5 实现 IK 约束三件套（add/set/delete-ik.tool.ts） | IK 反向动力学 | P1 |
| 4.6 实现变换约束三件套（add/set/delete-transform.tool.ts） | 变换约束 | P1 |
| 4.7 实现路径约束三件套（add/set/delete-path.tool.ts） | 路径约束 | P1 |
| 4.8 实现 control-slot.tool.ts、control-constraint.tool.ts | 插槽/约束时间轴关键帧 | P1 |
| 4.9 实现 add-event-keyframe.tool.ts、set-draw-order.tool.ts | 事件与绘制顺序 | P1 |
| 4.10 实现 set-curve.tool.ts | 关键帧曲线（linear/stepped/bezier） | P1 |
| 4.11 实现 set-animation-settings.tool.ts、import-image.tool.ts、export-video.tool.ts | 时长帧率/图片导入/视频导出 | P1 |
| 4.12 实现 create-project.tool.ts、scale-project.tool.ts | 项目创建与缩放 | P2 |

### Phase 5: 图片拆分 + 骨骼构建模块（2-3 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 5.1 实现 region-detector.ts | 透明区域检测 | P0 |
| 5.2 实现 splitter.ts | 连通区域分析（Flood Fill） | P0 |
| 5.3 实现 naming-resolver.ts | 智能命名 | P0 |
| 5.4 实现 split-atlas.tool.ts | MCP 工具封装 | P0 |
| 5.5 集成 sharp 进行图片裁剪输出 | 裁剪输出 | P0 |
| 5.6 实现 skeleton/builder.ts | 自动骨骼构建逻辑 | P0 |
| 5.7 实现 build-skeleton.tool.ts | 骨骼构建 MCP 工具封装 | P0 |
| 5.8 支持多种切割算法自动选择 | 切割算法优化 | P1 |
| 5.9 实现 repack-atlas.tool.ts | 部件图片重打包为引擎图集（CLI `-p`） | P1 |

### Phase 6: Cocos 集成 + 面板 UI（2-3 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 6.1 编写 extensions/package.json | 扩展面板定义 | P0 |
| 6.2 实现 asset-scanner.ts | 递归扫描 .spine 文件 | P0 |
| 6.3 实现 list-assets.tool.ts 和 validate-refs.tool.ts | Cocos 资产工具 | P0 |
| 6.4 开发 Vue 3 面板 | 全部 UI 组件 | P0 |
| 6.5 实现 panel-bridge.ts | 连接 UI 与 MCP Server | P0 |
| 6.6 实现新手引导流程 | 三步上手 | P1 |
| 6.7 实现安装向导脚本 | 一键检测环境 + 配置 SPINE_EXE | P1 |

### Phase 7: Web GUI（可选，3-4 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 7.1 Web GUI 基础框架 | Express + Vue 3 | P1 |
| 7.2 图片切割页面 | 可视化切割 + 部件标记 | P1 |
| 7.3 骨骼编辑页面 | 可视化骨骼树 + 拖拽 | P2 |
| 7.4 动画预览页面 | Canvas 实时动画预览 | P2 |
| 7.5 导出页面 | 一键导出到 Cocos 项目 | P1 |

### Phase 8: 测试与文档（1-2 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 8.1 单元测试：cli-executor、json-handler、splitter、constraint-writer | Jest 测试 | P1 |
| 8.2 集成测试 | 在本地 3.8.75 项目上测试全部 55 个工具 | P1 |
| 8.3 编写 README.md（中英文） | 用户文档 | P1 |
| 8.4 编写用户手册（PDF，20+ 页） | 图文并茂 | P1 |
| 8.5 录制 5 分钟演示视频 | 安装 → 配置 → 拆图 → 骨骼控制 | P1 |
| 8.6 打包 .ccx 插件 | Cocos 扩展安装包 | P1 |


## 12. 兼容性处理策略

本项目的开发与测试环境完全锁定在 Spine 3.8.75，所有工具的实现、CLI 参数解析、JSON 数据结构操作均基于此版本。

对于 Spine 4.x 或其他版本，本服务器采取**「尽力兼容，友好提示」**的策略：

当用户尝试打开一个非 3.8.75 版本的 .spine 项目时，服务器会检测到版本差异，并在返回结果中增加一条 WARNING 级别的提示，内容类似于：

> "检测到当前 Spine 项目版本为 {version}，本服务器主要针对 3.8.75 优化，部分功能（如骨骼控制、JSON 导入导出）在非 3.8.75 版本上可能无法正常工作或存在未知兼容性问题。建议您使用 Spine 3.8.75 以获得最佳体验。"

服务器不会主动拒绝或终止操作，而是将执行权交给用户。AI 看到这条警告后，可以决定是否继续调用后续工具。

如果某个工具在非 3.8.75 版本上确实因格式差异而执行失败，服务器会捕获 CLI 返回的错误信息，将其转换为人类可读的错误描述返回给 AI，并附带建议："当前操作失败，可能由于版本不兼容，建议降级项目至 3.8.75 或联系开发者适配。"

面板中增加 Spine 版本选择器：如果用户同时安装了多个版本，可手动选择使用哪个版本。

未来若需支持 4.x，可在 `spine/adapters/` 目录下新增 `adapter-4x.ts`，但本版本不包含。


## 13. 给 AI 开发者的使用约束

当 AI（如 Trae）调用本服务器时，需遵循以下规则：

1. **每次修改前自动备份**：服务器会在修改前自动生成 .bak 文件，AI 无需关心
2. **骨骼名称大小写敏感**：`spine_control_bone` 中的 boneName 必须与项目中的 BoneInfo.name 完全一致
3. **批量操作建议**：需要修改多个骨骼时，分别调用多次 `spine_control_bone`，不要一次性传入复杂结构
4. **路径使用绝对路径**：从 Cocos 获取的路径为绝对路径，直接传入即可
5. **图片格式要求**：`spine_split_atlas` 仅支持 PNG 格式（带透明通道）
6. **操作前先查看**：建议先调用 `spine_get_project_info` 确认项目信息，再执行修改操作


## 14. 最终交付物清单

| 交付物 | 说明 | 优先级 |
|--------|------|--------|
| 完整的源代码（含中文注释） | 全部 TypeScript 源码 | P0 |
| 编译后的 dist 文件夹 | 可运行版本 | P0 |
| Cocos 扩展安装包（.ccx） | 商店上架格式 | P0 |
| 安装向导脚本 | 一键检测环境 + 配置 SPINE_EXE | P1 |
| 用户手册（PDF，20+ 页，图文并茂） | 每个工具的参数解释和示例 | P1 |
| 5 分钟演示视频 | 安装 → 配置 → 拆图 → 骨骼控制 | P1 |
| 配套示例 Demo 项目 | 含测试用角色图 + Spine 项目 | P1 |
| 常见问题 FAQ（15+ 条） | 高频问题整理 | P1 |
| 版本更新日志（CHANGELOG.md） | 每次更新写清晰的 Changelog | P1 |


## 15. 商业化准备指南

从"技术可用"到"能卖钱"，需要补齐以下 6 大板块。

### 15.1 产品化与用户体验

| 项目 | 说明 |
|------|------|
| 新手引导流程 | 首次打开显示"三步上手"引导：选路径 → 启动服务 → 复制配置 |
| 预设工作流模板 | 内置 3-5 个常用流程，如"AI 拆图 → 自动绑定 → 生成动画" |
| 操作进度反馈 | 长任务（拆分大图、导出复杂项目）必须显示进度条 |
| 全中文 UI | 面板、错误提示、日志全部简体中文 |
| 精致视觉设计 | 参考 Cocos 官方插件设计风格，避免"程序员风格" |

### 15.2 稳定性与容错

| 项目 | 说明 |
|------|------|
| 全覆盖异常捕获 | 所有工具调用必须捕获异常，返回用户可读的中文提示 |
| 操作回滚机制 | 每次修改前自动备份，支持一键回退 |
| 异步队列处理 | 长任务不阻塞 UI，用异步队列 + 通知提醒 |
| 多版本 Spine 共存 | 面板内手动选择使用哪个版本的 Spine.exe |

### 15.3 文档与学习资源

| 项目 | 说明 |
|------|------|
| 5 分钟演示视频 | 放在商店详情页顶部，展示完整使用流程 |
| 图文使用手册 | 至少 20 页 PDF，每个工具都有参数解释和示例 |
| 常见问题 FAQ | 15-20 条高频问题 |
| 示例 Demo 项目 | 让用户拿到手就能跟着教程跑 |

### 15.4 售后与支持体系

| 项目 | 说明 |
|------|------|
| 用户交流群 | 建立微信/QQ 群（Cocos 生态标配） |
| 工单/Issue 系统 | 提供 GitHub Issues 或在线工单，承诺 24-48 小时响应 |
| 版本更新日志 | 每次更新写清晰的 Changelog（中文） |
| 免费试用期 | 7 天或 14 天免费试用（Cocos 商店支持） |

### 15.5 法律与合规

| 项目 | 说明 |
|------|------|
| Spine EULA 复核 | 明确声明"本工具不包含 Spine 软件，需用户自行购买许可证" |
| 不破解/修改 Spine | 通过官方 CLI 调用，不绕过任何许可验证 |
| 隐私声明 | 明确声明"所有操作均在本地完成，不上传任何文件" |
| 退款政策 | 明确什么情况可退款，什么情况不可 |
| 最终用户许可协议 | 放在安装包内，首次打开时勾选同意 |

### 15.6 定价策略

| 版本 | 价格 | 内容 |
|------|------|------|
| **社区版（免费）** | ¥0 | 4 个免费工具（spine_get_project_info、spine_inspect_json、spine_list_animations、spine_list_cocos_assets），每次加水印 |
| **专业版** | ¥89~129 | 全部工具 + 无水印 + 5 个动画预设 + 1 年更新 |
| **商业版** | ¥299 | 专业版 + 商用授权 + Web GUI + 技术支持 |

**对标竞品**：cocos-mcp-server ¥99，Funplay ¥199，建议 ¥89–¥129。
**首发促销**：前两周打 7 折，积累种子用户和好评。
**平台分成**：Cocos 商店抽成约 30%，需提前算好利润。

### 15.7 营销推广策略

| 推广渠道 | 内容 |
|---------|------|
| **Cocos Store** | 核心渠道，商品页 + 5-8 张截图 + 演示视频 |
| **Cocos 中文论坛** | 发布教程帖，引导下载 |
| **B站** | 视频教程 + 演示（5 分钟） |
| **GitHub** | 开源社区版，吸引核心用户 |
| **独立开发者社群** | 微信群/QQ 群 |

**推广阶段规划**：

| 阶段 | 策略 | 目标 |
|------|------|------|
| 预热 | 发布技术预览版，收集反馈 | 100+ 种子用户 |
| 上线 | Cocos Store 上架 + B站视频 | 首月 500+ 下载 |
| 增长 | 用户案例征集 + 教程 | 日活 100+ |
| 变现 | 专业版上线 | 转化率 5%+ |

### 15.8 Cocos Store 上架流程

**产品形态**：以 **Cocos Creator 扩展包** 形式上架，包含：
- `spine-mcp-server/` — MCP 服务端程序
- `cocos-extension/` — Cocos Creator 扩展面板（可视化操作界面 + 一键启动 + 一键导入导出）

**上架步骤**：
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


## 16. 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| Spine 3.8.75 CLI 兼容性问题 | 低 | 高 | 严格锁定版本，测试覆盖所有工具 |
| 图片切割算法不准确 | 中 | 中 | 提供手动调整接口 + 多种切割算法备选 |
| 用户安装配置困难（node-gyp 等） | 高 | 高 | 安装向导 + 自动检测 Sharp 编译情况 + 备选 Jimp |
| 竞品出现 | 中 | 低 | 快速迭代，建立口碑，深耕 Cocos 生态 |
| MCP 协议变更 | 低 | 高 | 关注官方更新，及时适配 |
| Cocos Creator 版本兼容 | 中 | 中 | 支持 LTS 版本，使用稳定的扩展接口 |
| Sharp 在 Windows 上编译失败 | 中 | 中 | 在 package.json 中锁定版本，提供 Jimp 作为备选方案 |


## 17. 附录：商业化检查清单

| 分类 | 项目 | 状态 |
|------|------|:----:|
| **产品化** | 新手引导流程 | ☐ |
| 产品化 | 预设工作流模板（≥3 个） | ☐ |
| 产品化 | 操作进度条 / 状态反馈 | ☐ |
| 产品化 | 全中文 UI + 错误提示 | ☐ |
| 产品化 | 精致视觉设计（非程序员风格） | ☐ |
| 产品化 | 安装向导脚本 | ☐ |
| **稳定性** | 全覆盖异常捕获 | ☐ |
| 稳定性 | 自动备份 + 回滚机制 | ☐ |
| 稳定性 | 异步队列处理长任务 | ☐ |
| 稳定性 | 支持手动选择多版本 Spine | ☐ |
| **文档** | 5 分钟演示视频 | ☐ |
| 文档 | 图文使用手册（20+ 页 PDF） | ☐ |
| 文档 | 常见问题 FAQ（15+ 条） | ☐ |
| 文档 | 配套示例 Demo 项目 | ☐ |
| **支持** | 微信群 / QQ 群 | ☐ |
| 支持 | 工单 / Issues 响应通道 | ☐ |
| 支持 | 版本更新日志（中文） | ☐ |
| 支持 | 7-14 天免费试用 | ☐ |
| **法律** | Spine EULA 合规声明 | ☐ |
| 法律 | 不破解/修改 Spine 声明 | ☐ |
| 法律 | 本地处理 + 隐私声明 | ☐ |
| 法律 | 退款政策 | ☐ |
| 法律 | 最终用户许可协议（EULA） | ☐ |
| **定价** | 竞品定价调研 | ☐ |
| 定价 | 免费版/专业版分层 | ☐ |
| 定价 | 首发促销计划 | ☐ |
| **营销** | Cocos 商店商品页 | ☐ |
| 营销 | 论坛教程帖 | ☐ |
| 营销 | B站演示视频 | ☐ |
| 营销 | GitHub 开源社区版 | ☐ |