/**
 * ConversationSyncer - Konuşma senkronizasyonu ve arşivleme
 *
 * Bu modül webview'dan konuşma verilerini çeker ve arşivler:
 * - DOM scraping ile mesaj çıkarma
 * - Archive sistemiyle senkronizasyon
 * - TrafficManager ile koordinasyon
 * - Otomatik sync (thinking idle olunca)
 */

import { LogManager } from "../log-manager.js";
import { getErrorMessage } from "../../types/index.js";
import { TrafficManager } from "../traffic-manager.js";
import { CatchManager } from "../catch-manager.js";
import { AppState } from "../app-state.js";
import { SlotController } from "../slot-controller.js";
import { ConversationListManager } from "../conversation-list-manager.js";
import { getProvider } from "./provider-factory.js";
import { normalizeUrl, isSlotUrlExcluded, isDefaultPage } from "./methods/shared/url-utils.js";
import { waitForDomReady } from "../../app.js";
import { PendingArchiveHandler } from "./pending-archive-handler.js";
import type { AppSettings } from "../../types/settings.js";

// ============================================================================
// Types
// ============================================================================

interface WebviewElement {
  getURL?: () => string;
  executeJavaScript: (script: string) => Promise<unknown>;
}

interface SyncResult {
  success: boolean;
  message?: string;
  conversationId?: string;
  commands?: { command: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

interface CoreEngine {
  handleCaughtCommand: (command: string, payload: Record<string, unknown>) => Promise<unknown>;
}

type ResolveWebviewFn = (slot: string) => WebviewElement | null;
type StableCallback = (err: Error | null, result: SyncResult | null) => void;

// ============================================================================
// ConversationSyncerClass
// ============================================================================

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
  }

  /**
   * Ayarları güncelle
   */
  setSettings(settings: AppSettings | null): void {
    this._settings = settings;
  }

  /**
   * Syncer'ı başlat
   */
  init(coreEngine: CoreEngine, resolveWebviewFn: ResolveWebviewFn): void {
    this._coreEngine = coreEngine;
    this._resolveWebviewFn = resolveWebviewFn;

    if (this._trafficUnsubscribe) {
      this._trafficUnsubscribe();
    }

    this._trafficUnsubscribe = TrafficManager.onUpdate(async (snapshot) => {
      try {
        const provider = snapshot?.provider;
        const state = (snapshot?.state || {}) as { thinkingState?: string; loadingJustEnded?: boolean; loadingEndedAt?: number };
        if (!provider) return;

        const currentThinking = state.thinkingState || "idle";
        const prevThinking = this._lastThinkingState[provider] || "idle";
        this._lastThinkingState[provider] = currentThinking;

        if (prevThinking !== "idle" && currentThinking === "idle") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await this.syncProvider(provider, { from: "auto" });
        }

        if (state.loadingJustEnded && state.loadingEndedAt && this._lastLoadingEnded[provider] !== undefined && state.loadingEndedAt > this._lastLoadingEnded[provider]) {
          this._lastLoadingEnded[provider] = state.loadingEndedAt;
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await this.syncProvider(provider, { from: "auto" });
        }
      } catch (_err) {}
    });

