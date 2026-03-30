type LaboratoryRecord = Record<string, unknown>;

type AnalysisArtifactRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  callRoomTools: (payload: LaboratoryRecord) => Promise<LaboratoryRecord>;
  getProjectProfileDir: (
    runtime: { paths: { projectsDir: string } },
    project: { slug: string }
  ) => string;
  getProjectProfilePreflightDir: (
    runtime: { paths: { projectsDir: string } },
    project: { slug: string }
  ) => string;
  normalizeProcessArtifact: (rawValue: unknown) => LaboratoryRecord;
  normalizeProcessFinding: (rawValue: unknown) => LaboratoryRecord;
  normalizeProfileArtifact: (rawValue: unknown) => LaboratoryRecord;
  normalizeProfileSignal: (rawValue: unknown) => LaboratoryRecord;
  readTextFile: (filePath: string) => Promise<string>;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
  writeJsonFile: (filePath: string, value: unknown) => Promise<void>;
};

type RunProfileToolOptions = {
  requestId?: string | null;
  jobId?: string | null;
  toolId: string;
  executableName?: string;
  cwd: string;
  args: string[];
  timeoutMs: number;
  roomId?: string;
};

export function createLaboratoryAnalysisArtifactRuntime(deps: AnalysisArtifactRuntimeDeps) {
  const {
    asNonEmptyString,
    asNumber,
    callRoomTools,
    getProjectProfileDir,
    getProjectProfilePreflightDir,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeProfileArtifact,
    normalizeProfileSignal,
    readTextFile,
    roomId,
    toRecord,
    writeJsonFile,
  } = deps;

  function cloneValue(value: unknown): LaboratoryRecord {
    return toRecord(JSON.parse(JSON.stringify(value)) as unknown);
  }

  function toUnknownArray(value: unknown): unknown[] {
    return Array.isArray(value)
      ? value.map(function (entry): unknown {
          return entry;
        })
      : [];
  }

  function createProfileArtifact(kind: string, path: unknown, label: string, metadata: unknown) {
    const normalizedPath = asNonEmptyString(path);
    if (normalizedPath === null) {
      return null;
    }

    return normalizeProfileArtifact({
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: kind,
      path: normalizedPath,
      fileName: normalizedPath.split(/[\\/]/).pop() || normalizedPath,
      label: label,
      createdAt: new Date().toISOString(),
      metadata: toRecord(metadata),
    });
  }

  function createProfileSignal(
    laneId: string,
    kind: string,
    level: string,
    confidence: string,
    title: string,
    detail: string,
    evidenceCount: number,
    artifactIds: unknown
  ) {
    return normalizeProfileSignal({
      id: `${laneId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      laneId: laneId,
      kind: kind,
      level: level,
      confidence: confidence,
      title: title,
      detail: detail,
      evidenceCount: evidenceCount,
      artifactIds: Array.isArray(artifactIds) ? artifactIds : [],
    });
  }

  function createProcessArtifact(
    moduleId: string,
    kind: string,
    path: unknown,
    label: string,
    metadata: unknown
  ) {
    const artifact = createProfileArtifact(kind, path, label, metadata);
    if (artifact === null) {
      return null;
    }

    return normalizeProcessArtifact({
      ...artifact,
      moduleId: moduleId,
    });
  }

  function createProcessFinding(
    moduleId: string,
    kind: string,
    level: string,
    confidence: string,
    title: string,
    detail: string,
    evidenceCount: number,
    artifactIds: unknown
  ) {
    return normalizeProcessFinding({
      ...createProfileSignal(
        moduleId,
        kind,
        level,
        confidence,
        title,
        detail,
        evidenceCount,
        artifactIds
      ),
      moduleId: moduleId,
    });
  }

  async function runProfileTool(_runtime: unknown, options: RunProfileToolOptions) {
    const runResult = await callRoomTools({
      operation: "tool-run",
      roomId: options.roomId || roomId,
      requestId: options.requestId || null,
      jobId: options.jobId || null,
      toolId: options.toolId,
      executableName: options.executableName || undefined,
      cwd: options.cwd,
      args: options.args,
      timeoutMs: options.timeoutMs,
    });
    const runPayload = toRecord(runResult["run"]);
    const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
    if (runPayload["cancelled"] === true || exitCode !== 0) {
      throw new Error(asNonEmptyString(runPayload["stderr"]) || `${options.toolId} job failed.`);
    }
    return runPayload;
  }

  async function generateProfileMetadataArtifact(
    runtime: { paths: { projectsDir: string } },
    project: LaboratoryRecord,
    target: LaboratoryRecord,
    artifactBase: string
  ) {
    const metadataPath = `${getProjectProfilePreflightDir(runtime, project as { slug: string })}/${artifactBase}-metadata.json`;
    await writeJsonFile(metadataPath, {
      generatedAt: new Date().toISOString(),
      target: {
        requestedMode: target["requestedMode"],
        mode: target["mode"],
        outputId: target["outputId"],
        label: target["label"],
        fileName: target["fileName"],
        mimeType: target["mimeType"],
        path: target["path"],
        signature: target["signature"],
      },
      metadata: cloneValue(target["metadata"] || {}),
    });
    return createProfileArtifact("metadata", metadataPath, "Metadata Snapshot", {
      requestedMode: target["requestedMode"],
      mode: target["mode"],
    });
  }

  async function generateProfileFrameStrip(
    runtime: { paths: { projectsDir: string } },
    project: LaboratoryRecord,
    requestId: string | null,
    jobId: string | null,
    target: LaboratoryRecord,
    artifactBase: string,
    sampleWindowSeconds: number,
    tileCount: unknown
  ) {
    const sourceKind =
      asNonEmptyString((project["source"] as LaboratoryRecord | undefined)?.["kind"]) || "video";
    const outputPath = `${getProjectProfilePreflightDir(runtime, project as { slug: string })}/${artifactBase}-frames.png`;

    if (sourceKind === "image") {
      await runProfileTool(runtime, {
        requestId: requestId,
        jobId: jobId,
        toolId: "ffmpeg",
        cwd: getProjectProfileDir(runtime, project as { slug: string }),
        args: [
          "-y",
          "-i",
          target["path"] as string,
          "-vf",
          "scale=1280:-1:flags=lanczos",
          "-frames:v",
          "1",
          outputPath,
        ],
        timeoutMs: 90_000,
      });
      return createProfileArtifact("frame-strip", outputPath, "Profile Reference Frame", {});
    }

    const normalizedTileCount = Math.max(2, Math.round(asNumber(tileCount) || 4));
    const intervalSeconds = Math.max(
      1,
      Math.round((sampleWindowSeconds || 40) / normalizedTileCount)
    );
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project as { slug: string }),
      args: [
        "-y",
        "-i",
        target["path"] as string,
        "-vf",
        `fps=1/${intervalSeconds},scale=420:-1:flags=lanczos,tile=${normalizedTileCount}x1`,
        "-frames:v",
        "1",
        outputPath,
      ],
      timeoutMs: 90_000,
    });
    return createProfileArtifact("frame-strip", outputPath, "Frame Strip", {
      tileCount: normalizedTileCount,
      intervalSeconds: intervalSeconds,
    });
  }

  async function generateProfileSpectrogram(
    runtime: { paths: { projectsDir: string } },
    project: LaboratoryRecord,
    requestId: string | null,
    jobId: string | null,
    target: LaboratoryRecord,
    artifactBase: string
  ) {
    const outputPath = `${getProjectProfilePreflightDir(runtime, project as { slug: string })}/${artifactBase}-spectrogram.png`;
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project as { slug: string }),
      args: [
        "-y",
        "-i",
        target["path"] as string,
        "-lavfi",
        "showspectrumpic=s=1600x440:legend=0",
        "-frames:v",
        "1",
        outputPath,
      ],
      timeoutMs: 90_000,
    });
    return createProfileArtifact("spectrogram", outputPath, "Spectrogram", {});
  }

  async function maybeRunWhisperProfileSample(
    runtime: { paths: { projectsDir: string } },
    project: LaboratoryRecord,
    requestId: string | null,
    jobId: string | null,
    target: LaboratoryRecord,
    artifactBase: string,
    transcriptSampleSeconds: unknown
  ) {
    const profileReadiness = toRecord(toRecord(project["profile"])["readiness"]);
    const selectedModel =
      toUnknownArray(profileReadiness["models"]).find(function (entry) {
        return toRecord(entry)["selected"] === true;
      }) || null;
    const selectedModelRecord = selectedModel === null ? null : toRecord(selectedModel);
    if (selectedModelRecord === null || selectedModelRecord["ready"] !== true) {
      return null;
    }

    const modelPath = asNonEmptyString(selectedModelRecord["path"]);
    if (modelPath === null) {
      return null;
    }

    const language = asNonEmptyString(selectedModelRecord["language"]) || "en";
    const sampleWavPath = `${getProjectProfilePreflightDir(runtime, project as { slug: string })}/${artifactBase}-speech.wav`;
    const transcriptBase = `${getProjectProfilePreflightDir(runtime, project as { slug: string })}/${artifactBase}-transcript`;
    const transcriptPath = `${transcriptBase}.txt`;

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project as { slug: string }),
      args: [
        "-y",
        "-i",
        target["path"] as string,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-t",
        String(Math.max(5, Math.round(asNumber(transcriptSampleSeconds) || 45))),
        sampleWavPath,
      ],
      timeoutMs: 120_000,
    });
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "whisper.cpp",
      cwd: getProjectProfileDir(runtime, project as { slug: string }),
      args: ["-m", modelPath, "-f", sampleWavPath, "-l", language, "-otxt", "-of", transcriptBase],
      timeoutMs: 8 * 60 * 1000,
    });

    const transcriptText = asNonEmptyString(await readTextFile(transcriptPath));
    if (transcriptText === null) {
      return null;
    }

    const artifact = createProfileArtifact("transcript", transcriptPath, "Transcript Sample", {
      wordCount: transcriptText.split(/\s+/).filter(Boolean).length,
      language: language,
    });

    return {
      text: transcriptText,
      artifact: artifact,
    };
  }

  function buildSyntheticProfileSignal(
    signals: unknown[],
    sensitivity: number,
    artifactIds: unknown
  ) {
    const score = signals.reduce<number>(function (total, entry) {
      const signal = toRecord(entry);
      const level = asNonEmptyString(signal["level"]) || "low";
      return total + (level === "high" ? 3 : level === "medium" ? 2 : 1);
    }, 0);
    const threshold = sensitivity >= 0.68 ? 4 : sensitivity >= 0.5 ? 5 : 6;
    if (score < threshold) {
      return null;
    }

    const level = score >= threshold + 3 ? "high" : "medium";
    const confidence = score >= threshold + 2 ? "medium" : "low";
    return createProfileSignal(
      "synthetic-suspicion",
      "derived",
      level,
      confidence,
      "Composite suspicion score elevated",
      "Multiple weak structure, continuity, or audio anomalies overlap in the sampled profile pass.",
      signals.length,
      artifactIds
    );
  }

  async function generateProcessMetadataArtifact(
    _runtime: unknown,
    _project: unknown,
    target: LaboratoryRecord,
    artifactBase: string,
    outputDir: string,
    moduleId: string
  ) {
    const metadataPath = `${outputDir}/${artifactBase}-metadata.json`;
    await writeJsonFile(metadataPath, {
      generatedAt: new Date().toISOString(),
      target: cloneValue(target),
      metadata: cloneValue(target["metadata"] || {}),
    });
    return createProcessArtifact(moduleId, "metadata", metadataPath, "Metadata Snapshot", {
      mode: target["mode"],
    });
  }

  function getFindingSeverityRank(level: unknown) {
    const nextLevel = asNonEmptyString(level) || "low";
    return nextLevel === "high" ? 3 : nextLevel === "medium" ? 2 : 1;
  }

  function formatIdentifierLabel(value: unknown) {
    const token = asNonEmptyString(value) || "item";
    return token
      .split(/[-_]/)
      .filter(Boolean)
      .map(function (segment: string) {
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      })
      .join(" ");
  }

  return {
    buildSyntheticProfileSignal,
    createProcessArtifact,
    createProcessFinding,
    createProfileArtifact,
    createProfileSignal,
    formatIdentifierLabel,
    generateProcessMetadataArtifact,
    generateProfileFrameStrip,
    generateProfileMetadataArtifact,
    generateProfileSpectrogram,
    getFindingSeverityRank,
    maybeRunWhisperProfileSample,
    runProfileTool,
  };
}
