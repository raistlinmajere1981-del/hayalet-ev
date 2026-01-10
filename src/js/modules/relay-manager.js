/**
 * RelayManager - Relay Orchestrator
 * 
 * Bu modül tüm relay tiplerini yönetir ve koordine eder:
 * - AIAIRelay: İki AI arasındaki iletişim
 * - AIAsistanRelay: AI ile Asistan arasındaki iletişim
 * 
 * Gelecekte yeni relay tipleri kolayca eklenebilir.
 */

import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { LogManager } from "./log-manager.js";
import { AIAIRelay } from "./relay/ai-ai-relay.js";
import { AIAsistanRelay } from "./relay/ai-asistan-relay.js";

class RelayManagerClass {
  constructor() {
    this.coreEngine = null;
    this._aiaiRelay = null;
    this._aiAsistanRelay = null;
    this._boundUpdate = this._onTrafficUpdate.bind(this);
    this._trafficUnsubscribe = null;
  }

  /**
   * RelayManager'ı başlat
   * @param {Object} coreEngine - CoreEngine instance
   */
  init(coreEngine) {
    this.coreEngine = coreEngine;

    // Relay instance'larını oluştur
    this._aiaiRelay = new AIAIRelay(coreEngine);
    this._aiAsistanRelay = new AIAsistanRelay(coreEngine);

    // TrafficManager subscription'ı yönet
    if (this._trafficUnsubscribe) {
      this._trafficUnsubscribe();
    }
    this._trafficUnsubscribe = TrafficManager.onUpdate(this._boundUpdate);

    LogManager.addEvent("relay", "info", "RelayManager initialized with AI-AI and AI-Asistan relays");
  }

  // ==========================================
  // PUBLIC API - Orchestrator Methods
  // ==========================================

  /**
   * Herhangi bir relay aktif mi?
   * @returns {boolean}
   */
  isActive() {
    return this._aiaiRelay?.isActive || this._aiAsistanRelay?.isActive || false;
  }

  /**
   * AI-AI relay aktif mi?
   * @returns {boolean}
   */
  isAIAIActive() {
    return this._aiaiRelay?.isActive || false;
  }

  /**
   * AI-Asistan relay aktif mi?
   * @returns {boolean}
   */
  isAsistanSessionActive() {
    return this._aiAsistanRelay?.isActive || false;
  }

  // ==========================================
  // AI-AI RELAY METHODS
  // ==========================================

  /**
   * Basit AI-AI relay oturumu başlat
   * @param {Object} opts - { providers: ['ai1', 'ai2'] }
   */
  async startSession(opts = {}) {
    // AI-Asistan session aktifse durdur
    if (this._aiAsistanRelay?.isActive) {
      LogManager.addEvent("relay", "info", "Stopping AI-Asistan session for AI-AI relay");
      await this._aiAsistanRelay.stop();
    }

    await this._aiaiRelay.start(opts);
    this._updateIndicator();
  }

  /**
   * AI-AI relay oturumunu durdur
   */
  async stopSession() {
    await this._aiaiRelay.stop();
    this._updateIndicator();
  }

  /**
   * Protokol tabanlı AI-AI oturumu başlat
   * @param {Object} opts - { providers, protocolPayload, attachments }
   */
  async startProtocolSession(opts = {}) {
    // AI-Asistan session aktifse durdur
    if (this._aiAsistanRelay?.isActive) {
      LogManager.addEvent("relay", "info", "Stopping AI-Asistan session for protocol relay");
      await this._aiAsistanRelay.stop();
    }

    await this._aiaiRelay.startProtocolSession(opts);
    this._updateIndicator();
  }

  /**
   * Protokol oturumunu durdur
   */
  async stopProtocolSession() {
    await this._aiaiRelay.stopProtocolSession();
    this._updateIndicator();
  }

  // ==========================================
  // AI-ASISTAN RELAY METHODS
  // ==========================================

  /**
   * AI-Asistan relay oturumu başlat
   * @param {Object} opts - { aiSlot: 'ai1' | 'ai2', assistantManager: AssistantManager }
   */
  async startAsistanSession(opts = {}) {
    // AI-AI session aktifse durdur
    if (this._aiaiRelay?.isActive) {
      LogManager.addEvent("relay", "info", "Stopping AI-AI session for AI-Asistan relay");
      await this._aiaiRelay.stop();
    }

    await this._aiAsistanRelay.start(opts);
    this._updateIndicator();
  }

  /**
   * AI-Asistan relay oturumunu durdur
   */
  async stopAsistanSession() {
    await this._aiAsistanRelay.stop();
    this._updateIndicator();
  }

  // ==========================================
  // INTERNAL - Traffic Update Handler
  // ==========================================

  /**
   * TrafficManager update'lerini işle
   * @private
   */
  async _onTrafficUpdate(snapshot) {
    try {
      const provider = snapshot?.provider;
      if (!provider) return;

      const state = snapshot?.state || {};
      const currentThinking = state.thinkingState || "idle";

      // Hangi relay bu provider'ı yönetiyor?
      let activeRelay = null;
      let thinkingComplete = false;

      if (this._aiAsistanRelay?.handlesProvider(provider)) {
        activeRelay = this._aiAsistanRelay;
        thinkingComplete = activeRelay.checkThinkingTransition(provider, currentThinking);
      } else if (this._aiaiRelay?.handlesProvider(provider)) {
        activeRelay = this._aiaiRelay;
        thinkingComplete = activeRelay.checkThinkingTransition(provider, currentThinking);
      }

      // Thinking tamamlandıysa ilgili relay'e bildir
      if (activeRelay && thinkingComplete) {
        const syncResult = await WebviewManager.syncConversation(provider);
        await activeRelay.handleThinkingComplete(provider, syncResult);
        this._updateIndicator();
      }

    } catch (err) {
      LogManager.addEventWithContext(
        "relay",
        "warning",
        `Traffic update handler error: ${err?.message || String(err)}`,
        { provider: snapshot?.provider, error: err?.message || String(err) }
      );
    }
  }

  // ==========================================
  // INTERNAL - UI Indicator
  // ==========================================

  /**
   * UI göstergesini güncelle
   * @private
   */
  _updateIndicator() {
    try {
      const el = document.getElementById("relay-indicator");
      if (!el) return;

      // AI-Asistan session kontrolü
      if (this._aiAsistanRelay?.isActive) {
        const count = this._aiAsistanRelay.forwardCount || 0;
        el.textContent = `asistan relay aktif (${count})`;
        el.classList.add("relay-active");
        el.classList.add("relay-asistan");
        return;
      }

      // AI-AI session kontrolü
      if (this._aiaiRelay?.isActive) {
        const count = this._aiaiRelay.forwardCount || 0;
        el.textContent = `relay aktif (${count})`;
        el.classList.add("relay-active");
        el.classList.remove("relay-asistan");
        return;
      }

      // Hiçbir relay aktif değil
      el.textContent = "relay pasif";
      el.classList.remove("relay-active");
      el.classList.remove("relay-asistan");
    } catch (e) {
      /* noop */
    }
  }

  // ==========================================
  // GETTERS - Relay Access
  // ==========================================

  /**
   * AI-AI Relay instance'ına erişim
   * @returns {AIAIRelay}
   */
  get aiaiRelay() {
    return this._aiaiRelay;
  }

  /**
   * AI-Asistan Relay instance'ına erişim
   * @returns {AIAsistanRelay}
   */
  get aiAsistanRelay() {
    return this._aiAsistanRelay;
  }
}

export const RelayManager = new RelayManagerClass();
