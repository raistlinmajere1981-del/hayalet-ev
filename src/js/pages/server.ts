import { Logger } from "../modules/logger/index.js";
import type { LogEntry } from "../modules/logger/index.js";
import type { TranslationParams } from "@shared/i18n.js";
import { LogCategory, LogLevel } from "@shared/logging-core";
import { CoreEngine } from "../modules/core-engine.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { AppState } from "../modules/app-state.js";
import { SlotController } from "../modules/slot-controller.js";
import { ServerCommands } from "../modules/server-commands.js";
import { AppI18n } from "../modules/i18n/index.js";
import { ButtonStates } from "../ui/button-states.js";
import {
  buildCommandTestMessage,
  buildInlineCommandSnippet,
  extractExampleArgsFromDescription,
  parseCommandExecutionInput,
} from "./server-command-utils.js";
import {
  buildSettingsWithDisabledCommands,
  getCommandCatalog,
  getDisabledCommandsForSlot,
  isCommandEnabled,
  normalizeSlot,
  resolveCategoryForSlot,
} from "./server/command-helpers.js";
import type {
  CommandCatalogItem,
  CommandCategory,
  CommandRunResult,
  CommandSlot,
  ServerCommandsApi,
} from "./server/types.js";
import {
  handleTimelineLogEntry,
  handleTimelineScroll,
  initializeTimeline,
  rebuildTimelineView,
  type TimelineState,
} from "./server/timeline-controller.js";
import { initServerControllerPage } from "./server/init-controller.js";
import type { ServerInitContext } from "./server/init-controller.js";
import type { TimelineEvent } from "./server-timeline.js";

const TIMELINE_SESSION_BATCH = 3;
const TIMELINE_TOP_THRESHOLD = 52;

