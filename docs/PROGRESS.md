# spine-mcp-server 开发进度文档

> 本文件为**当前完成进度**的唯一维护入口。每个开发阶段完成后由 AI 更新此文档，记录：完成项、验证结果、待办、用户测试步骤。
>
> 规格基准：[FINAL_SPEC.md](./FINAL_SPEC.md)（v3.0，55 个工具全量版）

## 进度总览

| Phase | 名称 | 状态 | 说明 |
|------|------|:----:|------|
| Phase 1 | 基础设施 | ✅ 完成 | 项目骨架 / CLI 封装 / 版本检测 / 配置中心 |
| Phase 2 | Spine 3.8.75 核心封装 | ✅ 完成 | project-reader / export / import / json-handler |
| Phase 3 | MCP 工具开发 - 基础 | ✅ 完成 | server / registry / 21 个基础工具 |
| Phase 4 | 高级骨骼模块 | ✅ 完成 | 约束 / 网格 / 曲线 / 事件 |
| Phase 5 | 图片拆分 + 骨骼构建 | ⬜ 未开始 | split_atlas / build_skeleton |
| Phase 6 | Cocos 集成 + 面板 UI | ⬜ 未开始 | 扩展面板 / Vue3 |
| Phase 7 | Web GUI（可选） | ⬜ 未开始 | 可视化面板 |
| Phase 8 | 测试与文档 | ⬜ 未开始 | 单测 / 集成 / 打包 |

图例：✅ 完成 · 🚧 进行中 · ⬜ 未开始 · ❌ 阻塞

---

## 环境锁定（已实测验证）

| 项 | 值 | 状态 |
|------|------|:--:|
| Spine CLI | `D:\cocos\SpinePro3.8.75\Spine.com`（3.8.75 Professional） | ✅ |
| Node.js | v22.20.0（要求 ≥20） | ✅ |
| npm | 10.9.3 | ✅ |
| Cocos Creator | 3.8.8（`C:\ProgramData\cocos\editors\Creator\3.8.8`） | ✅ |
| 测试素材 | Spine 自带 examples + D:\cocos 下真实项目 | ✅ |

### 关键 CLI 行为（实测，见 FINAL_SPEC 第 3 节）
- 信息：`Spine.com -i <project>` → stdout 含 `Spine version: x.y.z`、骨骼/插槽/动画列表
- 导出：`Spine.com -i <p> -o <dir> -e <settings.json>`（`-e` 是导出设置 JSON，非直接路径）
- 导入：`Spine.com -i <json> -o <p> -r <skeletonName>`（`-r` 导入）
- 清理：`Spine.com -i <p> -m`

---

## Phase 1：基础设施（已完成）

### 目标
搭建可编译、可运行、可调用 Spine.com 的最小工程骨架，验证全部基础假设。

### 任务清单

| # | 任务 | 状态 | 验证结果 |
|---|------|:----:|---------|
| 1.1 | 初始化 TS 项目（package.json / tsconfig / .gitignore / .env.example） | ✅ | 编译通过 |
| 1.2 | 安装依赖（typescript / @modelcontextprotocol/sdk / @types/node / sharp） | ✅ | 108 包，sharp 原生可用 |
| 1.3 | 实现 src/constants.ts、src/logger.ts、src/utils/error-codes.ts | ✅ | 编译通过 |
| 1.4 | 实现 src/spine/cli-executor.ts（封装 exec/spawn，超时 60s） | ✅ | info/version 命令实测可用 |
| 1.5 | 实现 src/spine/version-validator.ts（Info 命令解析版本） | ✅ | .spine→3.8.55 警告 / .json→3.8.75 ✅ |
| 1.6 | 实现 src/config-manager.ts（SPINE_EXE 统一配置） | ✅ | 自动检测 + .env 均可用 |
| 1.7 | 实现 src/index.ts 入口（check 命令） | ✅ | check/info/version/help 全部可用 |
| 1.8 | 构建 + 自测（真实 Spine.com 路径验证） | ✅ | 见下方验证表 |

> 注：规格 1.7「修复 auto_name_index 文件名 Bug」为历史遗留描述，本项目为全新开发，将在 Phase 5 split_atlas 的命名逻辑中直接保证 `part_01`（不产生 `part_0101`），无需修复既有代码。

### 当前进度明细（2026-08-22 完成 Phase 1）

