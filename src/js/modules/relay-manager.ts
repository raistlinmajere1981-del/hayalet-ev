import { LogCategory } from "@shared/logging-core";
import type { CoreEngine } from "./core-engine.js";

/**
 * RelayManager - Relay Orchestrator
 *
 * Bu modül tüm relay tiplerini yönetir ve koordine eder:
 * - AIAIRelay: İki AI arasındaki iletişim
 * - AIAsistanRelay: AI ve Asistan (AI0) arasındaki iletişim
 */

import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { SettingsManager } from "./settings-manager.js";
import { CatchManager } from "./catch-manager.js";
import { Logger } from "./logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import { AIAIRelay } from "./relay/ai-ai-relay.js";
import { AIAsistanRelay } from "./relay/ai-asistan-relay.js";

class RelayManagerClass {
  coreEngine: typeof CoreEngine | null;
  _aiaiRelay: AIAIRelay | null;
  _aiAsistanRelay: AIAsistanRelay | null;
  _boundUpdate: typeof this._onTrafficUpdate;
  _boundSyncComplete: (event: Event) => void;
  _trafficUnsubscribe: (() => void) | null;
  _lastAi0Thinking: string;

  constructor() {
    this.coreEngine = null;
    this._aiaiRelay = null;
    this._aiAsistanRelay = null;
    this._boundUpdate = this._onTrafficUpdate.bind(this);
    this._boundSyncComplete = this._onSyncComplete.bind(this);
    this._trafficUnsubscribe = null;
    this._lastAi0Thinking = "idle";
  }

  init(coreEngine: typeof CoreEngine): void {
    this.coreEngine = coreEngine;

    this._aiaiRelay = new AIAIRelay(coreEngine);
    this._aiAsistanRelay = new AIAsistanRelay(coreEngine);

    if (this._trafficUnsubscribe !== null) {
      this._trafficUnsubscribe();
    }
    this._trafficUnsubscribe = TrafficManager.onUpdate(
      this._boundUpdate as (snapshot: { provider: string; state: unknown }) => void
    );

    window.addEventListener("sync-complete", this._boundSyncComplete);

    Logger.info(LogCategory.RELAY, "RelayManager initialized with AI-AI and AI-Asistan relays");
  }

  /**
   * Herhangi bir relay aktif mi?
   * @returns {boolean}
   */
  isActive(): boolean {
    const ai1Active = this._aiaiRelay !== null && this._aiaiRelay.isActive === true;
    const asistanActive = this._aiAsistanRelay !== null && this._aiAsistanRelay.isActive === true;
    return ai1Active || asistanActive;
  }

  /**
   * AI-AI relay aktif mi?
   * @returns {boolean}
   */
  isAIAIActive(): boolean {
    return this._aiaiRelay !== null && this._aiaiRelay.isActive === true;
  }

  /**
   * AI-Asistan relay aktif mi?
   * @returns {boolean}
   */
  isAIAsistanActive(): boolean {
    return this._aiAsistanRelay !== null && this._aiAsistanRelay.isActive === true;
  }

  /**
   * AI-Asistan relay kaynak slotunu döndür
   * @returns {string|null}
   */
  getAIAsistanSourceSlot(): string | null {
    return this._aiAsistanRelay !== null ? this._aiAsistanRelay.sourceSlot : null;
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

  async startAIAsistanSession(sourceSlot: string): Promise<void> {
    if (this._aiaiRelay !== null && this._aiaiRelay.isActive === true) {
      await this._aiaiRelay.stop();
    }

    if (this._aiAsistanRelay !== null) {
      await this._aiAsistanRelay.start({ sourceSlot });
    }
  }

  async stopAIAsistanSession(): Promise<void> {
    if (this._aiAsistanRelay !== null) {
      await this._aiAsistanRelay.stop();
    }
  }

  async processAsistanCommandCatch(syncResult: Record<string, unknown> | null): Promise<boolean> {
    try {
      const settings = SettingsManager.getSnapshot() as {
        asistanSlot?: { catchCommands?: boolean };
      };
      const catchEnabled = settings.asistanSlot?.catchCommands === true;
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
      Logger.warn(LogCategory.RELAY, `Asistan command catch error: ${getErrorMessage(err)}`);
      return false;
    }
  }

  /**
   * TrafficManager update'lerini işle
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
          const handled = await this.processAsistanCommandCatch(ai0SyncResult);
          if (handled) {
            return;
          }
        }
      }

      let activeRelay = null;
      let thinkingComplete = false;

      if (
        this._aiAsistanRelay !== null &&
        this._aiAsistanRelay.handlesProvider(provider) === true
      ) {
        activeRelay = this._aiAsistanRelay;
        thinkingComplete = activeRelay.checkThinkingTransition(provider, currentThinking);
      } else if (this._aiaiRelay !== null && this._aiaiRelay.handlesProvider(provider) === true) {
        activeRelay = this._aiaiRelay;
        thinkingComplete = activeRelay.checkThinkingTransition(provider, currentThinking);
      }

      if (activeRelay !== null && thinkingComplete === true) {
        const shouldUseLatestOnlySync = activeRelay === this._aiAsistanRelay && provider === "ai0";
        const syncResult = (await (shouldUseLatestOnlySync
          ? WebviewManager.syncLatestMessage(provider)
          : WebviewManager.syncConversation(provider, null, {}))) as Record<string, unknown>;
        await activeRelay.handleThinkingComplete(provider, syncResult);
      }
    } catch (err) {
      Logger.warn(LogCategory.RELAY, `Traffic update handler error: ${getErrorMessage(err)}`, {
        provider: snapshot.provider,
        error: getErrorMessage(err),
      });
    }
  }

  /**
   * AI-AI Relay instance'ına erişim
   * @returns {AIAIRelay}
   */
  get aiaiRelay(): AIAIRelay | null {
    return this._aiaiRelay;
  }

  /**
   * AI-Asistan Relay instance'ına erişim
   * @returns {AIAsistanRelay}
   */
  get aiAsistanRelay(): AIAsistanRelay | null {
    return this._aiAsistanRelay;
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
          this._aiAsistanRelay === null ||
          this._aiAsistanRelay.isActive === false ||
          this._aiAsistanRelay.handlesProvider(provider) === false
        ) {
          return;
        }

        await this._aiAsistanRelay.handleThinkingComplete(
          provider,
          result as unknown as Record<string, unknown>
        );
      } catch (err) {
        const detail = (event as CustomEvent).detail as { provider?: string } | undefined;
        Logger.warn(LogCategory.RELAY, `Sync complete handler error: ${getErrorMessage(err)}`, {
          provider: detail?.provider,
          error: getErrorMessage(err),
        });
      }
    })();
  }
}

const relayManager = new RelayManagerClass();

export { relayManager, relayManager as RelayManager };
