/**
 * WebviewManager - Facade Pattern
 * 
 * Bu modül tüm webview alt sistemlerini koordine eder:
 * - LifecycleManager: Yaşam döngüsü (register, attach, detach, destroy)
 * - MessageSender: Mesaj ve dosya gönderimi
 * - ConversationSyncer: Konuşma senkronizasyonu ve arşivleme
 * - PendingArchiveHandler: Bekleyen arşiv işlemleri
 */

import { ProviderRegistry } from "./webview/provider-registry.js";
import { getProvider } from "./webview/provider-factory.js";
import { isUrlExcluded as checkUrlExcluded } from "./webview/methods/shared/url-utils.js";
import { LifecycleManager } from "./webview/lifecycle-manager.js";
import { MessageSender } from "./webview/message-sender.js";
import { AppState } from "./app-state.js";
import { ConversationSyncer } from "./webview/conversation-syncer.js";
import { PendingArchiveHandler } from "./webview/pending-archive-handler.js";

class WebviewManagerClass {
  constructor() {
    this.settings = null;
  }

  // ==========================================
  // ==========================================

  /**
   * Ayarları güncelle ve alt modüllere dağıt
   * @param {Object} settings - Uygulama ayarları
   */
  setSettings(settings) {
    this.settings = settings;
    MessageSender.setSettings(settings);
    ConversationSyncer.setSettings(settings);
  }

  // ==========================================
  // ==========================================

  /**
   * Webview'ı kaydet
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview elementi
   */
  register(provider, webview) {
    LifecycleManager.register(provider, webview);
  }

  /**
   * Webview'ı slot'a bağla
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview elementi
   * @param {Object} opts - { onReady }
   */
  attach(provider, webview, opts = {}) {
    const providerId = AppState.getProviderIdForSlot(provider);
    LifecycleManager.attach(provider, webview, { ...opts, providerId });
  }

  /**
   * Webview'ı slot'tan ayır
   * @param {string} provider - Slot ID
   * @param {Object} opts - { cleanupDom, skipTrafficStop }
   */
  detach(provider, opts = {}) {
    LifecycleManager.detach(provider, opts);
  }

  /**
   * Webview'ı çöz
   * @param {string} provider - Slot ID
   * @returns {HTMLElement|null}
   */
  resolveWebview(provider) {
    return LifecycleManager.resolve(provider);
  }

  /**
   * Webview'ı tamamen yok et
   * @param {string} provider - Slot ID
   */
  destroyWebview(provider) {
    LifecycleManager.destroy(provider);
  }

  /**
   * Webview'ı aktif olarak işaretle
   * @param {string} provider - Slot ID
   */
  markActive(provider) {
    LifecycleManager.markActive(provider);
  }

  /**
   * İnaktif webview'ları temizle
   */
  cleanupInactiveWebviews() {
    LifecycleManager.cleanupInactive();
  }

  // ==========================================
  // ==========================================

  /**
   * Mesaj ve dosya gönder
   * @param {Object} opts - { provider, text, attachments }
   * @returns {Promise<Object>}
   */
  async send({ provider, text, attachments = [] }) {
    const webview = this.resolveWebview(provider);
    return MessageSender.send({ provider, text, attachments, webview });
  }

  // ==========================================
  // ==========================================

  /**
   * ConversationSyncer'ı başlat
   * @param {Object} coreEngine - CoreEngine instance
   */
  initSyncer(coreEngine) {
    ConversationSyncer.init(coreEngine, (provider) => this.resolveWebview(provider));
  }

  /**
   * Konuşmayı senkronize et
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview elementi (optional)
   * @param {Object} options - { catchEnabled }
   * @returns {Promise<Object>}
   */
  async syncConversation(provider, webview, options = {}) {
    const targetWebview = webview || this.resolveWebview(provider);
    return ConversationSyncer.syncConversation(provider, targetWebview, options);
  }

  /**
   * Provider'ı senkronize et (eski SyncHandler.syncProvider)
   * @param {string} provider - Slot ID
   * @param {Object} opts - { from }
   * @returns {Promise<Object>}
   */
  async syncProvider(provider, opts = {}) {
    return ConversationSyncer.syncProvider(provider, opts);
  }

  /**
   * Stable listener ekle
   * @param {string} provider - Slot ID
   * @param {Function} callback - Callback
   */
  addStableListener(provider, callback) {
    ConversationSyncer.addStableListener(provider, callback);
  }

  /**
   * Son sync sonucunu getir
   * @param {string} provider - Slot ID
   * @returns {Object|null}
   */
  getLastSyncResult(provider) {
    return ConversationSyncer.getLastSyncResult(provider);
  }

  // ==========================================
  // ==========================================

  /**
   * Bekleyen arşiv ekle
   * @param {string} provider - Slot ID
   * @param {Object} entry - { jobId, folder, temp }
   */
  addPendingArchive(provider, entry) {
    PendingArchiveHandler.addPending(provider, entry);
  }

  // ==========================================
  // ==========================================

  /**
   * Slot için provider modülünü getir
   * @param {string} providerSlot - Slot ID
   * @returns {Object|null}
   */
  getProviderModule(providerSlot) {
    const providerId = AppState.getProviderIdForSlot(providerSlot);
    return providerId ? getProvider(providerId) : null;
  }

  /**
   * URL excluded mı kontrol et
   * @param {string} providerSlot - Slot ID
   * @param {string} url - URL
   * @returns {boolean}
   */
  isUrlExcluded(providerSlot, url) {
    const providerId = AppState.getProviderIdForSlot(providerSlot);
    if (!providerId || !url) return false;

    const cfg = ProviderRegistry.get(providerId);
    if (!cfg?.excludedUrls?.length) return false;

    return checkUrlExcluded(url, cfg.excludedUrls);
  }

  // ==========================================
  // ==========================================

  /**
   * Tüm webview referanslarını getir
   * @returns {Object}
   */
  get webviews() {
    return LifecycleManager.getAll();
  }
}

export const WebviewManager = new WebviewManagerClass();
