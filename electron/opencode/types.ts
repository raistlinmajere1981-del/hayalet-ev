/**
 * OpenCode Manager - Type Definitions
 */

export interface OpenCodeOptions {
  port?: number;
  cors?: string;
  projectPath?: string;
}

export interface OpenCodeState {
  running: boolean;
  pid: number | null;
  port: number;
  projectPath: string | null;
  error: string | null;
  sessionId: string | null;
  connected: boolean;
  authHeader: string | null; // Basic auth header for OpenCode API
}

export interface OpenCodeSession {
  id: string;
  path: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  models: Record<string, {
    name: string;
    limit?: { context?: number; output?: number };
    cost?: { input?: number; output?: number };
  }>;
}

export interface ProvidersResponse {
  providers: ProviderConfig[];
  default?: Record<string, string>;
}

export interface AgentInfo {
  name: string;
  description?: string;
  mode?: string;
  model?: { providerID?: string; modelID?: string };
}

export interface MCPServerInfo {
  name: string;
  status: string;
  toolCount?: number;
}

export interface BackgroundShell {
  pid: number;
  command: string;
  status: string;
}

export interface PluginInfo {
  name: string;
  enabled: boolean;
  path?: string;
}

export const ID_LENGTH = 26;
export const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Timeout değerleri
export const STARTUP_TIMEOUT = 30000; // 30 saniye (server başlatma için)
export const SHUTDOWN_TIMEOUT = 10000; // 10 saniye (server kapatma için)
export const API_TIMEOUT = 60000; // 60 saniye (API istekleri için)
