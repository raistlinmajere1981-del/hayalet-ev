export function createLaboratoryAnalysisArtifactRuntime(deps) {
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
    writeJsonFile
  } = deps;
  function cloneValue(value) {
    return toRecord(JSON.parse(JSON.stringify(value)));
  }
  function toUnknownArray(value) {
    return Array.isArray(value) ? value.map(function(entry) {
      return entry;
    }) : [];
  }
  function createProfileArtifact(kind, path, label, metadata) {
    const normalizedPath = asNonEmptyString(path);
    if (normalizedPath === null) {
      return null;
    }
    return normalizeProfileArtifact({
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      path: normalizedPath,
      fileName: normalizedPath.split(/[\\/]/).pop() || normalizedPath,
      label,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: toRecord(metadata)
    });
  }
  function createProfileSignal(laneId, kind, level, confidence, title, detail, evidenceCount, artifactIds) {
    return normalizeProfileSignal({
      id: `${laneId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      laneId,
      kind,
      level,
      confidence,
      title,
      detail,
      evidenceCount,
      artifactIds: Array.isArray(artifactIds) ? artifactIds : []
    });
  }
  function createProcessArtifact(moduleId, kind, path, label, metadata) {
    const artifact = createProfileArtifact(kind, path, label, metadata);
    if (artifact === null) {
      return null;
    }
    return normalizeProcessArtifact({
      ...artifact,
      moduleId
    });
  }
  function createProcessFinding(moduleId, kind, level, confidence, title, detail, evidenceCount, artifactIds) {
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
      moduleId
    });
  }
  async function runProfileTool(_runtime, options) {
    const runResult = await callRoomTools({
      operation: "tool-run",
      roomId: options.roomId || roomId,
      requestId: options.requestId || null,
      jobId: options.jobId || null,
      toolId: options.toolId,
      executableName: options.executableName || void 0,
      cwd: options.cwd,
      args: options.args,
      timeoutMs: options.timeoutMs
    });
    const runPayload = toRecord(runResult["run"]);
    const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
    if (runPayload["cancelled"] === true || exitCode !== 0) {
      throw new Error(asNonEmptyString(runPayload["stderr"]) || `${options.toolId} job failed.`);
    }
    return runPayload;
  }
  async function generateProfileMetadataArtifact(runtime, project, target, artifactBase) {
    const metadataPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-metadata.json`;
    await writeJsonFile(metadataPath, {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      target: {
        requestedMode: target["requestedMode"],
        mode: target["mode"],
        outputId: target["outputId"],
        label: target["label"],
        fileName: target["fileName"],
        mimeType: target["mimeType"],
        path: target["path"],
        signature: target["signature"]
      },
      metadata: cloneValue(target["metadata"] || {})
    });
    return createProfileArtifact("metadata", metadataPath, "Metadata Snapshot", {
      requestedMode: target["requestedMode"],
      mode: target["mode"]
    });
  }
  async function generateProfileFrameStrip(runtime, project, requestId, jobId, target, artifactBase, sampleWindowSeconds, tileCount) {
    const sourceKind = asNonEmptyString(project["source"]?.["kind"]) || "video";
    const outputPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-frames.png`;
    if (sourceKind === "image") {
      await runProfileTool(runtime, {
        requestId,
        jobId,
        toolId: "ffmpeg",
        cwd: getProjectProfileDir(runtime, project),
        args: [
          "-y",
          "-i",
          target["path"],
          "-vf",
          "scale=1280:-1:flags=lanczos",
          "-frames:v",
          "1",
          outputPath
        ],
        timeoutMs: 9e4
      });
      return createProfileArtifact("frame-strip", outputPath, "Profile Reference Frame", {});
    }
    const normalizedTileCount = Math.max(2, Math.round(asNumber(tileCount) || 4));
    const intervalSeconds = Math.max(
      1,
      Math.round((sampleWindowSeconds || 40) / normalizedTileCount)
    );
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project),
      args: [
        "-y",
        "-i",
        target["path"],
        "-vf",
        `fps=1/${intervalSeconds},scale=420:-1:flags=lanczos,tile=${normalizedTileCount}x1`,
        "-frames:v",
        "1",
        outputPath
      ],
      timeoutMs: 9e4
    });
    return createProfileArtifact("frame-strip", outputPath, "Frame Strip", {
      tileCount: normalizedTileCount,
      intervalSeconds
    });
  }
  async function generateProfileSpectrogram(runtime, project, requestId, jobId, target, artifactBase) {
    const outputPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-spectrogram.png`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project),
      args: [
        "-y",
        "-i",
        target["path"],
        "-lavfi",
        "showspectrumpic=s=1600x440:legend=0",
        "-frames:v",
        "1",
        outputPath
      ],
      timeoutMs: 9e4
    });
    return createProfileArtifact("spectrogram", outputPath, "Spectrogram", {});
  }
  async function maybeRunWhisperProfileSample(runtime, project, requestId, jobId, target, artifactBase, transcriptSampleSeconds) {
    const profileReadiness = toRecord(toRecord(project["profile"])["readiness"]);
    const selectedModel = toUnknownArray(profileReadiness["models"]).find(function(entry) {
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
    const sampleWavPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-speech.wav`;
    const transcriptBase = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-transcript`;
    const transcriptPath = `${transcriptBase}.txt`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project),
      args: [
        "-y",
        "-i",
        target["path"],
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-t",
        String(Math.max(5, Math.round(asNumber(transcriptSampleSeconds) || 45))),
        sampleWavPath
      ],
      timeoutMs: 12e4
    });
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "whisper.cpp",
      cwd: getProjectProfileDir(runtime, project),
      args: ["-m", modelPath, "-f", sampleWavPath, "-l", language, "-otxt", "-of", transcriptBase],
      timeoutMs: 8 * 60 * 1e3
    });
    const transcriptText = asNonEmptyString(await readTextFile(transcriptPath));
    if (transcriptText === null) {
      return null;
    }
    const artifact = createProfileArtifact("transcript", transcriptPath, "Transcript Sample", {
      wordCount: transcriptText.split(/\s+/).filter(Boolean).length,
      language
    });
    return {
      text: transcriptText,
      artifact
    };
  }
  function buildSyntheticProfileSignal(signals, sensitivity, artifactIds) {
    const score = signals.reduce(function(total, entry) {
      const signal = toRecord(entry);
      const level2 = asNonEmptyString(signal["level"]) || "low";
      return total + (level2 === "high" ? 3 : level2 === "medium" ? 2 : 1);
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
  async function generateProcessMetadataArtifact(_runtime, _project, target, artifactBase, outputDir, moduleId) {
    const metadataPath = `${outputDir}/${artifactBase}-metadata.json`;
    await writeJsonFile(metadataPath, {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      target: cloneValue(target),
      metadata: cloneValue(target["metadata"] || {})
    });
    return createProcessArtifact(moduleId, "metadata", metadataPath, "Metadata Snapshot", {
      mode: target["mode"]
    });
  }
  async function generateProcessFramePreviewArtifact(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId, sampleWindowSeconds, tileCount, label = "Frame Preview") {
    const sourceKind = asNonEmptyString(project["source"]?.["kind"]) || "video";
    const outputPath = `${outputDir}/${artifactBase}-frames.png`;
    if (sourceKind === "image") {
      await runProfileTool(runtime, {
        requestId,
        jobId,
        toolId: "ffmpeg",
        cwd: getProjectProfileDir(runtime, project),
        args: [
          "-y",
          "-i",
          target["path"],
          "-vf",
          "scale=1280:-1:flags=lanczos",
          "-frames:v",
          "1",
          outputPath
        ],
        timeoutMs: 9e4
      });
      return createProcessArtifact(moduleId, "frame-preview", outputPath, label, {
        sourceKind
      });
    }
    const normalizedTileCount = Math.max(2, Math.round(asNumber(tileCount) || 4));
    const intervalSeconds = Math.max(
      1,
      Math.round((sampleWindowSeconds || 40) / normalizedTileCount)
    );
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project),
      args: [
        "-y",
        "-i",
        target["path"],
        "-vf",
        `fps=1/${intervalSeconds},scale=420:-1:flags=lanczos,tile=${normalizedTileCount}x1`,
        "-frames:v",
        "1",
        outputPath
      ],
      timeoutMs: 9e4
    });
    return createProcessArtifact(moduleId, "frame-preview", outputPath, label, {
      sourceKind,
      tileCount: normalizedTileCount,
      intervalSeconds
    });
  }
  async function generateProcessVisualTransformArtifact(runtime, project, requestId, jobId, target, artifactBase, outputDir, moduleId, filterGraph, label, metadata = {}) {
    const outputPath = `${outputDir}/${artifactBase}-transform.png`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project),
      args: [
        "-y",
        "-i",
        target["path"],
        "-vf",
        `${filterGraph},scale=1280:-1:flags=lanczos`,
        "-frames:v",
        "1",
        outputPath
      ],
      timeoutMs: 9e4
    });
    return createProcessArtifact(moduleId, "transform-preview", outputPath, label, {
      ...metadata,
      filterGraph
    });
  }
  function getFindingSeverityRank(level) {
    const nextLevel = asNonEmptyString(level) || "low";
    return nextLevel === "high" ? 3 : nextLevel === "medium" ? 2 : 1;
  }
  function formatIdentifierLabel(value) {
    const token = asNonEmptyString(value) || "item";
    return token.split(/[-_]/).filter(Boolean).map(function(segment) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    }).join(" ");
  }
  return {
    buildSyntheticProfileSignal,
    createProcessArtifact,
    createProcessFinding,
    createProfileArtifact,
    createProfileSignal,
    formatIdentifierLabel,
    generateProcessFramePreviewArtifact,
    generateProcessMetadataArtifact,
    generateProcessVisualTransformArtifact,
    generateProfileFrameStrip,
    generateProfileMetadataArtifact,
    generateProfileSpectrogram,
    getFindingSeverityRank,
    maybeRunWhisperProfileSample,
    runProfileTool
  };
}
