import { generateUniqueId } from "../constants/index.js";
import { LogManager } from "./log-manager.js";
import { AppState } from "./app-state.js";

// ============================================================================
// Types
// ============================================================================

interface WhisperRecord {
  id: string;
  user: string;
  text: string;
  when: number;
  createdAt: number;
  done: boolean;
  queued: boolean;
  queuedAt?: number;
  doneAt?: number;
}

interface WhisperData {
  pending: WhisperRecord[];
  done: WhisperRecord[];
}

type SenderFn = (slot: string, text: string) => void | Promise<void>;

// ============================================================================
// Constants & Helpers
// ============================================================================

const PROVIDERS = ["ai1", "ai2"];

function resolveProvider(name = ""): string {
  const lowered = name.toLowerCase();
  
  const nick1 = AppState.getNickname("ai1").toLowerCase();
  const nick2 = AppState.getNickname("ai2").toLowerCase();

  if (lowered === "ai1" || (nick1 && lowered === nick1)) return "ai1";
  if (lowered === "ai2" || (nick2 && lowered === nick2)) return "ai2";

  return PROVIDERS.includes(lowered) ? lowered : "ai1";
}

// ============================================================================
// WhisperManagerClass
// ============================================================================

class WhisperManagerClass {
  data: Record<string, WhisperData>;
  timer: ReturnType<typeof setInterval> | null;
  sender: SenderFn | null;
  settings: Record<string, unknown>;
  paused: boolean;

  constructor() {
    this.data = {
      ai1: { pending: [], done: [] },
      ai2: { pending: [], done: [] },
    };
    this.timer = null;
    this.sender = null;
    this.settings = {};
    this.paused = false;
  }

  async init(options: { settings?: Record<string, unknown>; sender?: SenderFn } = {}): Promise<void> {
    this.settings = options.settings || {};
    if (typeof options.sender === "function") {
      this.sender = options.sender;
    }
    await this.loadAll();
    if (!this.timer) {
      this.timer = setInterval(() => this.WhisperManagerCheck(), 60 * 1000);
    }
  }

  setSender(fn: SenderFn): void {
    this.sender = fn;
  }

  async loadAll(): Promise<void> {
    for (const p of PROVIDERS) {
      this.data[p] = await this.loadProvider(p);
    }
  }

  async loadProvider(provider: string): Promise<WhisperData> {
    try {
      // Slot'tan hesap bilgisini al
      const accountInfo = AppState.getAccountForSlot(provider);
      if (!accountInfo?.id) {
        return { pending: [], done: [] };
      }
      
      const res = await window.electronAPI?.whisperLoad?.({ id: accountInfo.id } as { id: string });
      if (res && typeof res === "object") {
        return {
          pending: Array.isArray(res.pending)
            ? res.pending.map((r) => ({ ...r, queued: false }))
            : [],
          done: Array.isArray(res.done) ? res.done : [],
        };
      }
    } catch (e) {
      const err = e as Error;
      LogManager.addEvent(
        "whisper",
        "warning",
        `Whisper yüklenemedi (${provider}): ${err.message}`,
      );
    }
    return { pending: [], done: [] };
  }

  async saveProvider(provider: string): Promise<void> {
    try {
      // Slot'tan hesap bilgisini al
      const accountInfo = AppState.getAccountForSlot(provider);
      if (!accountInfo?.id) {
        return;
      }
      
      await window.electronAPI?.whisperSave?.(accountInfo.id, this.data[provider]);
    } catch (e) {
      const err = e as Error;
      LogManager.addEvent(
        "whisper",
        "error",
        `Whisper kaydedilemedi (${provider}): ${err.message}`,
      );
    }
  }

  WhisperManagerAdd(userName: string | undefined, text: string, when: unknown): WhisperRecord {
    const provider = resolveProvider(userName);
    const whenTs = this.parseWhen(when);
    const rec = {
      id: generateUniqueId("whisper"),
      user: provider,
      text,
      when: whenTs,
      createdAt: Date.now(),
      done: false,
      queued: false,
    };
    const data = this.data[provider];
    if (!data) return rec;
    data.pending.push(rec);
    this.sortPending(provider);
    this.saveProvider(provider);
    LogManager.addEvent("whisper", "info", `Whisper eklendi (${provider})`);
    this.notify();
    return rec;
  }

  WhisperManagerDone(userName: string | undefined, whisperId: string): boolean {
    const provider = resolveProvider(userName);
    const data = this.data[provider];
    if (!data) return false;
    const idx = data.pending.findIndex(
      (r) => r.id === whisperId,
    );
    if (idx === -1) return false;
    const rec = data.pending.splice(idx, 1)[0];
    if (!rec) return false;
    data.done.push({ ...rec, done: true, doneAt: Date.now() });
    this.saveProvider(provider);
    LogManager.addEvent(
      "whisper",
      "success",
      `Whisper tamamlandı (${provider})`,
    );
    this.notify();
    return true;
  }

