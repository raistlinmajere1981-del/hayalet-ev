/**
 * OpenCode UI - API Client
 * 
 * REST API isteklerini yönetir.
 * SSE Server ile iletişim için kullanılır.
 */

const APIClient = {
  /** @type {string} */
  _serverUrl: null as string | null, // Set from OpenCodeConfig

  /**
   * Get server URL from config
   * @returns {string}
   */
  _getServerUrl() {
    if (!this._serverUrl) {
      this._serverUrl = (typeof OpenCodeConfig !== 'undefined') 
        ? OpenCodeConfig.getServerUrl() 
        : 'http://127.0.0.1:4097';
    }
    return this._serverUrl;
  },

  // =========================================================================
  // Configuration
  // =========================================================================

  /**
   * Server URL'ini ayarla
   * @param {string} url
   */
  setServerUrl(url: string) {
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
  async sendMessage(message: string, messageId?: string) {
    return this._request('POST', '/api/send', { message, messageId });
  },

  /**
   * Permission onayı/reddi
   * @param {string} permissionId - Permission ID
   * @param {boolean} approved - Onaylandı mı?
   * @returns {Promise<{success: boolean}>}
   */
  async respondToPermission(permissionId: string, approved: boolean) {
    return this._request('POST', '/api/approve', { permissionId, approved });
  },

  /**
   * Soruya cevap ver
   * @param {string} questionId - Question ID
   * @param {string} answer - Cevap
   * @returns {Promise<{success: boolean}>}
   */
  async respondToQuestion(questionId: string, answer: string) {
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
  // Session Management (FAZ 9 - CodeNomad pattern)
  // =========================================================================

  /**
   * Tüm session'ları listele
   * @returns {Promise<{sessions: Array<{id: string, title: string, createdAt: number, messageCount: number}>}>}
   */
  async getSessions() {
    return this._request('GET', '/api/sessions');
  },

  /**
   * Belirli bir session'u al
   * @param {string} sessionId
   * @returns {Promise<{session: object, messages: Array}>}
   */
  async getSessionById(sessionId: string) {
    return this._request('GET', `/api/sessions/${sessionId}`);
  },

  /**
   * Yeni session oluştur
   * @param {string} [title] - Session başlığı
   * @returns {Promise<{success: boolean, sessionId: string}>}
   */
  async createSession(title?: string) {
    return this._request('POST', '/api/sessions', { title });
  },

  /**
   * Session sil
   * @param {string} sessionId
   * @returns {Promise<{success: boolean}>}
   */
  async deleteSession(sessionId: string) {
    return this._request('DELETE', `/api/sessions/${sessionId}`);
  },

  /**
   * Session yeniden adlandır
   * @param {string} sessionId
   * @param {string} title
   * @returns {Promise<{success: boolean}>}
   */
  async renameSession(sessionId: string, title: string) {
    return this._request('PUT', `/api/sessions/${sessionId}`, { title });
  },

  /**
   * Session'ın mesajlarını al
   * @param {string} sessionId
   * @returns {Promise<{messages: Array}>}
   */
  async getSessionMessages(sessionId: string) {
    return this._request('GET', `/api/sessions/${sessionId}/messages`);
  },

  // =========================================================================
  // Conversation Actions (FAZ 3 - Revert, Fork)
  // =========================================================================

  /**
   * Conversation'u belirli bir mesaja geri al
   * @param {string} messageId - Geri alınacak mesaj ID
   * @returns {Promise<{success: boolean}>}
   */
  async revertConversation(messageId: string) {
    return this._request('POST', '/api/conversation/revert', { messageId });
  },

  /**
   * Conversation'dan yeni bir dal oluştur (fork)
   * @param {string} messageId - Fork noktası mesaj ID
   * @param {string} [newSessionId] - Yeni session ID (opsiyonel)
   * @returns {Promise<{success: boolean, sessionId: string}>}
   */
  async forkConversation(messageId: string, newSessionId: string | null = null) {
    return this._request('POST', '/api/conversation/fork', { messageId, newSessionId });
  },

  /**
   * Context'i sıkıştır (compact)
   * @returns {Promise<{success: boolean, compactedTokens?: number}>}
   */
  async compact() {
    return this._request('POST', '/api/compact');
  },

  /**
   * Son mesajı tekrarla (retry)
   * @param {string} [messageId] - Tekrarlanacak mesaj ID (opsiyonel, yoksa son mesaj)
   * @returns {Promise<{success: boolean}>}
   */
  async retry(messageId: string | null = null) {
    return this._request('POST', '/api/retry', { messageId });
  },

  // =========================================================================
  // File Operations (FAZ 2 - @ mention)
  // =========================================================================

  /**
   * Workspace dosyalarını ara
   * @param {string} query - Arama terimi
   * @param {number} [limit=10] - Maksimum sonuç sayısı
   * @returns {Promise<{files: Array<{name: string, path: string, type: string}>}>}
   */
  async searchFiles(query: string, limit = 10) {
    return this._request('GET', `/api/files/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  /**
   * Dosya içeriğini al
   * @param {string} filePath
   * @returns {Promise<{content: string, language: string}>}
   */
  async getFileContent(filePath: string) {
    return this._request('GET', `/api/files/content?path=${encodeURIComponent(filePath)}`);
  },

  // =========================================================================
  // Status Panel APIs
  // =========================================================================

  /**
   * MCP server'larını al
   * @returns {Promise<{servers: Array<{name: string, status: string, toolCount?: number}>}>}
   */
  async getMCPServers() {
    return this._request('GET', '/api/mcp/servers');
  },

  /**
   * Aktif shell process'lerini al
   * @returns {Promise<{shells: Array<{pid: number, command: string, status: string}>}>}
   */
  async getBackgroundShells() {
    return this._request('GET', '/api/shells');
  },

  /**
   * Plugin listesini al
   * @returns {Promise<{plugins: Array<{name: string, enabled: boolean}>}>}
   */
  async getPlugins() {
    return this._request('GET', '/api/plugins');
  },

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /** @type {number} Default timeout in milliseconds */
  _defaultTimeout: 30000,

  /** @type {AbortController | null} Current request abort controller */
  _currentAbortController: null as AbortController | null,

  /**
   * Set default timeout for requests
   * @param {number} ms - Timeout in milliseconds
   */
  setDefaultTimeout(ms: number) {
    this._defaultTimeout = ms;
  },

  /**
   * Cancel all pending requests
   */
  cancelAllRequests() {
    if (this._currentAbortController) {
      this._currentAbortController.abort();
      this._currentAbortController = null;
    }
  },

  /**
   * HTTP isteği gönder
   * @param {'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'} method
   * @param {string} path
   * @param {object} [body]
   * @param {object} [options]
   * @param {number} [options.timeout] - Request timeout in ms (default: 30000)
   * @param {AbortSignal} [options.signal] - External abort signal
   * @returns {Promise<any>}
   */
  async _request(method: string, path: string, body: unknown = null, options: { timeout?: number; signal?: AbortSignal } = {}) {
    const url = `${this._getServerUrl()}${path}`;
    const timeout = options.timeout ?? this._defaultTimeout;
    
    // Create AbortController for timeout
    const controller = new AbortController();
    this._currentAbortController = controller;
    
    // Link external signal if provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }
    
    // Setup timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);
    
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      // Handle abort/timeout specifically
      if ((err as Error).name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeout}ms: ${method} ${path}`) as Error & { isTimeout: boolean };
        timeoutError.name = 'TimeoutError';
        timeoutError.isTimeout = true;
        console.error(`[API] ${method} ${path} timeout after ${timeout}ms`);
        throw timeoutError;
      }
      console.error(`[API] ${method} ${path} failed:`, err);
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (this._currentAbortController === controller) {
        this._currentAbortController = null;
      }
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
  },

  // =========================================================================
  // Filesystem Operations (Workspace Selection)
  // =========================================================================

  /**
   * Filesystem listing - directory browser için
   * @param {string} [path] - Listelenecek dizin yolu (opsiyonel, default: home)
   * @param {object} [options] - Listeleme seçenekleri
   * @param {boolean} [options.includeFiles=false] - Dosyaları da listele
   * @returns {Promise<{entries: Array<FileSystemEntry>, metadata: FileSystemListingMetadata}>}
   * 
   * @typedef {object} FileSystemEntry
   * @property {string} name - Dosya/klasör adı
   * @property {string} path - Relative path
   * @property {string} [absolutePath] - Absolute path
   * @property {'file' | 'directory'} type - Tip
   * @property {number} [size] - Boyut (byte)
   * @property {string} [modifiedAt] - Son değişiklik tarihi (ISO)
   * 
   * @typedef {object} FileSystemListingMetadata
   * @property {'restricted' | 'unrestricted'} scope
   * @property {string} currentPath - Mevcut dizin
   * @property {string} [parentPath] - Üst dizin
   * @property {string} rootPath - Kök dizin
   * @property {string} homePath - Home dizini
   * @property {string} displayPath - Görüntülenen yol
   * @property {'relative' | 'absolute' | 'drives'} pathKind
   */
  async listFileSystem(path: string, options: { includeFiles?: boolean } = {}) {
    const params = new URLSearchParams();
    if (path && path !== '.') {
      params.set('path', path);
    }
    if (options.includeFiles !== undefined) {
      params.set('includeFiles', String(options.includeFiles));
    }
    const query = params.toString();
    return this._request('GET', query ? `/api/filesystem?${query}` : '/api/filesystem');
  },

  /**
   * Workspace dosyalarını listele (instance-specific)
   * @param {string} workspaceId - Workspace ID
   * @param {string} [relativePath='.'] - Relative path
   * @returns {Promise<Array<FileSystemEntry>>}
   */
  async listWorkspaceFiles(workspaceId: string, relativePath = '.') {
    const params = new URLSearchParams({ path: relativePath });
    return this._request('GET', `/api/workspaces/${encodeURIComponent(workspaceId)}/files?${params.toString()}`);
  },

  /**
   * Workspace oluştur (yeni instance başlat)
   * @param {string} path - Workspace path
   * @param {string} [name] - Workspace adı
   * @returns {Promise<{id: string, path: string, status: string}>}
   */
  async createWorkspace(path: string, name?: string) {
    return this._request('POST', '/api/workspaces', { path, name });
  },

  /**
   * Mevcut workspace'leri listele
   * @returns {Promise<Array<{id: string, path: string, status: string}>>}
   */
  async listWorkspaces() {
    return this._request('GET', '/api/workspaces');
  },

  // =========================================================================
  // Agent & Provider Operations
  // =========================================================================

  /**
   * Agent listesini getir (OpenCode SDK endpoint: /agent)
   * @returns {Promise<Array<Agent>>}
   * 
   * @typedef {object} Agent
   * @property {string} name - Agent adı (unique identifier)
   * @property {string} [description] - Açıklama
   * @property {'agent' | 'subagent'} [mode] - Agent modu
   * @property {object} [model] - Model bilgisi
   * @property {string} [model.providerID] - Provider ID
   * @property {string} [model.modelID] - Model ID
   */
  async listAgents() {
    return this._request('GET', '/agent');
  },

  /**
   * Provider (model sağlayıcı) listesini getir (OpenCode SDK endpoint: /config/providers)
   * @returns {Promise<{providers: Array<Provider>, default: object}>}
   * 
   * @typedef {object} Provider
   * @property {string} id - Provider ID
   * @property {string} name - Görünen ad
   * @property {object} models - Model map (key: modelId, value: model info)
   */
  async listProviders() {
    return this._request('GET', '/config/providers');
  },

  /**
   * Aktif session'ın agent'ını değiştir
   * @param {string} sessionId - Session ID
   * @param {string} agentName - Yeni agent adı
   * @returns {Promise<void>}
   */
  async updateSessionAgent(sessionId: string, agentName: string) {
    return this._request('PATCH', `/api/sessions/${encodeURIComponent(sessionId)}`, {
      agent: agentName,
    });
  },

  /**
   * Aktif session'ın modelini değiştir
   * @param {string} sessionId - Session ID
   * @param {string} providerId - Provider ID
   * @param {string} modelId - Model ID
   * @returns {Promise<void>}
   */
  async updateSessionModel(sessionId: string, providerId: string, modelId: string) {
    return this._request('PATCH', `/api/sessions/${encodeURIComponent(sessionId)}`, {
      provider: providerId,
      model: modelId,
    });
  },

  /**
   * Tüm session'ları listele
   * @returns {Promise<Array<SessionSummary>>}
   * 
   * @typedef {object} SessionSummary
   * @property {string} id - Session ID
   * @property {string} [title] - Başlık
   * @property {string} agent - Agent adı
   * @property {string} provider - Provider ID
   * @property {string} model - Model ID
   * @property {string} status - Durum
   * @property {string} [parentId] - Parent session ID
   * @property {string} createdAt - Oluşturulma zamanı
   * @property {string} updatedAt - Son güncelleme
   */
  async listSessions() {
    return this._request('GET', '/api/sessions');
  },

  // =========================================================================
  // Status Panel - Extended Operations
  // =========================================================================

  /**
   * Plugin durumunu toggle et
   * @param {string} pluginName
   * @param {boolean} enabled
   * @returns {Promise<{success: boolean}>}
   */
  async togglePlugin(pluginName: string, enabled: boolean) {
    return this._request('PATCH', `/api/plugins/${encodeURIComponent(pluginName)}`, { enabled });
  },

  /**
   * Background shell output'unu getir
   * @param {string} shellId
   * @returns {Promise<{output: string}>}
   */
  async getShellOutput(shellId: string) {
    return this._request('GET', `/api/shells/${encodeURIComponent(shellId)}/output`);
  },

  /**
   * Background shell'i sonlandır
   * @param {string} shellId
   * @returns {Promise<{success: boolean}>}
   */
  async killShell(shellId: string) {
    return this._request('DELETE', `/api/shells/${encodeURIComponent(shellId)}`);
  }
};

// ES6 Export
export { APIClient };

// Global export (backward compatibility)
(window as unknown as { APIClient: typeof APIClient }).APIClient = APIClient;