**已完成文件**
```
package.json / tsconfig.json / .gitignore / .env.example / .env（本机）
src/constants.ts            — 55 个工具名常量、版本、超时等
src/logger.ts               — 分级日志（error/warn/info/debug，彩色 + 文件）
src/utils/error-codes.ts    — 15+ 错误码枚举 + SpineError 统一错误类
src/config-manager.ts       — SPINE_EXE 配置（.env/环境变量/自动检测）
src/spine/cli-executor.ts   — spawn 封装（超时 60s、退出码检测、统一错误码）
src/spine/version-validator.ts — .json 直读 / .spine 走 Info 命令解析版本
src/index.ts                — CLI 入口：check / info / version / help
```

**验证结果（本机实测）**
| 验证项 | 结果 |
|-------|:--:|
| npm install（108 包） | ✅ |
| sharp 原生库加载 | ✅ 无需编译，读 spineboy head.png 271x298 RGBA |
| `tsc` 编译（dist/） | ✅ 无报错 |
| `check` 命令（校验 Spine CLI） | ✅ 识别 SPINE_EXE=Spine.com，Launcher 3.8.75 |
| `version` 命令（.spine 二进制） | ✅ Info 命令解析到 3.8.55，正确输出兼容性警告 |
| `version` 命令（.json） | ✅ 解析 skeleton.spine=3.8.75，提示一致 |
| `info` 命令（goblins-pro.spine） | ✅ 输出骨骼 21 / 插槽 23 / 皮肤 2 / 动画 1 |
| 错误处理（文件不存在） | ✅ E_INVALID_ARGUMENT + 友好中文提示 + 退出码 1 |

**说明**：Spine 自带 examples 多为 3.8.55 格式（早于 3.8.75），版本检测正确区分「项目文件版本」与「应用版本」，并触发警告路径——这正是规格书 12 节设计的「尽力兼容，友好提示」行为。

### 用户测试步骤（Phase 1）

在项目根目录 `d:\cocos\spine-mcp-server` 打开 PowerShell，依次执行：

```powershell
# 1. 安装依赖（已装可跳过）
npm install

# 2. 编译
npm run build

# 3. 校验 Spine CLI 环境（应显示 Spine CLI + 配置摘要）
node dist/index.js check

# 4. 查看项目信息（换成你自己的 .spine 路径）
node dist/index.js info "D:/cocos/SpinePro3.8.75/examples/goblins/goblins-pro.spine"

# 5. 检测项目版本（.spine 二进制 / .json 都支持）
node dist/index.js version "D:/cocos/SpinePro3.8.75/examples/spineboy/spineboy-ess.spine"
node dist/index.js version "你的项目导出的.json"

# 6. 异常测试：传一个不存在的路径，应看到友好中文错误
node dist/index.js version "Z:/not-exist.spine"
```

**预期**：`check` 显示 Spine CLI 通过；`info` 输出骨骼/插槽/皮肤/动画；`version` 对 3.8.55 显示警告、对 3.8.75 显示 ✅；不存在路径提示 `E_INVALID_ARGUMENT` 且退出码 1。

---

## Phase 2：Spine 3.8.75 核心封装（已完成）

### 目标
封装 Spine CLI 的导出/导入/清理/信息能力，提供 JSON 深度操作层，打通「导出→修改→导入」核心工作流。

### 任务清单

| # | 任务 | 状态 | 验证结果 |
|---|------|:----:|---------|
| 2.1 | src/types.ts（核心数据类型） | ✅ | 编译通过 |
| 2.2 | utils/file-utils.ts（临时目录/备份） | ✅ | 备份/清理实测正常 |
| 2.3 | spine/info-service.ts（解析 -i 输出） | ✅ | 骨架名/fps/骨骼/皮肤/动画解析正确 |
| 2.4 | spine/project-reader.ts（JSON→结构化） | ✅ | hero 项目 31 骨/21 槽/8 动画/事件 |
| 2.5 | spine/export-service.ts（导出 json/binary） | ✅ | 两格式均导出成功 |
| 2.6 | spine/import-service.ts（-r 导入 + inPlace 替换） | ✅ | 往返验证关键帧回读一致 |
| 2.7 | spine/cleanup-service.ts（-m 清理） | ✅ | goblins 清理 0 未用关键帧 |
| 2.8 | spine/json-handler.ts（findBone/updateKeyframe/renameSlot/addBone/deleteBone/setAttachment/动画管理） | ✅ | 全部操作单测通过 |
| 2.9 | index.ts 新增 reader/export/import/clean/roundtrip 自测命令 | ✅ | 全部实测通过 |

### 当前进度明细（2026-08-22 完成 Phase 2）

