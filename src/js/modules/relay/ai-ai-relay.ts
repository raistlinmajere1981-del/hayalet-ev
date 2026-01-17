/**
 * AIAIRelay - İki AI arasındaki iletişimi yöneten relay
 * 
 * Bu sınıf AI-to-AI konuşmalarını yönetir:
 * - Basit relay: AI1 ↔ AI2 mesaj iletimi
 * - Protokol relay: Structured protocol ile başlayan oturumlar
 */

import { BaseRelay } from "./base-relay.js";
import { SlotController } from "../slot-controller.js";
import { getErrorMessage } from "../../types/index.js";

export class AIAIRelay extends BaseRelay {
  _providers: string[];
  _prevThinking: Record<string, string>;
  _lastTexts: Record<string, string>;

  constructor(coreEngine: any) {
    super(coreEngine);
    this._providers = ["ai1", "ai2"];
    this._prevThinking = { ai1: "idle", ai2: "idle" };
    this._lastTexts = { ai1: "", ai2: "" };
  }

  /**
   * Bu relay bu provider'ı yönetiyor mu?
   * @param {string} provider - AI slot
   * @returns {boolean}
   */
  handlesProvider(provider: string) {
    return this._active && this._providers.includes(provider);
  }

  /**
   * Basit AI-AI relay oturumu başlat
   * @param {Object} opts - { providers: ['ai1', 'ai2'] }
   */
  async start(opts: { providers?: string[] } = {}) {
    this._providers = Array.isArray(opts.providers) && opts.providers.length
      ? opts.providers
      : ["ai1", "ai2"];
    
    this._active = true;
    this._forwardCount = 0;
    this._lastTexts = { [this._providers[0]]: "", [this._providers[1]]: "" };
    
    this._log("info", `AI-AI Relay started: ${this._providers.join(",")}`);
    this._dispatchEvent("relay-changed", { active: true, type: "ai-ai" });
  }

