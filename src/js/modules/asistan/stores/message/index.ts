/**
 * Message Store - Barrel Export
 * 
 * Public API for the message store module
 */

// Main export
export { messageStore as MessageStore } from './manager';

// Type exports
export type {
  MessageRecord,
  MessageStatus,
  MessageErrorInfo,
  MessageUpsertInput,
  OptimisticMessageInput,
  OptimisticMessageResult,
  ReplaceMessageIdOptions,
  MessagePart,
  PartType,
  PartUpdateInput,
  ToolCallData,
  ThinkingData,
  StepData,
  PermissionEntry,
  PermissionRequest,
  PermissionState,
  QuestionEntry,
  QuestionState,
  SessionStatus,
  StoreEventType,
  StoreEvent,
  StoreListener,
} from './types';

// Utility exports
export { createId, randomBase62 } from './id-generator';
export { EventBus } from './subscription';
