/**
 * MCP Log Tools - Public API
 *
 * Combines existing and enhanced log tools
 */

// Enhanced tools (NEW)
export {
  streamLogs,
  analyzeErrors,
  traceCorrelation,
  getPerformanceReport,
  exportLogs,
  type StreamLogsArgs,
  type AnalyzeErrorsArgs,
  type AnalyzeErrorsResult,
  type ErrorCluster,
  type TraceCorrelationArgs,
  type CorrelationTrace,
  type PerformanceReportArgs,
  type PerformanceReport,
  type ExportLogsArgs,
  type ExportLogsResult,
} from "./enhanced-tools.js";

// Real-time Streaming (NEW)
export {
  streamLogsRealtime,
  STREAM_LOGS_REALTIME_TOOL,
  type StreamLogsRealtimeArgs,
  type StreamLogsRealtimeResult,
} from "./streaming.js";

// MCP Analysis Tools (SESSION 5.5)
export {
  analyzeMcpToolUsage,
  getMcpToolPerformance,
  correlateMcpErrors,
  getAgentToolTrace,
} from "./mcp-analysis.js";

// Re-export existing tools from log-tools.ts will be integrated later
