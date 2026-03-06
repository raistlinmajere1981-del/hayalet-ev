import { getFilename, generateUniqueId } from "../../constants/index.js";
import { AppState } from "../app-state.js";
import { CommandManager } from "../command-manager.js";
import type { CommandJob } from "../command-manager.js";
import { FileManager } from "../file-manager.js";
import { Logger, LogCategory, LogLevel } from "../logger/index.js";
import { ProtocolHandler } from "../protocol-handler.js";
import { resolveComposedProtocolMessage } from "../protocol-message-composer.js";
import { SlotController } from "../slot-controller.js";

export interface AttachmentInput {
  name?: string;
  path?: string;
  commandPath?: string;
}

export interface SendBatchParams {
  targets?: string[];
  text?: string;
  page?: string;
  archiveFolders?: Record<string, string>;
  attachments?: Array<string | AttachmentInput>;
  jobIds?: Record<string, string>;
}

export interface SendProtocolParams {
  room?: string;
  scenario?: string;
  targets?: string[];
  context?: Record<string, unknown>;
  mode?: string | null;
}

interface RelayRef {
  startProtocolSession?: (payload: {
    providers: string[];
    protocolPayload: Record<string, unknown>;
    attachments: Array<{ name: string; path: string }>;
  }) => Promise<void>;
  startSession?: (payload: { providers: string[] }) => Promise<void>;
  stopProtocolSession?: () => Promise<void>;
  stopSession?: () => Promise<void>;
  stopAIAsistanSession?: () => Promise<void>;
}

interface SendBatchContext {
  ensureReady: () => Promise<void>;
  setActiveTargets: (targets: string[]) => void;
}

interface SendProtocolContext {
  ensureReady: () => Promise<void>;
  sendBatch: (params: SendBatchParams) => Promise<{
    success: boolean;
    message?: string;
  }>;
  relay: RelayRef | null;
}

export function replaceProtocolTags(text: string): string {
  return text
    .replace(/<AI0>/g, AppState.getNickname("ai0"))
    .replace(/<AI1>/g, AppState.getNickname("ai1"))
    .replace(/<AI2>/g, AppState.getNickname("ai2"));
}

export async function sendBatchWithContext(
  {
    targets = [],
    text = "",
    page = "generic",
    archiveFolders = {},
    attachments = [],
    jobIds = {},
  }: SendBatchParams = {},
  context: SendBatchContext
): Promise<{ success: boolean; message?: string }> {
  await context.ensureReady();

  const list = (Array.isArray(targets) ? targets : [targets]).filter(
    (target): target is string => typeof target === "string" && target !== ""
  );
  if (list.length === 0) {
    return { success: false, message: "Hedef yok" };
  }

  const attachmentItems = attachments.map((attachment: string | AttachmentInput) => {
    const name =
      typeof attachment === "string"
        ? getFilename(attachment)
        : (attachment.name ?? getFilename(attachment.path ?? attachment.commandPath ?? ""));
    const path =
      typeof attachment === "string"
        ? attachment
        : (attachment.path ?? attachment.commandPath ?? attachment.name);
    return { name, path: path ?? "" };
  });
  const attachmentPaths = attachmentItems
    .map((attachment) => attachment.path)
    .filter((path): path is string => typeof path === "string" && path !== "");
  const hasAttachments = attachmentPaths.length > 0;

  const jobs: Partial<CommandJob>[] = await Promise.all(
    list.map(async (provider) => {
      const jobId = jobIds[provider] ?? generateUniqueId("cmd");
      let staged: { staged: unknown[]; temp: string[]; commandDir: string } = {
        staged: [],
        temp: [],
        commandDir: "",
      };

      if (hasAttachments) {
        const stageResult = (await FileManager.stageCommandFiles(jobId, attachmentPaths)) as {
          staged: unknown[];
          temp: string[];
          commandDir: string;
        };
        staged = stageResult;
        Logger.info(LogCategory.COMMAND, `Dosyalar komut için hazırlandı (${jobId})`, {
          context: {
            jobId,
            count: staged.staged.length,
          },
        });
      }

      const stagedEntries = staged.staged.map((entry) => {
        const item = entry as {
          name?: string;
          renamedName?: string;
          originalName?: string;
          commandPath?: string;
        };
        return {
          ...item,
          path: item.commandPath ?? "",
          name:
            item.name ??
            item.renamedName ??
            item.originalName ??
            getFilename(item.commandPath ?? ""),
        };
      });

      return {
        id: jobId,
        provider,
        message: text,
        attachments: stagedEntries,
        attachmentsMeta: {
          ...staged,
          staged: stagedEntries,
          stagedFiles: stagedEntries,
          temp: [] as string[],
        },
        meta: {
          targets: list,
          page,
          attachments: stagedEntries,
          archiveFolders,
        },
      };
    })
  );

  void CommandManager.enqueue(jobs);
  Logger.info(LogCategory.COMMAND, `Komut kuyruğa alındı (${jobs.length} iş)`, {
    context: {
      targets: list,
      page,
    },
  });
  context.setActiveTargets(list);
  return { success: true };
}

export async function sendMessageWithContext(
  payload: { provider?: string; text?: string; page?: string } | null,
  context: SendBatchContext
): Promise<{ success: boolean; message?: string }> {
  const { provider = "ai1", text = "", page = "generic" } = payload ?? {};
  return await sendBatchWithContext(
    {
      targets: [provider],
      text,
      page,
    },
    context
  );
}

