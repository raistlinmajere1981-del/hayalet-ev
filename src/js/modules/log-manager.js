/**
 * Renderer Process Log Manager
 * 
 * Merkezi olay kayıt sistemi. UI güncellemeleri ve dosya persistence sağlar.
 * Main process console-logger ile senkronize çalışır.
 * AI debugging için optimize edilmiş yapı.
 * 
 * @typedef {object} LogEntry
 * @property {string} timestamp - Zaman damgası
 * @property {string} source - Kaynak modül
 * @property {string} type - Log tipi (info, warning, error, debug, system)
 * @property {string} message - Log mesajı
 * @property {string | null} sessionId - Oturum ID
 * @property {string | null} [correlationId] - İşlem takip ID
 * @property {object | undefined} [context] - Ek bağlam bilgisi
 * @property {object | undefined} [meta] - Ek metadata
 * @property {object | undefined} [aiHint] - AI debugging ipucu
 */

class LogManagerClass {
  constructor() {
    /** @type {LogEntry[]} */
    this.logs = [];
    this.maxMemoryLogs = 200;
    /** @type {((entry: LogEntry) => void)[]} */
    this.listeners = [];
    /** @type {string | null} */
    this.sessionId = null;
    /** @type {Map<string, number>} */
    this.lastThrottle = new Map();
    /** @type {boolean} */
    this._consoleListenerSetup = false;
    /** @type {boolean} */
    this._initialized = false;
    /** @type {Map<string, object>} */
    this._activeOperations = new Map();
    /** @type {number} */
    this._correlationCounter = 0;
  }

  /**
   * Log sistemini başlat
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) return;
    
    try {
      const mainSessionId = await window.electronAPI?.getSessionId?.();
      this.sessionId = mainSessionId || this.generateSessionId();
    } catch {
      this.sessionId = this.generateSessionId();
    }

    this._initialized = true;
    
    this.addEvent(
      "system",
      "info",
      `Yeni oturum başlatıldı: ${this.sessionId}`,
    );

    this.setupConsoleLogListener();
  }

  /**
   * Main process'ten gelen console loglarını dinle
   */
  setupConsoleLogListener() {
    if (this._consoleListenerSetup) return;
    this._consoleListenerSetup = true;

    try {
      window.electronAPI?.onConsoleLogForward?.((data) => {
        this.addEventInternal(
          data.source,
          data.level,
          data.message,
          { context: data.context },
          false
        );
      });
    } catch (err) {
    }
  }

