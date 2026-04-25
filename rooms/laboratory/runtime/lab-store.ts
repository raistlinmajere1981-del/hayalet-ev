import {
  asLabRecord,
  asNonEmptyString,
  asNumber,
  asStringArray,
  clampPercent,
  createLabEventId,
  normalizeFindingKind,
  normalizeLabFeatureId,
  normalizeLabStage,
  toTimestamp,
  WORKSPACE_INTENTS,
} from "../models/lab-types.js";
import type {
  LabComparisonVariant,
  LabAiReport,
  LabArtifactProjection,
  LabEventFeedItem,
  LabEventSeverity,
  LabExecutionCandidate,
  LabExecutionCommitment,
  LabFindingProjection,
  LabInspectionMode,
  LabLiveFindingProjection,
  LabModuleState,
  LabModuleTraceEntry,
  LabPreflightResult,
  LabPreviewArtifactProjection,
  LabPersistedState,
  LabRun,
  LabSelection,
  LabSourceDrafts,
  LabStoreEvent,
  LabStoreState,
  LabUserActionEvent,
  LabUserReport,
  CapabilityFamilyId,
  LabWorkspaceUiState,
} from "../models/lab-types.js";
import {
  normalizeStoreAsset,
  normalizeStoreAssets,
  upsertStoreAsset,
} from "./store/lab-store-assets.js";
import { normalizeLabPreflight } from "../services/preflight-service.js";
import {
  freezeAnalysisScope,
  normalizeAnalysisReference,
  normalizeAnalysisScope,
} from "../shared/types/analysis-scope.js";
import { deriveLegacyStage, getActiveExecutionCandidate } from "./lab-selectors.js";
import {
  DEFAULT_AUDIO_FOCUS_SETTINGS,
  normalizeAudioFocusPatch,
  normalizeAudioFocusSettings,
} from "./lab-audio-focus-normalization.js";
import {
  clearWorkspaceSelection,
  getWorkspaceSourceSelectionResetKey,
  normalizeLabSelectionIntent,
  normalizeLabSelectionRoi,
  normalizeWorkspaceTimelineRange,
  syncWorkspaceSelectionWithRange,
} from "./lab-workspace-selection.js";
import { getSelectionSuggestionsForContext } from "./lab-selection-suggestion-logic.js";
import {
  LAB_USER_ACTION_HISTORY_LIMIT,
  getTrackedLabUserActionDefinition,
  isTrackedLabUserAction,
} from "./lab-user-actions.js";

function createDefaultSourceDrafts(): LabSourceDrafts {
  return {
    fileNameHint: "",
    urlInput: "",
    youtubeUrl: "",
    youtubePreset: null,
    youtubeCustom: {},
    youtubeCaptureMode: "video+audio",
  };
}

function createEmptyReports(): LabStoreState["reports"] {
  return {
    user: null,
    ai: null,
    emptyReason: "Rapor henüz üretilmedi.",
  };
}

function createIdlePreflight(
  reason: string | null = "Ön kontrol henüz çalıştırılmadı."
): LabPreflightResult {
  return {
    status: "idle",
    missingDependencies: [],
    warnings: [],
    estimatedRuntime: null,
    enabledModules: [],
    stageReady: false,
    rawStatus: null,
    reason,
  };
}

function normalizeWorkspaceIntentIds(value: unknown) {
  const knownIntentIds = new Set<string>(
    WORKSPACE_INTENTS.map(function (intent) {
      return intent.id;
    })
  );
  return asStringArray(value).filter(function (intentId, index, allIntentIds) {
    return knownIntentIds.has(intentId) && allIntentIds.indexOf(intentId) === index;
  }) as Array<(typeof WORKSPACE_INTENTS)[number]["id"]>;
}

function deriveCapabilitiesFromIntentIds(intentIds: unknown): CapabilityFamilyId[] {
  const normalizedIntentIds = normalizeWorkspaceIntentIds(intentIds);
  const capabilitySet = new Set<CapabilityFamilyId>();
  WORKSPACE_INTENTS.forEach(function (intent) {
    if (!normalizedIntentIds.includes(intent.id)) {
      return;
    }
    intent.internalCapabilities.forEach(function (capabilityId) {
      capabilitySet.add(capabilityId);
    });
  });
  return Array.from(capabilitySet);
}

function createInitialState(): LabStoreState {
  return {
    currentStage: "source",
    featureId: "media-analysis",
    selectedCapabilities: [],
    bootReady: false,
    roomReadySent: false,
    context: {},
    snapshot: null,
    projectIndex: {
      activeProjectId: null,
      projects: [],
    },
    workbench: {},
    source: null,
    sourceProbeStatus: "idle",
    editConfig: null,
    profileConfig: null,
    preflight: null,
    run: null,
    reports: createEmptyReports(),
    reportExports: [],
    assets: [],
    profileModels: [],
    toolState: {},
    activityFeed: [],
    userActions: [],
    persisted: null,
    ui: {
      sourceDrafts: createDefaultSourceDrafts(),
      editDrafts: {
        outputNameHint: "",
        notes: "",
        activeSourceRef: "original",
        advancedOpen: false,
      },
      profileDrafts: {
        sensitivity: null,
        transcriptSampleSeconds: null,
        depth: "balanced",
        frameSampleDensity: "balanced",
      },
      sourceDraftDirty: false,
      editDraftDirty: false,
      profileDraftDirty: false,
      toolManagerOpen: false,
      eventFeedExpanded: false,
      eventFeedCursor: 0,
      artifactListExpanded: false,
      artifactRenderCount: 12,
      reportView: "user",
      lastHydratedProjectId: null,
      activeExecutionCommitment: null,
      activeExecutionIntentId: null,
      activeSuggestionPreviewId: null,
      activeInspectionSnapshot: null,
      activePreviewArtifactId: null,
      activeAssetPreviewId: null,
      inspectionMode: "none",
      roiFocusActive: false,
      liveFindingsExpanded: true,
      analysisControlsCollapsed: true,
      editSidePanelCollapsed: false,
      rawLogCollapsed: true,
      workspace: createDefaultWorkspaceUiState(),
    },
  };
}

function createDefaultWorkspaceUiState(): LabWorkspaceUiState {
  return {
    timelineStartMs: null,
    timelineEndMs: null,
    activeSelection: null,
    roiRegions: [],
    interactiveSettings: {
      brightness: 100,
      contrast: 100,
      gamma: 1.0,
      saturation: 100,
      hueRotate: 0,
      sharpness: 100,
      channelR: true,
      channelG: true,
      channelB: true,
      edgeHighlight: false,
      invert: false,
    },
    audioFocus: normalizeAudioFocusSettings(DEFAULT_AUDIO_FOCUS_SETTINGS),
    dualPreviewEnabled: false,
    dualPreviewAudioAssetId: null,
    dualPreviewVolume: 1.0,
    hypothesis: "",
    bookmarks: [],
    selectedIntents: [],
    sourceIntakeCollapsed: false,
    rightPanelCollapsed: false,
    processViewActive: false,
    activeStepPreviewId: null,
    processPanelCollapsedSections: [],
    reportOverlayOpen: false,
  };
}

function normalizeInspectionMode(value: unknown): LabInspectionMode {
  switch (value) {
    case "visual":
    case "audio":
    case "motion":
      return value;
    default:
      return "none";
  }
}

function resetInspectionMode(state: LabStoreState) {
  state.ui.inspectionMode = "none";
}

function clearRoiFocus(state: LabStoreState) {
  state.ui.roiFocusActive = false;
}

function clearInspectionSnapshot(state: LabStoreState) {
  state.ui.activeInspectionSnapshot = null;
}

function clearInspectionDepth(state: LabStoreState) {
  clearRoiFocus(state);
  clearInspectionSnapshot(state);
}

function createImageInspectionSelection(roi: NonNullable<LabSelection["roi"]>): LabSelection {
  return {
    id: createLabEventId("selection"),
    startMs: 0,
    endMs: 1,
    type: "inspect",
    intent: "general",
    roi,
    createdAt: Math.max(0, Date.now()),
  };
}

function createSnapshotEvent(
  message: string,
  severity: LabEventFeedItem["severity"],
  detail: string | null = null,
  scope: LabEventFeedItem["scope"] = "global"
): LabEventFeedItem {
  return {
    id: createLabEventId("ui"),
    kind: "activity",
    severity,
    message,
    detail,
    percent: null,
    timestamp: Date.now(),
    source: "ui",
    action: null,
    stage: null,
    scope,
    moduleId: null,
    rawLine: null,
  };
}

function clearSuggestionPreview(state: LabStoreState) {
  state.ui.activeSuggestionPreviewId = null;
}

function clearExecutionCommitment(state: LabStoreState) {
  state.ui.activeExecutionCommitment = null;
}

function clearExecutionIntent(state: LabStoreState) {
  state.ui.activeExecutionIntentId = null;
  clearExecutionCommitment(state);
}

function normalizeExecutionPlanId(planId: string) {
  return typeof planId === "string" && planId.trim() !== "" ? planId.trim() : null;
}

function buildExecutionCommitmentSummary(candidate: LabExecutionCandidate) {
  if (candidate.status === "viable") {
    return "This path has been consciously chosen as the current passive commitment.";
  }
  if (candidate.status === "unstable") {
    return "This path has been chosen with review notes still attached.";
  }
  return "This path is not available for commitment.";
}

function createExecutionCommitmentFromCandidate(
  candidate: LabExecutionCandidate
): LabExecutionCommitment {
  return {
    id: `commitment:${candidate.planId}`,
    planId: candidate.planId,
    status: "committed",
    candidateStatus: candidate.status,
    summary: buildExecutionCommitmentSummary(candidate),
    committedAt: Date.now(),
    ...(Array.isArray(candidate.notes) && candidate.notes.length > 0
      ? { notes: candidate.notes.slice() }
      : {}),
    ...(Array.isArray(candidate.uncertainties) && candidate.uncertainties.length > 0
      ? { uncertainties: candidate.uncertainties.slice() }
      : {}),
    ...(typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
      ? { confidence: candidate.confidence }
      : {}),
  };
}

function normalizeSelectionSuggestionId(suggestionId: string) {
  return typeof suggestionId === "string" && suggestionId.trim() !== ""
    ? suggestionId.trim()
    : null;
}

function getWorkspaceSelectionSuggestionSourceKind(state: LabStoreState) {
  return asNonEmptyString(asLabRecord(state.source)["kind"]) || "video";
}

function canStoreSelectionSuggestionPreview(state: LabStoreState, suggestionId: string) {
  const normalizedSuggestionId = normalizeSelectionSuggestionId(suggestionId);
  if (normalizedSuggestionId === null) {
    return false;
  }
  const activeSelection = state.ui.workspace.activeSelection;
  if (activeSelection === null || activeSelection.endMs <= activeSelection.startMs) {
    return false;
  }

  const sourceKind = getWorkspaceSelectionSuggestionSourceKind(state);
  return getSelectionSuggestionsForContext(activeSelection, {
    inspectionMode: state.ui.inspectionMode,
    sourceKind,
  }).some((suggestion) => suggestion.id === normalizedSuggestionId);
}

