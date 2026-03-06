import { getErrorMessage } from "@shared/index.js";
import { TIMEOUTS } from "@timeouts";
import type { AppSettings } from "@shared/settings.js";
import { AppState } from "../app-state.js";
import { CommandExecutor } from "../command-executor.js";
import { CommandManager } from "../command-manager.js";
import type { CommandJob } from "../command-manager.js";
import { ErrorBoundary } from "../error-boundary.js";
import { FileManager } from "../file-manager.js";
import { Logger, LogCategory } from "../logger/index.js";
import { RelayManager } from "../relay-manager.js";
import { SettingsManager } from "../settings-manager.js";
import { SlotController, SlotEvent } from "../slot-controller.js";
import { TrafficManager } from "../traffic-manager.js";
import { WebviewManager } from "../webview-manager.js";

interface RelayRef {
  isAIAIActive(): boolean;
  isAIAsistanActive(): boolean;
  stopProtocolSession(): Promise<void>;
  stopSession(): Promise<void>;
  stopAIAsistanSession(): Promise<void>;
  getAIAsistanSourceSlot(): string | null;
}

export type RelayManagerRef = typeof RelayManager;

export interface CoreRuntimeHandles {
  settings: AppSettings | null;
  relay: RelayManagerRef | null;
  cleanupInterval: ReturnType<typeof setInterval> | null;
  settingsSub: (() => void) | null;
  commandSentUnsub: (() => void) | null;
  commandFailedUnsub: (() => void) | null;
  slotTrafficStartedUnsub: (() => void) | null;
  slotTrafficStoppedUnsub: (() => void) | null;
  slotDisconnectCompleteUnsub: (() => void) | null;
}

interface CoreRuntimeEngineRef {
  enqueueWhisperJob: (
    accountId: string,
    record?: { id?: string; text?: string; when?: unknown },
    messageOverride?: string
  ) => Promise<{ success: boolean; message?: string }>;
}

interface InitializeCoreRuntimeParams {
  coreEngine: CoreRuntimeEngineRef;
  applySettingsUpdate: (settings: AppSettings) => void;
  handleRelayDisconnectAutoStop: (slot: string) => Promise<void>;
}

