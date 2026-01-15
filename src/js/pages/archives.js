import { LogManager } from "../modules/log-manager.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { ConversationListManager } from "../modules/conversation-list-manager.js";
import { AppState } from "../modules/app-state.js";

export class ArchivesController {
  constructor() {
    this.entries = [];
    this.activeProvider = "ai1";
    this.selectedId = null;
    this.searchQuery = "";
    this.searchScope = "current";
    this.searchResults = { messages: [], attachments: [] };
    this.activeTab = "messages";
    this._searchTimeout = null;
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
    // Liste
    this.listEl = document.getElementById("archives-list");
    
    // Detay formu
    this.titleEl = document.getElementById("archive-title");
    this.summaryEl = document.getElementById("archive-summary");
    this.webUrlDisplayEl = document.getElementById("archive-weburl-display");
    this.statusEl = document.getElementById("archive-status");
    this.messageCountEl = document.getElementById("message-count");
    this.detailEmptyEl = document.getElementById("detail-empty");
    this.conversationFormEl = document.getElementById("conversation-form");
    
    // Arama
    this.searchInputEl = document.getElementById("search-input");
    this.clearSearchBtn = document.getElementById("btn-clear-search");
    this.searchEmptyEl = document.getElementById("search-empty");
    this.messagesCountEl = document.getElementById("messages-count");
    this.filesCountEl = document.getElementById("files-count");
    this.resultsMessagesEl = document.getElementById("results-messages");
    this.resultsFilesEl = document.getElementById("results-files");
  }

