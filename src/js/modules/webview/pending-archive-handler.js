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

class PendingArchiveHandlerClass {
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
      
      const lastUserIdx = [...history]
        .reverse()
        .findIndex((m) => m.role === "user");
      
      const messageIndex = lastUserIdx === -1 
        ? history.length 
        : history.length - 1 - lastUserIdx;

      for (const entry of list) {
        this._processEntry(entry, provider, messageIndex);
      }
    } catch (e) {
      LogManager.addEvent(
        "archive",
        "warning",
        `processPending error: ${e?.message || String(e)}`,
      );
    }
  }

  /**
   * Tek bir pending entry'yi işle
   * @private
   */
  _processEntry(entry, provider, messageIndex) {
    try {
      const targetDir = `${entry.folder}/msg-${Math.max(0, messageIndex)}`;
      
      LogManager.addEvent(
        "archive",
        "info",
        "Processing pending archive copy",
        {
          jobId: entry.jobId,
          provider,
          targetDir,
        },
      );

      Promise.resolve(FileManager.commandArchiveCopy(entry.jobId, targetDir))
        .then((result) => {
          if (result?.success) {
            LogManager.addEvent(
              "command",
              "info",
              `Arşiv kopyalandı (${targetDir})`,
              { jobId: entry.jobId },
            );

            this._cleanup(entry);
          } else {
            LogManager.addEvent(
              "command",
              "warning",
              `Arşiv kopyalanamadı (pending): ${result?.message || "bilinmiyor"}`,
              { jobId: entry.jobId, targetDir },
            );
          }
        })
        .catch((err) => {
          LogManager.addEvent(
            "command",
            "warning",
            `Arşiv kopyalama hatası (pending): ${err?.message || String(err)}`,
            { jobId: entry.jobId },
          );
        });
    } catch (e) {
      LogManager.addEvent(
        "archive",
        "warning",
        `Pending archive processing error: ${e?.message || String(e)}`,
        { jobId: entry.jobId },
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
        { jobId: entry.jobId },
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
    
    return Object.values(this._pendingArchives)
      .reduce((sum, list) => sum + (list?.length || 0), 0);
  }
}

export const PendingArchiveHandler = new PendingArchiveHandlerClass();
