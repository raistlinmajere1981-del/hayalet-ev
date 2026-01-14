import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { ConversationListManager } from "../modules/conversation-list-manager.js";
import { AppState } from "../modules/app-state.js";

export class ArchivesController {
  constructor() {
    this.entries = [];
    this.activeProvider = "ai1";
    this.selectedId = null;
  }

  async init() {
    await this.loadSettings();
    this.cacheElements();
    this.bindEvents();
    await this.loadIndex();
    this.applyNames();

    if (!this._unsubSettings) {
      this._unsubSettings = SettingsManager.subscribe(() => {
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
      await SettingsManager.load();
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  async loadIndex() {
    try {
      // Her slot için hesap bilgisini al ve DB'den konuşmaları çek
      const ai1Account = AppState.getAccountForSlot("ai1");
      const ai2Account = AppState.getAccountForSlot("ai2");

      const [ai1Entries, ai2Entries] = await Promise.all([
        ai1Account?.id ? window.electronAPI?.dbGetConversations?.({
          accountId: ai1Account.id,
        }) : [],
        ai2Account?.id ? window.electronAPI?.dbGetConversations?.({
          accountId: ai2Account.id,
        }) : [],
      ]);

      // Provider bilgisini slot olarak ekle (ai1/ai2)
      this.entries = [
        ...(ai1Entries || []).map(e => ({ ...e, provider: "ai1" })),
        ...(ai2Entries || []).map(e => ({ ...e, provider: "ai2" })),
      ];
      
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
    if (
      !confirm(
        `'${entry.title || entry.id}' kaydını kalıcı olarak silmek istediğinize emin misiniz?`,
      )
    ) {
      return;
    }

    try {
      // Slot'tan hesap bilgisini al
      const accountInfo = AppState.getAccountForSlot(entry.provider);
      if (!accountInfo?.id) {
        this.setStatus("Hesap bilgisi bulunamadı", "error");
        return;
      }

      // DB'den sil
      const result = await window.electronAPI?.dbDeleteConversation?.({
        accountId: accountInfo.id,
        conversationId: entry.id,
      });

      if (!result?.success) {
        this.setStatus(result?.error || "Sohbet silinemedi", "error");
        return;
      }

      LogManager.addEvent("archives", "info", `Sohbet silindi: ${entry.id}`);

      const isActive = this.selectedId === entry.id;
      if (isActive) {
        this.selectedId = null;
      }

      // Listeyi yenile
      await this.loadIndex();
      await ConversationListManager.refresh({ silent: true });

      if (isActive) {
        this.fillForm(null);
        this.setStatus("Sohbet silindi", "success");
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
    const entry = this.entries.find((e) => e.id === this.selectedId);
    if (!entry) {
      this.setStatus("Kayıt bulunamadı", "error");
      return;
    }

    // Slot'tan hesap bilgisini al
    const accountInfo = AppState.getAccountForSlot(entry.provider);
    if (!accountInfo?.id) {
      this.setStatus("Hesap bilgisi bulunamadı", "error");
      return;
    }

    const newTitle = this.titleEl.value || entry.title;
    const newSummary = this.summaryEl.value || entry.summary;

    try {
      // DB'de güncelle
      const result = await window.electronAPI?.dbUpdateConversation?.({
        accountId: accountInfo.id,
        conversationId: entry.id,
        title: newTitle,
        summary: newSummary,
      });

      if (result?.success) {
        this.setStatus("Kaydedildi", "success");
        LogManager.addEvent("archives", "success", "Arşiv güncellendi");
        await ConversationListManager.refresh({ silent: true });
        await this.loadIndex();
      } else {
        this.setStatus(result?.error || "Kaydedilemedi", "error");
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
    const settings = SettingsManager.getSnapshot();
    const ai1Assigned = !!settings?.slots?.ai1?.accountId;
    const ai2Assigned = !!settings?.slots?.ai2?.accountId;

    const ai1Name = ai1Assigned ? AppState.getNickname("ai1") : "AI1";
    const ai2Name = ai2Assigned ? AppState.getNickname("ai2") : "AI2";
    
    const labelAi1 = document.getElementById("archives-provider-ai1");
    const labelAi2 = document.getElementById("archives-provider-ai2");
    const radioAi1 = document.getElementById("archive-filter-ai1");
    const radioAi2 = document.getElementById("archive-filter-ai2");

    if (labelAi1) labelAi1.textContent = ai1Name;
    if (labelAi2) labelAi2.textContent = ai2Name;

    if (radioAi1) radioAi1.disabled = !ai1Assigned;
    if (radioAi2) radioAi2.disabled = !ai2Assigned;
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
