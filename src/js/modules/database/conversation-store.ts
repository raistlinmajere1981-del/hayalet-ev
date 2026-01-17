/**
 * Conversation Store - Konuşma CRUD İşlemleri
 *
 * @module src/js/modules/database/conversation-store
 */

import { LogManager } from "../log-manager.js";
import { getErrorMessage } from "../../types/index.js";

// ============================================================================
// Conversation Store
// ============================================================================

export const ConversationStore = {
  /**
   * Konuşmaları listele
   * @param {string} accountId - Account ID
   * @returns {Promise<Array>}
   */
  async list(accountId: string) {
    try {
      if (!accountId) {
        return [];
      }

      const result = await window.electronAPI?.dbGetConversations?.({ accountId });

      return Array.isArray(result) ? result : [];
    } catch (err) {
      LogManager.addEvent("database", "error", `ConversationStore.list error: ${getErrorMessage(err)}`, { context: { accountId } });
      return [];
    }
  },

  /**
   * Tek bir konuşmayı getir
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @returns {Promise<Object|null>}
   */
  async get(accountId: string, conversationId: string) {
    try {
      const conversations = await this.list(accountId);
      return conversations.find((c) => c.id === conversationId) || null;
    } catch (err) {
      LogManager.addEvent("database", "error", `ConversationStore.get error: ${getErrorMessage(err)}`, { context: { accountId, conversationId } });
      return null;
    }
  },

  /**
   * Konuşmayı güncelle
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @param {Object} data - { title?, summary? }
   * @returns {Promise<{ success: boolean }>}
   */
  async update(accountId: string, conversationId: string, data: { title?: string; summary?: string }) {
    try {
      const result = await window.electronAPI?.dbUpdateConversation?.({
        accountId,
        conversationId,
        ...data,
      });

      return result || { success: false, error: "API not available" };
    } catch (err) {
      LogManager.addEvent("database", "error", `ConversationStore.update error: ${getErrorMessage(err)}`, { context: { accountId, conversationId, data } });
      return { success: false, error: getErrorMessage(err) };
    }
  },

  /**
   * Konuşmayı sil
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @returns {Promise<{ success: boolean }>}
   */
  async delete(accountId: string, conversationId: string) {
    try {
      const result = await window.electronAPI?.dbDeleteConversation?.({ accountId, conversationId });

      return result || { success: false, error: "API not available" };
    } catch (err) {
      LogManager.addEvent("database", "error", `ConversationStore.delete error: ${getErrorMessage(err)}`, { context: { accountId, conversationId } });
      return { success: false, error: getErrorMessage(err) };
    }
  },

  /**
   * URL'ye göre konuşma bul
   * @param {string} accountId - Account ID
   * @param {string} webUrl
   * @returns {Promise<Object|null>}
   */
  async findByUrl(accountId: string, webUrl: string) {
    try {
      const conversations = await this.list(accountId);
      return conversations.find((c) => c.webUrl === webUrl) || null;
    } catch (err) {
      LogManager.addEvent("database", "error", `ConversationStore.findByUrl error: ${getErrorMessage(err)}`, { context: { accountId, webUrl } });
      return null;
    }
  },
};

export default ConversationStore;
