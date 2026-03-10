/**
 * Console Log Writer - Human-readable log format
 *
 * Writes logs in readable format with:
 * - Timestamp, level, visibility, source, category, message
 * - Metadata appended as JSON (if present)
 *
 * @module electron/logger/writers/ConsoleWriter
 */

import { join } from "path";
import { appendFile, mkdir } from "fs/promises";
import type { LogEntry } from "@shared/index.js";
import type { LogWriterConfig } from "@electron/types/logging.js";
import { loggerWriterT } from "./i18n.ts";

export class ConsoleWriter {
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
    this.filePath = join(this.config.sessionDir, "console.log");
    this.dirReady = false;
  }

  public async write(entry: LogEntry): Promise<void> {
    if (!this.config.enableConsoleLog) return;

    try {
      if (!this.dirReady) {
        await mkdir(this.config.sessionDir, { recursive: true });
        this.dirReady = true;
      }
      const line = this.formatEntry(entry);
      await appendFile(this.filePath, line + "\n", "utf-8");
    } catch (error) {
      console.error(
        await loggerWriterT("writerWriteFailed", {
          writer: "ConsoleWriter",
          message: error instanceof Error ? error.message : String(error),
        })
      );
      throw error;
    }
  }

  private formatEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(7);
    const visibility = typeof entry.visibility === "number" ? `[L${entry.visibility}]` : "[L-]";
    const source = (entry.source ?? "unknown").toUpperCase().padEnd(8);
    const category = String(entry.category).padEnd(20);
    const message = entry.message;

    let line = `[${timestamp}] [${level}] ${visibility} [${source}] [${category}] ${message}`;

    if (entry.context != null && Object.keys(entry.context).length > 0) {
      line += ` | context: ${JSON.stringify(entry.context)}`;
    }

    if (entry.error != null) {
      line += ` | error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack != null && entry.error.stack !== "") {
        line += `\n    Stack: ${entry.error.stack.split("\n").slice(0, 3).join("\n    ")}`;
      }
    }

    if (entry.aiHint != null) {
      line += ` | 🤖 Hint: ${entry.aiHint.suggestion}`;
    }

    return line;
  }

  public async flush(): Promise<void> {}
}
