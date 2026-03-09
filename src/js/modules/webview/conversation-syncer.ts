import { LogCategory } from "@shared/logging-core";
import { ASSISTANT_TIMEOUTS } from "@timeouts";
/**
 * ConversationSyncer - conversation sync and archiving
 *
 * This module pulls conversation data from the webview and archives it:
 * - Extract messages with DOM scraping
 * - Sync with the archive system
 * - Coordinate with TrafficManager
 * - Trigger automatic sync when thinking returns to idle
 */

import { Logger } from "../logger/index.js";
import { waitForDomReady } from "./methods/shared/file-utils.js";
import { getErrorMessage } from "@shared/index.js";
import { TrafficManager } from "../traffic-manager.js";
import { CatchManager } from "../catch-manager.js";
import { AppState } from "../app-state.js";
import { SlotController } from "../slot-controller.js";
import { ConversationListManager } from "../conversation-list-manager.js";
import { getProvider } from "./provider-factory.js";
import { normalizeUrl, isSlotUrlExcluded, isDefaultPage } from "./methods/shared/url-utils.js";
import { PendingArchiveHandler } from "./pending-archive-handler.js";
import type { AppSettings } from "@shared/settings.js";

interface WebviewElement {
  getURL?: () => string;
  executeJavaScript: (script: string) => Promise<unknown>;
}

interface SyncResult {
  success: boolean;
  message?: string;
  conversationId?: string | undefined;
  commands?: { command: string; [key: string]: unknown }[] | undefined;
  [key: string]: unknown;
}

interface CoreEngine {
  handleCaughtCommand: (command: string, payload: Record<string, unknown>) => Promise<unknown>;
}

interface ScrapedMessage {
  role?: string;
  text?: string;
  content?: string;
  [key: string]: unknown;
}

interface DbSyncResult {
  success: boolean;
  error?: string | undefined;
  added?: number | undefined;
  total?: number | undefined;
  conversationId?: string | undefined;
}

interface DbMessagesResult {
  data?: ScrapedMessage[];
}

interface ConversationItem {
  webUrl?: string;
  messageCount?: number;
}

type ResolveWebviewFn = (slot: string) => WebviewElement | null;
type StableCallback = (err: Error | null, result: SyncResult | null) => void;

class ConversationSyncerClass {
  _settings: AppSettings | null;
  _syncInProgress: Record<string, boolean>;
  _lastThinkingState: Record<string, string>;
  _lastLoadingEnded: Record<string, number>;
  _syncRetryTimers: Record<string, ReturnType<typeof setTimeout>>;
  _syncRetryCounts: Record<string, number>;
  _stableListeners: Record<string, StableCallback[]>;
  _lastSyncResult: Record<string, SyncResult>;
  _trafficUnsubscribe: (() => void) | null;
  _coreEngine: CoreEngine | null;
  _resolveWebviewFn: ResolveWebviewFn | null;
  syncRetryLimit: number;
  syncRetryDelayMs: number;

  constructor() {
    this._settings = null;
    this._syncInProgress = {};
    this._lastThinkingState = { ai1: "idle", ai2: "idle" };
    this._lastLoadingEnded = { ai1: 0, ai2: 0 };
    this._syncRetryTimers = {};
    this._syncRetryCounts = {};
    this._stableListeners = {};
    this._lastSyncResult = {};
    this._trafficUnsubscribe = null;
    this._coreEngine = null;
    this._resolveWebviewFn = null;
    this.syncRetryLimit = 2;
    this.syncRetryDelayMs = 3000;
  }

  _hasReadableAssistant(messages: ScrapedMessage[] | undefined): boolean {
    if (messages === undefined || messages.length === 0) return false;
    const last = messages[messages.length - 1];
    const text = (last?.text ?? last?.content ?? "").trim();
    return last?.role === "assistant" && text !== "";
  }

  setSettings(settings: AppSettings | null): void {
    this._settings = settings;
  }

