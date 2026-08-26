import { createMediaEditActionRuntime } from "./action-handlers-edit.js";
import { createMediaExportActionRuntime } from "./action-handlers-export.js";
import { createMediaAnnotationExportActionRuntime } from "./action-handlers-annotation-export.js";
import { createMediaProfileActionRuntime } from "./action-handlers-profile.js";
import { createMediaProjectActionRuntime } from "./action-handlers-project.js";
import { createMediaSourceActionRuntime } from "./action-handlers-source.js";
import { createLaboratoryBackgroundReferenceConvergenceRuntime } from "./background-reference-convergence.js";
import { createLaboratoryStructuralTransitionRuntime } from "./structural-transition.js";
import { createLaboratoryTransitionControlPhotometryRuntime } from "./transition-control-photometry.js";
import { createLaboratoryVisualResponseProbeRuntime } from "./visual-response-probe.js";
import { normalizeLaboratoryResponseBackgroundRoi } from "../../../shared/visual-response-probe-model.js";
import { buildLaboratoryVisualResponseReportAssessment } from "../../../shared/visual-response-report-assessment.js";

type LaboratoryRecord = Record<string, unknown>;

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

function resolveLatestResponseBackgroundRoi(
  deps: MediaActionRuntimeDeps,
  runtime: LaboratoryRecord
) {
  const project = deps.getActiveProject(runtime);
  if (project === null) return null;
  const projectRecord = asRecord(project);
  const edit = asRecord(projectRecord["edit"]);
  const sourcePath = deps.asNonEmptyString(asRecord(projectRecord["source"])["storedPath"]);
  const history = Array.isArray(edit["temporalStressTests"])
    ? (edit["temporalStressTests"] as unknown[])
    : [];
  const reference = history.find(function (entry) {
    const record = asRecord(entry);
    return (
      record["kind"] === "motion-reference-lock" &&
      (sourcePath === null || deps.asNonEmptyString(record["sourcePath"]) === sourcePath)
    );
  });
  if (reference === undefined) return null;
  const roi = asRecord(asRecord(reference)["roi"]);
  return normalizeLaboratoryResponseBackgroundRoi(roi);
}

function resolveResponseBackgroundRoi(
  deps: MediaActionRuntimeDeps,
  runtime: LaboratoryRecord,
  request: LaboratoryRecord
) {
  return (
    normalizeLaboratoryResponseBackgroundRoi(request["backgroundRoi"]) ??
    resolveLatestResponseBackgroundRoi(deps, runtime)
  );
}

function metricDifference(target: LaboratoryRecord, control: LaboratoryRecord) {
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
  return keys.reduce<LaboratoryRecord>(function (output, key) {
    const targetValue = finiteOrNull(target, key);
    const controlValue = finiteOrNull(control, key);
    output[key] = targetValue === null || controlValue === null ? null : targetValue - controlValue;
    return output;
  }, {});
}

