import { Logger } from "../modules/logger/index.js";
import type { LogEntry } from "../modules/logger/index.js";
import { LogCategory, LogLevel } from "@shared/logging-core";
import { CoreEngine } from "../modules/core-engine.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { AppState } from "../modules/app-state.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { ServerCommands } from "../modules/server-commands.js";
import { ButtonStates } from "../ui/button-states.js";
import type { AppSettings } from "@shared/settings.js";
import {
  buildCommandTestMessage,
  buildInlineCommandSnippet,
  extractExampleArgsFromDescription,
  parseCommandExecutionInput,
} from "./server-command-utils.js";

type CommandCategory = "ai1-ai2" | "ai0";
type CommandSlot = "ai1" | "ai2" | "ai0";

interface CommandCatalogItem {
  name: string;
  category: CommandCategory;
  isCustom: boolean;
  supportsTestMode: boolean;
}

interface CommandRunResult {
  success?: boolean;
  message?: string;
  detail?: string;
  [key: string]: unknown;
}

interface ServerCommandsApi {
  list(): string[];
  run(name: string, payload?: Record<string, unknown>): Promise<unknown>;
  getDescriptionText(name: string): string;
  listByCategory?: (category: CommandCategory) => string[];
  getCatalog?: (category?: CommandCategory) => CommandCatalogItem[];
}

type TimelineEventType = "command-catch" | "command-result" | "coreengine-ai-send";

interface TimelineEvent {
  eventKey: string;
  eventType: TimelineEventType;
  sessionId: string;
  isoTimestamp: string;
  displayTimestamp: string;
  provider: string;
  sender: string;
  command: string;
  args: string;
  detail: string;
  success: boolean | null;
  triggerSource: string;
  triggerCommand: string;
}

interface TimelineThread {
  threadId: string;
  sessionId: string;
  provider: string;
  sender: string;
  command: string;
  args: string;
  commandTimestamp: string;
  commandIsoTimestamp: string;
  resultTimestamp: string;
  resultIsoTimestamp: string;
  resultDetail: string;
  resultSuccess: boolean | null;
  transportDetail: string;
}

const TIMELINE_SESSION_BATCH = 3;
const TIMELINE_TOP_THRESHOLD = 52;

export class ServerController {
  isDelegated: boolean;
  availableControllers: { key: string; fallback: string }[];
  unsubscribeTraffic: (() => void) | null;
  logUnsubscribe: (() => void) | null;
  _unsubSettings: (() => void) | null;
  _unsubSlotController: (() => void) | null;

  controllerSelect: HTMLSelectElement | null;
  timelineLog: HTMLElement | null;
  timelineMeta: HTMLElement | null;
  delegateBtn: HTMLButtonElement | null;
  reclaimBtn: HTMLButtonElement | null;

  commandSlotSelect: HTMLSelectElement | null;
  commandList: HTMLElement | null;
  commandDetail: HTMLTextAreaElement | null;
  commandTestArgs: HTMLInputElement | null;
  commandRunBtn: HTMLButtonElement | null;
  commandCategoryTabs: HTMLElement | null;
  activeCategory: CommandCategory;
  selectedCommand: string;
  timelineEvents: Map<string, TimelineEvent>;
  timelineSessionIds: string[];
  timelineSessionCursor: number;
  timelineLoadedSessionIds: Set<string>;
  timelineLoading: boolean;
  timelineInitialized: boolean;

  constructor() {
    this.isDelegated = false;
    this.availableControllers = [];
    this.unsubscribeTraffic = null;
    this.logUnsubscribe = null;
    this._unsubSettings = null;
    this._unsubSlotController = null;

    this.controllerSelect = null;
    this.timelineLog = null;
    this.timelineMeta = null;
    this.delegateBtn = null;
    this.reclaimBtn = null;

    this.commandSlotSelect = null;
    this.commandList = null;
    this.commandDetail = null;
    this.commandTestArgs = null;
    this.commandRunBtn = null;
    this.commandCategoryTabs = null;
    this.activeCategory = "ai1-ai2";
    this.selectedCommand = "";
    this.timelineEvents = new Map();
    this.timelineSessionIds = [];
    this.timelineSessionCursor = 0;
    this.timelineLoadedSessionIds = new Set();
    this.timelineLoading = false;
    this.timelineInitialized = false;
  }

  private getServerCommandsApi(): ServerCommandsApi {
    return ServerCommands as unknown as ServerCommandsApi;
  }

  private toText(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    if (value instanceof Error) return value.message;
    if (value !== null && typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    }
    return "";
  }

  private getMetaText(entry: LogEntry, key: string): string {
    return this.toText(entry.meta?.[key]);
  }

  private getEntryText(entry: LogEntry, key: string): string {
    const ctxValue = entry.context?.[key];
    if (ctxValue !== undefined && ctxValue !== null) {
      const text = this.toText(ctxValue);
      if (text !== "") return text;
    }
    return this.getMetaText(entry, key);
  }

