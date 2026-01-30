/**
 * OpenCode SSE Server - REST API Endpoints
 * 
 * HTTP request handlers for all endpoints
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

export type EndpointHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export function createEndpointRouter(handlers: {
  handleSSE: EndpointHandler;
  handleGetSession: EndpointHandler;
  handleSendMessage: EndpointHandler;
  handleApprove: EndpointHandler;
  handleAnswer: EndpointHandler;
  handleConnect: EndpointHandler;
  handleDisconnect: EndpointHandler;
  handleCancel: EndpointHandler;
  handleStatus: EndpointHandler;
  handleHealth: EndpointHandler;
  handleGetSessions: EndpointHandler;
  handleGetSessionById: (sessionId: string, res: ServerResponse) => void | Promise<void>;
  handleGetSessionMessages: (sessionId: string, res: ServerResponse) => void | Promise<void>;
  handleCreateSession: EndpointHandler;
  handleDeleteSession: (sessionId: string, res: ServerResponse) => void | Promise<void>;
  handleRenameSession: (req: IncomingMessage, sessionId: string, res: ServerResponse) => void | Promise<void>;
  handleUpdateSession: (req: IncomingMessage, sessionId: string, res: ServerResponse) => void | Promise<void>;
  handleCompact: EndpointHandler;
  handleRetry: EndpointHandler;
  handleRevert: EndpointHandler;
  handleFork: EndpointHandler;
  handleFileSearch: (query: string, limit: number, res: ServerResponse) => void | Promise<void>;
  handleFileContent: (filePath: string, res: ServerResponse) => void | Promise<void>;
  handleGetMCPServers: EndpointHandler;
  handleGetShells: EndpointHandler;
  handleGetPlugins: EndpointHandler;
  handleGetProviders: EndpointHandler;
  handleGetAgents: EndpointHandler;
}): (req: IncomingMessage, res: ServerResponse) => void {
  return function route(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // Route handling
    if (path === '/api/events' && req.method === 'GET') {
      handlers.handleSSE(req, res);
    } else if (path === '/api/session' && req.method === 'GET') {
      handlers.handleGetSession(req, res);
    } else if (path === '/api/send' && req.method === 'POST') {
      handlers.handleSendMessage(req, res);
    } else if (path === '/api/approve' && req.method === 'POST') {
      handlers.handleApprove(req, res);
    } else if (path === '/api/answer' && req.method === 'POST') {
      handlers.handleAnswer(req, res);
    } else if (path === '/api/connect' && req.method === 'POST') {
      handlers.handleConnect(req, res);
    } else if (path === '/api/disconnect' && req.method === 'POST') {
      handlers.handleDisconnect(req, res);
    } else if (path === '/api/cancel' && req.method === 'POST') {
      handlers.handleCancel(req, res);
    } else if (path === '/api/status' && req.method === 'GET') {
      handlers.handleStatus(req, res);
    } else if (path === '/health' && req.method === 'GET') {
      handlers.handleHealth(req, res);
    } else if (path === '/api/sessions' && req.method === 'GET') {
      handlers.handleGetSessions(req, res);
    } else if (path === '/api/sessions' && req.method === 'POST') {
      handlers.handleCreateSession(req, res);
    } else if (path.startsWith('/api/sessions/') && req.method === 'GET') {
      const sessionId = path.split('/')[3] || '';
      if (path.endsWith('/messages')) {
        handlers.handleGetSessionMessages(sessionId.replace('/messages', ''), res);
      } else {
        handlers.handleGetSessionById(sessionId, res);
      }
    } else if (path.startsWith('/api/sessions/') && req.method === 'DELETE') {
      const sessionId = path.split('/')[3] || '';
      handlers.handleDeleteSession(sessionId, res);
    } else if (path.startsWith('/api/sessions/') && req.method === 'PUT') {
      const sessionId = path.split('/')[3] || '';
      handlers.handleRenameSession(req, sessionId, res);
    } else if (path.startsWith('/api/sessions/') && req.method === 'PATCH') {
      const sessionId = path.split('/')[3] || '';
      handlers.handleUpdateSession(req, sessionId, res);
    } else if (path === '/api/compact' && req.method === 'POST') {
      handlers.handleCompact(req, res);
    } else if (path === '/api/retry' && req.method === 'POST') {
      handlers.handleRetry(req, res);
    } else if (path === '/api/conversation/revert' && req.method === 'POST') {
      handlers.handleRevert(req, res);
    } else if (path === '/api/conversation/fork' && req.method === 'POST') {
      handlers.handleFork(req, res);
    } else if (path.startsWith('/api/files/search') && req.method === 'GET') {
      const query = url.searchParams.get('q') || '';
      const limit = parseInt(url.searchParams.get('limit') || '10');
      handlers.handleFileSearch(query, limit, res);
    } else if (path.startsWith('/api/files/content') && req.method === 'GET') {
      const filePath = url.searchParams.get('path') || '';
      handlers.handleFileContent(filePath, res);
    } else if (path === '/api/mcp/servers' && req.method === 'GET') {
      handlers.handleGetMCPServers(req, res);
    } else if (path === '/api/shells' && req.method === 'GET') {
      handlers.handleGetShells(req, res);
    } else if (path === '/api/plugins' && req.method === 'GET') {
      handlers.handleGetPlugins(req, res);
    } else if (path === '/config/providers' && req.method === 'GET') {
      handlers.handleGetProviders(req, res);
    } else if (path === '/config/agents' && req.method === 'GET') {
      handlers.handleGetAgents(req, res);
    } else if (path === '/session' && req.method === 'GET') {
      handlers.handleGetSessions(req, res);
    } else if (path === '/session' && req.method === 'POST') {
      handlers.handleCreateSession(req, res);
    } else if (path.startsWith('/session/') && path.split('/').length === 3 && req.method === 'GET') {
      const sessionId = path.split('/')[2] || '';
      handlers.handleGetSessionById(sessionId, res);
    } else if (path.startsWith('/session/') && path.endsWith('/messages') && req.method === 'GET') {
      const sessionId = path.split('/')[2] || '';
      handlers.handleGetSessionMessages(sessionId, res);
    } else if (path.startsWith('/session/') && path.split('/').length === 3 && req.method === 'DELETE') {
      const sessionId = path.split('/')[2] || '';
      handlers.handleDeleteSession(sessionId, res);
    } else if (path.startsWith('/session/') && path.split('/').length === 3 && req.method === 'PUT') {
      const sessionId = path.split('/')[2] || '';
      handlers.handleRenameSession(req, sessionId, res);
    } else if (path.startsWith('/session/') && path.split('/').length === 3 && req.method === 'PATCH') {
      const sessionId = path.split('/')[2] || '';
      handlers.handleUpdateSession(req, sessionId, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  };
}
