import { normalizeLaboratoryTransformStages } from "../../../shared/transform-stress-test-model.js";
import {
  appendLaboratoryAudioFiltersToCommand,
  buildLaboratoryAudioSweepPlan,
} from "./transform-stress-test.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryMediaEditArtifactRuntime = LaboratoryRecord;
type LaboratoryProjectRecord = LaboratoryRecord & { edit?: unknown; source?: unknown };
type LaboratoryArtifactOptions = LaboratoryRecord & {
  baseName?: unknown;
  jobId?: unknown;
  mode?: unknown;
  outputPath?: unknown;
  requestId?: unknown;
};
type LaboratoryArtifactEntry = {
  fileName: string;
  kind: string;
  metadata?: LaboratoryRecord;
  path: string;
};

type VideoAudioForensicsArtifactRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  buildBaselineEditCommand: (
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    targetPath: string,
    mode: "preview" | "apply"
  ) => string[];
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  getProjectEditDir: (
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord
  ) => string;
  getProjectEditPreviewDir: (
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord
  ) => string;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

function isArtifactEntry(value: LaboratoryArtifactEntry | null): value is LaboratoryArtifactEntry {
  return value !== null;
}

export function createVideoAudioForensicsArtifactRuntime(
  deps: VideoAudioForensicsArtifactRuntimeDeps
) {
  const {
    asNonEmptyString,
    buildBaselineEditCommand,
    callRoomTools,
    getProjectEditDir,
    getProjectEditPreviewDir,
    roomId,
    toRecord,
  } = deps;

  function buildArtifactEntry(
    filePath: unknown,
    kind: string,
    metadata?: LaboratoryRecord
  ): LaboratoryArtifactEntry | null {
    const normalizedPath = asNonEmptyString(filePath);
    if (normalizedPath === null) return null;
    return {
      kind,
      path: normalizedPath,
      fileName: normalizedPath.split(/[\\/]/).pop() || normalizedPath,
      ...(metadata === undefined ? {} : { metadata }),
    };
  }

  function getRecipe(project: LaboratoryProjectRecord) {
    return toRecord(toRecord(project.edit)["recipe"]);
  }

  function getAudioStages(project: LaboratoryProjectRecord) {
    return normalizeLaboratoryTransformStages(
      toRecord(getRecipe(project)["audio"])["transformStages"],
      "audio"
    );
  }

  function shouldBuildVideoAudioForensics(
    project: LaboratoryProjectRecord,
    options: LaboratoryArtifactOptions
  ) {
    const source = toRecord(project.source);
    if (source["kind"] !== "video" || options.mode !== "preview") return false;
    if (toRecord(getRecipe(project)["video"])["includeAudio"] !== true) return false;
    return getAudioStages(project).some((stage) => stage.enabled === true);
  }

  function buildCombinedDifferenceCommand(
    baselinePath: string,
    transformedPath: string,
    differencePath: string
  ) {
    return [
      "-y",
      "-i",
      baselinePath,
      "-i",
      transformedPath,
      "-filter_complex",
      "[0:v]format=gbrp[basev];[1:v]format=gbrp[transformedv];[basev][transformedv]blend=all_mode=difference:all_opacity=1,format=yuv420p[vd];[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[basea];[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[transformeda];[basea][transformeda]amerge=inputs=2[merged];[merged]pan=stereo|c0=c0-c2|c1=c1-c3[ad]",
      "-map",
      "[vd]",
      "-map",
      "[ad]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      differencePath,
    ];
  }

  async function buildAnalysisImage(
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    options: LaboratoryArtifactOptions,
    inputPath: string,
    outputPath: string,
    kind: string,
    role: "source" | "transform",
    filter: string,
    metadata: LaboratoryRecord
  ) {
    await callRoomTools({
      operation: "tool-run",
      roomId,
      requestId: options.requestId || null,
      jobId: options.jobId || null,
      toolId: "ffmpeg",
      cwd: getProjectEditDir(runtime, project),
      args: ["-y", "-i", inputPath, "-lavfi", filter, "-frames:v", "1", outputPath],
      timeoutMs: 60_000,
    });
    return buildArtifactEntry(outputPath, kind, { comparisonRole: role, ...metadata });
  }

  async function buildSweepArtifacts(
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    options: LaboratoryArtifactOptions,
    baselinePath: string,
    artifactDir: string,
    artifactBase: string
  ) {
    const plan = buildLaboratoryAudioSweepPlan(getAudioStages(project));
    if (plan === null || plan.variants.length === 0) return [];
    const artifacts: LaboratoryArtifactEntry[] = [];

    for (const variant of plan.variants) {
      const outputPath = `${artifactDir}/${artifactBase}-${variant.id}.wav`;
      const baseCommand = [
        "-y",
        "-i",
        baselinePath,
        "-vn",
        "-map",
        "0:a:0",
        "-c:a",
        "pcm_s16le",
        outputPath,
      ];
      const args = appendLaboratoryAudioFiltersToCommand(baseCommand, variant.filters);
      // eslint-disable-next-line no-await-in-loop -- keep sweep variants sequential to cap CPU and disk pressure.
      await callRoomTools({
        operation: "tool-run",
        roomId,
        requestId: options.requestId || null,
        jobId: options.jobId || null,
        toolId: "ffmpeg",
        cwd: getProjectEditDir(runtime, project),
        args,
        timeoutMs: 20 * 60 * 1000,
      });
      const artifact = buildArtifactEntry(outputPath, "audio-sweep-variant", {
        label: variant.label,
        primaryAxis: variant.primaryAxis,
        primaryValue: variant.primaryValue,
        secondaryAxis: variant.secondaryAxis,
        secondaryValue: variant.secondaryValue,
        requestedVariantCount: plan.requestedVariantCount,
        generatedVariantCount: plan.variants.length,
        truncated: plan.truncated,
        transformStages: variant.stages,
        filters: variant.filters,
        sourceKind: "video-audio",
      });
      if (artifact !== null) artifacts.push(artifact);
    }

    return artifacts;
  }

  async function buildAuxiliaryArtifacts(
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    optionsValue: LaboratoryArtifactOptions,
    existingArtifactsValue: LaboratoryArtifactEntry[] = []
  ) {
    const options = toRecord(optionsValue) as LaboratoryArtifactOptions;
    if (!shouldBuildVideoAudioForensics(project, options)) return [];

    const transformedPath = asNonEmptyString(options.outputPath);
    if (transformedPath === null) return [];

    const artifactDir = getProjectEditPreviewDir(runtime, project);
    const artifactBase = asNonEmptyString(options.baseName) || "artifact";
    const existingBaseline = existingArtifactsValue.find(
      (entry) => entry.kind === "transform-source-baseline"
    );
    const createdBaseline = existingBaseline === undefined;
    const baselinePath =
      existingBaseline?.path || `${artifactDir}/${artifactBase}-transform-audio-source.mp4`;

    const commonToolPayload = {
      operation: "tool-run",
      roomId,
      requestId: options.requestId || null,
      jobId: options.jobId || null,
      toolId: "ffmpeg",
      cwd: getProjectEditDir(runtime, project),
      timeoutMs: 20 * 60 * 1000,
    };

    if (createdBaseline) {
      await callRoomTools({
        ...commonToolPayload,
        args: buildBaselineEditCommand(runtime, project, baselinePath, "preview"),
      });
    }

    const differencePath = `${artifactDir}/${artifactBase}-transform-audio-difference.mp4`;
    await callRoomTools({
      ...commonToolPayload,
      args: buildCombinedDifferenceCommand(baselinePath, transformedPath, differencePath),
    });

    const sourceSpectrogram = await buildAnalysisImage(
      runtime,
      project,
      options,
      baselinePath,
      `${artifactDir}/${artifactBase}-spectrogram-source.png`,
      "spectrogram-source",
      "source",
      "aresample=48000,showspectrumpic=s=1600x640:legend=1:fscale=log:scale=log:start=20:stop=20000:drange=100",
      {
        frequencyMinHz: 20,
        frequencyMaxHz: 20000,
        frequencyScale: "log",
        amplitudeScale: "log",
        sourceKind: "video-audio",
      }
    );
    const transformSpectrogram = await buildAnalysisImage(
      runtime,
      project,
      options,
      transformedPath,
      `${artifactDir}/${artifactBase}-spectrogram.png`,
      "spectrogram",
      "transform",
      "aresample=48000,showspectrumpic=s=1600x640:legend=1:fscale=log:scale=log:start=20:stop=20000:drange=100",
      {
        frequencyMinHz: 20,
        frequencyMaxHz: 20000,
        frequencyScale: "log",
        amplitudeScale: "log",
        sourceKind: "video-audio",
      }
    );
    const sourceWaveform = await buildAnalysisImage(
      runtime,
      project,
      options,
      baselinePath,
      `${artifactDir}/${artifactBase}-waveform-source.png`,
      "waveform-source",
      "source",
      "showwavespic=s=1600x180:split_channels=1",
      { timeAxis: "full-preview-duration", alignedWithSpectrogram: true, sourceKind: "video-audio" }
    );
    const transformWaveform = await buildAnalysisImage(
      runtime,
      project,
      options,
      transformedPath,
      `${artifactDir}/${artifactBase}-waveform.png`,
      "waveform",
      "transform",
      "showwavespic=s=1600x180:split_channels=1",
      { timeAxis: "full-preview-duration", alignedWithSpectrogram: true, sourceKind: "video-audio" }
    );

    const artifacts = [
      createdBaseline
        ? buildArtifactEntry(baselinePath, "transform-source-baseline", {
            comparisonRole: "source",
            geometryBasis: "base-edit-recipe",
            stressTransformsApplied: false,
            sourceKind: "video-audio",
          })
        : null,
      buildArtifactEntry(differencePath, "transform-difference", {
        comparisonRole: "difference",
        differenceMethod: "ffmpeg-blend-plus-audio-sample-subtraction",
        geometryBasis: "base-edit-recipe",
        stressTransformsApplied: true,
        sourceKind: "video-audio",
      }),
      sourceSpectrogram,
      transformSpectrogram,
      sourceWaveform,
      transformWaveform,
    ].filter(isArtifactEntry);

    const sweepArtifacts = await buildSweepArtifacts(
      runtime,
      project,
      options,
      baselinePath,
      artifactDir,
      artifactBase
    );
    return artifacts.concat(sweepArtifacts);
  }

  return { buildAuxiliaryArtifacts };
}