export async function sendToTargetsWithContext(
  payload: { targets?: string[]; text?: string; page?: string } | null,
  context: SendBatchContext
): Promise<{ success: boolean; message?: string }> {
  return await sendBatchWithContext(
    {
      targets: payload?.targets ?? [],
      text: payload?.text ?? "",
      page: payload?.page ?? "generic",
    },
    context
  );
}

export async function sendProtocolWithContext(
  { room = "", scenario = "", targets = [], context = {}, mode = null }: SendProtocolParams = {},
  sendContext: SendProtocolContext
): Promise<{ success: boolean; message?: string }> {
  await sendContext.ensureReady();

  const payload = ProtocolHandler.buildPayload({
    room,
    scenario,
    targets,
    context,
  });
  if (!payload) {
    Logger.warn(LogCategory.SYSTEM, `Bilinmeyen protokol: ${room}:${scenario}`, {
      context: { room, scenario },
    });
    return { success: false, message: "Bilinmeyen protokol" };
  }

  const targetList = ((payload.targets as string[] | undefined) ?? []).filter(
    (target) => SlotController.isConnected(target) === true
  );
  if (targetList.length === 0) {
    Logger.warn(LogCategory.SYSTEM, "Protokol gönderilemedi, bağlı AI yok");
    return { success: false, message: "Bağlı hedef yok" };
  }

  const fallbackTitle = typeof payload.message === "string" ? payload.message : "";
  const protocolKey =
    typeof payload.protocolKey === "string" && payload.protocolKey !== ""
      ? payload.protocolKey
      : undefined;
  const resolveOptions =
    protocolKey !== undefined ? { fallbackTitle, protocolKey } : { fallbackTitle };
  const resolvedMessage = await resolveComposedProtocolMessage(resolveOptions);

  payload.message = replaceProtocolTags(resolvedMessage.message);

  if (resolvedMessage.error !== undefined) {
    Logger.error(LogCategory.SYSTEM, `Protokol yüklenemedi: ${resolvedMessage.error.message}`, {
      error: resolvedMessage.error,
      context: { protocolKey },
    });
  }

  if (protocolKey !== undefined && resolvedMessage.bodyLoaded) {
    Logger.info(LogCategory.SYSTEM, `Protokol gövdesi yüklendi: ${protocolKey}`);
  }

  const attachments = (
    ((payload as Record<string, unknown>)["attachments"] as
      | Array<{ name?: string; path?: string }>
      | undefined) ?? []
  ).map((attachment) => ({
    name: attachment.name ?? getFilename(attachment.path ?? ""),
    path: attachment.path ?? "",
  }));

  if (room === "analyze" && scenario === "ai-ai" && mode === "aiRelaySequential") {
    try {
      let orderedTargets = [...targetList];
      const contextStarter =
        typeof context === "object" && "starter" in context ? context["starter"] : null;
      if (contextStarter !== null && orderedTargets.includes(contextStarter as string)) {
        orderedTargets = [
          contextStarter as string,
          ...orderedTargets.filter((target) => target !== contextStarter),
        ];
      }

      if (sendContext.relay?.startProtocolSession !== undefined) {
        await sendContext.relay.startProtocolSession({
          providers: orderedTargets,
          protocolPayload: payload as Record<string, unknown>,
          attachments,
        });
        Logger.info(
          LogCategory.SYSTEM,
          `Started sequential protocol session for ${orderedTargets.join(", ")}`,
          {
            context: { targets: orderedTargets },
          }
        );
      }
      return { success: true, message: "sequential-session-started" };
    } catch (error) {
      Logger.error(
        LogCategory.SYSTEM,
        `Failed to start sequential session: ${error instanceof Error ? error.message : String(error)}`,
        {
          error: error instanceof Error ? error : new Error(String(error)),
        }
      );
    }
  }

  const result = await sendContext.sendBatch({
    targets: targetList,
    text: payload.message,
    attachments,
    page: `protocol-${room}`,
  });

  try {
    if (room === "analyze") {
      if (scenario === "ai-ai") {
        void sendContext.relay?.startSession?.({ providers: targetList });
      }
      if (scenario === "ai-ai-stop") {
        if (sendContext.relay !== null) {
          void sendContext.relay.stopProtocolSession?.();
          void sendContext.relay.stopSession?.();
        }
      }
      if (scenario === "ai-asistan-stop") {
        if (sendContext.relay !== null) {
          void sendContext.relay.stopAIAsistanSession?.();
        }
      }
    }
  } catch (error) {
    Logger.warn(
      LogCategory.RELAY,
      `Failed to apply relay action from protocol: ${error instanceof Error ? error.message : String(error)}`,
      {
        error: error instanceof Error ? error : new Error(String(error)),
        context: { room, scenario },
      }
    );
  }

  if (result.success === true) {
    Logger.panel(
      LogCategory.SYSTEM,
      LogLevel.INFO,
      `Protokol gönderildi: ${room}:${scenario} -> ${targetList.join(", ")}`,
      {
        context: { room, scenario, targets: targetList },
      }
    );
  } else {
    Logger.error(
      LogCategory.SYSTEM,
      `Protokol hata: ${result.message ?? "bilinmiyor"} (${room}:${scenario})`,
      {
        context: { room, scenario, message: result.message },
      }
    );
  }

  return result;
}
