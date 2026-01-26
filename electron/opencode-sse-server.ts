/**
 * OpenCode SSE Server
 * 
 * Server-Sent Events (SSE) tabanlı real-time event streaming.
 * OpenCode subprocess'inden gelen event'leri web UI'a iletir.
 * 
 * Özellikler:
 * - SSE endpoint (/api/events)
 * - REST API endpoints (/api/sessions, /api/send, /api/approve)
 * - Event bus pattern
 * - Heartbeat (connection keep-alive)
 * - Multi-client support
 * 
 * CodeNomad projesinden ilham alınmıştır.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { EventEmitter } from 'events';
import { URL } from 'url';
import { OpenCodeManager } from './opencode-manager.ts';
import type { NativeUIEvent } from './opencode-event-parser.ts';

// ============================================
// Types
// ============================================

/** SSE Event tipleri - CodeNomad uyumlu */
export type SSEEventType =
  | 'session.started'
  | 'session.stopped'
  | 'session.error'
  | 'session.updated'
  | 'session.completed'
  | 'session.compacted'  // CodeNomad
  | 'message.start'
  | 'message.created'
  | 'message.delta'
  | 'message.end'
  | 'message.completed'
  | 'message.removed'      // CodeNomad
  | 'message.part.removed' // CodeNomad
  | 'tool.start'
  | 'tool.output'
  | 'tool.end'
  | 'permission.request'
  | 'permission.resolved'
  | 'permission.updated'   // CodeNomad
  | 'permission.replied'   // CodeNomad
  | 'permission.requested' // Native UI
  | 'question.ask'
  | 'question.asked'       // CodeNomad
  | 'question.replied'     // CodeNomad
  | 'question.requested'   // Native UI
  | 'question.answered'    // Native UI
  | 'thinking.start'
  | 'thinking.delta'
  | 'thinking.end'
  | 'step.start'           // Token tracking
  | 'step.finish'          // Token tracking
  | 'status.change'
  | 'error'
  | 'heartbeat';

/** SSE Event payload */
export interface SSEEvent {
  type: SSEEventType;
  timestamp: number;
  sessionId?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
}

/** Message event data */
export interface MessageEventData {
  role: 'user' | 'assistant';
  content: string;
  messageId?: string;
}

/** Tool call event data */
export interface ToolEventData {
  toolId: string;
  toolName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
}

/** Permission request event data */
export interface PermissionEventData {
  permissionId: string;
  toolName: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

/** Question event data */
export interface QuestionEventData {
  questionId: string;
  question: string;
  options?: Array<{ label: string; value: string }>;
  allowFreeform?: boolean;
}

/** Session state - minimal, data comes from OpenCode API */
export interface SessionState {
  id: string;
  status: 'idle' | 'processing' | 'waiting' | 'error';
}

/** Connected SSE client */
interface SSEClient {
  id: number;
  response: ServerResponse;
  connectedAt: number;
}

/** Server configuration */
export interface SSEServerConfig {
  port: number;
  host: string;
  corsOrigin: string;
}

// ============================================
// Event Bus
// ============================================

class OpenCodeEventBus extends EventEmitter {
  publish(event: SSEEvent): void {
    // Emit for internal listeners
    this.emit('event', event);
    this.emit(event.type, event);
  }

