/**
 * Store Bridge - Event Handlers
 * 
 * Handles all SSE event types: message, tool, thinking, session, permission, question, step
 */

import type { MessageRecord } from '../message';
import type { SessionStatus, PartUpdateInput, PermissionEntry, QuestionEntry } from '../message/types';

// ============================================================================
// Store Interface Types
// ============================================================================

import type { MessageUpsertInput } from '../message/types';

interface MessageStoreAPI {
  hasMessage?: (messageId: string) => boolean;
  getMessage?: (messageId: string) => MessageRecord | null;
  upsertMessage?: (data: MessageUpsertInput) => MessageRecord;
  updateTextPart?: (messageId: string, content: string, isDelta: boolean) => void;
  updateMessageStatus?: (messageId: string, status: string) => void;
  addOrUpdatePart?: (data: PartUpdateInput) => void;
  upsertPermission?: (data: PermissionEntry) => void;
  removePermission?: (permissionId: string) => void;
  getPermissionQueue?: () => unknown[];
  upsertQuestion?: (data: QuestionEntry) => void;
  removeQuestion?: (questionId: string) => void;
  getQuestionQueue?: () => unknown[];
}

interface SessionStoreAPI {
  getCurrentSessionId?: () => string | null;
  updateStatus?: (status: SessionStatus) => void;
  setCurrentSession?: (sessionId: string) => void;
  upsertSession?: (sessionId: string, data: Record<string, unknown>) => void;
  updateSessionUsage?: (sessionId: string, usage: Record<string, unknown>) => void;
  updateSessionInfo?: (sessionId: string, info: Record<string, unknown>) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface InstanceStoreAPI {
  // Currently unused in handlers
}

interface PartNormalizerAPI {
  decodeHtml?: (html: string) => string;
}

interface ToolRendererAPI {
  addDiffViewer?: (toolId: string, diffData: Record<string, unknown>) => void;
}

interface EventHandlerDeps {
  MessageStore: MessageStoreAPI;
  SessionStore: SessionStoreAPI;
  InstanceStore: InstanceStoreAPI;
  PartNormalizer: PartNormalizerAPI;
  ToolRenderer: ToolRendererAPI;
  currentMessageId: string | null;
  debug: boolean;
}

export function createEventHandlers(deps: EventHandlerDeps) {
  return {
    handleMessageDelta(data: Record<string, unknown>) {
      const { MessageStore, SessionStore, PartNormalizer } = deps;
      const messageId = data?.messageId as string | undefined;
      const role = data?.role as string | undefined;
      const fullContent = data?.content as string | undefined;
      const delta = data?.delta as string | undefined;

      if (!messageId) return;
      if (role === 'user') return; // Skip user echoes

      const contentToCheck = fullContent || delta;
      if (!contentToCheck) return;

      const sessionId = (data.sessionId as string | undefined) || SessionStore?.getCurrentSessionId?.() || 'default';

      // Create message if not exists
      if (!MessageStore?.hasMessage?.(messageId)) {
        MessageStore?.upsertMessage?.({
          id: messageId,
          sessionId,
          role: (role as 'user' | 'assistant' | 'system') || 'assistant',
          status: 'streaming',
          isEphemeral: true,
        });
        deps.currentMessageId = messageId;
        SessionStore?.updateStatus?.('processing');
      }

      // Update content with HTML normalization
      if (fullContent !== undefined) {
        const normalized = PartNormalizer?.decodeHtml?.(fullContent) ?? fullContent;
        MessageStore?.updateTextPart?.(messageId, normalized, false);
      } else if (delta) {
        const normalized = PartNormalizer?.decodeHtml?.(delta) ?? delta;
        MessageStore?.updateTextPart?.(messageId, normalized, true);
      }
    },

    handleMessageStart(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const messageId = data?.messageId as string | undefined;
      const role = data?.role as string | undefined;

      if (!messageId || role === 'user') return;

      deps.currentMessageId = messageId;
      SessionStore?.updateStatus?.('processing');
    },

    handleMessageCompleted(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const messageId = data?.messageId as string | undefined;
      const content = data?.content as string | undefined;
      const role = data?.role as string | undefined;

      const targetId = messageId || deps.currentMessageId;

      if (targetId && MessageStore?.hasMessage?.(targetId)) {
        if (content) {
          MessageStore?.updateTextPart?.(targetId, content, false);
        }
        MessageStore?.updateMessageStatus?.(targetId, 'complete');
      } else if (content) {
        const sessionId = SessionStore?.getCurrentSessionId?.() || 'default';
        MessageStore?.upsertMessage?.({
          id: `msg-${Date.now()}`,
          sessionId,
          role: (role as 'user' | 'assistant' | 'system') || 'assistant',
          status: 'complete',
          parts: [{ type: 'text', text: content }],
        });
      }

      deps.currentMessageId = null;
      SessionStore?.updateStatus?.('idle');
    },

    // Tool Handlers
    handleToolStart(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const toolId = data?.toolId as string | undefined;
      const toolName = data?.toolName as string | undefined;
      const input = data?.input;
      const messageId = data?.messageId as string | undefined;

      if (!toolId) {
        console.warn('[StoreBridge] tool.start missing toolId');
        return;
      }

      const targetMessageId = messageId || deps.currentMessageId;
      const effectiveTargetId = targetMessageId || `msg-${Date.now()}`;

      // Ensure message exists
      if (!MessageStore?.hasMessage?.(effectiveTargetId)) {
        const sessionId = (data.sessionId as string | undefined) || SessionStore?.getCurrentSessionId?.() || 'default';
        MessageStore?.upsertMessage?.({
          id: effectiveTargetId,
          sessionId,
          role: 'assistant',
          status: 'streaming',
        });
      }

      MessageStore?.addOrUpdatePart?.({
        messageId: effectiveTargetId,
        partId: `tool-${toolId}`,
        type: 'tool',
        toolCall: {
          toolId,
          toolName: toolName || 'unknown',
          status: 'running',
          input,
          startedAt: Date.now(),
        },
      });
    },

    handleToolOutput(data: Record<string, unknown>) {
      const { MessageStore, PartNormalizer } = deps;
      const toolId = data?.toolId as string | undefined;
      const output = data?.output as string | undefined;
      const messageId = data?.messageId as string | undefined;

      const targetMessageId = messageId || deps.currentMessageId;
      if (!targetMessageId || !toolId) return;

      const message = MessageStore?.getMessage?.(targetMessageId);
      if (!message) return;

      const partId = `tool-${toolId}`;
      const existingPart = (message.parts as Record<string, unknown>)[partId] as Record<string, any> | undefined;

      if (existingPart?.toolCall) {
        const currentOutput = existingPart.toolCall.output || '';
        const normalizedOutput = PartNormalizer?.decodeHtml?.(output ?? '') ?? output ?? '';
        MessageStore?.addOrUpdatePart?.({
          messageId: targetMessageId,
          partId,
          type: 'tool',
          toolCall: {
            ...existingPart.toolCall,
            output: currentOutput + normalizedOutput,
          },
        });
      }
    },

    handleToolEnd(data: Record<string, unknown>) {
      const { MessageStore, ToolRenderer } = deps;
      const toolId = data?.toolId as string | undefined;
      const status = data?.status as string | undefined;
      const output = data?.output as string | undefined;
      const messageId = data?.messageId as string | undefined;
      const diff = data?.diff;
      const filePath = data?.filePath as string | undefined;

      if (!toolId) return;

      const targetMessageId = messageId || deps.currentMessageId;
      if (!targetMessageId) return;

      const message = MessageStore?.getMessage?.(targetMessageId);
      if (!message) return;

      const partId = `tool-${toolId}`;
      const existingPart = (message.parts as Record<string, unknown>)[partId] as Record<string, any> | undefined;

      if (existingPart?.toolCall) {
        const toolCall = existingPart.toolCall;
        const toolName = (toolCall.toolName || '').toLowerCase();

        MessageStore?.addOrUpdatePart?.({
          messageId: targetMessageId,
          partId,
          type: 'tool',
          toolCall: {
            ...toolCall,
            status: status === 'error' ? 'error' : 'success',
            output: output ?? toolCall.output,
            completedAt: Date.now(),
          },
        });

        // Add diff viewer for write tools
        const isWriteTool = ['write', 'file_write', 'writefile', 'edit'].includes(toolName);
        const hasDiffData = diff || (output && (output.includes('@@') || output.includes('+++') || output.includes('---')));

        if (isWriteTool && hasDiffData && ToolRenderer?.addDiffViewer) {
          const filename = filePath || (toolCall.input as Record<string, unknown>)?.file_path || (toolCall.input as Record<string, unknown>)?.path || 'unknown';
          const diffData = diff as Record<string, any> | undefined;
          ToolRenderer.addDiffViewer(toolId, {
            filename,
            oldContent: diffData?.oldContent || '',
            newContent: diffData?.newContent || '',
            unifiedDiff: diffData?.unifiedDiff || output,
          });
        }
      }
    },

    // Thinking Handlers
    handleThinkingStart(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const messageId = data?.messageId as string | undefined;

      const targetMessageId = messageId || deps.currentMessageId;
      if (!targetMessageId) return;

      if (!MessageStore?.hasMessage?.(targetMessageId)) {
        const sessionId = SessionStore?.getCurrentSessionId?.() || 'default';
        MessageStore?.upsertMessage?.({
          id: targetMessageId,
          sessionId,
          role: 'assistant',
          status: 'streaming',
        });
      }

      MessageStore?.addOrUpdatePart?.({
        messageId: targetMessageId,
        type: 'thinking',
        thinking: { content: '', isComplete: false },
      });
    },

    handleThinkingDelta(data: Record<string, unknown>) {
      const { MessageStore, PartNormalizer } = deps;
      const content = data?.content as string | undefined;
      const messageId = data?.messageId as string | undefined;

      const targetMessageId = messageId || deps.currentMessageId;
      if (!targetMessageId || !content) return;

      const message = MessageStore?.getMessage?.(targetMessageId);
      if (!message) return;

      const thinkingPartId = (message.partIds as string[]).find(
        (id: string) => ((message.parts as Record<string, unknown>)[id] as Record<string, any>)?.type === 'thinking'
      );
      const existingPart = thinkingPartId ? (message.parts as Record<string, unknown>)[thinkingPartId] as Record<string, any> : null;
      const currentContent = existingPart?.thinking?.content || '';
      const normalizedContent = PartNormalizer?.decodeHtml?.(content) ?? content;

      MessageStore?.addOrUpdatePart?.({
        messageId: targetMessageId,
        partId: thinkingPartId,
        type: 'thinking',
        thinking: { content: currentContent + normalizedContent, isComplete: false },
      });
    },

    handleThinkingEnd(data: Record<string, unknown>) {
      const { MessageStore } = deps;
      const messageId = data?.messageId as string | undefined;

      const targetMessageId = messageId || deps.currentMessageId;
      if (!targetMessageId) return;

      const message = MessageStore?.getMessage?.(targetMessageId);
      if (!message) return;

      const thinkingPartId = (message.partIds as string[]).find(
        (id: string) => ((message.parts as Record<string, unknown>)[id] as Record<string, any>)?.type === 'thinking'
      );

      if (thinkingPartId) {
        const existingPart = (message.parts as Record<string, unknown>)[thinkingPartId] as Record<string, any>;
        MessageStore?.addOrUpdatePart?.({
          messageId: targetMessageId,
          partId: thinkingPartId,
          type: 'thinking',
          thinking: { content: existingPart?.thinking?.content || '', isComplete: true },
        });
      }
    },

    // Session Handlers
    handleSessionStarted(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const session = (data?.session || {}) as Record<string, any>;
      const sessionId = session.id || data?.sessionId;

      if (!sessionId) {
        console.warn('[StoreBridge] session.started without sessionId');
        return;
      }

      SessionStore?.setCurrentSession?.(sessionId);
      SessionStore?.upsertSession?.(sessionId, {
        title: session.title || `Session ${sessionId.substring(0, 8)}`,
      });

      if (session.messages && Array.isArray(session.messages)) {
        session.messages.forEach((msg: Record<string, unknown>) => {
          MessageStore?.upsertMessage?.({
            id: (msg.id as string) || `msg-${msg.timestamp}`,
            sessionId,
            role: (msg.role as 'user' | 'assistant' | 'system') || 'assistant',
            status: 'complete',
            parts: [{ type: 'text', text: msg.content as string }],
            createdAt: msg.timestamp as number | undefined,
          });
        });
      }

      SessionStore?.updateStatus?.('idle');
    },

    handleSessionIdle(_data: Record<string, unknown>) {
      const { SessionStore } = deps;
      deps.currentMessageId = null;
      SessionStore?.updateStatus?.('idle');
    },

    handleStatusChange(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const status = data?.status as string | undefined;

      switch (status) {
        case 'idle':
        case 'connected':
        case 'opencode_connected':
          if (deps.currentMessageId) {
            const msg = MessageStore?.getMessage?.(deps.currentMessageId);
            if (msg?.status === 'streaming') return;
          }
          SessionStore?.updateStatus?.('idle');
          break;
        case 'processing':
          SessionStore?.updateStatus?.('processing');
          break;
        case 'waiting_permission':
        case 'waiting_answer':
          SessionStore?.updateStatus?.('waiting');
          break;
        case 'cancelled':
          deps.currentMessageId = null;
          SessionStore?.updateStatus?.('idle');
          break;
      }
    },

    // Permission Handlers
    handlePermissionRequested(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const permission = data?.permission as Record<string, any> | undefined;
      const messageId = data?.messageId as string | undefined;
      const toolCallId = data?.toolCallId as string | undefined;

      if (!permission?.id) return;

      const targetMessageId = messageId || deps.currentMessageId;
      const partId = toolCallId ? `tool-${toolCallId}` : undefined;

      MessageStore?.upsertPermission?.({
        id: permission.id,
        messageId: targetMessageId ?? undefined,
        partId,
        permission: {
          id: permission.id,
          type: permission.type || 'unknown',
          title: permission.title || 'Permission Required',
          description: permission.description || '',
          metadata: permission.metadata || {},
          risk: permission.risk || 'medium',
        },
      });

      SessionStore?.updateStatus?.('waiting');
    },

    handlePermissionResolved(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const permissionId = data?.permissionId as string | undefined;

      if (!permissionId) return;

      MessageStore?.removePermission?.(permissionId);

      if (MessageStore?.getPermissionQueue?.().length === 0 && MessageStore?.getQuestionQueue?.().length === 0) {
        SessionStore?.updateStatus?.('processing');
      }
    },

    // Question Handlers
    handleQuestionRequested(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const question = data?.question as Record<string, any> | undefined;
      const messageId = data?.messageId as string | undefined;

      if (!question?.id) return;

      const targetMessageId = messageId || deps.currentMessageId;

      MessageStore?.upsertQuestion?.({
        id: question.id,
        messageId: targetMessageId ?? undefined,
        question: {
          id: question.id,
          text: question.text || question.question || '',
          type: question.type || 'text',
          options: question.options || [],
          default: question.default,
        },
      });

      SessionStore?.updateStatus?.('waiting');
    },

    handleQuestionAnswered(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const questionId = data?.questionId as string | undefined;

      if (!questionId) return;

      MessageStore?.removeQuestion?.(questionId);

      if (MessageStore?.getPermissionQueue?.().length === 0 && MessageStore?.getQuestionQueue?.().length === 0) {
        SessionStore?.updateStatus?.('processing');
      }
    },

    // Step Handlers
    handleStepStart(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const stepId = data?.stepId as string | undefined;
      const messageId = data?.messageId as string | undefined;

      const targetMessageId = messageId || deps.currentMessageId;
      if (!targetMessageId) return;

      if (!MessageStore?.hasMessage?.(targetMessageId)) {
        const sessionId = SessionStore?.getCurrentSessionId?.() || 'default';
        MessageStore?.upsertMessage?.({
          id: targetMessageId,
          sessionId,
          role: 'assistant',
          status: 'streaming',
        });
      }

      MessageStore?.addOrUpdatePart?.({
        messageId: targetMessageId,
        partId: `step-${stepId || Date.now()}`,
        type: 'step',
        step: {
          stepId: stepId || `step-${Date.now()}`,
          status: 'start',
          startedAt: Date.now(),
        },
      });
    },

    handleStepFinish(data: Record<string, unknown>) {
      const { MessageStore, SessionStore } = deps;
      const stepId = data?.stepId as string | undefined;
      const messageId = data?.messageId as string | undefined;
      const inputTokens = data?.inputTokens as number | undefined;
      const outputTokens = data?.outputTokens as number | undefined;
      const cost = data?.cost as number | undefined;

      const targetMessageId = messageId || deps.currentMessageId;
      if (!targetMessageId) return;

      const message = MessageStore?.getMessage?.(targetMessageId);
      if (!message) return;

      const stepPartId = (message.partIds as string[]).find(
        (id: string) => ((message.parts as Record<string, unknown>)[id] as Record<string, any>)?.step?.stepId === stepId
      ) || `step-${stepId}`;

      const existingPart = (message.parts as Record<string, unknown>)[stepPartId] as Record<string, any> | undefined;

      MessageStore?.addOrUpdatePart?.({
        messageId: targetMessageId,
        partId: stepPartId,
        type: 'step',
        step: {
          stepId: stepId || existingPart?.step?.stepId,
          status: 'finish',
          startedAt: existingPart?.step?.startedAt,
          finishedAt: Date.now(),
          inputTokens: inputTokens || 0,
          outputTokens: outputTokens || 0,
          cost: cost || 0,
        },
      });

      if (inputTokens || outputTokens || cost) {
        SessionStore?.updateSessionUsage?.(message.sessionId, {
          tokens: (inputTokens || 0) + (outputTokens || 0),
          cost: cost || 0,
        });

        SessionStore?.updateSessionInfo?.(message.sessionId, {
          inputTokens: inputTokens || 0,
          outputTokens: outputTokens || 0,
          cost: cost || 0,
        });
      }
    },
  };
}