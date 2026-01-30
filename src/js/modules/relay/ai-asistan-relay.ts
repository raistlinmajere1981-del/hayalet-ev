/**
 * AIAsistanRelay - AI ve Asistan (AI0) arasındaki iletişimi yöneten relay
 * 
 * Bu sınıf AI-to-Asistan konuşmalarını yönetir:
 * - AI1 ↔ AI0 (Asistan) mesaj iletimi
 * - AI2 ↔ AI0 (Asistan) mesaj iletimi
 * 
 * Asistan (AI0) teknik sorulara cevap veren yardımcı AI rolündedir.
 * 
 * Akış:
 * 1. Protokol AI'ye gönderilir (AI-asistan.txt)
 * 2. AI cevap verir → Asistan'a iletilir
 * 3. Asistan cevap verir → AI'ye iletilir
 * 4. Döngü devam eder
 */

import { BaseRelay } from "./base-relay.js";
import { SlotController } from "../slot-controller.js";

// ============================================================================
// Types
// ============================================================================

interface SyncResult {
  messages?: { role?: string; text?: string }[];
}

interface CoreEngine {
  sendMessage: (opts: { provider: string; text: string; page: string }) => Promise<unknown>;
}

// AI-Asistan protokol dosyası yolu
const PROTOCOL_PATH = "protocol/AI-asistan.txt";

export class AIAsistanRelay extends BaseRelay {
  _sourceSlot: string | null;
  _targetSlot: string;
  _prevThinking: Record<string, string>;
  _lastTexts: Record<string, string>;
  _sessionState: string;
  // @ts-expect-error - CoreEngine type compatibility with BaseRelay
  declare coreEngine: CoreEngine;

  constructor(coreEngine: CoreEngine) {
    super(coreEngine as never);
    // Kaynak AI slotu (ai1 veya ai2) ve hedef her zaman ai0 (asistan)
    this._sourceSlot = null;
    this._targetSlot = "ai0";
    this._prevThinking = { ai0: "idle", ai1: "idle", ai2: "idle" };
    this._lastTexts = { ai0: "", ai1: "", ai2: "" };
    
    // Session state: "idle" | "protocol-sent" | "ai-replied" | "relay-active"
    this._sessionState = "idle";
  }

  /**
   * Bu relay bu provider'ı yönetiyor mu?
   */
  override handlesProvider(provider: string): boolean {
    if (!this._active) return false;
    return provider === this._sourceSlot || provider === this._targetSlot;
  }

  /**
   * Kaynak slot'u döndür
   */
  get sourceSlot(): string | null {
    return this._sourceSlot;
  }

  /**
   * AI-Asistan relay oturumu başlat
   * Protokolü okur ve AI'ye gönderir, ardından relay aktif olur
   */
  override async start(opts: { sourceSlot?: string } = {}): Promise<void> {
    const source = opts.sourceSlot;
    
    if (!source || (source !== "ai1" && source !== "ai2")) {
      throw new Error("Invalid sourceSlot: must be 'ai1' or 'ai2'");
    }

    // Kaynak ve hedef bağlı mı kontrol et
    if (!SlotController.isConnected(source)) {
      throw new Error(`Source slot ${source} is not connected`);
    }
    
    if (!SlotController.isConnected(this._targetSlot)) {
      throw new Error(`Asistan (${this._targetSlot}) is not connected`);
    }

    this._sourceSlot = source;
    this._active = true;
    this._forwardCount = 0;
    this._sessionState = "idle";
    this._lastTexts = { 
      [source]: "", 
      [this._targetSlot]: "" 
    };
    
    const sessionId = this._generateSessionId("ai-asistan");
    this._session = {
      id: sessionId,
      type: "ai-asistan",
      sourceSlot: source,
      targetSlot: this._targetSlot,
      createdAt: Date.now(),
    };

    this._log("info", `AI-Asistan Relay started: ${source} ↔ ${this._targetSlot}`);
    this._dispatchEvent("relay-changed", { 
      active: true, 
      type: "ai-asistan",
      sourceSlot: source,
      targetSlot: this._targetSlot 
    });

    // Protokolü oku ve AI'ye gönder
    await this._sendProtocolToAI(source);
  }

  /**
   * Protokol dosyasını oku ve AI'ye gönder
   * @private
   */
  async _sendProtocolToAI(aiSlot: string): Promise<void> {
    try {
      // Protokol dosyasını oku
      const protocol = await this._loadProtocol();
      
      if (!protocol) {
        this._log("warning", "Protocol file could not be loaded, starting without protocol");
        this._sessionState = "relay-active";
        return;
      }

      this._sessionState = "protocol-sent";
      this._log("info", `Sending protocol to ${aiSlot}`, { 
        sessionId: this._session?.id,
        protocolLength: protocol.length 
      });

      // AI'ye protokolü gönder
      await this.coreEngine.sendMessage({
        provider: aiSlot,
        text: protocol,
        page: "ai-asistan-protocol",
      });

      this._log("info", `Protocol sent to ${aiSlot}`);

    } catch (e) {
      const err = e as Error;
      this._log("warning", `Failed to send protocol: ${err?.message || String(err)}`);
      // Protokol gönderilemese de relay'i aktif tut
      this._sessionState = "relay-active";
    }
  }

