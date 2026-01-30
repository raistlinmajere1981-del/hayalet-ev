import { CoreEngine } from "../modules/core-engine.js";
import { AppState } from "../modules/app-state.js";
import { SettingsManager } from "../modules/settings-manager.js";

interface WhisperRecord {
  user: string;
  text: string;
  when?: number;
  done?: boolean;
  doneAt?: number;
  id?: string;
}
export class WhisperController {
  pendingAi1: HTMLElement | null = null;
  pendingAi2: HTMLElement | null = null;
  doneAi1: HTMLElement | null = null;
  doneAi2: HTMLElement | null = null;
  nameAi1: HTMLElement | null = null;
  nameAi2: HTMLElement | null = null;
  _unsubAppState: (() => void) | null = null;
  _unsubSettings: (() => void) | null = null;
  updateHandler: (() => void) | null = null;

  async init() {
    await CoreEngine.init();
    this.pendingAi1 = document.getElementById("whisper-pending-ai1");
    this.pendingAi2 = document.getElementById("whisper-pending-ai2");
    this.doneAi1 = document.getElementById("whisper-done-ai1");
    this.doneAi2 = document.getElementById("whisper-done-ai2");
    this.nameAi1 = document.getElementById("whisper-name-ai1");
    this.nameAi2 = document.getElementById("whisper-name-ai2");
    
    this.updateNames();

    this._unsubAppState = AppState.subscribe(() => {
      this.updateNames();
    });

    this._unsubSettings = SettingsManager.subscribe(() => {
      this.updateNames();
    });

    this.updateHandler = () => this.render();
    window.addEventListener("whisper-updated", this.updateHandler);
    await this.render();
  }

  updateNames() {
    const settings = SettingsManager.getSnapshot();
    const ai1Assigned = !!settings?.slots?.ai1?.accountId;
    const ai2Assigned = !!settings?.slots?.ai2?.accountId;

    if (this.nameAi1) {
      this.nameAi1.textContent = ai1Assigned ? AppState.getNickname("ai1") : "AI1";
    }
    if (this.nameAi2) {
      this.nameAi2.textContent = ai2Assigned ? AppState.getNickname("ai2") : "AI2";
    }

    if (this.pendingAi1) this.pendingAi1.style.opacity = ai1Assigned ? "1" : "0.5";
    if (this.pendingAi2) this.pendingAi2.style.opacity = ai2Assigned ? "1" : "0.5";
    if (this.doneAi1) this.doneAi1.style.opacity = ai1Assigned ? "1" : "0.5";
    if (this.doneAi2) this.doneAi2.style.opacity = ai2Assigned ? "1" : "0.5";
  }

  async render() {
    const pendingAi1Raw = await CoreEngine.whisper("list", { user: "ai1" });
    const pendingAi2Raw = await CoreEngine.whisper("list", { user: "ai2" });
    const doneAi1Raw = await CoreEngine.whisper("done", { user: "ai1" });
    const doneAi2Raw = await CoreEngine.whisper("done", { user: "ai2" });
    
    const pendingAi1 = Array.isArray(pendingAi1Raw) ? pendingAi1Raw : [];
    const pendingAi2 = Array.isArray(pendingAi2Raw) ? pendingAi2Raw : [];
    const doneAi1 = Array.isArray(doneAi1Raw) ? doneAi1Raw : [];
    const doneAi2 = Array.isArray(doneAi2Raw) ? doneAi2Raw : [];
    
    this.fillList(this.pendingAi1, pendingAi1, "ai1");
    this.fillList(this.pendingAi2, pendingAi2, "ai2");
    this.fillList(this.doneAi1, doneAi1);
    this.fillList(this.doneAi2, doneAi2);
  }

  fillList(container: HTMLElement | null, items: WhisperRecord[], provider = "") {
    if (!container) return;
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "whisper-empty";
      empty.textContent = "Kayıt yok";
      container.appendChild(empty);
      return;
    }
    items
      .slice()
      .sort((a, b) => (a.when || a.doneAt || 0) - (b.when || b.doneAt || 0))
      .forEach((rec) => {
        const row = document.createElement("div");
        row.className = "whisper-row";
        const text = document.createElement("div");
        text.className = "whisper-text";
        const stamp = this.formatDate(rec.doneAt || rec.when);
        text.textContent = `${stamp} - ${rec.text}`;
        row.appendChild(text);
        if (provider) {
          const del = document.createElement("button");
          del.className = "whisper-remove";
          del.textContent = "×";
          del.title = "Sil";
          del.addEventListener("click", async () => {
            await CoreEngine.whisper("remove", { user: provider, id: rec.id });
          });
          row.appendChild(del);
        }
        container.appendChild(row);
      });
  }

  async onShow() {
    await this.render();
  }

  onHide() {
  }

  formatDate(ts: number | undefined) {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("tr-TR");
  }

}
