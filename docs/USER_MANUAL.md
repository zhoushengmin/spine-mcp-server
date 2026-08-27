# Spine MCP Server — 用户手册

版本：1.0.0 ｜ 适用 Spine 3.8.75 ｜ 最后更新：2026-08

---

## 1. 产品介绍

Spine MCP Server 是一个把 Spine 3.8.75 Professional 编辑器能力封装为 **70 个工具** 的服务，让 AI 客户端（Trae、Cursor、Claude Desktop 等）能够直接：

- 读取和解析 Spine 项目结构
- 修改动画关键帧与曲线
- 编辑骨架、插槽、附件、皮肤
- 创建与管理 IK / 变换 / 路径约束
- 编辑网格（含 FFD 变形关键帧）
- 拆分图集、自动绑骨、重打包图集
- 渲染动画预览帧

所有修改操作都采用 **Round-Trip** 机制（导出 JSON → 修改 → 原地导入），并在修改前**自动备份**项目，保证可回滚。

## 2. 系统要求

| 组件 | 要求 |
|---|---|
| 操作系统 | Windows 10/11（实测） |
| Node.js | ≥ 20（推荐 22 LTS） |
| Spine | **3.8.75 Professional**（`Spine.com` 命令行） |
| 可选 | Cocos Creator 3.8+（扩展面板） |

> 本服务针对 Spine 3.8.75 优化。打开其他版本项目时会给出兼容性提示，但不阻止操作。

## 3. 安装

