import type { CoreEngine } from "./core-engine.js";
import type { CommandJob } from "./command-manager.js";
import { LogCategory } from "@shared/logging-core";
import { FileManager } from "./file-manager.js";
import { Logger } from "./logger/index.js";

import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { getErrorMessage } from "@shared/index.js";

interface WebviewSendResult {
  success: boolean;
  message?: string;
  code?: string;
}

class CommandExecutorClass {
  coreEngine: typeof CoreEngine | null;

  constructor() {
    this.coreEngine = null;
  }

  init(coreEngineInstance: typeof CoreEngine): void {
    this.coreEngine = coreEngineInstance;
  }

  async executeJob(job: CommandJob): Promise<WebviewSendResult> {
    const startTime = Date.now();
    const hasAttachments = job.attachments.length > 0;
    const pageMeta = job.meta["page"];
    const page = typeof pageMeta === "string" ? pageMeta : "";

    Logger.info(LogCategory.COMMAND, `Job başlatılıyor: ${job.provider}`, {
      eventType: "coreengine-ai-send",
      detail: "Gönderim kuyruğa alındı",
      provider: job.provider,
      category: "command",
      hasAttachments,
      attachmentCount: job.attachments.length,
      messageLength: job.message.length,
      jobId: job.id,
      page,
      timestamp: new Date().toLocaleString("tr-TR"),
    });

    const result = (await WebviewManager.send({
      provider: job.provider,
      text: job.message,
      attachments: job.attachments,
    })) as WebviewSendResult | undefined;

    const duration = Date.now() - startTime;

    if (result === undefined || result.success === false) {
      Logger.error(
        LogCategory.COMMAND,
        `Job başarısız: ${job.provider} - ${result?.message ?? "E_WEBVIEW_SEND"}`,
        {
          category: "command",
          provider: job.provider,
          duration,
          errorCode: result?.code ?? "E_WEBVIEW_SEND",
          jobId: job.id,
        }
      );
      const err = new Error(result?.message ?? "E_WEBVIEW_SEND") as Error & { code?: string };
      err.code = result?.code ?? "E_WEBVIEW_SEND";
      throw err;
    }

    Logger.info(LogCategory.COMMAND, `Job tamamlandı: ${job.provider} (${duration}ms)`, {
      eventType: "coreengine-ai-send",
      detail: `Gönderim tamamlandı (${duration}ms)`,
      provider: job.provider,
      category: "command",
      duration,
      jobId: job.id,
      page,
      timestamp: new Date().toLocaleString("tr-TR"),
    });

    return result;
  }

  handleJobSuccess(job: CommandJob): void {
    TrafficManager.signal(job.provider, "sent", job.message);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const folder = job.meta?.archiveFolders?.[job.provider];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const stagedFiles = job.attachmentsMeta?.staged ?? job.meta?.attachments ?? [];

      if (stagedFiles.length > 0) {
        WebviewManager.addPendingArchive(job.provider, {
          jobId: job.id,
          folder: folder ?? "", // folder can be empty, will be determined from conversationId
          temp: job.attachmentsMeta?.temp ?? [],
          stagedFiles: stagedFiles, // Pass stagedFiles to PendingArchiveHandler
        } as { jobId: string; folder: string; temp?: string[]; stagedFiles?: unknown[] });
        Logger.info(LogCategory.COMMAND, "Archive copy deferred until sync", {
          category: "archive",
          jobId: job.id,
          provider: job.provider,
          folder: folder ?? "(new conversation)",
          fileCount: stagedFiles.length,
        });
      } else {
        FileManager.commandCleanup(
          job.id,
          (job.attachmentsMeta?.temp ?? []).map((t: string) => ({ tempPath: t }))
        );
      }
    } catch (err) {
      Logger.warn(LogCategory.COMMAND, `Sync/temizlik hatası: ${getErrorMessage(err)}`, {
        category: "core",
        jobId: job.id,
      });
    }
  }

  handleJobFailure(job: CommandJob, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    TrafficManager.signal(job.provider, "error", errorMessage);
    void FileManager.commandFail(
      job.id,
      (job.attachmentsMeta?.temp ?? []).map((t: string) => ({ tempPath: t }))
    ).catch((err) => {
      Logger.error(LogCategory.COMMAND, "commandFail error", { error: err });
    });
    Logger.error(LogCategory.COMMAND, `Komut hata: ${job.provider} - ${errorMessage}`, {
      category: "command",
      jobId: job.id,
    });
  }
}

const commandExecutor = new CommandExecutorClass();
export { commandExecutor as CommandExecutor };