function canResolveSelectionExecutionIntent(state: LabStoreState, suggestionId: string) {
  const normalizedSuggestionId = normalizeSelectionSuggestionId(suggestionId);
  if (normalizedSuggestionId === null) {
    return false;
  }
  return canStoreSelectionSuggestionPreview(state, normalizedSuggestionId);
}

function canAcceptSelectionExecutionIntent(state: LabStoreState, suggestionId: string) {
  const normalizedSuggestionId = normalizeSelectionSuggestionId(suggestionId);
  if (normalizedSuggestionId === null) {
    return false;
  }
  if (state.ui.activeSuggestionPreviewId !== normalizedSuggestionId) {
    return false;
  }
  return canResolveSelectionExecutionIntent(state, normalizedSuggestionId);
}

function toEventFeedItem(
  value: unknown,
  fallbackScope: LabEventFeedItem["scope"]
): LabEventFeedItem | null {
  const record = asLabRecord(value);
  const message = asNonEmptyString(record["message"]);
  if (message === null) {
    return null;
  }

  const source = asNonEmptyString(record["source"]);
  const severity = asNonEmptyString(record["severity"]);
  const resultAssetIds = asStringArray(record["resultAssetIds"]);
  return {
    id: asNonEmptyString(record["id"]) || createLabEventId("event"),
    kind: asNonEmptyString(record["kind"]) || "activity",
    severity:
      severity === "success" || severity === "warning" || severity === "error" ? severity : "info",
    message,
    detail: asNonEmptyString(record["detail"]),
    percent: clampPercent(record["percent"]),
    timestamp: toTimestamp(record["timestamp"]),
    source: source === "ui" || source === "system" ? source : "host",
    action: asNonEmptyString(record["action"]),
    stage: asNonEmptyString(record["stage"]),
    scope:
      asNonEmptyString(record["scope"]) === "run"
        ? "run"
        : asNonEmptyString(record["scope"]) === "global"
          ? "global"
          : fallbackScope,
    moduleId: asNonEmptyString(record["moduleId"]),
    rawLine: asNonEmptyString(record["rawLine"]),
    analysisScope: normalizeAnalysisScope(record["analysisScope"]),
    finding: asLabRecord(record["finding"]),
    artifact: asLabRecord(record["artifact"]),
    moduleTrace: asLabRecord(record["moduleTrace"]),
    comparisonVariant: asLabRecord(record["comparisonVariant"]),
    requestId: asNonEmptyString(record["requestId"]),
    jobId: asNonEmptyString(record["jobId"]),
    projectId: asNonEmptyString(record["projectId"]),
    throttleWindow: asNonEmptyString(record["throttleWindow"]),
    ...(resultAssetIds.length > 0 ? { resultAssetIds: Array.from(new Set(resultAssetIds)) } : {}),
  };
}

function normalizeUserActionResultAssetIds(value: unknown): string[] | undefined {
  const resultAssetIds = asStringArray(value);
  return resultAssetIds.length > 0 ? Array.from(new Set(resultAssetIds)) : undefined;
}

function toArtifactProjection(value: unknown): LabArtifactProjection | null {
  const record = asLabRecord(value);
  const id = asNonEmptyString(record["id"]);
  if (id === null) {
    return null;
  }

  return {
    id,
    moduleId: asNonEmptyString(record["moduleId"]),
    kind: asNonEmptyString(record["kind"]) || "artifact",
    label: asNonEmptyString(record["label"]),
    path: asNonEmptyString(record["path"]),
    fileName: asNonEmptyString(record["fileName"]),
    previewUrl: asNonEmptyString(record["previewUrl"]) || asNonEmptyString(record["fileUrl"]),
    createdAt: asNonEmptyString(record["createdAt"]),
    status: asNonEmptyString(record["status"]) || "ready",
    variantId: asNonEmptyString(record["variantId"]),
    active: record["active"] !== false,
    reference: normalizeAnalysisReference(record["reference"] ?? record),
    metadata: asLabRecord(record["metadata"]),
  };
}

function toFindingProjection(value: unknown): LabFindingProjection | null {
  const record = asLabRecord(value);
  const id = asNonEmptyString(record["id"]);
  if (id === null) {
    return null;
  }
  const severity: LabEventSeverity =
    asNonEmptyString(record["severity"]) === "success" ||
    asNonEmptyString(record["severity"]) === "warning" ||
    asNonEmptyString(record["severity"]) === "error"
      ? (asNonEmptyString(record["severity"]) as LabEventSeverity)
      : "info";

  return {
    id,
    moduleId: asNonEmptyString(record["moduleId"]),
    code: asNonEmptyString(record["code"]),
    title: asNonEmptyString(record["title"]) || "Bulgu",
    detail: asNonEmptyString(record["detail"]) || "",
    level: asNonEmptyString(record["level"]) || "low",
    severity,
    confidence: asNonEmptyString(record["confidence"]) || "low",
    kind: normalizeFindingKind(record["kind"]),
    evidenceCount: Math.max(0, Math.round(asNumber(record["evidenceCount"]) || 0)),
    artifactIds: asStringArray(record["artifactIds"]),
    sourceModule: asNonEmptyString(record["sourceModule"]) || asNonEmptyString(record["moduleId"]),
    reference: normalizeAnalysisReference(record["reference"] ?? record),
    hypothesis: asNonEmptyString(record["hypothesis"]),
  };
}

function toPreviewArtifactProjection(value: unknown): LabPreviewArtifactProjection | null {
  const baseArtifact = toArtifactProjection(value);
  if (!baseArtifact) {
    return null;
  }

  return {
    ...baseArtifact,
    status: baseArtifact.status || "ready",
    variantId: baseArtifact.variantId || null,
    active: baseArtifact.active !== false,
    reference: baseArtifact.reference || null,
    metadata: baseArtifact.metadata || {},
  };
}

function toLiveFindingProjection(value: unknown): LabLiveFindingProjection | null {
  const baseFinding = toFindingProjection(value);
  if (!baseFinding) {
    return null;
  }

  return {
    ...baseFinding,
    emittedAt: toTimestamp(asLabRecord(value)["emittedAt"]),
    windowKey: asNonEmptyString(asLabRecord(value)["windowKey"]),
    streamId: asNonEmptyString(asLabRecord(value)["streamId"]),
  };
}

function toModuleTraceEntry(value: unknown): LabModuleTraceEntry | null {
  const record = asLabRecord(value);
  const id = asNonEmptyString(record["id"]);
  if (id === null) {
    return null;
  }

  return {
    id,
    moduleId: asNonEmptyString(record["moduleId"]),
    stage: asNonEmptyString(record["stage"]) || "process",
    status: asNonEmptyString(record["status"]) || "idle",
    timestamp: asNonEmptyString(record["timestamp"]) || new Date().toISOString(),
    message: asNonEmptyString(record["message"]),
    detail: asNonEmptyString(record["detail"]),
    eventId: asNonEmptyString(record["eventId"]),
  };
}

function toComparisonVariant(value: unknown): LabComparisonVariant | null {
  const record = asLabRecord(value);
  const id = asNonEmptyString(record["id"]);
  if (id === null) {
    return null;
  }

  const artifactIds = asStringArray(record["artifactIds"]);
  const artifactId = asNonEmptyString(record["artifactId"]);

  return {
    id,
    kind: asNonEmptyString(record["kind"]) || "variant",
    label: asNonEmptyString(record["label"]) || "Variant",
    status: asNonEmptyString(record["status"]) || "ready",
    summary: asNonEmptyString(record["summary"]),
    artifactIds: artifactIds.length > 0 ? artifactIds : artifactId ? [artifactId] : [],
    artifactId,
    artifactPath: asNonEmptyString(record["artifactPath"]),
    sourceModule: asNonEmptyString(record["sourceModule"]),
    active: record["active"] !== false,
  };
}

function toModuleState(value: unknown): LabModuleState | null {
  const record = asLabRecord(value);
  const id = asNonEmptyString(record["id"]);
  if (id === null) {
    return null;
  }

  return {
    id,
    status: (asNonEmptyString(record["status"]) || "idle") as LabModuleState["status"],
    startedAt: asNonEmptyString(record["startedAt"]),
    endedAt: asNonEmptyString(record["completedAt"]),
    progress: clampPercent(record["percent"]),
    progressMode:
      clampPercent(record["percent"]) !== null ||
      asNonEmptyString(record["progressMode"]) === "measured"
        ? "measured"
        : "none",
    message: asNonEmptyString(record["message"]),
    title: asNonEmptyString(record["title"]) || asNonEmptyString(record["label"]),
    summary: asNonEmptyString(record["summary"]),
    findingIds: asStringArray(record["findingIds"]),
    artifactIds: asStringArray(record["artifactIds"]),
    metadata: asLabRecord(record["metadata"]),
  };
}

function toRunFromProcessRecord(processRecord: Record<string, unknown>): LabRun | null {
  const runId = asNonEmptyString(processRecord["runId"]);
  if (runId === null) {
    return null;
  }

  const modules = Array.isArray(processRecord["modules"])
    ? (processRecord["modules"] as unknown[])
    : [];
  const moduleMap: Record<string, LabModuleState> = {};
  const moduleOrder: string[] = [];

  modules.forEach(function (entry) {
    const nextModule = toModuleState(entry);
    if (!nextModule) {
      return;
    }
    moduleMap[nextModule.id] = nextModule;
    moduleOrder.push(nextModule.id);
  });

  const findings = (Array.isArray(processRecord["findings"]) ? processRecord["findings"] : [])
    .map(toFindingProjection)
    .filter((entry): entry is LabFindingProjection => entry !== null);
  const artifacts = (Array.isArray(processRecord["artifacts"]) ? processRecord["artifacts"] : [])
    .map(toArtifactProjection)
    .filter((entry): entry is LabArtifactProjection => entry !== null);
  const liveFindings = (
    Array.isArray(processRecord["liveFindings"]) ? processRecord["liveFindings"] : []
  )
    .map(toLiveFindingProjection)
    .filter((entry): entry is LabLiveFindingProjection => entry !== null);
  const previewArtifacts = (
    Array.isArray(processRecord["previewArtifacts"]) ? processRecord["previewArtifacts"] : []
  )
    .map(toPreviewArtifactProjection)
    .filter((entry): entry is LabPreviewArtifactProjection => entry !== null);
  const moduleTrace = (
    Array.isArray(processRecord["moduleTrace"]) ? processRecord["moduleTrace"] : []
  )
    .map(toModuleTraceEntry)
    .filter((entry): entry is LabModuleTraceEntry => entry !== null);
  const comparisonVariants = (
    Array.isArray(processRecord["comparisonVariants"]) ? processRecord["comparisonVariants"] : []
  )
    .map(toComparisonVariant)
    .filter((entry): entry is LabComparisonVariant => entry !== null);
  const endedAt = asNonEmptyString(processRecord["completedAt"]);
  const events = (Array.isArray(processRecord["events"]) ? processRecord["events"] : [])
    .map(function (entry) {
      return toEventFeedItem(entry, "run");
    })
    .filter((entry): entry is LabEventFeedItem => entry !== null && entry.kind !== "raw-log");
  const rawLog = (Array.isArray(processRecord["rawLog"]) ? processRecord["rawLog"] : [])
    .map(function (entry) {
      return toEventFeedItem(entry, "run");
    })
    .filter((entry): entry is LabEventFeedItem => entry !== null);

  return {
    id: runId,
    state: (asNonEmptyString(processRecord["status"]) || "idle") as LabRun["state"],
    startedAt: toTimestamp(processRecord["startedAt"]),
    ...(endedAt ? { endedAt: toTimestamp(endedAt) } : {}),
    modules: moduleMap,
    moduleOrder,
    events,
    rawLog,
    artifacts,
    findings,
    warnings: asStringArray(processRecord["warnings"]),
    error: asNonEmptyString(processRecord["error"]),
    targetLabel: asNonEmptyString(asLabRecord(processRecord["targetSummary"])["label"]),
    progress: clampPercent(processRecord["percent"]),
    analysisScope: normalizeAnalysisScope(processRecord["analysisScope"]),
    liveFindings,
    previewArtifacts,
    confidence: asNonEmptyString(processRecord["confidence"]),
    moduleTrace,
    comparisonVariants,
    hypothesisSummary:
      asNonEmptyString(processRecord["hypothesisSummary"]) ||
      asNonEmptyString(
        asLabRecord(normalizeAnalysisScope(processRecord["analysisScope"]))["hypothesis"]
      ),
    emptyReason:
      asNonEmptyString(processRecord["emptyReason"]) ||
      (findings.length === 0 &&
      artifacts.length === 0 &&
      asNonEmptyString(processRecord["status"]) === "ready"
        ? "Çalışma tamamlandı ancak raporlanabilir bulgu veya artefakt oluşmadı."
        : null),
  };
}

