export function createAudioAnalysisLocalProcessRunners(deps) {
  const {
    buildEmotionHeuristicFromProsody,
    buildProcessSpeechAvailability,
    clone,
    createProcessArtifact,
    createProcessFinding,
    ensureProcessRuntimeDirectories,
    generateProcessSpectrogram,
    generateProcessWaveform,
    generateSpectralDescriptorArtifact,
    maybeRunWhisperProfileSample,
    normalizeProcessArtifact,
    resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe,
    runOpenSmileProsodyExtraction,
    toRecord,
    writeJsonFile
  } = deps;
  function toAudioProbeBucketRecord(value) {
    return toRecord(value);
  }
  function toAudioVolumeRecord(value) {
    return toRecord(value);
  }
  function toAudioProbeRecord(value) {
    return toRecord(value);
  }
  function toProcessArtifactRecord(value) {
    return toRecord(value);
  }
  function toTranscriptResultRecord(value) {
    return toRecord(value);
  }
  function toProsodySummaryRecord(value) {
    return toRecord(value);
  }
  function toProsodyExtractionRecord(value) {
    return toRecord(value);
  }
  function toEmotionHeuristicRecord(value) {
    return toRecord(value);
  }
  function compactArtifacts(values) {
    return values.reduce(function(accumulator, value) {
      if (!value) {
        return accumulator;
      }
      accumulator.push(toProcessArtifactRecord(value));
      return accumulator;
    }, []);
  }
  async function runSignalHealthAudioAnalyzer(runtime, project, requestId, jobId, target, _artifactBase, _moduleOutputDir, moduleId) {
    const audioProbe = toAudioProbeRecord(
      await runAudioStructureProbe(runtime, project, requestId, jobId, target)
    );
    const silence = toAudioProbeBucketRecord(audioProbe.silence);
    const volume = toAudioVolumeRecord(audioProbe.volume);
    const silenceCount = typeof silence.count === "number" && Number.isFinite(silence.count) ? silence.count : 0;
    const findings = [];
    const warnings = [];
    if (silenceCount > 0) {
      findings.push(
        createProcessFinding(
          moduleId,
          "measured",
          silenceCount > 3 ? "medium" : "low",
          "medium",
          "Silence pockets detected",
          `Silence detection found ${silenceCount} pocket(s) inside the sampled audio path.`,
          silenceCount,
          []
        )
      );
    }
    if (typeof volume.meanVolumeDb === "number" && Number.isFinite(volume.meanVolumeDb)) {
      warnings.push(`Mean volume: ${volume.meanVolumeDb} dB`);
    }
    return {
      artifacts: [],
      findings,
      status: "ready",
      summary: "Signal health checks finished on the current target.",
      warnings
    };
  }
  async function runSpectralArtifactsAudioAnalyzer(runtime, project, requestId, jobId, target, artifactBase, moduleOutputDir, moduleId) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);
    const spectrogram = await generateProcessSpectrogram(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      moduleId
    );
    const waveform = await generateProcessWaveform(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      moduleId
    );
    const descriptorArtifact = await generateSpectralDescriptorArtifact(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      moduleId
    );
    const artifacts = compactArtifacts([spectrogram, waveform, descriptorArtifact]);
    const descriptorArtifactRecord = descriptorArtifact ? toProcessArtifactRecord(descriptorArtifact) : null;
    return {
      artifacts,
      findings: descriptorArtifactRecord ? [
        createProcessFinding(
          moduleId,
          "derived",
          "low",
          "medium",
          "Spectral descriptor baseline captured",
          "Centroid, rolloff, flatness, and flux summaries were derived from the active audio target.",
          4,
          [String(descriptorArtifactRecord.id || "")]
        )
      ] : [],
      status: "ready",
      summary: "Spectral artifacts and descriptor summaries were generated for the current target.",
      warnings: []
    };
  }
  async function runTranscriptionAudioAnalyzer(runtime, project, requestId, jobId, target, artifactBase, _moduleOutputDir, moduleId) {
    const speech = buildProcessSpeechAvailability(runtime, project);
    if (speech.ready !== true) {
      return {
        artifacts: [],
        findings: [],
        status: "blocked",
        summary: "Transcript tooling is not ready on this runtime.",
        warnings: []
      };
    }
    const transcriptResult = toTranscriptResultRecord(
      await maybeRunWhisperProfileSample(
        runtime,
        project,
        requestId,
        jobId,
        target,
        artifactBase,
        45
      )
    );
    const transcriptArtifact = transcriptResult.artifact ? normalizeProcessArtifact({
      ...toRecord(transcriptResult.artifact),
      moduleId
    }) : null;
    const transcriptArtifactRecord = transcriptArtifact ? toProcessArtifactRecord(transcriptArtifact) : null;
    if (transcriptArtifactRecord) {
      const transcriptText = typeof transcriptResult.text === "string" ? transcriptResult.text : "";
      return {
        artifacts: [transcriptArtifactRecord],
        findings: [
          createProcessFinding(
            moduleId,
            "measured",
            "low",
            "medium",
            "Transcript sample captured",
            `Transcript sampling returned ${transcriptText.split(/\s+/).filter(Boolean).length} words for the active audio target.`,
            1,
            [String(transcriptArtifactRecord.id || "")]
          )
        ],
        status: "ready",
        summary: "Transcript sampling finished for the active target.",
        warnings: []
      };
    }
    return {
      artifacts: [],
      findings: [],
      status: "ready",
      summary: "Transcript tooling ran without a persisted sample artifact.",
      warnings: []
    };
  }
  async function runProsodyAudioAnalyzer(runtime, project, requestId, jobId, target, artifactBase, moduleOutputDir, moduleId) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);
    if (resolveOpenSmileProsodyRuntime(runtime) === null) {
      return {
        artifacts: [],
        findings: [],
        status: "blocked",
        summary: "Prosody config assets are missing from the room package.",
        warnings: ["Room-local openSMILE config package is unavailable on this runtime."]
      };
    }
    const extraction = toProsodyExtractionRecord(
      await runOpenSmileProsodyExtraction(
        runtime,
        project,
        requestId,
        jobId,
        target,
        artifactBase,
        moduleOutputDir,
        "prosody"
      )
    );
    const contourPath = typeof extraction.contourPath === "string" ? extraction.contourPath : "";
    const summaryPath = `${moduleOutputDir}/${artifactBase}-prosody.json`;
    const prosodySummary = toProsodySummaryRecord(extraction.prosodySummary);
    await writeJsonFile(summaryPath, {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      prosodySummary,
      target: toRecord(clone(target))
    });
    const contourArtifact = createProcessArtifact(
      moduleId,
      "prosody-contours",
      contourPath,
      "Prosody Contours",
      {
        columnCount: Array.isArray(prosodySummary.columns) ? prosodySummary.columns.length : 0,
        frameCount: typeof prosodySummary.frameCount === "number" ? prosodySummary.frameCount : null
      }
    );
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "prosody-summary",
      summaryPath,
      "Prosody Summary",
      {
        prosodySummary
      }
    );
    const artifacts = compactArtifacts([contourArtifact, summaryArtifact]);
    const artifactIds = artifacts.map(function(artifact) {
      return typeof artifact.id === "string" && artifact.id.trim() !== "" ? artifact.id : null;
    }).filter((artifactId) => artifactId !== null);
    const detailParts = [
      typeof prosodySummary.frameCount === "number" ? `${prosodySummary.frameCount} frames` : null,
      typeof prosodySummary.meanF0Hz === "number" ? `mean F0 ${Number(prosodySummary.meanF0Hz).toFixed(1)} Hz` : null,
      typeof prosodySummary.estimatedPauseCount === "number" ? `${prosodySummary.estimatedPauseCount} estimated pauses` : null
    ].filter((entry) => entry !== null);
    return {
      artifacts,
      findings: [
        createProcessFinding(
          moduleId,
          "derived",
          "low",
          "medium",
          "Prosody contour baseline captured",
          detailParts.length > 0 ? `openSMILE produced ${detailParts.join(", ")} for the active audio target.` : "openSMILE produced a prosody contour baseline for the active audio target.",
          detailParts.length,
          artifactIds
        )
      ],
      status: "ready",
      summary: "Prosody contours and pacing metrics were generated for the current target.",
      warnings: []
    };
  }
  async function runEmotionHeuristicAudioAnalyzer(runtime, project, requestId, jobId, target, artifactBase, moduleOutputDir, moduleId) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);
    if (resolveOpenSmileProsodyRuntime(runtime) === null) {
      return {
        artifacts: [],
        findings: [],
        status: "blocked",
        summary: "Emotion heuristics need the same packaged openSMILE config assets as prosody.",
        warnings: ["Room-local openSMILE config package is unavailable on this runtime."]
      };
    }
    const extraction = toProsodyExtractionRecord(
      await runOpenSmileProsodyExtraction(
        runtime,
        project,
        requestId,
        jobId,
        target,
        artifactBase,
        moduleOutputDir,
        "emotion-prosody"
      )
    );
    const heuristic = toEmotionHeuristicRecord(
      buildEmotionHeuristicFromProsody(toProsodySummaryRecord(extraction.prosodySummary))
    );
    const summaryPath = `${moduleOutputDir}/${artifactBase}-emotion.json`;
    await writeJsonFile(summaryPath, {
      emotionHeuristic: heuristic,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      target: toRecord(clone(target))
    });
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "emotion-summary",
      summaryPath,
      "Emotion Heuristic Summary",
      {
        emotionHeuristic: heuristic
      }
    );
    const artifacts = compactArtifacts([summaryArtifact]);
    const artifactIds = artifacts.map(function(artifact) {
      return typeof artifact.id === "string" && artifact.id.trim() !== "" ? artifact.id : null;
    }).filter((artifactId) => artifactId !== null);
    const cueText = Array.isArray(heuristic.cues) && heuristic.cues.length > 0 ? heuristic.cues.join(" ") : null;
    const disclaimer = typeof heuristic.disclaimer === "string" ? heuristic.disclaimer : "Heuristic output only.";
    const label = typeof heuristic.label === "string" ? heuristic.label : "Emotion label";
    const confidence = typeof heuristic.confidence === "string" && heuristic.confidence.trim() !== "" ? heuristic.confidence : "low";
    return {
      artifacts,
      findings: [
        createProcessFinding(
          moduleId,
          "heuristic",
          "low",
          confidence,
          "Heuristic emotion label generated",
          cueText !== null ? `${label}. ${cueText} ${disclaimer}` : `${label}. ${disclaimer}`,
          Array.isArray(heuristic.cues) ? heuristic.cues.length : 0,
          artifactIds
        )
      ],
      status: "ready",
      summary: "A coarse heuristic emotion label was derived from prosody signals.",
      warnings: [disclaimer]
    };
  }
  return {
    runEmotionHeuristicAudioAnalyzer,
    runProsodyAudioAnalyzer,
    runSignalHealthAudioAnalyzer,
    runSpectralArtifactsAudioAnalyzer,
    runTranscriptionAudioAnalyzer
  };
}
