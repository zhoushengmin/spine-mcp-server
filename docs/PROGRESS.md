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
| Phase 5 | 图片拆分 + 骨骼构建 | ✅ 完成 | split_atlas / build_skeleton / repack_atlas / JS 渲染 |
| Phase 6 | Cocos 集成 + 面板 UI | ✅ 完成 | cocos-extension 面板 / 安装向导 / .ccx |
| Phase 7 | Web GUI（可选） | ✅ 完成 | 可视化面板（5 页） |
| Phase 8 | 测试与文档 | ✅ 完成 | 单元测试 / README / 用户手册 / 演示脚本 / .ccx |

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

---

## Phase 5：图片拆分 + 骨骼构建（已完成）

### 目标
补齐「立绘 → 骨骼」的关键链路：图集拆分（split_atlas）、部件重打包（repack_atlas）、自动绑骨（build_skeleton）、JS 运行时渲染（render_preview 完善）。工具总数 50 → **54 个**。

### 任务清单

| # | 任务 | 状态 | 验证结果 |
|---|------|:----:|---------|
| 5.1 | split_atlas（region 提取 + 透明清理 + 连通域拆分） | ✅ | goblins 41 region / split 模式 118 部件 |
| 5.2 | repack_atlas（Shelf 排布 → .atlas + png） | ✅ | 8 图打包格式正确 |
| 5.3 | render_preview（JS 运行时渲染：骨骼矩阵 + 关键帧插值 + 附件合成） | ✅ | hero idle 渲染 512x512，7 附件 12.5% 像素 |
| 5.4 | build_skeleton（部件→骨骼/插槽/附件，可导入 .spine） | ✅ | grid/list 布局 + 导入成功 |
| 5.5 | validate_references（引用完整性校验） | ✅ | hero 合法 / 伪造项目检出 3+ 问题 |

### 当前进度明细（2026-08-22 完成 Phase 5）

**新增文件**：atlas-utils（.atlas 解析）、split-atlas-service、repack-atlas-service、render-service、build-skeleton-service + 4 个新工具 + tests/self-test-p5.cjs；重写 render-preview.tool（占位 → 完整实现）

**验证结果**
| 测试 | 结果 |
|-------|:--:|
| Phase 5 自测 tests/self-test-p5.cjs | ✅ 13/13 |
| Phase 3 回归 tests/self-test-tools.cjs | ✅ 37/37 |
| Phase 4 回归 tests/self-test-p4.cjs | ✅ 45/45 |
| MCP 协议 tests/self-test-mcp.cjs | ✅ 10/10（listTools = 54 个工具） |

### ⚠️ 自测发现并修复的问题（重要）
1. **atlas 解析 region 名被吞**：region 名是裸行，旧逻辑只在 `!currentRegion` 时识别，后续 region 全部丢失（只解析出 1 个）。已改为「每遇到裸行即 flush 前一 region」。✅
2. **validate_references 不支持 .json 输入**：旧实现总是走 CLI 导出。已加扩展名判断，.json 直接读取。✅
3. **render_preview 完整实现**：用 sharp 实现骨骼世界矩阵（Spine Bone.update 算法）+ rotate/translate/scale/shear 关键帧线性插值 + region 附件合成。⚠️ 限制：**mesh 附件按未变形 region 近似绘制**（不做顶点扭曲），shear 参与矩阵但绘制只支持旋转/缩放。

**下一步**：Phase 6（Cocos Creator 扩展面板 UI + 场景集成 + .ccx 打包）。

---

## Phase 6：Cocos 集成 + 面板 UI（已完成）

### 目标
提供 Cocos Creator 3.8 可视化扩展面板：一键启动 MCP 服务、扫描 Spine 项目、调用 Spine 工具、生成 AI 客户端配置。工具总数 54 → **55 个**（补 spine_list_cocos_assets，与规格书一致）。

### 任务清单

