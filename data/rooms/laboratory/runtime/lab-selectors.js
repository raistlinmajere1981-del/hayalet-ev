import { asLabRecord, asNonEmptyString, createLabFeatureMeta } from "../models/lab-types.js";
import { CAPABILITY_FAMILIES, WORKSPACE_INTENTS } from "../models/lab-types.js";
import { normalizeAnalysisScope } from "../shared/types/analysis-scope.js";
import { LAB_USER_ACTION_HISTORY_LIMIT } from "./lab-user-actions.js";
function normalizeIntentIdList(value) {
  const sourceIds = Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  return WORKSPACE_INTENTS.map(function(intent) {
    return intent.id;
  }).filter(function(intentId, index, allIntentIds) {
    return sourceIds.includes(intentId) && allIntentIds.indexOf(intentId) === index;
  });
}
function getEffectiveSelectedCapabilities(state) {
  const intentDerivedCapabilities = getIntentDerivedCapabilities(state);
  if (intentDerivedCapabilities.length > 0) {
    return intentDerivedCapabilities;
  }
  return getSelectedCapabilities(state);
}
export function getSnapshot(state) {
  return state.snapshot || {};
}
export function getActiveProject(state) {
  const snapshotProject = asLabRecord(getSnapshot(state)["activeProject"]);
  if (Object.keys(snapshotProject).length > 0) {
    return snapshotProject;
  }
  if (state.source || state.editConfig || state.profileConfig) {
    return {
      id: state.projectIndex.activeProjectId,
      source: state.source,
      edit: state.editConfig,
      profile: state.profileConfig
    };
  }
  return null;
}
export function getProjects(state) {
  return state.projectIndex.projects;
}
export function getCurrentFeatureId(state) {
  const activeModuleId = asNonEmptyString(state.workbench["activeModuleId"]);
  const featureId = activeModuleId || state.featureId;
  return featureId === "subtitle-analysis" ? "audio-analysis" : featureId;
}
export function getCurrentFeatureMeta(state) {
  return createLabFeatureMeta(getCurrentFeatureId(state));
}
export function getProjectSource(state) {
  return asLabRecord(state.source);
}
export function getProjectEdit(state) {
  return asLabRecord(state.editConfig);
}
export function getProjectProfile(state) {
  return asLabRecord(state.profileConfig);
}
export function getCurrentFeatureProcessRecord(state) {
  const activeProject = getActiveProject(state);
  if (!activeProject) {
    return {};
  }
  const process = asLabRecord(activeProject["process"]);
  return asLabRecord(asLabRecord(process["records"])[getCurrentFeatureId(state)]);
}
export function getCurrentFeatureReportRecord(state) {
  const activeProject = getActiveProject(state);
  if (!activeProject) {
    return {};
  }
  const report = asLabRecord(activeProject["report"]);
  return asLabRecord(asLabRecord(report["records"])[getCurrentFeatureId(state)]);
}
export function getCurrentPreflight(state) {
  const source = getProjectSource(state);
  if (Object.keys(source).length === 0) {
    return {
      status: "idle",
      missingDependencies: [],
      warnings: [],
      estimatedRuntime: null,
      enabledModules: [],
      stageReady: false,
      rawStatus: null,
      reason: "Önce kaynak seçilmelidir."
    };
  }
  if (state.sourceProbeStatus !== "completed") {
    return {
      status: "idle",
      missingDependencies: [],
      warnings: [],
      estimatedRuntime: null,
      enabledModules: [],
      stageReady: false,
      rawStatus: null,
      reason: "Kaynak probe tamamlanmadan ön kontrol doğrulanamaz."
    };
  }
  const selectedCapabilities = getEffectiveSelectedCapabilities(state);
  if (selectedCapabilities.length === 0) {
    return {
      status: "blocked",
      missingDependencies: [],
      warnings: [],
      estimatedRuntime: null,
      enabledModules: [],
      stageReady: false,
      rawStatus: null,
      reason: "Önce en az bir yetenek ailesi seçilmelidir."
    };
  }
  const selectedEntries = getAvailableCapabilities(state).filter(function(entry) {
    return selectedCapabilities.includes(entry.id);
  });
  const blockedEntries = selectedEntries.filter(function(entry) {
    return entry.readiness === "blocked";
  });
  const warningEntries = selectedEntries.filter(function(entry) {
    return entry.readiness === "optional";
  });
  const missingDependencies = blockedEntries.map(function(entry) {
    return entry.label;
  });
  const warnings = warningEntries.map(function(entry) {
    return entry.blockReason || `${entry.label} kısmi hazırlıkta.`;
  });
  const hostPreflight = state.preflight;
  const stageReady = blockedEntries.length === 0 && selectedEntries.length > 0;
  return {
    status: stageReady !== true ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    missingDependencies,
    warnings: hostPreflight && hostPreflight.warnings.length > 0 ? Array.from(new Set(hostPreflight.warnings.concat(warnings))) : warnings,
    estimatedRuntime: hostPreflight?.estimatedRuntime || Math.max(60, Math.round(selectedEntries.length * 75)),
    enabledModules: Array.isArray(selectedCapabilities) ? selectedCapabilities.slice() : [],
    stageReady,
    rawStatus: hostPreflight?.rawStatus || null,
    reason: stageReady !== true ? blockedEntries[0]?.blockReason || "Seçili yetenekler henüz hazır değil." : warnings.length > 0 ? "Araç uyarıları var ama işlem başlatılabilir." : null
  };
}
export function getCurrentRun(state) {
  return state.run;
}
export function getRunSnapshotSummary(state) {
  const run = getCurrentRun(state);
  if (!run || !run.analysisScope) {
    return null;
  }
  const scope = run.analysisScope;
  return {
    focus: typeof scope.focus === "string" ? scope.focus : null,
    timelineStartMs: scope.timeRange && typeof scope.timeRange.startMs === "number" ? scope.timeRange.startMs : null,
    timelineEndMs: scope.timeRange && typeof scope.timeRange.endMs === "number" ? scope.timeRange.endMs : null,
    hypothesis: typeof scope.hypothesis === "string" ? scope.hypothesis : null,
    intentIds: normalizeIntentIdList(scope.intentIds)
  };
}
export function getCurrentReports(state) {
  return state.reports;
}
export function getAssets(state) {
  return state.assets.slice();
}
export function getAssetById(state, assetId) {
  return state.assets.find(function(asset) {
    return asset.id === assetId;
  }) || null;
}
export function getCurrentSourceAsset(state) {
  const source = getProjectSource(state);
  const storedPath = asNonEmptyString(source["storedPath"]);
  const sourceUrl = asNonEmptyString(source["sourceUrl"]);
  const storedFileName = asNonEmptyString(source["storedFileName"]);
  return getAssets(state).find(function(asset) {
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
    return asset.name === storedFileName && asNonEmptyString(asLabRecord(asset.metadata)["storedFileName"]) === storedFileName;
  }) || null;
}
export function getAssetsByType(state, type) {
  return state.assets.filter(function(asset) {
    return asset.type === type;
  });
}
export function getAssetsBySource(state, sourceId) {
  return state.assets.filter(function(asset) {
    return asset.sourceId === sourceId;
  });
}
export function getAssetsByRun(state, runId) {
  return state.assets.filter(function(asset) {
    return asset.runId === runId;
  });
}
export function getLinkedAudioAssets(state, sourceId) {
  return getAssets(state).filter(function(asset) {
    return asset.type === "audio" && asset.derivedFromSourceId === sourceId;
  }).sort(function(left, right) {
    if (left.createdAt !== right.createdAt) {
      return right.createdAt - left.createdAt;
    }
    if (left.name !== right.name) {
      return left.name.localeCompare(right.name);
    }
    return left.id.localeCompare(right.id);
  });
}
export function getParentSourceForAsset(state, assetId) {
  const asset = getAssetById(state, assetId);
  if (asset === null) {
    return null;
  }
  if (asset.derivedFromAssetId) {
    const parentAsset = getAssetById(state, asset.derivedFromAssetId);
    if (parentAsset !== null) {
      return parentAsset;
    }
  }
  if (asset.derivedFromSourceId) {
    const parentSource = getAssetById(state, asset.derivedFromSourceId);
    if (parentSource !== null) {
      return parentSource;
    }
    return getAssets(state).find(function(candidate) {
      return candidate.type === "source" && candidate.sourceId === asset.derivedFromSourceId;
    }) || null;
  }
  return null;
}
export function getExpectedOutputs(intentId) {
  switch (intentId) {
    case "visual-inspection":
      return [
        { intentId, label: "Frame çıktıları", assetTypes: ["frame", "image"] },
        { intentId, label: "Anomali verileri", assetTypes: ["artifact"] }
      ];
    case "audio-investigation":
      return [{ intentId, label: "Ses çıktısı", assetTypes: ["audio"] }];
    default:
      return [];
  }
}
export function getActualOutputs(state, intentId) {
  return getAssets(state).filter(function(asset) {
    return Array.isArray(asset.intentIds) && asset.intentIds.includes(intentId);
  });
}
export function isExpectedOutputMatched(expectedOutput, actualOutputs) {
  return expectedOutput.assetTypes.some(function(assetType) {
    return actualOutputs.some(function(asset) {
      return asset.type === assetType;
    });
  });
}
export function getWorkbench(state) {
  return state.workbench;
}
export function getSourceProbeStatus(state) {
  return state.sourceProbeStatus;
}
export function getSourceStatus(state) {
  return asNonEmptyString(getProjectSource(state)["status"]) || "idle";
}
export function getSourceMode(state) {
  return asNonEmptyString(getProjectSource(state)["mode"]) || "local";
}
export function getSourceKind(state) {
  return asNonEmptyString(getProjectSource(state)["kind"]) || "video";
}
export function getSourceMetadata(state) {
  return asLabRecord(getProjectSource(state)["metadata"]);
}
export function getEditPreview(state) {
  return asLabRecord(getProjectEdit(state)["preview"]);
}
export function getEditOutputs(state) {
  const outputs = getProjectEdit(state)["outputs"];
  return Array.isArray(outputs) ? outputs.map(asLabRecord) : [];
}
export function getActiveEditOutput(state) {
  const activeOutputId = asNonEmptyString(getProjectEdit(state)["activeOutputId"]);
  if (activeOutputId === null) {
    return null;
  }
  return getEditOutputs(state).find(function(entry) {
    return asNonEmptyString(entry["id"]) === activeOutputId;
  }) || null;
}
export function getReportExports(state) {
  return state.reportExports;
}
export function getProfileModelCatalog(state) {
  return state.profileModels;
}
export function getSelectedProfileModel(state) {
  const profile = getProjectProfile(state);
  const modelId = asNonEmptyString(profile["modelId"]);
  if (modelId === null) {
    return null;
  }
  return getProfileModelCatalog(state).find(function(entry) {
    return asNonEmptyString(entry["id"]) === modelId;
  }) || null;
}
export function getToolState(state) {
  return state.toolState;
}
export function getFeatureCompatibility(state) {
  const featureId = getCurrentFeatureId(state);
  const sourceReady = state.source !== null && state.sourceProbeStatus === "completed";
  const availableModules = Array.isArray(state.workbench["availableModuleIds"]) ? state.workbench["availableModuleIds"].filter(
    (entry) => typeof entry === "string"
  ) : Array.isArray(state.workbench["selectedModuleIds"]) ? state.workbench["selectedModuleIds"].filter(
    (entry) => typeof entry === "string"
  ) : [featureId];
  const sourceKind = getSourceKind(state);
  return {
    featureId,
    mediaReady: sourceReady && availableModules.includes("media-analysis"),
    audioReady: sourceReady && availableModules.includes("audio-analysis") && (sourceKind === "audio" || sourceKind === "video")
  };
}
export function getStageBlockReason(state, stage) {
  const source = getProjectSource(state);
  const preflight = getCurrentPreflight(state);
  const reports = getCurrentReports(state);
  const reportStatus = asNonEmptyString(getCurrentFeatureReportRecord(state)["status"]);
  const probeStatus = getSourceProbeStatus(state);
  if (stage === "source") {
    return null;
  }
  if (stage === "edit") {
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
    if (reports.user !== null || reports.ai !== null || reportStatus === "ready" || reportStatus === "stale") {
      return null;
    }
    return "Rapor henüz üretilmedi.";
  }
  return "Bu aşama henüz hazır değil.";
}
export function canAdvanceToStage(state, stage) {
  return getStageBlockReason(state, stage) === null;
}
export function getPrimaryActionLabel(state, _stage) {
  const sourceProbeStatus = getSourceProbeStatus(state);
  if (hasReportPayload(state) && (state.ui.workspace.reportOverlayOpen || isRunComplete(state))) {
    return "Raporları Dışa Aktar";
  }
  if (isRunActive(state)) {
    return "Çalışmayı İptal Et";
  }
  if (getSourceReady(state)) {
    const edit = getProjectEdit(state);
    return asNonEmptyString(asLabRecord(edit["preview"])["status"]) === "ready" ? "Önizlemeyi Yenile" : "Önizleme Üret";
  }
  return sourceProbeStatus === "completed" ? "Kaynağı Yenile" : "Kaynağı Hazırla";
}
export function getVisibleEvents(state) {
  const feed = Array.isArray(state.run?.events) ? state.run.events.slice().sort(function(left, right) {
    return right.timestamp - left.timestamp;
  }) : [];
  const windowSize = state.ui.eventFeedExpanded ? 40 : 18;
  const windowStart = state.ui.eventFeedExpanded ? state.ui.eventFeedCursor : 0;
  return Array.isArray(feed) ? feed.slice(windowStart, windowStart + windowSize) : [];
}
export function hasMoreVisibleEvents(state) {
  const totalCount = Array.isArray(state.run?.events) ? state.run.events.length : 0;
  const windowSize = state.ui.eventFeedExpanded ? 40 : 18;
  const windowStart = state.ui.eventFeedExpanded ? state.ui.eventFeedCursor : 0;
  return totalCount > windowStart + windowSize;
}
export function getVisibleEventOffset(state) {
  return state.ui.eventFeedExpanded ? state.ui.eventFeedCursor : 0;
}
export function getVisibleRawLogs(state) {
  const rawLog = Array.isArray(state.run?.rawLog) ? state.run.rawLog : [];
  return Array.isArray(rawLog) ? rawLog.slice(0, state.ui.eventFeedExpanded ? 40 : 12) : [];
}
export function getGlobalActivityFeed(state) {
  return Array.isArray(state.activityFeed) ? state.activityFeed.slice() : [];
}
export function getUserActions(state) {
  const activeProjectId = state.projectIndex.activeProjectId;
  const userActions = Array.isArray(state.userActions) ? state.userActions : [];
  if (activeProjectId === null) {
    return userActions.slice();
  }
  return userActions.filter(function(entry) {
    return entry.projectId === null || entry.projectId === activeProjectId;
  });
}
export function getRecentUserActions(state, limit = 6) {
  return getUserActions(state).slice(0, Math.min(limit, LAB_USER_ACTION_HISTORY_LIMIT));
}
export function getHubUserActions(state, limit = 4) {
  return getUserActions(state).filter(function(entry) {
    return entry.status === "running" || entry.status === "error" || entry.dismissedFromHubAt == null;
  }).slice(0, limit);
}
export function getActionOutputs(state, actionId) {
  const action = getUserActions(state).find(function(entry) {
    return entry.id === actionId;
  });
  if (!action || Array.isArray(action.resultAssetIds) !== true || action.resultAssetIds.length === 0) {
    return [];
  }
  return action.resultAssetIds.map(function(assetId) {
    return getAssetById(state, assetId);
  }).filter((asset) => asset !== null);
}
export function getVisibleArtifacts(state) {
  const run = getCurrentRun(state);
  const artifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
  if (!state.ui.artifactListExpanded) {
    return Array.isArray(artifacts) ? artifacts.slice(0, 12) : [];
  }
  return Array.isArray(artifacts) ? artifacts.slice(0, state.ui.artifactRenderCount) : [];
}
export function hasMoreVisibleArtifacts(state) {
  const run = getCurrentRun(state);
  const artifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
  return artifacts.length > getVisibleArtifacts(state).length;
}
export function getProcessAnalysisScope(state) {
  const run = getCurrentRun(state);
  return run?.analysisScope || normalizeAnalysisScope(asLabRecord(state.workbench)["analysisScope"]);
}
export function getVisibleLiveFindings(state) {
  const run = getCurrentRun(state);
  const findings = Array.isArray(run?.liveFindings) ? run.liveFindings : [];
  return Array.isArray(findings) ? findings.slice(0, state.ui.liveFindingsExpanded ? 18 : 6) : [];
}
export function hasMoreVisibleLiveFindings(state) {
  const run = getCurrentRun(state);
  const findings = Array.isArray(run?.liveFindings) ? run.liveFindings : [];
  return findings.length > getVisibleLiveFindings(state).length;
}
export function getPreviewArtifacts(state) {
  const run = getCurrentRun(state);
  return Array.isArray(run?.previewArtifacts) ? run.previewArtifacts.slice() : [];
}
export function getActivePreviewArtifact(state) {
  const previewArtifacts = getPreviewArtifacts(state);
  if (previewArtifacts.length === 0) {
    return null;
  }
  const activePreviewId = asNonEmptyString(state.ui.activePreviewArtifactId) || asNonEmptyString(asLabRecord(state.workbench)["activePreviewArtifactId"]);
  return previewArtifacts.find(function(entry) {
    return entry.id === activePreviewId;
  }) || previewArtifacts.find(function(entry) {
    return entry.active === true;
  }) || previewArtifacts[0] || null;
}
function getAudioVisualizationArtifactTimestamp(artifact) {
  if (typeof artifact.createdAt !== "string" || artifact.createdAt.trim() === "") {
    return Number.NEGATIVE_INFINITY;
  }
  const parsedTimestamp = Date.parse(artifact.createdAt);
  return Number.isFinite(parsedTimestamp) ? parsedTimestamp : Number.NEGATIVE_INFINITY;
}
function getLoadableVisualizationArtifactUrl(artifact) {
  if (typeof artifact.previewUrl === "string" && artifact.previewUrl.trim() !== "") {
    return artifact.previewUrl;
  }
  const fileUrl = artifact.fileUrl;
  return typeof fileUrl === "string" && fileUrl.trim() !== "" ? fileUrl : null;
}
function hasLoadableVisualizationArtifactUrl(artifact) {
  return getLoadableVisualizationArtifactUrl(artifact) !== null;
}
function pickPreferredAudioVisualizationArtifact(artifacts, kind) {
  return artifacts.map(function(artifact, index) {
    return {
      artifact,
      index
    };
  }).filter(function(entry) {
    return entry.artifact.kind === kind && hasLoadableVisualizationArtifactUrl(entry.artifact);
  }).sort(function(left, right) {
    const timestampDelta = getAudioVisualizationArtifactTimestamp(right.artifact) - getAudioVisualizationArtifactTimestamp(left.artifact);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }
    if (left.artifact.active !== right.artifact.active) {
      return left.artifact.active === true ? -1 : 1;
    }
    return left.index - right.index;
  })[0]?.artifact || null;
}
export function getAudioVisualizationArtifact(state) {
  const mode = state.ui.workspace.audioFocus.visualizationMode === "spectrum" ? "spectrum" : "waveform";
  const run = getCurrentRun(state);
  if (!run) {
    return null;
  }
  const finalArtifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
  const previewArtifacts = Array.isArray(run.previewArtifacts) ? run.previewArtifacts : [];
  const preferredKinds = mode === "spectrum" ? ["spectrogram", "waveform"] : ["waveform", "spectrogram"];
  for (const kind of preferredKinds) {
    const finalArtifact = pickPreferredAudioVisualizationArtifact(finalArtifacts, kind);
    if (finalArtifact) {
      return finalArtifact;
    }
    const previewArtifact = pickPreferredAudioVisualizationArtifact(previewArtifacts, kind);
    if (previewArtifact) {
      return previewArtifact;
    }
  }
  return null;
}
export function getComparisonVariants(state) {
  const run = getCurrentRun(state);
  return Array.isArray(run?.comparisonVariants) ? run.comparisonVariants.slice() : [];
}
export function getActiveModule(state) {
  const run = getCurrentRun(state);
  if (!run || !Array.isArray(run.moduleOrder)) {
    return null;
  }
  const activeModuleId = run.moduleOrder.find(function(moduleId) {
    return run.modules[moduleId]?.status === "running";
  }) || null;
  return activeModuleId ? run.modules[activeModuleId] || null : null;
}
export function getSelectedCapabilities(state) {
  return state.selectedCapabilities;
}
export function getAvailableCapabilities(state) {
  const sourceKind = getSourceKind(state);
  const sourceReady = state.source !== null && state.sourceProbeStatus === "completed";
  const toolState = getToolState(state);
  const toolRegistry = asLabRecord(toolState["tools"]);
  const effectiveSelectedCapabilities = getEffectiveSelectedCapabilities(state);
  return CAPABILITY_FAMILIES.map(function(family) {
    const sourceCompatible = family.sourceKinds.includes(sourceKind);
    const toolsReady = family.requiredTools.every(function(toolId) {
      const tool = asLabRecord(toolRegistry[toolId]);
      return tool["installed"] === true || asNonEmptyString(tool["status"]) === "installed";
    });
    const toolsMissing = family.requiredTools.filter(function(toolId) {
      const tool = asLabRecord(toolRegistry[toolId]);
      return tool["installed"] !== true && asNonEmptyString(tool["status"]) !== "installed";
    });
    let readiness = "ready";
    let blockReason = null;
    if (!sourceReady) {
      readiness = "blocked";
      blockReason = "Kaynak henüz hazır değil.";
    } else if (!sourceCompatible) {
      readiness = "blocked";
      blockReason = `Bu kaynak türü (${sourceKind}) desteklenmiyor.`;
    } else if (!toolsReady) {
      if (toolsMissing.length === family.requiredTools.length) {
        readiness = "blocked";
        blockReason = `Eksik araç: ${toolsMissing.join(", ")}`;
      } else {
        readiness = "optional";
        blockReason = `Opsiyonel araç eksik: ${toolsMissing.join(", ")}`;
      }
    }
    return {
      ...family,
      readiness,
      blockReason,
      selected: effectiveSelectedCapabilities.includes(family.id)
    };
  });
}
export function getCapabilityWorkflowSummary(state) {
  const selected = getEffectiveSelectedCapabilities(state);
  const available = getAvailableCapabilities(state);
  const selectedFamilies = available.filter(function(entry) {
    return selected.includes(entry.id);
  });
  const readyCount = selectedFamilies.filter(function(entry) {
    return entry.readiness === "ready";
  }).length;
  return {
    familyCount: selectedFamilies.length,
    readyCount,
    blockedCount: selectedFamilies.length - readyCount,
    selectedIds: selected
  };
}
export function getWorkspaceMode(state) {
  if (!state.bootReady && state.source === null) {
    return "loading";
  }
  const run = getCurrentRun(state);
  if (run && (run.state === "running" || run.state === "queued")) {
    return "analyzing";
  }
  if (run && (run.state === "completed" || run.state === "ready" || run.state === "failed" || run.state === "cancelled")) {
    return "complete";
  }
  return "workspace";
}
export function getSourceReady(state) {
  return state.source !== null && state.sourceProbeStatus === "completed";
}
export function getActiveSelection(state) {
  return state.ui.workspace.activeSelection;
}
export function isSelectionValid(state) {
  const selection = getActiveSelection(state);
  return selection !== null && selection.endMs > selection.startMs;
}
export function getSelectionDuration(state) {
  const selection = getActiveSelection(state);
  if (selection === null || selection.endMs <= selection.startMs) {
    return 0;
  }
  return selection.endMs - selection.startMs;
}
export function getTimelineSelection(state) {
  const activeSelection = getActiveSelection(state);
  if (activeSelection !== null && activeSelection.endMs > activeSelection.startMs) {
    return {
      startMs: activeSelection.startMs,
      endMs: activeSelection.endMs
    };
  }
  return {
    startMs: state.ui.workspace.timelineStartMs,
    endMs: state.ui.workspace.timelineEndMs
  };
}
function getRoundedAssetMetadataNumber(asset, key) {
  if (asset === null) {
    return null;
  }
  const metadata = asLabRecord(asset.metadata);
  const rawValue = metadata[key];
  return typeof rawValue === "number" && Number.isFinite(rawValue) ? Math.round(rawValue) : null;
}
export function getWaveformTimelineModel(state) {
  const sourceKind = getSourceKind(state);
  const sourceReady = getSourceReady(state);
  const metadata = getSourceMetadata(state);
  const durationMs = sourceReady && typeof metadata["durationSeconds"] === "number" ? Math.max(0, Math.round(metadata["durationSeconds"] * 1e3)) : 0;
  const selection = getTimelineSelection(state);
  const dualPreviewActive = isDualPreviewActive(state);
  const selectedAudioAsset = dualPreviewActive ? getSelectedDualPreviewAudioAsset(state) : null;
  const rawWaveformOffsetMs = getRoundedAssetMetadataNumber(selectedAudioAsset, "startOffsetMs") || 0;
  const selectedAudioDurationMs = getRoundedAssetMetadataNumber(selectedAudioAsset, "durationMs");
  const waveformContentDurationMs = selectedAudioAsset !== null && selectedAudioDurationMs !== null ? Math.max(0, selectedAudioDurationMs) : durationMs;
  const waveformVisibleStartMs = Math.max(0, rawWaveformOffsetMs);
  const waveformVisibleEndMs = Math.min(
    durationMs,
    rawWaveformOffsetMs + waveformContentDurationMs
  );
  const waveformContentVisibleStartMs = Math.max(0, 0 - rawWaveformOffsetMs);
  const waveformContentVisibleEndMs = Math.max(
    waveformContentVisibleStartMs,
    Math.min(waveformContentDurationMs, durationMs - rawWaveformOffsetMs)
  );
  const waveformWindowDurationMs = durationMs > 0 ? Math.max(0, waveformVisibleEndMs - waveformVisibleStartMs) : 0;
  const waveformCropStartRatio = waveformContentDurationMs > 0 ? Math.max(0, Math.min(1, waveformContentVisibleStartMs / waveformContentDurationMs)) : 0;
  const waveformCropEndRatio = waveformContentDurationMs > 0 ? Math.max(0, Math.min(1, waveformContentVisibleEndMs / waveformContentDurationMs)) : 1;
  return {
    activeSelection: getActiveSelection(state),
    bookmarks: getBookmarks(state),
    dualPreviewActive,
    durationMs,
    endMs: selection.endMs,
    linkedAudioAssetId: selectedAudioAsset?.id || null,
    startMs: selection.startMs,
    sourceKind,
    visualizationArtifact: getAudioVisualizationArtifact(state),
    visualizationMode: state.ui.workspace.audioFocus.visualizationMode,
    waveformContentDurationMs,
    waveformCropEndRatio,
    waveformCropStartRatio,
    waveformOffsetMs: rawWaveformOffsetMs,
    waveformSourceLabel: selectedAudioAsset?.name || (sourceKind === "audio" ? "Source audio" : sourceKind === "video" ? "Embedded audio" : "Waveform"),
    waveformSyncLabel: selectedAudioAsset === null ? "Preview and waveform share the same master axis." : rawWaveformOffsetMs === 0 ? "Linked audio is aligned to the master axis." : `Linked audio offset ${rawWaveformOffsetMs > 0 ? "+" : ""}${String(rawWaveformOffsetMs)} ms`,
    waveformWindowDurationMs: sourceKind === "audio" || sourceKind === "video" ? waveformWindowDurationMs : 0,
    waveformWindowStartMs: sourceKind === "audio" || sourceKind === "video" ? waveformVisibleStartMs : 0
  };
}
export function getROIRegions(state) {
  return state.ui.workspace.roiRegions;
}
export function getActiveROIRegions(state) {
  return state.ui.workspace.roiRegions.filter(function(entry) {
    return entry.active;
  });
}
export function getInteractiveSettings(state) {
  return state.ui.workspace.interactiveSettings;
}
export function getAudioFocusSettings(state) {
  return state.ui.workspace.audioFocus;
}
export function getDualPreviewEnabled(state) {
  return state.ui.workspace.dualPreviewEnabled === true;
}
export function getDualPreviewVolume(state) {
  return Math.max(0, Math.min(1, state.ui.workspace.dualPreviewVolume));
}
export function getDualPreviewLinkedAudioAssets(state) {
  const currentSourceAsset = getCurrentSourceAsset(state);
  if (currentSourceAsset === null || getSourceKind(state) !== "video" || getSourceReady(state) !== true) {
    return [];
  }
  return getLinkedAudioAssets(state, currentSourceAsset.id);
}
export function getSelectedDualPreviewAudioAsset(state) {
  const linkedAudioAssets = getDualPreviewLinkedAudioAssets(state);
  if (linkedAudioAssets.length === 0) {
    return null;
  }
  const selectedId = asNonEmptyString(state.ui.workspace.dualPreviewAudioAssetId);
  return linkedAudioAssets.find(function(asset) {
    return asset.id === selectedId;
  }) || linkedAudioAssets[0] || null;
}
export function isDualPreviewAvailable(state) {
  return getDualPreviewLinkedAudioAssets(state).length > 0;
}
export function isDualPreviewActive(state) {
  return getDualPreviewEnabled(state) && isDualPreviewAvailable(state);
}
export function getBookmarks(state) {
  return state.ui.workspace.bookmarks;
}
export function getHypothesis(state) {
  return state.ui.workspace.hypothesis;
}
export function getSelectedIntents(state) {
  return state.ui.workspace.selectedIntents;
}
export function getAvailableIntents(state) {
  const sourceKind = getSourceKind(state);
  const sourceReady = getSourceReady(state);
  const availableCapabilities = getAvailableCapabilities(state);
  return WORKSPACE_INTENTS.map(function(intent) {
    const sourceCompatible = intent.sourceKinds.includes(sourceKind);
    const capabilityReadiness = intent.internalCapabilities.map(function(capId) {
      const cap = availableCapabilities.find(function(entry) {
        return entry.id === capId;
      });
      return cap ? cap.readiness : "blocked";
    });
    const allBlocked = capabilityReadiness.every(function(entry) {
      return entry === "blocked";
    });
    const someBlocked = capabilityReadiness.some(function(entry) {
      return entry === "blocked";
    });
    let readiness = "ready";
    let blockReason = null;
    if (!sourceReady) {
      readiness = "blocked";
      blockReason = "Source not ready.";
    } else if (!sourceCompatible) {
      readiness = "blocked";
      blockReason = "Not available for this source type.";
    } else if (allBlocked) {
      readiness = "blocked";
      blockReason = "Required tools not installed.";
    } else if (someBlocked) {
      readiness = "optional";
      blockReason = "Some tools missing — partial results.";
    }
    return {
      ...intent,
      readiness,
      blockReason,
      selected: state.ui.workspace.selectedIntents.includes(intent.id)
    };
  });
}
export function getIntentDerivedCapabilities(state) {
  const selectedIntents = getSelectedIntents(state);
  const capabilitySet = /* @__PURE__ */ new Set();
  WORKSPACE_INTENTS.forEach(function(intent) {
    if (selectedIntents.includes(intent.id)) {
      intent.internalCapabilities.forEach(function(capId) {
        capabilitySet.add(capId);
      });
    }
  });
  return Array.from(capabilitySet);
}
export function getWorkspaceAnalysisInput(state) {
  return {
    timeRange: getTimelineSelection(state),
    roiRegions: getActiveROIRegions(state),
    hypothesis: getHypothesis(state),
    selectedIntents: getSelectedIntents(state),
    interactiveSettings: getInteractiveSettings(state),
    bookmarks: getBookmarks(state)
  };
}
export function getWorkspaceDiff(state) {
  const snapshotSummary = getRunSnapshotSummary(state);
  if (!snapshotSummary) {
    return null;
  }
  const liveTimeline = getTimelineSelection(state);
  const liveHypothesis = getHypothesis(state).trim();
  const liveIntentIds = normalizeIntentIdList(getSelectedIntents(state));
  const timelineChanged = liveTimeline.startMs !== snapshotSummary.timelineStartMs || liveTimeline.endMs !== snapshotSummary.timelineEndMs;
  const hypothesisChanged = liveHypothesis !== (snapshotSummary.hypothesis || "");
  const intentsChanged = liveIntentIds.length !== snapshotSummary.intentIds.length || liveIntentIds.some(function(intentId, index) {
    return snapshotSummary.intentIds[index] !== intentId;
  });
  const changedKeys = [];
  if (timelineChanged) {
    changedKeys.push("timeline");
  }
  if (hypothesisChanged) {
    changedKeys.push("hypothesis");
  }
  if (intentsChanged) {
    changedKeys.push("intents");
  }
  return {
    timelineChanged,
    hypothesisChanged,
    intentsChanged,
    workspaceDirty: changedKeys.length > 0,
    changedKeys
  };
}
export function getIntentDirtyMap(state) {
  const snapshotSummary = getRunSnapshotSummary(state);
  if (!snapshotSummary) {
    return {};
  }
  const workspaceDiff = getWorkspaceDiff(state);
  const snapshotIntentIds = normalizeIntentIdList(snapshotSummary.intentIds);
  const liveIntentIds = normalizeIntentIdList(getSelectedIntents(state));
  const allIntentIds = WORKSPACE_INTENTS.map(function(intent) {
    return intent.id;
  }).filter(function(intentId) {
    return snapshotIntentIds.includes(intentId) || liveIntentIds.includes(intentId);
  });
  return allIntentIds.reduce(function(accumulator, intentId) {
    const inSnapshot = snapshotIntentIds.includes(intentId);
    const inWorkspace = liveIntentIds.includes(intentId);
    const changedKeys = [];
    if (inSnapshot !== inWorkspace) {
      changedKeys.push("selection");
    }
    if (inSnapshot && workspaceDiff?.timelineChanged) {
      changedKeys.push("timeline");
    }
    if (inSnapshot && workspaceDiff?.hypothesisChanged) {
      changedKeys.push("hypothesis");
    }
    accumulator[intentId] = {
      intentId,
      inSnapshot,
      inWorkspace,
      dirty: changedKeys.length > 0,
      changedKeys
    };
    return accumulator;
  }, {});
}
export function getProcessPanelCollapsedSections(state) {
  return state.ui.workspace.processPanelCollapsedSections;
}
export function isProcessSectionCollapsed(state, sectionId) {
  return state.ui.workspace.processPanelCollapsedSections.includes(sectionId);
}
export function getReportOverlayOpen(state) {
  return state.ui.workspace.reportOverlayOpen;
}
export function getRunElapsedSeconds(state) {
  const run = getCurrentRun(state);
  if (!run) {
    return 0;
  }
  const start = run.startedAt;
  const end = run.endedAt || Date.now();
  const diff = end - start;
  return diff > 0 ? Math.round(diff / 1e3) : 0;
}
export function getSourceActionBlockReason(state) {
  const sourceMode = getSourceMode(state);
  const drafts = state.ui.sourceDrafts;
  if (sourceMode === "url" && drafts.urlInput.trim() === "") {
    return "Kaynak URL gerekli";
  }
  if (sourceMode === "youtube" && drafts.youtubeUrl.trim() === "") {
    return "YouTube URL gerekli";
  }
  return null;
}
export function getPreflightSeverity(state) {
  const preflight = getCurrentPreflight(state);
  if (preflight.status === "blocked" && preflight.missingDependencies.length > 0) {
    return "will-fail";
  }
  if (preflight.status === "blocked" || preflight.status === "warning") {
    return "warning";
  }
  if (!preflight.stageReady && preflight.status !== "ready") {
    return "warning";
  }
  return "clear";
}
export function getPreflightWarnings(state) {
  const preflight = getCurrentPreflight(state);
  const msgs = [];
  if (preflight.missingDependencies.length > 0) {
    msgs.push(`Eksik dependency: ${preflight.missingDependencies.join(", ")}`);
  }
  preflight.warnings.forEach(function(w) {
    if (!msgs.includes(w)) msgs.push(w);
  });
  if (msgs.length === 0 && preflight.reason) {
    msgs.push(preflight.reason);
  }
  return msgs;
}
export function getAnalysisActionBlockReason(state) {
  if (!getSourceReady(state)) {
    return "Önce kaynak hazırlanmalı ve probe tamamlanmalı.";
  }
  const selectedCapabilities = getEffectiveSelectedCapabilities(state);
  if (selectedCapabilities.length === 0) {
    return "En az bir analiz modülü seçilmelidir.";
  }
  const severity = getPreflightSeverity(state);
  if (severity === "will-fail") {
    const preflight = getCurrentPreflight(state);
    return `Eksik dependency: ${preflight.missingDependencies.join(", ")}`;
  }
  return null;
}
export function getReportActionBlockReason(state) {
  const reports = getCurrentReports(state);
  const reportStatus = asNonEmptyString(getCurrentFeatureReportRecord(state)["status"]);
  if (reports.user !== null || reports.ai !== null || reportStatus === "ready" || reportStatus === "stale") {
    return null;
  }
  return "Rapor henüz üretilmedi.";
}
export function getEditActionBlockReason(state) {
  const source = getProjectSource(state);
  const probeStatus = getSourceProbeStatus(state);
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
export function isRunActive(state) {
  const run = getCurrentRun(state);
  return run !== null && (run.state === "running" || run.state === "queued");
}
export function isRunComplete(state) {
  const run = getCurrentRun(state);
  return run !== null && (run.state === "completed" || run.state === "ready" || run.state === "failed" || run.state === "cancelled");
}
export function hasReportPayload(state) {
  const reports = getCurrentReports(state);
  const reportStatus = asNonEmptyString(getCurrentFeatureReportRecord(state)["status"]);
  return reports.user !== null || reports.ai !== null || reportStatus === "ready" || reportStatus === "stale";
}
export function getToolRelevanceFilter(state) {
  const sourceMode = getSourceMode(state);
  const sourceKind = getSourceKind(state);
  const selectedIntents = getSelectedIntents(state);
  const intentCapabilities = getIntentDerivedCapabilities(state);
  const wsMode = getWorkspaceMode(state);
  const requiredToolIds = /* @__PURE__ */ new Set();
  CAPABILITY_FAMILIES.forEach(function(family) {
    if (intentCapabilities.includes(family.id)) {
      family.requiredTools.forEach(function(toolId) {
        requiredToolIds.add(toolId);
      });
    }
  });
  return {
    sourceMode,
    sourceKind,
    selectedIntents,
    intentCapabilities,
    workspaceMode: wsMode,
    requiredToolIds: Array.from(requiredToolIds)
  };
}
export function getReportFreshness(state) {
  const reports = getCurrentReports(state);
  const hasReport = reports.user !== null || reports.ai !== null;
  if (!hasReport) {
    return null;
  }
  const workspaceDirty = getWorkspaceDiff(state)?.workspaceDirty === true;
  const run = getCurrentRun(state);
  if (!run) {
    return {
      state: "previous-run",
      workspaceDirty
    };
  }
  if (run.state === "running" || run.state === "queued") {
    return {
      state: "previous-run",
      workspaceDirty
    };
  }
  if (run.state === "completed" || run.state === "ready") {
    return {
      state: "current",
      workspaceDirty
    };
  }
  return {
    state: "stale",
    workspaceDirty
  };
}
export function isWorkspaceDirty(state) {
  return getWorkspaceDiff(state)?.workspaceDirty === true;
}
export function deriveLegacyStage(state) {
  if (state.ui.workspace.reportOverlayOpen && hasReportPayload(state)) {
    return "report";
  }
  if (isRunComplete(state) && hasReportPayload(state)) {
    return "report";
  }
  if (isRunActive(state)) {
    return "process";
  }
  if (getSourceReady(state)) {
    return "edit";
  }
  return "source";
}
