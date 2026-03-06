/**
 * OpenCode UI Asistan Provider Adapter
 *
 * OpenCode serve subprocess yönetimi:
 * - Bağlan: opencode serve başlatılır, native opencode-ui sayfasına yönlendirilir
 * - Bağlantıyı Kes: subprocess kapatılır
 * - App Close: subprocess otomatik kapatılır (main process'te)
 */

import { LogCategory } from "@shared/logging-core";
import type { AppSettings } from "@shared/settings.js";
import type { AsistanProviderAdapter, ServerResult, ServerStatus } from "@shared/asistan.js";
import { Logger } from "../../modules/logger/index.js";
import { SettingsManager } from "../../modules/settings-manager.js";

export class OpenCodeUiAdapter implements AsistanProviderAdapter {
  readonly id = "opencode-ui" as const;
  readonly name = "OpenCode UI";

  private _isRunning = false;
  private _currentPort: number | null = null;
  private _serverUrl: string | null = null;

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
      Logger.info(LogCategory.ASISTAN_CORE, "OpenCode UI serve başlatılıyor...", {});

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return { success: false, error: "electronAPI mevcut değil" };
      }

      const portRange = this._resolvePortRange();
      const running = await electronApi.opencodeServeFindRunning(portRange.start, portRange.end);
      if (running.running === true && running.port !== undefined && running.port !== 0) {
        this._isRunning = true;
        this._currentPort = running.port;
        this._serverUrl = running.url ?? `http://127.0.0.1:${this._currentPort}/`;

        const pageUrl = `/pages/opencode-ui.html?port=${String(this._currentPort)}`;

        Logger.info(LogCategory.ASISTAN_CORE, "Mevcut OpenCode UI sunucusuna bağlanıldı", {
          pageUrl,
          serverUrl: this._serverUrl,
          port: this._currentPort,
        });

        return {
          success: true,
          url: pageUrl,
          alreadyRunning: true,
        };
      }

      let port: number | undefined;

      if (portSelection === "auto" || portSelection === undefined || portSelection === "") {
        const portResult = await electronApi.opencodeServeFindPort(portRange.start, portRange.end);
        if (portResult.error !== undefined && portResult.error !== "") {
          throw new Error(portResult.error);
        }
        port = portResult.port;
      } else {
        port = parseInt(portSelection, 10);
        if (Number.isNaN(port) || port < 1024 || port > 65535) {
          throw new Error("Geçersiz port seçimi");
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
        this._serverUrl = result.url ?? `http://127.0.0.1:${this._currentPort}/`;
        const pageUrl = `/pages/opencode-ui.html?port=${String(this._currentPort)}`;

        Logger.info(LogCategory.ASISTAN_CORE, "OpenCode UI serve başlatıldı", {
          pageUrl,
          serverUrl: this._serverUrl,
          port: this._currentPort,
        });

        return {
          success: true,
          url: pageUrl,
        };
      }

      this._isRunning = false;
      this._currentPort = null;
      this._serverUrl = null;
      return { success: false, error: result.error ?? "OpenCode UI serve başlatılamadı" };
    } catch (e) {
      const err = e as Error;
      this._isRunning = false;
      this._currentPort = null;
      this._serverUrl = null;
      Logger.error(LogCategory.ASISTAN_CORE, "OpenCode UI serve başlatma hatası", {
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  async stopServer(): Promise<ServerResult> {
    try {
      Logger.info(LogCategory.ASISTAN_CORE, "OpenCode UI serve durduruluyor...", {});

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        this._isRunning = false;
        this._currentPort = null;
        this._serverUrl = null;
        return { success: true };
      }

      const result = await electronApi.opencodeServeStop();
      this._isRunning = false;
      this._currentPort = null;
      this._serverUrl = null;

      if (result.success === true) {
        Logger.info(LogCategory.ASISTAN_CORE, "OpenCode UI serve durduruldu", {});
      }

      return result;
    } catch (e) {
      const err = e as Error;
      this._isRunning = false;
      this._currentPort = null;
      this._serverUrl = null;
      Logger.error(LogCategory.ASISTAN_CORE, "OpenCode UI serve durdurma hatası", {
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  async waitForReady(_url: string, timeoutMs = 90000, signal?: AbortSignal): Promise<boolean> {
    const start = Date.now();
    const checkInterval = 500;
    const electronApi = window.electronAPI;

    if (electronApi === undefined) {
      return false;
    }

    const serverUrl = this._serverUrl ?? `http://127.0.0.1:${this._currentPort ?? 4096}/`;

    let port: number | null;
    try {
      const parsed = new URL(serverUrl);
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
        const healthFn = electronApi["opencodeServeHealth"] as
          | ((healthUrl: string) => Promise<unknown>)
          | undefined;
        const healthCheck = await healthFn?.(`${serverUrl}/global/health`);
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
      Logger.info(
        LogCategory.ASISTAN_CORE,
        `OpenCode UI server ready check cancelled: ${serverUrl}`,
        {}
      );
      return false;
    }

    Logger.warn(LogCategory.ASISTAN_CORE, `OpenCode UI server ready timeout: ${serverUrl}`, {
      timeoutMs,
    });
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
      this._serverUrl = null;
    }
  }
}
