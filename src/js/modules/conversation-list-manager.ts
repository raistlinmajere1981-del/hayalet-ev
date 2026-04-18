import { Logger } from "./logger/index.js";
import { ASSISTANT_TIMEOUTS } from "@timeouts";
import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import type { SlotId } from "@shared/index.js";
import type { Us1SessionEvent } from "@shared/us1-mail.js";
import { AppI18n } from "./i18n/index.js";
import { SettingsManager } from "./settings-manager.js";
import { SlotController, SlotEvent } from "./slot-controller.js";
import { AppState } from "./app-state.js";
import { parseUs1SyntheticSessionUri } from "@shared/archive.js";
import { dispatchInternalSlotBridge } from "./commands/slot-bridge-runtime.js";
import { resolveUs1ForceSelectConversationId } from "./us1-session-selection.js";

interface RawConversationEntry {
  id?: string;
  webUrl?: string;
  title?: string;
  updatedAt?: number;
  createdAt?: number;
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
  localSessionId?: string | null;
  pendingUnreadCount?: number;
}

function conversationListT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.analyze.conversationList.${key}`, params);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function isUs1SessionEvent(value: unknown): value is Us1SessionEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["remoteUserId"] === "string" &&
    typeof value["localSessionId"] === "string" &&
    typeof value["conversationId"] === "string" &&
    typeof value["isNewSession"] === "boolean"
  );
}

class ConversationListManagerClass {
  selects: Record<string, HTMLSelectElement | null>;
  entries: ConversationEntry[];
  currentSelections: Record<string, string>;
  _settingsSub: (() => void) | null;
  _slotControllerSub: (() => void) | null;
  _appStateSub: (() => void) | null;
  _i18nSub: (() => void) | null;

  constructor() {
    this.selects = { ai1: null, ai2: null, us1: null };
    this.entries = [];
    this.currentSelections = { ai1: "new", ai2: "new", us1: "new" };
    this._settingsSub = null;
    this._slotControllerSub = null;
    this._appStateSub = null;
    this._i18nSub = null;
  }

  async init(): Promise<void> {
    this.selects = {
      ai1: document.getElementById("conversation-ai1") as HTMLSelectElement | null,
      ai2: document.getElementById("conversation-ai2") as HTMLSelectElement | null,
      us1: document.getElementById("conversation-us1") as HTMLSelectElement | null,
    };

    await this.refresh({ silent: true });
    this.bindEvents();
    this.subscribeToSettings();
  }

  subscribeToSettings(): void {
    this._settingsSub = SettingsManager.subscribe(
      ({ changedPaths }: { changedPaths: string[] }) => {
        const slotAccountPaths = [
          "slots.ai1.accountId",
          "slots.ai2.accountId",
          "us1Slot.selectedAccountId",
          "us1Slot.selectedRemoteUserId",
          "us1Slot.connectionState",
        ];
        const slotChanged =
          changedPaths.includes("*") ||
          changedPaths.some(
            (p: string) =>
              slotAccountPaths.some((path) => p === path) ||
              p.startsWith("remoteUsers") ||
              p.startsWith("accounts") ||
              p.startsWith("integrations.mailTransport")
          );

        if (slotChanged) {
          void this.refresh({ silent: true, skipNotify: true });
        }
      }
    );

    this._slotControllerSub ??= SlotController.on(SlotEvent.STATE_CHANGED, () => {
      this.renderAll({ silent: true });
    });

    this._appStateSub ??= AppState.subscribe(() => {
      this.renderAll({ silent: true });
    });

    this._i18nSub ??= AppI18n.subscribe(() => {
      this.renderAll({ silent: true });
    });

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

    const us1RefreshBtn = document.getElementById("conversation-refresh-us1");
    us1RefreshBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      void this.handleUs1Refresh();
    });
  }

  handleConversationChange(provider: string, options = { isInitial: false }): void {
    const select = this.selects[provider];
    if (!select) return;

    const conversationId = select.value;
    this.currentSelections[provider] = conversationId;

    this._clearMessagesArea(provider);

    const entry = this.entries.find((e) => e.id === conversationId && e.provider === provider);
    if (provider === "us1") {
      AppState.setActiveConversation("us1", conversationId === "new" ? null : conversationId);
      AppState.clearUs1PendingSession(entry?.localSessionId ?? null);
      if (conversationId !== "new") {
        AppState.clearUs1PendingSessionByConversation(conversationId);
      }
    } else {
      SlotController.navigate(provider as SlotId, entry?.webUrl ?? null);
    }

    if (!options.isInitial) {
      Logger.info(
        LogCategory.WEBVIEW,
        conversationListT("logs.userSelected", { provider, conversationId })
      );
    }

    window.dispatchEvent(
      new CustomEvent("conversation-selected", {
        detail: {
          provider,
          isNew: conversationId === "new",
          ...(provider === "us1" ? { localSessionId: entry?.localSessionId ?? null } : {}),
        },
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
      const us1AccountId = AppState.getUs1ArchiveAccountId();

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
      const us1Result =
        us1AccountId !== null && us1AccountId !== ""
          ? ((await electronApi.dbGetConversations({ accountId: us1AccountId })) as
              | { data: unknown[] }
              | undefined)
          : { data: [] };

      const ai1Entries = Array.isArray(ai1Result?.data) ? ai1Result.data : [];
      const ai2Entries = Array.isArray(ai2Result?.data) ? ai2Result.data : [];
      const us1Entries = Array.isArray(us1Result?.data) ? us1Result.data : [];
      const us1PendingSessions = AppState.getUs1PendingSessions();

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
        ...us1Entries.map((e: unknown) => {
          const entry = e as RawConversationEntry;
          const localSessionId = parseUs1SyntheticSessionUri(entry.webUrl)?.localSessionId ?? null;
          return {
            conversationId: String(entry.id ?? ""),
            id: String(entry.id ?? ""),
            webUrl: String(entry.webUrl ?? ""),
            provider: "us1" as const,
            mtime:
              Number(entry.updatedAt ?? entry.createdAt ?? 0) !== 0
                ? Number(entry.updatedAt ?? entry.createdAt ?? 0)
                : 0,
            folder: "",
            title: String(entry.title ?? ""),
            localSessionId,
            pendingUnreadCount:
              localSessionId !== null ? (us1PendingSessions[localSessionId]?.unreadCount ?? 0) : 0,
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
          targetProvider !== null && targetProvider !== ""
            ? [targetProvider]
            : ["ai1", "ai2", "us1"];

        await new Promise((resolve) =>
          setTimeout(resolve, ASSISTANT_TIMEOUTS.CONVERSATION_LIST_MICRO)
        );

        for (const p of providers) {
          const providerStr = p as string;
          const selections = this.currentSelections;
          const isNew = (selections[providerStr] ?? "new") === "new";
          window.dispatchEvent(
            new CustomEvent("conversation-selected", {
              detail: {
                provider: providerStr,
                isNew,
                ...(providerStr === "us1"
                  ? {
                      localSessionId:
                        this.entries.find(
                          (entry) =>
                            entry.provider === "us1" && entry.id === (selections[providerStr] ?? "")
                        )?.localSessionId ?? null,
                    }
                  : {}),
              },
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

    const hasAccount =
      provider === "us1" ? AppState.hasUs1Identity() === true : AppState.isAssigned(provider);
    select.disabled = !hasAccount;
    const refreshBtn = document.getElementById(
      `conversation-refresh-${provider}`
    ) as HTMLButtonElement | null;
    if (refreshBtn) {
      refreshBtn.disabled = !hasAccount;
    }

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
      const pendingUnreadCount = entry.pendingUnreadCount ?? 0;
      const optionLabel =
        provider === "us1" && pendingUnreadCount > 0
          ? `${entry.title} [new${pendingUnreadCount > 1 ? ` x${pendingUnreadCount}` : ""}]`
          : entry.title;
      const option = new Option(optionLabel, entry.id);
      option.dataset["folder"] = entry.folder;
      option.dataset["url"] = entry.webUrl;
      if (provider === "us1") {
        option.dataset["us1SessionId"] = entry.localSessionId ?? "";
        option.dataset["pendingUnreadCount"] = String(entry.pendingUnreadCount ?? 0);
      }
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
    this._appStateSub?.();
    this._i18nSub?.();
    this._settingsSub = null;
    this._slotControllerSub = null;
    this._appStateSub = null;
    this._i18nSub = null;
  }

  async handleUs1Refresh(): Promise<void> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined || typeof electronApi.us1SyncMessages !== "function") {
      return;
    }

    const selectedConversationId = this.currentSelections["us1"] ?? "new";
    const selectedEntry =
      selectedConversationId !== "new"
        ? this.entries.find(
            (entry) => entry.provider === "us1" && entry.id === selectedConversationId
          )
        : null;

    try {
      const ensureResult = await dispatchInternalSlotBridge(
        {
          action: "connection.ensure",
          toSlot: "us1",
        },
        {
          provider: "user",
          source: "user",
          fromSlot: "user",
        }
      );
      if (ensureResult.success !== true) {
        throw new Error(ensureResult.message ?? ensureResult.error ?? "US1 connection failed.");
      }

      const result = await dispatchInternalSlotBridge(
        {
          action: "session.sync",
          toSlot: "us1",
          ...(typeof selectedEntry?.localSessionId === "string" &&
          selectedEntry.localSessionId.trim() !== ""
            ? {
                sessionRef: {
                  id: selectedEntry.localSessionId.trim(),
                },
              }
            : {}),
        },
        {
          provider: "user",
          source: "user",
          fromSlot: "user",
        }
      );
      if (result.success !== true) {
        throw new Error(result.error ?? "US1 conversation refresh failed.");
      }

      const data = isRecord(result.data) ? result.data : {};
      const sessionEvents: Us1SessionEvent[] = Array.isArray(data["sessionEvents"])
        ? data["sessionEvents"].filter(isUs1SessionEvent)
        : [];
      for (const sessionEvent of sessionEvents) {
        if (
          sessionEvent.localSessionId === (selectedEntry?.localSessionId ?? null) ||
          sessionEvent.conversationId === selectedConversationId
        ) {
          AppState.clearUs1PendingSession(sessionEvent.localSessionId);
          AppState.clearUs1PendingSessionByConversation(sessionEvent.conversationId);
          continue;
        }

        const updatedAt = sessionEvent.sentAt ?? sessionEvent.createdAt;
        AppState.markUs1PendingSession(sessionEvent.localSessionId, {
          conversationId: sessionEvent.conversationId,
          unreadDelta: 1,
          ...(updatedAt !== undefined ? { updatedAt } : {}),
        });
      }

      await SettingsManager.reload();

      const forceSelectId = resolveUs1ForceSelectConversationId({
        selectedConversationId,
        resultConversationId:
          typeof result.session?.conversationId === "string"
            ? result.session.conversationId
            : typeof data["conversationId"] === "string"
              ? data["conversationId"]
              : null,
        sessionEvents,
        targetRemoteUserId:
          typeof data["remoteUserId"] === "string"
            ? data["remoteUserId"]
            : (AppState.getUs1Identity()?.remoteUserId ?? null),
        preserveExplicitNewSelection: true,
      });

      await this.refresh({
        silent: true,
        provider: "us1",
        ...(forceSelectId !== undefined ? { forceSelectId } : {}),
      });
    } catch (error) {
      Logger.error(
        LogCategory.WEBVIEW,
        conversationListT("logs.refreshError", { message: getErrorMessage(error) })
      );
    }
  }
}

const conversationListManager = new ConversationListManagerClass();

export { conversationListManager, conversationListManager as ConversationListManager };
