/**
 * PendingArchiveHandler - Bekleyen arşiv işlemleri yönetimi
 *
 * Bu modül AI yanıtı tamamlandığında işlenecek arşiv kopyalama işlemlerini yönetir:
 * - Pending archive kayıt
 * - Stable durumda işleme
 * - Cleanup işlemleri
 */

import { LogManager } from "../log-manager.js";
import { FileManager } from "../file-manager.js";
import { AppState } from "../app-state.js";

class PendingArchiveHandlerClass {
  _pendingArchives: Record<string, any[]>;

  constructor() {
    this._pendingArchives = {};
  }

  /**
   * Bekleyen arşiv ekle
   * @param {string} provider - Slot ID (ai1/ai2)
   * @param {Object} entry - { jobId, folder, temp }
   */
  addPending(provider, entry) {
    if (!provider || !entry) return;

    this._pendingArchives[provider] = this._pendingArchives[provider] || [];
    this._pendingArchives[provider].push(entry);

    LogManager.addEvent("archive", "debug", "Pending archive registered", {
      jobId: entry.jobId,
      provider,
      folder: entry.folder,
    });
  }

  /**
   * Bekleyen arşivleri işle (sync stable olunca çağrılır)
   * @param {string} provider - Slot ID
   * @param {Object} syncResult - Sync sonucu (messages array içerir)
   */
  processPending(provider, syncResult) {
    try {
      const list = this._pendingArchives[provider] || [];
      if (!list.length) return;

      delete this._pendingArchives[provider];

      const history = syncResult?.messages || [];
      const conversationId = syncResult?.conversationId;

      const lastUserIdx = [...history].reverse().findIndex((m) => m.role === "user");

      const messageIndex = lastUserIdx === -1 ? history.length : history.length - 1 - lastUserIdx;

      const message = history[messageIndex];

      for (const entry of list) {
        this._processEntry(entry, provider, message, conversationId);
      }
    } catch (e) {
      LogManager.addEvent("archive", "warning", `processPending error: ${e?.message || String(e)}`);
    }
  }

  /**
   * Tek bir pending entry'yi işle
   * @private
   */
  async _processEntry(entry, provider, message, conversationId) {
    try {
      const accountInfo = AppState.getAccountForSlot(provider);
      if (!accountInfo?.id || !message?.id || !conversationId) {
        LogManager.addEvent("archive", "warning", "Missing info for archive processing", {
          jobId: entry.jobId,
          accountId: accountInfo?.id,
          messageId: message?.id,
          conversationId,
        });
        return;
      }

      const stagedFiles = entry.stagedFiles || [];

      LogManager.addEvent(
        "archive",
        "info",
        `Processing ${stagedFiles.length} attachments for message ${message.id}`,
        { jobId: entry.jobId }
      );

      for (const file of stagedFiles) {
        const filePath = file.commandPath || file.path;
        if (!filePath) continue;

        const res = await window.electronAPI.dbSaveAttachment({
          accountId: accountInfo.id,
          conversationId,
          messageId: message.id,
          filePath,
          originalName: file.originalName || file.name,
          mimeType: null,
        });

        if (!res?.success) {
          LogManager.addEvent("archive", "error", `Attachment save failed: ${res?.error}`, {
            file: file.name,
          });
        }
      }

      LogManager.addEvent("archive", "info", "Attachments processed successfully", {
        jobId: entry.jobId,
      });

      this._cleanup(entry);
    } catch (e) {
      LogManager.addEvent(
        "archive",
        "warning",
        `Pending archive processing error: ${e?.message || String(e)}`,
        { jobId: entry.jobId }
      );
    }
  }

  /**
   * Entry için cleanup işlemi
   * @private
   */
  _cleanup(entry) {
    try {
      FileManager.commandCleanup(entry.jobId, entry.temp || []);
    } catch (e) {
      LogManager.addEvent(
        "command",
        "warning",
        `Arşiv sonrası temizlik hatası: ${e?.message || String(e)}`,
        { jobId: entry.jobId }
      );
    }
  }

  /**
   * Provider için bekleyen arşivleri temizle
   * @param {string} provider - Slot ID
   */
  clearPending(provider) {
    if (provider) {
      delete this._pendingArchives[provider];
    }
  }

  /**
   * Tüm bekleyen arşivleri temizle
   */
  clearAll() {
    this._pendingArchives = {};
  }

  /**
   * Provider için bekleyen arşiv var mı?
   * @param {string} provider - Slot ID
   * @returns {boolean}
   */
  hasPending(provider) {
    return (this._pendingArchives[provider]?.length || 0) > 0;
  }

  /**
   * Bekleyen arşiv sayısı
   * @param {string} provider - Slot ID (optional, all if not provided)
   * @returns {number}
   */
  getPendingCount(provider) {
    if (provider) {
      return this._pendingArchives[provider]?.length || 0;
    }

    return Object.values(this._pendingArchives).reduce((sum, list) => sum + (list?.length || 0), 0);
  }
}

export const PendingArchiveHandler = new PendingArchiveHandlerClass();
