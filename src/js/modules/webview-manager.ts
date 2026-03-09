import type { AppSettings } from "@shared/settings.js";
import type { WebviewTag } from "electron";

/**
 * WebviewManager - Facade Pattern
 *
 * Coordinates all webview subsystems:
 * - LifecycleManager: lifecycle operations (register, attach, detach, destroy)
 * - MessageSender: message and file delivery
 * - ConversationSyncer: conversation sync and archiving
 * - PendingArchiveHandler: pending archive operations
 */

import { getProvider } from "./webview/provider-factory.js";
import { isSlotUrlExcluded } from "./webview/methods/shared/url-utils.js";
import { LifecycleManager } from "./webview/lifecycle-manager.js";
import { MessageSender } from "./webview/message-sender.js";
import type { MessageSenderWebview } from "./webview/message-sender.js";
import { AppState } from "./app-state.js";
import { SlotController } from "./slot-controller.js";
import { ConversationSyncer } from "./webview/conversation-syncer.js";
import { PendingArchiveHandler } from "./webview/pending-archive-handler.js";

interface FileEntry {
  name?: string;
  path?: string;
}

interface SyncCoreEngine {
  handleCaughtCommand: (command: string, payload: Record<string, unknown>) => Promise<unknown>;
}

function isMessageSenderWebview(webview: unknown): webview is MessageSenderWebview {
  return (
    webview != null &&
    typeof (webview as { executeJavaScript?: unknown }).executeJavaScript === "function"
  );
}

function isSlotId(provider: string): provider is "ai0" | "ai1" | "ai2" {
  return provider === "ai0" || provider === "ai1" || provider === "ai2";
}

class WebviewManagerClass {
  settings: AppSettings | null;

  constructor() {
    this.settings = null;
  }

  /**
   * Update settings and distribute them to child modules.
   * @param {Object} settings - Application settings
   */
  setSettings(settings: AppSettings): void {
    this.settings = settings;
    MessageSender.setSettings(settings);
    ConversationSyncer.setSettings(settings);
  }

  /**
   * Register a webview
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Webview element
   */
  register(provider: string, webview: WebviewTag): void {
    if (isSlotId(provider)) {
      SlotController.registerWebview(provider, webview);
      return;
    }

    LifecycleManager.register(provider, webview);
  }

  /**
   * Attach a webview to a slot
   * @param {string} provider - Slot ID
   * @param {WebviewTag} webview - Webview element
   * @param {Object} opts - { onReady }
   */
  attach(provider: string, webview: WebviewTag, opts: Record<string, unknown> = {}): void {
    if (isSlotId(provider)) {
      SlotController.registerWebview(provider, webview);
      SlotController.ensureWebviewMounted(provider);
      SlotController.ensureWebviewAttached(provider);
      SlotController.markActive(provider);
      return;
    }

    const providerId = AppState.getProviderIdForSlot(provider);
    LifecycleManager.attach(provider, webview, {
      ...opts,
      ...(providerId !== null && providerId !== "" ? { providerId } : {}),
    });
  }

  /**
   * Detach a webview from a slot
   * @param {string} provider - Slot ID
   * @param {Object} opts - { cleanupDom, skipTrafficStop }
   */
  detach(provider: string, opts: Record<string, unknown> = {}): void {
    if (isSlotId(provider)) {
      SlotController.parkWebview(provider, "webview_manager_detach");
      return;
    }

    LifecycleManager.detach(provider, opts);
  }

  /**
   * Resolve the webview for a slot or provider.
   * @param {string} provider - Slot ID
   * @returns {HTMLElement|null}
   */
  resolveWebview(provider: string): WebviewTag | null {
    if (isSlotId(provider)) {
      const slotWebview = SlotController.getWebview(provider);
      if (slotWebview !== null) {
        return slotWebview as WebviewTag;
      }
    }

    const cached = LifecycleManager.get(provider);
    if (cached !== null) {
      return cached;
    }

    if (typeof document === "undefined") {
      return null;
    }

    const fallbackId = `${provider}-webview`;
    const found = document.getElementById(fallbackId) as WebviewTag | null;
    if (found !== null && isSlotId(provider)) {
      SlotController.registerWebview(provider, found);
    }
    return found;
  }

  /**
   * Destroy the webview completely.
   * @param {string} provider - Slot ID
   */
  destroyWebview(provider: string): void {
    if (isSlotId(provider)) {
      SlotController.parkWebview(provider, "webview_manager_destroy");
      return;
    }

    LifecycleManager.destroy(provider);
  }

