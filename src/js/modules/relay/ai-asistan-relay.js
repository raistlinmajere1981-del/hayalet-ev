/**
 * AIAsistanRelay - AI ile Asistan arasındaki iletişimi yöneten relay
 * 
 * Bu sınıf AI-to-Asistan konuşmalarını yönetir:
 * - AI yanıtlarını Asistan'a iletir
 * - Asistan çıktılarını AI'ya iletir
 * - Stop komutlarını algılar ve oturumu sonlandırır
 */

import { BaseRelay } from "./base-relay.js";
import { SlotController } from "../slot-controller.js";

export class AIAsistanRelay extends BaseRelay {
  constructor(coreEngine) {
    super(coreEngine);
    this._aiSlot = null;
    this._assistantManager = null;
    this._outputBuffer = "";
    this._boundAsistanOutput = this._onAsistanOutput.bind(this);
    this._prevThinking = "idle";
  }

  /**
   * Bu relay bu provider'ı yönetiyor mu?
   * @param {string} provider - AI slot
   * @returns {boolean}
   */
  handlesProvider(provider) {
    return this._active && provider === this._aiSlot;
  }

  /**
   * AI-Asistan relay oturumu başlat
   * @param {Object} opts - { aiSlot: 'ai1' | 'ai2', assistantManager: AssistantManager }
   */
  async start(opts = {}) {
    const { aiSlot = "ai1", assistantManager } = opts;

    if (!assistantManager) {
      throw new Error("AssistantManager required for AI-Asistan relay");
    }

    if (!SlotController.isConnected(aiSlot)) {
      throw new Error(`${aiSlot} bağlı değil`);
    }

    const id = this._generateSessionId("asistan-relay");
    
    this._session = {
      id,
      type: "asistan",
      aiSlot,
      createdAt: Date.now(),
    };
    
    this._aiSlot = aiSlot;
    this._assistantManager = assistantManager;
    this._outputBuffer = "";
    this._forwardCount = 0;
    this._active = true;
    this._prevThinking = "idle";

    assistantManager.on("assistant-output", this._boundAsistanOutput);

    this._log("info", `AI-Asistan relay started: ${aiSlot} <-> Asistan`, {
      sessionId: id,
      aiSlot,
    });

    await this._sendAsistanProtocolToAI(aiSlot);

    this._dispatchEvent("relay-changed", { active: true, type: "asistan" });
  }

  /**
   * AI-Asistan relay oturumu durdur
   */
  async stop() {
    if (!this._active) return;

    const sessionId = this._session?.id;
    const forwardCount = this._forwardCount;

    if (this._assistantManager && this._boundAsistanOutput) {
      this._assistantManager.off("assistant-output", this._boundAsistanOutput);
    }

    this._log("info", `AI-Asistan relay stopped (${forwardCount} forwards)`, {
      sessionId,
      forwardCount,
    });

    this._resetState();
    this._aiSlot = null;
    this._assistantManager = null;
    this._outputBuffer = "";
    this._prevThinking = "idle";

    this._dispatchEvent("relay-changed", { active: false, type: "asistan" });
  }

  /**
   * Asistan oturumu durdur (alias for stop)
   */
  async stopAsistanSession() {
    await this.stop();
  }

  /**
   * AI thinking tamamlandığında çağrılır
   * @param {string} provider - AI slot (ai1 veya ai2)
   * @param {Object} syncResult - Conversation sync sonucu
   */
  async handleThinkingComplete(provider, syncResult) {
    try {
      if (!this._active) return;
      if (provider !== this._aiSlot) return;
      if (!syncResult || !Array.isArray(syncResult.messages)) return;

      const lastAssistant = [...syncResult.messages]
        .reverse()
        .find((m) => m.role === "assistant" && (m.text || "").trim());

      if (!lastAssistant?.text) return;

      const text = lastAssistant.text.trim();
      await this._forwardToAsistan(text);

    } catch (err) {
      this._log("warning", `handleThinkingComplete error: ${err?.message || String(err)}`);
    }
  }