function serverCommandPanelT(key: string, params?: TranslationParams): string {
  return AppI18n.t(`app.commands.panel.${key}`, params);
}

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

  private updateTimelineMeta(text: string): void {
    if (this.timelineMeta === null) return;
    this.timelineMeta.textContent = text;
  }

  private normalizeSlot(value: string): CommandSlot {
    return normalizeSlot(value);
  }

  private resolveCategoryForSlot(slot: CommandSlot): CommandCategory {
    return resolveCategoryForSlot(slot);
  }

  private getSelectedCommandSlot(): CommandSlot {
    return this.normalizeSlot(this.commandSlotSelect?.value ?? "ai1");
  }

  syncCategoryWithSlot(): void {
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
    return getCommandCatalog(this.getServerCommandsApi(), category);
  }

  private getDisabledCommandsForSlot(slot: CommandSlot): string[] {
    const settings = SettingsManager.getSnapshot();
    return getDisabledCommandsForSlot(settings, slot);
  }

  private isCommandEnabled(slot: CommandSlot, commandName: string): boolean {
    return isCommandEnabled(this.getDisabledCommandsForSlot(slot), commandName);
  }

  private async saveDisabledCommands(slot: CommandSlot, disabledCommands: string[]): Promise<void> {
    const settings = SettingsManager.getSnapshot();
    const next = buildSettingsWithDisabledCommands(settings, slot, disabledCommands);
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
    return detail !== "" ? detail : `${commandName}\n\n${serverCommandPanelT("detailMissing")}`;
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

  async runSelectedCommand(): Promise<void> {
    const runButton = this.commandRunBtn;
    if (runButton === null) {
      return;
    }

    const commandName = this.selectedCommand.trim();
    if (commandName === "") {
      ButtonStates.setError(runButton, serverCommandPanelT("buttons.selectCommand"), 1200);
      return;
    }

    const slot = this.getSelectedCommandSlot();
    ButtonStates.setLoading(runButton, serverCommandPanelT("buttons.runLoading"));

    const rawInput = (this.commandTestArgs?.value ?? "").trim();
    const commandKey = commandName.toLowerCase();
    const inputWithDefault =
      rawInput === "" && ["assistantaisend", "asistanaisend"].includes(commandKey)
        ? "ai1"
        : rawInput;
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
        ButtonStates.setSuccess(runButton, serverCommandPanelT("buttons.success"), 1200);
      } else {
        ButtonStates.setError(runButton, serverCommandPanelT("buttons.error"), 1200);
      }

      const detailFromResult =
        typeof result.message === "string" && result.message !== ""
          ? result.message
          : typeof result.detail === "string" && result.detail !== ""
            ? result.detail
            : success
              ? serverCommandPanelT("results.completed")
              : serverCommandPanelT("results.failed");

      this.selectedCommand = resolvedCommandName;

      if (this.commandDetail !== null) {
        this.commandDetail.value = `${resolvedCommandName}\n\n${detailFromResult}`;
      }

      Logger.info(
        LogCategory.SERVER_COMMANDS,
        serverCommandPanelT("logs.runResult", { command: resolvedCommandName }),
        {
          command: resolvedCommandName,
          slot,
          success,
          detail: detailFromResult,
        }
      );
    } catch (error) {
      ButtonStates.setError(runButton, serverCommandPanelT("buttons.error"), 1200);
      const message = error instanceof Error ? error.message : String(error);
      if (this.commandDetail !== null) {
        this.commandDetail.value = `${resolvedCommandName}\n\n${message}`;
      }
      Logger.error(LogCategory.SERVER_COMMANDS, serverCommandPanelT("logs.runError", { message }));
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
      .sort((a, b) => a.name.localeCompare(b.name, AppI18n.getLocale()));

    this.commandList.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty-state";
      empty.textContent = serverCommandPanelT("status.emptyCategory");
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
      toggle.title = enabled
        ? serverCommandPanelT("status.enabledTitle")
        : serverCommandPanelT("status.disabledTitle");

      const name = document.createElement("span");
      name.className = "command-item-name";
      name.textContent = item.name;

      const status = document.createElement("span");
      status.className = "command-item-status";
      status.textContent = enabled
        ? serverCommandPanelT("status.enabled")
        : serverCommandPanelT("status.disabled");

      left.appendChild(toggle);
      left.appendChild(name);
      left.appendChild(status);

      const actions = document.createElement("div");
      actions.className = "command-item-actions";

      const detailButton = document.createElement("button");
      detailButton.className = "btn btn-secondary btn-sm";
      detailButton.type = "button";
      detailButton.textContent = serverCommandPanelT("buttons.detail");

      const exampleButton = document.createElement("button");
      exampleButton.className = "btn btn-primary btn-sm";
      exampleButton.type = "button";
      exampleButton.textContent = serverCommandPanelT("buttons.example");

      actions.appendChild(detailButton);
      actions.appendChild(exampleButton);

      row.appendChild(left);
      row.appendChild(actions);

      toggle.addEventListener("change", () => {
        const requestedState = toggle.checked;
        toggle.disabled = true;

        void this.toggleCommandForSlot(slot, item.name, requestedState)
          .then(() => {
            status.textContent = requestedState
              ? serverCommandPanelT("status.enabled")
              : serverCommandPanelT("status.disabled");
            toggle.title = requestedState
              ? serverCommandPanelT("status.enabledTitle")
              : serverCommandPanelT("status.disabledTitle");
            Logger.info(
              LogCategory.SERVER_COMMANDS,
              serverCommandPanelT("logs.statusUpdated", { command: item.name }),
              {
                command: item.name,
                slot,
                enabled: requestedState,
              }
            );
          })
          .catch((error) => {
            toggle.checked = !requestedState;
            Logger.error(
              LogCategory.SERVER_COMMANDS,
              serverCommandPanelT("logs.statusUpdateError", {
                message: error instanceof Error ? error.message : String(error),
              })
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
    await initServerControllerPage(this as unknown as ServerInitContext);
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
      opt.textContent = serverCommandPanelT("status.noConnectedAi");
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
      ButtonStates.setLoading(this.delegateBtn, serverCommandPanelT("buttons.delegateLoading"));
    }

    try {
      await CoreEngine.sendProtocol({
        room: "server",
        scenario: "takecontrol",
        targets: [controller],
      });
      this.isDelegated = true;

      if (this.delegateBtn) {
        ButtonStates.setSuccess(
          this.delegateBtn,
          serverCommandPanelT("buttons.delegateSuccess"),
          1500
        );
      }
      Logger.panel(
        LogCategory.SYSTEM,
        LogLevel.SUCCESS,
        serverCommandPanelT("logs.delegateSuccess", {
          controller: AppState.getNickname(controller),
        })
      );
    } catch (_error) {
      if (this.delegateBtn) {
        ButtonStates.setError(this.delegateBtn, serverCommandPanelT("buttons.error"), 1500);
      }
      Logger.error(LogCategory.SERVER_COMMANDS, serverCommandPanelT("logs.delegateError"));
    }

    setTimeout(() => {
      this.updateControlButtons();
    }, 1600);
  }

  async reclaimControl(): Promise<void> {
    const controller = this.controllerSelect?.value ?? "ai1";

    if (this.reclaimBtn) {
      ButtonStates.setLoading(this.reclaimBtn, serverCommandPanelT("buttons.reclaimLoading"));
    }

    try {
      await CoreEngine.sendBatch({
        targets: [controller],
        text: serverCommandPanelT("controlBatchText"),
        page: "server",
      });

      this.isDelegated = false;

      if (this.reclaimBtn) {
        ButtonStates.setSuccess(
          this.reclaimBtn,
          serverCommandPanelT("buttons.reclaimSuccess"),
          1500
        );
      }
      Logger.success(LogCategory.SYSTEM, serverCommandPanelT("logs.reclaimSuccess"));
    } catch (_error) {
      if (this.reclaimBtn) {
        ButtonStates.setError(this.reclaimBtn, serverCommandPanelT("buttons.error"), 1500);
      }
      Logger.error(LogCategory.SERVER_COMMANDS, serverCommandPanelT("logs.reclaimError"));
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
    await initializeTimeline({
      state: this as TimelineState,
      batchSize: TIMELINE_SESSION_BATCH,
      updateTimelineMeta: (text) => {
        this.updateTimelineMeta(text);
      },
      getProviderLabel: (provider) => this.getProviderLabel(provider),
    });
  }

  async handleTimelineScroll(): Promise<void> {
    await handleTimelineScroll({
      state: this as TimelineState,
      topThreshold: TIMELINE_TOP_THRESHOLD,
      batchSize: TIMELINE_SESSION_BATCH,
      updateTimelineMeta: (text) => {
        this.updateTimelineMeta(text);
      },
      getProviderLabel: (provider) => this.getProviderLabel(provider),
    });
  }

  handleLogEntry(entry: LogEntry): void {
    handleTimelineLogEntry({
      state: this as TimelineState,
      entry,
      getProviderLabel: (provider) => this.getProviderLabel(provider),
    });
  }

  private rebuildTimeline(stickToBottom = false): void {
    rebuildTimelineView({
      state: this as TimelineState,
      getProviderLabel: (provider) => this.getProviderLabel(provider),
      stickToBottom,
    });
  }
}
