/**
 * RelayManager - Relay Orchestrator
 * 
 * Bu modül tüm relay tiplerini yönetir ve koordine eder:
 * - AIAIRelay: İki AI arasındaki iletişim
 * - AIAsistanRelay: AI ve Asistan (AI0) arasındaki iletişim
 */

import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { LogManager } from "./log-manager.js";
import { getErrorMessage } from "../types/index.js";
import { AIAIRelay } from "./relay/ai-ai-relay.js";
import { AIAsistanRelay } from "./relay/ai-asistan-relay.js";

class RelayManagerClass {
  coreEngine: any;
  _aiaiRelay: AIAIRelay | null;
  _aiAsistanRelay: AIAsistanRelay | null;
  _boundUpdate: typeof this._onTrafficUpdate;
  _trafficUnsubscribe: (() => void) | null;

  constructor() {
    this.coreEngine = null;
    this._aiaiRelay = null;
    this._aiAsistanRelay = null;
    this._boundUpdate = this._onTrafficUpdate.bind(this);
    this._trafficUnsubscribe = null;
  }

  init(coreEngine: any) {
    this.coreEngine = coreEngine;

    this._aiaiRelay = new AIAIRelay(coreEngine);
    this._aiAsistanRelay = new AIAsistanRelay(coreEngine);

    if (this._trafficUnsubscribe) {
      this._trafficUnsubscribe();
    }
    this._trafficUnsubscribe = TrafficManager.onUpdate(this._boundUpdate as (snapshot: { provider: string; state: unknown }) => void);

    LogManager.addEvent("relay", "info", "RelayManager initialized with AI-AI and AI-Asistan relays");
  }

  // ==========================================
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
  isAIAsistanActive() {
    return this._aiAsistanRelay?.isActive || false;
  }

  /**
   * AI-Asistan relay kaynak slotunu döndür
   * @returns {string|null}
   */
  getAIAsistanSourceSlot() {
    return this._aiAsistanRelay?.sourceSlot || null;
  }

  // ==========================================
  // ==========================================

  async startSession(opts = {}) {
    await this._aiaiRelay?.start(opts);
  }

  async stopSession() {
    await this._aiaiRelay?.stop();
  }

  async startProtocolSession(opts = {}) {
    await this._aiaiRelay?.startProtocolSession(opts);
  }

  async stopProtocolSession() {
    await this._aiaiRelay?.stopProtocolSession();
  }

  // ==========================================
  // AI-Asistan Relay Methods
  // ==========================================

  /**
   * AI-Asistan relay oturumu başlat
   */
  async startAIAsistanSession(sourceSlot: string) {
    // Önce diğer relay'leri durdur
    if (this._aiaiRelay?.isActive) {
      await this._aiaiRelay.stop();
    }
    
    await this._aiAsistanRelay?.start({ sourceSlot });
  }

  async stopAIAsistanSession() {
    await this._aiAsistanRelay?.stop();
  }

  // ==========================================
  // ==========================================

  /**
   * TrafficManager update'lerini işle
   * @private
   */
  async _onTrafficUpdate(snapshot: { provider?: string; state?: { thinkingState?: string } }) {
    try {
      const provider = snapshot?.provider;
      if (!provider) return;

      const state = snapshot?.state || {};
      const currentThinking = state.thinkingState || "idle";

      let activeRelay = null;
      let thinkingComplete = false;

      // Önce AI-Asistan relay'i kontrol et
      if (this._aiAsistanRelay?.handlesProvider(provider)) {
        activeRelay = this._aiAsistanRelay;
        thinkingComplete = activeRelay.checkThinkingTransition(provider, currentThinking);
      }
      // Sonra AI-AI relay'i kontrol et
      else if (this._aiaiRelay?.handlesProvider(provider)) {
        activeRelay = this._aiaiRelay;
        thinkingComplete = activeRelay.checkThinkingTransition(provider, currentThinking);
      }

      if (activeRelay && thinkingComplete) {
        const syncResult = await WebviewManager.syncConversation(provider, null, {});
        await activeRelay.handleThinkingComplete(provider, syncResult);
      }

    } catch (err) {
      LogManager.addEventWithContext(
        "relay",
        "warning",
        `Traffic update handler error: ${getErrorMessage(err)}`,
        { provider: snapshot?.provider, error: getErrorMessage(err) }
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

  /**
   * AI-Asistan Relay instance'ına erişim
   * @returns {AIAsistanRelay}
   */
  get aiAsistanRelay() {
    return this._aiAsistanRelay;
  }
}

export const RelayManager = new RelayManagerClass();