  /**
   * Thinking state değişimini takip et
   * @param {string} provider - AI slot
   * @param {string} thinkingState - Yeni thinking state
   * @returns {boolean} - Thinking tamamlandı mı?
   */
  checkThinkingTransition(provider, thinkingState) {
    if (provider !== this._aiSlot) return false;
    
    const prev = this._prevThinking;
    this._prevThinking = thinkingState;
    return prev !== "idle" && thinkingState === "idle";
  }

  /**
   * Asistan output'unu işle
   * @private
   * @param {string} data - Asistan'dan gelen output
   */
  _onAsistanOutput(data) {
    if (!this._active) return;

    this._outputBuffer = (this._outputBuffer || "") + data;

    if (this._containsStopCommand(this._outputBuffer)) {
      this._log("info", "AI-Asistan relay: Stop command detected");
      this.stop();
      return;
    }

    if (this._outputBuffer.includes("\n")) {
      const lines = this._outputBuffer.split("\n");
      const completeLines = lines.slice(0, -1).join("\n");
      this._outputBuffer = lines[lines.length - 1];

      if (completeLines.trim()) {
        this._forwardToAI(completeLines);
      }
    }
  }

  /**
   * Stop komutu var mı kontrol et
   * @private
   * @param {string} text - Kontrol edilecek metin
   * @returns {boolean}
   */
  _containsStopCommand(text) {
    const stopPattern = /\+\+cmd:StopAIAssistanChat\(\)/;
    return stopPattern.test(text);
  }

  /**
   * AI'ye asistan protokolünü gönder
   * @private
   * @param {string} aiSlot - Hedef AI slot
   */
  async _sendAsistanProtocolToAI(aiSlot) {
    try {
      const protocolPath = "protocol/AI-asistan.txt";

      if (window.electronAPI?.readFile) {
        const base64 = await window.electronAPI.readFile(protocolPath);
        if (base64) {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const decoder = new TextDecoder("utf-8");
          const protocolText = decoder.decode(bytes);

          await this.coreEngine.sendMessage({
            provider: aiSlot,
            text: protocolText,
            page: "asistan-relay",
          });

          this._log("info", `AI-Asistan protocol sent to ${aiSlot}`);
        }
      }
    } catch (err) {
      this._log("warning", `Failed to send protocol: ${err?.message || err}`);
    }
  }

  /**
   * AI response'unu asistana forward et
   * @private
   * @param {string} text - AI'dan gelen mesaj
   */
  async _forwardToAsistan(text) {
    if (!this._active) return;

    this._forwardCount++;

    this._log("info", `Forwarding AI -> Asistan (#${this._forwardCount})`, {
      excerpt: text.slice(0, 200),
    });

    try {
      await this._assistantManager.sendMessage(text + "\n");
    } catch (err) {
      this._log("warning", `Forward to asistan failed: ${err?.message || err}`);
    }
  }

  /**
   * Asistan response'unu AI'ye forward et
   * @private
   * @param {string} text - Asistan'dan gelen mesaj
   */
  async _forwardToAI(text) {
    if (!this._active) return;

    this._forwardCount++;

    this._log("info", `Forwarding Asistan -> AI (#${this._forwardCount})`, {
      excerpt: text.slice(0, 200),
    });

    try {
      await this.coreEngine.sendMessage({
        provider: this._aiSlot,
        text,
        page: "asistan-relay",
      });
    } catch (err) {
      this._log("warning", `Forward to AI failed: ${err?.message || err}`);
    }
  }

  /**
   * AI slot getter
   * @returns {string|null}
   */
  get aiSlot() {
    return this._aiSlot;
  }

  /**
   * Output buffer getter (debug için)
   * @returns {string}
   */
  get outputBuffer() {
    return this._outputBuffer;
  }
}