### 3.1 安装 Node.js
从 [nodejs.org](https://nodejs.org) 下载 LTS 版本并安装。命令行验证：

```bash
node -v   # 应显示 v20 及以上
```

### 3.2 准备 Spine
确保 Spine 3.8.75 Professional 已安装，记下 `Spine.com` 路径，例如：
`D:\cocos\SpinePro3.8.75\Spine.com`

### 3.3 安装本项目依赖并构建

```bash
cd D:\cocos\spine-mcp-server
npm install
npm run build
```

### 3.4 配置环境（二选一）

**方式 A：安装向导（推荐）**

```bash
npm run installer
```

自动检测 Node / Spine / Cocos 并写入 `.env`。

**方式 B：手动写 `.env`**

```
SPINE_EXE=D:/cocos/SpinePro3.8.75/Spine.com
LOG_LEVEL=info
```

## 4. 快速上手（3 步）

1. **验证**：`node dist/index.js check` → 显示 "Spine CLI 校验通过"
2. **配置到 AI 客户端**：复制 MCP 配置到 Trae / Cursor / Claude Desktop
3. **开始对话**：让 AI 读取/修改你的 Spine 项目

## 5. 配置到 AI 客户端

### 5.1 Trae / Cursor / Claude Desktop

在客户端的 MCP 服务器配置中添加：

```json
{
  "mcpServers": {
    "spine-mcp": {
      "command": "node",
      "args": ["D:/cocos/spine-mcp-server/dist/index.js", "mcp"],
      "env": { "SPINE_EXE": "D:/cocos/SpinePro3.8.75/Spine.com" }
    }
  }
}
```

配置后重启客户端，应能看到 70 个 `spine_*` 工具。

> **故障排查**：如果显示 "No tools yet"，说明服务器 stdout 被污染或进程未重启。请**删除配置 → 重启客户端 → 重新添加**。

### 5.2 验证连通

对话输入：
> "查看 D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine 的项目信息"

AI 会调用 `spine_get_project_info` 返回骨骼/插槽/皮肤/动画。

## 6. 命令行基础命令

| 命令 | 用途 |
|---|---|
| `node dist/index.js check` | 校验 Spine CLI 与配置 |
| `node dist/index.js info <path>` | 显示项目信息 |
| `node dist/index.js version <path>` | 检测项目版本（3.8.55/3.8.75…） |
| `node dist/index.js export <path> <out> json\|binary` | 导出 JSON/二进制 |
| `node dist/index.js reader <json>` | 解析导出 JSON |
| `node dist/index.js mcp` | 启动 MCP 服务器（供客户端调用） |

## 7. 工具详解（70 个）

### 7.1 信息查询（8 个）

| 工具 | 说明 | 关键参数 |
|---|---|---|
| `spine_get_project_info` | 项目结构总览（骨骼/插槽/皮肤/动画） | projectPath |
| `spine_inspect_json` | 查看原始 JSON 片段 | projectPath, path |
| `spine_list_animations` | 动画列表与时长 | projectPath |
| `spine_list_events` | 事件定义列表 | projectPath |
| `spine_list_constraints` | 全部约束（IK/变换/路径） | projectPath |
| `spine_get_attachments` | 插槽可用附件 | projectPath, slotName |
| `spine_get_animation_detail` | 动画时间轴结构 | projectPath, animationName |
| `spine_render_preview` | JS 渲染动画单帧 PNG | skeletonJson/atlas/image + animationName |

### 7.2 骨架结构（9 个）

| 工具 | 说明 |
|---|---|
| `spine_control_bone` | 写骨骼关键帧（rotate/translate/scale/shear） |
| `spine_add_bone` / `spine_delete_bone` | 增删骨骼（删除自动重排权重网格索引） |
| `spine_set_bone` | 骨骼 Setup 姿态属性 |
| `spine_add_slot` / `spine_delete_slot` / `spine_set_slot` | 插槽增删与 Setup |
| `spine_rename_slot` | 重命名插槽（同步 skins/deform） |
| `spine_batch_rename` | 批量重命名骨骼/插槽 |

### 7.3 附件与皮肤（6 个）

| 工具 | 说明 |
|---|---|
| `spine_set_attachment` | 换装（设置插槽默认附件） |
| `spine_add_attachment` / `spine_delete_attachment` | 附件增删（region 需 width/height） |
| `spine_set_attachment_transform` | 附件位置/旋转/缩放/颜色 |
| `spine_edit_mesh` | 网格 setup 顶点 + deform FFD 关键帧 |
| `spine_set_skin` | 皮肤管理 |

### 7.4 约束（9 个）

IK / 变换 / 路径约束各 3 个：`spine_add_*`、`spine_set_*`（setup 或 animation 模式）、`spine_delete_*`。

> ⚠️ 约束 `order` 必须全类型唯一，工具自动处理。

### 7.5 动画（11 个）

`spine_add_simple_animation`（简单动画生成）、动画复制/删除/改名、`spine_set_animation_settings`（时长缩放）、`spine_control_slot`（插槽时间轴）、`spine_control_constraint`（约束时间轴）、`spine_add_event_keyframe`（事件）、`spine_set_draw_order`（绘制顺序）、`spine_set_curve`（曲线）、`spine_export_video`（占位）。

### 7.6 图集与项目（9 个）

| 工具 | 说明 |
|---|---|
| `spine_split_atlas` | 图集按部件拆分（region/连通域） |
| `spine_repack_atlas` | 部件重打包为 .atlas + png |
| `spine_import_image` | 附件纹理指向（region 名或绝对路径） |
| `spine_export` / `spine_import` / `spine_clean` | 导出 / 导入 / 清理 |
| `spine_create_project` | 创建空项目 |
| `spine_scale_project` | 整体缩放 |
| `spine_rollback` | 备份列表与回滚 |

### 7.7 Cocos 工具链（5 个）

`spine_list_cocos_assets`（扫描工作区）、`spine_validate_references`（引用完整性）、`spine_build_skeleton`（自动绑骨）、`spine_cut_parts`（散件切割）、`spine_assemble`（AI 装配绑骨）。

## 8. 实战：读取项目信息

对话示例：
> "帮我看看 D:/cocos/SpinePro3.8.75/examples/goblins/goblins-pro.spine 的结构"

AI 调用 `spine_get_project_info`，返回骨骼树、插槽、皮肤、动画等结构化数据。

## 9. 实战：修改动画关键帧

1. 复制项目到测试位置（避免改原始文件）
2. 对话：> "把 goblins 副本的 walk 动画 root 骨骼第 0 帧旋转改成 15 度"
3. AI 调用 `spine_control_bone`，自动备份原文件
4. 验证：重新导出查看 `angle=15`；或用 Spine 编辑器 Reopen 查看

> ⚠️ 修改后若 Spine 编辑器已打开，需 **File → Reopen** 加载最新文件；编辑器中保存会覆盖 AI 修改。

## 10. 实战：换装 / 皮肤

1. `spine_get_attachments` 查看可用附件
2. `spine_set_attachment` 切换插槽附件（如 head → hat）
3. 或 `spine_set_skin` 切换整套皮肤

## 11. 实战：约束（IK / 变换 / 路径）

1. `spine_add_ik` 创建 IK（bones + target）
2. `spine_set_ik` setup 改 mix；animation 模式写动画关键帧
3. `spine_control_constraint` 直接在动画指定帧写 mix

## 12. 实战：图集拆分（立绘 → 部件）

1. 准备图集：`examples/goblins/export/goblins.atlas` + `goblins.png`
2. `spine_split_atlas` mode=region 按区域提取；mode=split 做连通域拆分（分离贴合部件）
3. 得到独立部件 PNG，用于后续绑骨/换装

## 13. 实战：自动绑骨

1. 用拆分后的部件目录，可配 `partsIndex.json` 指定每个部件骨骼/位置
2. `spine_build_skeleton` 生成骨架 JSON（grid/list 布局）
3. 可 `importToProject` 直接导入生成 `.spine` 项目

## 14. 实战：渲染预览

1. 项目需已导出图集（`xxx.atlas` + `xxx.png`）
2. `spine_render_preview` 指定骨架 JSON / atlas / png / 动画 / 时间
3. 输出 PNG，AI 可据此确认动画效果（mesh 附件为近似绘制）

## 15. Cocos Creator 扩展

安装 `cocos-extension`（本地扩展或 `.ccx`），面板提供：服务启停、项目扫描、AI 配置生成、服务状态。详见 `docs/cocos-extension-README.md`。

## 16. 备份与回滚

- 每次修改自动生成 `xxx.spine.YYYY-MM-DDTHH-MM-SS.bak`
- `spine_rollback` 列出备份，`rollback` 参数可恢复指定备份
- 建议修改前先复制项目副本

## 17. 版本兼容性

- 目标：Spine 3.8.75
- 3.8.55 等旧版：尽力兼容 + WARNING 提示
- 4.x：JSON 格式差异较大，可能失败，建议降级至 3.8.75

## 18. 常见问题（FAQ）

**Q1: MCP 显示 No tools yet？**
A: 删除配置 → 重启客户端 → 重新添加。若仍失败，检查 `node dist/index.js mcp` 能否在命令行单独运行。

**Q2: 修改后 Spine 里看不到变化？**
A: 编辑器需 File → Reopen 重新加载；且确认查看的是动画模式而非 Setup 模式。

**Q3: 删骨骼失败（含权重网格）？**
A: 3.8 版本已支持自动重排；如仍报错，检查骨骼是否被约束引用。

**Q4: 图集拆分出的部件不完整？**
A: 用 mode=split 分离贴合部件；调节 alphaThreshold/minSize。

**Q5: 渲染预览空白？**
A: 确认已导出图集，且 atlas/png 与项目匹配（名称或子目录匹配）。

## 19. 安全与注意事项

- 本服务在**本机**运行，工具可读写本地 .spine 文件，请勿在不可信环境暴露
- 修改类操作会自动备份，但重要项目仍建议版本管理（Git）
- Spine 编辑器与 MCP 同时打开同一项目时，避免两边同时保存造成覆盖

## 20. 升级与维护

- 每次改动请 `npm run build` 后再接入客户端
- 更新后刷新 AI 客户端 MCP 连接，重启进程生效
- 测试：`npm run test:all`
