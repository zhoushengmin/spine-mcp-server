/**
 * spine-mcp-server 入口（Phase 1 基础设施 + Phase 2 核心封装自测）
 *
 * 子命令（Phase 2 自测用；MCP 服务器将在 Phase 3 接入）：
 *   check                       —— 校验 Spine CLI 并显示配置摘要
 *   info <path>                 —— 对项目执行 Info 命令并显示输出
 *   version <path>              —— 检测项目版本（3.8.75 兼容提示）
 *   reader <json>               —— 解析导出 JSON，显示结构化项目信息
 *   export <spine> <outdir> [json|binary|texture|video]
 *                               —— 测试导出
 *   import <spine> <json>       —— 测试导入（自动备份 + -r 导入）
 *   clean <spine>               —— 测试 -m 清理（复制到临时文件后执行）
 *   roundtrip <spine> <outdir>  —— 完整往返：导出→改骨骼帧→导入→验证
 *   help                        —— 显示帮助
 *
 * 用法：`node dist/index.js <command> [args]`
 */
import { configManager } from "./config-manager";
import { logger } from "./logger";
import { cliExecutor } from "./spine/cli-executor";
import { versionValidator } from "./spine/version-validator";
import { getProjectInfo } from "./spine/info-service";
import { readProjectJson } from "./spine/project-reader";
import { exportProject, generateExportSettings } from "./spine/export-service";
import { importJson, importJsonInPlace } from "./spine/import-service";
import { cleanProject } from "./spine/cleanup-service";
import { updateBoneKeyframe, frameToTime } from "./spine/json-handler";
import { toSpineError } from "./utils/error-codes";
import { createTempDir, removeDir, readJsonFile, writeJsonFile, ensureDir } from "./utils/file-utils";
import { startMcpServer } from "./server";

const HELP_TEXT = `
spine-mcp-server — Spine 3.8.75 MCP 服务器（Phase 1 + Phase 2）

用法:
  node dist/index.js <command> [args]

命令:
  check               校验 Spine CLI 并显示配置摘要
  info <path>         对 .spine 项目执行 Info 命令（版本/骨骼/插槽/动画）
  version <path>      检测 .spine 或 .json 文件的 Spine 版本
  reader <json>       解析导出 JSON，显示结构化项目信息
  export <spine> <outdir> [json|binary|texture|video]  测试导出
  import <spine> <json>          测试导入（自动备份 + -r 导入）
  clean <spine>       测试 -m 清理（在临时副本上执行）
  roundtrip <spine> <outdir>     完整往返：导出→改骨骼帧→导入→验证
  mcp                         启动 MCP stdio 服务器（供 Trae/Cursor 等 AI 客户端连接）
  help                        显示本帮助

环境变量（见 .env.example）:
  SPINE_EXE            Spine 命令行工具路径
  LOG_LEVEL            error|warn|info|debug
  CLI_TIMEOUT_MS       CLI 执行超时（毫秒）
`;

/** check 命令：校验环境 */
async function cmdCheck(): Promise<void> {
  configManager.assertSpineExists();
  logger.info("✅ Spine CLI 校验通过");
  console.log(configManager.summarize());

  // 探测 CLI 版本
  try {
    const out = await cliExecutor.execToString(["--version"]);
    logger.info(`CLI --version 输出:\n${out}`);
  } catch (err) {
    // --version 可能不受支持，降级提示
    logger.warn(`--version 探测失败: ${toSpineError(err).message}`);
  }
}

/** info 命令：Info 命令输出 */
async function cmdInfo(filePath: string): Promise<void> {
  const out = await cliExecutor.execToString(["-i", filePath]);
  console.log(out);
}

/** version 命令：检测版本 */
async function cmdVersion(filePath: string): Promise<void> {
  const result = await versionValidator.detect(filePath);
  console.log(`文件     : ${filePath}`);
  console.log(`版本     : ${result.version}`);
  console.log(`目标版本 : ${result.isSupported ? "✅ 与 3.8.75 一致" : "❌ 非 3.8.75"}`);
  if (result.warning) {
    console.log(`警告     : ${result.warning}`);
  }
}

