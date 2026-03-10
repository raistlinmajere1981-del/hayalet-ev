import { AppState } from "../../modules/app-state.js";
import { Logger } from "../../modules/logger/index.js";
import { SettingsManager } from "../../modules/settings-manager.js";
import { SlotController, SlotEvent } from "../../modules/slot-controller.js";
import { TrafficManager } from "../../modules/traffic-manager.js";
import { isAssistantAccountsSettingsPath, isAssistantSlotSettingsPath } from "@shared/settings.js";

export interface ServerInitContext {
  _unsubSettings: (() => void) | null;
  _unsubSlotController: (() => void) | null;
  unsubscribeTraffic: (() => void) | null;
  logUnsubscribe: (() => void) | null;
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
  renderCommandPanel: () => void;
  renderControllerOptions: () => void;
  updateControlButtons: () => void;
  syncCategoryWithSlot: () => void;
  assignControl: () => Promise<void>;
  reclaimControl: () => Promise<void>;
  runSelectedCommand: () => Promise<void>;
  handleTimelineScroll: () => Promise<void>;
  handleLogEntry: (entry: unknown) => void;
  initializeTimeline: () => Promise<void>;
}

export async function initServerControllerPage(controller: ServerInitContext): Promise<void> {
  await SettingsManager.load();

  controller._unsubSettings ??= SettingsManager.subscribe(
    ({ changedPaths }: { changedPaths: string[] }) => {
      const shouldRenderCommandPanel =
        changedPaths.includes("*") ||
        changedPaths.some(
          (path) =>
            path.startsWith("slots") ||
            isAssistantSlotSettingsPath(path) ||
            path.startsWith("accounts") ||
            isAssistantAccountsSettingsPath(path)
        );

      if (!shouldRenderCommandPanel) {
        return;
      }

      controller.renderCommandPanel();
    }
  );

  controller.controllerSelect = document.getElementById(
    "server-controller-select"
  ) as HTMLSelectElement | null;
  controller.timelineLog = document.getElementById("server-command-timeline");
  controller.timelineMeta = document.getElementById("server-timeline-meta");
  controller.delegateBtn = document.getElementById(
    "server-delegate-btn"
  ) as HTMLButtonElement | null;
  controller.reclaimBtn = document.getElementById("server-reclaim-btn") as HTMLButtonElement | null;

  controller.commandSlotSelect = document.getElementById(
    "server-command-slot-select"
  ) as HTMLSelectElement | null;
  controller.commandList = document.getElementById("server-command-list");
  controller.commandDetail = document.getElementById(
    "server-command-detail"
  ) as HTMLTextAreaElement | null;
  controller.commandTestArgs = document.getElementById(
    "server-command-test-args"
  ) as HTMLInputElement | null;
  controller.commandRunBtn = document.getElementById(
    "server-command-run"
  ) as HTMLButtonElement | null;
  controller.commandCategoryTabs = document.getElementById("server-command-category-tabs");

  controller.delegateBtn?.addEventListener("click", () => {
    void controller.assignControl();
  });

  controller.reclaimBtn?.addEventListener("click", () => {
    void controller.reclaimControl();
  });

  controller.controllerSelect?.addEventListener("change", () => {
    controller.updateControlButtons();
  });

  controller.commandSlotSelect?.addEventListener("change", () => {
    controller.syncCategoryWithSlot();
    controller.renderCommandPanel();
  });

  controller.commandCategoryTabs?.addEventListener("click", (event) => {
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

    if (categoryValue === "ai0") {
      if (controller.commandSlotSelect !== null) {
        controller.commandSlotSelect.value = "ai0";
      }
    } else if (
      controller.commandSlotSelect !== null &&
      controller.commandSlotSelect.value === "ai0"
    ) {
      controller.commandSlotSelect.value = "ai1";
    }

    controller.syncCategoryWithSlot();
    controller.renderCommandPanel();
  });

  controller.commandRunBtn?.addEventListener("click", () => {
    void controller.runSelectedCommand();
  });

  controller.commandTestArgs?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    void controller.runSelectedCommand();
  });

  controller.timelineLog?.addEventListener("scroll", () => {
    void controller.handleTimelineScroll();
  });

  controller.renderControllerOptions();
  controller.updateControlButtons();
  controller.syncCategoryWithSlot();
  controller.renderCommandPanel();

  AppState.subscribe(() => {
    controller.renderControllerOptions();
    controller.updateControlButtons();
  });

  controller._unsubSlotController ??= SlotController.on(SlotEvent.STATE_CHANGED, () => {
    controller.updateControlButtons();
  });

  controller.unsubscribeTraffic = TrafficManager.onUpdate((_snapshot) => {
    controller.updateControlButtons();
  });

  controller.logUnsubscribe = Logger.subscribe((entry) => {
    controller.handleLogEntry(entry);
  });

  await controller.initializeTimeline();
}
