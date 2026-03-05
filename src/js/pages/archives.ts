import { Logger } from "../modules/logger/index.js";
import { LogCategory } from "@shared/logging-core";
import { SettingsManager } from "../modules/settings-manager.js";
import { ConversationListManager } from "../modules/conversation-list-manager.js";
import { AppState } from "../modules/app-state.js";
import { ButtonStates } from "../ui/button-states.js";

interface ArchiveEntry {
  id: string;
  title?: string;
  summary?: string;
  webUrl?: string;
  messageCount?: number;
  provider?: string;
}

interface MessageResult {
  conversationId: string;
  conversationTitle?: string;
  accountId?: string;
  snippet?: string;
  content?: string;
}

interface FileResult {
  storedPath?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  conversationTitle?: string;
  accountId?: string;
  conversationId?: string;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => {
    return item !== null && typeof item === "object";
  });
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function unwrapIpcData(value: unknown): unknown {
  const record = toRecord(value);
  if (record === null || !("data" in record)) {
    return value;
  }
  return record["data"];
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function mapMessageResult(record: Record<string, unknown>): MessageResult {
  const conversationId = readString(record, "conversationId", "conversation_id");
  const conversationTitle = readString(record, "conversationTitle", "conversation_title");
  const accountId = readString(record, "accountId", "account_id");
  const content = readString(record, "content");
  const snippetRaw = readString(record, "snippet");
  const snippet = snippetRaw !== "" ? snippetRaw : content;

  const mapped: MessageResult = { conversationId };
  if (conversationTitle !== "") {
    mapped.conversationTitle = conversationTitle;
  }
  if (accountId !== "") {
    mapped.accountId = accountId;
  }
  if (snippet !== "") {
    mapped.snippet = snippet;
  }
  if (content !== "") {
    mapped.content = content;
  }
  return mapped;
}

function mapFileResult(record: Record<string, unknown>): FileResult {
  const storedPath = readString(record, "storedPath", "stored_path");
  const originalName = readString(record, "originalName", "original_name");
  const mimeType = readString(record, "mimeType", "mime_type");
  const conversationTitle = readString(record, "conversationTitle", "conversation_title");
  const accountId = readString(record, "accountId", "account_id");
  const conversationId = readString(record, "conversationId", "conversation_id");
  const size = readNumber(record, "size");

  const mapped: FileResult = {};
  if (storedPath !== "") {
    mapped.storedPath = storedPath;
  }
  if (originalName !== "") {
    mapped.originalName = originalName;
  }
  if (mimeType !== "") {
    mapped.mimeType = mimeType;
  }
  if (size !== undefined) {
    mapped.size = size;
  }
  if (conversationTitle !== "") {
    mapped.conversationTitle = conversationTitle;
  }
  if (accountId !== "") {
    mapped.accountId = accountId;
  }
  if (conversationId !== "") {
    mapped.conversationId = conversationId;
  }
  return mapped;
}

export class ArchivesController {
  entries: ArchiveEntry[];
  activeProvider: string;
  selectedId: string | null;
  searchQuery: string;
  searchScope: string;
  searchResults: { messages: MessageResult[]; attachments: FileResult[] };
  activeTab: string;
  _searchTimeout: ReturnType<typeof setTimeout> | null;
  _unsubSettings: (() => void) | null;

  // Protocol editor state
  _protocols: Record<string, string>;
  _selectedProtocolKey: string | null;

  listEl: HTMLElement | null;
  titleEl: HTMLInputElement | null;
  summaryEl: HTMLTextAreaElement | null;
  webUrlDisplayEl: HTMLElement | null;
  statusEl: HTMLElement | null;
  messageCountEl: HTMLElement | null;
  detailEmptyEl: HTMLElement | null;
  conversationFormEl: HTMLElement | null;
  searchInputEl: HTMLInputElement | null;
  clearSearchBtn: HTMLElement | null;
  searchEmptyEl: HTMLElement | null;
  messagesCountEl: HTMLElement | null;
  filesCountEl: HTMLElement | null;
  resultsMessagesEl: HTMLElement | null;
  resultsFilesEl: HTMLElement | null;
  _selectedEntry: ArchiveEntry | null;

  // Protocol editor elements
  protocolListEl: HTMLElement | null;
  protocolEditorTitleEl: HTMLElement | null;
  protocolTextareaEl: HTMLTextAreaElement | null;
  protocolSaveBtn: HTMLElement | null;
  protocolEmptyEl: HTMLElement | null;
  protocolStatusEl: HTMLElement | null;
  protocolTagButtonsEl: HTMLElement | null;
  constructor() {
    this.entries = [];
    this.activeProvider = "ai1";
    this.selectedId = null;
    this.searchQuery = "";
    this.searchScope = "current";
    this.searchResults = { messages: [], attachments: [] };
    this.activeTab = "messages";
    this._searchTimeout = null;
    this._unsubSettings = null;

    this.listEl = null;
    this.titleEl = null;
    this.summaryEl = null;
    this.webUrlDisplayEl = null;
    this.statusEl = null;
    this.messageCountEl = null;
    this.detailEmptyEl = null;
    this.conversationFormEl = null;
    this.searchInputEl = null;
    this.clearSearchBtn = null;
    this.searchEmptyEl = null;
    this.messagesCountEl = null;
    this.filesCountEl = null;
    this.resultsMessagesEl = null;
    this.resultsFilesEl = null;
    this._selectedEntry = null;

    // Protocol editor
    this._protocols = {};
    this._selectedProtocolKey = null;
    this.protocolListEl = null;
    this.protocolEditorTitleEl = null;
    this.protocolTextareaEl = null;
    this.protocolSaveBtn = null;
    this.protocolEmptyEl = null;
    this.protocolStatusEl = null;
    this.protocolTagButtonsEl = null;
  }

  async init(): Promise<void> {
    await this.loadSettings();
    this.cacheElements();
    this.bindEvents();
    await this.loadIndex();
    await this.loadProtocols();
    this.applyNames();

    this._unsubSettings ??= SettingsManager.subscribe(
      ({ changedPaths }: { changedPaths: string[] }) => {
        const shouldApplyNames =
          changedPaths.includes("*") ||
          changedPaths.some(
            (path) =>
              path.startsWith("accounts") ||
              path.startsWith("asistanAccounts") ||
              path.startsWith("slots") ||
              path.startsWith("asistanSlot")
          );

        if (!shouldApplyNames) {
          return;
        }

        this.applyNames();
      }
    );
  }

  cacheElements(): void {
    this.listEl = document.getElementById("archives-list");

    this.titleEl = document.getElementById("archive-title") as HTMLInputElement | null;
    this.summaryEl = document.getElementById("archive-summary") as HTMLTextAreaElement | null;
    this.webUrlDisplayEl = document.getElementById("archive-weburl-display");
    this.statusEl = document.getElementById("archive-status");
    this.messageCountEl = document.getElementById("message-count");
    this.detailEmptyEl = document.getElementById("detail-empty");
    this.conversationFormEl = document.getElementById("conversation-form");

    this.searchInputEl = document.getElementById("search-input") as HTMLInputElement | null;
    this.clearSearchBtn = document.getElementById("btn-clear-search");
    this.searchEmptyEl = document.getElementById("search-empty");
    this.messagesCountEl = document.getElementById("messages-count");
    this.filesCountEl = document.getElementById("files-count");
    this.resultsMessagesEl = document.getElementById("results-messages");
    this.resultsFilesEl = document.getElementById("results-files");

    // Protocol editor elements
    this.protocolListEl = document.getElementById("protocol-list");
    this.protocolEditorTitleEl = document.getElementById("protocol-editor-title");
    this.protocolTextareaEl = document.getElementById(
      "protocol-textarea"
    ) as HTMLTextAreaElement | null;
    this.protocolSaveBtn = document.getElementById("btn-protocol-save");
    this.protocolEmptyEl = document.getElementById("protocol-empty");
    this.protocolStatusEl = document.getElementById("protocol-status");
    this.protocolTagButtonsEl = document.getElementById("protocol-tag-buttons");
  }

  bindEvents(): void {
    document.getElementsByName("archives-provider").forEach((el) => {
      el.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          this.clearStatus();
          this.activeProvider = target.value;
          this.selectedId = null;
          this.renderList();
          this.fillForm(null);
        }
      });
    });

    document.getElementById("archive-save")?.addEventListener("click", (e) => {
      e.preventDefault();
      void this.saveSelected();
    });

    document.getElementById("btn-copy-url")?.addEventListener("click", () => {
      this.copyUrl();
    });

    document.getElementById("btn-delete")?.addEventListener("click", () => {
      const entry = this.entries.find((e) => e.id === this.selectedId);
      if (entry) void this.deleteEntry(entry);
    });

    this.searchInputEl?.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.clearSearchBtn?.classList.toggle("hidden", this.searchQuery === "");

      if (this._searchTimeout) clearTimeout(this._searchTimeout);
      this._searchTimeout = setTimeout(() => {
        void this.performSearch();
      }, 300);
    });

    this.clearSearchBtn?.addEventListener("click", () => {
      if (this.searchInputEl) this.searchInputEl.value = "";
      this.searchQuery = "";
      this.clearSearchBtn?.classList.add("hidden");
      this.clearSearchResults();
    });

    document.getElementsByName("search-scope").forEach((el) => {
      el.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          this.searchScope = target.value;
          if (this.searchQuery !== "") void this.performSearch();
        }
      });
    });

    document.querySelectorAll(".search-tabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.switchTab((btn as HTMLElement).dataset["tab"] ?? "messages");
      });
    });

    // Protocol editor events
    this.protocolSaveBtn?.addEventListener("click", () => {
      void this.saveSelectedProtocol();
    });

    // Protocol tag buttons — insert tag at cursor position
    this.protocolTagButtonsEl?.querySelectorAll(".protocol-tag-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = (btn as HTMLElement).dataset["tag"];
        if (tag !== undefined && tag !== "" && this.protocolTextareaEl) {
          this.insertTagAtCursor(this.protocolTextareaEl, tag);
        }
      });
    });
  }

  async loadSettings(): Promise<void> {
    try {
      await SettingsManager.load();
    } catch (err) {
      const error = err as Error;
      Logger.error(LogCategory.ARCHIVES, `Settings yükleme hatası: ${error.message}`);
    }
  }

  async loadIndex(): Promise<void> {
    try {
      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        this.entries = [];
        this.renderList();
        return;
      }

      const ai1Account = AppState.getAccountForSlot("ai1");
      const ai2Account = AppState.getAccountForSlot("ai2");

      const resultsRaw: unknown = await Promise.all([
        ai1Account?.id !== undefined && ai1Account.id !== ""
          ? electronApi.dbGetConversations({ accountId: ai1Account.id })
          : { data: [] },
        ai2Account?.id !== undefined && ai2Account.id !== ""
          ? electronApi.dbGetConversations({ accountId: ai2Account.id })
          : { data: [] },
      ]);

      const results = resultsRaw as [unknown, unknown];
      const ai1Result = results[0] as { data?: unknown } | undefined;
      const ai2Result = results[1] as { data?: unknown } | undefined;

      const ai1Entries = Array.isArray(ai1Result?.data) ? (ai1Result.data as ArchiveEntry[]) : [];
      const ai2Entries = Array.isArray(ai2Result?.data) ? (ai2Result.data as ArchiveEntry[]) : [];

      this.entries = [
        ...ai1Entries.map((e) => ({ ...e, provider: "ai1" as const })),
        ...ai2Entries.map((e) => ({ ...e, provider: "ai2" as const })),
      ];

      this.renderList();
    } catch (e) {
      const err = e as Error;
      Logger.error(LogCategory.ARCHIVES, `Arşiv okunamadı: ${err.message}`);
      this.entries = [];
    }
  }

  renderList(): void {
    if (!this.listEl) return;
    const items = this.entries.filter((e) => e.provider === this.activeProvider);
    this.listEl.innerHTML = "";
    if (items.length === 0) {
      const div = document.createElement("div");
      div.className = "empty";
      div.textContent = "Kayıt yok";
      this.listEl.appendChild(div);
      return;
    }
    items.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "archive-item glass-panel";
      const titleWrap = document.createElement("div");
      titleWrap.className = "archive-title";
      titleWrap.textContent = entry.title ?? entry.id;
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
      removeBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        void this.deleteEntry(entry);
      });

      if (entry.id === this.selectedId) {
        item.classList.add("active");
      }
      item.appendChild(titleWrap);
      item.appendChild(removeBtn);
      this.listEl?.appendChild(item);
    });
  }

  async deleteEntry(entry: ArchiveEntry | null): Promise<void> {
    if (!entry) return;
    if (
      !confirm(
        `'${entry.title ?? entry.id}' kaydını kalıcı olarak silmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    const deleteBtn = document.getElementById("btn-delete") as HTMLButtonElement | null;

    try {
      if (deleteBtn) {
        ButtonStates.setLoading(deleteBtn, "Siliniyor...");
      }

      const accountInfo = AppState.getAccountForSlot(entry.provider ?? "");
      if (accountInfo?.id === undefined || accountInfo.id === "") {
        if (deleteBtn) {
          ButtonStates.setError(deleteBtn, "Hata!", 1500);
        }
        this.setStatus("Hesap bilgisi bulunamadı", "error");
        return;
      }

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        if (deleteBtn) {
          ButtonStates.setError(deleteBtn, "Hata!", 1500);
        }
        this.setStatus("Uygulama API bulunamadı", "error");
        return;
      }

      const resultRaw: unknown = await electronApi.dbDeleteConversation({
        accountId: accountInfo.id,
        conversationId: entry.id,
      });
      const result = resultRaw as { success?: boolean; error?: string } | undefined;

      if (result?.success !== true) {
        if (deleteBtn) {
          ButtonStates.setError(deleteBtn, "Hata!", 1500);
        }
        this.setStatus(result?.error ?? "Sohbet silinemedi", "error");
        return;
      }

      if (deleteBtn) {
        ButtonStates.setSuccess(deleteBtn, "Silindi!", 1500);
      }

      Logger.info(LogCategory.ARCHIVES, `Sohbet silindi: ${entry.id}`);

      const isActive = this.selectedId === entry.id;
      if (isActive) {
        this.selectedId = null;
      }

      await this.loadIndex();
      await ConversationListManager.refresh({ silent: true });

      if (isActive) {
        this.fillForm(null);
        this.setStatus("Sohbet silindi", "success");
      } else {
        this.setStatus("Sohbet silindi", "success");
      }
    } catch (e) {
      const err = e as Error;
      if (deleteBtn) {
        ButtonStates.setError(deleteBtn, "Hata!", 1500);
      }
      Logger.error(LogCategory.ARCHIVES, `Silme hatası: ${err.message}`);
      this.setStatus("Sohbet silinirken hata oluştu", "error");
    }
  }

  fillForm(entry: ArchiveEntry | null): void {
    if (entry) {
      this.detailEmptyEl?.classList.add("hidden");
      this.conversationFormEl?.classList.remove("hidden");
    } else {
      this.detailEmptyEl?.classList.remove("hidden");
      this.conversationFormEl?.classList.add("hidden");
    }

    if (this.titleEl) this.titleEl.value = entry?.title ?? "";
    if (this.summaryEl) this.summaryEl.value = entry?.summary ?? "";
    if (this.webUrlDisplayEl) this.webUrlDisplayEl.textContent = entry?.webUrl ?? "-";
    if (this.messageCountEl) this.messageCountEl.textContent = String(entry?.messageCount ?? 0);

    this._selectedEntry = entry;
  }

  copyUrl(): void {
    const url = this._selectedEntry?.webUrl;
    if (url === undefined || url === "") return;

    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.setStatus("URL kopyalandı", "success");
        setTimeout(() => {
          this.clearStatus();
        }, 2000);
      })
      .catch(() => {
        this.setStatus("Kopyalama başarısız", "error");
      });
  }

  async performSearch(): Promise<void> {
    if (this.searchQuery === "" || this.searchQuery.length < 2) {
      this.clearSearchResults();
      return;
    }

    try {
      let messages: MessageResult[] = [];
      let attachments: FileResult[] = [];

      if (this.searchScope === "all") {
        const resultsRaw = await window.electronAPI?.["dbSearchAllAccounts"]?.({
          query: this.searchQuery,
          limit: 50,
        });

        const allData = toRecord(unwrapIpcData(resultsRaw));
        const messageRows = toRecordArray(allData?.["messages"]);
        const attachmentRows = toRecordArray(allData?.["attachments"]);

        messages = messageRows.map((row) => mapMessageResult(row));
        attachments = attachmentRows.map((row) => mapFileResult(row));
      } else {
        const accountInfo = AppState.getAccountForSlot(this.activeProvider);
        if (accountInfo?.id === undefined || accountInfo.id === "") {
          this.searchResults = { messages: [], attachments: [] };
          this.renderSearchResults();
          return;
        }

        const dbSearchMessages = window.electronAPI?.dbSearchMessages;
        const dbSearchAttachments = window.electronAPI?.["dbSearchAttachments"];
        let messagesRaw: unknown;
        let attachmentsRaw: unknown;
        if (typeof dbSearchMessages === "function") {
          messagesRaw = await dbSearchMessages({
            accountId: accountInfo.id,
            query: this.searchQuery,
            limit: 50,
          });
        }
        if (typeof dbSearchAttachments === "function") {
          attachmentsRaw = await dbSearchAttachments({
            accountId: accountInfo.id,
            query: this.searchQuery,
            limit: 50,
          });
        }

        const messageRows = toRecordArray(unwrapIpcData(messagesRaw));
        const attachmentRows = toRecordArray(unwrapIpcData(attachmentsRaw));

        messages = messageRows.map((row) => {
          const mapped = mapMessageResult(row);
          return {
            ...mapped,
            accountId: mapped.accountId ?? accountInfo.id,
          };
        });
        attachments = attachmentRows.map((row) => {
          const mapped = mapFileResult(row);
          return {
            ...mapped,
            accountId: mapped.accountId ?? accountInfo.id,
          };
        });
      }

      this.searchResults = { messages, attachments };
      this.renderSearchResults();
    } catch (e) {
      const err = e as Error;
      Logger.error(LogCategory.ARCHIVES, `Arama hatası: ${err.message}`);
      this.searchResults = { messages: [], attachments: [] };
      this.renderSearchResults();
    }
  }

  renderSearchResults(): void {
    const { messages, attachments } = this.searchResults;

    if (this.messagesCountEl) this.messagesCountEl.textContent = String(messages.length);
    if (this.filesCountEl) this.filesCountEl.textContent = String(attachments.length);

    const hasResults = messages.length > 0 || attachments.length > 0;
    this.searchEmptyEl?.classList.toggle("hidden", hasResults || this.searchQuery === "");

    if (this.resultsMessagesEl) {
      if (messages.length === 0) {
        this.resultsMessagesEl.innerHTML =
          this.searchQuery !== "" ? '<div class="no-results">Mesaj bulunamadı</div>' : "";
      } else {
        this.resultsMessagesEl.innerHTML = messages
          .map((m) => this.renderMessageResult(m))
          .join("");
      }

      this.resultsMessagesEl.querySelectorAll(".result-item").forEach((el: Element, i: number) => {
        const message = messages[i];
        if (message) {
          el.addEventListener("click", () => {
            void this.navigateToResult(message, "message");
          });
        }
      });
    }

    if (this.resultsFilesEl) {
      if (attachments.length === 0) {
        this.resultsFilesEl.innerHTML =
          this.searchQuery !== "" ? '<div class="no-results">Dosya bulunamadı</div>' : "";
      } else {
        this.resultsFilesEl.innerHTML = attachments.map((a) => this.renderFileResult(a)).join("");
        this.resultsFilesEl.querySelectorAll(".result-item").forEach((el: Element, i: number) => {
          const attachment = attachments[i];
          if (attachment) {
            el.addEventListener("click", () => {
              void this.navigateToResult(attachment, "file");
            });
          }
        });
      }
    }
  }

  renderMessageResult(msg: MessageResult): string {
    const snippet = this.highlightSnippet(msg.snippet ?? msg.content ?? "", this.searchQuery);
    const accountLabel = this.getAccountLabel(msg.accountId);

    return `
      <div class="result-item glass-panel" data-conversation-id="${msg.conversationId}">
        <div class="result-item-header">
          <span class="result-item-title">${this.escapeHtml(msg.conversationTitle ?? "İsimsiz Sohbet")}</span>
          ${this.searchScope === "all" ? `<span class="result-item-account">${accountLabel}</span>` : ""}
        </div>
        <div class="result-item-snippet">${snippet}</div>
      </div>
    `;
  }

  renderFileResult(file: FileResult): string {
    const icon = this.getFileIcon(file.mimeType);
    const size = this.formatFileSize(file.size);
    const accountLabel = this.getAccountLabel(file.accountId ?? "");

    return `
      <div class="result-item glass-panel" data-stored-path="${this.escapeHtml(file.storedPath ?? "")}">
        <div class="file-result">
          <span class="file-icon">${icon}</span>
          <div class="file-info">
            <div class="file-name">${this.escapeHtml(file.originalName ?? "")}</div>
            <div class="file-meta">
              ${this.escapeHtml(file.conversationTitle ?? "İsimsiz Sohbet")} · ${size}
              ${this.searchScope === "all" ? ` · ${accountLabel}` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async navigateToResult(result: MessageResult | FileResult, type: string): Promise<void> {
    if (type === "file") {
      const fileResult = result as FileResult;
      if (fileResult.storedPath !== undefined && fileResult.storedPath !== "") {
        try {
          const electronApi = window.electronAPI;
          if (electronApi === undefined) {
            this.setStatus("Uygulama API bulunamadı", "error");
            return;
          }
          await electronApi.openPath(fileResult.storedPath);
        } catch (err) {
          this.setStatus("Dosya açılamadı", "error");
        }
      }
      return;
    }

    const { accountId, conversationId } = result;
    if (
      accountId === undefined ||
      accountId === "" ||
      conversationId === undefined ||
      conversationId === ""
    )
      return;

    const ai1Account = AppState.getAccountForSlot("ai1");
    const ai2Account = AppState.getAccountForSlot("ai2");

    let targetProvider = null;
    if (ai1Account?.id === accountId) {
      targetProvider = "ai1";
    } else if (ai2Account?.id === accountId) {
      targetProvider = "ai2";
    }

    if (targetProvider === null) {
      this.setStatus("Hesap bulunamadı", "error");
      return;
    }

    if (this.activeProvider !== targetProvider) {
      this.activeProvider = targetProvider;
      const radio = document.querySelector<HTMLInputElement>(
        `input[name="archives-provider"][value="${targetProvider}"]`
      );
      if (radio !== null) radio.checked = true;
      await this.loadIndex();
    }

    this.selectedId = conversationId;
    this.renderList();

    const entry = this.entries.find((e) => e.id === conversationId);
    if (entry) {
      this.fillForm(entry);

      const item = this.listEl?.querySelector(`.archive-item.selected`);
      item?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  switchTab(tab: string): void {
    this.activeTab = tab;

    document.querySelectorAll(".search-tabs .tab-btn").forEach((btn) => {
      btn.classList.toggle("active", (btn as HTMLElement).dataset["tab"] === tab);
    });

    this.resultsMessagesEl?.classList.toggle("active", tab === "messages");
    this.resultsFilesEl?.classList.toggle("active", tab === "files");
  }

  clearSearchResults(): void {
    this.searchResults = { messages: [], attachments: [] };
    if (this.messagesCountEl) this.messagesCountEl.textContent = "0";
    if (this.filesCountEl) this.filesCountEl.textContent = "0";
    if (this.resultsMessagesEl) this.resultsMessagesEl.innerHTML = "";
    if (this.resultsFilesEl) this.resultsFilesEl.innerHTML = "";
    this.searchEmptyEl?.classList.remove("hidden");
  }

  highlightSnippet(text: string, query: string): string {
    if (text === "" || query === "") return this.escapeHtml(text);

    const escaped = this.escapeHtml(text);
    const queryEscaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${queryEscaped})`, "gi");

    return escaped.replace(regex, "<mark>$1</mark>");
  }

  escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  getAccountLabel(accountId: string | undefined): string {
    if (accountId === undefined || accountId === "") return "";
    const provider = accountId.split("_")[0];
    if (provider === undefined || provider === "") return "";
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  getFileIcon(mimeType: string | undefined): string {
    if (mimeType === undefined || mimeType === "") return "📄";
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.startsWith("video/")) return "🎬";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType.includes("pdf")) return "📕";
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar"))
      return "📦";
    if (mimeType.includes("text") || mimeType.includes("json") || mimeType.includes("xml"))
      return "📝";
    return "📄";
  }

  formatFileSize(bytes: number | undefined): string {
    if (bytes === undefined || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i] ?? "B"}`;
  }

  async saveSelected(): Promise<void> {
    const saveBtn = document.getElementById("archive-save") as HTMLButtonElement | null;

    if (this.selectedId === null || this.selectedId === "") {
      this.setStatus("Sohbet seçilmedi", "warning");
      return;
    }
    const entry = this.entries.find((e) => e.id === this.selectedId);
    if (entry === undefined) {
      this.setStatus("Kayıt bulunamadı", "error");
      return;
    }

    const accountInfo = AppState.getAccountForSlot(entry.provider ?? "");
    if (accountInfo?.id === undefined || accountInfo.id === "") {
      this.setStatus("Hesap bilgisi bulunamadı", "error");
      return;
    }

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      this.setStatus("Uygulama API bulunamadı", "error");
      return;
    }

    if (saveBtn) {
      ButtonStates.setLoading(saveBtn, "Kaydediliyor...");
    }

    const newTitle = this.titleEl?.value ?? entry.title;
    const newSummary = this.summaryEl?.value ?? entry.summary;

    try {
      const resultRaw: unknown = await electronApi.dbUpdateConversation({
        accountId: accountInfo.id,
        conversationId: entry.id,
        title: newTitle,
        summary: newSummary,
      });
      const result = resultRaw as { success?: boolean; error?: string } | undefined;

      if (result?.success === true) {
        if (saveBtn) {
          ButtonStates.setSuccess(saveBtn, "Kaydedildi!", 1500);
        }
        this.setStatus("Kaydedildi", "success");
        Logger.info(LogCategory.ARCHIVES, "Arşiv güncellendi");
        await ConversationListManager.refresh({ silent: true });
        await this.loadIndex();
      } else {
        if (saveBtn) {
          ButtonStates.setError(saveBtn, "Hata!", 1500);
        }
        this.setStatus((result as { error?: string }).error ?? "Kaydedilemedi", "error");
      }
    } catch (e) {
      const err = e as Error;
      if (saveBtn) {
        ButtonStates.setError(saveBtn, "Hata!", 1500);
      }
      Logger.error(LogCategory.ARCHIVES, `Kaydetme hatası: ${err.message}`);
      this.setStatus("Kaydedilemedi", "error");
    }
  }

  setStatus(text: string, type = "info"): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.className = `form-hint ${type}`;
  }

  clearStatus(): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = "";
    this.statusEl.className = "form-hint";
  }

  applyNames(): void {
    const settings = SettingsManager.getSnapshot();
    const slots = settings.slots as Record<string, { accountId?: string }>;
    const ai1Assigned = slots["ai1"]?.accountId !== undefined && slots["ai1"].accountId !== "";
    const ai2Assigned = slots["ai2"]?.accountId !== undefined && slots["ai2"].accountId !== "";

    const ai1Name = ai1Assigned ? AppState.getNickname("ai1") : "AI1";
    const ai2Name = ai2Assigned ? AppState.getNickname("ai2") : "AI2";

    const labelAi1 = document.getElementById("archives-provider-ai1");
    const labelAi2 = document.getElementById("archives-provider-ai2");
    const radioAi1 = document.getElementById("archive-filter-ai1");
    const radioAi2 = document.getElementById("archive-filter-ai2");

    if (labelAi1) labelAi1.textContent = ai1Name;
    if (labelAi2) labelAi2.textContent = ai2Name;

    if (radioAi1) (radioAi1 as HTMLInputElement).disabled = !ai1Assigned;
    if (radioAi2) (radioAi2 as HTMLInputElement).disabled = !ai2Assigned;
  }

  onShow(): void {
    void this.loadSettings().then(() => {
      this.applyNames();
    });
    void this.loadIndex();
    void this.loadProtocols();
    this.clearStatus();
  }
  onHide(): void {
    this.clearStatus();
    // Faz 3: Cleanup search timeout to prevent memory leak
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
      this._searchTimeout = null;
    }
    try {
      this._unsubSettings?.();
      this._unsubSettings = null;
    } catch (_) {
      void 0;
    }
  }

  // ==========================================
  // Protocol Editor Methods
  // ==========================================

  /** Protokolleri JSON dosyasından yükle */
  async loadProtocols(): Promise<void> {
    try {
      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        this._protocols = {};
        this.renderProtocolList();
        return;
      }

      const result = await electronApi.loadProtocols();
      if (result.success === true && result.protocols !== undefined) {
        this._protocols = result.protocols;
      } else {
        this._protocols = {};
      }
      this.renderProtocolList();
    } catch (e) {
      const err = e as Error;
      Logger.error(LogCategory.ARCHIVES, `Protokoller yüklenemedi: ${err.message}`);
      this._protocols = {};
      this.renderProtocolList();
    }
  }

  /** Protokol listesini sidebar'da render et */
  renderProtocolList(): void {
    if (!this.protocolListEl) return;
    const protocolListEl = this.protocolListEl;

    const keys = Object.keys(this._protocols);
    if (keys.length === 0) {
      protocolListEl.innerHTML = '<div class="empty">Protokol bulunamadı</div>';
      return;
    }

    protocolListEl.innerHTML = "";
    keys.forEach((key) => {
      const item = document.createElement("div");
      item.className = "protocol-item";
      if (key === this._selectedProtocolKey) {
        item.classList.add("active");
      }

      const icon = document.createElement("span");
      icon.className = "protocol-item-icon";
      icon.textContent = "📄";

      const name = document.createElement("span");
      name.className = "protocol-item-name";
      name.textContent = key;

      item.appendChild(icon);
      item.appendChild(name);

      item.addEventListener("click", () => {
        this.selectProtocol(key);
      });

      protocolListEl.appendChild(item);
    });
  }

  /** Bir protokolü seç ve editöre yükle */
  selectProtocol(key: string): void {
    this._selectedProtocolKey = key;
    this.renderProtocolList();

    if (this.protocolEditorTitleEl) {
      this.protocolEditorTitleEl.textContent = key;
    }

    if (this.protocolTextareaEl) {
      this.protocolTextareaEl.value = this._protocols[key] ?? "";
      this.protocolTextareaEl.classList.remove("hidden");
    }

    this.protocolEmptyEl?.classList.add("hidden");
    this.protocolSaveBtn?.classList.remove("hidden");
    this.protocolTagButtonsEl?.classList.remove("hidden");
    this.setProtocolStatus("");
  }

  /** Seçili protokolü kaydet */
  async saveSelectedProtocol(): Promise<void> {
    if (this._selectedProtocolKey === null || this._selectedProtocolKey === "") {
      this.setProtocolStatus("Protokol seçilmedi", "warning");
      return;
    }

    const content = this.protocolTextareaEl?.value ?? "";
    const saveBtn = this.protocolSaveBtn as HTMLButtonElement | null;

    try {
      if (saveBtn) {
        ButtonStates.setLoading(saveBtn, "Kaydediliyor...");
      }

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        if (saveBtn) {
          ButtonStates.setError(saveBtn, "Hata!", 1500);
        }
        this.setProtocolStatus("Uygulama API bulunamadı", "error");
        return;
      }

      const result = await electronApi.saveProtocol(this._selectedProtocolKey, content);

      if (result.success === true) {
        this._protocols[this._selectedProtocolKey] = content;
        if (saveBtn) {
          ButtonStates.setSuccess(saveBtn, "Kaydedildi!", 1500);
        }
        this.setProtocolStatus("Protokol kaydedildi", "success");
        Logger.info(LogCategory.ARCHIVES, `Protokol kaydedildi: ${this._selectedProtocolKey}`);
      } else {
        if (saveBtn) {
          ButtonStates.setError(saveBtn, "Hata!", 1500);
        }
        this.setProtocolStatus(result.message ?? "Kaydedilemedi", "error");
      }
    } catch (e) {
      const err = e as Error;
      if (saveBtn) {
        ButtonStates.setError(saveBtn, "Hata!", 1500);
      }
      Logger.error(LogCategory.ARCHIVES, `Protokol kaydetme hatası: ${err.message}`);
      this.setProtocolStatus("Protokol kaydedilemedi", "error");
    }
  }

  /** Textarea'da imlecin olduğu yere tag ekle */
  insertTagAtCursor(textarea: HTMLTextAreaElement, tag: string): void {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    textarea.value = value.slice(0, start) + tag + value.slice(end);
    const newPos = start + tag.length;
    textarea.selectionStart = newPos;
    textarea.selectionEnd = newPos;
    textarea.focus();
  }

  /** Protokol durum mesajı göster */
  setProtocolStatus(text: string, type = "info"): void {
    if (!this.protocolStatusEl) return;
    this.protocolStatusEl.textContent = text;
    this.protocolStatusEl.className = `form-hint ${type}`;
  }
}
