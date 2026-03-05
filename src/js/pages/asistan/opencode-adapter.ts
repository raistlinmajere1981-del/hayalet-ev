/**
 * OpenCode Asistan Provider Adapter
 *
 * OpenCode server subprocess yönetimi:
 * - Bağlan: opencode serve başlatılır, webview URL'e yönlendirilir
 * - Bağlantıyı Kes: subprocess kapatılır
 * - App Close: subprocess otomatik kapatılır (main process'te)
 */

import { LogCategory } from "@shared/logging-core";
import { Logger } from "../../modules/logger/index.js";
import type { AsistanProviderAdapter, ServerResult, ServerStatus } from "@shared/asistan.js";

export class OpenCodeAdapter implements AsistanProviderAdapter {
  readonly id = "opencode" as const;
  readonly name = "OpenCode";

  private _isRunning = false;
  private _currentPort: number | null = null;

  async startServer(portSelection?: string): Promise<ServerResult> {
    try {
      Logger.info(LogCategory.ASISTAN_CORE, "OpenCode serve başlatılıyor...", {});

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return { success: false, error: "electronAPI mevcut değil" };
      }

      // Önce çalışan bir sunucu var mı kontrol et
      const running = await electronApi.opencodeServeFindRunning(4096, 4110);
      if (running.running === true && running.port !== undefined && running.port !== 0) {
        this._isRunning = true;
        this._currentPort = running.port;
        const url = running.url ?? `http://127.0.0.1:${this._currentPort}/`;

        Logger.info(LogCategory.ASISTAN_CORE, "Mevcut OpenCode sunucusuna bağlanıldı", {
          url,
          port: this._currentPort,
        });

        return {
          success: true,
          url,
          alreadyRunning: true,
        };
      }

      // Çalışan sunucu yok — yeni başlat
      let port: number | undefined;

      if (portSelection === "auto" || portSelection === undefined || portSelection === "") {
        const portResult = await electronApi.opencodeServeFindPort(4096, 4110);
        if (portResult.error !== undefined && portResult.error !== "") {
          throw new Error(portResult.error);
        }
        port = portResult.port;
      } else {
        port = parseInt(portSelection, 10);
      }

      const result = await electronApi.opencodeServeStart({
        ...(typeof port === "number" ? { port } : {}),
        cors: ["http://localhost:5173"],
      });

      if (result.success === true) {
        this._isRunning = true;
        this._currentPort = result.port ?? port ?? 4096;
        const url = result.url ?? `http://127.0.0.1:${this._currentPort}/`;

        Logger.info(LogCategory.ASISTAN_CORE, "OpenCode serve başlatıldı", {
          url,
          port: this._currentPort,
        });

        return {
          success: true,
          url,
        };
      } else {
        this._isRunning = false;
        this._currentPort = null;
        return { success: false, error: result.error ?? "OpenCode serve başlatılamadı" };
      }
    } catch (e) {
      const err = e as Error;
      this._isRunning = false;
      this._currentPort = null;
      Logger.error(LogCategory.ASISTAN_CORE, "OpenCode serve başlatma hatası", {
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  async stopServer(): Promise<ServerResult> {
    try {
      Logger.info(LogCategory.ASISTAN_CORE, "OpenCode serve durduruluyor...", {});

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
        Logger.info(LogCategory.ASISTAN_CORE, "OpenCode serve durduruldu", {});
      }

      return result;
    } catch (e) {
      const err = e as Error;
      this._isRunning = false;
      this._currentPort = null;
      Logger.error(LogCategory.ASISTAN_CORE, "OpenCode serve durdurma hatası", {
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  async waitForReady(url: string, timeoutMs = 90000, signal?: AbortSignal): Promise<boolean> {
    const start = Date.now();
    const checkInterval = 500; // 500ms aralıklarla kontrol
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
      } catch (_e) {
        // Port check failed, continue
      }

      try {
        // CSP bypass: IPC üzerinden health check
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
      Logger.info(LogCategory.ASISTAN_CORE, `Server ready check cancelled: ${url}`, {});
      return false;
    }

    Logger.warn(LogCategory.ASISTAN_CORE, `Server ready timeout: ${url}`, { timeoutMs });
    return false;
  }

  getServerStatus(): ServerStatus {
    return {
      running: this._isRunning,
      ...(typeof this._currentPort === "number" ? { port: this._currentPort } : {}),
    };
  }

  /** Server çalışıyor mu? */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Çalışıyorsa false'a set et (dış kontrol için) */
  setRunning(value: boolean): void {
    this._isRunning = value;
    if (!value) {
      this._currentPort = null;
    }
  }
}
