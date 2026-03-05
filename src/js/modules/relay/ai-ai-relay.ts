/**
 * AIAIRelay - İki AI arasındaki iletişimi yöneten relay
 *
 * Bu sınıf AI-to-AI konuşmalarını yönetir:
 * - Basit relay: AI1 ↔ AI2 mesaj iletimi
 * - Protokol relay: Structured protocol ile başlayan oturumlar
 */

import { BaseRelay } from "./base-relay.js";
import type { SyncResult } from "./base-relay.js";
import { LogCategory } from "@shared/logging-core";
import { SlotController } from "../slot-controller.js";
import { getErrorMessage } from "@shared/index.js";
import type { CoreEngine as CoreEngineType } from "../core-engine.js";

interface ProtocolPayload {
  room?: string;
  scenario?: string;
  targets?: string[];
  [key: string]: unknown;
}

interface ProtocolAttachment {
  name: string;
  path: string;
  mimeType?: string;
}

interface ProtocolSessionOpts {
  providers?: string[];
  protocolPayload?: ProtocolPayload;
  attachments?: ProtocolAttachment[];
}

export class AIAIRelay extends BaseRelay {
  _providers: string[];
  _prevThinking: Record<string, string>;
  _lastMessageTimes: Record<string, number>;

  constructor(coreEngine: CoreEngineType) {
    super(coreEngine);
    this._providers = ["ai1", "ai2"];
    this._prevThinking = { ai1: "idle", ai2: "idle" };
    this._lastMessageTimes = { ai1: 0, ai2: 0 };
  }

  /**
   * Bu relay bu provider'ı yönetiyor mu?
   * @param {string} provider - AI slot
   * @returns {boolean}
   */
  override handlesProvider(provider: string): boolean {
    return this._active === true && this._providers.includes(provider);
  }

  /**
   * Basit AI-AI relay oturumu başlat
   * @param {Object} opts - { providers: ['ai1', 'ai2'] }
   */
  override async start(opts: { providers?: string[] } = {}): Promise<void> {
    this._providers =
      Array.isArray(opts.providers) && opts.providers.length > 0 ? opts.providers : ["ai1", "ai2"];

    this._active = true;
    this._forwardCount = 0;
    const provider0 = this._providers[0];
    const provider1 = this._providers[1];
    if (provider0 !== undefined && provider1 !== undefined) {
      this._lastMessageTimes = { [provider0]: 0, [provider1]: 0 };
    }

    this._log("info", `AI-AI Relay started: ${this._providers.join(",")}`);
    this._dispatchEvent("relay-changed", { active: true, type: "ai-ai" });
    await Promise.resolve();
  }

