/**
 * OpenCode SSE Server - Request Handler
 * 
 * HTTP request routing with CORS support
 * State injection pattern kullanılıyor
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { ServerState } from './types.js';
import { createEndpointRouter } from './endpoints.js';

/** Endpoint handler fonksiyonları */
export interface EndpointHandlers {
  handleSSE: (req: IncomingMessage, res: ServerResponse) => void;
  handleGetSession: (req: IncomingMessage, res: ServerResponse) => void;
  handleSendMessage: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleApprove: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleAnswer: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleConnect: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleDisconnect: (req: IncomingMessage, res: ServerResponse) => void;
  handleCancel: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleStatus: (req: IncomingMessage, res: ServerResponse) => void;
  handleHealth: (req: IncomingMessage, res: ServerResponse) => void;
  handleGetSessions: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleGetSessionById: (sessionId: string, res: ServerResponse) => Promise<void>;
  handleGetSessionMessages: (sessionId: string, res: ServerResponse) => Promise<void>;
  handleCreateSession: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleDeleteSession: (sessionId: string, res: ServerResponse) => Promise<void>;
  handleRenameSession: (req: IncomingMessage, sessionId: string, res: ServerResponse) => Promise<void>;
  handleUpdateSession: (req: IncomingMessage, sessionId: string, res: ServerResponse) => Promise<void>;
  handleCompact: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleRetry: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleRevert: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleFork: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleFileSearch: (query: string, limit: number, res: ServerResponse) => Promise<void>;
  handleFileContent: (filePath: string, res: ServerResponse) => Promise<void>;
  handleGetMCPServers: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleGetShells: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleGetPlugins: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleGetProviders: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  handleGetAgents: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}

export function handleRequest(
  state: ServerState,
  req: IncomingMessage,
  res: ServerResponse,
  handlers: EndpointHandlers
): void {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', state._config.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Route request
  const router = createEndpointRouter(handlers);
  router(req, res);
}
