import type { TranslationParams } from "@shared/i18n.js";
import { Logger } from "../modules/logger/index.js";
import { LogCategory } from "@shared/logging-core";
import { SettingsManager } from "../modules/settings-manager.js";
import { AppState } from "../modules/app-state.js";
import { AppI18n } from "../modules/i18n/index.js";
import { ButtonStates } from "../ui/button-states.js";
import type { ArchiveEntry, FileResult, MessageResult } from "./archives/types.js";
import {
  deleteArchiveEntry,
  navigateArchiveResult,
  performArchiveSearch,
  saveArchiveSelection,
} from "./archives/actions.js";
import {
  applyProtocolSelectionView,
  insertTagAtCursor as insertTagAtCursorInEditor,
  loadProtocolsFromApi,
  renderProtocolListView,
  saveProtocolContent,
  setProtocolStatusView,
} from "./archives/protocol-editor.js";
import {
  clearSearchResultsView,
  renderSearchResultsView,
  switchSearchTab,
} from "./archives/search-view.js";
import { isAssistantAccountsSettingsPath, isAssistantSlotSettingsPath } from "@shared/settings.js";
import {
  ARCHIVE_PROVIDER_KEYS,
  isArchiveProviderKey,
  type ArchiveProviderKey,
} from "@shared/archive.js";

function archivesT(key: string, params?: TranslationParams): string {
  return AppI18n.t(`app.archives.${key}`, params);
}

