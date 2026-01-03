// @ts-nocheck
// Whisper odası controller'ı
import { CoreEngine } from "../modules/core-engine.js";
import { AppState } from "../modules/app-state.js";

export class WhisperController {
  async init() {
    await CoreEngine.init();
    this.pendingAi1 = document.getElementById("whisper-pending-ai1");
    this.pendingAi2 = document.getElementById("whisper-pending-ai2");
    this.doneAi1 = document.getElementById("whisper-done-ai1");
    this.doneAi2 = document.getElementById("whisper-done-ai2");
    this.nameAi1 = document.getElementById("whisper-name-ai1");
    this.nameAi2 = document.getElementById("whisper-name-ai2");
    this.nameAi1.textContent = AppState.getNickname("ai1");
    this.nameAi2.textContent = AppState.getNickname("ai2");

    // Realtime nickname sync via AppState
    this._unsubAppState = AppState.subscribe(() => {
      if (this.nameAi1) this.nameAi1.textContent = AppState.getNickname("ai1");
      if (this.nameAi2) this.nameAi2.textContent = AppState.getNickname("ai2");
    });
    this.updateHandler = () => this.render();
    window.addEventListener("whisper-updated", this.updateHandler);
    await this.render();
  }

  async render() {
    const pendingAi1 =
      (await CoreEngine.whisper("list", { user: "ai1" })) || [];
    const pendingAi2 =
      (await CoreEngine.whisper("list", { user: "ai2" })) || [];
    const doneAi1 = (await CoreEngine.whisper("done", { user: "ai1" })) || [];
    const doneAi2 = (await CoreEngine.whisper("done", { user: "ai2" })) || [];
    this.fillList(this.pendingAi1, pendingAi1, "ai1");
    this.fillList(this.pendingAi2, pendingAi2, "ai2");
    this.fillList(this.doneAi1, doneAi1);
    this.fillList(this.doneAi2, doneAi2);
  }

  fillList(container, items, provider = "") {
    if (!container) return;
    container.innerHTML = "";
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
    try {
      this._unsubAppState?.();
      this._unsubAppState = null;
    } catch (_) {
      void 0;
    }
  }

  formatDate(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("tr-TR");
  }

}
