/**
 * Enhanced MCP Log Tools
 *
 * Advanced logging tools for AI agents:
 * - Real-time streaming
 * - Error clustering
 * - Correlation tracing
 * - Performance analysis
 * - Batch export
 *
 * @module mcp-server/tools/log/enhanced-tools
 */

import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { PROJECT_ROOT } from "../../utils/project-root.js";
import { createMcpTranslator } from "../../utils/i18n/index.js";
import type { LogEntry, LogQueryFilter } from "@shared/index.js";

export interface StreamLogsArgs {
  sessionId?: string; // Specific session or current
  tail?: number; // Start from last N lines
  filter?: AdvancedLogFilter;
}

export interface AdvancedLogFilter {
  level?: string[];
  category?: string[];
  contains?: string;
  regex?: string;
  correlationId?: string;
}

function enhancedLogT(
  t: (key: string, params?: Record<string, string | number | boolean>) => string,
  key: string,
  params?: Record<string, string | number | boolean>
): string {
  return t(`mcpServer.enhancedLogTools.${key}`, params);
}

export async function streamLogs(args: StreamLogsArgs): Promise<LogEntry[]> {
  const t = await createMcpTranslator();
  const logDir = join(PROJECT_ROOT, "logs", "app");
  const sessionId = args.sessionId ?? (await getCurrentSessionId(logDir));
  const sessionDir = join(logDir, sessionId);
  const structuredPath = join(sessionDir, "structured.jsonl");

  if (!existsSync(structuredPath)) {
    throw new Error(enhancedLogT(t, "errors.sessionNotFound", { sessionId }));
  }

  const content = await readFile(structuredPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  let entries: LogEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as LogEntry);
    } catch {}
  }

  if (args.filter) {
    entries = applyAdvancedFilters(entries, args.filter);
  }

  if (args.tail != null && args.tail > 0) {
    entries = entries.slice(-args.tail);
  }

  return entries;
}

export interface AnalyzeErrorsArgs {
  sessionId?: string;
  timeRange?: { from: string; to: string };
  groupBy?: "category" | "message" | "stack";
  minClusterSize?: number; // Minimum errors to form a cluster
}

export interface ErrorCluster {
  pattern: string;
  count: number;
  category: string;
  examples: LogEntry[];
  firstSeen: string;
  lastSeen: string;
  aiHint?: string;
}

export interface AnalyzeErrorsResult {
  totalErrors: number;
  uniqueErrors: number;
  clusters: ErrorCluster[];
  timeline: Array<{ timestamp: string; count: number }>;
}

