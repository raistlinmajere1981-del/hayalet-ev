import {
  asLabRecord,
  asNonEmptyString,
  createLabFeatureMeta,
} from "../models/lab-types.js";
import type {
  LabFeatureId,
  LabPreflightResult,
  LabRecord,
  LabReportSet,
  LabRun,
  LabStage,
  LabStoreState,
} from "../models/lab-types.js";
import { runPreflight } from "../services/preflight-service.js";

export function getSnapshot(state: LabStoreState): LabRecord {
  return state.snapshot || {};
}

export function getActiveProject(state: LabStoreState): LabRecord | null {
  const snapshotProject = asLabRecord(getSnapshot(state)["activeProject"]);
  if (Object.keys(snapshotProject).length > 0) {
    return snapshotProject;
  }
  if (state.source || state.editConfig || state.profileConfig) {
    return {
      id: state.projectIndex.activeProjectId,
      source: state.source,
      edit: state.editConfig,
      profile: state.profileConfig,
    };
  }
  return null;
}

export function getProjects(state: LabStoreState): LabRecord[] {
  return state.projectIndex.projects;
}

export function getCurrentFeatureId(state: LabStoreState): LabFeatureId {
  const activeModuleId = asNonEmptyString(state.workbench["activeModuleId"]);
  return (activeModuleId as LabFeatureId) || state.featureId;
}

export function getCurrentFeatureMeta(state: LabStoreState) {
  return createLabFeatureMeta(getCurrentFeatureId(state));
}

export function getProjectSource(state: LabStoreState): LabRecord {
  return asLabRecord(state.source);
}

export function getProjectEdit(state: LabStoreState): LabRecord {
  return asLabRecord(state.editConfig);
}

export function getProjectProfile(state: LabStoreState): LabRecord {
  return asLabRecord(state.profileConfig);
}

export function getCurrentFeatureProcessRecord(state: LabStoreState): LabRecord {
  const activeProject = getActiveProject(state);
  if (!activeProject) {
    return {};
  }
  const process = asLabRecord(activeProject["process"]);
  return asLabRecord(asLabRecord(process["records"])[getCurrentFeatureId(state)]);
}

export function getCurrentFeatureReportRecord(state: LabStoreState): LabRecord {
  const activeProject = getActiveProject(state);
  if (!activeProject) {
    return {};
  }
  const report = asLabRecord(activeProject["report"]);
  return asLabRecord(asLabRecord(report["records"])[getCurrentFeatureId(state)]);
}

export function getCurrentPreflight(state: LabStoreState): LabPreflightResult {
  return state.preflight || runPreflight(getProjectProfile(state), getProjectSource(state));
}

export function getCurrentRun(state: LabStoreState): LabRun | null {
  return state.run;
}

export function getCurrentReports(state: LabStoreState): LabReportSet {
  return state.reports;
}

export function getWorkbench(state: LabStoreState): LabRecord {
  return state.workbench;
}

export function getSourceProbeStatus(state: LabStoreState) {
  return state.sourceProbeStatus;
}

export function getSourceStatus(state: LabStoreState): string {
  return asNonEmptyString(getProjectSource(state)["status"]) || "idle";
}

export function getSourceMode(state: LabStoreState): string {
  return asNonEmptyString(getProjectSource(state)["mode"]) || "local";
}

export function getSourceKind(state: LabStoreState): string {
  return asNonEmptyString(getProjectSource(state)["kind"]) || "video";
}

export function getSourceMetadata(state: LabStoreState): LabRecord {
  return asLabRecord(getProjectSource(state)["metadata"]);
}

export function getEditPreview(state: LabStoreState): LabRecord {
  return asLabRecord(getProjectEdit(state)["preview"]);
}

export function getEditOutputs(state: LabStoreState): LabRecord[] {
  const outputs = getProjectEdit(state)["outputs"];
  return Array.isArray(outputs) ? outputs.map(asLabRecord) : [];
}

export function getActiveEditOutput(state: LabStoreState): LabRecord | null {
  const activeOutputId = asNonEmptyString(getProjectEdit(state)["activeOutputId"]);
  if (activeOutputId === null) {
    return null;
  }

  return (
    getEditOutputs(state).find(function (entry) {
      return asNonEmptyString(entry["id"]) === activeOutputId;
    }) || null
  );
}

export function getReportExports(state: LabStoreState): LabRecord[] {
  return state.reportExports;
}

export function getProfileModelCatalog(state: LabStoreState): LabRecord[] {
  return state.profileModels;
}

export function getSelectedProfileModel(state: LabStoreState): LabRecord | null {
  const profile = getProjectProfile(state);
  const modelId = asNonEmptyString(profile["modelId"]);
  if (modelId === null) {
    return null;
  }

  return (
    getProfileModelCatalog(state).find(function (entry) {
      return asNonEmptyString(entry["id"]) === modelId;
    }) || null
  );
}

export function getToolState(state: LabStoreState): LabRecord {
  return state.toolState;
}