export async function initializeCoreRuntime(
  params: InitializeCoreRuntimeParams
): Promise<CoreRuntimeHandles> {
  ErrorBoundary.init();

  const settings = await SettingsManager.load();
  WebviewManager.setSettings(settings);
  await FileManager.ensureDirs("all");
  AppState.init("ai1");
  await CommandManager.init();

  const cleanupInterval = setInterval(() => {
    try {
      WebviewManager.cleanupInactiveWebviews();
    } catch (error) {
      Logger.warn(LogCategory.SYSTEM, `Cleanup error: ${getErrorMessage(error)}`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, TIMEOUTS.CLEANUP_INTERVAL);

  CommandExecutor.init(params.coreEngine as never);
  CommandManager.setExecutor(async (job) => await CommandExecutor.executeJob(job));

  const commandSentUnsub = CommandManager.on("sent", (payload: unknown) => {
    const normalized = payload as { job?: CommandJob };
    if (normalized.job !== undefined) {
      CommandExecutor.handleJobSuccess(normalized.job);
    }
  });

  const commandFailedUnsub = CommandManager.on("failed", (payload: unknown) => {
    const normalized = payload as { job?: CommandJob; error: unknown };
    if (normalized.job !== undefined) {
      CommandExecutor.handleJobFailure(normalized.job, normalized.error);
    }
  });

  let relay: typeof RelayManager | null = null;
  try {
    RelayManager.init(params.coreEngine as never);
    relay = RelayManager;
  } catch (error) {
    Logger.warn(
      LogCategory.SYSTEM,
      `RelayManager init failed: ${error instanceof Error ? error.message : String(error)}`,
      {
        error: error instanceof Error ? error : new Error(String(error)),
      }
    );
  }

  const whisperInitOptions = { settings: settings as unknown as Record<string, unknown> };
  const whisperManagerModule = await import("../whisper-manager.js");
  await whisperManagerModule.WhisperManager.init(whisperInitOptions);
  whisperManagerModule.WhisperManager.setSender(
    async (accountId: string, text: string, whisperId: string) => {
      const result = await params.coreEngine.enqueueWhisperJob(
        accountId,
        { id: whisperId, text },
        text
      );
      if (!result.success) {
        throw new Error(result.message ?? "Whisper kuyruğa alınamadı");
      }
    }
  );

  WebviewManager.initSyncer(params.coreEngine as never);
  await SlotController.init();

  const slotTrafficStartedUnsub = SlotController.on(
    SlotEvent.TRAFFIC_STARTED,
    ({ slot }: { slot?: string }) => {
      if (slot === undefined || slot === "") {
        return;
      }

      const webview = SlotController.getWebview(slot);
      if (webview !== null) {
        TrafficManager.attachWebview(slot, webview);
        TrafficManager.start(slot);
      }
    }
  );

  const slotTrafficStoppedUnsub = SlotController.on(
    SlotEvent.TRAFFIC_STOPPED,
    ({ slot }: { slot?: string }) => {
      if (slot === undefined || slot === "") {
        return;
      }
      TrafficManager.stop(slot);
    }
  );

  const slotDisconnectCompleteUnsub = SlotController.on(
    SlotEvent.DISCONNECT_COMPLETE,
    ({ slot }: { slot?: string }) => {
      if (slot !== "ai0" && slot !== "ai1" && slot !== "ai2") {
        return;
      }
      void params.handleRelayDisconnectAutoStop(slot);
    }
  );

  const settingsSub = SettingsManager.subscribe((payload) => {
    const { settings: nextSettings } = payload as { settings: AppSettings | null };
    if (nextSettings == null) {
      return;
    }
    params.applySettingsUpdate(nextSettings);
  });

  return {
    settings,
    relay,
    cleanupInterval,
    settingsSub,
    commandSentUnsub,
    commandFailedUnsub,
    slotTrafficStartedUnsub,
    slotTrafficStoppedUnsub,
    slotDisconnectCompleteUnsub,
  };
}

export async function handleRelayDisconnectAutoStop(
  slot: string,
  context: {
    relay: RelayRef | null;
    sendProtocol: (payload: {
      room: string;
      scenario: string;
      targets: string[];
    }) => Promise<{ success: boolean; message?: string }>;
  }
): Promise<void> {
  if (slot !== "ai0" && slot !== "ai1" && slot !== "ai2") {
    return;
  }
  if (context.relay === null) {
    return;
  }

  try {
    if (context.relay.isAIAIActive() === true && (slot === "ai1" || slot === "ai2")) {
      const remainingTarget = slot === "ai1" ? "ai2" : "ai1";

      if (SlotController.isConnected(remainingTarget) === true) {
        const stopResult = await context.sendProtocol({
          room: "analyze",
          scenario: "ai-ai-stop",
          targets: [remainingTarget],
        });

        if (stopResult.success === true) {
          return;
        }
      }

      await context.relay.stopProtocolSession();
      await context.relay.stopSession();
      return;
    }

    if (context.relay.isAIAsistanActive() !== true) {
      return;
    }

    const sourceSlot = context.relay.getAIAsistanSourceSlot();
    if (sourceSlot !== "ai1" && sourceSlot !== "ai2") {
      await context.relay.stopAIAsistanSession();
      return;
    }

    if (slot === sourceSlot) {
      await context.relay.stopAIAsistanSession();
      return;
    }

    if (slot === "ai0") {
      if (SlotController.isConnected(sourceSlot) === true) {
        const stopResult = await context.sendProtocol({
          room: "analyze",
          scenario: "ai-asistan-stop",
          targets: [sourceSlot],
        });

        if (stopResult.success === true) {
          return;
        }
      }

      await context.relay.stopAIAsistanSession();
    }
  } catch (error) {
    Logger.warn(
      LogCategory.RELAY,
      `Relay auto-stop on disconnect failed: ${error instanceof Error ? error.message : String(error)}`,
      {
        error: error instanceof Error ? error : new Error(String(error)),
        context: { slot },
      }
    );
  }
}
