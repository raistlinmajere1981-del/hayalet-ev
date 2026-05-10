import { asLabRecord, asNonEmptyString } from "../../models/lab-types.js";
import type {
  LabArtifactProjection,
  LabComparisonVariant,
  LabEventFeedItem,
  LabLiveFindingProjection,
  LabModuleTraceEntry,
  LabPersistedState,
  LabPreviewArtifactProjection,
  LabRun,
  LabStoreState,
} from "../../models/lab-types.js";
import { freezeAnalysisScope, normalizeAnalysisScope } from "../../shared/types/analysis-scope.js";
import {
  toComparisonVariant,
  toEventFeedItem,
  toLiveFindingProjection,
  toModuleTraceEntry,
  toPreviewArtifactProjection,
} from "./lab-store-host-records.js";

function pushActivityEvent(state: LabStoreState, event: LabEventFeedItem) {
  state.activityFeed.unshift({
    ...event,
    scope: "global",
  });
  if (state.activityFeed.length > 260) {
    state.activityFeed.length = 260;
  }
}

function isProcessRunAction(action: string | null | undefined) {
  return action === "process-run" || action === "audio-process-run";
}

function canCreatePendingRunFromFeedEvent(event: LabEventFeedItem) {
  if (!isProcessRunAction(event.action)) {
    return false;
  }
  if (
    event.moduleId !== null &&
    event.moduleId !== undefined &&
    (event.stage === "completed" || event.stage === "failed" || event.stage === "cancelled")
  ) {
    return false;
  }
  return true;
}

function isPendingProcessRun(run: LabRun) {
  return (
    run.id.startsWith("pending-process-run-") || run.id.startsWith("pending-audio-process-run-")
  );
}

export function shouldKeepPendingRunDuringSnapshot(state: LabStoreState, nextRun: LabRun | null) {
  if (
    state.run === null ||
    isPendingProcessRun(state.run) !== true ||
    (state.run.state !== "running" && state.run.state !== "queued")
  ) {
    return false;
  }

  if (nextRun === null) {
    return true;
  }

  if (nextRun.state === "running" || nextRun.state === "queued") {
    return false;
  }

  if (state.ui.analysisCancelPending === true && nextRun.state === "cancelled") {
    return false;
  }

  return true;
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

export function syncActivePreviewArtifact(
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

export function syncRunAugmentationsFromHostEvent(state: LabStoreState, event: LabEventFeedItem) {
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
    const hadRun = state.run !== null;
    upsertRunPreviewArtifact(state, event, { finalArtifact: true });
    if (hadRun !== true && event.stage === "completed" && state.run !== null) {
      state.run.state = "completed";
      state.run.endedAt = state.run.endedAt || Date.now();
    }
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

export function routeFeedEvent(state: LabStoreState, event: LabEventFeedItem) {
  if (event.scope === "run") {
    if (state.run === null && canCreatePendingRunFromFeedEvent(event) !== true) {
      pushActivityEvent(state, event);
      return;
    }
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

export function sanitizeHydratedRun(run: LabPersistedState["lastRun"] | undefined) {
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

export function ensurePendingRun(state: LabStoreState, action: string) {
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

export function isRunMutationLocked(state: LabStoreState) {
  return state.run !== null && (state.run.state === "running" || state.run.state === "queued");
}
