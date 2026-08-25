import { createMediaEditActionRuntime } from "./action-handlers-edit.js";
import { createMediaExportActionRuntime } from "./action-handlers-export.js";
import { createMediaAnnotationExportActionRuntime } from "./action-handlers-annotation-export.js";
import { createMediaProfileActionRuntime } from "./action-handlers-profile.js";
import { createMediaProjectActionRuntime } from "./action-handlers-project.js";
import { createMediaSourceActionRuntime } from "./action-handlers-source.js";
import { createLaboratoryVisualResponseProbeRuntime } from "./visual-response-probe.js";

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
    requestId: string
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
type MediaExportActionRuntimeDeps = Parameters<typeof createMediaExportActionRuntime>[0];
type MediaProfileActionRuntimeDeps = Parameters<typeof createMediaProfileActionRuntime>[0];
type MediaProjectActionRuntimeDeps = Parameters<typeof createMediaProjectActionRuntime>[0];

type MediaActionRuntimeDeps = MediaSourceActionRuntimeDeps &
  MediaEditActionRuntimeDeps &
  MediaExportActionRuntimeDeps &
  MediaProfileActionRuntimeDeps &
  MediaProjectActionRuntimeDeps;

type MediaActionRuntime = ReturnType<typeof createMediaSourceActionRuntime> &
  ReturnType<typeof createMediaEditActionRuntime> &
  Omit<ReturnType<typeof createMediaExportActionRuntime>, "captureComparisonMoment"> &
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
  const x = roi["x"];
  const y = roi["y"];
  const width = roi["width"];
  const height = roi["height"];
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null;
  }
  return { x, y, width, height };
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

  type EditProject = Parameters<typeof deps.getProjectEditOutputDir>[1];
  const visualResponseRuntime = createLaboratoryVisualResponseProbeRuntime({
    callRoomTools: deps.callRoomTools,
    getActiveProject(runtime) {
      const project = deps.getActiveProject(runtime);
      return project === null ? null : asRecord(project);
    },
    getPreparedSourcePath(project) {
      return deps.asNonEmptyString(asRecord(project["source"])["storedPath"]);
    },
    getProjectEditOutputDir(runtime, project) {
      return deps.getProjectEditOutputDir(runtime, project as EditProject);
    },
    patchActiveProject(runtime, patcher) {
      return deps.patchActiveProject(runtime, function (project) {
        return patcher(asRecord(project)) as EditProject;
      });
    },
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

  async function persistCompositeResult(runtime: RunControlInjectionArgs[0], result: LaboratoryRecord) {
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

  async function runControlInjection(...args: RunControlInjectionArgs) {
    const [runtime, requestId, actionPayload] = args;
    const request = asRecord(actionPayload["request"]);
    const specialKind = deps.asNonEmptyString(request["kind"]);
    const temporalRequest = asRecord(request["temporalRequest"]);

    if (specialKind?.startsWith("response-") === true) {
      const backgroundRoi = resolveLatestResponseBackgroundRoi(deps, runtime);
      if (backgroundRoi === null) {
        throw new Error(
          "Lock a stable background ROI with Reference ROI before running Visibility Response."
        );
      }
      return visualResponseRuntime.runResponseProbe(runtime, requestId, {
        axis: specialKind.slice("response-".length),
        temporalRequest,
        backgroundRoi,
      });
    }

    if (specialKind === "appearance-transition") {
      const backgroundRoi = resolveLatestResponseBackgroundRoi(deps, runtime);
      if (backgroundRoi === null) {
        throw new Error(
          "Lock a stable background ROI with Reference ROI before running Transition Probe."
        );
      }
      return visualResponseRuntime.runTransitionProbe(runtime, requestId, {
        temporalRequest,
        backgroundRoi,
      });
    }

    if (specialKind === "recompression-ladder") {
      const backgroundRoi = resolveLatestResponseBackgroundRoi(deps, runtime);
      const crfValues = [18, 24, 30, 36, 42];
      const steps: LaboratoryRecord[] = [];
      for (const crf of crfValues) {
        const targetResult = asRecord(
          await originalRunControlInjection(runtime, requestId, {
            request: {
              kind: "recompression",
              params: { baselineCrf: 18, injectedCrf: crf },
              temporalRequest,
            },
          })
        );
        let backgroundResult: LaboratoryRecord | null = null;
        if (backgroundRoi !== null) {
          backgroundResult = asRecord(
            await originalRunControlInjection(runtime, requestId, {
              request: {
                kind: "recompression",
                params: { baselineCrf: 18, injectedCrf: crf },
                temporalRequest: { ...temporalRequest, roi: backgroundRoi },
              },
            })
          );
        }
        const targetDelta = asRecord(targetResult["delta"]);
        const backgroundDelta = asRecord(backgroundResult?.["delta"]);
        steps.push({
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
        });
      }
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
