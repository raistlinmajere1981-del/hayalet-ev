// @ts-nocheck
import { WebviewManager } from "./webview-manager.js";
import { FileManager } from "./file-manager.js";
import { LogManager } from "./log-manager.js";
import { TrafficManager } from "./traffic-manager.js";
import { SyncHandler } from "./sync-handler.js";

class CommandExecutorClass {
  constructor() {
    this.coreEngine = null;
  }

  /**
   * @param {any} coreEngineInstance
   */
  init(coreEngineInstance) {
    this.coreEngine = coreEngineInstance;
  }

  async executeJob(job) {
    const result = await WebviewManager.send({
      provider: job.provider,
      text: job.message,
      attachments: job.attachments,
    });

    if (!result?.success) {
      const err = new Error(result?.message || "E_WEBVIEW_SEND");
      // @ts-ignore
      err.code = result?.code || "E_WEBVIEW_SEND";
      throw err;
    }
    return result;
  }

  async handleJobSuccess(job) {
    TrafficManager.signal(job.provider, "sent", job.message || "");
    try {
      const folder = job.meta?.archiveFolders?.[job.provider];
      const stagedFiles =
        job.attachmentsMeta?.staged || job.meta?.attachments || [];

      if (folder && stagedFiles.length > 0) {
        SyncHandler.addPendingArchive(job.provider, {
          jobId: job.id,
          folder,
          stagedFiles,
          temp: job.attachmentsMeta?.temp || [],
        });
        LogManager.addEvent(
          "archive",
          "info",
          "Archive copy deferred until sync",
          {
            jobId: job.id,
            provider: job.provider,
            folder,
          },
        );
      } else {
        await FileManager.commandCleanup(
          job.id,
          job.attachmentsMeta?.temp || [],
        );
      }
    } catch (err) {
      LogManager.addEvent(
        "core",
        "warning",
        `Sync/temizlik hatası: ${err.message}`,
        {
          jobId: job.id,
        },
      );
    }
  }

  handleJobFailure(job, error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    TrafficManager.signal(job.provider, "error", errorMessage);
    FileManager.commandFail(job.id, job.attachmentsMeta?.temp || []);
    LogManager.addEvent(
      "command",
      "error",
      `Komut hata: ${job.provider} - ${errorMessage}`,
      {
        jobId: job.id,
      },
    );
  }
}

export const CommandExecutor = new CommandExecutorClass();
