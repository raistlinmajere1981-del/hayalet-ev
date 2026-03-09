import { LogCategory, LogLevel } from "@shared/logging-core";
import type { TranslationParams } from "@shared/i18n.js";
/**
 * BaseRelay - base class for all relay types
 *
 * This abstract class defines shared relay behavior:
 * - UI indicator updates
 * - Event dispatch
 * - Logging
 * - Basic state management
 */

import { Logger } from "../logger/index.js";

export interface CoreEngineInterface {
  sendToTargets?: (payload: {
    targets?: string[];
    message?: string;
    [key: string]: unknown;
  }) => Promise<unknown>;
  sendMessage?: (payload: {
    provider?: string;
    text?: string;
    attachments?: unknown[];
    [key: string]: unknown;
  }) => Promise<unknown>;
  handleCaughtCommand?: (
    commandName: string,
    payload?: {
      provider?: string;
      args?: string;
      source?: string;
      text?: string;
      [key: string]: unknown;
    }
  ) => Promise<unknown>;
}

type CoreEngineRef = CoreEngineInterface;

interface RelaySession {
  id: string;
  startedAt?: number;
  createdAt?: number;
  sourceSlot?: string;
  targetSlot?: string;
  mode?: string;
  type?: string;
  providers?: string[];
  state?: string;
  lastTexts?: Record<string, string>;
  lastMessageTimes?: Record<string, number>;
  forwardCount?: number;
  protocolPayload?: unknown;
  attachments?: Array<{ name: string; path: string; mimeType?: string }>;
  [key: string]: unknown;
}

export interface SyncResult {
  success?: boolean;
  messages?: Array<{ role?: string; text?: string; content?: string; [key: string]: unknown }>;
  count?: number;
  conversationId?: string;
  webUrl?: string;
  added?: number;
  total?: number;
  newEntry?: boolean;
  commands?: Array<{ command: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export class BaseRelay {
  coreEngine: CoreEngineRef;
  _active: boolean;
  _session: RelaySession | null;
  _forwardCount: number;

  constructor(coreEngine: CoreEngineRef) {
    this.coreEngine = coreEngine;
    this._active = false;
    this._session = null;
    this._forwardCount = 0;
  }

  /**
   * Whether the relay is active.
   * @returns {boolean}
   */
  get isActive(): boolean {
    return this._active;
  }

  /**
   * Session information.
   * @returns {Object|null}
   */
  get session(): RelaySession | null {
    return this._session;
  }

  /**
   * Forward count.
   * @returns {number}
   */
  get forwardCount(): number {
    return this._forwardCount;
  }

  /**
   * Start the relay session. Subclasses must override this.
   * @abstract
   * @param {Object} _opts - Session options
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  start(_opts = {}): Promise<void> {
    return Promise.reject(new Error("start() must be implemented by subclass"));
  }

  /**
   * Stop the relay session. Subclasses must override this.
   * @abstract
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  stop(): Promise<void> {
    return Promise.reject(new Error("stop() must be implemented by subclass"));
  }

  async stopProtocolSession(): Promise<void> {
    await this.stop();
  }

  /**
   * Called when AI thinking completes. Subclasses must override this.
   * @abstract
   * @param {string} _provider - AI slot (ai1 or ai2)
   * @param {Object} _syncResult - Conversation sync result
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  handleThinkingComplete(_provider: string, _syncResult: SyncResult | null): Promise<void> {
    return Promise.reject(new Error("handleThinkingComplete() must be implemented by subclass"));
  }

  /**
   * Whether this relay manages the given provider.
   * @param {string} _provider - AI slot
   * @returns {boolean}
   */
  handlesProvider(_provider: string): boolean {
    return false;
  }

  /**
   * Add a log event.
   * @protected
   * @param {string} level - Log level (info, warning, error)
   * @param {string} message - Log message
   * @param {Object} context - Extra context
   */
  _log(level: string, message: string, context: Record<string, unknown> = {}): void {
    const logContext = {
      relayType: this.constructor.name,
      ...context,
      ...(this._session?.id !== undefined ? { sessionId: this._session.id } : {}),
    };

    if (level === "error") {
      Logger.panel(LogCategory.RELAY, LogLevel.ERROR, message, logContext);
    } else if (level === "warning" || level === "warn") {
      Logger.panel(LogCategory.RELAY, LogLevel.WARNING, message, logContext);
    } else if (level === "debug") {
      Logger.debug(LogCategory.RELAY, message, logContext);
    } else {
      Logger.panel(LogCategory.RELAY, LogLevel.INFO, message, logContext);
    }
  }

  _logT(
    level: string,
    key: string,
    params?: TranslationParams,
    context: Record<string, unknown> = {}
  ): void {
    const logContext = {
      relayType: this.constructor.name,
      ...context,
      ...(this._session?.id !== undefined ? { sessionId: this._session.id } : {}),
    };

    if (level === "error") {
      Logger.errorT(LogCategory.RELAY, key, params, logContext);
    } else if (level === "warning" || level === "warn") {
      Logger.warnT(LogCategory.RELAY, key, params, logContext);
    } else if (level === "debug") {
      Logger.debugT(LogCategory.RELAY, key, params, logContext);
    } else {
      Logger.infoT(LogCategory.RELAY, key, params, logContext);
    }
  }

  /**
   * Dispatch a custom event.
   * @protected
   * @param {string} eventName - Event name
   * @param {Object} detail - Event details
   */
  _dispatchEvent(eventName: string, detail: Record<string, unknown> = {}): void {
    try {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            relayType: this.constructor.name,
            ...detail,
          },
        })
      );
    } catch {
      /* noop */
    }
  }

  /**
   * Update the UI indicator.
   * @protected
   * @param {string} elementId - DOM element ID
   * @param {string} text - Text to display
   * @param {string[]} addClasses - CSS classes to add
   * @param {string[]} removeClasses - CSS classes to remove
   */
  _updateIndicatorElement(
    elementId: string,
    text: string,
    addClasses: string[] = [],
    removeClasses: string[] = []
  ): void {
    try {
      const el = document.getElementById(elementId);
      if (el === null) return;

      el.textContent = text;
      addClasses.forEach((cls) => {
        el.classList.add(cls);
      });
      removeClasses.forEach((cls) => {
        el.classList.remove(cls);
      });
    } catch {
      /* noop */
    }
  }

  /**
   * Reset the session state.
   * @protected
   */
  _resetState(): void {
    this._active = false;
    this._session = null;
    this._forwardCount = 0;
  }

  /**
   * Generate a unique session ID.
   * @protected
   * @param {string} prefix - ID prefix
   * @returns {string}
   */
  _generateSessionId(prefix = LogCategory.RELAY): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
