/**
 * OpenCode UI - API Client
 * 
 * REST API isteklerini yönetir.
 * SSE Server ile iletişim için kullanılır.
 */

const APIClient = {
  /** @type {string} */
  _serverUrl: 'http://127.0.0.1:4097',

  // =========================================================================
  // Configuration
  // =========================================================================

  /**
   * Server URL'ini ayarla
   * @param {string} url
   */
  setServerUrl(url) {
    this._serverUrl = url;
  },

  /**
   * Server URL'ini al
   * @returns {string}
   */
  getServerUrl() {
    return this._serverUrl;
  },

  // =========================================================================
  // API Methods
  // =========================================================================

  /**
   * Server sağlık kontrolü
   * @returns {Promise<{status: string, timestamp: number}>}
   */
  async health() {
    return this._request('GET', '/health');
  },

  /**
   * Server durumunu al
   * @returns {Promise<{running: boolean, url: string | null, clients: number}>}
   */
  async status() {
    return this._request('GET', '/api/status');
  },

  /**
   * Mevcut session'u al
   * @returns {Promise<{session: object | null}>}
   */
  async getSession() {
    return this._request('GET', '/api/session');
  },

  /**
   * Mesaj gönder
   * @param {string} message - Gönderilecek mesaj
   * @param {string} [messageId] - Client-side üretilen message ID (CodeNomad pattern)
   * @returns {Promise<{success: boolean, sessionId?: string, messageId?: string}>}
   */
  async sendMessage(message, messageId) {
    return this._request('POST', '/api/send', { message, messageId });
  },

  /**
   * Permission onayı/reddi
   * @param {string} permissionId - Permission ID
   * @param {boolean} approved - Onaylandı mı?
   * @returns {Promise<{success: boolean}>}
   */
  async respondToPermission(permissionId, approved) {
    return this._request('POST', '/api/approve', { permissionId, approved });
  },

  /**
   * Soruya cevap ver
   * @param {string} questionId - Question ID
   * @param {string} answer - Cevap
   * @returns {Promise<{success: boolean}>}
   */
  async respondToQuestion(questionId, answer) {
    return this._request('POST', '/api/answer', { questionId, answer });
  },

  /**
   * OpenCode'a bağlan
   * @returns {Promise<{success: boolean, sessionId?: string, error?: string}>}
   */
  async connect() {
    return this._request('POST', '/api/connect');
  },

  /**
   * OpenCode bağlantısını kes
   * @returns {Promise<{success: boolean}>}
   */
  async disconnect() {
    return this._request('POST', '/api/disconnect');
  },

  /**
   * Mevcut işlemi iptal et
   * @returns {Promise<{success: boolean}>}
   */
  async cancel() {
    return this._request('POST', '/api/cancel');
  },

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * HTTP isteği gönder
   * @param {'GET' | 'POST' | 'PUT' | 'DELETE'} method
   * @param {string} path
   * @param {object} [body]
   * @returns {Promise<any>}
   */
  async _request(method, path, body = null) {
    const url = `${this._serverUrl}${path}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`[API] ${method} ${path} failed:`, err);
      throw err;
    }
  },

  /**
   * Server'a bağlanabilir mi kontrol et
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }
};

// Global'e ekle
window.APIClient = APIClient;
