/**
 * SSE Connection & Network
 */

import type { AppContext } from './types';

export function setupSSEConnection(context: AppContext) {
  return {
    async connect() {
      (context._updateStatus as any)?.('connecting', 'Bağlanıyor...');

      if (window.SSEClient && window.SSEClient.on) {
      window.SSEClient?.on?.('connection', (data: unknown) => (context._handleConnectionChange as any)?.(data));

      window.SSEClient?.on?.('session.started', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('session.started', { ...d.data, sessionId: d.sessionId });
        (context._handleSessionStarted as any)?.(d);
      });
      window.SSEClient?.on?.('session.stopped', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('session.stopped', { ...d.data, sessionId: d.sessionId });
        (context._handleSessionStopped as any)?.(d);
      });

      window.SSEClient?.on?.('message.start', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('message.start', { ...d.data, sessionId: d.sessionId });
      });
      window.SSEClient?.on?.('message.created', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('message.created', { ...d.data, sessionId: d.sessionId });
      });
      window.SSEClient?.on?.('message.delta', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('message.delta', { ...d.data, sessionId: d.sessionId });
        (context._updateStatus as any)?.('processing', 'İşleniyor...');
        (window.PromptHandler?.setProcessing as any)?.(true);
      });
      window.SSEClient?.on?.('message.end', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('message.end', { ...d.data, sessionId: d.sessionId });
        (context._updateStatus as any)?.('connected', 'Bağlı');
        (window.PromptHandler?.setProcessing as any)?.(false);
        (window.PromptHandler?.focus as any)?.();
      });
      window.SSEClient?.on?.('message.completed', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('message.completed', { ...d.data, sessionId: d.sessionId });
        (context._updateStatus as any)?.('connected', 'Bağlı');
        (window.PromptHandler?.setProcessing as any)?.(false);
        (window.PromptHandler?.focus as any)?.();
      });

      window.SSEClient?.on?.('tool.start', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('tool.start', { ...d.data, sessionId: d.sessionId });
      });
      window.SSEClient?.on?.('tool.output', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('tool.output', { ...d.data, sessionId: d.sessionId });
      });
      window.SSEClient?.on?.('tool.end', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('tool.end', { ...d.data, sessionId: d.sessionId });
      });

      window.SSEClient?.on?.('permission.request', (data: unknown) => (context._handlePermissionRequest as any)?.(data as any));
      window.SSEClient?.on?.('question.ask', (data: unknown) => (context._handleQuestion as any)?.(data as any));

      window.SSEClient?.on?.('thinking.start', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('thinking.start', { ...d.data, sessionId: d.sessionId });
      });
      window.SSEClient?.on?.('thinking.delta', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('thinking.delta', { ...d.data, sessionId: d.sessionId });
      });
      window.SSEClient?.on?.('thinking.end', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        window.StoreBridge?.handleEvent?.('thinking.end', { ...d.data, sessionId: d.sessionId });
      });

      window.SSEClient?.on?.('session.updated', (data: unknown) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        const sessionId = d.sessionId;
        const sessionData = d.data || {};

        console.log('[OpenCode] Session updated:', sessionId, sessionData);

        const hasAgent = (sessionData).agent !== undefined && (sessionData).agent !== null;
        const hasModel =
          (sessionData).provider !== undefined && (sessionData).model !== undefined;

        if (sessionId && (hasAgent || hasModel)) {
          const updateInfo: Record<string, unknown> = {};
          if (hasAgent) updateInfo.agent = (sessionData).agent;
          if (hasModel) {
            updateInfo.provider = (sessionData).provider;
            updateInfo.model = (sessionData).model;
          }

          window.SessionStore?.updateSessionInfo?.(sessionId, updateInfo);

          if (typeof window.AgentModelSelector !== 'undefined') {
            window.AgentModelSelector?.setFromSession?.(updateInfo);
          }

          (context._updateTokenDisplay as any)?.();
        }
      });

      window.SSEClient?.on?.('status.change', (data: unknown) => {
        const d = data as { data?: Record<string, unknown> };
        window.StoreBridge?.handleEvent?.('status.change', d.data);
        (context._handleStatusChange as any)?.(d);
      });
      window.SSEClient?.on?.('session.idle', (data: unknown) => {
        const d = data as { data?: Record<string, unknown> };
        window.StoreBridge?.handleEvent?.('session.idle', d.data);
        (context._handleStatusChange as any)?.({ data: { status: 'idle' } });
      });
      window.SSEClient?.on?.('session.completed', (data: unknown) => {
        const d = data as { data?: Record<string, unknown> };
        window.StoreBridge?.handleEvent?.('session.completed', d.data);
        (context._handleStatusChange as any)?.({ data: { status: 'idle' } });
      });

      window.SSEClient?.on?.('error', (data: unknown) => (context._handleError as any)?.(data));
      }

      const connected = await window.SSEClient?.connect?.();

      if (connected) {
        (context._updateStatus as any)?.('connected', 'SSE Bağlı');
        await (context._connectToOpenCode as any)?.();
      } else {
        (context._updateStatus as any)?.('error', 'Bağlantı hatası');
      }
    },

    async connectToOpenCode() {
      (context._updateStatus as any)?.('connecting', "OpenCode'a bağlanıyor...");

      try {
        const result = await window.APIClient?.connect?.();

        if (result?.success) {
          (context._updateStatus as any)?.('connected', 'Hazır');
          (window.PromptHandler?.focus as any)?.();
          console.log('[OpenCode] Connected to OpenCode, session:', result.sessionId);
        } else {
          (context._updateStatus as any)?.('warning', 'OpenCode bağlantısı bekleniyor');
          console.warn('[OpenCode] OpenCode connection failed:', result?.error);
        }
      } catch (err) {
        (context._updateStatus as any)?.('warning', 'OpenCode bağlantısı bekleniyor');
        console.warn('[OpenCode] OpenCode connection error:', err);
      }
    },
  };
}
