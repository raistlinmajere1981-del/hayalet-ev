import { LogCategory, LogLevel } from "@shared/logging-core";
/**
 * BaseRelay - Tüm relay tiplerinin miras alacağı temel sınıf
 *
 * Bu abstract class, relay'lerin ortak davranışlarını tanımlar:
 * - UI göstergesi güncelleme
 * - Event dispatch
 * - Logging
 * - Temel state yönetimi
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
   * Relay aktif mi?
   * @returns {boolean}
   */
  get isActive(): boolean {
    return this._active;
  }

  /**
   * Session bilgisi
   * @returns {Object|null}
   */
  get session(): RelaySession | null {
    return this._session;
  }

  /**
   * Forward sayısı
   * @returns {number}
   */
  get forwardCount(): number {
    return this._forwardCount;
  }

  /**
   * Relay oturumu başlat - alt sınıflar override etmeli
   * @abstract
   * @param {Object} _opts - Oturum seçenekleri
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  start(_opts = {}): Promise<void> {
    return Promise.reject(new Error("start() must be implemented by subclass"));
  }

  /**
   * Relay oturumu durdur - alt sınıflar override etmeli
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
   * AI thinking tamamlandığında çağrılır - alt sınıflar override etmeli
   * @abstract
   * @param {string} _provider - AI slot (ai1 veya ai2)
   * @param {Object} _syncResult - Conversation sync sonucu
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  handleThinkingComplete(_provider: string, _syncResult: SyncResult | null): Promise<void> {
    return Promise.reject(new Error("handleThinkingComplete() must be implemented by subclass"));
  }

  /**
   * Bu relay bu provider'ı yönetiyor mu?
   * @param {string} _provider - AI slot
   * @returns {boolean}
   */
  handlesProvider(_provider: string): boolean {
    return false;
  }

  /**
   * Log event ekle
   * @protected
   * @param {string} level - Log seviyesi (info, warning, error)
   * @param {string} message - Log mesajı
   * @param {Object} context - Ek context
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

  /**
   * Custom event dispatch et
   * @protected
   * @param {string} eventName - Event adı
   * @param {Object} detail - Event detayları
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
   * UI göstergesini güncelle
   * @protected
   * @param {string} elementId - DOM element ID
   * @param {string} text - Gösterilecek metin
   * @param {string[]} addClasses - Eklenecek CSS class'ları
   * @param {string[]} removeClasses - Kaldırılacak CSS class'ları
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
   * Session state'i sıfırla
   * @protected
   */
  _resetState(): void {
    this._active = false;
    this._session = null;
    this._forwardCount = 0;
  }

  /**
   * Unique session ID oluştur
   * @protected
   * @param {string} prefix - ID prefix'i
   * @returns {string}
   */
  _generateSessionId(prefix = LogCategory.RELAY): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
