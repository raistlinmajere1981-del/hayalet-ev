/**
 * Message Store - Part Operations
 * 
 * Message part CRUD: create, update, access parts (text, tool, thinking, step)
 */

import type {
  MessageRecord,
  MessagePart,
  PartType,
  PartUpdateInput,
  ToolCallData,
  ThinkingData,
  StepData,
} from './types.ts';

type UnknownRecord = Record<string, unknown>;

type PartNormalizer<T> = (candidate: unknown, fallback?: T) => T | undefined;

type PartValidator<T> = (value: unknown) => value is T;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const isToolCallData: PartValidator<ToolCallData> = (value: unknown): value is ToolCallData => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.name === 'string';
};

const isThinkingData: PartValidator<ThinkingData> = (value: unknown): value is ThinkingData => {
  if (!isRecord(value)) return false;
  return typeof value.content === 'string';
};

const isStepData: PartValidator<StepData> = (value: unknown): value is StepData => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && (value.status === 'start' || value.status === 'finish');
};

const createNormalizer = <T>(validator: PartValidator<T>): PartNormalizer<T> => {
  return (candidate: unknown, fallback?: T) => {
    if (validator(candidate)) return candidate;
    if (fallback && validator(fallback)) return fallback;
    return undefined;
  };
};

const normalizeToolCall = createNormalizer<ToolCallData>(isToolCallData);
const normalizeThinking = createNormalizer<ThinkingData>(isThinkingData);
const normalizeStep = createNormalizer<StepData>(isStepData);
export function addOrUpdatePart(
  message: MessageRecord,
  input: PartUpdateInput,
  now: number
): MessagePart | null {
  if (!message) {
    console.warn('[MessageStore] Cannot add part - message not found:', input.messageId);
    return null;
  }

  const partId = input.partId || generatePartId(message, input.type);
  const existing = message.parts[partId];

  const partRecord: MessagePart = {
    id: partId,
    messageId: input.messageId,
    type: input.type,
    revision: existing ? existing.revision + 1 : 0,
    text: input.text ?? existing?.text,
    toolCall: normalizeToolCall(input.toolCall, existing?.toolCall),
    thinking: normalizeThinking(input.thinking, existing?.thinking),
    step: normalizeStep(input.step, existing?.step),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  // Update message
  message.parts[partId] = partRecord;
  if (!message.partIds.includes(partId)) {
    message.partIds.push(partId);
  }
  message.revision += 1;
  message.updatedAt = now;

  return partRecord;
}

export function updateTextPart(
  message: MessageRecord,
  text: string,
  append = false,
  now: number
): void {
  if (!message) return;

  // Find existing text part
  const textPartId = message.partIds.find((id) => message.parts[id]?.type === 'text');

  if (textPartId && append) {
    const existing = message.parts[textPartId];
    text = (existing.text || '') + text;
  }

  addOrUpdatePart(
    message,
    {
      messageId: message.id,
      partId: textPartId,
      type: 'text',
      text,
    },
    now
  );
}

export function getMessageParts(message: MessageRecord): MessagePart[] {
  if (!message) return [];

  return message.partIds
    .map((id) => message.parts[id])
    .filter(Boolean);
}

export function getPart(message: MessageRecord, partId: string): MessagePart | undefined {
  return message.parts[partId];
}

function generatePartId(message: MessageRecord, _type: PartType): string {
  return `${message.id}-part-${message.partIds.length}-${Date.now()}`;
}

export function findOrCreatePartId(message: MessageRecord, type: PartType): string {
  // For text parts, reuse existing text part
  if (type === 'text') {
    const existingTextPart = message.partIds.find((id) => message.parts[id]?.type === 'text');
    if (existingTextPart) return existingTextPart;
  }

  // For thinking, reuse existing thinking part
  if (type === 'thinking') {
    const existingThinkingPart = message.partIds.find((id) => message.parts[id]?.type === 'thinking');
    if (existingThinkingPart) return existingThinkingPart;
  }

  // Generate new ID for tool parts or new parts
  return generatePartId(message, type);
}
