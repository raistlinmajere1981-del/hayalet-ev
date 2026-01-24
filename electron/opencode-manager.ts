/**
 * OpenCode Manager
 * 
 * OpenCode serve subprocess yönetimi
 * - Server başlatma/durdurma
 * - Port kontrolü
 * - Graceful shutdown
 * - Process state tracking
 * 
 * Config değerleri: src/js/modules/webview/providers/opencode/config.js
 */

import { spawn } from "child_process";
import { OPENCODE_DEFAULTS } from "./opencode-config.ts";
import { eventParser, type NativeUIEvent } from "./opencode-event-parser.ts";

// ===========================================================================
// ID Generation (adapted from CodeNomad's session-actions.ts)
// ===========================================================================

const ID_LENGTH = 26;
const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

let _lastTimestamp = 0;
let _localCounter = 0;

/**
 * Generate random base62 string
 */
function randomBase62(length: number): string {
  let result = "";
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      const idx = Math.floor(Math.random() * BASE62_CHARS.length);
      result += BASE62_CHARS[idx];
    }
  }
  return result;
}

/**
 * Create a unique, sortable ID with prefix
 * Format: prefix_timestamp(hex)_random
 */
function createId(prefix: string): string {
  const timestamp = Date.now();
  if (timestamp !== _lastTimestamp) {
    _lastTimestamp = timestamp;
    _localCounter = 0;
  }
  _localCounter++;

  const value = (BigInt(timestamp) << BigInt(12)) + BigInt(_localCounter);
  const bytes = new Array<number>(6);
  for (let i = 0; i < 6; i++) {
    const shift = BigInt(8 * (5 - i));
    bytes[i] = Number((value >> shift) & BigInt(0xff));
  }
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  const random = randomBase62(ID_LENGTH - 12);

  return `${prefix}_${hex}${random}`;
}

// Timeout değerleri
const STARTUP_TIMEOUT = 30000; // 30 saniye (server başlatma için)
const SHUTDOWN_TIMEOUT = 10000; // 10 saniye (server kapatma için)
const API_TIMEOUT = 60000; // 60 saniye (API istekleri için)

interface OpenCodeOptions {
  port?: number;
  cors?: string;
  projectPath?: string;
}

interface OpenCodeState {
  running: boolean;
  pid: number | null;
  port: number;
  projectPath: string | null;
  error: string | null;
  sessionId: string | null;
  connected: boolean;
  authHeader: string | null; // Basic auth header for OpenCode API
}

// Session bilgisi
interface OpenCodeSession {
  id: string;
  path: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
}

