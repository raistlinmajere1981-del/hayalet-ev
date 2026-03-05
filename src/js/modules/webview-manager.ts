import type { AppSettings } from "@shared/settings.js";
import type { WebviewTag } from "electron";

/**
 * WebviewManager - Facade Pattern
 *
 * Bu modül tüm webview alt sistemlerini koordine eder:
 * - LifecycleManager: Yaşam döngüsü (register, attach, detach, destroy)
 * - MessageSender: Mesaj ve dosya gönderimi
 * - ConversationSyncer: Konuşma senkronizasyonu ve arşivleme
 * - PendingArchiveHandler: Bekleyen arşiv işlemleri
 */

import { getProvider } from "./webview/provider-factory.js";
import { isSlotUrlExcluded } from "./webview/methods/shared/url-utils.js";
import { LifecycleManager } from "./webview/lifecycle-manager.js";
import { MessageSender } from "./webview/message-sender.js";
import type { MessageSenderWebview } from "./webview/message-sender.js";
import { AppState } from "./app-state.js";
import { SlotController } from "./slot-controller.js";
import { ConversationSyncer } from "./webview/conversation-syncer.js";
import { PendingArchiveHandler } from "./webview/pending-archive-handler.js";

interface FileEntry {
  name?: string;
  path?: string;
}

interface SyncCoreEngine {
  handleCaughtCommand: (command: string, payload: Record<string, unknown>) => Promise<unknown>;
}

function isMessageSenderWebview(webview: unknown): webview is MessageSenderWebview {
  return (
    webview != null &&
    typeof (webview as { executeJavaScript?: unknown }).executeJavaScript === "function"
  );
}

function isSlotId(provider: string): provider is "ai0" | "ai1" | "ai2" {
  return provider === "ai0" || provider === "ai1" || provider === "ai2";
}

class WebviewManagerClass {
  settings: AppSettings | null;

  constructor() {
    this.settings = null;
  }

  /**
   * Ayarları güncelle ve alt modüllere dağıt
   * @param {Object} settings - Uygulama ayarları
   */
  setSettings(settings: AppSettings): void {
    this.settings = settings;
    MessageSender.setSettings(settings);
    ConversationSyncer.setSettings(settings);
  }

  /**
   * Webview'ı kaydet
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview elementi
   */
  register(provider: string, webview: WebviewTag): void {
    if (isSlotId(provider)) {
      SlotController.registerWebview(provider, webview);
      return;
    }

    LifecycleManager.register(provider, webview);
  }

  /**
   * Webview'ı slot'a bağla
   * @param {string} provider - Slot ID
   * @param {WebviewTag} webview - Webview elementi
   * @param {Object} opts - { onReady }
   */
  attach(provider: string, webview: WebviewTag, opts: Record<string, unknown> = {}): void {
    if (isSlotId(provider)) {
      SlotController.registerWebview(provider, webview);
      SlotController.ensureWebviewMounted(provider);
      SlotController.ensureWebviewAttached(provider);
      SlotController.markActive(provider);
      return;
    }

    const providerId = AppState.getProviderIdForSlot(provider);
    LifecycleManager.attach(provider, webview, {
      ...opts,
      ...(providerId !== null && providerId !== "" ? { providerId } : {}),
    });
  }

  /**
   * Webview'ı slot'tan ayır
   * @param {string} provider - Slot ID
   * @param {Object} opts - { cleanupDom, skipTrafficStop }
   */
  detach(provider: string, opts: Record<string, unknown> = {}): void {
    if (isSlotId(provider)) {
      SlotController.parkWebview(provider, "webview_manager_detach");
      return;
    }

    LifecycleManager.detach(provider, opts);
  }

  /**
   * Webview'ı çöz
   * @param {string} provider - Slot ID
   * @returns {HTMLElement|null}
   */
  resolveWebview(provider: string): WebviewTag | null {
    if (isSlotId(provider)) {
      const slotWebview = SlotController.getWebview(provider);
      if (slotWebview !== null) {
        return slotWebview as WebviewTag;
      }
    }

    const cached = LifecycleManager.get(provider);
    if (cached !== null) {
      return cached;
    }

    if (typeof document === "undefined") {
      return null;
    }

    const fallbackId = `${provider}-webview`;
    const found = document.getElementById(fallbackId) as WebviewTag | null;
    if (found !== null && isSlotId(provider)) {
      SlotController.registerWebview(provider, found);
    }
    return found;
  }

  /**
   * Webview'ı tamamen yok et
   * @param {string} provider - Slot ID
   */
  destroyWebview(provider: string): void {
    if (isSlotId(provider)) {
      SlotController.parkWebview(provider, "webview_manager_destroy");
      return;
    }

    LifecycleManager.destroy(provider);
  }

