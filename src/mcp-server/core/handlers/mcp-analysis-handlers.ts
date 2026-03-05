/**
 * MCP Analysis & Streaming Handlers
 * MCP tool usage analytics, error correlation, streaming logs
 *
 * Co-located: definition + handler in ToolEntry format
 */

import {
  analyzeMcpToolUsage,
  getMcpToolPerformance,
  correlateMcpErrors,
  getAgentToolTrace,
} from "../../tools/log/mcp-analysis.js";
import { streamLogsRealtime, STREAM_LOGS_REALTIME_TOOL } from "../../tools/log/streaming.js";
import type { StreamLogsRealtimeArgs } from "../../tools/log/streaming.js";
import type { ToolEntry } from "../registry.js";

export function createMcpAnalysisTools(): ToolEntry[] {
  return [
    {
      definition: STREAM_LOGS_REALTIME_TOOL,
      handler: async (args): Promise<unknown> => {
        const result = await streamLogsRealtime(args as StreamLogsRealtimeArgs);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      },
    },
    {
      definition: {
        name: "hev_analyze_mcp_tool_usage",
        description:
          "MCP tool kullanım istatistiklerini analiz et: toplam çağrı sayısı, tool bazında çağrı sayısı, ortalama süre, hata oranı, en yavaş çağrılar",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID (varsayılan: en son session)",
            },
            timeRange: {
              type: "object",
              properties: {
                from: { type: "string", description: "ISO 8601 timestamp" },
                to: { type: "string", description: "ISO 8601 timestamp" },
              },
              description: "Zaman aralığı filtresi (opsiyonel)",
            },
          },
        },
        metadata: {
          category: "debug",
          subcategory: "mcp-analysis",
          priority: "medium",
          complexity: "medium",
          useCases: [
            "MCP tool performance analizi",
            "Hangi toollar çok kullanılıyor?",
            "Yavaş toolları bulma",
            "Hata oranı tespiti",
          ],
          relatedTools: ["hev_get_mcp_tool_performance", "hev_correlate_mcp_errors"],
          agentGuidance:
            "MCP toollarının genel kullanım istatistiklerini görmek için kullan. Performance sorunları ve sık kullanılan toolları tespit eder.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["mcp", "analysis", "performance", "statistics"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const result = await analyzeMcpToolUsage(
          args as { sessionId?: string; timeRange?: { from: string; to: string } }
        );

        let output = `📊 MCP Tool Usage Analysis\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `Total Calls: ${result.totalCalls}\n`;
        output += `Total Errors: ${result.totalErrors}\n\n`;

        if (result.byTool.length > 0) {
          output += `📈 Top Tools by Call Count:\n`;
          for (const tool of result.byTool.slice(0, 10)) {
            const errorPct = (tool.errorRate * 100).toFixed(1);
            output += `  ${tool.tool}: ${tool.calls} calls, avg ${tool.avgDuration}ms, ${errorPct}% errors\n`;
          }
        }

        if (result.slowestCalls.length > 0) {
          output += `\n🐌 Slowest Calls:\n`;
          for (const call of result.slowestCalls.slice(0, 5)) {
            output += `  ${call.tool}: ${call.duration}ms (${call.timestamp})\n`;
          }
        }

        return { content: [{ type: "text", text: output }] };
      },
    },
    {
      definition: {
        name: "hev_get_mcp_tool_performance",
        description:
          "Belirli bir MCP tool'un detaylı performans metriklerini al: toplam/başarılı/başarısız çağrılar, ortalama/min/max süre, son hatalar",
        inputSchema: {
          type: "object",
          properties: {
            toolName: {
              type: "string",
              description: "Tool adı (örn: hev_dev_lint_file)",
            },
            sessionId: {
              type: "string",
              description: "Session ID (varsayılan: en son session)",
            },
          },
          required: ["toolName"],
        },
        metadata: {
          category: "debug",
          subcategory: "mcp-analysis",
          priority: "medium",
          complexity: "simple",
          useCases: [
            "Tek bir tool'un performansını analiz et",
            "Son hataları gör",
            "Performance regression tespiti",
          ],
          relatedTools: ["hev_analyze_mcp_tool_usage", "hev_correlate_mcp_errors"],
          agentGuidance:
            "Belirli bir tool yavaş mı veya hata mı veriyor? Bu tool ile detaylı metrikleri gör.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["mcp", "performance", "tool-specific", "metrics"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const result = await getMcpToolPerformance(
          args as { toolName: string; sessionId?: string }
        );

        let output = `📊 MCP Tool Performance: ${result.toolName}\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `Total Calls: ${result.totalCalls}\n`;
        output += `Successful: ${result.successfulCalls}\n`;
        output += `Failed: ${result.failedCalls}\n`;
        output += `Avg Duration: ${result.avgDuration}ms\n`;
        output += `Min/Max: ${result.minDuration}ms / ${result.maxDuration}ms\n`;

        if (result.recentErrors.length > 0) {
          output += `\n❌ Recent Errors:\n`;
          for (const err of result.recentErrors) {
            output += `  [${err.timestamp}] ${err.error}\n`;
          }
        }

        return { content: [{ type: "text", text: output }] };
      },
    },
    {
      definition: {
        name: "hev_correlate_mcp_errors",
        description:
          "MCP hatalarını diğer sistem logları ile ilişkilendir: MCP error zamanlarına yakın renderer/main/webview eventleri bul",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID (varsayılan: en son session)",
            },
            timeWindow: {
              type: "number",
              description: "Zaman penceresi (ms), varsayılan 5000",
              default: 5000,
            },
          },
        },
        metadata: {
          category: "debug",
          subcategory: "mcp-analysis",
          priority: "high",
          complexity: "complex",
          useCases: ["MCP hatası ne sebep oldu?", "Error correlation", "Root cause analysis"],
          relatedTools: ["hev_analyze_mcp_tool_usage", "hev_read_electron_logs"],
          agentGuidance:
            "MCP hatası aldığında root cause bulmak için kullan. Hatadan önce/sonra olan system eventleri gösterir.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["mcp", "error", "correlation", "debugging"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const result = await correlateMcpErrors(
          args as { sessionId?: string; timeWindow?: number }
        );

        let output = `🔗 MCP Error Correlation Analysis\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        if (result.mcpErrors.length === 0) {
          output += `No MCP errors found in this session.\n`;
        } else {
          for (const error of result.mcpErrors) {
            output += `\n❌ ${error.toolName} at ${error.timestamp}\n`;
            output += `   Error: ${error.error}\n`;

            if (error.nearbyEvents.length > 0) {
              output += `   Nearby Events:\n`;
              for (const event of error.nearbyEvents) {
                const timeDiffStr =
                  event.timeDiff > 0 ? `+${event.timeDiff}ms` : `${event.timeDiff}ms`;
                output += `     [${timeDiffStr}] ${event.source}: ${event.message}\n`;
              }
            } else {
              output += `   No correlated events found\n`;
            }
          }
        }

        return { content: [{ type: "text", text: output }] };
      },
    },
    {
      definition: {
        name: "hev_get_agent_tool_trace",
        description:
          "AI agent'ın kullandığı toolların sıralı izini (trace) al: hangi tool hangi sırada kullanıldı, başarılı mı?",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID (varsayılan: en son session)",
            },
            limit: {
              type: "number",
              description: "Son N tool çağrısını göster (varsayılan: 50)",
              default: 50,
            },
          },
        },
        metadata: {
          category: "debug",
          subcategory: "mcp-analysis",
          priority: "medium",
          complexity: "simple",
          useCases: [
            "AI agent behavior analizi",
            "Tool kullanım pattern tespiti",
            "Debugging agent logic",
          ],
          relatedTools: ["hev_analyze_mcp_tool_usage"],
          agentGuidance:
            "Agent hangi toolları kullandı? Trace ile tool kullanım sırasını ve başarı durumunu gör.",
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["mcp", "agent", "trace", "behavior"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const result = await getAgentToolTrace(args as { sessionId?: string; limit?: number });

        let output = `🔍 Agent Tool Trace\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `Total Unique Tools: ${result.totalTools}\n`;
        output += `Showing: Last ${result.toolSequence.length} calls\n\n`;

        for (const call of result.toolSequence) {
          const icon = call.success ? "✅" : "❌";
          const durationStr = typeof call.duration === "number" ? ` (${call.duration}ms)` : "";
          output += `${icon} [${call.timestamp}] ${call.toolName}${durationStr}\n`;
        }

        return { content: [{ type: "text", text: output }] };
      },
    },
  ];
}
