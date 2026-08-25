import { normalizeLaboratoryTransformStages } from "../../../shared/transform-stress-test-model.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryMediaEditArtifactRuntime = LaboratoryRecord;

type LaboratoryProjectRecord = LaboratoryRecord & {
  edit?: unknown;
  source?: unknown;
};

type LaboratoryProjectEditRecord = LaboratoryRecord & {
  recipe?: unknown;
};

type LaboratoryProjectEditRecipeRecord = LaboratoryRecord & {
  audio?: unknown;
  image?: unknown;
  video?: unknown;
};

type LaboratoryProjectSourceRecord = LaboratoryRecord & {
  kind?: unknown;
  metadata?: unknown;
};

type LaboratoryAudioEditRecipeRecord = LaboratoryRecord & {
  spectrogram?: unknown;
};

type LaboratoryVideoEditRecipeRecord = LaboratoryRecord & {
  frameGrabCount?: unknown;
};

type LaboratoryDirectoryEntry = {
  isDirectory?: boolean;
  name?: string;
  path?: string;
};

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
    if (normalizedPath === null) {
      return null;
    }
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
      .filter(function (entry) {
        return entry.isDirectory !== true && String(entry.name || "").startsWith(filePrefix);
      })
      .map(function (entry) {
        return typeof entry.path === "string" ? entry.path : "";
      })
      .filter(Boolean)
      .sort();
  }

  function hasEnabledVisualTransformStages(project: LaboratoryProjectRecord) {
    const projectSource = toProjectSourceRecord(project.source);
    const recipe = toProjectEditRecipeRecord(toProjectEditRecord(project.edit).recipe);
    const visualRecipe =
      projectSource.kind === "image" ? toRecord(recipe.image) : toRecord(recipe.video);
    return normalizeLaboratoryTransformStages(visualRecipe["transformStages"], "visual").some(
      function (stage) {
        return stage.enabled;
      }
    );
  }

  function getTransformPreviewExtension(sourceKind: unknown) {
    return sourceKind === "image" ? "png" : "mp4";
  }

  function buildDifferenceCommand(
    sourceKind: unknown,
    baselinePath: string,
    transformedPath: string,
    differencePath: string
  ) {
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
    if (
      artifactOptions.mode !== "preview" ||
      (projectSource.kind !== "image" && projectSource.kind !== "video") ||
      !hasEnabledVisualTransformStages(project)
    ) {
      return [];
    }

    const transformedPath = asNonEmptyString(artifactOptions.outputPath);
    if (transformedPath === null) {
      return [];
    }
    const artifactBase = asNonEmptyString(artifactOptions.baseName) || "artifact";
    const extension = getTransformPreviewExtension(projectSource.kind);
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
      args: buildDifferenceCommand(
        projectSource.kind,
        baselinePath,
        transformedPath,
        differencePath
      ),
    });

    return [
      buildArtifactEntry(baselinePath, "transform-source-baseline", {
        comparisonRole: "source",
        geometryBasis: "base-edit-recipe",
        stressTransformsApplied: false,
      }),
      buildArtifactEntry(differencePath, "transform-difference", {
        comparisonRole: "difference",
        differenceMethod: "ffmpeg-blend-difference",
        geometryBasis: "base-edit-recipe",
        stressTransformsApplied: true,
      }),
    ].filter(isArtifactEntry);
  }

  async function buildAuxiliaryArtifacts(
    runtime: LaboratoryMediaEditArtifactRuntime,
    project: LaboratoryProjectRecord,
    options: LaboratoryArtifactOptions
  ) {
    const artifactOptions = toArtifactOptionsRecord(options);
    const projectSource = toProjectSourceRecord(project.source);
    const projectEdit = toProjectEditRecord(project.edit);
    const recipe = toProjectEditRecipeRecord(projectEdit.recipe);
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
      if (toAudioEditRecipeRecord(recipe.audio).spectrogram !== true) {
        return [];
      }
      const artifactBase = asNonEmptyString(artifactOptions.baseName) || "artifact";
      const spectrogramPath = `${artifactDir}/${artifactBase}-spectrogram.png`;

      await callRoomTools({
        operation: "tool-run",
        roomId: roomId,
        requestId: artifactOptions.requestId || null,
        jobId: artifactOptions.jobId || null,
        toolId: "ffmpeg",
        cwd: getProjectEditDir(runtime, project),
        args: [
          "-y",
          "-i",
          String(artifactOptions.outputPath || ""),
          "-lavfi",
          "showspectrumpic=s=1600x480:legend=0",
          "-frames:v",
          "1",
          spectrogramPath,
        ],
        timeoutMs: 60_000,
      });

      return [buildArtifactEntry(spectrogramPath, "spectrogram")].filter(isArtifactEntry);
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
          roomId: roomId,
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
            .map(function (filePath) {
              return buildArtifactEntry(filePath, "frame");
            })
            .filter(isArtifactEntry)
        );
      }
    }

    return transformComparisonArtifacts;
  }

  return {
    buildAuxiliaryArtifacts,
  };
}