  /**
   * Mark the webview as active.
   * @param {string} provider - Slot ID
   */
  markActive(provider: string): void {
    if (isSlotId(provider)) {
      SlotController.markActive(provider);
      return;
    }

    LifecycleManager.markActive(provider);
  }

  cleanupInactiveWebviews(): number {
    return SlotController.cleanupInactiveWebviews();
  }

  /**
   * Send a message and attachments.
   * @param {Object} opts - { provider, text, attachments }
   * @returns {Promise<Object>}
   */
  async send({
    provider,
    text,
    attachments = [],
  }: {
    provider: string;
    text: string;
    attachments?: FileEntry[];
  }): Promise<unknown> {
    const webview = this.resolveWebview(provider);
    if (!isMessageSenderWebview(webview)) {
      throw new Error(`Webview for slot "${provider}" is not ready`);
    }
    return await MessageSender.send({ provider, text, attachments, webview });
  }

  /**
   * Initialize the ConversationSyncer.
   * @param {Object} coreEngine - CoreEngine instance
   */
  initSyncer(coreEngine: SyncCoreEngine): void {
    ConversationSyncer.init(coreEngine, (provider: string) => this.resolveWebview(provider));
  }

  /**
   * Synchronize the conversation.
   * @param {string} provider - Slot ID
   * @param {HTMLElement} webview - Optional webview element
   * @param {Object} options - { catchEnabled }
   * @returns {Promise<Object>}
   */
  async syncConversation(
    provider: string,
    webview: WebviewTag | null,
    options: Record<string, unknown> = {}
  ): Promise<unknown> {
    const targetWebview = webview ?? this.resolveWebview(provider);
    if (targetWebview === null) throw new Error("Webview not found");
    return await ConversationSyncer.syncConversation(provider, targetWebview, options);
  }

  async syncLatestMessage(provider: string, webview: WebviewTag | null = null): Promise<unknown> {
    const targetWebview = webview ?? this.resolveWebview(provider);
    if (targetWebview === null) throw new Error("Webview not found");
    return await ConversationSyncer.syncLatestMessage(provider, targetWebview);
  }

  /**
   * Synchronize the provider (legacy SyncHandler.syncProvider).
   * @param {string} provider - Slot ID
   * @param {Object} opts - { from }
   * @returns {Promise<Object>}
   */
  async syncProvider(provider: string, opts: Record<string, unknown> = {}): Promise<unknown> {
    return await ConversationSyncer.syncProvider(provider, opts);
  }

  /**
   * Add a stable listener.
   * @param {string} provider - Slot ID
   * @param {Function} callback - Callback
   */
  addStableListener(provider: string, callback: () => void): void {
    ConversationSyncer.addStableListener(provider, callback);
  }

  /**
   * Return the last sync result.
   * @param {string} provider - Slot ID
   * @returns {Object|null}
   */
  getLastSyncResult(provider: string): unknown {
    return ConversationSyncer.getLastSyncResult(provider);
  }

  /**
   * Add a pending archive entry.
   * @param {string} provider - Slot ID
   * @param {Object} entry - { jobId, folder, temp }
   */
  addPendingArchive(
    provider: string,
    entry: { jobId: string; folder: string; temp?: string[] }
  ): void {
    PendingArchiveHandler.addPending(provider, entry);
  }

  /**
   * Return the provider module for a slot.
   * @param {string} providerSlot - Slot ID
   * @returns {Object|null}
   */
  getProviderModule(providerSlot: string): unknown {
    const providerId = AppState.getProviderIdForSlot(providerSlot);
    return providerId !== null && providerId !== "" ? getProvider(providerId) : null;
  }

  /**
   * Check whether the URL is excluded.
   * @deprecated Use isSlotUrlExcluded from url-utils.ts directly
   * @param {string} providerSlot - Slot ID
   * @param {string} url - URL
   * @returns {boolean}
   */
  isUrlExcluded(providerSlot: string, url: string): boolean {
    return isSlotUrlExcluded(providerSlot, url);
  }

  /**
   * Return all webview references.
   * @returns {Object}
   */
  get webviews(): unknown {
    const lifecycleWebviews = LifecycleManager.getAll();
    return {
      ...lifecycleWebviews,
      ai0: SlotController.getWebview("ai0"),
      ai1: SlotController.getWebview("ai1"),
      ai2: SlotController.getWebview("ai2"),
    };
  }
}

const webviewManager = new WebviewManagerClass();

export { webviewManager, webviewManager as WebviewManager };
