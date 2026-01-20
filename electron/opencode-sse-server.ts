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
  | 'question.ask'
  | 'question.asked'       // CodeNomad
  | 'question.replied'     // CodeNomad
  | 'thinking.start'
  | 'thinking.delta'
  | 'thinking.end'
  | 'status.change'
  | 'error'
  | 'heartbeat';

/** SSE Event payload */
export interface SSEEvent {
  type: SSEEventType;
  timestamp: number;
  sessionId?: string;
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

/** Session state */
export interface SessionState {
  id: string;
  status: 'idle' | 'processing' | 'waiting' | 'error';
  startedAt: number;
  lastActivity: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  pendingPermission?: PermissionEventData;
  pendingQuestion?: QuestionEventData;
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
  _session: null as SessionState | null,
  _openCodeConnected: false,
  _lastSentUserMessageId: null as string | null,  // Son gönderilen user mesajı ID'si (echo filtreleme için)
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
  async start(config: Partial<SSEServerConfig> = {}): Promise<{ success: boolean; url?: string; error?: string }> {
    if (this._server) {
      return { success: true, url: this._getServerUrl(), };
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
          resolve({ success: true, url: this._getServerUrl() });
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
   * Session state'ini al
   */
  getSession(): SessionState | null {
    return this._session;
  },

  /**
   * Yeni session başlat
   */
  startSession(): SessionState {
    this._session = {
      id: `session-${Date.now()}`,
      status: 'idle',
      startedAt: Date.now(),
      lastActivity: Date.now(),
      messages: [],
    };

    this.publish({
      type: 'session.started',
      timestamp: Date.now(),
      sessionId: this._session.id,
      data: { session: this._session },
    });

    return this._session;
  },

  /**
   * Session'ı sonlandır
   */
  endSession(): void {
    if (this._session) {
      this.publish({
        type: 'session.stopped',
        timestamp: Date.now(),
        sessionId: this._session.id,
      });
      this._session = null;
    }
  },

  /**
   * Mesaj ekle
   */
  addMessage(role: 'user' | 'assistant', content: string): void {
    if (!this._session) {
      this.startSession();
    }

    const messageId = `msg-${Date.now()}`;
    
    this._session!.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
    this._session!.lastActivity = Date.now();

    this.publish({
      type: 'message.end',
      timestamp: Date.now(),
      sessionId: this._session!.id,
      data: { role, content, messageId },
    });
  },

  /**
   * Streaming mesaj başlat
   */
  startMessageStream(role: 'user' | 'assistant', messageId?: string): string {
    const id = messageId || `msg-${Date.now()}`;
    
    if (this._session) {
      this._session.status = 'processing';
    }

    this.publish({
      type: 'message.start',
      timestamp: Date.now(),
      sessionId: this._session?.id,
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
      sessionId: this._session?.id,
      data: { messageId, delta },
    });
  },

  /**
   * Streaming mesaj bitir
   */
  endMessageStream(messageId: string, fullContent: string): void {
    if (this._session) {
      this._session.status = 'idle';
      this._session.messages.push({
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      });
    }

    this.publish({
      type: 'message.end',
      timestamp: Date.now(),
      sessionId: this._session?.id,
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
      sessionId: this._session?.id,
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
      sessionId: this._session?.id,
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
      sessionId: this._session?.id,
      data: { toolId, status, output: result },
    });
  },

  /**
   * Permission request gönder
   */
  requestPermission(data: PermissionEventData): void {
    if (this._session) {
      this._session.status = 'waiting';
      this._session.pendingPermission = data;
    }

    this.publish({
      type: 'permission.request',
      timestamp: Date.now(),
      sessionId: this._session?.id,
      data,
    });
  },

  /**
   * Question gönder
   */
  askQuestion(data: QuestionEventData): void {
    if (this._session) {
      this._session.status = 'waiting';
      this._session.pendingQuestion = data;
    }

    this.publish({
      type: 'question.ask',
      timestamp: Date.now(),
      sessionId: this._session?.id,
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
  async connectToOpenCode(): Promise<{ success: boolean; error?: string; sessionId?: string }> {
    if (this._openCodeConnected) {
      console.log('[SSE-SERVER]', 'debug', 'OpenCode zaten bağlı');
      return { success: true, sessionId: this._session?.id };
    }
    
    if (this._openCodeConnecting) {
      console.log('[SSE-SERVER]', 'debug', 'OpenCode bağlantısı zaten devam ediyor');
      return { success: true };
    }
    
    this._openCodeConnecting = true;

    try {
      // OpenCode server çalışıyor mu kontrol et
      const status = OpenCodeManager.getStatus();
      if (!status.running) {
        return { success: false, error: 'OpenCode server çalışmıyor' };
      }

      // Session oluştur veya mevcut session'a bağlan
      const sessionResult = await OpenCodeManager.createOrGetSession();
      if (!sessionResult.success) {
        return { success: false, error: sessionResult.error || 'Session oluşturulamadı' };
      }

      // Local session'ı güncelle
      if (sessionResult.data) {
        this._session = {
          id: sessionResult.data.id,
          status: 'idle',
          startedAt: sessionResult.data.createdAt || Date.now(),
          lastActivity: sessionResult.data.updatedAt || Date.now(),
          messages: [],
        };
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
        sessionId: this._session?.id,
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
      sessionId: this._session?.id,
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
        

        // User mesajlarını atla (role veya messageId ile)
        if (role === 'user') {
          console.log('[SSE-SERVER]', 'debug', 'User message.part.updated skipped (role)', { messageId });
          break;
        }
        
        // Echo filtreleme: Bizim gönderdiğimiz user mesajını atla
        if (messageId && messageId === this._lastSentUserMessageId) {
          console.log('[SSE-SERVER]', 'debug', 'User message.part.updated skipped (echo filter)', { messageId });
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
          sessionId: this._session?.id,
          data: event.data,
        });
        break;

      // Message part removed (CodeNomad)
      case 'message.part.removed':
        this.publish({
          type: 'message.part.removed',
          timestamp: event.timestamp,
          sessionId: this._session?.id,
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
        if (this._session) {
          this._session.status = 'processing';
          this._session.pendingPermission = undefined;
        }
        this.publish({
          type: 'permission.resolved',
          timestamp: event.timestamp,
          sessionId: this._session?.id,
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
        if (this._session) {
          this._session.status = 'processing';
          this._session.pendingQuestion = undefined;
        }
        this.publish({
          type: 'status.change',
          timestamp: event.timestamp,
          sessionId: this._session?.id,
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
          sessionId: this._session?.id,
          data: {
            ...event.data,
            messageId: this._currentAssistantMessageId || `thinking-${Date.now()}`,
          },
        });
        break;

      // =========================================
      // Session Events (CodeNomad: session.idle, session.status, session.compacted, session.error)
      // =========================================
      case 'session.updated':
        if (this._session && event.data.status) {
          this._session.status = this._mapOpenCodeStatus(event.data.status as string);
        }
        this.publish({
          type: 'session.updated',
          timestamp: event.timestamp,
          sessionId: this._session?.id,
          data: event.data,
        });
        break;

      case 'session.compacted':
        this.publish({
          type: 'session.compacted',
          timestamp: event.timestamp,
          sessionId: this._session?.id,
          data: event.data,
        });
        break;

      case 'session.error':
        this.publish({
          type: 'session.error',
          timestamp: event.timestamp,
          sessionId: this._session?.id,
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
        
        if (this._session) {
          this._session.status = this._mapOpenCodeStatus(statusType as string);
        }
        
        this.publish({
          type: 'status.change',
          timestamp: event.timestamp,
          sessionId: this._session?.id,
          data: { status: statusType },
        });
        break;
      }

      case 'error':
        this.publish({
          type: 'session.error',
          timestamp: event.timestamp,
          sessionId: this._session?.id,
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
          sessionId: this._session?.id,
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

    // Send current session state if exists
    if (this._session) {
      const sessionEvent: SSEEvent = {
        type: 'session.started',
        timestamp: Date.now(),
        sessionId: this._session.id,
        data: { session: this._session },
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
    res.end(JSON.stringify({ session: this._session }));
  },

  async _handleSendMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this._readBody(req);
      const { message, messageId: clientMessageId } = JSON.parse(body);

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

      // OpenCode'a mesajı ilet (client-side messageId varsa kullan)
      const result = await OpenCodeManager.sendMessage(message, undefined, clientMessageId);
      
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

      // Streaming response başlat (assistant mesajı için)
      this.startMessageStream('assistant', result.data?.messageId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        sessionId: this._session?.id,
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

      if (this._session) {
        this._session.status = 'processing';
        this._session.pendingPermission = undefined;
      }

      // Permission resolved event yayınla
      this.publish({
        type: 'status.change',
        timestamp: Date.now(),
        sessionId: this._session?.id,
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

      // TODO: OpenCode'da question response API'si eklenince burayı güncelle
      // Şimdilik sadece local state'i güncelle
      console.log('[SSE-SERVER]', 'info', 'Question yanıtı alındı', { questionId, answer });

      if (this._session) {
        this._session.status = 'processing';
        this._session.pendingQuestion = undefined;
      }

      // Question answered event yayınla
      this.publish({
        type: 'status.change',
        timestamp: Date.now(),
        sessionId: this._session?.id,
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
          sessionId: this._session?.id,
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
        if (this._session) {
          this._session.status = 'idle';
        }
        
        this.publish({
          type: 'status.change',
          timestamp: Date.now(),
          sessionId: this._session?.id,
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
};

export default OpenCodeSSEServer;
