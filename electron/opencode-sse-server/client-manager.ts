/**
 * OpenCode SSE Server - Client Management
 * 
 * SSE client connection, tracking, cleanup
 * State injection pattern kullanılıyor
 */

import { ServerResponse } from 'http';
import type { ServerState, SSEClient, SSEEvent } from './types.js';

export function addSSEClient(
  state: ServerState,
  res: ServerResponse,
  currentSessionId: string | null
): number {
  const clientId = ++state._nextClientId;
  console.log('[SSE-SERVER]', 'debug', `SSE client connected: ${clientId}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send initial connection event
  const connectEvent: SSEEvent = {
    type: 'status.change',
    timestamp: Date.now(),
    data: { status: 'connected', clientId },
  };
  res.write(`data: ${JSON.stringify(connectEvent)}\n\n`);

  // Send current session if exists
  if (currentSessionId) {
    const sessionEvent: SSEEvent = {
      type: 'session.started',
      timestamp: Date.now(),
      sessionId: currentSessionId,
      data: { sessionId: currentSessionId },
    };
    res.write(`data: ${JSON.stringify(sessionEvent)}\n\n`);
  }

  // Store client
  const client: SSEClient = {
    id: clientId,
    response: res,
    connectedAt: Date.now(),
  };
  state._clients.set(clientId, client);

  // Setup cleanup handlers
  const cleanup = () => {
    console.log('[SSE-SERVER]', 'debug', `SSE client disconnected: ${clientId}`);
    state._clients.delete(clientId);
  };

  res.on('close', cleanup);
  res.on('error', cleanup);

  return clientId;
}

export function removeSSEClient(state: ServerState, clientId: number): void {
  state._clients.delete(clientId);
}

export function getClientCount(state: ServerState): number {
  return state._clients.size;
}
