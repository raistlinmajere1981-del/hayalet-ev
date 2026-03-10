import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import * as net from "net";
import { isAbsolute, join } from "path";
import { getLoggerCore } from "./logger/index.js";
import { Paths } from "./paths.js";
import { LogCategory, LogLevel } from "../src/types/logging-core.js";
import type { ServerOptions, ServerInfo, ServerBinaryInfo } from "./types/server.ts";
import { SERVER_TIMEOUTS } from "@timeouts";
import { translateElectronMessage } from "./i18n/language-service.ts";

const logger = getLoggerCore();

function chunkToString(data: unknown): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  return String(data);
}

/**
 * OpenCode serve server management service
 * - Port collision checks
 * - Automatic port discovery (4096-4110)
 * - Process lifecycle management
 */
export class OpenCodeServerManager {
  private process: ChildProcess | null = null;
  private currentPort: number | null = null;
  private startTime: number | null = null;
  private usingExternalServer = false;

  private resolveBinaryCommand(binaryPath?: string | null): string {
    if (typeof binaryPath !== "string") return "opencode";
    const trimmed = binaryPath.trim();
    return trimmed !== "" ? trimmed : "opencode";
  }

  private parseVersion(raw: string): string | undefined {
    const output = raw.trim();
    if (output === "") return undefined;
    const match = output.match(/\b(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\b/);
    return match?.[1];
  }

  private parseWhereisOutput(raw: string): string | undefined {
    const line = raw.trim();
    if (line === "") return undefined;
    const colonIndex = line.indexOf(":");
    const list = (colonIndex >= 0 ? line.slice(colonIndex + 1) : line)
      .trim()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token !== "");
    return list.find((token) => token.startsWith("/"));
  }

