/**
 * Message Store - Mesaj CRUD ve Sync İşlemleri
 *
 * @module src/js/modules/database/message-store
 */

import { LogManager } from "../log-manager.js";
import { getErrorMessage } from "../../types/index.js";

// ============================================================================
// Hash Utility (Renderer-side)
// ============================================================================

/**
 * String'den hash oluştur (djb2 algoritması)
 * Main process ile aynı algoritma kullanılmalı
 * @param {string} str
 * @returns {string}
 */
export function hashString(str: string): string {
  if (!str) return "0";

  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit
  }
  return hash.toString(16);
}

// ============================================================================
// Message Store
// ============================================================================

export const MessageStore = {
  /**
   * Mesajları listele
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @returns {Promise<Array>}
   */
  async list(accountId: string, conversationId: string) {
    try {
      if (!accountId || !conversationId) {
        return [];
      }

      const result = await window.electronAPI?.dbGetMessages?.({ accountId, conversationId });

      return Array.isArray(result) ? result : [];
    } catch (err) {
      LogManager.addEvent("database", "error", `MessageStore.list error: ${getErrorMessage(err)}`, { context: { accountId, conversationId } });
      return [];
    }
  },

  /**
   * Mesajları senkronize et (incremental sync)
   * @param {Object} params
   * @param {string} params.accountId - Account ID
   * @param {string} params.webUrl - Konuşma URL'i
   * @param {Array} params.messages - Scrape edilmiş mesajlar
   * @param {Object} params.authors - { user: "...", assistant: "..." }
   * @returns {Promise<{ success: boolean, conversationId?: string, added?: number, total?: number }>}
   */
  async sync(params: { accountId: string; webUrl: string; messages: Array<{ role?: string; text?: string; index?: number; contentHash?: string }>; authors?: unknown }) {
    try {
      const { accountId, webUrl, messages, authors: _authors } = params;

      if (!accountId || !webUrl) {
        return { success: false, error: "Missing required parameters" };
      }

      // Mesajlara hash ekle (eğer yoksa)
      const messagesWithHash = messages.map((msg: { role?: string; text?: string; index?: number; contentHash?: string }, index: number) => ({
        ...msg,
        index: msg.index ?? index,
        contentHash: msg.contentHash || hashString(msg.text || ""),
      }));

      const result = await window.electronAPI?.dbSyncMessages?.({
        accountId,
        webUrl,
        messages: messagesWithHash,
      });

      return result || { success: false, error: "API not available" };
    } catch (err) {
      LogManager.addEvent("database", "error", `MessageStore.sync error: ${getErrorMessage(err)}`, { context: { webUrl: params.webUrl, accountId: params.accountId } });
      return { success: false, error: getErrorMessage(err) };
    }
  },

  /**
   * Mesajlarda arama yap (FTS5)
   * @param {string} accountId - Account ID
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async search(accountId: string, query: string, limit = 50) {
    try {
      if (!accountId || !query) {
        return [];
      }

      const result = await window.electronAPI?.dbSearchMessages?.({ accountId, query, limit });

      return Array.isArray(result) ? result : [];
    } catch (err) {
      LogManager.addEvent("database", "error", `MessageStore.search error: ${getErrorMessage(err)}`, { context: { accountId, query } });
      return [];
    }
  },

  /**
   * Hash hesapla (utility)
   * @param {string} content
   * @returns {string}
   */
  hash(content: string) {
    return hashString(content);
  },
};

export default MessageStore;
