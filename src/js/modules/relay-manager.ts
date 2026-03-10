import { LogCategory } from "@shared/logging-core";
import type { CoreEngine } from "./core-engine.js";

/**
 * RelayManager - Relay Orchestrator
 *
 * This module manages and coordinates all relay types:
 * - AIAIRelay: communication between two AIs
 * - AIAssistantRelay: communication between the AI and Assistant (AI0)
 */

import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { SettingsManager } from "./settings-manager.js";
import { CatchManager } from "./catch-manager.js";
import { Logger } from "./logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import { AIAIRelay } from "./relay/ai-ai-relay.js";
import { AIAssistantRelay } from "./relay/ai-assistant-relay.js";

class RelayManagerClass {
  coreEngine: typeof CoreEngine | null;
  _aiaiRelay: AIAIRelay | null;
  _aiAssistantRelay: AIAssistantRelay | null;
  _boundUpdate: typeof this._onTrafficUpdate;
  _boundSyncComplete: (event: Event) => void;
  _trafficUnsubscribe: (() => void) | null;
  _lastAi0Thinking: string;

  constructor() {
    this.coreEngine = null;
    this._aiaiRelay = null;
    this._aiAssistantRelay = null;
    this._boundUpdate = this._onTrafficUpdate.bind(this);
    this._boundSyncComplete = this._onSyncComplete.bind(this);
    this._trafficUnsubscribe = null;
    this._lastAi0Thinking = "idle";
  }

  init(coreEngine: typeof CoreEngine): void {
    this.coreEngine = coreEngine;

    this._aiaiRelay = new AIAIRelay(coreEngine);
    this._aiAssistantRelay = new AIAssistantRelay(coreEngine);

    if (this._trafficUnsubscribe !== null) {
      this._trafficUnsubscribe();
    }
    this._trafficUnsubscribe = TrafficManager.onUpdate(
      this._boundUpdate as (snapshot: { provider: string; state: unknown }) => void
    );

    window.addEventListener("sync-complete", this._boundSyncComplete);

    Logger.infoT(LogCategory.RELAY, "app.logs.relayManager.initialized");
  }

  /**
   * Checks whether any relay is active.
   * @returns {boolean}
   */
  isActive(): boolean {
    const ai1Active = this._aiaiRelay !== null && this._aiaiRelay.isActive === true;
    const assistantRelayActive =
      this._aiAssistantRelay !== null && this._aiAssistantRelay.isActive === true;
    return ai1Active || assistantRelayActive;
  }

  /**
   * Checks whether the AI-AI relay is active.
   * @returns {boolean}
   */
  isAIAIActive(): boolean {
    return this._aiaiRelay !== null && this._aiaiRelay.isActive === true;
  }

  /**
   * Checks whether the AI-Assistant relay is active.
   * @returns {boolean}
   */
  isAIAssistantActive(): boolean {
    return this._aiAssistantRelay !== null && this._aiAssistantRelay.isActive === true;
  }

  /**
   * Returns the source slot of the AI-Assistant relay.
   * @returns {string|null}
   */
  getAIAssistantSourceSlot(): string | null {
    return this._aiAssistantRelay !== null ? this._aiAssistantRelay.sourceSlot : null;
  }

  async startSession(opts = {}): Promise<void> {
    if (this._aiaiRelay !== null) {
      await this._aiaiRelay.start(opts);
    }
  }

  async stopSession(): Promise<void> {
    if (this._aiaiRelay !== null) {
      await this._aiaiRelay.stop();
    }
  }

  async startProtocolSession(opts = {}): Promise<void> {
    if (this._aiaiRelay !== null) {
      await this._aiaiRelay.startProtocolSession(opts);
    }
  }

  async stopProtocolSession(): Promise<void> {
    if (this._aiaiRelay !== null) {
      await this._aiaiRelay.stopProtocolSession();
    }
  }

  async startAIAssistantSession(sourceSlot: string): Promise<void> {
    if (this._aiaiRelay !== null && this._aiaiRelay.isActive === true) {
      await this._aiaiRelay.stop();
    }

    if (this._aiAssistantRelay !== null) {
      await this._aiAssistantRelay.start({ sourceSlot });
    }
  }

  async stopAIAssistantSession(): Promise<void> {
    if (this._aiAssistantRelay !== null) {
      await this._aiAssistantRelay.stop();
    }
  }

