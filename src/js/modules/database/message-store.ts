import { LogCategory } from "@shared/logging-core";
import { formatErrorWithDetail } from "../../../../shared/i18n/error-detail.js";
import { Logger } from "../logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import { AppI18n } from "../i18n/index.js";
import { resolveIpcErrorMessage } from "../ipc-errors.js";

function databaseT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.database.${key}`, params);
}

function databaseStoreError(store: string, operation: string, detail?: unknown): string {
  return formatErrorWithDetail(databaseT("operationFailed", { store, operation }), detail);
}

const messageStore = {
  async list(accountId: string, conversationId: string): Promise<unknown[]> {
    try {
      if (accountId === "" || conversationId === "") {
        return [];
      }

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return [];
      }

      const result = (await electronApi.dbGetMessages({ accountId, conversationId })) as
        | { data: unknown[] }
        | undefined;

      return result?.data ?? [];
    } catch (err) {
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "MessageStore", operation: "list", message: getErrorMessage(err) },
        { context: { accountId, conversationId } }
      );
      return [];
    }
  },

  async sync(params: {
    accountId: string;
    webUrl: string;
    messages: Array<{ role?: string; text?: string; index?: number; contentHash?: string }>;
    authors?: unknown;
  }): Promise<{
    success: boolean;
    conversationId?: string;
    added?: number;
    total?: number;
    error?: string;
  }> {
    try {
      const { accountId, webUrl, messages, authors: _authors } = params;

      if (accountId === "" || webUrl === "") {
        return {
          success: false,
          error: databaseStoreError("MessageStore", "sync", databaseT("missingParameters")),
        };
      }

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return {
          success: false,
          error: databaseStoreError("MessageStore", "sync", databaseT("apiUnavailable")),
        };
      }

      const messagesWithIndex = messages.map(
        (
          msg: { role?: string; text?: string; index?: number; contentHash?: string },
          index: number
        ) => ({
          ...msg,
          index: msg.index ?? index,
        })
      );

      const resultRaw: unknown = await electronApi.dbSyncMessages({
        accountId,
        webUrl,
        messages: messagesWithIndex,
      });
      const result = resultRaw as
        | {
            success: boolean;
            conversationId?: string;
            added?: number;
            total?: number;
            error?: string;
          }
        | undefined;

      if (result === undefined) {
        return {
          success: false,
          error: databaseStoreError("MessageStore", "sync", databaseT("apiUnavailable")),
        };
      }

      return {
        ...result,
        ...(result.success === true
          ? {}
          : {
              error: databaseStoreError(
                "MessageStore",
                "sync",
                resolveIpcErrorMessage(result) ?? result.error
              ),
            }),
      };
    } catch (err) {
      const errorMessage = databaseStoreError("MessageStore", "sync", err);
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "MessageStore", operation: "sync", message: getErrorMessage(err) },
        { context: { webUrl: params.webUrl, accountId: params.accountId } }
      );
      return { success: false, error: errorMessage };
    }
  },

  async search(accountId: string, query: string, limit = 50): Promise<unknown[]> {
    try {
      if (accountId === "" || query === "") {
        return [];
      }

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return [];
      }

      const result = (await electronApi.dbSearchMessages({ accountId, query, limit })) as
        | { data: unknown[] }
        | undefined;

      return result?.data ?? [];
    } catch (err) {
      Logger.errorT(
        LogCategory.DATABASE,
        "app.logs.database.storeOperationFailed",
        { store: "MessageStore", operation: "search", message: getErrorMessage(err) },
        { context: { accountId, query } }
      );
      return [];
    }
  },
};

export { messageStore as MessageStore };
export default messageStore;
