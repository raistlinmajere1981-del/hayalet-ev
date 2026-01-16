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

export class BaseRelay {
  coreEngine: any;
  _active: boolean;
  _session: any;
  _forwardCount: number;

  constructor(coreEngine: any) {
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
   * AI thinking tamamlandığında çağrılır - alt sınıflar override etmeli
   * @abstract
   * @param {string} _provider - AI slot (ai1 veya ai2)
   * @param {Object} _syncResult - Conversation sync sonucu
   */
  async handleThinkingComplete(_provider, _syncResult) {
    throw new Error("handleThinkingComplete() must be implemented by subclass");
  }

  /**
   * Bu relay bu provider'ı yönetiyor mu?
   * @param {string} _provider - AI slot
   * @returns {boolean}
   */
  handlesProvider(_provider) {
    return false;
  }

  /**
   * Log event ekle
   * @protected
   * @param {string} level - Log seviyesi (info, warning, error)
   * @param {string} message - Log mesajı
   * @param {Object} context - Ek context
   */
  _log(level, message, context = {}) {
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
  _dispatchEvent(eventName, detail = {}) {
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
  _updateIndicatorElement(elementId, text, addClasses = [], removeClasses = []) {
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
  _generateSessionId(prefix = "relay") {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