/** reader 命令：解析导出 JSON 显示结构化信息 */
async function cmdReader(jsonPath: string): Promise<void> {
  const info = readProjectJson(jsonPath);
  console.log(`版本     : ${info.version}`);
  console.log(`骨骼     : ${info.bones.length} 个`);
  console.log(`插槽     : ${info.slots.length} 个`);
  console.log(`皮肤     : ${info.skins.map((s) => s.name).join(", ") || "无"}`);
  console.log(`动画     : ${info.animations.map((a) => `${a.name}(${a.duration.toFixed(2)}s/${a.keyframeCount}帧)`).join(", ") || "无"}`);
  console.log(`事件     : ${info.events.join(", ") || "无"}`);
  if (info.compatibilityWarning) {
    console.log(`警告     : ${info.compatibilityWarning}`);
  }
}

/** export 命令：测试导出 */
async function cmdExport(spinePath: string, outDir: string, format: string): Promise<void> {
  ensureDir(outDir);
  console.log(`导出设置 : ${JSON.stringify(generateExportSettings({ format: format as any }))}`);
  const files = await exportProject(spinePath, outDir, { format: format as any });
  console.log(`导出完成 : ${files.length} 个文件`);
  files.forEach((f) => console.log(`  - ${f}`));
}

/** import 命令：测试导入 */
async function cmdImport(spinePath: string, jsonPath: string, skeletonName?: string): Promise<void> {
  const result = await importJson(spinePath, jsonPath, { skeletonName });
  console.log(`导入成功 : ${result.projectPath}`);
  console.log(`骨架名   : ${result.skeletonName}`);
  if (result.backupPath) {
    console.log(`备份     : ${result.backupPath}`);
  }
}

/** clean 命令：在临时副本上测试 -m 清理（避免破坏原项目） */
async function cmdClean(spinePath: string): Promise<void> {
  const fs = require("fs");
  const path = require("path");
  const tempDir = createTempDir("spine-clean-");
  const copyPath = path.join(tempDir, path.basename(spinePath));
  fs.copyFileSync(spinePath, copyPath);
  try {
    const result = await cleanProject(copyPath);
    console.log(`清理完成 : 骨架 ${result.skeletonName}，移除 ${result.removedKeys} 个未使用关键帧`);
    console.log(`（已在临时副本上执行，原项目未改动）`);
  } finally {
    removeDir(tempDir);
  }
}

