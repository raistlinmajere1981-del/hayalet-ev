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
import {
  createDefaultForgeOperatorProfile,
  isForgeOperatorEquipmentStatus,
  isForgeOperatorSkillLevel,
  type ForgeOperatorProfile,
  type ForgeSessionContextSelection,
} from "../shared/types/index.js";
import { renderApprovedTasksPanel } from "./panels/approved-tasks-panel.js";
import { renderCoordinatorPanel } from "./panels/coordinator-panel.js";
import { renderDraftBreakdownPanel } from "./panels/draft-breakdown-panel.js";
import { renderGoalInputPanel } from "./panels/goal-input-panel.js";
import {
  renderOperatorProfileManager,
  type ForgeProfileEditorDraftView,
} from "./panels/operator-profile-manager-panel.js";
import { renderResponsesPanel } from "./panels/responses-panel.js";
import { renderSynthesisPanel } from "./panels/synthesis-panel.js";

type ForgeUiWindow = Window & {
  roomAPI?: Window["roomAPI"];
};

type ForgeLocalViewState = {
  advancedCapsulesOpen: boolean;
  advancedDraftOpen: boolean;
  expandedResponseIds: Set<string>;
  expandedSynthesisIds: Set<string>;
  goalDetailsOpen: boolean;
  goalDraft: ForgeGoalDraftState | null;
  goalDraftDirty: boolean;
  guidedSurface: ForgeWorkbenchUiSurface | null;
  operatorProfileDraft: ForgeOperatorProfile | null;
  operatorProfileDraftDirty: boolean;
  operatorProfileDraftSourceFingerprint: string | null;
  profileEditorDraft: ForgeProfileEditorDraftView;
  profileEditorOpen: boolean;
  runConditionComposerOpen: boolean;
  runConditionComposerValue: string;
  runOverrideDraft: ForgeRunOverrideDraftState | null;
  runOverrideDraftDirty: boolean;
  sessionContextDraft: ForgeSessionContextSelection | null;
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

type ForgeGoalDraftState = {
  brief: string;
  constraints: string[];
  sourceFingerprint: string;
  sourceGoalId: string | null;
  sourceSessionId: string | null;
  summary: string;
  targetRoomId: string;
};

type ForgeRunOverrideDraftState = {
  enableRovoPreAnalysis: boolean;
  mode: "learn_first" | "result_first" | "";
  notes: string;
  riskTolerance: "high" | "low" | "medium" | "";
  sourceFingerprint: string;
  sourceSessionId: string | null;
  temporaryConditions: string[];
};

export function createForgeRoomUiRuntime() {
  const state: ForgeUiState = createInitialForgeUiState();
  const requestRuntime = createForgeUiRequestRuntime();
  const windowRef = window as ForgeUiWindow;
  const documentRef = document;
  const viewState: ForgeLocalViewState = {
    advancedCapsulesOpen: false,
    advancedDraftOpen: false,
    expandedResponseIds: new Set<string>(),
    expandedSynthesisIds: new Set<string>(),
    goalDetailsOpen: false,
    goalDraft: null,
    goalDraftDirty: false,
    guidedSurface: null,
    operatorProfileDraft: null,
    operatorProfileDraftDirty: false,
    operatorProfileDraftSourceFingerprint: null,
    profileEditorDraft: null,
    profileEditorOpen: false,
    runConditionComposerOpen: false,
    runConditionComposerValue: "",
    runOverrideDraft: null,
    runOverrideDraftDirty: false,
    sessionContextDraft: null,
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
    const resolved = typeof current === "string" && current.trim() !== "" ? current : fallback;
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

  function cloneSessionContextSelection(
    selection: ForgeSessionContextSelection
  ): ForgeSessionContextSelection {
    return {
      skillKeys: [...selection.skillKeys],
      equipmentKeys: [...selection.equipmentKeys],
    };
  }

  function sessionContextSelectionEquals(
    left: ForgeSessionContextSelection,
    right: ForgeSessionContextSelection
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function cloneOperatorProfile(profile: ForgeOperatorProfile): ForgeOperatorProfile {
    return {
      schemaVersion: profile.schemaVersion,
      updatedAt: profile.updatedAt,
      skills: profile.skills.map((record) => ({
        skillKey: record.skillKey,
        label: record.label,
        level: record.level,
        ...(record.notes ? { notes: record.notes } : {}),
      })),
      equipment: profile.equipment.map((record) => ({
        equipmentKey: record.equipmentKey,
        label: record.label,
        status: record.status,
        ...(record.brandModel ? { brandModel: record.brandModel } : {}),
        ...(record.notes ? { notes: record.notes } : {}),
      })),
    };
  }

  function operatorProfilesEqual(left: ForgeOperatorProfile, right: ForgeOperatorProfile): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function currentSessionContextSelection(): ForgeSessionContextSelection {
    return viewState.sessionContextDraft ?? state.snapshot.sessionContextSelection;
  }

  function goalSnapshotFingerprint(): string {
    return JSON.stringify({
      goalId: state.snapshot.currentGoal?.id ?? null,
      sessionId: state.snapshot.activeSessionId,
      summary: state.snapshot.currentGoal?.summary ?? "",
      brief: state.snapshot.currentGoal?.brief ?? "",
      constraints: state.snapshot.currentGoal?.constraints ?? [],
      targetRoomId: state.snapshot.currentGoal?.targetRoomId ?? "repair-room",
    });
  }

  function operatorProfileSnapshotFingerprint(): string {
    return JSON.stringify(state.snapshot.operatorProfile);
  }

  function runOverrideSnapshotFingerprint(): string {
    const runOverride = state.snapshot.runOverride;
    return JSON.stringify({
      sessionId: state.snapshot.activeSessionId,
      enableRovoPreAnalysis: runOverride?.enableRovoPreAnalysis === true,
      mode: runOverride?.mode ?? null,
      notes: runOverride?.notes ?? "",
      riskTolerance: runOverride?.riskTolerance ?? null,
      temporaryConditions: runOverride?.temporaryConditions ?? [],
    });
  }

  function createGoalDraftFromSnapshot(): ForgeGoalDraftState {
    return {
      brief: state.snapshot.currentGoal?.brief ?? "",
      constraints: [...(state.snapshot.currentGoal?.constraints ?? [])],
      sourceFingerprint: goalSnapshotFingerprint(),
      sourceGoalId: state.snapshot.currentGoal?.id ?? null,
      sourceSessionId: state.snapshot.activeSessionId,
      summary: state.snapshot.currentGoal?.summary ?? "",
      targetRoomId: state.snapshot.currentGoal?.targetRoomId ?? "repair-room",
    };
  }

  function syncGoalDraftFromSnapshot(force = false): void {
    const nextDraft = createGoalDraftFromSnapshot();
    const draft = viewState.goalDraft;
    const allowPendingRefresh = state.pendingCommand === "ForgeRoomUpdateGoal";
    const snapshotChanged = draft?.sourceFingerprint !== nextDraft.sourceFingerprint;
    if (
      force ||
      draft === null ||
      draft.sourceGoalId !== nextDraft.sourceGoalId ||
      draft.sourceSessionId !== nextDraft.sourceSessionId ||
      (snapshotChanged && (viewState.goalDraftDirty === false || allowPendingRefresh))
    ) {
      viewState.goalDraft = nextDraft;
      viewState.goalDraftDirty = false;
    }
  }

  function currentGoalDraft(): ForgeGoalDraftState {
    syncGoalDraftFromSnapshot();
    return viewState.goalDraft ?? createGoalDraftFromSnapshot();
  }

  function updateGoalDraft(
    updater: (draft: ForgeGoalDraftState) => ForgeGoalDraftState
  ): ForgeGoalDraftState {
    const nextDraft = updater(currentGoalDraft());
    viewState.goalDraft = nextDraft;
    viewState.goalDraftDirty = true;
    return nextDraft;
  }

  function createOperatorProfileDraftFromSnapshot(): ForgeOperatorProfile {
    return cloneOperatorProfile(state.snapshot.operatorProfile);
  }

  function syncOperatorProfileDraftFromSnapshot(force = false): void {
    const nextDraft = createOperatorProfileDraftFromSnapshot();
    const draft = viewState.operatorProfileDraft;
    const nextFingerprint = operatorProfileSnapshotFingerprint();
    const allowPendingRefresh = state.pendingCommand === "ForgeRoomUpdateOperatorProfile";
    if (
      force ||
      draft === null ||
      (viewState.operatorProfileDraftSourceFingerprint !== nextFingerprint &&
        (viewState.operatorProfileDraftDirty === false || allowPendingRefresh)) ||
      (viewState.operatorProfileDraftSourceFingerprint === null &&
        operatorProfilesEqual(draft, nextDraft) === false)
    ) {
      viewState.operatorProfileDraft = nextDraft;
      viewState.operatorProfileDraftDirty = false;
      viewState.operatorProfileDraftSourceFingerprint = nextFingerprint;
    }
  }

  function currentOperatorProfileDraft(): ForgeOperatorProfile {
    syncOperatorProfileDraftFromSnapshot();
    return viewState.operatorProfileDraft ?? createDefaultForgeOperatorProfile();
  }

  function updateOperatorProfileDraft(
    updater: (draft: ForgeOperatorProfile) => ForgeOperatorProfile
  ): ForgeOperatorProfile {
    const nextDraft = updater(currentOperatorProfileDraft());
    viewState.operatorProfileDraft = nextDraft;
    viewState.operatorProfileDraftDirty = true;
    return nextDraft;
  }

  function createRunOverrideDraftFromSnapshot(): ForgeRunOverrideDraftState {
    const runOverride = state.snapshot.runOverride;
    return {
      enableRovoPreAnalysis: runOverride?.enableRovoPreAnalysis === true,
      mode: runOverride?.mode ?? "",
      notes: runOverride?.notes ?? "",
      riskTolerance: runOverride?.riskTolerance ?? "",
      sourceFingerprint: runOverrideSnapshotFingerprint(),
      sourceSessionId: state.snapshot.activeSessionId,
      temporaryConditions: [...(runOverride?.temporaryConditions ?? [])],
    };
  }

  function syncRunOverrideDraftFromSnapshot(force = false): void {
    const nextDraft = createRunOverrideDraftFromSnapshot();
    const draft = viewState.runOverrideDraft;
    const allowPendingRefresh = state.pendingCommand === "ForgeRoomUpdateRunOverride";
    const snapshotChanged = draft?.sourceFingerprint !== nextDraft.sourceFingerprint;
    if (
      force ||
      draft === null ||
      draft.sourceSessionId !== nextDraft.sourceSessionId ||
      (snapshotChanged && (viewState.runOverrideDraftDirty === false || allowPendingRefresh))
    ) {
      viewState.runOverrideDraft = nextDraft;
      viewState.runOverrideDraftDirty = false;
    }
  }

  function currentRunOverrideDraft(): ForgeRunOverrideDraftState {
    syncRunOverrideDraftFromSnapshot();
    return viewState.runOverrideDraft ?? createRunOverrideDraftFromSnapshot();
  }

  function updateRunOverrideDraft(
    updater: (draft: ForgeRunOverrideDraftState) => ForgeRunOverrideDraftState
  ): ForgeRunOverrideDraftState {
    const nextDraft = updater(currentRunOverrideDraft());
    viewState.runOverrideDraft = nextDraft;
    viewState.runOverrideDraftDirty = true;
    return nextDraft;
  }

  function draftToRunOverridePayload(draft: ForgeRunOverrideDraftState): {
    enableRovoPreAnalysis: boolean;
    mode?: "learn_first" | "result_first";
    notes: string;
    riskTolerance?: "high" | "low" | "medium";
    temporaryConditions: string[];
  } {
    return {
      enableRovoPreAnalysis: draft.enableRovoPreAnalysis,
      ...(draft.mode ? { mode: draft.mode } : {}),
      notes: draft.notes,
      ...(draft.riskTolerance ? { riskTolerance: draft.riskTolerance } : {}),
      temporaryConditions: [...draft.temporaryConditions],
    };
  }

  function openGoalDetails(): void {
    viewState.goalDetailsOpen = true;
    bumpLocalUiVersion();
    render();
  }

  function closeGoalDetails(): void {
    viewState.goalDetailsOpen = false;
    bumpLocalUiVersion();
    render();
  }

  function sortUniqueKeys(values: string[]): string[] {
    return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
  }

  function sortSessionContextSelection(
    selection: ForgeSessionContextSelection
  ): ForgeSessionContextSelection {
    return {
      skillKeys: sortUniqueKeys(selection.skillKeys),
      equipmentKeys: sortUniqueKeys(selection.equipmentKeys),
    };
  }

  function sortOperatorProfileDraft(profile: ForgeOperatorProfile): ForgeOperatorProfile {
    return {
      ...profile,
      skills: profile.skills
        .map((record) => ({
          skillKey: record.skillKey,
          label: record.label,
          level: record.level,
          ...(record.notes ? { notes: record.notes } : {}),
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      equipment: profile.equipment
        .map((record) => ({
          equipmentKey: record.equipmentKey,
          label: record.label,
          status: record.status,
          ...(record.brandModel ? { brandModel: record.brandModel } : {}),
          ...(record.notes ? { notes: record.notes } : {}),
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    };
  }

  function createProfileEntryKey(prefix: "equipment" | "skill"): string {
    const globalCrypto = globalThis.crypto;
    if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
      return `${prefix}-${globalCrypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function buildSkillEditorDraft(
    profile: ForgeOperatorProfile,
    options: {
      mode: "create" | "edit";
      skillKey?: string | null;
    }
  ): Extract<ForgeProfileEditorDraftView, { kind: "skill" }> | null {
    if (options.mode === "edit") {
      const record = profile.skills.find((entry) => entry.skillKey === options.skillKey) ?? null;
      if (!record) {
        return null;
      }
      return {
        kind: "skill",
        mode: "edit",
        label: record.label,
        level: record.level,
        notes: record.notes ?? "",
        sourceKey: record.skillKey,
      };
    }
    return {
      kind: "skill",
      mode: "create",
      label: "",
      level: "none",
      notes: "",
      sourceKey: null,
    };
  }

  function buildEquipmentEditorDraft(
    profile: ForgeOperatorProfile,
    options: {
      equipmentKey?: string | null;
      mode: "create" | "edit";
    }
  ): Extract<ForgeProfileEditorDraftView, { kind: "equipment" }> | null {
    if (options.mode === "edit") {
      const record =
        profile.equipment.find((entry) => entry.equipmentKey === options.equipmentKey) ?? null;
      if (!record) {
        return null;
      }
      return {
        kind: "equipment",
        mode: "edit",
        brandModel: record.brandModel ?? "",
        label: record.label,
        notes: record.notes ?? "",
        sourceKey: record.equipmentKey,
        status: record.status,
      };
    }
    return {
      kind: "equipment",
      mode: "create",
      brandModel: "",
      label: "",
      notes: "",
      sourceKey: null,
      status: "unavailable",
    };
  }

  function openProfileEditor(): void {
    viewState.profileEditorOpen = true;
    bumpLocalUiVersion();
    render();
  }

  function openProfileEntryEditor(
    kind: "equipment" | "skill",
    mode: "create" | "edit",
    entryKey: string | null = null
  ): void {
    const draft = currentOperatorProfileDraft();
    viewState.profileEditorDraft =
      kind === "skill"
        ? buildSkillEditorDraft(draft, { mode, skillKey: entryKey })
        : buildEquipmentEditorDraft(draft, { mode, equipmentKey: entryKey });
    viewState.profileEditorOpen = true;
    bumpLocalUiVersion();
    render();
  }

  function removeProfileEntry(kind: "equipment" | "skill", entryKey: string): void {
    updateOperatorProfileDraft((draft) => {
      if (kind === "skill") {
        return sortOperatorProfileDraft({
          ...draft,
          skills: draft.skills.filter((entry) => entry.skillKey !== entryKey),
        });
      }
      if (kind === "equipment") {
        return sortOperatorProfileDraft({
          ...draft,
          equipment: draft.equipment.filter((entry) => entry.equipmentKey !== entryKey),
        });
      }
      return draft;
    });
    if (
      viewState.profileEditorDraft &&
      ((viewState.profileEditorDraft.kind === "skill" &&
        kind === "skill" &&
        viewState.profileEditorDraft.sourceKey === entryKey) ||
        (viewState.profileEditorDraft.kind === "equipment" &&
          kind === "equipment" &&
          viewState.profileEditorDraft.sourceKey === entryKey))
    ) {
      viewState.profileEditorDraft = null;
    }
    bumpLocalUiVersion();
    render();
  }

  function commitProfileEntryDraft(): void {
    const editorDraft = viewState.profileEditorDraft;
    if (editorDraft === null) {
      return;
    }
    if (editorDraft.kind === "skill") {
      const label = readInputValue("forge-profile-editor-skill-label").trim();
      const levelValue = readInputValue("forge-profile-editor-skill-level").trim();
      const notes = toNullableTrimmedValue(readInputValue("forge-profile-editor-skill-notes"));
      if (label === "" || isForgeOperatorSkillLevel(levelValue) === false) {
        return;
      }
      updateOperatorProfileDraft((draft) =>
        sortOperatorProfileDraft({
          ...draft,
          skills: [
            ...draft.skills.filter((entry) => entry.skillKey !== editorDraft.sourceKey),
            {
              skillKey: editorDraft.sourceKey ?? createProfileEntryKey("skill"),
              label,
              level: levelValue,
              ...(notes ? { notes } : {}),
            },
          ],
        })
      );
    } else if (editorDraft.kind === "equipment") {
      const label = readInputValue("forge-profile-editor-equipment-label").trim();
      const statusValue = readInputValue("forge-profile-editor-equipment-status").trim();
      const brandModel = toNullableTrimmedValue(
        readInputValue("forge-profile-editor-equipment-brand-model")
      );
      const notes = toNullableTrimmedValue(readInputValue("forge-profile-editor-equipment-notes"));
      if (label === "" || isForgeOperatorEquipmentStatus(statusValue) === false) {
        return;
      }
      updateOperatorProfileDraft((draft) =>
        sortOperatorProfileDraft({
          ...draft,
          equipment: [
            ...draft.equipment.filter((entry) => entry.equipmentKey !== editorDraft.sourceKey),
            {
              equipmentKey: editorDraft.sourceKey ?? createProfileEntryKey("equipment"),
              label,
              status: statusValue,
              ...(brandModel ? { brandModel } : {}),
              ...(notes ? { notes } : {}),
            },
          ],
        })
      );
    }
    viewState.profileEditorDraft = null;
    bumpLocalUiVersion();
    render();
  }

  function persistOperatorProfileDraftIfDirty(): void {
    if (viewState.operatorProfileDraftDirty !== true) {
      return;
    }
    const operatorProfileDraft = currentOperatorProfileDraft();
    const sent = requestRuntime.updateOperatorProfile({
      skills: operatorProfileDraft.skills.map((record) => ({
        skillKey: record.skillKey,
        label: record.label,
        level: record.level,
        ...(record.notes ? { notes: record.notes } : {}),
      })),
      equipment: operatorProfileDraft.equipment.map((record) => ({
        equipmentKey: record.equipmentKey,
        label: record.label,
        status: record.status,
        ...(record.brandModel ? { brandModel: record.brandModel } : {}),
        ...(record.notes ? { notes: record.notes } : {}),
      })),
    });
    if (sent === true) {
      state.pendingCommand = "ForgeRoomUpdateOperatorProfile";
    } else {
      state.lastCommandResult = {
        command: "ForgeRoomUpdateOperatorProfile",
        success: false,
        message: "roomAPI.sendCommand returned false.",
      };
      state.pendingCommand = null;
    }
  }

  function closeProfileEditor(): void {
    persistOperatorProfileDraftIfDirty();
    viewState.profileEditorOpen = false;
    viewState.profileEditorDraft = null;
    bumpLocalUiVersion();
    render();
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
      return text(["workbench", "guards", "requiresSavedGoal"], "REQUIRES: GOAL");
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
            label: text(["workbench", "primaryAction", "saveGoal"], "SAVE GOAL -> START"),
            description: text(["workbench", "primaryAction", "saveGoalLocked"], "REQUIRES: GOAL"),
            mode: "command" as const,
            commandAction: "save-goal",
          };
        case "SESSION_CREATED":
          return {
            label: text(["workbench", "primaryAction", "saveGoal"], "SAVE GOAL -> START"),
            description: text(["workbench", "primaryAction", "saveGoalRequired"], "REQUIRES: GOAL"),
            mode: "command" as const,
            commandAction: "save-goal",
          };
        case "GOAL_DEFINED":
          return {
            label: text(["workbench", "primaryAction", "generateDraft"], "Generate draft"),
            description: text(
              ["workbench", "primaryAction", "generateDraftRequired"],
              "NEXT: GENERATE DRAFT"
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
                  "NEXT: APPROVE DRAFT"
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
              "NEXT: DISPATCH"
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
              "REQUIRES: RESPONSES"
            ),
            mode: "guide" as const,
            guidedSurface: "responses",
          };
        case "RESPONSES_READY":
          return {
            label: text(["workbench", "primaryAction", "generateSynthesis"], "Generate synthesis"),
            description: text(
              ["workbench", "primaryAction", "generateSynthesisRequired"],
              "NEXT: GENERATE SYNTHESIS"
            ),
            mode: "command" as const,
            commandAction: "generate-synthesis",
          };
        case "CONFLICT":
          return {
            label: text(["workbench", "primaryAction", "resolveDecision"], "Resolve decision"),
            description: text(
              ["workbench", "primaryAction", "resolveDecisionBlocked"],
              "BLOCKER: OPEN DECISION"
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
            label: text(["workbench", "primaryAction", "saveGoal"], "SAVE GOAL -> START"),
            description: text(["workbench", "primaryAction", "saveGoalLocked"], "REQUIRES: GOAL"),
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
    const goalSummary = state.snapshot.currentGoal?.summary.trim() ?? "";
    if (goalSummary !== "") {
      identity.append(createElement("strong", "forge-statusbar__goal", goalSummary));
    }
    const operatorActions = createElement("div", "forge-statusbar__subactions");
    const operatorButton = createElement(
      "button",
      "forge-button forge-button--secondary forge-statusbar__subaction",
      text(["workbench", "goalPanel", "operatorProfile", "topbarAction"], "Operator Profile")
    );
    operatorButton.dataset["forgeAction"] = "toggle-profile-editor";
    operatorActions.append(
      createElement("span", "forge-statusbar__microcopy", state.context.userNickname),
      operatorButton
    );
    identity.append(operatorActions);

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
      draftBlockedReason: describeDraftStep(),
      flowLabel,
      flowState: flow.state,
      goalDetailsOpen: viewState.goalDetailsOpen,
      goalDraft,
      runConditionComposerOpen: viewState.runConditionComposerOpen,
      runConditionComposerValue: viewState.runConditionComposerValue,
      runOverrideDraft,
      sessionContextDirty:
        viewState.sessionContextDraft !== null &&
        sessionContextSelectionEquals(
          viewState.sessionContextDraft,
          state.snapshot.sessionContextSelection
        ) === false,
      sessionContextSelection: currentSessionContextSelection(),
    });
    setPanelBadge(goalPanel, panelModes.goal);
    const planSecondaryPanel = hasApprovedTasks()
      ? renderApprovedTasksPanel(documentRef, state, text, {
          advancedCapsulesOpen: viewState.advancedCapsulesOpen,
          dispatchBlockedReason: describeDispatchStep(),
          flowState: flow.state,
        })
      : renderDraftBreakdownPanel(documentRef, state, text, {
          approvalBlockedReason: describeApprovalStep(),
          flowState: flow.state,
          rawEditorOpen: viewState.advancedDraftOpen,
        });
    setPanelBadge(planSecondaryPanel, panelModes.goal);
    planColumn.append(goalPanel, planSecondaryPanel);

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
    responseColumn.append(responsesPanel);

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
    outputColumn.append(synthesisPanel);

    workbench.append(planColumn, responseColumn, outputColumn);
    shell.append(renderStatusBar(flow), workbench);
    if (viewState.profileEditorOpen) {
      shell.append(
        renderOperatorProfileManager(documentRef, text, {
          dirty: viewState.operatorProfileDraftDirty,
          draft: operatorProfileDraft,
          editorDraft: viewState.profileEditorDraft,
          userAvatar: state.context.userAvatar,
          userNickname: state.context.userNickname,
        })
      );
    }
    shell.append(
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

  function toNullableTrimmedValue(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
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

    function sendRunOverrideUpdate(nextDraft: ForgeRunOverrideDraftState): void {
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
          message: "roomAPI.sendCommand returned false.",
        };
        state.pendingCommand = null;
      }
      render();
    }

    function toggleSessionContextSelection(section: "equipment" | "skill", key: string): void {
      const current = cloneSessionContextSelection(currentSessionContextSelection());
      const nextSelection =
        section === "skill"
          ? sortSessionContextSelection({
              ...current,
              skillKeys: current.skillKeys.includes(key)
                ? current.skillKeys.filter((entry) => entry !== key)
                : [...current.skillKeys, key],
            })
          : sortSessionContextSelection({
              ...current,
              equipmentKeys: current.equipmentKeys.includes(key)
                ? current.equipmentKeys.filter((entry) => entry !== key)
                : [...current.equipmentKeys, key],
            });
      viewState.sessionContextDraft = nextSelection;
      viewState.guidedSurface = null;
      bumpLocalUiVersion();
      const sent = requestRuntime.updateSessionContext(nextSelection);
      if (sent !== true) {
        viewState.sessionContextDraft = null;
        state.lastCommandResult = {
          command: "ForgeRoomUpdateSessionContext",
          success: false,
          message: "roomAPI.sendCommand returned false.",
        };
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
      .querySelectorAll<HTMLElement>("[data-forge-action='toggle-profile-editor']")
      .forEach((element) => {
        element.addEventListener("click", () => {
          if (viewState.profileEditorOpen) {
            closeProfileEditor();
            return;
          }
          openProfileEditor();
        });
      });

    root
      .querySelectorAll<HTMLElement>("[data-forge-action='toggle-goal-details']")
      .forEach((element) => {
        element.addEventListener("click", () => {
          if (viewState.goalDetailsOpen) {
            closeGoalDetails();
            return;
          }
          openGoalDetails();
        });
      });

    root.querySelectorAll<HTMLElement>("[data-forge-goal-field]").forEach((element) => {
      const syncGoalField = () => {
        const field = element.dataset["forgeGoalField"];
        const control = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if (!field || typeof control.value !== "string") {
          return;
        }
        if (field === "summary") {
          updateGoalDraft((draft) => ({
            ...draft,
            summary: control.value,
          }));
        } else if (field === "brief") {
          updateGoalDraft((draft) => ({
            ...draft,
            brief: control.value,
          }));
        } else if (field === "targetRoomId") {
          updateGoalDraft((draft) => ({
            ...draft,
            targetRoomId: control.value,
          }));
        } else if (field === "constraints") {
          updateGoalDraft((draft) => ({
            ...draft,
            constraints: parseConstraintLines(control.value),
          }));
        }
        bumpLocalUiVersion();
        render();
      };
      element.addEventListener("input", syncGoalField);
      element.addEventListener("change", syncGoalField);
    });

    root
      .querySelectorAll<HTMLElement>("[data-forge-action='start-profile-create']")
      .forEach((element) => {
        element.addEventListener("click", () => {
          const kind = element.dataset["forgeProfileKind"];
          const entryKey = element.dataset["forgeProfileKey"] ?? null;
          if (kind === "skill" || kind === "equipment") {
            openProfileEntryEditor(kind, "create", entryKey);
          }
        });
      });

    root
      .querySelectorAll<HTMLElement>("[data-forge-action='start-profile-edit']")
      .forEach((element) => {
        element.addEventListener("click", () => {
          const kind = element.dataset["forgeProfileKind"];
          const entryKey = element.dataset["forgeProfileKey"] ?? null;
          if ((kind === "skill" || kind === "equipment") && typeof entryKey === "string") {
            openProfileEntryEditor(kind, "edit", entryKey);
          }
        });
      });

    root
      .querySelectorAll<HTMLElement>("[data-forge-action='remove-profile-entry']")
      .forEach((element) => {
        element.addEventListener("click", () => {
          const kind = element.dataset["forgeProfileKind"];
          const entryKey = element.dataset["forgeProfileKey"] ?? null;
          if ((kind === "skill" || kind === "equipment") && typeof entryKey === "string") {
            removeProfileEntry(kind, entryKey);
          }
        });
      });

    root
      .querySelector<HTMLElement>("[data-forge-action='commit-profile-entry']")
      ?.addEventListener("click", () => {
        commitProfileEntryDraft();
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='cancel-profile-entry']")
      ?.addEventListener("click", () => {
        viewState.profileEditorDraft = null;
        bumpLocalUiVersion();
        render();
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
    root.querySelectorAll<HTMLElement>("[data-forge-action='load-session']").forEach((element) => {
      element.addEventListener("click", () => {
        const sessionId = element.dataset["forgeSessionId"];
        if (!sessionId) {
          return;
        }
        issueCommand("ForgeRoomLoadSession", () => requestRuntime.loadSession({ sessionId }));
      });
    });
    root
      .querySelector<HTMLElement>("[data-forge-action='delete-session']")
      ?.addEventListener("click", () => {
        const sessionId =
          root.querySelector<HTMLElement>("[data-forge-action='delete-session']")?.dataset[
            "forgeSessionId"
          ] ??
          state.snapshot.activeSessionId ??
          null;
        issueCommand("ForgeRoomDeleteSession", () =>
          sessionId ? requestRuntime.deleteSession({ sessionId }) : requestRuntime.deleteSession({})
        );
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='save-goal']")
      ?.addEventListener("click", () => {
        const goalDraft = currentGoalDraft();
        issueCommand("ForgeRoomUpdateGoal", () => {
          return requestRuntime.updateGoal({
            summary: goalDraft.summary,
            brief: goalDraft.brief,
            constraints: [...goalDraft.constraints],
            targetRoomId: goalDraft.targetRoomId,
          });
        });
      });
    root.querySelectorAll<HTMLElement>("[data-forge-context-chip]").forEach((element) => {
      element.addEventListener("click", () => {
        const section = element.dataset["forgeContextSection"];
        const key = element.dataset["forgeContextKey"];
        if ((section === "skill" || section === "equipment") && typeof key === "string") {
          toggleSessionContextSelection(section, key);
        }
      });
    });
    root.querySelectorAll<HTMLElement>("[data-forge-run-override-toggle]").forEach((element) => {
      element.addEventListener("click", () => {
        const toggle = element.dataset["forgeRunOverrideToggle"];
        if (toggle === "preAnalysis") {
          const nextDraft = updateRunOverrideDraft((draft) => ({
            ...draft,
            enableRovoPreAnalysis: draft.enableRovoPreAnalysis !== true,
          }));
          sendRunOverrideUpdate(nextDraft);
        }
      });
    });
    root
      .querySelector<HTMLElement>("[data-forge-action='toggle-run-condition-composer']")
      ?.addEventListener("click", () => {
        viewState.runConditionComposerOpen = !viewState.runConditionComposerOpen;
        if (!viewState.runConditionComposerOpen) {
          viewState.runConditionComposerValue = "";
        }
        bumpLocalUiVersion();
        render();
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='cancel-run-condition']")
      ?.addEventListener("click", () => {
        viewState.runConditionComposerOpen = false;
        viewState.runConditionComposerValue = "";
        bumpLocalUiVersion();
        render();
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='commit-run-condition']")
      ?.addEventListener("click", () => {
        const nextCondition = viewState.runConditionComposerValue.trim();
        if (!nextCondition) {
          return;
        }
        const nextDraft = updateRunOverrideDraft((draft) => ({
          ...draft,
          temporaryConditions: sortUniqueKeys([
            ...draft.temporaryConditions.filter((entry) => entry !== nextCondition),
            nextCondition,
          ]),
        }));
        viewState.runConditionComposerOpen = false;
        viewState.runConditionComposerValue = "";
        sendRunOverrideUpdate(nextDraft);
      });
    root.querySelectorAll<HTMLElement>("[data-forge-remove-run-condition]").forEach((element) => {
      element.addEventListener("click", () => {
        const condition = element.dataset["forgeRemoveRunCondition"];
        if (!condition) {
          return;
        }
        const nextDraft = updateRunOverrideDraft((draft) => ({
          ...draft,
          temporaryConditions: draft.temporaryConditions.filter((entry) => entry !== condition),
        }));
        sendRunOverrideUpdate(nextDraft);
      });
    });
    root
      .querySelector<HTMLElement>("#forge-run-override-condition-input")
      ?.addEventListener("input", () => {
        viewState.runConditionComposerValue =
          (
            documentRef.getElementById(
              "forge-run-override-condition-input"
            ) as HTMLInputElement | null
          )?.value ?? "";
      });
    root.querySelector<HTMLElement>("#forge-run-override-notes")?.addEventListener("change", () => {
      const nextDraft = updateRunOverrideDraft((draft) => ({
        ...draft,
        notes: readInputValue("forge-run-override-notes"),
      }));
      sendRunOverrideUpdate(nextDraft);
    });
    root.querySelector<HTMLElement>("#forge-run-override-mode")?.addEventListener("change", () => {
      const nextDraft = updateRunOverrideDraft((draft) => ({
        ...draft,
        mode: readInputValue("forge-run-override-mode") as ForgeRunOverrideDraftState["mode"],
      }));
      sendRunOverrideUpdate(nextDraft);
    });
    root.querySelector<HTMLElement>("#forge-run-override-risk")?.addEventListener("change", () => {
      const nextDraft = updateRunOverrideDraft((draft) => ({
        ...draft,
        riskTolerance: readInputValue(
          "forge-run-override-risk"
        ) as ForgeRunOverrideDraftState["riskTolerance"],
      }));
      sendRunOverrideUpdate(nextDraft);
    });
    root
      .querySelector<HTMLElement>("[data-forge-action='run-preflight']")
      ?.addEventListener("click", () => {
        issueCommand("ForgeRoomRunPreflight", () => requestRuntime.runPreflight());
      });
    root
      .querySelector<HTMLElement>("[data-forge-action='generate-draft']")
      ?.addEventListener("click", () => {
        const goalDraft = currentGoalDraft();
        issueCommand("ForgeRoomGenerateDraft", () =>
          requestRuntime.generateDraft({
            summary: goalDraft.summary,
            brief: goalDraft.brief,
            constraints: [...goalDraft.constraints],
            targetRoomId: goalDraft.targetRoomId,
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
      .querySelector<HTMLElement>("[data-forge-toggle-advanced-capsules='true']")
      ?.addEventListener("click", () => {
        viewState.advancedCapsulesOpen = !viewState.advancedCapsulesOpen;
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
    root.querySelectorAll<HTMLElement>("[data-forge-save-context-capsule]").forEach((element) => {
      element.addEventListener("click", () => {
        const taskId = element.dataset["forgeSaveContextCapsule"];
        if (!taskId) {
          return;
        }
        const taskKey = taskDomKey(taskId);
        issueCommand("ForgeRoomUpdateContextCapsule", () =>
          requestRuntime.updateContextCapsule({
            taskId,
            summary: readInputValue(`forge-approved-capsule-summary-${taskKey}`),
            relevantModules: readLineList(`forge-approved-capsule-modules-${taskKey}`),
            constraints: readLineList(`forge-approved-capsule-constraints-${taskKey}`),
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
      syncGoalDraftFromSnapshot();
      syncOperatorProfileDraftFromSnapshot();
      syncRunOverrideDraftFromSnapshot();
      viewState.sessionContextDraft = null;
      const meta = toRecord(metaSource);
      state.meta = {
        roleCatalog: toRecord(meta["roleCatalog"]),
        personaPresets: toRecord(meta["personaPresets"]),
      };
      render();
      return;
    }

    const result = toRecord(payload.result);
    if (payload.command === "ForgeRoomUpdateSessionContext" && result["success"] !== true) {
      viewState.sessionContextDraft = null;
    }
    if (payload.command === "ForgeRoomUpdateRunOverride" && result["success"] !== true) {
      syncRunOverrideDraftFromSnapshot(true);
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
