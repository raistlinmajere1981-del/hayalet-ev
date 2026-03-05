/**
 * Performance Log Writer - Performance metrics tracking
 *
 * Writes logs with performance data (duration, memory) in JSONL format
 * for analysis and monitoring
 *
 * @module electron/logger/writers/PerformanceWriter
 */

import { join } from "path";
import { appendFile, mkdir } from "fs/promises";
import type { LogEntry } from "@shared/index.js";
import type { LogWriterConfig } from "@electron/types/logging.js";

interface PerformanceEntry {
  timestamp: string;
  category: string;
  operation?: string;
  correlationId?: string;
  duration?: number; // ms
  memoryUsage?: number; // MB
  context?: Record<string, unknown>;
}

export class PerformanceWriter {
  private config: LogWriterConfig;
  private filePath: string = "";
  private dirReady: boolean = false;

  constructor(config: LogWriterConfig) {
    this.config = config;
    this.updateFilePath();
  }

  public updateConfig(config: LogWriterConfig): void {
    this.config = config;
    this.updateFilePath();
  }

  private updateFilePath(): void {
    this.filePath = join(this.config.sessionDir, "performance.jsonl");
    this.dirReady = false;
  }

  public async write(entry: LogEntry): Promise<void> {
    if (!this.config.enablePerformanceLog) return;
    const hasDuration = typeof entry.context?.duration === "number";
    const hasMemoryUsage = typeof entry.context?.memoryUsage === "number";
    if (!hasDuration && !hasMemoryUsage) return;

    try {
      if (!this.dirReady) {
        await mkdir(this.config.sessionDir, { recursive: true });
        this.dirReady = true;
      }
      const perfEntry: PerformanceEntry = {
        timestamp: entry.timestamp,
        category: String(entry.category),
        ...(typeof entry.context?.operationName === "string"
          ? { operation: entry.context.operationName }
          : {}),
        ...(typeof entry.correlationId === "string" ? { correlationId: entry.correlationId } : {}),
        ...(typeof entry.context?.duration === "number"
          ? { duration: entry.context.duration }
          : {}),
        ...(typeof entry.context?.memoryUsage === "number"
          ? { memoryUsage: entry.context.memoryUsage }
          : {}),
        ...(entry.context != null ? { context: entry.context } : {}),
      };

      const line = JSON.stringify(perfEntry) + "\n";
      await appendFile(this.filePath, line, "utf-8");
    } catch (error) {
      console.error("[PerformanceWriter] Write failed:", error);
      throw error;
    }
  }

  public async flush(): Promise<void> {}
}
