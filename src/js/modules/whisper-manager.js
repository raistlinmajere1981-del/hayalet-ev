import { LogManager } from "./log-manager.js";

const PROVIDERS = ["ai1", "ai2"];

function resolveProvider(name = "", settings = {}) {
  const lowered = name.toLowerCase();
  
  const getAccountNickname = (slot) => {
    const accountId = settings.slots?.[slot]?.accountId;
    if (!accountId) return "";
    const account = settings.accounts?.find(acc => acc.id === accountId);
    return (account?.nickname || "").toLowerCase();
  };
  
  const nick1 = getAccountNickname("ai1");
  const nick2 = getAccountNickname("ai2");

  if (lowered === "ai1" || (nick1 && lowered === nick1)) return "ai1";
  if (lowered === "ai2" || (nick2 && lowered === nick2)) return "ai2";

  return PROVIDERS.includes(lowered) ? lowered : "ai1";
}

class WhisperManagerClass {
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

  async init(options = {}) {
    this.settings = options.settings || {};
    if (typeof options.sender === "function") {
      this.sender = options.sender;
    }
    await this.loadAll();
    if (!this.timer) {
      this.timer = setInterval(() => this.WhisperManagerCheck(), 60 * 1000);
    }
  }

  setSender(fn) {
    this.sender = fn;
  }

  async loadAll() {
    for (const p of PROVIDERS) {
      this.data[p] = await this.loadProvider(p);
    }
  }

  async loadProvider(provider) {
    try {
      const res = await window.electronAPI?.whisperLoad?.(provider);
      if (res && typeof res === "object") {
        return {
          pending: Array.isArray(res.pending)
            ? res.pending.map((r) => ({ ...r, queued: false }))
            : [],
          done: Array.isArray(res.done) ? res.done : [],
        };
      }
    } catch (err) {
      const error = /** @type {Error} */ (err);
      LogManager.addEvent(
        "whisper",
        "warning",
        `Whisper yüklenemedi (${provider}): ${error.message}`,
      );
    }
    return { pending: [], done: [] };
  }

  async saveProvider(provider) {
    try {
      await window.electronAPI?.whisperSave?.(provider, this.data[provider]);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      LogManager.addEvent(
        "whisper",
        "error",
        `Whisper kaydedilemedi (${provider}): ${error.message}`,
      );
    }
  }

  WhisperManagerAdd(userName, text, when) {
    const provider = resolveProvider(userName, this.settings);
    const whenTs = this.parseWhen(when);
    const rec = {
      id: `whisper-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      user: provider,
      text,
      when: whenTs,
      createdAt: Date.now(),
      done: false,
      queued: false,
    };
    this.data[provider].pending.push(rec);
    this.sortPending(provider);
    this.saveProvider(provider);
    LogManager.addEvent("whisper", "info", `Whisper eklendi (${provider})`);
    this.notify();
    return rec;
  }

  WhisperManagerDone(userName, whisperId) {
    const provider = resolveProvider(userName, this.settings);
    const idx = this.data[provider].pending.findIndex(
      (r) => r.id === whisperId,
    );
    if (idx === -1) return false;
    const rec = this.data[provider].pending.splice(idx, 1)[0];
    this.data[provider].done.push({ ...rec, done: true, doneAt: Date.now() });
    this.saveProvider(provider);
    LogManager.addEvent(
      "whisper",
      "success",
      `Whisper tamamlandı (${provider})`,
    );
    this.notify();
    return true;
  }

  WhisperManagerDelete(userName, whisperId) {
    const provider = resolveProvider(userName, this.settings);
    const before = this.data[provider].pending.length;
    this.data[provider].pending = this.data[provider].pending.filter(
      (r) => r.id !== whisperId,
    );
    if (before !== this.data[provider].pending.length) {
      this.saveProvider(provider);
      LogManager.addEvent("whisper", "info", `Whisper silindi (${provider})`);
      this.notify();
      return true;
    }
    return false;
  }

  WhisperManagerClear(userName) {
    const provider = resolveProvider(userName, this.settings);
    this.data[provider].pending = [];
    this.saveProvider(provider);
    LogManager.addEvent(
      "whisper",
      "info",
      `Whisper kayıtları temizlendi (${provider})`,
    );
    this.notify();
    return true;
  }

  WhisperManagerCheck() {
    if (this.paused) return false;
    const now = Date.now();
    PROVIDERS.forEach((provider) => {
      const due = this.data[provider].pending.filter(
        (r) => r.when <= now && !r.queued,
      );
      if (!due.length) return;
      due.forEach(async (rec) => {
        const msg = `Zamanlı Fısıltı Kaydı: ${rec.text}`;
        let sent = false;
        this.markQueued(provider, rec.id);
        if (typeof this.sender === "function") {
          try {
            const res = await this.sender({
              provider,
              record: rec,
              message: msg,
            });
            sent = !!res?.success;
            if (!sent) {
              this.markReady(provider, rec.id);
            }
          } catch (err) {
            const error = /** @type {Error} */ (err);
            LogManager.addEvent(
              "whisper",
              "error",
              `Whisper gönderilemedi (${provider}): ${error.message}`,
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

  getRecords(provider) {
    const p = resolveProvider(provider, this.settings);
    return [...(this.data[p]?.pending || [])];
  }

  getDoneRecords(provider) {
    const p = resolveProvider(provider, this.settings);
    return [...(this.data[p]?.done || [])];
  }

  parseWhen(raw) {
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

  sortPending(provider) {
    this.data[provider].pending.sort((a, b) => (a.when || 0) - (b.when || 0));
  }

  markQueued(provider, whisperId) {
    const rec = (this.data[provider]?.pending || []).find(
      (r) => r.id === whisperId,
    );
    if (rec) {
      rec.queued = true;
      rec.queuedAt = Date.now();
      this.saveProvider(provider);
    }
  }

  markReady(provider, whisperId) {
    const rec = (this.data[provider]?.pending || []).find(
      (r) => r.id === whisperId,
    );
    if (rec) {
      rec.queued = false;
      this.saveProvider(provider);
    }
  }

  catch() {
    const now = Date.now();
    const due = [];
    PROVIDERS.forEach((provider) => {
      const list = (this.data[provider]?.pending || []).filter(
        (r) => !r.queued && (r.when || 0) <= now,
      );
      due.push(...list.map((r) => ({ ...r, provider })));
    });
    return due;
  }

  pause() {
    this.paused = true;
  }

  resume(runCheck = false) {
    this.paused = false;
    if (runCheck) {
      this.WhisperManagerCheck();
    }
  }

  notify() {
    try {
      window.dispatchEvent(new CustomEvent("whisper-updated"));
    } catch (e) {
    }
  }
}

export const WhisperManager = new WhisperManagerClass();
