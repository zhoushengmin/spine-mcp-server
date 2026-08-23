/**
 * Phase 6 扩展自测：mock Editor API，验证主进程桥接逻辑。
 * （Cocos 编辑器 UI 无法自测，这部分由用户验证）
 */
const path = require("path");
const fs = require("fs");

let ok = 0, fail = 0;
function report(name, cond, detail = "") {
  if (cond) { ok++; console.log(`✅ ${name}`); }
  else { fail++; console.log(`❌ ${name} ${detail}`); }
}

// ---- mock Editor ----
const store = { config: { serverPath: "D:/cocos/spine-mcp-server", spineExe: "D:/cocos/SpinePro3.8.75/Spine.com", workspace: "D:/cocos/SpinePro3.8.75/examples" } };
global.Editor = {
  Profile: {
    getConfig: () => store.config,
    setConfig: (_k, v) => { store.config = v; },
  },
  Message: {
    send: () => {},
  },
};

const ext = require("d:/cocos/spine-mcp-server/cocos-extension/main.js");

(async () => {
  report("扩展加载（load/unload/methods 存在）", typeof ext.load === "function" && typeof ext.methods === "object");

  // 配置
  let r = await ext.methods["spine:get-config"]();
  report("get-config", r.ok && r.config.serverPath === store.config.serverPath && r.spineExeExists === true, r.error);

  // 工具列表
  r = await ext.methods["spine:list-tools"]();
  report("list-tools（55 个）", r.ok && r.tools.length === 55, `实际 ${r.tools?.length}`);

  // 运行只读工具
  r = await ext.methods["spine:get-info"]("D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine");
  report("run-tool(get_project_info)", r.ok && r.result.success, r.error || r.result?.message);

  // 扫描项目
  r = await ext.methods["spine:list-projects"]("D:/cocos/SpinePro3.8.75/examples");
  report("list-projects（扫描 examples）", r.ok && r.projects.length >= 10, `${r.projects?.length} 个`);

  // AI 配置生成
  r = await ext.methods["spine:get-cli-config"]();
  const args0 = r.config.mcpServers["spine-mcp"].args[0] || "";
  report("get-cli-config", r.ok && args0.includes("dist") && args0.includes("index.js") && r.config.mcpServers["spine-mcp"].env.SPINE_EXE, JSON.stringify(r.config));

  // 服务启停（stdio 进程）
  r = await ext.methods["spine:start"]();
  report("spine:start", r.ok && r.status === "running", r.error);
  r = await ext.methods["spine:status"]();
  report("spine:status", r.status === "running");
  r = await ext.methods["spine:stop"]();
  report("spine:stop", r.ok && r.status === "stopped", r.error);

  // 面板模板/样式/方法完整性
  const panel = require("d:/cocos/spine-mcp-server/cocos-extension/panel/panel.js");
  report("panel template 非空", typeof panel.template === "string" && panel.template.length > 200);
  report("panel methods 齐备", ["startServer", "scanProjects", "generateConfig", "copyConfig", "getInfo"].every((m) => typeof panel.methods[m] === "function"));
  report("panel ready/close", typeof panel.ready === "function" && typeof panel.close === "function");

  // 扩展文件语法检查（通过 require 已隐含加载成功）

  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
