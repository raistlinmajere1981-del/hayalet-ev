/**
 * Session Store
 * Web session state yönetimi
 * Sayfa değişimlerinde session durumunu korur.
 */

class SessionStoreClass {
  constructor() {
    this._session = null;
  }

  /**
   * Session başlat
   */
  startSession(sessionData) {
    this._session = {
      id: `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      provider: sessionData.provider,
      url: sessionData.url,
      connectedAt: sessionData.connectedAt || Date.now(),
    };
    console.log("[SessionStore] Session started:", this._session.id);
  }

  /**
   * Session sonlandır
   */
  endSession() {
    if (this._session) {
      console.log("[SessionStore] Session ended:", this._session.id);
    }
    this._session = null;
  }

  /**
   * Aktif session var mı?
   */
  hasActiveSession() {
    return this._session !== null;
  }

  /**
   * Session bilgisini al
   */
  getSession() {
    return this._session ? { ...this._session } : null;
  }

  /**
   * Session durumu özeti
   */
  getStatus() {
    if (!this._session) {
      return { active: false };
    }

    return {
      active: true,
      sessionId: this._session.id,
      provider: this._session.provider,
      url: this._session.url,
      connectedAt: this._session.connectedAt,
      uptime: Date.now() - this._session.connectedAt,
    };
  }
}

// Singleton export
export const SessionStore = new SessionStoreClass();
