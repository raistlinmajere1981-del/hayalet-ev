/**
 * OpenCode SSE Server - Lifecycle Management
 * 
 * Server start/stop operations
 * State injection pattern kullanılıyor (circular dependency yok)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'http';
import type { ServerState, SSEServerConfig } from './types.js';
import { getServerUrl, disconnectAllClients, setupHeartbeat } from './utils.js';

export async function startServer(
  state: ServerState,
  config: Partial<SSEServerConfig>,
  requestHandler: (req: IncomingMessage, res: ServerResponse) => void
): Promise<{ success: boolean; url?: string; workspace?: string; error?: string }> {
  // Already running
  if (state._server) {
    return { 
      success: true, 
      url: getServerUrl(state._config.host, state._config.port), 
      workspace: process.cwd() 
    };
  }

  // Merge config
  state._config = { ...state._config, ...config };

  return new Promise((resolve) => {
    try {
      state._server = createServer(requestHandler);

      state._server.on('error', (err: NodeJS.ErrnoException) => {
        console.log('[SSE-SERVER]', 'error', `Server error: ${err.message}`);
        if (err.code === 'EADDRINUSE') {
          resolve({ success: false, error: `Port ${state._config.port} kullanımda` });
        } else {
          resolve({ success: false, error: err.message });
        }
      });

      state._server.listen(state._config.port, state._config.host, () => {
        console.log('[SSE-SERVER]', 'info', `Server başlatıldı: ${getServerUrl(state._config.host, state._config.port)}`);
        
        // Start heartbeat
        state._heartbeatInterval = setupHeartbeat(state._clients);
        
        resolve({ 
          success: true, 
          url: getServerUrl(state._config.host, state._config.port), 
          workspace: process.cwd() 
        });
      });
    } catch (err: unknown) {
      resolve({ success: false, error: (err as Error).message });
    }
  });
}

export async function stopServer(
  state: ServerState,
  disconnectFromOpenCode: () => void
): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    // Disconnect OpenCode
    disconnectFromOpenCode();
    
    // Stop heartbeat
    if (state._heartbeatInterval) {
      clearInterval(state._heartbeatInterval);
      state._heartbeatInterval = null;
    }
    
    // Disconnect all clients
    disconnectAllClients(state._clients);

    // Close server
    if (!state._server) {
      resolve({ success: true });
      return;
    }

    state._server.close((err) => {
      if (err) {
        console.log('[SSE-SERVER]', 'error', `Server kapatma hatası: ${err.message}`);
      } else {
        console.log('[SSE-SERVER]', 'info', 'Server durduruldu');
      }
      state._server = null;
      resolve({ success: true });
    });
  });
}