**已完成文件**
```
src/types.ts                     — SpineProjectInfo/BoneInfo/SlotInfo/SkinInfo/AnimationInfo/ExportOptions 等
src/utils/file-utils.ts          — ensureDir/createTempDir/backupFile/listBackups/readJsonFile/writeJsonFile
src/spine/info-service.ts        — parseInfoOutput / getProjectInfo / getSkeletonName
src/spine/project-reader.ts      — parseProjectJson / readProjectJson / buildBoneTree（兼容 skins 数组/对象）
src/spine/export-service.ts      — generateExportSettings / exportProject / exportJson / exportBinary
src/spine/import-service.ts      — importJson / importJsonInPlace（原子替换）
src/spine/cleanup-service.ts     — cleanProject
src/spine/json-handler.ts        — frameToTime/findBone/findSlot/getBoneTree/updateBoneKeyframe/
                                     renameSlot/addBone/deleteBone/setAttachment/动画管理
src/index.ts                     — 新增 reader/export/import/clean/roundtrip 命令
```

**验证结果（本机实测）**
| 验证项 | 结果 |
|-------|:--:|
| 导出 JSON（goblins/hero） | ✅ 3.8.75 JSON 生成 |
| 导出二进制 .skel | ✅ |
| reader 解析（hero-pro） | ✅ 31 骨骼 / 21 插槽 / 8 动画(含时长帧数) / 事件 footstep |
| roundtrip（goblins + spineboy） | ✅ 导出→改 root 第0帧 rotation+10→原地导入→回读 angle=10 |
| import 创建新项目 | ✅ 骨架名 goblins-pro 生成 .spine |
| clean（-m） | ✅ 0 未使用关键帧 |
| json-handler 全操作 | ✅ renameSlot/addBone/deleteBone/setAttachment/动画增删复制改名/translate 关键帧 |

### ⚠️ 关键实测发现（影响规格书，务必记录）

1. **Spine 3.8.75 导出 JSON 的 `skins` 是数组格式** `[{ "name": "...", "attachments": {...} }]`，不是常见的 keyed 对象。代码已兼容两种格式，但规格书第 6/7 节未注明。✅ 已处理
2. **Round-Trip 导入不能直接 `-o` 已存在项目**（会静默丢失修改，实测）。正确做法：导入到**临时新文件**再**原子替换**原项目。代码已实现 `importJsonInPlace`。✅ 已处理
3. **图片/视频导出**：类名是 `images`（不是 `texture`），且完整 schema 在 CLI 上不直接可用（官方示例也只导 json/binary/atlas）。render_preview 的图片导出将在 **Phase 4** 专门解决。⚠️ 待 Phase 4
4. **Spine 3.8 网格变形时间轴键名是 `deform`**（不是 `ffd`）：结构为 `animations.<名>.deform.<皮肤名>.<插槽名>.<附件名>`。**自测发现的 bug**：`renameSlot` 最初漏同步 deform 中的插槽键，导致改名后导入被 Spine 拒绝（"Error reading animation: attack"）。已修复（`renameSlot` 同时更新 `deform`/`ffd`），并端到端验证：slots/skins/deform 全部同步、无残留、导入成功。⚠️ 影响 Phase 4 edit_mesh 的设计（需读写 deform）。✅ 已修复

### 用户测试步骤（Phase 2）

在项目根目录 `d:\cocos\spine-mcp-server` 打开 PowerShell：

```powershell
npm run build

# 1. 导出 JSON / 二进制
node dist/index.js export "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine" "%TEMP%\p2\hero-json" json
node dist/index.js export "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine" "%TEMP%\p2\hero-bin" binary

# 2. 解析导出 JSON（应显示 31 骨骼/21 插槽/8 动画/事件）
node dist/index.js reader "%TEMP%\p2\hero-json\hero-pro.json"

# 3. 完整往返测试（导出→改骨骼帧→原地导入→验证；在临时副本执行，不动原项目）
#    应显示：5) 验证 ✅ 关键帧写入成功并回读一致
node dist/index.js roundtrip "D:/cocos/SpinePro3.8.75/examples/goblins/goblins-pro.spine" "%TEMP%\p2\rt"

# 4. 导入创建新项目
node dist/index.js import "%TEMP%\p2\newproj.spine" "%TEMP%\p2\hero-json\hero-pro.json" "hero-pro"

# 5. 清理测试（在临时副本执行）
node dist/index.js clean "D:/cocos/SpinePro3.8.75/examples/goblins/goblins-pro.spine"
```

