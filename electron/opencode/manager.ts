/**
 * OpenCode Manager - Main Manager Class
 * 
 * Koordinasyon, başlatma/durdurma, state yönetimi
 */

import type { ChildProcess } from "child_process";
import {
  spawnServer,
  waitForServer,
  isPortInUse,
  killProcess,
} from './process-control.ts';
import * as sseEvents from './sse-events.ts';
import * as apiClient from './api-client.ts';
import * as sessionApi from './session-api.ts';
import * as shellApi from './shell-api.ts';
import { OPENCODE_DEFAULTS } from "../opencode-config.ts";
import type { NativeUIEvent } from "../opencode-event-parser.ts";
import type {
  OpenCodeOptions,
  OpenCodeState,
  ApiResponse,
  OpenCodeSession,
  ProvidersResponse,
  MCPServerInfo,
  PluginInfo,
  BackgroundShell,
} from './types.ts';

export const OpenCodeManager = {
  _process: null as ChildProcess | null,
  _sseReader: null as ReturnType<typeof sseEvents.startSSEReader> | null,
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
  // Public API - Lifecycle
  // =========================================================================

  /**
   * OpenCode server'ı başlat
   */
  async start(options: OpenCodeOptions = {}): Promise<{
    success: boolean;
    url?: string;
    error?: string;
    alreadyRunning?: boolean;
  }> {
    const port = options.port || OPENCODE_DEFAULTS.port;
    const cors = options.cors || OPENCODE_DEFAULTS.cors;
    const projectPath = options.projectPath || null;

    if (this._process && this._state.running) {
      console.log("[OPENCODE]", "warn", "Server zaten çalışıyor", { pid: this._state.pid });
      return {
        success: true,
        url: this._getProjectUrl(projectPath, port),
        alreadyRunning: true,
      };
    }

    try {
      let actualPort = port;
      const portInUse_val = await isPortInUse(port);
      if (portInUse_val) {
        console.log("[OPENCODE]", "warn", `Port ${port} kullanımda, alternatif port aranıyor...`);
        
        for (let testPort = port + 1; testPort < port + 100; testPort++) {
          const inUse = await isPortInUse(testPort);
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

      const { process, authHeader, pid } = await spawnServer(actualPort, cors);
      this._process = process;
      
      await waitForServer(actualPort);
      
      this._state.running = true;
      this._state.port = actualPort;
      this._state.pid = pid;
      this._state.projectPath = projectPath;
      this._state.error = null;
      this._state.authHeader = authHeader;
      
      const url = this._getProjectUrl(projectPath, actualPort);
      console.log("[OPENCODE]", "info", "Server başlatıldı", { port: actualPort, url, pid, authEnabled: !!authHeader });
      
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
   */
  async stop(): Promise<{ success: boolean; error?: string; alreadyStopped?: boolean }> {
    if (!this._process) {
      console.log("[OPENCODE]", "debug", "Server zaten çalışmıyor");
      this._resetState();
      return { success: true, alreadyStopped: true };
    }

    try {
      await killProcess(this._process, this._state.port);
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
   */
  getStatus(): OpenCodeState {
    return { ...this._state };
  },

  /**
   * Durum değişikliği dinleyicisi ekle
   */
  onStatusChange(callback: (state: OpenCodeState) => void): void {
    this._statusListeners.push(callback);
  },

  /**
   * Dinleyiciyi kaldır
   */
  removeStatusListener(callback: (state: OpenCodeState) => void): void {
    this._statusListeners = this._statusListeners.filter(cb => cb !== callback);
  },

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    console.log("[OPENCODE]", "info", "Cleanup başlatılıyor...");
    this._disconnectEventSource();
    await this.stop();
  },

  /**
   * External workspace auth header'ını set et
   */
  setAuthHeader(authHeader: string): void {
    this._state.authHeader = authHeader;
    console.log("[OPENCODE]", "debug", "External auth header set", { 
      hasAuth: !!authHeader,
      preview: authHeader?.substring(0, 20) + "..."
    });
  },

  /**
   * External workspace port'unu set et
   */
  setPort(port: number): void {
    this._state.port = port;
    this._state.running = true;
    console.log("[OPENCODE]", "debug", "External port set", { port });
  },

  /**
   * External workspace'den yapılandır
   */
  configureFromWorkspace(config: { port: number; authHeader: string; projectPath?: string }): void {
    this._state.port = config.port;
    this._state.authHeader = config.authHeader;
    this._state.running = true;
    this._state.projectPath = config.projectPath || null;
    console.log("[OPENCODE]", "info", "Configured from workspace", { 
      port: config.port,
      hasAuth: !!config.authHeader,
      projectPath: config.projectPath
    });
  },

  // =========================================================================
  // Public API - Config
  // =========================================================================

  async getProviders(): Promise<ApiResponse<ProvidersResponse>> {
    return apiClient.getProviders(this._state.port, this._state.authHeader);
  },

  async getAgents(): Promise<ApiResponse<Array<{ name: string; description?: string }>>> {
    return apiClient.getAgents(this._state.port, this._state.authHeader);
  },

  async setAgent(agentName: string): Promise<ApiResponse<void>> {
    if (!this._state.running) {
      return { success: false, error: "OpenCode çalışmıyor" };
    }
    return apiClient.setAgent(this._state.port, this._state.authHeader, agentName);
  },

  async setModel(providerId: string, modelId: string): Promise<ApiResponse<void>> {
    if (!this._state.running) {
      return { success: false, error: "OpenCode çalışmıyor" };
    }
    return apiClient.setModel(this._state.port, this._state.authHeader, providerId, modelId);
  },

  async getMCPServers(): Promise<ApiResponse<MCPServerInfo[]>> {
    return apiClient.getMCPServers(this._state.port, this._state.authHeader);
  },

  async getPlugins(): Promise<ApiResponse<PluginInfo[]>> {
    return apiClient.getPlugins(this._state.port, this._state.authHeader);
  },

  // =========================================================================
  // Public API - Sessions
  // =========================================================================

  async getSessions(): Promise<ApiResponse<OpenCodeSession[]>> {
    return sessionApi.getSessions(this._state.port, this._state.authHeader);
  },

  async getSessionById(sessionId: string): Promise<ApiResponse<OpenCodeSession>> {
    return sessionApi.getSessionById(this._state.port, this._state.authHeader, sessionId);
  },

  async getSessionMessages(sessionId: string): Promise<ApiResponse<Array<{ role: string; content: string; id?: string }>>> {
    return sessionApi.getSessionMessages(this._state.port, this._state.authHeader, sessionId);
  },

  async createOrGetSession(path?: string): Promise<ApiResponse<OpenCodeSession>> {
    return sessionApi.createOrGetSession(this._state.port, this._state.authHeader, path, this._state.sessionId);
  },

  async sendMessage(message: string, sessionId?: string, messageId?: string): Promise<ApiResponse<{ messageId: string }>> {
    return sessionApi.sendMessage(this._state.port, this._state.authHeader, message, sessionId, messageId);
  },

  async respondToPermission(sessionId: string, permissionId: string, approved: boolean): Promise<ApiResponse<void>> {
    return sessionApi.respondToPermission(this._state.port, this._state.authHeader, sessionId, permissionId, approved);
  },

  async cancelSession(sessionId?: string): Promise<ApiResponse<void>> {
    const sid = sessionId || this._state.sessionId;
    if (!sid) return { success: false, error: "Session ID gerekli" };
    return sessionApi.cancelSession(this._state.port, this._state.authHeader, sid);
  },

  async compactSession(sessionId?: string): Promise<ApiResponse<{ tokens?: number }>> {
    const sid = sessionId || this._state.sessionId;
    if (!sid) return { success: false, error: "Session ID gerekli" };
    return sessionApi.compactSession(this._state.port, this._state.authHeader, sid);
  },

  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    const result = await sessionApi.deleteSession(this._state.port, this._state.authHeader, sessionId);
    if (this._state.sessionId === sessionId) {
      this._state.sessionId = null;
    }
    return result;
  },

  async updateSession(sessionId: string, updates: { title?: string }): Promise<ApiResponse<void>> {
    return sessionApi.updateSession(this._state.port, this._state.authHeader, sessionId, updates);
  },

  // =========================================================================
  // Public API - SSE Events
  // =========================================================================

  subscribeToEvents(callback: (event: NativeUIEvent) => void): void {
    this._eventCallback = callback;
    this._connectEventSource();
  },

  unsubscribeFromEvents(): void {
    this._eventCallback = null;
    this._disconnectEventSource();
  },

  // =========================================================================
  // Public API - Shell
  // =========================================================================

  async getBackgroundShells(): Promise<ApiResponse<BackgroundShell[]>> {
    return shellApi.getBackgroundShells(this._state.port, this._state.authHeader, this._state.sessionId);
  },

  // =========================================================================
  // Private Methods
  // =========================================================================

  _connectEventSource(): void {
    if (this._state.connected) {
      console.log("[OPENCODE-SSE]", "debug", "SSE zaten bağlı, yeni bağlantı atlanıyor");
      return;
    }
    
    if (this._sseReader) {
      console.log("[OPENCODE-SSE]", "debug", "Mevcut SSE reader kapatılıyor");
      this._disconnectEventSource();
    }

    if (!this._eventCallback) {
      console.log("[OPENCODE-SSE]", "debug", "Event callback yok, SSE dinleme başlatılmıyor");
      return;
    }

    this._sseReader = sseEvents.startSSEReader(
      this._state.port,
      this._state.authHeader,
      this._eventCallback
    );
    this._state.connected = true;
  },

  _disconnectEventSource(): void {
    if (this._sseReader) {
      this._sseReader.abort();
      this._sseReader = null;
    }
    this._state.connected = false;
  },

  _resetState(): void {
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

  _getProjectUrl(projectPath: string | null, port: number): string {
    const baseUrl = `http://localhost:${port}`;
    if (projectPath) {
      return `${baseUrl}?project=${encodeURIComponent(projectPath)}`;
    }
    return baseUrl;
  },

  _notifyListeners(): void {
    const state = this.getStatus();
    this._statusListeners.forEach(cb => {
      try {
        cb(state);
      } catch (err: unknown) {
        console.log("[OPENCODE]", "error", "Status listener hatası", { error: (err as Error).message });
      }
    });
  },
};
