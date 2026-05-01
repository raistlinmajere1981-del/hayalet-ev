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
  "export-enhanced-frame",
  "export-timeline-clip",
  "export-audio-track",
  "export-clean-audio",
  "export-band-pass-voice",
] as const;

type LaboratoryExportActionRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  getActiveProject: (runtime: LaboratoryRecord) => LaboratoryRecord | null;
  getProjectEditOutputDir: (runtime: LaboratoryRecord, project: LaboratoryRecord) => string;
  handleAssetAsSource: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    assetId: string
  ) => Promise<unknown>;
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
    handleAssetAsSource,
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

  function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function toEvenInteger(value: number, minimum: number) {
    const rounded = Math.max(minimum, Math.round(value));
    return rounded % 2 === 0 ? rounded : Math.max(minimum, rounded - 1);
  }

  function getSourceDimensions(source: LaboratoryRecord) {
    const metadata = toRecord(source["metadata"]);
    const width = asNumber(metadata["width"]);
    const height = asNumber(metadata["height"]);
    return width !== null && height !== null && width > 0 && height > 0 ? { width, height } : null;
  }

  function getSourceDurationMs(source: LaboratoryRecord): number | null {
    const durationSeconds = asNumber(toRecord(source["metadata"])["durationSeconds"]);
    return durationSeconds !== null && durationSeconds > 0
      ? Math.round(durationSeconds * 1000)
      : null;
  }

  function sourceAudioAvailability(
    sourceKind: string,
    source: LaboratoryRecord
  ): "ready" | "missing" {
    if (sourceKind === "audio") {
      return "ready";
    }
    const metadata = toRecord(source["metadata"]);
    const audioCodec = asNonEmptyString(metadata["audioCodec"]);
    if (audioCodec !== null) {
      return "ready";
    }
    const codec = asNonEmptyString(metadata["codec"]);
    if (codec !== null && codec.includes("+")) {
      return "ready";
    }
    return Object.keys(metadata).length > 0 && sourceKind === "video" ? "missing" : "ready";
  }

  function resolveNormalizedCropPixels(
    source: LaboratoryRecord,
    normalizedRoiValue: unknown
  ): {
    height: number;
    sourceDimensions: { height: number; width: number };
    width: number;
    x: number;
    y: number;
  } | null {
    const normalizedRoi = toRecord(normalizedRoiValue);
    const dimensions = getSourceDimensions(source);
    if (dimensions === null || Object.keys(normalizedRoi).length === 0) {
      return null;
    }

    const rawX = clampNumber(asNumber(normalizedRoi["x"]) ?? 0, 0, 1);
    const rawY = clampNumber(asNumber(normalizedRoi["y"]) ?? 0, 0, 1);
    const rawWidth = clampNumber(asNumber(normalizedRoi["width"]) ?? 1, 0.02, 1);
    const rawHeight = clampNumber(asNumber(normalizedRoi["height"]) ?? 1, 0.02, 1);
    const width = Math.min(dimensions.width, toEvenInteger(dimensions.width * rawWidth, 2));
    const height = Math.min(dimensions.height, toEvenInteger(dimensions.height * rawHeight, 2));
    const maxX = Math.max(0, dimensions.width - width);
    const maxY = Math.max(0, dimensions.height - height);

    return {
      height,
      sourceDimensions: dimensions,
      width,
      x: Math.min(maxX, Math.max(0, Math.floor(dimensions.width * rawX))),
      y: Math.min(maxY, Math.max(0, Math.floor(dimensions.height * rawY))),
    };
  }

  function hasNormalizedRoiPayload(payload: LaboratoryRecord) {
    return Object.keys(toRecord(payload["normalizedRoi"])).length > 0;
  }

  function getCurrentSourceAssetLink(project: LaboratoryRecord) {
    const sourceAssetId = deriveLabSourceId(project);
    return sourceAssetId === null
      ? {}
      : {
          derivedFromAssetId: sourceAssetId,
          derivedFromSourceId: sourceAssetId,
        };
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

  async function activateCreatedAssetAsSource(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    asset: LabAsset
  ) {
    await handleAssetAsSource(api, runtime, requestId, asset.id);
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
    const normalizedCrop = resolveNormalizedCropPixels(source, payload["normalizedRoi"]);
    if (hasNormalizedRoiPayload(payload) && normalizedCrop === null) {
      throw new Error("Source dimensions are required for normalized ROI export.");
    }
    const cropX = normalizedCrop?.x ?? asNumber(payload["x"]) ?? 0;
    const cropY = normalizedCrop?.y ?? asNumber(payload["y"]) ?? 0;
    const cropW = normalizedCrop?.width ?? asNumber(payload["width"]) ?? 100;
    const cropH = normalizedCrop?.height ?? asNumber(payload["height"]) ?? 100;
    const sourceKind = asNonEmptyString(source["kind"]) || "video";
    const intentIds = getPayloadIntentIds(payload);
    const seekMs = asNumber(payload["seekMs"]);

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
        ...getCurrentSourceAssetLink(project),
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: "export-roi-image",
          evidenceRole: "derived",
          fileName: outputFileName,
          filterPreset: "roi-crop",
          flowKind: "operation-result",
          operationId: "roi-crop",
          regionId,
          requestId,
          ...(seekMs === null
            ? {}
            : {
                sourceRange: {
                  endMs: seekMs,
                  startMs: seekMs,
                },
              }),
          ...(normalizedCrop === null
            ? {}
            : {
                cropPixels: {
                  height: normalizedCrop.height,
                  width: normalizedCrop.width,
                  x: normalizedCrop.x,
                  y: normalizedCrop.y,
                },
                normalizedRoi: toRecord(payload["normalizedRoi"]),
                sourceDimensions: normalizedCrop.sourceDimensions,
              }),
          toolId: "ffmpeg",
        },
      });
      await activateCreatedAssetAsSource(api, runtime, requestId, createdAsset);

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
        ...getCurrentSourceAssetLink(project),
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: "export-frame-grab",
          evidenceRole: "derived",
          fileName: outputFileName,
          filterPreset: "frame-grab",
          flowKind: "operation-result",
          operationId: "frame-grab",
          requestId,
          seekMs,
          sourceRange: {
            endMs: seekMs,
            startMs: seekMs,
          },
          toolId: "ffmpeg",
        },
      });
      await activateCreatedAssetAsSource(api, runtime, requestId, createdAsset);

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

  async function exportEnhancedFrame(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for enhanced frame export.");
    }

    const projectId = getProjectId(project);
    const source = getSourceRecord(project);
    const storedPath = asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for enhanced frame export.");
    }

    const sourceKind = asNonEmptyString(source["kind"]) || "video";
    if (sourceKind !== "video" && sourceKind !== "image") {
      throw new Error("Enhanced frame export is only available for video or image sources.");
    }

    const seekMs = asNumber(payload["seekMs"]) || 0;
    const intentIds = getPayloadIntentIds(payload);
    const normalizedCrop = resolveNormalizedCropPixels(source, payload["normalizedRoi"]);
    if (hasNormalizedRoiPayload(payload) && normalizedCrop === null) {
      throw new Error("Source dimensions are required for normalized enhanced frame export.");
    }

    await cancelJobsForProject(runtime, projectId, requestId, {
      actionIds: Array.from(MEDIA_EXPORT_ACTION_IDS),
    });

    const jobId = `export-enhanced-frame-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "export-enhanced-frame",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    pushJobState(api, {
      action: "export-enhanced-frame",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = getProjectEditOutputDir(runtime, project);
      const outputFileName = `enhanced-frame-${String(Math.round(seekMs))}ms-${Date.now()}.png`;
      const outputPath = `${outputDir}/${outputFileName}`;
      const filters = [
        ...(normalizedCrop === null
          ? []
          : [
              `crop=${String(normalizedCrop.width)}:${String(normalizedCrop.height)}:${String(
                normalizedCrop.x
              )}:${String(normalizedCrop.y)}`,
            ]),
        "eq=contrast=1.25:brightness=0.04:saturation=1.15",
        "unsharp=5:5:0.8:3:3:0.4",
      ];
      const args: string[] = ["-y"];

      if (sourceKind === "video") {
        if (seekMs > 0) {
          args.push("-ss", String(seekMs / 1000));
        }
        args.push("-i", storedPath, "-frames:v", "1");
      } else {
        args.push("-i", storedPath, "-frames:v", "1");
      }
      args.push("-filter:v", filters.join(","), outputPath);

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
        throw new Error(
          asNonEmptyString(runPayload["stderr"]) || "ffmpeg enhanced frame export failed."
        );
      }

      const createdAsset = await registerOutputAsset(runtime, project, {
        type: sourceKind === "video" ? "frame" : "image",
        name: outputFileName,
        localPath: outputPath,
        ...getCurrentSourceAssetLink(project),
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: "export-enhanced-frame",
          evidenceRole: "derived",
          fileName: outputFileName,
          filterPreset: "clarity-basic",
          flowKind: "operation-result",
          operationId: "enhanced-frame",
          requestId,
          seekMs,
          sourceRange: {
            endMs: seekMs,
            startMs: seekMs,
          },
          ...(normalizedCrop === null
            ? {}
            : {
                cropPixels: {
                  height: normalizedCrop.height,
                  width: normalizedCrop.width,
                  x: normalizedCrop.x,
                  y: normalizedCrop.y,
                },
                normalizedRoi: toRecord(payload["normalizedRoi"]),
                sourceDimensions: normalizedCrop.sourceDimensions,
              }),
          toolId: "ffmpeg",
        },
      });
      await activateCreatedAssetAsSource(api, runtime, requestId, createdAsset);

      pushJobState(api, {
        action: "export-enhanced-frame",
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
        action: "export-enhanced-frame",
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
        ...getCurrentSourceAssetLink(project),
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: "export-timeline-clip",
          durationMs: endMs - startMs,
          endMs,
          evidenceRole: "derived",
          fileName: outputFileName,
          filterPreset: hasCrop ? "clip-export-crop" : "clip-export",
          flowKind: "operation-result",
          operationId: "clip-export",
          requestId,
          sourceRange: {
            endMs,
            startMs,
          },
          startMs,
          toolId: "ffmpeg",
          ...(hasCrop
            ? {
                cropPixels: {
                  height: Number(cropRegion["height"]),
                  width: Number(cropRegion["width"]),
                  x: Number(cropRegion["x"]),
                  y: Number(cropRegion["y"]),
                },
              }
            : {}),
        },
      });
      await activateCreatedAssetAsSource(api, runtime, requestId, createdAsset);

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

  async function exportAudioVariant(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord,
    config: {
      action: "export-clean-audio" | "export-band-pass-voice";
      audioChannels: number;
      filterChain: string;
      filterPreset: string;
      operationId: "audio-cleanup" | "band-pass-voice";
      outputPrefix: string;
    }
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for audio variant export.");
    }

    const projectId = getProjectId(project);
    const source = getSourceRecord(project);
    const storedPath = asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for audio variant export.");
    }

    const sourceKind = asNonEmptyString(source["kind"]) || "video";
    if (sourceKind !== "video" && sourceKind !== "audio") {
      throw new Error("Audio variants are only available for video or audio sources.");
    }
    if (sourceAudioAvailability(sourceKind, source) === "missing") {
      throw new Error("The current video source does not expose an audio track.");
    }

    const intentIds = getPayloadIntentIds(payload);

    await cancelJobsForProject(runtime, projectId, requestId, {
      actionIds: Array.from(MEDIA_EXPORT_ACTION_IDS),
    });

    const jobId = `${config.action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: config.action,
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    pushJobState(api, {
      action: config.action,
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = getProjectEditOutputDir(runtime, project);
      const outputFileName = `${config.outputPrefix}-${Date.now()}.wav`;
      const outputPath = `${outputDir}/${outputFileName}`;
      const args = [
        "-y",
        "-i",
        storedPath,
        "-vn",
        "-af",
        config.filterChain,
        "-acodec",
        "pcm_s16le",
        "-ar",
        "48000",
        "-ac",
        String(config.audioChannels),
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
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffmpeg audio variant failed.");
      }

      const durationMs = getSourceDurationMs(source);
      const createdAsset = await registerOutputAsset(runtime, project, {
        type: "audio",
        name: outputFileName,
        localPath: outputPath,
        ...getCurrentSourceAssetLink(project),
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: config.action,
          audioChannels: config.audioChannels,
          evidenceRole: "derived",
          fileName: outputFileName,
          filterChain: config.filterChain,
          filterPreset: config.filterPreset,
          flowKind: "operation-result",
          operationId: config.operationId,
          requestId,
          toolId: "ffmpeg",
          ...(durationMs === null ? {} : { durationMs }),
          ...(durationMs === null
            ? {}
            : {
                sourceRange: {
                  endMs: durationMs,
                  startMs: 0,
                },
              }),
          startOffsetMs: 0,
        },
      });
      await activateCreatedAssetAsSource(api, runtime, requestId, createdAsset);

      pushJobState(api, {
        action: config.action,
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
        action: config.action,
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

  async function exportCleanAudio(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    return exportAudioVariant(api, runtime, requestId, payload, {
      action: "export-clean-audio",
      audioChannels: 2,
      filterChain: "highpass=f=80,lowpass=f=12000,afftdn=nf=-25,dynaudnorm=f=150:g=15",
      filterPreset: "cleanup-basic",
      operationId: "audio-cleanup",
      outputPrefix: "clean-audio",
    });
  }

  async function exportBandPassVoice(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    return exportAudioVariant(api, runtime, requestId, payload, {
      action: "export-band-pass-voice",
      audioChannels: 1,
      filterChain: "highpass=f=120,lowpass=f=3800,dynaudnorm=f=150:g=12",
      filterPreset: "voice-band-pass",
      operationId: "band-pass-voice",
      outputPrefix: "band-pass-voice",
    });
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
        ...getCurrentSourceAssetLink(project),
        ...(intentIds === undefined ? {} : { intentIds }),
        metadata: {
          action: "export-audio-track",
          evidenceRole: "derived",
          fileName: outputFileName,
          filterPreset: "audio-extract",
          flowKind: "operation-result",
          operationId: "audio-extract",
          requestId,
          toolId: "ffmpeg",
          ...(durationMs === null ? {} : { durationMs }),
          ...(durationMs === null
            ? {}
            : {
                sourceRange: {
                  endMs: durationMs,
                  startMs: 0,
                },
              }),
          startOffsetMs: 0,
        },
      });
      await activateCreatedAssetAsSource(api, runtime, requestId, createdAsset);

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
    exportBandPassVoice,
    exportCleanAudio,
    exportEnhancedFrame,
    exportROIImage,
    exportFrameGrab,
    exportTimelineClip,
  };
}
