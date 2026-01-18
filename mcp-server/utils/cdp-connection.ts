/**
 * CDP (Chrome DevTools Protocol) Connection Manager
 * 
 * Electron uygulamasına WebSocket üzerinden bağlanır ve
 * JavaScript kodlarını uzaktan çalıştırır.
 */

import WebSocket from "ws";

const CDP_PORT = process.env.CDP_PORT || 9222;
const CDP_HOST = process.env.CDP_HOST || "localhost";

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
    const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as CDPTarget[];
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ECONNREFUSED") {
      throw new Error(
        `Electron'a bağlanılamadı (port ${CDP_PORT}). ` +
        `Uygulama --remote-debugging-port=${CDP_PORT} ile başlatıldığından emin olun.`
      );
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
  const pageTarget = targets.find(t => t.type === "page");
  if (pageTarget) return pageTarget;
  
  // Yoksa ilk hedefi döndür
  return targets[0] || null;
}

/**
 * Belirli bir hedefe WebSocket bağlantısı aç
 */
function connectToTarget(wsUrl: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
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
    
    // 10 saniye timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.terminate();
        reject(new Error("WebSocket bağlantı zaman aşımı"));
      }
    }, 10000);
  });
}

// Global ID counter for CDP commands
let cdpCommandId = 1;

/**
 * CDP komutu gönder ve yanıt bekle
 */
export function sendCDPCommand(
  ws: WebSocket, 
  method: string, 
  params: Record<string, unknown> = {}, 
  timeout = 15000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const id = cdpCommandId++;
    // eslint-disable-next-line prefer-const
    let timeoutId: NodeJS.Timeout;
    
    const messageHandler = (data: WebSocket.RawData): void => {
      try {
        const response = JSON.parse(data.toString()) as CDPResponse;
        if (response.id === id) {
          clearTimeout(timeoutId);
          ws.off("message", messageHandler);
          if (response.error) {
            reject(new Error(`CDP Hatası: ${response.error.message}`));
          } else {
            resolve(response.result || {});
          }
        }
      } catch {
        // JSON parse hatası, devam et
      }
    };
    
    ws.on("message", messageHandler);
    
    try {
      ws.send(JSON.stringify({ id, method, params }));
    } catch (e) {
      const err = e as Error;
      ws.off("message", messageHandler);
      reject(new Error(`WebSocket gönderim hatası: ${err.message}`));
      return;
    }
    
    timeoutId = setTimeout(() => {
      ws.off("message", messageHandler);
      reject(new Error(`CDP komut zaman aşımı: ${method}`));
    }, timeout);
  });
}

/**
 * JavaScript kodunu Electron'da çalıştır
 */
export async function evaluateJS(
  ws: WebSocket, 
  expression: string, 
  awaitPromise = true
): Promise<unknown> {
  const result = (await sendCDPCommand(ws, "Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  })) as EvaluateResult;
  
  if (result.exceptionDetails) {
    throw new Error(
      `JavaScript hatası: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`
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
    const mainWindow = targets.find(t => t.type === "page");
    
    return {
      connected: true,
      port: CDP_PORT,
      targetsCount: targets.length,
      mainWindow: mainWindow ? {
        title: mainWindow.title,
        url: mainWindow.url,
        type: mainWindow.type,
      } : null,
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