  async processAssistantCommandCatch(syncResult: Record<string, unknown> | null): Promise<boolean> {
    try {
      const settings = SettingsManager.getSnapshot() as {
        assistantSlot?: { catchCommands?: boolean };
      };
      const catchEnabled = settings.assistantSlot?.catchCommands === true;
      if (!catchEnabled) {
        return false;
      }

      const coreEngine = this.coreEngine;
      if (coreEngine?.handleCaughtCommand === undefined) {
        return false;
      }

      const messagesRaw = syncResult?.["messages"];
      const messages = Array.isArray(messagesRaw)
        ? (messagesRaw as Array<{ role?: string; text?: string; content?: string }>)
        : [];
      if (messages.length === 0) {
        return false;
      }

      const lastAssistant = [...messages].reverse().find((m) => {
        if (m.role !== "assistant") return false;
        const text = (m.text ?? m.content ?? "").trim();
        return text !== "";
      });

      const lastAssistantText = (lastAssistant?.text ?? lastAssistant?.content ?? "").trim();
      if (lastAssistantText === "") {
        return false;
      }

      const commands = CatchManager.catchCommands({
        provider: "ai0",
        webUrl: "relay://ai0-thinking-catch",
        messages: [{ role: "assistant", text: lastAssistantText }],
        prevCount: 0,
        hasExisting: false,
      });

      if (commands.length === 0) {
        return false;
      }

      await commands.reduce<Promise<void>>(async (prev, cmd) => {
        await prev;
        await coreEngine.handleCaughtCommand(cmd.command, {
          provider: "ai0",
          args: cmd.args,
          source: "ai0",
          text: lastAssistantText,
          target: "core",
        });
      }, Promise.resolve());

      return true;
    } catch (err) {
      Logger.warnT(LogCategory.RELAY, "app.logs.relayManager.assistantCommandCatchError", {
        message: getErrorMessage(err),
      });
      return false;
    }
  }

  /**
   * Handles TrafficManager updates.
   * @private
   */
  async _onTrafficUpdate(snapshot: {
    provider?: string;
    state?: { thinkingState?: string };
  }): Promise<void> {
    try {
      const provider = snapshot.provider;
      if (provider === undefined || provider === "") return;

      const state = snapshot.state ?? {};
      const currentThinking = state.thinkingState ?? "idle";

      if (provider === "ai0") {
        const prevAi0Thinking = this._lastAi0Thinking;
        this._lastAi0Thinking = currentThinking;

        if (prevAi0Thinking !== "idle" && currentThinking === "idle") {
          const ai0SyncResult = (await WebviewManager.syncLatestMessage("ai0")) as Record<
            string,
            unknown
          >;
          const handled = await this.processAssistantCommandCatch(ai0SyncResult);
          if (handled) {
            return;
          }
        }
      }

      let activeRelay = null;
      let thinkingComplete = false;

      if (
        this._aiAssistantRelay !== null &&
        this._aiAssistantRelay.handlesProvider(provider) === true
      ) {
        activeRelay = this._aiAssistantRelay;
        thinkingComplete = activeRelay.checkThinkingTransition(provider, currentThinking);
      } else if (this._aiaiRelay !== null && this._aiaiRelay.handlesProvider(provider) === true) {
        activeRelay = this._aiaiRelay;
        thinkingComplete = activeRelay.checkThinkingTransition(provider, currentThinking);
      }

      if (activeRelay !== null && thinkingComplete === true) {
        const shouldUseLatestOnlySync =
          activeRelay === this._aiAssistantRelay && provider === "ai0";
        const syncResult = (await (shouldUseLatestOnlySync
          ? WebviewManager.syncLatestMessage(provider)
          : WebviewManager.syncConversation(provider, null, {}))) as Record<string, unknown>;
        await activeRelay.handleThinkingComplete(provider, syncResult);
      }
    } catch (err) {
      Logger.warnT(
        LogCategory.RELAY,
        "app.logs.relayManager.trafficUpdateHandlerError",
        { message: getErrorMessage(err) },
        {
          provider: snapshot.provider,
          error: getErrorMessage(err),
        }
      );
    }
  }

  /**
   * Returns the AI-AI relay instance.
   * @returns {AIAIRelay}
   */
  get aiaiRelay(): AIAIRelay | null {
    return this._aiaiRelay;
  }

  /**
   * Returns the AI-Assistant relay instance.
   * @returns {AIAssistantRelay}
   */
  get aiAssistantRelay(): AIAssistantRelay | null {
    return this._aiAssistantRelay;
  }

  _onSyncComplete(event: Event): void {
    void (async (): Promise<void> => {
      try {
        const customEvent = event as CustomEvent<{
          provider: string;
          result: Record<string, unknown>;
          source?: string;
        }>;
        const provider = customEvent.detail.provider;
        const result = customEvent.detail.result;
        const source = customEvent.detail.source ?? "manual";

        if (provider === "") return;

        if (source !== "auto" && source !== "retry") {
          return;
        }

        if (
          this._aiaiRelay !== null &&
          this._aiaiRelay.isActive &&
          this._aiaiRelay.handlesProvider(provider)
        ) {
          await this._aiaiRelay.handleThinkingComplete(
            provider,
            result as unknown as Record<string, unknown>
          );
          return;
        }

        if (
          this._aiAssistantRelay === null ||
          this._aiAssistantRelay.isActive === false ||
          this._aiAssistantRelay.handlesProvider(provider) === false
        ) {
          return;
        }

        await this._aiAssistantRelay.handleThinkingComplete(
          provider,
          result as unknown as Record<string, unknown>
        );
      } catch (err) {
        const detail = (event as CustomEvent).detail as { provider?: string } | undefined;
        Logger.warnT(
          LogCategory.RELAY,
          "app.logs.relayManager.syncCompleteHandlerError",
          { message: getErrorMessage(err) },
          {
            provider: detail?.provider,
            error: getErrorMessage(err),
          }
        );
      }
    })();
  }
}

const relayManager = new RelayManagerClass();

export { relayManager, relayManager as RelayManager };