  init(coreEngine: CoreEngine, resolveWebviewFn: ResolveWebviewFn): void {
    this._coreEngine = coreEngine;
    this._resolveWebviewFn = resolveWebviewFn;

    if (this._trafficUnsubscribe) {
      this._trafficUnsubscribe();
    }

    this._trafficUnsubscribe = TrafficManager.onUpdate((snapshot) => {
      const provider = snapshot.provider;
      void (async (): Promise<void> => {
        try {
          const state = (snapshot.state ?? {}) as {
            thinkingState?: string;
            loadingJustEnded?: boolean;
            loadingEndedAt?: number;
          };
          if (provider === "") return;

          if (provider !== "ai1" && provider !== "ai2") {
            return;
          }

          const currentThinking = state.thinkingState ?? "idle";
          const prevThinking = this._lastThinkingState[provider] ?? "idle";
          this._lastThinkingState[provider] = currentThinking;

          if (prevThinking !== "idle" && currentThinking === "idle") {
            await this.syncProvider(provider, { from: "auto" });
          }

          if (
            state.loadingJustEnded === true &&
            state.loadingEndedAt !== undefined &&
            this._lastLoadingEnded[provider] !== undefined &&
            state.loadingEndedAt > this._lastLoadingEnded[provider]
          ) {
            this._lastLoadingEnded[provider] = state.loadingEndedAt;
            await new Promise((resolve) => setTimeout(resolve, ASSISTANT_TIMEOUTS.CONVERSATION_SYNC));
            await this.syncProvider(provider, { from: "auto" });
          }
        } catch (_err: unknown) {
          const errorMessage = _err instanceof Error ? _err.message : String(_err);
          Logger.warn(LogCategory.WEBVIEW, "Failed to check loading state", {
            provider,
            error: errorMessage,
          });
        }
      })();
    });

    Logger.info(LogCategory.WEBVIEW, "ConversationSyncer initialized");
  }

  /**
   * Checks whether the URL is excluded.
   * @deprecated Use isSlotUrlExcluded from url-utils.ts directly
   */
  isUrlExcluded(providerSlot: string, url: string): boolean {
    return isSlotUrlExcluded(providerSlot, url);
  }