function toReportsFromRecord(reportRecord: Record<string, unknown>) {
  const userRecord = asLabRecord(reportRecord["userReport"]);
  const aiRecord = asLabRecord(reportRecord["aiReport"]);

  return {
    user:
      asNonEmptyString(userRecord["summary"]) !== null
        ? (userRecord as unknown as LabUserReport)
        : null,
    ai: aiRecord["manifest"] !== undefined ? (aiRecord as unknown as LabAiReport) : null,
    emptyReason:
      asNonEmptyString(reportRecord["emptyReason"]) ||
      (asNonEmptyString(reportRecord["status"]) === "ready"
        ? "Rapor hazır ancak okunabilir içerik üretilemedi."
        : "Rapor henüz üretilmedi."),
  };
}

function syncDraftsFromSnapshot(state: LabStoreState, snapshot: Record<string, unknown>) {
  const activeProject = asLabRecord(snapshot["activeProject"]);
  const activeProjectId = asNonEmptyString(activeProject["id"]);
  if (activeProjectId === null) {
    state.ui.lastHydratedProjectId = null;
    return state;
  }

  const source = asLabRecord(activeProject["source"]);
  const sourceDrafts = asLabRecord(source["drafts"]);
  if (state.ui.sourceDraftDirty !== true || state.ui.lastHydratedProjectId !== activeProjectId) {
    const captureMode = asNonEmptyString(sourceDrafts["youtubeCaptureMode"]);
    state.ui.sourceDrafts = {
      fileNameHint: asNonEmptyString(sourceDrafts["fileNameHint"]) || "",
      urlInput: asNonEmptyString(sourceDrafts["urlInput"]) || "",
      youtubeUrl: asNonEmptyString(sourceDrafts["youtubeUrl"]) || "",
      youtubePreset: asNonEmptyString(sourceDrafts["youtubePreset"]),
      youtubeCustom: asLabRecord(sourceDrafts["youtubeCustom"]),
      youtubeCaptureMode:
        captureMode === "audio-only" || captureMode === "video-only" ? captureMode : "video+audio",
    };
  }

  const edit = asLabRecord(activeProject["edit"]);
  const recipeCommon = asLabRecord(asLabRecord(edit["recipe"])["common"]);
  if (state.ui.editDraftDirty !== true || state.ui.lastHydratedProjectId !== activeProjectId) {
    state.ui.editDrafts = {
      ...state.ui.editDrafts,
      outputNameHint: asNonEmptyString(recipeCommon["outputNameHint"]) || "",
      notes: asNonEmptyString(recipeCommon["notes"]) || "",
      activeSourceRef:
        asNonEmptyString(asLabRecord(edit["preview"])["status"]) === "ready" &&
        asNonEmptyString(edit["handoffMode"]) === "derived"
          ? "preview"
          : "original",
    };
  }

  const profile = asLabRecord(activeProject["profile"]);
  if (state.ui.profileDraftDirty !== true || state.ui.lastHydratedProjectId !== activeProjectId) {
    state.ui.profileDrafts = {
      sensitivity:
        typeof profile["sensitivity"] === "number" ? (profile["sensitivity"] as number) : null,
      transcriptSampleSeconds:
        typeof profile["transcriptSampleSeconds"] === "number"
          ? (profile["transcriptSampleSeconds"] as number)
          : null,
      depth: asNonEmptyString(profile["depth"]) || "balanced",
      frameSampleDensity: asNonEmptyString(profile["frameSampleDensity"]) || "balanced",
    };
  }

  state.ui.lastHydratedProjectId = activeProjectId;
  return state;
}

function pushActivityEvent(state: LabStoreState, event: LabEventFeedItem) {
  state.activityFeed.unshift({
    ...event,
    scope: "global",
  });
  if (state.activityFeed.length > 260) {
    state.activityFeed.length = 260;
  }
}

function pushRunEvent(
  state: LabStoreState,
  event: LabEventFeedItem,
  options: { raw?: boolean } = {}
) {
  const run = state.run || ensurePendingRun(state, event.action || "runtime");
  const target = options.raw === true ? run.rawLog : run.events;
  target.unshift({
    ...event,
    scope: "run",
  });
  if (target.length > 260) {
    target.length = 260;
  }
}

function pushUserAction(state: LabStoreState, actionEvent: LabUserActionEvent) {
  const normalizedResultAssetIds = normalizeUserActionResultAssetIds(actionEvent.resultAssetIds);
  state.userActions = state.userActions.filter(function (entry) {
    return entry.id !== actionEvent.id;
  });
  state.userActions.unshift({
    ...actionEvent,
    ...(normalizedResultAssetIds === undefined ? {} : { resultAssetIds: normalizedResultAssetIds }),
  });
  if (state.userActions.length > LAB_USER_ACTION_HISTORY_LIMIT) {
    state.userActions.length = LAB_USER_ACTION_HISTORY_LIMIT;
  }
}

function patchUserAction(
  state: LabStoreState,
  id: string,
  patch: Partial<LabUserActionEvent>
): LabUserActionEvent | null {
  const target = state.userActions.find(function (entry) {
    return entry.id === id;
  });
  if (!target) {
    return null;
  }
  const nextPatch: Partial<LabUserActionEvent> = {
    ...patch,
  };
  if (Object.prototype.hasOwnProperty.call(patch, "resultAssetIds")) {
    const normalizedResultAssetIds = normalizeUserActionResultAssetIds(patch.resultAssetIds);
    if (normalizedResultAssetIds === undefined) {
      delete nextPatch.resultAssetIds;
    } else {
      nextPatch.resultAssetIds = normalizedResultAssetIds;
    }
  }
  Object.assign(target, nextPatch);
  return target;
}

function upsertRunLiveFinding(state: LabStoreState, event: LabEventFeedItem) {
  const run = state.run || ensurePendingRun(state, event.action || "runtime");
  const nextFinding = toLiveFindingProjection({
    ...asLabRecord(event.finding || {}),
    ...(event.moduleId ? { moduleId: event.moduleId } : {}),
    ...(event.throttleWindow ? { windowKey: event.throttleWindow } : {}),
    ...(event.analysisScope ? { analysisScope: event.analysisScope } : {}),
    ...(event.kind && !event.finding ? { kind: event.kind } : {}),
  });
  if (!nextFinding) {
    return;
  }
  run.liveFindings = run.liveFindings.filter(function (entry) {
    return entry.id !== nextFinding.id;
  });
  run.liveFindings.unshift(nextFinding);
  if (run.liveFindings.length > 80) {
    run.liveFindings.length = 80;
  }
  run.analysisScope = normalizeAnalysisScope(event.analysisScope) || run.analysisScope;
  run.hypothesisSummary = nextFinding.hypothesis || run.hypothesisSummary;
  state.ui.liveFindingsExpanded = true;
  state.workbench = {
    ...state.workbench,
    activeLiveFindingsStreamId: nextFinding.streamId || state.featureId,
  };
}

function upsertRunPreviewArtifact(
  state: LabStoreState,
  event: LabEventFeedItem,
  options: { finalArtifact?: boolean } = {}
) {
  const run = state.run || ensurePendingRun(state, event.action || "runtime");
  const nextArtifact = toPreviewArtifactProjection(event.artifact || event);
  if (!nextArtifact) {
    return;
  }
  const shouldActivate = nextArtifact.active !== false;
  if (options.finalArtifact === true) {
    const filteredArtifacts = run.artifacts.filter(function (entry) {
      return entry.id !== nextArtifact.id;
    });
    const nextArtifacts: LabArtifactProjection[] = filteredArtifacts.map(function (entry) {
      return shouldActivate ? { ...entry, active: false } : entry;
    });
    nextArtifacts.unshift({
      ...nextArtifact,
      active: shouldActivate,
    });
    if (nextArtifacts.length > 48) {
      nextArtifacts.length = 48;
    }
    run.artifacts = nextArtifacts;
  } else {
    const filteredPreviewArtifacts = run.previewArtifacts.filter(function (entry) {
      return entry.id !== nextArtifact.id;
    });
    const nextPreviewArtifacts: LabPreviewArtifactProjection[] = filteredPreviewArtifacts.map(
      function (entry) {
        return shouldActivate ? { ...entry, active: false } : entry;
      }
    );
    nextPreviewArtifacts.unshift({
      ...nextArtifact,
      active: shouldActivate,
    });
    if (nextPreviewArtifacts.length > 48) {
      nextPreviewArtifacts.length = 48;
    }
    run.previewArtifacts = nextPreviewArtifacts;
  }
  if (shouldActivate) {
    state.ui.activePreviewArtifactId = nextArtifact.id;
    state.workbench = {
      ...state.workbench,
      activePreviewArtifactId: nextArtifact.id,
    };
  }
}

function syncActivePreviewArtifact(
  variants: LabPreviewArtifactProjection[],
  artifactId: string | null
): LabPreviewArtifactProjection[] {
  return variants.map(function (entry, index) {
    const isActive =
      artifactId !== null
        ? entry.id === artifactId
        : index === 0 &&
          variants.every(function (candidate) {
            return candidate.active !== true;
          });
    return {
      ...entry,
      active: isActive,
    };
  });
}

