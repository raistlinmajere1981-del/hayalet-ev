/**
 * Database Module - Renderer Process Facade
 *
 * IPC üzerinden main process database'ine erişim sağlar.
 * ConversationStore ve MessageStore doğrudan kullanılır.
 *
 * @module src/js/modules/database
 */

export { ConversationStore } from "./conversation-store.js";
export { MessageStore } from "./message-store.js";
