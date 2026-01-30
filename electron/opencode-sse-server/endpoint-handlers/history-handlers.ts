/**
 * OpenCode SSE Server - History Endpoint Handlers
 * 
 * History operations: compact, retry, revert, fork
 * State injection pattern kullanılıyor
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { OpenCodeManager } from '../../opencode/index.js';
import type { ServerState } from '../types.js';
import { readBody } from '../utils.js';

export async function handleCompact(
  state: ServerState,
  _req: IncomingMessage,
  res: ServerResponse,
  publish: (event: import('../types.js').SSEEvent) => void
): Promise<void> {
  try {
    const result = await OpenCodeManager.compactSession();
    if (result.success) {
      publish({
        type: 'session.compacted',
        timestamp: Date.now(),
        sessionId: state._currentSessionId,
        data: { compactedTokens: result.data?.tokens || 0 },
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: result.success, compactedTokens: result.data?.tokens }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

export async function handleRetry(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await readBody(req);
    const { messageId } = JSON.parse(body || '{}');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, messageId }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

export async function handleRevert(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await readBody(req);
    const { messageId } = JSON.parse(body || '{}');
    if (!messageId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Message ID required' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, messageId }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

export async function handleFork(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, message: 'Fork not yet implemented' }));
}
