import type { createLabOutputAsset } from "../../../shared/host/lab-assets.js";
import {
  readBooleanSetting,
  readNumberSetting,
  readStringSetting,
} from "../../../shared/host/settings-readers.js";
import type { LabAsset } from "../../../models/lab-types.js";
import { MEDIA_EXPORT_ACTION_IDS } from "./action-handlers-export-utils.js";
import type { LaboratoryRecord } from "./action-handlers-export-utils.js";

type RegisterOutputAssetInput = Parameters<typeof createLabOutputAsset>[1];

type MediaAudioExportActionsDeps = {
  activateCreatedAssetAsSource: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    asset: LabAsset
  ) => Promise<void>;
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  assertToolRunSucceeded: (run: LaboratoryRecord, message: string) => void;
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  cancelJobsForProject: (
    runtime: LaboratoryRecord,
    projectId: string,
    requestId: string,
    options?: {
      actionIds?: string[];
    }
  ) => Promise<unknown>;
  clearJob: (runtime: LaboratoryRecord, jobId: string) => void;
  getActiveProject: (runtime: LaboratoryRecord) => LaboratoryRecord | null;
  getAudioChannelCount: (value: string, fallback: number) => number;
  getAudioCodecForFormat: (format: string) => string;
  getCurrentSourceAssetLink: (project: LaboratoryRecord) => Partial<RegisterOutputAssetInput>;
  getPayloadIntentIds: (payload: LaboratoryRecord) => string[] | undefined;
  getProjectEditOutputDir: (runtime: LaboratoryRecord, project: LaboratoryRecord) => string;
  getProjectId: (project: LaboratoryRecord) => string;
  getSourceDurationMs: (source: LaboratoryRecord) => number | null;
  getSourceRecord: (project: LaboratoryRecord) => LaboratoryRecord;
  isOperationCancelledError: (error: unknown) => boolean;
  pushCancelledJobState: (
    api: unknown,
    action: string,
    jobId: string,
    projectId: string,
    requestId: string
  ) => void;
  pushJobState: (api: unknown, payload: LaboratoryRecord) => void;
  readOperationSettings: (
    operationId: "audio-cleanup" | "band-pass-voice" | "audio-extract",
    payload: LaboratoryRecord
  ) => LaboratoryRecord;
  registerJob: (runtime: LaboratoryRecord, job: LaboratoryRecord) => void;
  registerOutputAsset: (
    runtime: LaboratoryRecord,
    inputProject: LaboratoryRecord,
    assetInput: RegisterOutputAssetInput
  ) => Promise<LabAsset>;
  sourceAudioAvailability: (sourceKind: string, source: LaboratoryRecord) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

type AudioVariantConfig = {
  action: "export-clean-audio" | "export-band-pass-voice";
  audioChannels: number;
  filterChain: string;
  filterPreset: string;
  operationId: "audio-cleanup" | "band-pass-voice";
  outputPrefix: string;
};

