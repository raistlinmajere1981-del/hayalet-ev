import { asLabRecord, asNonEmptyString } from "../models/lab-types.js";
import type {
  CapabilityFamilyId,
  LabActionSuggestion,
  LabAsset,
  LabActiveExecutionResult,
  LabExecutionAlternatives,
  LabExecutionCandidate,
  LabExecutionCommitment,
  LabExecutionDispatchCandidate,
  LabExecutionGoalEvaluation,
  LabExecutionPayloadPreview,
  LabExecutionPlan,
  LabExecutionReadiness,
  LabExecutionReflection,
  LabExecutionResult,
  LabExecutionSelectionSnapshot,
  LabExecutionSimulation,
  LabExecutionStaging,
  LabExpectedOutput,
  LabGlobalProcessSummary,
  LabInspectionMode,
  LabInterpretationItem,
  LabIntentDirtyMap,
  LabPreflightResult,
  LabRun,
  LabSelection,
  LabSelectionIntent,
  LabSuggestionPreview,
  LabStage,
  LabStoreState,
  LabRightPanelContext,
  LabUserActionEvent,
  LabWorkspaceDiff,
  PreflightSeverity,
  ReportFreshness,
  LabDrawerMode,
  LabIntentId,
} from "../models/lab-types.js";
import { CAPABILITY_FAMILIES, WORKSPACE_INTENTS } from "../models/lab-types.js";
import { normalizeAnalysisScope } from "../shared/types/analysis-scope.js";
import { normalizeAudioFocusSettings } from "./lab-audio-focus-normalization.js";
import { buildExecutionAlternativesFromResolved } from "./lab-execution-alternatives.js";
import { buildExecutionPayloadPreviewFromResolved } from "./lab-execution-payload-preview.js";
import { buildExecutionCandidateFromResolved } from "./lab-execution-candidate.js";
import { buildExecutionPlan } from "./lab-execution-planner.js";
import { buildExecutionReadiness } from "./lab-execution-readiness.js";
import { buildExecutionReflectionFromResolved } from "./lab-execution-reflection.js";
import { buildExecutionSimulation } from "./lab-execution-simulator.js";
import { buildExecutionStagingFromResolved } from "./lab-execution-staging.js";
import { buildInterpretationItems } from "./lab-interpretation-engine.js";
import {
  buildSelectionSuggestionPreview,
  getSelectionSuggestionsForContext,
} from "./lab-selection-suggestion-logic.js";
import { LAB_USER_ACTION_HISTORY_LIMIT } from "./lab-user-actions.js";
import {
  getCurrentFeatureReportRecord,
  getProjectSource,
} from "./selectors/lab-project-selectors.js";
import {
  getActiveModule,
  getAssetById,
  getAssets,
  getAudioVisualizationArtifact,
  getCurrentReports,
  getCurrentRun,
  getCurrentSourceAsset,
  getEditPreview,
  getLinkedAudioAssets,
  getRunSnapshotSummary,
  getSourceKind,
  getSourceMetadata,
  getSourceMode,
  getSourceProbeStatus,
  getToolState,
} from "./selectors/lab-source-selectors.js";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter(function (key) {
      return record[key] !== undefined;
    })
    .map(function (key) {
      return `${JSON.stringify(key)}:${stableStringify(record[key])}`;
    })
    .join(",")}}`;
}

export function buildExecutionDispatchId(input: {
  payloadPreview: LabExecutionPayloadPreview;
  planId: string;
  selectionSnapshot: LabExecutionSelectionSnapshot;
  staging: LabExecutionStaging;
}): string {
  return `dispatch:${stableStringify({
    actionType: input.payloadPreview.actionType,
    candidateStatus: input.staging.candidateStatus,
    commitmentStatus: input.staging.commitmentStatus,
    planId: input.planId,
    readinessPassesPreview: input.payloadPreview.readinessPassesPreview,
    readinessStatus: input.staging.readinessStatus,
    selectionSnapshot: input.selectionSnapshot,
    stagingStatus: input.staging.status,
  })}`;
}

function createExecutionSelectionSnapshot(
  state: LabStoreState,
  selection: LabSelection
): LabExecutionSelectionSnapshot {
  const roi = selection.roi;
  return {
    endMs: selection.endMs,
    inspectionMode: getInspectionMode(state),
    intent: selection.intent,
    sourceKind: getSourceKind(state) || "unknown",
    startMs: selection.startMs,
    type: selection.type,
    ...(roi
      ? {
          roi: {
            height: Number(roi.height.toFixed(4)),
            width: Number(roi.width.toFixed(4)),
            x: Number(roi.x.toFixed(4)),
            y: Number(roi.y.toFixed(4)),
          },
        }
      : {}),
  };
}

export type LabExecutionResultInterpretation = {
  coverageLevel: "low" | "medium" | "high";
  anomalyLevel: "none" | "moderate" | "high";
  alignment: "matches-simulation" | "partial" | "deviates";
};

export type LabExecutionResultInterpretationInput = LabExecutionResult & {
  actionType: string;
  selectionSnapshot?: LabExecutionSelectionSnapshot;
};

export type LabExecutionGoalEvaluationInput = LabExecutionResult & {
  selectionSnapshot?: LabExecutionSelectionSnapshot;
};

type ActiveExecutionRuntimeContext = {
  dispatchCandidate: LabExecutionDispatchCandidate;
  result: LabExecutionResult;
};

type ExecutionPatternStats = {
  executionCount: number;
  coverageTotal: number;
  successCount: number;
  failureCount: number;
};

const executionPatternRegistry = new Map<string, ExecutionPatternStats>();
const recordedExecutionPatternSamples = new Set<string>();
const activeExecutionGoalEvaluationCache = new Map<string, LabExecutionGoalEvaluation>();

function getExpectedExecutionArtifactCount(actionType: string) {
  if (actionType === "analyze-segment") {
    return 2;
  }
  if (actionType === "focus-region" || actionType === "inspect-audio") {
    return 1;
  }
  return 1;
}

function getExecutionSelectionDurationMs(selection?: LabExecutionSelectionSnapshot) {
  if (selection === undefined) {
    return 0;
  }
  return Math.max(0, selection.endMs - selection.startMs);
}

function getExecutionDurationBucket(selection?: LabExecutionSelectionSnapshot) {
  const durationMs = getExecutionSelectionDurationMs(selection);
  if (durationMs < 1000) {
    return "short";
  }
  if (durationMs < 5000) {
    return "medium";
  }
  if (durationMs < 15000) {
    return "long";
  }
  return "extended";
}

function buildExecutionPatternKey(input: {
  actionType: string;
  selectionSnapshot?: LabExecutionSelectionSnapshot;
}) {
  return [
    input.actionType,
    getExecutionDurationBucket(input.selectionSnapshot),
    input.selectionSnapshot?.roi === undefined ? "no-roi" : "roi",
  ].join(":");
}

function buildExecutionResultSignature(result: LabExecutionResult) {
  return stableStringify({
    artifacts: result.artifacts,
    insights: result.insights,
    metrics: result.metrics,
    summary: result.summary,
  });
}

function buildExecutionPatternSampleId(context: ActiveExecutionRuntimeContext) {
  return `${context.dispatchCandidate.dispatchId}:${buildExecutionResultSignature(context.result)}`;
}

function getExecutionCoverageScore(result: LabExecutionResultInterpretationInput) {
  const expectedArtifactCount = getExpectedExecutionArtifactCount(result.actionType);
  const metricCoverage = result.metrics.coverage;
  let coverageScore =
    typeof metricCoverage === "number" && Number.isFinite(metricCoverage)
      ? metricCoverage
      : result.artifacts.length / expectedArtifactCount;
  const durationMs = getExecutionSelectionDurationMs(result.selectionSnapshot);

  if (durationMs > 10000 && result.artifacts.length <= expectedArtifactCount) {
    coverageScore -= 0.1;
  }
  if (durationMs > 0 && durationMs < 500) {
    coverageScore -= 0.05;
  }

  return Math.max(0, Math.min(1, coverageScore));
}

export function buildExecutionResultInterpretation(
  result: LabExecutionResultInterpretationInput
): LabExecutionResultInterpretation {
  const coverageScore = getExecutionCoverageScore(result);
  const coverageLevel = coverageScore >= 0.8 ? "high" : coverageScore >= 0.55 ? "medium" : "low";
  const expectedArtifactCount = getExpectedExecutionArtifactCount(result.actionType);
  const artifactCount = result.artifacts.length;
  const anomalyLevel =
    artifactCount === 0
      ? "none"
      : result.actionType === "analyze-segment" && artifactCount >= 3
        ? "high"
        : artifactCount > expectedArtifactCount + 1
          ? "high"
          : "moderate";
  const alignment =
    coverageLevel === "low" || anomalyLevel === "high"
      ? "deviates"
      : coverageLevel === "high"
        ? "matches-simulation"
        : "partial";

  return {
    alignment,
    anomalyLevel,
    coverageLevel,
  };
}

function clampGoalAlignment(value: number) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function createGoalEvaluation(
  outcome: LabExecutionGoalEvaluation["outcome"],
  goalAlignment: number,
  summary: string
): LabExecutionGoalEvaluation {
  return {
    outcome,
    goalAlignment: clampGoalAlignment(goalAlignment),
    summary,
  };
}

export function getExecutionGoalEvaluation(
  result: LabExecutionGoalEvaluationInput,
  actionType: string
): LabExecutionGoalEvaluation {
  const interpretation = buildExecutionResultInterpretation({
    ...result,
    actionType,
  });
  const confidence =
    typeof result.metrics.confidence === "number" && Number.isFinite(result.metrics.confidence)
      ? Math.max(0, Math.min(1, result.metrics.confidence))
      : undefined;
  const hasRoi = result.selectionSnapshot?.roi !== undefined;
  const artifactCount = result.artifacts.length;

  switch (actionType) {
    case "analyze-segment":
      if (interpretation.coverageLevel === "high" && interpretation.anomalyLevel !== "none") {
        return createGoalEvaluation(
          "successful",
          interpretation.anomalyLevel === "high" ? 0.95 : 0.88,
          "Segment goal achieved through high-coverage anomaly detection"
        );
      }
      if (interpretation.coverageLevel === "low") {
        return createGoalEvaluation(
          "failed",
          0.25,
          "Segment goal remains unmet because coverage is too limited"
        );
      }
      return createGoalEvaluation(
        "neutral",
        0.55,
        "Segment goal remains inconclusive under the current evidence"
      );
    case "focus-region":
      if (hasRoi !== true) {
        return createGoalEvaluation(
          "neutral",
          0.5,
          "Region goal remains neutral without an ROI snapshot"
        );
      }
      if (interpretation.coverageLevel === "high") {
        return createGoalEvaluation(
          "successful",
          0.9,
          "Region goal achieved with high ROI coverage"
        );
      }
      if (interpretation.coverageLevel === "low") {
        return createGoalEvaluation(
          "failed",
          0.25,
          "Region goal remains unmet because ROI coverage is limited"
        );
      }
      return createGoalEvaluation(
        "neutral",
        0.58,
        "Region goal remains inconclusive under the current ROI coverage"
      );
    case "inspect-audio":
      if (artifactCount >= 2 && confidence !== undefined && confidence >= 0.6) {
        return createGoalEvaluation(
          "successful",
          confidence >= 0.75 ? 0.88 : 0.8,
          "Audio goal achieved through repeated frequency evidence"
        );
      }
      if (confidence !== undefined && confidence < 0.6) {
        return createGoalEvaluation(
          "failed",
          0.25,
          "Audio goal remains unmet because confidence is too low"
        );
      }
      return createGoalEvaluation(
        "neutral",
        0.55,
        "Audio goal remains inconclusive for the current result"
      );
    default:
      return createGoalEvaluation(
        "neutral",
        0.5,
        "Goal evaluation remains neutral for this action"
      );
  }
}

function roundExecutionPatternMetric(value: number) {
  return Number(value.toFixed(2));
}

function getExecutionPatternSignal(
  patternKey: string
): LabExecutionGoalEvaluation["patternSignal"] {
  const stats = executionPatternRegistry.get(patternKey);
  if (stats === undefined || stats.executionCount === 0) {
    return undefined;
  }

  const averageCoverage = roundExecutionPatternMetric(stats.coverageTotal / stats.executionCount);
  const decisiveCount = stats.successCount + stats.failureCount;
  const successRatio =
    decisiveCount > 0 ? roundExecutionPatternMetric(stats.successCount / decisiveCount) : 0;
  const failureRatio =
    decisiveCount > 0 ? roundExecutionPatternMetric(stats.failureCount / decisiveCount) : 0;
  const weak = averageCoverage < 0.55 || failureRatio >= 0.6;
  const strong = averageCoverage >= 0.8 && successRatio >= 0.6;
  const strength = weak ? "weak" : strong ? "strong" : "neutral";

  return {
    averageCoverage,
    executionCount: stats.executionCount,
    failureRatio,
    strength,
    successRatio,
    ...(strength === "weak"
      ? { note: "Historically similar evaluations show low coverage" }
      : strength === "strong"
        ? { note: "Historically similar evaluations usually complete successfully" }
        : {}),
  };
}

function recordExecutionPatternSample(
  context: ActiveExecutionRuntimeContext,
  goalEvaluation: LabExecutionGoalEvaluation
) {
  const sampleId = buildExecutionPatternSampleId(context);
  if (recordedExecutionPatternSamples.has(sampleId)) {
    return;
  }

  const patternKey = buildExecutionPatternKey({
    actionType: context.dispatchCandidate.actionType,
    selectionSnapshot: context.dispatchCandidate.selectionSnapshot,
  });
  const stats = executionPatternRegistry.get(patternKey) ?? {
    coverageTotal: 0,
    executionCount: 0,
    failureCount: 0,
    successCount: 0,
  };
  const coverage = getExecutionCoverageScore({
    ...context.result,
    actionType: context.dispatchCandidate.actionType,
    selectionSnapshot: context.dispatchCandidate.selectionSnapshot,
  });

  stats.executionCount += 1;
  stats.coverageTotal += coverage;
  if (goalEvaluation.outcome === "successful") {
    stats.successCount += 1;
  } else if (goalEvaluation.outcome === "failed") {
    stats.failureCount += 1;
  }

  executionPatternRegistry.set(patternKey, stats);
  recordedExecutionPatternSamples.add(sampleId);
}

function appendExecutionPatternSignal(
  goalEvaluation: LabExecutionGoalEvaluation,
  patternSignal: LabExecutionGoalEvaluation["patternSignal"]
): LabExecutionGoalEvaluation {
  if (patternSignal === undefined) {
    return goalEvaluation;
  }

  const note = patternSignal.note;
  return {
    ...goalEvaluation,
    patternSignal,
    ...(note !== undefined && !goalEvaluation.summary.includes(note)
      ? { summary: `${goalEvaluation.summary} ${note}` }
      : {}),
  };
}

export function __testOnlyResetExecutionPatternRegistry() {
  executionPatternRegistry.clear();
  recordedExecutionPatternSamples.clear();
  activeExecutionGoalEvaluationCache.clear();
}

export function __testOnlyBuildExecutionPatternKey(input: {
  actionType: string;
  selectionSnapshot?: LabExecutionSelectionSnapshot;
}) {
  return buildExecutionPatternKey(input);
}

function getReflectionFeedbackLine(interpretation: LabExecutionResultInterpretation) {
  if (interpretation.coverageLevel === "low") {
    return "Result shows limited coverage";
  }
  if (interpretation.alignment === "deviates") {
    return "Detected structure differs from initial simulation";
  }
  if (interpretation.alignment === "matches-simulation") {
    return "Output aligns with simulated expectations";
  }
  return "Result partially aligns with simulated expectations";
}

function appendReflectionFeedback(
  reflection: LabExecutionReflection,
  interpretation: LabExecutionResultInterpretation | null,
  goalEvaluation: LabExecutionGoalEvaluation | null
): LabExecutionReflection {
  const feedbackLines: string[] = [];

  if (interpretation !== null) {
    const feedbackLine = getReflectionFeedbackLine(interpretation);
    if (!reflection.summary.includes(feedbackLine)) {
      feedbackLines.push(feedbackLine);
    }
  }

  if (goalEvaluation !== null && !reflection.summary.includes(goalEvaluation.summary)) {
    feedbackLines.push(goalEvaluation.summary);
  }

  if (feedbackLines.length === 0) {
    return reflection;
  }
  return {
    ...reflection,
    summary: `${reflection.summary} ${feedbackLines.join(" ")}`,
  };
}

export {
  getActiveProject,
  getCurrentFeatureId,
  getCurrentFeatureMeta,
  getCurrentFeatureProcessRecord,
  getCurrentFeatureReportRecord,
  getProjectEdit,
  getProjectProfile,
  getProjectSource,
  getProjects,
  getSnapshot,
} from "./selectors/lab-project-selectors.js";
export {
  getActiveEditOutput,
  getActiveModule,
  getActivePreviewArtifact,
  getAssetById,
  getAssets,
  getAssetsByRun,
  getAssetsBySource,
  getAssetsByType,
  getAudioVisualizationArtifact,
  getComparisonVariants,
  getCurrentReports,
  getCurrentRun,
  getCurrentSourceAsset,
  getEditOutputs,
  getEditPreview,
  getFeatureCompatibility,
  getLinkedAudioAssets,
  getParentSourceForAsset,
  getPreviewArtifacts,
  getProfileModelCatalog,
  getReportExports,
  getRunSnapshotSummary,
  getSelectedProfileModel,
  getSourceKind,
  getSourceMetadata,
  getSourceMode,
  getSourceProbeStatus,
  getSourceStatus,
  getToolState,
  getWorkbench,
} from "./selectors/lab-source-selectors.js";

function normalizeIntentIdList(value: unknown) {
  const sourceIds = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
  return WORKSPACE_INTENTS.map(function (intent) {
    return intent.id;
  }).filter(function (intentId, index, allIntentIds) {
    return sourceIds.includes(intentId) && allIntentIds.indexOf(intentId) === index;
  });
}

function getEffectiveSelectedCapabilities(state: LabStoreState) {
  const intentDerivedCapabilities = getIntentDerivedCapabilities(state);
  if (intentDerivedCapabilities.length > 0) {
    return intentDerivedCapabilities;
  }
  return getSelectedCapabilities(state);
}

export function getCurrentPreflight(state: LabStoreState): LabPreflightResult {
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
      reason: "Önce kaynak seçilmelidir.",
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
      reason: "Kaynak probe tamamlanmadan ön kontrol doğrulanamaz.",
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
      reason: "Önce en az bir yetenek ailesi seçilmelidir.",
    };
  }

  const selectedEntries = getAvailableCapabilities(state).filter(function (entry) {
    return selectedCapabilities.includes(entry.id);
  });
  const blockedEntries = selectedEntries.filter(function (entry) {
    return entry.readiness === "blocked";
  });
  const warningEntries = selectedEntries.filter(function (entry) {
    return entry.readiness === "optional";
  });

  const missingDependencies = blockedEntries.map(function (entry) {
    return entry.label;
  });
  const warnings = warningEntries.map(function (entry) {
    return entry.blockReason || `${entry.label} kısmi hazırlıkta.`;
  });
  const hostPreflight = state.preflight;
  const stageReady = blockedEntries.length === 0 && selectedEntries.length > 0;

  return {
    status: stageReady !== true ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    missingDependencies,
    warnings:
      hostPreflight && hostPreflight.warnings.length > 0
        ? Array.from(new Set(hostPreflight.warnings.concat(warnings)))
        : warnings,
    estimatedRuntime:
      hostPreflight?.estimatedRuntime || Math.max(60, Math.round(selectedEntries.length * 75)),
    enabledModules: Array.isArray(selectedCapabilities) ? selectedCapabilities.slice() : [],
    stageReady,
    rawStatus: hostPreflight?.rawStatus || null,
    reason:
      stageReady !== true
        ? blockedEntries[0]?.blockReason || "Seçili yetenekler henüz hazır değil."
        : warnings.length > 0
          ? "Araç uyarıları var ama işlem başlatılabilir."
          : null,
  };
}

export function getExpectedOutputs(intentId: string): LabExpectedOutput[] {
  switch (intentId) {
    case "visual-inspection":
      return [
        { intentId, label: "Frame çıktıları", assetTypes: ["frame", "image"] },
        { intentId, label: "Anomali verileri", assetTypes: ["artifact"] },
      ];
    case "audio-investigation":
      return [{ intentId, label: "Ses çıktısı", assetTypes: ["audio"] }];
    default:
      return [];
  }
}

export function getActualOutputs(state: LabStoreState, intentId: string): LabAsset[] {
  return getAssets(state).filter(function (asset) {
    return Array.isArray(asset.intentIds) && asset.intentIds.includes(intentId);
  });
}

export function isExpectedOutputMatched(
  expectedOutput: LabExpectedOutput,
  actualOutputs: LabAsset[]
): boolean {
  return expectedOutput.assetTypes.some(function (assetType) {
    return actualOutputs.some(function (asset) {
      return asset.type === assetType;
    });
  });
}

/** @deprecated Use condition-driven readiness selectors instead (getSourceActionBlockReason, getEditActionBlockReason, etc.) */
export function getStageBlockReason(state: LabStoreState, stage: LabStage): string | null {
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

/** @deprecated Use condition-driven readiness selectors instead */
export function canAdvanceToStage(state: LabStoreState, stage: LabStage) {
  return getStageBlockReason(state, stage) === null;
}

export function getPrimaryActionLabel(state: LabStoreState, _stage: LabStage) {
  // Condition-driven: _stage parameter is accepted for compat but real state decides
  const sourceProbeStatus = getSourceProbeStatus(state);

  if (hasReportPayload(state) && (state.ui.workspace.reportOverlayOpen || isRunComplete(state))) {
    return "Raporları Dışa Aktar";
  }
  if (isRunActive(state)) {
    return "Çalışmayı İptal Et";
  }
  if (getSourceReady(state)) {
    return asNonEmptyString(getEditPreview(state)["status"]) === "ready"
      ? "Önizlemeyi Yenile"
      : "Önizleme Üret";
  }
  return sourceProbeStatus === "completed" ? "Kaynağı Yenile" : "Kaynağı Hazırla";
}

export function getVisibleEvents(state: LabStoreState) {
  const feed = Array.isArray(state.run?.events)
    ? state.run.events.slice().sort(function (left, right) {
        return right.timestamp - left.timestamp;
      })
    : [];
  const windowSize = state.ui.eventFeedExpanded ? 40 : 18;
  const windowStart = state.ui.eventFeedExpanded ? state.ui.eventFeedCursor : 0;
  return Array.isArray(feed) ? feed.slice(windowStart, windowStart + windowSize) : [];
}

export function hasMoreVisibleEvents(state: LabStoreState) {
  const totalCount = Array.isArray(state.run?.events) ? state.run.events.length : 0;
  const windowSize = state.ui.eventFeedExpanded ? 40 : 18;
  const windowStart = state.ui.eventFeedExpanded ? state.ui.eventFeedCursor : 0;
  return totalCount > windowStart + windowSize;
}

export function getVisibleEventOffset(state: LabStoreState) {
  return state.ui.eventFeedExpanded ? state.ui.eventFeedCursor : 0;
}

export function getVisibleRawLogs(state: LabStoreState) {
  const rawLog = Array.isArray(state.run?.rawLog) ? state.run.rawLog : [];
  return Array.isArray(rawLog) ? rawLog.slice(0, state.ui.eventFeedExpanded ? 40 : 12) : [];
}

export function getGlobalActivityFeed(state: LabStoreState) {
  return Array.isArray(state.activityFeed) ? state.activityFeed.slice() : [];
}

export function getUserActions(state: LabStoreState): LabUserActionEvent[] {
  const activeProjectId = state.projectIndex.activeProjectId;
  const userActions = Array.isArray(state.userActions) ? state.userActions : [];
  if (activeProjectId === null) {
    return userActions.slice();
  }
  return userActions.filter(function (entry) {
    return entry.projectId === null || entry.projectId === activeProjectId;
  });
}

export function getRecentUserActions(state: LabStoreState, limit = 6): LabUserActionEvent[] {
  return getUserActions(state).slice(0, Math.min(limit, LAB_USER_ACTION_HISTORY_LIMIT));
}

export function getHubUserActions(state: LabStoreState, limit = 4): LabUserActionEvent[] {
  return getUserActions(state)
    .filter(function (entry) {
      return (
        entry.status === "running" || entry.status === "error" || entry.dismissedFromHubAt == null
      );
    })
    .slice(0, limit);
}

export function getActionOutputs(state: LabStoreState, actionId: string): LabAsset[] {
  const action = getUserActions(state).find(function (entry) {
    return entry.id === actionId;
  });
  if (
    !action ||
    Array.isArray(action.resultAssetIds) !== true ||
    action.resultAssetIds.length === 0
  ) {
    return [];
  }
  return action.resultAssetIds
    .map(function (assetId) {
      return getAssetById(state, assetId);
    })
    .filter((asset): asset is LabAsset => asset !== null);
}

export function getVisibleArtifacts(state: LabStoreState) {
  const run = getCurrentRun(state);
  const artifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
  if (!state.ui.artifactListExpanded) {
    return Array.isArray(artifacts) ? artifacts.slice(0, 12) : [];
  }
  return Array.isArray(artifacts) ? artifacts.slice(0, state.ui.artifactRenderCount) : [];
}

export function hasMoreVisibleArtifacts(state: LabStoreState) {
  const run = getCurrentRun(state);
  const artifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
  return artifacts.length > getVisibleArtifacts(state).length;
}

export function getProcessAnalysisScope(state: LabStoreState) {
  const run = getCurrentRun(state);
  return (
    run?.analysisScope || normalizeAnalysisScope(asLabRecord(state.workbench)["analysisScope"])
  );
}

export function getVisibleLiveFindings(state: LabStoreState) {
  const run = getCurrentRun(state);
  const findings = Array.isArray(run?.liveFindings) ? run.liveFindings : [];
  return Array.isArray(findings) ? findings.slice(0, state.ui.liveFindingsExpanded ? 18 : 6) : [];
}

export function hasMoreVisibleLiveFindings(state: LabStoreState) {
  const run = getCurrentRun(state);
  const findings = Array.isArray(run?.liveFindings) ? run.liveFindings : [];
  return findings.length > getVisibleLiveFindings(state).length;
}

export function getSelectedCapabilities(state: LabStoreState): CapabilityFamilyId[] {
  return state.selectedCapabilities;
}

export function getAvailableCapabilities(state: LabStoreState) {
  const sourceKind = getSourceKind(state);
  const sourceReady = state.source !== null && state.sourceProbeStatus === "completed";
  const toolState = getToolState(state);
  const toolRegistry = asLabRecord(toolState["tools"]);
  const effectiveSelectedCapabilities = getEffectiveSelectedCapabilities(state);

  return CAPABILITY_FAMILIES.map(function (family) {
    const sourceCompatible = family.sourceKinds.includes(sourceKind as "video" | "audio" | "image");
    const toolsReady = family.requiredTools.every(function (toolId) {
      const tool = asLabRecord(toolRegistry[toolId]);
      return tool["installed"] === true || asNonEmptyString(tool["status"]) === "installed";
    });
    const toolsMissing = family.requiredTools.filter(function (toolId) {
      const tool = asLabRecord(toolRegistry[toolId]);
      return tool["installed"] !== true && asNonEmptyString(tool["status"]) !== "installed";
    });

    let readiness: "ready" | "optional" | "blocked" = "ready";
    let blockReason: string | null = null;

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
      selected: effectiveSelectedCapabilities.includes(family.id),
    };
  });
}

export function getCapabilityWorkflowSummary(state: LabStoreState) {
  const selected = getEffectiveSelectedCapabilities(state);
  const available = getAvailableCapabilities(state);
  const selectedFamilies = available.filter(function (entry) {
    return selected.includes(entry.id);
  });
  const readyCount = selectedFamilies.filter(function (entry) {
    return entry.readiness === "ready";
  }).length;

  return {
    familyCount: selectedFamilies.length,
    readyCount,
    blockedCount: selectedFamilies.length - readyCount,
    selectedIds: selected,
  };
}

// V2.3 workspace selectors

export function getWorkspaceMode(
  state: LabStoreState
): import("../models/lab-types.js").WorkspaceMode {
  if (!state.bootReady && state.source === null) {
    return "loading";
  }
  const run = getCurrentRun(state);
  if (run && (run.state === "running" || run.state === "queued")) {
    return "analyzing";
  }
  if (
    run &&
    (run.state === "completed" ||
      run.state === "ready" ||
      run.state === "failed" ||
      run.state === "cancelled")
  ) {
    return "complete";
  }
  return "workspace";
}

export function getSourceReady(state: LabStoreState): boolean {
  return state.source !== null && state.sourceProbeStatus === "completed";
}

export function getActiveSelection(state: LabStoreState): LabSelection | null {
  return state.ui.workspace.activeSelection;
}

export function isSelectionValid(state: LabStoreState): boolean {
  const selection = getActiveSelection(state);
  return selection !== null && selection.endMs > selection.startMs;
}

export function getSelectionDuration(state: LabStoreState): number {
  const selection = getActiveSelection(state);
  if (selection === null || selection.endMs <= selection.startMs) {
    return 0;
  }
  return selection.endMs - selection.startMs;
}

export function getSelectionIntent(state: LabStoreState): LabSelectionIntent {
  return state.ui.workspace.activeSelection?.intent ?? "unknown";
}

export function getInspectionMode(state: LabStoreState): LabInspectionMode {
  return state.ui.inspectionMode;
}

export function getRoiFocusActive(state: LabStoreState): boolean {
  return state.ui.roiFocusActive === true;
}

export function getActiveInspectionSnapshot(state: LabStoreState) {
  return state.ui.activeInspectionSnapshot;
}

export function getActiveSuggestionPreviewId(state: LabStoreState): string | null {
  return state.ui.activeSuggestionPreviewId;
}

export function getActiveExecutionIntentId(state: LabStoreState): string | null {
  return state.ui.activeExecutionIntentId;
}

export function getSelectionSuggestions(state: LabStoreState): LabActionSuggestion[] {
  return getSelectionSuggestionsForContext(getActiveSelection(state), {
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
  });
}

export function getInterpretationItems(state: LabStoreState): LabInterpretationItem[] {
  return buildInterpretationItems({
    activeSelection: getActiveSelection(state),
    audioFocus: getEffectivePreviewAudioFocusSettings(state),
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
  });
}

export function buildSuggestionPreview(
  suggestion: LabActionSuggestion,
  selection: LabSelection
): LabSuggestionPreview {
  return buildSelectionSuggestionPreview(suggestion, selection);
}

export function getActiveSuggestionPreview(state: LabStoreState): LabSuggestionPreview | null {
  const previewId = getActiveSuggestionPreviewId(state);
  const activeSelection = getActiveSelection(state);
  if (
    previewId === null ||
    activeSelection === null ||
    activeSelection.endMs <= activeSelection.startMs
  ) {
    return null;
  }
  const suggestion = getSelectionSuggestions(state).find(function (entry) {
    return entry.id === previewId;
  });
  if (!suggestion) {
    return null;
  }
  return buildSuggestionPreview(suggestion, activeSelection);
}

export function getActiveExecutionIntent(state: LabStoreState): LabActionSuggestion | null {
  const activeExecutionIntentId = getActiveExecutionIntentId(state);
  if (activeExecutionIntentId === null) {
    return null;
  }
  return (
    getSelectionSuggestions(state).find(function (entry) {
      return entry.id === activeExecutionIntentId;
    }) || null
  );
}

export function getActiveExecutionPlan(state: LabStoreState): LabExecutionPlan | null {
  const activeExecutionIntent = getActiveExecutionIntent(state);
  const activeSelection = getActiveSelection(state);
  if (
    activeExecutionIntent === null ||
    activeSelection === null ||
    activeSelection.endMs <= activeSelection.startMs
  ) {
    return null;
  }
  return buildExecutionPlan({
    suggestion: activeExecutionIntent,
    activeSelection,
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
  });
}

export function getActiveExecutionSimulation(state: LabStoreState): LabExecutionSimulation | null {
  const activeExecutionPlan = getActiveExecutionPlan(state);
  const activeSelection = getActiveSelection(state);
  if (
    activeExecutionPlan === null ||
    activeSelection === null ||
    activeSelection.endMs <= activeSelection.startMs
  ) {
    return null;
  }
  return buildExecutionSimulation({
    executionPlan: activeExecutionPlan,
    activeSelection,
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
    audioFocus: getEffectivePreviewAudioFocusSettings(state),
  });
}

export function getActiveExecutionReadiness(state: LabStoreState): LabExecutionReadiness | null {
  const activeExecutionPlan = getActiveExecutionPlan(state);
  const activeExecutionSimulation = getActiveExecutionSimulation(state);
  const activeSelection = getActiveSelection(state);
  if (
    activeExecutionPlan === null ||
    activeExecutionSimulation === null ||
    activeSelection === null ||
    activeSelection.endMs <= activeSelection.startMs
  ) {
    return null;
  }
  return buildExecutionReadiness({
    executionPlan: activeExecutionPlan,
    executionSimulation: activeExecutionSimulation,
    activeSelection,
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
    audioFocus: getEffectivePreviewAudioFocusSettings(state),
  });
}

export function getActiveExecutionPayloadPreview(
  state: LabStoreState
): LabExecutionPayloadPreview | null {
  return buildExecutionPayloadPreviewFromResolved({
    executionPlan: getActiveExecutionPlan(state),
    executionSimulation: getActiveExecutionSimulation(state),
    executionReadiness: getActiveExecutionReadiness(state),
    activeSelection: getActiveSelection(state),
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
  });
}

function getBaseActiveExecutionReflection(state: LabStoreState): LabExecutionReflection | null {
  return buildExecutionReflectionFromResolved({
    executionPlan: getActiveExecutionPlan(state),
    executionSimulation: getActiveExecutionSimulation(state),
    executionReadiness: getActiveExecutionReadiness(state),
    executionPayloadPreview: getActiveExecutionPayloadPreview(state),
    activeSelection: getActiveSelection(state),
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
  });
}

export function getActiveExecutionReflection(state: LabStoreState): LabExecutionReflection | null {
  const reflection = getBaseActiveExecutionReflection(state);
  if (reflection === null) {
    return null;
  }
  return appendReflectionFeedback(
    reflection,
    getActiveExecutionResultInterpretation(state),
    getActiveExecutionGoalEvaluation(state)
  );
}

function getBaseActiveExecutionAlternatives(state: LabStoreState): LabExecutionAlternatives | null {
  return buildExecutionAlternativesFromResolved({
    executionPlan: getActiveExecutionPlan(state),
    executionSimulation: getActiveExecutionSimulation(state),
    executionReadiness: getActiveExecutionReadiness(state),
    executionReflection: getBaseActiveExecutionReflection(state),
    activeSelection: getActiveSelection(state),
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
  });
}

export function getActiveExecutionAlternatives(
  state: LabStoreState
): LabExecutionAlternatives | null {
  return buildExecutionAlternativesFromResolved({
    executionPlan: getActiveExecutionPlan(state),
    executionSimulation: getActiveExecutionSimulation(state),
    executionReadiness: getActiveExecutionReadiness(state),
    executionReflection: getActiveExecutionReflection(state),
    executionResult: getActiveExecutionResult(state),
    executionGoalEvaluation: getActiveExecutionGoalEvaluation(state),
    executionResultInterpretation: getActiveExecutionResultInterpretation(state),
    activeSelection: getActiveSelection(state),
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
  });
}

function getBaseActiveExecutionCandidate(state: LabStoreState): LabExecutionCandidate | null {
  return buildExecutionCandidateFromResolved({
    executionPlan: getActiveExecutionPlan(state),
    executionSimulation: getActiveExecutionSimulation(state),
    executionReadiness: getActiveExecutionReadiness(state),
    executionPayloadPreview: getActiveExecutionPayloadPreview(state),
    executionReflection: getBaseActiveExecutionReflection(state),
    executionAlternatives: getBaseActiveExecutionAlternatives(state),
    activeSelection: getActiveSelection(state),
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
  });
}

export function getActiveExecutionCandidate(state: LabStoreState): LabExecutionCandidate | null {
  return buildExecutionCandidateFromResolved({
    executionPlan: getActiveExecutionPlan(state),
    executionSimulation: getActiveExecutionSimulation(state),
    executionReadiness: getActiveExecutionReadiness(state),
    executionPayloadPreview: getActiveExecutionPayloadPreview(state),
    executionReflection: getActiveExecutionReflection(state),
    executionAlternatives: getActiveExecutionAlternatives(state),
    executionResult: getActiveExecutionResult(state),
    executionGoalEvaluation: getActiveExecutionGoalEvaluation(state),
    executionResultInterpretation: getActiveExecutionResultInterpretation(state),
    activeSelection: getActiveSelection(state),
    inspectionMode: getInspectionMode(state),
    sourceKind: getSourceKind(state),
  });
}

function getBaseActiveExecutionCommitment(state: LabStoreState): LabExecutionCommitment | null {
  const commitment = state.ui.activeExecutionCommitment;
  if (commitment === null || commitment.status !== "committed") {
    return null;
  }
  const candidate = getBaseActiveExecutionCandidate(state);
  if (
    candidate === null ||
    candidate.planId !== commitment.planId ||
    candidate.status !== commitment.candidateStatus ||
    candidate.status === "not-viable"
  ) {
    return null;
  }
  return commitment;
}

export function getActiveExecutionCommitment(state: LabStoreState): LabExecutionCommitment | null {
  const commitment = state.ui.activeExecutionCommitment;
  if (commitment === null || commitment.status !== "committed") {
    return null;
  }
  const candidate = getActiveExecutionCandidate(state);
  if (
    candidate === null ||
    candidate.planId !== commitment.planId ||
    candidate.status !== commitment.candidateStatus ||
    candidate.status === "not-viable"
  ) {
    return null;
  }
  return commitment;
}

function getBaseActiveExecutionStaging(state: LabStoreState): LabExecutionStaging | null {
  return buildExecutionStagingFromResolved({
    executionPlan: getActiveExecutionPlan(state),
    executionSimulation: getActiveExecutionSimulation(state),
    executionReadiness: getActiveExecutionReadiness(state),
    executionPayloadPreview: getActiveExecutionPayloadPreview(state),
    executionReflection: getBaseActiveExecutionReflection(state),
    executionAlternatives: getBaseActiveExecutionAlternatives(state),
    executionCandidate: getBaseActiveExecutionCandidate(state),
    executionCommitment: getBaseActiveExecutionCommitment(state),
    activeSelection: getActiveSelection(state),
  });
}

export function getActiveExecutionStaging(state: LabStoreState): LabExecutionStaging | null {
  return buildExecutionStagingFromResolved({
    executionPlan: getActiveExecutionPlan(state),
    executionSimulation: getActiveExecutionSimulation(state),
    executionReadiness: getActiveExecutionReadiness(state),
    executionPayloadPreview: getActiveExecutionPayloadPreview(state),
    executionReflection: getActiveExecutionReflection(state),
    executionAlternatives: getActiveExecutionAlternatives(state),
    executionCandidate: getActiveExecutionCandidate(state),
    executionCommitment: getActiveExecutionCommitment(state),
    activeSelection: getActiveSelection(state),
  });
}

function getBaseExecutionDispatchCandidate(
  state: LabStoreState
): LabExecutionDispatchCandidate | null {
  const commitment = getBaseActiveExecutionCommitment(state);
  const staging = getBaseActiveExecutionStaging(state);
  const payloadPreview = getActiveExecutionPayloadPreview(state);
  const activeSelection = getActiveSelection(state);
  if (
    commitment === null ||
    staging === null ||
    payloadPreview === null ||
    activeSelection === null ||
    activeSelection.endMs <= activeSelection.startMs ||
    staging.status !== "staged" ||
    staging.planId !== commitment.planId ||
    payloadPreview.planId !== commitment.planId
  ) {
    return null;
  }
  const selectionSnapshot = createExecutionSelectionSnapshot(state, activeSelection);
  return {
    dispatchId: buildExecutionDispatchId({
      payloadPreview,
      planId: commitment.planId,
      selectionSnapshot,
      staging,
    }),
    actionType: payloadPreview.actionType,
    planId: commitment.planId,
    payloadPreview,
    selectionSnapshot,
    staging,
  };
}

export function getExecutionDispatchCandidate(
  state: LabStoreState
): LabExecutionDispatchCandidate | null {
  const commitment = getActiveExecutionCommitment(state);
  const staging = getActiveExecutionStaging(state);
  const payloadPreview = getActiveExecutionPayloadPreview(state);
  const activeSelection = getActiveSelection(state);
  if (
    commitment === null ||
    staging === null ||
    payloadPreview === null ||
    activeSelection === null ||
    activeSelection.endMs <= activeSelection.startMs ||
    staging.status !== "staged" ||
    staging.planId !== commitment.planId ||
    payloadPreview.planId !== commitment.planId
  ) {
    return null;
  }
  const selectionSnapshot = createExecutionSelectionSnapshot(state, activeSelection);
  return {
    dispatchId: buildExecutionDispatchId({
      payloadPreview,
      planId: commitment.planId,
      selectionSnapshot,
      staging,
    }),
    actionType: payloadPreview.actionType,
    planId: commitment.planId,
    payloadPreview,
    selectionSnapshot,
    staging,
  };
}

function getActiveExecutionRuntimeContext(
  state: LabStoreState
): ActiveExecutionRuntimeContext | null {
  const executionRuntime = state.ui.executionRuntime;
  if (
    executionRuntime.status !== "completed" ||
    executionRuntime.result === undefined ||
    executionRuntime.dispatchId === undefined
  ) {
    return null;
  }
  const dispatchCandidate = getBaseExecutionDispatchCandidate(state);
  if (
    dispatchCandidate === null ||
    dispatchCandidate.dispatchId !== executionRuntime.dispatchId ||
    dispatchCandidate.planId !== executionRuntime.activePlanId
  ) {
    return null;
  }
  return {
    dispatchCandidate,
    result: executionRuntime.result,
  };
}

export function getActiveExecutionResult(state: LabStoreState): LabActiveExecutionResult | null {
  const context = getActiveExecutionRuntimeContext(state);
  if (context === null) {
    return null;
  }
  return {
    ...context.result,
    selectionSnapshot: context.dispatchCandidate.selectionSnapshot,
  };
}

export function getActiveExecutionResultInterpretation(
  state: LabStoreState
): LabExecutionResultInterpretation | null {
  const context = getActiveExecutionRuntimeContext(state);
  if (context === null) {
    return null;
  }
  return buildExecutionResultInterpretation({
    ...context.result,
    actionType: context.dispatchCandidate.actionType,
    selectionSnapshot: context.dispatchCandidate.selectionSnapshot,
  });
}

export function getActiveExecutionGoalEvaluation(
  state: LabStoreState
): LabExecutionGoalEvaluation | null {
  const context = getActiveExecutionRuntimeContext(state);
  if (context === null) {
    return null;
  }
  const sampleId = buildExecutionPatternSampleId(context);
  const cachedEvaluation = activeExecutionGoalEvaluationCache.get(sampleId);
  if (cachedEvaluation !== undefined) {
    return cachedEvaluation;
  }

  const goalEvaluation = getExecutionGoalEvaluation(
    {
      ...context.result,
      selectionSnapshot: context.dispatchCandidate.selectionSnapshot,
    },
    context.dispatchCandidate.actionType
  );
  const patternKey = buildExecutionPatternKey({
    actionType: context.dispatchCandidate.actionType,
    selectionSnapshot: context.dispatchCandidate.selectionSnapshot,
  });
  const augmentedEvaluation = appendExecutionPatternSignal(
    goalEvaluation,
    getExecutionPatternSignal(patternKey)
  );

  activeExecutionGoalEvaluationCache.set(sampleId, augmentedEvaluation);
  recordExecutionPatternSample(context, goalEvaluation);
  return augmentedEvaluation;
}

export function getExecutionJourneyStep(state: LabStoreState): number {
  if (getActiveExecutionStaging(state) !== null) return 4;
  if (getActiveExecutionCandidate(state) !== null || getActiveExecutionCommitment(state) !== null)
    return 3;
  if (
    getActiveExecutionSimulation(state) !== null ||
    getActiveExecutionReadiness(state) !== null ||
    getActiveExecutionReflection(state) !== null ||
    getActiveExecutionAlternatives(state) !== null
  )
    return 2;
  if (getActiveExecutionPlan(state) !== null) return 1;
  if (getActiveSelection(state) !== null) return 0;
  return -1;
}

function getModuleProgress(run: LabRun | null) {
  if (run === null || Array.isArray(run.moduleOrder) !== true || run.moduleOrder.length === 0) {
    return {
      completedCount: 0,
      totalCount: 0,
    };
  }
  const completedCount = run.moduleOrder.filter(function (moduleId) {
    const status = run.modules[moduleId]?.status;
    return status === "completed" || status === "ready";
  }).length;
  return {
    completedCount,
    totalCount: run.moduleOrder.length,
  };
}

function getPassiveExecutionMilestoneCount(state: LabStoreState) {
  return [
    getActiveExecutionIntent(state),
    getActiveExecutionPlan(state),
    getActiveExecutionSimulation(state),
    getActiveExecutionReadiness(state),
    getActiveExecutionPayloadPreview(state),
    getActiveExecutionReflection(state),
    getActiveExecutionAlternatives(state),
    getActiveExecutionCandidate(state),
    getActiveExecutionCommitment(state),
    getActiveExecutionStaging(state),
  ].filter(Boolean).length;
}

export function getLaboratoryProcessSummary(state: LabStoreState): LabGlobalProcessSummary {
  const run = getCurrentRun(state);
  const activeModule = getActiveModule(state);
  const runningAction = getUserActions(state).find(function (action) {
    return action.status === "running";
  });
  const activeStaging = getActiveExecutionStaging(state);
  const moduleProgress = getModuleProgress(run);
  const passiveMilestones = getPassiveExecutionMilestoneCount(state);

  if (run !== null && (run.state === "running" || run.state === "queued")) {
    const activeTaskLabel =
      activeModule?.title || activeModule?.id || run.targetLabel || runningAction?.label || null;
    return {
      state: "analyzing",
      completedCount: moduleProgress.completedCount,
      totalCount: moduleProgress.totalCount,
      activeTaskLabel,
      progressLabel:
        moduleProgress.totalCount > 0
          ? `${String(moduleProgress.completedCount)} / ${String(moduleProgress.totalCount)}`
          : null,
      tone: "running",
    };
  }

  if (runningAction !== undefined || state.sourceProbeStatus === "running") {
    const activeTaskLabel = runningAction?.label || null;
    const activeTaskKey =
      runningAction?.label === undefined && state.sourceProbeStatus === "running"
        ? "sourcePreparation"
        : null;
    return {
      state: "processing",
      completedCount: 0,
      totalCount: 1,
      activeTaskKey,
      activeTaskLabel,
      progressKey: activeTaskLabel !== null || activeTaskKey !== null ? "oneActiveTask" : null,
      progressLabel: null,
      tone: "running",
    };
  }

  if (activeStaging !== null) {
    return {
      state: "staging",
      completedCount: passiveMilestones,
      totalCount: 9,
      activeTaskLabel: activeStaging.summary,
      progressLabel: `${String(passiveMilestones)} / 9`,
      tone: activeStaging.status === "staged" ? "success" : "warning",
    };
  }

  return {
    state: "idle",
    completedCount: 0,
    totalCount: 0,
    activeTaskLabel: null,
    progressLabel: null,
    tone: "neutral",
  };
}

function formatSelectionRangeLabel(selection: LabSelection | null) {
  if (selection === null || selection.endMs <= selection.startMs) {
    return null;
  }
  return `${String(Math.round(selection.startMs))} ms → ${String(Math.round(selection.endMs))} ms`;
}

export function getLaboratoryRightPanelContext(state: LabStoreState): LabRightPanelContext {
  const selection = getActiveSelection(state);
  const activeIntent = getActiveExecutionIntent(state);
  const candidate = getActiveExecutionCandidate(state);
  const commitment = getActiveExecutionCommitment(state);
  const staging = getActiveExecutionStaging(state);
  return {
    activeIntentLabel: activeIntent?.label || null,
    candidateStatus: candidate?.status || null,
    commitmentStatus: commitment?.status || "none",
    processSummary: getLaboratoryProcessSummary(state),
    selectionLabel: selection?.label || selection?.intent || null,
    selectionRangeLabel: formatSelectionRangeLabel(selection),
    stagingStatus: staging?.status || "none",
  };
}

export function getTimelineSelection(state: LabStoreState) {
  const activeSelection = getActiveSelection(state);
  if (activeSelection !== null && activeSelection.endMs > activeSelection.startMs) {
    return {
      startMs: activeSelection.startMs,
      endMs: activeSelection.endMs,
    };
  }
  return {
    startMs: state.ui.workspace.timelineStartMs,
    endMs: state.ui.workspace.timelineEndMs,
  };
}

function getRoundedAssetMetadataNumber(
  asset: LabAsset | null,
  key: "durationMs" | "startOffsetMs"
): number | null {
  if (asset === null) {
    return null;
  }
  const metadata = asLabRecord(asset.metadata);
  const rawValue = metadata[key];
  return typeof rawValue === "number" && Number.isFinite(rawValue) ? Math.round(rawValue) : null;
}

export function getWaveformTimelineModel(state: LabStoreState) {
  const sourceKind = getSourceKind(state);
  const sourceReady = getSourceReady(state);
  const metadata = getSourceMetadata(state);
  const durationMs =
    sourceReady && typeof metadata["durationSeconds"] === "number"
      ? Math.max(0, Math.round(metadata["durationSeconds"] * 1000))
      : 0;
  const selection = getTimelineSelection(state);
  const dualPreviewActive = isDualPreviewActive(state);
  const selectedAudioAsset = dualPreviewActive ? getSelectedDualPreviewAudioAsset(state) : null;
  const rawWaveformOffsetMs =
    getRoundedAssetMetadataNumber(selectedAudioAsset, "startOffsetMs") || 0;
  const selectedAudioDurationMs = getRoundedAssetMetadataNumber(selectedAudioAsset, "durationMs");
  const waveformContentDurationMs =
    selectedAudioAsset !== null && selectedAudioDurationMs !== null
      ? Math.max(0, selectedAudioDurationMs)
      : durationMs;
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
  const waveformWindowDurationMs =
    durationMs > 0 ? Math.max(0, waveformVisibleEndMs - waveformVisibleStartMs) : 0;
  const waveformCropStartRatio =
    waveformContentDurationMs > 0
      ? Math.max(0, Math.min(1, waveformContentVisibleStartMs / waveformContentDurationMs))
      : 0;
  const waveformCropEndRatio =
    waveformContentDurationMs > 0
      ? Math.max(0, Math.min(1, waveformContentVisibleEndMs / waveformContentDurationMs))
      : 1;
  const hasSelectionInspectionLens =
    (sourceKind === "audio" || sourceKind === "video") &&
    selection.startMs !== null &&
    selection.endMs !== null &&
    selection.endMs > selection.startMs &&
    waveformContentDurationMs > 0;
  const waveformInspectionLensWindowStartMs =
    hasSelectionInspectionLens === true
      ? Math.max(waveformVisibleStartMs, selection.startMs ?? 0)
      : 0;
  const waveformInspectionLensWindowEndMs =
    hasSelectionInspectionLens === true
      ? Math.min(waveformVisibleEndMs, selection.endMs ?? waveformVisibleEndMs)
      : 0;
  const waveformInspectionLensDurationMs =
    hasSelectionInspectionLens === true
      ? Math.max(1, waveformInspectionLensWindowEndMs - waveformInspectionLensWindowStartMs)
      : 0;
  const waveformInspectionLensContentStartMs =
    hasSelectionInspectionLens === true
      ? Math.max(0, waveformInspectionLensWindowStartMs - rawWaveformOffsetMs)
      : 0;
  const waveformInspectionLensContentEndMs =
    hasSelectionInspectionLens === true
      ? Math.max(
          waveformInspectionLensContentStartMs,
          Math.min(
            waveformContentDurationMs,
            waveformInspectionLensWindowEndMs - rawWaveformOffsetMs
          )
        )
      : 0;
  const waveformInspectionLensCropStartRatio =
    hasSelectionInspectionLens === true && waveformContentDurationMs > 0
      ? Math.max(0, Math.min(1, waveformInspectionLensContentStartMs / waveformContentDurationMs))
      : 0;
  const waveformInspectionLensCropEndRatio =
    hasSelectionInspectionLens === true && waveformContentDurationMs > 0
      ? Math.max(
          waveformInspectionLensCropStartRatio,
          Math.min(1, waveformInspectionLensContentEndMs / waveformContentDurationMs)
        )
      : 1;

  return {
    activeExecutionAlternatives: getActiveExecutionAlternatives(state),
    activeExecutionCandidate: getActiveExecutionCandidate(state),
    activeExecutionCommitment: getActiveExecutionCommitment(state),
    activeExecutionPlan: getActiveExecutionPlan(state),
    activeExecutionPayloadPreview: getActiveExecutionPayloadPreview(state),
    activeExecutionReadiness: getActiveExecutionReadiness(state),
    activeExecutionReflection: getActiveExecutionReflection(state),
    activeExecutionSimulation: getActiveExecutionSimulation(state),
    activeExecutionStaging: getActiveExecutionStaging(state),
    activeExecutionIntent: getActiveExecutionIntent(state),
    activeSelection: getActiveSelection(state),
    activeInspectionSnapshot: getActiveInspectionSnapshot(state),
    activeSuggestionPreview: getActiveSuggestionPreview(state),
    audioFocus: getEffectivePreviewAudioFocusSettings(state),
    bookmarks: getBookmarks(state),
    dualPreviewActive,
    durationMs,
    endMs: selection.endMs,
    inspectionMode: getInspectionMode(state),
    interpretationItems: getInterpretationItems(state),
    linkedAudioAssetId: selectedAudioAsset?.id || null,
    roiFocusActive: getRoiFocusActive(state),
    selectionSuggestions: getSelectionSuggestions(state),
    startMs: selection.startMs,
    sourceKind,
    visualizationArtifact: getAudioVisualizationArtifact(state),
    visualizationMode: state.ui.workspace.audioFocus.visualizationMode,
    waveformContentDurationMs,
    waveformCropEndRatio,
    waveformCropStartRatio,
    waveformOffsetMs: rawWaveformOffsetMs,
    waveformSourceLabel:
      selectedAudioAsset?.name ||
      (sourceKind === "audio"
        ? "Source audio"
        : sourceKind === "video"
          ? "Embedded audio"
          : "Waveform"),
    waveformSyncLabel:
      selectedAudioAsset === null
        ? "Preview and waveform share the same master axis."
        : rawWaveformOffsetMs === 0
          ? "Linked audio is aligned to the master axis."
          : `Linked audio offset ${rawWaveformOffsetMs > 0 ? "+" : ""}${String(rawWaveformOffsetMs)} ms`,
    waveformInspectionLens: {
      cropEndRatio: waveformInspectionLensCropEndRatio,
      cropStartRatio: waveformInspectionLensCropStartRatio,
      durationMs: waveformInspectionLensDurationMs,
      enabled: hasSelectionInspectionLens,
      sourceLabel:
        hasSelectionInspectionLens === true
          ? `Micro zoom · ${selection.endMs! - selection.startMs!} ms`
          : "Micro zoom",
      windowDurationMs: waveformInspectionLensDurationMs,
      windowStartMs: waveformInspectionLensWindowStartMs,
    },
    waveformWindowDurationMs:
      sourceKind === "audio" || sourceKind === "video" ? waveformWindowDurationMs : 0,
    waveformWindowStartMs:
      sourceKind === "audio" || sourceKind === "video" ? waveformVisibleStartMs : 0,
  };
}

export function getROIRegions(state: LabStoreState) {
  return state.ui.workspace.roiRegions;
}

export function getActiveROIRegions(state: LabStoreState) {
  return state.ui.workspace.roiRegions.filter(function (entry) {
    return entry.active;
  });
}

export function getInteractiveSettings(state: LabStoreState) {
  return state.ui.workspace.interactiveSettings;
}

export function getAudioFocusSettings(state: LabStoreState) {
  return normalizeAudioFocusSettings(state.ui.workspace.audioFocus);
}

export function getEffectivePreviewAudioFocusSettings(state: LabStoreState) {
  const normalizedSettings = getAudioFocusSettings(state);
  if (isDualPreviewActive(state) !== true) {
    return normalizedSettings;
  }
  return {
    ...normalizedSettings,
    playbackRate: 1,
    preservePitch: true,
  };
}

export function getDualPreviewEnabled(state: LabStoreState) {
  return state.ui.workspace.dualPreviewEnabled === true;
}

export function getDualPreviewVolume(state: LabStoreState) {
  return Math.max(0, Math.min(1, state.ui.workspace.dualPreviewVolume));
}

export function getDualPreviewLinkedAudioAssets(state: LabStoreState): LabAsset[] {
  const currentSourceAsset = getCurrentSourceAsset(state);
  if (
    currentSourceAsset === null ||
    getSourceKind(state) !== "video" ||
    getSourceReady(state) !== true
  ) {
    return [];
  }
  return getLinkedAudioAssets(state, currentSourceAsset.id);
}

export function getSelectedDualPreviewAudioAsset(state: LabStoreState): LabAsset | null {
  const linkedAudioAssets = getDualPreviewLinkedAudioAssets(state);
  if (linkedAudioAssets.length === 0) {
    return null;
  }
  const selectedId = asNonEmptyString(state.ui.workspace.dualPreviewAudioAssetId);
  return (
    linkedAudioAssets.find(function (asset) {
      return asset.id === selectedId;
    }) ||
    linkedAudioAssets[0] ||
    null
  );
}

export function isDualPreviewAvailable(state: LabStoreState) {
  return getDualPreviewLinkedAudioAssets(state).length > 0;
}

export function isDualPreviewActive(state: LabStoreState) {
  return getDualPreviewEnabled(state) && isDualPreviewAvailable(state);
}

export function getBookmarks(state: LabStoreState) {
  return state.ui.workspace.bookmarks;
}

export function getHypothesis(state: LabStoreState) {
  return state.ui.workspace.hypothesis;
}

export function getSelectedIntents(
  state: LabStoreState
): import("../models/lab-types.js").LabIntentId[] {
  return state.ui.workspace.selectedIntents;
}

export function getAvailableIntents(state: LabStoreState) {
  const sourceKind = getSourceKind(state);
  const sourceReady = getSourceReady(state);
  const availableCapabilities = getAvailableCapabilities(state);

  return WORKSPACE_INTENTS.map(function (intent) {
    const sourceCompatible = intent.sourceKinds.includes(sourceKind as "video" | "audio" | "image");
    const capabilityReadiness = intent.internalCapabilities.map(function (capId) {
      const cap = availableCapabilities.find(function (entry) {
        return entry.id === capId;
      });
      return cap ? cap.readiness : "blocked";
    });
    const allBlocked = capabilityReadiness.every(function (entry) {
      return entry === "blocked";
    });
    const someBlocked = capabilityReadiness.some(function (entry) {
      return entry === "blocked";
    });

    let readiness: "ready" | "optional" | "blocked" = "ready";
    let blockReason: string | null = null;

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
      selected: state.ui.workspace.selectedIntents.includes(intent.id),
    };
  });
}

export function getIntentDerivedCapabilities(
  state: LabStoreState
): import("../models/lab-types.js").CapabilityFamilyId[] {
  const selectedIntents = getSelectedIntents(state);
  const capabilitySet = new Set<import("../models/lab-types.js").CapabilityFamilyId>();
  WORKSPACE_INTENTS.forEach(function (intent) {
    if (selectedIntents.includes(intent.id)) {
      intent.internalCapabilities.forEach(function (capId) {
        capabilitySet.add(capId);
      });
    }
  });
  return Array.from(capabilitySet);
}

export function getWorkspaceAnalysisInput(state: LabStoreState) {
  return {
    timeRange: getTimelineSelection(state),
    roiRegions: getActiveROIRegions(state),
    hypothesis: getHypothesis(state),
    selectedIntents: getSelectedIntents(state),
    interactiveSettings: getInteractiveSettings(state),
    bookmarks: getBookmarks(state),
  };
}

export function getWorkspaceDiff(state: LabStoreState): LabWorkspaceDiff | null {
  const snapshotSummary = getRunSnapshotSummary(state);
  if (!snapshotSummary) {
    return null;
  }

  const liveTimeline = getTimelineSelection(state);
  const liveHypothesis = getHypothesis(state).trim();
  const liveIntentIds = normalizeIntentIdList(getSelectedIntents(state));

  const timelineChanged =
    liveTimeline.startMs !== snapshotSummary.timelineStartMs ||
    liveTimeline.endMs !== snapshotSummary.timelineEndMs;
  const hypothesisChanged = liveHypothesis !== (snapshotSummary.hypothesis || "");
  const intentsChanged =
    liveIntentIds.length !== snapshotSummary.intentIds.length ||
    liveIntentIds.some(function (intentId, index) {
      return snapshotSummary.intentIds[index] !== intentId;
    });

  const changedKeys: LabWorkspaceDiff["changedKeys"] = [];
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
    changedKeys,
  };
}

export function getIntentDirtyMap(state: LabStoreState): LabIntentDirtyMap {
  const snapshotSummary = getRunSnapshotSummary(state);
  if (!snapshotSummary) {
    return {} as LabIntentDirtyMap;
  }

  const workspaceDiff = getWorkspaceDiff(state);
  const snapshotIntentIds = normalizeIntentIdList(snapshotSummary.intentIds);
  const liveIntentIds = normalizeIntentIdList(getSelectedIntents(state));
  const allIntentIds = WORKSPACE_INTENTS.map(function (intent) {
    return intent.id;
  }).filter(function (intentId) {
    return snapshotIntentIds.includes(intentId) || liveIntentIds.includes(intentId);
  });

  return allIntentIds.reduce(function (accumulator, intentId) {
    const inSnapshot = snapshotIntentIds.includes(intentId);
    const inWorkspace = liveIntentIds.includes(intentId);
    const changedKeys: Array<"timeline" | "hypothesis" | "selection"> = [];

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
      changedKeys,
    };
    return accumulator;
  }, {} as LabIntentDirtyMap);
}

export function getReportOverlayOpen(state: LabStoreState): boolean {
  return state.ui.workspace.reportOverlayOpen;
}

export function getRunElapsedSeconds(state: LabStoreState): number {
  const run = getCurrentRun(state);
  if (!run) {
    return 0;
  }
  const start = run.startedAt;
  const end = run.endedAt || Date.now();
  const diff = end - start;
  return diff > 0 ? Math.round(diff / 1000) : 0;
}

// ---------------------------------------------------------------------------
// Condition-driven readiness selectors (replaces stage-based gating)
// ---------------------------------------------------------------------------

export function getSourceActionBlockReason(state: LabStoreState): string | null {
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

export function getPreflightSeverity(state: LabStoreState): PreflightSeverity {
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

export function getPreflightWarnings(state: LabStoreState): string[] {
  const preflight = getCurrentPreflight(state);
  const msgs: string[] = [];
  if (preflight.missingDependencies.length > 0) {
    msgs.push(`Eksik dependency: ${preflight.missingDependencies.join(", ")}`);
  }
  preflight.warnings.forEach(function (w) {
    if (!msgs.includes(w)) msgs.push(w);
  });
  if (msgs.length === 0 && preflight.reason) {
    msgs.push(preflight.reason);
  }
  return msgs;
}

export function getAnalysisActionBlockReason(state: LabStoreState): string | null {
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

export function getReportActionBlockReason(state: LabStoreState): string | null {
  const reports = getCurrentReports(state);
  const reportStatus = asNonEmptyString(getCurrentFeatureReportRecord(state)["status"]);
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

export function getEditActionBlockReason(state: LabStoreState): string | null {
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

export function isRunActive(state: LabStoreState): boolean {
  const run = getCurrentRun(state);
  return run !== null && (run.state === "running" || run.state === "queued");
}

export function isRunComplete(state: LabStoreState): boolean {
  const run = getCurrentRun(state);
  return (
    run !== null &&
    (run.state === "completed" ||
      run.state === "ready" ||
      run.state === "failed" ||
      run.state === "cancelled")
  );
}

export function hasReportPayload(state: LabStoreState): boolean {
  const reports = getCurrentReports(state);
  const reportStatus = asNonEmptyString(getCurrentFeatureReportRecord(state)["status"]);
  return (
    reports.user !== null ||
    reports.ai !== null ||
    reportStatus === "ready" ||
    reportStatus === "stale"
  );
}

export function getToolRelevanceFilter(state: LabStoreState) {
  const sourceMode = getSourceMode(state);
  const sourceKind = getSourceKind(state);
  const selectedIntents = getSelectedIntents(state);
  const intentCapabilities = getIntentDerivedCapabilities(state);
  const wsMode = getWorkspaceMode(state);

  const requiredToolIds = new Set<string>();
  CAPABILITY_FAMILIES.forEach(function (family) {
    if (intentCapabilities.includes(family.id)) {
      family.requiredTools.forEach(function (toolId) {
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
    requiredToolIds: Array.from(requiredToolIds),
  };
}

// ---------------------------------------------------------------------------
// Condition-driven freshness & dirty selectors (IFL §4h, §5c)
// ---------------------------------------------------------------------------

export function getReportFreshness(state: LabStoreState): ReportFreshness | null {
  const reports = getCurrentReports(state);
  const reportStatus = asNonEmptyString(getCurrentFeatureReportRecord(state)["status"]);
  const hasReport =
    reports.user !== null ||
    reports.ai !== null ||
    reportStatus === "ready" ||
    reportStatus === "stale";
  if (!hasReport) {
    return null;
  }
  const workspaceDirty = getWorkspaceDiff(state)?.workspaceDirty === true;
  if (reportStatus === "stale") {
    return {
      state: "stale",
      workspaceDirty,
    };
  }
  const run = getCurrentRun(state);
  if (!run) {
    return {
      state: "previous-run",
      workspaceDirty,
    };
  }
  if (run.state === "running" || run.state === "queued") {
    return {
      state: "previous-run",
      workspaceDirty,
    };
  }
  if (run.state === "completed" || run.state === "ready") {
    return {
      state: "current",
      workspaceDirty,
    };
  }
  // failed or cancelled
  return {
    state: "stale",
    workspaceDirty,
  };
}

export function isWorkspaceDirty(state: LabStoreState): boolean {
  return getWorkspaceDiff(state)?.workspaceDirty === true;
}

// ---------------------------------------------------------------------------
// Legacy stage projection — single authoritative derivation for currentStage
// ---------------------------------------------------------------------------

export function resolveDrawerMode(state: LabStoreState): LabDrawerMode {
  if (isRunActive(state)) return "running";
  const run = getCurrentRun(state);
  if (!getSourceReady(state)) return "setup";
  if (!hasReportPayload(state)) {
    if (isRunComplete(state) && asNonEmptyString(run?.emptyReason) !== null) {
      return "explore";
    }
    return "setup";
  }
  if (state.ui.workspace.drawerModeOverride === "setup") {
    return "setup";
  }
  if (state.ui.workspace.drawerModeOverride === "result") {
    return "result";
  }
  const freshness = getReportFreshness(state);
  if (
    freshness?.state === "current" &&
    state.ui.workspace.userExploreToggle !== true
  ) {
    return "result";
  }
  return "explore";
}

export function getDrawerCollapsed(state: LabStoreState): boolean {
  return state.ui.workspace.drawerCollapsed === true;
}

const INTENT_ACTION_PHRASES: Record<LabIntentId, string> = {
  "visual-inspection": "görsel yapıyı ve forensic işaretleri inceleyerek",
  "audio-investigation": "ses sinyallerini analiz ederek",
  "detail-enhancement": "transkript ve kaynak ayrıştırma yaparak",
  "anomaly-detection": "görsel ve işitsel anomali taraması yaparak",
};

const INTENT_OUTPUT_PHRASES: Record<LabIntentId, string> = {
  "visual-inspection": "yapısal anomaliler ve forensic kanıtlar",
  "audio-investigation": "ses anomalileri ve sinyal detayları",
  "detail-enhancement": "konuşma dökümleri ve ayrıştırılmış ses kaynakları",
  "anomaly-detection": "olası anormallikler ve sınıflandırılmış ses olayları",
};

function formatMsAsTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function buildIntentPreviewSentence(state: LabStoreState): string {
  const selectedIntents = getSelectedIntents(state);
  if (selectedIntents.length === 0) return "";
  const timelineSelection = getTimelineSelection(state);
  const metadata = getSourceMetadata(state);
  const durationSeconds =
    typeof metadata["durationSeconds"] === "number" ? metadata["durationSeconds"] : 0;
  const durationMs = Math.round(durationSeconds * 1000);
  const isFullRange =
    (timelineSelection.startMs === null || timelineSelection.startMs <= 0) &&
    (timelineSelection.endMs === null || timelineSelection.endMs >= durationMs - 500);
  const scopeLabel = isFullRange
    ? `tüm kaynak (${formatMsAsTime(durationMs)})`
    : `${formatMsAsTime(timelineSelection.startMs ?? 0)} \u2013 ${formatMsAsTime(timelineSelection.endMs ?? durationMs)}`;
  const actions = selectedIntents
    .map(function (id) {
      return INTENT_ACTION_PHRASES[id] || id;
    })
    .join(", ");
  const outputs = selectedIntents
    .map(function (id) {
      return INTENT_OUTPUT_PHRASES[id] || id;
    });
  const uniqueOutputs = outputs.filter(function (output, index) {
    return outputs.indexOf(output) === index;
  });
  const hypothesis = getHypothesis(state).trim();
  const hypothesisAppend =
    hypothesis.length > 0 ? ` Hipotez: \u201C${hypothesis}\u201D` : "";
  return `Bu analiz ${scopeLabel} üzerinde ${actions} ${uniqueOutputs.join(", ")} tespit edecek.${hypothesisAppend}`;
}

export function deriveLegacyStage(state: LabStoreState): LabStage {
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
