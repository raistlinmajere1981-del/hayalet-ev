#!/usr/bin/env node

/**
 * Hayalet-ev MCP Server (Orchestrator)
 * 
 * Alt modüller:
 * - tools/provider-tools.js: Provider yönetim araçları
 * - tools/electron-tools.js: Electron test ve plugin araçları
 * - tools/log-tools.js: Log okuma ve sorgulama araçları
 * - tools/debug-tools.js: Hata analizi ve debugging araçları
 * - utils/log-utils.js: Log yardımcı fonksiyonları
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { listProviders, addProvider } from "./tools/provider-tools.js";
import { testElectron, listPlugins } from "./tools/electron-tools.js";
import { readElectronLogs, listLogSessions, getSessionSummary } from "./tools/log-tools.js";
import { getErrorHints } from "./tools/debug-tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const LOG_DIR = join(PROJECT_ROOT, "logs");

const server = new Server(
  {
    name: "hayalet-ev-mcp",
    version: "1.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOL_DEFINITIONS = [
  {
    name: "list_providers",
    description: "Hayalet-ev'deki mevcut AI provider'ları listele",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_provider",
    description: "Hayalet-ev'e yeni AI provider ekle",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Provider adı (örn: perplexity, ollama)" },
        url: { type: "string", description: "Provider URL'i" },
      },
      required: ["name", "url"],
    },
  },
  {
    name: "test_electron",
    description: "Hayalet-ev Electron uygulamasını test et",
    inputSchema: {
      type: "object",
      properties: {
        timeout: { type: "number", description: "Test süresi (saniye), varsayılan 5", default: 5 },
      },
    },
  },
  {
    name: "list_plugins",
    description: "Hayalet-ev plugin'lerini listele",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "read_electron_logs",
    description: "Electron console ve error loglarını oku. Gelişmiş filtreleme: source (MAIN, RENDERER, WEBVIEW-AI1, etc.), level (LOG, WARN, ERROR), içerik arama, correlation ID ile işlem takibi.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["console", "error", "all", "structured"], description: "Log tipi", default: "all" },
        tail: { type: "number", description: "Son N satırı göster (varsayılan: 50)", default: 50 },
        source: { type: "string", description: "Kaynak filtresi: MAIN, RENDERER, WEBVIEW-AI1, WEBVIEW-AI2, WEBVIEW-* (glob destekli)" },
        level: { type: "string", enum: ["LOG", "WARN", "ERROR", "DEBUG", "INFO"], description: "Log seviyesi filtresi" },
        contains: { type: "string", description: "İçerik arama (case-insensitive)" },
        correlationId: { type: "string", description: "İşlem takibi için correlation ID" },
        sessionId: { type: "string", description: "Belirli bir session'ın loglarını oku (varsayılan: en son session)" },
      },
    },
  },
  {
    name: "list_log_sessions",
    description: "Mevcut log session'larını listele. Her session bir uygulama çalıştırmasını temsil eder.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Gösterilecek maksimum session sayısı (varsayılan: 10)", default: 10 },
      },
    },
  },
  {
    name: "get_error_hints",
    description: "Belirli bir hata mesajı için AI debugging ipuçları al. Bilinen hata pattern'lerini eşleştirir ve çözüm önerileri sunar.",
    inputSchema: {
      type: "object",
      properties: {
        errorMessage: { type: "string", description: "Analiz edilecek hata mesajı" },
        provider: { type: "string", description: "İlgili provider (chatgpt, gemini, grok) - dosya yolları için kullanılır" },
      },
      required: ["errorMessage"],
    },
  },
  {
    name: "get_session_summary",
    description: "Belirli bir session'ın özet bilgilerini al (hata sayısı, süre, son durum)",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID (varsayılan: en son session)" },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOL_DEFINITIONS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_providers":
        return await listProviders(PROJECT_ROOT);

      case "add_provider":
        return await addProvider(PROJECT_ROOT, args);

      case "test_electron":
        return await testElectron(PROJECT_ROOT, args);

      case "list_plugins":
        return await listPlugins(PROJECT_ROOT);

      case "read_electron_logs":
        return await readElectronLogs(LOG_DIR, args);

      case "list_log_sessions":
        return await listLogSessions(LOG_DIR, args);

      case "get_error_hints":
        return await getErrorHints(LOG_DIR, args);

      case "get_session_summary":
        return await getSessionSummary(LOG_DIR, args);

      default:
        throw new Error(`Bilinmeyen tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `❌ Hata: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hayalet-ev MCP Server v1.2.0 başlatıldı");
}

main().catch((error) => {
  console.error("Server hatası:", error);
  process.exit(1);
});
