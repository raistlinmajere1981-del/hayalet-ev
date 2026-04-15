import {
  sanitizeForgeRoomSnapshot,
  sanitizeForgeUiContext,
  type ForgeHostMessage,
} from "../shared/ui/host-messages.js";
import { createForgeUiRequestRuntime } from "../shared/ui/request-runtime.js";
import {
  createInitialForgeUiState,
  type ForgeUiState,
  type ForgeWorkbenchUiFlowState,
  type ForgeWorkbenchUiSurface,
} from "../shared/ui/state.js";
import { renderApprovedTasksPanel } from "./panels/approved-tasks-panel.js";
import { renderCoordinatorPanel } from "./panels/coordinator-panel.js";
import { renderDraftBreakdownPanel } from "./panels/draft-breakdown-panel.js";
import { renderGoalInputPanel } from "./panels/goal-input-panel.js";
import { renderResponsesPanel } from "./panels/responses-panel.js";
import { renderSynthesisPanel } from "./panels/synthesis-panel.js";

type ForgeUiWindow = Window & {
  roomAPI?: Window["roomAPI"];
};

type ForgeLocalViewState = {
  advancedDraftOpen: boolean;
  expandedResponseIds: Set<string>;
  expandedSynthesisIds: Set<string>;
  guidedSurface: ForgeWorkbenchUiSurface | null;
};

type ForgePrimaryAction = {
  label: string;
  description: string;
  mode: "command" | "guide";
  commandAction?: string;
  guidedSurface?: ForgeWorkbenchUiSurface;
  disabled?: boolean;
};

type ForgeUiFlowModel = {
  state: ForgeWorkbenchUiFlowState;
  label: string;
  surface: ForgeWorkbenchUiSurface;
};

type ForgePanelMode = "active" | "monitor" | "locked";

type ForgePanelModeMap = Record<ForgeWorkbenchUiSurface, ForgePanelMode>;

