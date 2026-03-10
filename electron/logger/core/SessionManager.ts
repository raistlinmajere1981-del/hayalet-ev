/**
 * Session Manager - Handles log session lifecycle
 *
 * Responsibilities:
 * - Create unique session IDs
 * - Manage session directories
 * - Generate session summaries
 * - Cleanup old sessions
 *
 * @module electron/logger/core/SessionManager
 */

import { join } from "path";
import { mkdir, writeFile, readdir, stat, rm } from "fs/promises";
import { existsSync } from "fs";
import { Paths } from "../../paths.ts";
import type { SessionSummary } from "@electron/types/logging.js";
import type { SessionStats } from "./session-stats.js";
import { translateElectronMessage } from "../../i18n/language-service.ts";

async function loggerT(key: string, params?: Record<string, string | number>): Promise<string> {
  return await translateElectronMessage(`electron.logger.${key}`, params);
}

export class SessionManager {
  private sessionId: string = "";
  private sessionDir: string = "";
  private logDir: string = "";
  private sessionStartTime: number = 0;

  public async init(customLogDir?: string): Promise<void> {
    this.logDir = customLogDir ?? join(Paths.getLogsDir(), "hayalet-ev");
    this.sessionId = this.generateSessionId();
    this.sessionDir = join(this.logDir, this.sessionId);
    this.sessionStartTime = Date.now();

    if (!existsSync(this.sessionDir)) {
      await mkdir(this.sessionDir, { recursive: true });
    }

    await this.writeSessionMetadata();

    this.cleanupOldSessions().catch((err) => {
      void loggerT("logs.cleanupFailed", {
        message: err instanceof Error ? err.message : String(err),
      }).then((message) => {
        console.error(message);
      });
    });
  }

  private generateSessionId(): string {
    const now = new Date();
    const date = now.toISOString().split("T")[0]?.replace(/-/g, "") ?? "";
    const time = now.toTimeString().split(" ")[0]?.replace(/:/g, "") ?? "";
    const random = Math.random().toString(36).substring(2, 6);
    return `${date}-${time}-${random}`;
  }

  private async writeSessionMetadata(): Promise<void> {
    const metadata = {
      sessionId: this.sessionId,
      startTime: new Date(this.sessionStartTime).toISOString(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
    };

    const metadataPath = join(this.sessionDir, "session-metadata.json");
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  }

  public async closeSession(stats?: SessionStats): Promise<void> {
    try {
      const summary = this.generateSummary(stats);
      const summaryPath = join(this.sessionDir, "summary.json");
      await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    } catch (error) {
      console.error(
        await loggerT("logs.summaryGenerateFailed", {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  private generateSummary(stats?: SessionStats): SessionSummary {
    const endTime = Date.now();
    const duration = endTime - this.sessionStartTime;
    const totalLogs = stats?.totalLogs ?? 0;
    const durationSeconds = duration > 0 ? duration / 1000 : 0;

    const summary: SessionSummary = {
      sessionId: this.sessionId,
      startTime: new Date(this.sessionStartTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration,
      stats: {
        totalLogs,
        byLevel: stats?.byLevel ?? {},
        byCategory: stats?.byCategory ?? {},
        errorCount: stats?.errorCount ?? 0,
        warningCount: stats?.warningCount ?? 0,
      },
      performance: {
        averageLogRate: durationSeconds > 0 ? totalLogs / durationSeconds : 0,
      },
    };

    return summary;
  }

  private async cleanupOldSessions(): Promise<void> {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const now = Date.now();

    try {
      const entries = await readdir(this.logDir);
      const staleSessions = await Promise.all(
        entries.map(async (entry) => {
          const sessionPath = join(this.logDir, entry);
          const stats = await stat(sessionPath);
          return stats.isDirectory() && now - stats.mtimeMs > maxAge
            ? { entry, sessionPath }
            : null;
        })
      );
      await Promise.all(
        staleSessions
          .filter((item): item is { entry: string; sessionPath: string } => item !== null)
          .map(async ({ entry, sessionPath }) => {
            console.info(await loggerT("logs.cleanupOldSession", { sessionId: entry }));
            await rm(sessionPath, { recursive: true, force: true });
          })
      );
    } catch (error) {
      console.error(
        await loggerT("logs.cleanupError", {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getSessionDir(): string {
    return this.sessionDir;
  }

  public getLogDir(): string {
    return this.logDir;
  }
}