export function getFeatureCompatibility(state: LabStoreState) {
  const featureId = getCurrentFeatureId(state);
  const sourceReady = state.source !== null && state.sourceProbeStatus === "completed";
  const availableModules = Array.isArray(state.workbench["availableModuleIds"])
    ? (state.workbench["availableModuleIds"] as unknown[]).filter((entry): entry is string => typeof entry === "string")
    : Array.isArray(state.workbench["selectedModuleIds"])
      ? (state.workbench["selectedModuleIds"] as unknown[]).filter((entry): entry is string => typeof entry === "string")
      : [featureId];
  const sourceKind = getSourceKind(state);
  const sourceMode = getSourceMode(state);
  return {
    featureId,
    mediaReady: sourceReady && availableModules.includes("media-analysis"),
    audioReady:
      sourceReady &&
      availableModules.includes("audio-analysis") &&
      (sourceKind === "audio" || sourceKind === "video"),
    subtitleReady:
      availableModules.includes("subtitle-analysis") &&
      (sourceReady || sourceMode === "url" || sourceMode === "youtube"),
  };
}

export function getStageBlockReason(state: LabStoreState, stage: LabStage): string | null {
  const source = getProjectSource(state);
  const preflight = getCurrentPreflight(state);
  const reports = getCurrentReports(state);
  const reportStatus = asNonEmptyString(getCurrentFeatureReportRecord(state)["status"]);
  const probeStatus = getSourceProbeStatus(state);

  if (stage === "source") {
    return null;
  }
  if (stage === "edit" || stage === "profile") {
    if (Object.keys(source).length === 0) {
      return "Önce kaynak seçilmelidir.";
    }
    if (probeStatus === "running") {
      return "Kaynak probe işlemi tamamlanmadı.";
    }
    if (probeStatus === "failed") {
      return "Kaynak probe hata verdi.";
    }
    if (probeStatus !== "completed") {
      return "Kaynak probe tamamlanmalı.";
    }
    return null;
  }
  if (stage === "process") {
    if (probeStatus !== "completed") {
      return "Analizden önce kaynak probe tamamlanmalı.";
    }
    if (preflight.status === "blocked") {
      if (preflight.missingDependencies.length > 0) {
        return `Eksik dependency: ${preflight.missingDependencies.join(", ")}`;
      }
      return "Ön kontrol bu aşamayı blokladı.";
    }
    if (preflight.stageReady !== true) {
      return "Ön kontrol henüz hazır değil.";
    }
    return null;
  }
  if (stage === "report") {
    if (
      reports.user !== null ||
      reports.ai !== null ||
      reportStatus === "ready" ||
      reportStatus === "stale"
    ) {
      return null;
    }
    return "Rapor henüz üretilmedi.";
  }
  return "Bu aşama henüz hazır değil.";
}

export function canAdvanceToStage(state: LabStoreState, stage: LabStage) {
  return getStageBlockReason(state, stage) === null;
}

export function getPrimaryActionLabel(state: LabStoreState, stage: LabStage) {
  const sourceProbeStatus = getSourceProbeStatus(state);
  const edit = getProjectEdit(state);
  const run = getCurrentRun(state);
  switch (stage) {
    case "source":
      return sourceProbeStatus === "completed" ? "Kaynağı Yenile" : "Kaynağı Hazırla";
    case "edit":
      return asNonEmptyString(asLabRecord(edit["preview"])["status"]) === "ready"
        ? "Önizlemeyi Yenile"
        : "Önizleme Üret";
    case "profile":
      return "Ön Kontrol Çalıştır";
    case "process":
      return run && run.state === "running" ? "Çalışmayı İptal Et" : "Analizi Başlat";
    case "report":
      return "Raporları Dışa Aktar";
    default:
      return "Devam";
  }
}

export function getVisibleEvents(state: LabStoreState) {
  const feed = state.eventFeed.slice().sort(function (left, right) {
    return right.timestamp - left.timestamp;
  });
  const windowSize = state.ui.eventFeedExpanded ? 40 : 18;
  const windowStart = state.ui.eventFeedExpanded ? state.ui.eventFeedCursor : 0;
  return feed.slice(windowStart, windowStart + windowSize);
}

export function hasMoreVisibleEvents(state: LabStoreState) {
  const windowSize = state.ui.eventFeedExpanded ? 40 : 18;
  const windowStart = state.ui.eventFeedExpanded ? state.ui.eventFeedCursor : 0;
  return state.eventFeed.length > windowStart + windowSize;
}

export function getVisibleEventOffset(state: LabStoreState) {
  return state.ui.eventFeedExpanded ? state.ui.eventFeedCursor : 0;
}

export function getVisibleArtifacts(state: LabStoreState) {
  const run = getCurrentRun(state);
  const artifacts = run ? run.artifacts : [];
  if (!state.ui.artifactListExpanded) {
    return artifacts.slice(0, 12);
  }
  return artifacts.slice(0, state.ui.artifactRenderCount);
}

export function hasMoreVisibleArtifacts(state: LabStoreState) {
  const run = getCurrentRun(state);
  const artifacts = run ? run.artifacts : [];
  return artifacts.length > getVisibleArtifacts(state).length;
}