    LogManager.addEvent("sync", "info", "ConversationSyncer initialized", { visibility: 2 });
  }

  /**
   * URL excluded mı kontrol et
   * @deprecated Use isSlotUrlExcluded from url-utils.ts directly
   */
  isUrlExcluded(providerSlot: string, url: string): boolean {
    return isSlotUrlExcluded(providerSlot, url);
  }

  /**
   * Konuşmayı senkronize et (WebviewManager'dan çağrılır)
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview elementi
   * @param {Object} options - { catchEnabled }
   * @returns {Promise<Object>}
   */
  async syncConversation(provider: string, webview: Electron.WebviewTag | WebviewElement | null | undefined, options: { catchEnabled?: boolean } = {}) {
    if (!webview) {
      LogManager.addEvent(`webview-${provider}`, "error", "Webview bulunamadı");
      return { success: false, message: "Webview bulunamadı" };
    }

    const currentUrl = webview.getURL?.() || "";
    if (this.isUrlExcluded(provider, currentUrl)) {
      LogManager.addEvent(
        `webview-${provider}`,
        "warning",
        `URL excluded: ${currentUrl}, sync operation disabled`
      );
      return { success: false, message: "URL excluded from operations" };
    }

    // Default page kontrolü - ana sayfada sync yapma
    const providerId = AppState.getProviderIdForSlot(provider);
    if (providerId && isDefaultPage(currentUrl, providerId)) {
      LogManager.addEvent(
        `webview-${provider}`,
        "info",
        `Default page, sync skipped: ${currentUrl}`,
        { visibility: 3 }
      );
      return { success: false, message: "default-page" };
    }

    if (this._syncInProgress[provider]) {
      LogManager.addEvent(`webview-${provider}`, "info", "sync skipped: already in progress", { visibility: 3 });
      return { success: false, message: "sync-in-progress" };
    }
    this._syncInProgress[provider] = true;

    try {
      await waitForDomReady(webview as any);

      const providerId = AppState.getProviderIdForSlot(provider);
      const providerModule = providerId ? getProvider(providerId) : null;

      if (!providerModule || typeof providerModule.scrapeMessages !== "function") {
        throw new Error(`Provider module or scrapeMessages function for "${provider}" not found.`);
      }

      const messages = await webview.executeJavaScript(
        `(${providerModule.scrapeMessages.toString()})();`
      );

      const rawUrl = webview.getURL?.() || "";
      const webUrl = normalizeUrl(rawUrl);

      const { existing, prevCount, newEntry } = await this._getArchiveStatus(provider, webUrl);

      if (!messages || messages.length === 0) {
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

      const authors = {
        user: AppState.getNickname("user"),
        ai: AppState.getNickname(provider),
      };

      const normalized = messages.map((m: { role?: string; [key: string]: unknown }) => ({
        ...m,
        author: m.role === "assistant" ? authors.ai : authors.user,
        ts: Date.now(),
      }));

      const slots = this._settings?.slots as Record<string, { catchCommands?: boolean }> | undefined;
      const catchEnabled =
        options.catchEnabled ?? slots?.[provider]?.catchCommands ?? true;

      const commands = catchEnabled
        ? await CatchManager.catchCommands({
            provider,
            webUrl,
            messages: normalized,
            prevCount,
            hasExisting: !!existing,
          })
        : [];

      const accountInfo = AppState.getAccountForSlot(provider);

      if (!accountInfo?.id) {
        LogManager.addEvent(
          `webview-${provider}`,
          "warning",
          `Sync skipped: No account info for slot ${provider}`
        );
        this._syncInProgress[provider] = false;
        return { success: false, message: "No account assigned to slot" };
      }

      // Database sync (incremental - sadece yeni mesajları ekler)
      const syncResult = await window.electronAPI?.dbSyncMessages?.({
        accountId: accountInfo.id,
        webUrl,
        messages: normalized,
        authors,
      });

      if (!syncResult?.success) {
        throw new Error(syncResult?.error || "Database sync failed");
      }

      // Fetch messages with IDs from DB
      const dbMessagesResult = await window.electronAPI?.dbGetMessages?.({
        accountId: accountInfo.id,
        conversationId: syncResult.conversationId,
      });

      return {
        success: true,
        count: normalized.length,
        messages: dbMessagesResult?.data ?? normalized,
        commands,
        webUrl,
        newEntry,
        added: syncResult.added,
        total: syncResult.total,
        conversationId: syncResult.conversationId,
      };
    } catch (error) {
      LogManager.addEvent(
        `webview-${provider}`,
        "error",
        `Sync failed: ${getErrorMessage(error)}`
      );
      return { success: false, message: getErrorMessage(error) };
    } finally {
      this._syncInProgress[provider] = false;
    }
  }

  /**
   * Provider'ı senkronize et (SyncHandler'dan taşındı)
   * @param {string} provider - Slot ID
   * @param {Object} opts - { from: 'auto' | 'manual' | 'retry' }
   * @returns {Promise<Object>}
   */
  async syncProvider(provider: string, opts: { from?: string } = {}) {
    if (!provider) return { success: false, message: "no-provider" };

    if (opts?.from === "manual") {
      if (this._syncRetryTimers[provider]) {
        clearTimeout(this._syncRetryTimers[provider]);
      }
      this._syncRetryCounts[provider] = 0;
    }

    try {
      LogManager.addEvent(
        "sync",
        "info",
        `syncProvider called for ${provider} (source=${opts.from || "manual"})`
      );

      const webview = this._resolveWebviewFn?.(provider);
      const res = await this.syncConversation(provider, webview);

      this._lastSyncResult[provider] = res;

      const lastAfter = res.messages?.[res.messages.length - 1];
      const stableAfter = lastAfter?.role && lastAfter.role !== "user";

      if (stableAfter) {
        this._notifyStable(provider, res);
      }

      if (!res) return { success: false, message: "no-result" };
      if (res.count === 0) return res;

      const last = res.messages?.[res.messages.length - 1];
      if (last?.role === "user") {
        const tried = this._syncRetryCounts[provider] || 0;
        if (tried < this.syncRetryLimit) {
          LogManager.addEvent(
            "sync",
            "info",
            `SyncProvider: last message is user for ${provider}, scheduling retry...`
          );
          this._syncRetryCounts[provider] = tried + 1;
          this._syncRetryTimers[provider] = setTimeout(() => {
            if (SlotController.isConnected(provider)) {
              this.syncProvider(provider, { from: "retry" });
            }
          }, 3000);
        }
      } else {
        if (this._syncRetryTimers[provider]) {
          clearTimeout(this._syncRetryTimers[provider]);
        }
        this._syncRetryCounts[provider] = 0;
      }

      if (res.success) {
        await ConversationListManager.refresh({
          silent: true,
          forceSelectId: res.conversationId,
          provider, // Sadece bu provider için mesaj listesini güncelle
        });
      }

      if (res.commands && res.commands.length > 0 && this._coreEngine) {
        for (const cmd of res.commands) {
          await this._coreEngine.handleCaughtCommand(cmd.command, {
            ...cmd,
            source: opts.from || "auto",
          });
        }
      }

      return res;
    } catch (err) {
      const message = err instanceof Error ? getErrorMessage(err) : String(err);
      LogManager.addEvent("sync", "error", `syncProvider error for ${provider}: ${message}`);
      return { success: false, message };
    }
  }

  /**
   * Stable durumunu bildir
   * @private
   */
  _notifyStable(provider: string, res: SyncResult): void {
    try {
      const list = this._stableListeners[provider] || [];
      delete this._stableListeners[provider];

      for (const cb of list) {
        try {
          cb(null, res);
        } catch (_e) {}
      }

      try {
        PendingArchiveHandler.processPending(provider, res);
      } catch (_e) {}
    } catch (_e) {}
  }

  /**
   * Stable listener ekle
   */
  addStableListener(provider: string, callback: StableCallback): void {
    if (!this._stableListeners[provider]) {
      this._stableListeners[provider] = [];
    }
    this._stableListeners[provider].push(callback);
  }

  /**
   * Belirli bir provider için bekleyen tüm listener'ları iptal et
   */
  cancelListeners(provider: string): void {
    if (this._stableListeners[provider]) {
      LogManager.addEvent("sync", "info", `Canceling listeners for ${provider}`, { visibility: 3 });
      delete this._stableListeners[provider];
    }

    // Retry timer'larını da temizle
    if (this._syncRetryTimers[provider]) {
      clearTimeout(this._syncRetryTimers[provider]);
      delete this._syncRetryTimers[provider];
    }
    delete this._syncRetryCounts[provider];
  }

  /**
   * Son sync sonucunu getir
   */
  getLastSyncResult(provider: string): SyncResult | null {
    return this._lastSyncResult[provider] || null;
  }

  /**
   * Archive durumunu getir (DB'den)
   * @private
   */
  async _getArchiveStatus(provider: string, webUrl: string): Promise<{ existing: unknown; prevCount: number; newEntry: boolean }> {
    try {
      const accountInfo = AppState.getAccountForSlot(provider);
      if (!accountInfo?.id) {
        return { existing: null, prevCount: 0, newEntry: true };
      }

      const conversations = await window.electronAPI?.dbGetConversations?.({
        accountId: accountInfo.id,
      }) as Array<{ webUrl?: string; messageCount?: number }> | undefined;

      const existing =
        (conversations || []).find((item) => normalizeUrl(item.webUrl as string) === webUrl) || null;

      return {
        existing,
        prevCount: (existing?.messageCount || 0) as number,
        newEntry: !existing,
      };
    } catch (_error) {
      return { existing: null, prevCount: 0, newEntry: true };
    }
  }

  /**
   * Cleanup (destroy için)
   */
  destroy() {
    if (this._trafficUnsubscribe) {
      this._trafficUnsubscribe();
      this._trafficUnsubscribe = null;
    }

    Object.values(this._syncRetryTimers).forEach((timer) => {
      clearTimeout(timer);
    });
    this._syncRetryTimers = {};
    this._syncRetryCounts = {};
    this._stableListeners = {};
  }
}

export const ConversationSyncer = new ConversationSyncerClass();
