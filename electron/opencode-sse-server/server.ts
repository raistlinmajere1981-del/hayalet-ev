/**
 * OpenCode SSE Server - Main Server
 * 
 * SSE server, client management, message streaming, event publishing
 * Çok büyük dosyadan çıktığı için temel yapılar + handler'lar burada
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'http';
import { OpenCodeManager } from '../opencode/index.ts';
import type { NativeUIEvent } from '../opencode-event-parser.ts';
import { handleOpenCodeEvent } from './event-handlers.ts';
import { OpenCodeEventBus } from './event-bus.ts';
import {
  readBody,
  getServerUrl,
  broadcastToClients as _broadcastToClients,
  disconnectAllClients,
  setupHeartbeat,
} from './utils.ts';
import { createEndpointRouter } from './endpoints.ts';
import type {
  SSEEvent,
  SSEEventType as _SSEEventType,
  SSEClient,
  SSEServerConfig,
  PermissionEventData,
  QuestionEventData,
} from './types.ts';

export const OpenCodeSSEServer = {
  _server: null as ReturnType<typeof createServer> | null,
  _eventBus: new OpenCodeEventBus(),
  _clients: new Map<number, SSEClient>(),
  _nextClientId: 0,
  _heartbeatInterval: null as NodeJS.Timeout | null,
  _currentSessionId: null as string | null,
  _openCodeConnected: false,
  _lastSentUserMessageId: null as string | null,
  _openCodeConnecting: false,
  _currentAssistantMessageId: null as string | null,
  _currentAssistantContent: '' as string,
  _config: {
    port: 4097,
    host: '127.0.0.1',
    corsOrigin: '*',
  } as SSEServerConfig,

  // =========================================================================
  // Public API - Lifecycle
  // =========================================================================

  async start(config: Partial<SSEServerConfig> = {}): Promise<{ success: boolean; url?: string; workspace?: string; error?: string }> {
    if (this._server) {
      return { success: true, url: getServerUrl(this._config.host, this._config.port), workspace: process.cwd() };
    }

    this._config = { ...this._config, ...config };

    return new Promise((resolve) => {
      try {
        this._server = createServer((req, res) => this._handleRequest(req, res));

        this._server.on('error', (err: NodeJS.ErrnoException) => {
          console.log('[SSE-SERVER]', 'error', `Server error: ${err.message}`);
          if (err.code === 'EADDRINUSE') {
            resolve({ success: false, error: `Port ${this._config.port} kullanımda` });
          } else {
            resolve({ success: false, error: err.message });
          }
        });

        this._server.listen(this._config.port, this._config.host, () => {
          console.log('[SSE-SERVER]', 'info', `Server başlatıldı: ${getServerUrl(this._config.host, this._config.port)}`);
          this._startHeartbeat();
          resolve({ success: true, url: getServerUrl(this._config.host, this._config.port), workspace: process.cwd() });
        });
      } catch (err: unknown) {
        resolve({ success: false, error: (err as Error).message });
      }
    });
  },

  async stop(): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      this.disconnectFromOpenCode();
      this._stopHeartbeat();
      disconnectAllClients(this._clients);

      if (!this._server) {
        resolve({ success: true });
        return;
      }

      this._server.close((err) => {
        if (err) {
          console.log('[SSE-SERVER]', 'error', `Server kapatma hatası: ${err.message}`);
        } else {
          console.log('[SSE-SERVER]', 'info', 'Server durduruldu');
        }
        this._server = null;
        resolve({ success: true });
      });
    });
  },

  // =========================================================================
  // Public API - Event Publishing
  // =========================================================================

  publish(event: SSEEvent): void {
    this._eventBus.publish(event);
    
    const eventData = `data: ${JSON.stringify(event)}\n\n`;
    for (const [clientId, client] of this._clients) {
      try {
        client.response.write(eventData);
      } catch (err) {
        console.log('[SSE-SERVER]', 'warn', `Failed to write to client ${clientId}`, { error: (err as Error).message });
        this._clients.delete(clientId);
      }
    }
  },

  getSessionId(): string | null {
    return this._currentSessionId;
  },

  setSessionId(sessionId: string | null): void {
    this._currentSessionId = sessionId;
    if (sessionId) {
      this.publish({
        type: 'session.started',
        timestamp: Date.now(),
        sessionId,
        data: { sessionId },
      });
    }
  },

  startMessageStream(role: 'user' | 'assistant', messageId?: string): string {
    const id = messageId || `msg-${Date.now()}`;
    this.publish({
      type: 'message.start',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { role, messageId: id },
    });
    return id;
  },

  appendMessageDelta(messageId: string, delta: string): void {
    this.publish({
      type: 'message.delta',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { messageId, delta },
    });
  },

  endMessageStream(messageId: string, fullContent: string): void {
    this.publish({
      type: 'message.end',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { messageId, content: fullContent },
    });
  },

  startToolCall(toolId: string, toolName: string, input?: Record<string, unknown>): void {
    this.publish({
      type: 'tool.start',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { toolId, toolName, status: 'running', input },
    });
  },

  sendToolOutput(toolId: string, output: string): void {
    this.publish({
      type: 'tool.output',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { toolId, output },
    });
  },

  endToolCall(toolId: string, status: 'success' | 'error', result?: string): void {
    this.publish({
      type: 'tool.end',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { toolId, status, output: result },
    });
  },

  startStep(stepId: string, messageId?: string): void {
    this.publish({
      type: 'step.start',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { stepId, messageId },
    });
  },

  finishStep(stepId: string, usage: { inputTokens?: number; outputTokens?: number; cost?: number }, messageId?: string): void {
    this.publish({
      type: 'step.finish',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: {
        stepId,
        messageId,
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
        cost: usage.cost || 0,
      },
    });
  },

  requestPermission(data: PermissionEventData): void {
    this.publish({
      type: 'permission.request',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data,
    });
  },

  askQuestion(data: QuestionEventData): void {
    this.publish({
      type: 'question.ask',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data,
    });
  },

  getStatus(): { running: boolean; url: string | null; clients: number; openCodeConnected: boolean } {
    return {
      running: this._server !== null,
      url: this._server ? getServerUrl(this._config.host, this._config.port) : null,
      clients: this._clients.size,
      openCodeConnected: this._openCodeConnected,
    };
  },

  // =========================================================================
  // OpenCode Event Bridge
  // =========================================================================

  async connectToOpenCode(): Promise<{ success: boolean; error?: string; sessionId?: string | null }> {
    if (this._openCodeConnected) {
      console.log('[SSE-SERVER]', 'debug', 'OpenCode zaten bağlı');
      return { success: true, sessionId: this._currentSessionId };
    }
    
    if (this._openCodeConnecting) {
      console.log('[SSE-SERVER]', 'debug', 'OpenCode bağlantısı zaten devam ediyor');
      return { success: true };
    }
    
    this._openCodeConnecting = true;

    try {
      const status = OpenCodeManager.getStatus();
      if (!status.running) {
        this._openCodeConnecting = false;
        console.log('[SSE-SERVER]', 'warn', 'OpenCode server çalışmıyor');
        return { success: false, error: 'OpenCode server çalışmıyor - önce workspace oluşturun' };
      }
      
      if (!status.authHeader) {
        this._openCodeConnecting = false;
        console.log('[SSE-SERVER]', 'warn', 'Auth header yok');
        return { success: false, error: 'Auth header yok - önce workspace oluşturun' };
      }

      const sessionResult = await OpenCodeManager.createOrGetSession();
      if (!sessionResult.success) {
        this._openCodeConnecting = false;
        return { success: false, error: sessionResult.error || 'Session oluşturulamadı' };
      }

      if (sessionResult.data) {
        this._currentSessionId = sessionResult.data.id;
      }

      OpenCodeManager.subscribeToEvents((event: NativeUIEvent) => {
        handleOpenCodeEvent(
          event,
          {
            currentAssistantMessageId: this._currentAssistantMessageId,
            currentAssistantContent: this._currentAssistantContent,
            lastSentUserMessageId: this._lastSentUserMessageId,
          },
          {
            startMessageStream: this.startMessageStream.bind(this),
            appendMessageDelta: this.appendMessageDelta.bind(this),
            endMessageStream: this.endMessageStream.bind(this),
            startToolCall: this.startToolCall.bind(this),
            endToolCall: this.endToolCall.bind(this),
            startStep: this.startStep.bind(this),
            finishStep: this.finishStep.bind(this),
            requestPermission: this.requestPermission.bind(this),
            askQuestion: this.askQuestion.bind(this),
            publish: this.publish.bind(this),
            getCurrentSessionId: () => this._currentSessionId,
          }
        );
      });

      this._openCodeConnected = true;
      this._openCodeConnecting = false;
      console.log('[SSE-SERVER]', 'info', 'OpenCode bağlantısı kuruldu', { sessionId: sessionResult.data?.id });

      this.publish({
        type: 'status.change',
        timestamp: Date.now(),
        sessionId: this._currentSessionId,
        data: { status: 'opencode_connected' },
      });

      return { success: true, sessionId: sessionResult.data?.id };
    } catch (err) {
      this._openCodeConnecting = false;
      console.log('[SSE-SERVER]', 'error', 'OpenCode bağlantı hatası', { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  },

  disconnectFromOpenCode(): void {
    if (!this._openCodeConnected) return;

    OpenCodeManager.unsubscribeFromEvents();
    this._openCodeConnected = false;

    console.log('[SSE-SERVER]', 'info', 'OpenCode bağlantısı kesildi');

    this.publish({
      type: 'status.change',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { status: 'opencode_disconnected' },
    });
  },

  // =========================================================================
  // Private Methods
  // =========================================================================

  _handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', this._config.corsOrigin);
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
    const router = createEndpointRouter({
      handleSSE: this._handleSSE.bind(this),
      handleGetSession: this._handleGetSession.bind(this),
      handleSendMessage: this._handleSendMessage.bind(this),
      handleApprove: this._handleApprove.bind(this),
      handleAnswer: this._handleAnswer.bind(this),
      handleConnect: this._handleConnect.bind(this),
      handleDisconnect: this._handleDisconnect.bind(this),
      handleCancel: this._handleCancel.bind(this),
      handleStatus: this._handleStatus.bind(this),
      handleHealth: this._handleHealth.bind(this),
      handleGetSessions: this._handleGetSessions.bind(this),
      handleGetSessionById: this._handleGetSessionById.bind(this),
      handleGetSessionMessages: this._handleGetSessionMessages.bind(this),
      handleCreateSession: this._handleCreateSession.bind(this),
      handleDeleteSession: this._handleDeleteSession.bind(this),
      handleRenameSession: this._handleRenameSession.bind(this),
      handleUpdateSession: this._handleUpdateSession.bind(this),
      handleCompact: this._handleCompact.bind(this),
      handleRetry: this._handleRetry.bind(this),
      handleRevert: this._handleRevert.bind(this),
      handleFork: this._handleFork.bind(this),
      handleFileSearch: this._handleFileSearch.bind(this),
      handleFileContent: this._handleFileContent.bind(this),
      handleGetMCPServers: this._handleGetMCPServers.bind(this),
      handleGetShells: this._handleGetShells.bind(this),
      handleGetPlugins: this._handleGetPlugins.bind(this),
      handleGetProviders: this._handleGetProviders.bind(this),
      handleGetAgents: this._handleGetAgents.bind(this),
    });

    router(req, res);
  },

  _handleSSE(_req: IncomingMessage, res: ServerResponse): void {
    const clientId = ++this._nextClientId;
    console.log('[SSE-SERVER]', 'debug', `SSE client connected: ${clientId}`);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const connectEvent: SSEEvent = {
      type: 'status.change',
      timestamp: Date.now(),
      data: { status: 'connected', clientId },
    };
    res.write(`data: ${JSON.stringify(connectEvent)}\n\n`);

    if (this._currentSessionId) {
      const sessionEvent: SSEEvent = {
        type: 'session.started',
        timestamp: Date.now(),
        sessionId: this._currentSessionId,
        data: { sessionId: this._currentSessionId },
      };
      res.write(`data: ${JSON.stringify(sessionEvent)}\n\n`);
    }

    const client: SSEClient = {
      id: clientId,
      response: res,
      connectedAt: Date.now(),
    };
    this._clients.set(clientId, client);

    const cleanup = () => {
      console.log('[SSE-SERVER]', 'debug', `SSE client disconnected: ${clientId}`);
      this._clients.delete(clientId);
    };

    res.on('close', cleanup);
    res.on('error', cleanup);
  },

  _handleGetSession(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessionId: this._currentSessionId }));
  },

  async _handleSendMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readBody(req);
      const { message, messageId: clientMessageId } = JSON.parse(body);

      if (!message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Message required' }));
        return;
      }

      if (this._currentAssistantMessageId && this._currentAssistantContent) {
        this.endMessageStream(this._currentAssistantMessageId, this._currentAssistantContent);
      }

      this._currentAssistantContent = '';
      this._currentAssistantMessageId = null;

      const result = await OpenCodeManager.sendMessage(message, undefined, clientMessageId);
      
      if (result.success && result.data?.messageId) {
        this._lastSentUserMessageId = result.data.messageId;
        console.log('[SSE-SERVER]', 'debug', 'User messageId kaydedildi', { messageId: this._lastSentUserMessageId });
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
        sessionId: this._currentSessionId,
        messageId: result.data?.messageId 
      }));
    } catch (err: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  async _handleApprove(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

      this.publish({
        type: 'status.change',
        timestamp: Date.now(),
        sessionId: this._currentSessionId,
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
  },

  async _handleAnswer(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readBody(req);
      const { questionId, answer } = JSON.parse(body);

      if (!questionId || answer === undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Question ID and answer required' }));
        return;
      }

      this.publish({
        type: 'status.change',
        timestamp: Date.now(),
        sessionId: this._currentSessionId,
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
  },

  _handleStatus(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.getStatus()));
  },

  _handleHealth(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  },

  async _handleConnect(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const result = await this.connectToOpenCode();
      
      if (result.success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          sessionId: this._currentSessionId,
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
  },

  _handleDisconnect(_req: IncomingMessage, res: ServerResponse): void {
    this.disconnectFromOpenCode();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'OpenCode bağlantısı kesildi' }));
  },

  async _handleCancel(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const result = await OpenCodeManager.cancelSession();
      
      if (result.success) {
        this.publish({
          type: 'status.change',
          timestamp: Date.now(),
          sessionId: this._currentSessionId,
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
  },

  // Session management stubs - dosya uzunluğu sınırı
  async _handleGetSessions(_req: IncomingMessage, res: ServerResponse): Promise<void> {
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
  },

  async _handleGetSessionById(sessionId: string, res: ServerResponse): Promise<void> {
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
  },

  async _handleGetSessionMessages(sessionId: string, res: ServerResponse): Promise<void> {
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
  },

  async _handleCreateSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readBody(req);
      const { title, path } = JSON.parse(body || '{}');
      
      const result = await OpenCodeManager.createOrGetSession(path);
      if (!result.success || !result.data) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error || 'Session creation failed' }));
        return;
      }
      
      this._currentSessionId = result.data.id;
      
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
  },

  async _handleDeleteSession(sessionId: string, res: ServerResponse): Promise<void> {
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
      
      if (this._currentSessionId === sessionId) {
        this._currentSessionId = null;
      }
      
      this.publish({
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
  },

  async _handleRenameSession(req: IncomingMessage, sessionId: string, res: ServerResponse): Promise<void> {
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
      
      this.publish({
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
  },

  async _handleUpdateSession(req: IncomingMessage, sessionId: string, res: ServerResponse): Promise<void> {
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
      
      this.publish({
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
  },

  async _handleCompact(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const result = await OpenCodeManager.compactSession();
      if (result.success) {
        this.publish({
          type: 'session.compacted',
          timestamp: Date.now(),
          sessionId: this._currentSessionId,
          data: { compactedTokens: result.data?.tokens || 0 },
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: result.success, compactedTokens: result.data?.tokens }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  async _handleRetry(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readBody(req);
      const { messageId } = JSON.parse(body || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, messageId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  async _handleRevert(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
  },

  async _handleFork(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Fork not yet implemented' }));
  },

  async _handleFileSearch(query: string, limit: number, res: ServerResponse): Promise<void> {
    try {
      const { readdirSync } = await import('fs');
      const { join, relative } = await import('path');
      
      const cwd = process.cwd();
      const results: Array<{ name: string; path: string; type: string }> = [];
      
      const searchDir = (dir: string, depth = 0) => {
        if (depth > 3 || results.length >= limit) return;
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= limit) break;
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = join(dir, entry.name);
            const relPath = './' + relative(cwd, fullPath);
            if (entry.name.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                name: entry.name,
                path: relPath,
                type: entry.isDirectory() ? 'folder' : 'file',
              });
            }
            if (entry.isDirectory()) {
              searchDir(fullPath, depth + 1);
            }
          }
        } catch {
          // Ignore
        }
      };
      
      if (query) {
        searchDir(cwd);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: results }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message, files: [] }));
    }
  },

  async _handleFileContent(filePath: string, res: ServerResponse): Promise<void> {
    try {
      const { readFileSync } = await import('fs');
      const { extname } = await import('path');
      
      const content = readFileSync(filePath, 'utf-8');
      const ext = extname(filePath).slice(1);
      
      const langMap: Record<string, string> = {
        ts: 'typescript', js: 'javascript', py: 'python',
        json: 'json', md: 'markdown', css: 'css', html: 'html',
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content, language: langMap[ext] || 'plaintext' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  async _handleGetMCPServers(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const result = await OpenCodeManager.getMCPServers();
      if (result.success && result.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ servers: result.data }));
      } else {
        const servers = [
          { name: 'hayalet-ev', status: 'connected', toolCount: 47 },
        ];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ servers }));
      }
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ servers: [] }));
    }
  },

  async _handleGetShells(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const result = await OpenCodeManager.getBackgroundShells();
      if (result.success && result.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ shells: result.data }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ shells: [] }));
      }
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ shells: [] }));
    }
  },

  async _handleGetPlugins(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const result = await OpenCodeManager.getPlugins();
      if (result.success && result.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ plugins: result.data }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ plugins: [] }));
      }
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ plugins: [] }));
    }
  },

  async _handleGetProviders(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const result = await OpenCodeManager.getProviders();
      if (result.success && result.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ providers: [], default: {} }));
      }
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ providers: [], default: {} }));
    }
  },

  async _handleGetAgents(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const result = await OpenCodeManager.getAgents();
      if (result.success && result.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ agents: result.data }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ agents: [] }));
      }
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents: [] }));
    }
  },

  _startHeartbeat(): void {
    this._heartbeatInterval = setupHeartbeat(this._clients);
  },

  _stopHeartbeat(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  },
};