export class ArchivesController {
  entries: ArchiveEntry[];
  activeProvider: ArchiveProviderKey;
  selectedId: string | null;
  searchQuery: string;
  searchScope: string;
  searchResults: { messages: MessageResult[]; attachments: FileResult[] };
  activeTab: string;
  _searchTimeout: ReturnType<typeof setTimeout> | null;
  _unsubSettings: (() => void) | null;
  _unsubI18n: (() => void) | null;

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
    this._unsubI18n = null;

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
    this.ensureSubscriptions();
    this.applyTranslations();
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
        const nextProvider = target.value;
        if (target.checked && isArchiveProviderKey(nextProvider)) {
          this.clearStatus();
          this.activeProvider = nextProvider;
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
      const entry =
        this.selectedId !== null
          ? this.entries.find(
              (archiveEntry) =>
                archiveEntry.id === this.selectedId &&
                archiveEntry.provider === this.activeProvider
            ) ?? null
          : null;
      if (entry) void this.deleteEntry(entry);
    });

    this.searchInputEl?.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.clearSearchBtn?.classList.toggle("is-hidden", this.searchQuery === "");

      if (this._searchTimeout) clearTimeout(this._searchTimeout);
      this._searchTimeout = setTimeout(() => {
        void this.performSearch();
      }, 300);
    });

    this.clearSearchBtn?.addEventListener("click", () => {
      if (this.searchInputEl) this.searchInputEl.value = "";
      this.searchQuery = "";
      this.clearSearchBtn?.classList.add("is-hidden");
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

    this.protocolSaveBtn?.addEventListener("click", () => {
      void this.saveSelectedProtocol();
    });

    this.protocolTagButtonsEl?.querySelectorAll(".protocol-tag-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = (btn as HTMLElement).dataset["tag"];
        if (tag !== undefined && tag !== "" && this.protocolTextareaEl) {
          this.insertTagAtCursor(this.protocolTextareaEl, tag);
        }
      });
    });
  }

  ensureSubscriptions(): void {
    this._unsubSettings ??= SettingsManager.subscribe(
      ({ changedPaths }: { changedPaths: string[] }) => {
        const shouldApplyNames =
          changedPaths.includes("*") ||
          changedPaths.some(
            (path) =>
              path.startsWith("accounts") ||
              isAssistantAccountsSettingsPath(path) ||
              path.startsWith("slots") ||
              isAssistantSlotSettingsPath(path) ||
              path.startsWith("remoteUsers") ||
              path.startsWith("us1Slot")
          );

        if (!shouldApplyNames) {
          return;
        }

        this.applyNames();
        void this.loadIndex();
      }
    );

    this._unsubI18n ??= AppI18n.subscribe(() => {
      this.applyTranslations();
    });
  }

  async loadSettings(): Promise<void> {
    try {
      await SettingsManager.load();
    } catch (err) {
      const error = err as Error;
      Logger.error(
        LogCategory.ARCHIVES,
        archivesT("logs.settingsLoadError", { message: error.message })
      );
    }
  }

  async loadIndex(): Promise<void> {
    try {
      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        this.entries = [];
        this.syncActiveProvider();
        this.renderList();
        this.fillForm(null);
        return;
      }

      const providers = ARCHIVE_PROVIDER_KEYS.map((provider) => ({
        provider,
        accountId: AppState.getArchiveAccountIdForProvider(provider),
      }));

      const results = (await Promise.all(
        providers.map(({ accountId }) =>
          accountId !== null ? electronApi.dbGetConversations({ accountId }) : Promise.resolve({ data: [] })
        )
      )) as Array<{ data?: unknown } | undefined>;

      this.entries = providers.flatMap(({ provider, accountId }, index) => {
        const result = results[index];
        const rawEntries = Array.isArray(result?.data) ? (result.data as ArchiveEntry[]) : [];
        return rawEntries.map((entry) => {
          const nextEntry: ArchiveEntry = {
            ...entry,
            provider,
          };

          const resolvedAccountId = accountId ?? entry.accountId;
          if (resolvedAccountId !== undefined) {
            nextEntry.accountId = resolvedAccountId;
          }

          return nextEntry;
        });
      });

      this.syncActiveProvider();
      this.renderList();

      const selectedEntry =
        this.selectedId !== null
          ? this.entries.find(
              (entry) => entry.id === this.selectedId && entry.provider === this.activeProvider
            ) ?? null
          : null;

      if (selectedEntry !== null) {
        this.fillForm(selectedEntry);
      } else {
        this.selectedId = null;
        this.fillForm(null);
      }
    } catch (e) {
      const err = e as Error;
      Logger.error(
        LogCategory.ARCHIVES,
        archivesT("logs.archiveReadError", { message: err.message })
      );
      this.entries = [];
      this.syncActiveProvider();
      this.renderList();
      this.fillForm(null);
    }
  }

  renderList(): void {
    if (!this.listEl) return;
    const items = this.entries.filter((e) => e.provider === this.activeProvider);
    this.listEl.innerHTML = "";
    if (items.length === 0) {
      const div = document.createElement("div");
      div.className = "empty";
      div.textContent = archivesT("page.empty");
      this.listEl.appendChild(div);
      return;
    }
    items.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "archive-item glass-panel";
      const titleWrap = document.createElement("div");
      titleWrap.className = "archive-title";
      titleWrap.textContent = entry.title ?? entry.id;
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
      removeBtn.title = archivesT("page.deleteTitle");
      removeBtn.innerHTML = "×";
      removeBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        void this.deleteEntry(entry);
      });

      if (entry.id === this.selectedId) {
        item.classList.add("is-selected");
      }
      item.appendChild(titleWrap);
      item.appendChild(removeBtn);
      this.listEl?.appendChild(item);
    });
  }

  async deleteEntry(entry: ArchiveEntry | null): Promise<void> {
    await deleteArchiveEntry(this, entry);
  }

  fillForm(entry: ArchiveEntry | null): void {
    if (entry) {
      this.detailEmptyEl?.classList.add("is-hidden");
      this.conversationFormEl?.classList.remove("is-hidden");
    } else {
      this.detailEmptyEl?.classList.remove("is-hidden");
      this.conversationFormEl?.classList.add("is-hidden");
    }

    if (this.titleEl) this.titleEl.value = entry?.title ?? "";
    if (this.summaryEl) this.summaryEl.value = entry?.summary ?? "";
    if (this.webUrlDisplayEl)
      this.webUrlDisplayEl.textContent = entry?.webUrl ?? archivesT("page.webUrlEmpty");
    if (this.messageCountEl) this.messageCountEl.textContent = String(entry?.messageCount ?? 0);

    this._selectedEntry = entry;
  }

  copyUrl(): void {
    const url = this._selectedEntry?.webUrl;
    if (url === undefined || url === "") return;

    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.setStatus(archivesT("page.urlCopied"), "success");
        setTimeout(() => {
          this.clearStatus();
        }, 2000);
      })
      .catch(() => {
        this.setStatus(archivesT("page.copyFailed"), "error");
      });
  }

  async performSearch(): Promise<void> {
    await performArchiveSearch(this);
  }

  renderSearchResults(): void {
    renderSearchResultsView({
      searchResults: this.searchResults,
      searchQuery: this.searchQuery,
      searchScope: this.searchScope,
      messagesCountEl: this.messagesCountEl,
      filesCountEl: this.filesCountEl,
      searchEmptyEl: this.searchEmptyEl,
      resultsMessagesEl: this.resultsMessagesEl,
      resultsFilesEl: this.resultsFilesEl,
      onNavigate: async (result, type) => {
        await this.navigateToResult(result, type);
      },
    });
  }

  async navigateToResult(result: MessageResult | FileResult, type: string): Promise<void> {
    await navigateArchiveResult(this, result, type);
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    switchSearchTab(tab, this.resultsMessagesEl, this.resultsFilesEl);
  }

  clearSearchResults(): void {
    this.searchResults = { messages: [], attachments: [] };
    clearSearchResultsView({
      messagesCountEl: this.messagesCountEl,
      filesCountEl: this.filesCountEl,
      resultsMessagesEl: this.resultsMessagesEl,
      resultsFilesEl: this.resultsFilesEl,
      searchEmptyEl: this.searchEmptyEl,
    });
  }

  async saveSelected(): Promise<void> {
    await saveArchiveSelection(this);
  }

  setStatus(text: string, type = "info"): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.className = `form-hint is-${type}`;
  }

  clearStatus(): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = "";
    this.statusEl.className = "form-hint";
  }

  getAvailableProviders(): ArchiveProviderKey[] {
    return ARCHIVE_PROVIDER_KEYS.filter((provider) => {
      return AppState.getArchiveAccountIdForProvider(provider) !== null;
    });
  }

  syncActiveProvider(): void {
    const availableProviders = this.getAvailableProviders();
    if (!availableProviders.includes(this.activeProvider)) {
      this.activeProvider = availableProviders[0] ?? "ai1";
    }

    ARCHIVE_PROVIDER_KEYS.forEach((provider) => {
      const radio = document.querySelector<HTMLInputElement>(
        `input[name="archives-provider"][value="${provider}"]`
      );
      if (radio !== null) {
        radio.checked = provider === this.activeProvider;
      }
    });
  }

  applyNames(): void {
    const settings = SettingsManager.getSnapshot();
    const slots = settings.slots as Record<string, { accountId?: string }>;
    const ai1Assigned = slots["ai1"]?.accountId !== undefined && slots["ai1"].accountId !== "";
    const ai2Assigned = slots["ai2"]?.accountId !== undefined && slots["ai2"].accountId !== "";
    const us1Assigned = AppState.getArchiveAccountIdForProvider("us1") !== null;

    const ai1Name = ai1Assigned ? AppState.getNickname("ai1") : "AI1";
    const ai2Name = ai2Assigned ? AppState.getNickname("ai2") : "AI2";
    const us1Name = us1Assigned ? AppState.getNickname("us1") : "US1";

    const labelAi1 = document.getElementById("archives-provider-ai1");
    const labelAi2 = document.getElementById("archives-provider-ai2");
    const labelUs1 = document.getElementById("archives-provider-us1");
    const radioAi1 = document.getElementById("archive-filter-ai1");
    const radioAi2 = document.getElementById("archive-filter-ai2");
    const radioUs1 = document.getElementById("archive-filter-us1");

    if (labelAi1) labelAi1.textContent = ai1Name;
    if (labelAi2) labelAi2.textContent = ai2Name;
    if (labelUs1) labelUs1.textContent = us1Name;

    if (radioAi1) (radioAi1 as HTMLInputElement).disabled = !ai1Assigned;
    if (radioAi2) (radioAi2 as HTMLInputElement).disabled = !ai2Assigned;
    if (radioUs1) (radioUs1 as HTMLInputElement).disabled = !us1Assigned;

    this.syncActiveProvider();
  }

  onShow(): void {
    void this.loadSettings().then(() => {
      this.applyNames();
    });
    this.ensureSubscriptions();
    this.applyTranslations();
    void this.loadIndex();
    void this.loadProtocols();
    this.clearStatus();
  }
  onHide(): void {
    this.clearStatus();
    // NOTE: Clear the search timeout to avoid leaks.
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
      this._searchTimeout = null;
    }
  }

  async loadProtocols(): Promise<void> {
    try {
      this._protocols = await loadProtocolsFromApi(window.electronAPI);
      this.renderProtocolList();
    } catch (e) {
      const err = e as Error;
      Logger.error(
        LogCategory.ARCHIVES,
        archivesT("protocol.logs.loadFailed", { message: err.message })
      );
      this._protocols = {};
      this.renderProtocolList();
    }
  }

  renderProtocolList(): void {
    renderProtocolListView({
      protocolListEl: this.protocolListEl,
      protocols: this._protocols,
      selectedProtocolKey: this._selectedProtocolKey,
      onSelect: (key) => {
        this.selectProtocol(key);
      },
    });
  }

  selectProtocol(key: string): void {
    this._selectedProtocolKey = key;
    this.renderProtocolList();
    applyProtocolSelectionView({
      key,
      protocols: this._protocols,
      protocolEditorTitleEl: this.protocolEditorTitleEl,
      protocolTextareaEl: this.protocolTextareaEl,
      protocolEmptyEl: this.protocolEmptyEl,
      protocolSaveBtn: this.protocolSaveBtn,
      protocolTagButtonsEl: this.protocolTagButtonsEl,
      setStatus: (text, type) => {
        this.setProtocolStatus(text, type);
      },
    });
  }

  async saveSelectedProtocol(): Promise<void> {
    if (this._selectedProtocolKey === null || this._selectedProtocolKey === "") {
      this.setProtocolStatus(archivesT("protocol.status.selectionRequired"), "warning");
      return;
    }

    const content = this.protocolTextareaEl?.value ?? "";
    const saveBtn = this.protocolSaveBtn as HTMLButtonElement | null;

    try {
      if (saveBtn) {
        ButtonStates.setLoading(saveBtn, archivesT("protocol.buttons.saving"));
      }

      const result = await saveProtocolContent({
        electronApi: window.electronAPI,
        selectedProtocolKey: this._selectedProtocolKey,
        content,
      });

      if (result.success) {
        this._protocols[this._selectedProtocolKey] = content;
        if (saveBtn) {
          ButtonStates.setSuccess(saveBtn, archivesT("protocol.buttons.saved"), 1500);
        }
        this.setProtocolStatus(archivesT("protocol.status.saved"), "success");
        Logger.info(
          LogCategory.ARCHIVES,
          archivesT("protocol.logs.saved", { key: this._selectedProtocolKey })
        );
      } else {
        if (saveBtn) {
          ButtonStates.setError(saveBtn, archivesT("protocol.buttons.error"), 1500);
        }
        this.setProtocolStatus(result.message ?? archivesT("protocol.status.saveFailed"), "error");
      }
    } catch (e) {
      const err = e as Error;
      if (saveBtn) {
        ButtonStates.setError(saveBtn, archivesT("protocol.buttons.error"), 1500);
      }
      Logger.error(
        LogCategory.ARCHIVES,
        archivesT("protocol.logs.saveError", { message: err.message })
      );
      this.setProtocolStatus(archivesT("protocol.status.saveFailed"), "error");
    }
  }

  insertTagAtCursor(textarea: HTMLTextAreaElement, tag: string): void {
    insertTagAtCursorInEditor(textarea, tag);
  }

  setProtocolStatus(text: string, type = "info"): void {
    setProtocolStatusView(this.protocolStatusEl, text, type);
  }

  private setElementText(id: string, text: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  }

  private applyTranslations(): void {
    this.setElementText("archives-sidebar-title", archivesT("page.sidebarTitle"));
    this.setElementText("archives-detail-title", archivesT("page.detailTitle"));
    this.setElementText("archives-detail-empty-text", archivesT("page.detailEmpty"));
    this.setElementText("archives-title-label", archivesT("page.titleLabel"));
    this.setElementText("archives-summary-label", archivesT("page.summaryLabel"));
    this.setElementText("archives-weburl-label", archivesT("page.webUrlLabel"));
    this.setElementText("archives-search-title", archivesT("page.searchTitle"));
    this.setElementText("archives-scope-current", archivesT("page.scopeCurrent"));
    this.setElementText("archives-scope-all", archivesT("page.scopeAll"));
    this.setElementText("archives-messages-tab-label", archivesT("page.messagesTab"));
    this.setElementText("archives-files-tab-label", archivesT("page.filesTab"));
    this.setElementText("archives-search-empty-text", archivesT("page.searchEmpty"));
    this.setElementText("archives-protocol-list-title", archivesT("page.protocolListTitle"));
    this.setElementText("archives-protocol-list-loading", archivesT("page.protocolLoading"));
    this.setElementText("archives-protocol-empty-text", archivesT("page.protocolEmpty"));

    if (this.titleEl) {
      this.titleEl.placeholder = archivesT("page.titlePlaceholder");
    }
    if (this.summaryEl) {
      this.summaryEl.placeholder = archivesT("page.summaryPlaceholder");
    }
    if (this.searchInputEl) {
      this.searchInputEl.placeholder = archivesT("page.searchPlaceholder");
    }
    if (this.protocolTextareaEl) {
      this.protocolTextareaEl.placeholder = archivesT("page.protocolPlaceholder");
    }

    const copyUrlButton = document.getElementById("btn-copy-url");
    if (copyUrlButton) {
      copyUrlButton.title = archivesT("page.copyUrlTitle");
    }

    const saveButton = document.getElementById("archive-save");
    if (saveButton) {
      saveButton.textContent = archivesT("page.saveButton");
    }

    const deleteButton = document.getElementById("btn-delete");
    if (deleteButton) {
      deleteButton.textContent = `🗑️ ${archivesT("page.deleteButton")}`;
    }

    const protocolSaveButton = document.getElementById("btn-protocol-save");
    if (protocolSaveButton) {
      protocolSaveButton.textContent = `💾 ${archivesT("page.protocolSaveButton")}`;
    }

    if (this._selectedProtocolKey === null && this.protocolEditorTitleEl) {
      this.protocolEditorTitleEl.textContent = archivesT("page.protocolEditorPlaceholderTitle");
    }

    this.fillForm(this._selectedEntry);
    this.renderList();
    this.renderProtocolList();

    if (this._selectedProtocolKey !== null) {
      this.selectProtocol(this._selectedProtocolKey);
    }

    if (this.searchQuery === "") {
      this.clearSearchResults();
      return;
    }

    this.renderSearchResults();
  }
}
