// @ts-nocheck
/**
 * @typedef {object} LogEntry
 * @property {string} timestamp
 * @property {string} source
 * @property {string} type
 * @property {string} message
 * @property {string | null} sessionId
 * @property {object | undefined} [meta]
 */

// Log Yöneticisi - Olay (event) kaydetme sistemi
class LogManagerClass {
  constructor() {
    /** @type {LogEntry[]} */
    this.logs = [];
    this.maxMemoryLogs = 200;
    /** @type {((entry: LogEntry) => void)[]} */
    this.listeners = [];
    /** @type {string | null} */
    this.sessionId = null;
    this.lastDedup = null;
    /** @type {Map<string, number>} */
    this.lastThrottle = new Map();
  }

  init() {
    this.sessionId = this.generateSessionId();
    this.addEvent(
      "system",
      "info",
      `Yeni oturum başlatıldı: ${this.sessionId}`,
    );
  }

  /**
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
   * @param {string} source
   * @param {'info' | 'warning' | 'error' | 'debug' | 'system' | string} type
   * @param {string} message
   * @param {object | null} [meta=null]
   */
  addEvent(source, type, message, meta = null) {
    const key = `${source}|${type}|${message}`;
    const nowTs = Date.now();
    const last = this.lastThrottle.get(key);
    if (type !== "error" && last && nowTs - last < 2000) return;
    this.lastThrottle.set(key, nowTs);

    const entry = {
      timestamp: new Date().toLocaleTimeString("tr-TR"),
      source,
      type,
      message,
      sessionId: this.sessionId,
      meta: meta || undefined,
    };

    this.logs.push(entry);

    // Bellekte yalnızca son `maxMemoryLogs` kaydı tut
    if (this.logs.length > this.maxMemoryLogs) {
      this.logs.shift();
    }

    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (error) {
        console.error("Log listener error:", error);
      }
    });

    this.persist(entry);
  }

  /**
   * @param {LogEntry} entry
   */
  persist(entry) {
    try {
      const line = JSON.stringify(entry);
      window.electronAPI?.appendLog?.({
        sessionId: this.sessionId || "session-unknown",
        line,
      });
    } catch (error) {
      console.warn("Log persist error:", error);
    }
  }

  /**
   * @param {(entry: LogEntry) => void} listener
   * @returns {() => void}
   */
  onUpdate(listener) {
    if (typeof listener !== "function")
      return () => {
        /* noop */
      };
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * @param {number} [limit=50]
   * @returns {LogEntry[]}
   */
  getRecent(limit = 50) {
    return this.logs.slice(-limit);
  }

  /**
   * @returns {LogEntry[]}
   */
  getAll() {
    return [...this.logs];
  }

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