  WhisperManagerDelete(userName: string | undefined, whisperId: string | undefined): boolean {
    const provider = resolveProvider(userName);
    const data = this.data[provider];
    if (!data) return false;
    const before = data.pending.length;
    data.pending = data.pending.filter(
      (r) => r.id !== whisperId,
    );
    if (before !== data.pending.length) {
      this.saveProvider(provider);
      LogManager.addEvent("whisper", "info", `Whisper silindi (${provider})`, { visibility: 1 });
      this.notify();
      return true;
    }
    return false;
  }

  WhisperManagerClear(userName: string | undefined): boolean {
    const provider = resolveProvider(userName);
    const data = this.data[provider];
    if (!data) return false;
    data.pending = [];
    this.saveProvider(provider);
    LogManager.addEvent(
      "whisper",
      "info",
      `Whisper kayıtları temizlendi (${provider})`,
    );
    this.notify();
    return true;
  }

  WhisperManagerCheck(): boolean {
    if (this.paused) return false;
    const now = Date.now();
    PROVIDERS.forEach((provider) => {
      const data = this.data[provider];
      const due = (data?.pending || []).filter(
        (r) => r.when <= now && !r.queued,
      );
      if (!due.length) return;
      due.forEach(async (rec) => {
        const msg = `Zamanlı Fısıltı Kaydı: ${rec.text}`;
        let sent = false;
        this.markQueued(provider, rec.id);
        if (typeof this.sender === "function") {
          try {
            await this.sender(provider, msg);
            sent = true;
            if (!sent) {
              this.markReady(provider, rec.id);
            }
          } catch (e) {
            const err = e as Error;
            LogManager.addEvent(
              "whisper",
              "error",
              `Whisper gönderilemedi (${provider}): ${err.message}`,
            );
            this.markReady(provider, rec.id);
          }
        } else {
          this.markReady(provider, rec.id);
        }
        if (sent) {
          this.WhisperManagerDone(provider, rec.id);
        }
      });
    });
    return true;
  }

  getRecords(provider: string | undefined): WhisperRecord[] {
    const p = resolveProvider(provider);
    return [...(this.data[p]?.pending || [])];
  }

  getDoneRecords(provider: string | undefined): WhisperRecord[] {
    const p = resolveProvider(provider);
    return [...(this.data[p]?.done || [])];
  }

  parseWhen(raw: unknown): number {
    if (!raw) return Date.now();
    if (raw instanceof Date) return raw.getTime();
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    const str = String(raw).trim();
    let parsed = Date.parse(str);
    if (!Number.isFinite(parsed)) {
      const m = str.match(
        /^(\d{1,2})[./](\d{1,2})[./](\d{4})[:\s](\d{1,2})[.:](\d{2})$/,
      );
      if (m) {
        const [, d, mo, y, h, min] = m;
        parsed = new Date(
          Number(y),
          Number(mo) - 1,
          Number(d),
          Number(h),
          Number(min),
        ).getTime();
      }
    }
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  sortPending(provider: string): void {
    const data = this.data[provider];
    if (data) data.pending.sort((a, b) => (a.when || 0) - (b.when || 0));
  }

  markQueued(provider: string, whisperId: string): void {
    const rec = (this.data[provider]?.pending || []).find(
      (r) => r.id === whisperId,
    );
    if (rec) {
      rec.queued = true;
      rec.queuedAt = Date.now();
      this.saveProvider(provider);
    }
  }

  markReady(provider: string, whisperId: string): void {
    const rec = (this.data[provider]?.pending || []).find(
      (r) => r.id === whisperId,
    );
    if (rec) {
      rec.queued = false;
      this.saveProvider(provider);
    }
  }

  catch(): (WhisperRecord & { provider: string })[] {
    const now = Date.now();
    const due: (WhisperRecord & { provider: string })[] = [];
    PROVIDERS.forEach((provider) => {
      const list = (this.data[provider]?.pending || []).filter(
        (r) => !r.queued && (r.when || 0) <= now,
      );
      due.push(...list.map((r) => ({ ...r, provider })));
    });
    return due;
  }

  pause(): void {
    this.paused = true;
  }

  resume(runCheck = false): void {
    this.paused = false;
    if (runCheck) {
      this.WhisperManagerCheck();
    }
  }

  notify(): void {
    try {
      window.dispatchEvent(new CustomEvent("whisper-updated"));
    } catch (_e) {
      // Ignore
    }
  }
}

export const WhisperManager = new WhisperManagerClass();
