/**
 * OpenCode SSE Server - Session Endpoint Handlers
 * 
 * Session CRUD operations: get, create, delete, rename, update
 * State injection pattern kullanılıyor
 */

import { IncomingMessage, ServerResponse } from 'http';
import { OpenCodeManager } from '../../opencode/index.js';
import type { ServerState } from '../types.js';
import { readBody } from '../utils.js';

export async function handleGetSessions(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const result = await OpenCodeManager.getSessions();
    
    if (result.success && result.data) {
      const sessions = result.data.map((s) => ({
        id: s.id,
        title: s.title || `Session ${s.id.substring(0, 8)}`,
        createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString(),
        messageCount: 0,
        status: 'active',
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessions }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions: [] }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (error as Error).message }));
  }
}

export async function handleGetSessionById(
  sessionId: string,
  res: ServerResponse
): Promise<void> {
  try {
    const result = await OpenCodeManager.getSessionById(sessionId);
    if (result.success && result.data) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ session: result.data }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session not found' }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (error as Error).message }));
  }
}

export async function handleGetSessionMessages(
  sessionId: string,
  res: ServerResponse
): Promise<void> {
  try {
    const result = await OpenCodeManager.getSessionMessages(sessionId);
    if (result.success && result.data) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ messages: result.data }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: [] }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (error as Error).message }));
  }
}

export async function handleCreateSession(
  state: ServerState,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await readBody(req);
    const { title, path } = JSON.parse(body || '{}');
    
    const result = await OpenCodeManager.createOrGetSession(path);
    if (!result.success || !result.data) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error || 'Session creation failed' }));
      return;
    }
    
    state._currentSessionId = result.data.id;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      sessionId: result.data.id, 
      title: title || result.data.title,
      path 
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

export async function handleDeleteSession(
  state: ServerState,
  sessionId: string,
  res: ServerResponse,
  publish: (event: import('../types.js').SSEEvent) => void
): Promise<void> {
  try {
    const result = await OpenCodeManager.deleteSession(sessionId);
    if (!result.success) {
      if (result.error === 'Session not found') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error || 'Failed to delete session' }));
      return;
    }
    
    if (state._currentSessionId === sessionId) {
      state._currentSessionId = null;
    }
    
    publish({
      type: 'session.stopped',
      timestamp: Date.now(),
      sessionId,
      data: { sessionId, reason: 'deleted' },
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (error as Error).message }));
  }
}

export async function handleRenameSession(
  req: IncomingMessage,
  sessionId: string,
  res: ServerResponse,
  publish: (event: import('../types.js').SSEEvent) => void
): Promise<void> {
  try {
    const body = await readBody(req);
    const { title } = JSON.parse(body || '{}');
    
    if (!title || typeof title !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Title is required' }));
      return;
    }
    
    const result = await OpenCodeManager.updateSession(sessionId, { title: title.trim() });
    if (!result.success) {
      if (result.error === 'Session not found') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error || 'Failed to rename session' }));
      return;
    }
    
    publish({
      type: 'session.updated',
      timestamp: Date.now(),
      sessionId,
      data: { title: title.trim() },
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, sessionId, title: title.trim() }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

export async function handleUpdateSession(
  req: IncomingMessage,
  sessionId: string,
  res: ServerResponse,
  publish: (event: import('../types.js').SSEEvent) => void
): Promise<void> {
  try {
    const body = await readBody(req);
    const { agent, provider, model } = JSON.parse(body || '{}');
    
    if (agent) {
      const result = await OpenCodeManager.setAgent(agent);
      if (!result.success) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error || 'Failed to set agent' }));
        return;
      }
    }
    
    if (provider && model) {
      const result = await OpenCodeManager.setModel(provider, model);
      if (!result.success) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error || 'Failed to set model' }));
        return;
      }
    }
    
    publish({
      type: 'session.updated',
      timestamp: Date.now(),
      sessionId,
      data: { agent, provider, model },
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, sessionId, agent, provider, model }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}
