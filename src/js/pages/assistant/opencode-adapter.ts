import { LogCategory } from "@shared/logging-core";
import type { TranslationParams } from "@shared/i18n.js";
import { formatErrorWithDetail } from "../../../../shared/i18n/error-detail.js";
import { AppI18n } from "../../modules/i18n/index.js";
import { Logger } from "../../modules/logger/index.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import type { AppSettings } from "@shared/settings.js";
import type { AssistantProviderAdapter, ServerResult, ServerStatus } from "@shared/assistant.js";

function assistantT(key: string, params?: TranslationParams): string {
  return AppI18n.t(`shell.assistant.${key}`, params);
}

function assistantError(key: string, detail?: unknown, params?: TranslationParams): string {
  return formatErrorWithDetail(assistantT(`errors.${key}`, params), detail);
}

export class OpenCodeAdapter implements AssistantProviderAdapter {
  readonly id = "opencode" as const;
  readonly name = "OpenCode";

  private _isRunning = false;
  private _currentPort: number | null = null;

  private _resolvePortRange(): { start: number; end: number } {
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const configuredPort = settings?.assistants?.opencode?.defaultPort;
    const start =
      typeof configuredPort === "number" &&
      Number.isInteger(configuredPort) &&
      configuredPort >= 1024 &&
      configuredPort <= 65535
        ? configuredPort
        : 4096;
    return { start, end: Math.min(start + 14, 65535) };
  }

  private _resolveBinaryPath(): string | undefined {
    const settings = SettingsManager.getSnapshot() as AppSettings | null;
    const binaryPath = settings?.assistants?.opencode?.binaryPath;
    if (typeof binaryPath !== "string") return undefined;
    const trimmed = binaryPath.trim();
    return trimmed !== "" ? trimmed : undefined;
  }

  async startServer(portSelection?: string): Promise<ServerResult> {
    try {
      Logger.infoT(LogCategory.ASSISTANT_CORE, "shell.assistant.logs.providerServeStarting", {
        name: this.name,
      });

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return { success: false, error: assistantT("errors.electronApiUnavailable") };
      }

      const portRange = this._resolvePortRange();
      const running = await electronApi.opencodeServeFindRunning(portRange.start, portRange.end);
      if (running.running === true && running.port !== undefined && running.port !== 0) {
        this._isRunning = true;
        this._currentPort = running.port;
        const url = running.url ?? `http://127.0.0.1:${this._currentPort}/`;

        Logger.infoT(
          LogCategory.ASSISTANT_CORE,
          "shell.assistant.logs.providerServeAttached",
          { name: this.name },
          {
            url,
            port: this._currentPort,
          }
        );

        return {
          success: true,
          url,
          alreadyRunning: true,
        };
      }

      let port: number | undefined;

      if (portSelection === "auto" || portSelection === undefined || portSelection === "") {
        const portResult = await electronApi.opencodeServeFindPort(portRange.start, portRange.end);
        if (portResult.error !== undefined && portResult.error !== "") {
          throw new Error(
            assistantError("providerServeStartFailed", portResult.error, { name: this.name })
          );
        }
        port = portResult.port;
      } else {
        port = parseInt(portSelection, 10);
        if (Number.isNaN(port) || port < 1024 || port > 65535) {
          throw new Error(assistantT("errors.invalidPortSelection"));
        }
      }

      const binaryPath = this._resolveBinaryPath();

      const result = await electronApi.opencodeServeStart({
        ...(typeof port === "number" ? { port } : {}),
        ...(binaryPath !== undefined ? { binaryPath } : {}),
        cors: ["http://localhost:5173"],
      });

      if (result.success === true) {
        this._isRunning = true;
        this._currentPort = result.port ?? port ?? 4096;
        const url = result.url ?? `http://127.0.0.1:${this._currentPort}/`;

        Logger.infoT(
          LogCategory.ASSISTANT_CORE,
          "shell.assistant.logs.providerServeStarted",
          { name: this.name },
          {
            url,
            port: this._currentPort,
          }
        );

        return {
          success: true,
          url,
        };
      } else {
        this._isRunning = false;
        this._currentPort = null;
        const errorMessage = assistantError("providerServeStartFailed", result.error, {
          name: this.name,
        });
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (e) {
      const err = e as Error;
      const errorMessage = assistantError("providerServeStartFailed", err, { name: this.name });
      this._isRunning = false;
      this._currentPort = null;
      Logger.errorT(
        LogCategory.ASSISTANT_CORE,
        "shell.assistant.logs.providerServeStartError",
        { name: this.name },
        {
          error: errorMessage,
        }
      );
      return { success: false, error: errorMessage };
    }
  }

  async stopServer(): Promise<ServerResult> {
    try {
      Logger.infoT(LogCategory.ASSISTANT_CORE, "shell.assistant.logs.providerServeStopping", {
        name: this.name,
      });

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        this._isRunning = false;
        this._currentPort = null;
        return { success: true };
      }

      const result = await electronApi.opencodeServeStop();
      this._isRunning = false;
      this._currentPort = null;

      if (result.success === true) {
        Logger.infoT(LogCategory.ASSISTANT_CORE, "shell.assistant.logs.providerServeStopped", {
          name: this.name,
        });
        return result;
      }

      const errorMessage = assistantError("providerServeStopFailed", result.error, {
        name: this.name,
      });
      Logger.errorT(
        LogCategory.ASSISTANT_CORE,
        "shell.assistant.logs.providerServeStopError",
        { name: this.name },
        {
          error: errorMessage,
        }
      );
      return { ...result, success: false, error: errorMessage };
    } catch (e) {
      const err = e as Error;
      const errorMessage = assistantError("providerServeStopFailed", err, { name: this.name });
      this._isRunning = false;
      this._currentPort = null;
      Logger.errorT(
        LogCategory.ASSISTANT_CORE,
        "shell.assistant.logs.providerServeStopError",
        { name: this.name },
        {
          error: errorMessage,
        }
      );
      return { success: false, error: errorMessage };
    }
  }

