// @ts-nocheck
// Arşiv sayfası controller'ı (`archives/index.json` okuma/yazma işlemleri)
import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { ConversationListManager } from "../modules/conversation-list-manager.js";
import { AppState } from "../modules/app-state.js";

export class ArchivesController {
  constructor() {
    this.entries = [];
    this.activeProvider = "ai1";
    this.selectedId = null;
    this.settings = null;
  }

  async init() {
    await this.loadSettings();
    this.cacheElements();
    this.bindEvents();
    await this.loadIndex();
    this.applyNames();

    // Realtime settings sync
    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe((s) => {
        this.settings = s;
        this.applyNames();
      });
    }
  }

  cacheElements() {
    this.listEl = document.getElementById("archives-list");
    this.titleEl = document.getElementById("archive-title");
    this.summaryEl = document.getElementById("archive-summary");
    this.webUrlEl = document.getElementById("archive-weburl");
    this.statusEl = document.getElementById("archive-status");
  }

  bindEvents() {
    document.getElementsByName("archives-provider").forEach((el) => {
      el.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.clearStatus();
          this.activeProvider = e.target.value;
          this.selectedId = null;
          this.renderList();
          this.fillForm(null);
        }
      });
    });

    document.getElementById("archive-save")?.addEventListener("click", () => {
      this.saveSelected();
    });
  }

  async loadSettings() {
    try {
      this.settings = await SettingsManager.load();
    } catch {
      this.settings = null;
    }
  }

  async loadIndex() {
    try {
      const raw = await window.electronAPI?.readArchivesIndex?.();
      this.entries = Array.isArray(raw) ? raw : [];
      this.renderList();
    } catch (err) {
      console.error("Arşiv okunamadı:", err);
      this.entries = [];
    }
  }

  renderList() {
    if (!this.listEl) return;
    const items = this.entries.filter(
      (e) => e.provider === this.activeProvider,
    );
    this.listEl.innerHTML = "";
    if (!items.length) {
      const div = document.createElement("div");
      div.className = "empty";
      div.textContent = "Kayıt yok";
      this.listEl.appendChild(div);
      return;
    }
    items.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "archive-item";
      const titleWrap = document.createElement("div");
      titleWrap.className = "archive-title";
      titleWrap.textContent = entry.title || entry.id || "Başlıksız";
      titleWrap.style.flex = "1";
      titleWrap.addEventListener("click", () => {
        if (this.selectedId !== entry.id) {
          this.clearStatus();
        }
        this.selectedId = entry.id;
        this.renderList();
        this.fillForm(entry);
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "archive-remove";
      removeBtn.title = "Sohbeti Sil";
      removeBtn.innerHTML = "×";
      removeBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await this.deleteEntry(entry);
      });

      if (entry.id === this.selectedId) {
        item.classList.add("selected");
      }
      item.appendChild(titleWrap);
      item.appendChild(removeBtn);
      this.listEl.appendChild(item);
    });
  }

  async deleteEntry(entry) {
    if (!entry) return;
    // Confirm
    if (
      !confirm(
        `'${entry.title || entry.id}' kaydını kalıcı olarak silmek istediğinize emin misiniz?`,
      )
    ) {
      return;
    }

    try {
      const folder = entry.folder || entry.path || "";
      if (folder && window.electronAPI?.removeArchive) {
        await window.electronAPI.removeArchive(folder);
      }

      this.entries = this.entries.filter((e) => e.id !== entry.id);
      const ok = await window.electronAPI?.writeArchivesIndex?.(this.entries);
      if (!ok) {
        this.setStatus("Arşiv güncellenemedi", "error");
        return;
      }

      LogManager.addEvent("archives", "info", `Sohbet silindi: ${entry.id}`);

      const isActive = this.selectedId === entry.id;
      if (isActive) {
        this.selectedId = null;
      }

      this.renderList();
      await ConversationListManager.refresh({ silent: true });

      // If active was deleted, ensure UI shows 'new' selection
      if (isActive) {
        this.fillForm(null);
        this.setStatus("Sohbet silindi, yeni sohbet seçildi", "success");
      } else {
        this.setStatus("Sohbet silindi", "success");
      }
    } catch (err) {
      console.error("Error deleting entry:", err);
      this.setStatus("Sohbet silinirken hata oluştu", "error");
    }
  }

  fillForm(entry) {
    this.titleEl.value = entry?.title || "";
    this.summaryEl.value = entry?.summary || "";
    this.webUrlEl.value = entry?.webUrl || "";
  }

  async saveSelected() {
    if (!this.selectedId) {
      this.setStatus("Sohbet seçilmedi", "warning");
      return;
    }
    const idx = this.entries.findIndex((e) => e.id === this.selectedId);
    if (idx === -1) {
      this.setStatus("Kayıt bulunamadı", "error");
      return;
    }
    const entry = this.entries[idx];
    entry.title = this.titleEl.value || entry.title;
    entry.summary = this.summaryEl.value || entry.summary;
    entry.webUrl = this.webUrlEl.value || entry.webUrl;
    delete entry.category;
    entry.updatedAt = Date.now();

    try {
      const ok = await window.electronAPI?.writeArchivesIndex?.(this.entries);
      if (ok) {
        this.setStatus("Kaydedildi", "success");
        LogManager.addEvent("archives", "success", "Arşiv güncellendi");
        await ConversationListManager.refresh({ silent: true });
        await this.loadIndex();
      } else {
        this.setStatus("Kaydedilemedi", "error");
      }
    } catch (err) {
      console.error("Kaydetme hatası:", err);
      this.setStatus("Kaydedilemedi", "error");
    }
  }

  setStatus(text, type = "info") {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.className = `form-hint ${type}`;
  }

  clearStatus() {
    if (!this.statusEl) return;
    this.statusEl.textContent = "";
    this.statusEl.className = "form-hint";
  }

  applyNames() {
    const ai1Name = AppState.getNickname("ai1");
    const ai2Name = AppState.getNickname("ai2");
    const labelAi1 = document.getElementById("archives-provider-ai1");
    const labelAi2 = document.getElementById("archives-provider-ai2");
    if (labelAi1) labelAi1.textContent = ai1Name;
    if (labelAi2) labelAi2.textContent = ai2Name;
  }

  onShow() {
    this.loadSettings().then(() => this.applyNames());
    this.loadIndex();
    this.clearStatus();
  }

  onHide() {
    this.clearStatus();
    try {
      this._unsubSettings?.();
      this._unsubSettings = null;
    } catch (_) {
      void 0;
    }
  }
}
