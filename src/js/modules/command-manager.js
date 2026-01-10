import { LogManager } from "./log-manager.js";

/**
 * @typedef {object} CommandJob
 * @property {string} id
 * @property {string} provider
 * @property {string} command
 * @property {string} message
 * @property {any[]} attachments
 * @property {string | null} sessionId
 * @property {object} meta
 * @property {object} payload
 * @property {number} createdAt
 * @property {'queued' | 'processing' | 'sent' | 'failed'} status
 * @property {Function | null} run
 * @property {any} _deferred
 * @property {Promise<any>} done
 * @property {any} [result]
 */

class CommandManagerClass {
  constructor() {
    /** @type {CommandJob[]} */
    this.queue = [];
    this.processing = false;
    /** @type {((job: CommandJob) => Promise<any>) | null} */
    this.executor = null;
    /** @type {Record<string, Function[]>} */
    this.listeners = { queued: [], sent: [], failed: [], status: [] };
  }

  async init() {
    try {
      await window.electronAPI?.commandInit?.();
      // Init logu kaldırıldı - gereksiz gürültü
      this.queue = [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      LogManager.addEvent(
        "command",
        "error",
        `CommandManager init hatası: ${message}`,
      );
    }
  }

  /**
   * @param {(job: CommandJob) => Promise<any>} fn
   */
  setExecutor(fn) {
    this.executor = typeof fn === "function" ? fn : null;
  }

  /**
   * @param {string} event
   * @param {Function} listener
   * @returns {() => void}
   */
  on(event, listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    if (typeof listener === "function") {
      this.listeners[event].push(listener);
    }
    return () => {
      this.listeners[event] = (this.listeners[event] || []).filter(
        (l) => l !== listener,
      );
    };
  }

  /**
   * @param {string} event
   * @param {any} payload
   */
  emit(event, payload) {
    (this.listeners[event] || []).forEach((l) => {
      try {
        l(payload);
      } catch (err) {
        LogManager.addEvent("command", "warning", `Listener error: ${err?.message || err}`);
      }
    });
  }

  defer() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  /**
   * @param {object} [payload={}]
   * @returns {object}
   */
  sanitizePayload(payload = {}) {
    const rest = payload || {};
    try {
      return JSON.parse(JSON.stringify(rest));
    } catch {
      const cleaned = {};
      Object.entries(rest || {}).forEach(([key, value]) => {
        if (typeof value === "function") return;
        try {
          cleaned[key] = JSON.parse(JSON.stringify(value));
        } catch (e) {
          /* noop */
        }
      });
      return cleaned;
    }
  }

  /**
   * @param {any[]} [items=[]]
   * @returns {CommandJob[]}
   */
  enqueue(items = []) {
    const list = Array.isArray(items) ? items : [items];
    const jobs = list.map((item) => this.addJob(item));
    this.processNext();
    return jobs;
  }

  /**
   * @param {any} [item={}]
   * @returns {CommandJob}
   */
  addJob(item = {}) {
    const deferred = this.defer();
    /** @type {CommandJob} */
    const job = {
      id: item.id || `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      provider: item.provider || item.target || "default",
      command:
        item.command || item.payload?.command || item.meta?.command || "",
      message: item.message || item.payload?.message || item.command || "",
      attachments: item.attachments || [],
      sessionId: item.sessionId || null,
      meta: item.meta || {},
      payload: this.sanitizePayload(item.payload || {}),
      createdAt: Date.now(),
      status: "queued",
      run: item.run || null,
      _deferred: deferred,
      done: deferred.promise,
    };
    this.queue.push(job);
    this.persist(job);
    this.emit("queued", job);
    return job;
  }

  /**
   * @returns {CommandJob | undefined}
   */
  getNextJob() {
    if (!this.queue.length) return undefined;
    return this.queue.shift();
  }

  async processNext() {
    if (this.processing) return;
    const job = this.getNextJob();
    if (!job) return;
    this.processing = true;
    job.status = "processing";
    this.emit("status", { job, status: "processing" });
    try {
      const runner = job.run || this.executor;
      if (runner) {
        const res = await runner(job);
        job.result = res;
        job.status = "sent";
        this.emit("sent", { job, result: res });
      } else {
        job.result = null;
        job.status = "sent";
        this.emit("sent", { job, result: null });
      }
      this.markDone(job.id);
      job._deferred.resolve(job);
    } catch (err) {
      job.status = "failed";
      this.emit("failed", { job, error: err });
      const message = err instanceof Error ? err.message : "unknown error";
      this.markFailed(job.id, message);
      job._deferred.reject(err);
    } finally {
      // FIX: Clean up deferred references to prevent memory leak
      // The promise has been resolved/rejected, so we can safely clear these
      this._cleanupJobReferences(job);
      
      this.processing = false;
      if (this.queue.length) {
        this.processNext();
      }
    }
  }

  /**
   * FIX: Clean up job references after completion to prevent memory leak
   * @param {CommandJob} job
   */
  _cleanupJobReferences(job) {
    if (!job) return;
    // Clear deferred object - promise is already settled
    job._deferred = null;
    // Clear the done promise reference
    job.done = null;
    // Clear the runner function reference
    job.run = null;
  }

  /**
   * @param {string} id
   */
  markDone(id) {
    const mover = window.electronAPI?.commandMove;
    if (typeof mover === "function") {
      mover(id, "done").catch?.(() => {
        /* noop */
      });
    }
    LogManager.addEvent("command", "info", `Komut tamamlandı (${id})`);
    return true;
  }

  /**
   * @param {string} id
   * @param {string} [reason='']
   */
  markFailed(id, reason = "") {
    const mover = window.electronAPI?.commandMove;
    if (typeof mover === "function") {
      mover(id, "failed").catch?.(() => {
        /* noop */
      });
    }
    LogManager.addEvent("command", "error", `Komut hatası (${id}): ${reason}`);
    return false;
  }

  /**
   * @param {CommandJob} job
   */
  persist(job) {
    const writer = window.electronAPI?.commandWrite;
    if (typeof writer === "function") {
      const safeJob = {
        ...job,
        command: job.command,
        payload: this.sanitizePayload(job.payload),
        run: undefined,
        _deferred: undefined,
        done: undefined,
      };
      writer(safeJob).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        LogManager.addEvent(
          "command",
          "error",
          `Komut dosyası yazılamadı: ${message}`,
        );
      });
    }
  }

  list() {
    return [...this.queue];
  }

  clearQueue() {
    this.queue = [];
    this.processing = false;
    LogManager.addEvent("command", "info", "Komut kuyruğu temizlendi");
  }

  // Eski API sarmalayıcısı (priority parametresi artık kullanılmıyor; FIFO devam ediyor)
  CommandManagerEnqueue(
    target,
    command,
    _mode = "default",
    payload = {},
    /** @type {Function | null | undefined} */
    executor = null,
    _priority = "normal",
  ) {
    const [job] = this.enqueue([
      {
        provider: target,
        command,
        message: payload.message || "",
        payload,
        run: executor || undefined,
      },
    ]);
    return job;
  }
}

export const CommandManager = new CommandManagerClass();
