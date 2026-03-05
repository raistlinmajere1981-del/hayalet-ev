/**
 * MCP Server Setup & Bootstrap
 * Server initialization and main function
 *
 * Uses unified registry pattern:
 * - All tools registered once via registerAllTools()
 * - getAllDefinitions() for ListTools
 * - handleToolCall() for CallTool
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { join } from "path";
import { logError } from "../utils/mcp-logger.js";
import { setMcpServer, setProgressToken } from "../utils/progress.js";
import { PROJECT_ROOT } from "../utils/project-root.js";
import { getAllDefinitions, getToolCount } from "./registry.js";
import { registerAllTools } from "./handlers/index.js";
import { handleToolCall } from "./handlers.js";

const LOG_DIR = join(PROJECT_ROOT, "logs", "hayalet-ev");

// MCP Server version — single source of truth
const MCP_VERSION = "3.0.0";

interface McpServerInitialization {
  server: Server;
  PROJECT_ROOT: string;
  LOG_DIR: string;
}

export function initializeMcpServer(): McpServerInitialization {
  const server = new Server(
    {
      name: "hayalet-ev-mcp",
      version: MCP_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all tools into the unified registry
  registerAllTools({ PROJECT_ROOT, LOG_DIR });

  // Progress utility'ye server referansı ver
  setMcpServer(server);

  // List tools handler — reads from registry
  server.setRequestHandler(ListToolsRequestSchema, () => {
    return { tools: getAllDefinitions() };
  });

  // Call tool handler — routes through registry
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Progress token'ı ayarla (varsa)
    const progressToken = (request.params as { _meta?: { progressToken?: string | number } })._meta
      ?.progressToken;
    setProgressToken(progressToken ?? null);

    return (await handleToolCall(name, args ?? {})) as Record<string, unknown>;
  });

  return { server, PROJECT_ROOT, LOG_DIR };
}

export async function main(): Promise<void> {
  try {
    const { server } = initializeMcpServer();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Keep the process alive for stdio-based MCP clients.
    process.stdin.resume();
    // Write to stderr (MCP protocol requires stderr for logging)
    process.stderr.write(
      `Hayalet-ev MCP Server v${MCP_VERSION} başlatıldı (${getToolCount()} tools | Unified Registry)\n`
    );
  } catch (err) {
    const error = err as Error;
    logError("Server başlatma hatası", error);
    process.stderr.write(`Server hatası: ${error.message}\n${error.stack ?? ""}\n`);
    process.exit(1);
  }
}
