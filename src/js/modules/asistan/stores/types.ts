/**
 * OpenCode UI - Store Types
 * 
 * JSDoc type definitions for the message store system.
 * Adapted from CodeNomad's message-v2/types.ts
 */

// =============================================================================
// Message Status & Role
// =============================================================================

/**
 * Message status for optimistic updates flow:
 * - 'sending': User message being sent, waiting for server acknowledgment
 * - 'sent': Server acknowledged receipt, waiting for assistant response
 * - 'streaming': Assistant response being streamed
 * - 'complete': Message fully received/confirmed
 * - 'error': Send failed or server error
 * 
 * State transitions:
 * - User message: sending → sent → complete
 * - Assistant message: streaming → complete
 * - On error: any → error
 * 
 * @typedef {'sending' | 'sent' | 'streaming' | 'complete' | 'error'} MessageStatus
 */

/**
 * @typedef {'user' | 'assistant'} MessageRole
 */

// =============================================================================
// Message Parts
// =============================================================================

/**
 * @typedef {'text' | 'tool' | 'thinking'} PartType
 */

/**
 * @typedef {'pending' | 'running' | 'success' | 'error'} ToolStatus
 */

/**
 * @typedef {Object} ToolCallData
 * @property {string} toolId - Tool call ID
 * @property {string} toolName - Tool name
 * @property {ToolStatus} status - Execution status
 * @property {Object} [input] - Tool input parameters
 * @property {string} [output] - Tool output/result
 * @property {number} [startedAt] - Execution start time
 * @property {number} [completedAt] - Execution completion time
 */

/**
 * @typedef {Object} ThinkingData
 * @property {string} content - Thinking/reasoning content
 * @property {boolean} [isComplete] - Whether thinking is complete
 */

/**
 * @typedef {Object} MessagePart
 * @property {string} id - Unique part ID
 * @property {string} messageId - Parent message ID
 * @property {PartType} type - Part type
 * @property {number} revision - Update revision number
 * @property {string} [text] - Text content (for text parts)
 * @property {ToolCallData} [toolCall] - Tool call data (for tool parts)
 * @property {ThinkingData} [thinking] - Thinking data (for thinking parts)
 * @property {StepData} [step] - Step data (for step parts)
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

// =============================================================================
// Message Record
// =============================================================================

/**
 * @typedef {Object} MessageRecord
 * @property {string} id - Unique message ID
 * @property {string} sessionId - Session ID this message belongs to
 * @property {MessageRole} role - Message author role
 * @property {MessageStatus} status - Current message status
 * @property {number} revision - Update revision for change detection
 * @property {boolean} [isEphemeral] - True for optimistic/temp messages
 * @property {string[]} partIds - Ordered list of part IDs
 * @property {Object.<string, MessagePart>} parts - Part records by ID
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

// =============================================================================
// Session Record
// =============================================================================

/**
 * @typedef {'idle' | 'processing' | 'waiting'} SessionStatus
 */

/**
 * @typedef {Object} SessionRecord
 * @property {string} id - Unique session ID
 * @property {string} [title] - Session title
 * @property {string[]} messageIds - Ordered list of message IDs
 * @property {SessionStatus} status - Current session status
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

// =============================================================================
// Store State
// =============================================================================

/**
 * @typedef {Object} MessageStoreState
 * @property {Map<string, MessageRecord>} messages - All messages by ID
 * @property {Map<string, MessagePart>} parts - All parts by ID (denormalized for quick access)
 * @property {Map<string, string[]>} sessionMessages - Message IDs grouped by session
 * @property {Map<string, number>} sessionRevisions - Revision counters per session
 */

/**
 * @typedef {Object} SessionStoreState
 * @property {string | null} currentSessionId - Active session ID
 * @property {Map<string, SessionRecord>} sessions - All sessions by ID
 * @property {SessionStatus} status - Global UI status
 */

// =============================================================================
// Event Types (for store notifications)
// =============================================================================

/**
 * @typedef {'message:created' | 'message:updated' | 'message:deleted' | 'part:updated' | 'session:changed'} StoreEventType
 */

/**
 * @typedef {Object} StoreEvent
 * @property {StoreEventType} type - Event type
 * @property {string} [messageId] - Related message ID
 * @property {string} [partId] - Related part ID
 * @property {string} [sessionId] - Related session ID
 * @property {number} timestamp - Event timestamp
 */

