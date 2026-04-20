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
} from "../models/lab-types.js";
import type {
  LabComparisonVariant,
  LabAiReport,
  LabArtifactProjection,
  LabEventFeedItem,
  LabEventSeverity,
  LabFindingProjection,
  LabLiveFindingProjection,
  LabModuleState,
  LabModuleTraceEntry,
  LabPreflightResult,
  LabPreviewArtifactProjection,
  LabPersistedState,
  LabRun,
  LabSourceDrafts,
  LabStoreEvent,
  LabStoreState,
  LabUserReport,
} from "../models/lab-types.js";
import { normalizeLabPreflight } from "../services/preflight-service.js";
import {
  freezeAnalysisScope,
  normalizeAnalysisReference,
  normalizeAnalysisScope,
} from "../shared/types/analysis-scope.js";

function createDefaultSourceDrafts(): LabSourceDrafts {
  return {
    fileNameHint: "",
    urlInput: "",
    youtubeUrl: "",
    youtubePreset: null,
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

function createInitialState(): LabStoreState {
  return {
    currentStage: "source",
    featureId: "media-analysis",
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
    profileModels: [],
    toolState: {},
    activityFeed: [],
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
      moduleManagerOpen: false,
      toolManagerOpen: false,
      eventFeedExpanded: false,
      eventFeedCursor: 0,
      artifactListExpanded: false,
      artifactRenderCount: 12,
      reportView: "user",
      lastHydratedProjectId: null,
      activePreviewArtifactId: null,
      liveFindingsExpanded: true,
      analysisControlsCollapsed: true,
    },
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
    timestamp: Date.now(),
    source: "ui",
    action: null,
    stage: null,
    scope,
    moduleId: null,
    rawLine: null,
  };
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
  return {
    id: asNonEmptyString(record["id"]) || createLabEventId("event"),
    kind: asNonEmptyString(record["kind"]) || "activity",
    severity:
      severity === "success" || severity === "warning" || severity === "error" ? severity : "info",
    message,
    detail: asNonEmptyString(record["detail"]),
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
    throttleWindow: asNonEmptyString(record["throttleWindow"]),
  };
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
  const liveFindings = (Array.isArray(processRecord["liveFindings"])
    ? processRecord["liveFindings"]
    : []
  )
    .map(toLiveFindingProjection)
    .filter((entry): entry is LabLiveFindingProjection => entry !== null);
  const previewArtifacts = (Array.isArray(processRecord["previewArtifacts"])
    ? processRecord["previewArtifacts"]
    : []
  )
    .map(toPreviewArtifactProjection)
    .filter((entry): entry is LabPreviewArtifactProjection => entry !== null);
  const moduleTrace = (Array.isArray(processRecord["moduleTrace"]) ? processRecord["moduleTrace"] : [])
    .map(toModuleTraceEntry)
    .filter((entry): entry is LabModuleTraceEntry => entry !== null);
  const comparisonVariants = (Array.isArray(processRecord["comparisonVariants"])
    ? processRecord["comparisonVariants"]
    : []
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
      asNonEmptyString(asLabRecord(normalizeAnalysisScope(processRecord["analysisScope"]))["hypothesis"]),
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
    state.ui.sourceDrafts = {
      fileNameHint: asNonEmptyString(sourceDrafts["fileNameHint"]) || "",
      urlInput: asNonEmptyString(sourceDrafts["urlInput"]) || "",
      youtubeUrl: asNonEmptyString(sourceDrafts["youtubeUrl"]) || "",
      youtubePreset: asNonEmptyString(sourceDrafts["youtubePreset"]),
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
        : index === 0 && variants.every(function (candidate) {
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
  const nextVariantIds = new Set(nextVariants.map(function (entry) {
    return entry.id;
  }));
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

function syncCanonicalStateFromSnapshot(
  state: LabStoreState,
  snapshot: Record<string, unknown>,
  options: { preserveFeatureId?: boolean } = {}
) {
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
  state.ui.liveFindingsExpanded = asNonEmptyString(state.workbench["activeLiveFindingsStreamId"]) !== null;
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
    state.sourceProbeStatus = state.sourceProbeStatus === "running" ? "running" : "idle";
    state.ui.lastHydratedProjectId = null;
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
  state.run = toRunFromProcessRecord(asLabRecord(processRecord));

  const reportRecord = asLabRecord(
    asLabRecord(asLabRecord(activeProject["report"])["records"])[state.featureId]
  );
  state.reports = toReportsFromRecord(reportRecord);
  state.reportExports = Array.isArray(reportRecord["exports"])
    ? (reportRecord["exports"] as unknown[]).map(asLabRecord)
    : [];

  syncDraftsFromSnapshot(state, snapshot);
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
          asLabRecord(normalizeAnalysisScope(asLabRecord(state.workbench)["analysisScope"]))["hypothesis"]
        ) || null,
    };
  state.run = nextRun;
  return nextRun;
}

function reduceEvent(state: LabStoreState, event: LabStoreEvent): LabStoreState {
  switch (event.type) {
    case "hydrate":
      if (event.payload) {
        state.persisted = event.payload as LabPersistedState;
        state.currentStage = normalizeLabStage(event.payload.currentStage, state.currentStage);
        state.featureId = normalizeLabFeatureId(event.payload.featureId, state.featureId);
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
      return state;
    case "source-probe-progress":
      state.sourceProbeStatus = "running";
      return state;
    case "source-probe-completed":
      state.sourceProbeStatus = "completed";
      return state;
    case "source-probe-failed":
      state.sourceProbeStatus = "failed";
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
      state.ui.activePreviewArtifactId = asNonEmptyString(state.workbench["activePreviewArtifactId"]);
      state.ui.analysisControlsCollapsed = state.workbench["controlsCollapsed"] === true;
      state.ui.liveFindingsExpanded = asNonEmptyString(state.workbench["activeLiveFindingsStreamId"]) !== null;
      return state;
    case "source-config-patched":
      state.source = {
        ...(state.source || {}),
        ...asLabRecord(event.patch),
      };
      return state;
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
    case "module-manager-toggled":
      state.ui.moduleManagerOpen =
        typeof event.open === "boolean" ? event.open : !state.ui.moduleManagerOpen;
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
    case "push-event":
      routeFeedEvent(state, event.event);
      return state;
    case "clear-events":
      state.activityFeed = [createSnapshotEvent("Olay akisi temizlendi.", "info")];
      state.ui.eventFeedCursor = 0;
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
