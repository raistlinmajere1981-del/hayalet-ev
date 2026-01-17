/**
 * LogReader - Log okuma ve sorgulama işlemleri
 *
 * Bu modül log dosyalarını okuma ve sorgulama işlemlerini yönetir:
 * - Console logları okuma
 * - Error logları okuma
 * - Tüm logları okuma (session bazlı)
 * - Log sorgulama (filtre)
 */

import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getSessionDir, getLogDir, getSessionId } from "./session-manager.ts";
import { getErrorLogPath } from "./log-writer.ts";
import type { LogQueryParams, SessionMeta, SessionSummary, StructuredLogEntry } from "../types/index.ts";

/**
 * Console loglarını oku
 */
export async function readConsoleLogs(tail: number = 100): Promise<string> {
  try {
    const sessionDir = getSessionDir();
    if (!sessionDir || !existsSync(sessionDir)) {
      return "No session logs found";
    }
    
    const files = await readdir(sessionDir);
    const consoleFiles = files
      .filter(f => f.startsWith("console-") && f.endsWith(".log"))
      .sort();
    
    let allLines: string[] = [];
    for (const file of consoleFiles) {
      const content = await readFile(join(sessionDir, file), "utf-8");
      allLines = allLines.concat(content.split("\n").filter(l => l.trim()));
    }
    
    return allLines.slice(-tail).join("\n");
  } catch (err) {
    return `Failed to read logs: ${err.message}`;
  }
}

/**
 * Error loglarını oku
 */
export async function readErrorLogs(tail: number = 100): Promise<string> {
  try {
    const errorLog = getErrorLogPath();
    if (!errorLog || !existsSync(errorLog)) {
      return "No error logs found";
    }
    
    const content = await readFile(errorLog, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    return lines.slice(-tail).join("\n");
  } catch (err) {
    return `Failed to read error logs: ${err.message}`;
  }
}

interface AllLogsResult {
  sessionId: string | null;
  console: string;
  error: string;
  structured: StructuredLogEntry[];
  meta: SessionMeta | null;
  summary: SessionSummary | null;
}

/**
 * Tüm logları oku (session bazlı)
 */
export async function readAllLogs(targetSessionId: string | null = null): Promise<AllLogsResult> {
  const logDir = getLogDir();
  const sessionId = targetSessionId || getSessionId();
  const sessionDir = targetSessionId
    ? join(logDir!, targetSessionId)
    : getSessionDir();

  const result: AllLogsResult = {
    sessionId,
    console: "",
    error: "",
    structured: [],
    meta: null,
    summary: null,
  };
  
  try {
    if (!existsSync(sessionDir)) {
      return { ...result, error: "Session not found" };
    }
    
    const files = await readdir(sessionDir);
    const consoleFiles = files
      .filter(f => f.startsWith("console-") && f.endsWith(".log"))
      .sort();
    
    for (const file of consoleFiles) {
      result.console += await readFile(join(sessionDir, file), "utf-8");
    }
    
    const errorPath = join(sessionDir, "error.log");
    if (existsSync(errorPath)) {
      result.error = await readFile(errorPath, "utf-8");
    }
    
    const structuredPath = join(sessionDir, "structured.jsonl");
    if (existsSync(structuredPath)) {
      const content = await readFile(structuredPath, "utf-8");
      result.structured = content
        .split("\n")
        .filter(l => l.trim())
        .map(l => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
    
    const metaPath = join(sessionDir, "meta.json");
    if (existsSync(metaPath)) {
      result.meta = JSON.parse(await readFile(metaPath, "utf-8"));
    }
    
    const summaryPath = join(sessionDir, "summary.json");
    if (existsSync(summaryPath)) {
      result.summary = JSON.parse(await readFile(summaryPath, "utf-8"));
    }
  } catch (err) {
    result.error = `Failed to read logs: ${err.message}`;
  }
  
  return result;
}

/**
 * Logları sorgula
 */
export async function queryLogs(query: LogQueryParams = {}): Promise<string[]> {
  const {
    type = "all",
    source = null,
    contains = null,
    level = null,
    since = null,
    tail = 100,
    sessionId = null,
  } = query;
  
  try {
    const logs = await readAllLogs(sessionId);
    let lines: string[] = [];
    
    if (type === "console" || type === "all") {
      lines = lines.concat(logs.console.split("\n"));
    }
    if (type === "error" || type === "all") {
      lines = lines.concat(logs.error.split("\n"));
    }
    
    let filtered = lines.filter(l => l.trim());
    
    if (source) {
      const sourcePattern = source.replace(/\*/g, ".*");
      const sourceRegex = new RegExp(`\\[${sourcePattern}\\]`, "i");
      filtered = filtered.filter(l => sourceRegex.test(l));
    }
    
    if (contains) {
      const containsLower = contains.toLowerCase();
      filtered = filtered.filter(l => l.toLowerCase().includes(containsLower));
    }
    
    if (level) {
      filtered = filtered.filter(l => l.includes(`[${level}]`));
    }
    
    if (since) {
      const sinceDate = new Date(since);
      filtered = filtered.filter(l => {
        const match = l.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/);
        if (match) {
          return new Date(match[1]) >= sinceDate;
        }
        return true;
      });
    }
    
    return filtered.slice(-tail);
  } catch (err) {
    return [`Query error: ${err.message}`];
  }
}

/**
 * Log istatistiklerini hesapla (session summary için)
 */
export async function calculateLogStats(): Promise<{
  totalLogs: number;
  errorCount: number;
  warnCount: number;
}> {
  let totalLogs = 0;
  let errorCount = 0;
  let warnCount = 0;
  
  try {
    const sessionDir = getSessionDir();
    if (!sessionDir || !existsSync(sessionDir)) {
      return { totalLogs, errorCount, warnCount };
    }
    
    const errorPath = join(sessionDir, "error.log");
    if (existsSync(errorPath)) {
      const errorContent = await readFile(errorPath, "utf-8");
      const errorLines = errorContent.split("\n").filter(l => l.trim());
      errorCount = errorLines.filter(l => l.includes("[ERROR]")).length;
      warnCount = errorLines.filter(l => l.includes("[WARN]")).length;
    }
    
    const files = await readdir(sessionDir);
    for (const file of files) {
      if (file.startsWith("console-") && file.endsWith(".log")) {
        const content = await readFile(join(sessionDir, file), "utf-8");
        totalLogs += content.split("\n").filter(l => l.trim()).length;
      }
    }
  } catch (_err) {
  }
  
  return { totalLogs, errorCount, warnCount };
}