  /**
   * Syncs the conversation (called by WebviewManager).
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview element
   * @param {Object} options - { catchEnabled }
   * @returns {Promise<Object>}
   */
  async syncConversation(
    provider: string,
    webview: Electron.WebviewTag | WebviewElement | null | undefined,
    options: { catchEnabled?: boolean } = {}
  ): Promise<SyncResult> {
    if (provider === "ai0") {
      return await this.syncLatestMessage(provider, webview);
    }

    if (webview === null || webview === undefined) {
      Logger.error(LogCategory.WEBVIEW, "Webview not found", { provider });
      return { success: false, message: "Webview bulunamadı" };
    }

    const currentUrl = webview.getURL?.() ?? "";
    if (this.isUrlExcluded(provider, currentUrl)) {
      Logger.warn(LogCategory.WEBVIEW, "URL excluded, sync operation disabled", {
        provider,
        currentUrl,
      });
      return { success: false, message: "URL excluded from operations" };
    }

    const providerId = AppState.getProviderIdForSlot(provider);
    if (providerId !== null && isDefaultPage(currentUrl, providerId)) {
      return { success: false, message: "default-page" };
    }

    if (this._syncInProgress[provider] === true) {
      Logger.debug(LogCategory.WEBVIEW, "sync skipped: already in progress", { provider });
      return { success: false, message: "sync-in-progress" };
    }
    this._syncInProgress[provider] = true;

    try {
      await waitForDomReady(webview as never);

      const providerId = AppState.getProviderIdForSlot(provider);
      const providerModule = providerId !== null ? getProvider(providerId) : null;

      if (
        providerModule === null ||
        providerModule === undefined ||
        typeof providerModule["scrapeMessages"] !== "function"
      ) {
        throw new Error(`Provider module or scrapeMessages function for "${provider}" not found.`);
      }

      const messages = (await webview.executeJavaScript(
        `(${providerModule["scrapeMessages"].toString()})();`
      )) as ScrapedMessage[] | null | undefined;

      const rawUrl = webview.getURL?.() ?? "";
      const webUrl = normalizeUrl(rawUrl);

      const { existing, prevCount, newEntry } = await this._getArchiveStatus(provider, webUrl);

      if (
        messages === null ||
        messages === undefined ||
        !Array.isArray(messages) ||
        messages.length === 0
      ) {
        this._syncInProgress[provider] = false;
        return {
          success: true,
          count: 0,
          messages: [],
          commands: [],
          webUrl,
          newEntry: false,
        };
      }

      // In relay mode the user-side author actually comes from the peer AI.
      const relayState = AppState.getAssistantRelay();
      const isRelayActive = relayState.active === true;
      const relaySource =
        isRelayActive && relayState.sourceSlot !== null ? relayState.sourceSlot : undefined;

      const authors = {
        user:
          isRelayActive && relaySource !== undefined && relaySource !== ""
            ? AppState.getNickname(relaySource)
            : AppState.getNickname("user"),
        ai: AppState.getNickname(provider),
      };

      const normalized: ScrapedMessage[] = messages.map((m: ScrapedMessage) => {
        // If the message contains a hev-sender tag (++cmd delivery), override the author.
        const textContent =
          typeof m.text === "string" ? m.text : typeof m.content === "string" ? m.content : "";
        const senderMatch = /<!--\s*hev-sender:([^-]+?)\s*-->/.exec(textContent);
        const senderOverride = senderMatch?.[1]?.trim();
        return {
          ...m,
          // Remove the tag from the stored text.
          text:
            senderMatch !== null
              ? textContent.replace(/\s*<!--\s*hev-sender:[^-]+?\s*-->\s*/, "").trim()
              : (m.text ?? m.content ?? ""),
          author:
            senderOverride !== undefined && senderOverride !== ""
              ? senderOverride
              : m.role === "assistant"
                ? authors.ai
                : authors.user,
          ts: Date.now(),
        };
      });

      const slots = this._settings?.slots as
        | Record<string, { catchCommands?: boolean }>
        | undefined;
      const catchEnabled = options.catchEnabled ?? slots?.[provider]?.catchCommands ?? true;

      const commands = catchEnabled
        ? CatchManager.catchCommands({
            provider,
            webUrl,
            messages: normalized,
            prevCount,
            hasExisting: existing !== null,
          })
        : [];

      const accountInfo = AppState.getAccountForSlot(provider);

      if (accountInfo?.id === undefined || accountInfo.id === "") {
        Logger.warn(LogCategory.WEBVIEW, "Sync skipped: No account info for slot", { provider });
        this._syncInProgress[provider] = false;
        return { success: false, message: "No account assigned to slot" };
      }

      const syncResult = (await window.electronAPI?.dbSyncMessages({
        accountId: accountInfo.id,
        webUrl,
        messages: normalized,
        authors,
      })) as DbSyncResult | undefined;

      if (syncResult?.success !== true) {
        throw new Error(syncResult?.error ?? "Database sync failed");
      }

      const dbMessagesResult = (await window.electronAPI?.dbGetMessages({
        accountId: accountInfo.id,
        conversationId: syncResult.conversationId,
      })) as DbMessagesResult | undefined;

      const finalMessages: ScrapedMessage[] = dbMessagesResult?.data ?? normalized;

      const lastMsg = finalMessages[finalMessages.length - 1];
      if (lastMsg !== undefined && lastMsg.role !== "user") {
        const result: SyncResult = {
          success: true,
          count: normalized.length,
          messages: finalMessages,
          commands,
          webUrl,
          newEntry,
          added: syncResult.added,
          total: syncResult.total,
          ...(syncResult.conversationId !== undefined && {
            conversationId: syncResult.conversationId,
          }),
        };

        try {
          PendingArchiveHandler.processPending(provider, result);
        } catch (err) {
          Logger.warn(
            LogCategory.WEBVIEW,
            "Pending archive processing failed in syncConversation",
            {
              provider,
              error: getErrorMessage(err),
            }
          );
        }

        return result;
      }

      const result: SyncResult = {
        success: true,
        count: normalized.length,
        messages: finalMessages,
        commands,
        webUrl,
        newEntry,
        added: syncResult.added,
        total: syncResult.total,
        ...(syncResult.conversationId !== undefined && {
          conversationId: syncResult.conversationId,
        }),
      };
      return result;
    } catch (error) {
      Logger.error(LogCategory.WEBVIEW, "Sync failed", { provider, error: getErrorMessage(error) });
      return { success: false, message: getErrorMessage(error) };
    } finally {
      this._syncInProgress[provider] = false;
    }
  }