function appendModuleTraceFromEvent(state: LabStoreState, event: LabEventFeedItem) {
  const run = state.run || ensurePendingRun(state, event.action || "runtime");
  const nextTrace =
    toModuleTraceEntry(event.moduleTrace) ||
    (function () {
      if (event.moduleId === null) {
        return null;
      }
      return {
        id: event.id,
        moduleId: event.moduleId,
        stage: event.stage || "process",
        status: event.kind,
        timestamp: new Date(event.timestamp).toISOString(),
        message: event.message,
        detail: event.detail,
        eventId: event.id,
      } as LabModuleTraceEntry;
    })();
  if (!nextTrace) {
    return;
  }
  run.moduleTrace = run.moduleTrace.filter(function (entry) {
    return entry.id !== nextTrace.id;
  });
  run.moduleTrace.unshift(nextTrace);
  if (run.moduleTrace.length > 120) {
    run.moduleTrace.length = 120;
  }
}

function appendComparisonVariantFromEvent(state: LabStoreState, event: LabEventFeedItem) {
  const run = state.run || ensurePendingRun(state, event.action || "runtime");
  const nextVariants = (Array.isArray(event.comparisonVariants) ? event.comparisonVariants : [])
    .map(toComparisonVariant)
    .filter((entry): entry is LabComparisonVariant => entry !== null);
  const primaryVariant = toComparisonVariant(event.comparisonVariant);
  if (primaryVariant) {
    nextVariants.unshift(primaryVariant);
  }
  if (nextVariants.length === 0) {
    return;
  }
  const nextVariantIds = new Set(
    nextVariants.map(function (entry) {
      return entry.id;
    })
  );
  run.comparisonVariants = run.comparisonVariants.filter(function (entry) {
    return nextVariantIds.has(entry.id) !== true;
  });
  nextVariants
    .slice()
    .reverse()
    .forEach(function (entry) {
      run.comparisonVariants.unshift(entry);
    });
  if (run.comparisonVariants.length > 32) {
    run.comparisonVariants.length = 32;
  }
}

function syncRunAugmentationsFromHostEvent(state: LabStoreState, event: LabEventFeedItem) {
  if (event.kind === "analysis-scope-updated") {
    const run = state.run || ensurePendingRun(state, event.action || "runtime");
    run.analysisScope = normalizeAnalysisScope(event.analysisScope) || run.analysisScope;
    run.hypothesisSummary =
      asNonEmptyString(asLabRecord(run.analysisScope || {})["hypothesis"]) || run.hypothesisSummary;
    return;
  }
  if (event.kind === "live-finding") {
    upsertRunLiveFinding(state, event);
    appendModuleTraceFromEvent(state, event);
    return;
  }
  if (event.kind === "preview-artifact") {
    upsertRunPreviewArtifact(state, event);
    appendComparisonVariantFromEvent(state, event);
    appendModuleTraceFromEvent(state, event);
    return;
  }
  if (event.kind === "module-artifact") {
    upsertRunPreviewArtifact(state, event, { finalArtifact: true });
    appendModuleTraceFromEvent(state, event);
    return;
  }
  if (event.kind === "module-progress" || event.kind === "module-warning") {
    appendModuleTraceFromEvent(state, event);
    if (event.kind === "module-warning" && event.detail) {
      const run = state.run || ensurePendingRun(state, event.action || "runtime");
      run.warnings = Array.from(new Set(run.warnings.concat(event.detail)));
    }
    return;
  }
  if (event.kind === "interactive-adjustment-applied") {
    state.ui.analysisControlsCollapsed = false;
  }
}

function syncUserActionsFromHostEvent(state: LabStoreState, event: LabEventFeedItem) {
  const requestId = asNonEmptyString(event.requestId);
  if (requestId === null) {
    return;
  }

  const matchedAction = state.userActions.find(function (entry) {
    return entry.requestId === requestId;
  });
  if (!matchedAction || isTrackedLabUserAction(matchedAction.sourceAction) !== true) {
    return;
  }

  const sourceAction = matchedAction.sourceAction || event.action || null;
  const trackedDefinition = getTrackedLabUserActionDefinition(sourceAction);
  if (trackedDefinition === null) {
    return;
  }

  const jobId = asNonEmptyString(event.jobId);
  if (event.kind === "request-result") {
    if (matchedAction.jobId !== null && matchedAction.jobId !== undefined) {
      return;
    }
    if (event.stage === "failed" || event.stage === "cancelled") {
      patchUserAction(state, matchedAction.id, {
        status: "error",
        finishedAt: event.timestamp || Date.now(),
        message: event.detail || trackedDefinition.errorMessage,
        projectId: asNonEmptyString(event.projectId) || matchedAction.projectId || null,
      });
    }
    return;
  }

  const basePatch: Partial<LabUserActionEvent> = {
    jobId: jobId || matchedAction.jobId || null,
    projectId: asNonEmptyString(event.projectId) || matchedAction.projectId || null,
    sourceAction,
  };

  if (event.stage === "queued" || event.stage === "running") {
    patchUserAction(state, matchedAction.id, {
      ...basePatch,
      status: "running",
    });
    return;
  }

  if (event.stage === "completed") {
    const normalizedResultAssetIds = normalizeUserActionResultAssetIds(event.resultAssetIds);
    patchUserAction(state, matchedAction.id, {
      ...basePatch,
      status: "success",
      finishedAt: event.timestamp || Date.now(),
      message: trackedDefinition.successMessage,
      ...(normalizedResultAssetIds === undefined
        ? {}
        : { resultAssetIds: normalizedResultAssetIds }),
    });
    return;
  }

  if (event.stage === "failed" || event.stage === "cancelled") {
    patchUserAction(state, matchedAction.id, {
      ...basePatch,
      status: "error",
      finishedAt: event.timestamp || Date.now(),
      message: event.detail || trackedDefinition.errorMessage,
    });
  }
}

function routeFeedEvent(state: LabStoreState, event: LabEventFeedItem) {
  if (event.scope === "run") {
    syncRunModuleFromFeedEvent(state, event);
    pushRunEvent(state, event, { raw: event.kind === "raw-log" });
    return;
  }
  pushActivityEvent(state, event);
}

function syncRunModuleFromFeedEvent(state: LabStoreState, event: LabEventFeedItem) {
  if (event.scope !== "run" || event.moduleId === null) {
    return;
  }
  const run = state.run || ensurePendingRun(state, event.action || "runtime");
  const explicitLifecycleStage =
    event.stage === "queued" ||
    event.stage === "running" ||
    event.stage === "completed" ||
    event.stage === "failed" ||
    event.stage === "cancelled" ||
    event.stage === "skipped";
  if (!run.modules[event.moduleId] && explicitLifecycleStage) {
    run.modules[event.moduleId] = {
      id: event.moduleId,
      title: event.moduleId,
      status: "queued",
      message: null,
      progress: null,
      progressMode: "none",
    };
    run.moduleOrder.push(event.moduleId);
  }
  const module = run.modules[event.moduleId];
  if (!module || event.kind === "raw-log") {
    return;
  }
  module.message = event.detail || event.message;
  if (event.severity === "error" || event.stage === "failed") {
    module.status = "failed";
    return;
  }
  if (event.stage === "completed") {
    module.status = "completed";
    return;
  }
  if (event.stage === "skipped") {
    module.status = "skipped";
    return;
  }
  if (event.stage === "cancelled") {
    module.status = "cancelled";
    return;
  }
  if (event.stage === "queued") {
    module.status = "queued";
    return;
  }
  if (event.stage === "running") {
    module.status = "running";
  }
}

function isSourceAction(action: string | null) {
  return (action || "").startsWith("source-") || (action || "").startsWith("subtitle-source-");
}

function syncSourceProbeFromHostEvent(state: LabStoreState, event: LabEventFeedItem) {
  if (isSourceAction(event.action) !== true) {
    return;
  }
  if (event.stage === "completed") {
    state.sourceProbeStatus = "completed";
    return;
  }
  if (event.stage === "failed" || event.stage === "cancelled") {
    state.sourceProbeStatus = "failed";
    return;
  }
  if (event.stage === "queued" || event.stage === "running") {
    state.sourceProbeStatus = "running";
  }
}

function syncPreviewFromHostEvent(state: LabStoreState, event: LabEventFeedItem) {
  if (
    event.action !== "edit-preview" &&
    event.action !== "subtitle-edit-preview" &&
    event.action !== "edit-apply" &&
    event.action !== "subtitle-edit-apply"
  ) {
    return;
  }
  if (!state.editConfig) {
    return;
  }
  const preview = asLabRecord(state.editConfig["preview"]);
  if (event.stage === "completed") {
    preview["status"] = "ready";
    preview["percent"] = 100;
  } else if (event.stage === "failed" || event.stage === "cancelled") {
    preview["status"] = "failed";
  } else if (event.stage === "queued" || event.stage === "running") {
    preview["status"] = "running";
  } else {
    return;
  }
  state.editConfig = {
    ...state.editConfig,
    preview,
  };
}

function syncPreflightFromHostEvent(state: LabStoreState, event: LabEventFeedItem) {
  if (event.action !== "profile-run-preflight") {
    return;
  }
  if (event.stage === "completed") {
    state.preflight = normalizeLabPreflight(state.profileConfig);
    return;
  }
  if (event.stage === "failed" || event.stage === "cancelled") {
    state.preflight = {
      ...(state.preflight || createIdlePreflight()),
      status: "blocked",
      rawStatus: "failed",
      stageReady: false,
      reason: event.detail || "Ön kontrol tamamlanamadı.",
    };
    return;
  }
  if (event.stage === "queued" || event.stage === "running") {
    state.preflight = {
      ...(state.preflight || createIdlePreflight()),
      status: "idle",
      rawStatus: "running",
      reason: event.detail || "Ön kontrol çalışıyor.",
    };
  }
}

function syncRunStateFromHostEvent(state: LabStoreState, event: LabEventFeedItem) {
  if (event.action !== "process-run" && event.action !== "audio-process-run") {
    return;
  }
  if (event.stage === "failed") {
    const run = ensurePendingRun(state, event.action);
    run.state = "failed";
    run.error = event.detail || run.error;
    return;
  }
  if (event.stage === "cancelled") {
    const run = ensurePendingRun(state, event.action);
    run.state = "cancelled";
    run.endedAt = run.endedAt || Date.now();
    return;
  }
  if (event.stage === "completed") {
    const run = ensurePendingRun(state, event.action);
    run.state = "completed";
    run.endedAt = run.endedAt || Date.now();
    return;
  }
  if (event.stage === "queued" || event.stage === "running") {
    ensurePendingRun(state, event.action).state = "running";
  }
}

function syncCanonicalStateFromHostEvent(state: LabStoreState, event: LabEventFeedItem) {
  syncSourceProbeFromHostEvent(state, event);
  syncPreviewFromHostEvent(state, event);
  syncPreflightFromHostEvent(state, event);
  syncRunStateFromHostEvent(state, event);
  syncUserActionsFromHostEvent(state, event);
}

function deriveProbeStatus(
  source: Record<string, unknown>,
  fallback: LabStoreState["sourceProbeStatus"]
) {
  const status = asNonEmptyString(source["status"]);
  if (status === "ready" || asNonEmptyString(source["storedPath"]) !== null) {
    return "completed";
  }
  if (status === "error") {
    return "failed";
  }
  if (fallback === "running") {
    return "running";
  }
  return "idle";
}

