/**
 * Progress Indicator Utility
 * 
 * Uzun süren işlemler için progress göstergesi.
 * MCP notification + stderr üzerinden mesaj gönderir.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

// Global server reference (set from index.ts)
let mcpServer: Server | null = null;
let currentProgressToken: string | number | null = null;

/**
 * MCP Server referansını ayarla (index.ts'den çağrılır)
 */
export function setMcpServer(server: Server): void {
  mcpServer = server;
}

/**
 * Progress token'ı ayarla (request'ten gelen)
 */
export function setProgressToken(token: string | number | null): void {
  currentProgressToken = token;
}

export interface ProgressOptions {
  /** İşlem adı */
  operation: string;
  /** Toplam adım sayısı (biliniyorsa) */
  total?: number;
  /** Heartbeat interval (ms) */
  interval?: number;
  /** Sessiz mod (sadece önemli adımları göster) */
  quiet?: boolean;
  /** Progress token (MCP notification için) */
  progressToken?: string | number;
}

export interface ProgressTracker {
  /** Mevcut adımı güncelle */
  update: (current: number, message?: string) => void;
  /** Mesaj göster */
  log: (message: string) => void;
  /** İşlem tamamlandı */
  done: (message?: string) => void;
  /** Hata ile sonlandır */
  fail: (error: string) => void;
  /** Heartbeat'i durdur */
  stop: () => void;
}

/**
 * MCP notification gönder (varsa)
 */
async function sendProgressNotification(
  progress: number,
  total: number | undefined,
  message: string
): Promise<void> {
  const token = currentProgressToken;
  if (!mcpServer || !token) return;
  
  try {
    await mcpServer.notification({
      method: "notifications/progress",
      params: {
        progressToken: token,
        progress,
        total,
        message,
      } as Record<string, unknown>,
    });
  } catch {
    // Notification başarısız olursa sessizce devam et
  }
}

/**
 * Progress tracker oluştur
 * 
 * Kullanım:
 * ```ts
 * const progress = createProgress({ operation: "Proje analizi", total: 100 });
 * progress.update(25, "Dosyalar taranıyor...");
 * progress.update(50, "Bağımlılıklar analiz ediliyor...");
 * progress.done("Tamamlandı!");
 * ```
 */
export function createProgress(options: ProgressOptions): ProgressTracker {
  const { operation, total, interval = 2000, quiet = false, progressToken } = options;
  const startTime = Date.now();
  let currentStep = 0;
  let lastMessage = "";
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let isRunning = true;

  // Progress token'ı override et (tool'dan gelebilir)
  if (progressToken) {
    setProgressToken(progressToken);
  }

  // Başlangıç mesajı
  if (!quiet) {
    console.error(`[PROGRESS] ⏳ ${operation} başladı...`);
  }
  
  // MCP notification gönder
  sendProgressNotification(0, total, `${operation} başladı...`);

  // Heartbeat - işlemin devam ettiğini göster
  heartbeatTimer = setInterval(() => {
    if (!isRunning) return;
    
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const progressStr = total 
      ? `${currentStep}/${total} (${Math.round(currentStep / total * 100)}%)`
      : `${currentStep} adım`;
    
    console.error(`[PROGRESS] ⏳ ${operation} devam ediyor... [${elapsed}s] ${progressStr}${lastMessage ? ` - ${lastMessage}` : ""}`);
    
    // Heartbeat notification
    sendProgressNotification(currentStep, total, `${operation} devam ediyor... ${lastMessage || ""}`);
  }, interval);

  return {
    update(current: number, message?: string) {
      currentStep = current;
      if (message) {
        lastMessage = message;
        if (!quiet) {
          const progressStr = total 
            ? `[${Math.round(current / total * 100)}%]`
            : `[${current}]`;
          console.error(`[PROGRESS] ${progressStr} ${message}`);
        }
        // MCP notification
        sendProgressNotification(current, total, message);
      }
    },

    log(message: string) {
      console.error(`[PROGRESS] ℹ️ ${message}`);
      sendProgressNotification(currentStep, total, message);
    },

    done(message?: string) {
      isRunning = false;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const finalMessage = message || "Tamamlandı";
      console.error(`[PROGRESS] ✅ ${operation} ${finalMessage} (${elapsed}s)`);
      
      // Final notification (total'a ulaştı)
      sendProgressNotification(total || currentStep, total, `✅ ${operation} ${finalMessage} (${elapsed}s)`);
      setProgressToken(null);
    },

    fail(error: string) {
      isRunning = false;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[PROGRESS] ❌ ${operation} başarısız: ${error} (${elapsed}s)`);
      
      // Error notification
      sendProgressNotification(currentStep, total, `❌ ${operation} başarısız: ${error} (${elapsed}s)`);
      setProgressToken(null);
    },

    stop() {
      isRunning = false;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      setProgressToken(null);
    },
  };
}

/**
 * Basit progress spinner (işlem adı ile) - internal
 */
function withProgress<T>(
  operation: string,
  fn: (progress: ProgressTracker) => Promise<T>
): Promise<T> {
  const progress = createProgress({ operation });
  
  return fn(progress)
    .then((result) => {
      progress.done();
      return result;
    })
    .catch((error) => {
      progress.fail(error.message);
      throw error;
    });
}

/**
 * Uzun işlem için timeout wrapper
 * İşlem belirtilen süreden uzun sürerse progress mesajı gösterir
 */
export function withTimeout<T>(
  operation: string,
  fn: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  let progress: ProgressTracker | null = null;

  const timeoutId = setTimeout(() => {
    progress = createProgress({ operation, quiet: true });
  }, timeoutMs);

  return fn()
    .then((result) => {
      clearTimeout(timeoutId);
      if (progress) {
        progress.done();
      }
      return result;
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      if (progress) {
        progress.fail(error.message);
      }
      throw error;
    });
}
