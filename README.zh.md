# 🦴 Spine MCP Server

[![中文](https://img.shields.io/badge/lang-中文-red)](README.zh.md) [![EN](https://img.shields.io/badge/lang-EN-blue)](README.md)

> AI 驱动的 Spine 3.8.75 动画工作流服务 · 供 Trae / Cursor / Claude Desktop / Codex / Windsurf / Cline 等 AI 客户端直接调用 Spine 编辑器能力

[![Node](https://img.shields.io/badge/Node-%3E%3D20-339933)](https://nodejs.org) [![Spine](https://img.shields.io/badge/Spine-3.8.75-yellow)](https://esotericsoftware.com) [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## 📖 简介

**Spine MCP Server** 是一个基于 [MCP（Model Context Protocol）](https://modelcontextprotocol.io) 的服务器，把 **Spine 3.8.75 Professional** 的编辑器能力封装成 55 个工具，让 AI 可以直接：

- 读取 Spine 项目（骨骼 / 插槽 / 皮肤 / 动画 / 事件 / 约束）
- 修改动画关键帧（旋转 / 位移 / 缩放 / 切变 / 曲线）
- 编辑骨架结构（增删骨骼 / 插槽 / 附件 / 皮肤 / 换装）
- 操作约束（IK / 变换 / 路径）与网格（FFD 变形）
- 图集拆分（立绘拆部件）、自动绑骨、图集重打包
- JS 运行时渲染动画预览帧
- 通过 Cocos Creator 扩展面板一键配置 / 启停服务 / 生成 AI 客户端配置

## ✨ 特性

| 能力 | 说明 |
|---|---|
| 55 个 MCP 工具 | 覆盖 Spine 全部功能域（信息/骨架/附件/约束/动画/图集/项目） |
| Round-Trip 修改 | 导出 JSON → 修改 → 原地导入，**自动备份**（`.bak`） |
| 版本兼容 | 锁定 Spine 3.8.75，非 3.8.75 友好提示 |
| Cocos 扩展 | Cocos Creator 3.8+ 可视化面板 + `.ccx` 打包 |
| 安装向导 | 一键检测环境 + 写入配置 |

## 🔧 环境要求

- **Node.js ≥ 20**（开发机实测 v22）
- **Spine.com**（3.8.75 Professional，位于 `D:\cocos\SpinePro3.8.75\Spine.com`）
- 可选：Cocos Creator 3.8+（扩展面板）

## 🚀 快速开始

```bash
# 1. 安装依赖 + 构建
npm install
npm run build

# 2. 配置 Spine 路径（或直接运行安装向导）
npm run installer        # 自动检测 Spine/Cocos/Node 并写 .env

# 3. 验证
node dist/index.js check
node dist/index.js info "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine"
```

## 🤖 配置到 AI 客户端

把以下配置加入 Trae / Cursor / Claude Desktop 的 MCP 服务器配置：

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

> ⚠️ 若 MCP 连接后显示 "No tools yet"，请重启 AI 客户端让服务器进程重新拉起。

## 🧩 工具一览（55 个）

| 分类 | 工具 |
|---|---|
| 信息查询 (8) | get_project_info · inspect_json · list_animations · list_events · list_constraints · get_attachments · get_animation_detail · render_preview |
| 骨架结构 (9) | control_bone · add_bone · delete_bone · set_bone · add_slot · delete_slot · set_slot · rename_slot · batch_rename |
| 附件与皮肤 (6) | set_attachment · add_attachment · delete_attachment · set_attachment_transform · edit_mesh · set_skin |
| 约束 (9) | add/set/delete × {ik, transform, path} |
| 动画 (11) | add_simple_animation · duplicate/delete/rename_animation · set_animation_settings · control_slot · control_constraint · add_event_keyframe · set_draw_order · set_curve · export_video |
| 图集与项目 (9) | split_atlas · repack_atlas · import_image · export · import · clean · create_project · scale_project · rollback |
| Cocos 工具链 (3) | list_cocos_assets · validate_references · build_skeleton |

## 🎮 Cocos 扩展

`cocos-extension/` 提供 Cocos Creator 3.8+ 面板：

- 安装：扩展管理器 → 本地扩展 → 添加 `cocos-extension` 目录（或 `npm run package:ccx` 生成 `.ccx` 导入）
- 功能：启动 MCP 服务 / 扫描项目 / 生成 AI 配置 / 服务状态
- 详见 [docs/cocos-extension-README.md](docs/cocos-extension-README.md)

## 🧪 测试

```bash
npm run test:all     # 全部套件一键跑（单元 + 集成 + MCP 协议 + 扩展桥接）
npm run test:unit    # 单元测试（node:test）
```

测试矩阵：单元 **20/20** · Phase 3 **37/37** · Phase 4 **45/45** · Phase 5 **13/13** · MCP 协议 **10/10**（55 工具）· 扩展桥接 **12/12**

## 📚 文档

- [用户手册 (中文)](docs/USER_MANUAL.md)
- [User Manual (EN)](docs/USER_MANUAL.en.md)
- [Cocos 扩展说明 (中文)](docs/cocos-extension-README.md)
- [Cocos Extension README (EN)](docs/cocos-extension-README.en.md)

## 🗂 项目结构

```
├── src/                  # 源码（TS）
│   ├── server.ts         # MCP stdio 服务器
│   ├── spine/            # 核心：cli-executor / json-handler / export / import / render / split ...
│   ├── tools/            # 55 个工具（registry.ts 注册）
│   └── utils/            # 配置 / 日志 / 错误码 / 文件工具
├── cocos-extension/      # Cocos Creator 扩展（面板）
├── scripts/              # 安装向导 / .ccx 打包
├── tests/                # 全部测试套件
└── docs/                 # 文档
```

## 💰 购买支持

在 [Swarms Marketplace](https://swarms.world/agent/c44211d8-0ed5-4948-8c4e-10e63f465bc3) 购买支持本项目

## 📄 License

MIT