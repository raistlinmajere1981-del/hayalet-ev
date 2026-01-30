/**
 * BaseRelay - Tüm relay tiplerinin miras alacağı temel sınıf
 * 
 * Bu abstract class, relay'lerin ortak davranışlarını tanımlar:
 * - UI göstergesi güncelleme
 * - Event dispatch
 * - Logging
 * - Temel state yönetimi
 */

import { LogManager } from "../log-manager.js";

/** CoreEngine interface - relay'lerin ihtiyaç duyduğu metodlar */
 
type CoreEngineRef = any;

/** Relay session bilgisi - esnek yapı, alt sınıflar genişletebilir */
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
  forwardCount?: number;
  protocolPayload?: unknown;
  attachments?: unknown[];
  [key: string]: unknown;
}

/** Sync result interface */
interface SyncResult {
  success?: boolean;
  messages?: Array<{ role?: string; text?: string; [key: string]: unknown }>;
  count?: number;
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
  get isActive() {
    return this._active;
  }

  /**
   * Session bilgisi
   * @returns {Object|null}
   */
  get session() {
    return this._session;
  }

  /**
   * Forward sayısı
   * @returns {number}
   */
  get forwardCount() {
    return this._forwardCount;
  }

  /**
   * Relay oturumu başlat - alt sınıflar override etmeli
   * @abstract
   * @param {Object} _opts - Oturum seçenekleri
   */
  async start(_opts = {}) {
    throw new Error("start() must be implemented by subclass");
  }

  /**
   * Relay oturumu durdur - alt sınıflar override etmeli
   * @abstract
   */
  async stop() {
    throw new Error("stop() must be implemented by subclass");
  }

  /**
   * Protokol oturumunu durdur (opsiyonel override)
   */
  async stopProtocolSession() {
    await this.stop();
  }


  /**
   * AI thinking tamamlandığında çağrılır - alt sınıflar override etmeli
   * @abstract
   * @param {string} _provider - AI slot (ai1 veya ai2)
   * @param {Object} _syncResult - Conversation sync sonucu
   */
  async handleThinkingComplete(_provider: string, _syncResult: SyncResult) {
    throw new Error("handleThinkingComplete() must be implemented by subclass");
  }

  /**
   * Bu relay bu provider'ı yönetiyor mu?
   * @param {string} _provider - AI slot
   * @returns {boolean}
   */
  handlesProvider(_provider: string) {
    return false;
  }

  /**
   * Log event ekle
   * @protected
   * @param {string} level - Log seviyesi (info, warning, error)
   * @param {string} message - Log mesajı
   * @param {Object} context - Ek context
   */
  _log(level: string, message: string, context: Record<string, unknown> = {}) {
    LogManager.addEventWithContext(
      "relay",
      level,
      message,
      { relayType: this.constructor.name, ...context },
      this._session?.id
    );
  }

  /**
   * Custom event dispatch et
   * @protected
   * @param {string} eventName - Event adı
   * @param {Object} detail - Event detayları
   */
  _dispatchEvent(eventName: string, detail: Record<string, unknown> = {}) {
    try {
      window.dispatchEvent(
        new CustomEvent(eventName, { 
          detail: { 
            relayType: this.constructor.name,
            ...detail 
          } 
        })
      );
    } catch (e) {
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
  _updateIndicatorElement(elementId: string, text: string, addClasses: string[] = [], removeClasses: string[] = []) {
    try {
      const el = document.getElementById(elementId);
      if (!el) return;
      
      el.textContent = text;
      addClasses.forEach(cls => el.classList.add(cls));
      removeClasses.forEach(cls => el.classList.remove(cls));
    } catch (e) {
    }
  }

  /**
   * Session state'i sıfırla
   * @protected
   */
  _resetState() {
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
  _generateSessionId(prefix = "relay"): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
