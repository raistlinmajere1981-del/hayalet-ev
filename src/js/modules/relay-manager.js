/**
 * RelayManager - Relay Orchestrator
 * 
 * Bu modül tüm relay tiplerini yönetir ve koordine eder:
 * - AIAIRelay: İki AI arasındaki iletişim
 * 
 * Gelecekte yeni relay tipleri kolayca eklenebilir.
 */

import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { LogManager } from "./log-manager.js";
import { AIAIRelay } from "./relay/ai-ai-relay.js";

class RelayManagerClass {
  constructor() {
    this.coreEngine = null;
    this._aiaiRelay = null;
    this._boundUpdate = this._onTrafficUpdate.bind(this);
    this._trafficUnsubscribe = null;
  }

  /**
   * RelayManager'ı başlat
   * @param {Object} coreEngine - CoreEngine instance
   */
  init(coreEngine) {
    this.coreEngine = coreEngine;

    this._aiaiRelay = new AIAIRelay(coreEngine);

    if (this._trafficUnsubscribe) {
      this._trafficUnsubscribe();
    }
    this._trafficUnsubscribe = TrafficManager.onUpdate(this._boundUpdate);

    LogManager.addEvent("relay", "info", "RelayManager initialized with AI-AI relay");
  }

  // ==========================================
  // ==========================================

  /**
   * Herhangi bir relay aktif mi?
   * @returns {boolean}
   */
  isActive() {
    return this._aiaiRelay?.isActive || false;
  }

  /**
   * AI-AI relay aktif mi?
   * @returns {boolean}
   */
  isAIAIActive() {
    return this._aiaiRelay?.isActive || false;
  }

  // ==========================================
  // ==========================================

  /**
   * Basit AI-AI relay oturumu başlat
   * @param {Object} opts - { providers: ['ai1', 'ai2'] }
   */
  async startSession(opts = {}) {
    await this._aiaiRelay.start(opts);
  }

  /**
   * AI-AI relay oturumunu durdur
   */
  async stopSession() {
    await this._aiaiRelay.stop();
  }

  /**
   * Protokol tabanlı AI-AI oturumu başlat
   * @param {Object} opts - { providers, protocolPayload, attachments }
   */
  async startProtocolSession(opts = {}) {
    await this._aiaiRelay.startProtocolSession(opts);
  }

  /**
   * Protokol oturumunu durdur
   */
  async stopProtocolSession() {
    await this._aiaiRelay.stopProtocolSession();
  }

  // ==========================================
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

      let activeRelay = null;
      let thinkingComplete = false;

      if (this._aiaiRelay?.handlesProvider(provider)) {
        activeRelay = this._aiaiRelay;
        thinkingComplete = activeRelay.checkThinkingTransition(provider, currentThinking);
      }

      if (activeRelay && thinkingComplete) {
        const syncResult = await WebviewManager.syncConversation(provider);
        await activeRelay.handleThinkingComplete(provider, syncResult);
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
  // ==========================================

  /**
   * AI-AI Relay instance'ına erişim
   * @returns {AIAIRelay}
   */
  get aiaiRelay() {
    return this._aiaiRelay;
  }
}

export const RelayManager = new RelayManagerClass();