// API Response tipleri
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export const OpenCodeManager = {
  _process: null as import("child_process").ChildProcess | null,
  _eventSource: null as EventSource | null,
  _eventCallback: null as ((event: NativeUIEvent) => void) | null,

  _state: {
    running: false,
    pid: null,
    port: OPENCODE_DEFAULTS.port,
    projectPath: null,
    error: null,
    sessionId: null,
    connected: false,
    authHeader: null,
  } as OpenCodeState,

  _statusListeners: [] as Array<(state: OpenCodeState) => void>,

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * OpenCode server'ı başlat
   */
  async start(options: OpenCodeOptions = {}): Promise<{
    success: boolean;
    url?: string;
    error?: string;
    alreadyRunning?: boolean;
    existingServer?: boolean;
  }> {
    const port = options.port || OPENCODE_DEFAULTS.port;
    const cors = options.cors || OPENCODE_DEFAULTS.cors;
    const projectPath = options.projectPath || null;

    // Zaten çalışıyorsa
    if (this._process && this._state.running) {
      console.log("[OPENCODE]", "warn", "Server zaten çalışıyor", { pid: this._state.pid });
      return {
        success: true,
        url: this._getProjectUrl(projectPath, port),
        alreadyRunning: true,
      };
    }

    try {
      // Port kontrolü - eğer port kullanımdaysa farklı port dene
      let actualPort = port;
      const portInUse = await this._isPortInUse(port);
      if (portInUse) {
        // Port kullanımda - farklı bir port bul (auth sorunlarından kaçınmak için kendi server'ımızı başlat)
        console.log("[OPENCODE]", "warn", `Port ${port} kullanımda, alternatif port aranıyor...`);
        
        // 4096'dan başlayarak boş port bul
        for (let testPort = port + 1; testPort < port + 100; testPort++) {
          const inUse = await this._isPortInUse(testPort);
          if (!inUse) {
            actualPort = testPort;
            console.log("[OPENCODE]", "info", `Alternatif port bulundu: ${actualPort}`);
            break;
          }
        }
        
        if (actualPort === port) {
          throw new Error(`Port ${port} ve sonraki 100 port kullanımda`);
        }
      }

      // Server'ı başlat (kendi auth bilgilerimizle)
      await this._spawnServer(actualPort, cors);
      
      // Server hazır olana kadar bekle
      await this._waitForServer(actualPort);
      
      this._state.running = true;
      this._state.port = actualPort;
      this._state.projectPath = projectPath;
      this._state.error = null;
      
      const url = this._getProjectUrl(projectPath, actualPort);
      console.log("[OPENCODE]", "info", "Server başlatıldı", { port: actualPort, url, pid: this._state.pid, authEnabled: !!this._state.authHeader });
      
      this._notifyListeners();
      
      return { success: true, url };
    } catch (error: unknown) {
      this._state.error = (error as Error).message;
      console.log("[OPENCODE]", "error", "Server başlatılamadı", { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * OpenCode server'ı durdur
   * @returns {Promise<{success: boolean, error?: string, alreadyStopped?: boolean}>}
   */
  async stop() {
    if (!this._process) {
      console.log("[OPENCODE]", "debug", "Server zaten çalışmıyor");
      this._resetState();
      return { success: true, alreadyStopped: true };
    }

    try {
      await this._killProcess();
      this._resetState();
      console.log("[OPENCODE]", "info", "Server durduruldu");
      this._notifyListeners();
      return { success: true };
    } catch (error: unknown) {
      console.log("[OPENCODE]", "error", "Server durdurulamadı", { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Server durumunu al
   * @returns {OpenCodeState}
   */
  getStatus() {
    return { ...this._state };
  },

  /**
   * Durum değişikliği dinleyicisi ekle
   * @param {Function} callback
   */
  onStatusChange(callback: (state: OpenCodeState) => void) {
    this._statusListeners.push(callback);
  },

  /**
   * Dinleyiciyi kaldır
   * @param {Function} callback
   */
  removeStatusListener(callback: (state: OpenCodeState) => void) {
    this._statusListeners = this._statusListeners.filter(cb => cb !== callback);
  },

  /**
   * Uygulama kapanırken çağrılacak cleanup
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.log("[OPENCODE]", "info", "Cleanup başlatılıyor...");
    this._disconnectEventSource();
    await this.stop();
  },

  // =========================================================================
  // HTTP API Methods
  // =========================================================================

  /**
   * API base URL'ini döndür
   */
  _getApiUrl(): string {
    return `http://127.0.0.1:${this._state.port}`;
  },

  // =========================================================================
  // Auth Helper
  // =========================================================================

  /**
   * Get headers for API requests including auth
   */
  _getHeaders(contentType = "application/json"): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };
    
    if (this._state.authHeader) {
      headers["Authorization"] = this._state.authHeader;
    }
    
    return headers;
  },

  /**
   * Get headers for SSE connections
   */
  _getSSEHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Accept": "text/event-stream",
    };
    
    if (this._state.authHeader) {
      headers["Authorization"] = this._state.authHeader;
    }
    
    return headers;
  },

  // =========================================================================
  // Config API (Providers & Models)
  // =========================================================================

  /**
   * Provider ve model listesini OpenCode server'dan al
   * Endpoint: GET /config -> providers objesi
   */
  async getProviders(): Promise<ApiResponse<{
    providers: Array<{
      id: string;
      name: string;
      models: Record<string, {
        name: string;
        limit?: { context?: number; output?: number };
        cost?: { input?: number; output?: number };
      }>;
    }>;
    default?: Record<string, string>;
  }>> {
    try {
      // /config/providers endpoint'inden provider ve model listesini al
      const headers = this._getHeaders();
      
      // DEBUG: Auth header kontrolü
      console.log("[OPENCODE-API]", "debug", "getProviders request", {
        url: `${this._getApiUrl()}/config/providers`,
        hasAuthHeader: !!headers["Authorization"],
        authHeaderPreview: headers["Authorization"]?.substring(0, 20) + "...",
      });
      
      const response = await fetch(`${this._getApiUrl()}/config/providers`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        // 401 Unauthorized ise auth header eksik olabilir
        if (response.status === 401) {
          console.warn("[OPENCODE-API]", "warn", "getProviders unauthorized - auth may be required");
          return { success: false, error: "Unauthorized - auth required" };
        }
        const errorText = await response.text();
        console.error("[OPENCODE-API]", "error", "getProviders failed", { status: response.status, error: errorText });
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      // Response'un JSON olduğundan emin ol
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error("[OPENCODE-API]", "error", "getProviders returned non-JSON", { contentType });
        return { success: false, error: "Server returned non-JSON response" };
      }

      // /config.providers endpoint'i providers array'i ve default map'i döndürüyor
      const rawData = await response.json() as {
        providers: Array<{
          id: string;
          name: string;
          models: Record<string, {
            name: string;
            limit?: { context?: number; output?: number };
            cost?: { input?: number; output?: number };
          }>;
        }>;
        default?: Record<string, string>;
      };
      
      // DEBUG: Raw response'u logla
      console.log("[OPENCODE-API]", "debug", "Raw config.providers response", { 
        providersCount: rawData?.providers?.length || 0,
        defaultKeys: Object.keys(rawData?.default || {}),
        firstProvider: rawData?.providers?.[0]?.id,
      });
      
      // Providers zaten array formatında, models'ları düzelt
      const providers = (rawData.providers || []).map(provider => {
        const models: Record<string, {
          name: string;
          limit?: { context?: number; output?: number };
          cost?: { input?: number; output?: number };
        }> = {};
        
        if (provider.models) {
          for (const [modelKey, modelValue] of Object.entries(provider.models)) {
            models[modelKey] = {
              name: modelValue.name || modelKey,
              limit: modelValue.limit,
              cost: modelValue.cost,
            };
          }
        }
        
        return {
          id: provider.id,
          name: provider.name,
          models,
        };
      });
      
      const data = {
        providers,
        default: rawData.default,
      };
      
      console.log("[OPENCODE-API]", "info", "Providers fetched", { 
        providerCount: providers.length,
        modelCount: providers.reduce((sum, p) => sum + Object.keys(p.models || {}).length, 0)
      });
      
      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[OPENCODE-API]", "error", "getProviders error", { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Agent listesini OpenCode server'dan al
   * Endpoint: GET /app.agents
   */
  async getAgents(): Promise<ApiResponse<Array<{ name: string; description?: string }>>> {
    try {
      // /agent endpoint'inden agent listesini al
      const response = await fetch(`${this._getApiUrl()}/agent`, {
        method: "GET",
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("[OPENCODE-API]", "warn", "getAgents unauthorized");
          return { success: false, error: "Unauthorized" };
        }
        const errorText = await response.text();
        console.error("[OPENCODE-API]", "error", "getAgents failed", { status: response.status, error: errorText });
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      // Response'un JSON olduğundan emin ol
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error("[OPENCODE-API]", "error", "getAgents returned non-JSON");
        return { success: false, error: "Server returned non-JSON response" };
      }

      // /app.agents endpoint'i direkt array döndürüyor
      const rawData = await response.json() as Array<{ 
        name: string; 
        description?: string;
        mode?: string;
        model?: { providerID?: string; modelID?: string };
      }>;
      
      const data = (rawData || []).map(agent => ({
        name: agent.name,
        description: agent.description || '',
      }));
      
      console.log("[OPENCODE-API]", "info", "Agents fetched", { count: data.length });
      
      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[OPENCODE-API]", "error", "getAgents error", { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  // =========================================================================
  // Session API  
  // =========================================================================

  /**
   * Session listesini al
   */
  async getSessions(): Promise<ApiResponse<OpenCodeSession[]>> {
    try {
      const response = await fetch(`${this._getApiUrl()}/session`, {
        method: "GET",
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { sessions?: OpenCodeSession[] };
      return { success: true, data: data.sessions || (data as unknown as OpenCodeSession[]) };
    } catch (err) {
      console.log("[OPENCODE-API]", "error", "getSessions hatası", { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Yeni session oluştur veya mevcut session'a bağlan
   */
  async createOrGetSession(path?: string): Promise<ApiResponse<OpenCodeSession>> {
    try {
      // Önce mevcut session'ları kontrol et
      const sessionsResult = await this.getSessions();
      if (sessionsResult.success && sessionsResult.data && sessionsResult.data.length > 0) {
        // Path'e göre eşleşen session bul
        const targetPath = path || process.cwd();
        const existingSession = sessionsResult.data.find(s => s.path === targetPath);
        
        if (existingSession) {
          console.log("[OPENCODE-API]", "info", "Mevcut session bulundu", { id: existingSession.id });
          this._state.sessionId = existingSession.id;
          return { success: true, data: existingSession };
        }
      }

      // Yeni session oluştur
      const response = await fetch(`${this._getApiUrl()}/session`, {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({ path: path || process.cwd() }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { session?: OpenCodeSession };
      const session = data.session || (data as unknown as OpenCodeSession);
      this._state.sessionId = session.id;
      
      console.log("[OPENCODE-API]", "info", "Yeni session oluşturuldu", { id: session.id });
      return { success: true, data: session };
    } catch (err) {
      console.log("[OPENCODE-API]", "error", "createOrGetSession hatası", { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Mesaj gönder (async - streaming response için)
   * OpenCode API formatı: { messageID, parts: [{ id, type: "text", text: "..." }] }
   * CodeNomad pattern: messageID ve partID client-side üretilir
   */
  async sendMessage(message: string, sessionId?: string, messageId?: string): Promise<ApiResponse<{ messageId: string }>> {
    let sid = sessionId || this._state.sessionId;
    
    // Session yoksa otomatik oluştur
    if (!sid) {
      console.log("[OPENCODE-API]", "info", "Session yok, otomatik oluşturuluyor...");
      const sessionResult = await this.createOrGetSession();
      if (!sessionResult.success || !sessionResult.data?.id) {
        return { success: false, error: "Session oluşturulamadı: " + (sessionResult.error || "Bilinmeyen hata") };
      }
      sid = sessionResult.data.id;
      this._state.sessionId = sid;
      console.log("[OPENCODE-API]", "info", "Session oluşturuldu", { sessionId: sid });
    }

    try {
      // Client-side ID üretimi (CodeNomad pattern)
      const msgId = messageId || createId("msg");
      const partId = createId("part");
      
      console.log("[OPENCODE-API]", "debug", "Mesaj gönderiliyor", { 
        sessionId: sid, 
        messageId: msgId,
        partId,
        messageLength: message.length 
      });
      
      // OpenCode API formatı: messageID + parts array (CodeNomad uyumlu)
      // Not: model ve agent parametreleri OpenCode'un kendi config'inden alınır
      const body: Record<string, unknown> = {
        messageID: msgId,
        parts: [
          { id: partId, type: "text", text: message }
        ],
      };
      
      const response = await fetch(`${this._getApiUrl()}/session/${sid}/prompt_async`, {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      // prompt_async 204 No Content dönebilir - bu durumda client-side ID kullan
      if (response.status === 204) {
        console.log("[OPENCODE-API]", "info", "Mesaj gönderildi (async)", { messageId: msgId });
        return { success: true, data: { messageId: msgId } };
      }

      const data = await response.json() as { messageId?: string; id?: string };
      // Server ID döndürürse onu kullan, yoksa client-side ID
      const finalMessageId = data.messageId || data.id || msgId;
      console.log("[OPENCODE-API]", "info", "Mesaj gönderildi", { messageId: finalMessageId });
      
      return { success: true, data: { messageId: finalMessageId } };
    } catch (err) {
      console.log("[OPENCODE-API]", "error", "sendMessage hatası", { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Permission isteğine yanıt ver
   */
  async respondToPermission(
    permissionId: string,
    approved: boolean,
    sessionId?: string
  ): Promise<ApiResponse<void>> {
    const sid = sessionId || this._state.sessionId;
    
    if (!sid) {
      return { success: false, error: "Session ID gerekli" };
    }

    try {
      console.log("[OPENCODE-API]", "debug", "Permission yanıtı gönderiliyor", { 
        sessionId: sid, 
        permissionId, 
        approved 
      });
      
      const response = await fetch(`${this._getApiUrl()}/session/${sid}/permissions/${permissionId}`, {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({ approved }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log("[OPENCODE-API]", "info", "Permission yanıtı gönderildi", { permissionId, approved });
      return { success: true };
    } catch (err) {
      console.log("[OPENCODE-API]", "error", "respondToPermission hatası", { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Session'ı iptal et (mevcut işlemi durdur)
   */
  async cancelSession(sessionId?: string): Promise<ApiResponse<void>> {
    const sid = sessionId || this._state.sessionId;
    
    if (!sid) {
      return { success: false, error: "Session ID gerekli" };
    }

    try {
      const response = await fetch(`${this._getApiUrl()}/session/${sid}/cancel`, {
        method: "POST",
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log("[OPENCODE-API]", "info", "Session iptal edildi", { sessionId: sid });
      return { success: true };
    } catch (err) {
      console.log("[OPENCODE-API]", "error", "cancelSession hatası", { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Session context'sıkıştır (compact)
   * Token sayısını azaltmak için eski mesajları özetler
   */
  async compactSession(sessionId?: string): Promise<ApiResponse<{ tokens?: number }>> {
    const sid = sessionId || this._state.sessionId;
    
    if (!sid) {
      return { success: false, error: "Session ID gerekli" };
    }

    try {
      // OpenCode API'de compact endpoint'i varsa kullan
      const response = await fetch(`${this._getApiUrl()}/session/${sid}/compact`, {
        method: "POST",
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        // Compact endpoint yoksa başarılı dön (opsiyonel özellik)
        if (response.status === 404) {
          console.log("[OPENCODE-API]", "warn", "Compact endpoint bulunamadı");
          return { success: true, data: { tokens: 0 } };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { tokens?: number; compactedTokens?: number };
      console.log("[OPENCODE-API]", "info", "Session compact edildi", { sessionId: sid, tokens: data.tokens });
      return { success: true, data: { tokens: data.tokens || data.compactedTokens || 0 } };
    } catch (err) {
      console.log("[OPENCODE-API]", "error", "compactSession hatası", { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Agent değiştir
   */
  async setAgent(agentName: string): Promise<ApiResponse<void>> {
    if (!this._state.running) {
      return { success: false, error: "OpenCode çalışmıyor" };
    }

    try {
      const url = `${this._getApiUrl()}/agent`;
      const response = await fetch(url, {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({ name: agentName }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: error || `HTTP ${response.status}` };
      }

      console.log("[OPENCODE-API]", "info", "Agent değiştirildi", { agent: agentName });
      return { success: true };
    } catch (err) {
      console.log("[OPENCODE-API]", "error", "setAgent hatası", { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Model değiştir
   */
  async setModel(providerId: string, modelId: string): Promise<ApiResponse<void>> {
    if (!this._state.running) {
      return { success: false, error: "OpenCode çalışmıyor" };
    }

    try {
      const url = `${this._getApiUrl()}/model`;
      const response = await fetch(url, {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify({ provider: providerId, model: modelId }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: error || `HTTP ${response.status}` };
      }

      console.log("[OPENCODE-API]", "info", "Model değiştirildi", { provider: providerId, model: modelId });
      return { success: true };
    } catch (err) {
      console.log("[OPENCODE-API]", "error", "setModel hatası", { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  },

  // =========================================================================
  // SSE Event Subscription
  // =========================================================================

  /**
   * OpenCode SSE event stream'ine bağlan
   */
  subscribeToEvents(callback: (event: NativeUIEvent) => void): void {
    this._eventCallback = callback;
    this._connectEventSource();
  },

  /**
   * Event subscription'ı durdur
   */
  unsubscribeFromEvents(): void {
    this._eventCallback = null;
    this._disconnectEventSource();
  },

  /**
   * EventSource bağlantısı kur
   */
  _connectEventSource(): void {
    // Zaten bağlıysa veya bağlanıyorsa tekrar bağlanma
    if (this._state.connected) {
      console.log("[OPENCODE-SSE]", "debug", "SSE zaten bağlı, yeni bağlantı atlanıyor");
      return;
    }
    
    if (this._eventSource) {
      console.log("[OPENCODE-SSE]", "debug", "Mevcut EventSource kapatılıyor");
      this._disconnectEventSource();
    }

    const url = `${this._getApiUrl()}/event`;
    console.log("[OPENCODE-SSE]", "info", "SSE bağlantısı kuruluyor", { url });

    // Node.js'te EventSource yok, fetch ile SSE okuyacağız
    this._startSSEReader(url);
  },

  /**
   * EventSource bağlantısını kapat
   */
  _disconnectEventSource(): void {
    if (this._eventSource) {
      // @ts-expect-error - custom abort controller
      this._eventSource.abort?.();
      this._eventSource = null;
    }
    this._state.connected = false;
  },

  /**
   * SSE stream okuyucu (Node.js uyumlu)
   */
  async _startSSEReader(url: string): Promise<void> {
    const abortController = new AbortController();
    // @ts-expect-error - store abort controller as eventSource
    this._eventSource = { abort: () => abortController.abort() };

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this._getSSEHeaders(),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE bağlantısı başarısız: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body yok");
      }

      this._state.connected = true;
      console.log("[OPENCODE-SSE]", "info", "SSE bağlantısı kuruldu");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log("[OPENCODE-SSE]", "info", "SSE stream sona erdi");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // SSE standardı: \n\n ile ayrılmış event chunk'larını işle
        // CodeNomad flushEvents pattern'i
        buffer = this._flushSSEEvents(buffer);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        console.log("[OPENCODE-SSE]", "debug", "SSE bağlantısı iptal edildi");
      } else {
        console.log("[OPENCODE-SSE]", "error", "SSE hatası", { error: (err as Error).message });
      }
    } finally {
      this._state.connected = false;
      this._eventSource = null;
    }
  },

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Server process'ini başlat
   * @param {number} port
   * @param {string} cors
   * @returns {Promise<void>}
   */
  _spawnServer(port: number, cors: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Generate a random password for this server instance
      const serverPassword = randomBase62(32);
      const username = "opencode";
      
      // Create Basic auth header
      const credentials = Buffer.from(`${username}:${serverPassword}`).toString('base64');
      this._state.authHeader = `Basic ${credentials}`;
      
      const args = ["serve", "--port", String(port), "--cors", cors];
      
      // Set password via environment variable
      const env = {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: serverPassword,
        OPENCODE_SERVER_USERNAME: username,
      };
      
      console.log("[OPENCODE]", "debug", "Server başlatılıyor", { 
        command: OPENCODE_DEFAULTS.command, 
        args,
        authEnabled: true 
      });
      
      this._process = spawn(OPENCODE_DEFAULTS.command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
        env,
      });

      this._state.pid = this._process.pid ?? null;

      // Stdout log
      this._process.stdout?.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log("[OPENCODE-STDOUT]", "debug", output);
        }
      });

      // Stderr log
      this._process.stderr?.on("data", (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log("[OPENCODE-STDERR]", "warn", output);
        }
      });

      // Process kapandığında
      this._process.on("close", (code) => {
        console.log("[OPENCODE]", "info", `Server process kapandı`, { code });
        this._resetState();
        this._notifyListeners();
      });

      // Hata durumunda
      this._process.on("error", (err) => {
        console.log("[OPENCODE]", "error", "Process hatası", { error: (err as Error).message });
        this._state.error = (err as Error).message;
        reject(err);
      });

      // Spawn başarılı
      resolve(undefined);
    });
  },

  /**
   * Server'ın hazır olmasını bekle
   * @param {number} port
   * @returns {Promise<void>}
   */
  async _waitForServer(port: number) {
    const startTime = Date.now();
    // OpenCode server 127.0.0.1'de dinliyor
    const url = `http://127.0.0.1:${port}`;
    
    while (Date.now() - startTime < STARTUP_TIMEOUT) {
      try {
        const response = await fetch(url, { 
          method: "GET", 
          signal: AbortSignal.timeout(2000) 
        });
        // Herhangi bir yanıt aldıysak server hazır demektir
        // Status 200, 404, 405 vb. olabilir - önemli olan yanıt vermesi
        console.log("[OPENCODE]", "debug", "Server yanıt verdi", { status: response.status });
        return;
      } catch (err: unknown) {
        // Connection refused veya timeout - henüz hazır değil
        console.log("[OPENCODE]", "debug", "Server henüz hazır değil, bekleniyor...");
      }
      await this._sleep(500);
    }
    
    throw new Error(`Server ${STARTUP_TIMEOUT}ms içinde başlamadı`);
  },

  /**
   * Port'un kullanımda olup olmadığını kontrol et
   * @param {number} port
   * @returns {Promise<boolean>}
   */
  async _isPortInUse(port: number) {
    try {
      await fetch(`http://127.0.0.1:${port}`, { 
        method: "GET", 
        signal: AbortSignal.timeout(1000) 
      });
      return true; // Yanıt aldık, port kullanımda
    } catch {
      return false; // Bağlantı başarısız, port boş
    }
  },

  /**
   * Process'i öldür
   * @returns {Promise<void>}
   */
  _killProcess(): Promise<void> {
    return new Promise((resolve, _reject) => {
      if (!this._process) {
        resolve(undefined);
        return;
      }

      const pid = this._process.pid;
      let resolved = false;
      
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        this._process = null;
        resolve(undefined);
      };

      // İlk timeout: SIGKILL dene
      const killTimeout = setTimeout(() => {
        console.log("[OPENCODE]", "warn", "Graceful shutdown timeout, SIGKILL gönderiliyor");
        try {
          this._process?.kill("SIGKILL");
        } catch (e) {
          // Process zaten öldüyse hata verebilir
        }
      }, SHUTDOWN_TIMEOUT);
      
      // İkinci timeout: Port bazlı kill dene ve zorla resolve et
      const forceTimeout = setTimeout(async () => {
        console.log("[OPENCODE]", "warn", "Force shutdown - process yanıt vermiyor, port bazlı kill deneniyor");
        clearTimeout(killTimeout);
        
        // Port bazlı kill dene
        try {
          await this._killByPort(this._state.port);
        } catch (e) {
          console.log("[OPENCODE]", "debug", "Port bazlı kill başarısız", { error: (e as Error).message });
        }
        
        cleanup();
      }, SHUTDOWN_TIMEOUT + 5000); // SIGKILL'den 5 saniye sonra

      this._process.on("close", () => {
        clearTimeout(killTimeout);
        clearTimeout(forceTimeout);
        cleanup();
      });
      
      this._process.on("error", (err) => {
        console.log("[OPENCODE]", "error", "Process error", { error: err.message });
        clearTimeout(killTimeout);
        clearTimeout(forceTimeout);
        cleanup();
      });

      // Önce SIGTERM dene
      console.log("[OPENCODE]", "debug", "SIGTERM gönderiliyor", { pid });
      try {
        this._process.kill("SIGTERM");
      } catch (e) {
        // Process zaten öldüyse
        clearTimeout(killTimeout);
        clearTimeout(forceTimeout);
        cleanup();
      }
    });
  },

  /**
   * Port kullanan process'i öldür (Linux/Mac için)
   */
  async _killByPort(port: number): Promise<void> {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    try {
      // Linux/Mac: lsof ile portu kullanan PID'i bul
      const { stdout } = await execAsync(`lsof -t -i:${port} 2>/dev/null || fuser ${port}/tcp 2>/dev/null || true`);
      const pids = stdout.trim().split('\n').filter(p => p);
      
      if (pids.length > 0) {
        for (const pid of pids) {
          try {
            console.log("[OPENCODE]", "debug", "Port bazlı kill", { port, pid });
            await execAsync(`kill -9 ${pid} 2>/dev/null || true`);
          } catch {
            // Ignore
          }
        }
      }
    } catch (e) {
      // Windows veya komut başarısız - ignore
      console.log("[OPENCODE]", "debug", "Port kill komutu başarısız", { error: (e as Error).message });
    }
  },

  /**
   * State'i sıfırla
   */
  _resetState() {
    this._process = null;
    this._state = {
      running: false,
      pid: null,
      port: OPENCODE_DEFAULTS.port,
      projectPath: null,
      error: null,
      sessionId: null,
      connected: false,
      authHeader: null,
    };
  },

  /**
   * Proje URL'i oluştur
   * @param {string|null} projectPath
   * @param {number} port
   * @returns {string}
   */
  _getProjectUrl(projectPath: string | null, port: number) {
    const baseUrl = `http://localhost:${port}`;
    if (projectPath) {
      return `${baseUrl}?project=${encodeURIComponent(projectPath)}`;
    }
    return baseUrl;
  },

  /**
   * Dinleyicileri bilgilendir
   */
  _notifyListeners() {
    const state = this.getStatus();
    this._statusListeners.forEach(cb => {
      try {
        cb(state);
      } catch (err: unknown) {
        console.log("[OPENCODE]", "error", "Status listener hatası", { error: (err as Error).message });
      }
    });
  },

  /**
   * SSE buffer'dan tam event'leri çıkar ve işle
   * CodeNomad flushEvents pattern'i - SSE standardı \n\n separator
   * @param {string} buffer - Mevcut buffer
   * @returns {string} - Kalan buffer (incomplete event)
   */
  _flushSSEEvents(buffer: string): string {
    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex >= 0) {
      const chunk = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      this._processSSEChunk(chunk);
      separatorIndex = buffer.indexOf("\n\n");
    }

    return buffer;
  },

  /**
   * Tek bir SSE chunk'ını işle
   * Birden fazla data: satırını birleştirerek parse eder
   * @param {string} chunk - SSE event chunk'ı
   */
  _processSSEChunk(chunk: string): void {
    const lines = chunk.split(/\r?\n/);
    const dataLines: string[] = [];

    for (const line of lines) {
      // Comment satırlarını atla
      if (line.startsWith(":")) {
        continue;
      }
      // data: ile başlayan satırları topla
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) {
      return;
    }

    // Tüm data satırlarını birleştir
    const payload = dataLines.join("\n").trim();
    if (!payload) {
      return;
    }

    try {
      const openCodeEvent = JSON.parse(payload);
      console.log("[OPENCODE-SSE]", "debug", "Event parsed", { type: openCodeEvent.type });
      
      const nativeEvent = eventParser.toNativeUIEvent(openCodeEvent);
      if (nativeEvent && this._eventCallback) {
        console.log("[OPENCODE-SSE]", "debug", "Dispatching event", { type: nativeEvent.type });
        this._eventCallback(nativeEvent);
      }
    } catch (err) {
      console.log("[OPENCODE-SSE]", "warn", "SSE chunk parse hatası", { 
        error: (err as Error).message,
        payload: payload.substring(0, 200) 
      });
    }
  },

  /**
   * Sleep utility
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // =========================================================================
  // MCP & Background Process APIs
  // =========================================================================

  /**
   * MCP server listesini al
   * OpenCode'un bağlı olduğu MCP server'ları döndürür
   */
  async getMCPServers(): Promise<ApiResponse<Array<{ name: string; status: string; toolCount?: number }>>> {
    try {
      // OpenCode /app/info veya /config endpoint'inden MCP bilgisi çekilebilir
      const response = await fetch(`${this._getApiUrl()}/app/info`, {
        method: "GET",
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        // Endpoint yoksa boş liste dön
        if (response.status === 404) {
          return { success: true, data: [] };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as { 
        mcpServers?: Array<{ name: string; status?: string; tools?: unknown[] }>;
        mcp?: { servers?: Array<{ name: string; status?: string; tools?: unknown[] }> };
      };
      
      // MCP server bilgisini çıkar
      const servers = data.mcpServers || data.mcp?.servers || [];
      const result = servers.map(s => ({
        name: s.name,
        status: s.status || 'connected',
        toolCount: s.tools?.length || 0,
      }));
      
      console.log("[OPENCODE-API]", "debug", "MCP servers fetched", { count: result.length });
      return { success: true, data: result };
    } catch (err) {
      console.log("[OPENCODE-API]", "warn", "getMCPServers error", { error: (err as Error).message });
      return { success: true, data: [] }; // Hata durumunda boş liste
    }
  },

  /**
   * Arka plan shell process'lerini al
   * OpenCode tarafından başlatılan ve hala çalışan shell komutları
   */
  async getBackgroundShells(): Promise<ApiResponse<Array<{ pid: number; command: string; status: string }>>> {
    try {
      // OpenCode /session/{id}/processes veya /app/processes endpoint'i
      const sessionId = this._state.sessionId;
      if (!sessionId) {
        return { success: true, data: [] };
      }

      const response = await fetch(`${this._getApiUrl()}/session/${sessionId}/processes`, {
        method: "GET",
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        // Endpoint yoksa boş liste dön
        if (response.status === 404) {
          return { success: true, data: [] };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as { 
        processes?: Array<{ pid: number; command: string; status?: string }>;
        shells?: Array<{ pid: number; command: string; status?: string }>;
      };
      
      const shells = data.processes || data.shells || [];
      const result = shells.map(s => ({
        pid: s.pid,
        command: s.command,
        status: s.status || 'running',
      }));
      
      console.log("[OPENCODE-API]", "debug", "Background shells fetched", { count: result.length });
      return { success: true, data: result };
    } catch (err) {
      console.log("[OPENCODE-API]", "warn", "getBackgroundShells error", { error: (err as Error).message });
      return { success: true, data: [] }; // Hata durumunda boş liste
    }
  },

  /**
   * Plugin listesini al
   */
  async getPlugins(): Promise<ApiResponse<Array<{ name: string; enabled: boolean }>>> {
    try {
      const response = await fetch(`${this._getApiUrl()}/app/plugins`, {
        method: "GET",
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: true, data: [] };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as Array<{ name: string; enabled?: boolean }> | { plugins?: Array<{ name: string; enabled?: boolean }> };
      const plugins = Array.isArray(data) ? data : (data.plugins || []);
      
      const result = plugins.map(p => ({
        name: p.name,
        enabled: p.enabled !== false,
      }));
      
      console.log("[OPENCODE-API]", "debug", "Plugins fetched", { count: result.length });
      return { success: true, data: result };
    } catch (err) {
      console.log("[OPENCODE-API]", "warn", "getPlugins error", { error: (err as Error).message });
      return { success: true, data: [] };
    }
  },
};
