/**
 * MCP 服务器主类（stdio 传输）。
 * 通过 @modelcontextprotocol/sdk 提供工具列表与工具调用。
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { allTools, toolMap } from "./tools/registry";
import { logger } from "./logger";
import { configManager } from "./config-manager";
import { toSpineError } from "./utils/error-codes";

/** 启动 stdio MCP 服务器（阻塞，直到连接断开） */
export async function startMcpServer(): Promise<void> {
  // 预加载配置；若 SPINE_EXE 缺失不阻断启动，由具体工具返回 E_SPINE_NOT_FOUND
  try {
    configManager.load();
  } catch (err) {
    logger.warn(`配置加载警告：${toSpineError(err).message}`);
  }

  const server = new Server(
    { name: "spine-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  // 列出工具
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  }));

  // 调用工具
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`调用工具：${name}`);

    const tool = toolMap[name];
    if (!tool) {
      return { content: [{ type: "text", text: `未知工具：${name}` }], isError: true };
    }

    // 参数校验（zod）
    const parsed = tool.inputSchema.safeParse(args ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("；");
      logger.error(`工具 ${name} 参数校验失败：${issues}`);
      return { content: [{ type: "text", text: `参数校验失败：${issues}` }], isError: true };
    }

    // 执行
    try {
      const result = await tool.execute(parsed.data);
      let text = result.message;
      if (result.data !== undefined && result.data !== null) {
        text += "\n" + JSON.stringify(result.data, null, 2);
      }
      if (result.data?.suggestion) {
        text += "\n建议：" + result.data.suggestion;
      }
      if (result.warning) {
        text += "\n⚠️ " + result.warning;
      }
      logger.info(`工具 ${name} ${result.success ? "成功" : "失败"}：${result.message}`);
      return { content: [{ type: "text", text }], isError: !result.success };
    } catch (err) {
      const e = toSpineError(err);
      logger.error(`工具 ${name} 异常：${e.toFriendlyString()}`);
      return {
        content: [{ type: "text", text: e.toFriendlyString() }],
        isError: true,
      };
    }
  });

  // 传输层错误处理（非致命）
  server.onerror = (err) => {
    logger.error(`MCP 服务器错误：${err instanceof Error ? err.message : String(err)}`);
  };

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("✅ Spine MCP 服务器已启动（stdio）");
}
