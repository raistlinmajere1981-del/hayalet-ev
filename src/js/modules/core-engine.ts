import { Logger, LogCategory, LogLevel } from "./logger/index.js";
import { AppState } from "./app-state.js";
import { CommandManager } from "./command-manager.js";
import { TrafficManager } from "./traffic-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { AppI18n } from "./i18n/index.js";
import { registerSlotBridgeCoreEngine } from "./commands/slot-bridge-runtime.js";
import {
  replaceProtocolTags,
  sendBatchWithContext,
  sendMessageWithContext,
  sendToTargetsWithContext,
  type SendBatchParams,
} from "./core/send-actions.js";
import {
  handleRelayDisconnectAutoStop as handleCoreRelayDisconnectAutoStop,
  initializeCoreRuntime,
  type RelayManagerRef,
} from "./core/runtime-actions.js";
import {
  destroyWhisperActions,
  enqueueWhisperJobWithContext,
  handleCaughtCommandWithContext,
  pauseWhispers,
  resolveSlotForAccount,
  resumeWhispers,
  runWhisperOperation,
  type CaughtCommandPayload,
  type ServerCommandsRef,
  type WhisperRecord,
} from "./core/whisper-actions.js";
// NOTE: ServerCommands injected from app bootstrap to break circular dependency.
let _serverCommands: ServerCommandsRef | null = null;
function registerServerCommands(sc: ServerCommandsRef): void {
  _serverCommands = sc;
}
function getServerCommands(): ServerCommandsRef {
  if (_serverCommands === null)
    throw new Error(AppI18n.t("app.logs.coreEngine.serverCommandsNotRegistered"));
  return _serverCommands;
}
import { SlotController } from "./slot-controller.js";
import { ConversationSyncer } from "./webview/conversation-syncer.js";
import type { AppSettings } from "@shared/settings.js";

function coreEngineT(key: string): string {
  return AppI18n.t(`app.logs.coreEngine.${key}`);
}

interface ConnectionResult {
  success: boolean;
  message?: string;
  correlationId?: string;
}

interface SendProtocolParams {
  room?: string;
  scenario?: string;
  targets?: string[];
  context?: Record<string, unknown>;
  mode?: string | null;
  preface?: string | null;
}

class CoreEngineClass {
  settings: AppSettings | null;
  initialized: boolean;
  relay: RelayManagerRef | null;
  _settingsSub: (() => void) | null;
  _previousSettings: AppSettings | null;
  _cleanupInterval: ReturnType<typeof setInterval> | null;
  _commandSentUnsub: (() => void) | null;
  _commandFailedUnsub: (() => void) | null;
  _slotTrafficStartedUnsub: (() => void) | null;
  _slotTrafficStoppedUnsub: (() => void) | null;
  _slotDisconnectCompleteUnsub: (() => void) | null;

  constructor() {
    this.settings = null;
    this.initialized = false;
    this.relay = null;
    this._settingsSub = null;
    this._previousSettings = null;
    this._cleanupInterval = null;
    this._commandSentUnsub = null;
    this._commandFailedUnsub = null;
    this._slotTrafficStartedUnsub = null;
    this._slotTrafficStoppedUnsub = null;
    this._slotDisconnectCompleteUnsub = null;
  }

  async init(): Promise<AppSettings | null> {
    if (this.initialized) {
      return this.settings;
    }

    const runtimeState = await initializeCoreRuntime({
      coreEngine: this,
      applySettingsUpdate: (settings) => {
        this.useSettings(settings);
        this._previousSettings = JSON.parse(JSON.stringify(settings)) as AppSettings;
      },
      handleRelayDisconnectAutoStop: async (slot) => {
        await this._handleRelayDisconnectAutoStop(slot);
      },
    });

    this.settings = runtimeState.settings;
    this.relay = runtimeState.relay;
    this._cleanupInterval = runtimeState.cleanupInterval;
    this._settingsSub = runtimeState.settingsSub;
    this._commandSentUnsub = runtimeState.commandSentUnsub;
    this._commandFailedUnsub = runtimeState.commandFailedUnsub;
    this._slotTrafficStartedUnsub = runtimeState.slotTrafficStartedUnsub;
    this._slotTrafficStoppedUnsub = runtimeState.slotTrafficStoppedUnsub;
    this._slotDisconnectCompleteUnsub = runtimeState.slotDisconnectCompleteUnsub;
    this._previousSettings =
      this.settings !== null ? (JSON.parse(JSON.stringify(this.settings)) as AppSettings) : null;
    this.initialized = true;

    return this.settings;
  }

