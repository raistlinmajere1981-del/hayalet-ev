/**
 * MCP Server Setup & Bootstrap
 * Server initialization and main function
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { logError } from "../utils/mcp-logger.js";
import { setMcpServer, setProgressToken } from "../utils/progress.js";
import { getAllToolDefinitions } from "./tools-list.js";
import { handleToolCall } from "./handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = process.cwd();
const LOG_DIR = join(PROJECT_ROOT, "logs");

export async function initializeMcpServer() {
  const server = new Server(
    {
      name: "hayalet-ev-mcp",
      version: "1.7.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Progress utility'ye server referansı ver
  setMcpServer(server);

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getAllToolDefinitions() };
  });

  // Call tool handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
    const { name, arguments: args } = request.params;

    // Progress token'ı ayarla (varsa)
    const progressToken = (
      request.params as { _meta?: { progressToken?: string | number } }
    )._meta?.progressToken;
    setProgressToken(progressToken || null);

    return await handleToolCall(name, args ?? {}, PROJECT_ROOT, LOG_DIR);
  });

  return { server, PROJECT_ROOT, LOG_DIR };
}

export async function main() {
  try {
    const { server } = await initializeMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(
      "Hayalet-ev MCP Server v1.7.0 başlatıldı (CDP + Filesystem + Dev Tools + Recycle Bin + Logging)"
    );
  } catch (err) {
    const error = err as Error;
    logError("Server başlatma hatası", error);
    console.error("Server hatası:", error);
    process.exit(1);
  }
}
