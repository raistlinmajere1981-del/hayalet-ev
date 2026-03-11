import { LogCategory } from "@shared/logging-core";
import { formatErrorWithDetail } from "../../../../shared/i18n/error-detail.js";
import { Logger } from "../logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import { AppI18n } from "../i18n/index.js";
import { resolveIpcErrorMessage } from "../ipc-errors.js";
import type { Conversation } from "@shared/database.js";

function databaseT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.database.${key}`, params);
}

function databaseStoreError(store: string, operation: string, detail?: unknown): string {
  return formatErrorWithDetail(databaseT("operationFailed", { store, operation }), detail);
}

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

  async update(
    accountId: string,
    conversationId: string,
    data: { title?: string; summary?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const dbUpdateConversation = window.electronAPI?.dbUpdateConversation;
      if (typeof dbUpdateConversation !== "function") {
        return {
          success: false,
          error: databaseStoreError("ConversationStore", "update", databaseT("apiUnavailable")),
        };
      }

      const result = await dbUpdateConversation({
        accountId,
        conversationId,
        ...data,
      });

      return {
        success: result.success === true,
        ...(result.success === true
          ? {}
          : {
              error: databaseStoreError(
                "ConversationStore",
                "update",
                resolveIpcErrorMessage(result) ?? result.error
              ),
            }),
      };
    } catch (err) {
      const errorMessage = databaseStoreError("ConversationStore", "update", err);
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "ConversationStore", operation: "update", message: getErrorMessage(err) },
        { context: { accountId, conversationId, data } }
      );
      return { success: false, error: errorMessage };
    }
  },

  async delete(
    accountId: string,
    conversationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const dbDeleteConversation = window.electronAPI?.dbDeleteConversation;
      if (typeof dbDeleteConversation !== "function") {
        return {
          success: false,
          error: databaseStoreError("ConversationStore", "delete", databaseT("apiUnavailable")),
        };
      }

      const result = await dbDeleteConversation({
        accountId,
        conversationId,
      });

      return {
        success: result.success === true,
        ...(result.success === true
          ? {}
          : {
              error: databaseStoreError(
                "ConversationStore",
                "delete",
                resolveIpcErrorMessage(result) ?? result.error
              ),
            }),
      };
    } catch (err) {
      const errorMessage = databaseStoreError("ConversationStore", "delete", err);
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "ConversationStore", operation: "delete", message: getErrorMessage(err) },
        { context: { accountId, conversationId } }
      );
      return { success: false, error: errorMessage };
    }
  },

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
