import { SettingsManager } from "./settings-manager.js";
import { WebviewManager } from "./webview-manager.js";
import { LogManager } from "./log-manager.js";
import { AppState } from "./app-state.js";
import { ProtocolHandler } from "./protocol-handler.js";
import { RelayManager } from "./relay-manager.js";
import { CommandManager } from "./command-manager.js";
import { CommandExecutor } from "./command-executor.js";
import { WhisperManager } from "./whisper-manager.js";
import { FileManager } from "./file-manager.js";
import { TrafficManager } from "./traffic-manager.js";
import { ServerCommands } from "./server-commands.js";
import { SlotController, SlotEvent } from "./slot-controller.js";
import { getFilename, generateUniqueId, TIMEOUTS, decodeBase64 } from "../constants/index.js";
import type { AppSettings } from "../types/settings.js";

// ============================================================================
// Types
// ============================================================================

/** Bağlantı sonucu */
interface ConnectionResult {
  success: boolean;
  message?: string;
  correlationId?: string;
}

/** Batch gönderim parametreleri */
interface SendBatchParams {
  targets?: string[];
  text?: string;
  page?: string;
  archiveFolders?: Record<string, string>;
  attachments?: (string | AttachmentInput)[];
  jobIds?: Record<string, string>;
}

/** Attachment girişi */
interface AttachmentInput {
  name?: string;
  path?: string;
  commandPath?: string;
}

/** Protokol gönderim parametreleri */
interface SendProtocolParams {
  room?: string;
  scenario?: string;
  targets?: string[];
  context?: Record<string, unknown>;
  mode?: string | null;
}

/** Whisper kayıt bilgisi */
interface WhisperRecord {
  text?: string;
  id?: string;
  when?: unknown;
}

/** Caught command payload */
interface CaughtCommandPayload {
  provider?: string;
  args?: string;
  source?: string;
  webUrl?: string;
  target?: string;
}

class CoreEngineClass {
  settings: AppSettings | null;
  initialized: boolean;
  relay: typeof RelayManager | null;
  _settingsSub: (() => void) | null;
  _previousSettings: AppSettings | null;
  _cleanupInterval: ReturnType<typeof setInterval> | null;

  constructor() {
    this.settings = null;
    this.initialized = false;
    this.relay = null;
    this._settingsSub = null;
    this._previousSettings = null;
    this._cleanupInterval = null;
  }