  async waitForReady(url: string, timeoutMs = 90000, signal?: AbortSignal): Promise<boolean> {
    const start = Date.now();
    const checkInterval = 500;
    let port: number | null;
    const electronApi = window.electronAPI;

    if (electronApi === undefined) {
      return false;
    }

    try {
      const parsed = new URL(url);
      port = parsed.port !== "" ? Number(parsed.port) : null;
    } catch {
      port = null;
    }

    const sleep = async (): Promise<void> => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, checkInterval);
      });
    };

    const pollReady = async (): Promise<boolean> => {
      if (signal?.aborted === true) return false;
      if (Date.now() - start >= timeoutMs) return false;

      try {
        if (port !== null && port !== 0) {
          const portCheck = await electronApi.opencodeServeFindPort(port, port);
          if (portCheck.error?.includes("No available port found") === true) {
            return true;
          }
        }
      } catch (_e) {}

      try {
        // NOTE: CSP bypass: run the health check over IPC.
        const healthFn = electronApi["opencodeServeHealth"] as
          | ((healthUrl: string) => Promise<unknown>)
          | undefined;
        const healthCheck = await healthFn?.(`${url}/global/health`);
        if (
          healthCheck !== undefined &&
          healthCheck !== null &&
          typeof healthCheck === "object" &&
          "success" in healthCheck &&
          (healthCheck as { success?: boolean }).success === true
        ) {
          return true;
        }
      } catch (_e) {}

      await sleep();
      return await pollReady();
    };

    if (await pollReady()) {
      return true;
    }

    if (signal?.aborted === true) {
      Logger.infoT(
        LogCategory.ASSISTANT_CORE,
        "shell.assistant.logs.providerReadyCheckCancelled",
        { name: this.name },
        { url }
      );
      return false;
    }

    Logger.warnT(
      LogCategory.ASSISTANT_CORE,
      "shell.assistant.logs.providerServerTimeout",
      { name: this.name },
      { timeoutMs, url }
    );
    return false;
  }

  getServerStatus(): ServerStatus {
    return {
      running: this._isRunning,
      ...(typeof this._currentPort === "number" ? { port: this._currentPort } : {}),
    };
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  setRunning(value: boolean): void {
    this._isRunning = value;
    if (!value) {
      this._currentPort = null;
    }
  }
}
