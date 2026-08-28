import { normalizeLaboratoryTransformStages } from "../../../shared/transform-stress-test-model.js";
import {
  appendLaboratoryAudioFiltersToCommand,
  buildLaboratoryAudioSweepPlan,
} from "./transform-stress-test.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryMediaEditArtifactRuntime = LaboratoryRecord;

type LaboratoryProjectRecord = LaboratoryRecord & {
  edit?: unknown;
  source?: unknown;
};

type LaboratoryProjectEditRecord = LaboratoryRecord & { recipe?: unknown };
type LaboratoryProjectEditRecipeRecord = LaboratoryRecord & {
  audio?: unknown;
  image?: unknown;
  video?: unknown;
};
type LaboratoryProjectSourceRecord = LaboratoryRecord & { kind?: unknown; metadata?: unknown };
type LaboratoryAudioEditRecipeRecord = LaboratoryRecord & {
  spectrogram?: unknown;
  transformStages?: unknown;
};
type LaboratoryVideoEditRecipeRecord = LaboratoryRecord & { frameGrabCount?: unknown };

type LaboratoryDirectoryEntry = { isDirectory?: boolean; name?: string; path?: string };
type LaboratoryArtifactOptions = LaboratoryRecord & {
  baseName?: unknown;
  jobId?: unknown;
  metadata?: unknown;
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

type MediaEditArtifactRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  buildBaselineEditCommand: (
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    targetPath: string,
    mode: "preview" | "apply"
  ) => string[];
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  clampNumber: (value: unknown, min: number, max: number, fallback: number) => number;
  getProjectEditDir: (
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord
  ) => string;
  getProjectEditOutputDir: (
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord
  ) => string;
  getProjectEditPreviewDir: (
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord
  ) => string;
  listDirectory: (dirPath: string) => Promise<LaboratoryDirectoryEntry[]>;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createMediaEditArtifactRuntime(deps: MediaEditArtifactRuntimeDeps) {
  const {
    asNonEmptyString,
    asNumber,
    buildBaselineEditCommand,
    callRoomTools,
    clampNumber,
    getProjectEditDir,
    getProjectEditOutputDir,
    getProjectEditPreviewDir,
    listDirectory,
    roomId,
    toRecord,
  } = deps;

  function toProjectEditRecord(value: unknown): LaboratoryProjectEditRecord {
    return toRecord(value);
  }
  function toProjectEditRecipeRecord(value: unknown): LaboratoryProjectEditRecipeRecord {
    return toRecord(value);
  }
  function toProjectSourceRecord(value: unknown): LaboratoryProjectSourceRecord {
    return toRecord(value);
  }
  function toAudioEditRecipeRecord(value: unknown): LaboratoryAudioEditRecipeRecord {
    return toRecord(value);
  }
  function toVideoEditRecipeRecord(value: unknown): LaboratoryVideoEditRecipeRecord {
    return toRecord(value);
  }
  function toArtifactOptionsRecord(value: unknown): LaboratoryArtifactOptions {
    return toRecord(value);
  }

  function isArtifactEntry(
    entry: LaboratoryArtifactEntry | null
  ): entry is LaboratoryArtifactEntry {
    return entry !== null;
  }

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

  async function listArtifactsWithPrefix(dirPath: string, filePrefix: string) {
    const entries = await listDirectory(dirPath);
    return entries
      .filter(
        (entry) => entry.isDirectory !== true && String(entry.name || "").startsWith(filePrefix)
      )
      .map((entry) => (typeof entry.path === "string" ? entry.path : ""))
      .filter(Boolean)
      .sort();
  }

  function getRecipe(project: LaboratoryProjectRecord) {
    return toProjectEditRecipeRecord(toProjectEditRecord(project.edit).recipe);
  }

  function hasEnabledVisualTransformStages(project: LaboratoryProjectRecord) {
    const projectSource = toProjectSourceRecord(project.source);
    const recipe = getRecipe(project);
    const visualRecipe =
      projectSource.kind === "image" ? toRecord(recipe.image) : toRecord(recipe.video);
    return normalizeLaboratoryTransformStages(visualRecipe["transformStages"], "visual").some(
      (stage) => stage.enabled
    );
  }

  function hasEnabledAudioTransformStages(project: LaboratoryProjectRecord) {
    const audioRecipe = toAudioEditRecipeRecord(getRecipe(project).audio);
    return normalizeLaboratoryTransformStages(audioRecipe.transformStages, "audio").some(
      (stage) => stage.enabled && stage.kind !== "parameter-sweep"
    );
  }

  function getTransformPreviewExtension(sourceKind: unknown) {
    if (sourceKind === "image") return "png";
    if (sourceKind === "audio") return "wav";
    return "mp4";
  }

  function buildDifferenceCommand(
    sourceKind: unknown,
    baselinePath: string,
    transformedPath: string,
    differencePath: string
  ) {
    if (sourceKind === "audio") {
      return [
        "-y",
        "-i",
        baselinePath,
        "-i",
        transformedPath,
        "-filter_complex",
        "[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo[base];[1:a]aformat=sample_fmts=fltp:channel_layouts=stereo[transformed];[base][transformed]amerge=inputs=2[merged];[merged]pan=stereo|c0=c0-c2|c1=c1-c3[out]",
        "-map",
        "[out]",
        "-c:a",
        "pcm_s16le",
        differencePath,
      ];
    }
    if (sourceKind === "image") {
      return [
        "-y",
        "-i",
        baselinePath,
        "-i",
        transformedPath,
        "-filter_complex",
        "[0:v]format=rgb24[base];[1:v]format=rgb24[transformed];[base][transformed]blend=all_mode=difference:all_opacity=1[out]",
        "-map",
        "[out]",
        "-frames:v",
        "1",
        differencePath,
      ];
    }
    return [
      "-y",
      "-i",
      baselinePath,
      "-i",
      transformedPath,
      "-filter_complex",
      "[0:v]format=gbrp[base];[1:v]format=gbrp[transformed];[base][transformed]blend=all_mode=difference:all_opacity=1,format=yuv420p[out]",
      "-map",
      "[out]",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      differencePath,
    ];
  }

  async function buildTransformComparisonArtifacts(
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    artifactOptions: LaboratoryArtifactOptions,
    artifactDir: string
  ) {
    const projectSource = toProjectSourceRecord(project.source);
    const sourceKind = projectSource.kind;
    const supportedKind =
      sourceKind === "image" || sourceKind === "video" || sourceKind === "audio";
    const enabledTransforms =
      sourceKind === "audio"
        ? hasEnabledAudioTransformStages(project)
        : hasEnabledVisualTransformStages(project);
    if (
      artifactOptions.mode !== "preview" ||
      !supportedKind ||
      (sourceKind !== "audio" && !enabledTransforms)
    ) {
      return [];
    }

    const transformedPath = asNonEmptyString(artifactOptions.outputPath);
    if (transformedPath === null) return [];
    const artifactBase = asNonEmptyString(artifactOptions.baseName) || "artifact";
    const extension = getTransformPreviewExtension(sourceKind);
    const baselinePath = `${artifactDir}/${artifactBase}-transform-source.${extension}`;
    const differencePath = `${artifactDir}/${artifactBase}-transform-difference.${extension}`;
    const commonToolPayload = {
      operation: "tool-run",
      roomId,
      requestId: artifactOptions.requestId || null,
      jobId: artifactOptions.jobId || null,
      toolId: "ffmpeg",
      cwd: getProjectEditDir(runtime, project),
      timeoutMs: 20 * 60 * 1000,
    };

    await callRoomTools({
      ...commonToolPayload,
      args: buildBaselineEditCommand(runtime, project, baselinePath, "preview"),
    });
    await callRoomTools({
      ...commonToolPayload,
      args: buildDifferenceCommand(sourceKind, baselinePath, transformedPath, differencePath),
    });

    const differenceMetadata =
      sourceKind === "audio"
        ? {
            comparisonRole: "difference",
            differenceMethod: "ffmpeg-amerge-pan-sample-subtraction",
            geometryBasis: "base-edit-recipe",
            stressTransformsApplied: enabledTransforms,
          }
        : {
            comparisonRole: "difference",
            differenceMethod: "ffmpeg-blend-difference",
            geometryBasis: "base-edit-recipe",
            stressTransformsApplied: enabledTransforms,
          };

    return [
      buildArtifactEntry(baselinePath, "transform-source-baseline", {
        comparisonRole: "source",
        geometryBasis: "base-edit-recipe",
        stressTransformsApplied: false,
      }),
      buildArtifactEntry(differencePath, "transform-difference", differenceMetadata),
    ].filter(isArtifactEntry);
  }

  async function buildSpectrogramArtifact(
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    artifactOptions: LaboratoryArtifactOptions,
    inputPath: string,
    outputPath: string,
    kind: string,
    comparisonRole: string
  ) {
    await callRoomTools({
      operation: "tool-run",
      roomId,
      requestId: artifactOptions.requestId || null,
      jobId: artifactOptions.jobId || null,
      toolId: "ffmpeg",
      cwd: getProjectEditDir(runtime, project),
      args: [
        "-y",
        "-i",
        inputPath,
        "-lavfi",
        "aresample=48000,showspectrumpic=s=1600x640:legend=1:fscale=log:scale=log:start=20:stop=20000:drange=100",
        "-frames:v",
        "1",
        outputPath,
      ],
      timeoutMs: 60_000,
    });
    return buildArtifactEntry(outputPath, kind, {
      comparisonRole,
      frequencyMinHz: 20,
      frequencyMaxHz: 20000,
      frequencyScale: "log",
      amplitudeScale: "log",
    });
  }

  async function buildWaveformArtifact(
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    artifactOptions: LaboratoryArtifactOptions,
    inputPath: string,
    outputPath: string,
    kind: string,
    comparisonRole: string
  ) {
    await callRoomTools({
      operation: "tool-run",
      roomId,
      requestId: artifactOptions.requestId || null,
      jobId: artifactOptions.jobId || null,
      toolId: "ffmpeg",
      cwd: getProjectEditDir(runtime, project),
      args: [
        "-y",
        "-i",
        inputPath,
        "-lavfi",
        "showwavespic=s=1600x180:split_channels=1",
        "-frames:v",
        "1",
        outputPath,
      ],
      timeoutMs: 60_000,
    });
    return buildArtifactEntry(outputPath, kind, {
      comparisonRole,
      timeAxis: "full-preview-duration",
      alignedWithSpectrogram: true,
    });
  }

  async function buildAudioSweepArtifacts(
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    artifactOptions: LaboratoryArtifactOptions,
    artifactDir: string
  ) {
    if (artifactOptions.mode !== "preview") return [];
    const audioRecipe = toAudioEditRecipeRecord(getRecipe(project).audio);
    const plan = buildLaboratoryAudioSweepPlan(audioRecipe.transformStages);
    if (plan === null || plan.variants.length === 0) return [];
    const artifactBase = asNonEmptyString(artifactOptions.baseName) || "artifact";
    const artifacts: LaboratoryArtifactEntry[] = [];

    for (const variant of plan.variants) {
      const outputPath = `${artifactDir}/${artifactBase}-${variant.id}.wav`;
      const baseCommand = buildBaselineEditCommand(runtime, project, outputPath, "preview");
      const args = appendLaboratoryAudioFiltersToCommand(baseCommand, variant.filters);
      // eslint-disable-next-line no-await-in-loop -- NOTE: keep FFmpeg sweep variants sequential to cap CPU and disk pressure.
      await callRoomTools({
        operation: "tool-run",
        roomId,
        requestId: artifactOptions.requestId || null,
        jobId: artifactOptions.jobId || null,
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
      });
      if (artifact !== null) artifacts.push(artifact);
    }
    return artifacts;
  }

  async function buildAuxiliaryArtifacts(
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    options: LaboratoryArtifactOptions
  ) {
    const artifactOptions = toArtifactOptionsRecord(options);
    const projectSource = toProjectSourceRecord(project.source);
    const recipe = getRecipe(project);
    const artifactDir =
      artifactOptions.mode === "preview"
        ? getProjectEditPreviewDir(runtime, project)
        : getProjectEditOutputDir(runtime, project);

    const transformComparisonArtifacts = await buildTransformComparisonArtifacts(
      runtime,
      project,
      artifactOptions,
      artifactDir
    );

    if (projectSource.kind === "audio") {
      const artifacts = [...transformComparisonArtifacts];
      const audioRecipe = toAudioEditRecipeRecord(recipe.audio);
      const shouldGenerateSpectrogram =
        artifactOptions.mode === "preview" || audioRecipe.spectrogram === true;
      const transformedPath = asNonEmptyString(artifactOptions.outputPath);
      const artifactBase = asNonEmptyString(artifactOptions.baseName) || "artifact";

      if (shouldGenerateSpectrogram && transformedPath !== null) {
        const transformSpectrogram = await buildSpectrogramArtifact(
          runtime,
          project,
          artifactOptions,
          transformedPath,
          `${artifactDir}/${artifactBase}-spectrogram.png`,
          "spectrogram",
          "transform"
        );
        if (transformSpectrogram !== null) artifacts.push(transformSpectrogram);

        if (artifactOptions.mode === "preview") {
          const baseline = transformComparisonArtifacts.find(
            (entry) => entry.kind === "transform-source-baseline"
          );
          if (baseline !== undefined) {
            const sourceSpectrogram = await buildSpectrogramArtifact(
              runtime,
              project,
              artifactOptions,
              baseline.path,
              `${artifactDir}/${artifactBase}-spectrogram-source.png`,
              "spectrogram-source",
              "source"
            );
            if (sourceSpectrogram !== null) artifacts.push(sourceSpectrogram);
          }
        }
      }

      if (artifactOptions.mode === "preview" && transformedPath !== null) {
        const transformWaveform = await buildWaveformArtifact(
          runtime,
          project,
          artifactOptions,
          transformedPath,
          `${artifactDir}/${artifactBase}-waveform.png`,
          "waveform",
          "transform"
        );
        if (transformWaveform !== null) artifacts.push(transformWaveform);

        const baseline = transformComparisonArtifacts.find(
          (entry) => entry.kind === "transform-source-baseline"
        );
        if (baseline !== undefined) {
          const sourceWaveform = await buildWaveformArtifact(
            runtime,
            project,
            artifactOptions,
            baseline.path,
            `${artifactDir}/${artifactBase}-waveform-source.png`,
            "waveform-source",
            "source"
          );
          if (sourceWaveform !== null) artifacts.push(sourceWaveform);
        }
      }

      const sweepArtifacts = await buildAudioSweepArtifacts(
        runtime,
        project,
        artifactOptions,
        artifactDir
      );
      return artifacts.concat(sweepArtifacts);
    }

    if (projectSource.kind === "video" && artifactOptions.mode === "apply") {
      const frameGrabCount = clampNumber(
        toVideoEditRecipeRecord(recipe.video).frameGrabCount,
        0,
        24,
        0
      );
      const durationSeconds =
        asNumber(toArtifactOptionsRecord(artifactOptions.metadata)["durationSeconds"]) ||
        asNumber(toRecord(projectSource.metadata)["durationSeconds"]);
      if (frameGrabCount > 0 && durationSeconds && durationSeconds > 0) {
        const artifactBase = asNonEmptyString(artifactOptions.baseName) || "artifact";
        const framePattern = `${artifactDir}/${artifactBase}-frame-%03d.jpg`;
        const fpsValue = Math.max(0.2, frameGrabCount / durationSeconds);
        await callRoomTools({
          operation: "tool-run",
          roomId,
          requestId: artifactOptions.requestId || null,
          jobId: artifactOptions.jobId || null,
          toolId: "ffmpeg",
          cwd: getProjectEditDir(runtime, project),
          args: [
            "-y",
            "-i",
            String(artifactOptions.outputPath || ""),
            "-vf",
            `fps=${fpsValue}`,
            "-frames:v",
            String(frameGrabCount),
            framePattern,
          ],
          timeoutMs: 60_000,
        });
        const createdFrames = await listArtifactsWithPrefix(artifactDir, `${artifactBase}-frame-`);
        return transformComparisonArtifacts.concat(
          createdFrames
            .map((filePath) => buildArtifactEntry(filePath, "frame"))
            .filter(isArtifactEntry)
        );
      }
    }

    return transformComparisonArtifacts;
  }

  return { buildAuxiliaryArtifacts };
}
