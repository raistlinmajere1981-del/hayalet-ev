/**
 * OpenCode SSE Server - Event Publisher
 * 
 * Generic event publishing: session, permission, question, status
 * State injection pattern kullanılıyor
 */

import type { ServerState, SSEEvent, PermissionEventData, QuestionEventData } from './types.js';

/** Generic event publisher */
export function publish(state: ServerState, event: SSEEvent): void {
  state._eventBus.publish(event);
  
  const eventData = `data: ${JSON.stringify(event)}\n\n`;
  for (const [clientId, client] of state._clients) {
    try {
      client.response.write(eventData);
    } catch (err) {
      console.log('[SSE-SERVER]', 'warn', `Failed to write to client ${clientId}`, { error: (err as Error).message });
      state._clients.delete(clientId);
    }
  }
}

export function getSessionId(state: ServerState): string | null {
  return state._currentSessionId;
}

export function setSessionId(state: ServerState, sessionId: string | null): void {
  state._currentSessionId = sessionId;
  if (sessionId) {
    publish(state, {
      type: 'session.started',
      timestamp: Date.now(),
      sessionId,
      data: { sessionId },
    });
  }
}

export function requestPermission(state: ServerState, data: PermissionEventData): void {
  publish(state, {
    type: 'permission.request',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data,
  });
}

export function askQuestion(state: ServerState, data: QuestionEventData): void {
  publish(state, {
    type: 'question.ask',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data,
  });
}

export function publishStatusChange(state: ServerState, status: string, additionalData?: Record<string, unknown>): void {
  publish(state, {
    type: 'status.change',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: { status, ...additionalData },
  });
}

export function getStatus(state: ServerState): { running: boolean; url: string | null; clients: number; openCodeConnected: boolean } {
  // Dynamic import yerine static import kullanılıyor (utils.ts'den)
  const getServerUrl = (host: string, port: number) => `http://${host}:${port}`;
  return {
    running: state._server !== null,
    url: state._server ? getServerUrl(state._config.host, state._config.port) : null,
    clients: state._clients.size,
    openCodeConnected: state._openCodeConnected,
  };
}