**预期**：export 各导出 1 个文件；reader 显示结构化信息；roundtrip 第 5 步显示 ✅ 回读一致；import 提示创建新项目并给出骨架名；clean 显示移除关键帧数（原项目不被改动）。

---

## Phase 3：MCP 工具开发 - 基础（已完成）

### 目标
构建 MCP stdio 服务器，注册 21 个基础工具，实现「AI 对话 → 工具调用 → Spine 操作」闭环。

### 任务清单

| # | 任务 | 状态 | 验证结果 |
|---|------|:----:|---------|
| 3.1 | server.ts + registry.ts（MCP stdio） | ✅ | 协议级测试 10/10 |
| 3.2 | info / inspect / list-animations 工具 | ✅ | 真实项目读取成功 |
| 3.3 | export / import 工具 | ✅ | 导出 + 创建新项目 |
| 3.4 | bones-control 工具（核心） | ✅ | 改帧回读 angle 一致 |
| 3.5 | clean / add_simple_animation 工具 | ✅ | 清理 + 模板动画 |
| 3.6 | rename-slot / batch-rename 工具 | ✅ | 重命名 + 正则批量 |
| 3.7 | add/delete-bone / add/delete-slot 工具 | ✅ | 增删操作 + 权重网格守卫 |
| 3.8 | set-attachment / set-skin 工具 | ✅ | 换装 + 皮肤管理 |
| 3.9 | duplicate/delete/rename-animation 工具 | ✅ | 动画管理 |
| 3.10 | rollback 工具 | ✅ | 备份列表 |
| 3.11 | render-preview 工具 | ⚠️ 占位 | 依赖 Phase 4 渲染方案 |

### 当前进度明细（2026-08-22 完成 Phase 3）

**已完成文件**
```
src/server.ts                    — MCP Server（stdio），list/call/error 处理
src/tools/base.tool.ts           — 工具基类（zod schema + 统一错误捕获）
src/tools/registry.ts            — 21 个工具注册表
src/tools/*.tool.ts (21个)       — info/inspect/list-animations/export/import/clean/
                                     bones-control/animation-generate/rename-slot/batch-rename/
                                     add-bone/delete-bone/add-slot/delete-slot/set-attachment/
                                     set-skin/duplicate-animation/delete-animation/
                                     rename-animation/rollback/render-preview
src/spine/modify-service.ts      — Round-Trip 统一封装 + readJsonForExport
src/index.ts                     — 新增 mcp 子命令（启动 stdio 服务器）
tests/self-test-tools.cjs        — 工具级自测（37 断言）
tests/self-test-mcp.cjs          — MCP 协议级自测（10 断言）
```

**验证结果（本机实测）**
| 测试 | 结果 |
|-------|:--:|
| 工具级自测 tests/self-test-tools.cjs | ✅ 37/37（含错误路径、权重网格守卫、回读验证） |
| MCP 协议级自测 tests/self-test-mcp.cjs | ✅ 10/10（listTools 21 个 + callTool + 参数错误 + 未知工具 + 改帧回读） |
| Phase 1+2 CLI 回归（check/version/roundtrip/reader） | ✅ 全部正常 |
| `node dist/index.js mcp` 启动 stdio | ✅ Client 可连接 |

### ⚠️ 自测发现并修复的问题
1. **exportJsonForRead 临时目录过早删除** → 只读工具读不到文件。改为 `readJsonForExport` 返回解析对象后清理。✅
2. **set_attachment 覆盖附件数据**：原实现把附件条目覆写为 `{}`，丢失 region/mesh 数据导致 Spine 拒绝。改为「更新插槽默认附件 + 保留已有数据」，并校验附件名存在（不存在 → E_ATTACHMENT_NOT_FOUND 并列出可用附件）。✅
3. **delete_bone 与权重网格**：实测发现 Spine 3.8 加权网格 vertices 格式为 `[count, (boneIndex,x,y,weight)×count]`，删除任何骨骼都会使顶点骨骼索引失效（`IndexOutOfBounds`）。Phase 3 实现**守卫**：项目含权重网格时 delete_bone 返回明确错误；完整重排索引在 Phase 4/5（做网格时）实现。✅ 已守卫
4. **get_project_info 错误路径** → 补文件存在性校验，返回 E_INVALID_ARGUMENT。✅
5. **import 到不存在目标** → 支持创建新项目。✅

### 用户接入步骤（AI 客户端配置）

