import { createMediaEditActionRuntime } from "./action-handlers-edit.js";
import { createMediaExportActionRuntime } from "./action-handlers-export.js";
import { createMediaAnnotationExportActionRuntime } from "./action-handlers-annotation-export.js";
import { createMediaProfileActionRuntime } from "./action-handlers-profile.js";
import { createMediaProjectActionRuntime } from "./action-handlers-project.js";
import { createMediaSourceActionRuntime } from "./action-handlers-source.js";
import { createLaboratoryBackgroundReferenceConvergenceRuntime } from "./background-reference-convergence.js";
import { createLaboratoryCameraTrackingRuntime } from "./camera-tracking.js";
import { createLaboratoryStructuralTransitionRuntime } from "./structural-transition.js";
import { createLaboratoryTransitionControlPhotometryRuntime } from "./transition-control-photometry.js";
import { createLaboratoryVisualResponseProbeRuntime } from "./visual-response-probe.js";
import {
  isLaboratoryResponseSweepAxis,
  normalizeLaboratoryResponseBackgroundRoi,
} from "../../../shared/visual-response-probe-model.js";
import { normalizeLaboratoryTemporalStressTestRequest } from "../../../shared/temporal-stress-test-model.js";
import { buildLaboratoryVisualResponseReportAssessment } from "../../../shared/visual-response-report-assessment.js";
import type {
  AppearanceTransitionPhase,
  AppearanceTransitionMeasurement,
  AppearanceTransitionResult,
  CameraTrackingCache,
  CameraTransformPoint,
  LaboratoryAnalysisResult,
  StructuralTransitionResult,
  TrackingProvenance,
  VisualResponseRegionMetrics,
  VisualResponseMeasurement,
  VisualResponseResult,
} from "../../../domain/lab-analysis-results.js";
import {
  isCameraTrackingCacheUsableForMeasurement,
  isCameraTransformPointUsableForDiagnostics,
} from "../../../domain/lab-analysis-results.js";

type LaboratoryRecord = Record<string, unknown>;
type NormalizedResponseRoi = NonNullable<
  ReturnType<typeof normalizeLaboratoryResponseBackgroundRoi>
>;

const TRANSITION_OFFSETS = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1] as const;

type MediaSourceActionRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  getDefaultMode: (sourcePresets: unknown, sourceKind: unknown) => string;
  getDefaultSourceType: (sourcePresets: unknown) => string;
  handleLocalPick: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    localFields?: unknown
  ) => Promise<unknown>;
  handleUrlDownload: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  handleYoutubeDownload: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    requestValue?: unknown
  ) => Promise<unknown>;
  handleYoutubeProbe: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    url: string
  ) => Promise<unknown>;
  patchActiveProject: (
    runtime: LaboratoryRecord,
    patcher: (project: LaboratoryRecord) => LaboratoryRecord
  ) => Promise<unknown>;
  patchActiveProjectDrafts: (runtime: LaboratoryRecord, fields: unknown) => Promise<unknown>;
  resetEditForCurrentSource: (runtime: LaboratoryRecord, project: LaboratoryRecord) => void;
  resetProfileForCurrentSource: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    reason: string
  ) => void;
};

type MediaEditActionRuntimeDeps = Parameters<typeof createMediaEditActionRuntime>[0];
type MediaEditActionRuntime = ReturnType<typeof createMediaEditActionRuntime>;
type MediaExportActionRuntimeDeps = Parameters<typeof createMediaExportActionRuntime>[0];
type MediaProfileActionRuntimeDeps = Parameters<typeof createMediaProfileActionRuntime>[0];
type MediaProjectActionRuntimeDeps = Parameters<typeof createMediaProjectActionRuntime>[0];

type MediaActionRuntimeDeps = MediaSourceActionRuntimeDeps &
  MediaEditActionRuntimeDeps &
  MediaExportActionRuntimeDeps &
  MediaProfileActionRuntimeDeps &
  MediaProjectActionRuntimeDeps;