| # | 任务 | 状态 | 验证结果 |
|---|------|:----:|---------|
| 6.1 | cocos-extension/package.json 扩展清单 | ✅ | 清单 + 面板 + 9 个消息方法 |
| 6.2 | asset-scanner（递归扫描 .spine） | ✅ | examples 扫描 15+ 项目 |
| 6.3 | spine_list_cocos_assets 工具 | ✅ | 注册到 MCP（55 个） |
| 6.4 | panel.js 面板 UI（模板/样式/方法） | ✅ | 模板/样式/10 个方法齐备 |
| 6.5 | main.js 主进程（面板桥接 + 服务启停 + 配置持久化） | ✅ | mock 测试 12/12 |
| 6.6 | 新手引导（三步） | ✅ | 模板内实现 |
| 6.7 | scripts/installer.js 安装向导 | ✅ | 检测 Spine/Cocos/Node + 写 .env |
| 6.8 | scripts/package-ccx.js .ccx 打包 | ✅ | 生成 7.5 KB .ccx |

### 当前进度明细（2026-08-22 完成 Phase 6）

**新增文件**：cocos-extension/（package.json、main.js、panel/panel.js）、src/spine/asset-scanner.ts、spine_list_cocos_assets 工具、scripts/installer.js、scripts/package-ccx.js、docs/cocos-extension-README.md、tests/self-test-extension.cjs

**验证结果**
| 测试 | 结果 |
|-------|:--:|
| 扩展桥接 tests/self-test-extension.cjs（mock Editor） | ✅ 12/12 |
| Phase 3 回归 | ✅ 37/37 ｜ Phase 4 回归 | ✅ 45/45 |
| Phase 5 回归 | ✅ 13/13 ｜ MCP 协议（listTools = 55） | ✅ 10/10 |
| .ccx 打包 | ✅ dist-ccx/spine-mcp-panel.ccx |

### ⚠️ 需要用户验证的部分（Cocos 编辑器 UI 无法自测）
1. 在 Cocos Creator 中安装扩展：**扩展 → 扩展管理器 → 本地扩展 → 添加本地扩展 → 选择 `cocos-extension` 目录**
2. 打开面板：**扩展 → Spine MCP Server**
3. 验证：Spine 路径检测、服务启动状态灯、工作区扫描、AI 配置生成/复制、项目信息查看、快速工具调用

**下一步**：Phase 8 测试与文档（或按需先做 Phase 7 Web GUI）。

---

## Phase 7：Web GUI 可视化面板（已完成）

### 目标
提供本地 Web 可视化面板（Vue 3 + Node 内置 http，复用 55 个 MCP 工具作为 API），作为 Cocos 扩展面板的补充。

### 任务清单

