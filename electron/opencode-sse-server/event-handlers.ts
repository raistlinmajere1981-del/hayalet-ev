/**
 * OpenCode SSE Server - Event Handlers
 * 
 * OpenCode'dan gelen event'leri işler ve Native UI'a iletir
 */

import type { NativeUIEvent, SSEEvent, SSEEventType } from './types.ts';

/**
 * OpenCode'dan gelen event'leri işle ve Native UI'a ilet
 */
export function handleOpenCodeEvent(
  event: NativeUIEvent,
  state: {
    currentAssistantMessageId: string | null;
    currentAssistantContent: string;
    lastSentUserMessageId: string | null;
  },
  callbacks: {
    startMessageStream: (role: 'user' | 'assistant', messageId?: string) => string;
    appendMessageDelta: (messageId: string, delta: string) => void;
    endMessageStream: (messageId: string, fullContent: string) => void;
    startToolCall: (toolId: string, toolName: string, input?: Record<string, unknown>) => void;
    endToolCall: (toolId: string, status: 'success' | 'error', result?: string) => void;
    startStep: (stepId: string, messageId?: string) => void;
    finishStep: (stepId: string, usage: { inputTokens?: number; outputTokens?: number; cost?: number }, messageId?: string) => void;
    requestPermission: (data: { permissionId: string; toolName: string; description: string; risk: string }) => void;
    askQuestion: (data: { questionId: string; question: string; options?: Array<{ label: string; value: string }>; allowFreeform?: boolean }) => void;
    publish: (event: SSEEvent) => void;
    getCurrentSessionId: () => string | null;
  }
): void {
  console.log('[SSE-SERVER]', 'debug', 'OpenCode event alındı', { type: event.type });
  
  switch (event.type) {
    case 'message.created':
      break; // Ignored

    case 'message.part.updated': {
      const partObj = event.data.part as { type?: string; content?: string; text?: string } | undefined;
      const role = (event.data.role as 'user' | 'assistant') || 'assistant';
      const messageId = (event.data.messageId || event.data.id) as string;
      const fullContent = partObj?.content || partObj?.text || (event.data.fullContent as string) || (event.data.content as string) || '';
      const partType = partObj?.type || (event.data.partType as string) || (event.data.type as string) || 'text';
      
      console.log('[SSE-SERVER]', 'debug', 'message.part.updated received', { 
        messageId, 
        role, 
        partType,
        contentLength: fullContent?.length || 0,
      });

      if (role === 'user') {
        console.log('[SSE-SERVER]', 'debug', 'User message.part.updated skipped (role=user)', { messageId });
        break;
      }
      
      if (messageId === state.lastSentUserMessageId) {
        console.log('[SSE-SERVER]', 'debug', 'User message echo skipped (same messageId)', { messageId });
        break;
      }
      
      if (partType === 'step-finish') {
        const reason = (event.data.reason as string) || (partObj as Record<string, unknown>)?.reason as string;
        console.log('[SSE-SERVER]', 'debug', 'step-finish received', { messageId, reason, hasCurrentMsg: !!state.currentAssistantMessageId });
        
        if (reason === 'stop' && state.currentAssistantMessageId) {
          console.log('[SSE-SERVER]', 'info', 'Streaming tamamlandı (step-finish:stop)', { messageId: state.currentAssistantMessageId });
          callbacks.endMessageStream(state.currentAssistantMessageId, state.currentAssistantContent);
          state.currentAssistantMessageId = null;
          state.currentAssistantContent = '';
        }
        break;
      }
      
      if (partType !== 'text' && partType !== 'thinking') {
        console.log('[SSE-SERVER]', 'debug', 'Non-text part skipped', { partType, messageId });
        break;
      }
      
      if (!fullContent || fullContent.trim() === '') {
        break;
      }
      
      if (!state.currentAssistantMessageId) {
        state.currentAssistantMessageId = messageId || `msg-${Date.now()}`;
        state.currentAssistantContent = '';
        callbacks.startMessageStream('assistant', state.currentAssistantMessageId);
      } else if (messageId && messageId !== state.currentAssistantMessageId) {
        callbacks.endMessageStream(state.currentAssistantMessageId, state.currentAssistantContent);
        state.currentAssistantMessageId = messageId;
        state.currentAssistantContent = '';
        callbacks.startMessageStream('assistant', state.currentAssistantMessageId);
      }
      
      let actualDelta = fullContent;
      if (fullContent.startsWith(state.currentAssistantContent)) {
        actualDelta = fullContent.slice(state.currentAssistantContent.length);
      }
      
      if (actualDelta) {
        state.currentAssistantContent = fullContent;
        callbacks.appendMessageDelta(state.currentAssistantMessageId, actualDelta);
      }
      break;
    }

    case 'message.updated': {
      console.log('[SSE-SERVER]', 'debug', 'message.updated RAW DATA', {
        dataKeys: Object.keys(event.data || {}),
      });
      
      const updatedMessageId = (event.data.messageId || event.data.id) as string;
      const updatedContent = (event.data.content || event.data.text || event.data.fullContent) as string;
      const updatedRole = (event.data.role as string) || 'assistant';
      
      if (updatedRole === 'user') {
        break;
      }
      
      if (!updatedContent) {
        break;
      }
      
      if (!state.currentAssistantMessageId && updatedMessageId) {
        state.currentAssistantMessageId = updatedMessageId;
        state.currentAssistantContent = '';
        callbacks.startMessageStream('assistant', updatedMessageId);
      }
      
      let delta = updatedContent;
      if (updatedContent.startsWith(state.currentAssistantContent)) {
        delta = updatedContent.slice(state.currentAssistantContent.length);
      }
      
      if (delta) {
        state.currentAssistantContent = updatedContent;
        callbacks.appendMessageDelta(state.currentAssistantMessageId!, delta);
      }
      break;
    }

    case 'message.delta': {
      const deltaContent = (event.data.delta || event.data.content || event.data.fullContent || event.data.text) as string;
      const deltaRole = event.data.role as string;
      const deltaMessageId = (event.data.messageId || event.data.id) as string;
      
      if (deltaRole === 'user') {
        break;
      }
      
      if (deltaContent) {
        if (!state.currentAssistantMessageId) {
          state.currentAssistantMessageId = deltaMessageId || `msg-${Date.now()}`;
          state.currentAssistantContent = '';
          callbacks.startMessageStream('assistant', state.currentAssistantMessageId);
        }
        
        state.currentAssistantContent += deltaContent;
        callbacks.appendMessageDelta(state.currentAssistantMessageId, deltaContent);
      }
      break;
    }

    case 'message.completed': {
      const role = (event.data.role as 'user' | 'assistant') || 'assistant';
      
      if (role === 'user') {
        break;
      }
      
      if (state.currentAssistantMessageId) {
        const finalContent = (event.data.content as string) || state.currentAssistantContent;
        callbacks.endMessageStream(state.currentAssistantMessageId, finalContent);
        state.currentAssistantMessageId = null;
        state.currentAssistantContent = '';
      }
      break;
    }

    case 'message.removed':
      callbacks.publish({
        type: 'message.removed',
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: event.data,
      });
      break;

    case 'message.part.removed':
      callbacks.publish({
        type: 'message.part.removed',
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: event.data,
      });
      break;

    case 'tool.start':
      callbacks.startToolCall(
        event.data.toolId as string,
        event.data.toolName as string,
        event.data.toolInput as Record<string, unknown>
      );
      break;

    case 'tool.end':
      callbacks.endToolCall(
        event.data.toolId as string,
        event.data.isError ? 'error' : 'success',
        event.data.output as string
      );
      break;

    case 'permission.request':
    case 'permission.updated':
    case 'permission.asked':
      callbacks.requestPermission({
        permissionId: (event.data.permissionId || event.data.id) as string,
        toolName: event.data.toolName as string,
        description: (event.data.message || event.data.description || `Tool "${event.data.toolName}" izin istiyor`) as string,
        risk: 'medium',
      });
      break;

    case 'permission.resolved':
    case 'permission.replied':
      callbacks.publish({
        type: 'permission.resolved',
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: event.data,
      });
      break;

    case 'question.ask':
    case 'question.asked':
      callbacks.askQuestion({
        questionId: (event.data.questionId || event.data.id) as string,
        question: (event.data.question || event.data.text) as string,
        options: event.data.options as Array<{ label: string; value: string }>,
        allowFreeform: true,
      });
      break;

    case 'question.answered':
    case 'question.replied':
    case 'question.rejected':
      callbacks.publish({
        type: 'status.change',
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: { status: 'question_answered', ...event.data },
      });
      break;

    case 'thinking.start':
    case 'thinking.delta':
    case 'thinking.end':
      callbacks.publish({
        type: event.type as SSEEventType,
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: {
          ...event.data,
          messageId: state.currentAssistantMessageId || `thinking-${Date.now()}`,
        },
      });
      break;

    case 'step.start':
      callbacks.startStep(
        (event.data.stepId as string) || `step-${Date.now()}`,
        (event.data.messageId as string) || state.currentAssistantMessageId || undefined
      );
      break;

    case 'step.finish':
      callbacks.finishStep(
        (event.data.stepId as string) || `step-${Date.now()}`,
        {
          inputTokens: (event.data.inputTokens as number) || 0,
          outputTokens: (event.data.outputTokens as number) || 0,
          cost: (event.data.cost as number) || 0,
        },
        (event.data.messageId as string) || state.currentAssistantMessageId || undefined
      );
      break;

    case 'session.updated':
      callbacks.publish({
        type: 'session.updated',
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: event.data,
      });
      break;

    case 'session.compacted':
      callbacks.publish({
        type: 'session.compacted',
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: event.data,
      });
      break;

    case 'session.error':
      callbacks.publish({
        type: 'session.error',
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: event.data,
      });
      break;

    case 'status.change': {
      const status = event.data.status;
      const statusType = typeof status === 'object' && status !== null ? (status as { type?: string }).type : status;
      
      if (statusType === 'idle') {
        if (state.currentAssistantMessageId && state.currentAssistantContent) {
          console.log('[SSE-SERVER]', 'debug', 'status.change:idle ignored - active streaming', {
            messageId: state.currentAssistantMessageId,
            contentLength: state.currentAssistantContent.length
          });
          break;
        }
      }
      
      callbacks.publish({
        type: 'status.change',
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: { status: statusType },
      });
      break;
    }

    case 'error':
      callbacks.publish({
        type: 'session.error',
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: event.data,
      });
      break;

    default:
      callbacks.publish({
        type: event.type as SSEEventType,
        timestamp: event.timestamp,
        sessionId: callbacks.getCurrentSessionId(),
        data: event.data,
      });
  }
}
