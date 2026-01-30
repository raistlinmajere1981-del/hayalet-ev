/**
 * OpenCode Manager - API Client
 * 
 * Config API (Providers, Models, Agents, Plugins)
 * Background APIs (MCP, Shell processes)
 */

import { API_TIMEOUT } from './types.ts';
import type {
  ApiResponse,
  ProvidersResponse,
  AgentInfo,
  MCPServerInfo,
  PluginInfo,
} from './types.ts';

/**
 * Get API base URL
 */
export function getApiUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

/**
 * Get headers for API requests including auth
 */
export function getHeaders(authHeader: string | null, contentType = "application/json"): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };
  
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  
  return headers;
}

/**
 * Get headers for SSE connections
 */
export function getSSEHeaders(authHeader: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "text/event-stream",
  };
  
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  
  return headers;
}

/**
 * Provider ve model listesini OpenCode server'dan al
 */
export async function getProviders(
  port: number,
  authHeader: string | null
): Promise<ApiResponse<ProvidersResponse>> {
  try {
    const headers = getHeaders(authHeader);
    
    console.log("[OPENCODE-API]", "debug", "getProviders request", {
      url: `${getApiUrl(port)}/config/providers`,
      hasAuthHeader: !!headers["Authorization"],
      authHeaderPreview: headers["Authorization"]?.substring(0, 20) + "...",
    });
    
    const response = await fetch(`${getApiUrl(port)}/config/providers`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn("[OPENCODE-API]", "warn", "getProviders unauthorized - auth may be required");
        return { success: false, error: "Unauthorized - auth required" };
      }
      const errorText = await response.text();
      console.error("[OPENCODE-API]", "error", "getProviders failed", { status: response.status, error: errorText });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error("[OPENCODE-API]", "error", "getProviders returned non-JSON", { contentType });
      return { success: false, error: "Server returned non-JSON response" };
    }

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
    
    console.log("[OPENCODE-API]", "debug", "Raw config.providers response", { 
      providersCount: rawData?.providers?.length || 0,
      defaultKeys: Object.keys(rawData?.default || {}),
      firstProvider: rawData?.providers?.[0]?.id,
    });
    
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
}

/**
 * Agent listesini OpenCode server'dan al
 */
export async function getAgents(
  port: number,
  authHeader: string | null
): Promise<ApiResponse<Array<{ name: string; description?: string }>>> {
  try {
    const response = await fetch(`${getApiUrl(port)}/agent`, {
      method: "GET",
      headers: getHeaders(authHeader),
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

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error("[OPENCODE-API]", "error", "getAgents returned non-JSON");
      return { success: false, error: "Server returned non-JSON response" };
    }

    const rawData = await response.json() as Array<AgentInfo>;
    
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
}

/**
 * Agent değiştir
 */
export async function setAgent(
  port: number,
  authHeader: string | null,
  agentName: string
): Promise<ApiResponse<void>> {
  try {
    const url = `${getApiUrl(port)}/agent`;
    const response = await fetch(url, {
      method: "POST",
      headers: getHeaders(authHeader),
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
}

/**
 * Model değiştir
 */
export async function setModel(
  port: number,
  authHeader: string | null,
  providerId: string,
  modelId: string
): Promise<ApiResponse<void>> {
  try {
    const url = `${getApiUrl(port)}/model`;
    const response = await fetch(url, {
      method: "POST",
      headers: getHeaders(authHeader),
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
}

/**
 * MCP server listesini al
 */
export async function getMCPServers(
  port: number,
  authHeader: string | null
): Promise<ApiResponse<MCPServerInfo[]>> {
  try {
    const response = await fetch(`${getApiUrl(port)}/mcp`, {
      method: "GET",
      headers: getHeaders(authHeader),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log("[OPENCODE-API]", "debug", "MCP endpoint not found (404)");
        return { success: true, data: [] };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { servers?: Record<string, unknown> } | Array<{ name?: string; status?: string; tools?: unknown[] }>;
    
    console.log("[OPENCODE-API]", "debug", "MCP raw response", { 
      keys: Object.keys(data || {}),
      hasServers: !Array.isArray(data) && !!(data as { servers?: unknown })?.servers,
      dataPreview: JSON.stringify(data).substring(0, 500)
    });
    
    let servers: MCPServerInfo[] = [];
    
    if (!Array.isArray(data) && data?.servers && typeof data.servers === 'object') {
      servers = Object.entries(data.servers).map(([key, s]: [string, unknown]) => {
        const server = s as { name?: string; status?: string; tools?: Array<{ name: string }>; error?: string };
        return {
          name: server.name || key,
          status: server.error ? 'error' : (server.status || 'connected'),
          toolCount: server.tools?.length || 0,
        };
      });
    } else if (Array.isArray(data)) {
      servers = data.map((s: { name?: string; status?: string; tools?: unknown[] }) => ({
        name: s.name || 'unknown',
        status: s.status || 'connected',
        toolCount: Array.isArray(s.tools) ? s.tools.length : 0,
      }));
    }
    
    console.log("[OPENCODE-API]", "debug", "MCP servers fetched", { count: servers.length });
    return { success: true, data: servers };
  } catch (err) {
    console.log("[OPENCODE-API]", "warn", "getMCPServers error", { error: (err as Error).message });
    return { success: true, data: [] };
  }
}

/**
 * Plugin listesini al
 */
export async function getPlugins(
  port: number,
  authHeader: string | null
): Promise<ApiResponse<PluginInfo[]>> {
  try {
    const response = await fetch(`${getApiUrl(port)}/config`, {
      method: "GET",
      headers: getHeaders(authHeader),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log("[OPENCODE-API]", "debug", "Config endpoint not found (404)");
        return { success: true, data: [] };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { 
      plugins?: Record<string, string>;
    };
    
    const plugins = data.plugins ? Object.entries(data.plugins).map(([name, path]) => ({
      name,
      enabled: true,
      path: typeof path === 'string' ? path : undefined,
    })) : [];
    
    console.log("[OPENCODE-API]", "debug", "Plugins fetched", { count: plugins.length });
    return { success: true, data: plugins };
  } catch (err) {
    console.log("[OPENCODE-API]", "warn", "getPlugins error", { error: (err as Error).message });
    return { success: true, data: [] };
  }
}