  /**
   * Protokol tabanlı AI-AI oturumu başlat
   * Önce providers[0]'a protokol gönderir, yanıt alınca providers[1]'e iletir,
   * sonra relay aktif olarak mesajları ileri geri taşır.
   *
   * @param {Object} opts - { providers, protocolPayload, attachments }
   */
  async startProtocolSession(opts: ProtocolSessionOpts = {}): Promise<void> {
    try {
      const id = this._generateSessionId(LogCategory.RELAY);

      const providersArray = opts.providers ?? this._providers;
      const provider0 = providersArray[0];
      const provider1 = providersArray[1];
      if (provider0 === undefined || provider1 === undefined) {
        throw new Error("Invalid providers in session");
      }

      this._session = {
        id,
        type: "protocol",
        providers: [...providersArray],
        protocolPayload: { ...opts.protocolPayload },
        attachments: Array.isArray(opts.attachments) ? [...opts.attachments] : [],
        state: "sent-to-ai1",
        lastMessageTimes: { [provider0]: 0, [provider1]: 0 },
        forwardCount: 0,
        createdAt: Date.now(),
      };

      this._providers = [...providersArray];
      this._active = true;
      this._lastMessageTimes = this._session.lastMessageTimes ?? {
        [provider0]: 0,
        [provider1]: 0,
      };

      const first = providersArray[0];
      if (first === undefined) throw new Error("First provider is undefined");
      const protocolPayload = this._session.protocolPayload as Record<string, unknown> | undefined;
      const protocolMessage = protocolPayload?.["message"];
      const message = typeof protocolMessage === "string" ? protocolMessage : "";
      const attachments = this._session.attachments ?? [];

      this._log("info", `Protocol session ${id}: sending to ${first}`);

      if (this.coreEngine.sendToTargets !== undefined) {
        await this.coreEngine.sendToTargets({
          targets: [first],
          text: message,
          page: "protocol-relay",
          attachments: attachments,
        });
      }

      this._log("info", `Protocol session ${id}: sent to ${first}`);
      this._dispatchEvent("relay-changed", { active: true, type: "ai-ai-protocol" });
    } catch (err) {
      this._log("warning", `startProtocolSession error: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  override async stop(): Promise<void> {
    const wasProtocol = this._session?.type === "protocol";
    const sessionId = this._session?.id;

    if (sessionId !== undefined && sessionId !== "") {
      this._log(
        "info",
        `${wasProtocol === true ? "Protocol session" : "Relay"} ${sessionId} stopped`
      );
    } else {
      this._log("info", "AI-AI Relay stopped");
    }

    this._resetState();
    this._prevThinking = { ai1: "idle", ai2: "idle" };
    this._lastMessageTimes = { ai1: 0, ai2: 0 };

    this._dispatchEvent("relay-changed", { active: false, type: "ai-ai" });
    await Promise.resolve();
  }

  /**
   * Protokol oturumunu durdur (alias for stop)
   */
  override async stopProtocolSession(): Promise<void> {
    await this.stop();
  }

  /**
   * AI thinking tamamlandığında çağrılır
   * @param {string} provider - AI slot (ai1 veya ai2)
   * @param {Object} syncResult - Conversation sync sonucu
   */
  override async handleThinkingComplete(
    provider: string,
    syncResult: SyncResult | null
  ): Promise<void> {
    try {
      if (syncResult === null || !Array.isArray(syncResult.messages)) return;

      const lastAssistant = [...syncResult.messages]
        .reverse()
        .find(
          (m) =>
            m.role === "assistant" &&
            (m.text !== undefined || m.content !== undefined) &&
            (m.text ?? m.content ?? "").trim() !== ""
        );

      const lastAssistantText = lastAssistant?.text ?? lastAssistant?.content;
      if (lastAssistantText == null) return;

      const text = lastAssistantText.trim();

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
  async _handleProtocolFlow(provider: string, text: string): Promise<void> {
    const s = this._session;
    if (s?.providers === undefined || s.lastMessageTimes === undefined) return;

    const [ai1, ai2] = s.providers;
    if (ai1 === undefined || ai2 === undefined) return;

    if (s.state === "sent-to-ai1" && provider === ai1) {
      const now = Date.now();
      if (s.lastMessageTimes[ai1] === now) return;
      s.lastMessageTimes[ai1] = now;

      this._log("info", `Protocol session ${s.id}: ${ai1} replied`, {
        excerpt: text.slice(0, 200),
      });

      const protocolPayload = s.protocolPayload as Record<string, unknown> | undefined;
      const protocolMessage = protocolPayload?.["message"];
      const baseMsg = typeof protocolMessage === "string" ? protocolMessage : "";
      const forwardText = `${baseMsg}\n\n[${ai1}]: ${text}`;
      s.state = "sent-to-ai2";

      try {
        if (this.coreEngine.sendToTargets !== undefined) {
          await this.coreEngine.sendToTargets({
            targets: [ai2],
            text: forwardText,
            page: "protocol-relay",
            attachments: s.attachments ?? [],
          });
        }
        this._log("info", `Protocol session ${s.id}: forwarded ${ai1} -> ${ai2}`);
      } catch (e) {
        this._log(
          "warning",
          `Protocol session ${s.id}: forward to ${ai2} failed: ${getErrorMessage(e)}`
        );
      }
      return;
    }

    if ((s.state === "sent-to-ai2" || s.state === "relay-active") && provider === ai2) {
      const now = Date.now();
      if (s.lastMessageTimes[ai2] === now) return;
      s.lastMessageTimes[ai2] = now;

      s.state = "relay-active";
      s.forwardCount = (s.forwardCount ?? 0) + 1;
      this._forwardCount = s.forwardCount;

      this._log(
        "info",
        `Protocol session ${s.id}: forwarding ${ai2} -> ${ai1} (#${s.forwardCount})`,
        { excerpt: text.slice(0, 200) }
      );

      try {
        if (this.coreEngine.sendMessage !== undefined) {
          await this.coreEngine.sendMessage({
            provider: ai1,
            text,
            page: "relay",
          });
        }
      } catch (e) {
        this._log(
          "warning",
          `Protocol session ${s.id}: forward ${ai2}->${ai1} failed: ${getErrorMessage(e)}`
        );
      }
      return;
    }

    if (s.state === "relay-active" && provider === ai1) {
      const now = Date.now();
      if (s.lastMessageTimes[ai1] === now) return;
      s.lastMessageTimes[ai1] = now;

      s.forwardCount = (s.forwardCount ?? 0) + 1;
      this._forwardCount = s.forwardCount;

      this._log(
        "info",
        `Protocol session ${s.id}: forwarding ${ai1} -> ${ai2} (#${s.forwardCount})`,
        { excerpt: text.slice(0, 200) }
      );

      try {
        if (this.coreEngine.sendMessage !== undefined) {
          await this.coreEngine.sendMessage({
            provider: ai2,
            text,
            page: "relay",
          });
        }
      } catch (e) {
        this._log(
          "warning",
          `Protocol session ${s.id}: forward ${ai1}->${ai2} failed: ${getErrorMessage(e)}`
        );
      }
    }
  }

  /**
   * Basit relay akışını yönet
   * @private
   */
  async _handleSimpleRelayFlow(provider: string, text: string): Promise<void> {
    const now = Date.now();
    if (this._lastMessageTimes[provider] === now) return;
    this._lastMessageTimes[provider] = now;

    const target = this._determineTarget(provider);
    if (target === "") {
      this._log("warning", "Could not determine relay target");
      return;
    }

    if (SlotController.isConnected(target) === false) {
      this._log("info", `Relay skipped: target ${target} not connected`);
      return;
    }

    this._forwardCount += 1;
    this._log("info", `Relay forwarding (#${this._forwardCount}) ${provider} -> ${target}`, {
      job: { from: provider, to: target },
      excerpt: text.slice(0, 200),
    });

    try {
      if (this.coreEngine.sendMessage !== undefined) {
        await this.coreEngine.sendMessage({
          provider: target,
          text,
          page: "relay",
        });
      }
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
  _determineTarget(source: string): string {
    const idx = this._providers.indexOf(source);
    if (idx === -1) return this._providers[0] ?? "";
    return this._providers[(idx + 1) % this._providers.length] ?? "";
  }

  /**
   * Thinking state değişimini takip et
   * @param {string} provider - AI slot
   * @param {string} thinkingState - Yeni thinking state
   * @returns {boolean} - Thinking tamamlandı mı?
   */
  checkThinkingTransition(provider: string, thinkingState: string): boolean {
    const prev = this._prevThinking[provider] ?? "idle";
    this._prevThinking[provider] = thinkingState;
    return prev !== "idle" && thinkingState === "idle";
  }
}