  /**
   * Session ID oluştur
   * @returns {string}
   */
  generateSessionId() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1);
    const year = now.getFullYear();
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    return `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`;
  }

  /**
   * Benzersiz correlation ID oluştur
   * @param {string} [prefix='op'] - ID prefix'i
   * @returns {string}
   */
  generateCorrelationId(prefix = 'op') {
    this._correlationCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this._correlationCounter.toString(36).padStart(4, '0');
    return `${prefix}-${timestamp}-${counter}`;
  }

  /**
   * İşlem başlat (correlation tracking için)
   * @param {string} operationName - İşlem adı
   * @param {object} [initialContext] - Başlangıç bağlamı
   * @returns {string} Correlation ID
   */
  startOperation(operationName, initialContext = {}) {
    const correlationId = this.generateCorrelationId(operationName);
    
    this._activeOperations.set(correlationId, {
      name: operationName,
      startTime: Date.now(),
      context: initialContext,
      events: [],
    });
    
    this.addEvent(
      operationName,
      "info",
      `İşlem başladı: ${operationName}`,
      { correlationId, ...initialContext }
    );
    
    return correlationId;
  }

  /**
   * İşlemi sonlandır
   * @param {string} correlationId - Correlation ID
   * @param {'success' | 'error' | 'cancelled'} [status='success'] - Sonuç durumu
   * @param {object} [result] - Sonuç verisi
   */
  endOperation(correlationId, status = 'success', result = null) {
    const operation = this._activeOperations.get(correlationId);
    if (!operation) return;
    
    const duration = Date.now() - operation.startTime;
    
    this.addEvent(
      operation.name,
      status === 'error' ? 'error' : 'info',
      `İşlem ${status === 'success' ? 'tamamlandı' : status === 'error' ? 'başarısız' : 'iptal edildi'}: ${operation.name} (${duration}ms)`,
      { correlationId, status, duration, result }
    );
    
    this._activeOperations.delete(correlationId);
  }

  /**
   * Log girdisi ekle
   * @param {string} source - Kaynak modül
   * @param {'info' | 'warning' | 'error' | 'debug' | 'system'} type - Log tipi
   * @param {string} message - Mesaj
   * @param {object | null} [meta=null] - Ek metadata
   */
  addEvent(source, type, message, meta = null) {
    this.addEventInternal(source, type, message, meta, true);
  }

  /**
   * Internal event adder with persist control
   * @param {string} source
   * @param {string} type
   * @param {string} message
   * @param {object | null} meta
   * @param {boolean} shouldPersist - Dosyaya yazılsın mı?
   */
  addEventInternal(source, type, message, meta = null, shouldPersist = true) {
    const key = `${source}|${type}|${message}`;
    const nowTs = Date.now();
    const last = this.lastThrottle.get(key);
    if (type !== "error" && last && nowTs - last < 2000) return;
    this.lastThrottle.set(key, nowTs);

    const correlationId = meta?.correlationId || null;
    const context = meta?.context || null;
    
    let cleanMeta = meta ? { ...meta } : undefined;
    if (cleanMeta) {
      delete cleanMeta.correlationId;
      delete cleanMeta.context;
      if (Object.keys(cleanMeta).length === 0) {
        cleanMeta = undefined;
      }
    }

    /** @type {LogEntry} */
    const entry = {
      timestamp: new Date().toLocaleTimeString("tr-TR"),
      isoTimestamp: new Date().toISOString(),
      source,
      type,
      message,
      sessionId: this.sessionId,
      correlationId,
      context,
      meta: cleanMeta && Object.keys(cleanMeta).length > 0 ? cleanMeta : undefined,
    };

    this.logs.push(entry);

    // Bellekte yalnızca son `maxMemoryLogs` kaydı tut
    if (this.logs.length > this.maxMemoryLogs) {
      this.logs.shift();
    }

    // Listeners'a bildir (UI güncellemesi için)
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (error) {
        // Log listener error - silent to prevent infinite loop
      }
    });

    // Sadece shouldPersist true ise dosyaya yaz
    // (console-logger'dan gelen loglar zaten yazıldı)
    if (shouldPersist) {
      this.persist(entry);
    }
  }

  /**
   * Context ile log ekle (webview işlemleri için)
   * @param {string} source - Kaynak
   * @param {string} type - Tip
   * @param {string} message - Mesaj
   * @param {object} context - Bağlam (provider, slot, url, action, selector, etc.)
   * @param {string} [correlationId] - İşlem ID
   */
  addEventWithContext(source, type, message, context, correlationId = null) {
    this.addEvent(source, type, message, { context, correlationId });
  }

  /**
   * Log girdisini dosyaya yaz
   * @param {LogEntry} entry
   */
  persist(entry) {
    try {
      if (!this.sessionId) return;

      const line = JSON.stringify(entry);
      window.electronAPI?.appendLog?.({
        sessionId: this.sessionId,
        line,
        context: entry.context,
      });
    } catch (error) {
    }
  }

  /**
   * Log değişikliklerini dinle
   * @param {(entry: LogEntry) => void} listener
   * @returns {() => void} Unsubscribe fonksiyonu
   */
  onUpdate(listener) {
    if (typeof listener !== "function")
      return () => {
      };
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Son N log girdisini al
   * @param {number} [limit=50]
   * @returns {LogEntry[]}
   */
  getRecent(limit = 50) {
    return this.logs.slice(-limit);
  }

  /**
   * Tüm logları al
   * @returns {LogEntry[]}
   */
  getAll() {
    return [...this.logs];
  }

  /**
   * Logları filtrele
   * @param {object} filter - Filtre kriterleri
   * @returns {LogEntry[]}
   */
  filter(filter = {}) {
    const { source, type, correlationId, contains, since } = filter;
    
    return this.logs.filter(entry => {
      if (source && !entry.source.toLowerCase().includes(source.toLowerCase())) {
        return false;
      }
      if (type && entry.type !== type) {
        return false;
      }
      if (correlationId && entry.correlationId !== correlationId) {
        return false;
      }
      if (contains && !entry.message.toLowerCase().includes(contains.toLowerCase())) {
        return false;
      }
      if (since) {
        const entryTime = new Date(entry.isoTimestamp || entry.timestamp);
        const sinceTime = new Date(since);
        if (entryTime < sinceTime) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Aktif işlemleri al
   * @returns {Map<string, object>}
   */
  getActiveOperations() {
    return new Map(this._activeOperations);
  }

  /**
   * Hata sayısını al
   * @returns {number}
   */
  getErrorCount() {
    return this.logs.filter(l => l.type === 'error').length;
  }

  /**
   * Uyarı sayısını al
   * @returns {number}
   */
  getWarningCount() {
    return this.logs.filter(l => l.type === 'warning').length;
  }

  /**
   * İstatistikleri al
   * @returns {object}
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byType: {},
      bySource: {},
      errors: 0,
      warnings: 0,
    };
    
    for (const log of this.logs) {
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
      
      stats.bySource[log.source] = (stats.bySource[log.source] || 0) + 1;
      
      if (log.type === 'error') stats.errors++;
      if (log.type === 'warning') stats.warnings++;
    }
    
    return stats;
  }

  /**
   * Logları temizle
   */
  clear() {
    this.logs = [];
    this.lastThrottle.clear();
  }

  // ============================================================================
  // ============================================================================

  LoggerNewSession() {
    return this.init();
  }

  /**
   * @param {string} source
   * @param {string} type
   * @param {string} message
   */
  LoggerAddEvent(source, type, message) {
    return this.addEvent(source, type, message);
  }

  /**
   * @param {number} [limit=50]
   */
  LoggerGetRecent(limit = 50) {
    return this.getRecent(limit);
  }
}

export const LogManager = new LogManagerClass();
