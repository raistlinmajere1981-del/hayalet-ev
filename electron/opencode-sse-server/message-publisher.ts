/**
 * OpenCode SSE Server - Message Publisher
 * 
 * Message streaming API: start, delta, end, tool calls, steps
 * State injection pattern kullanılıyor
 */

import type { ServerState, SSEEvent } from './types.js';

/** Publish helper - internal use */
function publishEvent(state: ServerState, event: SSEEvent): void {
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

export function startMessageStream(
  state: ServerState,
  role: 'user' | 'assistant',
  messageId?: string
): string {
  const id = messageId || `msg-${Date.now()}`;
  publishEvent(state, {
    type: 'message.start',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: { role, messageId: id },
  });
  return id;
}

export function appendMessageDelta(
  state: ServerState,
  messageId: string,
  delta: string
): void {
  publishEvent(state, {
    type: 'message.delta',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: { messageId, delta },
  });
}

export function endMessageStream(
  state: ServerState,
  messageId: string,
  fullContent: string
): void {
  publishEvent(state, {
    type: 'message.end',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: { messageId, content: fullContent },
  });
}

export function startToolCall(
  state: ServerState,
  toolId: string,
  toolName: string,
  input?: Record<string, unknown>
): void {
  publishEvent(state, {
    type: 'tool.start',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: { toolId, toolName, status: 'running', input },
  });
}

export function sendToolOutput(
  state: ServerState,
  toolId: string,
  output: string
): void {
  publishEvent(state, {
    type: 'tool.output',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: { toolId, output },
  });
}

export function endToolCall(
  state: ServerState,
  toolId: string,
  status: 'success' | 'error',
  result?: string
): void {
  publishEvent(state, {
    type: 'tool.end',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: { toolId, status, output: result },
  });
}

export function startStep(
  state: ServerState,
  stepId: string,
  messageId?: string
): void {
  publishEvent(state, {
    type: 'step.start',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: { stepId, messageId },
  });
}

export function finishStep(
  state: ServerState,
  stepId: string,
  usage: { inputTokens?: number; outputTokens?: number; cost?: number },
  messageId?: string
): void {
  publishEvent(state, {
    type: 'step.finish',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: {
      stepId,
      messageId,
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
      cost: usage.cost || 0,
    },
  });
}
