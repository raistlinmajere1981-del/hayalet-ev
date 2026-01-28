/**
 * SSE Connection & Network
 */

export function setupSSEConnection(context: any) {
  return {
    async connect() {
      context._updateStatus('connecting', 'Bağlanıyor...');

      (window as any).SSEClient.on('connection', (data: any) => context._handleConnectionChange(data));

      (window as any).SSEClient.on('session.started', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('session.started', { ...d.data, sessionId: d.sessionId });
        context._handleSessionStarted(d);
      });
      (window as any).SSEClient.on('session.stopped', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('session.stopped', { ...d.data, sessionId: d.sessionId });
        context._handleSessionStopped(d);
      });

      (window as any).SSEClient.on('message.start', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('message.start', { ...d.data, sessionId: d.sessionId });
      });
      (window as any).SSEClient.on('message.created', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('message.created', { ...d.data, sessionId: d.sessionId });
      });
      (window as any).SSEClient.on('message.delta', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('message.delta', { ...d.data, sessionId: d.sessionId });
        context._updateStatus('processing', 'İşleniyor...');
        (window as any).PromptHandler.setProcessing(true);
      });
      (window as any).SSEClient.on('message.end', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('message.end', { ...d.data, sessionId: d.sessionId });
        context._updateStatus('connected', 'Bağlı');
        (window as any).PromptHandler.setProcessing(false);
        (window as any).PromptHandler.focus();
      });
      (window as any).SSEClient.on('message.completed', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('message.completed', { ...d.data, sessionId: d.sessionId });
        context._updateStatus('connected', 'Bağlı');
        (window as any).PromptHandler.setProcessing(false);
        (window as any).PromptHandler.focus();
      });

      (window as any).SSEClient.on('tool.start', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('tool.start', { ...d.data, sessionId: d.sessionId });
      });
      (window as any).SSEClient.on('tool.output', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('tool.output', { ...d.data, sessionId: d.sessionId });
      });
      (window as any).SSEClient.on('tool.end', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('tool.end', { ...d.data, sessionId: d.sessionId });
      });

      (window as any).SSEClient.on('permission.request', (data: any) => context._handlePermissionRequest(data));
      (window as any).SSEClient.on('question.ask', (data: any) => context._handleQuestion(data));

      (window as any).SSEClient.on('thinking.start', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('thinking.start', { ...d.data, sessionId: d.sessionId });
      });
      (window as any).SSEClient.on('thinking.delta', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('thinking.delta', { ...d.data, sessionId: d.sessionId });
      });
      (window as any).SSEClient.on('thinking.end', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        (window as any).StoreBridge.handleEvent('thinking.end', { ...d.data, sessionId: d.sessionId });
      });

      (window as any).SSEClient.on('session.updated', (data: any) => {
        const d = data as { data?: Record<string, unknown>; sessionId?: string };
        const sessionId = d.sessionId;
        const sessionData = d.data || {};

        console.log('[OpenCode] Session updated:', sessionId, sessionData);

        const hasAgent = (sessionData as any).agent !== undefined && (sessionData as any).agent !== null;
        const hasModel =
          (sessionData as any).provider !== undefined && (sessionData as any).model !== undefined;

        if (sessionId && (hasAgent || hasModel)) {
          const updateInfo: any = {};
          if (hasAgent) updateInfo.agent = (sessionData as any).agent;
          if (hasModel) {
            updateInfo.provider = (sessionData as any).provider;
            updateInfo.model = (sessionData as any).model;
          }

          window.SessionStore?.updateSessionInfo?.(sessionId, updateInfo);

          if (typeof (window as any).AgentModelSelector !== 'undefined') {
            (window as any).AgentModelSelector.setFromSession(updateInfo);
          }

          context._updateTokenDisplay();
        }
      });

      (window as any).SSEClient.on('status.change', (data: any) => {
        const d = data as { data?: Record<string, unknown> };
        (window as any).StoreBridge.handleEvent('status.change', d.data);
        context._handleStatusChange(d);
      });
      (window as any).SSEClient.on('session.idle', (data: any) => {
        const d = data as { data?: Record<string, unknown> };
        (window as any).StoreBridge.handleEvent('session.idle', d.data);
        context._handleStatusChange({ data: { status: 'idle' } });
      });
      (window as any).SSEClient.on('session.completed', (data: any) => {
        const d = data as { data?: Record<string, unknown> };
        (window as any).StoreBridge.handleEvent('session.completed', d.data);
        context._handleStatusChange({ data: { status: 'idle' } });
      });

      (window as any).SSEClient.on('error', (data: any) => context._handleError(data));

      const connected = await (window as any).SSEClient.connect(context._getServerUrl());

      if (connected) {
        context._updateStatus('connected', 'SSE Bağlı');
        await context._connectToOpenCode();
      } else {
        context._updateStatus('error', 'Bağlantı hatası');
      }
    },

    async connectToOpenCode() {
      context._updateStatus('connecting', "OpenCode'a bağlanıyor...");

      try {
        const result = await (window as any).APIClient.connect();

        if (result.success) {
          context._updateStatus('connected', 'Hazır');
          (window as any).PromptHandler.focus();
          console.log('[OpenCode] Connected to OpenCode, session:', result.sessionId);
        } else {
          context._updateStatus('warning', 'OpenCode bağlantısı bekleniyor');
          console.warn('[OpenCode] OpenCode connection failed:', result.error);
        }
      } catch (err) {
        context._updateStatus('warning', 'OpenCode bağlantısı bekleniyor');
        console.warn('[OpenCode] OpenCode connection error:', err);
      }
    },
  };
}
