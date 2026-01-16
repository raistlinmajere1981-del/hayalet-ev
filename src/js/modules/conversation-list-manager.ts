import { LogManager } from "./log-manager.js";
import { SettingsManager } from "./settings-manager.js";
import { SlotController, SlotEvent } from "./slot-controller.js";
import { AppState } from "./app-state.js";

class ConversationListManagerClass {
  selects: Record<string, HTMLSelectElement | null>;
  entries: any[];
  currentSelections: Record<string, string>;
  _settingsSub: (() => void) | null;
  _slotControllerSub: (() => void) | null;

  constructor() {
    this.selects = { ai1: null, ai2: null };
    this.entries = [];
    this.currentSelections = { ai1: "new", ai2: "new" };
    this._settingsSub = null;
    this._slotControllerSub = null;
  }

  async init() {
    // DOM query'leri init sırasında yap - constructor'da sayfa henüz yüklenmemiş olabilir
    this.selects = {
      ai1: document.getElementById("conversation-ai1"),
      ai2: document.getElementById("conversation-ai2"),
    };
    
    await this.refresh({ silent: true });
    this.bindEvents();
    this.subscribeToSettings();
  }

  subscribeToSettings() {
    this._settingsSub = SettingsManager.subscribe(({ changedPaths }) => {
      const slotAccountPaths = ["slots.ai1.accountId", "slots.ai2.accountId"];
      const slotChanged =
        changedPaths.includes("*") ||
        changedPaths.some((p) => slotAccountPaths.some((path) => p === path));

      if (slotChanged) {
        this.renderAll({ silent: true });
      }
    });

    if (!this._slotControllerSub) {
      this._slotControllerSub = SlotController.on(SlotEvent.STATE_CHANGED, () => {
        this.renderAll({ silent: true });
      });
    }
  }

  bindEvents() {
    for (const provider in this.selects) {
      this.selects[provider]?.addEventListener("change", () =>
        this.handleConversationChange(provider),
      );
    }
  }

  handleConversationChange(provider, options = { isInitial: false }) {
    const select = this.selects[provider];
    if (!select) return;

    const conversationId = select.value;
    this.currentSelections[provider] = conversationId;

    // Hem ID hem provider eşleşmeli (aynı ID farklı provider'larda olabilir)
    const entry = this.entries.find((e) => e.id === conversationId && e.provider === provider);
    SlotController.navigate(provider, entry?.webUrl || null);

    if (!options.isInitial) {
      LogManager.addEvent(
        "conversation",
        "info",
        `User selected: ${provider} -> ${conversationId}`,
      );
    }
  }

  async refresh(
    options: { silent?: boolean; forceSelectId?: any; skipNotify?: boolean } = {},
  ) {
    const { silent = false, forceSelectId = null, skipNotify = false } = options;
    try {
      // Her slot için hesap bilgisini al ve DB'den konuşmaları çek
      const ai1Account = AppState.getAccountForSlot("ai1");
      const ai2Account = AppState.getAccountForSlot("ai2");

      const [ai1Entries, ai2Entries] = await Promise.all([
        ai1Account?.id ? window.electronAPI?.dbGetConversations?.(ai1Account.id) : [],
        ai2Account?.id ? window.electronAPI?.dbGetConversations?.(ai2Account.id) : [],
      ]);

      // Provider bilgisini slot olarak ekle (ai1/ai2)
      this.entries = [
        ...(ai1Entries || []).map(e => ({ ...e, provider: "ai1", mtime: e.updatedAt || e.createdAt })),
        ...(ai2Entries || []).map(e => ({ ...e, provider: "ai2", mtime: e.updatedAt || e.createdAt })),
      ];

      this.renderAll({ silent });
      if (forceSelectId) {
        this.updateSelection(forceSelectId, { silent: true });
      }
      if (!skipNotify) {
        window.dispatchEvent(
          new CustomEvent("conversation-selected", {
            detail: { provider: "ai1" },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("conversation-selected", {
            detail: { provider: "ai2" },
          }),
        );
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      LogManager.addEvent(
        "conversation",
        "error",
        `Listeyi yenileme hatası: ${err.message}`,
      );
    }
  }

  renderAll(options: { silent?: boolean } = {}) {
    for (const provider in this.selects) {
      this.render(provider, options);
    }
  }

  render(provider: string, options: { silent?: boolean } = {}) {
    const select = this.selects[provider];
    if (!select) return;

    const settings = SettingsManager.getSnapshot();
    const slot = settings?.slots?.[provider] || {};
    const hasAccount = !!slot.accountId;
    const isConnected = SlotController.isConnected(provider);

    select.disabled = !hasAccount || !isConnected;

    const currentVal = options.silent
      ? select.value
      : this.currentSelections[provider] || "new";

    select.innerHTML = "";

    if (!hasAccount) {
      const emptyOpt = new Option("— Slot boş —", "empty");
      emptyOpt.disabled = true;
      emptyOpt.selected = true;
      select.appendChild(emptyOpt);
      this.currentSelections[provider] = "empty";
      return;
    }

    const newOption = new Option("Yeni Sohbet", "new");
    newOption.dataset.url = "";
    newOption.dataset.folder = "";
    select.appendChild(newOption);

    const providerEntries = this.entries.filter((e) => e.provider === provider);
    providerEntries.sort((a, b) => b.mtime - a.mtime);

    for (const entry of providerEntries) {
      const option = new Option(entry.title || entry.id, entry.id);
      option.dataset.folder = entry.folder || "";
      option.dataset.url = entry.webUrl || "";
      select.appendChild(option);
    }

    select.value = currentVal;
    if (select.selectedIndex === -1) {
      select.value = "new";
    }
    this.currentSelections[provider] = select.value;
  }

  updateSelection(conversationId: string, options: { silent?: boolean; provider?: string | null } = {}) {
    const { silent = false, provider: targetProvider = null } = options;
    // Provider belirtilmişse ona göre, değilse ilk eşleşeni bul
    const entry = targetProvider 
      ? this.entries.find((e) => e.id === conversationId && e.provider === targetProvider)
      : this.entries.find((e) => e.id === conversationId);
    if (!entry) return;

    const { provider } = entry;
    const select = this.selects[provider];
    if (select && select.value !== conversationId) {
      select.value = conversationId;
      this.currentSelections[provider] = conversationId;
      if (!silent) {
        this.handleConversationChange(provider);
      }
    }
  }
}

export const ConversationListManager = new ConversationListManagerClass();