  async syncLatestMessage(
    provider: string,
    webview: Electron.WebviewTag | WebviewElement | null | undefined
  ): Promise<SyncResult> {
    if (webview === null || webview === undefined) {
      Logger.error(LogCategory.WEBVIEW, "Webview not found", { provider });
      return { success: false, message: "Webview bulunamadı" };
    }

    const currentUrl = webview.getURL?.() ?? "";
    if (this.isUrlExcluded(provider, currentUrl)) {
      Logger.warn(LogCategory.WEBVIEW, "URL excluded, latest-message sync disabled", {
        provider,
        currentUrl,
      });
      return { success: false, message: "URL excluded from operations" };
    }

    const providerId = AppState.getProviderIdForSlot(provider);
    if (providerId !== null && isDefaultPage(currentUrl, providerId)) {
      return { success: false, message: "default-page" };
    }

    try {
      await waitForDomReady(webview as never);

      const providerModule = providerId !== null ? getProvider(providerId) : null;
      if (
        providerModule === null ||
        providerModule === undefined ||
        typeof providerModule["scrapeMessages"] !== "function"
      ) {
        throw new Error(`Provider module or scrapeMessages function for "${provider}" not found.`);
      }

      const messages = (await webview.executeJavaScript(
        `(${providerModule["scrapeMessages"].toString()})();`
      )) as ScrapedMessage[] | null | undefined;

      const webUrl = normalizeUrl(currentUrl);

      if (!Array.isArray(messages) || messages.length === 0) {
        return {
          success: true,
          count: 0,
          messages: [],
          commands: [],
          webUrl,
          newEntry: false,
        };
      }

      const lastAssistant = [...messages]
        .reverse()
        .find(
          (msg) => (msg.role ?? "") === "assistant" && (msg.text ?? msg.content ?? "").trim() !== ""
        );

      const finalMessages = lastAssistant !== undefined ? [lastAssistant] : [];

      return {
        success: true,
        count: finalMessages.length,
        messages: finalMessages,
        commands: [],
        webUrl,
        newEntry: false,
      };
    } catch (error) {
      Logger.error(LogCategory.WEBVIEW, "Latest message sync failed", {
        provider,
        error: getErrorMessage(error),
      });
      return { success: false, message: getErrorMessage(error) };
    }
  }

  /**
   * Syncs the provider (moved from SyncHandler).
   * @param {string} provider - Slot ID
   * @param {Object} opts - { from: 'auto' | 'manual' | 'retry' }
   * @returns {Promise<Object>}
   */
  async syncProvider(provider: string, opts: { from?: string } = {}): Promise<SyncResult> {
    if (provider === "") return { success: false, message: "no-provider" };

    if (opts.from === "manual") {
      if (this._syncRetryTimers[provider] !== undefined) {
        clearTimeout(this._syncRetryTimers[provider]);
      }
      this._syncRetryCounts[provider] = 0;
    }

    this._setSyncStatus(provider, "syncing");

    try {
      Logger.info(LogCategory.WEBVIEW, "syncProvider called", {
        provider,
        source: opts.from ?? "manual",
      });

      const webview = this._resolveWebviewFn?.(provider);
      const res = await this.syncConversation(provider, webview);

      this._setSyncStatus(provider, res.success ? "success" : "error");

      this._lastSyncResult[provider] = res;

      window.dispatchEvent(
        new CustomEvent("sync-complete", {
          detail: { provider, result: res, source: opts.from ?? "manual" },
        })
      );

      const messages = res["messages"] as ScrapedMessage[] | undefined;
      const stableAfter = this._hasReadableAssistant(messages);

      if (stableAfter) {
        this._notifyStable(provider, res);
      }

      const from = opts.from ?? "manual";
      const shouldRetryByReadiness =
        (from === "auto" || from === "retry") &&
        res.success === true &&
        this._hasReadableAssistant(messages) === false;

      if (shouldRetryByReadiness) {
        const tried = this._syncRetryCounts[provider] ?? 0;
        if (tried < this.syncRetryLimit) {
          Logger.debug(
            LogCategory.WEBVIEW,
            "SyncProvider: assistant not readable, scheduling retry",
            {
              provider,
              tried,
              messageCount: messages?.length ?? 0,
            }
          );
          this._syncRetryCounts[provider] = tried + 1;
          this._syncRetryTimers[provider] = setTimeout(() => {
            if (SlotController.isConnected(provider) === true) {
              void this.syncProvider(provider, { from: "retry" });
            }
          }, this.syncRetryDelayMs);
        }
      } else {
        if (this._syncRetryTimers[provider] !== undefined) {
          clearTimeout(this._syncRetryTimers[provider]);
        }
        this._syncRetryCounts[provider] = 0;
      }

      if (res.success) {
        const refreshOpts: {
          silent: boolean;
          provider: string;
          skipNotify: boolean;
          forceSelectId?: string;
        } = {
          silent: true,
          provider,
          skipNotify: false,
        };
        if ("conversationId" in res && res.conversationId !== undefined) {
          refreshOpts.forceSelectId = res.conversationId;
        }
        await ConversationListManager.refresh(refreshOpts);
      }

      if (res.commands !== undefined && res.commands.length > 0 && this._coreEngine !== null) {
        const coreEngine = this._coreEngine;
        await res.commands.reduce(async (prev, cmd) => {
          await prev;
          await coreEngine.handleCaughtCommand(cmd.command, {
            ...cmd,
            source: opts.from ?? "auto",
          });
        }, Promise.resolve());
      }

      return res;
    } catch (err) {
      const message = err instanceof Error ? getErrorMessage(err) : String(err);
      Logger.error(LogCategory.WEBVIEW, "syncProvider error", { provider, error: message });
      this._setSyncStatus(provider, "error", message);
      return { success: false, message };
    }
  }

