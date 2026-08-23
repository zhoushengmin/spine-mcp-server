# Spine MCP Server — Cocos Creator 扩展

Cocos Creator 3.8+ 可视化面板：一键启动 MCP 服务、扫描 Spine 项目、调用 Spine 工具、生成 AI 客户端配置。

## 安装（两种方式）

### 方式 A：本地扩展（推荐开发测试）
1. 打开 Cocos Creator → 菜单 **扩展 → 扩展管理器 → 本地扩展**
2. 点击 **添加本地扩展**，选择本目录 `cocos-extension`
3. 扩展列表出现 **Spine MCP Server**，勾选启用
4. 菜单 **扩展 → Spine MCP Server** 打开面板

### 方式 B：.ccx 安装包
1. 运行 `node scripts/package-ccx.js` 生成 `dist-ccx/spine-mcp-panel.ccx`
2. 在 Cocos 扩展管理器中 **导入 .ccx** 安装

## 使用流程

1. **配置 Spine 路径**：面板「基本配置」中填写 `Spine.com` 路径（如 `D:/cocos/SpinePro3.8.75/Spine.com`），点击保存
2. **配置工作区**：填写包含 .spine 文件的目录（如 Cocos 项目 `assets` 文件夹）
3. **启动服务**：点击「启动服务」，状态灯变绿
4. **复制 AI 配置**：点击「生成配置」→「一键复制」，粘贴到 Trae / Cursor 的 MCP 配置
5. **扫描项目**：项目列表显示工作区内的 .spine，点击可查看信息、调用快速工具

## 要求

- Cocos Creator 3.8+
- Spine.com（Professional 版）已安装
- 服务器已 `npm run build`（安装向导自动处理）
- 服务器路径可在面板「Server 路径」中配置（默认 `D:/cocos/spine-mcp-server`）

## 环境检测与安装向导

运行 `node scripts/installer.js` 可自动检测 Spine/Cocos/Node 并写入 `.env`、安装依赖、构建服务器。