  async setConnection(
    provider: string,
    connected: boolean,
    opts: { force?: boolean; url?: string } = {}
  ): Promise<ConnectionResult> {
    if (provider === "") return { success: false, message: coreEngineT("noProvider") };

    if (provider !== "ai0" && provider !== "ai1" && provider !== "ai2") {
      return { success: false, message: coreEngineT("invalidProvider") };
    }

    const prev = AppState.isConnected(provider);
    const now = connected === true;
    const force = opts.force === true;
    const url = opts.url;

    Logger.debugT(
      LogCategory.SYSTEM,
      "app.logs.coreEngine.setConnection",
      {
        provider,
        now: String(now),
        force: String(force),
        prev: String(prev),
      },
      {
        context: { provider, now, force, prev, ...(url !== undefined ? { url } : {}) },
      }
    );

    if (!force && prev === now) {
      return { success: true, message: coreEngineT("noChange") };
    }

    let result;
    if (now) {
      result = await SlotController.connect(provider, {
        force,
        ...(url !== undefined ? { url } : {}),
      });
    } else {
      result = await SlotController.disconnect(provider, { force });
    }

    return result;
  }

  async ensureReady(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  useSettings(settings: AppSettings | null): AppSettings | null {
    if (settings) {
      this.settings = settings;
      WebviewManager.setSettings(this.settings);
    }
    return this.settings;
  }

  async sendBatch({
    targets = [],
    text = "",
    page = "generic",
    archiveFolders = {},
    attachments = [],
    jobIds = {},
  }: SendBatchParams = {}): Promise<{ success: boolean; message?: string }> {
    return await sendBatchWithContext(
      {
        targets,
        text,
        page,
        archiveFolders,
        attachments,
        jobIds,
      },
      {
        ensureReady: this.ensureReady.bind(this),
        setActiveTargets: this.setActiveTargets.bind(this),
      }
    );
  }

  async sendMessage(
    p: { provider?: string; text?: string; page?: string } | null
  ): Promise<{ success: boolean; message?: string }> {
    return await sendMessageWithContext(p, {
      ensureReady: this.ensureReady.bind(this),
      setActiveTargets: this.setActiveTargets.bind(this),
    });
  }

  async sendToTargets(
    p: { targets?: string[]; text?: string; page?: string } | null
  ): Promise<{ success: boolean; message?: string }> {
    return await sendToTargetsWithContext(p, {
      ensureReady: this.ensureReady.bind(this),
      setActiveTargets: this.setActiveTargets.bind(this),
    });
  }

  async sendProtocol({
    room = "",
    scenario = "",
    targets = [],
    context = {},
    mode = null,
    preface = null,
  }: SendProtocolParams = {}): Promise<{ success: boolean; message?: string }> {
    await this.ensureReady();

    if (room === "analyze" && scenario === "ai-ai" && mode === "aiRelaySequential") {
      const [{ ProtocolHandler: protocolHandler }, { resolveComposedProtocolMessage }] =
        await Promise.all([
          import("./protocol-handler.js"),
          import("./protocol-message-composer.js"),
        ]);
      const protocolPayload = protocolHandler.buildPayload({
        room,
        scenario,
        targets,
        context,
      });
      if (protocolPayload === null) {
        return { success: false, message: AppI18n.t("app.commands.executor.unknownProtocol") };
      }

      const orderedTargets = [...protocolPayload.targets];
      const starter = typeof context["starter"] === "string" ? context["starter"] : null;
      if (starter !== null && orderedTargets.includes(starter) === true) {
        orderedTargets.splice(orderedTargets.indexOf(starter), 1);
        orderedTargets.unshift(starter);
      }

      if (orderedTargets.length === 0) {
        return { success: false, message: AppI18n.t("app.commands.executor.noConnectedTarget") };
      }

      const resolvedMessage = await resolveComposedProtocolMessage({
        fallbackTitle: protocolPayload.message,
        ...(typeof protocolPayload.protocolKey === "string" && protocolPayload.protocolKey !== ""
          ? { protocolKey: protocolPayload.protocolKey }
          : {}),
        ...(preface !== null ? { preface } : {}),
      });

      if (this.relay !== null) {
        await this.relay.startProtocolSession({
          providers: orderedTargets,
          protocolPayload: {
            room,
            scenario,
            targets: orderedTargets,
            context,
            message: replaceProtocolTags(resolvedMessage.message),
          },
          attachments: [],
        });
      }

      return { success: true, message: "sequential-session-started" };
    }

    const { slotBridgeHandler } = await import("./commands/slot-bridge.js");
    const bridgeResult = await slotBridgeHandler({
      action: "message.send",
      fromSlot: "system",
      ...(targets.length === 1 ? { toSlot: targets[0] } : { toSlots: targets }),
      payload: {
        protocol: {
          room,
          scenario,
          ...(preface !== null ? { preface } : {}),
          ...(Object.keys(context).length > 0 ? { context } : {}),
        },
      },
      provider: "system",
      source: "system",
      message: "++cmd:SlotBridge",
    });

    try {
      if (bridgeResult.success === true && room === "analyze") {
        if (scenario === "ai-ai") {
          if (this.relay !== null) {
            void this.relay.startSession({ providers: targets });
          }
        }
        if (scenario === "ai-ai-stop") {
          if (this.relay !== null) {
            void this.relay.stopProtocolSession();
            void this.relay.stopSession();
          }
        }
        if (scenario === "ai-assistant-stop") {
          if (this.relay !== null) {
            void this.relay.stopAssistantRelaySession();
          }
        }
      }
    } catch (error) {
      Logger.warn(
        LogCategory.RELAY,
        AppI18n.t("app.commands.executor.protocolRelayActionFailed", {
          message: error instanceof Error ? error.message : String(error),
        }),
        {
          error: error instanceof Error ? error : new Error(String(error)),
          context: { room, scenario },
        }
      );
    }

    return {
      success: bridgeResult.success,
      ...(bridgeResult.message !== undefined ? { message: bridgeResult.message } : {}),
    };
  }

  async _handleRelayDisconnectAutoStop(slot: string): Promise<void> {
    await handleCoreRelayDisconnectAutoStop(slot, {
      relay: this.relay,
      sendProtocol: async (payload) => await this.sendProtocol(payload),
    });
  }

  async whisper(
    op: string,
    args?: {
      accountId?: string;
      text?: string;
      when?: unknown;
      id?: string;
      patch?: { text?: string; when?: unknown };
    }
  ): Promise<unknown> {
    return await runWhisperOperation(op, args);
  }

  pauseWhispers(): void {
    pauseWhispers();
  }

  resumeWhispers(runCheck = false): void {
    resumeWhispers(runCheck);
  }

  resolveSlotForAccount(accountId: string): "ai1" | "ai2" | null {
    return resolveSlotForAccount(accountId);
  }

  async enqueueWhisperJob(
    accountId: string,
    record: WhisperRecord = {},
    messageOverride = ""
  ): Promise<{ success: boolean; jobId?: string; message?: string }> {
    return await enqueueWhisperJobWithContext(accountId, record, messageOverride, {
      ensureReady: this.ensureReady.bind(this),
      sendMessage: this.sendMessage.bind(this),
      getServerCommands,
    });
  }

  async handleCaughtCommand(
    commandName: string,
    payload: CaughtCommandPayload = {}
  ): Promise<{ success: boolean; message?: string; jobId?: string; priority?: string }> {
    return await handleCaughtCommandWithContext(commandName, payload, {
      ensureReady: this.ensureReady.bind(this),
      sendMessage: this.sendMessage.bind(this),
      getServerCommands,
    });
  }

  replaceProtocolTags(text: string): string {
    return replaceProtocolTags(text);
  }

  setActiveTargets(targets: string[] = []): void {
    AppState.setChatTargets(targets);
  }

  listCommands(): unknown[] {
    return CommandManager.list();
  }

  destroy(): void {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    if (this._settingsSub) {
      this._settingsSub();
      this._settingsSub = null;
    }
    if (this._commandSentUnsub) {
      this._commandSentUnsub();
      this._commandSentUnsub = null;
    }
    if (this._commandFailedUnsub) {
      this._commandFailedUnsub();
      this._commandFailedUnsub = null;
    }
    if (this._slotTrafficStartedUnsub) {
      this._slotTrafficStartedUnsub();
      this._slotTrafficStartedUnsub = null;
    }
    if (this._slotTrafficStoppedUnsub) {
      this._slotTrafficStoppedUnsub();
      this._slotTrafficStoppedUnsub = null;
    }
    if (this._slotDisconnectCompleteUnsub) {
      this._slotDisconnectCompleteUnsub();
      this._slotDisconnectCompleteUnsub = null;
    }
    destroyWhisperActions();
    TrafficManager.destroy();
    ConversationSyncer.destroy();
    Logger.shutdown();
    import("../ui/toast-manager.js")
      .then(({ ToastManager }) => {
        ToastManager.destroy();
      })
      .catch(() => {});
    this.initialized = false;
    Logger.panelT(LogCategory.SYSTEM, LogLevel.INFO, "app.logs.coreEngine.destroyed");
  }
}

const coreEngine = new CoreEngineClass();
registerSlotBridgeCoreEngine(coreEngine);
export { coreEngine as CoreEngine, registerServerCommands };
export type { ServerCommandsRef };
export type CoreEngine = CoreEngineClass;
