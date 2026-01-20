import { generateUniqueId } from "../constants/index.js";
import { LogManager } from "./log-manager.js";
import { getErrorMessage } from "../types/index.js";

/** Attachment dosya bilgisi */
interface CommandAttachment {
  path: string;
  name?: string;
  type?: string;
  size?: number;
}

/** Command meta bilgileri */
interface CommandMeta {
  source?: string;
  priority?: number;
  retryCount?: number;
  [key: string]: unknown;
}

/** Deferred promise yapısı */
interface DeferredPromise<T = unknown> {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  promise: Promise<T>;
}

/** Command job result */
interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

interface CommandJob {
  id: string;
  provider: string;
  target?: string;
  command: string;
  message: string;
  attachments: CommandAttachment[];
  sessionId: string | null;
  meta: CommandMeta;
  payload: Record<string, unknown>;
  createdAt: number;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  run: (() => Promise<CommandResult>) | null;
  _deferred: DeferredPromise<CommandResult> | null;
  done: Promise<CommandResult> | null;
  result?: CommandResult;
}

/** Event listener tipi - esnek payload */
 
type CommandEventListener = (payload: any) => void;

class CommandManagerClass {
  queue: CommandJob[];
  processing: boolean;
  executor: ((job: CommandJob) => Promise<CommandResult>) | null;
  listeners: Record<string, CommandEventListener[]>;

  constructor() {
    this.queue = [];
    this.processing = false;
    this.executor = null;
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

  setExecutor(fn: ((job: CommandJob) => Promise<CommandResult>) | null) {
    this.executor = typeof fn === "function" ? fn : null;
  }

  on(event: string, listener: CommandEventListener) {
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

  emit(event: string, payload: CommandJob | CommandResult | unknown) {
    (this.listeners[event] || []).forEach((l) => {
      try {
        l(payload);
      } catch (err) {
        LogManager.addEvent("command", "warning", `Listener error: ${getErrorMessage(err)}`);
      }
    });
  }

  defer(): DeferredPromise<CommandResult> {
    let resolve: ((value: CommandResult) => void) | undefined;
    let reject: ((reason?: unknown) => void) | undefined;
    const promise = new Promise<CommandResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
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
      const cleaned: Record<string, any> = {};
      Object.entries(rest || {}).forEach(([key, value]) => {
        if (typeof value === "function") return;
        try {
          cleaned[key] = JSON.parse(JSON.stringify(value));
        } catch (e) {
        }
      });
      return cleaned;
    }
  }

  enqueue(items: Partial<CommandJob>[] = []) {
    const list = Array.isArray(items) ? items : [items];
    const jobs = list.map((item) => this.addJob(item));
    this.processNext();
    return jobs;
  }

  /**
   * @param {any} [item={}]
   * @returns {CommandJob}
   */
  addJob(item: Partial<CommandJob> & { target?: string } = {}) {
    const deferred = this.defer();
    const payloadObj = (item.payload || {}) as Record<string, unknown>;
    const metaObj = (item.meta || {}) as CommandMeta;
    const job: CommandJob = {
      id: item.id || generateUniqueId("cmd"),
      provider: item.provider || item.target || "default",
      command: String(item.command || payloadObj.command || metaObj.command || ""),
      message: String(item.message || payloadObj.message || item.command || ""),
      attachments: item.attachments || [],
      sessionId: item.sessionId || null,
      meta: metaObj,
      payload: this.sanitizePayload(payloadObj),
      createdAt: Date.now(),
      status: "queued" as const,
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
        job.result = { success: true, message: "No executor" };
        job.status = "sent";
        this.emit("sent", { job, result: job.result });
      }
      this.markDone(job.id);
      job._deferred?.resolve(job.result);
    } catch (err) {
      job.status = "failed";
      this.emit("failed", { job, error: err });
      const message = err instanceof Error ? err.message : "unknown error";
      this.markFailed(job.id, message);
      job._deferred?.reject(err);
    } finally {
      this._cleanupJobReferences(job);
      
      this.processing = false;
      if (this.queue.length) {
        this.processNext();
      }
    }
  }

  _cleanupJobReferences(job: CommandJob | null) {
    if (!job) return;
    job._deferred = null;
    job.done = null;
    job.run = null;
  }

  markDone(id: string) {
    const mover = window.electronAPI?.commandMove;
    if (typeof mover === "function") {
      mover(id, "done").catch?.(() => {
      });
    }
    LogManager.addEvent("command", "info", `Komut tamamlandı (${id})`);
    return true;
  }

  markFailed(id: string, reason = "") {
    const mover = window.electronAPI?.commandMove;
    if (typeof mover === "function") {
      mover(id, "failed").catch?.(() => {
      });
    }
    LogManager.addEvent("command", "error", `Komut hatası (${id}): ${reason}`);
    return false;
  }

  persist(job: CommandJob) {
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
    LogManager.addEvent("command", "info", "Komut kuyruğu temizlendi", { visibility: 2 });
  }

  CommandManagerEnqueue(
    target: string,
    command: string,
    _mode = "default",
    payload: Record<string, any> = {},
    executor: (() => Promise<any>) | null = null,
    _priority = "normal",
  ) {
    const [job] = this.enqueue([
      {
        provider: target,
        command,
        message: (payload as any).message || "",
        payload,
        run: executor || undefined,
      } as any,
    ]);
    return job;
  }
}

export const CommandManager = new CommandManagerClass();
