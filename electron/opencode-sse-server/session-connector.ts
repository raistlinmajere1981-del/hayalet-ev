/**
 * OpenCode SSE Server - Session Connector
 * 
 * OpenCode connection management, event subscription
 * State injection pattern kullanılıyor
 */

import { OpenCodeManager } from '../opencode/index.js';
import type { NativeUIEvent } from '../opencode-event-parser.js';
import { handleOpenCodeEvent } from './event-handlers.js';
import type { ServerState } from './types.js';

/** OpenCode connection callback handlers */
interface OpenCodeHandlers {
  startMessageStream: (role: 'user' | 'assistant', messageId?: string) => string;
  appendMessageDelta: (messageId: string, delta: string) => void;
  endMessageStream: (messageId: string, fullContent: string) => void;
  startToolCall: (toolId: string, toolName: string, input?: Record<string, unknown>) => void;
  endToolCall: (toolId: string, status: 'success' | 'error', result?: string) => void;
  startStep: (stepId: string, messageId?: string) => void;
  finishStep: (stepId: string, usage: { inputTokens?: number; outputTokens?: number; cost?: number }, messageId?: string) => void;
  requestPermission: (data: import('./types.js').PermissionEventData) => void;
  askQuestion: (data: import('./types.js').QuestionEventData) => void;
  publish: (event: import('./types.js').SSEEvent) => void;
  getCurrentSessionId: () => string | null;
}

export async function connectToOpenCode(
  state: ServerState,
  handlers: OpenCodeHandlers
): Promise<{ success: boolean; error?: string; sessionId?: string | null }> {
  if (state._openCodeConnected) {
    console.log('[SSE-SERVER]', 'debug', 'OpenCode zaten bağlı');
    return { success: true, sessionId: state._currentSessionId };
  }
  
  if (state._openCodeConnecting) {
    console.log('[SSE-SERVER]', 'debug', 'OpenCode bağlantısı zaten devam ediyor');
    return { success: true };
  }
  
  state._openCodeConnecting = true;

  try {
    const status = OpenCodeManager.getStatus();
    if (!status.running) {
      state._openCodeConnecting = false;
      console.log('[SSE-SERVER]', 'warn', 'OpenCode server çalışmıyor');
      return { success: false, error: 'OpenCode server çalışmıyor - önce workspace oluşturun' };
    }
    
    if (!status.authHeader) {
      state._openCodeConnecting = false;
      console.log('[SSE-SERVER]', 'warn', 'Auth header yok');
      return { success: false, error: 'Auth header yok - önce workspace oluşturun' };
    }

    const sessionResult = await OpenCodeManager.createOrGetSession();
    if (!sessionResult.success) {
      state._openCodeConnecting = false;
      return { success: false, error: sessionResult.error || 'Session oluşturulamadı' };
    }

    if (sessionResult.data) {
      state._currentSessionId = sessionResult.data.id;
    }

    OpenCodeManager.subscribeToEvents((event: NativeUIEvent) => {
      handleOpenCodeEvent(
        event,
        {
          currentAssistantMessageId: state._currentAssistantMessageId,
          currentAssistantContent: state._currentAssistantContent,
          lastSentUserMessageId: state._lastSentUserMessageId,
        },
        handlers
      );
    });

    state._openCodeConnected = true;
    state._openCodeConnecting = false;
    console.log('[SSE-SERVER]', 'info', 'OpenCode bağlantısı kuruldu', { sessionId: sessionResult.data?.id });

    handlers.publish({
      type: 'status.change',
      timestamp: Date.now(),
      sessionId: state._currentSessionId,
      data: { status: 'opencode_connected' },
    });

    return { success: true, sessionId: sessionResult.data?.id };
  } catch (err) {
    state._openCodeConnecting = false;
    console.log('[SSE-SERVER]', 'error', 'OpenCode bağlantı hatası', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

export function disconnectFromOpenCode(state: ServerState, publish: (event: import('./types.js').SSEEvent) => void): void {
  if (!state._openCodeConnected) return;

  OpenCodeManager.unsubscribeFromEvents();
  state._openCodeConnected = false;

  console.log('[SSE-SERVER]', 'info', 'OpenCode bağlantısı kesildi');

  publish({
    type: 'status.change',
    timestamp: Date.now(),
    sessionId: state._currentSessionId,
    data: { status: 'opencode_disconnected' },
  });
}
