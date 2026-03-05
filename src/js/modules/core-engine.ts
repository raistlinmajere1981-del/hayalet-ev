import { SettingsManager } from "./settings-manager.js";
import { getErrorMessage } from "@shared/index.js";
import { WebviewManager } from "./webview-manager.js";
import { Logger, LogCategory, LogLevel } from "./logger/index.js";
import { AppState } from "./app-state.js";
import { ProtocolHandler } from "./protocol-handler.js";
import { RelayManager } from "./relay-manager.js";
import { CommandManager } from "./command-manager.js";
import { CommandExecutor } from "./command-executor.js";
import { WhisperManager } from "./whisper-manager.js";
import { FileManager } from "./file-manager.js";
import { TrafficManager } from "./traffic-manager.js";
import { resolveComposedProtocolMessage } from "./protocol-message-composer.js";
// ServerCommands injected from app bootstrap to break circular dependency
type ServerCommandsRef = {
  list(): string[];
  run(name: string, payload: Record<string, unknown>): Promise<unknown>;
};
let _serverCommands: ServerCommandsRef | null = null;
function registerServerCommands(sc: ServerCommandsRef): void {
  _serverCommands = sc;
}
function getServerCommands(): ServerCommandsRef {
  if (_serverCommands === null)
    throw new Error("ServerCommands not registered — call registerServerCommands() at bootstrap");
  return _serverCommands;
}
import { SlotController, SlotEvent } from "./slot-controller.js";
import { ErrorBoundary } from "./error-boundary.js";
import { ConversationSyncer } from "./webview/conversation-syncer.js";
import { getFilename, generateUniqueId } from "../constants/index.js";
import { TIMEOUTS } from "@timeouts";
import type { AppSettings } from "@shared/settings.js";
import type { CommandJob, CommandResult } from "./command-manager.js";

interface ConnectionResult {
  success: boolean;
  message?: string;
  correlationId?: string;
}

interface SendBatchParams {
  targets?: string[];
  text?: string;
  page?: string;
  archiveFolders?: Record<string, string>;
  attachments?: (string | AttachmentInput)[];
  jobIds?: Record<string, string>;
}

interface AttachmentInput {
  name?: string;
  path?: string;
  commandPath?: string;
}

interface SendProtocolParams {
  room?: string;
  scenario?: string;
  targets?: string[];
  context?: Record<string, unknown>;
  mode?: string | null;
}

interface WhisperRecord {
  text?: string;
  id?: string;
  when?: unknown;
}

interface CaughtCommandPayload {
  provider?: string;
  args?: string;
  source?: string;
  webUrl?: string;
  target?: string;
  text?: string;
}

class CoreEngineClass {
  settings: AppSettings | null;
  initialized: boolean;
  relay: typeof RelayManager | null;
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

    // Initialize error boundary first (catches all subsequent errors)
    ErrorBoundary.init();

    this.settings = await SettingsManager.load();
    WebviewManager.setSettings(this.settings);
    await FileManager.ensureDirs("all");
    AppState.init("ai1");
    await CommandManager.init();