  /**
   * Webview'ı aktif olarak işaretle
   * @param {string} provider - Slot ID
   */
  markActive(provider: string): void {
    if (isSlotId(provider)) {
      SlotController.markActive(provider);
      return;
    }

    LifecycleManager.markActive(provider);
  }

  cleanupInactiveWebviews(): number {
    return SlotController.cleanupInactiveWebviews();
  }

  /**
   * Mesaj ve dosya gönder
   * @param {Object} opts - { provider, text, attachments }
   * @returns {Promise<Object>}
   */
  async send({
    provider,
    text,
    attachments = [],
  }: {
    provider: string;
    text: string;
    attachments?: FileEntry[];
  }): Promise<unknown> {
    const webview = this.resolveWebview(provider);
    if (!isMessageSenderWebview(webview)) {
      throw new Error(`Webview for slot "${provider}" is not ready`);
    }
    return await MessageSender.send({ provider, text, attachments, webview });
  }

  /**
   * ConversationSyncer'ı başlat
   * @param {Object} coreEngine - CoreEngine instance
   */
  initSyncer(coreEngine: SyncCoreEngine): void {
    ConversationSyncer.init(coreEngine, (provider: string) => this.resolveWebview(provider));
  }

  /**
   * Konuşmayı senkronize et
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview elementi (optional)
   * @param {Object} options - { catchEnabled }
   * @returns {Promise<Object>}
   */
  async syncConversation(
    provider: string,
    webview: WebviewTag | null,
    options: Record<string, unknown> = {}
  ): Promise<unknown> {
    const targetWebview = webview ?? this.resolveWebview(provider);
    if (targetWebview === null) throw new Error("Webview not found");
    return await ConversationSyncer.syncConversation(provider, targetWebview, options);
  }

  async syncLatestMessage(provider: string, webview: WebviewTag | null = null): Promise<unknown> {
    const targetWebview = webview ?? this.resolveWebview(provider);
    if (targetWebview === null) throw new Error("Webview not found");
    return await ConversationSyncer.syncLatestMessage(provider, targetWebview);
  }

  /**
   * Provider'ı senkronize et (eski SyncHandler.syncProvider)
   * @param {string} provider - Slot ID
   * @param {Object} opts - { from }
   * @returns {Promise<Object>}
   */
  async syncProvider(provider: string, opts: Record<string, unknown> = {}): Promise<unknown> {
    return await ConversationSyncer.syncProvider(provider, opts);
  }

  /**
   * Stable listener ekle
   * @param {string} provider - Slot ID
   * @param {Function} callback - Callback
   */
  addStableListener(provider: string, callback: () => void): void {
    ConversationSyncer.addStableListener(provider, callback);
  }

  /**
   * Son sync sonucunu getir
   * @param {string} provider - Slot ID
   * @returns {Object|null}
   */
  getLastSyncResult(provider: string): unknown {
    return ConversationSyncer.getLastSyncResult(provider);
  }

  /**
   * Bekleyen arşiv ekle
   * @param {string} provider - Slot ID
   * @param {Object} entry - { jobId, folder, temp }
   */
  addPendingArchive(
    provider: string,
    entry: { jobId: string; folder: string; temp?: string[] }
  ): void {
    PendingArchiveHandler.addPending(provider, entry);
  }

  /**
   * Slot için provider modülünü getir
   * @param {string} providerSlot - Slot ID
   * @returns {Object|null}
   */
  getProviderModule(providerSlot: string): unknown {
    const providerId = AppState.getProviderIdForSlot(providerSlot);
    return providerId !== null && providerId !== "" ? getProvider(providerId) : null;
  }

  /**
   * URL excluded mı kontrol et
   * @deprecated Use isSlotUrlExcluded from url-utils.ts directly
   * @param {string} providerSlot - Slot ID
   * @param {string} url - URL
   * @returns {boolean}
   */
  isUrlExcluded(providerSlot: string, url: string): boolean {
    return isSlotUrlExcluded(providerSlot, url);
  }

  /**
   * Tüm webview referanslarını getir
   * @returns {Object}
   */
  get webviews(): unknown {
    const lifecycleWebviews = LifecycleManager.getAll();
    return {
      ...lifecycleWebviews,
      ai0: SlotController.getWebview("ai0"),
      ai1: SlotController.getWebview("ai1"),
      ai2: SlotController.getWebview("ai2"),
    };
  }
}

const webviewManager = new WebviewManagerClass();

export { webviewManager, webviewManager as WebviewManager };