  private getEventType(entry: LogEntry): string {
    const eventType = this.getEntryText(entry, "eventType");
    if (eventType !== "") return eventType;
    return this.toText(entry.source);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private toLogLevel(value: string): LogLevel {
    const level = value.toLowerCase();
    if (level === LogLevel.DEBUG) return LogLevel.DEBUG;
    if (level === LogLevel.INFO) return LogLevel.INFO;
    if (level === LogLevel.SUCCESS) return LogLevel.SUCCESS;
    if (level === LogLevel.WARNING) return LogLevel.WARNING;
    if (level === LogLevel.ERROR) return LogLevel.ERROR;
    return LogLevel.INFO;
  }

  private normalizeIsoTimestamp(raw: string): string {
    if (raw === "") return "";
    const stamp = new Date(raw);
    if (Number.isNaN(stamp.getTime())) return "";
    return stamp.toISOString();
  }

  private isTimelineEventType(value: string): value is TimelineEventType {
    return (
      value === "command-catch" || value === "command-result" || value === "coreengine-ai-send"
    );
  }

  private buildTimelineEventKey(event: Omit<TimelineEvent, "eventKey">): string {
    return [
      event.sessionId,
      event.isoTimestamp,
      event.eventType,
      event.provider,
      event.sender,
      event.command,
      event.args,
      event.detail,
      event.triggerSource,
      event.triggerCommand,
    ].join("|");
  }

  private buildPairKey(event: TimelineEvent): string {
    return [
      event.provider.toLowerCase(),
      event.sender.toLowerCase(),
      event.command.toLowerCase(),
      event.args.toLowerCase(),
    ].join("|");
  }

  private toLogEntry(value: unknown): LogEntry | null {
    if (!this.isRecord(value)) return null;

    const timestamp = this.toText(value["timestamp"]);
    const message = this.toText(value["message"]);
    if (timestamp === "" || message === "") {
      return null;
    }

    const levelText = this.toText(value["level"]);
    const categoryText = this.toText(value["category"]);
    const sourceText = this.toText(value["source"]);
    const sessionId = this.toText(value["sessionId"]);
    const contextValue = value["context"];
    const metaValue = value["meta"];

    const entry: LogEntry = {
      timestamp,
      level: this.toLogLevel(levelText),
      category: categoryText !== "" ? categoryText : LogCategory.COMMAND,
      message,
      source: sourceText !== "" ? sourceText : "renderer",
      ...(sessionId !== "" ? { sessionId } : {}),
      ...(this.isRecord(contextValue) ? { context: contextValue } : {}),
      ...(this.isRecord(metaValue) ? { meta: metaValue } : {}),
    };

    return entry;
  }

  private getTimelineSessionIds(payload: unknown): string[] {
    if (!Array.isArray(payload)) return [];

    const entries = payload
      .filter((item): item is Record<string, unknown> => this.isRecord(item))
      .map((item) => {
        const sessionId = this.toText(item["sessionId"]);
        const startTime = this.toText(item["startTime"]);
        return { sessionId, startTime };
      })
      .filter((item) => item.sessionId !== "");

    entries.sort((a, b) => {
      const aTime = a.startTime !== "" ? new Date(a.startTime).getTime() : 0;
      const bTime = b.startTime !== "" ? new Date(b.startTime).getTime() : 0;
      return bTime - aTime;
    });

    return Array.from(new Set(entries.map((item) => item.sessionId)));
  }

  private getStructuredEntries(payload: unknown): LogEntry[] {
    if (!this.isRecord(payload)) return [];
    const structured = payload["structured"];
    if (!Array.isArray(structured)) return [];

    return structured
      .map((item) => this.toLogEntry(item))
      .filter((entry): entry is LogEntry => entry !== null);
  }

  private normalizeTimelineEvent(entry: LogEntry, fallbackSessionId = ""): TimelineEvent | null {
    const eventTypeRaw = this.getEventType(entry);
    if (!this.isTimelineEventType(eventTypeRaw)) {
      return null;
    }

    const isoTimestamp = this.normalizeIsoTimestamp(this.toText(entry.timestamp));
    if (isoTimestamp === "") {
      return null;
    }

    const provider = this.getEntryText(entry, "provider");
    const sender =
      this.getEntryText(entry, "sender") !== ""
        ? this.getEntryText(entry, "sender")
        : this.getProviderLabel(provider);
    const commandText = this.getEntryText(entry, "command");
    const args = this.getEntryText(entry, "args");
    const triggerSource = this.getEntryText(entry, "triggerSource");
    const triggerCommand = this.getEntryText(entry, "triggerCommand");
    const sessionId =
      this.toText(entry.sessionId) !== "" ? this.toText(entry.sessionId) : fallbackSessionId;
    const displayTimestamp =
      this.getEntryText(entry, "timestamp") !== ""
        ? this.getEntryText(entry, "timestamp")
        : new Date(isoTimestamp).toLocaleString("tr-TR");
    const detail =
      this.getEntryText(entry, "detail") !== ""
        ? this.getEntryText(entry, "detail")
        : this.toText(entry.message);
    const command = commandText !== "" ? commandText : triggerCommand;
    const success =
      eventTypeRaw === "command-result"
        ? entry.level === LogLevel.ERROR
          ? false
          : entry.level === LogLevel.SUCCESS
            ? true
            : null
        : null;

    const baseEvent: Omit<TimelineEvent, "eventKey"> = {
      eventType: eventTypeRaw,
      sessionId,
      isoTimestamp,
      displayTimestamp,
      provider,
      sender,
      command,
      args,
      detail,
      success,
      triggerSource,
      triggerCommand,
    };

    return {
      ...baseEvent,
      eventKey: this.buildTimelineEventKey(baseEvent),
    };
  }

  private registerTimelineEvent(event: TimelineEvent): boolean {
    if (this.timelineEvents.has(event.eventKey)) {
      return false;
    }
    this.timelineEvents.set(event.eventKey, event);
    return true;
  }

  private hasMoreTimelineSessions(): boolean {
    return this.timelineSessionCursor < this.timelineSessionIds.length;
  }

  private isTimelineNearBottom(): boolean {
    if (this.timelineLog === null) return false;
    const distance =
      this.timelineLog.scrollHeight - this.timelineLog.scrollTop - this.timelineLog.clientHeight;
    return distance <= 72;
  }

  private scrollTimelineToBottom(): void {
    if (this.timelineLog === null) return;
    this.timelineLog.scrollTop = this.timelineLog.scrollHeight;
  }

  private updateTimelineMeta(text: string): void {
    if (this.timelineMeta === null) return;
    this.timelineMeta.textContent = text;
  }

  private normalizeSlot(value: string): CommandSlot {
    if (value === "ai0" || value === "ai1" || value === "ai2") {
      return value;
    }
    return "ai1";
  }

  private resolveCategoryForSlot(slot: CommandSlot): CommandCategory {
    return slot === "ai0" ? "ai0" : "ai1-ai2";
  }

  private getSelectedCommandSlot(): CommandSlot {
    return this.normalizeSlot(this.commandSlotSelect?.value ?? "ai1");
  }

  private syncCategoryWithSlot(): void {
    const slot = this.getSelectedCommandSlot();
    this.activeCategory = this.resolveCategoryForSlot(slot);
    this.updateCategoryTabs();
  }

  private updateCategoryTabs(): void {
    const buttons =
      this.commandCategoryTabs?.querySelectorAll<HTMLButtonElement>(".command-category-tab");
    buttons?.forEach((button) => {
      const category = (button.dataset["category"] ?? "") as CommandCategory;
      if (category === this.activeCategory) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
  }

  private getCommandCatalog(category: CommandCategory): CommandCatalogItem[] {
    const commandApi = this.getServerCommandsApi();

    if (typeof commandApi.getCatalog === "function") {
      return commandApi.getCatalog(category);
    }

    if (typeof commandApi.listByCategory === "function") {
      return commandApi.listByCategory(category).map((name) => ({
        name,
        category,
        isCustom: false,
        supportsTestMode: false,
      }));
    }

    return commandApi.list().map((name) => ({
      name,
      category,
      isCustom: false,
      supportsTestMode: false,
    }));
  }

  private getDisabledCommandsForSlot(slot: CommandSlot): string[] {
    const settings = SettingsManager.getSnapshot();

    if (slot === "ai1" || slot === "ai2") {
      const disabled = settings.slots[slot].disabledCommands;
      return Array.isArray(disabled)
        ? disabled.filter((item): item is string => typeof item === "string")
        : [];
    }

    const asistanDisabled = settings.asistanSlot?.disabledCommands;
    return Array.isArray(asistanDisabled)
      ? asistanDisabled.filter((item): item is string => typeof item === "string")
      : [];
  }

  private isCommandEnabled(slot: CommandSlot, commandName: string): boolean {
    const disabled = this.getDisabledCommandsForSlot(slot);
    return disabled.every((item) => item.toLowerCase() !== commandName.toLowerCase());
  }

  private async saveDisabledCommands(slot: CommandSlot, disabledCommands: string[]): Promise<void> {
    const unique = Array.from(
      new Set(disabledCommands.map((item) => item.trim()).filter((item) => item !== ""))
    );
    const settings = SettingsManager.getSnapshot();

    if (slot === "ai1" || slot === "ai2") {
      const slotSettings = settings.slots[slot];
      const next: AppSettings = {
        ...settings,
        slots: {
          ...settings.slots,
          [slot]: {
            ...slotSettings,
            disabledCommands: unique,
          },
        },
      };
      await SettingsManager.save(next as unknown as Record<string, unknown>);
      return;
    }

    const asistanSlot = settings.asistanSlot ?? {
      accountId: null,
      catchCommands: false,
      disabledCommands: [],
      messageMethod: "injection",
      fileMethod: "injection",
    };

    const next: AppSettings = {
      ...settings,
      asistanSlot: {
        ...asistanSlot,
        disabledCommands: unique,
      },
    };

    await SettingsManager.save(next as unknown as Record<string, unknown>);
  }

  private async toggleCommandForSlot(
    slot: CommandSlot,
    commandName: string,
    enabled: boolean
  ): Promise<void> {
    const current = this.getDisabledCommandsForSlot(slot);
    const key = commandName.toLowerCase();
    const next = enabled
      ? current.filter((item) => item.toLowerCase() !== key)
      : [...current, commandName];
    await this.saveDisabledCommands(slot, next);
  }

  private getCommandDetailText(commandName: string): string {
    const detail = this.getServerCommandsApi().getDescriptionText(commandName);
    return detail !== "" ? detail : `${commandName}\n\nDetay bulunamadi.`;
  }

  private setCommandDetail(commandName: string): void {
    this.selectedCommand = commandName;
    if (this.commandDetail === null) {
      return;
    }

    this.commandDetail.value = this.getCommandDetailText(commandName);
  }

  private insertExampleArgs(commandName: string): void {
    this.selectedCommand = commandName;
    const detailText = this.getCommandDetailText(commandName);
    const parsedArgs = extractExampleArgsFromDescription(commandName, detailText);

    if (this.commandTestArgs !== null) {
      this.commandTestArgs.value = buildInlineCommandSnippet(commandName, parsedArgs);
    }

    if (this.commandDetail !== null) {
      this.commandDetail.value = detailText;
    }
  }

  private async runSelectedCommand(): Promise<void> {
    const runButton = this.commandRunBtn;
    if (runButton === null) {
      return;
    }

    const commandName = this.selectedCommand.trim();
    if (commandName === "") {
      ButtonStates.setError(runButton, "Komut Seç", 1200);
      return;
    }

    const slot = this.getSelectedCommandSlot();
    ButtonStates.setLoading(runButton, "Çalıştır...");

    const rawInput = (this.commandTestArgs?.value ?? "").trim();
    const inputWithDefault =
      rawInput === "" && commandName.toLowerCase() === "asistanaisend" ? "ai1" : rawInput;
    const parsed = parseCommandExecutionInput(inputWithDefault, commandName);
    const resolvedCommandName = parsed.commandName;
    const resolvedArgs = parsed.args;

    const payload: Record<string, unknown> = {
      provider: slot,
      source: "manual",
      sender: AppState.getNickname("user"),
      args: resolvedArgs,
      text: buildCommandTestMessage(resolvedCommandName, resolvedArgs),
      testMode: true,
    };

    try {
      const result = (await this.getServerCommandsApi().run(
        resolvedCommandName,
        payload
      )) as CommandRunResult;
      const success = result.success === true;

      if (success) {
        ButtonStates.setSuccess(runButton, "OK", 1200);
      } else {
        ButtonStates.setError(runButton, "Hata", 1200);
      }

      const detailFromResult =
        typeof result.message === "string" && result.message !== ""
          ? result.message
          : typeof result.detail === "string" && result.detail !== ""
            ? result.detail
            : success
              ? "Calistirma tamamlandi"
              : "Calistirma basarisiz";

      this.selectedCommand = resolvedCommandName;

      if (this.commandDetail !== null) {
        this.commandDetail.value = `${resolvedCommandName}\n\n${detailFromResult}`;
      }

      Logger.info(LogCategory.SERVER_COMMANDS, `Komut calistirma sonucu: ${resolvedCommandName}`, {
        command: resolvedCommandName,
        slot,
        success,
        detail: detailFromResult,
      });
    } catch (error) {
      ButtonStates.setError(runButton, "Hata", 1200);
      const message = error instanceof Error ? error.message : String(error);
      if (this.commandDetail !== null) {
        this.commandDetail.value = `${resolvedCommandName}\n\n${message}`;
      }
      Logger.error(LogCategory.SERVER_COMMANDS, `Komut calistirma hatasi: ${message}`);
    }
  }

  private renderCommandPanel(): void {
    if (this.commandList === null) {
      return;
    }

    const slot = this.getSelectedCommandSlot();
    this.activeCategory = this.resolveCategoryForSlot(slot);
    this.updateCategoryTabs();

    const list = this.getCommandCatalog(this.activeCategory)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    this.commandList.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty-state";
      empty.textContent = "Bu kategori için komut bulunamadı";
      this.commandList.appendChild(empty);
      if (this.commandDetail !== null) {
        this.commandDetail.value = "";
      }
      return;
    }

    const hasSelected = list.some((item) => item.name === this.selectedCommand);
    if (!hasSelected) {
      this.selectedCommand = list[0]?.name ?? "";
    }

    list.forEach((item) => {
      const enabled = this.isCommandEnabled(slot, item.name);

      const row = document.createElement("div");
      row.className = "command-item";

      const left = document.createElement("div");
      left.className = "command-item-left";

      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.className = "command-toggle";
      toggle.checked = enabled;
      toggle.title = enabled ? "Komut aktif" : "Komut pasif";

      const name = document.createElement("span");
      name.className = "command-item-name";
      name.textContent = item.name;

      const status = document.createElement("span");
      status.className = "command-item-status";
      status.textContent = enabled ? "Aktif" : "Pasif";

      left.appendChild(toggle);
      left.appendChild(name);
      left.appendChild(status);

      const actions = document.createElement("div");
      actions.className = "command-item-actions";

      const detailButton = document.createElement("button");
      detailButton.className = "btn btn-secondary btn-sm";
      detailButton.type = "button";
      detailButton.textContent = "Detay";

      const exampleButton = document.createElement("button");
      exampleButton.className = "btn btn-primary btn-sm";
      exampleButton.type = "button";
      exampleButton.textContent = "Örnek";

      actions.appendChild(detailButton);
      actions.appendChild(exampleButton);

      row.appendChild(left);
      row.appendChild(actions);

      toggle.addEventListener("change", () => {
        const requestedState = toggle.checked;
        toggle.disabled = true;

        void this.toggleCommandForSlot(slot, item.name, requestedState)
          .then(() => {
            status.textContent = requestedState ? "Aktif" : "Pasif";
            toggle.title = requestedState ? "Komut aktif" : "Komut pasif";
            Logger.info(LogCategory.SERVER_COMMANDS, `Komut durumu güncellendi: ${item.name}`, {
              command: item.name,
              slot,
              enabled: requestedState,
            });
          })
          .catch((error) => {
            toggle.checked = !requestedState;
            Logger.error(
              LogCategory.SERVER_COMMANDS,
              `Komut durumu güncellenemedi: ${error instanceof Error ? error.message : String(error)}`
            );
          })
          .finally(() => {
            toggle.disabled = false;
          });
      });

      detailButton.addEventListener("click", () => {
        this.setCommandDetail(item.name);
      });

      exampleButton.addEventListener("click", () => {
        this.insertExampleArgs(item.name);
      });

      this.commandList?.appendChild(row);
    });

    if (this.selectedCommand !== "") {
      this.setCommandDetail(this.selectedCommand);
    }
  }

  getProviderLabel(provider: string | null): string {
    if (provider == null || provider === "") return "AI";
    if (provider === "ai1" || provider === "ai2" || provider === "user") {
      return String(AppState.getNickname(provider));
    }
    return provider;
  }

  async init(): Promise<void> {
    await SettingsManager.load();

    this._unsubSettings ??= SettingsManager.subscribe(
      ({ changedPaths }: { changedPaths: string[] }) => {
        const shouldRenderCommandPanel =
          changedPaths.includes("*") ||
          changedPaths.some(
            (path) =>
              path.startsWith("slots") ||
              path.startsWith("asistanSlot") ||
              path.startsWith("accounts") ||
              path.startsWith("asistanAccounts")
          );

        if (!shouldRenderCommandPanel) {
          return;
        }

        this.renderCommandPanel();
      }
    );

    this.controllerSelect = document.getElementById(
      "server-controller-select"
    ) as HTMLSelectElement | null;
    this.timelineLog = document.getElementById("server-command-timeline");
    this.timelineMeta = document.getElementById("server-timeline-meta");
    this.delegateBtn = document.getElementById("server-delegate-btn") as HTMLButtonElement | null;
    this.reclaimBtn = document.getElementById("server-reclaim-btn") as HTMLButtonElement | null;

    this.commandSlotSelect = document.getElementById(
      "server-command-slot-select"
    ) as HTMLSelectElement | null;
    this.commandList = document.getElementById("server-command-list");
    this.commandDetail = document.getElementById(
      "server-command-detail"
    ) as HTMLTextAreaElement | null;
    this.commandTestArgs = document.getElementById(
      "server-command-test-args"
    ) as HTMLInputElement | null;
    this.commandRunBtn = document.getElementById("server-command-run") as HTMLButtonElement | null;
    this.commandCategoryTabs = document.getElementById("server-command-category-tabs");

    this.delegateBtn?.addEventListener("click", () => {
      void this.assignControl();
    });

    this.reclaimBtn?.addEventListener("click", () => {
      void this.reclaimControl();
    });

    this.controllerSelect?.addEventListener("change", () => {
      this.updateControlButtons();
    });

    this.commandSlotSelect?.addEventListener("change", () => {
      this.syncCategoryWithSlot();
      this.renderCommandPanel();
    });

    this.commandCategoryTabs?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest<HTMLButtonElement>(".command-category-tab");
      if (button === null) {
        return;
      }

      const categoryValue = button.dataset["category"];
      if (categoryValue !== "ai0" && categoryValue !== "ai1-ai2") {
        return;
      }
      const category: CommandCategory = categoryValue;

      if (category === "ai0") {
        if (this.commandSlotSelect !== null) {
          this.commandSlotSelect.value = "ai0";
        }
      } else if (this.commandSlotSelect !== null && this.commandSlotSelect.value === "ai0") {
        this.commandSlotSelect.value = "ai1";
      }

      this.syncCategoryWithSlot();
      this.renderCommandPanel();
    });

    this.commandRunBtn?.addEventListener("click", () => {
      void this.runSelectedCommand();
    });

    this.commandTestArgs?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      void this.runSelectedCommand();
    });

    this.timelineLog?.addEventListener("scroll", () => {
      void this.handleTimelineScroll();
    });

    this.renderControllerOptions();
    this.updateControlButtons();
    this.syncCategoryWithSlot();
    this.renderCommandPanel();

    AppState.subscribe(() => {
      this.renderControllerOptions();
      this.updateControlButtons();
    });

    this._unsubSlotController ??= SlotController.on(SlotEvent.STATE_CHANGED, () => {
      this.updateControlButtons();
    });

    this.unsubscribeTraffic = TrafficManager.onUpdate((_snapshot) => {
      this.updateControlButtons();
    });

    this.logUnsubscribe = Logger.subscribe((entry) => {
      this.handleLogEntry(entry);
    });

    await this.initializeTimeline();
  }

  renderControllerOptions(): void {
    if (!this.controllerSelect) return;
    const providers = [
      { key: "ai1", fallback: "AI1" },
      { key: "ai2", fallback: "AI2" },
    ];

    const available = providers.filter((p) => {
      return SlotController.isConnected(p.key) === true;
    });
    this.availableControllers = available;
    this.controllerSelect.innerHTML = "";
    if (available.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Bağlı AI yok";
      this.controllerSelect.appendChild(opt);
    } else {
      available.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.key;
        opt.textContent = AppState.getNickname(p.key);
        this.controllerSelect?.appendChild(opt);
      });
    }
  }

  updateControlButtons(): void {
    const hasConnectedAI = this.availableControllers.length > 0;
    const delegateBtn = document.getElementById("server-delegate-btn") as HTMLButtonElement | null;
    const reclaimBtn = document.getElementById("server-reclaim-btn") as HTMLButtonElement | null;

    if (delegateBtn) {
      delegateBtn.disabled = !hasConnectedAI;
    }
    if (reclaimBtn) {
      reclaimBtn.disabled = !hasConnectedAI;
    }
  }

  async assignControl(): Promise<void> {
    const controller = this.controllerSelect?.value ?? "ai1";
    if (controller === "") return;

    if (this.delegateBtn) {
      ButtonStates.setLoading(this.delegateBtn, "Devrediliyor...");
    }

    try {
      await CoreEngine.sendProtocol({
        room: "server",
        scenario: "takecontrol",
        targets: [controller],
      });
      this.isDelegated = true;

      if (this.delegateBtn) {
        ButtonStates.setSuccess(this.delegateBtn, "Devredildi!", 1500);
      }
      Logger.panel(
        LogCategory.SYSTEM,
        LogLevel.SUCCESS,
        `Kontrol ${AppState.getNickname(controller)}'e devredildi`
      );
    } catch (_error) {
      if (this.delegateBtn) {
        ButtonStates.setError(this.delegateBtn, "Hata!", 1500);
      }
      Logger.error(LogCategory.SERVER_COMMANDS, "Kontrol devretme hatası");
    }

    setTimeout(() => {
      this.updateControlButtons();
    }, 1600);
  }

  async reclaimControl(): Promise<void> {
    const controller = this.controllerSelect?.value ?? "ai1";

    if (this.reclaimBtn) {
      ButtonStates.setLoading(this.reclaimBtn, "Devralınıyor...");
    }

    try {
      await CoreEngine.sendBatch({
        targets: [controller],
        text: "Kontrol Devralındı",
        page: "server",
      });

      this.isDelegated = false;

      if (this.reclaimBtn) {
        ButtonStates.setSuccess(this.reclaimBtn, "Devralındı!", 1500);
      }
      Logger.success(LogCategory.SYSTEM, "Kontrol insana devralındı");
    } catch (_error) {
      if (this.reclaimBtn) {
        ButtonStates.setError(this.reclaimBtn, "Hata!", 1500);
      }
      Logger.error(LogCategory.SERVER_COMMANDS, "Kontrol devralma hatası");
    }

    setTimeout(() => {
      this.updateControlButtons();
    }, 1600);
  }

  onShow(): void {
    this.renderControllerOptions();
    this.updateControlButtons();
    this.renderCommandPanel();
    if (this.timelineInitialized) {
      this.rebuildTimeline(false);
    } else {
      void this.initializeTimeline();
    }
  }

  onHide(): void {
    try {
      this._unsubSettings?.();
      this._unsubSettings = null;
    } catch (_error) {
      void 0;
    }
  }

  private async initializeTimeline(): Promise<void> {
    if (this.timelineInitialized) {
      return;
    }

    this.timelineInitialized = true;
    this.timelineEvents.clear();
    this.timelineSessionIds = [];
    this.timelineSessionCursor = 0;
    this.timelineLoadedSessionIds.clear();

    const loggerApi = window.electronAPI?.logger;
    if (loggerApi !== undefined) {
      try {
        const sessionsPayload = await loggerApi.listSessions();
        this.timelineSessionIds = this.getTimelineSessionIds(sessionsPayload);
      } catch (error) {
        Logger.warn(
          LogCategory.SERVER_COMMANDS,
          `Session listesi okunamadi: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (this.timelineSessionIds.length > 0) {
      await this.loadMoreTimelineSessions(false);
    }

    this.seedTimelineFromMemoryLogs();
    this.rebuildTimeline(true);

    if (!this.timelineLoading && !this.hasMoreTimelineSessions()) {
      const total = this.timelineLoadedSessionIds.size;
      this.updateTimelineMeta(
        total > 0 ? `Tum session gecmisi yuklendi (${total} session)` : "Canli komut akisina bagli"
      );
    }
  }

  private seedTimelineFromMemoryLogs(): void {
    const recent = Logger.getRecentLogs(500);
    recent.forEach((entry) => {
      const normalized = this.normalizeTimelineEvent(entry, this.toText(entry.sessionId));
      if (normalized === null) {
        return;
      }
      this.registerTimelineEvent(normalized);
    });
  }

  private async readSessionTimelineEvents(sessionId: string): Promise<TimelineEvent[]> {
    const loggerApi = window.electronAPI?.logger;
    if (loggerApi === undefined) {
      return [];
    }

    try {
      const payload = await loggerApi.readAllLogs(sessionId);
      const entries = this.getStructuredEntries(payload);
      const events = entries
        .map((entry) => this.normalizeTimelineEvent(entry, sessionId))
        .filter((entry): entry is TimelineEvent => entry !== null);

      const order: Record<TimelineEventType, number> = {
        "command-catch": 0,
        "coreengine-ai-send": 1,
        "command-result": 2,
      };

      events.sort((a, b) => {
        if (a.isoTimestamp === b.isoTimestamp) {
          return order[a.eventType] - order[b.eventType];
        }
        return a.isoTimestamp.localeCompare(b.isoTimestamp);
      });

      return events;
    } catch (error) {
      Logger.warn(
        LogCategory.SERVER_COMMANDS,
        `Session logu okunamadi (${sessionId}): ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  private async loadMoreTimelineSessions(preserveScroll: boolean): Promise<void> {
    if (this.timelineLoading) {
      return;
    }

    if (!this.hasMoreTimelineSessions()) {
      return;
    }

    const timeline = this.timelineLog;
    const prevHeight = preserveScroll && timeline !== null ? timeline.scrollHeight : 0;
    const prevTop = preserveScroll && timeline !== null ? timeline.scrollTop : 0;

    this.timelineLoading = true;
    this.updateTimelineMeta("Gecmis komutlar yukleniyor...");

    try {
      const start = this.timelineSessionCursor;
      const end = Math.min(this.timelineSessionIds.length, start + TIMELINE_SESSION_BATCH);
      const batchSessionIds = this.timelineSessionIds.slice(start, end);
      this.timelineSessionCursor = end;

      await batchSessionIds.reduce<Promise<void>>(async (prev, sessionId) => {
        await prev;
        if (this.timelineLoadedSessionIds.has(sessionId)) {
          return;
        }
        const events = await this.readSessionTimelineEvents(sessionId);
        events.forEach((event) => {
          this.registerTimelineEvent(event);
        });
        this.timelineLoadedSessionIds.add(sessionId);
      }, Promise.resolve());

      this.rebuildTimeline(false);

      if (preserveScroll && timeline !== null) {
        const delta = timeline.scrollHeight - prevHeight;
        timeline.scrollTop = prevTop + delta;
      }
    } finally {
      this.timelineLoading = false;
      const remaining = Math.max(0, this.timelineSessionIds.length - this.timelineSessionCursor);
      if (remaining > 0) {
        this.updateTimelineMeta(
          `Yukariya kaydir: +${TIMELINE_SESSION_BATCH} session daha (${remaining} kaldi)`
        );
      } else {
        this.updateTimelineMeta(
          `Tum session gecmisi yuklendi (${this.timelineLoadedSessionIds.size} session)`
        );
      }
    }
  }

  private async handleTimelineScroll(): Promise<void> {
    if (this.timelineLog === null || this.timelineLoading) {
      return;
    }
    if (this.timelineLog.scrollTop > TIMELINE_TOP_THRESHOLD) {
      return;
    }
    if (!this.hasMoreTimelineSessions()) {
      return;
    }
    await this.loadMoreTimelineSessions(true);
  }

  handleLogEntry(entry: LogEntry): void {
    const normalized = this.normalizeTimelineEvent(entry, this.toText(entry.sessionId));
    if (normalized === null) {
      return;
    }

    const stickToBottom = this.isTimelineNearBottom();
    const didAdd = this.registerTimelineEvent(normalized);
    if (!didAdd) {
      return;
    }

    this.rebuildTimeline(stickToBottom);
  }

  private buildTimelineThreads(events: TimelineEvent[]): TimelineThread[] {
    const threads: TimelineThread[] = [];
    const pendingByKey = new Map<string, number[]>();

    events.forEach((event) => {
      if (event.eventType === "command-catch") {
        const thread = this.createThreadFromCatchEvent(event);
        threads.push(thread);

        const pairKey = this.buildPairKey(event);
        const pending = pendingByKey.get(pairKey) ?? [];
        pending.push(threads.length - 1);
        pendingByKey.set(pairKey, pending);
        return;
      }

      if (event.eventType === "command-result") {
        const pairKey = this.buildPairKey(event);
        const pending = pendingByKey.get(pairKey);
        let targetIndex = pending !== undefined && pending.length > 0 ? (pending.pop() ?? -1) : -1;

        if (targetIndex < 0) {
          targetIndex = this.findPendingThreadIndex(threads, event);
        }

        if (targetIndex >= 0) {
          const target = threads[targetIndex];
          if (target !== undefined) {
            target.resultDetail = event.detail;
            target.resultSuccess = event.success;
            target.resultTimestamp = event.displayTimestamp;
            target.resultIsoTimestamp = event.isoTimestamp;
          }
        } else {
          threads.push(this.createThreadFromResultEvent(event));
        }
        return;
      }

      const transportIndex = this.findTransportThreadIndex(threads, event);
      if (transportIndex >= 0) {
        const target = threads[transportIndex];
        if (target !== undefined) {
          target.transportDetail = event.detail;
        }
        return;
      }

      if (event.triggerCommand !== "" || event.command !== "") {
        const thread = this.createThreadFromCatchEvent(event);
        thread.transportDetail = event.detail;
        threads.push(thread);
      }
    });

    return threads;
  }

  private findPendingThreadIndex(threads: TimelineThread[], event: TimelineEvent): number {
    const eventCommand = event.command.toLowerCase();
    const eventArgs = event.args.toLowerCase();
    const eventSender = event.sender.toLowerCase();

    for (let i = threads.length - 1; i >= 0; i -= 1) {
      const thread = threads[i];
      if (thread === undefined) continue;
      if (thread.resultDetail !== "") continue;
      if (event.provider !== "" && thread.provider !== event.provider) continue;
      if (eventCommand !== "" && thread.command.toLowerCase() !== eventCommand) continue;
      if (eventArgs !== "" && thread.args.toLowerCase() !== eventArgs) continue;
      if (eventSender !== "" && thread.sender.toLowerCase() !== eventSender) continue;
      return i;
    }

    return -1;
  }

  private findTransportThreadIndex(threads: TimelineThread[], event: TimelineEvent): number {
    const triggerCommand = event.triggerCommand.toLowerCase();
    const eventTime = new Date(event.isoTimestamp).getTime();

    for (let i = threads.length - 1; i >= 0; i -= 1) {
      const thread = threads[i];
      if (thread === undefined) continue;
      if (event.provider !== "" && thread.provider !== event.provider) continue;

      if (triggerCommand !== "" && thread.command.toLowerCase() !== triggerCommand) {
        continue;
      }

      const threadTime = new Date(thread.commandIsoTimestamp).getTime();
      const withinWindow = Number.isFinite(threadTime)
        ? Math.abs(eventTime - threadTime) <= 3 * 60 * 1000
        : true;

      if (triggerCommand !== "" || withinWindow) {
        return i;
      }
    }

    return -1;
  }

  private createThreadFromCatchEvent(event: TimelineEvent): TimelineThread {
    const resolvedCommand =
      event.command !== ""
        ? event.command
        : event.triggerCommand !== ""
          ? event.triggerCommand
          : "Komut";
    const sender = event.sender !== "" ? event.sender : this.getProviderLabel(event.provider);

    return {
      threadId: `${event.sessionId}|${event.isoTimestamp}|${resolvedCommand}|${event.args}`,
      sessionId: event.sessionId,
      provider: event.provider,
      sender,
      command: resolvedCommand,
      args: event.args,
      commandTimestamp: event.displayTimestamp,
      commandIsoTimestamp: event.isoTimestamp,
      resultTimestamp: "",
      resultIsoTimestamp: "",
      resultDetail: "",
      resultSuccess: null,
      transportDetail: "",
    };
  }

  private createThreadFromResultEvent(event: TimelineEvent): TimelineThread {
    const thread = this.createThreadFromCatchEvent(event);
    thread.resultDetail = event.detail;
    thread.resultSuccess = event.success;
    thread.resultTimestamp = event.displayTimestamp;
    thread.resultIsoTimestamp = event.isoTimestamp;
    return thread;
  }

  private createTimelineThreadElement(thread: TimelineThread): HTMLElement {
    const root = document.createElement("div");
    root.className = `timeline-thread${thread.resultDetail === "" ? " is-pending" : ""}`;

    const header = document.createElement("div");
    header.className = "timeline-thread-header";

    const actor = document.createElement("span");
    const target = thread.provider !== "" ? this.getProviderLabel(thread.provider) : "AI";
    actor.textContent = `${thread.sender} -> ${target}`;

    const stamp = document.createElement("span");
    stamp.textContent = thread.commandTimestamp;

    header.appendChild(actor);
    header.appendChild(stamp);

    const commandLine = document.createElement("div");
    commandLine.className = "timeline-thread-command";
    if (thread.command !== "" && thread.command !== "Komut") {
      commandLine.textContent = `Komut: ${buildInlineCommandSnippet(thread.command, thread.args)}`;
    } else {
      commandLine.textContent = `Komut: ${thread.command}`;
    }

    const resultLine = document.createElement("div");
    resultLine.className = `timeline-thread-result${thread.resultSuccess === false ? " is-error" : ""}`;
    if (thread.resultDetail !== "") {
      resultLine.textContent = `Sonuc: ${thread.resultDetail}`;
    } else {
      resultLine.textContent = "Sonuc bekleniyor...";
    }

    const meta = document.createElement("div");
    meta.className = "timeline-thread-meta";
    const metaParts: string[] = [];
    if (thread.transportDetail !== "") {
      metaParts.push(`gonderim: ${thread.transportDetail}`);
    }
    metaParts.push(`session: ${thread.sessionId}`);
    if (thread.resultTimestamp !== "") {
      metaParts.push(`result-ts: ${thread.resultTimestamp}`);
    }
    meta.textContent = metaParts.join(" | ");

    root.appendChild(header);
    root.appendChild(commandLine);
    root.appendChild(resultLine);
    root.appendChild(meta);

    return root;
  }

  private rebuildTimeline(stickToBottom = false): void {
    if (this.timelineLog === null) {
      return;
    }

    const order: Record<TimelineEventType, number> = {
      "command-catch": 0,
      "coreengine-ai-send": 1,
      "command-result": 2,
    };

    const events = Array.from(this.timelineEvents.values()).sort((a, b) => {
      if (a.isoTimestamp === b.isoTimestamp) {
        return order[a.eventType] - order[b.eventType];
      }
      return a.isoTimestamp.localeCompare(b.isoTimestamp);
    });

    const threads = this.buildTimelineThreads(events);

    this.timelineLog.innerHTML = "";
    if (threads.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty-state";
      empty.textContent = "Henuz komut kaydi yok";
      this.timelineLog.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    threads.forEach((thread) => {
      fragment.appendChild(this.createTimelineThreadElement(thread));
    });
    this.timelineLog.appendChild(fragment);

    if (stickToBottom) {
      this.scrollTimelineToBottom();
    }
  }
}
