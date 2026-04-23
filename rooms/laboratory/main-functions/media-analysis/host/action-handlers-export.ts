import {
  createLabOutputAsset,
  deriveLabSourceId,
  upsertLabAsset,
} from "../../../shared/host/lab-assets.js";
import type { LabAsset } from "../../../models/lab-types.js";

type LaboratoryRecord = Record<string, unknown>;

const MEDIA_EXPORT_ACTION_IDS = [
  "export-roi-image",
  "export-frame-grab",
  "export-timeline-clip",
  "export-audio-track",
] as const;

type LaboratoryExportActionRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  getActiveProject: (runtime: LaboratoryRecord) => LaboratoryRecord | null;
  getProjectEditOutputDir: (runtime: LaboratoryRecord, project: LaboratoryRecord) => string;
  patchActiveProject: (
    runtime: LaboratoryRecord,
    patcher: (project: LaboratoryRecord) => LaboratoryRecord
  ) => Promise<unknown>;
  pushJobState: (api: unknown, payload: LaboratoryRecord) => void;
  registerJob: (runtime: LaboratoryRecord, job: LaboratoryRecord) => void;
  clearJob: (runtime: LaboratoryRecord, jobId: string) => void;
  cancelJobsForProject: (
    runtime: LaboratoryRecord,
    projectId: string,
    requestId: string,
    options?: {
      actionIds?: string[];
    }
  ) => Promise<unknown>;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createMediaExportActionRuntime(deps: LaboratoryExportActionRuntimeDeps) {
  const {
    asNonEmptyString,
    asNumber,
    callRoomTools,
    getActiveProject,
    getProjectEditOutputDir,
    patchActiveProject,
    pushJobState,
    registerJob,
    clearJob,
    cancelJobsForProject,
    toRecord,
  } = deps;

  function getProjectId(project: LaboratoryRecord): string {
    return asNonEmptyString(project["id"]) || "";
  }

  function getSourceRecord(project: LaboratoryRecord): LaboratoryRecord {
    return toRecord(project["source"]);
  }

  function getCurrentMediaRunId(project: LaboratoryRecord): string | null {
    return asNonEmptyString(
      toRecord(toRecord(toRecord(project["process"])["records"])["media-analysis"])["runId"]
    );
  }

  function getWorkspaceIntentIds(project: LaboratoryRecord): string[] {
    const scope = toRecord(toRecord(project["workbench"])["analysisScope"]);
    const intentIds = scope["intentIds"];
    if (!Array.isArray(intentIds)) {
      return [];
    }
    return intentIds.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
    );
  }

  function getPayloadIntentIds(payload: LaboratoryRecord): string[] | undefined {
    const intentIds = payload["intentIds"];
    if (!Array.isArray(intentIds)) {
      return undefined;
    }
    const normalizedIntentIds = intentIds
      .map(function (entry) {
        return asNonEmptyString(entry);
      })
      .filter((entry): entry is string => entry !== null);
    return normalizedIntentIds.length > 0 ? Array.from(new Set(normalizedIntentIds)) : undefined;
  }

  async function registerOutputAsset(
    runtime: LaboratoryRecord,
    inputProject: LaboratoryRecord,
    assetInput: Parameters<typeof createLabOutputAsset>[1]
  ): Promise<LabAsset> {
    let createdAsset: LabAsset | undefined;
    await patchActiveProject(runtime, function (nextProject) {
      createdAsset = createLabOutputAsset(nextProject, {
        ...assetInput,
        runId: assetInput.runId || getCurrentMediaRunId(inputProject),
        intentIds: assetInput.intentIds || getWorkspaceIntentIds(inputProject),
      });
      return {
        ...nextProject,
        assets: upsertLabAsset(nextProject["assets"], createdAsset),
      };
    });
    if (createdAsset === undefined) {
      throw new Error("Output asset could not be registered.");
    }
    return createdAsset;
  }

  async function exportROIImage(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for ROI export.");
    }

    const projectId = getProjectId(project);
    const source = getSourceRecord(project);
    const storedPath = asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for ROI export.");
    }

    const regionId = asNonEmptyString(payload["regionId"]) || "unknown";
    const cropX = asNumber(payload["x"]) || 0;
    const cropY = asNumber(payload["y"]) || 0;
    const cropW = asNumber(payload["width"]) || 100;
    const cropH = asNumber(payload["height"]) || 100;
    const sourceKind = asNonEmptyString(source["kind"]) || "video";
    const intentIds = getPayloadIntentIds(payload);

    await cancelJobsForProject(runtime, projectId, requestId, {
      actionIds: Array.from(MEDIA_EXPORT_ACTION_IDS),
    });

    const jobId = `export-roi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "export-roi-image",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    pushJobState(api, {
      action: "export-roi-image",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = getProjectEditOutputDir(runtime, project);
      const outputFileName = `roi-${regionId}-${Date.now()}.png`;
      const outputPath = `${outputDir}/${outputFileName}`;

      const args: string[] = ["-y"];

      if (sourceKind === "video") {
        const seekMs = asNumber(payload["seekMs"]);
        if (seekMs !== null && seekMs > 0) {
          args.push("-ss", String(seekMs / 1000));
        }
        args.push("-i", storedPath, "-frames:v", "1");
      } else {
        args.push("-i", storedPath);
      }

      args.push(
        "-filter:v",
        `crop=${String(cropW)}:${String(cropH)}:${String(cropX)}:${String(cropY)}`,
        outputPath
      );

      const runResult = toRecord(
        await callRoomTools({
          args,
          cwd: outputDir,
          jobId,
          operation: "tool-run",
          requestId,
          roomId: asNonEmptyString(runtime["roomId"]) || "laboratory",
          timeoutMs: 30 * 1000,
          toolId: "ffmpeg",
        })
      );

      const runPayload = toRecord(runResult["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
      if (runPayload["cancelled"] === true || exitCode !== 0) {
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffmpeg ROI export failed.");
      }

      const createdAsset = await registerOutputAsset(runtime, project, {
        type: "image",
        name: outputFileName,
        localPath: outputPath,
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: "export-roi-image",
          fileName: outputFileName,
          regionId,
          requestId,
          toolId: "ffmpeg",
        },
      });

      pushJobState(api, {
        action: "export-roi-image",
        jobId,
        percent: 100,
        projectId,
        requestId,
        resultAssetIds: [createdAsset.id],
        stage: "completed",
        toolId: "ffmpeg",
      });

      return {
        outputPath,
        outputFileName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      pushJobState(api, {
        action: "export-roi-image",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "ffmpeg",
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  async function exportFrameGrab(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for frame export.");
    }

    const projectId = getProjectId(project);
    const source = getSourceRecord(project);
    const storedPath = asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for frame export.");
    }

    const sourceKind = asNonEmptyString(source["kind"]) || "video";
    if (sourceKind !== "video") {
      throw new Error("Frame export is only available for video sources.");
    }

    const seekMs = asNumber(payload["seekMs"]) || 0;
    const intentIds = getPayloadIntentIds(payload);

    await cancelJobsForProject(runtime, projectId, requestId, {
      actionIds: Array.from(MEDIA_EXPORT_ACTION_IDS),
    });

    const jobId = `export-frame-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "export-frame-grab",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    pushJobState(api, {
      action: "export-frame-grab",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = getProjectEditOutputDir(runtime, project);
      const outputFileName = `frame-${String(Math.round(seekMs))}ms-${Date.now()}.png`;
      const outputPath = `${outputDir}/${outputFileName}`;

      const args = [
        "-y",
        "-ss",
        String(seekMs / 1000),
        "-i",
        storedPath,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        outputPath,
      ];

      const runResult = toRecord(
        await callRoomTools({
          args,
          cwd: outputDir,
          jobId,
          operation: "tool-run",
          requestId,
          roomId: asNonEmptyString(runtime["roomId"]) || "laboratory",
          timeoutMs: 30 * 1000,
          toolId: "ffmpeg",
        })
      );

      const runPayload = toRecord(runResult["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
      if (runPayload["cancelled"] === true || exitCode !== 0) {
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffmpeg frame grab failed.");
      }

      const createdAsset = await registerOutputAsset(runtime, project, {
        type: "frame",
        name: outputFileName,
        localPath: outputPath,
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: "export-frame-grab",
          fileName: outputFileName,
          requestId,
          seekMs,
          toolId: "ffmpeg",
        },
      });

      pushJobState(api, {
        action: "export-frame-grab",
        jobId,
        percent: 100,
        projectId,
        requestId,
        resultAssetIds: [createdAsset.id],
        stage: "completed",
        toolId: "ffmpeg",
      });

      return {
        outputPath,
        outputFileName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      pushJobState(api, {
        action: "export-frame-grab",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "ffmpeg",
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  async function exportTimelineClip(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for clip export.");
    }

    const projectId = getProjectId(project);
    const source = getSourceRecord(project);
    const storedPath = asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for clip export.");
    }

    const sourceKind = asNonEmptyString(source["kind"]) || "video";
    if (sourceKind !== "video") {
      throw new Error("Clip export is only available for video sources.");
    }

    const startMs = asNumber(payload["startMs"]) || 0;
    const endMs = asNumber(payload["endMs"]);
    if (endMs === null || endMs <= startMs) {
      throw new Error("Invalid timeline selection for clip export.");
    }
    const durationSec = (endMs - startMs) / 1000;
    const intentIds = getPayloadIntentIds(payload);

    const cropRegion = payload["cropRegion"] as LaboratoryRecord | undefined;
    const hasCrop =
      cropRegion &&
      typeof cropRegion["width"] === "number" &&
      typeof cropRegion["height"] === "number" &&
      cropRegion["width"] > 0 &&
      cropRegion["height"] > 0;

    await cancelJobsForProject(runtime, projectId, requestId, {
      actionIds: Array.from(MEDIA_EXPORT_ACTION_IDS),
    });

    const jobId = `export-clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "export-timeline-clip",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    pushJobState(api, {
      action: "export-timeline-clip",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = getProjectEditOutputDir(runtime, project);
      const outputFileName = `clip-${String(Math.round(startMs))}-${String(Math.round(endMs))}ms-${Date.now()}.mp4`;
      const outputPath = `${outputDir}/${outputFileName}`;

      const args: string[] = [
        "-y",
        "-ss",
        String(startMs / 1000),
        "-i",
        storedPath,
        "-t",
        String(durationSec),
      ];

      if (hasCrop) {
        const cx = Number(cropRegion["x"]);
        const cy = Number(cropRegion["y"]);
        const cw = Number(cropRegion["width"]);
        const ch = Number(cropRegion["height"]);
        args.push("-filter:v", `crop=${String(cw)}:${String(ch)}:${String(cx)}:${String(cy)}`);
      }

      args.push("-c:v", "libx264", "-c:a", "aac", outputPath);

      const runResult = toRecord(
        await callRoomTools({
          args,
          cwd: outputDir,
          jobId,
          operation: "tool-run",
          requestId,
          roomId: asNonEmptyString(runtime["roomId"]) || "laboratory",
          timeoutMs: 5 * 60 * 1000,
          toolId: "ffmpeg",
        })
      );

      const runPayload = toRecord(runResult["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
      if (runPayload["cancelled"] === true || exitCode !== 0) {
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffmpeg clip export failed.");
      }

      const createdAsset = await registerOutputAsset(runtime, project, {
        type: "clip",
        name: outputFileName,
        localPath: outputPath,
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: "export-timeline-clip",
          durationMs: endMs - startMs,
          endMs,
          fileName: outputFileName,
          requestId,
          startMs,
          toolId: "ffmpeg",
        },
      });

      pushJobState(api, {
        action: "export-timeline-clip",
        jobId,
        percent: 100,
        projectId,
        requestId,
        resultAssetIds: [createdAsset.id],
        stage: "completed",
        toolId: "ffmpeg",
      });

      return {
        outputPath,
        outputFileName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      pushJobState(api, {
        action: "export-timeline-clip",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "ffmpeg",
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  async function exportAudioTrack(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for audio export.");
    }

    const projectId = getProjectId(project);
    const source = getSourceRecord(project);
    const storedPath = asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for audio export.");
    }

    const sourceKind = asNonEmptyString(source["kind"]) || "video";
    if (sourceKind !== "video" && sourceKind !== "audio") {
      throw new Error("Audio export is only available for video or audio sources.");
    }
    const intentIds = getPayloadIntentIds(payload);

    await cancelJobsForProject(runtime, projectId, requestId, {
      actionIds: Array.from(MEDIA_EXPORT_ACTION_IDS),
    });

    const jobId = `export-audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "export-audio-track",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    pushJobState(api, {
      action: "export-audio-track",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = getProjectEditOutputDir(runtime, project);
      const outputFileName = `audio-track-${Date.now()}.wav`;
      const outputPath = `${outputDir}/${outputFileName}`;
      const args = [
        "-y",
        "-i",
        storedPath,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        outputPath,
      ];

      const runResult = toRecord(
        await callRoomTools({
          args,
          cwd: outputDir,
          jobId,
          operation: "tool-run",
          requestId,
          roomId: asNonEmptyString(runtime["roomId"]) || "laboratory",
          timeoutMs: 5 * 60 * 1000,
          toolId: "ffmpeg",
        })
      );

      const runPayload = toRecord(runResult["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
      if (runPayload["cancelled"] === true || exitCode !== 0) {
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffmpeg audio export failed.");
      }

      const currentSourceAssetId = deriveLabSourceId(project);
      const sourceMetadata = toRecord(source["metadata"]);
      const sourceDurationSeconds = asNumber(sourceMetadata["durationSeconds"]);
      const durationMs =
        sourceDurationSeconds !== null && sourceDurationSeconds > 0
          ? Math.round(sourceDurationSeconds * 1000)
          : null;

      const createdAsset = await registerOutputAsset(runtime, project, {
        type: "audio",
        name: outputFileName,
        localPath: outputPath,
        ...(currentSourceAssetId === null
          ? {}
          : {
              derivedFromAssetId: currentSourceAssetId,
              derivedFromSourceId: currentSourceAssetId,
            }),
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: "export-audio-track",
          fileName: outputFileName,
          requestId,
          toolId: "ffmpeg",
          ...(durationMs === null ? {} : { durationMs }),
          startOffsetMs: 0,
        },
      });

      pushJobState(api, {
        action: "export-audio-track",
        jobId,
        percent: 100,
        projectId,
        requestId,
        resultAssetIds: [createdAsset.id],
        stage: "completed",
        toolId: "ffmpeg",
      });

      return {
        outputPath,
        outputFileName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      pushJobState(api, {
        action: "export-audio-track",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "ffmpeg",
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  return {
    exportAudioTrack,
    exportROIImage,
    exportFrameGrab,
    exportTimelineClip,
  };
}