  async init(): Promise<AppSettings | null> {
    if (this.initialized) {
      return this.settings;
    }
    this.settings = await SettingsManager.load();
    WebviewManager.setSettings(this.settings as Record<string, unknown>);
    await FileManager.ensureDirs("all");
    AppState.init("ai1");
    LogManager.init();
    await CommandManager.init();
    
    // Inactive webview cleanup interval
    this._cleanupInterval = setInterval(() => {
      try {
        WebviewManager.cleanupInactiveWebviews();
      } catch (err) {
        LogManager.addEvent("core", "warning", `Cleanup error: ${err?.message || err}`);
      }
    }, TIMEOUTS.CLEANUP_INTERVAL);
    CommandExecutor.init(this);
    CommandManager.setExecutor((job: unknown) => CommandExecutor.executeJob(job as never));
    CommandManager.on("sent", ({ job }: { job: unknown }) =>
      CommandExecutor.handleJobSuccess(job as never),
    );
    CommandManager.on("failed", ({ job, error }: { job: unknown; error: unknown }) =>
      CommandExecutor.handleJobFailure(job as never, error),
    );
    try {
      RelayManager.init(this);
      this.relay = RelayManager;
    } catch (e) {
      LogManager.addEvent(
        "core",
        "warning",
        `RelayManager init failed: ${(e instanceof Error ? e.message : String(e)) || String(e)}`,
      );
    }

    await WhisperManager.init({ settings: this.settings as Record<string, unknown> | undefined });
    WhisperManager.setSender((slot: string, text: string) => {
      void this.enqueueWhisperJob(slot, { text }, text);
    });
    WebviewManager.initSyncer(this);
    
    await SlotController.init();
    
    SlotController.on(SlotEvent.TRAFFIC_STARTED, ({ slot }: { slot?: string }) => {
      if (!slot) return;
      const webview = SlotController.getWebview(slot);
      if (webview) {
        TrafficManager.attachWebview(slot, webview);
        TrafficManager.start(slot);
      }
    });
    
    SlotController.on(SlotEvent.TRAFFIC_STOPPED, ({ slot }: { slot?: string }) => {
      if (!slot) return;
      TrafficManager.stop(slot);
    });
    
    this.initialized = true;

    this._previousSettings = JSON.parse(JSON.stringify(this.settings));

    try {
      this._settingsSub = SettingsManager.subscribe((payload) => {
        const { settings } = payload;
        if (!settings) return;

        this.useSettings(settings as AppSettings);
        this._previousSettings = JSON.parse(JSON.stringify(settings)) as AppSettings;
      });
    } catch (err) {
      LogManager.addEvent(
        "core",
        "warning",
        `SettingsManager subscribe error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.settings;
  }

  /**
   * Set connection state for a provider slot
   * Delegates to SlotController for coordinated state management
   */
  async setConnection(
    provider: string,
    connected: boolean,
    opts: { force?: boolean } = {}
  ): Promise<ConnectionResult> {
    if (!provider) return { success: false, message: "no-provider" };

    if (provider !== "ai0" && provider !== "ai1" && provider !== "ai2") {
      return { success: false, message: "invalid-provider" };
    }

    const prev = SlotController.isConnected(provider);
    const now = !!connected;
    const force = !!opts.force;

    LogManager.addEvent(
      "core",
      "info",
      `setConnection ${provider} => ${now} (force=${force}, prev=${prev})`,
    );

    if (!force && prev === now) {
      return { success: true, message: "no-change" };
    }

    let result;
    if (now) {
      result = await SlotController.connect(provider, { force });
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

  /**
   * Batch mesaj gönderimi
   */
  async sendBatch({
    targets = [],
    text = "",
    page = "generic",
    archiveFolders = {},
    attachments = [],
    jobIds = {},
  }: SendBatchParams = {}): Promise<{ success: boolean; message?: string }> {
    await this.ensureReady();
    const list = Array.isArray(targets)
      ? targets.filter(Boolean)
      : [targets].filter(Boolean);
    if (!list.length) return { success: false, message: "Hedef yok" };

    const attachmentItems = attachments.map((a: string | AttachmentInput) => {
      const name =
        typeof a === "string"
          ? getFilename(a)
          : a.name ||
            getFilename(a.path || "") ||
            getFilename(a.commandPath || "");
      const path =
        typeof a === "string" ? a : a.path || a.commandPath || a.name;
      return { name, path };
    });
    const attachmentPaths = attachmentItems.map((a) => a.path).filter(Boolean);
    const hasAttachments = attachmentPaths.length > 0;
    /** @type {Array<any>} */
    const jobs: unknown[] = [];
    for (const provider of list) {
      const jobId =
        jobIds?.[provider] ||
        generateUniqueId("cmd");
      let staged: { staged: unknown[]; temp: string[]; commandDir: string } = { staged: [], temp: [], commandDir: "" };
      if (hasAttachments) {
        const stageResult = await FileManager.stageCommandFiles(jobId, attachmentPaths.filter((p): p is string => typeof p === "string"));
        staged = stageResult;
        LogManager.addEvent(
          "command",
          "info",
          `Dosyalar komut için hazırlandı (${jobId})`,
          {
            jobId,
            count: staged.staged?.length || 0,
          },
        );
      }
      const stagedEntries = ((staged && staged.staged) || []).map((s) => {
        const item = s as { name?: string; renamedName?: string; originalName?: string; commandPath?: string };
        return {
          ...item,
          name:
            item.name ||
            item.renamedName ||
            item.originalName ||
            getFilename(item.commandPath || ""),
        };
      });
      jobs.push({
        id: jobId,
        provider,
        message: text || "",
        attachments: stagedEntries,
        attachmentsMeta: { ...staged, staged: stagedEntries, temp: [] as string[] },
        meta: {
          targets: list,
          page,
          attachments: stagedEntries,
          archiveFolders,
        },
      });
    }
    CommandManager.enqueue(jobs as never[]);
    LogManager.addEvent(
      "command",
      "info",
      `Komut kuyruğa alındı (${jobs.length} iş)`,
      {
        targets: list,
        page,
      },
    );
    this.setActiveTargets(list);
    return { success: true };
  }

  async sendMessage(p: { provider?: string; text?: string; page?: string } | null): Promise<{ success: boolean; message?: string }> {
    const { provider = "ai1", text = "", page = "generic" } = p || {};
    return this.sendBatch({
      targets: [provider],
      text,
      page,
    });
  }

  async sendToTargets(p: { targets?: string[]; text?: string; page?: string } | null): Promise<{ success: boolean; message?: string }> {
    return this.sendBatch({
      targets: p?.targets,
      text: p?.text || "",
      page: p?.page || "generic",
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
      targets: /** @type {any} */ (targets),
      context,
    });
    if (!payload) {
      LogManager.addEvent(
        "protocol",
        "warning",
        `Bilinmeyen protokol: ${room}:${scenario}`,
      );
      return { success: false, message: "Bilinmeyen protokol" };
    }
    /** @type {any[]} */
    const targetList = (payload.targets || []).filter((t) =>
      SlotController.isConnected(t),
    );
    if (!targetList.length) {
      LogManager.addEvent(
        "protocol",
        "warning",
        "Protokol gönderilemedi, bağlı AI yok",
      );
      return { success: false, message: "Bağlı hedef yok" };
    }

    if (payload.protocolPath && window.electronAPI?.readFile) {
      try {
        const base64 = await window.electronAPI.readFile(payload.protocolPath);
        if (base64) {
          payload.message = decodeBase64(base64);
          LogManager.addEvent(
            "protocol",
            "info",
            `Protokol dosyası okundu: ${payload.protocolPath}`,
          );
        }
      } catch (err) {
        LogManager.addEvent(
          "protocol",
          "error",
          `Protokol dosyası okunamadı: ${(err instanceof Error ? err.message : String(err)) || "unknown error"}`,
        );
      }
    }

    const attachments = ((payload as any).attachments || []).map((att: any) => ({
      name: att.name || getFilename(att.path || ""),
      path: att.path || att,
    }));
    if (
      room === "analyze" &&
      scenario === "ai-ai" &&
      mode === "aiRelaySequential"
    ) {
      try {
        let orderedTargets = [...targetList];
        const contextStarter =
          context && typeof context === "object" && "starter" in context
            ? context.starter
            : null;
        if (contextStarter && orderedTargets.includes(contextStarter as string)) {
          orderedTargets = [
            contextStarter as string,
            ...orderedTargets.filter((t) => t !== contextStarter),
          ];
        }

        await this.relay?.startProtocolSession?.({
          providers: orderedTargets,
          protocolPayload: payload,
          attachments,
        });
        LogManager.addEvent(
          "protocol",
          "info",
          `Started sequential protocol session for ${orderedTargets.join(", ")}`,
        );
        return { success: true, message: "sequential-session-started" };
      } catch (e) {
        LogManager.addEvent(
          "protocol",
          "error",
          `Failed to start sequential session: ${(e instanceof Error ? e.message : String(e)) || "unknown error"}`,
        );
      }
    }

    const res = await this.sendBatch({
      targets: /** @type {any[]} */ (targetList),
      text: payload.message,
      attachments,
      page: `protocol-${room || "generic"}`,
    });
    try {
      if (room === "analyze") {
        if (scenario === "ai-ai") {
          this.relay?.startSession({ providers: targetList });
        }
        if (scenario === "ai-ai-stop") {
          this.relay?.stopProtocolSession?.();
          this.relay?.stopSession?.();
        }
      }
    } catch (e) {
      LogManager.addEvent(
        "relay",
        "warning",
        `Failed to apply relay action from protocol: ${(e instanceof Error ? e.message : String(e)) || "unknown error"}`,
      );
    }
    if (res?.success) {
      LogManager.addEvent(
        "protocol",
        "info",
        `Protokol gönderildi: ${room}:${scenario} -> ${targetList.join(", ")}`,
      );
    } else {
      LogManager.addEvent(
        "protocol",
        "error",
        `Protokol hata: ${res?.message || "bilinmiyor"} (${room}:${scenario})`,
      );
    }
    return res;
  }

  async whisper(
    op: string,
    args?: { user?: string; text?: string; when?: unknown; id?: string }
  ): Promise<unknown> {
    switch (op) {
      case "add":
        return WhisperManager.WhisperManagerAdd(
          args?.user,
          args?.text || "",
          args?.when,
        );
      case "remove":
        return WhisperManager.WhisperManagerDelete(args?.user, args?.id || "");
      case "list":
        return WhisperManager.getRecords(args?.user);
      case "done":
        return WhisperManager.getDoneRecords(args?.user);
      case "catch":
        return WhisperManager.catch();
      default:
        return null;
    }
  }

  pauseWhispers(): void {
    WhisperManager.pause?.();
  }

  resumeWhispers(runCheck = false): void {
    WhisperManager.resume?.(runCheck);
  }

  async enqueueWhisperJob(
    provider: string,
    record: WhisperRecord = {},
    messageOverride = ""
  ): Promise<{ success: boolean; jobId?: string }> {
    const text = messageOverride || record.text || "";
    const whisperId = record.id || "";
    const payload = {
      provider,
      whisperId,
      message: text,
      when: record.when,
    };
    LogManager.addEvent(
      "whisper",
      "info",
      `Whisper kuyruğa alındı (${provider})`,
    );
    const exec = async (): Promise<void> => {
      const res = await this.sendMessage({ provider, text });
      if (!res?.success) {
        WhisperManager.markReady(provider, whisperId);
        throw new Error(
          (res && typeof res === "object" && "message" in res
            ? String(res.message)
            : undefined) || "Whisper gönderilemedi",
        );
      }
      WhisperManager.WhisperManagerDone(provider, whisperId);
    };
    const job = CommandManager.CommandManagerEnqueue(
      provider,
      "WhisperSend",
      "whisper",
      payload,
      exec as unknown as null,
      "normal",
    );
    return { success: true, jobId: job?.id };
  }

  async handleCaughtCommand(
    commandName: string,
    payload: CaughtCommandPayload = {}
  ): Promise<{ success: boolean; message?: string; jobId?: string; priority?: string }> {
    if (!commandName) return { success: false, message: "Komut adı yok" };
    const known = Array.isArray(ServerCommands.list())
      ? ServerCommands.list().some(
          (c) => (c || "").toLowerCase() === String(commandName).toLowerCase(),
        )
      : false;
    if (!known) {
      LogManager.addEvent(
        "command",
        "error",
        `Bilinmeyen komut: ${commandName}`,
      );
      return { success: false, message: "Bilinmeyen komut" };
    }
    if (!this.settings) {
      await this.init();
    }
    const priority = "normal";
    const stamp = new Date().toLocaleString("tr-TR");
    const provider = payload.provider || "AI";
    const nickAi1 = AppState.getNickname("ai1");
    const nickAi2 = AppState.getNickname("ai2");
    const humanName = AppState.getNickname("user");
    const who =
      provider === "ai1" ? nickAi1 : provider === "ai2" ? nickAi2 : provider;
    const argLabel =
      typeof payload.args === "string" && payload.args.length
        ? payload.args
        : "";
    const cmdText = `++cmd:${commandName}${argLabel ? `(${argLabel})` : "()"}`;
    const sender = payload.source === "manual" ? humanName : who;
    const queuePayload = {
      provider,
      command: commandName,
      args: argLabel,
      source: payload.source || provider,
      sender,
      webUrl: payload.webUrl || "",
      message: cmdText,
    };
    LogManager.addEvent(
      "command-catch",
      "info",
      `${sender} - ${commandName}${argLabel ? ` (${argLabel})` : ""} - ${stamp}`,
      {
        provider,
        sender,
        command: commandName,
        args: argLabel,
        timestamp: stamp,
        webUrl: payload.webUrl || "",
      },
    );
    const execFn = async (): Promise<void> => {
      await ServerCommands.run(commandName, queuePayload);
    };
    const job = CommandManager.CommandManagerEnqueue(
      payload.target || "core",
      commandName,
      "catch",
      queuePayload,
      execFn as unknown as null,
      priority,
    );
    LogManager.addEvent(
      "core",
      "info",
      `[${stamp}] ${who} - Komut kuyruğa alındı: ${cmdText}`,
      {
        provider,
        command: commandName,
        args: argLabel,
        jobId: job?.id,
      },
    );
    return { success: true, jobId: job?.id, priority };
  }

  setActiveTargets(targets: string[] = []): void {
    AppState.setChatTargets(targets as never[]);
  }

  listCommands(): unknown[] {
    return CommandManager.list();
  }

  /**
   * Cleanup method - tüm subscription ve interval'ları temizle
   * Uygulama kapanırken çağrılmalı
   */
  destroy(): void {
    // Cleanup interval'ı durdur
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    // Settings subscription'ı iptal et
    if (this._settingsSub) {
      this._settingsSub();
      this._settingsSub = null;
    }
    this.initialized = false;
    LogManager.addEvent("core", "info", "CoreEngine destroyed");
  }
}

export const CoreEngine = new CoreEngineClass();
