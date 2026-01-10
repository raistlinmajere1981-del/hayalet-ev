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
import { TrafficManager } from "../traffic-manager.js";
import { CatchManager } from "../catch-manager.js";
import { AppState } from "../app-state.js";
import { SlotController } from "../slot-controller.js";
import { ConversationListManager } from "../conversation-list-manager.js";
import { ProviderRegistry } from "./provider-registry.js";
import { getProvider } from "./provider-factory.js";
import { normalizeUrl, isUrlExcluded as checkUrlExcluded } from "./methods/shared/url-utils.js";
import { waitForDomReady } from "../../app.js";
import { PendingArchiveHandler } from "./pending-archive-handler.js";

class ConversationSyncerClass {
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
   * @param {Object} settings - Uygulama ayarları
   */
  setSettings(settings) {
    this._settings = settings;
  }

  /**
   * Syncer'ı başlat
   * @param {Object} coreEngine - CoreEngine instance
   * @param {Function} resolveWebviewFn - Webview resolve fonksiyonu
   */
  init(coreEngine, resolveWebviewFn) {
    this._coreEngine = coreEngine;
    this._resolveWebviewFn = resolveWebviewFn;

    // Önceki listener varsa kaldır
    if (this._trafficUnsubscribe) {
      this._trafficUnsubscribe();
    }

    // TrafficManager'dan otomatik sync tetiklemesi
    this._trafficUnsubscribe = TrafficManager.onUpdate(async (snapshot) => {
      try {
        const provider = snapshot?.provider;
        const state = snapshot?.state || {};
        if (!provider) return;

        const currentThinking = state.thinkingState || "idle";
        const prevThinking = this._lastThinkingState[provider] || "idle";
        this._lastThinkingState[provider] = currentThinking;

        // Thinking idle olunca sync yap
        if (prevThinking !== "idle" && currentThinking === "idle") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await this.syncProvider(provider, { from: "auto" });
        }

        // Loading bitince sync yap
        if (
          state.loadingJustEnded &&
          state.loadingEndedAt > this._lastLoadingEnded[provider]
        ) {
          this._lastLoadingEnded[provider] = state.loadingEndedAt;
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await this.syncProvider(provider, { from: "auto" });
        }
      } catch (_err) {
        // Silent fail
      }
    });