function buildControlComparability(
  target: LaboratoryRecord,
  control: LaboratoryRecord,
  targetRoi: LaboratoryRecord,
  controlRoi: LaboratoryRecord
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
    patchActiveProject(runtime, patcher) {
      return deps.patchActiveProject(runtime, function (project) {
        return patcher(asRecord(project));
      });
    },
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
  type RunControlInjectionArgs = Parameters<typeof originalRunControlInjection>;

  async function persistCompositeResult(
    runtime: RunControlInjectionArgs[0],
    result: LaboratoryRecord
  ) {
    await deps.patchActiveProject(runtime, function (project) {
      const edit = asRecord(asRecord(project)["edit"]);
      const existing = Array.isArray(edit["temporalStressTests"])
        ? (edit["temporalStressTests"] as unknown[])
        : [];
      asRecord(project)["edit"] = {
        ...edit,
        temporalStressTests: [result, ...existing].slice(0, 30),
        lastActionAt: result["createdAt"],
        lastError: null,
      };
      return project;
    });
  }

  async function replaceStoredResult(
    runtime: RunControlInjectionArgs[0],
    result: LaboratoryRecord
  ) {
    const resultId = deps.asNonEmptyString(result["id"]);
    if (resultId === null) return result;
    await deps.patchActiveProject(runtime, function (project) {
      const projectRecord = asRecord(project);
      const edit = asRecord(projectRecord["edit"]);
      const existing = Array.isArray(edit["temporalStressTests"])
        ? (edit["temporalStressTests"] as unknown[])
        : [];
      projectRecord["edit"] = {
        ...edit,
        temporalStressTests: existing.map(function (entry) {
          const record = asRecord(entry);
          return deps.asNonEmptyString(record["id"]) === resultId ? result : entry;
        }),
        lastActionAt: result["createdAt"],
        lastError: null,
      };
      return project;
    });
    return result;
  }

  async function persistResponseAssessment(
    runtime: RunControlInjectionArgs[0],
    result: LaboratoryRecord
  ) {
    return replaceStoredResult(runtime, {
      ...result,
      interpretation: buildLaboratoryVisualResponseReportAssessment(result),
    });
  }

  async function enrichTransitionResult(
    runtime: RunControlInjectionArgs[0],
    requestId: string,
    rawResult: LaboratoryRecord,
    temporalRequest: LaboratoryRecord,
    backgroundRoi: ReturnType<typeof normalizeLaboratoryResponseBackgroundRoi>,
    controlRoi: ReturnType<typeof normalizeLaboratoryResponseBackgroundRoi>,
    backgroundReferenceSeconds: number | null
  ) {
    const project = deps.getActiveProject(runtime);
    if (project === null || backgroundRoi === null) return rawResult;
    const projectRecord = asRecord(project);
    const source = asRecord(projectRecord["source"]);
    const sourcePath = deps.asNonEmptyString(source["storedPath"]);
    const metadata = asRecord(source["metadata"]);
    const sourceWidth = finite(metadata, "width");
    const sourceHeight = finite(metadata, "height");
    const durationSeconds = finiteOrNull(metadata, "durationSeconds");
    const targetRoi = normalizeLaboratoryResponseBackgroundRoi(temporalRequest["roi"]);
    const resultRequest = asRecord(rawResult["request"]);
    const eventSeconds = finite(resultRequest, "eventSeconds");
    if (
      sourcePath === null ||
      targetRoi === null ||
      sourceWidth <= 0 ||
      sourceHeight <= 0 ||
      eventSeconds < 0
    ) {
      return rawResult;
    }

    const referenceRoi = resolveLatestResponseBackgroundRoi(deps, runtime) ?? backgroundRoi;
    let structural: LaboratoryRecord;
    try {
      structural = asRecord(
        await structuralTransitionRuntime.analyzeTransition({
          backgroundRoi,
          controlRoi,
          durationSeconds,
          eventSeconds,
          project: projectRecord,
          referenceRoi,
          requestId,
          runtime,
          sourceHeight,
          sourcePath,
          sourceWidth,
          targetRoi,
        })
      );
    } catch (error) {
      structural = {
        status: "unavailable",
        error: error instanceof Error ? error.message : "Structural transition analysis failed.",
      };
    }

    if (backgroundReferenceSeconds !== null && structural["status"] !== "unavailable") {
      try {
        const targetStructuralTimeline = Array.isArray(structural["timeline"])
          ? (structural["timeline"] as unknown[])
          : [];
        structural = {
          ...structural,
          revealedBackground: await backgroundReferenceConvergenceRuntime.analyzeConvergence({
            backgroundReferenceSeconds,
            durationSeconds,
            eventSeconds,
            project: projectRecord,
            requestId,
            runtime,
            sourcePath,
            targetRoi,
            targetStructuralTimeline,
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

    const phases = Array.isArray(rawResult["phases"])
      ? (rawResult["phases"] as unknown[]).map(asRecord)
      : [];
    let controlMeasurements: LaboratoryRecord[] = [];
    if (controlRoi !== null) {
      try {
        controlMeasurements = (
          await controlPhotometryRuntime.measureControlPhases({
            controlRoi,
            phases: phases.map(function (phase) {
              return {
                phase: deps.asNonEmptyString(phase["phase"]) || "phase",
                startSeconds: finite(phase, "startSeconds"),
                endSeconds: finite(phase, "endSeconds"),
              };
            }),
            project: projectRecord,
            requestId,
            runtime,
            sampleFps: finite(temporalRequest, "sampleFps") || 5,
            sourcePath,
          })
        ).map(asRecord);
      } catch {
        controlMeasurements = [];
      }
    }

    const enrichedPhases: LaboratoryRecord[] = phases.map(function (phase): LaboratoryRecord {
      const phaseName = deps.asNonEmptyString(phase["phase"]);
      const controlEntry = controlMeasurements.find(function (entry) {
        return deps.asNonEmptyString(entry["phase"]) === phaseName;
      });
      const control = controlEntry === undefined ? null : asRecord(controlEntry["metrics"]);
      const target = asRecord(phase["target"]);
      return {
        ...phase,
        control,
        targetVsControl: control === null ? null : metricDifference(target, control),
        targetVsBackground: phase["differential"],
      };
    });
    const prePhase = enrichedPhases.find(function (phase) {
      return phase["phase"] === "pre";
    });
    const preControlValue = prePhase?.["control"];
    const preControl =
      preControlValue !== null &&
      typeof preControlValue === "object" &&
      !Array.isArray(preControlValue)
        ? asRecord(preControlValue)
        : null;
    const controlComparability =
      controlRoi === null || prePhase === undefined || preControl === null
        ? null
        : buildControlComparability(
            asRecord(prePhase["target"]),
            preControl,
            targetRoi,
            controlRoi
          );
    const oldInterpretation = asRecord(rawResult["interpretation"]);
    const structuralAssessment = asRecord(structural["assessment"]);
    const structuralClassification = deps.asNonEmptyString(structuralAssessment["classification"]);
    const roiStability = asRecord(structural["roiStability"]);
    const revealedBackground = asRecord(structural["revealedBackground"]);
    const revealedBackgroundAssessment = asRecord(revealedBackground["assessment"]);
    const enrichedResult: LaboratoryRecord = {
      ...rawResult,
      schemaVersion: 2,
      request: {
        ...resultRequest,
        controlRoi,
        ...(backgroundReferenceSeconds === null ? {} : { backgroundReferenceSeconds }),
      },
      phases: enrichedPhases,
      structural,
      roiStability,
      interpretation: {
        ...oldInterpretation,
        photometricClassification: oldInterpretation["classification"],
        structuralClassification,
        controlComparability,
        roiStability,
        revealedBackgroundClassification: deps.asNonEmptyString(
          revealedBackgroundAssessment["classification"]
        ),
        referenceTransitionShape: deps.asNonEmptyString(
          revealedBackgroundAssessment["transitionShape"]
        ),
      },
    };
    return replaceStoredResult(runtime, enrichedResult);
  }

  async function runControlInjection(...args: RunControlInjectionArgs) {
    const [runtime, requestId, actionPayload] = args;
    const request = asRecord(actionPayload["request"]);
    const specialKind = deps.asNonEmptyString(request["kind"]);
    const temporalRequest = asRecord(request["temporalRequest"]);

    if (specialKind?.startsWith("response-") === true) {
      const backgroundRoi = resolveResponseBackgroundRoi(deps, runtime, request);
      if (backgroundRoi === null) {
        throw new Error(
          "Select a Background ROI before running Visibility Response. Legacy Motion Reference lock is accepted as fallback."
        );
      }
      const result = asRecord(
        await visualResponseRuntime.runResponseProbe(runtime, requestId, {
          axis: specialKind.slice("response-".length),
          temporalRequest,
          backgroundRoi,
        })
      );
      return persistResponseAssessment(runtime, result);
    }

    if (specialKind === "appearance-transition") {
      const backgroundRoi = resolveResponseBackgroundRoi(deps, runtime, request);
      if (backgroundRoi === null) {
        throw new Error(
          "Select a Background ROI before running Transition Probe. Legacy Motion Reference lock is accepted as fallback."
        );
      }
      const controlRoi = normalizeLaboratoryResponseBackgroundRoi(request["controlRoi"]);
      const rawBackgroundReferenceSeconds = finiteOrNull(request, "backgroundReferenceSeconds");
      const backgroundReferenceSeconds =
        rawBackgroundReferenceSeconds !== null && rawBackgroundReferenceSeconds >= 0
          ? rawBackgroundReferenceSeconds
          : null;
      const result = asRecord(
        await visualResponseRuntime.runTransitionProbe(runtime, requestId, {
          temporalRequest,
          backgroundRoi,
        })
      );
      return enrichTransitionResult(
        runtime,
        requestId,
        result,
        temporalRequest,
        backgroundRoi,
        controlRoi,
        backgroundReferenceSeconds
      );
    }

    if (specialKind === "recompression-ladder") {
      const backgroundRoi = resolveResponseBackgroundRoi(deps, runtime, request);
      const crfValues = [18, 24, 30, 36, 42];
      const steps = await sequentialMap(crfValues, async function (crf) {
        const targetResult = asRecord(
          await originalRunControlInjection(runtime, requestId, {
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
                await originalRunControlInjection(runtime, requestId, {
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
        schemaVersion: 1,
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
