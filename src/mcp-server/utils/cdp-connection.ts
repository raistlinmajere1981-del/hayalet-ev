/**
 * CDP (Chrome DevTools Protocol) Connection Manager
 *
 * Electron uygulamasına WebSocket üzerinden bağlanır ve
 * JavaScript kodlarını uzaktan çalıştırır.
 */

import WebSocket from "ws";
import { CDP_TIMEOUTS } from "@timeouts";

const CDP_PORT = process.env["CDP_PORT"] ?? 9222;
const CDP_HOST = process.env["CDP_HOST"] ?? "localhost";

/** CDP Target interface */
interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

/** CDP Response interface */
interface CDPResponse {
  id?: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
  exceptionDetails?: {
    exception?: { description?: string };
    text?: string;
  };
}

/** CDP Evaluate Result */
interface EvaluateResult {
  result?: { value?: unknown };
  exceptionDetails?: {
    exception?: { description?: string };
    text?: string;
  };
}

/**
 * Electron debug endpoint'lerini keşfet
 */
export async function discoverTargets(): Promise<CDPTarget[]> {
  try {
    // Target discovery timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, CDP_TIMEOUTS.TARGET_DISCOVERY);

    const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as CDPTarget[];
  } catch (error) {
    const err = error as Error & { code?: string };

    // Timeout hatası
    if (err.name === "AbortError") {
      const timeoutError = new Error(
        `Electron bağlantı zaman aşımı (5s). Port ${CDP_PORT} açık mı kontrol edin.`
      ) as Error & { cause?: unknown };
      timeoutError.cause = error;
      throw timeoutError;
    }

    // Connection refused
    if (err.code === "ECONNREFUSED" || err.message.includes("ECONNREFUSED")) {
      const connectionError = new Error(
        `Electron'a bağlanılamadı (port ${CDP_PORT}). ` +
          `Uygulama --remote-debugging-port=${CDP_PORT} ile başlatıldığından emin olun.`
      ) as Error & { cause?: unknown };
      connectionError.cause = error;
      throw connectionError;
    }

    // fetch failed (genel ağ hatası)
    if (err.message.includes("fetch failed")) {
      const fetchError = new Error(
        `Electron'a bağlanılamadı (port ${CDP_PORT}). Uygulama çalışıyor mu?`
      ) as Error & { cause?: unknown };
      fetchError.cause = error;
      throw fetchError;
    }

    throw error;
  }
}

/**
 * Ana pencere hedefini bul
 */
async function findMainWindow(): Promise<CDPTarget | null> {
  const targets = await discoverTargets();

  // Önce "page" tipinde hedef ara
  const pageTarget = targets.find((t) => t.type === "page");
  if (pageTarget) return pageTarget;

  // Yoksa ilk hedefi döndür
  return targets[0] ?? null;
}

/**
 * Belirli bir hedefe WebSocket bağlantısı aç
 */
async function connectToTarget(wsUrl: string): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    let resolved = false;
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      if (!resolved) {
        resolved = true;
        resolve(ws);
      }
    });

    ws.on("error", (err: Error) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`WebSocket hatası: ${err.message}`));
      }
    });

    // WebSocket bağlantı timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.terminate();
        reject(new Error("WebSocket bağlantı zaman aşımı"));
      }
    }, CDP_TIMEOUTS.WEBSOCKET_CONNECT);
  });
}

// Global ID counter for CDP commands
let cdpCommandId = 1;

function rawDataToText(data: WebSocket.RawData): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return "";
}

/**
 * CDP komutu gönder ve yanıt bekle
 */
export async function sendCDPCommand(
  ws: WebSocket,
  method: string,
  params: Record<string, unknown> = {},
  timeout: number = CDP_TIMEOUTS.COMMAND_DEFAULT
): Promise<Record<string, unknown>> {
  return await new Promise((resolve, reject) => {
    const id = cdpCommandId++;
    const messageHandler = (data: WebSocket.RawData): void => {
      try {
        const response = JSON.parse(rawDataToText(data)) as CDPResponse;
        if (response.id === id) {
          clearTimeout(timeoutId);
          ws.off("message", messageHandler);
          if (response.error) {
            reject(new Error(`CDP Hatası: ${response.error.message}`));
          } else {
            resolve(response.result ?? {});
          }
        }
      } catch {
        // JSON parse hatası, devam et
      }
    };

    const timeoutId = setTimeout(() => {
      ws.off("message", messageHandler);
      reject(new Error(`CDP komut zaman aşımı: ${method}`));
    }, timeout);

    ws.on("message", messageHandler);

    try {
      ws.send(JSON.stringify({ id, method, params }));
    } catch (e) {
      const err = e as Error;
      ws.off("message", messageHandler);
      reject(new Error(`WebSocket gönderim hatası: ${err.message}`));
      return;
    }
  });
}

/**
 * JavaScript kodunu Electron'da çalıştır
 */
export async function evaluateJS(
  ws: WebSocket,
  expression: string,
  awaitPromise = true,
  timeout?: number
): Promise<unknown> {
  const result = (await sendCDPCommand(
    ws,
    "Runtime.evaluate",
    {
      expression,
      awaitPromise,
      returnByValue: true,
    },
    timeout
  )) as EvaluateResult;

  if (result.exceptionDetails) {
    throw new Error(
      `JavaScript hatası: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "unknown"}`
    );
  }

  return result.result?.value;
}

/**
 * Electron'a bağlan, komutu çalıştır ve bağlantıyı kapat
 */
export async function withConnection<T>(action: (ws: WebSocket) => Promise<T>): Promise<T> {
  const target = await findMainWindow();
  if (!target) {
    throw new Error("Electron penceresi bulunamadı. Uygulama çalışıyor mu?");
  }

  const ws = await connectToTarget(target.webSocketDebuggerUrl);

  try {
    // Runtime'ı etkinleştir
    await sendCDPCommand(ws, "Runtime.enable");
    return await action(ws);
  } finally {
    ws.close();
  }
}

/** Connection status result */
interface ConnectionStatus {
  connected: boolean;
  port: string | number;
  targetsCount?: number;
  mainWindow?: {
    title: string;
    url: string;
    type: string;
  } | null;
  error?: string;
}

/**
 * Electron bağlantı durumunu kontrol et
 */
export async function checkConnection(): Promise<ConnectionStatus> {
  try {
    const targets = await discoverTargets();
    const mainWindow = targets.find((t) => t.type === "page");

    return {
      connected: true,
      port: CDP_PORT,
      targetsCount: targets.length,
      mainWindow: mainWindow
        ? {
            title: mainWindow.title,
            url: mainWindow.url,
            type: mainWindow.type,
          }
        : null,
    };
  } catch (error) {
    const err = error as Error;
    return {
      connected: false,
      port: CDP_PORT,
      error: err.message,
    };
  }
}
