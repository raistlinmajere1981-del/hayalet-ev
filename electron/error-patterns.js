/**
 * Error Pattern Database for Hayalet-ev
 * 
 * Bilinen hata pattern'leri ve çözüm ipuçları.
 * AI debugging için otomatik hint sistemi.
 */

/**
 * @typedef {object} ErrorHint
 * @property {string} pattern - Regex pattern
 * @property {string} category - Hata kategorisi
 * @property {string} suggestion - Çözüm önerisi
 * @property {string[]} checkFiles - Kontrol edilecek dosyalar
 * @property {string[]} relatedDocs - İlgili dokümantasyon
 * @property {string} [severity] - Önem derecesi: low, medium, high, critical
 */

/** @type {ErrorHint[]} */
const ERROR_PATTERNS = [
  // DOM/Selector Hataları
  {
    pattern: "Cannot read propert(?:y|ies) ['\"]?click['\"]? of (?:null|undefined)",
    category: "dom-selector",
    suggestion: "Selector muhtemelen değişti. Provider'ın DOM yapısını kontrol et ve config.js'deki selector'ları güncelle.",
    checkFiles: [
      "src/js/modules/webview/providers/{provider}/config.js",
      "src/js/modules/webview/providers/{provider}/index.js",
    ],
    relatedDocs: ["doc/{provider}-dom.txt"],
    severity: "high",
  },
  {
    pattern: "Cannot read propert(?:y|ies) .* of (?:null|undefined)",
    category: "null-reference",
    suggestion: "Null/undefined değerine erişim hatası. Optional chaining (?.) kullanılmalı veya değerin varlığı kontrol edilmeli.",
    checkFiles: [],
    relatedDocs: [],
    severity: "medium",
  },
  {
    pattern: "querySelector.*returned null",
    category: "dom-selector",
    suggestion: "DOM elementi bulunamadı. Selector'ın doğruluğunu ve elementin yüklenip yüklenmediğini kontrol et.",
    checkFiles: ["src/js/modules/webview/providers/{provider}/config.js"],
    relatedDocs: [],
    severity: "medium",
  },
  
  // Network Hataları
  {
    pattern: "net::ERR_INTERNET_DISCONNECTED",
    category: "network",
    suggestion: "İnternet bağlantısı yok. Ağ bağlantısını kontrol et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "high",
  },
  {
    pattern: "net::ERR_NAME_NOT_RESOLVED",
    category: "network",
    suggestion: "DNS çözümlemesi başarısız. Domain adının doğru olduğunu ve DNS sunucusuna erişilebildiğini kontrol et.",
    checkFiles: ["src/js/modules/webview/providers/{provider}/config.js"],
    relatedDocs: [],
    severity: "high",
  },
  {
    pattern: "net::ERR_CONNECTION_REFUSED",
    category: "network",
    suggestion: "Bağlantı reddedildi. Hedef sunucunun çalışıp çalışmadığını kontrol et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "high",
  },
  {
    pattern: "net::ERR_CONNECTION_TIMED_OUT",
    category: "network",
    suggestion: "Bağlantı zaman aşımına uğradı. Ağ bağlantısını ve sunucu durumunu kontrol et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "medium",
  },
  {
    pattern: "net::ERR_SSL",
    category: "network",
    suggestion: "SSL/TLS hatası. Sertifika geçerliliğini kontrol et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "high",
  },
  {
    pattern: "CORS",
    category: "network",
    suggestion: "Cross-Origin Resource Sharing hatası. Webview'de CORS genellikle sorun olmaz, ancak external API çağrılarında dikkat et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "medium",
  },
  
  // IPC Hataları
  {
    pattern: "ipcRenderer\\.invoke.*timed out",
    category: "ipc",
    suggestion: "IPC çağrısı zaman aşımına uğradı. Main process'in yanıt verip vermediğini kontrol et.",
    checkFiles: ["electron/main.js", "electron/preload.cjs"],
    relatedDocs: [],
    severity: "high",
  },
  {
    pattern: "No handler registered for.*channel",
    category: "ipc",
    suggestion: "IPC kanalı için handler tanımlı değil. Main process'te ipcMain.handle() tanımını kontrol et.",
    checkFiles: ["electron/main.js"],
    relatedDocs: [],
    severity: "high",
  },
  {
    pattern: "contextBridge.*not available",
    category: "ipc",
    suggestion: "contextBridge mevcut değil. Preload script'in doğru yüklendiğinden emin ol.",
    checkFiles: ["electron/preload.cjs", "electron/webview-preload.cjs"],
    relatedDocs: [],
    severity: "critical",
  },
  
  // File System Hataları
  {
    pattern: "ENOENT.*no such file",
    category: "filesystem",
    suggestion: "Dosya veya dizin bulunamadı. Yolun doğruluğunu ve dosyanın varlığını kontrol et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "medium",
  },
  {
    pattern: "EACCES.*permission denied",
    category: "filesystem",
    suggestion: "Dosya erişim izni yok. Dosya/dizin izinlerini kontrol et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "high",
  },
  {
    pattern: "EEXIST.*file already exists",
    category: "filesystem",
    suggestion: "Dosya zaten mevcut. Üzerine yazma veya farklı isim kullanmayı değerlendir.",
    checkFiles: [],
    relatedDocs: [],
    severity: "low",
  },
  
  // Provider-Specific Hataları
  {
    pattern: "ChatGPT.*session.*expired",
    category: "provider-auth",
    suggestion: "ChatGPT oturumu sona ermiş. Webview'de yeniden giriş yapılmalı.",
    checkFiles: [],
    relatedDocs: ["doc/chatgpt-dom.txt"],
    severity: "medium",
  },
  {
    pattern: "Gemini.*quota.*exceeded",
    category: "provider-limit",
    suggestion: "Gemini API kotası aşıldı. Bir süre bekle veya farklı hesap kullan.",
    checkFiles: [],
    relatedDocs: ["doc/gemini-dom.txt"],
    severity: "medium",
  },
  {
    pattern: "rate.?limit",
    category: "provider-limit",
    suggestion: "Rate limit hatası. İstek sıklığını azalt veya bekle.",
    checkFiles: [],
    relatedDocs: [],
    severity: "medium",
  },
  
  // Memory/Performance Hataları
  {
    pattern: "out of memory|heap.*exceeded",
    category: "memory",
    suggestion: "Bellek yetersiz. Uygulamayı yeniden başlat veya bellek kullanımını optimize et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "critical",
  },
  {
    pattern: "Maximum call stack size exceeded",
    category: "stack-overflow",
    suggestion: "Sonsuz döngü veya aşırı derin recursion var. Kod mantığını kontrol et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "critical",
  },
  
  // Webview Hataları
  {
    pattern: "Webview.*crashed",
    category: "webview-crash",
    suggestion: "Webview çöktü. Sayfayı yeniden yükle veya webview'i yeniden oluştur.",
    checkFiles: ["src/js/modules/webview-manager.js"],
    relatedDocs: [],
    severity: "critical",
  },
  {
    pattern: "did-fail-load",
    category: "webview-load",
    suggestion: "Webview sayfa yükleme hatası. URL'in doğruluğunu ve ağ bağlantısını kontrol et.",
    checkFiles: ["src/js/modules/webview/providers/{provider}/config.js"],
    relatedDocs: [],
    severity: "high",
  },
  
  // JSON/Parse Hataları
  {
    pattern: "JSON\\.parse.*Unexpected token",
    category: "parse",
    suggestion: "JSON parse hatası. Gelen verinin geçerli JSON olduğundan emin ol.",
    checkFiles: [],
    relatedDocs: [],
    severity: "medium",
  },
  {
    pattern: "SyntaxError.*Unexpected",
    category: "syntax",
    suggestion: "JavaScript syntax hatası. Kod içeriğini kontrol et.",
    checkFiles: [],
    relatedDocs: [],
    severity: "high",
  },
  
  // Command Queue Hataları
  {
    pattern: "Command.*timeout",
    category: "command",
    suggestion: "Komut zaman aşımına uğradı. Webview'in yanıt verip vermediğini kontrol et.",
    checkFiles: ["src/js/modules/command-executor.js", "electron/command-manager.js"],
    relatedDocs: [],
    severity: "medium",
  },
  {
    pattern: "Job.*failed",
    category: "command",
    suggestion: "İş başarısız oldu. Hata detaylarını ve webview durumunu kontrol et.",
    checkFiles: ["src/js/modules/command-executor.js"],
    relatedDocs: [],
    severity: "medium",
  },
  
  // Google Drive Hataları
  {
    pattern: "Google.*auth.*failed|OAuth.*error",
    category: "googledrive",
    suggestion: "Google Drive kimlik doğrulama hatası. Credentials'ı yenile veya yeniden bağlan.",
    checkFiles: ["electron/googledrive-manager.js"],
    relatedDocs: [],
    severity: "high",
  },
  {
    pattern: "Drive.*quota",
    category: "googledrive",
    suggestion: "Google Drive kotası dolu. Yer açın veya farklı hesap kullanın.",
    checkFiles: [],
    relatedDocs: [],
    severity: "medium",
  },
];

/**
 * Hata mesajını pattern database ile eşleştir
 * @param {string} errorMessage - Hata mesajı
 * @param {string} [provider] - Provider adı (opsiyonel, checkFiles için placeholder)
 * @returns {ErrorHint | null}
 */
export function matchErrorPattern(errorMessage, provider = null) {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return null;
  }
  
  for (const pattern of ERROR_PATTERNS) {
    const regex = new RegExp(pattern.pattern, 'i');
    if (regex.test(errorMessage)) {
      const hint = { ...pattern };
      
      if (provider) {
        hint.checkFiles = hint.checkFiles.map(f => f.replace(/{provider}/g, provider));
        hint.relatedDocs = hint.relatedDocs.map(d => d.replace(/{provider}/g, provider));
      }
      
      return {
        pattern: pattern.pattern,
        category: hint.category,
        suggestion: hint.suggestion,
        checkFiles: hint.checkFiles,
        relatedDocs: hint.relatedDocs,
        severity: hint.severity || 'medium',
      };
    }
  }
  
  return null;
}

export { ERROR_PATTERNS };