  /**
   * Protokol tabanlı AI-AI oturumu başlat
   * Önce providers[0]'a protokol gönderir, yanıt alınca providers[1]'e iletir,
   * sonra relay aktif olarak mesajları ileri geri taşır.
   * 
   * @param {Object} opts - { providers, protocolPayload, attachments }
   */
  async startProtocolSession(opts: { providers?: string[]; protocolPayload?: any; attachments?: any[] } = {}) {
    try {
      if (!opts?.protocolPayload || !Array.isArray(opts.providers) || opts.providers.length < 2) {
        throw new Error("Invalid protocol session args");
      }

      const providers = opts.providers;
      const id = this._generateSessionId("ai-ai-protocol");
      
      this._session = {
        id,
        type: "protocol",
        providers: [...providers],
        protocolPayload: { ...opts.protocolPayload },
        attachments: Array.isArray(opts.attachments) ? [...opts.attachments] : [],
        state: "sent-to-ai1",
        lastTexts: { [providers[0]]: "", [providers[1]]: "" },
        forwardCount: 0,
        createdAt: Date.now(),
      };
      
      this._providers = [...providers];
      this._active = true;
      this._lastTexts = this._session?.lastTexts || {};

      const first = providers[0];
      const protocolPayload = this._session?.protocolPayload as Record<string, unknown> | undefined;
      const message = String(protocolPayload?.message || "");
      const attachments = (this._session?.attachments || []) as unknown[];

      this._log("info", `Protocol session ${id}: sending to ${first}`);

      await this.coreEngine.sendToTargets({
        targets: [first],
        text: message,
        page: "protocol-relay",
        attachments: attachments as string[],
      });

      this._log("info", `Protocol session ${id}: sent to ${first}`);
      this._dispatchEvent("relay-changed", { active: true, type: "ai-ai-protocol" });

    } catch (err) {
      this._log("warning", `startProtocolSession error: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  /**
   * Relay oturumunu durdur
   */
  async stop() {
    const wasProtocol = this._session?.type === "protocol";
    const sessionId = this._session?.id;
    
    if (sessionId) {
      this._log("info", `${wasProtocol ? "Protocol session" : "Relay"} ${sessionId} stopped`);
    } else {
      this._log("info", "AI-AI Relay stopped");
    }

    this._resetState();
    this._prevThinking = { ai1: "idle", ai2: "idle" };
    this._lastTexts = { ai1: "", ai2: "" };
    
    this._dispatchEvent("relay-changed", { active: false, type: "ai-ai" });
  }

  /**
   * Protokol oturumunu durdur (alias for stop)
   */
  async stopProtocolSession() {
    await this.stop();
  }

  /**
   * AI thinking tamamlandığında çağrılır
   * @param {string} provider - AI slot (ai1 veya ai2)
   * @param {Object} syncResult - Conversation sync sonucu
   */
  async handleThinkingComplete(provider: string, syncResult: { messages?: Array<{ role: string; text?: string }> }) {
    try {
      if (!syncResult || !Array.isArray(syncResult.messages)) return;

      const lastAssistant = [...syncResult.messages]
        .reverse()
        .find((m) => m.role === "assistant" && (m.text || "").trim());
      
      if (!lastAssistant?.text) return;
      
      const text = lastAssistant.text.trim();

      if (this._session?.type === "protocol") {
        await this._handleProtocolFlow(provider, text);
        return;
      }

      await this._handleSimpleRelayFlow(provider, text);

    } catch (err) {
      this._log("warning", `handleThinkingComplete error: ${getErrorMessage(err)}`);
    }
  }

  /**
   * Protokol akışını yönet
   * @private
   */
  async _handleProtocolFlow(provider: string, text: string) {
    const s = this._session;
    if (!s || !s.providers || !s.lastTexts) return;
    
    const [ai1, ai2] = s.providers;

    if (s.state === "sent-to-ai1" && provider === ai1) {
      if (s.lastTexts[ai1] === text) return;
      s.lastTexts[ai1] = text;

      this._log("info", `Protocol session ${s.id}: ${ai1} replied`, { excerpt: text.slice(0, 200) });

      const protocolPayload = s.protocolPayload as Record<string, unknown> | undefined;
      const baseMsg = String(protocolPayload?.message || "");
      const forwardText = `${baseMsg}\n\n[${ai1}]: ${text}`;
      s.state = "sent-to-ai2";

      try {
        await this.coreEngine.sendToTargets({
          targets: [ai2],
          text: forwardText,
          page: "protocol-relay",
          attachments: (s.attachments || []) as string[],
        });
        this._log("info", `Protocol session ${s.id}: forwarded ${ai1} -> ${ai2}`);
      } catch (e) {
        this._log("warning", `Protocol session ${s.id}: forward to ${ai2} failed: ${getErrorMessage(e)}`);
      }
      return;
    }

    if ((s.state === "sent-to-ai2" || s.state === "relay-active") && provider === ai2) {
      if (s.lastTexts[ai2] === text) return;
      s.lastTexts[ai2] = text;
      
      s.state = "relay-active";
      s.forwardCount = (s.forwardCount || 0) + 1;
      this._forwardCount = s.forwardCount;

      this._log("info", `Protocol session ${s.id}: forwarding ${ai2} -> ${ai1} (#${s.forwardCount})`, { excerpt: text.slice(0, 200) });

      try {
        await this.coreEngine.sendMessage({
          provider: ai1,
          text,
          page: "relay",
        });
      } catch (e) {
        this._log("warning", `Protocol session ${s.id}: forward ${ai2}->${ai1} failed: ${getErrorMessage(e)}`);
      }
      return;
    }

    if (s.state === "relay-active" && provider === ai1) {
      if (s.lastTexts[ai1] === text) return;
      s.lastTexts[ai1] = text;
      
      s.forwardCount = (s.forwardCount || 0) + 1;
      this._forwardCount = s.forwardCount;

      this._log("info", `Protocol session ${s.id}: forwarding ${ai1} -> ${ai2} (#${s.forwardCount})`, { excerpt: text.slice(0, 200) });

      try {
        await this.coreEngine.sendMessage({
          provider: ai2,
          text,
          page: "relay",
        });
      } catch (e) {
        this._log("warning", `Protocol session ${s.id}: forward ${ai1}->${ai2} failed: ${getErrorMessage(e)}`);
      }
    }
  }

  /**
   * Basit relay akışını yönet
   * @private
   */
  async _handleSimpleRelayFlow(provider: string, text: string) {
    if (this._lastTexts[provider] === text) return;
    this._lastTexts[provider] = text;

    const target = this._determineTarget(provider);
    
    if (!SlotController.isConnected(target)) {
      this._log("info", `Relay skipped: target ${target} not connected`);
      return;
    }

    this._forwardCount += 1;
    this._log("info", `Relay forwarding (#${this._forwardCount}) ${provider} -> ${target}`, {
      job: { from: provider, to: target },
      excerpt: text.slice(0, 200),
    });

    try {
      await this.coreEngine.sendMessage({
        provider: target,
        text,
        page: "relay",
      });
    } catch (err) {
      this._log("warning", `Relay forwarding failed: ${getErrorMessage(err)}`, {
        from: provider,
        to: target,
      });
    }
  }

  /**
   * Kaynak provider'a göre hedef provider'ı belirle
   * @private
   * @param {string} source - Kaynak AI slot
   * @returns {string} - Hedef AI slot
   */
  _determineTarget(source: string) {
    const idx = this._providers.indexOf(source);
    if (idx === -1) return this._providers[0];
    return this._providers[(idx + 1) % this._providers.length];
  }

  /**
   * Thinking state değişimini takip et
   * @param {string} provider - AI slot
   * @param {string} thinkingState - Yeni thinking state
   * @returns {boolean} - Thinking tamamlandı mı?
   */
  checkThinkingTransition(provider: string, thinkingState: string) {
    const prev = this._prevThinking[provider] || "idle";
    this._prevThinking[provider] = thinkingState;
    return prev !== "idle" && thinkingState === "idle";
  }
}
