/**
 * Database Module - Renderer Process Facade
 *
 * Provides access to the main-process database over IPC.
 * ConversationStore and MessageStore are used directly.
 *
 * @module src/js/modules/database
 */

export { ConversationStore } from "./conversation-store.js";
export { MessageStore } from "./message-store.js";
