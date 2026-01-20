/**
 * Renderer Process Log Manager
 * 
 * Merkezi olay kayıt sistemi. UI güncellemeleri ve dosya persistence sağlar.
 * Main process console-logger ile senkronize çalışır.
 * AI debugging için optimize edilmiş yapı.
 * 
 * Toast Entegrasyonu: success, error, warning tipli loglar otomatik Toast gösterir.
 */

// Toast import - lazy loaded to avoid circular dependencies
let ToastModule: typeof import('../ui/toast-manager') | null = null;
const getToast = async () => {
  if (!ToastModule) {
    try {
      ToastModule = await import('../ui/toast-manager.js');
    } catch {
      // Toast modülü yüklenemedi - sessizce devam et
    }
  }
  return ToastModule?.Toast;
};

/**
 * Log Visibility Seviyeleri:
 * 1 = Toast: Kullanıcı bildirimi (bağlantı, hata, başarı)
 * 2 = Panel: Süreç durumu (db açıldı, sync, loading)
 * 3 = Verbose: Debug (state transition, IPC, probe)
 * 
 * Her seviye alt seviyeleri içerir:
 * - Toast (1): Toast + Panel + Verbose görünür
 * - Panel (2): Panel + Verbose görünür
 * - Verbose (3): Sadece Verbose görünür
 */
export type LogVisibility = 1 | 2 | 3;

export interface LogEntry {
  timestamp: string;
  isoTimestamp?: string;
  source: string;
  type: string;
  message: string;
  sessionId: string | null;
  correlationId?: string | null;
  context?: unknown;
  meta?: Record<string, unknown>;
  aiHint?: unknown;
  /** Log görünürlük seviyesi: 1=toast, 2=panel, 3=verbose */
  visibility: LogVisibility;
}

class LogManagerClass {
  logs: LogEntry[];
  maxMemoryLogs: number;
  listeners: ((entry: LogEntry) => void)[];
  sessionId: string | null;
  lastThrottle: Map<string, number>;
  _consoleListenerSetup: boolean;
  _initialized: boolean;
  _activeOperations: Map<string, any>;
  _correlationCounter: number;

  constructor() {
    this.logs = [];
    this.maxMemoryLogs = 200;
    this.listeners = [];
    this.sessionId = null;
    this.lastThrottle = new Map();
    this._consoleListenerSetup = false;
    this._initialized = false;
    this._activeOperations = new Map();
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
    
    // Main process'in erken loglarını yükle (UI hazır olmadan önce oluşanlar)
    await this.loadEarlyLogs();
    
    this.addEvent(
      "system",
      "info",
      `Yeni oturum başlatıldı: ${this.sessionId}`,
      { visibility: 2 } // Panel seviyesi
    );

    this.setupConsoleLogListener();
  }

