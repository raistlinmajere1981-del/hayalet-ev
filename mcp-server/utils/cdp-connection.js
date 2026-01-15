/**
 * CDP (Chrome DevTools Protocol) Connection Manager
 * 
 * Electron uygulamasına WebSocket üzerinden bağlanır ve
 * JavaScript kodlarını uzaktan çalıştırır.
 */

import WebSocket from "ws";

const CDP_PORT = process.env.CDP_PORT || 9222;
const CDP_HOST = process.env.CDP_HOST || "localhost";

/**
 * Electron debug endpoint'lerini keşfet
 * @returns {Promise<Array>} Mevcut hedefler listesi
 */
export async function discoverTargets() {
  try {
    const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
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
 * @returns {Promise<Object|null>} Ana pencere hedefi veya null
 */
async function findMainWindow() {
  const targets = await discoverTargets();
  
  // Önce "page" tipinde hedef ara
  const pageTarget = targets.find(t => t.type === "page");
  if (pageTarget) return pageTarget;
  
  // Yoksa ilk hedefi döndür
  return targets[0] || null;
}

/**
 * Belirli bir hedefe WebSocket bağlantısı aç
 * @param {string} wsUrl - WebSocket debug URL'i
 * @returns {Promise<WebSocket>} Bağlı WebSocket instance
 */
function connectToTarget(wsUrl) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const ws = new WebSocket(wsUrl);
    
    ws.on("open", () => {
      if (!resolved) {
        resolved = true;
        resolve(ws);
      }
    });
    
    ws.on("error", (err) => {
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

/**
 * CDP komutu gönder ve yanıt bekle
 * @param {WebSocket} ws - WebSocket bağlantısı
 * @param {string} method - CDP metod adı
 * @param {Object} params - Metod parametreleri
 * @param {number} timeout - Timeout süresi (ms)
 * @returns {Promise<Object>} CDP yanıtı
 */
// Global ID counter for CDP commands
let cdpCommandId = 1;

export function sendCDPCommand(ws, method, params = {}, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const id = cdpCommandId++;
    let timeoutId;
    
    const messageHandler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          clearTimeout(timeoutId);
          ws.off("message", messageHandler);
          if (response.error) {
            reject(new Error(`CDP Hatası: ${response.error.message}`));
          } else {
            resolve(response.result || {});
          }
        }
      } catch (e) {
        // JSON parse hatası, devam et
      }
    };
    
    ws.on("message", messageHandler);
    
    try {
      ws.send(JSON.stringify({ id, method, params }));
    } catch (e) {
      ws.off("message", messageHandler);
      reject(new Error(`WebSocket gönderim hatası: ${e.message}`));
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
 * @param {WebSocket} ws - WebSocket bağlantısı
 * @param {string} expression - JavaScript kodu
 * @param {boolean} awaitPromise - Promise sonucunu bekle
 * @returns {Promise<any>} Çalıştırma sonucu
 */
export async function evaluateJS(ws, expression, awaitPromise = true) {
  const result = await sendCDPCommand(ws, "Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  
  if (result.exceptionDetails) {
    throw new Error(
      `JavaScript hatası: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`
    );
  }
  
  return result.result?.value;
}

/**
 * Electron'a bağlan, komutu çalıştır ve bağlantıyı kapat
 * @param {Function} action - (ws) => Promise şeklinde aksiyon
 * @returns {Promise<any>} Aksiyon sonucu
 */
export async function withConnection(action) {
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

/**
 * Electron bağlantı durumunu kontrol et
 * @returns {Promise<Object>} Bağlantı durumu
 */
export async function checkConnection() {
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
    return {
      connected: false,
      port: CDP_PORT,
      error: error.message,
    };
  }
}