  onEvent(listener: (event: SSEEvent) => void): () => void {
    this.on('event', listener);
    return () => this.off('event', listener);
  }
}

// ============================================
// SSE Server
// ============================================

export const OpenCodeSSEServer = {
  _server: null as ReturnType<typeof createServer> | null,
  _eventBus: new OpenCodeEventBus(),
  _clients: new Map<number, SSEClient>(),
  _nextClientId: 0,
  _heartbeatInterval: null as NodeJS.Timeout | null,
  // Session state - minimal tracking (session ID only, data comes from OpenCode API)
  _currentSessionId: null as string | null,
  _openCodeConnected: false,
  // Echo filtreleme için son gönderilen user mesajı ID'si
  _lastSentUserMessageId: null as string | null,
  _config: {
    port: 4097, // OpenCode server'dan farklı port
    host: '127.0.0.1',
    corsOrigin: '*',
  } as SSEServerConfig,

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * SSE Server'ı başlat
   */
  async start(config: Partial<SSEServerConfig> = {}): Promise<{ success: boolean; url?: string; workspace?: string; error?: string }> {
    if (this._server) {
      return { success: true, url: this._getServerUrl(), workspace: process.cwd() };
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
          console.log('[SSE-SERVER]', 'info', `Server başlatıldı: ${this._getServerUrl()}`);
          this._startHeartbeat();
          resolve({ success: true, url: this._getServerUrl(), workspace: process.cwd() });
        });
      } catch (err: unknown) {
        resolve({ success: false, error: (err as Error).message });
      }
    });
  },

  /**
   * SSE Server'ı durdur
   */
  async stop(): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      // OpenCode bağlantısını kes
      this.disconnectFromOpenCode();
      
      this._stopHeartbeat();
      this._disconnectAllClients();

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

  /**
   * Event yayınla (OpenCode Manager tarafından çağrılır)
   * Tüm bağlı SSE client'lara event gönderir
   */
  publish(event: SSEEvent): void {
    // Emit for internal listeners via event bus
    this._eventBus.publish(event);
    
    // Send to all connected SSE clients
    const eventData = `data: ${JSON.stringify(event)}\n\n`;
    for (const [clientId, client] of this._clients) {
      try {
        client.response.write(eventData);
      } catch (err) {
        console.log('[SSE-SERVER]', 'warn', `Failed to write to client ${clientId}`, { error: (err as Error).message });
        // Remove dead client
        this._clients.delete(clientId);
      }
    }
  },

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this._currentSessionId;
  },

  /**
   * Set current session ID (called when OpenCode session is created/loaded)
   */
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

  /**
   * Streaming mesaj başlat
   */
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

  /**
   * Streaming mesaj delta
   */
  appendMessageDelta(messageId: string, delta: string): void {
    this.publish({
      type: 'message.delta',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { messageId, delta },
    });
  },

  /**
   * Streaming mesaj bitir
   */
  endMessageStream(messageId: string, fullContent: string): void {
    this.publish({
      type: 'message.end',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { messageId, content: fullContent },
    });
  },

  /**
   * Tool call başlat
   */
  startToolCall(toolId: string, toolName: string, input?: Record<string, unknown>): void {
    this.publish({
      type: 'tool.start',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { toolId, toolName, status: 'running', input },
    });
  },

  /**
   * Tool output gönder
   */
  sendToolOutput(toolId: string, output: string): void {
    this.publish({
      type: 'tool.output',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { toolId, output },
    });
  },

  /**
   * Tool call bitir
   */
  endToolCall(toolId: string, status: 'success' | 'error', result?: string): void {
    this.publish({
      type: 'tool.end',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { toolId, status, output: result },
    });
  },

  /**
   * Step started event gönder (token tracking)
   */
  startStep(stepId: string, messageId?: string): void {
    this.publish({
      type: 'step.start',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data: { stepId, messageId },
    });
  },

  /**
   * Step finished event gönder (token tracking)
   */
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

  /**
   * Permission request gönder
   */
  requestPermission(data: PermissionEventData): void {
    this.publish({
      type: 'permission.request',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data,
    });
  },

  /**
   * Question gönder
   */
  askQuestion(data: QuestionEventData): void {
    this.publish({
      type: 'question.ask',
      timestamp: Date.now(),
      sessionId: this._currentSessionId,
      data,
    });
  },

  /**
   * Server durumunu al
   */
  getStatus(): { running: boolean; url: string | null; clients: number; openCodeConnected: boolean } {
    return {
      running: this._server !== null,
      url: this._server ? this._getServerUrl() : null,
      clients: this._clients.size,
      openCodeConnected: this._openCodeConnected,
    };
  },

  // =========================================================================
  // OpenCode Event Bridge
  // =========================================================================

  _openCodeConnecting: false,

  /**
   * OpenCode SSE stream'ine bağlan ve event'leri Native UI'a ilet
   */
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
      // OpenCode server çalışıyor mu ve auth header set edilmiş mi kontrol et
      const status = OpenCodeManager.getStatus();
      if (!status.running) {
        this._openCodeConnecting = false;
        console.log('[SSE-SERVER]', 'warn', 'OpenCode server çalışmıyor - workspace oluşturulmalı');
        return { success: false, error: 'OpenCode server çalışmıyor - önce workspace oluşturun' };
      }
      
      // Auth header kontrolü - workspace oluşturulmadan API çağrıları 401 döner
      if (!status.authHeader) {
        this._openCodeConnecting = false;
        console.log('[SSE-SERVER]', 'warn', 'Auth header yok - workspace oluşturulmalı');
        return { success: false, error: 'Auth header yok - önce workspace oluşturun' };
      }

      // Session oluştur veya mevcut session'a bağlan
      const sessionResult = await OpenCodeManager.createOrGetSession();
      if (!sessionResult.success) {
        this._openCodeConnecting = false;
        return { success: false, error: sessionResult.error || 'Session oluşturulamadı' };
      }

      // Session ID'yi kaydet
      if (sessionResult.data) {
        this._currentSessionId = sessionResult.data.id;
      }

      // OpenCode SSE event'lerine subscribe ol
      OpenCodeManager.subscribeToEvents((event: NativeUIEvent) => {
        this._handleOpenCodeEvent(event);
      });

      this._openCodeConnected = true;
      this._openCodeConnecting = false;
      console.log('[SSE-SERVER]', 'info', 'OpenCode bağlantısı kuruldu', { 
        sessionId: sessionResult.data?.id 
      });

      // Bağlantı event'i yayınla
      this.publish({
        type: 'status.change',
        timestamp: Date.now(),
        sessionId: this._currentSessionId,
        data: { status: 'opencode_connected' },
      });

      return { success: true, sessionId: sessionResult.data?.id };
    } catch (err) {
      this._openCodeConnecting = false;
      console.log('[SSE-SERVER]', 'error', 'OpenCode bağlantı hatası', { 
        error: (err as Error).message 
      });
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * OpenCode bağlantısını kes
   */
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

  _currentAssistantMessageId: null as string | null,
  _currentAssistantContent: '' as string,  // Kümülatif içerik takibi
  // Not: Echo filtreleme artık client tarafında (StoreBridge) yapılıyor

  /**
   * OpenCode'dan gelen event'leri işle ve Native UI'a ilet
   * CodeNomad session-events.ts pattern'i takip edilir
   */
  _handleOpenCodeEvent(event: NativeUIEvent): void {
    console.log('[SSE-SERVER]', 'debug', 'OpenCode event alındı', { type: event.type });
    
    // Event tipine göre işle - CodeNomad tarzı
    switch (event.type) {
      // =========================================
      // Message Events (CodeNomad: message.updated, message.part.updated)
      // =========================================
      case 'message.created': {
        // DEVRE DIŞI - message.part.updated kullanıyoruz
        // message.created sadece log için
        const role = (event.data.role as 'user' | 'assistant') || 'assistant';
        const messageId = (event.data.id as string) || '';
        console.log('[SSE-SERVER]', 'debug', 'message.created ignored', { role, messageId });
        break;
      }

      // =========================================
      // Message Part Updated (CodeNomad/OpenCode streaming event)
      // =========================================
      case 'message.part.updated': {
        // Farklı format destekleri - nested part objesi veya flat data
        const partObj = event.data.part as { type?: string; content?: string; text?: string } | undefined;
        const role = (event.data.role as 'user' | 'assistant') || 'assistant';
        const messageId = (event.data.messageId || event.data.id) as string;
        
        // Part içeriğini al (nested veya flat format)
        const fullContent = partObj?.content || partObj?.text || (event.data.fullContent as string) || (event.data.content as string) || '';
        const partType = partObj?.type || (event.data.partType as string) || (event.data.type as string) || 'text';
        
        // DEBUG: Tüm message.part.updated event'lerini logla
        console.log('[SSE-SERVER]', 'debug', 'message.part.updated received', { 
          messageId, 
          role, 
          partType,
          contentLength: fullContent?.length || 0,
          contentPreview: fullContent?.substring?.(0, 50) || '(empty)',
          lastSentUserMessageId: this._lastSentUserMessageId,
          isUserMessage: role === 'user',
          isEchoCandidate: messageId === this._lastSentUserMessageId,
          hasPartObj: !!partObj,
          eventDataKeys: Object.keys(event.data || {}),
        });

        // User mesajlarını atla - SADECE role === 'user' kontrolü
        if (role === 'user') {
          console.log('[SSE-SERVER]', 'debug', 'User message.part.updated skipped (role=user)', { messageId });
          break;
        }
        
        // User mesajının echo'sunu atla (aynı messageId ile gelen)
        // OpenCode user mesajını echo ediyor ve role bilgisi her zaman doğru gelmiyor
        if (messageId === this._lastSentUserMessageId) {
          console.log('[SSE-SERVER]', 'debug', 'User message echo skipped (same messageId)', { messageId });
          break;
        }
        
        // step-finish: Streaming bitişi sinyali
        if (partType === 'step-finish') {
          // reason event.data'dan veya partObj'den gelebilir
          const reason = (event.data.reason as string) || (partObj as Record<string, unknown>)?.reason as string;
          console.log('[SSE-SERVER]', 'debug', 'step-finish received', { messageId, reason, hasCurrentMsg: !!this._currentAssistantMessageId });
          
          // reason: "stop" = mesaj tamamlandı, "tool-calls" = tool çağrısı yapılacak
          if (reason === 'stop' && this._currentAssistantMessageId) {
            console.log('[SSE-SERVER]', 'info', 'Streaming tamamlandı (step-finish:stop)', { messageId: this._currentAssistantMessageId });
            this.endMessageStream(this._currentAssistantMessageId, this._currentAssistantContent);
            this._currentAssistantMessageId = null;
            this._currentAssistantContent = '';
          }
          break;
        }
        
        // Sadece text ve thinking part'ları işle
        if (partType !== 'text' && partType !== 'thinking') {
          console.log('[SSE-SERVER]', 'debug', 'Non-text part skipped', { partType, messageId });
          break;
        }
        
        // Boş içerik atla
        if (!fullContent || fullContent.trim() === '') {
          break;
        }
        
        // Not: Echo filtreleme artık client tarafında (StoreBridge) yapılıyor
        
        // Mesaj başlatılmadıysa başlat
        if (!this._currentAssistantMessageId) {
          this._currentAssistantMessageId = messageId || `msg-${Date.now()}`;
          this._currentAssistantContent = '';
          this.startMessageStream('assistant', this._currentAssistantMessageId);
        } else if (messageId && messageId !== this._currentAssistantMessageId) {
          // Farklı mesaj - öncekini kapat
          this.endMessageStream(this._currentAssistantMessageId, this._currentAssistantContent);
          this._currentAssistantMessageId = messageId;
          this._currentAssistantContent = '';
          this.startMessageStream('assistant', this._currentAssistantMessageId);
        }
        
        // Gerçek delta'yı hesapla
        let actualDelta = fullContent;
        if (fullContent.startsWith(this._currentAssistantContent)) {
          actualDelta = fullContent.slice(this._currentAssistantContent.length);
        }
        
        if (actualDelta) {
          this._currentAssistantContent = fullContent;
          this.appendMessageDelta(this._currentAssistantMessageId, actualDelta);
        }
        break;
      }

      // message.updated - OpenCode bazen bu formatı kullanıyor
      case 'message.updated': {
        // DEBUG: message.updated event'ini logla
        console.log('[SSE-SERVER]', 'debug', 'message.updated RAW DATA', {
          dataKeys: Object.keys(event.data || {}),
          content: event.data.content,
          text: event.data.text,
          fullContent: event.data.fullContent,
          role: event.data.role,
          messageId: event.data.messageId,
        });
        
        const updatedMessageId = (event.data.messageId || event.data.id) as string;
        const updatedContent = (event.data.content || event.data.text || event.data.fullContent) as string;
        const updatedRole = (event.data.role as string) || 'assistant';
        
        // User mesajlarını atla
        if (updatedRole === 'user') {
          break;
        }
        
        if (!updatedContent) {
          break;
        }
        
        // Mesaj başlatılmamışsa başlat
        if (!this._currentAssistantMessageId && updatedMessageId) {
          this._currentAssistantMessageId = updatedMessageId;
          this._currentAssistantContent = '';
          this.startMessageStream('assistant', updatedMessageId);
        }
        
        // Delta hesapla
        let delta = updatedContent;
        if (updatedContent.startsWith(this._currentAssistantContent)) {
          delta = updatedContent.slice(this._currentAssistantContent.length);
        }
        
        if (delta) {
          this._currentAssistantContent = updatedContent;
          this.appendMessageDelta(this._currentAssistantMessageId!, delta);
        }
        break;
      }

      case 'message.delta': {
        // Fallback: message.delta doğrudan delta gönderir
        const deltaContent = (event.data.delta || event.data.content || event.data.fullContent || event.data.text) as string;
        const deltaRole = event.data.role as string;
        const deltaMessageId = (event.data.messageId || event.data.id) as string;
        
        // User mesajlarını atla
        if (deltaRole === 'user') {
          break;
        }
        
        if (deltaContent) {
          // Mesaj başlatılmamışsa başlat
          if (!this._currentAssistantMessageId) {
            this._currentAssistantMessageId = deltaMessageId || `msg-${Date.now()}`;
            this._currentAssistantContent = '';
            this.startMessageStream('assistant', this._currentAssistantMessageId);
          }
          
          this._currentAssistantContent += deltaContent;
          this.appendMessageDelta(this._currentAssistantMessageId, deltaContent);
        }
        break;
      }

      case 'message.completed': {
        const role = (event.data.role as 'user' | 'assistant') || 'assistant';
        
        // User mesajlarını atla
        if (role === 'user') {
          break;
        }
        
        if (this._currentAssistantMessageId) {
          const finalContent = (event.data.content as string) || this._currentAssistantContent;
          this.endMessageStream(this._currentAssistantMessageId, finalContent);
          this._currentAssistantMessageId = null;
          this._currentAssistantContent = '';
        }
        break;
      }

      // Message removed (CodeNomad)
      case 'message.removed':
        this.publish({
          type: 'message.removed',
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: event.data,
        });
        break;

      // Message part removed (CodeNomad)
      case 'message.part.removed':
        this.publish({
          type: 'message.part.removed',
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: event.data,
        });
        break;

      // =========================================
      // Tool Events
      // =========================================
      case 'tool.start':
        this.startToolCall(
          event.data.toolId as string,
          event.data.toolName as string,
          event.data.toolInput as Record<string, unknown>
        );
        break;

      case 'tool.end':
        this.endToolCall(
          event.data.toolId as string,
          event.data.isError ? 'error' : 'success',
          event.data.output as string
        );
        break;

      // =========================================
      // Permission Events (CodeNomad: permission.updated, permission.replied)
      // =========================================
      case 'permission.request':
      case 'permission.updated':
      case 'permission.asked':
        this.requestPermission({
          permissionId: (event.data.permissionId || event.data.id) as string,
          toolName: event.data.toolName as string,
          description: (event.data.message || event.data.description || `Tool "${event.data.toolName}" izin istiyor`) as string,
          risk: 'medium',
        });
        break;

      case 'permission.resolved':
      case 'permission.replied':
        this.publish({
          type: 'permission.resolved',
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: event.data,
        });
        break;

      // =========================================
      // Question Events (CodeNomad: question.asked, question.replied)
      // =========================================
      case 'question.ask':
      case 'question.asked':
        this.askQuestion({
          questionId: (event.data.questionId || event.data.id) as string,
          question: (event.data.question || event.data.text) as string,
          options: event.data.options as Array<{ label: string; value: string }>,
          allowFreeform: true,
        });
        break;

      case 'question.answered':
      case 'question.replied':
      case 'question.rejected':
        this.publish({
          type: 'status.change',
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: { status: 'question_answered', ...event.data },
        });
        break;

      // =========================================
      // Thinking/Reasoning Events
      // =========================================
      case 'thinking.start':
      case 'thinking.delta':
      case 'thinking.end':
        // Thinking event'lerini sadece yayınla, mesaj başlatma
        // Mesaj başlatma işi message.delta'da yapılacak
        this.publish({
          type: event.type as SSEEventType,
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: {
            ...event.data,
            messageId: this._currentAssistantMessageId || `thinking-${Date.now()}`,
          },
        });
        break;

      // =========================================
      // Step Events (Token Tracking - CodeNomad pattern)
      // =========================================
      case 'step.start':
        this.startStep(
          (event.data.stepId as string) || `step-${Date.now()}`,
          (event.data.messageId as string) || this._currentAssistantMessageId || undefined
        );
        break;

      case 'step.finish':
        this.finishStep(
          (event.data.stepId as string) || `step-${Date.now()}`,
          {
            inputTokens: (event.data.inputTokens as number) || 0,
            outputTokens: (event.data.outputTokens as number) || 0,
            cost: (event.data.cost as number) || 0,
          },
          (event.data.messageId as string) || this._currentAssistantMessageId || undefined
        );
        break;

      // =========================================
      // Session Events (CodeNomad: session.idle, session.status, session.compacted, session.error)
      // =========================================
      case 'session.updated':
        this.publish({
          type: 'session.updated',
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: event.data,
        });
        break;

      case 'session.compacted':
        this.publish({
          type: 'session.compacted',
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: event.data,
        });
        break;

      case 'session.error':
        this.publish({
          type: 'session.error',
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: event.data,
        });
        break;

      case 'status.change': {
        const status = event.data.status;
        const statusType = typeof status === 'object' && status !== null ? (status as { type?: string }).type : status;
        
        // Idle status'u sadece aktif streaming yoksa işle
        // Aksi halde mesaj tamamlanmadan UI "Hazır" moduna geçer
        if (statusType === 'idle') {
          // Aktif streaming varsa idle'a geçme - message.completed bekle
          if (this._currentAssistantMessageId && this._currentAssistantContent) {
            console.log('[SSE-SERVER]', 'debug', 'status.change:idle ignored - active streaming', {
              messageId: this._currentAssistantMessageId,
              contentLength: this._currentAssistantContent.length
            });
            // Session status'unu güncelleme, client'a gönderme
            break;
          }
        }
        
        this.publish({
          type: 'status.change',
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: { status: statusType },
        });
        break;
      }

      case 'error':
        this.publish({
          type: 'session.error',
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: event.data,
        });
        break;

      // =========================================
      // Default: Pass through unknown events
      // =========================================
      default:
        this.publish({
          type: event.type as SSEEventType,
          timestamp: event.timestamp,
          sessionId: this._currentSessionId,
          data: event.data,
        });
    }
  },

  /**
   * OpenCode status'unu local status'a map et
   */
  _mapOpenCodeStatus(status: string): 'idle' | 'processing' | 'waiting' | 'error' {
    switch (status) {
      case 'idle':
        return 'idle';
      case 'processing':
        return 'processing';
      case 'waiting_permission':
      case 'waiting_answer':
        return 'waiting';
      default:
        return 'idle';
    }
  },

  // =========================================================================
  // Private Methods - HTTP Handling
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

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // Route handling
    if (path === '/api/events' && req.method === 'GET') {
      this._handleSSE(req, res);
    } else if (path === '/api/session' && req.method === 'GET') {
      this._handleGetSession(res);
    } else if (path === '/api/send' && req.method === 'POST') {
      this._handleSendMessage(req, res);
    } else if (path === '/api/approve' && req.method === 'POST') {
      this._handleApprove(req, res);
    } else if (path === '/api/answer' && req.method === 'POST') {
      this._handleAnswer(req, res);
    } else if (path === '/api/connect' && req.method === 'POST') {
      this._handleConnect(res);
    } else if (path === '/api/disconnect' && req.method === 'POST') {
      this._handleDisconnect(res);
    } else if (path === '/api/cancel' && req.method === 'POST') {
      this._handleCancel(res);
    } else if (path === '/api/status' && req.method === 'GET') {
      this._handleStatus(res);
    } else if (path === '/health' && req.method === 'GET') {
      this._handleHealth(res);
    } else if (path === '/api/sessions' && req.method === 'GET') {
      this._handleGetSessions(res);
    } else if (path.startsWith('/api/sessions/') && req.method === 'GET') {
      const sessionId = path.split('/')[3];
      if (path.endsWith('/messages')) {
        this._handleGetSessionMessages(sessionId.replace('/messages', ''), res);
      } else {
        this._handleGetSessionById(sessionId, res);
      }
    } else if (path.startsWith('/api/sessions/') && req.method === 'DELETE') {
      const sessionId = path.split('/')[3];
      this._handleDeleteSession(sessionId, res);
    } else if (path.startsWith('/api/sessions/') && req.method === 'PUT') {
      const sessionId = path.split('/')[3];
      this._handleRenameSession(req, sessionId, res);
    } else if (path.startsWith('/api/sessions/') && req.method === 'PATCH') {
      const sessionId = path.split('/')[3];
      this._handleUpdateSession(req, sessionId, res);
    } else if (path === '/api/sessions' && req.method === 'POST') {
      this._handleCreateSession(req, res);
    } else if (path === '/api/compact' && req.method === 'POST') {
      this._handleCompact(res);
    } else if (path === '/api/retry' && req.method === 'POST') {
      this._handleRetry(req, res);
    } else if (path === '/api/conversation/revert' && req.method === 'POST') {
      this._handleRevert(req, res);
    } else if (path === '/api/conversation/fork' && req.method === 'POST') {
      this._handleFork(req, res);
    } else if (path.startsWith('/api/files/search') && req.method === 'GET') {
      const query = url.searchParams.get('q') || '';
      const limit = parseInt(url.searchParams.get('limit') || '10');
      this._handleFileSearch(query, limit, res);
    } else if (path.startsWith('/api/files/content') && req.method === 'GET') {
      const filePath = url.searchParams.get('path') || '';
      this._handleFileContent(filePath, res);
    } else if (path === '/api/mcp/servers' && req.method === 'GET') {
      this._handleGetMCPServers(res);
    } else if (path === '/api/shells' && req.method === 'GET') {
      this._handleGetShells(res);
    } else if (path === '/api/plugins' && req.method === 'GET') {
      this._handleGetPlugins(res);
    } else if (path === '/config/providers' && req.method === 'GET') {
      // Native UI için providers endpoint'i
      this._handleGetProviders(res);
    } else if (path === '/config/agents' && req.method === 'GET') {
      // Native UI için agents endpoint'i
      this._handleGetAgents(res);
    // =========================================================================
    // OpenCode SDK Compatible Routes: /session/{id} format
    // API Client bu formatı kullanıyor - /api/sessions/ ile aynı handler'ları kullan
    // =========================================================================
    } else if (path === '/session' && req.method === 'GET') {
      // GET /session - tüm session'ları listele
      this._handleGetSessions(res);
    } else if (path === '/session' && req.method === 'POST') {
      // POST /session - yeni session oluştur
      this._handleCreateSession(req, res);
    } else if (path.startsWith('/session/') && path.split('/').length === 3 && req.method === 'GET') {
      // GET /session/{id} - belirli session'ı al
      const sessionId = path.split('/')[2];
      this._handleGetSessionById(sessionId, res);
    } else if (path.startsWith('/session/') && path.endsWith('/messages') && req.method === 'GET') {
      // GET /session/{id}/messages - session mesajlarını al
      const sessionId = path.split('/')[2];
      this._handleGetSessionMessages(sessionId, res);
    } else if (path.startsWith('/session/') && path.split('/').length === 3 && req.method === 'DELETE') {
      // DELETE /session/{id} - session sil
      const sessionId = path.split('/')[2];
      this._handleDeleteSession(sessionId, res);
    } else if (path.startsWith('/session/') && path.split('/').length === 3 && req.method === 'PUT') {
      // PUT /session/{id} - session yeniden adlandır
      const sessionId = path.split('/')[2];
      this._handleRenameSession(req, sessionId, res);
    } else if (path.startsWith('/session/') && path.split('/').length === 3 && req.method === 'PATCH') {
      // PATCH /session/{id} - session güncelle (agent, model)
      const sessionId = path.split('/')[2];
      this._handleUpdateSession(req, sessionId, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  },

  _handleSSE(_req: IncomingMessage, res: ServerResponse): void {
    const clientId = ++this._nextClientId;
    console.log('[SSE-SERVER]', 'debug', `SSE client connected: ${clientId}`);

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Initial connection event
    const connectEvent: SSEEvent = {
      type: 'status.change',
      timestamp: Date.now(),
      data: { status: 'connected', clientId },
    };
    res.write(`data: ${JSON.stringify(connectEvent)}\n\n`);

    // Send current session ID if exists
    if (this._currentSessionId) {
      const sessionEvent: SSEEvent = {
        type: 'session.started',
        timestamp: Date.now(),
        sessionId: this._currentSessionId,
        data: { sessionId: this._currentSessionId },
      };
      res.write(`data: ${JSON.stringify(sessionEvent)}\n\n`);
    }

    // Register client
    const client: SSEClient = {
      id: clientId,
      response: res,
      connectedAt: Date.now(),
    };
    this._clients.set(clientId, client);

    // Handle disconnect
    const cleanup = () => {
      console.log('[SSE-SERVER]', 'debug', `SSE client disconnected: ${clientId}`);
      this._clients.delete(clientId);
    };

    res.on('close', cleanup);
    res.on('error', cleanup);
  },

  _handleGetSession(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessionId: this._currentSessionId }));
  },

  async _handleSendMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this._readBody(req);
      const { message, messageId: clientMessageId, agent, providerId, modelId } = JSON.parse(body);

      if (!message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Message required' }));
        return;
      }

      // Önceki streaming mesajı güvenli şekilde tamamla
      if (this._currentAssistantMessageId && this._currentAssistantContent) {
        console.log('[SSE-SERVER]', 'debug', 'Önceki streaming mesaj tamamlanıyor', { 
          messageId: this._currentAssistantMessageId 
        });
        this.endMessageStream(this._currentAssistantMessageId, this._currentAssistantContent);
      }

      // Yeni mesaj için state'i sıfırla
      this._currentAssistantContent = '';
      this._currentAssistantMessageId = null;

      // OpenCode'a mesajı ilet (model ve agent bilgisi dahil - CodeNomad pattern)
      const result = await OpenCodeManager.sendMessage(message, undefined, clientMessageId, {
        agent: agent as string | undefined,
        providerId: providerId as string | undefined,
        modelId: modelId as string | undefined,
      });
      
      // User messageId'yi kaydet (echo filtreleme için)
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

      // NOT: Assistant streaming'i burada başlatmıyoruz!
      // OpenCode'dan message.part.updated event'i geldiğinde otomatik başlayacak
      // Erken başlatmak _currentAssistantMessageId'yi set eder ve gerçek yanıtların
      // işlenmesini engeller.

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
      const body = await this._readBody(req);
      const { permissionId, approved } = JSON.parse(body);

      if (!permissionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Permission ID required' }));
        return;
      }

      // OpenCode'a onay/red bilgisini ilet
      const result = await OpenCodeManager.respondToPermission(permissionId, approved);
      
      if (!result.success) {
        console.log('[SSE-SERVER]', 'error', 'Permission response hatası', { error: result.error });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error || 'Permission yanıtı gönderilemedi' }));
        return;
      }

      // Permission resolved event yayınla
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
      const body = await this._readBody(req);
      const { questionId, answer } = JSON.parse(body);

      if (!questionId || answer === undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Question ID and answer required' }));
        return;
      }

      console.log('[SSE-SERVER]', 'info', 'Question yanıtı alındı', { questionId, answer });

      // Question answered event yayınla
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

  _handleStatus(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.getStatus()));
  },

  _handleHealth(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  },

  async _handleConnect(res: ServerResponse): Promise<void> {
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

  _handleDisconnect(res: ServerResponse): void {
    this.disconnectFromOpenCode();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'OpenCode bağlantısı kesildi' }));
  },

  async _handleCancel(res: ServerResponse): Promise<void> {
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

  // =========================================================================
  // Private Methods - Utilities
  // =========================================================================

  _getServerUrl(): string {
    return `http://${this._config.host}:${this._config.port}`;
  },

  _broadcastToClients(event: SSEEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    
    for (const client of this._clients.values()) {
      try {
        client.response.write(data);
      } catch (err) {
        console.log('[SSE-SERVER]', 'warn', `Client ${client.id} write error`);
        this._clients.delete(client.id);
      }
    }
  },

  _disconnectAllClients(): void {
    for (const client of this._clients.values()) {
      try {
        client.response.end();
      } catch {
        // Ignore
      }
    }
    this._clients.clear();
  },

  _startHeartbeat(): void {
    this._heartbeatInterval = setInterval(() => {
      const event: SSEEvent = {
        type: 'heartbeat',
        timestamp: Date.now(),
      };
      this._broadcastToClients(event);
    }, 15000); // 15 saniye
  },

  _stopHeartbeat(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  },

  _readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  },

  // =========================================================================
  // Session Management Endpoints - Direct OpenCode API Proxy
  // =========================================================================

  async _handleGetSessions(res: ServerResponse): Promise<void> {
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
      console.log('[SSE-SERVER]', 'error', 'Failed to fetch sessions', { 
        error: (error as Error).message 
      });
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
      const body = await this._readBody(req);
      const { title, path } = JSON.parse(body || '{}');
      
      console.log('[SSE-SERVER]', 'info', 'Creating session via OpenCode API', { title, path });
      
      const result = await OpenCodeManager.createOrGetSession(path);
      
      if (!result.success || !result.data) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error || 'Session creation failed' }));
        return;
      }
      
      const openCodeSession = result.data;
      this._currentSessionId = openCodeSession.id;
      
      console.log('[SSE-SERVER]', 'info', 'Session created', { 
        sessionId: openCodeSession.id, 
        path 
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        sessionId: openCodeSession.id, 
        title: title || openCodeSession.title,
        path 
      }));
    } catch (err) {
      console.log('[SSE-SERVER]', 'error', 'Session creation error', { error: (err as Error).message });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  async _handleDeleteSession(sessionId: string, res: ServerResponse): Promise<void> {
    try {
      console.log('[SSE-SERVER]', 'info', 'Delete session requested', { sessionId });
      
      // OpenCodeManager üzerinden session'ı sil
      const result = await OpenCodeManager.deleteSession(sessionId);
      
      if (!result.success) {
        // 404 durumunda özel handling
        if (result.error === 'Session not found') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error || 'Failed to delete session' }));
        return;
      }
      
      // Local state'i güncelle
      if (this._currentSessionId === sessionId) {
        this._currentSessionId = null;
      }
      
      // SSE event gönder
      this.publish({
        type: 'session.stopped',
        timestamp: Date.now(),
        sessionId,
        data: { sessionId, reason: 'deleted' },
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.log('[SSE-SERVER]', 'error', 'Delete session error', { error: (error as Error).message });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
  },

  async _handleRenameSession(req: IncomingMessage, sessionId: string, res: ServerResponse): Promise<void> {
    try {
      const body = await this._readBody(req);
      const { title } = JSON.parse(body || '{}');
      
      if (!title || typeof title !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Title is required' }));
        return;
      }
      
      console.log('[SSE-SERVER]', 'info', `Session rename requested: ${sessionId} -> ${title}`);
      
      // OpenCodeManager üzerinden session'ı güncelle
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
      
      // SSE event gönder
      this.publish({
        type: 'session.updated',
        timestamp: Date.now(),
        sessionId,
        data: { title: title.trim() },
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sessionId, title: title.trim() }));
    } catch (err) {
      console.log('[SSE-SERVER]', 'error', 'Rename session error', { error: (err as Error).message });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  /**
   * Session güncelle (agent, model, provider değiştir)
   */
  async _handleUpdateSession(req: IncomingMessage, sessionId: string, res: ServerResponse): Promise<void> {
    try {
      const body = await this._readBody(req);
      const { agent, provider, model } = JSON.parse(body || '{}');
      
      console.log('[SSE-SERVER]', 'info', `Session update: ${sessionId}`, { agent, provider, model });
      
      // OpenCode'a gönder (agent/model değiştirme)
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
      
      // SSE event gönder
      this.publish({
        type: 'session.updated',
        timestamp: Date.now(),
        sessionId,
        data: { agent, provider, model },
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sessionId, agent, provider, model }));
    } catch (err) {
      console.error('[SSE-SERVER]', 'error', 'Update session error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  // =========================================================================
  // Conversation Actions (FAZ 3 - Revert, Fork, Compact, Retry)
  // =========================================================================

  async _handleCompact(res: ServerResponse): Promise<void> {
    try {
      // OpenCode'a compact komutu gönder
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
      const body = await this._readBody(req);
      const { messageId } = JSON.parse(body || '{}');
      
      // Son mesajı veya belirtilen mesajı tekrar gönder
      // OpenCode'da retry API'si yoksa local olarak handle et
      console.log('[SSE-SERVER]', 'info', `Retry requested for: ${messageId || 'last message'}`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, messageId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  async _handleRevert(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this._readBody(req);
      const { messageId } = JSON.parse(body || '{}');
      
      if (!messageId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Message ID required' }));
        return;
      }
      
      // TODO: Implement OpenCodeManager.revertToMessage when available
      console.log('[SSE-SERVER]', 'info', `Revert requested to message: ${messageId}`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, messageId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  async _handleFork(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this._readBody(req);
      const { messageId } = JSON.parse(body || '{}');
      
      // TODO: Implement OpenCodeManager.forkSession when available
      console.log('[SSE-SERVER]', 'info', `Fork requested from message: ${messageId}`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Fork not yet implemented' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  },

  // =========================================================================
  // File Search (FAZ 2 - @ mention)
  // =========================================================================

  async _handleFileSearch(query: string, limit: number, res: ServerResponse): Promise<void> {
    try {
      const { readdirSync } = await import('fs');
      const { join, relative } = await import('path');
      
      const cwd = process.cwd();
      const results: Array<{ name: string; path: string; type: string }> = [];
      
      // Basit recursive dosya arama
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
          // Erişim hatası - atla
        }
      };
      
      if (query) {
        searchDir(cwd);
      } else {
        // Query yoksa root dosyaları göster
        try {
          const entries = readdirSync(cwd, { withFileTypes: true });
          for (const entry of entries.slice(0, limit)) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            results.push({
              name: entry.name,
              path: './' + entry.name,
              type: entry.isDirectory() ? 'folder' : 'file',
            });
          }
        } catch {
          // Hata
        }
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
      
      // Basit language detection
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

  // =========================================================================
  // Status Panel (FAZ 8 - MCP Servers, Shells)
  // =========================================================================

  async _handleGetMCPServers(res: ServerResponse): Promise<void> {
    try {
      // OpenCodeManager'dan gerçek MCP server bilgilerini al
      const result = await OpenCodeManager.getMCPServers();
      
      if (result.success && result.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ servers: result.data }));
      } else {
        // Fallback: Varsayılan değerler
        const servers = [
          { name: 'hayalet-ev', status: 'connected', toolCount: 47 },
        ];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ servers }));
      }
    } catch (err) {
      console.log('[SSE-SERVER]', 'error', 'MCP servers fetch error', { error: (err as Error).message });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ servers: [] }));
    }
  },

  async _handleGetShells(res: ServerResponse): Promise<void> {
    try {
      // OpenCodeManager'dan gerçek shell process bilgilerini al
      const result = await OpenCodeManager.getBackgroundShells();
      
      if (result.success && result.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ shells: result.data }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ shells: [] }));
      }
    } catch (err) {
      console.log('[SSE-SERVER]', 'error', 'Shells fetch error', { error: (err as Error).message });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ shells: [] }));
    }
  },

  async _handleGetPlugins(res: ServerResponse): Promise<void> {
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
      console.log('[SSE-SERVER]', 'error', 'Plugins fetch error', { error: (err as Error).message });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ plugins: [] }));
    }
  },

  /**
   * Provider ve model listesini döndür
   * Native UI için /config/providers endpoint'i
   */
  async _handleGetProviders(res: ServerResponse): Promise<void> {
    try {
      const result = await OpenCodeManager.getProviders();
      
      if (result.success && result.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      } else {
        // Boş providers listesi döndür
        console.log('[SSE-SERVER]', 'warn', 'Providers fetch failed', { error: result.error });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ providers: [], default: {} }));
      }
    } catch (err) {
      console.log('[SSE-SERVER]', 'error', 'Providers fetch error', { error: (err as Error).message });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ providers: [], default: {} }));
    }
  },

  /**
   * Agent listesini döndür
   * Native UI için /config/agents endpoint'i
   */
  async _handleGetAgents(res: ServerResponse): Promise<void> {
    try {
      const result = await OpenCodeManager.getAgents();
      
      if (result.success && result.data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ agents: result.data }));
      } else {
        console.log('[SSE-SERVER]', 'warn', 'Agents fetch failed', { error: result.error });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ agents: [] }));
      }
    } catch (err) {
      console.log('[SSE-SERVER]', 'error', 'Agents fetch error', { error: (err as Error).message });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents: [] }));
    }
  },
};

// Named export kullanılıyor: export { OpenCodeSSEServer }