  /**
   * Protokol dosyasını yükle
   * @private
   */
  async _loadProtocol(): Promise<string | null> {
    try {
      // electronAPI üzerinden dosya oku (base64 olarak döner)
      if (window.electronAPI?.readFile) {
        const base64 = await window.electronAPI.readFile(PROTOCOL_PATH);
        if (base64) {
          // Base64'ü decode et
          const decoded = this._decodeBase64(base64);
          return decoded;
        }
      }
      
      // Fallback: fetch ile dene
      const response = await fetch(`/${PROTOCOL_PATH}`);
      if (response.ok) {
        return await response.text();
      }
      
      return null;
    } catch (e) {
      const err = e as Error;
      this._log("warning", `Protocol load error: ${err?.message || String(err)}`);
      return null;
    }
  }

  /**
   * Base64 string'i UTF-8 text'e decode et
   * @private
   */
  _decodeBase64(base64: string): string {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(bytes);
    } catch (e) {
      const err = e as Error;
      this._log("warning", `Base64 decode error: ${err?.message || String(err)}`);
      return "";
    }
  }

  /**
   * Relay oturumunu durdur
   */
  override async stop(): Promise<void> {
    const sessionId = this._session?.id;
    const source = this._sourceSlot;
    
    if (sessionId) {
      this._log("info", `AI-Asistan Relay ${sessionId} stopped (${source} ↔ ${this._targetSlot})`);
    } else {
      this._log("info", "AI-Asistan Relay stopped");
    }

    this._sourceSlot = null;
    this._sessionState = "idle";
    this._resetState();
    this._prevThinking = { ai0: "idle", ai1: "idle", ai2: "idle" };
    this._lastTexts = { ai0: "", ai1: "", ai2: "" };
    
    this._dispatchEvent("relay-changed", { active: false, type: "ai-asistan" });
  }

  /**
   * AI thinking tamamlandığında çağrılır
   * State machine'e göre akışı yönetir
   */
  override async handleThinkingComplete(provider: string, syncResult: SyncResult | null): Promise<void> {
    try {
      if (!syncResult || !Array.isArray(syncResult.messages)) return;

      // Son assistant mesajını bul
      const lastAssistant = [...syncResult.messages]
        .reverse()
        .find((m) => m.role === "assistant" && (m.text || "").trim());
      
      if (!lastAssistant?.text) return;
      
      const text = lastAssistant.text.trim();

      // State machine'e göre işle
      await this._handleStateMachine(provider, text);

    } catch (e) {
      const err = e as Error;
      this._log("warning", `handleThinkingComplete error: ${err?.message || String(err)}`);
    }
  }

  /**
   * State machine ile relay akışını yönet
   * @private
   */
  async _handleStateMachine(provider: string, text: string): Promise<void> {
    // Aynı mesajı tekrar iletme
    if (this._lastTexts[provider] === text) return;
    this._lastTexts[provider] = text;

    const sessionId = this._session?.id || "unknown";

    // State: protocol-sent - AI protokole cevap verdi
    if (this._sessionState === "protocol-sent" && provider === this._sourceSlot) {
      this._sessionState = "ai-replied";
      this._log("info", `Session ${sessionId}: AI (${provider}) replied to protocol`, { 
        excerpt: text.slice(0, 200) 
      });

      // AI'nin cevabını Asistan'a ilet
      await this._forwardMessage(provider, this._targetSlot, text);
      
      // Artık relay aktif
      this._sessionState = "relay-active";
      return;
    }

    // State: relay-active - Normal relay modu
    if (this._sessionState === "relay-active" || this._sessionState === "ai-replied") {
      await this._handleRelayFlow(provider, text);
      return;
    }

    // State: idle veya bilinmeyen durum - log yaz
    this._log("debug", `Ignoring message in state ${this._sessionState} from ${provider}`);
  }

  /**
   * Mesajı hedef slot'a ilet
   * @private
   */
  async _forwardMessage(from: string, to: string | null, text: string): Promise<boolean> {
    // Hedef bağlı mı kontrol et
    if (!to || !SlotController.isConnected(to)) {
      this._log("info", `Forward skipped: target ${to} not connected`);
      return false;
    }

    this._forwardCount += 1;
    this._log("info", `AI-Asistan Relay forwarding (#${this._forwardCount}) ${from} -> ${to}`, {
      job: { from, to },
      excerpt: text.slice(0, 200),
    });

    try {
      await this.coreEngine.sendMessage({
        provider: to,
        text,
        page: "ai-asistan-relay",
      });
      return true;
    } catch (e) {
      const err = e as Error;
      this._log("warning", `AI-Asistan Relay forwarding failed: ${err?.message || String(err)}`, {
        from,
        to,
      });
      return false;
    }
  }

  /**
   * Normal relay akışını yönet (relay-active state)
   * @private
   */
  async _handleRelayFlow(provider: string, text: string): Promise<void> {
    // Hedefi belirle
    let target;
    if (provider === this._sourceSlot) {
      // Kaynak AI'dan mesaj geldi -> Asistan'a ilet
      target = this._targetSlot;
    } else if (provider === this._targetSlot) {
      // Asistan'dan mesaj geldi -> Kaynak AI'a ilet
      target = this._sourceSlot;
    } else {
      // Bu provider bu relay'e ait değil
      return;
    }

    await this._forwardMessage(provider, target, text);
  }

  /**
   * Thinking state değişimini takip et
   */
  checkThinkingTransition(provider: string, thinkingState: string): boolean {
    const prev = this._prevThinking[provider] || "idle";
    this._prevThinking[provider] = thinkingState;
    return prev !== "idle" && thinkingState === "idle";
  }
}
