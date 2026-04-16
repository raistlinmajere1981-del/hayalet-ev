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
  toTimestamp
} from "../models/lab-types.js";
import { normalizeLabPreflight } from "../services/preflight-service.js";
function createDefaultSourceDrafts() {
  return {
    fileNameHint: "",
    urlInput: "",
    youtubeUrl: "",
    youtubePreset: null
  };
}
function createInitialState() {
  return {
    currentStage: "source",
    featureId: "media-analysis",
    bootReady: false,
    roomReadySent: false,
    context: {},
    snapshot: null,
    projectIndex: {
      activeProjectId: null,
      projects: []
    },
    workbench: {},
    source: null,
    sourceProbeStatus: "idle",
    editConfig: null,
    profileConfig: null,
    preflight: null,
    run: null,
    reports: {
      user: null,
      ai: null
    },
    reportExports: [],
    profileModels: [],
    toolState: {},
    eventFeed: [],
    persisted: null,
    ui: {
      sourceDrafts: createDefaultSourceDrafts(),
      editDrafts: {
        outputNameHint: "",
        notes: "",
        activeSourceRef: "original",
        advancedOpen: false
      },
      profileDrafts: {
        sensitivity: null,
        transcriptSampleSeconds: null,
        depth: "balanced",
        frameSampleDensity: "balanced"
      },
      sourceDraftDirty: false,
      editDraftDirty: false,
      profileDraftDirty: false,
      eventFeedExpanded: false,
      eventFeedCursor: 0,
      artifactListExpanded: false,
      artifactRenderCount: 12,
      reportView: "user",
      lastHydratedProjectId: null
    }
  };
}
function createSnapshotEvent(message, severity, detail = null) {
  return {
    id: createLabEventId("ui"),
    kind: "ui",
    severity,
    message,
    detail,
    timestamp: Date.now(),
    source: "ui",
    action: null,
    stage: null
  };
}
function toArtifactProjection(value) {
  const record = asLabRecord(value);
  const id = asNonEmptyString(record["id"]);
  if (id === null) {
    return null;
  }
  return {
    id,
    kind: asNonEmptyString(record["kind"]) || "artifact",
    path: asNonEmptyString(record["path"]),
    fileName: asNonEmptyString(record["fileName"]),
    previewUrl: asNonEmptyString(record["previewUrl"]) || asNonEmptyString(record["fileUrl"]),
    createdAt: asNonEmptyString(record["createdAt"])
  };
}
function toFindingProjection(value) {
  const record = asLabRecord(value);
  const id = asNonEmptyString(record["id"]);
  if (id === null) {
    return null;
  }
  return {
    id,
    moduleId: asNonEmptyString(record["moduleId"]),
    title: asNonEmptyString(record["title"]) || "Bulgu",
    detail: asNonEmptyString(record["detail"]) || "",
    level: asNonEmptyString(record["level"]) || "low",
    confidence: asNonEmptyString(record["confidence"]) || "low",
    kind: normalizeFindingKind(record["kind"]),
    evidenceCount: Math.max(0, Math.round(asNumber(record["evidenceCount"]) || 0)),
    artifactIds: asStringArray(record["artifactIds"])
  };
}
function toModuleState(value) {
  const record = asLabRecord(value);
  const id = asNonEmptyString(record["id"]);
  if (id === null) {
    return null;
  }
  return {
    id,
    status: asNonEmptyString(record["status"]) || "idle",
    startedAt: asNonEmptyString(record["startedAt"]),
    endedAt: asNonEmptyString(record["completedAt"]),
    progress: clampPercent(record["percent"]),
    message: asNonEmptyString(record["message"]),
    title: asNonEmptyString(record["title"]) || asNonEmptyString(record["label"]),
    summary: asNonEmptyString(record["summary"]),
    findingIds: asStringArray(record["findingIds"]),
    artifactIds: asStringArray(record["artifactIds"])
  };
}
function toRunFromProcessRecord(processRecord, eventFeed) {
  const runId = asNonEmptyString(processRecord["runId"]);
  if (runId === null) {
    return null;
  }
  const modules = Array.isArray(processRecord["modules"]) ? processRecord["modules"] : [];
  const moduleMap = {};
  const moduleOrder = [];
  modules.forEach(function(entry) {
    const nextModule = toModuleState(entry);
    if (!nextModule) {
      return;
    }
    moduleMap[nextModule.id] = nextModule;
    moduleOrder.push(nextModule.id);
  });
  const findings = (Array.isArray(processRecord["findings"]) ? processRecord["findings"] : []).map(toFindingProjection).filter((entry) => entry !== null);
  const artifacts = (Array.isArray(processRecord["artifacts"]) ? processRecord["artifacts"] : []).map(toArtifactProjection).filter((entry) => entry !== null);
  const endedAt = asNonEmptyString(processRecord["completedAt"]);
  return {
    id: runId,
    state: asNonEmptyString(processRecord["status"]) || "idle",
    startedAt: toTimestamp(processRecord["startedAt"]),
    ...endedAt ? { endedAt: toTimestamp(endedAt) } : {},
    modules: moduleMap,
    moduleOrder,
    events: eventFeed.slice(),
    artifacts,
    findings,
    warnings: asStringArray(processRecord["warnings"]),
    error: asNonEmptyString(processRecord["error"]),
    targetLabel: asNonEmptyString(asLabRecord(processRecord["targetSummary"])["label"]),
    progress: clampPercent(processRecord["percent"])
  };
}
function toReportsFromRecord(reportRecord) {
  const userRecord = asLabRecord(reportRecord["userReport"]);
  const aiRecord = asLabRecord(reportRecord["aiReport"]);
  return {
    user: asNonEmptyString(userRecord["summary"]) !== null ? userRecord : null,
    ai: aiRecord["manifest"] !== void 0 ? aiRecord : null
  };
}
function syncDraftsFromSnapshot(state, snapshot) {
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
      youtubePreset: asNonEmptyString(sourceDrafts["youtubePreset"])
    };
  }
  const edit = asLabRecord(activeProject["edit"]);
  const recipeCommon = asLabRecord(asLabRecord(edit["recipe"])["common"]);
  if (state.ui.editDraftDirty !== true || state.ui.lastHydratedProjectId !== activeProjectId) {
    state.ui.editDrafts = {
      ...state.ui.editDrafts,
      outputNameHint: asNonEmptyString(recipeCommon["outputNameHint"]) || "",
      notes: asNonEmptyString(recipeCommon["notes"]) || "",
      activeSourceRef: asNonEmptyString(asLabRecord(edit["preview"])["status"]) === "ready" && asNonEmptyString(edit["handoffMode"]) === "derived" ? "preview" : "original"
    };
  }
  const profile = asLabRecord(activeProject["profile"]);
  if (state.ui.profileDraftDirty !== true || state.ui.lastHydratedProjectId !== activeProjectId) {
    state.ui.profileDrafts = {
      sensitivity: typeof profile["sensitivity"] === "number" ? profile["sensitivity"] : null,
      transcriptSampleSeconds: typeof profile["transcriptSampleSeconds"] === "number" ? profile["transcriptSampleSeconds"] : null,
      depth: asNonEmptyString(profile["depth"]) || "balanced",
      frameSampleDensity: asNonEmptyString(profile["frameSampleDensity"]) || "balanced"
    };
  }
  state.ui.lastHydratedProjectId = activeProjectId;
  return state;
}
function pushEvent(state, event) {
  state.eventFeed.unshift(event);
  if (state.eventFeed.length > 260) {
    state.eventFeed.length = 260;
  }
  if (state.run) {
    state.run.events = state.eventFeed.slice();
  }
}
function deriveProbeStatus(source, fallback) {
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
function syncCanonicalStateFromSnapshot(state, snapshot, options = {}) {
  state.snapshot = snapshot;
  state.bootReady = snapshot["ready"] === true || state.bootReady;
  if (options.preserveFeatureId !== true) {
    state.featureId = normalizeLabFeatureId(snapshot["featureId"], state.featureId);
  }
  state.projectIndex = {
    activeProjectId: asNonEmptyString(snapshot["activeProjectId"]),
    projects: Array.isArray(snapshot["projects"]) ? snapshot["projects"].map(asLabRecord) : []
  };
  state.workbench = asLabRecord(snapshot["workbench"]);
  state.profileModels = Array.isArray(snapshot["profileModels"]) ? snapshot["profileModels"].map(asLabRecord) : [];
  state.toolState = asLabRecord(snapshot["toolState"]);
  const activeProject = asLabRecord(snapshot["activeProject"]);
  if (Object.keys(activeProject).length === 0) {
    state.source = null;
    state.editConfig = null;
    state.profileConfig = null;
    state.preflight = null;
    state.run = null;
    state.reports = {
      user: null,
      ai: null
    };
    state.reportExports = [];
    state.sourceProbeStatus = state.sourceProbeStatus === "running" ? "running" : "idle";
    state.ui.lastHydratedProjectId = null;
    return state;
  }
  state.source = asLabRecord(activeProject["source"]);
  state.editConfig = asLabRecord(activeProject["edit"]);
  state.profileConfig = asLabRecord(activeProject["profile"]);
  state.preflight = normalizeLabPreflight(state.profileConfig);
  state.sourceProbeStatus = deriveProbeStatus(state.source, state.sourceProbeStatus);
  const processRecord = asLabRecord(asLabRecord(activeProject["process"])["records"])[state.featureId];
  state.run = toRunFromProcessRecord(asLabRecord(processRecord), state.eventFeed);
  const reportRecord = asLabRecord(
    asLabRecord(asLabRecord(activeProject["report"])["records"])[state.featureId]
  );
  state.reports = toReportsFromRecord(reportRecord);
  state.reportExports = Array.isArray(reportRecord["exports"]) ? reportRecord["exports"].map(asLabRecord) : [];
  syncDraftsFromSnapshot(state, snapshot);
  return state;
}
function sanitizeHydratedRun(run) {
  if (!run) {
    return null;
  }
  const nextRun = structuredClone(run);
  if (nextRun.state === "running" || nextRun.state === "queued") {
    nextRun.state = "cancelled";
    const endedAt = nextRun.endedAt || Date.now();
    nextRun.endedAt = endedAt;
    nextRun.moduleOrder.forEach(function(moduleId) {
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
  nextRun.events = Array.isArray(nextRun.events) ? nextRun.events : [];
  return nextRun;
}
function ensurePendingRun(state, action) {
  if (state.run) {
    return state.run;
  }
  const nextRun = {
    id: `pending-${action}-${Date.now()}`,
    state: "running",
    startedAt: Date.now(),
    modules: {},
    moduleOrder: [],
    events: state.eventFeed.slice(),
    artifacts: [],
    findings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: null
  };
  state.run = nextRun;
  return nextRun;
}
function reduceEvent(state, event) {
  switch (event.type) {
    case "hydrate":
      if (event.payload) {
        state.persisted = event.payload;
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
        state.preflight = event.payload.preflight || null;
        state.run = sanitizeHydratedRun(event.payload.lastRun);
        state.reports = event.payload.reports || state.reports;
        state.reportExports = Array.isArray(event.payload.reportExports) ? event.payload.reportExports : [];
        state.profileModels = Array.isArray(event.payload.profileModels) ? event.payload.profileModels : [];
        state.toolState = asLabRecord(event.payload.toolState);
        state.ui.sourceDrafts = {
          ...state.ui.sourceDrafts,
          ...event.payload.sourceDrafts || {}
        };
        state.ui.editDrafts = {
          ...state.ui.editDrafts,
          ...event.payload.editDrafts || {}
        };
        state.ui.profileDrafts = {
          ...state.ui.profileDrafts,
          ...event.payload.profileDrafts || {}
        };
        state.ui.reportView = event.payload.reportView || state.ui.reportView;
        state.ui.eventFeedExpanded = event.payload.eventFeedExpanded === true;
        state.ui.eventFeedCursor = Math.max(0, Math.round(event.payload.eventFeedCursor || 0));
        state.ui.artifactListExpanded = event.payload.artifactListExpanded === true;
        state.ui.artifactRenderCount = Math.max(
          12,
          Math.round(event.payload.artifactRenderCount || state.ui.artifactRenderCount)
        );
        state.bootReady = state.bootReady || state.source !== null || state.run !== null || state.reports.user !== null || state.reports.ai !== null;
      }
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
        pushEvent(state, event.event);
      }
      return state;
    case "request-result-received":
      if (event.event) {
        pushEvent(state, event.event);
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
          preview
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
          preview
        };
      }
      return state;
    case "preview-failed":
      if (state.editConfig) {
        const preview = asLabRecord(state.editConfig["preview"]);
        preview["status"] = "failed";
        state.editConfig = {
          ...state.editConfig,
          preview
        };
      }
      return state;
    case "preflight-started":
      state.preflight = {
        ...state.preflight || normalizeLabPreflight(state.profileConfig),
        rawStatus: "running"
      };
      return state;
    case "preflight-completed":
      state.preflight = normalizeLabPreflight(state.profileConfig);
      return state;
    case "preflight-failed":
      state.preflight = {
        ...state.preflight || normalizeLabPreflight(state.profileConfig),
        status: "blocked",
        rawStatus: "failed",
        stageReady: false
      };
      return state;
    case "run-started":
      ensurePendingRun(state, event.action).state = "running";
      return state;
    case "run-cancelled":
      if (state.run) {
        state.run.state = "cancelled";
        state.run.endedAt = state.run.endedAt || Date.now();
        const activeModuleId = state.run.moduleOrder.find(function(moduleId) {
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
          progress: null
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
        }
      } else if (event.type === "module-finished") {
        module.status = "completed";
        module.progress = 100;
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
    case "source-drafts-updated":
      state.ui.sourceDrafts = {
        ...state.ui.sourceDrafts,
        ...event.patch
      };
      state.ui.sourceDraftDirty = true;
      return state;
    case "source-drafts-committed":
      state.ui.sourceDraftDirty = false;
      return state;
    case "edit-drafts-updated":
      state.ui.editDrafts = {
        ...state.ui.editDrafts,
        ...event.patch
      };
      state.ui.editDraftDirty = true;
      return state;
    case "edit-drafts-committed":
      state.ui.editDraftDirty = false;
      return state;
    case "profile-drafts-updated":
      state.ui.profileDrafts = {
        ...state.ui.profileDrafts,
        ...event.patch
      };
      state.ui.profileDraftDirty = true;
      return state;
    case "profile-drafts-committed":
      state.ui.profileDraftDirty = false;
      return state;
    case "toggle-event-feed":
      state.ui.eventFeedExpanded = typeof event.force === "boolean" ? event.force : !state.ui.eventFeedExpanded;
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
      state.ui.artifactListExpanded = typeof event.force === "boolean" ? event.force : !state.ui.artifactListExpanded;
      state.ui.artifactRenderCount = state.ui.artifactListExpanded ? Math.max(24, state.ui.artifactRenderCount) : 12;
      return state;
    case "show-more-artifacts":
      state.ui.artifactListExpanded = true;
      state.ui.artifactRenderCount += 24;
      return state;
    case "report-view-changed":
      state.ui.reportView = event.view;
      return state;
    case "push-event":
      pushEvent(state, event.event);
      return state;
    case "clear-events":
      state.eventFeed = [createSnapshotEvent("Olay akisi temizlendi.", "info")];
      if (state.run) {
        state.run.events = state.eventFeed.slice();
      }
      state.ui.eventFeedCursor = 0;
      return state;
    default:
      return state;
  }
}
export function createLabStore() {
  let state = createInitialState();
  const listeners = /* @__PURE__ */ new Set();
  function getState() {
    return state;
  }
  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }
  function dispatch(event) {
    state = reduceEvent(structuredClone(state), event);
    listeners.forEach(function(listener) {
      listener(state);
    });
  }
  return {
    dispatch,
    getState,
    subscribe
  };
}
