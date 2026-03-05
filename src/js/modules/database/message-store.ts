import { LogCategory } from "@shared/logging-core";
import { Logger } from "../logger/index.js";
import { getErrorMessage } from "@shared/index.js";

const messageStore = {
  /**
   * Mesajları listele
   * @param {string} accountId - Account ID
   * @param {string} conversationId
   * @returns {Promise<Array>}
   */
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
      Logger.error(LogCategory.DATABASE, `MessageStore.list error: ${getErrorMessage(err)}`, {
        context: { accountId, conversationId },
      });
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
        return { success: false, error: "Missing required parameters" };
      }

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return { success: false, error: "API not available" };
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

      return result ?? { success: false, error: "API not available" };
    } catch (err) {
      Logger.error(LogCategory.DATABASE, `MessageStore.sync error: ${getErrorMessage(err)}`, {
        context: { webUrl: params.webUrl, accountId: params.accountId },
      });
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
      Logger.error(LogCategory.DATABASE, `MessageStore.search error: ${getErrorMessage(err)}`, {
        context: { accountId, query },
      });
      return [];
    }
  },
};

export { messageStore as MessageStore };
export default messageStore;