export async function analyzeErrors(args: AnalyzeErrorsArgs): Promise<AnalyzeErrorsResult> {
  const t = await createMcpTranslator();
  const logDir = join(PROJECT_ROOT, "logs", "app");
  const sessionId = args.sessionId ?? (await getCurrentSessionId(logDir));
  const sessionDir = join(logDir, sessionId);
  const structuredPath = join(sessionDir, "structured.jsonl");

  if (!existsSync(structuredPath)) {
    throw new Error(enhancedLogT(t, "errors.sessionNotFound", { sessionId }));
  }

  const content = await readFile(structuredPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  let errors: LogEntry[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LogEntry;
      if (entry.level === "error") {
        errors.push(entry);
      }
    } catch {}
  }

  if (args.timeRange) {
    const from = new Date(args.timeRange.from).getTime();
    const to = new Date(args.timeRange.to).getTime();
    errors = errors.filter((e) => {
      const time = new Date(e.timestamp).getTime();
      return time >= from && time <= to;
    });
  }

  const groupBy = args.groupBy ?? "message";
  const minClusterSize = args.minClusterSize ?? 2;

  const grouped = new Map<string, LogEntry[]>();

  for (const error of errors) {
    let key: string;

    if (groupBy === "category") {
      key = String(error.category);
    } else if (groupBy === "stack") {
      key = error.error?.stack?.split("\n")[0] ?? error.message;
    } else {
      key = error.message;
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    const group = grouped.get(key);
    if (group) group.push(error);
  }

  const clusters: ErrorCluster[] = [];

  for (const [pattern, entries] of grouped) {
    if (entries.length >= minClusterSize) {
      const sorted = entries.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      clusters.push({
        pattern,
        count: entries.length,
        category: String(entries[0]?.category ?? enhancedLogT(t, "common.unknown")),
        examples: entries.slice(0, 3),
        firstSeen: sorted[0]?.timestamp ?? "",
        lastSeen: sorted[sorted.length - 1]?.timestamp ?? "",
        ...(entries[0]?.aiHint?.suggestion != null && entries[0].aiHint.suggestion !== ""
          ? { aiHint: entries[0].aiHint.suggestion }
          : {}),
      });
    }
  }

  clusters.sort((a, b) => b.count - a.count);

  const timeline = createErrorTimeline(errors);

  return {
    totalErrors: errors.length,
    uniqueErrors: grouped.size,
    clusters,
    timeline,
  };
}

export interface TraceCorrelationArgs {
  correlationId: string;
  sessionId?: string;
}

export interface CorrelationTrace {
  correlationId: string;
  operation: string;
  category: string;
  timeline: LogEntry[];
  duration?: number; // ms
  status: "success" | "failed" | "incomplete";
  result?: string;
}

export async function traceCorrelation(args: TraceCorrelationArgs): Promise<CorrelationTrace> {
  const t = await createMcpTranslator();
  const logDir = join(PROJECT_ROOT, "logs", "app");
  const sessionId = args.sessionId ?? (await getCurrentSessionId(logDir));
  const sessionDir = join(logDir, sessionId);
  const structuredPath = join(sessionDir, "structured.jsonl");

  if (!existsSync(structuredPath)) {
    throw new Error(enhancedLogT(t, "errors.sessionNotFound", { sessionId }));
  }

  const content = await readFile(structuredPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  const timeline: LogEntry[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LogEntry;
      if (entry.correlationId === args.correlationId) {
        timeline.push(entry);
      }
    } catch {}
  }

  if (timeline.length === 0) {
    throw new Error(
      enhancedLogT(t, "errors.noLogsForCorrelationId", { correlationId: args.correlationId })
    );
  }

  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const first = timeline[0];

  const operationName =
    typeof first?.context?.operationName === "string"
      ? first.context.operationName
      : enhancedLogT(t, "common.unknownOperation");
  const category = String(first?.category ?? enhancedLogT(t, "common.unknown"));

  let status: "success" | "failed" | "incomplete" = "incomplete";
  let result: string | undefined;
  let duration: number | undefined;

  for (const entry of timeline) {
    if (entry.message.includes("[OPERATION SUCCESS]")) {
      status = "success";
      result = (entry.context as Record<string, unknown> | undefined)?.["result"] as string;
      duration = (entry.context as Record<string, unknown> | undefined)?.["duration"] as number;
    } else if (entry.message.includes("[OPERATION FAILED]")) {
      status = "failed";
      result = entry.message;
      duration = (entry.context as Record<string, unknown> | undefined)?.["duration"] as number;
    }
  }

  return {
    correlationId: args.correlationId,
    operation: operationName,
    category,
    timeline,
    ...(duration !== undefined ? { duration } : {}),
    status,
    ...(result !== undefined ? { result } : {}),
  };
}

export interface PerformanceReportArgs {
  sessionId?: string;
  interval?: "1m" | "5m" | "15m" | "1h";
}

export interface PerformanceReport {
  sessionId: string;
  timeRange: { from: string; to: string };

  totalLogs: number;
  logsPerSecond: number;

  byLevel: Record<string, number>;
  errorRate: number;

  topCategories: Array<{ category: string; count: number; percentage: number }>;

  averageOperationDuration?: number;
  slowestOperations?: Array<{ operation: string; duration: number; timestamp: string }>;

  logVolumeTimeline: Array<{ timestamp: string; count: number }>;
}

export async function getPerformanceReport(
  args: PerformanceReportArgs
): Promise<PerformanceReport> {
  const t = await createMcpTranslator();
  const logDir = join(PROJECT_ROOT, "logs", "app");
  const sessionId = args.sessionId ?? (await getCurrentSessionId(logDir));
  const sessionDir = join(logDir, sessionId);
  const structuredPath = join(sessionDir, "structured.jsonl");

  if (!existsSync(structuredPath)) {
    throw new Error(enhancedLogT(t, "errors.sessionNotFound", { sessionId }));
  }

  const content = await readFile(structuredPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  const entries: LogEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as LogEntry);
    } catch {}
  }

  if (entries.length === 0) {
    throw new Error(enhancedLogT(t, "errors.noLogsInSession"));
  }

  const sorted = entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstTime = new Date(sorted[0]?.timestamp ?? Date.now());
  const lastTime = new Date(sorted[sorted.length - 1]?.timestamp ?? Date.now());
  const durationSec = (lastTime.getTime() - firstTime.getTime()) / 1000;

  const byLevel: Record<string, number> = {};
  for (const entry of entries) {
    byLevel[entry.level] = (byLevel[entry.level] ?? 0) + 1;
  }

  const errorCount = byLevel["error"] ?? 0;
  const errorRate = entries.length > 0 ? errorCount / entries.length : 0;

  const byCategory = new Map<string, number>();
  for (const entry of entries) {
    const cat = String(entry.category);
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
  }

  const topCategories = Array.from(byCategory.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: (count / entries.length) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const logVolumeTimeline = createLogVolumeTimeline(entries, args.interval ?? "5m");

  return {
    sessionId,
    timeRange: {
      from: sorted[0]?.timestamp ?? "",
      to: sorted[sorted.length - 1]?.timestamp ?? "",
    },
    totalLogs: entries.length,
    logsPerSecond: entries.length / durationSec,
    byLevel,
    errorRate,
    topCategories,
    logVolumeTimeline,
  };
}

