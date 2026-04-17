import {
  sanitizeForgeRoomSnapshot,
  sanitizeForgeUiContext
} from "../shared/ui/host-messages.js";
import { createForgeUiRequestRuntime } from "../shared/ui/request-runtime.js";
import {
  createInitialForgeUiState
} from "../shared/ui/state.js";
import {
  createDefaultForgeOperatorProfile
} from "../shared/types/index.js";
import { renderApprovedTasksPanel } from "./panels/approved-tasks-panel.js";
import { renderCoordinatorPanel } from "./panels/coordinator-panel.js";
import { renderDraftBreakdownPanel } from "./panels/draft-breakdown-panel.js";
import { renderGoalInputPanel } from "./panels/goal-input-panel.js";
import { renderResponsesPanel } from "./panels/responses-panel.js";
import { renderSynthesisPanel } from "./panels/synthesis-panel.js";
export function createForgeRoomUiRuntime() {
  const state = createInitialForgeUiState();
  const requestRuntime = createForgeUiRequestRuntime();
  const windowRef = window;
  const documentRef = document;
  const viewState = {
    advancedCapsulesOpen: false,
    advancedDraftOpen: false,
    activeProfileEntryId: null,
    expandedResponseIds: /* @__PURE__ */ new Set(),
    expandedSynthesisIds: /* @__PURE__ */ new Set(),
    goalDetailsOpen: false,
    goalDraft: null,
    goalDraftDirty: false,
    guidedSurface: null,
    operatorProfileDraft: null,
    operatorProfileDraftDirty: false,
    operatorProfileDraftSourceFingerprint: null,
    profileEditorOpen: false,
    runConditionComposerOpen: false,
    runConditionComposerValue: "",
    runOverrideDraft: null,
    runOverrideDraftDirty: false,
    sessionContextDraft: null
  };
  let lastRenderSignature = null;
  let localUiVersion = 0;
  function createElement(tagName, className, textContent) {
    const element = documentRef.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (typeof textContent === "string") {
      element.textContent = textContent;
    }
    return element;
  }
  function toRecord(value) {
    return value !== null && typeof value === "object" && Array.isArray(value) === false ? value : {};
  }
  function applyTextParams(template, params) {
    if (!params) {
      return template;
    }
    return Object.entries(params).reduce((result, [key, value]) => {
      return result.replaceAll(`{${key}}`, String(value));
    }, template);
  }
  function text(path, fallback, params) {
    let current = state.context.translations;
    for (const part of path) {
      const next = toRecord(current)[part];
      if (next === void 0) {
        return applyTextParams(fallback, params);
      }
      current = next;
    }
    const resolved = typeof current === "string" && current.trim() !== "" ? current : fallback;
    return applyTextParams(resolved, params);
  }
  function localizedRoomName() {
    return text(["title"], state.context.roomName);
  }
  function toFlowKey(flowState) {
    const keys = {
      IDLE: "idle",
      GOAL_DEFINED: "goalDefined",
      SESSION_CREATED: "sessionCreated",
      DRAFT_READY: "draftReady",
      APPROVED: "approved",
      DISPATCHED: "dispatched",
      RESPONSES_READY: "responsesReady",
      CONFLICT: "conflict",
      SYNTHESIS_READY: "synthesisReady",
      EXPORTED: "exported"
    };
    return keys[flowState];
  }
  function setPanelBadge(panel, mode) {
    const badge = mode === "locked" ? text(["workbench", "badges", "locked"], "Locked") : mode === "monitor" ? text(["workbench", "badges", "monitor"], "Monitor") : "";
    if (badge === "") {
      delete panel.dataset["panelBadge"];
      return;
    }
    panel.dataset["panelBadge"] = badge;
  }
  function buildRenderSignature() {
    return JSON.stringify({
      context: state.context,
      lastCommandResult: state.lastCommandResult,
      localUiVersion,
      meta: state.meta,
      pendingCommand: state.pendingCommand,
      snapshot: state.snapshot
    });
  }
  function countQueuedAssignments() {
    return state.snapshot.assignments.filter((assignment) => assignment.status === "queued").length;
  }
  function countTopLevelDraftTasks() {
    return state.snapshot.draftTasks.filter((task) => task.level === 1).length;
  }
  function countTopLevelApprovedTasks() {
    return state.snapshot.approvedTasks.filter((task) => task.level === 1).length;
  }
  function countOpenConflicts() {
    return state.snapshot.conflicts.filter((conflict) => conflict.status === "open").length;
  }
  function hasGoalSummary() {
    return Boolean(state.snapshot.currentGoal?.summary.trim());
  }
  function hasDraftTasks() {
    return countTopLevelDraftTasks() > 0;
  }
  function hasApprovedTasks() {
    return countTopLevelApprovedTasks() > 0;
  }
  function hasDispatchStarted() {
    return state.snapshot.assignments.some((assignment) => assignment.status !== "queued");
  }
  function hasSynthesisArtifacts() {
    return state.snapshot.syntheses.length > 0 || state.snapshot.selectedSynthesisId !== null;
  }
  function hasValidExport() {
    return state.snapshot.exports.length > 0 && countOpenConflicts() === 0 && state.snapshot.selectedSynthesisId !== null;
  }
  function cloneSessionContextSelection(selection) {
    return {
      skill: {
        level: selection.skill.level,
        soldering: selection.skill.soldering,
        measurement: selection.skill.measurement,
        mechanical: selection.skill.mechanical
      },
      tools: {
        multimeter: selection.tools.multimeter,
        solderingIron: selection.tools.solderingIron,
        hotAir: selection.tools.hotAir,
        benchPowerSupply: selection.tools.benchPowerSupply,
        magnification: selection.tools.magnification
      },
      preferences: {
        mode: selection.preferences.mode,
        riskTolerance: selection.preferences.riskTolerance
      }
    };
  }
  function sessionContextSelectionEquals(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  function cloneOperatorProfile(profile) {
    return {
      schemaVersion: profile.schemaVersion,
      updatedAt: profile.updatedAt,
      skill: {
        level: profile.skill.level,
        soldering: profile.skill.soldering,
        measurement: profile.skill.measurement,
        mechanical: profile.skill.mechanical
      },
      tools: {
        multimeter: profile.tools.multimeter,
        solderingIron: profile.tools.solderingIron,
        hotAir: profile.tools.hotAir,
        benchPowerSupply: profile.tools.benchPowerSupply,
        magnification: profile.tools.magnification
      },
      preferences: {
        mode: profile.preferences.mode,
        riskTolerance: profile.preferences.riskTolerance
      }
    };
  }
  function operatorProfilesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  function currentSessionContextSelection() {
    return viewState.sessionContextDraft ?? state.snapshot.sessionContextSelection;
  }
  function goalSnapshotFingerprint() {
    return JSON.stringify({
      goalId: state.snapshot.currentGoal?.id ?? null,
      sessionId: state.snapshot.activeSessionId,
      summary: state.snapshot.currentGoal?.summary ?? "",
      brief: state.snapshot.currentGoal?.brief ?? "",
      constraints: state.snapshot.currentGoal?.constraints ?? [],
      targetRoomId: state.snapshot.currentGoal?.targetRoomId ?? "repair-room"
    });
  }
  function operatorProfileSnapshotFingerprint() {
    return JSON.stringify(state.snapshot.operatorProfile);
  }
  function runOverrideSnapshotFingerprint() {
    const runOverride = state.snapshot.runOverride;
    return JSON.stringify({
      sessionId: state.snapshot.activeSessionId,
      enableRovoPreAnalysis: runOverride?.enableRovoPreAnalysis === true,
      notes: runOverride?.notes ?? "",
      tools: {
        hotAir: runOverride?.tools.hotAir === true
      }
    });
  }
  function createGoalDraftFromSnapshot() {
    return {
      brief: state.snapshot.currentGoal?.brief ?? "",
      constraints: [...state.snapshot.currentGoal?.constraints ?? []],
      sourceFingerprint: goalSnapshotFingerprint(),
      sourceGoalId: state.snapshot.currentGoal?.id ?? null,
      sourceSessionId: state.snapshot.activeSessionId,
      summary: state.snapshot.currentGoal?.summary ?? "",
      targetRoomId: state.snapshot.currentGoal?.targetRoomId ?? "repair-room"
    };
  }
  function syncGoalDraftFromSnapshot(force = false) {
    const nextDraft = createGoalDraftFromSnapshot();
    const draft = viewState.goalDraft;
    const allowPendingRefresh = state.pendingCommand === "ForgeRoomUpdateGoal";
    const snapshotChanged = draft?.sourceFingerprint !== nextDraft.sourceFingerprint;
    if (force || draft === null || draft.sourceGoalId !== nextDraft.sourceGoalId || draft.sourceSessionId !== nextDraft.sourceSessionId || snapshotChanged && (viewState.goalDraftDirty === false || allowPendingRefresh)) {
      viewState.goalDraft = nextDraft;
      viewState.goalDraftDirty = false;
    }
  }
  function currentGoalDraft() {
    syncGoalDraftFromSnapshot();
    return viewState.goalDraft ?? createGoalDraftFromSnapshot();
  }
  function updateGoalDraft(updater) {
    const nextDraft = updater(currentGoalDraft());
    viewState.goalDraft = nextDraft;
    viewState.goalDraftDirty = true;
    return nextDraft;
  }
  function createOperatorProfileDraftFromSnapshot() {
    return cloneOperatorProfile(state.snapshot.operatorProfile);
  }
  function syncOperatorProfileDraftFromSnapshot(force = false) {
    const nextDraft = createOperatorProfileDraftFromSnapshot();
    const draft = viewState.operatorProfileDraft;
    const nextFingerprint = operatorProfileSnapshotFingerprint();
    const allowPendingRefresh = state.pendingCommand === "ForgeRoomUpdateOperatorProfile";
    if (force || draft === null || viewState.operatorProfileDraftSourceFingerprint !== nextFingerprint && (viewState.operatorProfileDraftDirty === false || allowPendingRefresh) || viewState.operatorProfileDraftSourceFingerprint === null && operatorProfilesEqual(draft, nextDraft) === false) {
      viewState.operatorProfileDraft = nextDraft;
      viewState.operatorProfileDraftDirty = false;
      viewState.operatorProfileDraftSourceFingerprint = nextFingerprint;
    }
  }
  function currentOperatorProfileDraft() {
    syncOperatorProfileDraftFromSnapshot();
    return viewState.operatorProfileDraft ?? createDefaultForgeOperatorProfile();
  }
  function updateOperatorProfileDraft(updater) {
    const nextDraft = updater(currentOperatorProfileDraft());
    viewState.operatorProfileDraft = nextDraft;
    viewState.operatorProfileDraftDirty = true;
    return nextDraft;
  }
  function createRunOverrideDraftFromSnapshot() {
    const runOverride = state.snapshot.runOverride;
    return {
      enableRovoPreAnalysis: runOverride?.enableRovoPreAnalysis === true,
      notes: runOverride?.notes ?? "",
      sourceFingerprint: runOverrideSnapshotFingerprint(),
      sourceSessionId: state.snapshot.activeSessionId,
      tools: {
        hotAir: runOverride?.tools.hotAir === true
      }
    };
  }
  function syncRunOverrideDraftFromSnapshot(force = false) {
    const nextDraft = createRunOverrideDraftFromSnapshot();
    const draft = viewState.runOverrideDraft;
    const allowPendingRefresh = state.pendingCommand === "ForgeRoomUpdateRunOverride";
    const snapshotChanged = draft?.sourceFingerprint !== nextDraft.sourceFingerprint;
    if (force || draft === null || draft.sourceSessionId !== nextDraft.sourceSessionId || snapshotChanged && (viewState.runOverrideDraftDirty === false || allowPendingRefresh)) {
      viewState.runOverrideDraft = nextDraft;
      viewState.runOverrideDraftDirty = false;
    }
  }
  function currentRunOverrideDraft() {
    syncRunOverrideDraftFromSnapshot();
    return viewState.runOverrideDraft ?? createRunOverrideDraftFromSnapshot();
  }
  function updateRunOverrideDraft(updater) {
    const nextDraft = updater(currentRunOverrideDraft());
    viewState.runOverrideDraft = nextDraft;
    viewState.runOverrideDraftDirty = true;
    return nextDraft;
  }
  function notesToConditions(notes) {
    return notes.split(/\r?\n/).map((entry) => entry.trim()).filter((entry) => entry !== "");
  }
  function draftToRunOverridePayload(draft) {
    return {
      enableRovoPreAnalysis: draft.enableRovoPreAnalysis,
      notes: draft.notes,
      tools: {
        hotAir: draft.tools.hotAir
      }
    };
  }
  function openGoalDetails() {
    viewState.goalDetailsOpen = true;
    bumpLocalUiVersion();
    render();
  }
  function closeGoalDetails() {
    viewState.goalDetailsOpen = false;
    bumpLocalUiVersion();
    render();
  }
  function profileEntryInputId(entryId) {
    const inputIds = {
      "skill-level": "forge-profile-skill-level",
      "skill-soldering": "forge-profile-soldering",
      "skill-measurement": "forge-profile-measurement",
      "skill-mechanical": "forge-profile-mechanical",
      "tool-multimeter": "forge-profile-tool-multimeter",
      "tool-soldering-iron": "forge-profile-tool-soldering-iron",
      "tool-hot-air": "forge-profile-tool-hot-air",
      "tool-bench-supply": "forge-profile-tool-bench-supply",
      "tool-magnification": "forge-profile-tool-magnification",
      "preference-mode": "forge-profile-mode",
      "preference-risk": "forge-profile-risk"
    };
    return inputIds[entryId] ?? null;
  }
  function readProfileEntryValue(entryId) {
    switch (entryId) {
      case "skill-level":
        return state.snapshot.operatorProfile.skill.level;
      case "skill-soldering":
        return state.snapshot.operatorProfile.skill.soldering;
      case "skill-measurement":
        return state.snapshot.operatorProfile.skill.measurement;
      case "skill-mechanical":
        return state.snapshot.operatorProfile.skill.mechanical;
      case "tool-multimeter":
        return state.snapshot.operatorProfile.tools.multimeter;
      case "tool-soldering-iron":
        return state.snapshot.operatorProfile.tools.solderingIron;
      case "tool-hot-air":
        return state.snapshot.operatorProfile.tools.hotAir;
      case "tool-bench-supply":
        return state.snapshot.operatorProfile.tools.benchPowerSupply;
      case "tool-magnification":
        return state.snapshot.operatorProfile.tools.magnification;
      case "preference-mode":
        return state.snapshot.operatorProfile.preferences.mode;
      case "preference-risk":
        return state.snapshot.operatorProfile.preferences.riskTolerance;
      default:
        return null;
    }
  }
  function firstProfileEntry(section) {
    const entries = section === "skill" ? ["skill-level", "skill-soldering", "skill-measurement", "skill-mechanical"] : section === "equipment" ? [
      "tool-multimeter",
      "tool-soldering-iron",
      "tool-hot-air",
      "tool-bench-supply",
      "tool-magnification"
    ] : ["preference-mode", "preference-risk"];
    const firstEmpty = entries.find((entryId) => readProfileEntryValue(entryId) === null);
    return firstEmpty ?? entries[0] ?? "skill-level";
  }
  function openProfileEditor(entryId = null) {
    viewState.profileEditorOpen = true;
    viewState.activeProfileEntryId = entryId ?? viewState.activeProfileEntryId ?? firstProfileEntry("skill");
    bumpLocalUiVersion();
    render();
  }
  function closeProfileEditor() {
    viewState.profileEditorOpen = false;
    bumpLocalUiVersion();
    render();
  }
  function deriveUiFlowState() {
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
  function toUiFlowLabel(flowState) {
    const fallbacks = {
      IDLE: "Idle",
      GOAL_DEFINED: "Goal Defined",
      SESSION_CREATED: "Session Created",
      DRAFT_READY: "Draft Ready",
      APPROVED: "Approved",
      DISPATCHED: "Dispatched",
      RESPONSES_READY: "Responses Ready",
      CONFLICT: "Conflict",
      SYNTHESIS_READY: "Synthesis Ready",
      EXPORTED: "Exported"
    };
    return text(["workbench", "flow", toFlowKey(flowState)], fallbacks[flowState]);
  }
  function deriveDefaultSurface(flowState) {
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
  function deriveUiFlowModel() {
    const flowState = deriveUiFlowState();
    return {
      label: toUiFlowLabel(flowState),
      state: flowState,
      surface: deriveDefaultSurface(flowState)
    };
  }
  function derivePanelModes(flowState) {
    switch (flowState) {
      case "IDLE":
      case "SESSION_CREATED":
      case "GOAL_DEFINED":
      case "DRAFT_READY":
      case "APPROVED":
        return {
          goal: "active",
          synthesis: "locked",
          responses: "locked"
        };
      case "DISPATCHED":
      case "CONFLICT":
        return {
          goal: "locked",
          synthesis: "locked",
          responses: "active"
        };
      case "RESPONSES_READY":
      case "SYNTHESIS_READY":
      case "EXPORTED":
        return {
          goal: "locked",
          synthesis: "active",
          responses: "monitor"
        };
      default:
        return {
          goal: "active",
          synthesis: "locked",
          responses: "locked"
        };
    }
  }
  function describeDraftStep() {
    if (hasGoalSummary() !== true) {
      return text(["workbench", "guards", "requiresSavedGoal"], "REQUIRES: GOAL");
    }
    return null;
  }
  function describeApprovalStep() {
    if (hasDraftTasks() !== true) {
      return text(["workbench", "guards", "requiresDraftTasks"], "REQUIRES: DRAFT TASKS");
    }
    if (state.snapshot.validationMessages.length > 0) {
      return text(["workbench", "guards", "blockerDraftIssues"], "BLOCKER: DRAFT ISSUES");
    }
    return null;
  }
  function describeDispatchStep() {
    if (hasApprovedTasks() !== true) {
      return text(["workbench", "guards", "requiresApprovedPlan"], "REQUIRES: APPROVED PLAN");
    }
    if (countQueuedAssignments() === 0) {
      return text(["workbench", "guards", "blockerNoQueuedWork"], "BLOCKER: NO QUEUED WORK");
    }
    return null;
  }
  function describeSynthesisStep() {
    if (state.snapshot.responses.length === 0) {
      return text(["workbench", "guards", "requiresResponses"], "REQUIRES: RESPONSES");
    }
    if (countOpenConflicts() > 0) {
      return countOpenConflicts() === 1 ? text(["workbench", "guards", "blockerOpenDecision"], "BLOCKER: OPEN DECISION") : text(["workbench", "guards", "blockerOpenDecisions"], "BLOCKER: OPEN DECISIONS");
    }
    return null;
  }
  function describeHandoffStep() {
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
  function latestExportLabel() {
    const latestExport = state.snapshot.exports[0]?.filePath;
    return latestExport ? latestExport.split("/").at(-1) ?? latestExport : null;
  }
  function derivePrimaryAction(flow) {
    const nextAction = (() => {
      switch (flow.state) {
        case "IDLE":
          return {
            label: text(["workbench", "primaryAction", "saveGoal"], "SAVE GOAL -> START"),
            description: text(["workbench", "primaryAction", "saveGoalLocked"], "REQUIRES: GOAL"),
            mode: "command",
            commandAction: "save-goal"
          };
        case "SESSION_CREATED":
          return {
            label: text(["workbench", "primaryAction", "saveGoal"], "SAVE GOAL -> START"),
            description: text(["workbench", "primaryAction", "saveGoalRequired"], "REQUIRES: GOAL"),
            mode: "command",
            commandAction: "save-goal"
          };
        case "GOAL_DEFINED":
          return {
            label: text(["workbench", "primaryAction", "generateDraft"], "Generate draft"),
            description: text(
              ["workbench", "primaryAction", "generateDraftRequired"],
              "NEXT: GENERATE DRAFT"
            ),
            mode: "command",
            commandAction: "generate-draft"
          };
        case "DRAFT_READY": {
          const approvalStep = describeApprovalStep();
          return approvalStep ? {
            label: text(["workbench", "primaryAction", "finishDraft"], "Finish draft"),
            description: approvalStep,
            mode: "guide",
            guidedSurface: "goal"
          } : {
            label: text(["workbench", "primaryAction", "approveDraft"], "Approve draft"),
            description: text(
              ["workbench", "primaryAction", "approveDraftRequired"],
              "NEXT: APPROVE DRAFT"
            ),
            mode: "command",
            commandAction: "approve-draft"
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
              "NEXT: DISPATCH"
            ),
            mode: "command",
            commandAction: "dispatch-assignments"
          };
        case "DISPATCHED":
          return {
            label: text(
              ["workbench", "primaryAction", "reviewResponseLane"],
              "Review response lane"
            ),
            description: text(
              ["workbench", "primaryAction", "waitForResponses"],
              "REQUIRES: RESPONSES"
            ),
            mode: "guide",
            guidedSurface: "responses"
          };
        case "RESPONSES_READY":
          return {
            label: text(["workbench", "primaryAction", "generateSynthesis"], "Generate synthesis"),
            description: text(
              ["workbench", "primaryAction", "generateSynthesisRequired"],
              "NEXT: GENERATE SYNTHESIS"
            ),
            mode: "command",
            commandAction: "generate-synthesis"
          };
        case "CONFLICT":
          return {
            label: text(["workbench", "primaryAction", "resolveDecision"], "Resolve decision"),
            description: text(
              ["workbench", "primaryAction", "resolveDecisionBlocked"],
              "BLOCKER: OPEN DECISION"
            ),
            mode: "guide",
            guidedSurface: "responses"
          };
        case "SYNTHESIS_READY":
          if (state.snapshot.selectedSynthesisId === null) {
            return {
              label: text(["workbench", "primaryAction", "chooseSynthesis"], "Choose synthesis"),
              description: text(
                ["workbench", "primaryAction", "chooseSynthesisRequired"],
                "EXPORT LOCKED: SELECT SYNTHESIS."
              ),
              mode: "guide",
              guidedSurface: "synthesis"
            };
          }
          return state.snapshot.exportSummary.exportReady ? {
            label: text(["workbench", "primaryAction", "exportHandoff"], "Export handoff"),
            description: text(
              ["workbench", "primaryAction", "exportHandoffReady"],
              "FINAL STEP READY: EXPORT HANDOFF."
            ),
            mode: "command",
            commandAction: "export-handoff"
          } : {
            label: text(["workbench", "primaryAction", "checkHandoff"], "Check handoff"),
            description: describeHandoffStep(),
            mode: "command",
            commandAction: "handoff-check"
          };
        case "EXPORTED":
          return {
            label: text(["workbench", "primaryAction", "reviewExport"], "Review export"),
            description: text(
              ["workbench", "primaryAction", "exportComplete"],
              "EXPORT COMPLETE: {label}.",
              { label: latestExportLabel() ?? "HANDOFF PACKAGE" }
            ),
            mode: "guide",
            guidedSurface: "synthesis"
          };
        default:
          return {
            label: text(["workbench", "primaryAction", "saveGoal"], "SAVE GOAL -> START"),
            description: text(["workbench", "primaryAction", "saveGoalLocked"], "REQUIRES: GOAL"),
            mode: "command",
            commandAction: "save-goal"
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
        disabled: true
      };
    }
    return nextAction;
  }
  function renderStatusBar(flow) {
    const bar = createElement("header", "forge-statusbar");
    const primaryAction = derivePrimaryAction(flow);
    bar.dataset["forgeUiState"] = flow.state;
    const identity = createElement("div", "forge-statusbar__identity");
    identity.append(
      createElement("p", "forge-statusbar__room", localizedRoomName()),
      createElement(
        "strong",
        "forge-statusbar__goal",
        state.snapshot.currentGoal?.summary || text(["workbench", "statusBar", "startGoal"], "Define the goal to start this run.")
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
        count: countQueuedAssignments()
      }),
      text(["workbench", "statusBar", "stats", "answers"], "ANS {count}", {
        count: state.snapshot.responses.length
      }),
      text(["workbench", "statusBar", "stats", "decisions"], "CF {count}", {
        count: countOpenConflicts()
      }),
      hasSynthesisArtifacts() ? text(["workbench", "statusBar", "stats", "synthesisOpen"], "SYN OPEN") : text(["workbench", "statusBar", "stats", "synthesisLocked"], "SYN LOCKED"),
      hasValidExport() ? text(["workbench", "statusBar", "stats", "exportSent"], "EXP SENT") : state.snapshot.exportSummary.exportReady ? text(["workbench", "statusBar", "stats", "exportReady"], "EXP READY") : text(["workbench", "statusBar", "stats", "exportLocked"], "EXP LOCKED")
    ].forEach((value, index) => {
      const chip = createElement(
        "span",
        index === 4 && (hasValidExport() || state.snapshot.exportSummary.exportReady) ? "forge-chip forge-chip--accent" : "forge-chip",
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
  function renderColumnHeading(label, caption) {
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
    documentRef.documentElement.lang = typeof state.context.locale === "string" && state.context.locale.trim() !== "" ? state.context.locale : "en";
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
    const goalDraft = currentGoalDraft();
    const operatorProfileDraft = currentOperatorProfileDraft();
    const runOverrideDraft = currentRunOverrideDraft();
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
      activeProfileEntryId: viewState.activeProfileEntryId,
      draftBlockedReason: describeDraftStep(),
      flowLabel,
      flowState: flow.state,
      goalDetailsOpen: viewState.goalDetailsOpen,
      goalDraft,
      operatorProfileDraft,
      profileEditorOpen: viewState.profileEditorOpen,
      runConditionComposerOpen: viewState.runConditionComposerOpen,
      runConditionComposerValue: viewState.runConditionComposerValue,
      runOverrideDraft,
      sessionContextDirty: viewState.sessionContextDraft !== null && sessionContextSelectionEquals(
        viewState.sessionContextDraft,
        state.snapshot.sessionContextSelection
      ) === false,
      sessionContextSelection: currentSessionContextSelection()
    });
    setPanelBadge(goalPanel, panelModes.goal);
    const planSecondaryPanel = hasApprovedTasks() ? renderApprovedTasksPanel(documentRef, state, text, {
      advancedCapsulesOpen: viewState.advancedCapsulesOpen,
      dispatchBlockedReason: describeDispatchStep(),
      flowState: flow.state
    }) : renderDraftBreakdownPanel(documentRef, state, text, {
      approvalBlockedReason: describeApprovalStep(),
      flowState: flow.state,
      rawEditorOpen: viewState.advancedDraftOpen
    });
    setPanelBadge(planSecondaryPanel, panelModes.goal);
    planColumn.append(
      renderColumnHeading(
        text(["workbench", "columns", "planEyebrow"], "Left"),
        text(["workbench", "columns", "planTitle"], "Control Surface")
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
      flowState: flow.state
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
      synthesisBlockedReason: describeSynthesisStep()
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
        handoffLabel: hasValidExport() ? text(["workbench", "coordinator", "handoffStatuses", "sent"], "sent") : state.snapshot.exportSummary.exportReady ? text(["workbench", "coordinator", "handoffStatuses", "ready"], "ready") : text(["workbench", "coordinator", "handoffStatuses", "locked"], "locked"),
        note: derivePrimaryAction(flow).description
      })
    );
    mount.replaceChildren(shell);
    bindActions(shell);
    lastRenderSignature = renderSignature;
  }
  function bumpLocalUiVersion() {
    localUiVersion += 1;
  }
  function parseConstraintLines(value) {
    return value.split(/\r?\n/).map((entry) => entry.trim()).filter((entry) => entry !== "");
  }
  function taskDomKey(taskId) {
    return taskId.replace(/[^a-z0-9_-]/gi, "-");
  }
  function readLineList(elementId) {
    const value = documentRef.getElementById(elementId)?.value ?? "";
    return parseConstraintLines(value);
  }
  function readInputValue(elementId) {
    const input = documentRef.getElementById(elementId);
    return input?.value ?? "";
  }
  function toNullableTrimmedValue(value) {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  function toNullableBooleanValue(value) {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return null;
  }
  function bindActions(root) {
    function issueCommand(commandLabel, send) {
      viewState.guidedSurface = null;
      const sent = send();
      if (sent === true) {
        state.pendingCommand = commandLabel;
      } else {
        state.lastCommandResult = {
          command: commandLabel,
          success: false,
          message: "roomAPI.sendCommand returned false."
        };
        state.pendingCommand = null;
      }
      render();
    }
    function sendRunOverrideUpdate(nextDraft) {
      viewState.runOverrideDraft = nextDraft;
      viewState.runOverrideDraftDirty = true;
      viewState.guidedSurface = null;
      bumpLocalUiVersion();
      const sent = requestRuntime.updateRunOverride(draftToRunOverridePayload(nextDraft));
      if (sent === true) {
        state.pendingCommand = "ForgeRoomUpdateRunOverride";
      } else {
        state.lastCommandResult = {
          command: "ForgeRoomUpdateRunOverride",
          success: false,
          message: "roomAPI.sendCommand returned false."
        };
        state.pendingCommand = null;
      }
      render();
    }
    function toggleSessionContextSelection(section, key) {
      const current = currentSessionContextSelection();
      const nextSelection = cloneSessionContextSelection(current);
      if (section === "skill") {
        const record = nextSelection.skill;
        if (!(key in record)) {
          return;
        }
        record[key] = record[key] !== true;
      } else if (section === "tools") {
        const record = nextSelection.tools;
        if (!(key in record)) {
          return;
        }
        record[key] = record[key] !== true;
      } else {
        const record = nextSelection.preferences;
        if (!(key in record)) {
          return;
        }
        record[key] = record[key] !== true;
      }
      viewState.sessionContextDraft = nextSelection;
      viewState.guidedSurface = null;
      bumpLocalUiVersion();
      const sent = requestRuntime.updateSessionContext(nextSelection);
      if (sent !== true) {
        viewState.sessionContextDraft = null;
        state.lastCommandResult = {
          command: "ForgeRoomUpdateSessionContext",
          success: false,
          message: "roomAPI.sendCommand returned false."
        };
      }
      render();
    }
    root.querySelectorAll("[data-forge-guide-surface]").forEach((element) => {
      element.addEventListener("click", () => {
        const guidedSurface = element.dataset["forgeGuideSurface"];
        if (guidedSurface !== "goal" && guidedSurface !== "responses" && guidedSurface !== "synthesis") {
          return;
        }
        viewState.guidedSurface = guidedSurface;
        bumpLocalUiVersion();
        render();
      });
    });
    root.querySelectorAll("[data-forge-action='toggle-profile-editor']").forEach((element) => {
      element.addEventListener("click", () => {
        if (viewState.profileEditorOpen) {
          closeProfileEditor();
          return;
        }
        openProfileEditor();
      });
    });
    root.querySelectorAll("[data-forge-action='toggle-goal-details']").forEach((element) => {
      element.addEventListener("click", () => {
        if (viewState.goalDetailsOpen) {
          closeGoalDetails();
          return;
        }
        openGoalDetails();
      });
    });
    root.querySelectorAll("[data-forge-goal-field]").forEach((element) => {
      const syncGoalField = () => {
        const field = element.dataset["forgeGoalField"];
        const control = element;
        if (!field || typeof control.value !== "string") {
          return;
        }
        if (field === "summary") {
          updateGoalDraft((draft) => ({
            ...draft,
            summary: control.value
          }));
        } else if (field === "brief") {
          updateGoalDraft((draft) => ({
            ...draft,
            brief: control.value
          }));
        } else if (field === "targetRoomId") {
          updateGoalDraft((draft) => ({
            ...draft,
            targetRoomId: control.value
          }));
        } else if (field === "constraints") {
          updateGoalDraft((draft) => ({
            ...draft,
            constraints: parseConstraintLines(control.value)
          }));
        }
        bumpLocalUiVersion();
        render();
      };
      element.addEventListener("input", syncGoalField);
      element.addEventListener("change", syncGoalField);
    });
    root.querySelectorAll("[data-forge-profile-entry]").forEach((element) => {
      element.addEventListener("click", () => {
        const entryId = element.dataset["forgeProfileEntry"];
        if (!entryId) {
          return;
        }
        viewState.profileEditorOpen = true;
        viewState.activeProfileEntryId = entryId;
        bumpLocalUiVersion();
        render();
      });
    });
    root.querySelectorAll("[data-forge-profile-field]").forEach((element) => {
      const syncProfileField = () => {
        const entryId = element.dataset["forgeProfileField"];
        const control = element;
        if (!entryId || typeof control.value !== "string") {
          return;
        }
        if (entryId === "skill-level") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            skill: {
              ...draft.skill,
              level: toNullableTrimmedValue(
                control.value
              )
            }
          }));
        } else if (entryId === "skill-soldering") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            skill: {
              ...draft.skill,
              soldering: toNullableTrimmedValue(
                control.value
              )
            }
          }));
        } else if (entryId === "skill-measurement") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            skill: {
              ...draft.skill,
              measurement: toNullableTrimmedValue(
                control.value
              )
            }
          }));
        } else if (entryId === "skill-mechanical") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            skill: {
              ...draft.skill,
              mechanical: toNullableTrimmedValue(
                control.value
              )
            }
          }));
        } else if (entryId === "tool-multimeter") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            tools: {
              ...draft.tools,
              multimeter: toNullableBooleanValue(control.value)
            }
          }));
        } else if (entryId === "tool-soldering-iron") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            tools: {
              ...draft.tools,
              solderingIron: toNullableBooleanValue(control.value)
            }
          }));
        } else if (entryId === "tool-hot-air") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            tools: {
              ...draft.tools,
              hotAir: toNullableBooleanValue(control.value)
            }
          }));
        } else if (entryId === "tool-bench-supply") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            tools: {
              ...draft.tools,
              benchPowerSupply: toNullableBooleanValue(control.value)
            }
          }));
        } else if (entryId === "tool-magnification") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            tools: {
              ...draft.tools,
              magnification: toNullableBooleanValue(control.value)
            }
          }));
        } else if (entryId === "preference-mode") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            preferences: {
              ...draft.preferences,
              mode: toNullableTrimmedValue(
                control.value
              )
            }
          }));
        } else if (entryId === "preference-risk") {
          updateOperatorProfileDraft((draft) => ({
            ...draft,
            preferences: {
              ...draft.preferences,
              riskTolerance: toNullableTrimmedValue(
                control.value
              )
            }
          }));
        } else {
          return;
        }
        bumpLocalUiVersion();
        render();
      };
      element.addEventListener("input", syncProfileField);
      element.addEventListener("change", syncProfileField);
    });
    root.querySelectorAll("[data-forge-action='profile-quick-action']").forEach((element) => {
      element.addEventListener("click", () => {
        const actionValue = element.dataset["forgeActionValue"];
        if (actionValue === "skill") {
          openProfileEditor(firstProfileEntry("skill"));
          return;
        }
        if (actionValue === "equipment") {
          openProfileEditor(firstProfileEntry("equipment"));
          return;
        }
        if (actionValue === "edit") {
          openProfileEditor(viewState.activeProfileEntryId ?? firstProfileEntry("skill"));
          return;
        }
        if (actionValue === "clear") {
          if (viewState.activeProfileEntryId === null) {
            openProfileEditor(firstProfileEntry("skill"));
            return;
          }
          const inputId = profileEntryInputId(viewState.activeProfileEntryId);
          const input = inputId ? documentRef.getElementById(inputId) : null;
          if (input !== null && "value" in input && typeof input.value === "string") {
            input.value = "";
          }
        }
      });
    });
    root.querySelector("[data-forge-action='create-session']")?.addEventListener("click", () => {
      issueCommand("ForgeRoomCreateSession", () => requestRuntime.createSession());
    });
    root.querySelector("[data-forge-action='save-session']")?.addEventListener("click", () => {
      issueCommand("ForgeRoomSaveSession", () => requestRuntime.saveSession());
    });
    root.querySelector("[data-forge-action='load-latest']")?.addEventListener("click", () => {
      issueCommand("ForgeRoomLoadLatestSession", () => requestRuntime.loadLatestSession());
    });
    root.querySelector("[data-forge-action='save-goal']")?.addEventListener("click", () => {
      const goalDraft = currentGoalDraft();
      issueCommand("ForgeRoomUpdateGoal", () => {
        return requestRuntime.updateGoal({
          summary: goalDraft.summary,
          brief: goalDraft.brief,
          constraints: [...goalDraft.constraints],
          targetRoomId: goalDraft.targetRoomId
        });
      });
    });
    root.querySelector("[data-forge-action='save-operator-profile']")?.addEventListener("click", () => {
      const operatorProfileDraft = currentOperatorProfileDraft();
      issueCommand("ForgeRoomUpdateOperatorProfile", () => {
        return requestRuntime.updateOperatorProfile({
          skill: {
            level: operatorProfileDraft.skill.level,
            soldering: operatorProfileDraft.skill.soldering,
            measurement: operatorProfileDraft.skill.measurement,
            mechanical: operatorProfileDraft.skill.mechanical
          },
          tools: {
            multimeter: operatorProfileDraft.tools.multimeter,
            solderingIron: operatorProfileDraft.tools.solderingIron,
            hotAir: operatorProfileDraft.tools.hotAir,
            benchPowerSupply: operatorProfileDraft.tools.benchPowerSupply,
            magnification: operatorProfileDraft.tools.magnification
          },
          preferences: {
            mode: operatorProfileDraft.preferences.mode,
            riskTolerance: operatorProfileDraft.preferences.riskTolerance
          }
        });
      });
    });
    root.querySelectorAll("[data-forge-context-chip]").forEach((element) => {
      element.addEventListener("click", () => {
        const unset = element.dataset["forgeContextUnset"] === "true";
        const entryId = element.dataset["forgeProfileEntry"];
        if (unset && entryId) {
          openProfileEditor(entryId);
          return;
        }
        const section = element.dataset["forgeContextSection"];
        const key = element.dataset["forgeContextKey"];
        if ((section === "skill" || section === "tools" || section === "preferences") && typeof key === "string") {
          toggleSessionContextSelection(section, key);
        }
      });
    });
    root.querySelectorAll("[data-forge-run-override-toggle]").forEach((element) => {
      element.addEventListener("click", () => {
        const toggle = element.dataset["forgeRunOverrideToggle"];
        if (toggle === "hotAir") {
          const nextDraft = updateRunOverrideDraft((draft) => ({
            ...draft,
            tools: {
              ...draft.tools,
              hotAir: draft.tools.hotAir !== true
            }
          }));
          sendRunOverrideUpdate(nextDraft);
          return;
        }
        if (toggle === "preAnalysis") {
          const nextDraft = updateRunOverrideDraft((draft) => ({
            ...draft,
            enableRovoPreAnalysis: draft.enableRovoPreAnalysis !== true
          }));
          sendRunOverrideUpdate(nextDraft);
        }
      });
    });
    root.querySelector("[data-forge-action='toggle-run-condition-composer']")?.addEventListener("click", () => {
      viewState.runConditionComposerOpen = !viewState.runConditionComposerOpen;
      if (!viewState.runConditionComposerOpen) {
        viewState.runConditionComposerValue = "";
      }
      bumpLocalUiVersion();
      render();
    });
    root.querySelector("[data-forge-action='cancel-run-condition']")?.addEventListener("click", () => {
      viewState.runConditionComposerOpen = false;
      viewState.runConditionComposerValue = "";
      bumpLocalUiVersion();
      render();
    });
    root.querySelector("[data-forge-action='commit-run-condition']")?.addEventListener("click", () => {
      const nextCondition = viewState.runConditionComposerValue.trim();
      if (!nextCondition) {
        return;
      }
      const currentConditions = notesToConditions(currentRunOverrideDraft().notes).filter(
        (entry) => entry !== nextCondition
      );
      const nextDraft = updateRunOverrideDraft((draft) => ({
        ...draft,
        notes: [...currentConditions, nextCondition].join("\n")
      }));
      viewState.runConditionComposerOpen = false;
      viewState.runConditionComposerValue = "";
      sendRunOverrideUpdate(nextDraft);
    });
    root.querySelectorAll("[data-forge-remove-run-condition]").forEach((element) => {
      element.addEventListener("click", () => {
        const condition = element.dataset["forgeRemoveRunCondition"];
        if (!condition) {
          return;
        }
        const nextDraft = updateRunOverrideDraft((draft) => ({
          ...draft,
          notes: notesToConditions(draft.notes).filter((entry) => entry !== condition).join("\n")
        }));
        sendRunOverrideUpdate(nextDraft);
      });
    });
    root.querySelector("#forge-run-override-condition-input")?.addEventListener("input", () => {
      viewState.runConditionComposerValue = documentRef.getElementById(
        "forge-run-override-condition-input"
      )?.value ?? "";
    });
    root.querySelector("[data-forge-action='run-preflight']")?.addEventListener("click", () => {
      issueCommand("ForgeRoomRunPreflight", () => requestRuntime.runPreflight());
    });
    root.querySelector("[data-forge-action='generate-draft']")?.addEventListener("click", () => {
      const goalDraft = currentGoalDraft();
      issueCommand(
        "ForgeRoomGenerateDraft",
        () => requestRuntime.generateDraft({
          summary: goalDraft.summary,
          brief: goalDraft.brief,
          constraints: [...goalDraft.constraints],
          targetRoomId: goalDraft.targetRoomId
        })
      );
    });
    root.querySelector("[data-forge-toggle-advanced-draft='true']")?.addEventListener("click", () => {
      viewState.advancedDraftOpen = !viewState.advancedDraftOpen;
      bumpLocalUiVersion();
      render();
    });
    root.querySelector("[data-forge-toggle-advanced-capsules='true']")?.addEventListener("click", () => {
      viewState.advancedCapsulesOpen = !viewState.advancedCapsulesOpen;
      bumpLocalUiVersion();
      render();
    });
    root.querySelector("[data-forge-action='apply-draft-text']")?.addEventListener("click", () => {
      issueCommand(
        "ForgeRoomApplyDraftText",
        () => requestRuntime.applyDraftText({
          draftText: readInputValue("forge-draft-source")
        })
      );
    });
    root.querySelector("[data-forge-action='add-draft-task']")?.addEventListener("click", () => {
      issueCommand(
        "ForgeRoomUpsertDraftTask",
        () => requestRuntime.upsertDraftTask({
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
          checklist: []
        })
      );
    });
    root.querySelectorAll("[data-forge-save-draft-task]").forEach((element) => {
      element.addEventListener("click", () => {
        const taskId = element.dataset["forgeSaveDraftTask"];
        if (!taskId) {
          return;
        }
        const taskKey = taskDomKey(taskId);
        const compareSeatId = readInputValue(`forge-draft-compare-seat-${taskKey}`);
        const personaPresetId = readInputValue(`forge-draft-persona-${taskKey}`);
        issueCommand(
          "ForgeRoomUpsertDraftTask",
          () => requestRuntime.upsertDraftTask({
            taskId,
            title: readInputValue(`forge-draft-title-${taskKey}`),
            summary: readInputValue(`forge-draft-summary-${taskKey}`),
            seatId: readInputValue(`forge-draft-seat-${taskKey}`),
            roleId: readInputValue(`forge-draft-role-${taskKey}`),
            dispatchMode: readInputValue(`forge-draft-mode-${taskKey}`),
            compareSeatIds: compareSeatId ? [compareSeatId] : [],
            personaPresetId: personaPresetId || null,
            checklist: readLineList(`forge-draft-checklist-${taskKey}`)
          })
        );
      });
    });
    root.querySelectorAll("[data-forge-remove-draft-task]").forEach((element) => {
      element.addEventListener("click", () => {
        const taskId = element.dataset["forgeRemoveDraftTask"];
        if (!taskId) {
          return;
        }
        issueCommand("ForgeRoomRemoveDraftTask", () => requestRuntime.removeDraftTask({ taskId }));
      });
    });
    root.querySelector("[data-forge-action='approve-draft']")?.addEventListener("click", () => {
      issueCommand("ForgeRoomApproveDraft", () => requestRuntime.approveDraft());
    });
    root.querySelectorAll("[data-forge-save-approved-task]").forEach((element) => {
      element.addEventListener("click", () => {
        const taskId = element.dataset["forgeSaveApprovedTask"];
        if (!taskId) {
          return;
        }
        const taskKey = taskDomKey(taskId);
        const compareSeatId = readInputValue(`forge-approved-compare-seat-${taskKey}`);
        const personaPresetId = readInputValue(`forge-approved-persona-${taskKey}`);
        issueCommand(
          "ForgeRoomUpdateApprovedTask",
          () => requestRuntime.updateApprovedTask({
            taskId,
            seatId: readInputValue(`forge-approved-seat-${taskKey}`),
            roleId: readInputValue(`forge-approved-role-${taskKey}`),
            dispatchMode: readInputValue(`forge-approved-mode-${taskKey}`),
            compareSeatIds: compareSeatId ? [compareSeatId] : [],
            personaPresetId: personaPresetId || null
          })
        );
      });
    });
    root.querySelectorAll("[data-forge-save-context-capsule]").forEach((element) => {
      element.addEventListener("click", () => {
        const taskId = element.dataset["forgeSaveContextCapsule"];
        if (!taskId) {
          return;
        }
        const taskKey = taskDomKey(taskId);
        issueCommand(
          "ForgeRoomUpdateContextCapsule",
          () => requestRuntime.updateContextCapsule({
            taskId,
            summary: readInputValue(`forge-approved-capsule-summary-${taskKey}`),
            relevantModules: readLineList(`forge-approved-capsule-modules-${taskKey}`),
            constraints: readLineList(`forge-approved-capsule-constraints-${taskKey}`)
          })
        );
      });
    });
    root.querySelector("[data-forge-action='dispatch-assignments']")?.addEventListener("click", () => {
      issueCommand("ForgeRoomDispatchAssignments", () => requestRuntime.dispatchAssignments());
    });
    root.querySelectorAll("[data-forge-toggle-response]").forEach((element) => {
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
    root.querySelectorAll("[data-forge-resolve-conflict]").forEach((element) => {
      element.addEventListener("click", () => {
        const conflictId = element.dataset["forgeResolveConflict"];
        const status = element.dataset["forgeConflictStatus"];
        if (!conflictId || !status) {
          return;
        }
        issueCommand(
          "ForgeRoomResolveConflict",
          () => requestRuntime.resolveConflict({
            conflictId,
            preferredResponseId: element.dataset["forgePreferredResponseId"] ?? null,
            status: status === "resolved" ? "resolved" : "open"
          })
        );
      });
    });
    root.querySelector("[data-forge-action='handoff-check']")?.addEventListener("click", () => {
      issueCommand("ForgeRoomExportHandoffCheck", () => requestRuntime.exportHandoffCheck());
    });
    root.querySelector("[data-forge-action='generate-synthesis']")?.addEventListener("click", () => {
      issueCommand("ForgeRoomGenerateSynthesis", () => requestRuntime.generateSynthesis());
    });
    root.querySelector("[data-forge-action='export-handoff']")?.addEventListener("click", () => {
      issueCommand("ForgeRoomExportHandoff", () => requestRuntime.exportHandoff());
    });
    root.querySelectorAll("[data-forge-select-synthesis]").forEach((element) => {
      element.addEventListener("click", () => {
        const synthesisId = element.dataset["forgeSelectSynthesis"];
        if (!synthesisId) {
          return;
        }
        issueCommand(
          "ForgeRoomSelectSynthesis",
          () => requestRuntime.selectSynthesis({
            synthesisId
          })
        );
      });
    });
    root.querySelectorAll("[data-forge-toggle-synthesis]").forEach((element) => {
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
  function handleHostMessage(message) {
    const payload = toRecord(message);
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
      const snapshotSource = forgeStatePayload["snapshot"] !== void 0 ? forgeStatePayload["snapshot"] : payload["snapshot"];
      const metaSource = forgeStatePayload["meta"] !== void 0 ? forgeStatePayload["meta"] : payload["meta"];
      state.snapshot = sanitizeForgeRoomSnapshot(snapshotSource);
      syncGoalDraftFromSnapshot();
      syncOperatorProfileDraftFromSnapshot();
      syncRunOverrideDraftFromSnapshot();
      viewState.sessionContextDraft = null;
      const meta = toRecord(metaSource);
      state.meta = {
        roleCatalog: toRecord(meta["roleCatalog"]),
        personaPresets: toRecord(meta["personaPresets"])
      };
      render();
      return;
    }
    const result = toRecord(payload.result);
    if (payload.command === "ForgeRoomUpdateSessionContext" && result["success"] !== true) {
      viewState.sessionContextDraft = null;
    }
    if (payload.command === "ForgeRoomUpdateGoal" && result["success"] === true) {
      viewState.goalDraftDirty = false;
    }
    if (payload.command === "ForgeRoomUpdateOperatorProfile" && result["success"] === true) {
      viewState.operatorProfileDraftDirty = false;
    }
    if (payload.command === "ForgeRoomUpdateRunOverride" && result["success"] === true) {
      viewState.runOverrideDraftDirty = false;
    }
    state.pendingCommand = null;
    state.lastCommandResult = {
      command: typeof payload.command === "string" && payload.command.trim() !== "" ? payload.command : "command",
      success: result["success"] === true,
      message: typeof result["message"] === "string" && result["message"].trim() !== "" ? result["message"] : null
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
        stage: "ui-ready"
      });
    }
  }
  return {
    start
  };
}
