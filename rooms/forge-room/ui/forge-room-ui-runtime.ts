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
type ForgeTextParams = Record<string, number | string>;

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

  function applyTextParams(template: string, params?: ForgeTextParams): string {
    if (!params) {
      return template;
    }
    return Object.entries(params).reduce((result, [key, value]) => {
      return result.replaceAll(`{${key}}`, String(value));
    }, template);
  }

  function text(path: string[], fallback: string, params?: ForgeTextParams): string {
    let current: unknown = state.context.translations;
    for (const part of path) {
      const next = toRecord(current)[part];
      if (next === undefined) {
        return applyTextParams(fallback, params);
      }
      current = next;
    }
    const resolved =
      typeof current === "string" && current.trim() !== "" ? current : fallback;
    return applyTextParams(resolved, params);
  }

  function localizedRoomName(): string {
    return text(["title"], state.context.roomName);
  }

  function toFlowKey(flowState: ForgeWorkbenchUiFlowState): string {
    const keys: Record<ForgeWorkbenchUiFlowState, string> = {
      IDLE: "idle",
      GOAL_DEFINED: "goalDefined",
      SESSION_CREATED: "sessionCreated",
      DRAFT_READY: "draftReady",
      APPROVED: "approved",
      DISPATCHED: "dispatched",
      RESPONSES_READY: "responsesReady",
      CONFLICT: "conflict",
      SYNTHESIS_READY: "synthesisReady",
      EXPORTED: "exported",
    };
    return keys[flowState];
  }

  function setPanelBadge(panel: HTMLElement, mode: ForgePanelMode): void {
    const badge =
      mode === "locked"
        ? text(["workbench", "badges", "locked"], "Locked")
        : mode === "monitor"
          ? text(["workbench", "badges", "monitor"], "Monitor")
          : "";
    if (badge === "") {
      delete panel.dataset["panelBadge"];
      return;
    }
    panel.dataset["panelBadge"] = badge;
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
    const fallbacks: Record<ForgeWorkbenchUiFlowState, string> = {
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
    return text(["workbench", "flow", toFlowKey(flowState)], fallbacks[flowState]);
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
          synthesis: "locked",
          responses: "locked",
        };
      case "DISPATCHED":
      case "CONFLICT":
        return {
          goal: "locked",
          synthesis: "locked",
          responses: "active",
        };
      case "RESPONSES_READY":
      case "SYNTHESIS_READY":
      case "EXPORTED":
        return {
          goal: "locked",
          synthesis: "active",
          responses: "monitor",
        };
      default:
        return {
          goal: "active",
          synthesis: "locked",
          responses: "locked",
        };
    }
  }

  function describeDraftStep(): string | null {
    if (hasGoalSummary() !== true) {
      return text(["workbench", "guards", "requiresSavedGoal"], "REQUIRES: SAVED GOAL");
    }
    return null;
  }

  function describeApprovalStep(): string | null {
    if (hasDraftTasks() !== true) {
      return text(["workbench", "guards", "requiresDraftTasks"], "REQUIRES: DRAFT TASKS");
    }
    if (state.snapshot.validationMessages.length > 0) {
      return text(["workbench", "guards", "blockerDraftIssues"], "BLOCKER: DRAFT ISSUES");
    }
    return null;
  }

  function describeDispatchStep(): string | null {
    if (hasApprovedTasks() !== true) {
      return text(["workbench", "guards", "requiresApprovedPlan"], "REQUIRES: APPROVED PLAN");
    }
    if (countQueuedAssignments() === 0) {
      return text(["workbench", "guards", "blockerNoQueuedWork"], "BLOCKER: NO QUEUED WORK");
    }
    return null;
  }

  function describeSynthesisStep(): string | null {
    if (state.snapshot.responses.length === 0) {
      return text(["workbench", "guards", "requiresResponses"], "REQUIRES: RESPONSES");
    }
    if (countOpenConflicts() > 0) {
      return countOpenConflicts() === 1
        ? text(["workbench", "guards", "blockerOpenDecision"], "BLOCKER: OPEN DECISION")
        : text(["workbench", "guards", "blockerOpenDecisions"], "BLOCKER: OPEN DECISIONS");
    }
    return null;
  }

  function describeHandoffStep(): string {
    if (state.snapshot.exportSummary.exportReady) {
      return text(["workbench", "guards", "stateExportReady"], "STATE: EXPORT READY");
    }
    const firstRequirement = state.snapshot.exportSummary.missingRequirements[0] ?? "";
    if (firstRequirement === "Define a goal") {
      return text(["workbench", "guards", "requiresSavedGoal"], "REQUIRES: SAVED GOAL");
    }
    if (firstRequirement === "Target room must be repair-room") {
      return text(
        ["workbench", "guards", "requiresTargetRepairRoom"],
        "REQUIRES: TARGET REPAIR ROOM"
      );
    }
    if (firstRequirement === "Select a synthesis") {
      return text(
        ["workbench", "guards", "requiresSelectedSynthesis"],
        "REQUIRES: SELECTED SYNTHESIS"
      );
    }
    if (firstRequirement.startsWith("Resolve ")) {
      return text(["workbench", "guards", "blockerOpenDecision"], "BLOCKER: OPEN DECISION");
    }
    if (firstRequirement === "Add at least one acceptance criterion") {
      return text(
        ["workbench", "guards", "requiresAcceptanceCriteria"],
        "REQUIRES: ACCEPTANCE CRITERIA"
      );
    }
    return text(["workbench", "guards", "blockerHandoffCheck"], "BLOCKER: HANDOFF CHECK");
  }

  function latestExportLabel(): string | null {
    const latestExport = state.snapshot.exports[0]?.filePath;
    return latestExport ? (latestExport.split("/").at(-1) ?? latestExport) : null;
  }

  function derivePrimaryAction(flow: ForgeUiFlowModel): ForgePrimaryAction {
    const nextAction: ForgePrimaryAction = (() => {
      switch (flow.state) {
        case "IDLE":
          return {
            label: text(["workbench", "primaryAction", "saveGoal"], "Save goal"),
            description: text(
              ["workbench", "primaryAction", "saveGoalLocked"],
              "CONTROL LOCKED UNTIL GOAL IS SAVED."
            ),
            mode: "command" as const,
            commandAction: "save-goal",
          };
        case "SESSION_CREATED":
          return {
            label: text(["workbench", "primaryAction", "saveGoal"], "Save goal"),
            description: text(
              ["workbench", "primaryAction", "saveGoalRequired"],
              "NEXT ACTION REQUIRED: SAVE GOAL."
            ),
            mode: "command" as const,
            commandAction: "save-goal",
          };
        case "GOAL_DEFINED":
          return {
            label: text(["workbench", "primaryAction", "generateDraft"], "Generate draft"),
            description: text(
              ["workbench", "primaryAction", "generateDraftRequired"],
              "NEXT ACTION REQUIRED: GENERATE DRAFT."
            ),
            mode: "command" as const,
            commandAction: "generate-draft",
          };
        case "DRAFT_READY": {
          const approvalStep = describeApprovalStep();
          return approvalStep
            ? {
                label: text(["workbench", "primaryAction", "finishDraft"], "Finish draft"),
                description: approvalStep,
                mode: "guide" as const,
                guidedSurface: "goal",
              }
            : {
                label: text(["workbench", "primaryAction", "approveDraft"], "Approve draft"),
                description: text(
                  ["workbench", "primaryAction", "approveDraftRequired"],
                  "NEXT ACTION REQUIRED: APPROVE DRAFT."
                ),
                mode: "command" as const,
                commandAction: "approve-draft",
              };
        }
        case "APPROVED":
          return {
            label: text(
              ["workbench", "primaryAction", "dispatchAssignments"],
              "Dispatch assignments"
            ),
            description: text(
              ["workbench", "primaryAction", "dispatchAssignmentsRequired"],
              "NEXT ACTION REQUIRED: DISPATCH ASSIGNMENTS."
            ),
            mode: "command" as const,
            commandAction: "dispatch-assignments",
          };
        case "DISPATCHED":
          return {
            label: text(
              ["workbench", "primaryAction", "reviewResponseLane"],
              "Review response lane"
            ),
            description: text(
              ["workbench", "primaryAction", "waitForResponses"],
              "STATE HOLD: WAIT FOR RESPONSES."
            ),
            mode: "guide" as const,
            guidedSurface: "responses",
          };
        case "RESPONSES_READY":
          return {
            label: text(
              ["workbench", "primaryAction", "generateSynthesis"],
              "Generate synthesis"
            ),
            description: text(
              ["workbench", "primaryAction", "generateSynthesisRequired"],
              "NEXT ACTION REQUIRED: GENERATE SYNTHESIS."
            ),
            mode: "command" as const,
            commandAction: "generate-synthesis",
          };
        case "CONFLICT":
          return {
            label: text(["workbench", "primaryAction", "resolveDecision"], "Resolve decision"),
            description: text(
              ["workbench", "primaryAction", "resolveDecisionBlocked"],
              "RUN BLOCKED: RESOLVE DECISION."
            ),
            mode: "guide" as const,
            guidedSurface: "responses",
          };
        case "SYNTHESIS_READY":
          if (state.snapshot.selectedSynthesisId === null) {
            return {
              label: text(["workbench", "primaryAction", "chooseSynthesis"], "Choose synthesis"),
              description: text(
                ["workbench", "primaryAction", "chooseSynthesisRequired"],
                "EXPORT LOCKED: SELECT SYNTHESIS."
              ),
              mode: "guide" as const,
              guidedSurface: "synthesis",
            };
          }
          return state.snapshot.exportSummary.exportReady
            ? {
                label: text(["workbench", "primaryAction", "exportHandoff"], "Export handoff"),
                description: text(
                  ["workbench", "primaryAction", "exportHandoffReady"],
                  "FINAL STEP READY: EXPORT HANDOFF."
                ),
                mode: "command" as const,
                commandAction: "export-handoff",
              }
            : {
                label: text(["workbench", "primaryAction", "checkHandoff"], "Check handoff"),
                description: describeHandoffStep(),
                mode: "command" as const,
                commandAction: "handoff-check",
              };
        case "EXPORTED":
          return {
            label: text(["workbench", "primaryAction", "reviewExport"], "Review export"),
            description: text(
              ["workbench", "primaryAction", "exportComplete"],
              "EXPORT COMPLETE: {label}.",
              { label: latestExportLabel() ?? "HANDOFF PACKAGE" }
            ),
            mode: "guide" as const,
            guidedSurface: "synthesis",
          };
        default:
          return {
            label: text(["workbench", "primaryAction", "saveGoal"], "Save goal"),
            description: text(
              ["workbench", "primaryAction", "saveGoalLocked"],
              "CONTROL LOCKED UNTIL GOAL IS SAVED."
            ),
            mode: "command" as const,
            commandAction: "save-goal",
          };
      }
    })();

    if (state.pendingCommand !== null) {
      return {
        ...nextAction,
        label: text(["workbench", "primaryAction", "working"], "Working on this step"),
        description: text(
          ["workbench", "primaryAction", "workingLocked"],
          "SYSTEM LOCKED UNTIL STEP COMPLETES."
        ),
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
      createElement("p", "forge-statusbar__room", localizedRoomName()),
      createElement(
        "strong",
        "forge-statusbar__goal",
        state.snapshot.currentGoal?.summary ||
          text(
            ["workbench", "statusBar", "startGoal"],
            "Define the goal to start this run."
          )
      ),
      createElement(
        "p",
        "forge-statusbar__stage",
        text(["workbench", "statusBar", "stage"], "State {label}", { label: flow.label })
      )
    );

    const stats = createElement("div", "forge-statusbar__stats");
    [
      text(["workbench", "statusBar", "stats", "queue"], "QUEUE {count}", {
        count: countQueuedAssignments(),
      }),
      text(["workbench", "statusBar", "stats", "answers"], "ANS {count}", {
        count: state.snapshot.responses.length,
      }),
      text(["workbench", "statusBar", "stats", "decisions"], "CF {count}", {
        count: countOpenConflicts(),
      }),
      hasSynthesisArtifacts()
        ? text(["workbench", "statusBar", "stats", "synthesisOpen"], "SYN OPEN")
        : text(["workbench", "statusBar", "stats", "synthesisLocked"], "SYN LOCKED"),
      hasValidExport()
        ? text(["workbench", "statusBar", "stats", "exportSent"], "EXP SENT")
        : state.snapshot.exportSummary.exportReady
          ? text(["workbench", "statusBar", "stats", "exportReady"], "EXP READY")
          : text(["workbench", "statusBar", "stats", "exportLocked"], "EXP LOCKED"),
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
    );
    actionButton.disabled = primaryAction.disabled === true;
    if (primaryAction.mode === "command" && primaryAction.commandAction) {
      actionButton.dataset["forgeAction"] = primaryAction.commandAction;
    }
    if (primaryAction.mode === "guide" && primaryAction.guidedSurface) {
      actionButton.dataset["forgeGuideSurface"] = primaryAction.guidedSurface;
    }
    guidance.append(
      createElement(
        "p",
        "forge-statusbar__label",
        text(["workbench", "statusBar", "requiredAction"], "Required action")
      ),
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
    documentRef.documentElement.lang =
      typeof state.context.locale === "string" && state.context.locale.trim() !== ""
        ? state.context.locale
        : "en";
    documentRef.title = `${localizedRoomName()} - ${text(
      ["workbench", "title"],
      "Forge Workbench"
    )}`;
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
    const flowLabel = toUiFlowLabel(flow.state);

    const planColumn = createElement("section", "forge-column forge-column--plan");
    planColumn.dataset["panelMode"] = panelModes.goal;
    if (guidedSurface === "goal" && panelModes.goal !== "locked") {
      planColumn.dataset["guided"] = "true";
    }
    const goalPanel = renderGoalInputPanel(documentRef, state, text, {
      draftBlockedReason: describeDraftStep(),
      flowLabel,
      flowState: flow.state,
    });
    setPanelBadge(goalPanel, panelModes.goal);
    const planSecondaryPanel = hasApprovedTasks()
      ? renderApprovedTasksPanel(documentRef, state, text, {
          dispatchBlockedReason: describeDispatchStep(),
          flowState: flow.state,
        })
      : renderDraftBreakdownPanel(documentRef, state, text, {
          approvalBlockedReason: describeApprovalStep(),
          flowState: flow.state,
          rawEditorOpen: viewState.advancedDraftOpen,
        });
    setPanelBadge(planSecondaryPanel, panelModes.goal);
    planColumn.append(
      renderColumnHeading(
        text(["workbench", "columns", "planEyebrow"], "Left"),
        text(["workbench", "columns", "planTitle"], "Plan")
      ),
      goalPanel,
      planSecondaryPanel
    );

    const responseColumn = createElement("section", "forge-column forge-column--responses");
    responseColumn.dataset["panelMode"] = panelModes.responses;
    if (guidedSurface === "responses" && panelModes.responses !== "locked") {
      responseColumn.dataset["guided"] = "true";
    }
    const responsesPanel = renderResponsesPanel(documentRef, state, text, {
      expandedResponseIds: viewState.expandedResponseIds,
      flowState: flow.state,
    });
    setPanelBadge(responsesPanel, panelModes.responses);
    responseColumn.append(
      renderColumnHeading(
        text(["workbench", "columns", "responsesEyebrow"], "Center"),
        text(["workbench", "columns", "responsesTitle"], "Responses / Decision")
      ),
      responsesPanel
    );

    const outputColumn = createElement("section", "forge-column forge-column--output");
    outputColumn.dataset["panelMode"] = panelModes.synthesis;
    if (guidedSurface === "synthesis" && panelModes.synthesis !== "locked") {
      outputColumn.dataset["guided"] = "true";
    }
    const synthesisPanel = renderSynthesisPanel(documentRef, state, text, {
      expandedSynthesisIds: viewState.expandedSynthesisIds,
      exportBlockedReason: describeHandoffStep(),
      flowState: flow.state,
      synthesisBlockedReason: describeSynthesisStep(),
    });
    setPanelBadge(synthesisPanel, panelModes.synthesis);
    outputColumn.append(
      renderColumnHeading(
        text(["workbench", "columns", "outputEyebrow"], "Right"),
        text(["workbench", "columns", "outputTitle"], "Output")
      ),
      synthesisPanel
    );

    workbench.append(planColumn, responseColumn, outputColumn);
    shell.append(
      renderStatusBar(flow),
      workbench,
      renderCoordinatorPanel(documentRef, state, text, {
        flowLabel,
        flowState: flow.state,
        handoffLabel: hasValidExport()
          ? text(["workbench", "coordinator", "handoffStatuses", "sent"], "sent")
          : state.snapshot.exportSummary.exportReady
            ? text(["workbench", "coordinator", "handoffStatuses", "ready"], "ready")
            : text(["workbench", "coordinator", "handoffStatuses", "locked"], "locked"),
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
            title: text(["workbench", "defaults", "newTaskTitle"], "New task"),
            summary: text(
              ["workbench", "defaults", "newTaskSummary"],
              "Describe the next top-level Forge task."
            ),
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