function normalizeWorkspaceSourceModeToken(value: string | null) {
  return (value || "").replaceAll(/\s+/g, "").toLowerCase();
}

function isWorkspaceLocalSourceRouteLabel(routeLabel: string) {
  return routeLabel === "localcopy" || routeLabel === "assetreuse";
}

function isWorkspaceSourceMatchingMode(source: Record<string, unknown>, mode: string | null) {
  const routeLabel = normalizeWorkspaceSourceModeToken(asNonEmptyString(source["routeLabel"]));
  if (routeLabel === "") {
    return false;
  }
  if (mode === "url") {
    return routeLabel === "directurl";
  }
  if (mode === "youtube") {
    return routeLabel === "youtube";
  }
  return isWorkspaceLocalSourceRouteLabel(routeLabel);
}

function isWorkspaceSourceReady(source: Record<string, unknown> | null) {
  if (!source) {
    return false;
  }
  const sourceRecord = asLabRecord(source);
  const mode = asNonEmptyString(sourceRecord["mode"]) || "local";
  if (asNonEmptyString(sourceRecord["storedPath"]) === null) {
    return false;
  }
  return isWorkspaceSourceMatchingMode(sourceRecord, mode);
}

function clampDualPreviewVolume(value: unknown) {
  if (typeof value !== "number" || Number.isFinite(value) !== true) {
    return 1.0;
  }
  return Math.max(0, Math.min(1, value));
}

function findWorkspaceCurrentSourceAsset(state: LabStoreState) {
  const sourceRecord = asLabRecord(state.source);
  const storedPath = asNonEmptyString(sourceRecord["storedPath"]);
  const sourceUrl = asNonEmptyString(sourceRecord["sourceUrl"]);
  const storedFileName = asNonEmptyString(sourceRecord["storedFileName"]);

  return (
    state.assets.find(function (asset) {
      if (asset.type !== "source") {
        return false;
      }
      if (storedPath !== null && asset.localPath === storedPath) {
        return true;
      }
      if (sourceUrl !== null && asset.url === sourceUrl) {
        return true;
      }
      if (storedFileName === null) {
        return false;
      }
      return (
        asset.name === storedFileName &&
        asNonEmptyString(asLabRecord(asset.metadata)["storedFileName"]) === storedFileName
      );
    }) || null
  );
}

function getWorkspaceLinkedAudioAssets(state: LabStoreState) {
  const currentSourceAsset = findWorkspaceCurrentSourceAsset(state);
  if (currentSourceAsset === null) {
    return [];
  }
  return state.assets
    .filter(function (asset) {
      return asset.type === "audio" && asset.derivedFromSourceId === currentSourceAsset.id;
    })
    .sort(function (left, right) {
      if (left.createdAt !== right.createdAt) {
        return right.createdAt - left.createdAt;
      }
      if (left.name !== right.name) {
        return left.name.localeCompare(right.name);
      }
      return left.id.localeCompare(right.id);
    });
}

function healWorkspaceDualPreviewState(state: LabStoreState) {
  const sourceRecord = asLabRecord(state.source);
  const sourceKind = asNonEmptyString(sourceRecord["kind"]);
  const linkedAudioAssets =
    sourceKind === "video" &&
    state.sourceProbeStatus === "completed" &&
    isWorkspaceSourceReady(state.source)
      ? getWorkspaceLinkedAudioAssets(state)
      : [];
  const dualPreviewAvailable = linkedAudioAssets.length > 0;
  const currentSelection = asNonEmptyString(state.ui.workspace.dualPreviewAudioAssetId);
  const resolvedSelection =
    linkedAudioAssets.find(function (asset) {
      return asset.id === currentSelection;
    }) ||
    linkedAudioAssets[0] ||
    null;

  state.ui.workspace = {
    ...state.ui.workspace,
    dualPreviewEnabled:
      dualPreviewAvailable === true ? state.ui.workspace.dualPreviewEnabled === true : false,
    dualPreviewAudioAssetId: resolvedSelection?.id || null,
    dualPreviewVolume: clampDualPreviewVolume(state.ui.workspace.dualPreviewVolume),
  };
}

function syncCanonicalStateFromSnapshot(
  state: LabStoreState,
  snapshot: Record<string, unknown>,
  options: { preserveFeatureId?: boolean } = {}
) {
  const previousActiveProjectId = state.projectIndex.activeProjectId;
  const previousSourceReady = isWorkspaceSourceReady(state.source);
  const previousSourceSelectionKey = getWorkspaceSourceSelectionResetKey(state.source);
  state.snapshot = snapshot;
  state.bootReady = snapshot["ready"] === true || state.bootReady;
  if (options.preserveFeatureId !== true) {
    state.featureId = normalizeLabFeatureId(snapshot["featureId"], state.featureId);
  }

  state.projectIndex = {
    activeProjectId: asNonEmptyString(snapshot["activeProjectId"]),
    projects: Array.isArray(snapshot["projects"])
      ? (snapshot["projects"] as unknown[]).map(asLabRecord)
      : [],
  };
  state.workbench = asLabRecord(snapshot["workbench"]);
  state.ui.activePreviewArtifactId = asNonEmptyString(state.workbench["activePreviewArtifactId"]);
  state.ui.analysisControlsCollapsed = state.workbench["controlsCollapsed"] === true;
  state.ui.liveFindingsExpanded =
    asNonEmptyString(state.workbench["activeLiveFindingsStreamId"]) !== null;
  state.profileModels = Array.isArray(snapshot["profileModels"])
    ? (snapshot["profileModels"] as unknown[]).map(asLabRecord)
    : [];
  state.toolState = asLabRecord(snapshot["toolState"]);

  const activeProject = asLabRecord(snapshot["activeProject"]);
  if (Object.keys(activeProject).length === 0) {
    state.source = null;
    state.editConfig = null;
    state.profileConfig = null;
    state.preflight = null;
    state.run = null;
    state.reports = createEmptyReports();
    state.reportExports = [];
    state.assets = [];
    state.sourceProbeStatus = state.sourceProbeStatus === "running" ? "running" : "idle";
    state.ui.lastHydratedProjectId = null;
    clearExecutionIntent(state);
    clearSuggestionPreview(state);
    resetInspectionMode(state);
    clearInspectionDepth(state);
    state.ui.workspace = clearWorkspaceSelection({
      ...state.ui.workspace,
      sourceIntakeCollapsed: false,
    });
    healWorkspaceDualPreviewState(state);
    return state;
  }

  state.source = asLabRecord(activeProject["source"]);
  state.editConfig = asLabRecord(activeProject["edit"]);
  state.profileConfig = asLabRecord(activeProject["profile"]);
  state.preflight =
    Object.keys(asLabRecord(asLabRecord(state.profileConfig)["preflight"])).length > 0
      ? normalizeLabPreflight(state.profileConfig)
      : createIdlePreflight();
  state.sourceProbeStatus = deriveProbeStatus(state.source, state.sourceProbeStatus);

  const processRecord = asLabRecord(asLabRecord(activeProject["process"])["records"])[
    state.featureId
  ];
  const nextRun = toRunFromProcessRecord(asLabRecord(processRecord));
  if (
    nextRun === null &&
    state.run &&
    state.run.id.startsWith("pending-") &&
    state.run.state === "running"
  ) {
    // Keep the pending local run alive until the host creates the process record
  } else {
    state.run = nextRun;
  }

  const reportRecord = asLabRecord(
    asLabRecord(asLabRecord(activeProject["report"])["records"])[state.featureId]
  );
  state.reports = toReportsFromRecord(reportRecord);
  state.reportExports = Array.isArray(reportRecord["exports"])
    ? (reportRecord["exports"] as unknown[]).map(asLabRecord)
    : [];
  state.assets = normalizeStoreAssets(activeProject["assets"]);

  const nextActiveProjectId = state.projectIndex.activeProjectId;
  const nextSourceReady = isWorkspaceSourceReady(state.source);
  const nextSourceSelectionKey = getWorkspaceSourceSelectionResetKey(state.source);
  if (
    previousActiveProjectId !== nextActiveProjectId ||
    previousSourceSelectionKey !== nextSourceSelectionKey
  ) {
    clearExecutionIntent(state);
    clearSuggestionPreview(state);
    resetInspectionMode(state);
    clearInspectionDepth(state);
    state.ui.workspace = clearWorkspaceSelection(state.ui.workspace);
  }
  if (previousActiveProjectId !== nextActiveProjectId) {
    state.ui.workspace = {
      ...state.ui.workspace,
      sourceIntakeCollapsed: nextSourceReady,
    };
  } else if (previousSourceReady !== nextSourceReady) {
    state.ui.workspace = {
      ...state.ui.workspace,
      sourceIntakeCollapsed: nextSourceReady,
    };
  }

  syncDraftsFromSnapshot(state, snapshot);
  healWorkspaceDualPreviewState(state);
  return state;
}

function sanitizeHydratedRun(run: LabPersistedState["lastRun"] | undefined) {
  if (!run) {
    return null;
  }

  const nextRun = structuredClone(run);
  const scopeFrozenAt =
    typeof nextRun.startedAt === "number"
      ? new Date(nextRun.startedAt).toISOString()
      : new Date().toISOString();
  if (nextRun.state === "running" || nextRun.state === "queued") {
    nextRun.state = "cancelled";
    const endedAt = nextRun.endedAt || Date.now();
    nextRun.endedAt = endedAt;
    nextRun.moduleOrder.forEach(function (moduleId) {
      const module = nextRun.modules[moduleId];
      if (!module) {
        return;
      }
      if (module.status === "running" || module.status === "queued") {
        module.status = "cancelled";
      }
      module.endedAt = module.endedAt || new Date(endedAt).toISOString();
    });
  }
  nextRun.events = Array.isArray(nextRun.events)
    ? nextRun.events
        .map(function (entry) {
          return toEventFeedItem(entry, "run");
        })
        .filter((entry): entry is LabEventFeedItem => entry !== null && entry.kind !== "raw-log")
    : [];
  nextRun.rawLog = Array.isArray(nextRun.rawLog)
    ? nextRun.rawLog
        .map(function (entry) {
          return toEventFeedItem(entry, "run");
        })
        .filter((entry): entry is LabEventFeedItem => entry !== null)
    : [];
  nextRun.analysisScope = freezeAnalysisScope(nextRun.analysisScope, nextRun.id, scopeFrozenAt);
  nextRun.liveFindings = Array.isArray(nextRun.liveFindings)
    ? nextRun.liveFindings
        .map(function (entry) {
          return toLiveFindingProjection(entry);
        })
        .filter((entry): entry is LabLiveFindingProjection => entry !== null)
    : [];
  nextRun.previewArtifacts = Array.isArray(nextRun.previewArtifacts)
    ? nextRun.previewArtifacts
        .map(function (entry) {
          return toPreviewArtifactProjection(entry);
        })
        .filter((entry): entry is LabPreviewArtifactProjection => entry !== null)
    : [];
  nextRun.confidence = asNonEmptyString(nextRun.confidence);
  nextRun.moduleTrace = Array.isArray(nextRun.moduleTrace)
    ? nextRun.moduleTrace
        .map(function (entry) {
          return toModuleTraceEntry(entry);
        })
        .filter((entry): entry is LabModuleTraceEntry => entry !== null)
    : [];
  nextRun.comparisonVariants = Array.isArray(nextRun.comparisonVariants)
    ? nextRun.comparisonVariants
        .map(function (entry) {
          return toComparisonVariant(entry);
        })
        .filter((entry): entry is LabComparisonVariant => entry !== null)
    : [];
  nextRun.hypothesisSummary = asNonEmptyString(nextRun.hypothesisSummary);
  nextRun.emptyReason =
    typeof nextRun.emptyReason === "string"
      ? nextRun.emptyReason
      : "Önceki çalışma özet olarak geri yüklendi.";
  return nextRun;
}