    this._cleanupInterval = setInterval(() => {
      try {
        WebviewManager.cleanupInactiveWebviews();
      } catch (err) {
        Logger.warn(LogCategory.SYSTEM, `Cleanup error: ${getErrorMessage(err)}`, {
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }, TIMEOUTS.CLEANUP_INTERVAL);
    CommandExecutor.init(this);
    CommandManager.setExecutor(async (job) => await CommandExecutor.executeJob(job));
    this._commandSentUnsub = CommandManager.on("sent", (payload: unknown) => {
      const p = payload as { job?: CommandJob };
      if (p.job !== undefined) {
        CommandExecutor.handleJobSuccess(p.job);
      }
    });
    this._commandFailedUnsub = CommandManager.on("failed", (payload: unknown) => {
      const p = payload as { job?: CommandJob; error: unknown };
      if (p.job !== undefined) {
        CommandExecutor.handleJobFailure(p.job, p.error);
      }
    });
    try {
      RelayManager.init(this);
      this.relay = RelayManager;
    } catch (e) {
      Logger.warn(
        LogCategory.SYSTEM,
        `RelayManager init failed: ${e instanceof Error ? e.message : String(e)}`,
        {
          error: e instanceof Error ? e : new Error(String(e)),
        }
      );
    }

    const whisperInitOptions = { settings: this.settings as unknown as Record<string, unknown> };
    await WhisperManager.init(whisperInitOptions);
    WhisperManager.setSender(async (accountId: string, text: string, whisperId: string) => {
      const result = await this.enqueueWhisperJob(accountId, { id: whisperId, text }, text);
      if (!result.success) {
        throw new Error(result.message ?? "Whisper kuyruğa alınamadı");
      }
    });
    WebviewManager.initSyncer(this);

    await SlotController.init();

    this._slotTrafficStartedUnsub = SlotController.on(
      SlotEvent.TRAFFIC_STARTED,
      ({ slot }: { slot?: string }) => {
        if (slot === undefined || slot === "") return;
        const webview = SlotController.getWebview(slot);
        if (webview !== null) {
          TrafficManager.attachWebview(slot, webview);
          TrafficManager.start(slot);
        }
      }
    );

    this._slotTrafficStoppedUnsub = SlotController.on(
      SlotEvent.TRAFFIC_STOPPED,
      ({ slot }: { slot?: string }) => {
        if (slot === undefined || slot === "") return;
        TrafficManager.stop(slot);
      }
    );

    this._slotDisconnectCompleteUnsub = SlotController.on(
      SlotEvent.DISCONNECT_COMPLETE,
      ({ slot }: { slot?: string }) => {
        if (slot !== "ai0" && slot !== "ai1" && slot !== "ai2") return;
        void this._handleRelayDisconnectAutoStop(slot);
      }
    );

    this.initialized = true;

    this._previousSettings = JSON.parse(JSON.stringify(this.settings)) as AppSettings;

    try {
      this._settingsSub = SettingsManager.subscribe((payload) => {
        const { settings } = payload as { settings: AppSettings | null };
        if (settings == null) return;

        this.useSettings(settings);
        this._previousSettings = JSON.parse(JSON.stringify(settings)) as AppSettings;
      });
    } catch (err) {
      Logger.warn(
        LogCategory.SYSTEM,
        `SettingsManager subscribe error: ${err instanceof Error ? err.message : String(err)}`,
        {
          error: err instanceof Error ? err : new Error(String(err)),
        }
      );
    }

    return this.settings;
  }

  async setConnection(
    provider: string,
    connected: boolean,
    opts: { force?: boolean; url?: string } = {}
  ): Promise<ConnectionResult> {
    if (provider === "") return { success: false, message: "no-provider" };

    if (provider !== "ai0" && provider !== "ai1" && provider !== "ai2") {
      return { success: false, message: "invalid-provider" };
    }

    const prev = SlotController.isConnected(provider);
    const now = connected === true;
    const force = opts.force === true;
    const url = opts.url;

    Logger.debug(
      LogCategory.SYSTEM,
      `setConnection ${provider} => ${String(now)} (force=${String(force)}, prev=${String(prev)})`,
      {
        context: { provider, now, force, prev, ...(url !== undefined ? { url } : {}) },
      }
    );

    if (!force && prev === now) {
      return { success: true, message: "no-change" };
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
    await this.ensureReady();
    const list = (Array.isArray(targets) ? targets : [targets]).filter(
      (t): t is string => typeof t === "string" && t !== ""
    );
    if (list.length === 0) return { success: false, message: "Hedef yok" };

    const attachmentItems = attachments.map((a: string | AttachmentInput) => {
      const name =
        typeof a === "string"
          ? getFilename(a)
          : (a.name ?? getFilename(a.path ?? a.commandPath ?? ""));
      const path = typeof a === "string" ? a : (a.path ?? a.commandPath ?? a.name);
      return { name: name, path: path ?? "" };
    });
    const attachmentPaths = attachmentItems
      .map((a) => a.path)
      .filter((p): p is string => typeof p === "string" && p !== "");
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
        const stagedEntries = staged.staged.map((s) => {
          const item = s as {
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
            stagedFiles: stagedEntries, // Add stagedFiles for PendingArchiveHandler
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
    this.setActiveTargets(list);
    return { success: true };
  }

  async sendMessage(
    p: { provider?: string; text?: string; page?: string } | null
  ): Promise<{ success: boolean; message?: string }> {
    const { provider = "ai1", text = "", page = "generic" } = p ?? {};
    return await this.sendBatch({
      targets: [provider],
      text,
      page,
    });
  }

  async sendToTargets(
    p: { targets?: string[]; text?: string; page?: string } | null
  ): Promise<{ success: boolean; message?: string }> {
    return await this.sendBatch({
      targets: p?.targets ?? [],
      text: p?.text ?? "",
      page: p?.page ?? "generic",
    });
  }

  async sendProtocol({
    room = "",
    scenario = "",
    targets = [],
    context = {},
    mode = null,
  }: SendProtocolParams = {}): Promise<{ success: boolean; message?: string }> {
    await this.ensureReady();
    /** @type {any} */
    const payload = ProtocolHandler.buildPayload({
      room,
      scenario,
      targets: /** @type {any} */ targets,
      context,
    });
    if (!payload) {
      Logger.warn(LogCategory.SYSTEM, `Bilinmeyen protokol: ${room}:${scenario}`, {
        context: { room, scenario },
      });
      return { success: false, message: "Bilinmeyen protokol" };
    }
    /** @type {any[]} */
    const targetList = ((payload.targets as string[] | undefined) ?? []).filter(
      (t) => SlotController.isConnected(t) === true
    );
    if (targetList.length === 0) {
      Logger.warn(LogCategory.SYSTEM, "Protokol gönderilemedi, bağlı AI yok");
      return { success: false, message: "Bağlı hedef yok" };
    }

    {
      const fallbackTitle = typeof payload.message === "string" ? payload.message : "";
      const protocolKey =
        typeof payload.protocolKey === "string" && payload.protocolKey !== ""
          ? payload.protocolKey
          : undefined;

      const resolveOptions =
        protocolKey !== undefined ? { fallbackTitle, protocolKey } : { fallbackTitle };

      const resolvedMessage = await resolveComposedProtocolMessage(resolveOptions);

      payload.message = this.replaceProtocolTags(resolvedMessage.message);

      if (resolvedMessage.error !== undefined) {
        Logger.error(LogCategory.SYSTEM, `Protokol yüklenemedi: ${resolvedMessage.error.message}`, {
          error: resolvedMessage.error,
          context: { protocolKey },
        });
      }

      if (protocolKey !== undefined && resolvedMessage.bodyLoaded) {
        Logger.info(LogCategory.SYSTEM, `Protokol gövdesi yüklendi: ${protocolKey}`);
      }
    }

    interface AttachmentData {
      name?: string;
      path?: string;
    }
    const attachments = (
      ((payload as Record<string, unknown>)["attachments"] as AttachmentData[] | undefined) ?? []
    ).map((att: AttachmentData) => ({
      name: att.name ?? getFilename(att.path ?? ""),
      path: att.path ?? "",
    }));
    if (room === "analyze" && scenario === "ai-ai" && mode === "aiRelaySequential") {
      try {
        let orderedTargets = [...targetList];
        const contextStarter =
          typeof context === "object" && "starter" in context ? context["starter"] : null;
        if (contextStarter !== null && orderedTargets.includes(contextStarter as string)) {
          orderedTargets = [
            contextStarter as string,
            ...orderedTargets.filter((t) => t !== contextStarter),
          ];
        }

        if (this.relay?.startProtocolSession !== undefined) {
          await this.relay.startProtocolSession({
            providers: orderedTargets,
            protocolPayload: payload,
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
      } catch (e) {
        Logger.error(
          LogCategory.SYSTEM,
          `Failed to start sequential session: ${e instanceof Error ? e.message : String(e)}`,
          {
            error: e instanceof Error ? e : new Error(String(e)),
          }
        );
      }
    }

    const res = await this.sendBatch({
      targets: /** @type {any[]} */ targetList,
      text: payload.message,
      attachments,
      page: `protocol-${room}`,
    });
    try {
      if (room === "analyze") {
        if (scenario === "ai-ai") {
          void this.relay?.startSession({ providers: targetList });
        }
        if (scenario === "ai-ai-stop") {
          if (this.relay !== null) {
            void this.relay.stopProtocolSession();
            void this.relay.stopSession();
          }
        }
        if (scenario === "ai-asistan-stop") {
          if (this.relay !== null) {
            void this.relay.stopAIAsistanSession();
          }
        }
      }
    } catch (e) {
      Logger.warn(
        LogCategory.RELAY,
        `Failed to apply relay action from protocol: ${e instanceof Error ? e.message : String(e)}`,
        {
          error: e instanceof Error ? e : new Error(String(e)),
          context: { room, scenario },
        }
      );
    }
    if (res.success === true) {
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
        `Protokol hata: ${res.message ?? "bilinmiyor"} (${room}:${scenario})`,
        {
          context: { room, scenario, message: res.message },
        }
      );
    }
    return res;
  }

  async _handleRelayDisconnectAutoStop(slot: string): Promise<void> {
    if (slot !== "ai0" && slot !== "ai1" && slot !== "ai2") return;
    if (this.relay === null) return;

    try {
      if (this.relay.isAIAIActive() === true && (slot === "ai1" || slot === "ai2")) {
        const remainingTarget = slot === "ai1" ? "ai2" : "ai1";

        if (SlotController.isConnected(remainingTarget) === true) {
          const stopResult = await this.sendProtocol({
            room: "analyze",
            scenario: "ai-ai-stop",
            targets: [remainingTarget],
          });

          if (stopResult.success === true) {
            return;
          }
        }

        await this.relay.stopProtocolSession();
        await this.relay.stopSession();
        return;
      }

      if (this.relay.isAIAsistanActive() !== true) {
        return;
      }

      const sourceSlot = this.relay.getAIAsistanSourceSlot();
      if (sourceSlot !== "ai1" && sourceSlot !== "ai2") {
        await this.relay.stopAIAsistanSession();
        return;
      }

      if (slot === sourceSlot) {
        await this.relay.stopAIAsistanSession();
        return;
      }

      if (slot === "ai0") {
        if (SlotController.isConnected(sourceSlot) === true) {
          const stopResult = await this.sendProtocol({
            room: "analyze",
            scenario: "ai-asistan-stop",
            targets: [sourceSlot],
          });

          if (stopResult.success === true) {
            return;
          }
        }

        await this.relay.stopAIAsistanSession();
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
    switch (op) {
      case "add":
        return await Promise.resolve(
          WhisperManager.WhisperManagerAdd(args?.accountId, args?.text ?? "", args?.when)
        );
      case "remove":
        return await Promise.resolve(
          WhisperManager.WhisperManagerDelete(args?.accountId, args?.id ?? "")
        );
      case "update": {
        const patch: { text?: string; when?: unknown } = {};
        const nextText = args?.patch?.text ?? args?.text;
        const nextWhen = args?.patch?.when ?? args?.when;
        if (nextText !== undefined) {
          patch.text = nextText;
        }
        if (nextWhen !== undefined) {
          patch.when = nextWhen;
        }
        return await Promise.resolve(
          WhisperManager.WhisperManagerUpdate(args?.accountId, args?.id, patch)
        );
      }
      case "list":
        return await Promise.resolve(WhisperManager.getRecords(args?.accountId));
      case "done":
        return await Promise.resolve(WhisperManager.getDoneRecords(args?.accountId));
      case "accounts":
        return await Promise.resolve(WhisperManager.getAllByAccount());
      case "catch":
        return await Promise.resolve(WhisperManager.catch());
      default:
        return await Promise.resolve(null);
    }
  }

  pauseWhispers(): void {
    WhisperManager.pause();
  }

  resumeWhispers(runCheck = false): void {
    WhisperManager.resume(runCheck);
  }

  resolveSlotForAccount(accountId: string): "ai1" | "ai2" | null {
    const settings = SettingsManager.getSnapshot();
    if (settings.slots.ai1.accountId === accountId) {
      return "ai1";
    }
    if (settings.slots.ai2.accountId === accountId) {
      return "ai2";
    }
    return null;
  }

  async enqueueWhisperJob(
    accountId: string,
    record: WhisperRecord = {},
    messageOverride = ""
  ): Promise<{ success: boolean; jobId?: string; message?: string }> {
    const slot = this.resolveSlotForAccount(accountId);
    if (slot === null) {
      return await Promise.resolve({
        success: false,
        message: "Whisper hesabı aktif bir slota bağlı değil",
      });
    }

    const text = messageOverride !== "" ? messageOverride : (record.text ?? "");
    const whisperId = record.id ?? "";
    const payload = {
      provider: slot,
      accountId,
      whisperId,
      message: text,
      when: record.when,
    };

    Logger.info(LogCategory.WHISPER, `Whisper kuyruğa alındı (${accountId}/${slot})`, {
      context: { accountId, slot, whisperId },
    });

    const exec = async (): Promise<CommandResult> => {
      const res = await this.sendMessage({ provider: slot, text });
      if (!res.success) {
        if (whisperId !== "") {
          WhisperManager.markReady(accountId, whisperId);
        }
        throw new Error(res.message ?? "Whisper gönderilemedi");
      }
      if (whisperId !== "") {
        WhisperManager.WhisperManagerDone(accountId, whisperId);
      }
      return { success: true };
    };

    const job = CommandManager.CommandManagerEnqueue(
      slot,
      "WhisperSend",
      "whisper",
      payload,
      exec,
      "normal"
    );

    if (job?.id !== undefined && job.id !== "") {
      return await Promise.resolve({ success: true, jobId: job.id });
    }
    return await Promise.resolve({ success: true });
  }

  async handleCaughtCommand(
    commandName: string,
    payload: CaughtCommandPayload = {}
  ): Promise<{ success: boolean; message?: string; jobId?: string; priority?: string }> {
    if (commandName === "") return { success: false, message: "Komut adı yok" };
    const sc = getServerCommands();
    const known = sc.list().some((c) => c.toLowerCase() === String(commandName).toLowerCase());
    if (!known) {
      Logger.error(LogCategory.COMMAND, `Bilinmeyen komut: ${commandName}`, {
        context: { commandName },
      });
      return { success: false, message: "Bilinmeyen komut" };
    }
    if (!this.settings) {
      await this.init();
    }
    const priority = "normal";
    const stamp = new Date().toLocaleString("tr-TR");
    const provider = payload.provider ?? "AI";
    const nickAi1 = AppState.getNickname("ai1");
    const nickAi2 = AppState.getNickname("ai2");
    const humanName = AppState.getNickname("user");
    const who = provider === "ai1" ? nickAi1 : provider === "ai2" ? nickAi2 : provider;
    const argLabel =
      typeof payload.args === "string" && payload.args.length !== 0 ? payload.args : "";
    const cmdText = `++cmd:${commandName}${argLabel !== "" ? `(${argLabel})` : "()"}`;
    const sender = payload.source === "manual" ? humanName : who;
    const queuePayload = {
      provider,
      command: commandName,
      args: argLabel,
      source: payload.source ?? provider,
      sender,
      webUrl: payload.webUrl ?? "",
      text: typeof payload.text === "string" ? payload.text : "",
      message: cmdText,
    };
    Logger.panel(
      LogCategory.COMMAND,
      LogLevel.INFO,
      `${sender} - ${commandName}${argLabel !== "" ? ` (${argLabel})` : ""} - ${stamp}`,
      {
        eventType: "command-catch",
        provider,
        sender,
        command: commandName,
        args: argLabel,
        timestamp: stamp,
        webUrl: payload.webUrl ?? "",
        triggerSource: payload.source ?? provider,
      }
    );
    const execFn = async (): Promise<CommandResult> => {
      await getServerCommands().run(commandName, queuePayload);
      return { success: true };
    };
    const job = CommandManager.CommandManagerEnqueue(
      payload.target ?? "core",
      commandName,
      "catch",
      queuePayload,
      execFn,
      priority
    );
    Logger.debug(LogCategory.SYSTEM, `[${stamp}] ${who} - Komut kuyruğa alındı: ${cmdText}`, {
      context: {
        provider,
        command: commandName,
        args: argLabel,
        jobId: job?.id,
      },
    });
    if (job?.id !== undefined && job.id !== "") {
      return { success: true, jobId: job.id, priority };
    }
    return { success: true, priority };
  }

  /** Protokol metnindeki <AI0>, <AI1>, <AI2> etiketlerini nickname ile değiştirir */
  replaceProtocolTags(text: string): string {
    return text
      .replace(/<AI0>/g, AppState.getNickname("ai0"))
      .replace(/<AI1>/g, AppState.getNickname("ai1"))
      .replace(/<AI2>/g, AppState.getNickname("ai2"));
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
    WhisperManager.destroy();
    TrafficManager.destroy();
    ConversationSyncer.destroy();
    Logger.shutdown();
    import("../ui/toast-manager.js")
      .then(({ ToastManager }) => {
        ToastManager.destroy();
      })
      .catch(() => {});
    this.initialized = false;
    Logger.panel(LogCategory.SYSTEM, LogLevel.INFO, "CoreEngine destroyed");
  }
}

const coreEngine = new CoreEngineClass();
export { coreEngine as CoreEngine, registerServerCommands };
export type { ServerCommandsRef };
export type CoreEngine = CoreEngineClass;
