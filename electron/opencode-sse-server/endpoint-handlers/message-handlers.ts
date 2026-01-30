/**
 * OpenCode SSE Server - Message Endpoint Handlers
 * 
 * sendMessage, approve, answer, connect, disconnect, cancel endpoints
 * State injection pattern kullanılıyor
 */

import { IncomingMessage, ServerResponse } from 'http';
import { OpenCodeManager } from '../../opencode/index.js';
import type { ServerState } from '../types.js';
import { readBody } from '../utils.js';

export async function handleSendMessage(
  state: ServerState,
  req: IncomingMessage,
  res: ServerResponse,
  endMessageStream: (messageId: string, content: string) => void
): Promise<void> {
  try {
    const body = await readBody(req);
    const { message, messageId: clientMessageId } = JSON.parse(body);

    if (!message) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Message required' }));
      return;
    }

    if (state._currentAssistantMessageId && state._currentAssistantContent) {
      endMessageStream(state._currentAssistantMessageId, state._currentAssistantContent);
    }

    state._currentAssistantContent = '';
    state._currentAssistantMessageId = null;

    const result = await OpenCodeManager.sendMessage(message, undefined, clientMessageId);
    
    if (result.success && result.data?.messageId) {
      state._lastSentUserMessageId = result.data.messageId;
      console.log('[SSE-SERVER]', 'debug', 'User messageId kaydedildi', { messageId: state._lastSentUserMessageId });
    }
    
    if (!result.success) {
      console.log('[SSE-SERVER]', 'error', 'OpenCode mesaj gönderme hatası', { error: result.error });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error || 'Mesaj gönderilemedi' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      sessionId: state._currentSessionId,
      messageId: result.data?.messageId 
    }));
  } catch (err: unknown) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

export async function handleApprove(
  state: ServerState,
  req: IncomingMessage,
  res: ServerResponse,
  publish: (event: import('../types.js').SSEEvent) => void
): Promise<void> {
  try {
    const body = await readBody(req);
    const { sessionId, permissionId, approved } = JSON.parse(body);

    if (!sessionId || !permissionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session ID and Permission ID required' }));
      return;
    }

    const result = await OpenCodeManager.respondToPermission(sessionId, permissionId, approved);
    
    if (!result.success) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error || 'Permission yanıtı gönderilemedi' }));
      return;
    }

    publish({
      type: 'status.change',
      timestamp: Date.now(),
      sessionId: state._currentSessionId,
      data: { 
        status: approved ? 'permission_approved' : 'permission_denied',
        permissionId 
      },
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, permissionId, approved }));
  } catch (err: unknown) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

export async function handleAnswer(
  state: ServerState,
  req: IncomingMessage,
  res: ServerResponse,
  publish: (event: import('../types.js').SSEEvent) => void
): Promise<void> {
  try {
    const body = await readBody(req);
    const { questionId, answer } = JSON.parse(body);

    if (!questionId || answer === undefined) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Question ID and answer required' }));
      return;
    }

    publish({
      type: 'status.change',
      timestamp: Date.now(),
      sessionId: state._currentSessionId,
      data: { 
        status: 'question_answered',
        questionId,
        answer 
      },
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, questionId, answer }));
  } catch (err: unknown) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

export async function handleConnect(
  connectToOpenCode: () => Promise<{ success: boolean; error?: string; sessionId?: string | null }>,
  state: ServerState,
  res: ServerResponse
): Promise<void> {
  try {
    const result = await connectToOpenCode();
    
    if (result.success) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        sessionId: state._currentSessionId,
        message: 'OpenCode bağlantısı kuruldu'
      }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: result.error || 'Bağlantı kurulamadı'
      }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

export function handleDisconnect(
  disconnectFromOpenCode: () => void,
  res: ServerResponse
): void {
  disconnectFromOpenCode();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, message: 'OpenCode bağlantısı kesildi' }));
}

export async function handleCancel(
  state: ServerState,
  res: ServerResponse,
  publish: (event: import('../types.js').SSEEvent) => void
): Promise<void> {
  try {
    const result = await OpenCodeManager.cancelSession();
    
    if (result.success) {
      publish({
        type: 'status.change',
        timestamp: Date.now(),
        sessionId: state._currentSessionId,
        data: { status: 'cancelled' },
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'İşlem iptal edildi' }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: result.error || 'İptal edilemedi'
      }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}
