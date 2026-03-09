import { Logger } from "./logger/index.js";
import { ASSISTANT_TIMEOUTS } from "@timeouts";
import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import type { SlotId } from "@shared/index.js";
import { AppI18n } from "./i18n/index.js";
import { SettingsManager } from "./settings-manager.js";
import { SlotController, SlotEvent } from "./slot-controller.js";
import { AppState } from "./app-state.js";

interface RawConversationEntry {
  id?: string;
  webUrl?: string;
  title?: string;
  updatedAt?: number;
  createdAt?: number;
}

interface SlotSettings {
  accountId?: string;
  [key: string]: unknown;
}
interface ConversationEntry {
  conversationId: string;
  id: string;
  webUrl: string;
  provider: string;
  mtime: number;
  folder: string;
  title: string;
  lastMessageTime?: number;
}

function conversationListT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.analyze.conversationList.${key}`, params);
}

class ConversationListManagerClass {
  selects: Record<string, HTMLSelectElement | null>;
  entries: ConversationEntry[];
  currentSelections: Record<string, string>;
  _settingsSub: (() => void) | null;
  _slotControllerSub: (() => void) | null;
  _i18nSub: (() => void) | null;

  constructor() {
    this.selects = { ai1: null, ai2: null };
    this.entries = [];
    this.currentSelections = { ai1: "new", ai2: "new" };
    this._settingsSub = null;
    this._slotControllerSub = null;
    this._i18nSub = null;
  }

  async init(): Promise<void> {
    this.selects = {
      ai1: document.getElementById("conversation-ai1") as HTMLSelectElement | null,
      ai2: document.getElementById("conversation-ai2") as HTMLSelectElement | null,
    };

    await this.refresh({ silent: true });
    this.bindEvents();
    this.subscribeToSettings();
  }

  subscribeToSettings(): void {
    this._settingsSub = SettingsManager.subscribe(
      ({ changedPaths }: { changedPaths: string[] }) => {
        const slotAccountPaths = ["slots.ai1.accountId", "slots.ai2.accountId"];
        const slotChanged =
          changedPaths.includes("*") ||
          changedPaths.some((p: string) => slotAccountPaths.some((path) => p === path));

        if (slotChanged) {
          void this.refresh({ silent: true, skipNotify: true });
        }
      }
    );

    this._slotControllerSub ??= SlotController.on(SlotEvent.STATE_CHANGED, () => {
      this.renderAll({ silent: true });
    });

    this._i18nSub ??= AppI18n.subscribe(() => {
      this.renderAll({ silent: true });
    });

    // When URL changes to the default page, reset the conversation list to "new".
    SlotController.on(
      SlotEvent.URL_CHANGED,
      (payload: { event?: string; slot?: string; data?: { isDefaultPage?: boolean } }) => {
        const slot = payload.slot;
        const isDefaultPage = (payload as { data?: { isDefaultPage?: boolean } }).data
          ?.isDefaultPage;
        if (slot !== undefined && slot !== "" && isDefaultPage === true) {
          const select = this.selects[slot];
          if (select !== undefined && select !== null && select.value !== "new") {
            select.value = "new";
            this.currentSelections[slot] = "new";
            Logger.info(
              LogCategory.WEBVIEW,
              conversationListT("logs.resetToNewConversation", { slot })
            );
          }
        }
      }
    );
  }

  bindEvents(): void {
    for (const provider in this.selects) {
      this.selects[provider]?.addEventListener("change", () => {
        this.handleConversationChange(provider);
      });
    }
  }

  handleConversationChange(provider: string, options = { isInitial: false }): void {
    const select = this.selects[provider];
    if (!select) return;

    const conversationId = select.value;
    this.currentSelections[provider] = conversationId;

    this._clearMessagesArea(provider);

    const entry = this.entries.find((e) => e.id === conversationId && e.provider === provider);
    SlotController.navigate(provider as SlotId, entry?.webUrl ?? null);

    if (!options.isInitial) {
      Logger.info(LogCategory.WEBVIEW, `User selected: ${provider} -> ${conversationId}`);
    }

    window.dispatchEvent(
      new CustomEvent("conversation-selected", {
        detail: { provider, isNew: conversationId === "new" },
      })
    );
  }
  _clearMessagesArea(provider: string): void {
    const container = document.getElementById(`messages-${provider}`);
    if (container) {
      container.innerHTML = `<div class="message-placeholder">${conversationListT("loadingMessages")}</div>`;
    }
  }

  async refresh(
    options: {
      silent?: boolean;
      forceSelectId?: string;
      skipNotify?: boolean;
      provider?: string;
    } = {}
  ): Promise<void> {
    const { silent = false, forceSelectId = null, skipNotify = false, provider = null } = options;
    try {
      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        this.entries = [];
        this.renderAll({ silent: true });
        return;
      }

      const ai1Account = AppState.getAccountForSlot("ai1");
      const ai2Account = AppState.getAccountForSlot("ai2");

      const ai1Result =
        ai1Account?.id !== undefined && ai1Account.id !== ""
          ? ((await electronApi.dbGetConversations({ accountId: ai1Account.id })) as
              | { data: unknown[] }
              | undefined)
          : { data: [] };
      const ai2Result =
        ai2Account?.id !== undefined && ai2Account.id !== ""
          ? ((await electronApi.dbGetConversations({ accountId: ai2Account.id })) as
              | { data: unknown[] }
              | undefined)
          : { data: [] };

      const ai1Entries = Array.isArray(ai1Result?.data) ? ai1Result.data : [];
      const ai2Entries = Array.isArray(ai2Result?.data) ? ai2Result.data : [];

      this.entries = [
        ...ai1Entries.map((e: unknown) => {
          const entry = e as RawConversationEntry;
          return {
            conversationId: String(entry.id ?? ""),
            id: String(entry.id ?? ""),
            webUrl: String(entry.webUrl ?? ""),
            provider: "ai1" as const,
            mtime:
              Number(entry.updatedAt ?? entry.createdAt ?? 0) !== 0
                ? Number(entry.updatedAt ?? entry.createdAt ?? 0)
                : 0,
            folder: "",
            title: String(entry.title ?? ""),
          } as ConversationEntry;
        }),
        ...ai2Entries.map((e: unknown) => {
          const entry = e as RawConversationEntry;
          return {
            conversationId: String(entry.id ?? ""),
            id: String(entry.id ?? ""),
            webUrl: String(entry.webUrl ?? ""),
            provider: "ai2" as const,
            mtime:
              Number(entry.updatedAt ?? entry.createdAt ?? 0) !== 0
                ? Number(entry.updatedAt ?? entry.createdAt ?? 0)
                : 0,
            folder: "",
            title: String(entry.title ?? ""),
          } as ConversationEntry;
        }),
      ];

      this.renderAll({ silent });

      if (forceSelectId !== null && forceSelectId !== "") {
        await new Promise((resolve) =>
          setTimeout(resolve, ASSISTANT_TIMEOUTS.CONVERSATION_LIST_MICRO)
        );
        this.updateSelection(forceSelectId, { silent: true, provider });
      }

      if (skipNotify === false) {
        const targetProvider =
          provider ??
          (forceSelectId !== null && forceSelectId !== ""
            ? this.entries.find((e) => e.id === forceSelectId)?.provider
            : null);
        const providers =
          targetProvider !== null && targetProvider !== "" ? [targetProvider] : ["ai1", "ai2"];

        await new Promise((resolve) =>
          setTimeout(resolve, ASSISTANT_TIMEOUTS.CONVERSATION_LIST_MICRO)
        );

        for (const p of providers) {
          const providerStr = p as string;
          const selections = this.currentSelections;
          const isNew = (selections[providerStr] ?? "new") === "new";
          window.dispatchEvent(
            new CustomEvent("conversation-selected", {
              detail: { provider: providerStr, isNew },
            })
          );
        }
      }
    } catch (error) {
      const err = /** @type {Error} */ error;
      Logger.error(
        LogCategory.WEBVIEW,
        conversationListT("logs.refreshError", { message: getErrorMessage(err) })
      );
    }
  }

  renderAll(options: { silent?: boolean } = {}): void {
    for (const provider in this.selects) {
      this.render(provider, options);
    }
  }

  render(provider: string, options: { silent?: boolean } = {}): void {
    const select = this.selects[provider];
    if (!select) return;

    const settings = SettingsManager.getSnapshot();
    const slot = (settings.slots[provider] ?? {}) as SlotSettings;
    const hasAccount = slot.accountId !== undefined && slot.accountId !== "";
    const isConnected = SlotController.isConnected(provider) === true;

    select.disabled = !hasAccount || !isConnected;

    const currentVal =
      options.silent === true ? select.value : (this.currentSelections[provider] ?? "new");

    select.innerHTML = "";

    if (hasAccount === false) {
      const emptyOpt = new Option(conversationListT("emptySlot"), "empty");
      emptyOpt.disabled = true;
      emptyOpt.selected = true;
      select.appendChild(emptyOpt);
      this.currentSelections[provider] = "empty";
      return;
    }

    const newOption = new Option(conversationListT("newConversation"), "new");
    newOption.dataset["url"] = "";
    newOption.dataset["folder"] = "";
    select.appendChild(newOption);

    const providerEntries = this.entries.filter((e) => e.provider === provider);
    providerEntries.sort((a, b) => b.mtime - a.mtime);

    for (const entry of providerEntries) {
      const option = new Option(entry.title, entry.id);
      option.dataset["folder"] = entry.folder;
      option.dataset["url"] = entry.webUrl;
      select.appendChild(option);
    }

    select.value = currentVal;
    if (select.selectedIndex === -1) {
      select.value = "new";
    }
    this.currentSelections[provider] = select.value;
  }

  updateSelection(
    conversationId: string,
    options: { silent?: boolean; provider?: string | null } = {}
  ): boolean {
    const { silent = false, provider: targetProvider = null } = options;
    const entry =
      targetProvider !== null && targetProvider !== ""
        ? this.entries.find((e) => e.id === conversationId && e.provider === targetProvider)
        : this.entries.find((e) => e.id === conversationId);
    if (entry === undefined) return false;

    const { provider } = entry;
    const select = this.selects[provider];
    if (select !== undefined && select !== null && select.value !== conversationId) {
      select.value = conversationId;
      this.currentSelections[provider] = conversationId;
      if (silent === false) {
        this.handleConversationChange(provider);
      }
    }
    return true;
  }

  destroy(): void {
    this._settingsSub?.();
    this._slotControllerSub?.();
    this._i18nSub?.();
    this._settingsSub = null;
    this._slotControllerSub = null;
    this._i18nSub = null;
  }
}

const conversationListManager = new ConversationListManagerClass();

export { conversationListManager, conversationListManager as ConversationListManager };
