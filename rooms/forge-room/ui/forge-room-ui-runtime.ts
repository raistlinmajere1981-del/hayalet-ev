import { sanitizeForgeRoomSnapshot, sanitizeForgeUiContext, type ForgeHostMessage } from "../shared/ui/host-messages.js";
import { createForgeUiRequestRuntime } from "../shared/ui/request-runtime.js";
import { createInitialForgeUiState, type ForgeUiState } from "../shared/ui/state.js";
import { renderApprovedTasksPanel } from "./panels/approved-tasks-panel.js";
import { renderConflictSummaryPanel } from "./panels/conflict-summary-panel.js";
import { renderCoordinatorPanel } from "./panels/coordinator-panel.js";
import { renderDraftBreakdownPanel } from "./panels/draft-breakdown-panel.js";
import { renderGoalInputPanel } from "./panels/goal-input-panel.js";
import { renderResponsesPanel } from "./panels/responses-panel.js";
import { renderSynthesisPanel } from "./panels/synthesis-panel.js";

type ForgeUiWindow = Window & {
  roomAPI?: Window["roomAPI"];
};

export function createForgeRoomUiRuntime() {
  const state: ForgeUiState = createInitialForgeUiState();
  const requestRuntime = createForgeUiRequestRuntime();
  const windowRef = window as ForgeUiWindow;
  const documentRef = document;

  function toRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === "object" && Array.isArray(value) === false
      ? (value as Record<string, unknown>)
      : {};
  }

  function text(path: string[], fallback: string): string {
    let current: unknown = state.context.translations;
    for (const part of path) {
      const next = toRecord(current)[part];
      if (next === undefined) {
        return fallback;
      }
      current = next;
    }
    return typeof current === "string" && current.trim() !== "" ? current : fallback;
  }

  function render() {
    const mount = documentRef.getElementById("app");
    if (mount === null) {
      return;
    }

    const shell = documentRef.createElement("div");
    shell.className = "forge-shell";

    const hero = documentRef.createElement("section");
    hero.className = "forge-shell__hero";
    hero.innerHTML = `
      <div>
        <h1 class="forge-shell__title">${text(["workbench", "title"], "Forge Workbench")}</h1>
        <p class="forge-shell__subtitle">${text(["workbench", "subtitle"], "Shape a goal, review the task draft, and prepare a downstream handoff.")}</p>
      </div>
      <div>
        <p class="forge-shell__meta">Room: ${state.context.roomName}</p>
        <p class="forge-shell__meta">Operator: ${state.context.userNickname}</p>
      </div>
    `;

    const grid = documentRef.createElement("div");
    grid.className = "forge-grid";
    grid.append(
      renderGoalInputPanel(documentRef, state, text),
      renderDraftBreakdownPanel(documentRef, state, text),
      renderApprovedTasksPanel(documentRef, state, text),
      renderResponsesPanel(documentRef, state, text),
      renderConflictSummaryPanel(documentRef, state, text),
      renderSynthesisPanel(documentRef, state, text),
      renderCoordinatorPanel(documentRef, state, text)
    );

    shell.append(hero, grid);
    mount.replaceChildren(shell);
    bindActions(shell);
  }

  function parseConstraintLines(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "");
  }

  function taskDomKey(taskId: string): string {
    return taskId.replace(/[^a-z0-9_-]/gi, "-");
  }

  function readLineList(elementId: string): string[] {
    const value = (documentRef.getElementById(elementId) as HTMLTextAreaElement | null)?.value ?? "";
    return parseConstraintLines(value);
  }

  function readInputValue(elementId: string): string {
    const input = documentRef.getElementById(elementId) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;
    return input?.value ?? "";
  }

  function bindActions(root: HTMLElement) {
    function issueCommand(commandLabel: string, send: () => boolean) {
      const sent = send();
      if (sent === true) {
        state.pendingCommand = commandLabel;
        render();
      } else {
        state.lastCommandResult = {
          command: commandLabel,
          success: false,
          message: "roomAPI.sendCommand returned false.",
        };
        state.pendingCommand = null;
        render();
      }
    }

    root.querySelector<HTMLElement>("[data-forge-action='create-session']")?.addEventListener(
      "click",
      () => {
        issueCommand("ForgeRoomCreateSession", () => requestRuntime.createSession());
      }
    );
    root.querySelector<HTMLElement>("[data-forge-action='save-session']")?.addEventListener(
      "click",
      () => {
        issueCommand("ForgeRoomSaveSession", () => requestRuntime.saveSession());
      }
    );
    root.querySelector<HTMLElement>("[data-forge-action='load-latest']")?.addEventListener(
      "click",
      () => {
        issueCommand("ForgeRoomLoadLatestSession", () => requestRuntime.loadLatestSession());
      }
    );
    root.querySelector<HTMLElement>("[data-forge-action='save-goal']")?.addEventListener(
      "click",
      () => {
        const summary =
          (documentRef.getElementById("forge-goal-summary") as HTMLInputElement | null)?.value ?? "";
        const brief =
          (documentRef.getElementById("forge-goal-brief") as HTMLTextAreaElement | null)?.value ??
          "";
        const constraints =
          (documentRef.getElementById("forge-goal-constraints") as HTMLTextAreaElement | null)
            ?.value ?? "";
        const targetRoomId =
          (documentRef.getElementById("forge-goal-target-room") as HTMLInputElement | null)?.value ??
          "";
        issueCommand("ForgeRoomUpdateGoal", () =>
          requestRuntime.updateGoal({
            summary,
            brief,
            constraints: parseConstraintLines(constraints),
            targetRoomId,
          } as {
            brief: string;
            constraints: string[];
            summary: string;
            targetRoomId: string;
          })
        );
      }
    );
    root.querySelector<HTMLElement>("[data-forge-action='generate-draft']")?.addEventListener(
      "click",
      () => {
        const summary =
          (documentRef.getElementById("forge-goal-summary") as HTMLInputElement | null)?.value ?? "";
        const brief =
          (documentRef.getElementById("forge-goal-brief") as HTMLTextAreaElement | null)?.value ??
          "";
        const constraints =
          (documentRef.getElementById("forge-goal-constraints") as HTMLTextAreaElement | null)
            ?.value ?? "";
        const targetRoomId =
          (documentRef.getElementById("forge-goal-target-room") as HTMLInputElement | null)?.value ??
          "";
        issueCommand("ForgeRoomGenerateDraft", () =>
          requestRuntime.generateDraft({
            summary,
            brief,
            constraints: parseConstraintLines(constraints),
            targetRoomId,
          })
        );
      }
    );
    root.querySelector<HTMLElement>("[data-forge-action='apply-draft-text']")?.addEventListener(
      "click",
      () => {
        const draftText =
          (documentRef.getElementById("forge-draft-source") as HTMLTextAreaElement | null)?.value ??
          "";
        issueCommand("ForgeRoomApplyDraftText", () => requestRuntime.applyDraftText({ draftText }));
      }
    );
    root.querySelector<HTMLElement>("[data-forge-action='add-draft-task']")?.addEventListener(
      "click",
      () => {
        issueCommand("ForgeRoomUpsertDraftTask", () =>
          requestRuntime.upsertDraftTask({
            title: "New task",
            summary: "Describe the next top-level Forge task.",
            seatId: "ai1",
            roleId: "architect",
            dispatchMode: "single-owner",
            compareSeatIds: [],
            personaPresetId: null,
            checklist: [],
          })
        );
      }
    );
    root.querySelectorAll<HTMLElement>("[data-forge-save-draft-task]").forEach((element) => {
      element.addEventListener("click", () => {
        const taskId = element.dataset["forgeSaveDraftTask"];
        if (!taskId) {
          return;
        }
        const taskKey = taskDomKey(taskId);
        const compareSeatId = readInputValue(`forge-draft-compare-seat-${taskKey}`);
        const personaPresetId = readInputValue(`forge-draft-persona-${taskKey}`);
        issueCommand("ForgeRoomUpsertDraftTask", () =>
          requestRuntime.upsertDraftTask({
            taskId,
            title: readInputValue(`forge-draft-title-${taskKey}`),
            summary: readInputValue(`forge-draft-summary-${taskKey}`),
            seatId: readInputValue(`forge-draft-seat-${taskKey}`),
            roleId: readInputValue(`forge-draft-role-${taskKey}`),
            dispatchMode: readInputValue(`forge-draft-mode-${taskKey}`),
            compareSeatIds: compareSeatId ? [compareSeatId] : [],
            personaPresetId: personaPresetId || null,
            checklist: readLineList(`forge-draft-checklist-${taskKey}`),
          })
        );
      });
    });
    root.querySelectorAll<HTMLElement>("[data-forge-remove-draft-task]").forEach((element) => {
      element.addEventListener("click", () => {
        const taskId = element.dataset["forgeRemoveDraftTask"];
        if (!taskId) {
          return;
        }
        issueCommand("ForgeRoomRemoveDraftTask", () => requestRuntime.removeDraftTask({ taskId }));
      });
    });
    root.querySelector<HTMLElement>("[data-forge-action='approve-draft']")?.addEventListener(
      "click",
      () => {
        issueCommand("ForgeRoomApproveDraft", () => requestRuntime.approveDraft());
      }
    );
    root.querySelectorAll<HTMLElement>("[data-forge-save-approved-task]").forEach((element) => {
      element.addEventListener("click", () => {
        const taskId = element.dataset["forgeSaveApprovedTask"];
        if (!taskId) {
          return;
        }
        const taskKey = taskDomKey(taskId);
        const compareSeatId = readInputValue(`forge-approved-compare-seat-${taskKey}`);
        const personaPresetId = readInputValue(`forge-approved-persona-${taskKey}`);
        issueCommand("ForgeRoomUpdateApprovedTask", () =>
          requestRuntime.updateApprovedTask({
            taskId,
            seatId: readInputValue(`forge-approved-seat-${taskKey}`),
            roleId: readInputValue(`forge-approved-role-${taskKey}`),
            dispatchMode: readInputValue(`forge-approved-mode-${taskKey}`),
            compareSeatIds: compareSeatId ? [compareSeatId] : [],
            personaPresetId: personaPresetId || null,
          })
        );
      });
    });
    root.querySelector<HTMLElement>("[data-forge-action='dispatch-assignments']")?.addEventListener(
      "click",
      () => {
        issueCommand("ForgeRoomDispatchAssignments", () => requestRuntime.dispatchAssignments());
      }
    );
    root.querySelector<HTMLElement>("[data-forge-action='handoff-check']")?.addEventListener(
      "click",
      () => {
        issueCommand("ForgeRoomExportHandoffCheck", () => requestRuntime.exportHandoffCheck());
      }
    );
    root.querySelector<HTMLElement>("[data-forge-action='generate-synthesis']")?.addEventListener(
      "click",
      () => {
        issueCommand("ForgeRoomGenerateSynthesis", () => requestRuntime.generateSynthesis());
      }
    );
    root.querySelector<HTMLElement>("[data-forge-action='export-handoff']")?.addEventListener(
      "click",
      () => {
        issueCommand("ForgeRoomExportHandoff", () => requestRuntime.exportHandoff());
      }
    );
    root
      .querySelectorAll<HTMLElement>("[data-forge-select-synthesis]")
      .forEach((element) => {
        element.addEventListener("click", () => {
          const synthesisId = element.dataset["forgeSelectSynthesis"];
          if (!synthesisId) {
            return;
          }
          issueCommand("ForgeRoomSelectSynthesis", () =>
            requestRuntime.selectSynthesis({
              synthesisId,
            })
          );
        });
      });
  }

  function handleHostMessage(message: unknown) {
    const payload = toRecord(message) as ForgeHostMessage & Record<string, unknown>;
    const type = typeof payload["type"] === "string" ? payload["type"] : null;
    if (type === null) {
      return;
    }

    if (type === "host-context") {
      state.context = sanitizeForgeUiContext(payload);
      render();
      return;
    }

    if (type === "forge-state") {
      state.snapshot = sanitizeForgeRoomSnapshot(payload.snapshot);
      const meta = toRecord(payload.meta);
      state.meta = {
        roleCatalog: toRecord(meta["roleCatalog"]),
        personaPresets: toRecord(meta["personaPresets"]),
      };
      render();
      return;
    }

    const result = toRecord(payload.result);
    state.pendingCommand = null;
    state.lastCommandResult = {
      command:
        typeof payload.command === "string" && payload.command.trim() !== ""
          ? payload.command
          : "command",
      success: result["success"] === true,
      message:
        typeof result["message"] === "string" && result["message"].trim() !== ""
          ? result["message"]
          : null,
    };
    render();
  }

  function start() {
    if (windowRef.roomAPI && typeof windowRef.roomAPI.onHostMessage === "function") {
      windowRef.roomAPI.onHostMessage(handleHostMessage);
    }
    render();
    requestRuntime.notifyUiReady();
    if (windowRef.roomAPI && typeof windowRef.roomAPI.ready === "function") {
      windowRef.roomAPI.ready({
        room: "forge-room",
        feature: "forge-workbench",
        stage: "ui-ready",
      });
    }
  }

  return {
    start,
  };
}
