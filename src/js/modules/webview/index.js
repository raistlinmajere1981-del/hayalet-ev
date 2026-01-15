/**
 * Webview Module - Barrel Export
 * 
 * Tüm webview alt modüllerini tek noktadan export eder.
 * 
 * Kullanım:
 *   import { LifecycleManager, MessageSender, ConversationSyncer } from "./webview";
 *   import { WebviewManager } from "./webview-manager.js"; // Facade
 */

export { LifecycleManager } from "./lifecycle-manager.js";
export { MessageSender } from "./message-sender.js";
export { ConversationSyncer } from "./conversation-syncer.js";
export { PendingArchiveHandler } from "./pending-archive-handler.js";
export { ProviderRegistry } from "./provider-registry.js";
export { getProvider } from "./provider-factory.js";