export interface ExportLogsArgs {
  sessionId: string;
  format: "json" | "csv" | "jsonl";
  filter?: LogQueryFilter;
  outputPath: string;
}

export interface ExportLogsResult {
  format: string;
  outputPath: string;
  totalExported: number;
  fileSize: number;
  duration: number;
}

export async function exportLogs(args: ExportLogsArgs): Promise<ExportLogsResult> {
  const startTime = Date.now();
  const t = await createMcpTranslator();

  const logDir = join(PROJECT_ROOT, "logs", "app");
  const sessionDir = join(logDir, args.sessionId);
  const structuredPath = join(sessionDir, "structured.jsonl");

  if (!existsSync(structuredPath)) {
    throw new Error(enhancedLogT(t, "errors.sessionNotFound", { sessionId: args.sessionId }));
  }

  const content = await readFile(structuredPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  let entries: LogEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as LogEntry);
    } catch {}
  }

  if (args.filter) {
    entries = applyAdvancedFilters(entries, args.filter);
  }

  const { writeFile } = await import("fs/promises");
  let exportContent: string;

  if (args.format === "json") {
    exportContent = JSON.stringify(entries, null, 2);
  } else if (args.format === "jsonl") {
    exportContent = entries.map((e) => JSON.stringify(e)).join("\n");
  } else {
    exportContent = convertToCSV(entries);
  }

  await writeFile(args.outputPath, exportContent, "utf-8");

  const fileSize = Buffer.byteLength(exportContent, "utf-8");
  const duration = Date.now() - startTime;

  return {
    format: args.format,
    outputPath: args.outputPath,
    totalExported: entries.length,
    fileSize,
    duration,
  };
}

async function getCurrentSessionId(logDir: string): Promise<string> {
  const sessions = await readdir(logDir);
  const sorted = sessions.sort().reverse();
  return sorted[0] ?? "";
}

function applyAdvancedFilters(entries: LogEntry[], filter: AdvancedLogFilter): LogEntry[] {
  let filtered = entries;

  if (filter.level != null && filter.level.length > 0) {
    filtered = filtered.filter((e) => filter.level?.includes(e.level) === true);
  }

  if (filter.category != null && filter.category.length > 0) {
    filtered = filtered.filter((e) => filter.category?.includes(String(e.category)) === true);
  }

  if (filter.contains != null && filter.contains !== "") {
    const search = filter.contains.toLowerCase();
    filtered = filtered.filter((e) => e.message.toLowerCase().includes(search));
  }

  if (filter.regex != null && filter.regex !== "") {
    const regex = new RegExp(filter.regex, "i");
    filtered = filtered.filter((e) => regex.test(e.message));
  }

  if (filter.correlationId != null && filter.correlationId !== "") {
    filtered = filtered.filter((e) => e.correlationId === filter.correlationId);
  }

  return filtered;
}

function createErrorTimeline(errors: LogEntry[]): Array<{ timestamp: string; count: number }> {
  const byMinute = new Map<string, number>();

  for (const error of errors) {
    const minute = error.timestamp.substring(0, 16);
    byMinute.set(minute, (byMinute.get(minute) ?? 0) + 1);
  }

  return Array.from(byMinute.entries())
    .map(([timestamp, count]) => ({ timestamp, count }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function createLogVolumeTimeline(
  entries: LogEntry[],
  interval: "1m" | "5m" | "15m" | "1h"
): Array<{ timestamp: string; count: number }> {
  const intervalMs = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
  }[interval];

  const buckets = new Map<number, number>();

  for (const entry of entries) {
    const time = new Date(entry.timestamp).getTime();
    const bucket = Math.floor(time / intervalMs) * intervalMs;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([timestamp, count]) => ({
      timestamp: new Date(timestamp).toISOString(),
      count,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function convertToCSV(entries: LogEntry[]): string {
  const headers = ["timestamp", "level", "category", "message", "visibility", "correlationId"];
  const rows = [headers.join(",")];

  for (const entry of entries) {
    const row = [
      entry.timestamp,
      entry.level,
      String(entry.category),
      `"${entry.message.replace(/"/g, '""')}"`,
      entry.visibility ?? "",
      entry.correlationId ?? "",
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
}