| # | 任务 | 状态 | 验证结果 |
|---|------|:----:|---------|
| 7.1 | Node http 服务器（静态 + /api/*） | ✅ | status/tools/projects/info/tool/preview/export-copy |
| 7.2 | 拆图页面（split_atlas 可视化 + 部件展示） | ✅ | 41 部件 + /files/ 图片可访问 |
| 7.3 | 骨骼编辑页面（骨骼树 + control_bone） | ✅ | 加载骨骼 + 写入关键帧 |
| 7.4 | 动画预览页面（时间轴 + 渲染） | ✅ | hero idle 渲染 7 附件 |
| 7.5 | 导出页面（复制到 Cocos 项目） | ✅ | 复制 3 文件（spine+atlas+png） |
| 7.6 | Vue3 前端应用（5 页） | ✅ | 页面/样式/逻辑加载正常 |

### 当前进度明细（2026-08-22 完成 Phase 7）

**新增文件**：webgui/server.js、webgui/public/{index.html, style.css, app.js}

**验证结果（服务器实测）**
| API | 结果 |
|-----|:--:|
| GET /api/status | ✅ 55 工具 |
| GET /api/projects?dir= | ✅ 扫描 |
| GET /api/info?project= | ✅ 项目信息 |
| POST /api/tool（split_atlas） | ✅ 41 部件 + 图片 URL |
| GET /api/preview（hero idle） | ✅ 512x512 渲染 |
| POST /api/export-copy | ✅ 3 文件 |

### ⚠️ 自测发现并修复的问题
1. **工具返回结构访问错误**：映射拆分输出时误用 `plain.result.data.*`（工具返回无 `.result` 包装层），导致部件图片 URL 未生成。已修为 `plain.data.*`。✅
2. **atlas 自动发现**：hero 项目导出图集名为 `hero.atlas` 而项目名为 `hero-pro.spine`，匹配失败。已改为「递归搜索 + 基础名匹配（去掉 -pro/-ess 后缀）」。✅
3. **export-copy atlas 匹配**：同样按基础名匹配，goblins-pro 正确复制 goblins.atlas/png。✅

### 使用方式
```bash
npm run web          # 启动 http://localhost:3000（或 node webgui/server.js）
```
浏览器打开 http://localhost:3000，5 个页签：项目 / 拆图 / 骨骼 / 预览 / 导出。

**下一步**：Phase 8 测试与文档（单测、README、用户手册、演示视频、.ccx 上架）。

---

## Phase 8：测试与文档（已完成）

### 目标
补齐测试体系与用户文档：单元测试、统一集成测试、中英 README、用户手册、演示脚本、.ccx 打包验证。

### 任务清单

| # | 任务 | 状态 | 验证结果 |
|---|------|:----:|---------|
| 8.1 | 单元测试（node:test，零依赖） | ✅ | 20/20（json-handler/atlas/权重网格） |
| 8.2 | 统一集成测试 `npm run test:all` | ✅ | 137 项断言全通过 |
| 8.3 | README.md（中英双语） | ✅ | 项目根目录 |
| 8.4 | 用户手册 USER_MANUAL.md（21 章）+ 打印 HTML | ✅ | 可浏览器打印为 PDF |
| 8.5 | 演示脚本 DEMO_SCRIPT.md（5 分钟 7 场景） | ✅ | 含旁白/操作/命令 |
| 8.6 | .ccx 打包验证 | ✅ | dist-ccx/spine-mcp-panel.ccx |

### 当前进度明细（2026-08-22 完成 Phase 8）

**新增文件**：tests/unit-tests.mjs（20 个单元测试）、README.md、docs/USER_MANUAL.md、docs/USER_MANUAL.html、docs/DEMO_SCRIPT.md、scripts/gen-manual-html.js

**最终测试矩阵（npm run test:all）**
| 套件 | 结果 |
|------|:--:|
| 单元测试（node:test） | ✅ 20/20 |
| Phase 3 工具集成 | ✅ 37/37 |
| Phase 4 工具集成 | ✅ 45/45 |
| Phase 5 工具集成 | ✅ 13/13 |
| MCP 协议 | ✅ 10/10（55 工具） |
| Cocos 扩展桥接 | ✅ 12/12 |
| **合计** | ✅ **137 项断言** |

**自测发现并修复**：findRegion 未匹配 region 子目录前缀（goblin/head vs head）→ 已修复并补单元测试；权重网格重排测试数据修正。

---

## 补充：占位功能补齐（2026-08-23 完成）

### 目标
消除 render_preview / export_video 两个占位项，让 55 个工具全部可用：
- **render_preview**：从「mesh 附件按未变形 region 近似绘制」升级为**真实网格顶点变形渲染**（软件三角形光栅化）。
- **export_video**：从占位工具升级为**完整视频导出**（JS 逐帧渲染 → GIF/MP4/WebM）。

### 变更内容
1. **src/spine/render-service.ts 重写**：
   - 软件三角形光栅化器（重心坐标 + 双线性纹理采样 + 预乘 alpha src-over）
   - mesh 附件真实顶点计算：支持**加权（蒙皮多骨骼权重混合）与非加权** mesh、**deform FFD**（offset + 逐顶点偏移）
   - region 附件也走同一光栅化路径（2 三角形），保证绘制顺序正确
   - 新增 `renderFrameToRgba`（返回 RGBA Buffer）、`renderAnimationFrames`（多帧序列）；`renderFrame` 保持兼容
2. **src/utils/gif-encoder.ts（新增）**：纯 JS GIF89a 编码器（零依赖）
   - 中位切分颜色量化（透明色保留）
   - GIF 标准 LZW 压缩（可变码宽 9→12 位，字典满自动 clear）
   - 提供 encodeGif / encodeLZW / decodeLZW（后者用于往返自测）
3. **src/tools/export-video.tool.ts 重写**：
   - 支持 projectPath（自动导出 JSON + 定位 atlas/png）或直接传产物
   - 默认输出 GIF（纯 JS，任意环境可用）；检测到 ffmpeg（FFMPEG_PATH 或 PATH）可输出 MP4/WebM
   - 无 ffmpeg 请求 mp4/webm 时返回明确提示
4. **tests/self-test-render.cjs（新增，14 项）**：mesh 渲染非空白 / 多帧序列 / LZW 往返（含字典增长）/ GIF sharp 可解码 / export_video 成功与错误路径。

### 验证结果（本机实测）
| 测试 | 结果 |
|------|:--:|
| render_preview hero idle（7 个加权 mesh 附件） | ✅ 512x512 非空白，包围盒居中（中心 x≈306/y≈248，画布中心 256） |
| renderAnimationFrames idle 8 帧 | ✅ 帧内容随动画变化 |
| GIF LZW 往返（pattern/字典增长/random） | ✅ 全通过 |
| GIF sharp + PIL 解码 | ✅ 2 帧动画可解码、尺寸/颜色正确 |
| export_video GIF（hero idle） | ✅ 8 帧 GIF 可解码 |
| **test:all 全量回归** | ✅ **151 项断言全通过**（20 单测 + 37 P3 + 45 P4 + 13 P5 + 14 render + 10 MCP + 12 ext） |

### ⚠️ 自测发现并修复的问题
1. **GIF LSD 色表大小字节错误**：packed 写 0x80（声明 2 色）但写了 768 字节全局色表 → libvips/PIL 解析错位报 "Invalid frame data"。改为 0x87（256 色）。✅
2. **GIF LZW 编码增宽时机**：`nextCode == 2^codeSize` 时增宽会导致解码端错位（bad code 992）；改为 `nextCode > 2^codeSize`（与解码端 `dict.length == 2^codeSize` 对齐）。✅
3. **GCE 透明索引写错位置**：透明索引应位于 gce[6]，delay 位于 gce[4..5]。✅
4. **export_video GIF 分支漏写文件**：encodeGif 后未 fs.writeFileSync。✅

### 说明
- mesh 渲染限制：附件染色（color）、路径约束、剪切附件（clipping）暂不支持；region 附件旋转/缩放/变形均支持。
- 视频导出：GIF 为纯 JS 编码，任意环境可用；MP4/WebM 依赖 ffmpeg（设置 FFMPEG_PATH 或加入 PATH）。

**下一步**：录制演示视频、Cocos Store 上架资料、真实项目工作流验证。

---

## 补充：Cocos 扩展菜单修复（2026-08-23）

### 问题
用户验证 Phase 6 扩展时发现：导入 `cocos-extension` 后有 `spine-mcp-panel`，但 **扩展 → Spine MCP Server 菜单不出现**。

### 根因（2 处）
1. **package.json 缺 `contributions.menu`**：Cocos Creator 3.x 的菜单项必须通过 `contributions.menu` 注册（`{ path: "扩展/Spine MCP Server", message: "<扩展名>:open-panel" }`），原清单只有 `panel`/`messages`，故面板存在但无菜单入口。
2. **panel.js 消息扩展名错误**：所有 `Editor.Message.request('spine-mcp', ...)` 的扩展名应为实际包名 `spine-mcp-panel`，写成了 `spine-mcp`（该名称是 AI 客户端里 MCP server 的名字，不是 Cocos 扩展名）→ 即使打开面板，消息调用也全部失败。

### 修复
| 文件 | 变更 |
|------|------|
| `cocos-extension/package.json` | 新增 `contributions.menu`（扩展/Spine MCP Server）+ `messages` 增加 `spine-mcp-panel:open-panel` |
| `cocos-extension/main.js` | `methods` 增加 `open-panel`（`Editor.Panel.open('spine-mcp-panel')`）；子进程 stderr 改直接输出控制台 |
| `cocos-extension/panel/panel.js` | 10 处 `'spine-mcp'` → `'spine-mcp-panel'` |

### 验证
- `tests/self-test-extension.cjs` ✅ 12/12
- `npm run package:ccx` ✅ 重新打包 7.6 KB

### 用户重新验证步骤
1. 关闭并重开 Cocos Creator（或 扩展管理器 → 刷新）
2. 若仍是旧版本：先**移除**该扩展，再重新导入 `cocos-extension` 目录并勾选启用
3. 菜单 **扩展 → Spine MCP Server** 应出现，点击打开面板
4. 面板应能读取配置/扫描项目/启动服务（消息通道已修正）

### 二次修复（同批验证发现）
用户反馈：菜单出现了但显示 **undefined**，点击报错 `Panel(spine-mcp-panel) is not defined`。
- **根因**：面板注册字段放错位置——Cocos Creator 3.8 的 `panels`（复数）必须定义在 **package.json 顶层**，原结构用了 `contributions.panel`（单数，非 3.x 字段），导致面板未注册；menu 项缺 `label` 字段导致显示 undefined；`extensionType: "app"` 为非 3.x 标准字段。
- **修复**：
  - `package.json`：面板移入顶层 `panels.default`；menu 增加 `label`、path 用 `i18n:menu.extension/Spine MCP Server`；open-panel 消息改不带前缀；移除 `extensionType`
  - `panel/panel.js`：改用 Cocos 3.8 推荐的 `Editor.Panel.define({...})`（带非 Cocos 环境兼容导出，供自测）
- **验证**：扩展自测 12/12；`.ccx` 重新打包 7.7 KB
- **重新验证**：移除扩展 → 重新导入 `cocos-extension` → 启用 → **扩展 → Spine MCP Server**（正常显示文本）→ 点击打开面板

### 三次修复（面板重写 + 报错修复，2026-08-23）
用户反馈：面板能打开但报错 + 界面混乱（Vue 语法原文显示）+ 字色看不清。
- **报错 1**：`The "path" argument must be of type string. Received an instance of Object` → `panels.default.icon` 用了 `{ font, content }` 对象，而 3.8 中 icon 应为字符串路径 → **移除 icon 字段**
- **报错 2**：`Message does not exist: spine-mcp-panel - spine:get-cli-config` → panel 调用的 `spine:get-cli-config`、`spine:list-tools` 未在 `contributions.messages` 注册 → **补全注册**
- **界面混乱**：Cocos 面板的 Vue 需手动 `new window.Vue({ el: this.shadowRoot })` 才编译，`Editor.Panel.define` 不自动编译 → template 里 `{{ }}`/`v-if`/`@click` 显示为原文 → **重写为纯 HTML/CSS/JS（原生 DOM + addEventListener）**，彻底不依赖 Vue
- **重新设计**：深色高对比面板（背景 #1e1e1e、文字 #e8e8e8），所有配色对比度 ≥ 7.0（超 WCAG AA 4.5），亮/暗主题下均清晰；三步引导改为 ①→✅ 状态点
- **验证**：扩展自测 12/12；`.ccx` 重新打包 9.0 KB；模板无 Vue 残留、全部事件 ID 匹配、关键方法齐备

### 四次修复（面板 DOM 访问方式，2026-08-23）
用户反馈：`Cannot read properties of null (reading 'addEventListener')`，所有按钮无点击反馈。
- **根因**：`ready()` 中手动用 `vm.shadowRoot || vm.$el` 猜 DOM 根是错误的——Cocos 3.8 官方面板机制是**通过 `$` 选择器**（渲染后编辑器自动 `document.querySelector` 并挂到 `this.$`）。`this.shadowRoot` 不含 template 渲染内容 → `querySelector('#sm-btn-start')` 返回 null → 首个 addEventListener 抛错，后续绑定全未执行。
- **修复**：`panelDef` 增加 `$` 选择器（root + 全部交互按钮）；`ready()` 用 `this.$.root` 获取根元素，事件绑定改用 `this.$.btnXxx`（带 `#id` querySelector 兜底）。
- **验证**：扩展自测 12/12；`.ccx` 重新打包 9.3 KB。


