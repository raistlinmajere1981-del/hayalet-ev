import { createLabOutputAsset, upsertLabAsset } from "../../../shared/host/lab-assets.js";
import {
  readBooleanSetting,
  readNumberSetting,
  readStringSetting,
} from "../../../shared/host/settings-readers.js";
import type { LabAsset } from "../../../models/lab-types.js";
import {
  MEDIA_EXPORT_ACTION_IDS,
  createMediaExportUtilities,
} from "./action-handlers-export-utils.js";
import type { LaboratoryRecord } from "./action-handlers-export-utils.js";
import { createMediaAudioExportActions } from "./action-handlers-export-audio.js";

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
  const {
    appendImageQualityArgs,
    assertToolRunSucceeded,
    buildEnhancedFrameFilters,
    buildTimestampFilter,
    clampNumber,
    formatTimestampFileToken,
    getAudioChannelCount,
    getAudioCodecForFormat,
    getCrfForQuality,
    getCurrentMediaRunId,
    getCurrentSourceAssetLink,
    getFpsFilter,
    getFrameGrabSeekPoints,
    getImageExtension,
    getPayloadIntentIds,
    getProjectId,
    getScaleFilter,
    getSourceDimensions,
    getSourceDurationMs,
    getSourceRecord,
    getWorkspaceIntentIds,
    hasNormalizedRoiPayload,
    isOperationCancelledError,
    pushCancelledJobState,
    readOperationSettings,
    resolveNormalizedCropPixels,
    sourceAudioAvailability,
  } = createMediaExportUtilities({
    asNonEmptyString,
    asNumber,
    pushJobState,
    toRecord,
  });

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
    const settings = readOperationSettings("roi-crop", payload);

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
      const format = getImageExtension(readStringSetting(settings, "format", "png"));
      const outputFileName = `roi-${regionId}-${Date.now()}.${format}`;
      const outputPath = `${outputDir}/${outputFileName}`;
      const padding = readNumberSetting(settings, "padding", 0);
      const aspectLock = readStringSetting(settings, "aspectLock", "free");
      let nextCropX = cropX - padding;
      let nextCropY = cropY - padding;
      let nextCropW = cropW + padding * 2;
      let nextCropH = cropH + padding * 2;
      const dimensions = getSourceDimensions(source);
      if (aspectLock !== "free") {
        const ratio = aspectLock === "square" ? 1 : aspectLock === "16:9" ? 16 / 9 : 4 / 3;
        const currentRatio = nextCropW / Math.max(1, nextCropH);
        if (currentRatio > ratio) {
          const targetH = nextCropW / ratio;
          nextCropY -= (targetH - nextCropH) / 2;
          nextCropH = targetH;
        } else {
          const targetW = nextCropH * ratio;
          nextCropX -= (targetW - nextCropW) / 2;
          nextCropW = targetW;
        }
      }
      if (dimensions !== null) {
        nextCropX = clampNumber(nextCropX, 0, dimensions.width - 1);
        nextCropY = clampNumber(nextCropY, 0, dimensions.height - 1);
        nextCropW = clampNumber(nextCropW, 1, dimensions.width - nextCropX);
        nextCropH = clampNumber(nextCropH, 1, dimensions.height - nextCropY);
      }
      const outputSize = readStringSetting(settings, "outputSize", "source");
      const filters = [
        `crop=${String(Math.round(nextCropW))}:${String(Math.round(nextCropH))}:${String(Math.round(nextCropX))}:${String(Math.round(nextCropY))}`,
        outputSize === "512" || outputSize === "1024" || outputSize === "2048"
          ? `scale=${outputSize}:-2`
          : null,
      ].filter((entry): entry is string => entry !== null);

      const args: string[] = ["-y"];

      if (sourceKind === "video") {
        if (seekMs !== null && seekMs > 0) {
          args.push("-ss", String(seekMs / 1000));
        }
        args.push("-i", storedPath, "-frames:v", "1");
      } else {
        args.push("-i", storedPath);
      }

      args.push("-filter:v", filters.join(","));
      appendImageQualityArgs(args, format, 92);
      args.push(outputPath);

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
      assertToolRunSucceeded(runPayload, "ffmpeg ROI export failed.");

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
          settingsUsed: settings,
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
      if (isOperationCancelledError(error)) {
        pushCancelledJobState(api, "export-roi-image", jobId, projectId, requestId);
        return { cancelled: true };
      }
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

    const rawSeekMs = asNumber(payload["seekMs"]) || 0;
    const startMs = asNumber(payload["startMs"]);
    const endMs = asNumber(payload["endMs"]);
    const intentIds = getPayloadIntentIds(payload);
    const settings = readOperationSettings("frame-grab", payload);
    const seekPoints = getFrameGrabSeekPoints({
      endMs,
      rawSeekMs,
      settings,
      source,
      startMs,
    });
    const timestampLabel = readBooleanSetting(settings, "timestampLabel", false);

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
      const format = getImageExtension(readStringSetting(settings, "format", "png"));
      const quality = readNumberSetting(settings, "quality", 92);
      const frameResults = await seekPoints.reduce<
        Promise<Array<{ asset: LabAsset; outputFileName: string; outputPath: string }>>
      >(async function (previousResults, seekMs, index) {
        const results = await previousResults;
        const outputFileName =
          seekPoints.length > 1
            ? `frame-${formatTimestampFileToken(seekMs)}-${String(index + 1).padStart(2, "0")}-${Date.now()}.${format}`
            : `frame-${String(Math.round(seekMs))}ms-${Date.now()}.${format}`;
        const outputPath = `${outputDir}/${outputFileName}`;
        const args: string[] = [
          "-y",
          "-ss",
          String(seekMs / 1000),
          "-i",
          storedPath,
          "-frames:v",
          "1",
        ];
        if (timestampLabel) {
          args.push("-filter:v", buildTimestampFilter(seekMs));
        }
        appendImageQualityArgs(args, format, quality);
        args.push(outputPath);

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
        assertToolRunSucceeded(runPayload, "ffmpeg frame grab failed.");

        const asset = await registerOutputAsset(runtime, project, {
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
            settingsUsed: settings,
            sourceRange: {
              endMs: seekMs,
              startMs: seekMs,
            },
            timestampLabel,
            toolId: "ffmpeg",
          },
        });
        return [...results, { asset, outputFileName, outputPath }];
      }, Promise.resolve([]));
      const createdAssets = frameResults.map(function (result) {
        return result.asset;
      });
      const outputPaths = frameResults.map(function (result) {
        return result.outputPath;
      });
      const outputFileNames = frameResults.map(function (result) {
        return result.outputFileName;
      });
      if (createdAssets[0]) {
        await activateCreatedAssetAsSource(api, runtime, requestId, createdAssets[0]);
      }

      pushJobState(api, {
        action: "export-frame-grab",
        jobId,
        percent: 100,
        projectId,
        requestId,
        resultAssetIds: createdAssets.map(function (asset) {
          return asset.id;
        }),
        stage: "completed",
        toolId: "ffmpeg",
      });

      return {
        outputFileName: outputFileNames[0] || null,
        outputFileNames,
        outputPath: outputPaths[0] || null,
        outputPaths,
      };
    } catch (error) {
      if (isOperationCancelledError(error)) {
        pushCancelledJobState(api, "export-frame-grab", jobId, projectId, requestId);
        return { cancelled: true };
      }
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
    const settings = readOperationSettings("enhanced-frame", payload);
    const previewSettings = toRecord(payload["previewSettings"]);
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
      const format = getImageExtension(readStringSetting(settings, "format", "png"));
      const outputFileName = `enhanced-frame-${String(Math.round(seekMs))}ms-${Date.now()}.${format}`;
      const outputPath = `${outputDir}/${outputFileName}`;
      const filters = [
        ...(normalizedCrop === null
          ? []
          : [
              `crop=${String(normalizedCrop.width)}:${String(normalizedCrop.height)}:${String(
                normalizedCrop.x
              )}:${String(normalizedCrop.y)}`,
            ]),
        ...buildEnhancedFrameFilters(settings, previewSettings),
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
      appendImageQualityArgs(args, format, 92);
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
      assertToolRunSucceeded(runPayload, "ffmpeg enhanced frame export failed.");

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
          filterPreset: readStringSetting(settings, "preset", "clarity"),
          flowKind: "operation-result",
          operationId: "enhanced-frame",
          requestId,
          seekMs,
          settingsUsed: settings,
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
      if (isOperationCancelledError(error)) {
        pushCancelledJobState(api, "export-enhanced-frame", jobId, projectId, requestId);
        return { cancelled: true };
      }
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
    const settings = readOperationSettings("clip-export", payload);
    const applyRoiCrop = readBooleanSetting(settings, "applyRoiCrop", false);

    const normalizedCrop = applyRoiCrop
      ? resolveNormalizedCropPixels(source, payload["normalizedRoi"])
      : null;
    if (applyRoiCrop && hasNormalizedRoiPayload(payload) && normalizedCrop === null) {
      throw new Error("Source dimensions are required for normalized ROI clip export.");
    }
    const cropRegion = normalizedCrop || (payload["cropRegion"] as LaboratoryRecord | undefined);
    const hasCrop =
      applyRoiCrop &&
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
      const format = readStringSetting(settings, "format", "mp4");
      const outputFileName = `clip-${String(Math.round(startMs))}-${String(Math.round(endMs))}ms-${Date.now()}.${format}`;
      const outputPath = `${outputDir}/${outputFileName}`;
      const filters: string[] = [];

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
        filters.push(`crop=${String(cw)}:${String(ch)}:${String(cx)}:${String(cy)}`);
      }
      const fpsFilter = getFpsFilter(readStringSetting(settings, "fps", "source"));
      const scaleFilter = getScaleFilter(readStringSetting(settings, "scale", "source"));
      if (fpsFilter !== null) {
        filters.push(fpsFilter);
      }
      if (scaleFilter !== null) {
        filters.push(scaleFilter);
      }
      if (filters.length > 0) {
        args.push("-filter:v", filters.join(","));
      }

      if (format === "gif") {
        args.push(outputPath);
      } else if (format === "webm") {
        args.push(
          "-c:v",
          "libvpx-vp9",
          "-crf",
          getCrfForQuality(readStringSetting(settings, "quality", "balanced")),
          "-b:v",
          "0"
        );
        if (readBooleanSetting(settings, "includeAudio", true)) {
          args.push("-c:a", "libopus");
        } else {
          args.push("-an");
        }
        args.push(outputPath);
      } else {
        args.push(
          "-c:v",
          "libx264",
          "-crf",
          getCrfForQuality(readStringSetting(settings, "quality", "balanced"))
        );
        if (readBooleanSetting(settings, "includeAudio", true)) {
          args.push("-c:a", "aac");
        } else {
          args.push("-an");
        }
        args.push(outputPath);
      }

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
      assertToolRunSucceeded(runPayload, "ffmpeg clip export failed.");

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
          settingsUsed: settings,
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
      if (isOperationCancelledError(error)) {
        pushCancelledJobState(api, "export-timeline-clip", jobId, projectId, requestId);
        return { cancelled: true };
      }
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

  const { exportAudioTrack, exportBandPassVoice, exportCleanAudio } = createMediaAudioExportActions(
    {
      activateCreatedAssetAsSource,
      asNonEmptyString,
      asNumber,
      assertToolRunSucceeded,
      callRoomTools,
      cancelJobsForProject,
      clearJob,
      getActiveProject,
      getAudioChannelCount,
      getAudioCodecForFormat,
      getCurrentSourceAssetLink,
      getPayloadIntentIds,
      getProjectEditOutputDir,
      getProjectId,
      getSourceDurationMs,
      getSourceRecord,
      isOperationCancelledError,
      pushCancelledJobState,
      pushJobState,
      readOperationSettings,
      registerJob,
      registerOutputAsset,
      sourceAudioAvailability,
      toRecord,
    }
  );

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