  /**
   * Stable durumunu bildir
   * @private
   */
  _notifyStable(provider: string, res: SyncResult): void {
    try {
      const list = this._stableListeners[provider] ?? [];
      delete this._stableListeners[provider];

      for (const cb of list) {
        try {
          cb(null, res);
        } catch (_e: unknown) {
          const errorMessage = _e instanceof Error ? _e.message : String(_e);
          Logger.warn(LogCategory.WEBVIEW, "Stable callback failed", {
            provider,
            error: errorMessage,
          });
        }
      }

      try {
        PendingArchiveHandler.processPending(provider, res);
      } catch (_e: unknown) {
        const errorMessage = _e instanceof Error ? _e.message : String(_e);
        Logger.warn(LogCategory.WEBVIEW, "Pending archive processing failed", {
          provider,
          error: errorMessage,
        });
      }
    } catch (_e: unknown) {
      const errorMessage = _e instanceof Error ? _e.message : String(_e);
      Logger.warn(LogCategory.WEBVIEW, "Notify stable failed", { provider, error: errorMessage });
    }
  }

  addStableListener(provider: string, callback: StableCallback): void {
    this._stableListeners[provider] ??= [];
    this._stableListeners[provider].push(callback);
  }

  cancelListeners(provider: string): void {
    if (this._stableListeners[provider] !== undefined) {
      delete this._stableListeners[provider];
    }

    if (this._syncRetryTimers[provider] !== undefined) {
      clearTimeout(this._syncRetryTimers[provider]);
      delete this._syncRetryTimers[provider];
    }
    delete this._syncRetryCounts[provider];
  }

  getLastSyncResult(provider: string): SyncResult | null {
    return this._lastSyncResult[provider] ?? null;
  }

  /**
   * Archive durumunu getir (DB'den)
   * @private
   */
  async _getArchiveStatus(
    provider: string,
    webUrl: string
  ): Promise<{ existing: ConversationItem | null; prevCount: number; newEntry: boolean }> {
    try {
      const accountInfo = AppState.getAccountForSlot(provider);
      if (accountInfo?.id === undefined || accountInfo.id === "") {
        return { existing: null, prevCount: 0, newEntry: true };
      }

      const conversations = (await window.electronAPI?.dbGetConversations({
        accountId: accountInfo.id,
      })) as ConversationItem[] | undefined;

      const existing =
        (conversations ?? []).find((item) => normalizeUrl(item.webUrl as string) === webUrl) ??
        null;

      return {
        existing,
        prevCount: existing?.messageCount ?? 0,
        newEntry: existing === null,
      };
    } catch (_error) {
      return { existing: null, prevCount: 0, newEntry: true };
    }
  }

  _setSyncStatus(
    provider: string,
    status: "syncing" | "success" | "error",
    message?: string
  ): void {
    const event = new CustomEvent("sync-status-changed", {
      detail: { provider, status, message },
    });
    window.dispatchEvent(event);
  }

  destroy(): void {
    if (this._trafficUnsubscribe !== null) {
      this._trafficUnsubscribe();
      this._trafficUnsubscribe = null;
    }

    Object.values(this._syncRetryTimers).forEach((timer) => {
      clearTimeout(timer);
    });
    this._syncRetryTimers = {};
    this._syncRetryCounts = {};
    this._stableListeners = {};

    this._syncInProgress = {};
    this._lastSyncResult = {};
    this._coreEngine = null;
    this._resolveWebviewFn = null;

    Logger.debug(LogCategory.WEBVIEW, "ConversationSyncer destroyed");
  }
}

const conversationSyncer = new ConversationSyncerClass();
export { conversationSyncer as ConversationSyncer };
