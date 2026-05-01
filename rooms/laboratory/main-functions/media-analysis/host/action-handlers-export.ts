import {
  createLabOutputAsset,
  deriveLabSourceId,
  upsertLabAsset,
} from "../../../shared/host/lab-assets.js";
import { normalizeLabOperationSettings } from "../../../models/lab-types.js";
import type {
  LabAsset,
  LabInteractiveSettings,
  LabOperationCapabilityId,
  LabSettingsRecord,
} from "../../../models/lab-types.js";

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

  function readOperationSettings(
    capabilityId: LabOperationCapabilityId,
    payload: LaboratoryRecord
  ): LabSettingsRecord {
    return normalizeLabOperationSettings(capabilityId, payload["operationSettings"]);
  }

  function readStringSetting(settings: LabSettingsRecord, key: string, fallback: string): string {
    const value = settings[key];
    return typeof value === "string" && value.trim() !== "" ? value : fallback;
  }

  function readNumberSetting(settings: LabSettingsRecord, key: string, fallback: number): number {
    const value = settings[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function readBooleanSetting(
    settings: LabSettingsRecord,
    key: string,
    fallback: boolean
  ): boolean {
    const value = settings[key];
    return typeof value === "boolean" ? value : fallback;
  }

  function clampRoundedSetting(
    settings: LabSettingsRecord,
    key: string,
    fallback: number,
    min: number,
    max: number
  ) {
    return Math.max(min, Math.min(max, Math.round(readNumberSetting(settings, key, fallback))));
  }

  function getImageExtension(format: string) {
    return format === "jpg" ? "jpg" : format === "webp" ? "webp" : "png";
  }

  function getAudioCodecForFormat(format: string) {
    switch (format) {
      case "flac":
        return "flac";
      case "mp3":
        return "libmp3lame";
      default:
        return "pcm_s16le";
    }
  }

  function getAudioChannelCount(channels: string, fallback: number) {
    if (channels === "mono") {
      return 1;
    }
    if (channels === "stereo") {
      return 2;
    }
    return fallback;
  }

  function getCrfForQuality(quality: string) {
    return quality === "high" ? "18" : quality === "compact" ? "30" : "23";
  }

  function getScaleFilter(scale: string) {
    switch (scale) {
      case "480p":
        return "scale=-2:480";
      case "720p":
        return "scale=-2:720";
      case "1080p":
        return "scale=-2:1080";
      default:
        return null;
    }
  }

  function getFpsFilter(fps: string) {
    return fps === "12" || fps === "24" || fps === "30" ? `fps=${fps}` : null;
  }

  function appendImageQualityArgs(args: string[], format: string, quality: number) {
    if (format === "jpg") {
      args.push("-q:v", String(Math.max(2, Math.round(31 - (quality / 100) * 29))));
    } else if (format === "webp") {
      args.push("-quality", String(Math.round(quality)));
    }
  }

  function readPreviewNumber(
    settings: LaboratoryRecord,
    key: keyof LabInteractiveSettings,
    fallback: number
  ) {
    const value = settings[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function readPreviewBoolean(
    settings: LaboratoryRecord,
    key: keyof LabInteractiveSettings,
    fallback: boolean
  ) {
    const value = settings[key];
    return typeof value === "boolean" ? value : fallback;
  }

  function buildPreviewSettingsFilters(settings: LaboratoryRecord): string[] {
    const brightness = readPreviewNumber(settings, "brightness", 100);
    const contrast = readPreviewNumber(settings, "contrast", 100);
    const gamma = readPreviewNumber(settings, "gamma", 1);
    const saturation = readPreviewNumber(settings, "saturation", 100);
    const hueRotate = readPreviewNumber(settings, "hueRotate", 0);
    const sharpness = readPreviewNumber(settings, "sharpness", 100);
    const filters: string[] = [];
    const eqParts: string[] = [];

    if (brightness !== 100) {
      eqParts.push(`brightness=${fixedFilterNumber((brightness - 100) / 200)}`);
    }
    if (contrast !== 100) {
      eqParts.push(`contrast=${fixedFilterNumber(contrast / 100)}`);
    }
    if (gamma !== 1) {
      eqParts.push(`gamma=${fixedFilterNumber(gamma)}`);
    }
    if (saturation !== 100) {
      eqParts.push(`saturation=${fixedFilterNumber(saturation / 100)}`);
    }
    if (eqParts.length > 0) {
      filters.push(`eq=${eqParts.join(":")}`);
    }
    if (hueRotate !== 0) {
      filters.push(`hue=h=${fixedFilterNumber((hueRotate * Math.PI) / 180)}`);
    }
    if (
      readPreviewBoolean(settings, "channelR", true) !== true ||
      readPreviewBoolean(settings, "channelG", true) !== true ||
      readPreviewBoolean(settings, "channelB", true) !== true
    ) {
      filters.push(
        `colorchannelmixer=rr=${readPreviewBoolean(settings, "channelR", true) ? "1" : "0"}:gg=${
          readPreviewBoolean(settings, "channelG", true) ? "1" : "0"
        }:bb=${readPreviewBoolean(settings, "channelB", true) ? "1" : "0"}`
      );
    }
    if (sharpness > 100) {
      filters.push(`unsharp=5:5:${fixedFilterNumber(0.3 + ((sharpness - 100) / 100) * 1.2)}:3:3:0.0`);
    } else if (sharpness < 100) {
      filters.push(`boxblur=${fixedFilterNumber(Math.max(0.2, (100 - sharpness) / 200))}:1`);
    }
    if (readPreviewBoolean(settings, "edgeHighlight", false)) {
      filters.push("edgedetect=mode=colormix:high=0.18:low=0.06");
    }
    if (readPreviewBoolean(settings, "invert", false)) {
      filters.push("negate");
    }
    return filters;
  }

  function fixedFilterNumber(value: number): string {
    return Number(value.toFixed(3)).toString();
  }

  function buildEnhancedFrameFilters(
    settings: LabSettingsRecord,
    previewSettings: LaboratoryRecord = {}
  ) {
    const preset = readStringSetting(settings, "preset", "clarity");
    const strength = readNumberSetting(settings, "strength", 1);
    const scaled = (base: number) => Number((base * strength).toFixed(3));
    const previewFilters = readBooleanSetting(settings, "applyPreviewSettings", false)
      ? buildPreviewSettingsFilters(previewSettings)
      : [];
    if (preset === "low-light") {
      return [`eq=brightness=${scaled(0.08)}:contrast=${scaled(1.2)}:gamma=1.45`, ...previewFilters];
    }
    if (preset === "edge") {
      return [`unsharp=7:7:${scaled(1.6)}:7:7:0.0`, ...previewFilters];
    }
    if (preset === "forensic") {
      return [
        `eq=contrast=${scaled(1.4)}:brightness=${scaled(0.03)}:saturation=${scaled(1.1)}`,
        `histeq=strength=${Math.min(1, scaled(0.28)).toFixed(2)}:intensity=0.25`,
        `unsharp=5:5:${scaled(1.1)}:3:3:0.2`,
        ...previewFilters,
      ];
    }
    return [
      `eq=contrast=${scaled(1.25)}:brightness=${scaled(0.04)}:saturation=${scaled(1.15)}`,
      `unsharp=5:5:${scaled(0.8)}:3:3:0.4`,
      ...previewFilters,
    ];
  }

  function formatTimestamp(ms: number) {
    const safeMs = Math.max(0, Math.round(ms));
    const totalSeconds = Math.floor(safeMs / 1000);
    const milliseconds = safeMs % 1000;
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  function formatTimestampFileToken(ms: number) {
    return formatTimestamp(ms).replaceAll(":", "-").replace(".", "-");
  }

  function escapeDrawtextValue(value: string) {
    return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
  }

  function buildTimestampFilter(ms: number) {
    return `drawtext=text='${escapeDrawtextValue(formatTimestamp(ms))}':x=16:y=h-th-16:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.55`;
  }

  function getFrameGrabSeekPoints(params: {
    endMs: number | null;
    rawSeekMs: number;
    settings: LabSettingsRecord;
    source: LaboratoryRecord;
    startMs: number | null;
  }) {
    const frameMode = readStringSetting(params.settings, "frameMode", "current");
    if (frameMode === "middle" && params.startMs !== null && params.endMs !== null && params.endMs > params.startMs) {
      return [Math.round(params.startMs + (params.endMs - params.startMs) / 2)];
    }
    if (frameMode !== "burst") {
      return [Math.max(0, Math.round(params.rawSeekMs))];
    }

    const burstCount = clampRoundedSetting(params.settings, "burstCount", 1, 1, 12);
    if (burstCount <= 1) {
      return [Math.max(0, Math.round(params.rawSeekMs))];
    }
    if (params.startMs !== null && params.endMs !== null && params.endMs > params.startMs) {
      const rangeStartMs = params.startMs;
      const span = params.endMs - params.startMs;
      return Array.from({ length: burstCount }, function (_entry, index) {
        return Math.round(rangeStartMs + (span * index) / Math.max(1, burstCount - 1));
      });
    }

    const durationMs = getSourceDurationMs(params.source);
    const stepMs = 500;
    const firstMs = Math.max(0, Math.round(params.rawSeekMs - ((burstCount - 1) * stepMs) / 2));
    return Array.from({ length: burstCount }, function (_entry, index) {
      const seekMs = firstMs + index * stepMs;
      return durationMs === null ? seekMs : Math.min(durationMs, seekMs);
    });
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
        const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
        if (runPayload["cancelled"] === true || exitCode !== 0) {
          throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffmpeg frame grab failed.");
        }

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
    const settings = readOperationSettings(config.operationId, payload);

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
      const audioChannels =
        config.operationId === "band-pass-voice"
          ? getAudioChannelCount(
              readStringSetting(settings, "channels", "mono"),
              config.audioChannels
            )
          : config.audioChannels;
      const bandPassLowHz = readNumberSetting(settings, "lowHz", 120);
      const bandPassHighHz = readNumberSetting(settings, "highHz", 3800);
      const bandPassCenterHz = (bandPassLowHz + bandPassHighHz) / 2;
      const bandPassGainDb = Math.round(readNumberSetting(settings, "gain", 1) * 6);
      const cleanupTargetDb = readNumberSetting(settings, "normalizeTargetDb", -16);
      const filterChain =
        config.operationId === "band-pass-voice"
          ? `highpass=f=${String(bandPassLowHz)},lowpass=f=${String(
              bandPassHighHz
            )},equalizer=f=${String(bandPassCenterHz)}:t=q:w=${String(
              readNumberSetting(settings, "widthQ", 1)
            )}:g=${String(bandPassGainDb)},dynaudnorm=f=150:g=${String(
              Math.round(readNumberSetting(settings, "gain", 1) * 12)
            )}`
          : `highpass=f=${String(readNumberSetting(settings, "highpassHz", 80))},lowpass=f=${String(
              readNumberSetting(settings, "lowpassHz", 12000)
            )},afftdn=nf=${
              readStringSetting(settings, "denoise", "medium") === "strong"
                ? "-32"
                : readStringSetting(settings, "denoise", "medium") === "light"
                  ? "-18"
                  : "-25"
            },dynaudnorm=f=150:g=15,loudnorm=I=${String(cleanupTargetDb)}:TP=-1.5:LRA=11${
              readBooleanSetting(settings, "compressor", true)
                ? ",acompressor=threshold=-18dB:ratio=2:attack=20:release=250"
                : ""
            }`;
      const args = [
        "-y",
        "-i",
        storedPath,
        "-vn",
        "-af",
        filterChain,
        "-acodec",
        "pcm_s16le",
        "-ar",
        "48000",
        "-ac",
        String(audioChannels),
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
          audioChannels,
          evidenceRole: "derived",
          fileName: outputFileName,
          filterChain,
          filterPreset: config.filterPreset,
          flowKind: "operation-result",
          operationId: config.operationId,
          requestId,
          settingsUsed: settings,
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
    const settings = readOperationSettings("audio-extract", payload);
    const startMs = asNumber(payload["startMs"]);
    const endMs = asNumber(payload["endMs"]);

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
      const format = readStringSetting(settings, "format", "wav");
      const sampleRate = Math.round(readNumberSetting(settings, "sampleRate", 48000));
      const channels = getAudioChannelCount(readStringSetting(settings, "channels", "stereo"), 2);
      const outputFileName = `audio-track-${Date.now()}.${format}`;
      const outputPath = `${outputDir}/${outputFileName}`;
      const args = ["-y"];
      if (
        readBooleanSetting(settings, "timelineOnly", false) &&
        startMs !== null &&
        endMs !== null &&
        endMs > startMs
      ) {
        args.push("-ss", String(startMs / 1000));
      }
      args.push(
        "-i",
        storedPath,
        "-vn",
        "-acodec",
        getAudioCodecForFormat(format),
        "-ar",
        String(sampleRate),
        "-ac",
        String(channels)
      );
      if (
        readBooleanSetting(settings, "timelineOnly", false) &&
        startMs !== null &&
        endMs !== null &&
        endMs > startMs
      ) {
        args.push("-t", String((endMs - startMs) / 1000));
      }
      args.push(outputPath);

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
          audioChannels: channels,
          evidenceRole: "derived",
          fileName: outputFileName,
          filterPreset: "audio-extract",
          flowKind: "operation-result",
          operationId: "audio-extract",
          requestId,
          sampleRate,
          settingsUsed: settings,
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
