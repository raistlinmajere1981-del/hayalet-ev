/**
 * AIAssistantRelay - manages communication between an AI slot and Assistant (AI0)
 *
 * This relay coordinates AI-to-Assistant conversations:
 * - AI1 ↔ AI0 (Assistant) message delivery
 * - AI2 ↔ AI0 (Assistant) message delivery
 *
 * Assistant (AI0) acts as a helper AI for technical questions.
 *
 * Flow:
 * 1. Send the protocol to the AI
 * 2. AI replies and the message is forwarded to Assistant
 * 3. Assistant replies and the message is forwarded back to the AI
 * 4. The loop continues
 */

import { BaseRelay } from "./base-relay.js";
import type { CoreEngineInterface } from "./base-relay.js";
import { LogCategory } from "@shared/logging-core";
import { SlotController } from "../slot-controller.js";
import { resolveComposedProtocolMessage } from "../protocol-message-composer.js";
import { START_STOP_PROTOCOL_HEADERS } from "../protocol-default-headers.js";
import { PROTOCOL_KEY } from "@slots";

const AI_ASSISTANT_PROTOCOL_FALLBACK_TITLE =
  START_STOP_PROTOCOL_HEADERS.ANALYZE_AI_ASSISTANT_START;

interface SyncResult {
  messages?: { role?: string; text?: string; content?: string }[];
}

export class AIAssistantRelay extends BaseRelay {
  _sourceSlot: string | null;
  _targetSlot: string;
  _prevThinking: Record<string, string>;
  _lastMessageTimes: Record<string, number>;
  _sessionState: string;

  constructor(coreEngine: CoreEngineInterface) {
    super(coreEngine);
    this._sourceSlot = null;
    this._targetSlot = "ai0";
    this._prevThinking = { ai0: "idle", ai1: "idle", ai2: "idle" };
    this._lastMessageTimes = { ai0: 0, ai1: 0, ai2: 0 };

    this._sessionState = "idle";
  }

  override handlesProvider(provider: string): boolean {
    if (this._active === false) return false;
    return provider === this._sourceSlot || provider === this._targetSlot;
  }

  get sourceSlot(): string | null {
    return this._sourceSlot;
  }

  override async start(opts: { sourceSlot?: string } = {}): Promise<void> {
    const source = opts.sourceSlot;

    if (source === undefined || (source !== "ai1" && source !== "ai2")) {
      throw new Error("Invalid sourceSlot: must be 'ai1' or 'ai2'");
    }

    if (SlotController.isConnected(source) === false) {
      throw new Error(`Source slot ${source} is not connected`);
    }

    if (SlotController.isConnected(this._targetSlot) === false) {
      throw new Error(`Assistant (${this._targetSlot}) is not connected`);
    }

    this._sourceSlot = source;
    this._active = true;
    this._forwardCount = 0;
    this._sessionState = "idle";
    this._lastMessageTimes = {
      [source]: 0,
      [this._targetSlot]: 0,
    };

    const sessionId = this._generateSessionId(LogCategory.RELAY);
    this._session = {
      id: sessionId,
      type: "ai-assistant",
      sourceSlot: source,
      targetSlot: this._targetSlot,
      createdAt: Date.now(),
    };

    this._log("info", `AI-Assistant relay started: ${source} ↔ ${this._targetSlot}`);
    this._dispatchEvent("relay-changed", {
      active: true,
      type: "ai-assistant",
      sourceSlot: source,
      targetSlot: this._targetSlot,
    });

    await this._sendProtocolToAI(source);
  }

  /**
   * Read the protocol and send it to the AI.
   * @private
   */
  async _sendProtocolToAI(aiSlot: string): Promise<void> {
    try {
      const protocol = await this._loadProtocol();

      this._sessionState = "protocol-sent";
      this._log("info", `Sending protocol to ${aiSlot}`, {
        sessionId: this._session?.id,
        protocolLength: protocol.length,
      });

      if (this.coreEngine.sendMessage === undefined) {
        throw new Error("sendMessage method not available");
      }
      await this.coreEngine.sendMessage({
        provider: aiSlot,
        text: protocol,
        page: "ai-assistant-protocol",
      });

      this._log("info", `Protocol sent to ${aiSlot}`);
    } catch (e) {
      const err = e as Error;
      this._log("warning", `Failed to send protocol: ${err.message}`);
      this._sessionState = "relay-active";
    }
  }

  /**
   * Load protocol content from the composed protocol source.
   * @private
   */
  async _loadProtocol(): Promise<string> {
    const resolvedMessage = await resolveComposedProtocolMessage({
      fallbackTitle: AI_ASSISTANT_PROTOCOL_FALLBACK_TITLE,
      protocolKey: PROTOCOL_KEY,
    });

    if (resolvedMessage.error !== undefined) {
      this._log("warning", `Protocol load error: ${resolvedMessage.error.message}`);
    }

    return resolvedMessage.message;
  }

