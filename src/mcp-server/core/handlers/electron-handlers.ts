/**
 * Electron & Log Tool Handlers
 * Health checks, electron testing, tool discovery, log reading
 *
 * Co-located: definition + handler in ToolEntry format
 */

import { testElectron, listTools, mcpHealthCheck } from "../../tools/electron-tools.js";
import { handleSuggestTool } from "../../tools/tool-discovery.js";
import { TOOL_DISCOVERY_DEFINITIONS } from "../../tools/tool-discovery.js";
import { readElectronLogs, listLogSessions, getSessionSummary } from "../../tools/log-tools.js";
import { getErrorHints } from "../../tools/debug-tools.js";
import type { ToolEntry, ToolContext } from "../registry.js";
import { getToolCount } from "../registry.js";

export function createElectronTools(context: ToolContext): ToolEntry[] {
  const { PROJECT_ROOT, LOG_DIR } = context;

  return [
    // ─── Core ────────────────────────────────────────────
    {
      definition: {
        name: "hev_mcp_health",
        description:
          "Hayalet-ev MCP'nin sağlık durumunu kontrol et. MCP server'ın çalışma durumunu, versiyon ve tool sayısını gösterir.",
        inputSchema: { type: "object", properties: {} },
        metadata: {
          category: "core",
          subcategory: "health",
          priority: "critical",
          complexity: "simple",
          useCases: [
            "Session başlangıcında MCP sağlığını kontrol et",
            "Tool çalışmıyorsa troubleshoot",
          ],
          relatedTools: ["hev_list_tools"],
          agentGuidance:
            "Her session başında veya tool hatası aldığında kullan. MCP çalışmazsa built-in toollar aktif olur (RISKLI!).",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["health", "status", "troubleshoot"],
        },
      },
      handler: (): unknown => {
        const health = mcpHealthCheck();
        // Use runtime tool count instead of hardcoded value
        const toolCount = getToolCount();
        const output = `
${health.message}

📊 MCP Durum:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sağlık: ${health.healthy ? "Healthy" : "Unhealthy"}
📦 Versiyon: ${health.version}
⏱️  Uptime: ${Math.floor(health.uptime)}s
🔧 Tool Sayısı: ${toolCount}

💡 Bu mesajı görüyorsan:
   → Hayalet-ev MCP çalışıyor
   → Tüm hev_* toolları kullanılabilir

⚠️  Eğer bu tool çalışmazsa:
   → Hayalet-ev MCP çökmüş demektir
   → Acil: MCP server'ı yeniden başlat
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        return { content: [{ type: "text", text: output }] };
      },
    },
    {
      definition: {
        name: "hev_test_electron",
        description: "Hayalet-ev Electron uygulamasını test et",
        inputSchema: {
          type: "object",
          properties: {
            timeout: {
              type: "number",
              description: "Test süresi (saniye), varsayılan 5",
              default: 5,
            },
          },
        },
        metadata: {
          category: "electron",
          subcategory: "testing",
          priority: "medium",
          complexity: "simple",
          useCases: ["Electron app connectivity test", "CDP health check"],
          relatedTools: ["hev_check_electron_connection", "hev_mcp_health"],
          agentGuidance: "Use to verify Electron app is running and CDP is accessible.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["electron", "testing", "connectivity"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const opts = args ?? {};
        return await testElectron(PROJECT_ROOT, opts);
      },
    },
    {
      definition: {
        name: "hev_list_tools",
        description: "Hayalet-ev MCP tool'larını kategorize ederek listele",
        inputSchema: { type: "object", properties: {} },
        metadata: {
          category: "core",
          subcategory: "discovery",
          priority: "high",
          complexity: "simple",
          useCases: ["Tool keşfetme", "Kategori bazlı araştırma", "Tool count doğrulama"],
          relatedTools: ["hev_suggest_tool"],
          agentGuidance:
            "Tüm toolları görmek yerine hev_suggest_tool veya kategori bazlı arama kullan.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["discovery", "list", "reference"],
        },
      },
      handler: (): unknown => {
        return listTools();
      },
    },

    // ─── Tool Discovery ──────────────────────────────────
    {
      definition: TOOL_DISCOVERY_DEFINITIONS[0],
      handler: (args): unknown => {
        return handleSuggestTool(args ?? {});
      },
    },
    // ─── Log Tools ───────────────────────────────────────
    {
      definition: {
        name: "hev_read_electron_logs",
        description:
          "Electron console ve error loglarını oku. Gelişmiş filtreleme: source (MAIN, RENDERER, WEBVIEW-AI1, etc.), level (LOG, WARN, ERROR), içerik arama, correlation ID ile işlem takibi.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["console", "error", "all", "structured"],
              description: "Log tipi",
              default: "all",
            },
            app: {
              type: "string",
              enum: ["hayalet-ev", "mcp-server", "ghost-agent"],
              description: "Hangi uygulamanın session logları okunacak (varsayılan: hayalet-ev)",
              default: "hayalet-ev",
            },
            tail: {
              type: "number",
              description: "Son N satırı göster (varsayılan: 50)",
              default: 50,
            },
            source: {
              type: "string",
              description:
                "Kaynak filtresi: MAIN, RENDERER, WEBVIEW-AI1, WEBVIEW-AI2, WEBVIEW-* (glob destekli)",
            },
            level: {
              type: "string",
              enum: ["LOG", "WARN", "ERROR", "DEBUG", "INFO"],
              description: "Log seviyesi filtresi",
            },
            contains: { type: "string", description: "İçerik arama (case-insensitive)" },
            correlationId: {
              type: "string",
              description: "İşlem takibi için correlation ID",
            },
            sessionId: {
              type: "string",
              description: "Belirli bir session'ın loglarını oku (varsayılan: en son session)",
            },
          },
        },
        metadata: {
          category: "debug",
          subcategory: "logs",
          priority: "high",
          complexity: "medium",
          useCases: [
            "Hata ayıklama için log inceleme",
            "Belirli source/level/pattern ile filtreleme",
            "Correlation ID ile işlem takibi",
          ],
          relatedTools: ["hev_list_log_sessions", "hev_get_session_summary", "hev_get_error_hints"],
          agentGuidance:
            "Hata araştırması için kullan. source ile WEBVIEW-AI1, WEBVIEW-AI2 vb. ayır. correlationId ile işlem zincirini takip et.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["debug", "logs", "troubleshooting", "electron"],
        },
      },
      handler: async (args): Promise<unknown> => {
        return await readElectronLogs(LOG_DIR, args);
      },
    },
    {
      definition: {
        name: "hev_list_log_sessions",
        description:
          "Mevcut log session'larını listele. Her session bir uygulama çalıştırmasını temsil eder.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Gösterilecek maksimum session sayısı (varsayılan: 10)",
              default: 10,
            },
            app: {
              type: "string",
              enum: ["hayalet-ev", "mcp-server", "ghost-agent"],
              description: "Session listesi hangi uygulama için alınsın (varsayılan: hayalet-ev)",
              default: "hayalet-ev",
            },
          },
        },
        metadata: {
          category: "debug",
          subcategory: "logs",
          priority: "medium",
          complexity: "simple",
          useCases: ["Geçmiş session'ları görüntüleme", "Belirli bir session ID bulma"],
          relatedTools: ["hev_read_electron_logs", "hev_get_session_summary"],
          agentGuidance:
            "Log okumadan önce session listesini kontrol et. En son session varsayılan olarak kullanılır.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["debug", "logs", "session"],
        },
      },
      handler: async (args): Promise<unknown> => {
        return await listLogSessions(LOG_DIR, args);
      },
    },
    {
      definition: {
        name: "hev_get_error_hints",
        description:
          "Belirli bir hata mesajı için AI debugging ipuçları al. Bilinen hata pattern'lerini eşleştirir ve çözüm önerileri sunar.",
        inputSchema: {
          type: "object",
          properties: {
            errorMessage: { type: "string", description: "Analiz edilecek hata mesajı" },
            provider: {
              type: "string",
              description:
                "İlgili provider (chatgpt, gemini, grok) - dosya yolları için kullanılır",
            },
          },
          required: ["errorMessage"],
        },
        metadata: {
          category: "debug",
          subcategory: "error-analysis",
          priority: "high",
          complexity: "medium",
          useCases: [
            "Hata pattern matching",
            "Çözüm önerisi alma",
            "Provider-specific troubleshooting",
          ],
          relatedTools: ["hev_collect_error_context", "hev_read_electron_logs"],
          agentGuidance:
            "Hata mesajı aldığında bu tool ile bilinen pattern'leri kontrol et. Provider bilgisi verirsen dosya yolları için kullanır.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["debug", "error", "hints", "ai-assisted"],
        },
      },
      handler: (args): unknown => {
        return getErrorHints(args ?? {});
      },
    },
    {
      definition: {
        name: "hev_get_session_summary",
        description: "Belirli bir session'ın özet bilgilerini al (hata sayısı, süre, son durum)",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID (varsayılan: en son session)",
            },
            app: {
              type: "string",
              enum: ["hayalet-ev", "mcp-server", "ghost-agent"],
              description: "Özet hangi uygulamanın session'ı için alınsın (varsayılan: hayalet-ev)",
              default: "hayalet-ev",
            },
          },
        },
        metadata: {
          category: "debug",
          subcategory: "logs",
          priority: "medium",
          complexity: "simple",
          useCases: [
            "Session health check",
            "Hata istatistikleri görme",
            "Session karşılaştırması",
          ],
          relatedTools: ["hev_list_log_sessions", "hev_read_electron_logs"],
          agentGuidance:
            "Session'ın genel durumunu öğrenmek için kullan. Hata sayısı, süre ve durum bilgisi verir.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["debug", "logs", "session", "summary"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const opts = args ?? {};
        return await getSessionSummary(LOG_DIR, opts);
      },
    },
  ];
}
