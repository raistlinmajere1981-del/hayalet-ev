import {
  sanitizeForgeRoomSnapshot,
  sanitizeForgeUiContext,
  type ForgeHostMessage,
} from "../shared/ui/host-messages.js";
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
  let lastRenderSignature: string | null = null;

  function createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    className?: string,
    textContent?: string
  ): HTMLElementTagNameMap[K] {
    const element = documentRef.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (typeof textContent === "string") {
      element.textContent = textContent;
    }
    return element;
  }

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

  function buildRenderSignature(): string {
    return JSON.stringify({
      context: state.context,
      lastCommandResult: state.lastCommandResult,
      meta: state.meta,
      pendingCommand: state.pendingCommand,
      snapshot: state.snapshot,
    });
  }

  function toHeadlineText(): string {
    return state.snapshot.currentGoal?.summary || text(["workbench", "title"], "Forge Workbench");
  }

  function toBriefText(): string {
    return (
      state.snapshot.currentGoal?.brief ||
      text(
        ["workbench", "subtitle"],
        "Shape a goal, review the task draft, and prepare a downstream handoff."
      )
    );
  }

  function toPlanLabel(planStatus: ForgeUiState["snapshot"]["coordinatorState"]["planStatus"]): string {
    const labels: Record<ForgeUiState["snapshot"]["coordinatorState"]["planStatus"], string> = {
      idle: "Idle",
      drafting: "Drafting",
      "generating-draft": "Generating draft",
      "awaiting-approval": "Awaiting approval",
      "ready-for-assignment": "Ready for assignment",
      dispatching: "Dispatching",
      "reviewing-conflicts": "Reviewing conflicts",
      "synthesis-ready": "Synthesis ready",
      blocked: "Blocked",
      exported: "Exported",
    };
    return labels[planStatus] ?? planStatus;
  }

  function deriveActiveStage(): number {
    if (
      state.snapshot.selectedSynthesisId !== null ||
      state.snapshot.syntheses.length > 0 ||
      state.snapshot.exports.length > 0 ||
      state.snapshot.coordinatorState.synthesisStatus !== "idle"
    ) {
      return 3;
    }
    if (
      state.snapshot.draftTasks.length > 0 ||
      state.snapshot.approvedTasks.length > 0 ||
      state.snapshot.responses.length > 0 ||
      state.snapshot.conflicts.length > 0
    ) {
      return 2;
    }
    return 1;
  }

  function deriveNextStep(): string {
    if (state.pendingCommand) {
      return state.pendingCommand;
    }
    if (state.snapshot.activeSessionId === null) {
      return "Create session";
    }
    if (!state.snapshot.currentGoal?.summary) {
      return "Save goal";
    }
    if (state.snapshot.draftTasks.length === 0) {
      return "Generate draft";
    }
    if (state.snapshot.approvedTasks.length === 0) {
      return "Approve draft";
    }
    if (state.snapshot.responses.length < state.snapshot.coordinatorState.assignmentQueueTotal) {
      return "Dispatch assignments";
    }
    if (state.snapshot.selectedSynthesisId === null) {
      return "Generate synthesis";
    }
    if (state.snapshot.exports.length === 0) {
      return "Export handoff";
    }
    return "Review latest export";
  }

  function renderHero(): HTMLElement {
    const hero = createElement("section", "forge-shell__hero");

    const intro = createElement("div", "forge-shell__hero-copy");
    intro.append(
      createElement("p", "forge-shell__eyebrow", "Hayalet Ev / Forge Room"),
      createElement("h1", "forge-shell__title", toHeadlineText()),
      createElement("p", "forge-shell__subtitle", toBriefText())
    );

    const aside = createElement("div", "forge-shell__hero-aside");
    aside.append(
      createElement("p", "forge-shell__kicker", "Next step"),
      createElement("p", "forge-shell__signal", deriveNextStep())
    );

    const meta = createElement("div", "forge-shell__hero-meta");
    const metaItems = [
      `Room ${state.context.roomName}`,
      `Operator ${state.context.userNickname}`,
      `Plan ${toPlanLabel(state.snapshot.coordinatorState.planStatus)}`,
      `Target ${state.snapshot.currentGoal?.targetRoomId ?? "repair-room"}`,
    ];
    metaItems.forEach((value, index) => {
      const chip = createElement(
        "span",
        index === 2 ? "forge-chip forge-chip--accent" : "forge-chip",
        value
      );
      meta.append(chip);
    });

    aside.append(meta);
    hero.append(intro, aside);
    return hero;
  }

  function renderStageRail(): HTMLElement {
    const rail = createElement("section", "forge-stage-rail");
    const activeStage = deriveActiveStage();
    const stages = [
      {
        code: "01",
        title: "Asama 1",
        label: "Hedef",
        detail: state.snapshot.currentGoal?.summary || "Goal capture and room target",
      },
      {
        code: "02",
        title: "Asama 2",
        label: "Karar",
        detail:
          state.snapshot.responses.length > 0
            ? `${String(state.snapshot.responses.length)} response collected`
            : state.snapshot.draftTasks.length > 0
              ? `${String(state.snapshot.draftTasks.filter((task) => task.level === 1).length)} task in flow`
              : "Draft and review task flow",
      },
      {
        code: "03",
        title: "Asama 3",
        label: "Cikti",
        detail:
          state.snapshot.selectedSynthesisId !== null
            ? "Selected synthesis ready for export"
            : "Synthesis and handoff package",
      },
    ];

    stages.forEach((stage, index) => {
      const card = createElement("article", "forge-stage-rail__card");
      card.dataset["active"] = index + 1 === activeStage ? "true" : "false";
      card.append(
        createElement("span", "forge-stage-rail__code", stage.code),
        createElement("strong", "forge-stage-rail__title", stage.title),
        createElement("p", "forge-stage-rail__label", stage.label),
        createElement("p", "forge-stage-rail__detail", stage.detail)
      );
      rail.append(card);
    });

    return rail;
  }

  function renderColumnHeading(label: string, caption: string): HTMLElement {
    const block = createElement("div", "forge-column__heading");
    block.append(
      createElement("p", "forge-column__eyebrow", label),
      createElement("h2", "forge-column__title", caption)
    );
    return block;
  }

  function render() {
    const mount = documentRef.getElementById("app");
    if (mount === null) {
      return;
    }
    const renderSignature = buildRenderSignature();
    if (renderSignature === lastRenderSignature && mount.childElementCount > 0) {
      return;
    }

    const shell = documentRef.createElement("div");
    shell.className = "forge-shell";

    const hero = renderHero();
    const stageRail = renderStageRail();

    const workbench = createElement("section", "forge-workbench");

    const goalColumn = createElement("div", "forge-column forge-column--goal");
    goalColumn.append(
      renderColumnHeading("Asama 1", "Hedef"),
      renderGoalInputPanel(documentRef, state, text)
    );

    const decisionColumn = createElement("div", "forge-column forge-column--decision");
    decisionColumn.append(renderColumnHeading("Asama 2", "Karar"));
    if (state.snapshot.approvedTasks.filter((task) => task.level === 1).length > 0) {
      decisionColumn.append(renderApprovedTasksPanel(documentRef, state, text));
    } else {
      decisionColumn.append(renderDraftBreakdownPanel(documentRef, state, text));
    }
    decisionColumn.append(
      renderResponsesPanel(documentRef, state, text),
      renderConflictSummaryPanel(documentRef, state, text)
    );
    if (state.snapshot.approvedTasks.filter((task) => task.level === 1).length > 0) {
      decisionColumn.append(renderDraftBreakdownPanel(documentRef, state, text));
    }

    const outputColumn = createElement("div", "forge-column forge-column--output");
    outputColumn.append(
      renderColumnHeading("Asama 3", "Cikti"),
      renderSynthesisPanel(documentRef, state, text)
    );

    const footer = renderCoordinatorPanel(documentRef, state, text);
    footer.classList.add("forge-footer-panel");

    workbench.append(goalColumn, decisionColumn, outputColumn);
    shell.append(hero, stageRail, workbench, footer);
    mount.replaceChildren(shell);
    bindActions(shell);
    lastRenderSignature = renderSignature;
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
    const value =
      (documentRef.getElementById(elementId) as HTMLTextAreaElement | null)?.value ?? "";
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

    root
      .querySelector<HTMLElement>("[data-forge-action='create-session']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomCreateSession", () => requestRuntime.createSession());
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='save-session']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomSaveSession", () => requestRuntime.saveSession());
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='load-latest']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomLoadLatestSession", () => requestRuntime.loadLatestSession());
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='save-goal']")
      ?.addEventListener("click", () => {
        const summary =
          (documentRef.getElementById("forge-goal-summary") as HTMLInputElement | null)?.value ??
          "";
        const brief =
          (documentRef.getElementById("forge-goal-brief") as HTMLTextAreaElement | null)?.value ??
          "";
        const constraints =
          (documentRef.getElementById("forge-goal-constraints") as HTMLTextAreaElement | null)
            ?.value ?? "";
        const targetRoomId =
          (documentRef.getElementById("forge-goal-target-room") as HTMLInputElement | null)
            ?.value ?? "";
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
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='generate-draft']")
      ?.addEventListener("click", () => {
        const summary =
          (documentRef.getElementById("forge-goal-summary") as HTMLInputElement | null)?.value ??
          "";
        const brief =
          (documentRef.getElementById("forge-goal-brief") as HTMLTextAreaElement | null)?.value ??
          "";
        const constraints =
          (documentRef.getElementById("forge-goal-constraints") as HTMLTextAreaElement | null)
            ?.value ?? "";
        const targetRoomId =
          (documentRef.getElementById("forge-goal-target-room") as HTMLInputElement | null)
            ?.value ?? "";
        issueCommand("ForgeRoomGenerateDraft", () =>
          requestRuntime.generateDraft({
            summary,
            brief,
            constraints: parseConstraintLines(constraints),
            targetRoomId,
          })
        );
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='apply-draft-text']")
      ?.addEventListener("click", () => {
        const draftText =
          (documentRef.getElementById("forge-draft-source") as HTMLTextAreaElement | null)?.value ??
          "";
        issueCommand("ForgeRoomApplyDraftText", () => requestRuntime.applyDraftText({ draftText }));
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='add-draft-task']")
      ?.addEventListener("click", () => {
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
      });
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
    root
      .querySelector<HTMLElement>("[data-forge-action='approve-draft']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomApproveDraft", () => requestRuntime.approveDraft());
      });
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
    root
      .querySelector<HTMLElement>("[data-forge-action='dispatch-assignments']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomDispatchAssignments", () => requestRuntime.dispatchAssignments());
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='handoff-check']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomExportHandoffCheck", () => requestRuntime.exportHandoffCheck());
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='generate-synthesis']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomGenerateSynthesis", () => requestRuntime.generateSynthesis());
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='export-handoff']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomExportHandoff", () => requestRuntime.exportHandoff());
      });
    root.querySelectorAll<HTMLElement>("[data-forge-select-synthesis]").forEach((element) => {
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
      const forgeStatePayload = toRecord(payload["payload"]);
      state.snapshot = sanitizeForgeRoomSnapshot(forgeStatePayload["snapshot"]);
      const meta = toRecord(forgeStatePayload["meta"]);
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