  /**
   * Main process'in erken loglarını yükle
   * UI hazır olmadan önce oluşan logları retroaktif olarak ekler
   */
  private async loadEarlyLogs() {
    try {
      const earlyLogs = await window.electronAPI?.getEarlyLogs?.();
      if (Array.isArray(earlyLogs) && earlyLogs.length > 0) {
        earlyLogs.forEach((log: { source: string; level: string; message: string; timestamp?: string; visibility?: number }) => {
          // Erken logları persist etmeden ekle (zaten dosyaya yazılmış)
          this.addEventInternal(
            log.source || 'main',
            log.level || 'info',
            log.message,
            { visibility: log.visibility || 2 },
            false // shouldPersist = false
          );
        });
        this.addEvent('system', 'debug', `${earlyLogs.length} erken log yüklendi`, { visibility: 3 });
      }
    } catch {
      // Early logs yüklenemedi - kritik değil
    }
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
          data.source || "console",
          data.level,
          data.message || "",
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
    const pad = (n: number) => n.toString().padStart(2, "0");
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
  startOperation(operationName: string, initialContext: Record<string, unknown> = {}) {
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
  endOperation(correlationId: string, status: 'success' | 'error' | 'cancelled' = 'success', result: unknown = null) {
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
   * @param {'info' | 'warning' | 'error' | 'debug' | 'system' | 'success'} type - Log tipi
   * @param {string} message - Mesaj
   * @param {object | null} [meta=null] - Ek metadata (visibility: 1|2|3 içerebilir)
   */
  addEvent(source: string, type: string, message: string, meta: Record<string, unknown> | null = null) {
    this.addEventInternal(source, type, message, meta, true);
  }

  /**
   * Toast seviyesinde log ekle (visibility: 1)
   * Kullanıcıya gösterilmesi gereken önemli mesajlar için
   */
  toast(source: string, type: string, message: string, meta: Record<string, unknown> | null = null) {
    this.addEvent(source, type, message, { ...meta, visibility: 1 });
  }

  /**
   * Panel seviyesinde log ekle (visibility: 2)
   * Süreç durumu mesajları için
   */
  panel(source: string, type: string, message: string, meta: Record<string, unknown> | null = null) {
    this.addEvent(source, type, message, { ...meta, visibility: 2 });
  }

  /**
   * Verbose seviyesinde log ekle (visibility: 3) - default
   * Debug ve detaylı mesajlar için
   */
  verbose(source: string, type: string, message: string, meta: Record<string, unknown> | null = null) {
    this.addEvent(source, type, message, { ...meta, visibility: 3 });
  }

  /**
   * Internal event adder with persist control
   * @param {string} source
   * @param {string} type
   * @param {string} message
   * @param {object | null} meta - visibility: 1|2|3 içerebilir
   * @param {boolean} shouldPersist - Dosyaya yazılsın mı?
   */
  addEventInternal(source: string, type: string, message: string, meta: Record<string, unknown> | null = null, shouldPersist = true) {
    const key = `${source}|${type}|${message}`;
    const nowTs = Date.now();
    const last = this.lastThrottle.get(key);
    if (type !== "error" && last && nowTs - last < 2000) return;
    this.lastThrottle.set(key, nowTs);

    const correlationId = (meta?.correlationId as string | null) || null;
    const context = meta?.context ?? null;
    
    // Visibility seviyesi: 1=toast, 2=panel, 3=verbose (default)
    const visibility = (meta?.visibility as LogVisibility) || this._inferVisibility(source, type);
    
    let cleanMeta = meta ? { ...meta } : undefined;
    if (cleanMeta) {
      delete cleanMeta.correlationId;
      delete cleanMeta.context;
      delete cleanMeta.showToast; // eski API uyumluluğu için
      delete cleanMeta.visibility;
      if (Object.keys(cleanMeta).length === 0) {
        cleanMeta = undefined;
      }
    }

    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString("tr-TR"),
      isoTimestamp: new Date().toISOString(),
      source,
      type,
      message,
      sessionId: this.sessionId,
      correlationId,
      context,
      meta: cleanMeta && Object.keys(cleanMeta).length > 0 ? cleanMeta : undefined,
      visibility,
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

    // Toast entegrasyonu - visibility 1 olan loglar için Toast göster
    if (visibility === 1) {
      this._showToast(source, type, message);
    }
  }

  /**
   * Visibility seviyesini source, type ve message'a göre otomatik belirle
   * Mevcut loglar için geriye uyumluluk sağlar
   * 
   * Seviye 1 (Toast): Kullanıcının görmesi gereken önemli bildirimler
   * Seviye 2 (Panel): Süreç durumu, init mesajları
   * Seviye 3 (Verbose): Debug, teknik detaylar
   */
  private _inferVisibility(source: string, type: string): LogVisibility {
    const srcLower = source.toLowerCase();
    
    // ============================================
    // SEVIYE 3 (Verbose) - Debug ve teknik loglar
    // ============================================
    
    // Debug tipi her zaman verbose
    if (type === 'debug') return 3;
    
    // Teknik/verbose kaynaklar - error/warning olsa bile verbose
    const verboseSources = [
      // Traffic ve probe
      'traffic', 'probe', 'webview-events',
      // State machine
      'slot-state', 'state-machine', 'statemachine',
      // IPC ve teknik
      'ipc-client', 'app-state', 'settings-events', 'settings-ipc',
      // UI bileşenleri (sık tetiklenir)
      'buttonstates', 'audiomanager', 'canvasmanager', 
      'toast', 'modal', 'thememanager', 'splashscreen',
      // Provider ve factory
      'provider-factory', 'provider-registry',
      // Webview detay logları (slot-ai1, slot-ai2, webview-chatgpt vb.)
      'slot-ai', 'webview-chatgpt', 'webview-grok', 'webview-gemini', 'webview-opencode',
      // Renderer ve console
      'renderer', 'console',
      // Sync detayları
      'conversation-syncer', 'pending-archive'
    ];
    if (verboseSources.some(s => srcLower.includes(s))) {
      return 3;
    }
    
    // ============================================
    // SEVIYE 1 (Toast) - Kullanıcı bildirimleri
    // ============================================
    
    // Success mesajları genellikle toast (kullanıcı aksiyonu sonucu)
    if (type === 'success') return 1;
    
    // Kritik hatalar toast seviyesinde
    if (type === 'error') {
      // Kaynak bazlı toast error'lar (bağlantı, upload, komut hataları)
      const toastErrorSources = ['entrance', 'asistan', 'server', 'analyze', 'file-upload', 'whisper'];
      if (toastErrorSources.some(s => srcLower.includes(s))) return 1;
      // Diğer error'lar panel seviyesinde
      return 2;
    }
    
    // Warning'ler panel seviyesinde
    if (type === 'warning') {
      return 2;
    }
    
    // ============================================
    // SEVIYE 2 (Panel) - Süreç durumu (SADECE bunlar)
    // ============================================
    
    // Sadece önemli sistem ve süreç logları
    const panelSources = [
      'system',           // Uygulama başlatıldı
      'slot-controller',  // SlotController initialized
      'relay',            // RelayManager initialized
      'error-boundary',   // ErrorBoundary initialized
      'core',             // CoreEngine
      'meta-command',     // Custom komut yüklendi
      'asistan',          // AsistanController (init, server start/stop)
      'entrance',         // Bağlanıyor/kesiliyor bilgileri
      'db', 'database',   // Database açıldı/kapandı
      'sync',             // Sync initialized
      'webview-panel',    // Preload script ayarlandı
      'lifecycle',        // Webview attached/destroyed
    ];
    if (panelSources.some(s => srcLower.includes(s))) {
      return 2;
    }
    
    // Default: VERBOSE (bilinmeyen kaynaklar debug seviyesinde)
    return 3;
  }

  /**
   * Belirli visibility seviyesine göre logları filtrele
   * @param maxVisibility - Maksimum görünürlük seviyesi (1, 2 veya 3)
   * @returns Filtrelenmiş log dizisi
   */
  getByVisibility(maxVisibility: LogVisibility): LogEntry[] {
    return this.logs.filter(entry => entry.visibility <= maxVisibility);
  }

  /**
   * Toast seviyesindeki logları al (visibility: 1)
   */
  getToastLogs(): LogEntry[] {
    return this.getByVisibility(1);
  }

  /**
   * Panel seviyesindeki logları al (visibility: 1 ve 2)
   */
  getPanelLogs(): LogEntry[] {
    return this.getByVisibility(2);
  }

  /**
   * Tüm logları al (verbose - visibility: 1, 2 ve 3)
   */
  getVerboseLogs(): LogEntry[] {
    return this.getByVisibility(3);
  }

  /**
   * Toast göster
   */
  private _showToast(source: string, type: string, message: string): void {
    getToast().then(Toast => {
      if (!Toast) return;
      
      // Source'u başlık olarak kullan (capitalize)
      const title = source.charAt(0).toUpperCase() + source.slice(1);
      
      switch (type) {
        case 'success':
          Toast.success(title, message);
          break;
        case 'error':
          Toast.error(title, message);
          break;
        case 'warning':
          Toast.warning(title, message);
          break;
      }
    });
  }

  /**
   * Context ile log ekle (webview işlemleri için)
   * @param {string} source - Kaynak
   * @param {string} type - Tip
   * @param {string} message - Mesaj
   * @param {object} context - Bağlam (provider, slot, url, action, selector, etc.)
   * @param {string} [correlationId] - İşlem ID
   */
  addEventWithContext(source: string, type: string, message: string, context: Record<string, unknown>, correlationId: string | null = null) {
    this.addEvent(source, type, message, { context, correlationId });
  }

  /**
   * Log girdisini dosyaya yaz
   * @param {LogEntry} entry
   */
  persist(entry: LogEntry) {
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
  onUpdate(listener: (entry: LogEntry) => void) {
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
  filter(filter: { source?: string; type?: string; correlationId?: string; contains?: string; since?: string | Date } = {}) {
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
        const entryTime = new Date(entry.timestamp);
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
    const stats: { total: number; byType: Record<string, number>; bySource: Record<string, number>; errors: number; warnings: number } = {
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
  LoggerAddEvent(source: string, type: string, message: string) {
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