type MediaActionRuntime = ReturnType<typeof createMediaSourceActionRuntime> &
  Omit<MediaEditActionRuntime, "runControlInjection"> & {
    runControlInjection: (
      ...args: Parameters<MediaEditActionRuntime["runControlInjection"]>
    ) => Promise<LaboratoryRecord>;
  } & Omit<ReturnType<typeof createMediaExportActionRuntime>, "captureComparisonMoment"> &
  ReturnType<typeof createMediaAnnotationExportActionRuntime> &
  ReturnType<typeof createMediaProfileActionRuntime> &
  ReturnType<typeof createMediaProjectActionRuntime>;

function asRecord(value: unknown): LaboratoryRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as LaboratoryRecord)
    : {};
}

function finite(record: LaboratoryRecord, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function finiteOrNull(record: LaboratoryRecord, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function similarity(delta: number, tolerance: number) {
  return clamp01(1 - Math.abs(delta) / tolerance);
}

async function sequentialMap<T, U>(
  values: readonly T[],
  mapper: (value: T) => Promise<U>
): Promise<U[]> {
  return values.reduce<Promise<U[]>>(async function (pending, value) {
    const output = await pending;
    output.push(await mapper(value));
    return output;
  }, Promise.resolve([]));
}

function mean(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce(function (sum, value) {
        return sum + value;
      }, 0) / values.length;
}

function buildTrackingProvenance(
  cache: CameraTrackingCache,
  status: TrackingProvenance["status"] = "completed",
  error?: string
): TrackingProvenance {
  const points = cache.transforms.filter(function (point) {
    return Math.abs(point.timeSeconds - cache.anchorSeconds) > 0.001;
  });
  const usable = points.filter(isCameraTransformPointUsableForDiagnostics);
  const measurementUsable = isCameraTrackingCacheUsableForMeasurement(cache);
  const diagnosticMean = (values: number[]) => (values.length === 0 ? null : mean(values));
  return {
    algorithm: cache.algorithm,
    anchorSeconds: cache.anchorSeconds,
    cacheId: cache.cacheId,
    confidence: diagnosticMean(usable.map((point) => point.confidence)),
    ...(error === undefined ? {} : { error }),
    fallbackUsed: !measurementUsable,
    featureCount:
      usable.length === 0 ? null : Math.round(mean(usable.map((point) => point.featureCount))),
    forwardBackwardRatio: diagnosticMean(usable.map((point) => point.forwardBackwardRatio)),
    inlierRatio: diagnosticMean(usable.map((point) => point.inlierRatio)),
    mode: measurementUsable ? cache.mode : "fixed-roi-fallback",
    quality: cache.quality,
    residualErrorPx: diagnosticMean(usable.map((point) => point.residualErrorPx)),
    status,
    transformModel: cache.transformModel,
    transformSeries: status === "completed" ? cache.transforms : [],
    version: cache.version,
  };
}

function resolveResponseBackgroundRoi(request: LaboratoryRecord) {
  return normalizeLaboratoryResponseBackgroundRoi(request["backgroundRoi"]);
}

function requireVisualAnalysisContext(
  deps: MediaActionRuntimeDeps,
  runtime: LaboratoryRecord,
  rawTemporalRequest: unknown,
  backgroundRoi: NormalizedResponseRoi | null
) {
  if (backgroundRoi === null) {
    throw new Error("Select a Background ROI before running the analysis.");
  }
  const projectValue = deps.getActiveProject(runtime);
  if (projectValue === null) throw new Error("Active project is missing.");
  const project = asRecord(projectValue);
  const source = asRecord(project["source"]);
  if (deps.asNonEmptyString(source["kind"]) !== "video") {
    throw new Error("This analysis currently requires a video source.");
  }
  const sourcePath = deps.asNonEmptyString(source["storedPath"]);
  if (sourcePath === null) throw new Error("Prepare a source file before running the analysis.");
  const metadata = asRecord(source["metadata"]);
  const sourceWidth = finiteOrNull(metadata, "width");
  const sourceHeight = finiteOrNull(metadata, "height");
  if (sourceWidth === null || sourceHeight === null || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("Source dimensions are required before running the analysis.");
  }
  const durationSeconds = finiteOrNull(metadata, "durationSeconds");
  const temporalRequest = normalizeLaboratoryTemporalStressTestRequest(
    rawTemporalRequest,
    durationSeconds
  );
  if (temporalRequest === null || temporalRequest.roi === null) {
    throw new Error("Select a valid Target ROI and timeline range before running the analysis.");
  }
  return {
    backgroundRoi,
    durationSeconds,
    project,
    sourceHeight,
    sourcePath,
    sourceWidth,
    targetRoi: temporalRequest.roi,
    temporalRequest,
  };
}

function metricDifference(
  target: VisualResponseRegionMetrics,
  control: VisualResponseRegionMetrics
): NonNullable<AppearanceTransitionPhase["targetVsControl"]> {
  const keys = [
    "visibilityScore",
    "meanLuma",
    "lumaSpread",
    "chromaDistance",
    "edgeEnergy",
    "edgePersistence",
    "frameDifferenceEnergy",
    "temporalPersistence",
    "recoveredDarkFraction",
    "nearBlackFraction",
  ] as const;
  return keys.reduce<NonNullable<AppearanceTransitionPhase["targetVsControl"]>>(function (
    output,
    key
  ) {
    const targetValue = finiteOrNull(target, key);
    const controlValue = finiteOrNull(control, key);
    output[key] = targetValue === null || controlValue === null ? null : targetValue - controlValue;
    return output;
  }, {});
}

function buildControlComparability(
  target: VisualResponseRegionMetrics,
  control: VisualResponseRegionMetrics,
  targetRoi: NormalizedResponseRoi,
  controlRoi: NormalizedResponseRoi
) {
  const targetArea = finite(targetRoi, "width") * finite(targetRoi, "height");
  const controlArea = finite(controlRoi, "width") * finite(controlRoi, "height");
  const areaRatio =
    targetArea > 0 && controlArea > 0
      ? Math.min(targetArea, controlArea) / Math.max(targetArea, controlArea)
      : 0;
  const meanLumaDelta = finite(target, "meanLuma") - finite(control, "meanLuma");
  const lumaSpreadDelta = finite(target, "lumaSpread") - finite(control, "lumaSpread");
  const chromaDelta = finite(target, "chromaDistance") - finite(control, "chromaDistance");
  const edgeDelta = finite(target, "edgeEnergy") - finite(control, "edgeEnergy");
  const score =
    similarity(meanLumaDelta, 0.25) * 0.3 +
    similarity(lumaSpreadDelta, 0.25) * 0.25 +
    similarity(chromaDelta, 0.15) * 0.2 +
    similarity(edgeDelta, 0.12) * 0.15 +
    clamp01(areaRatio / 0.5) * 0.1;
  return {
    score,
    status: score >= 0.75 ? "high" : score >= 0.55 ? "medium" : "low",
    areaRatio,
    meanLumaDelta,
    lumaSpreadDelta,
    chromaDelta,
    edgeEnergyDelta: edgeDelta,
    qualityOnly: true,
  };
}

export function createMediaActionRuntime(deps: MediaActionRuntimeDeps): MediaActionRuntime {
  const mediaSourceActionRuntime = createMediaSourceActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    getDefaultMode: deps.getDefaultMode,
    getDefaultSourceType: deps.getDefaultSourceType,
    handleLocalPick: deps.handleLocalPick,
    handleUrlDownload: deps.handleUrlDownload,
    handleYoutubeDownload: deps.handleYoutubeDownload,
    handleYoutubeProbe: deps.handleYoutubeProbe,
    patchActiveProject: deps.patchActiveProject,
    patchActiveProjectDrafts: deps.patchActiveProjectDrafts,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource,
  });

  const mediaEditActionRuntime = createMediaEditActionRuntime({
    applyEditRecipePatch: deps.applyEditRecipePatch,
    asNonEmptyString: deps.asNonEmptyString,
    audioFeatureId: deps.audioFeatureId,
    callRoomTools: deps.callRoomTools,
    cancelEditJobsForProject: deps.cancelEditJobsForProject,
    createDefaultEditState: deps.createDefaultEditState,
    findEditPreset: deps.findEditPreset,
    getActiveProject: deps.getActiveProject,
    getProjectEditOutputDir: deps.getProjectEditOutputDir,
    markCloseoutAsStale: deps.markCloseoutAsStale,
    markProfileAsStale: deps.markProfileAsStale,
    patchActiveProject: deps.patchActiveProject,
    readBinaryFileBytes: deps.readBinaryFileBytes,
    roomId: deps.roomId,
    runEditPipeline: deps.runEditPipeline,
    toRecord: deps.toRecord,
  });

  const runtimeProjectOutput = function (runtime: LaboratoryRecord, project: LaboratoryRecord) {
    return deps.getProjectEditOutputDir(runtime, project);
  };
  const cameraTrackingRuntime = createLaboratoryCameraTrackingRuntime({
    callRoomTools: deps.callRoomTools,
    getProjectEditOutputDir: runtimeProjectOutput,
    patchActiveProject(runtime, patcher) {
      return deps.patchActiveProject(runtime, function (project) {
        return patcher(asRecord(project));
      });
    },
    readBinaryFileBytes: deps.readBinaryFileBytes,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });
  const visualResponseRuntime = createLaboratoryVisualResponseProbeRuntime({
    callRoomTools: deps.callRoomTools,
    getActiveProject(runtime) {
      const project = deps.getActiveProject(runtime);
      return project === null ? null : asRecord(project);
    },
    getPreparedSourcePath(project) {
      return deps.asNonEmptyString(asRecord(project["source"])["storedPath"]);
    },
    getProjectEditOutputDir: runtimeProjectOutput,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });
  const structuralTransitionRuntime = createLaboratoryStructuralTransitionRuntime({
    callRoomTools: deps.callRoomTools,
    getProjectEditOutputDir: runtimeProjectOutput,
    readBinaryFileBytes: deps.readBinaryFileBytes,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });
  const backgroundReferenceConvergenceRuntime =
    createLaboratoryBackgroundReferenceConvergenceRuntime({
      callRoomTools: deps.callRoomTools,
      getProjectEditOutputDir: runtimeProjectOutput,
      readBinaryFileBytes: deps.readBinaryFileBytes,
      roomId: deps.roomId,
      toRecord: deps.toRecord,
    });
  const controlPhotometryRuntime = createLaboratoryTransitionControlPhotometryRuntime({
    callRoomTools: deps.callRoomTools,
    getProjectEditOutputDir: runtimeProjectOutput,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });

  const mediaProfileActionRuntime = createMediaProfileActionRuntime({
    applyProfilePresetPatch: deps.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    cancelProfileJobsForProject: deps.cancelProfileJobsForProject,
    clampNumber: deps.clampNumber,
    clampProfileTranscriptSampleSeconds: deps.clampProfileTranscriptSampleSeconds,
    createEmptyProfilePreflight: deps.createEmptyProfilePreflight,
    findProfilePreset: deps.findProfilePreset,
    getActiveProject: deps.getActiveProject,
    markProfileAsStale: deps.markProfileAsStale,
    normalizeProfileArtifactPreferences: deps.normalizeProfileArtifactPreferences,
    patchActiveProject: deps.patchActiveProject,
    runProfilePreflight: deps.runProfilePreflight,
    toRecord: deps.toRecord,
  });

  const mediaExportActionRuntime = createMediaExportActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    callRoomTools: deps.callRoomTools,
    getActiveProject: deps.getActiveProject,
    getProjectEditOutputDir: deps.getProjectEditOutputDir,
    patchActiveProject: deps.patchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    clearJob: deps.clearJob,
    cancelJobsForProject: deps.cancelJobsForProject,
    toRecord: deps.toRecord,
  });

  const mediaAnnotationExportActionRuntime = createMediaAnnotationExportActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    callRoomTools: deps.callRoomTools,
    getActiveProject: deps.getActiveProject,
    getProjectEditOutputDir: deps.getProjectEditOutputDir,
    patchActiveProject: deps.patchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    clearJob: deps.clearJob,
    toRecord: deps.toRecord,
    fallbackCaptureComparisonMoment: mediaExportActionRuntime.captureComparisonMoment,
  });

  const mediaProjectActionRuntime = createMediaProjectActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    cancelJobById: deps.cancelJobById,
    cancelJobsForProject: deps.cancelJobsForProject,
    cancelFeatureProcess: deps.cancelFeatureProcess,
    checkAllToolUpdates: deps.checkAllToolUpdates,
    checkToolUpdates: deps.checkToolUpdates,
    createProject: deps.createProject,
    deleteProject: deps.deleteProject,
    ensureProjectExists: deps.ensureProjectExists,
    exportFeatureReport: deps.exportFeatureReport,
    handleToolMutation: deps.handleToolMutation,
    patchActiveProject: deps.patchActiveProject,
    refreshActiveProjectMetadata: deps.refreshActiveProjectMetadata,
    refreshToolStatus: deps.refreshToolStatus,
    runFeatureProcess: deps.runFeatureProcess,
    updateAllTools: deps.updateAllTools,
    updateSelectedTools: deps.updateSelectedTools,
  });

  const originalRunControlInjection = mediaEditActionRuntime.runControlInjection;
  const measureControlInjection = mediaEditActionRuntime.measureControlInjection;
  type RunControlInjectionArgs = Parameters<typeof originalRunControlInjection>;

  async function persistCompositeResult(
    runtime: RunControlInjectionArgs[0],
    result: LaboratoryAnalysisResult | LaboratoryRecord
  ) {
    await deps.patchActiveProject(runtime, function (project) {
      const edit = asRecord(asRecord(project)["edit"]);
      const existing = Array.isArray(edit["temporalStressTests"])
        ? (edit["temporalStressTests"] as unknown[])
        : [];
      asRecord(project)["edit"] = {
        ...edit,
        temporalStressTests: [result, ...existing].slice(0, 30),
        lastActionAt: asRecord(result)["createdAt"],
        lastError: null,
      };
      return project;
    });
  }

  function createFallbackTrackingCache(input: {
    anchorSeconds: number;
    exclusionRois: Array<NormalizedResponseRoi | null>;
    preferredReferenceRoi: NormalizedResponseRoi;
    requestId: string;
    sampleTimes: number[];
    sourceHeight: number;
    sourcePath: string;
    sourceWidth: number;
  }): CameraTrackingCache {
    const createdAt = new Date().toISOString();
    const transformTimes = [...new Set([input.anchorSeconds, ...input.sampleTimes])].sort(
      function (left, right) {
        return left - right;
      }
    );
    const transforms: CameraTransformPoint[] = transformTimes.map(function (timeSeconds) {
      return {
        confidence: 0,
        featureCount: 0,
        forwardBackwardRatio: 0,
        inlierCount: 0,
        inlierRatio: 0,
        quality: "unreliable",
        residual: { dx: 0, dy: 0, rotationDegrees: 0, scale: 1 },
        residualErrorPx: 0,
        timeSeconds,
        transform: { dx: 0, dy: 0, rotationDegrees: 0, scale: 1 },
      };
    });
    const requestToken = input.requestId.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 64);
    return {
      algorithm: "feature-similarity-ransac",
      anchorSeconds: input.anchorSeconds,
      cacheId: `camera-tracking-${requestToken || "request"}-${createdAt.replace(/[:.]/g, "-")}`,
      createdAt,
      exclusionRois: input.exclusionRois.filter(
        (roi): roi is NormalizedResponseRoi => roi !== null
      ),
      fallbackUsed: true,
      mode: "fixed-roi-fallback",
      preferredReferenceRoi: input.preferredReferenceRoi,
      quality: "unreliable",
      sourceHeight: input.sourceHeight,
      sourcePath: input.sourcePath,
      sourceWidth: input.sourceWidth,
      transformModel: "similarity-dx-dy-rotation-scale",
      transforms,
      version: 2,
    };
  }

  async function resolveTrackingCache(input: {
    anchorSeconds: number;
    durationSeconds: number | null;
    exclusionRois: Array<NormalizedResponseRoi | null>;
    preferredReferenceRoi: NormalizedResponseRoi;
    project: LaboratoryRecord;
    requestId: string;
    runtime: RunControlInjectionArgs[0];
    sampleTimes: number[];
    sourceHeight: number;
    sourcePath: string;
    sourceWidth: number;
  }) {
    try {
      return {
        cache: await cameraTrackingRuntime.getOrCreateTrackingCache(input),
        error: null,
      };
    } catch (error) {
      const cache = createFallbackTrackingCache(input);
      return {
        cache,
        error: error instanceof Error ? error.message : "Camera tracking failed.",
      };
    }
  }

  function transitionSampleTimes(
    eventSeconds: number,
    durationSeconds: number | null,
    backgroundReferenceSeconds: number | null
  ) {
    const sourceEnd =
      durationSeconds ?? Math.max(eventSeconds + 1, backgroundReferenceSeconds ?? eventSeconds);
    const times = TRANSITION_OFFSETS.map(function (offset) {
      return Math.max(0, Math.min(sourceEnd, eventSeconds + offset));
    });
    if (backgroundReferenceSeconds !== null) {
      times.push(Math.max(0, Math.min(sourceEnd, backgroundReferenceSeconds)));
    }
    return times;
  }

  function enrichVisibilityResult(
    rawResult: VisualResponseMeasurement,
    trackingResolution: Awaited<ReturnType<typeof resolveTrackingCache>>
  ): VisualResponseResult {
    const assessedInterpretation = buildLaboratoryVisualResponseReportAssessment(rawResult);
    const tracking = {
      ...buildTrackingProvenance(
        trackingResolution.cache,
        trackingResolution.error === null ? "completed" : "unavailable",
        trackingResolution.error ?? undefined
      ),
      measurementCoordinateMode: "fixed-roi" as const,
    };
    const limited = tracking.fallbackUsed;
    return {
      ...rawResult,
      schemaVersion: 2,
      tracking,
      interpretation: {
        ...assessedInterpretation,
        ungatedClassification: assessedInterpretation.classification,
        classification: limited
          ? "roi-tracking-quality-limits-response-result"
          : assessedInterpretation.classification,
        trackingQuality: tracking.quality,
        trackingQualityGate: limited ? "limited" : "advisory",
        trackingAppliedToMeasurement: false,
        photometricCoordinateMode: "fixed-roi",
      },
    };
  }

  async function enrichTransitionResult(
    runtime: RunControlInjectionArgs[0],
    requestId: string,
    rawResult: AppearanceTransitionMeasurement,
    context: ReturnType<typeof requireVisualAnalysisContext>,
    controlRoi: ReturnType<typeof normalizeLaboratoryResponseBackgroundRoi>,
    backgroundReferenceSeconds: number | null,
    trackingResolution: Awaited<ReturnType<typeof resolveTrackingCache>>
  ): Promise<AppearanceTransitionResult> {
    const {
      backgroundRoi,
      durationSeconds,
      project: projectRecord,
      sourceHeight,
      sourcePath,
      sourceWidth,
      targetRoi,
      temporalRequest,
    } = context;
    const resultRequest = rawResult.request;
    const eventSeconds = (temporalRequest.startSeconds + temporalRequest.endSeconds) / 2;
    const trackingCache = trackingResolution.cache;
    let structural: StructuralTransitionResult;
    try {
      structural = await structuralTransitionRuntime.analyzeTransition({
        backgroundRoi,
        controlRoi,
        durationSeconds,
        eventSeconds,
        project: projectRecord,
        referenceRoi: backgroundRoi,
        requestId,
        runtime,
        sourceHeight,
        sourcePath,
        sourceWidth,
        targetRoi,
        trackingCache,
      });
    } catch (error) {
      structural = {
        status: "unavailable",
        error: error instanceof Error ? error.message : "Structural transition analysis failed.",
      };
    }

    if (backgroundReferenceSeconds !== null && structural.status === "assessed") {
      try {
        const targetStructuralTimeline = structural.timeline;
        structural = {
          ...structural,
          revealedBackground: await backgroundReferenceConvergenceRuntime.analyzeConvergence({
            backgroundReferenceSeconds,
            durationSeconds,
            eventSeconds,
            project: projectRecord,
            requestId,
            runtime,
            sourceHeight,
            sourcePath,
            sourceWidth,
            targetRoi,
            targetStructuralTimeline,
            trackingCache,
          }),
        };
      } catch (error) {
        structural = {
          ...structural,
          revealedBackground: {
            status: "unavailable",
            referenceTimeSeconds: backgroundReferenceSeconds,
            error:
              error instanceof Error
                ? error.message
                : "Background reference convergence analysis failed.",
          },
        };
      }
    }

    const phases = rawResult.phases;
    type ControlMeasurement = Awaited<
      ReturnType<typeof controlPhotometryRuntime.measureControlPhases>
    >[number];
    let controlMeasurements: ControlMeasurement[] = [];
    if (controlRoi !== null) {
      try {
        controlMeasurements = await controlPhotometryRuntime.measureControlPhases({
          controlRoi,
          phases: phases.map(function (phase) {
            return {
              phase: phase.phase,
              startSeconds: phase.startSeconds,
              endSeconds: phase.endSeconds,
            };
          }),
          project: projectRecord,
          requestId,
          runtime,
          sampleFps: temporalRequest.sampleFps,
          sourcePath,
        });
      } catch {
        controlMeasurements = [];
      }
    }

    const enrichedPhases: AppearanceTransitionPhase[] = phases.map(function (phase) {
      const phaseName = phase.phase;
      const controlEntry = controlMeasurements.find(function (entry) {
        return entry.phase === phaseName;
      });
      const control = controlEntry?.metrics ?? null;
      return {
        ...phase,
        control,
        targetVsControl: control === null ? null : metricDifference(phase.target, control),
      };
    });
    const prePhase = enrichedPhases.find(function (phase) {
      return phase.phase === "pre";
    });
    const preControl = prePhase?.control ?? null;
    const controlComparability =
      controlRoi === null || prePhase === undefined || preControl === null
        ? null
        : buildControlComparability(prePhase.target, preControl, targetRoi, controlRoi);
    const measurementInterpretation = rawResult.interpretation;
    const tracking = buildTrackingProvenance(
      trackingCache,
      trackingResolution.error === null ? "completed" : "unavailable",
      trackingResolution.error ?? undefined
    );
    const trackingLimited = tracking.fallbackUsed;
    const enrichedResult: AppearanceTransitionResult = {
      ...rawResult,
      schemaVersion: 3,
      request: {
        ...resultRequest,
        controlRoi,
        ...(backgroundReferenceSeconds === null ? {} : { backgroundReferenceSeconds }),
      },
      phases: enrichedPhases,
      structural,
      tracking,
      interpretation: {
        ...measurementInterpretation,
        controlComparability,
        photometricCoordinateMode: "fixed-roi",
        structuralCoordinateMode: trackingLimited ? "fixed-roi-fallback" : "camera-similarity",
      },
    };
    return enrichedResult;
  }

  async function runControlInjection(...args: RunControlInjectionArgs) {
    const [runtime, requestId, actionPayload] = args;
    const request = asRecord(actionPayload["request"]);
    const specialKind = deps.asNonEmptyString(request["kind"]);
    const temporalRequest = asRecord(request["temporalRequest"]);

    if (specialKind?.startsWith("response-") === true) {
      const backgroundRoi = resolveResponseBackgroundRoi(request);
      const axis = specialKind.slice("response-".length);
      if (!isLaboratoryResponseSweepAxis(axis)) {
        throw new Error("Select a valid response axis before running Visibility Response.");
      }
      const context = requireVisualAnalysisContext(deps, runtime, temporalRequest, backgroundRoi);
      const { startSeconds, endSeconds } = context.temporalRequest;
      const anchorSeconds = (startSeconds + endSeconds) / 2;
      const sampleTimes: number[] = [];
      const step = Math.max(0.2, Math.min(0.5, (endSeconds - startSeconds) / 8));
      for (let time = startSeconds; time <= endSeconds + 0.001; time += step) {
        sampleTimes.push(Math.min(endSeconds, time));
      }
      const trackingResolution = await resolveTrackingCache({
        anchorSeconds,
        durationSeconds: context.durationSeconds,
        exclusionRois: [context.targetRoi],
        preferredReferenceRoi: context.backgroundRoi,
        project: context.project,
        requestId,
        runtime,
        sampleTimes,
        sourceHeight: context.sourceHeight,
        sourcePath: context.sourcePath,
        sourceWidth: context.sourceWidth,
      });
      const result = await visualResponseRuntime.runResponseProbe(runtime, requestId, {
        axis,
        temporalRequest: context.temporalRequest,
        backgroundRoi: context.backgroundRoi,
      });
      const finalResult = enrichVisibilityResult(result, trackingResolution);
      await persistCompositeResult(runtime, finalResult);
      return finalResult;
    }

    if (specialKind === "appearance-transition") {
      const backgroundRoi = resolveResponseBackgroundRoi(request);
      const context = requireVisualAnalysisContext(deps, runtime, temporalRequest, backgroundRoi);
      const controlRoi = normalizeLaboratoryResponseBackgroundRoi(request["controlRoi"]);
      const rawBackgroundReferenceSeconds = finiteOrNull(request, "backgroundReferenceSeconds");
      const backgroundReferenceSeconds =
        rawBackgroundReferenceSeconds !== null && rawBackgroundReferenceSeconds >= 0
          ? rawBackgroundReferenceSeconds
          : null;
      const eventSeconds =
        (context.temporalRequest.startSeconds + context.temporalRequest.endSeconds) / 2;
      const trackingResolution = await resolveTrackingCache({
        anchorSeconds: eventSeconds,
        durationSeconds: context.durationSeconds,
        exclusionRois: [context.targetRoi, controlRoi],
        preferredReferenceRoi: context.backgroundRoi,
        project: context.project,
        requestId,
        runtime,
        sampleTimes: transitionSampleTimes(
          eventSeconds,
          context.durationSeconds,
          backgroundReferenceSeconds
        ),
        sourceHeight: context.sourceHeight,
        sourcePath: context.sourcePath,
        sourceWidth: context.sourceWidth,
      });
      const result = await visualResponseRuntime.runTransitionProbe(runtime, requestId, {
        temporalRequest: context.temporalRequest,
        backgroundRoi: context.backgroundRoi,
      });
      const finalResult = await enrichTransitionResult(
        runtime,
        requestId,
        result,
        context,
        controlRoi,
        backgroundReferenceSeconds,
        trackingResolution
      );
      await persistCompositeResult(runtime, finalResult);
      return finalResult;
    }

    if (specialKind === "recompression-ladder") {
      const backgroundRoi = resolveResponseBackgroundRoi(request);
      const crfValues = [18, 24, 30, 36, 42];
      const steps = await sequentialMap(crfValues, async function (crf) {
        const targetResult = asRecord(
          await measureControlInjection(runtime, requestId, {
            request: {
              kind: "recompression",
              params: { baselineCrf: 18, injectedCrf: crf },
              temporalRequest,
            },
          })
        );
        const backgroundResult =
          backgroundRoi === null
            ? null
            : asRecord(
                await measureControlInjection(runtime, requestId, {
                  request: {
                    kind: "recompression",
                    params: { baselineCrf: 18, injectedCrf: crf },
                    temporalRequest: { ...temporalRequest, roi: backgroundRoi },
                  },
                })
              );
        const targetDelta = asRecord(targetResult["delta"]);
        const backgroundDelta = asRecord(backgroundResult?.["delta"]);
        return {
          crf,
          target: targetResult,
          background: backgroundResult,
          differential: {
            meanFrameDifferenceEnergy:
              finite(targetDelta, "meanFrameDifferenceEnergy") -
              finite(backgroundDelta, "meanFrameDifferenceEnergy"),
            meanEdgeEnergy:
              finite(targetDelta, "meanEdgeEnergy") - finite(backgroundDelta, "meanEdgeEnergy"),
            lumaRange: finite(targetDelta, "lumaRange") - finite(backgroundDelta, "lumaRange"),
          },
        };
      });
      const createdAt = new Date().toISOString();
      const result: LaboratoryRecord = {
        schemaVersion: 2,
        kind: "recompression-ladder",
        id: `recompression-ladder-${createdAt.replace(/[:.]/g, "-")}`,
        createdAt,
        request: { temporalRequest, backgroundRoi },
        crfValues,
        steps,
        interpretation: {
          dataQuality: backgroundRoi === null ? "target-only" : "differential",
          classification:
            backgroundRoi === null
              ? "sample-insufficient-for-target-background-comparison"
              : "compare-target-and-background-degradation-curves",
        },
      };
      await persistCompositeResult(runtime, result);
      return result;
    }

    return originalRunControlInjection(...args);
  }

  return {
    ...mediaSourceActionRuntime,
    ...mediaEditActionRuntime,
    runControlInjection,
    ...mediaExportActionRuntime,
    ...mediaAnnotationExportActionRuntime,
    ...mediaProfileActionRuntime,
    ...mediaProjectActionRuntime,
  };
}
