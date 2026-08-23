# Spine MCP Server — 5 分钟演示脚本

用途：录制 5 分钟演示视频（安装 → 配置 → 拆图 → 骨骼控制）。
每个场景给出：**画面内容**、**操作/命令**、**旁白文案**。

---

## 场景 1：开场 + 环境验证（00:00 - 00:30）

**画面**：终端窗口，项目目录

```bash
cd D:\cocos\spine-mcp-server
node dist/index.js check
```

**旁白**：
"这是 Spine MCP Server——一个让 AI 直接操作 Spine 3.8.75 的服务。首先验证环境：check 命令显示 Spine CLI 校验通过，检测到 Professional 版。"

---

## 场景 2：配置到 AI 客户端（00:30 - 01:20）

**画面**：AI 客户端 MCP 配置界面，粘贴 JSON 配置；工具列表出现 55 个 spine_* 工具

```json
{ "mcpServers": { "spine-mcp": {
  "command": "node",
  "args": ["D:/cocos/spine-mcp-server/dist/index.js", "mcp"],
  "env": { "SPINE_EXE": "D:/cocos/SpinePro3.8.75/Spine.com" } } } }
```

**旁白**：
"把配置粘贴到 AI 客户端，重启后能看到 55 个 Spine 工具。现在 AI 就能直接读取和修改 Spine 项目了。"

---

## 场景 3：读取项目信息（01:20 - 02:00）

**画面**：AI 对话窗，输入指令 → 返回项目信息

**对话输入**：
> 查看 D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine 有哪些动画

**旁白**：
"让 AI 查看 hero 项目：返回了 8 个动画、31 根骨骼、21 个插槽、2 个皮肤——全部结构化数据，AI 可以据此进行后续操作。"

---

## 场景 4：修改动画关键帧（02:00 - 02:50）

**画面**：AI 对话 + Spine 编辑器 Reopen 对比

**对话输入**：
> 把 hero 的 idle 动画 head 骨骼第 0 帧旋转改成 30 度

**旁白**：
"这是核心能力——修改动画关键帧。AI 调用 control_bone 工具，自动备份后写入。回到 Spine 编辑器，File 重新打开，head 骨骼已经旋转了 30 度。整个修改都是可回滚的。"

---

## 场景 5：图集拆分（02:50 - 04:00）

**画面**：Web GUI 拆图页，输入 atlas/png，点击拆分，展示部件缩略图

```bash
npm run web    # 打开 http://localhost:3000
```

**对话输入（或 Web GUI 操作）**：
> 用 goblins 图集拆分部件

**旁白**：
"立绘到骨骼的关键一步——图集拆分。通过 Web GUI 或 AI 调用 split_atlas，把一张图集拆成 41 个独立部件，支持连通域拆分，能分离贴合在一起的手臂和身体。"

---

## 场景 6：自动绑骨 + 导出（04:00 - 04:50）

**画面**：build_skeleton 生成骨架，导出到 Cocos

**对话输入**：
> 把拆分出的部件自动绑骨，导出到 Cocos 项目

**旁白**：
"用 build_skeleton 自动生成骨架和插槽，配合图集重打包，就能把一张立绘快速变成 Cocos 里可用的 Spine 资源。"

---

## 场景 7：收尾（04:50 - 05:00）

**画面**：项目结构 / 文档 / 测试

```bash
npm run test:all
```

**旁白**：
"完整的工具链、Cocos 扩展面板、Web GUI 和中文文档都已就绪，测试全部通过。让 AI 帮你做 Spine 动画，从这里开始。"

---

## 录制建议

1. 用 OBS 或系统录屏，1920x1080
2. 每个场景前停留 1 秒再开始操作
3. 命令字号调大（Ctrl+鼠标滚轮放大终端）
4. 关键操作加鼠标高亮（OBS 放大）
5. 若需要口播，用 edge-tts 生成中文配音
