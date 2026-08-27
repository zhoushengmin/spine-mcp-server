/**
 * Phase 3 自测：MCP 协议级测试。
 * 用官方 @modelcontextprotocol/sdk Client 通过 stdio 连接本服务器：
 *   initialize → list tools → call 工具 → 校验响应
 */
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

let ok = 0, fail = 0;
const report = (name, cond, detail = "") => {
  if (cond) { ok++; console.log(`✅ ${name}`); }
  else { fail++; console.log(`❌ ${name} ${detail}`); }
};

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["d:/cocos/spine-mcp-server/dist/index.js", "mcp"],
    cwd: "d:/cocos/spine-mcp-server",
  });
  const client = new Client({ name: "self-test-client", version: "0.1.0" });

  await client.connect(transport);
  console.log("MCP 已连接");

  // 1. 列出工具
  const { tools } = await client.listTools();
  report("listTools 返回工具数", tools.length === 70, `实际 ${tools.length}`);
  const names = tools.map((t) => t.name);
  report("包含 spine_get_project_info", names.includes("spine_get_project_info"));
  report("包含 spine_control_bone", names.includes("spine_control_bone"));
  const infoTool = tools.find((t) => t.name === "spine_get_project_info");
  report("工具含 description 与 inputSchema", !!infoTool?.description && !!infoTool?.inputSchema);

  // 2. 调用只读工具
  const HERO = "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine";
  const r1 = await client.callTool({ name: "spine_get_project_info", arguments: { projectPath: HERO } });
  report("callTool get_project_info isError=false", r1.isError !== true);
  report("get_project_info 文本含 bones 数据", Array.isArray(r1.content) && r1.content.some((c) => c.text && c.text.includes("bones")));

  // 3. 参数校验错误（负数帧）→ isError
  const r2 = await client.callTool({ name: "spine_control_bone", arguments: { projectPath: HERO, animationName: "walk", boneName: "root", frameIndex: -1 } });
  report("callTool 参数错误 isError=true", r2.isError === true);

  // 4. 未知工具 → isError
  const r3 = await client.callTool({ name: "spine_unknown_tool", arguments: {} });
  report("未知工具 isError=true", r3.isError === true);

  // 5. 调用修改工具（在临时副本上，验证完整链路）
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const { exportProject } = require("d:/cocos/spine-mcp-server/dist/spine/export-service");
  const { ensureDir, createTempDir, removeDir } = require("d:/cocos/spine-mcp-server/dist/utils/file-utils");
  const t = createTempDir("p3-proto-");
  const copy = path.join(t, "hero.spine");
  fs.copyFileSync("D:/cocos/SpinePro3.8.75/examples/goblins/goblins-pro.spine", copy);
  const r4 = await client.callTool({ name: "spine_control_bone", arguments: { projectPath: copy, animationName: "walk", boneName: "root", frameIndex: 0, rotation: 25 } });
  report("callTool control_bone 成功", r4.isError !== true, JSON.stringify(r4.content?.[0]?.text));
  // 回读验证
  const e = path.join(t, "verify"); ensureDir(e);
  const files = await exportProject(copy, e, { format: "json" });
  const vjson = JSON.parse(fs.readFileSync(files.find((f) => f.endsWith(".json")), "utf8"));
  const frame0 = (vjson.animations?.walk?.bones?.root?.rotate ?? []).find((f) => Math.abs((f.time ?? 0)) < 1e-6);
  report("修改后回读 angle=25", frame0 && Math.abs(frame0.angle - 25) < 1e-6, JSON.stringify(frame0));
  removeDir(t);

  await client.close();
  console.log(`\n总计: ${ok} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
