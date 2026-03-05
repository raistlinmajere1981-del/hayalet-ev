import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import * as net from "net";
import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { getLoggerCore } from "./logger/index.js";
import { Paths } from "./paths.js";
import { LogCategory, LogLevel } from "../src/types/logging-core.js";
import type { ServerOptions, ServerInfo } from "./types/server.ts";
import { SERVER_TIMEOUTS } from "@timeouts";

function getPidFilePath(): string {
  return join(Paths.getProjectRoot(), "data", "servers", "opencode-server.pid");
}

async function writePidFile(pid: number): Promise<void> {
  const pidFilePath = getPidFilePath();
  await mkdir(dirname(pidFilePath), { recursive: true });
  await writeFile(pidFilePath, String(pid), "utf-8");
}

async function readPidFile(): Promise<number | null> {
  try {
    const raw = await readFile(getPidFilePath(), "utf-8");
    const pid = parseInt(raw.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

async function deletePidFile(): Promise<void> {
  try {
    await unlink(getPidFilePath());
  } catch {
    // dosya yoksa sorun değil
  }
}

/** PID dosyası var ve process hâlâ ayaktaysa true ("biz başlattık" sahiplik kontrolü) */
function isOwnedProcess(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForOwnedProcessExit(pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  const waitOnce = async (): Promise<void> => {
    if (!isOwnedProcess(pid) || Date.now() >= deadline) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, SERVER_TIMEOUTS.STARTUP_SETTLE));
    await waitOnce();
  };

  await waitOnce();
}

const logger = getLoggerCore();

function chunkToString(data: unknown): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  return String(data);
}

/**
 * OpenCode serve server yönetim servisi
 * - Port충돌 kontrolü
 * - Otomatik port bulma (4096-4110)

 * - Process lifecycle management
 */
export class OpenCodeServerManager {
  private process: ChildProcess | null = null;
  private currentPort: number | null = null;
  private startTime: number | null = null;
  /** Kendi başlatmadığımız ama PID dosyası üzerinden sahiplendiğimiz harici process PID'i */
  private ownedExternalPid: number | null = null;

  private async isPortAvailable(port: number): Promise<boolean> {
    return await new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", () => {
        resolve(false);
      });

      server.once("listening", () => {
        server.close();
        resolve(true);
      });

      server.listen(port, "127.0.0.1");
    });
  }

  async findAvailablePort(start = 4096, end = 4110): Promise<number | null> {
    const find = async (port: number): Promise<number | null> => {
      if (port > end) return null;
      return (await this.isPortAvailable(port)) ? port : await find(port + 1);
    };
    return await find(start);
  }

  /**
   * Port aralığında çalışan bir OpenCode sunucusu arar.
   * Her meşgul portta health check yaparak gerçek bir OpenCode sunucusu olup olmadığını doğrular.
   */
  async findRunningServer(start = 4096, end = 4110): Promise<ServerInfo> {
    const find = async (port: number): Promise<ServerInfo> => {
      if (port > end) return { running: false };

      const portInUse = !(await this.isPortAvailable(port));
      if (!portInUse) {
        return await find(port + 1);
      }

      try {
        const healthResult = await this.checkHealth(`http://127.0.0.1:${port}/global/health`);
        if (healthResult.success) {
          await logger.logInternal(
            LogCategory.MAIN,
            LogLevel.INFO,
            "Found existing OpenCode server",
            { port }
          );
          return {
            running: true,
            port,
            url: `http://127.0.0.1:${port}`,
          };
        }
      } catch {}

      return await find(port + 1);
    };

    return await find(start);
  }

  async start(options: ServerOptions = {}): Promise<ServerInfo> {
    // Zaten bu manager'dan başlatılmış bir process varsa hata ver
    if (this.process !== null) {
      throw new Error("OpenCode server already running");
    }

    // Önce port aralığında çalışan bir sunucu ara
    const existing = await this.findRunningServer(options.port ?? 4096, options.port ?? 4110);
    if (existing.running === true && existing.port != null) {
      // PID dosyası varsa: hayalet-ev veya ghost-agent başlatmış → sahiplenebiliriz
      const savedPid = await readPidFile();
      const ownedByUs = savedPid !== null && isOwnedProcess(savedPid);

      await logger.logInternal(
        LogCategory.MAIN,
        LogLevel.INFO,
        "Reusing existing OpenCode server instead of starting new one",
        { port: existing.port, ownedByUs, savedPid }
      );
      this.currentPort = existing.port;
      this.ownedExternalPid = ownedByUs ? savedPid : null;
      return {
        ...existing,
        alreadyRunning: true,
      };
    }

    let port: number;
    if (options.port !== undefined) {
      const available = await this.isPortAvailable(options.port);
      if (!available) {
        throw new Error(`Port ${options.port} is already in use`);
      }
      port = options.port;
    } else {
      const foundPort = await this.findAvailablePort();
      if (foundPort === null) {
        throw new Error("No available port found (tried 4096-4110)");
      }
      port = foundPort;
    }

    const args = ["serve", "--port", String(port), "--hostname", "127.0.0.1"];

    // CORS ekle
    const cors = options.cors ?? ["http://localhost:5173"];
    cors.forEach((origin) => {
      args.push("--cors", origin);
    });

    await logger.logInternal(LogCategory.MAIN, LogLevel.INFO, "Starting OpenCode serve", {
      port,
      args,
    });

    const childEnv = { ...process.env };
    delete childEnv["CDP_PORT"];
    delete childEnv["NODE_OPTIONS"];
    delete childEnv["NODE_INSPECT_RESUME_ON_START"];

    this.process = spawn("opencode", args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: childEnv,
    });

    this.currentPort = port;
    this.startTime = Date.now();

    const pid = this.process.pid;

    // PID dosyasına yaz — ghost-agent da bu süreci kapatabilsin
    if (typeof pid === "number") {
      await writePidFile(pid);
    }

    this.process.stdout?.on("data", (data: unknown) => {
      const output = chunkToString(data);
      void logger.logInternal(LogCategory.MAIN, LogLevel.DEBUG, "OpenCode serve stdout", {
        output,
      });
    });

    this.process.stderr?.on("data", (data: unknown) => {
      const error = chunkToString(data);
      void logger.logInternal(LogCategory.MAIN, LogLevel.WARNING, "OpenCode serve stderr", {
        error,
      });
    });

    this.process.on("close", (code) => {
      void logger.logInternal(LogCategory.MAIN, LogLevel.INFO, "OpenCode serve closed", { code });
      this.cleanup();
    });

    this.process.on("error", (err) => {
      void logger.logInternal(LogCategory.MAIN, LogLevel.ERROR, "OpenCode serve error", {
        error: err.message,
      });
      this.cleanup();
    });

    return {
      running: true,
      port,
      url: `http://127.0.0.1:${port}`,
      ...(typeof pid === "number" ? { pid } : {}),
      ...(typeof this.startTime === "number" ? { startTime: this.startTime } : {}),
    };
  }

  async stop(): Promise<void> {
    // Kendi başlattığımız process varsa → direkt durdur
    if (this.process !== null) {
      await logger.logInternal(
        LogCategory.MAIN,
        LogLevel.INFO,
        "Stopping OpenCode serve (own process)",
        {
          pid: this.process.pid,
          port: this.currentPort,
        }
      );

      const proc = this.process;
      const pid = proc.pid;
      await deletePidFile();
      this.cleanup();

      const canKillGroup = process.platform !== "win32";
      const tryKill = (signal: NodeJS.Signals, useGroup: boolean): boolean => {
        try {
          if (useGroup && canKillGroup && typeof pid === "number") {
            process.kill(-pid, signal);
          } else {
            proc.kill(signal);
          }
          return true;
        } catch {
          return false;
        }
      };

      const termByGroup = tryKill("SIGTERM", true);
      if (!termByGroup) void tryKill("SIGTERM", false);

      await new Promise<boolean>((resolve) => {
        if (proc.exitCode !== null) {
          resolve(true);
          return;
        }
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000);
        proc.once("close", () => {
          clearTimeout(timeout);
          resolve(true);
        });
      }).then((exited) => {
        if (!exited) {
          const killByGroup = tryKill("SIGKILL", true);
          if (!killByGroup) void tryKill("SIGKILL", false);
        }
      });
      return;
    }

    // Bellekte sahiplik yoksa PID dosyasından sahiplenmeyi dene
    if (this.ownedExternalPid === null) {
      const savedPid = await readPidFile();
      if (savedPid !== null && isOwnedProcess(savedPid)) {
        this.ownedExternalPid = savedPid;
      } else if (savedPid !== null) {
        // Stale PID dosyası
        await deletePidFile();
      }
    }

    // PID dosyası üzerinden sahiplenilen harici process varsa → durdur
    if (this.ownedExternalPid !== null) {
      const pid = this.ownedExternalPid;
      await logger.logInternal(
        LogCategory.MAIN,
        LogLevel.INFO,
        "Stopping OpenCode serve (owned external pid)",
        {
          pid,
          port: this.currentPort,
        }
      );
      const canKillGroup = process.platform !== "win32";
      const tryKill = (signal: NodeJS.Signals, useGroup: boolean): boolean => {
        try {
          if (useGroup && canKillGroup) {
            process.kill(-pid, signal);
          } else {
            process.kill(pid, signal);
          }
          return true;
        } catch {
          return false;
        }
      };

      const termByGroup = tryKill("SIGTERM", true);
      if (!termByGroup) void tryKill("SIGTERM", false);

      await deletePidFile();
      this.ownedExternalPid = null;
      this.currentPort = null;

      await waitForOwnedProcessExit(pid, 5000);

      if (isOwnedProcess(pid)) {
        const killByGroup = tryKill("SIGKILL", true);
        if (!killByGroup) void tryKill("SIGKILL", false);
      }
      return;
    }

    // Harici sunucu (PID dosyası yok) → dokunma
    await logger.logInternal(
      LogCategory.MAIN,
      LogLevel.INFO,
      "Skipping stop: OpenCode server is external (no PID file)",
      {
        port: this.currentPort,
      }
    );
    this.currentPort = null;
  }

  getStatus(): ServerInfo {
    if (this.currentPort === null || (this.process === null && this.ownedExternalPid === null)) {
      return { running: false };
    }

    const pid = this.process?.pid ?? this.ownedExternalPid ?? undefined;

    return {
      running: true,
      port: this.currentPort,
      url: `http://127.0.0.1:${this.currentPort}`,
      ...(typeof pid === "number" ? { pid } : {}),
      ...(typeof this.startTime === "number" ? { startTime: this.startTime } : {}),
    };
  }

  /**
   * Server health check (HTTP request via Node.js - CSP bypass)
   */
  async checkHealth(url: string): Promise<{ success: boolean; error?: string }> {
    const http = await import("http");
    return await new Promise((resolve) => {
      const parsedUrl = new URL(url);

      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname,
          method: "GET",
          timeout: 1000,
        },
        (res) => {
          resolve({ success: res.statusCode === 200 });
        }
      );

      req.on("error", (err: Error) => {
        resolve({ success: false, error: err.message });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ success: false, error: "timeout" });
      });

      req.end();
    });
  }

  private cleanup(): void {
    this.process = null;
    this.currentPort = null;
    this.startTime = null;
    this.ownedExternalPid = null;
  }
}

export const opencodeServerManager = new OpenCodeServerManager();