在 Trae / Cursor / Claude Desktop 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "spine-mcp": {
      "command": "node",
      "args": ["D:/cocos/spine-mcp-server/dist/index.js", "mcp"],
      "env": {
        "SPINE_EXE": "D:/cocos/SpinePro3.8.75/Spine.com",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

配置后 AI 客户端应能列出 21 个 `spine_*` 工具。典型对话示例：
- "查看 D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine 的项目信息"
- "把 goblins-pro.spine 的 walk 动画 root 骨骼第 0 帧旋转改为 15 度"（会自动备份）

> ⚠️ **需要用户验证的部分**：Trae/Cursor/Claude Desktop 实际连接配置、工具在 AI 对话中的真实调用体验。这部分我无法自测。

**下一步**：Phase 4（高级骨骼模块：约束 IK/变换/路径、网格 edit_mesh、曲线/事件/绘制顺序、list-events/constraints/attachments/animation-detail 查询、图片渲染 render_preview）。

---

## Phase 4：高级骨骼模块（已完成）

### 目标
补齐 Spine 高级能力：约束系统（IK/变换/路径）、网格编辑（setup + FFD deform）、附件完整管理、曲线/事件/绘制顺序、项目级操作。工具总数 21 → **50 个**。

### 任务清单

| # | 任务 | 状态 | 验证结果 |
|---|------|:----:|---------|
| 4.1 | 高级信息查询（list-events/constraints/attachments/animation-detail） | ✅ | 真实项目读取成功 |
| 4.2 | set-bone / set-slot（Setup 属性） | ✅ | 改 root 位置 / blend 成功 |
| 4.3 | 附件（add/delete/set-transform） | ✅ | region 附件增删改 |
| 4.4 | edit-mesh（setup + deform FFD） | ✅ | 网格尺寸 + 变形关键帧 |
| 4.5 | IK 约束三件套 | ✅ | add/set(setup+animation)/delete |
| 4.6 | 变换约束三件套 | ✅ | 含 mix/offset 属性 |
| 4.7 | 路径约束三件套 | ✅ | stretchyman 实测 |
| 4.8 | control-slot / control-constraint | ✅ | 插槽/约束时间轴关键帧 |
| 4.9 | 事件 / 绘制顺序 / 曲线 / 动画时长 | ✅ | 全部实测 |
| 4.10 | create-project / scale-project / import-image | ✅ | 实测 |
| 4.11 | export-video | ⚠️ 占位 | 依赖 JS 渲染方案 |
| 4.12 | **delete_bone 权重网格重排（解除 Phase 3 守卫）** | ✅ | goblins 实测删除成功 |

### 当前进度明细（2026-08-22 完成 Phase 4）

**新增文件**：29 个工具文件 + json-handler 高级函数（约束/附件/网格/事件/绘制/曲线/时长缩放/权重网格重排/scaleProjectJson）+ tests/self-test-p4.cjs

**验证结果**
| 测试 | 结果 |
|-------|:--:|
| Phase 4 自测 tests/self-test-p4.cjs | ✅ 45/45 |
| Phase 3 回归 tests/self-test-tools.cjs | ✅ 37/37 |
| MCP 协议 tests/self-test-mcp.cjs | ✅ 10/10（listTools = 50 个工具） |

### ⚠️ 自测发现并修复的问题（重要）
1. **约束 order 必须在所有类型（ik/transform/path）间唯一递增**：原按 type 内长度算，导致 `Missing constraint order`。已改为取全类型最大 order + 1。✅
2. **draworder offsets 必须按插槽原始顺序排序**（offset 值为新顺序中的位置）：实测多 offset 直接写会 `Error reading animation`。已实现排序。✅
3. **region 附件需要 width/height**：缺省导致 `Named value not found: width`。工具文档已注明。✅
4. **权重网格重排（Phase 4 完成）**：实现加权网格 vertices `[count,(bi,x,y,w)×count]` 的骨骼索引重排，**解除 Phase 3 的 delete_bone 守卫**——现在含权重网格的项目也能删除骨骼了（goblins spear1 实测成功）。✅
5. import_image：仅对绝对路径做存在性校验（图集 region 名为相对名）。✅
6. **render_preview / export_video 仍为占位**：Spine 3.8.75 CLI 的图片/视频导出 schema 不可直接使用，完整方案需 JS Spine 运行时渲染（延后至后续阶段，标注在工具描述中）。⚠️

**下一步**：Phase 5（图片拆分 split_atlas + 自动绑骨 build_skeleton + 图集重打包 repack_atlas，含 JS 渲染方案 render_preview 的完整实现）。