function ensurePendingRun(state: LabStoreState, action: string) {
  if (state.run) {
    return state.run;
  }

  const nextRun: LabRun = {
    id: `pending-${action}-${Date.now()}`,
    state: "running",
    startedAt: Date.now(),
    modules: {},
    moduleOrder: [],
    events: [],
    rawLog: [],
    artifacts: [],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: null,
    emptyReason: null,
    analysisScope: normalizeAnalysisScope(asLabRecord(state.workbench)["analysisScope"]),
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary:
      asNonEmptyString(
        asLabRecord(normalizeAnalysisScope(asLabRecord(state.workbench)["analysisScope"]))[
          "hypothesis"
        ]
      ) || null,
  };
  state.run = nextRun;
  return nextRun;
}

function reduceEvent(state: LabStoreState, event: LabStoreEvent): LabStoreState {
  switch (event.type) {
    case "hydrate":
      if (event.payload) {
        clearExecutionIntent(state);
        clearSuggestionPreview(state);
        resetInspectionMode(state);
        clearInspectionDepth(state);
        state.persisted = event.payload as LabPersistedState;
        state.currentStage = normalizeLabStage(event.payload.currentStage, state.currentStage);
        state.featureId = normalizeLabFeatureId(event.payload.featureId, state.featureId);
        state.selectedCapabilities = Array.isArray(event.payload.selectedCapabilities)
          ? (event.payload.selectedCapabilities as unknown[]).filter(
              (entry): entry is CapabilityFamilyId => typeof entry === "string"
            )
          : [];
        if (event.payload.projectIndex) {
          state.projectIndex = event.payload.projectIndex;
          state.ui.lastHydratedProjectId = event.payload.projectIndex.activeProjectId;
        }
        state.workbench = asLabRecord(event.payload.workbench);
        state.source = event.payload.source || null;
        state.sourceProbeStatus = event.payload.sourceProbeStatus || state.sourceProbeStatus;
        state.editConfig = event.payload.editConfig || null;
        state.profileConfig = event.payload.profileConfig || null;
        state.preflight = event.payload.preflight || createIdlePreflight();
        state.run = sanitizeHydratedRun(event.payload.lastRun);
        state.reports = event.payload.reports || state.reports;
        state.reportExports = Array.isArray(event.payload.reportExports)
          ? event.payload.reportExports
          : [];
        state.assets = normalizeStoreAssets(event.payload.assets);
        state.profileModels = Array.isArray(event.payload.profileModels)
          ? event.payload.profileModels
          : [];
        state.toolState = asLabRecord(event.payload.toolState);
        state.activityFeed = Array.isArray(event.payload.activityFeed)
          ? event.payload.activityFeed
              .map(function (entry) {
                return toEventFeedItem(entry, "global");
              })
              .filter((entry): entry is LabEventFeedItem => entry !== null)
          : [];
        state.ui.sourceDrafts = {
          ...state.ui.sourceDrafts,
          ...(event.payload.sourceDrafts || {}),
        };
        state.ui.editDrafts = {
          ...state.ui.editDrafts,
          ...(event.payload.editDrafts || {}),
        };
        state.ui.profileDrafts = {
          ...state.ui.profileDrafts,
          ...(event.payload.profileDrafts || {}),
        };
        state.ui.reportView = event.payload.reportView || state.ui.reportView;
        state.ui.eventFeedExpanded = event.payload.eventFeedExpanded === true;
        state.ui.eventFeedCursor = Math.max(0, Math.round(event.payload.eventFeedCursor || 0));
        state.ui.artifactListExpanded = event.payload.artifactListExpanded === true;
        state.ui.artifactRenderCount = Math.max(
          12,
          Math.round(event.payload.artifactRenderCount || state.ui.artifactRenderCount)
        );
        state.ui.activePreviewArtifactId = event.payload.activePreviewArtifactId || null;
        state.ui.liveFindingsExpanded = event.payload.liveFindingsExpanded !== false;
        state.ui.analysisControlsCollapsed = event.payload.analysisControlsCollapsed === true;
        state.ui.editSidePanelCollapsed = event.payload.editSidePanelCollapsed === true;
        state.ui.rawLogCollapsed = event.payload.rawLogCollapsed !== false;
        // V2.3: hydrate workspace state
        if (event.payload.workspace && typeof event.payload.workspace === "object") {
          const ws = event.payload.workspace as Partial<
            import("../models/lab-types.js").LabWorkspaceUiState
          >;
          const hydratedTimelineRange = normalizeWorkspaceTimelineRange(
            typeof ws.timelineStartMs === "number"
              ? ws.timelineStartMs
              : state.ui.workspace.timelineStartMs,
            typeof ws.timelineEndMs === "number"
              ? ws.timelineEndMs
              : state.ui.workspace.timelineEndMs
          );
          state.ui.workspace = syncWorkspaceSelectionWithRange(
            {
              ...state.ui.workspace,
              activeSelection: null,
              roiRegions: Array.isArray(ws.roiRegions)
                ? ws.roiRegions
                : state.ui.workspace.roiRegions,
              interactiveSettings: ws.interactiveSettings
                ? { ...state.ui.workspace.interactiveSettings, ...ws.interactiveSettings }
                : state.ui.workspace.interactiveSettings,
              audioFocus: normalizeAudioFocusPatch(state.ui.workspace.audioFocus, ws.audioFocus),
              dualPreviewEnabled: ws.dualPreviewEnabled === true,
              dualPreviewAudioAssetId:
                typeof ws.dualPreviewAudioAssetId === "string" ? ws.dualPreviewAudioAssetId : null,
              dualPreviewVolume:
                typeof ws.dualPreviewVolume === "number"
                  ? clampDualPreviewVolume(ws.dualPreviewVolume)
                  : state.ui.workspace.dualPreviewVolume,
              hypothesis:
                typeof ws.hypothesis === "string" ? ws.hypothesis : state.ui.workspace.hypothesis,
              bookmarks: Array.isArray(ws.bookmarks) ? ws.bookmarks : state.ui.workspace.bookmarks,
              selectedIntents: Array.isArray(ws.selectedIntents)
                ? normalizeWorkspaceIntentIds(ws.selectedIntents)
                : state.ui.workspace.selectedIntents,
              sourceIntakeCollapsed: ws.sourceIntakeCollapsed === true,
              rightPanelCollapsed: ws.rightPanelCollapsed === true,
              processViewActive: ws.processViewActive === true,
              activeStepPreviewId:
                typeof ws.activeStepPreviewId === "string" ? ws.activeStepPreviewId : null,
              processPanelCollapsedSections: Array.isArray(ws.processPanelCollapsedSections)
                ? ws.processPanelCollapsedSections
                : state.ui.workspace.processPanelCollapsedSections,
              reportOverlayOpen: ws.reportOverlayOpen === true,
            },
            hydratedTimelineRange,
            {
              persistedSelection: ws.activeSelection,
            }
          );
          if (Array.isArray(ws.selectedIntents)) {
            state.selectedCapabilities = deriveCapabilitiesFromIntentIds(
              state.ui.workspace.selectedIntents
            );
          }
          healWorkspaceDualPreviewState(state);
        }
        state.bootReady =
          state.bootReady ||
          state.source !== null ||
          state.run !== null ||
          state.reports.user !== null ||
          state.reports.ai !== null;
      }
      return state;
    case "host-event-received":
      syncCanonicalStateFromHostEvent(state, event.event);
      syncRunAugmentationsFromHostEvent(state, event.event);
      routeFeedEvent(state, event.event);
      return state;
    case "bootstrap-ready-sent":
      state.roomReadySent = true;
      return state;
    case "context-received":
      state.context = event.payload;
      state.featureId = normalizeLabFeatureId(event.payload["featureId"], state.featureId);
      return state;
    case "snapshot-received":
      syncCanonicalStateFromSnapshot(state, event.payload);
      return state;
    case "source-snapshot-received":
      syncCanonicalStateFromSnapshot(state, event.payload, { preserveFeatureId: true });
      return state;
    case "job-received":
      if (event.event) {
        routeFeedEvent(state, event.event);
      }
      return state;
    case "request-result-received":
      if (event.event) {
        routeFeedEvent(state, event.event);
      }
      state.ui.sourceDraftDirty = false;
      state.ui.editDraftDirty = false;
      state.ui.profileDraftDirty = false;
      return state;
    case "source-probe-started":
      state.sourceProbeStatus = "running";
      healWorkspaceDualPreviewState(state);
      return state;
    case "source-probe-progress":
      state.sourceProbeStatus = "running";
      healWorkspaceDualPreviewState(state);
      return state;
    case "source-probe-completed":
      state.sourceProbeStatus = "completed";
      state.ui.workspace = {
        ...state.ui.workspace,
        sourceIntakeCollapsed: true,
      };
      healWorkspaceDualPreviewState(state);
      return state;
    case "source-probe-failed":
      state.sourceProbeStatus = "failed";
      state.ui.workspace = {
        ...state.ui.workspace,
        sourceIntakeCollapsed: false,
      };
      healWorkspaceDualPreviewState(state);
      return state;
    case "preview-started":
    case "preview-progress": {
      if (state.editConfig) {
        const preview = asLabRecord(state.editConfig["preview"]);
        preview["status"] = "running";
        if (event.type === "preview-progress" && typeof event.progress === "number") {
          preview["percent"] = event.progress;
        }
        state.editConfig = {
          ...state.editConfig,
          preview,
        };
      }
      return state;
    }
    case "preview-completed":
      if (state.editConfig) {
        const preview = asLabRecord(state.editConfig["preview"]);
        preview["status"] = "ready";
        preview["percent"] = 100;
        state.editConfig = {
          ...state.editConfig,
          preview,
        };
      }
      return state;
    case "preview-failed":
      if (state.editConfig) {
        const preview = asLabRecord(state.editConfig["preview"]);
        preview["status"] = "failed";
        state.editConfig = {
          ...state.editConfig,
          preview,
        };
      }
      return state;
    case "preflight-started":
      state.preflight = {
        ...(state.preflight || createIdlePreflight()),
        status: "idle",
        rawStatus: "running",
        reason: "Ön kontrol çalışıyor.",
      };
      return state;
    case "preflight-completed":
      state.preflight = normalizeLabPreflight(state.profileConfig);
      return state;
    case "preflight-failed":
      state.preflight = {
        ...(state.preflight || createIdlePreflight()),
        status: "blocked",
        rawStatus: "failed",
        stageReady: false,
        reason: event.detail || "Ön kontrol tamamlanamadı.",
      };
      return state;
    case "run-started":
      ensurePendingRun(state, event.action).state = "running";
      return state;
    case "run-cancelled":
      if (state.run) {
        state.run.state = "cancelled";
        state.run.endedAt = state.run.endedAt || Date.now();
        const activeModuleId = state.run.moduleOrder.find(function (moduleId) {
          const module = state.run?.modules[moduleId];
          return module?.status === "running" || module?.status === "queued";
        });
        if (activeModuleId) {
          const activeModule = state.run.modules[activeModuleId];
          if (activeModule) {
            activeModule.status = "cancelled";
          }
        }
      }
      return state;
    case "run-failed":
      ensurePendingRun(state, event.action).state = "failed";
      if (state.run) {
        state.run.error = event.detail || state.run.error;
      }
      return state;
    case "module-started":
    case "module-progress":
    case "module-finished":
    case "module-failed":
    case "module-skipped": {
      const run = ensurePendingRun(state, event.action);
      if (!run.modules[event.moduleId]) {
        run.modules[event.moduleId] = {
          id: event.moduleId,
          status: "queued",
          message: null,
          progress: null,
          progressMode: "none",
        };
        run.moduleOrder.push(event.moduleId);
      }
      const module = run.modules[event.moduleId];
      if (!module) {
        return state;
      }
      if (event.type === "module-started") {
        module.status = "running";
      } else if (event.type === "module-progress") {
        module.status = "running";
        if (typeof event.progress === "number") {
          module.progress = event.progress;
          module.progressMode = "measured";
        }
      } else if (event.type === "module-finished") {
        module.status = "completed";
        if (module.progressMode === "measured") {
          module.progress = 100;
        }
      } else if (event.type === "module-failed") {
        module.status = "failed";
      } else if (event.type === "module-skipped") {
        module.status = "skipped";
      }
      module.message = event.detail || module.message || null;
      return state;
    }
    case "stage-changed":
      // Legacy compat: accept the stage value passively but it will be
      // overwritten by the projection in syncLegacyStage after reduce.
      state.currentStage = event.stage;
      return state;
    case "feature-changed":
      state.featureId = event.featureId;
      if (state.snapshot) {
        syncCanonicalStateFromSnapshot(state, state.snapshot, { preserveFeatureId: true });
      }
      return state;
    case "workbench-updated":
      state.workbench = asLabRecord(event.workbench);
      state.ui.activePreviewArtifactId = asNonEmptyString(
        state.workbench["activePreviewArtifactId"]
      );
      state.ui.analysisControlsCollapsed = state.workbench["controlsCollapsed"] === true;
      state.ui.liveFindingsExpanded =
        asNonEmptyString(state.workbench["activeLiveFindingsStreamId"]) !== null;
      return state;
    case "source-config-patched": {
      const previousSourceSelectionKey = getWorkspaceSourceSelectionResetKey(state.source);
      state.source = {
        ...(state.source || {}),
        ...asLabRecord(event.patch),
      };
      const nextSourceSelectionKey = getWorkspaceSourceSelectionResetKey(state.source);
      if (previousSourceSelectionKey !== nextSourceSelectionKey) {
        clearExecutionIntent(state);
        clearSuggestionPreview(state);
        resetInspectionMode(state);
        clearInspectionDepth(state);
        state.ui.workspace = clearWorkspaceSelection(state.ui.workspace);
      }
      if (
        event.patch["kind"] !== undefined ||
        event.patch["mode"] !== undefined ||
        event.patch["storedPath"] === null ||
        event.patch["status"] === "idle"
      ) {
        state.ui.workspace = {
          ...state.ui.workspace,
          sourceIntakeCollapsed: false,
        };
      }
      healWorkspaceDualPreviewState(state);
      return state;
    }
    case "source-drafts-updated":
      state.ui.sourceDrafts = {
        ...state.ui.sourceDrafts,
        ...event.patch,
      };
      state.ui.sourceDraftDirty = true;
      return state;
    case "source-drafts-committed":
      state.ui.sourceDraftDirty = false;
      return state;
    case "edit-drafts-updated":
      state.ui.editDrafts = {
        ...state.ui.editDrafts,
        ...event.patch,
      };
      state.ui.editDraftDirty = true;
      return state;
    case "edit-drafts-committed":
      state.ui.editDraftDirty = false;
      return state;
    case "profile-drafts-updated":
      state.ui.profileDrafts = {
        ...state.ui.profileDrafts,
        ...event.patch,
      };
      state.ui.profileDraftDirty = true;
      return state;
    case "profile-drafts-committed":
      state.ui.profileDraftDirty = false;
      return state;
    case "tool-manager-toggled":
      state.ui.toolManagerOpen =
        typeof event.open === "boolean" ? event.open : !state.ui.toolManagerOpen;
      return state;
    case "toggle-event-feed":
      state.ui.eventFeedExpanded =
        typeof event.force === "boolean" ? event.force : !state.ui.eventFeedExpanded;
      state.ui.eventFeedCursor = 0;
      return state;
    case "advance-event-feed":
      state.ui.eventFeedExpanded = true;
      state.ui.eventFeedCursor += 40;
      return state;
    case "reset-event-feed":
      state.ui.eventFeedCursor = 0;
      return state;
    case "toggle-artifacts":
      state.ui.artifactListExpanded =
        typeof event.force === "boolean" ? event.force : !state.ui.artifactListExpanded;
      state.ui.artifactRenderCount = state.ui.artifactListExpanded
        ? Math.max(24, state.ui.artifactRenderCount)
        : 12;
      return state;
    case "show-more-artifacts":
      state.ui.artifactListExpanded = true;
      state.ui.artifactRenderCount += 24;
      return state;
    case "report-view-changed":
      state.ui.reportView = event.view;
      return state;
    case "preview-artifact-activated":
      state.ui.activePreviewArtifactId = event.artifactId;
      if (state.run) {
        state.run.previewArtifacts = syncActivePreviewArtifact(
          state.run.previewArtifacts,
          event.artifactId
        );
      }
      state.workbench = {
        ...state.workbench,
        activePreviewArtifactId: event.artifactId,
      };
      return state;
    case "asset-preview-opened":
      state.ui.activeAssetPreviewId = event.assetId;
      return state;
    case "asset-preview-closed":
      state.ui.activeAssetPreviewId = null;
      return state;
    case "live-findings-expanded":
      state.ui.liveFindingsExpanded =
        typeof event.force === "boolean" ? event.force : !state.ui.liveFindingsExpanded;
      state.workbench = {
        ...state.workbench,
        activeLiveFindingsStreamId: state.ui.liveFindingsExpanded ? state.featureId : null,
      };
      return state;
    case "analysis-controls-collapsed":
      state.ui.analysisControlsCollapsed =
        typeof event.force === "boolean" ? event.force : !state.ui.analysisControlsCollapsed;
      state.workbench = {
        ...state.workbench,
        controlsCollapsed: state.ui.analysisControlsCollapsed,
      };
      return state;
    case "capability-select": {
      const nextCaps = state.selectedCapabilities.includes(event.capabilityId)
        ? state.selectedCapabilities
        : state.selectedCapabilities.concat(event.capabilityId);
      state.selectedCapabilities = nextCaps;
      return state;
    }
    case "capability-deselect": {
      state.selectedCapabilities = state.selectedCapabilities.filter(function (entry) {
        return entry !== event.capabilityId;
      });
      return state;
    }
    case "capability-set":
      state.selectedCapabilities = event.capabilities.slice();
      return state;
    case "edit-side-panel-toggled":
      state.ui.editSidePanelCollapsed =
        typeof event.force === "boolean" ? event.force : !state.ui.editSidePanelCollapsed;
      return state;
    case "raw-log-toggled":
      state.ui.rawLogCollapsed =
        typeof event.force === "boolean" ? event.force : !state.ui.rawLogCollapsed;
      return state;
    case "push-event":
      routeFeedEvent(state, event.event);
      return state;
    case "asset-added":
      state.assets = upsertStoreAsset(state.assets, event.asset);
      healWorkspaceDualPreviewState(state);
      return state;
    case "asset-removed":
      state.assets = state.assets.filter(function (asset) {
        return asset.id !== event.id;
      });
      if (state.ui.activeAssetPreviewId === event.id) {
        state.ui.activeAssetPreviewId = null;
      }
      healWorkspaceDualPreviewState(state);
      return state;
    case "asset-updated":
      state.assets = state.assets.map(function (asset) {
        if (asset.id !== event.id) {
          return asset;
        }
        return (
          normalizeStoreAsset({
            ...asset,
            ...event.patch,
            id: asset.id,
            type: event.patch.type || asset.type,
            name: event.patch.name || asset.name,
            createdAt: event.patch.createdAt || asset.createdAt,
          }) || asset
        );
      });
      healWorkspaceDualPreviewState(state);
      return state;
    case "user-action-added":
      const normalizedResultAssetIds = normalizeUserActionResultAssetIds(
        event.actionEvent.resultAssetIds
      );
      pushUserAction(state, {
        ...event.actionEvent,
        dismissedFromHubAt: event.actionEvent.dismissedFromHubAt ?? null,
        jobId: event.actionEvent.jobId ?? null,
        projectId: event.actionEvent.projectId ?? null,
        requestId: event.actionEvent.requestId ?? null,
        ...(normalizedResultAssetIds === undefined
          ? {}
          : { resultAssetIds: normalizedResultAssetIds }),
        sourceAction: event.actionEvent.sourceAction ?? null,
      });
      return state;
    case "user-action-updated":
      patchUserAction(state, event.id, event.patch);
      return state;
    case "user-action-hub-dismissed":
      patchUserAction(state, event.id, {
        dismissedFromHubAt: Date.now(),
      });
      return state;
    case "clear-events":
      state.activityFeed = [createSnapshotEvent("Olay akisi temizlendi.", "info")];
      state.ui.eventFeedCursor = 0;
      return state;
    // V2.3 workspace events
    case "workspace-timeline-updated": {
      const nextTimelineRange = normalizeWorkspaceTimelineRange(event.startMs, event.endMs);
      if (
        nextTimelineRange.startMs !== state.ui.workspace.timelineStartMs ||
        nextTimelineRange.endMs !== state.ui.workspace.timelineEndMs
      ) {
        clearExecutionIntent(state);
        clearSuggestionPreview(state);
        clearInspectionDepth(state);
      }
      state.ui.workspace = syncWorkspaceSelectionWithRange(state.ui.workspace, nextTimelineRange);
      return state;
    }
    case "workspace-selection-intent-updated": {
      if (state.ui.workspace.activeSelection === null) {
        return state;
      }
      const nextIntent = normalizeLabSelectionIntent(event.intent);
      if (state.ui.workspace.activeSelection.intent === nextIntent) {
        return state;
      }
      clearExecutionIntent(state);
      clearSuggestionPreview(state);
      state.ui.workspace = {
        ...state.ui.workspace,
        activeSelection: {
          ...state.ui.workspace.activeSelection,
          intent: nextIntent,
        },
      };
      return state;
    }
    case "workspace-selection-suggestion-clicked":
      return state;
    case "workspace-selection-suggestion-accepted":
      if (!canAcceptSelectionExecutionIntent(state, event.suggestionId)) {
        return state;
      }
      {
        const nextExecutionIntentId = normalizeSelectionSuggestionId(event.suggestionId);
        if (state.ui.activeExecutionIntentId !== nextExecutionIntentId) {
          clearExecutionCommitment(state);
        }
        state.ui.activeExecutionIntentId = nextExecutionIntentId;
      }
      return state;
    case "workspace-selection-suggestion-dismissed":
      if (state.ui.activeExecutionIntentId === normalizeSelectionSuggestionId(event.suggestionId)) {
        clearExecutionIntent(state);
      }
      return state;
    case "workspace-selection-suggestion-queued":
      return state;
    case "workspace-execution-intent-cleared":
      clearExecutionIntent(state);
      return state;
    case "workspace-execution-commitment-set": {
      const planId = normalizeExecutionPlanId(event.planId);
      if (planId === null) {
        return state;
      }
      const candidate = getActiveExecutionCandidate(state);
      if (candidate === null || candidate.planId !== planId || candidate.status === "not-viable") {
        return state;
      }
      state.ui.activeExecutionCommitment = createExecutionCommitmentFromCandidate(candidate);
      return state;
    }
    case "workspace-execution-commitment-revoked":
      clearExecutionCommitment(state);
      return state;
    case "workspace-selection-suggestion-preview-set":
      if (!canStoreSelectionSuggestionPreview(state, event.suggestionId)) {
        clearSuggestionPreview(state);
        return state;
      }
      state.ui.activeSuggestionPreviewId = normalizeSelectionSuggestionId(event.suggestionId);
      return state;
    case "workspace-selection-suggestion-preview-cleared":
      clearSuggestionPreview(state);
      return state;
    case "selection-roi-focus-set": {
      const activeSelection = state.ui.workspace.activeSelection;
      if (
        event.active !== true ||
        activeSelection === null ||
        activeSelection.endMs <= activeSelection.startMs ||
        activeSelection.roi === undefined
      ) {
        clearRoiFocus(state);
        return state;
      }
      state.ui.roiFocusActive = true;
      return state;
    }
    case "selection-roi-focus-cleared":
      clearRoiFocus(state);
      return state;
    case "selection-roi-updated": {
      const normalizedRoi = normalizeLabSelectionRoi(event.roi);
      if (!normalizedRoi) {
        return state;
      }
      clearExecutionIntent(state);
      clearSuggestionPreview(state);
      clearInspectionSnapshot(state);
      const activeSelection = state.ui.workspace.activeSelection;
      const sourceKind = getWorkspaceSelectionSuggestionSourceKind(state);
      if (activeSelection === null || activeSelection.endMs <= activeSelection.startMs) {
        if (sourceKind !== "image") {
          return state;
        }
        state.ui.workspace = {
          ...state.ui.workspace,
          activeSelection: createImageInspectionSelection(normalizedRoi),
        };
        return state;
      }
      state.ui.workspace = {
        ...state.ui.workspace,
        activeSelection: {
          ...activeSelection,
          roi: normalizedRoi,
        },
      };
      return state;
    }
    case "selection-roi-cleared": {
      const activeSelection = state.ui.workspace.activeSelection;
      if (activeSelection === null) {
        clearExecutionIntent(state);
        clearInspectionDepth(state);
        return state;
      }
      clearExecutionIntent(state);
      clearSuggestionPreview(state);
      clearInspectionDepth(state);
      const sourceKind = getWorkspaceSelectionSuggestionSourceKind(state);
      const imageOnlySelection =
        sourceKind === "image" &&
        activeSelection.startMs === 0 &&
        activeSelection.endMs === 1 &&
        state.ui.workspace.timelineStartMs === null &&
        state.ui.workspace.timelineEndMs === null;
      if (imageOnlySelection) {
        state.ui.workspace = {
          ...state.ui.workspace,
          activeSelection: null,
        };
        return state;
      }
      const { roi: _removedRoi, ...selectionWithoutRoi } = activeSelection;
      state.ui.workspace = {
        ...state.ui.workspace,
        activeSelection: selectionWithoutRoi,
      };
      return state;
    }
    case "selection-roi-snapshot-set": {
      const activeSelection = state.ui.workspace.activeSelection;
      if (
        activeSelection === null ||
        activeSelection.endMs <= activeSelection.startMs ||
        activeSelection.roi === undefined
      ) {
        clearInspectionSnapshot(state);
        return state;
      }
      state.ui.activeInspectionSnapshot = event.snapshot;
      return state;
    }
    case "selection-roi-snapshot-cleared":
      clearInspectionSnapshot(state);
      return state;
    case "selection-inspection-mode-updated": {
      const nextInspectionMode = normalizeInspectionMode(event.mode);
      if (state.ui.inspectionMode === nextInspectionMode) {
        return state;
      }
      clearExecutionIntent(state);
      clearSuggestionPreview(state);
      state.ui.inspectionMode = nextInspectionMode;
      return state;
    }
    case "workspace-roi-added":
      state.ui.workspace = {
        ...state.ui.workspace,
        roiRegions: state.ui.workspace.roiRegions.concat(event.region),
      };
      return state;
    case "workspace-roi-updated":
      state.ui.workspace = {
        ...state.ui.workspace,
        roiRegions: state.ui.workspace.roiRegions.map(function (entry) {
          return entry.id === event.region.id ? event.region : entry;
        }),
      };
      return state;
    case "workspace-roi-removed":
      state.ui.workspace = {
        ...state.ui.workspace,
        roiRegions: state.ui.workspace.roiRegions.filter(function (entry) {
          return entry.id !== event.regionId;
        }),
      };
      return state;
    case "workspace-roi-toggled":
      state.ui.workspace = {
        ...state.ui.workspace,
        roiRegions: state.ui.workspace.roiRegions.map(function (entry) {
          return entry.id === event.regionId ? { ...entry, active: !entry.active } : entry;
        }),
      };
      return state;
    case "workspace-dual-preview-toggled": {
      const nextEnabled =
        typeof event.force === "boolean" ? event.force : !state.ui.workspace.dualPreviewEnabled;
      state.ui.workspace = {
        ...state.ui.workspace,
        dualPreviewEnabled: nextEnabled,
        dualPreviewAudioAssetId:
          typeof event.audioAssetId === "string"
            ? event.audioAssetId
            : state.ui.workspace.dualPreviewAudioAssetId,
      };
      healWorkspaceDualPreviewState(state);
      return state;
    }
    case "workspace-dual-preview-audio-selected":
      state.ui.workspace = {
        ...state.ui.workspace,
        dualPreviewAudioAssetId: event.audioAssetId,
      };
      healWorkspaceDualPreviewState(state);
      return state;
    case "workspace-dual-preview-volume-updated":
      state.ui.workspace = {
        ...state.ui.workspace,
        dualPreviewVolume: clampDualPreviewVolume(event.volume),
      };
      return state;
    case "workspace-interactive-updated":
      state.ui.workspace = {
        ...state.ui.workspace,
        interactiveSettings: {
          ...state.ui.workspace.interactiveSettings,
          ...event.patch,
        },
      };
      return state;
    case "workspace-hypothesis-updated":
      state.ui.workspace = {
        ...state.ui.workspace,
        hypothesis: event.text,
      };
      return state;
    case "workspace-bookmark-added":
      state.ui.workspace = {
        ...state.ui.workspace,
        bookmarks: state.ui.workspace.bookmarks.concat(event.bookmark),
      };
      return state;
    case "workspace-bookmark-removed":
      state.ui.workspace = {
        ...state.ui.workspace,
        bookmarks: state.ui.workspace.bookmarks.filter(function (entry) {
          return entry.id !== event.bookmarkId;
        }),
      };
      return state;
    case "workspace-intent-set": {
      const nextIntents = normalizeWorkspaceIntentIds(event.intents);
      state.ui.workspace = {
        ...state.ui.workspace,
        selectedIntents: nextIntents,
      };
      state.selectedCapabilities = deriveCapabilitiesFromIntentIds(nextIntents);
      return state;
    }
    case "workspace-intent-toggled": {
      const intents = normalizeWorkspaceIntentIds(state.ui.workspace.selectedIntents);
      const nextIntents = intents.includes(event.intentId)
        ? intents.filter(function (entry) {
            return entry !== event.intentId;
          })
        : intents.concat(event.intentId);
      state.ui.workspace = {
        ...state.ui.workspace,
        selectedIntents: nextIntents,
      };
      state.selectedCapabilities = deriveCapabilitiesFromIntentIds(nextIntents);
      return state;
    }
    case "workspace-source-intake-toggled":
      state.ui.workspace = {
        ...state.ui.workspace,
        sourceIntakeCollapsed:
          typeof event.force === "boolean"
            ? event.force
            : !state.ui.workspace.sourceIntakeCollapsed,
      };
      return state;
    case "workspace-audio-updated":
      state.ui.workspace = {
        ...state.ui.workspace,
        audioFocus: normalizeAudioFocusPatch(state.ui.workspace.audioFocus, event.patch),
      };
      return state;
    case "workspace-right-panel-toggled":
      state.ui.workspace = {
        ...state.ui.workspace,
        rightPanelCollapsed:
          typeof event.force === "boolean" ? event.force : !state.ui.workspace.rightPanelCollapsed,
      };
      return state;
    case "workspace-process-view-toggled":
      state.ui.workspace = {
        ...state.ui.workspace,
        processViewActive:
          typeof event.force === "boolean" ? event.force : !state.ui.workspace.processViewActive,
      };
      return state;
    case "workspace-step-preview-activated":
      state.ui.workspace = {
        ...state.ui.workspace,
        activeStepPreviewId: event.stepId,
      };
      return state;
    case "workspace-process-section-toggled": {
      const collapsed = state.ui.workspace.processPanelCollapsedSections.slice();
      const idx = collapsed.indexOf(event.sectionId);
      if (idx >= 0) {
        collapsed.splice(idx, 1);
      } else {
        collapsed.push(event.sectionId);
      }
      state.ui.workspace = {
        ...state.ui.workspace,
        processPanelCollapsedSections: collapsed,
      };
      return state;
    }
    case "report-overlay-toggled":
      state.ui.workspace = {
        ...state.ui.workspace,
        reportOverlayOpen: event.open,
      };
      return state;
    default:
      return state;
  }
}

export function createLabStore() {
  let state = createInitialState();
  const listeners = new Set<(nextState: LabStoreState) => void>();

  function getState() {
    return state;
  }

  function subscribe(listener: (nextState: LabStoreState) => void) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  function dispatch(event: LabStoreEvent) {
    state = reduceEvent(structuredClone(state), event);
    // Recompute legacy stage from real state after every mutation
    state.currentStage = deriveLegacyStage(state);
    listeners.forEach(function (listener) {
      listener(state);
    });
  }

  return {
    dispatch,
    getState,
    subscribe,
  };
}