  bindEvents() {
    // Provider toggle
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

    // Kaydet butonu
    document.getElementById("archive-save")?.addEventListener("click", (e) => {
      e.preventDefault();
      this.saveSelected();
    });

    // URL kopyala
    document.getElementById("btn-copy-url")?.addEventListener("click", () => {
      this.copyUrl();
    });

    // Sil butonu
    document.getElementById("btn-delete")?.addEventListener("click", () => {
      const entry = this.entries.find((e) => e.id === this.selectedId);
      if (entry) this.deleteEntry(entry);
    });

    // Arama input (debounced)
    this.searchInputEl?.addEventListener("input", (e) => {
      this.searchQuery = e.target.value;
      this.clearSearchBtn?.classList.toggle("hidden", !this.searchQuery);
      
      clearTimeout(this._searchTimeout);
      this._searchTimeout = setTimeout(() => {
        this.performSearch();
      }, 300);
    });

    // Arama temizle
    this.clearSearchBtn?.addEventListener("click", () => {
      this.searchInputEl.value = "";
      this.searchQuery = "";
      this.clearSearchBtn.classList.add("hidden");
      this.clearSearchResults();
    });

    // Arama scope toggle
    document.getElementsByName("search-scope").forEach((el) => {
      el.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.searchScope = e.target.value;
          if (this.searchQuery) this.performSearch();
        }
      });
    });

    // Tab buttons
    document.querySelectorAll(".search-tabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.switchTab(btn.dataset.tab);
      });
    });
  }

  async loadSettings() {
    try {
      await SettingsManager.load();
    } catch (error) {
      LogManager.addEvent("archives", "error", `Settings yükleme hatası: ${error.message}`);
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
      LogManager.addEvent("archives", "error", `Arşiv okunamadı: ${err.message}`);
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
      LogManager.addEvent("archives", "error", `Silme hatası: ${err.message}`);
      this.setStatus("Sohbet silinirken hata oluştu", "error");
    }
  }

  fillForm(entry) {
    // Form görünürlüğü
    if (entry) {
      this.detailEmptyEl?.classList.add("hidden");
      this.conversationFormEl?.classList.remove("hidden");
    } else {
      this.detailEmptyEl?.classList.remove("hidden");
      this.conversationFormEl?.classList.add("hidden");
    }

    // Form değerleri
    if (this.titleEl) this.titleEl.value = entry?.title || "";
    if (this.summaryEl) this.summaryEl.value = entry?.summary || "";
    if (this.webUrlDisplayEl) this.webUrlDisplayEl.textContent = entry?.webUrl || "-";
    if (this.messageCountEl) this.messageCountEl.textContent = entry?.messageCount || "0";
    
    // Seçili entry'yi sakla
    this._selectedEntry = entry;
  }

  copyUrl() {
    const url = this._selectedEntry?.webUrl;
    if (!url) return;
    
    navigator.clipboard.writeText(url).then(() => {
      this.setStatus("URL kopyalandı", "success");
      setTimeout(() => this.clearStatus(), 2000);
    }).catch(() => {
      this.setStatus("Kopyalama başarısız", "error");
    });
  }

  // ============================================
  // Arama Fonksiyonları
  // ============================================

  async performSearch() {
    if (!this.searchQuery || this.searchQuery.length < 2) {
      this.clearSearchResults();
      return;
    }

    try {
      let results;

      if (this.searchScope === "all") {
        // Tüm hesaplarda ara
        results = await window.electronAPI?.dbSearchAllAccounts?.({
          query: this.searchQuery,
          limit: 50,
        });
      } else {
        // Mevcut hesapta ara
        const accountInfo = AppState.getAccountForSlot(this.activeProvider);
        if (!accountInfo?.id) {
          this.searchResults = { messages: [], attachments: [] };
          this.renderSearchResults();
          return;
        }

        const [messages, attachments] = await Promise.all([
          window.electronAPI?.dbSearchMessages?.({
            accountId: accountInfo.id,
            query: this.searchQuery,
            limit: 50,
          }),
          window.electronAPI?.dbSearchAttachments?.({
            accountId: accountInfo.id,
            query: this.searchQuery,
            limit: 50,
          }),
        ]);

        results = {
          messages: (messages || []).map(m => ({ ...m, accountId: accountInfo.id })),
          attachments: (attachments || []).map(a => ({ ...a, accountId: accountInfo.id })),
        };
      }

      this.searchResults = results || { messages: [], attachments: [] };
      this.renderSearchResults();
    } catch (err) {
      LogManager.addEvent("archives", "error", `Arama hatası: ${err.message}`);
      this.searchResults = { messages: [], attachments: [] };
      this.renderSearchResults();
    }
  }

  renderSearchResults() {
    const { messages, attachments } = this.searchResults;
    
    // Sayaçları güncelle
    if (this.messagesCountEl) this.messagesCountEl.textContent = messages.length;
    if (this.filesCountEl) this.filesCountEl.textContent = attachments.length;

    // Empty state
    const hasResults = messages.length > 0 || attachments.length > 0;
    this.searchEmptyEl?.classList.toggle("hidden", hasResults || !this.searchQuery);

    // Mesaj sonuçları
    if (this.resultsMessagesEl) {
      if (messages.length === 0) {
        this.resultsMessagesEl.innerHTML = this.searchQuery 
          ? '<div class="no-results">Mesaj bulunamadı</div>' 
          : '';
      } else {
        this.resultsMessagesEl.innerHTML = messages.map(m => this.renderMessageResult(m)).join("");
      }

      // Event listeners
      this.resultsMessagesEl.querySelectorAll(".result-item").forEach((el, i) => {
        el.addEventListener("click", () => this.navigateToResult(messages[i], "message"));
      });
    }

    // Dosya sonuçları
    if (this.resultsFilesEl) {
      if (attachments.length === 0) {
        this.resultsFilesEl.innerHTML = this.searchQuery 
          ? '<div class="no-results">Dosya bulunamadı</div>' 
          : '';
      } else {
        this.resultsFilesEl.innerHTML = attachments.map(a => this.renderFileResult(a)).join("");
      }

      // Event listeners
      this.resultsFilesEl.querySelectorAll(".result-item").forEach((el, i) => {
        el.addEventListener("click", () => this.navigateToResult(attachments[i], "file"));
      });
    }
  }

  renderMessageResult(msg) {
    const snippet = this.highlightSnippet(msg.snippet || msg.content || "", this.searchQuery);
    const accountLabel = this.getAccountLabel(msg.accountId);
    
    return `
      <div class="result-item" data-conversation-id="${msg.conversationId}">
        <div class="result-item-header">
          <span class="result-item-title">${this.escapeHtml(msg.conversationTitle || "İsimsiz Sohbet")}</span>
          ${this.searchScope === "all" ? `<span class="result-item-account">${accountLabel}</span>` : ""}
        </div>
        <div class="result-item-snippet">${snippet}</div>
      </div>
    `;
  }

  renderFileResult(file) {
    const icon = this.getFileIcon(file.mimeType);
    const size = this.formatFileSize(file.size);
    const accountLabel = this.getAccountLabel(file.accountId);
    
    return `
      <div class="result-item" data-stored-path="${this.escapeHtml(file.storedPath || "")}">
        <div class="file-result">
          <span class="file-icon">${icon}</span>
          <div class="file-info">
            <div class="file-name">${this.escapeHtml(file.originalName)}</div>
            <div class="file-meta">
              ${this.escapeHtml(file.conversationTitle || "İsimsiz Sohbet")} · ${size}
              ${this.searchScope === "all" ? ` · ${accountLabel}` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async navigateToResult(result, type) {
    if (type === "file") {
      // Dosyayı aç
      if (result.storedPath) {
        try {
          await window.electronAPI?.openPath?.(result.storedPath);
        } catch (err) {
          this.setStatus("Dosya açılamadı", "error");
        }
      }
      return;
    }

    // Mesaj sonucu - ilgili sohbete git
    const { accountId, conversationId } = result;
    if (!accountId || !conversationId) return;

    // Provider'ı bul (accountId'den)
    const ai1Account = AppState.getAccountForSlot("ai1");
    const ai2Account = AppState.getAccountForSlot("ai2");
    
    let targetProvider = null;
    if (ai1Account?.id === accountId) {
      targetProvider = "ai1";
    } else if (ai2Account?.id === accountId) {
      targetProvider = "ai2";
    }

    if (!targetProvider) {
      this.setStatus("Hesap bulunamadı", "error");
      return;
    }

    // Provider'ı değiştir
    if (this.activeProvider !== targetProvider) {
      this.activeProvider = targetProvider;
      const radio = document.querySelector(`input[name="archives-provider"][value="${targetProvider}"]`);
      if (radio) radio.checked = true;
      await this.loadIndex();
    }

    // Sohbeti seç
    this.selectedId = conversationId;
    this.renderList();
    
    const entry = this.entries.find(e => e.id === conversationId);
    if (entry) {
      this.fillForm(entry);
      
      // Liste içinde scroll
      const item = this.listEl?.querySelector(`.archive-item.selected`);
      item?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  switchTab(tab) {
    this.activeTab = tab;
    
    // Tab butonlarını güncelle
    document.querySelectorAll(".search-tabs .tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    // Panel'leri güncelle
    this.resultsMessagesEl?.classList.toggle("active", tab === "messages");
    this.resultsFilesEl?.classList.toggle("active", tab === "files");
  }

  clearSearchResults() {
    this.searchResults = { messages: [], attachments: [] };
    if (this.messagesCountEl) this.messagesCountEl.textContent = "0";
    if (this.filesCountEl) this.filesCountEl.textContent = "0";
    if (this.resultsMessagesEl) this.resultsMessagesEl.innerHTML = "";
    if (this.resultsFilesEl) this.resultsFilesEl.innerHTML = "";
    this.searchEmptyEl?.classList.remove("hidden");
  }

  // ============================================
  // Yardımcı Fonksiyonlar
  // ============================================

  highlightSnippet(text, query) {
    if (!text || !query) return this.escapeHtml(text || "");
    
    const escaped = this.escapeHtml(text);
    const queryEscaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${queryEscaped})`, "gi");
    
    return escaped.replace(regex, "<mark>$1</mark>");
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  getAccountLabel(accountId) {
    if (!accountId) return "";
    // accountId: chatgpt_user_at_gmail_com → ChatGPT
    const provider = accountId.split("_")[0];
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  getFileIcon(mimeType) {
    if (!mimeType) return "📄";
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.startsWith("video/")) return "🎬";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType.includes("pdf")) return "📕";
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar")) return "📦";
    if (mimeType.includes("text") || mimeType.includes("json") || mimeType.includes("xml")) return "📝";
    return "📄";
  }

  formatFileSize(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
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
      LogManager.addEvent("archives", "error", `Kaydetme hatası: ${err.message}`);
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
