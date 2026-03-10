/**
 * MCP Log Tools - Public API
 *
 * Combines existing and enhanced log tools
 */

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

export {
  streamLogsRealtime,
  STREAM_LOGS_REALTIME_TOOL,
  type StreamLogsRealtimeArgs,
  type StreamLogsRealtimeResult,
} from "./streaming.js";

export {
  analyzeMcpToolUsage,
  getMcpToolPerformance,
  correlateMcpErrors,
  getAgentToolTrace,
} from "./mcp-analysis.js";
