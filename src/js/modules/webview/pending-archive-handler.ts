/**
 * PendingArchiveHandler - Bekleyen arşiv işlemleri yönetimi
 *
 * Bu modül AI yanıtı tamamlandığında işlenecek arşiv kopyalama işlemlerini yönetir:
 * - Pending archive kayıt
 * - Stable durumda işleme
 * - Cleanup işlemleri
 */

import { LogManager } from "../log-manager.js";
import { getErrorMessage } from "../../types/index.js";
import { FileManager } from "../file-manager.js";
import { AppState } from "../app-state.js";

interface StagedFile {
  name: string;
  path: string;
  commandPath?: string;
  originalName?: string;
}

interface PendingEntry {
  jobId: string;
  folder?: string;
  temp?: string[];
  stagedFiles?: StagedFile[];
}

interface SyncMessage {
  id?: string;
  role: string;
  attachments?: string[];
}

interface SyncResult {
  messages?: SyncMessage[];
  conversationId?: string;
}

class PendingArchiveHandlerClass {
  _pendingArchives: Record<string, PendingEntry[]>;

  constructor() {
    this._pendingArchives = {};
  }

  addPending(provider: string, entry: PendingEntry) {
    if (!provider || !entry) return;

    this._pendingArchives[provider] = this._pendingArchives[provider] || [];
    this._pendingArchives[provider].push(entry);

    LogManager.addEvent("archive", "debug", "Pending archive registered", { visibility: 3,
      jobId: entry.jobId,
      provider,
      folder: entry.folder,
    });
  }

  processPending(provider: string, syncResult: SyncResult) {
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
      LogManager.addEvent("archive", "warning", `processPending error: ${getErrorMessage(e)}`);
    }
  }

  async _processEntry(
    entry: PendingEntry,
    provider: string,
    message: SyncMessage | undefined,
    conversationId: string | undefined
  ) {
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

        const res = await window.electronAPI?.dbSaveAttachment({
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
        `Pending archive processing error: ${getErrorMessage(e)}`,
        { jobId: entry.jobId }
      );
    }
  }

  _cleanup(entry: { jobId: string; temp?: string[] }) {
    try {
      FileManager.commandCleanup(entry.jobId, (entry.temp || []).map((t: string) => ({ tempPath: t })));
    } catch (e) {
      LogManager.addEvent(
        "command",
        "warning",
        `Arşiv sonrası temizlik hatası: ${getErrorMessage(e)}`,
        { jobId: entry.jobId }
      );
    }
  }

  clearPending(provider: string) {
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

  hasPending(provider: string): boolean {
    return (this._pendingArchives[provider]?.length || 0) > 0;
  }

  getPendingCount(provider?: string): number {
    if (provider) {
      return this._pendingArchives[provider]?.length || 0;
    }

    return Object.values(this._pendingArchives).reduce((sum, list) => sum + (list?.length || 0), 0);
  }
}

export const PendingArchiveHandler = new PendingArchiveHandlerClass();
