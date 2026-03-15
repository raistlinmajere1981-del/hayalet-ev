// NOTE: Analyze MCP log streams for usage and performance stats.

import { readFile } from "fs/promises";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";
import { PROJECT_ROOT } from "../../utils/project-root.js";

const MCP_LOG_DIR = join(PROJECT_ROOT, "logs", "mcp-server");
const APP_LOG_DIR_CANDIDATES = [join(PROJECT_ROOT, "logs", "app")];

interface MCPLogEntry {
  timestamp: string;
  level: string;
  category: string;
  toolName?: string;
  operation: "start" | "success" | "error";
  duration?: number;
  args?: unknown;
  result?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  agentContext?: unknown;
}

interface ToolStats {
  tool: string;
  calls: number;
  avgDuration: number;
  errorRate: number;
}

interface SlowCall {
  tool: string;
  duration: number;
  timestamp: string;
}

interface AnalysisResult {
  totalCalls: number;
  byTool: ToolStats[];
  totalErrors: number;
  slowestCalls: SlowCall[];
}

interface StructuredEvent {
  timestamp: string;
  source: string;
  message: string;
}

function analysisRuntimeT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.analysis.common.${key}`, params);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStructuredEvent(line: string, unknownValue: string): StructuredEvent | null {
  try {
    const parsed: unknown = JSON.parse(line);
    if (!isRecord(parsed)) return null;
    const timestamp = typeof parsed["timestamp"] === "string" ? parsed["timestamp"] : "";
    const sourceValue =
      typeof parsed["source"] === "string"
        ? parsed["source"]
        : typeof parsed["category"] === "string"
          ? parsed["category"]
          : unknownValue;
    const message = typeof parsed["message"] === "string" ? parsed["message"] : "";
    return { timestamp, source: sourceValue, message };
  } catch {
    return null;
  }
}

function getCurrentSessionId(logDir: string | string[]): string {
  try {
    const logDirs = Array.isArray(logDir) ? logDir : [logDir];
    const sessions = logDirs.flatMap((candidateDir) => {
      if (!existsSync(candidateDir)) return [];

      return readdirSync(candidateDir)
        .map((entryName) => {
          try {
            const sessionPath = join(candidateDir, entryName);
            const sessionStat = statSync(sessionPath);
            if (!sessionStat.isDirectory()) return null;
            return { entryName, mtimeMs: sessionStat.mtimeMs };
          } catch {
            return null;
          }
        })
        .filter((entry): entry is { entryName: string; mtimeMs: number } => entry !== null);
    });

    sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);

    return sessions[0]?.entryName ?? "default";
  } catch {
    return "default";
  }
}

function resolveAppStructuredLogPath(preferredSessionId: string): string | null {
  for (const logDir of APP_LOG_DIR_CANDIDATES) {
    const preferredPath = join(logDir, preferredSessionId, "structured.jsonl");
    if (existsSync(preferredPath)) {
      return preferredPath;
    }
  }

  const fallbackSessionId = getCurrentSessionId(APP_LOG_DIR_CANDIDATES);
  for (const logDir of APP_LOG_DIR_CANDIDATES) {
    const fallbackPath = join(logDir, fallbackSessionId, "structured.jsonl");
    if (existsSync(fallbackPath)) {
      return fallbackPath;
    }
  }

  return null;
}

export async function analyzeMcpToolUsage(args: {
  sessionId?: string;
  timeRange?: { from: string; to: string };
}): Promise<AnalysisResult> {
  const unknownValue = analysisRuntimeT("unknown");
  const sessionId = args.sessionId ?? getCurrentSessionId(MCP_LOG_DIR);
  const mcpLogPath = join(MCP_LOG_DIR, sessionId, "mcp-tools.jsonl");

  if (!existsSync(mcpLogPath)) {
    return {
      totalCalls: 0,
      byTool: [],
      totalErrors: 0,
      slowestCalls: [],
    };
  }

  const content = await readFile(mcpLogPath, "utf-8");
  const entries = content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as MCPLogEntry);

  let filtered = entries;
  if (args.timeRange) {
    const from = new Date(args.timeRange.from).getTime();
    const to = new Date(args.timeRange.to).getTime();
    filtered = entries.filter((e) => {
      const time = new Date(e.timestamp).getTime();
      return time >= from && time <= to;
    });
  }

  const byTool = new Map<string, { calls: number; durations: number[]; errors: number }>();

  for (const entry of filtered) {
    if (entry.toolName == null) continue;

    if (!byTool.has(entry.toolName)) {
      byTool.set(entry.toolName, { calls: 0, durations: [], errors: 0 });
    }

    const stats = byTool.get(entry.toolName);
    if (!stats) continue;

    if (entry.operation === "start") {
      stats.calls++;
    } else if (entry.operation === "success" && entry.duration != null) {
      stats.durations.push(entry.duration);
    } else if (entry.operation === "error") {
      stats.errors++;
    }
  }

  const toolStats = Array.from(byTool.entries()).map(([tool, stats]) => ({
    tool,
    calls: stats.calls,
    avgDuration:
      stats.durations.length > 0
        ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
        : 0,
    errorRate: stats.calls > 0 ? stats.errors / stats.calls : 0,
  }));

  toolStats.sort((a, b) => b.calls - a.calls);

  const slowestCalls = filtered
    .filter((e) => e.operation === "success" && e.duration != null)
    .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
    .slice(0, 10)
    .map((e) => ({
      tool: e.toolName ?? unknownValue,
      duration: e.duration ?? 0,
      timestamp: e.timestamp,
    }));

  return {
    totalCalls: filtered.filter((e) => e.operation === "start").length,
    byTool: toolStats,
    totalErrors: filtered.filter((e) => e.operation === "error").length,
    slowestCalls,
  };
}

export async function getMcpToolPerformance(args: {
  toolName: string;
  sessionId?: string;
}): Promise<{
  toolName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  recentErrors: Array<{ timestamp: string; error: string }>;
}> {
  const unknownError = analysisRuntimeT("unknownError");
  const sessionId = args.sessionId ?? getCurrentSessionId(MCP_LOG_DIR);
  const mcpLogPath = join(MCP_LOG_DIR, sessionId, "mcp-tools.jsonl");

  if (!existsSync(mcpLogPath)) {
    return {
      toolName: args.toolName,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      recentErrors: [],
    };
  }

  const content = await readFile(mcpLogPath, "utf-8");
  const entries = content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as MCPLogEntry)
    .filter((e) => e.toolName === args.toolName);

  const durations = entries
    .filter((e) => e.operation === "success" && e.duration != null)
    .map((e) => e.duration ?? 0);

  const recentErrors = entries
    .filter((e) => e.operation === "error")
    .slice(-5)
    .map((e) => ({
      timestamp: e.timestamp,
      error: e.error?.message ?? unknownError,
    }));

  return {
    toolName: args.toolName,
    totalCalls: entries.filter((e) => e.operation === "start").length,
    successfulCalls: entries.filter((e) => e.operation === "success").length,
    failedCalls: entries.filter((e) => e.operation === "error").length,
    avgDuration:
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
    minDuration: durations.length > 0 ? Math.min(...durations) : 0,
    maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
    recentErrors,
  };
}

export async function correlateMcpErrors(args: {
  sessionId?: string;
  timeWindow?: number;
}): Promise<{
  mcpErrors: Array<{
    timestamp: string;
    toolName: string;
    error: string;
    nearbyEvents: Array<{
      source: string;
      message: string;
      timeDiff: number;
    }>;
  }>;
}> {
  const unknownValue = analysisRuntimeT("unknown");
  const unknownError = analysisRuntimeT("unknownError");
  const sessionId = args.sessionId ?? getCurrentSessionId(MCP_LOG_DIR);
  const mcpLogPath = join(MCP_LOG_DIR, sessionId, "mcp-tools.jsonl");
  const structuredLogPath = resolveAppStructuredLogPath(sessionId);
  const timeWindow = args.timeWindow ?? 5000;

  if (!existsSync(mcpLogPath)) {
    return { mcpErrors: [] };
  }

  const mcpContent = await readFile(mcpLogPath, "utf-8");
  const mcpErrors = mcpContent
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as MCPLogEntry)
    .filter((e) => e.operation === "error");

  let structuredEvents: StructuredEvent[] = [];
  if (structuredLogPath !== null && existsSync(structuredLogPath)) {
    const structuredContent = await readFile(structuredLogPath, "utf-8");
    structuredEvents = structuredContent
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => parseStructuredEvent(line, unknownValue))
      .filter((event): event is StructuredEvent => event !== null);
  }

  const correlatedErrors = mcpErrors.map((error) => {
    const errorTime = new Date(error.timestamp).getTime();

    const nearbyEvents = structuredEvents
      .map((event) => {
        const eventTime = new Date(event.timestamp).getTime();
        const timeDiff = eventTime - errorTime;
        return { ...event, timeDiff };
      })
      .filter((event) => Math.abs(event.timeDiff) <= timeWindow && event.source !== "mcp-server")
      .sort((a, b) => Math.abs(a.timeDiff) - Math.abs(b.timeDiff))
      .slice(0, 5);

    return {
      timestamp: error.timestamp,
      toolName: error.toolName ?? unknownValue,
      error: error.error?.message ?? unknownError,
      nearbyEvents,
    };
  });

  return { mcpErrors: correlatedErrors };
}

export async function getAgentToolTrace(args: { sessionId?: string; limit?: number }): Promise<{
  totalTools: number;
  toolSequence: Array<{
    timestamp: string;
    toolName: string;
    operation: string;
    duration?: number;
    success: boolean;
  }>;
}> {
  const unknownValue = analysisRuntimeT("unknown");
  const sessionId = args.sessionId ?? getCurrentSessionId(MCP_LOG_DIR);
  const mcpLogPath = join(MCP_LOG_DIR, sessionId, "mcp-tools.jsonl");
  const limit = args.limit ?? 50;

  if (!existsSync(mcpLogPath)) {
    return { totalTools: 0, toolSequence: [] };
  }

  const content = await readFile(mcpLogPath, "utf-8");
  const entries = content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as MCPLogEntry);

  const toolSequence = entries
    .slice(-limit * 2)
    .slice(-limit)
    .map((e) => ({
      timestamp: e.timestamp,
      toolName: e.toolName ?? unknownValue,
      operation: e.operation,
      ...(e.duration !== undefined ? { duration: e.duration } : {}),
      success: e.operation === "success",
    }));

  return {
    totalTools: new Set(entries.map((e) => e.toolName)).size,
    toolSequence,
  };
}