export function createForgeRoomUiRuntime() {
  const state: ForgeUiState = createInitialForgeUiState();
  const requestRuntime = createForgeUiRequestRuntime();
  const windowRef = window as ForgeUiWindow;
  const documentRef = document;
  const viewState: ForgeLocalViewState = {
    advancedDraftOpen: false,
    expandedResponseIds: new Set<string>(),
    expandedSynthesisIds: new Set<string>(),
    guidedSurface: null,
  };
  let lastRenderSignature: string | null = null;
  let localUiVersion = 0;

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
      localUiVersion,
      meta: state.meta,
      pendingCommand: state.pendingCommand,
      snapshot: state.snapshot,
    });
  }

  function countQueuedAssignments(): number {
    return state.snapshot.assignments.filter((assignment) => assignment.status === "queued").length;
  }

  function countTopLevelDraftTasks(): number {
    return state.snapshot.draftTasks.filter((task) => task.level === 1).length;
  }

  function countTopLevelApprovedTasks(): number {
    return state.snapshot.approvedTasks.filter((task) => task.level === 1).length;
  }

  function countOpenConflicts(): number {
    return state.snapshot.conflicts.filter((conflict) => conflict.status === "open").length;
  }

  function hasGoalSummary(): boolean {
    return Boolean(state.snapshot.currentGoal?.summary.trim());
  }

  function hasDraftTasks(): boolean {
    return countTopLevelDraftTasks() > 0;
  }

  function hasApprovedTasks(): boolean {
    return countTopLevelApprovedTasks() > 0;
  }

  function hasDispatchStarted(): boolean {
    return state.snapshot.assignments.some((assignment) => assignment.status !== "queued");
  }

  function hasSynthesisArtifacts(): boolean {
    return state.snapshot.syntheses.length > 0 || state.snapshot.selectedSynthesisId !== null;
  }

  function hasValidExport(): boolean {
    return (
      state.snapshot.exports.length > 0 &&
      countOpenConflicts() === 0 &&
      state.snapshot.selectedSynthesisId !== null
    );
  }

  function deriveUiFlowState(): ForgeWorkbenchUiFlowState {
    if (hasValidExport()) {
      return "EXPORTED";
    }
    if (countOpenConflicts() > 0) {
      return "CONFLICT";
    }
    if (hasSynthesisArtifacts()) {
      return "SYNTHESIS_READY";
    }
    if (state.snapshot.responses.length > 0) {
      return "RESPONSES_READY";
    }
    if (hasDispatchStarted()) {
      return "DISPATCHED";
    }
    if (hasApprovedTasks()) {
      return "APPROVED";
    }
    if (hasDraftTasks()) {
      return "DRAFT_READY";
    }
    if (hasGoalSummary()) {
      return "GOAL_DEFINED";
    }
    if (state.snapshot.activeSessionId !== null) {
      return "SESSION_CREATED";
    }
    return "IDLE";
  }

  function toUiFlowLabel(flowState: ForgeWorkbenchUiFlowState): string {
    const labels: Record<ForgeWorkbenchUiFlowState, string> = {
      IDLE: "Idle",
      GOAL_DEFINED: "Goal Defined",
      SESSION_CREATED: "Session Created",
      DRAFT_READY: "Draft Ready",
      APPROVED: "Approved",
      DISPATCHED: "Dispatched",
      RESPONSES_READY: "Responses Ready",
      CONFLICT: "Conflict",
      SYNTHESIS_READY: "Synthesis Ready",
      EXPORTED: "Exported",
    };
    return labels[flowState];
  }

  function deriveDefaultSurface(flowState: ForgeWorkbenchUiFlowState): ForgeWorkbenchUiSurface {
    switch (flowState) {
      case "DISPATCHED":
      case "RESPONSES_READY":
      case "CONFLICT":
        return "responses";
      case "SYNTHESIS_READY":
      case "EXPORTED":
        return "synthesis";
      case "IDLE":
      case "GOAL_DEFINED":
      case "SESSION_CREATED":
      case "DRAFT_READY":
      case "APPROVED":
      default:
        return "goal";
    }
  }

  function deriveUiFlowModel(): ForgeUiFlowModel {
    const flowState = deriveUiFlowState();
    return {
      label: toUiFlowLabel(flowState),
      state: flowState,
      surface: deriveDefaultSurface(flowState),
    };
  }

  function derivePanelModes(flowState: ForgeWorkbenchUiFlowState): ForgePanelModeMap {
    switch (flowState) {
      case "IDLE":
      case "SESSION_CREATED":
      case "GOAL_DEFINED":
      case "DRAFT_READY":
      case "APPROVED":
        return {
          goal: "active",
          output: "locked",
          responses: "locked",
        };
      case "DISPATCHED":
      case "CONFLICT":
        return {
          goal: "locked",
          output: "locked",
          responses: "active",
        };
      case "RESPONSES_READY":
      case "SYNTHESIS_READY":
      case "EXPORTED":
        return {
          goal: "locked",
          output: "active",
          responses: "monitor",
        };
    }
  }

  function describeDraftStep(): string | null {
    if (hasGoalSummary() !== true) {
      return "REQUIRES: SAVED GOAL";
    }
    return null;
  }

  function describeApprovalStep(): string | null {
    if (hasDraftTasks() !== true) {
      return "REQUIRES: DRAFT TASKS";
    }
    if (state.snapshot.validationMessages.length > 0) {
      return "BLOCKER: DRAFT ISSUES";
    }
    return null;
  }

  function describeDispatchStep(): string | null {
    if (hasApprovedTasks() !== true) {
      return "REQUIRES: APPROVED PLAN";
    }
    if (countQueuedAssignments() === 0) {
      return "BLOCKER: NO QUEUED WORK";
    }
    return null;
  }

  function describeSynthesisStep(): string | null {
    if (state.snapshot.responses.length === 0) {
      return "REQUIRES: RESPONSES";
    }
    if (countOpenConflicts() > 0) {
      return countOpenConflicts() === 1 ? "BLOCKER: OPEN DECISION" : "BLOCKER: OPEN DECISIONS";
    }
    return null;
  }

  function describeHandoffStep(): string {
    if (state.snapshot.exportSummary.exportReady) {
      return "STATE: EXPORT READY";
    }
    const firstRequirement = state.snapshot.exportSummary.missingRequirements[0] ?? "";
    if (firstRequirement === "Define a goal") {
      return "REQUIRES: SAVED GOAL";
    }
    if (firstRequirement === "Target room must be repair-room") {
      return "REQUIRES: TARGET REPAIR ROOM";
    }
    if (firstRequirement === "Select a synthesis") {
      return "REQUIRES: SELECTED SYNTHESIS";
    }
    if (firstRequirement.startsWith("Resolve ")) {
      return "BLOCKER: OPEN DECISION";
    }
    if (firstRequirement === "Add at least one acceptance criterion") {
      return "REQUIRES: ACCEPTANCE CRITERIA";
    }
    return "BLOCKER: HANDOFF CHECK";
  }

  function latestExportLabel(): string | null {
    const latestExport = state.snapshot.exports[0]?.filePath;
    return latestExport ? (latestExport.split("/").at(-1) ?? latestExport) : null;
  }

  function derivePrimaryAction(flow: ForgeUiFlowModel): ForgePrimaryAction {
    const nextAction = (() => {
      switch (flow.state) {
        case "IDLE":
          return {
            label: "Save goal",
            description: "CONTROL LOCKED UNTIL GOAL IS SAVED.",
            mode: "command" as const,
            commandAction: "save-goal",
          };
        case "SESSION_CREATED":
          return {
            label: "Save goal",
            description: "NEXT ACTION REQUIRED: SAVE GOAL.",
            mode: "command" as const,
            commandAction: "save-goal",
          };
        case "GOAL_DEFINED":
          return {
            label: "Generate draft",
            description: "NEXT ACTION REQUIRED: GENERATE DRAFT.",
            mode: "command" as const,
            commandAction: "generate-draft",
          };
        case "DRAFT_READY": {
          const approvalStep = describeApprovalStep();
          return approvalStep
            ? {
                label: "Finish draft",
                description: approvalStep,
                mode: "guide" as const,
                guidedSurface: "goal",
              }
            : {
                label: "Approve draft",
                description: "NEXT ACTION REQUIRED: APPROVE DRAFT.",
                mode: "command" as const,
                commandAction: "approve-draft",
              };
        }
        case "APPROVED":
          return {
            label: "Dispatch assignments",
            description: "NEXT ACTION REQUIRED: DISPATCH ASSIGNMENTS.",
            mode: "command" as const,
            commandAction: "dispatch-assignments",
          };
        case "DISPATCHED":
          return {
            label: "Review response lane",
            description: "STATE HOLD: WAIT FOR RESPONSES.",
            mode: "guide" as const,
            guidedSurface: "responses",
          };
        case "RESPONSES_READY":
          return {
            label: "Generate synthesis",
            description: "NEXT ACTION REQUIRED: GENERATE SYNTHESIS.",
            mode: "command" as const,
            commandAction: "generate-synthesis",
          };
        case "CONFLICT":
          return {
            label: "Resolve decision",
            description: "RUN BLOCKED: RESOLVE DECISION.",
            mode: "guide" as const,
            guidedSurface: "responses",
          };
        case "SYNTHESIS_READY":
          if (state.snapshot.selectedSynthesisId === null) {
            return {
              label: "Choose synthesis",
              description: "EXPORT LOCKED: SELECT SYNTHESIS.",
              mode: "guide" as const,
              guidedSurface: "synthesis",
            };
          }
          return state.snapshot.exportSummary.exportReady
            ? {
                label: "Export handoff",
                description: "FINAL STEP READY: EXPORT HANDOFF.",
                mode: "command" as const,
                commandAction: "export-handoff",
              }
            : {
                label: "Check handoff",
                description: describeHandoffStep(),
                mode: "command" as const,
                commandAction: "handoff-check",
              };
        case "EXPORTED":
          return {
            label: "Review export",
            description: `EXPORT COMPLETE: ${latestExportLabel() ?? "HANDOFF PACKAGE"}.`,
            mode: "guide" as const,
            guidedSurface: "synthesis",
          };
      }
    })();

    if (state.pendingCommand !== null) {
      return {
        ...nextAction,
        label: "Working on this step",
        description: "SYSTEM LOCKED UNTIL STEP COMPLETES.",
        disabled: true,
      };
    }
    return nextAction;
  }

  function renderStatusBar(flow: ForgeUiFlowModel): HTMLElement {
    const bar = createElement("header", "forge-statusbar");
    const primaryAction = derivePrimaryAction(flow);
    bar.dataset["forgeUiState"] = flow.state;

    const identity = createElement("div", "forge-statusbar__identity");
    identity.append(
      createElement("p", "forge-statusbar__room", state.context.roomName),
      createElement(
        "strong",
        "forge-statusbar__goal",
        state.snapshot.currentGoal?.summary || "Define the goal to start this run."
      ),
      createElement("p", "forge-statusbar__stage", `State ${flow.label}`)
    );

    const stats = createElement("div", "forge-statusbar__stats");
    [
      `QUEUE ${String(countQueuedAssignments())}`,
      `ANS ${String(state.snapshot.responses.length)}`,
      `CF ${String(countOpenConflicts())}`,
      `SYN ${hasSynthesisArtifacts() ? "OPEN" : "LOCKED"}`,
      `EXP ${hasValidExport() ? "SENT" : state.snapshot.exportSummary.exportReady ? "READY" : "LOCKED"}`,
    ].forEach((value, index) => {
      const chip = createElement(
        "span",
        index === 4 && (hasValidExport() || state.snapshot.exportSummary.exportReady)
          ? "forge-chip forge-chip--accent"
          : "forge-chip",
        value
      );
      stats.append(chip);
    });

    const guidance = createElement("div", "forge-statusbar__guidance");
    const actionButton = createElement(
      "button",
      "forge-button forge-button--primary forge-statusbar__action",
      primaryAction.label
    ) as HTMLButtonElement;
    actionButton.disabled = primaryAction.disabled === true;
    if (primaryAction.mode === "command" && primaryAction.commandAction) {
      actionButton.dataset["forgeAction"] = primaryAction.commandAction;
    }
    if (primaryAction.mode === "guide" && primaryAction.guidedSurface) {
      actionButton.dataset["forgeGuideSurface"] = primaryAction.guidedSurface;
    }
    guidance.append(
      createElement("p", "forge-statusbar__label", "Required action"),
      actionButton,
      createElement("p", "forge-statusbar__note", primaryAction.description)
    );

    bar.append(identity, stats, guidance);
    return bar;
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
    const flow = deriveUiFlowModel();
    const panelModes = derivePanelModes(flow.state);
    shell.dataset["forgeUiState"] = flow.state;

    const workbench = createElement("section", "forge-workbench");
    const guidedSurface = viewState.guidedSurface ?? flow.surface;

    const planColumn = createElement("section", "forge-column forge-column--plan");
    planColumn.dataset["panelMode"] = panelModes.goal;
    if (guidedSurface === "goal" && panelModes.goal !== "locked") {
      planColumn.dataset["guided"] = "true";
    }
    planColumn.append(
      renderColumnHeading("Left", "Plan"),
      renderGoalInputPanel(documentRef, state, text, {
        draftBlockedReason: describeDraftStep(),
        flowState: flow.state,
      }),
      hasApprovedTasks()
        ? renderApprovedTasksPanel(documentRef, state, text, {
            dispatchBlockedReason: describeDispatchStep(),
            flowState: flow.state,
          })
        : renderDraftBreakdownPanel(documentRef, state, text, {
            approvalBlockedReason: describeApprovalStep(),
            flowState: flow.state,
            rawEditorOpen: viewState.advancedDraftOpen,
          })
    );

    const responseColumn = createElement("section", "forge-column forge-column--responses");
    responseColumn.dataset["panelMode"] = panelModes.responses;
    if (guidedSurface === "responses" && panelModes.responses !== "locked") {
      responseColumn.dataset["guided"] = "true";
    }
    responseColumn.append(
      renderColumnHeading("Center", "Responses / Decision"),
      renderResponsesPanel(documentRef, state, text, {
        expandedResponseIds: viewState.expandedResponseIds,
        flowState: flow.state,
      })
    );

    const outputColumn = createElement("section", "forge-column forge-column--output");
    outputColumn.dataset["panelMode"] = panelModes.synthesis;
    if (guidedSurface === "synthesis" && panelModes.synthesis !== "locked") {
      outputColumn.dataset["guided"] = "true";
    }
    outputColumn.append(
      renderColumnHeading("Right", "Output"),
      renderSynthesisPanel(documentRef, state, text, {
        expandedSynthesisIds: viewState.expandedSynthesisIds,
        exportBlockedReason: describeHandoffStep(),
        flowState: flow.state,
        synthesisBlockedReason: describeSynthesisStep(),
      })
    );

    workbench.append(planColumn, responseColumn, outputColumn);
    shell.append(
      renderStatusBar(flow),
      workbench,
      renderCoordinatorPanel(documentRef, state, {
        flowState: flow.state,
        handoffLabel: hasValidExport()
          ? "sent"
          : state.snapshot.exportSummary.exportReady
            ? "ready"
            : "locked",
        note: derivePrimaryAction(flow).description,
      })
    );
    mount.replaceChildren(shell);
    bindActions(shell);
    lastRenderSignature = renderSignature;
  }

  function bumpLocalUiVersion(): void {
    localUiVersion += 1;
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
      viewState.guidedSurface = null;
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
      }
      render();
    }

    root.querySelectorAll<HTMLElement>("[data-forge-guide-surface]").forEach((element) => {
      element.addEventListener("click", () => {
        const guidedSurface = element.dataset["forgeGuideSurface"];
        if (
          guidedSurface !== "goal" &&
          guidedSurface !== "responses" &&
          guidedSurface !== "synthesis"
        ) {
          return;
        }
        viewState.guidedSurface = guidedSurface;
        bumpLocalUiVersion();
        render();
      });
    });

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
        issueCommand("ForgeRoomUpdateGoal", () =>
          requestRuntime.updateGoal({
            summary: readInputValue("forge-goal-summary"),
            brief: readInputValue("forge-goal-brief"),
            constraints: parseConstraintLines(readInputValue("forge-goal-constraints")),
            targetRoomId: readInputValue("forge-goal-target-room"),
          })
        );
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='generate-draft']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomGenerateDraft", () =>
          requestRuntime.generateDraft({
            summary: readInputValue("forge-goal-summary"),
            brief: readInputValue("forge-goal-brief"),
            constraints: parseConstraintLines(readInputValue("forge-goal-constraints")),
            targetRoomId: readInputValue("forge-goal-target-room"),
          })
        );
      });
    root
      .querySelector<HTMLElement>("[data-forge-toggle-advanced-draft='true']")
      ?.addEventListener("click", () => {
        viewState.advancedDraftOpen = !viewState.advancedDraftOpen;
        bumpLocalUiVersion();
        render();
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='apply-draft-text']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomApplyDraftText", () =>
          requestRuntime.applyDraftText({
            draftText: readInputValue("forge-draft-source"),
          })
        );
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
    root.querySelectorAll<HTMLElement>("[data-forge-toggle-response]").forEach((element) => {
      element.addEventListener("click", () => {
        const responseId = element.dataset["forgeToggleResponse"];
        if (!responseId) {
          return;
        }
        if (viewState.expandedResponseIds.has(responseId)) {
          viewState.expandedResponseIds.delete(responseId);
        } else {
          viewState.expandedResponseIds.add(responseId);
        }
        bumpLocalUiVersion();
        render();
      });
    });
    root.querySelectorAll<HTMLElement>("[data-forge-resolve-conflict]").forEach((element) => {
      element.addEventListener("click", () => {
        const conflictId = element.dataset["forgeResolveConflict"];
        const status = element.dataset["forgeConflictStatus"];
        if (!conflictId || !status) {
          return;
        }
        issueCommand("ForgeRoomResolveConflict", () =>
          requestRuntime.resolveConflict({
            conflictId,
            preferredResponseId: element.dataset["forgePreferredResponseId"] ?? null,
            status: status === "resolved" ? "resolved" : "open",
          })
        );
      });
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
    root.querySelectorAll<HTMLElement>("[data-forge-toggle-synthesis]").forEach((element) => {
      element.addEventListener("click", () => {
        const synthesisId = element.dataset["forgeToggleSynthesis"];
        if (!synthesisId) {
          return;
        }
        if (viewState.expandedSynthesisIds.has(synthesisId)) {
          viewState.expandedSynthesisIds.delete(synthesisId);
        } else {
          viewState.expandedSynthesisIds.add(synthesisId);
        }
        bumpLocalUiVersion();
        render();
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
      const snapshotSource =
        forgeStatePayload["snapshot"] !== undefined
          ? forgeStatePayload["snapshot"]
          : payload["snapshot"];
      const metaSource =
        forgeStatePayload["meta"] !== undefined ? forgeStatePayload["meta"] : payload["meta"];
      state.snapshot = sanitizeForgeRoomSnapshot(snapshotSource);
      const meta = toRecord(metaSource);
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