// =============================================================================
// Input Types (for store mutations)
// =============================================================================

/**
 * @typedef {Object} MessageUpsertInput
 * @property {string} id - Message ID
 * @property {string} sessionId - Session ID
 * @property {MessageRole} role - Message role
 * @property {MessageStatus} [status] - Status (defaults to 'streaming' for new)
 * @property {boolean} [isEphemeral] - Is this an optimistic message
 * @property {MessagePart[]} [parts] - Initial parts
 * @property {number} [createdAt] - Creation time override
 */

/**
 * @typedef {Object} PartUpdateInput
 * @property {string} messageId - Parent message ID
 * @property {string} [partId] - Part ID (auto-generated if not provided)
 * @property {PartType} type - Part type
 * @property {string} [text] - Text content
 * @property {ToolCallData} [toolCall] - Tool data
 * @property {ThinkingData} [thinking] - Thinking data
 */

/**
 * @typedef {Object} ReplaceMessageIdOptions
 * @property {string} oldId - Current (temp) message ID
 * @property {string} newId - New (real) message ID
 */

// =============================================================================
// Optimistic Update Types
// =============================================================================

/**
 * Input for creating an optimistic (ephemeral) message
 * @typedef {Object} OptimisticMessageInput
 * @property {string} sessionId - Session ID
 * @property {MessageRole} role - Message role
 * @property {string} content - Message text content
 * @property {string} [tempId] - Optional custom temp ID (auto-generated if not provided)
 */

/**
 * Result from creating an optimistic message
 * @typedef {Object} OptimisticMessageResult
 * @property {string} tempId - Temporary message ID
 * @property {MessageRecord} record - Created message record
 */

/**
 * Error info for failed messages
 * @typedef {Object} MessageErrorInfo
 * @property {string} code - Error code (e.g., 'NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR')
 * @property {string} message - Human-readable error message
 * @property {boolean} [retryable] - Whether the operation can be retried
 */

// =============================================================================
// Permission Types (adapted from CodeNomad)
// =============================================================================

/**
 * @typedef {'pending' | 'approved' | 'denied'} PermissionStatus
 */

/**
 * @typedef {Object} PermissionRequest
 * @property {string} id - Unique permission ID
 * @property {string} type - Permission type (e.g., 'file_write', 'command_execute')
 * @property {string} title - Human-readable title
 * @property {string} [description] - Detailed description
 * @property {Object} [metadata] - Additional context data
 * @property {number} createdAt - Request timestamp
 */

/**
 * @typedef {Object} PermissionEntry
 * @property {string} id - Entry ID
 * @property {string} messageId - Associated message ID
 * @property {string} partId - Associated part ID (tool call)
 * @property {PermissionRequest} permission - Permission details
 * @property {PermissionStatus} status - Current status
 * @property {number} createdAt - Entry creation timestamp
 */

// =============================================================================
// Question Types
// =============================================================================

/**
 * @typedef {'pending' | 'answered'} QuestionStatus
 */

/**
 * @typedef {Object} QuestionOption
 * @property {string} label - Option label
 * @property {string} value - Option value
 */

/**
 * @typedef {Object} QuestionRequest
 * @property {string} id - Unique question ID
 * @property {string} text - Question text
 * @property {'text' | 'select' | 'confirm'} type - Input type
 * @property {QuestionOption[]} [options] - Options for select type
 * @property {string} [default] - Default value
 * @property {number} createdAt - Question timestamp
 */

/**
 * @typedef {Object} QuestionEntry
 * @property {string} id - Entry ID
 * @property {string} messageId - Associated message ID
 * @property {QuestionRequest} question - Question details
 * @property {string} [answer] - User's answer
 * @property {QuestionStatus} status - Current status
 * @property {number} createdAt - Entry creation timestamp
 */

// =============================================================================
// Extended Store Event Types
// =============================================================================

/**
 * Extended store event types including permission and question events
 * @typedef {'message:created' | 'message:updated' | 'message:deleted' | 'part:updated' | 'session:changed' | 'permission:updated' | 'permission:removed' | 'permission:cleared' | 'question:updated' | 'question:removed' | 'question:cleared'} ExtendedStoreEventType
 */

// Version marker (no export - loaded as script)
// eslint-disable-next-line no-unused-vars
const TYPES_VERSION = '1.2.0';