/** roundtrip 命令：导出 → 修改骨骼关键帧 → 导入 → 验证（在临时副本上执行，不动原项目） */
async function cmdRoundtrip(spinePath: string, outDir: string): Promise<void> {
  const fs = require("fs");
  const path = require("path");
  ensureDir(outDir);

  const tempDir = createTempDir("spine-rt-");
  // 0. 在临时副本上执行，保护原始文件
  const workProj = path.join(tempDir, path.basename(spinePath));
  fs.copyFileSync(spinePath, workProj);

  // 1. 导出 JSON
  const exportDir = path.join(tempDir, "export");
  const files = await exportProject(workProj, exportDir, { format: "json" });
  const jsonFile = files.find((f) => f.endsWith(".json"));
  if (!jsonFile) {
    throw new Error("导出未产生 JSON 文件");
  }
  console.log(`1) 导出   : ${jsonFile}`);

  // 2. 获取骨架名与 fps
  const info = await getProjectInfo(workProj);
  const fps = info.fps || 30;
  console.log(`2) 骨架   : ${info.skeletonName}  fps=${fps}  骨骼=${info.bones.length}`);

  // 3. 修改骨骼关键帧（第一个动画的第一个骨骼，rotation + 10）
  const json = readJsonFile(jsonFile);
  const animName = info.animations[0];
  const boneName = info.bones[0];
  const time = frameToTime(0, fps);
  const baseRotation = findBoneSafe(json, boneName).rotation ?? 0;
  const affected = updateBoneKeyframe(json, animName, boneName, time, { rotation: baseRotation + 10 });
  writeJsonFile(jsonFile, json);
  console.log(`3) 修改   : 动画 "${animName}" 骨骼 "${boneName}" 第 0 帧 rotation+10（影响 ${affected} 帧）`);

  // 4. 原地导入（临时新文件 + 原子替换，已验证正确保留修改）
  const imp = await importJsonInPlace(workProj, jsonFile, info.skeletonName);
  console.log(`4) 导入   : ${imp.projectPath}（备份: ${path.basename(imp.backupPath ?? "")}）`);

  // 5. 验证：重新导出导入后的项目，检查关键帧是否保留
  const verifyDir = path.join(tempDir, "verify");
  const verifyFiles = await exportProject(workProj, verifyDir, { format: "json" });
  const verifyJson = verifyFiles.find((f) => f.endsWith(".json"));
  if (!verifyJson) {
    throw new Error("验证导出未产生 JSON 文件");
  }
  const vData = readJsonFile(verifyJson);
  const vBone = findBoneSafe(vData, boneName);
  const timeline = vData.animations?.[animName]?.bones?.[boneName]?.rotate ?? [];
  // Spine 导出时 time=0 的关键帧会省略 time 字段，视为 0
  const frame0 = timeline.find((f: any) => Math.abs((f?.time ?? 0) - 0) < 1e-6);
  const expected = baseRotation + 10;
  console.log(`5) 验证   : 第 0 帧 angle = ${frame0?.angle}（期望 ${expected}，Setup rotation = ${vBone.rotation}）`);
  console.log(frame0 && Math.abs((frame0.angle ?? 0) - expected) < 1e-6 ? `   ✅ 关键帧写入成功并回读一致` : `   ❌ 关键帧验证失败`);

  removeDir(tempDir);
}

/** 安全读取骨骼（不存在返回空对象） */
function findBoneSafe(json: any, name: string): any {
  return (json.bones ?? []).find((b: any) => b.name === name) ?? {};
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "help";

  // 先加载配置（若 SPINE_EXE 缺失，check/其余命令会给出友好错误）
  try {
    configManager.load();
  } catch (err) {
    logger.error(toSpineError(err).toFriendlyString());
    process.exit(1);
  }

  try {
    switch (command) {
      case "check":
        await cmdCheck();
        break;
      case "info":
        requireArg(args, 1, "info <path>");
        await cmdInfo(args[1]);
        break;
      case "version":
        requireArg(args, 1, "version <path>");
        await cmdVersion(args[1]);
        break;
      case "reader":
        requireArg(args, 1, "reader <json>");
        await cmdReader(args[1]);
        break;
      case "export":
        requireArg(args, 2, "export <spine> <outdir> [format]");
        await cmdExport(args[1], args[2], args[3] ?? "json");
        break;
      case "import":
        requireArg(args, 2, "import <spine> <json> [skeletonName]");
        await cmdImport(args[1], args[2], args[3]);
        break;
      case "clean":
        requireArg(args, 1, "clean <spine>");
        await cmdClean(args[1]);
        break;
      case "roundtrip":
        requireArg(args, 2, "roundtrip <spine> <outdir>");
        await cmdRoundtrip(args[1], args[2]);
        break;
      case "mcp":
        // 启动 MCP stdio 服务器（长驻进程）
        await startMcpServer();
        break;
      case "help":
      case "-h":
      case "--help":
        console.log(HELP_TEXT);
        break;
      default:
        logger.error(`未知命令：${command}`);
        console.log(HELP_TEXT);
        process.exit(1);
    }
  } catch (err) {
    const spineErr = toSpineError(err);
    logger.error(spineErr.toFriendlyString());
    process.exit(1);
  }
}

/** 参数数量校验 */
function requireArg(args: string[], index: number, usage: string): void {
  if (!args[index]) {
    logger.error(`缺少参数：${usage}`);
    console.log(HELP_TEXT);
    process.exit(1);
  }
}

// 仅在直接作为入口运行时执行（避免被测试框架引入时误执行）
if (require.main === module) {
  main();
}
