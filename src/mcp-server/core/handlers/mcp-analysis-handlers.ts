import {
  analyzeMcpToolUsage,
  getMcpToolPerformance,
  correlateMcpErrors,
  getAgentToolTrace,
} from "../../tools/log/mcp-analysis.js";
import { streamLogsRealtime, STREAM_LOGS_REALTIME_TOOL } from "../../tools/log/streaming.js";
import type { StreamLogsRealtimeArgs } from "../../tools/log/streaming.js";
import { createMcpTranslator, createMcpTranslatorSync } from "../../utils/i18n/index.js";
import type { TranslationParams } from "../../../types/i18n.js";
import type { ToolEntry } from "../registry.js";

type McpTranslator = (key: string, params?: TranslationParams) => string;

const analysisToolDefinitionTranslator = createMcpTranslatorSync();

function analysisToolT(key: string, params?: TranslationParams): string {
  return analysisToolDefinitionTranslator(`mcpServer.fs.toolDefinitions.analysis.${key}`, params);
}

function analysisT(t: McpTranslator, key: string, params?: TranslationParams): string {
  return t(`mcpServer.analysis.${key}`, params);
}

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
        description: analysisToolT("usage.description"),
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: analysisToolT("usage.sessionId"),
            },
            timeRange: {
              type: "object",
              properties: {
                from: { type: "string", description: analysisToolT("usage.timeRangeFrom") },
                to: { type: "string", description: analysisToolT("usage.timeRangeTo") },
              },
              description: analysisToolT("usage.timeRange"),
            },
          },
        },
        metadata: {
          category: "debug",
          subcategory: "mcp-analysis",
          priority: "medium",
          complexity: "medium",
          useCases: [
            analysisToolT("usage.useCases.performanceAnalysis"),
            analysisToolT("usage.useCases.popularTools"),
            analysisToolT("usage.useCases.slowTools"),
            analysisToolT("usage.useCases.errorRate"),
          ],
          relatedTools: ["hev_get_mcp_tool_performance", "hev_correlate_mcp_errors"],
          agentGuidance: analysisToolT("usage.agentGuidance"),
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["mcp", "analysis", "performance", "statistics"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const t = await createMcpTranslator();
        const result = await analyzeMcpToolUsage(
          args as { sessionId?: string; timeRange?: { from: string; to: string } }
        );

        const lines = [
          analysisT(t, "usage.title"),
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          analysisT(t, "usage.totalCalls", { value: result.totalCalls }),
          analysisT(t, "usage.totalErrors", { value: result.totalErrors }),
          "",
        ];

        if (result.byTool.length > 0) {
          lines.push(analysisT(t, "usage.topToolsTitle"));
          for (const tool of result.byTool.slice(0, 10)) {
            lines.push(
              analysisT(t, "usage.topToolLine", {
                tool: tool.tool,
                calls: tool.calls,
                avgDuration: tool.avgDuration,
                errorPct: (tool.errorRate * 100).toFixed(1),
              })
            );
          }
        }

        if (result.slowestCalls.length > 0) {
          lines.push("", analysisT(t, "usage.slowestCallsTitle"));
          for (const call of result.slowestCalls.slice(0, 5)) {
            lines.push(
              analysisT(t, "usage.slowestCallLine", {
                tool: call.tool,
                duration: call.duration,
                timestamp: call.timestamp,
              })
            );
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    },
    {
      definition: {
        name: "hev_get_mcp_tool_performance",
        description: analysisToolT("performance.description"),
        inputSchema: {
          type: "object",
          properties: {
            toolName: {
              type: "string",
              description: analysisToolT("performance.toolName"),
            },
            sessionId: {
              type: "string",
              description: analysisToolT("performance.sessionId"),
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
            analysisToolT("performance.useCases.singleToolAnalysis"),
            analysisToolT("performance.useCases.recentErrors"),
            analysisToolT("performance.useCases.performanceRegression"),
          ],
          relatedTools: ["hev_analyze_mcp_tool_usage", "hev_correlate_mcp_errors"],
          agentGuidance: analysisToolT("performance.agentGuidance"),
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["mcp", "performance", "tool-specific", "metrics"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const t = await createMcpTranslator();
        const result = await getMcpToolPerformance(
          args as { toolName: string; sessionId?: string }
        );

        const lines = [
          analysisT(t, "performance.title", { toolName: result.toolName }),
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          analysisT(t, "performance.totalCalls", { value: result.totalCalls }),
          analysisT(t, "performance.successfulCalls", { value: result.successfulCalls }),
          analysisT(t, "performance.failedCalls", { value: result.failedCalls }),
          analysisT(t, "performance.avgDuration", { value: result.avgDuration }),
          analysisT(t, "performance.minMaxDuration", {
            min: result.minDuration,
            max: result.maxDuration,
          }),
        ];

        if (result.recentErrors.length > 0) {
          lines.push("", analysisT(t, "performance.recentErrorsTitle"));
          for (const err of result.recentErrors) {
            lines.push(
              analysisT(t, "performance.recentErrorLine", {
                timestamp: err.timestamp,
                error: err.error,
              })
            );
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    },
    {
      definition: {
        name: "hev_correlate_mcp_errors",
        description: analysisToolT("correlation.description"),
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: analysisToolT("correlation.sessionId"),
            },
            timeWindow: {
              type: "number",
              description: analysisToolT("correlation.timeWindow"),
              default: 5000,
            },
          },
        },
        metadata: {
          category: "debug",
          subcategory: "mcp-analysis",
          priority: "high",
          complexity: "complex",
          useCases: [
            analysisToolT("correlation.useCases.rootCauseQuestion"),
            analysisToolT("correlation.useCases.errorCorrelation"),
            analysisToolT("correlation.useCases.rootCauseAnalysis"),
          ],
          relatedTools: ["hev_analyze_mcp_tool_usage", "hev_read_electron_logs"],
          agentGuidance: analysisToolT("correlation.agentGuidance"),
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["mcp", "error", "correlation", "debugging"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const t = await createMcpTranslator();
        const result = await correlateMcpErrors(
          args as { sessionId?: string; timeWindow?: number }
        );

        const lines = [
          analysisT(t, "correlation.title"),
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ];

        if (result.mcpErrors.length === 0) {
          lines.push(analysisT(t, "correlation.noErrors"));
        } else {
          for (const error of result.mcpErrors) {
            lines.push(
              "",
              analysisT(t, "correlation.errorLine", {
                toolName: error.toolName,
                timestamp: error.timestamp,
              }),
              analysisT(t, "correlation.errorDetail", { error: error.error })
            );

            if (error.nearbyEvents.length > 0) {
              lines.push(analysisT(t, "correlation.nearbyEventsTitle"));
              for (const event of error.nearbyEvents) {
                const timeDiff =
                  event.timeDiff > 0 ? `+${event.timeDiff}ms` : `${event.timeDiff}ms`;
                lines.push(
                  analysisT(t, "correlation.nearbyEventLine", {
                    timeDiff,
                    source: event.source,
                    message: event.message,
                  })
                );
              }
            } else {
              lines.push(analysisT(t, "correlation.noCorrelatedEvents"));
            }
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    },
    {
      definition: {
        name: "hev_get_agent_tool_trace",
        description: analysisToolT("trace.description"),
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: analysisToolT("trace.sessionId"),
            },
            limit: {
              type: "number",
              description: analysisToolT("trace.limit"),
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
            analysisToolT("trace.useCases.behaviorAnalysis"),
            analysisToolT("trace.useCases.patternDetection"),
            analysisToolT("trace.useCases.debugAgentLogic"),
          ],
          relatedTools: ["hev_analyze_mcp_tool_usage"],
          agentGuidance: analysisToolT("trace.agentGuidance"),
          requiresConfirmation: false,
          riskLevel: "low",
          tags: ["mcp", "agent", "trace", "behavior"],
        },
      },
      handler: async (args): Promise<unknown> => {
        const t = await createMcpTranslator();
        const result = await getAgentToolTrace(args as { sessionId?: string; limit?: number });

        const lines = [
          analysisT(t, "trace.title"),
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          analysisT(t, "trace.totalTools", { value: result.totalTools }),
          analysisT(t, "trace.showingLastCalls", { value: result.toolSequence.length }),
          "",
        ];

        for (const call of result.toolSequence) {
          const icon = call.success ? "✅" : "❌";
          if (typeof call.duration === "number") {
            lines.push(
              analysisT(t, "trace.callLineWithDuration", {
                icon,
                timestamp: call.timestamp,
                toolName: call.toolName,
                duration: call.duration,
              })
            );
            continue;
          }

          lines.push(
            analysisT(t, "trace.callLine", {
              icon,
              timestamp: call.timestamp,
              toolName: call.toolName,
            })
          );
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    },
  ];
}