    LogManager.addEvent("sync", "info", "ConversationSyncer initialized");
  }

  /**
   * Slot için provider ID'sini getir
   * @param {string} slot - Slot ID
   * @returns {string}
   */
  getProviderIdForSlot(slot) {
    const account = this._getAccountForSlot(slot);
    return account?.provider || "";
  }

  /**
   * URL excluded mı kontrol et
   * @param {string} providerSlot - Slot ID
   * @param {string} url - Kontrol edilecek URL
   * @returns {boolean}
   */
  isUrlExcluded(providerSlot, url) {
    const providerId = this.getProviderIdForSlot(providerSlot);
    if (!providerId || !url) return false;

    const cfg = ProviderRegistry.get(providerId);
    if (!cfg?.excludedUrls?.length) return false;

    return checkUrlExcluded(url, cfg.excludedUrls);
  }

  /**
   * Konuşmayı senkronize et (WebviewManager'dan çağrılır)
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview elementi
   * @param {Object} options - { catchEnabled }
   * @returns {Promise<Object>}
   */
  async syncConversation(provider, webview, options = {}) {
    if (!webview) {
      LogManager.addEvent(`webview-${provider}`, "error", "Webview bulunamadı");
      return { success: false, message: "Webview bulunamadı" };
    }

    // URL exclusion kontrolü
    const currentUrl = webview.getURL?.() || "";
    if (this.isUrlExcluded(provider, currentUrl)) {
      LogManager.addEvent(
        `webview-${provider}`,
        "warning",
        `URL excluded: ${currentUrl}, sync operation disabled`,
      );
      return { success: false, message: "URL excluded from operations" };
    }

    // Çift sync önleme
    if (this._syncInProgress[provider]) {
      LogManager.addEvent(
        `webview-${provider}`,
        "info",
        "sync skipped: already in progress",
      );
      return { success: false, message: "sync-in-progress" };
    }
    this._syncInProgress[provider] = true;

    try {
      await waitForDomReady(webview);

      const providerId = this.getProviderIdForSlot(provider);
      const providerModule = providerId ? getProvider(providerId) : null;
      
      if (!providerModule || typeof providerModule.scrapeMessages !== "function") {
        throw new Error(
          `Provider module or scrapeMessages function for "${provider}" not found.`,
        );
      }

      // DOM'dan mesajları çek
      const messages = await webview.executeJavaScript(
        `(${providerModule.scrapeMessages.toString()})();`,
      );

      const rawUrl = webview.getURL() || "";
      const webUrl = normalizeUrl(rawUrl);

      // Archive durumunu kontrol et
      const { existing, prevCount, newEntry } = await this._getArchiveStatus(
        provider,
        webUrl,
      );

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

      // Author bilgilerini ekle
      const authors = {
        user: AppState.getNickname("user"),
        ai: AppState.getNickname(provider),
      };

      const normalized = messages.map((m) => ({
        ...m,
        author: m.role === "assistant" ? authors.ai : authors.user,
        ts: Date.now(),
      }));

      // Komut yakalama
      const catchEnabled =
        options.catchEnabled ??
        this._settings?.slots?.[provider]?.catchCommands ??
        true;
      
      const commands = catchEnabled
        ? await CatchManager.catchCommands({
            provider,
            webUrl,
            messages: normalized,
            prevCount,
            hasExisting: !!existing,
          })
        : [];

      // Archive'a kaydet
      const accountInfo = this._getAccountForSlot(provider);
      const archiveResult = await window.electronAPI.archiveSync({
        provider,
        webUrl,
        messages: normalized,
        authors,
        updateIndex: newEntry,
        accountInfo,
      });

      if (!archiveResult?.success) {
        throw new Error(archiveResult?.error || "Archive sync failed");
      }

      return {
        success: true,
        count: normalized.length,
        messages: normalized,
        commands,
        webUrl,
        newEntry,
        meta: archiveResult.meta,
      };
    } catch (error) {
      LogManager.addEvent(
        `webview-${provider}`,
        "error",
        `Sync failed: ${error?.message || error}`,
      );
      return { success: false, message: error?.message || String(error) };
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
  async syncProvider(provider, opts = {}) {
    if (!provider) return { success: false, message: "no-provider" };

    // Manual sync'te retry'ları sıfırla
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
        `syncProvider called for ${provider} (source=${opts.from || "manual"})`,
      );

      // Webview'ı çöz
      const webview = this._resolveWebviewFn?.(provider);
      const res = await this.syncConversation(provider, webview);
      
      this._lastSyncResult[provider] = res;

      // Stable kontrolü (son mesaj assistant ise)
      const lastAfter = res.messages?.[res.messages.length - 1];
      const stableAfter = lastAfter && lastAfter.role && lastAfter.role !== "user";
      
      if (stableAfter) {
        this._notifyStable(provider, res);
      }

      if (!res) return { success: false, message: "no-result" };
      if (res.count === 0) return res;

      // Son mesaj user ise retry planla
      const last = res.messages?.[res.messages.length - 1];
      if (last?.role === "user") {
        const tried = this._syncRetryCounts[provider] || 0;
        if (tried < this.syncRetryLimit) {
          LogManager.addEvent(
            "sync",
            "info",
            `SyncProvider: last message is user for ${provider}, scheduling retry...`,
          );
          this._syncRetryCounts[provider] = tried + 1;
          this._syncRetryTimers[provider] = setTimeout(() => {
            if (SlotController.isConnected(provider)) {
              this.syncProvider(provider, { from: "retry" });
            }
          }, 3000);
        }
      } else {
        // Retry'ları temizle
        if (this._syncRetryTimers[provider]) {
          clearTimeout(this._syncRetryTimers[provider]);
        }
        this._syncRetryCounts[provider] = 0;
      }

      // Conversation listesini güncelle
      if (res.success) {
        await ConversationListManager.refresh({
          silent: true,
          forceSelectId: res.meta?.id,
        });
      }

      // Yakalanan komutları işle
      if (res.commands?.length > 0 && this._coreEngine) {
        for (const cmd of res.commands) {
          await this._coreEngine.handleCaughtCommand(cmd.command, {
            ...cmd,
            source: opts.from || "auto",
          });
        }
      }

      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      LogManager.addEvent(
        "sync",
        "error",
        `syncProvider error for ${provider}: ${message}`,
      );
      return { success: false, message };
    }
  }

  /**
   * Stable durumunu bildir
   * @private
   */
  _notifyStable(provider, res) {
    try {
      const list = this._stableListeners[provider] || [];
      delete this._stableListeners[provider];
      
      for (const cb of list) {
        try {
          cb(null, res);
        } catch (_e) {
          /* noop */
        }
      }

      // Pending archive'ları işle
      try {
        PendingArchiveHandler.processPending(provider, res);
      } catch (_e) {
        /* noop */
      }
    } catch (_e) {
      /* noop */
    }
  }

  /**
   * Stable listener ekle
   * @param {string} provider - Slot ID
   * @param {Function} callback - Callback fonksiyonu
   */
  addStableListener(provider, callback) {
    if (!this._stableListeners[provider]) {
      this._stableListeners[provider] = [];
    }
    this._stableListeners[provider].push(callback);
  }

  /**
   * Son sync sonucunu getir
   * @param {string} provider - Slot ID
   * @returns {Object|null}
   */
  getLastSyncResult(provider) {
    return this._lastSyncResult[provider] || null;
  }

  /**
   * Archive durumunu getir
   * @private
   */
  async _getArchiveStatus(provider, webUrl) {
    try {
      const indexList = await window.electronAPI?.readArchivesIndex();
      const existing = indexList.find(
        (item) =>
          item.provider === provider && normalizeUrl(item.webUrl) === webUrl,
      ) || null;
      
      return {
        existing,
        prevCount: existing?.messageCount || 0,
        newEntry: !existing,
      };
    } catch (_error) {
      return { existing: null, prevCount: 0, newEntry: false };
    }
  }

  /**
   * Slot için account bilgisini getir
   * @private
   */
  _getAccountForSlot(slot) {
    const activeAccountId = this._settings?.slots?.[slot]?.accountId;
    if (!activeAccountId || !Array.isArray(this._settings?.accounts)) {
      return null;
    }
    return this._settings.accounts.find((acc) => acc.id === activeAccountId);
  }

  /**
   * Cleanup (destroy için)
   */
  destroy() {
    if (this._trafficUnsubscribe) {
      this._trafficUnsubscribe();
      this._trafficUnsubscribe = null;
    }

    // Tüm retry timer'ları temizle
    Object.values(this._syncRetryTimers).forEach((timer) => {
      clearTimeout(timer);
    });
    this._syncRetryTimers = {};
    this._syncRetryCounts = {};
    this._stableListeners = {};
  }
}

export const ConversationSyncer = new ConversationSyncerClass();
