/**
 * OpenCode SSE Server - Utilities
 */

import { IncomingMessage, ServerResponse } from 'http';
import type { SSEClient } from './types.ts';

/**
 * Read HTTP request body
 */
export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Get server URL
 */
export function getServerUrl(host: string, port: number): string {
  return `http://${host}:${port}`;
}

/**
 * Broadcast SSE event to all clients
 */
export function broadcastToClients(clients: Map<number, SSEClient>, eventData: string): void {
  for (const client of clients.values()) {
    try {
      client.response.write(eventData);
    } catch (err) {
      console.log('[SSE-SERVER]', 'warn', `Client ${client.id} write error`);
      clients.delete(client.id);
    }
  }
}

/**
 * Disconnect all clients
 */
export function disconnectAllClients(clients: Map<number, SSEClient>): void {
  for (const client of clients.values()) {
    try {
      client.response.end();
    } catch {
      // Ignore
    }
  }
  clients.clear();
}

/**
 * Setup heartbeat interval
 */
export function setupHeartbeat(
  clients: Map<number, SSEClient>,
  intervalMs: number = 15000
): NodeJS.Timeout {
  return setInterval(() => {
    const heartbeatData = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`;
    broadcastToClients(clients, heartbeatData);
  }, intervalMs);
}