export function createMediaAudioExportActions(deps: MediaAudioExportActionsDeps) {
  async function exportAudioVariant(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord,
    config: AudioVariantConfig
  ) {
    const project = deps.getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for audio variant export.");
    }

    const projectId = deps.getProjectId(project);
    const source = deps.getSourceRecord(project);
    const storedPath = deps.asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for audio variant export.");
    }

    const sourceKind = deps.asNonEmptyString(source["kind"]) || "video";
    if (sourceKind !== "video" && sourceKind !== "audio") {
      throw new Error("Audio variants are only available for video or audio sources.");
    }
    if (deps.sourceAudioAvailability(sourceKind, source) === "missing") {
      throw new Error("The current video source does not expose an audio track.");
    }

    const intentIds = deps.getPayloadIntentIds(payload);
    const settings = deps.readOperationSettings(config.operationId, payload);

    await deps.cancelJobsForProject(runtime, projectId, requestId, {
      actionIds: Array.from(MEDIA_EXPORT_ACTION_IDS),
    });

    const jobId = `${config.action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    deps.registerJob(runtime, {
      action: config.action,
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    deps.pushJobState(api, {
      action: config.action,
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = deps.getProjectEditOutputDir(runtime, project);
      const outputFileName = `${config.outputPrefix}-${Date.now()}.wav`;
      const outputPath = `${outputDir}/${outputFileName}`;
      const audioChannels =
        config.operationId === "band-pass-voice"
          ? deps.getAudioChannelCount(
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

      const runResult = deps.toRecord(
        await deps.callRoomTools({
          args,
          cwd: outputDir,
          jobId,
          operation: "tool-run",
          requestId,
          roomId: deps.asNonEmptyString(runtime["roomId"]) || "laboratory",
          timeoutMs: 5 * 60 * 1000,
          toolId: "ffmpeg",
        })
      );

      const runPayload = deps.toRecord(runResult["run"]);
      deps.assertToolRunSucceeded(runPayload, "ffmpeg audio variant failed.");

      const durationMs = deps.getSourceDurationMs(source);
      const createdAsset = await deps.registerOutputAsset(runtime, project, {
        type: "audio",
        name: outputFileName,
        localPath: outputPath,
        ...deps.getCurrentSourceAssetLink(project),
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
      await deps.activateCreatedAssetAsSource(api, runtime, requestId, createdAsset);

      deps.pushJobState(api, {
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
      if (deps.isOperationCancelledError(error)) {
        deps.pushCancelledJobState(api, config.action, jobId, projectId, requestId);
        return { cancelled: true };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      deps.pushJobState(api, {
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
      deps.clearJob(runtime, jobId);
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
    const project = deps.getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for audio export.");
    }

    const projectId = deps.getProjectId(project);
    const source = deps.getSourceRecord(project);
    const storedPath = deps.asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for audio export.");
    }

    const sourceKind = deps.asNonEmptyString(source["kind"]) || "video";
    if (sourceKind !== "video" && sourceKind !== "audio") {
      throw new Error("Audio export is only available for video or audio sources.");
    }
    const intentIds = deps.getPayloadIntentIds(payload);
    const settings = deps.readOperationSettings("audio-extract", payload);
    const startMs = deps.asNumber(payload["startMs"]);
    const endMs = deps.asNumber(payload["endMs"]);

    await deps.cancelJobsForProject(runtime, projectId, requestId, {
      actionIds: Array.from(MEDIA_EXPORT_ACTION_IDS),
    });

    const jobId = `export-audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    deps.registerJob(runtime, {
      action: "export-audio-track",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    deps.pushJobState(api, {
      action: "export-audio-track",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = deps.getProjectEditOutputDir(runtime, project);
      const format = readStringSetting(settings, "format", "wav");
      const sampleRate = Math.round(readNumberSetting(settings, "sampleRate", 48000));
      const channels = deps.getAudioChannelCount(
        readStringSetting(settings, "channels", "stereo"),
        2
      );
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
        deps.getAudioCodecForFormat(format),
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

      const runResult = deps.toRecord(
        await deps.callRoomTools({
          args,
          cwd: outputDir,
          jobId,
          operation: "tool-run",
          requestId,
          roomId: deps.asNonEmptyString(runtime["roomId"]) || "laboratory",
          timeoutMs: 5 * 60 * 1000,
          toolId: "ffmpeg",
        })
      );

      const runPayload = deps.toRecord(runResult["run"]);
      deps.assertToolRunSucceeded(runPayload, "ffmpeg audio export failed.");

      const sourceMetadata = deps.toRecord(source["metadata"]);
      const sourceDurationSeconds = deps.asNumber(sourceMetadata["durationSeconds"]);
      const durationMs =
        sourceDurationSeconds !== null && sourceDurationSeconds > 0
          ? Math.round(sourceDurationSeconds * 1000)
          : null;

      const createdAsset = await deps.registerOutputAsset(runtime, project, {
        type: "audio",
        name: outputFileName,
        localPath: outputPath,
        ...deps.getCurrentSourceAssetLink(project),
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
      await deps.activateCreatedAssetAsSource(api, runtime, requestId, createdAsset);

      deps.pushJobState(api, {
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
      if (deps.isOperationCancelledError(error)) {
        deps.pushCancelledJobState(api, "export-audio-track", jobId, projectId, requestId);
        return { cancelled: true };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      deps.pushJobState(api, {
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
      deps.clearJob(runtime, jobId);
    }
  }

  return {
    exportAudioTrack,
    exportBandPassVoice,
    exportCleanAudio,
  };
}