  override async stop(): Promise<void> {
    const sessionId = this._session?.id;
    const source = this._sourceSlot;

    if (sessionId !== undefined && sessionId !== "") {
      this._log(
        "info",
        `AI-Assistant relay ${sessionId} stopped (${source ?? "unknown"} ↔ ${this._targetSlot})`
      );
    } else {
      this._log("info", "AI-Assistant relay stopped");
    }

    this._sourceSlot = null;
    this._sessionState = "idle";
    this._resetState();
    this._prevThinking = { ai0: "idle", ai1: "idle", ai2: "idle" };
    this._lastMessageTimes = { ai0: 0, ai1: 0, ai2: 0 };

    this._dispatchEvent("relay-changed", { active: false, type: "ai-assistant" });
    await Promise.resolve();
  }

  override async handleThinkingComplete(
    provider: string,
    syncResult: SyncResult | null
  ): Promise<void> {
    try {
      if (syncResult === null || !Array.isArray(syncResult.messages)) {
        return;
      }

      const lastAssistant = [...syncResult.messages]
        .reverse()
        .find(
          (m) =>
            m.role === "assistant" &&
            ((m.text !== undefined && m.text !== "") ||
              (m.content !== undefined && m.content !== ""))
        );

      const lastAssistantText = lastAssistant?.text ?? lastAssistant?.content;

      if (lastAssistantText === undefined || lastAssistantText === "") {
        return;
      }

      const text = lastAssistantText.trim();

      await this._handleStateMachine(provider, text);
    } catch (e) {
      const err = e as Error;
      this._log("warning", `handleThinkingComplete error: ${err.message}`);
    }
  }

  /**
   * Manage the relay flow with a simple state machine.
   * @private
   */
  async _handleStateMachine(provider: string, text: string): Promise<void> {
    // Timestamp-based duplicate protection.
    const now = Date.now();

    if (this._lastMessageTimes[provider] === now) {
      this._log("warning", `Duplicate message detected for ${provider} - blocking`);
      return;
    }
    this._lastMessageTimes[provider] = now;

    const sessionId = this._session?.id ?? "unknown";

    if (this._sessionState === "protocol-sent" && provider === this._sourceSlot) {
      this._log("info", `Session ${sessionId}: AI (${provider}) replied to protocol`, {
        excerpt: text.slice(0, 200),
      });

      await this._forwardMessage(provider, this._targetSlot, text);

      this._sessionState = "relay-active";
      return;
    }

    if (this._sessionState === "relay-active" || this._sessionState === "ai-replied") {
      await this._handleRelayFlow(provider, text);
      return;
    }

    this._log("debug", `Ignoring message in state ${this._sessionState} from ${provider}`);
  }

  /**
   * Forward the message to the target slot.
   * @private
   */
  async _forwardMessage(from: string, to: string | null, text: string): Promise<boolean> {
    if (to === null || SlotController.isConnected(to) === false) {
      this._log("info", `Forward skipped: target ${to ?? "unknown"} not connected`);
      return false;
    }

    this._forwardCount += 1;
    this._log("info", `AI-Assistant relay forwarding (#${this._forwardCount}) ${from} -> ${to}`, {
      job: { from, to },
      excerpt: text.slice(0, 200),
    });

    try {
      if (this.coreEngine.sendMessage === undefined) {
        throw new Error("sendMessage method not available");
      }
      await this.coreEngine.sendMessage({
        provider: to,
        text,
        page: "ai-assistant-relay",
      });
      return true;
    } catch (e) {
      const err = e as Error;
      this._log("warning", `AI-Assistant relay forwarding failed: ${err.message}`, {
        from,
        to,
      });
      return false;
    }
  }

  /**
   * Process the normal relay flow in the `relay-active` state.
   * @private
   */
  async _handleRelayFlow(provider: string, text: string): Promise<void> {
    let target: string | null;

    if (provider === this._sourceSlot) {
      target = this._targetSlot;
    } else if (provider === this._targetSlot) {
      target = this._sourceSlot;
    } else {
      this._log("warning", `Provider ${provider} not recognized in relay flow`);
      return;
    }

    if (target === null) {
      this._log("warning", `Target is null for provider ${provider}`);
      return;
    }

    await this._forwardMessage(provider, target, text);
  }

  checkThinkingTransition(provider: string, thinkingState: string): boolean {
    const prev = this._prevThinking[provider] ?? "idle";
    const transitionDetected = prev !== "idle" && thinkingState === "idle";

    if (prev !== thinkingState) {
      this._log("debug", `Thinking transition: ${provider} ${prev} → ${thinkingState}`);
    }

    this._prevThinking[provider] = thinkingState;
    return transitionDetected;
  }
}
