import type { CoreEngine } from "./core-engine.js";
import { FileManager } from "./file-manager.js";
import { LogManager } from "./log-manager.js";
import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { getErrorMessage } from "../types/index.js";

interface CommandJob {
  id: string;
  provider: string;
  message?: string;
  attachments?: unknown[];
  attachmentsMeta?: {
    staged?: unknown[];
    temp?: string[];
  };
  meta?: {
    archiveFolders?: Record<string, string>;
    attachments?: unknown[];
  };
}

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

  init(coreEngineInstance: typeof CoreEngine) {
    this.coreEngine = coreEngineInstance;
  }

  async executeJob(job: CommandJob) {
    const startTime = Date.now();
    const hasAttachments = (job.attachments?.length ?? 0) > 0;
    
    LogManager.addEventWithContext(
      "command",
      "info",
      `Job başlatılıyor: ${job.provider}`,
      {
        provider: job.provider,
        hasAttachments,
        attachmentCount: job.attachments?.length || 0,
        messageLength: job.message?.length || 0,
      },
      job.id
    );

    const result = await WebviewManager.send({
      provider: job.provider,
      text: job.message || "",
      attachments: job.attachments,
    }) as WebviewSendResult | undefined;

    const duration = Date.now() - startTime;

    if (!result?.success) {
      LogManager.addEventWithContext(
        "command",
        "error",
        `Job başarısız: ${job.provider} - ${result?.message || "E_WEBVIEW_SEND"}`,
        {
          provider: job.provider,
          duration,
          errorCode: result?.code || "E_WEBVIEW_SEND",
        },
        job.id
      );
      const err = new Error(result?.message || "E_WEBVIEW_SEND") as Error & { code?: string };
      err.code = result?.code || "E_WEBVIEW_SEND";
      throw err;
    }
    
    LogManager.addEventWithContext(
      "command",
      "info",
      `Job tamamlandı: ${job.provider} (${duration}ms)`,
      { provider: job.provider, duration },
      job.id
    );
    
    return result;
  }

  async handleJobSuccess(job: CommandJob) {
    TrafficManager.signal(job.provider, "sent", job.message || "");
    try {
      const folder = job.meta?.archiveFolders?.[job.provider];
      const stagedFiles =
        job.attachmentsMeta?.staged || job.meta?.attachments || [];

      if (folder && stagedFiles.length > 0) {
        WebviewManager.addPendingArchive(job.provider, {
          jobId: job.id,
          folder,
          temp: job.attachmentsMeta?.temp || [],
        } as { jobId: string; folder: string; temp?: string[]; stagedFiles?: unknown[] });
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
          (job.attachmentsMeta?.temp || []).map((t: string) => ({ tempPath: t })),
        );
      }
    } catch (err) {
      LogManager.addEvent(
        "core",
        "warning",
        `Sync/temizlik hatası: ${getErrorMessage(err)}`,
        {
          jobId: job.id,
        },
      );
    }
  }

  handleJobFailure(job: CommandJob, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    TrafficManager.signal(job.provider, "error", errorMessage);
    FileManager.commandFail(job.id, (job.attachmentsMeta?.temp || []).map((t: string) => ({ tempPath: t })));
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
