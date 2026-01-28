/**
 * OpenCode Manager - Shell API
 * 
 * Background process management
 */

import { getApiUrl, getHeaders } from './api-client.ts';
import { API_TIMEOUT } from './types.ts';
import type { ApiResponse, BackgroundShell } from './types.ts';

/**
 * Arka plan shell process'lerini al
 */
export async function getBackgroundShells(
  port: number,
  authHeader: string | null,
  sessionId?: string | null
): Promise<ApiResponse<BackgroundShell[]>> {
  try {
    if (!sessionId) {
      return { success: true, data: [] };
    }

    const response = await fetch(`${getApiUrl(port)}/session/${sessionId}/processes`, {
      method: "GET",
      headers: getHeaders(authHeader),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: true, data: [] };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { 
      processes?: BackgroundShell[];
      shells?: BackgroundShell[];
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
    return { success: true, data: [] };
  }
}
