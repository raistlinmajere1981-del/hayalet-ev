import { LogCategory } from "@shared/logging-core";
/**
 * Conversation Store - conversation CRUD operations
 *
 * @module src/js/modules/database/conversation-store
 */

import { Logger } from "../logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import type { Conversation } from "@shared/database.js";

function isConversation(value: unknown): value is Conversation {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe["id"] === "string" &&
    typeof maybe["accountId"] === "string" &&
    typeof maybe["title"] === "string" &&
    typeof maybe["webUrl"] === "string" &&
    typeof maybe["createdAt"] === "number" &&
    typeof maybe["updatedAt"] === "number"
  );
}

function toConversationArray(value: unknown): Conversation[] {
  return Array.isArray(value)
    ? value.filter((item): item is Conversation => isConversation(item))
    : [];
}

const conversationStore = {
  /**
   * List conversations.
   * @param {string} accountId - Account ID
   * @returns {Promise<Array>}
   */
  async list(accountId: string): Promise<Conversation[]> {
    try {
      if (accountId === "") {
        return [];
      }

      const dbGetConversations = window.electronAPI?.dbGetConversations;
      if (typeof dbGetConversations !== "function") {
        return [];
      }

      const result = await dbGetConversations({ accountId });

      return toConversationArray(result.data);
    } catch (err) {
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "ConversationStore", operation: "list", message: getErrorMessage(err) },
        { context: { accountId } }
      );
      return [];
    }
  },

  /**
   * Return a single conversation.
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @returns {Promise<Object|null>}
   */
  async get(accountId: string, conversationId: string): Promise<Conversation | null> {
    try {
      const conversations = await this.list(accountId);
      return conversations.find((c: Conversation) => c.id === conversationId) ?? null;
    } catch (err) {
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "ConversationStore", operation: "get", message: getErrorMessage(err) },
        { context: { accountId, conversationId } }
      );
      return null;
    }
  },

  /**
   * Update a conversation.
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @param {Object} data - { title?, summary? }
   * @returns {Promise<{ success: boolean }>}
   */
  async update(
    accountId: string,
    conversationId: string,
    data: { title?: string; summary?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const dbUpdateConversation = window.electronAPI?.dbUpdateConversation;
      if (typeof dbUpdateConversation !== "function") {
        return { success: false, error: "electronAPI.dbUpdateConversation unavailable" };
      }

      const result = await dbUpdateConversation({
        accountId,
        conversationId,
        ...data,
      });

      return {
        success: result.success === true,
        ...(typeof result.error === "string" ? { error: result.error } : {}),
      };
    } catch (err) {
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "ConversationStore", operation: "update", message: getErrorMessage(err) },
        { context: { accountId, conversationId, data } }
      );
      return { success: false, error: getErrorMessage(err) };
    }
  },

  /**
   * Delete a conversation.
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @returns {Promise<{ success: boolean; error?: string }>}
   */
  async delete(
    accountId: string,
    conversationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const dbDeleteConversation = window.electronAPI?.dbDeleteConversation;
      if (typeof dbDeleteConversation !== "function") {
        return { success: false, error: "electronAPI.dbDeleteConversation unavailable" };
      }

      const result = await dbDeleteConversation({
        accountId,
        conversationId,
      });

      return {
        success: result.success === true,
        ...(typeof result.error === "string" ? { error: result.error } : {}),
      };
    } catch (err) {
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "ConversationStore", operation: "delete", message: getErrorMessage(err) },
        { context: { accountId, conversationId } }
      );
      return { success: false, error: getErrorMessage(err) };
    }
  },

  /**
   * Find a conversation by URL.
   * @param {string} accountId - Account ID
   * @param {string} webUrl
   * @returns {Promise<Object|null>}
   */
  async findByUrl(accountId: string, webUrl: string): Promise<Conversation | null> {
    try {
      const conversations = await this.list(accountId);
      return conversations.find((c: Conversation) => c.webUrl === webUrl) ?? null;
    } catch (err) {
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "ConversationStore", operation: "findByUrl", message: getErrorMessage(err) },
        { context: { accountId, webUrl } }
      );
      return null;
    }
  },
};

export { conversationStore as ConversationStore };
export default conversationStore;