  private async runCommandCapture(
    command: string,
    args: string[],
    timeoutMs = 3000
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string; error?: string }> {
    return await new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = (payload: {
        exitCode: number | null;
        stdout: string;
        stderr: string;
        error?: string;
      }): void => {
        if (settled) return;
        settled = true;
        if (timer !== null) {
          clearTimeout(timer);
        }
        resolve(payload);
      };

      const child = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });

      child.stdout.on("data", (data: unknown) => {
        stdout += chunkToString(data);
      });

      child.stderr.on("data", (data: unknown) => {
        stderr += chunkToString(data);
      });

      child.once("error", (error: Error) => {
        finish({
          exitCode: null,
          stdout,
          stderr,
          error: error.message,
        });
      });

      child.once("close", (code: number | null) => {
        finish({
          exitCode: code,
          stdout,
          stderr,
        });
      });

      timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
        finish({
          exitCode: null,
          stdout,
          stderr,
          error: "Command timeout",
        });
      }, timeoutMs);
    });
  }

  async diagnoseBinary(options: { binaryPath?: string | null } = {}): Promise<ServerBinaryInfo> {
    const command = this.resolveBinaryCommand(options.binaryPath);
    const versionProbe = await this.runCommandCapture(
      command,
      ["--version"],
      SERVER_TIMEOUTS.BINARY_PROBE
    );
    const combinedOutput = `${versionProbe.stdout}\n${versionProbe.stderr}`.trim();

    if (versionProbe.error !== undefined) {
      return {
        available: false,
        command,
        error: versionProbe.error,
      };
    }

    if (versionProbe.exitCode !== 0) {
      return {
        available: false,
        command,
        error:
          combinedOutput !== "" ? combinedOutput : `Exit code ${String(versionProbe.exitCode)}`,
      };
    }

    const version = this.parseVersion(combinedOutput);
    let resolvedPath: string | undefined;

    if (command.includes("/") || command.includes("\\")) {
      resolvedPath = isAbsolute(command) ? command : join(Paths.getProjectRoot(), command);
    } else if (process.platform !== "win32") {
      const whereisResult = await this.runCommandCapture("whereis", [command], 1800);
      if (whereisResult.exitCode === 0) {
        resolvedPath = this.parseWhereisOutput(whereisResult.stdout);
      }
    }

    return {
      available: true,
      command,
      ...(version !== undefined ? { version } : {}),
      ...(resolvedPath !== undefined ? { resolvedPath } : {}),
    };
  }

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
   * Searches for a running OpenCode server within the port range.
   * Verifies whether each occupied port is a real OpenCode server by running a health check.
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
          await logger.logInternalT(
            LogCategory.MAIN,
            LogLevel.INFO,
            "electron.opencodeServer.logs.foundExistingServer",
            { port },
            { port }
          );
          return {
            running: true,
            port,
            url: `http://127.0.0.1:${port}`,
            source: "existing",
          };
        }
      } catch {}

      return await find(port + 1);
    };

    return await find(start);
  }

  async start(options: ServerOptions = {}): Promise<ServerInfo> {
    // Fail when a process started by this manager is already running.
    if (this.process !== null) {
      throw new Error(
        await translateElectronMessage("electron.opencodeServer.serverAlreadyRunning")
      );
    }

    // First, look for a running server in the port range.
    const existing = await this.findRunningServer(options.port ?? 4096, options.port ?? 4110);
    if (existing.running === true && existing.port != null) {
      await logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.INFO,
        "electron.opencodeServer.logs.reusingExistingServer",
        { port: existing.port },
        { port: existing.port }
      );
      this.currentPort = existing.port;
      this.usingExternalServer = true;
      return {
        ...existing,
        alreadyRunning: true,
        source: "existing",
      };
    }

    let port: number;
    if (options.port !== undefined) {
      const available = await this.isPortAvailable(options.port);
      if (!available) {
        throw new Error(
          await translateElectronMessage("electron.opencodeServer.portAlreadyInUse", {
            port: options.port,
          })
        );
      }
      port = options.port;
    } else {
      const foundPort = await this.findAvailablePort();
      if (foundPort === null) {
        throw new Error(
          await translateElectronMessage("electron.opencodeServer.noAvailablePortFound")
        );
      }
      port = foundPort;
    }

    const binaryCommand = this.resolveBinaryCommand(options.binaryPath);
    const binaryInfo = await this.diagnoseBinary({ binaryPath: binaryCommand });
    if (!binaryInfo.available) {
      throw new Error(
        await translateElectronMessage("electron.opencodeServer.binaryCheckFailed", {
          command: binaryCommand,
          message: binaryInfo.error ?? "unknown error",
        })
      );
    }
    const binaryExecutable = binaryInfo.resolvedPath ?? binaryInfo.command;

    const args = ["serve", "--port", String(port), "--hostname", "127.0.0.1"];

    // Add configured CORS origins.
    const cors = options.cors ?? ["http://localhost:5173"];
    cors.forEach((origin) => {
      args.push("--cors", origin);
    });

    await logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.INFO,
      "electron.opencodeServer.logs.startingServe",
      { port },
      {
        port,
        binaryCommand,
        binaryExecutable,
        args,
      }
    );

    const childEnv = { ...process.env };
    delete childEnv["CDP_PORT"];
    delete childEnv["NODE_OPTIONS"];
    delete childEnv["NODE_INSPECT_RESUME_ON_START"];

    this.process = spawn(binaryExecutable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: childEnv,
    });

    this.currentPort = port;
    this.startTime = Date.now();
    this.usingExternalServer = false;

    const pid = this.process.pid;

    this.process.stdout?.on("data", (data: unknown) => {
      const output = chunkToString(data);
      void logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.DEBUG,
        "electron.opencodeServer.logs.stdout",
        undefined,
        {
          output,
        }
      );
    });

    this.process.stderr?.on("data", (data: unknown) => {
      const error = chunkToString(data);
      void logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.WARNING,
        "electron.opencodeServer.logs.stderr",
        undefined,
        {
          error,
        }
      );
    });

    this.process.on("close", (code) => {
      void logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.INFO,
        "electron.opencodeServer.logs.closed",
        { code: code ?? "null" },
        { code }
      );
      this.cleanup();
    });

    this.process.on("error", (err) => {
      void logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.ERROR,
        "electron.opencodeServer.logs.error",
        { message: err.message },
        {
          error: err.message,
        }
      );
      this.cleanup();
    });

    return {
      running: true,
      port,
      url: `http://127.0.0.1:${port}`,
      ...(typeof pid === "number" ? { pid } : {}),
      ...(typeof this.startTime === "number" ? { startTime: this.startTime } : {}),
      source: "started",
    };
  }

  async stop(): Promise<void> {
    // If the process was started by this manager, stop it directly.
    if (this.process !== null) {
      await logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.INFO,
        "electron.opencodeServer.logs.stoppingOwnProcess",
        undefined,
        {
          pid: this.process.pid,
          port: this.currentPort,
        }
      );

      const proc = this.process;
      const pid = proc.pid;
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

    if (this.usingExternalServer) {
      await logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.INFO,
        "electron.opencodeServer.logs.skippingExternalStop",
        undefined,
        {
          port: this.currentPort,
        }
      );
    }

    this.currentPort = null;
    this.startTime = null;
    this.usingExternalServer = false;
  }

  getStatus(): ServerInfo {
    if (this.currentPort === null) {
      return { running: false };
    }

    const pid = this.process?.pid ?? undefined;

    return {
      running: true,
      port: this.currentPort,
      url: `http://127.0.0.1:${this.currentPort}`,
      ...(typeof pid === "number" ? { pid } : {}),
      ...(typeof this.startTime === "number" ? { startTime: this.startTime } : {}),
      source: this.process !== null ? "started" : "existing",
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
    this.usingExternalServer = false;
  }
}

export const opencodeServerManager = new OpenCodeServerManager();
