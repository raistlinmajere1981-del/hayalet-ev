// @ts-nocheck
export function createAudioAnalysisLocalProcessRunners(deps) {
  const {
    asNonEmptyString,
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
    writeJsonFile,
  } = deps;

  async function runSignalHealthAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    _artifactBase,
    _moduleOutputDir,
    moduleId
  ) {
    const audioProbe = await runAudioStructureProbe(runtime, project, requestId, jobId, target);
    const findings = [];
    const warnings = [];

    if (audioProbe.silence.count > 0) {
      findings.push(
        createProcessFinding(
          moduleId,
          "measured",
          audioProbe.silence.count > 3 ? "medium" : "low",
          "medium",
          "Silence pockets detected",
          `Silence detection found ${audioProbe.silence.count} pocket(s) inside the sampled audio path.`,
          audioProbe.silence.count,
          []
        )
      );
    }
    if (typeof audioProbe.volume.meanVolumeDb === "number") {
      warnings.push(`Mean volume: ${audioProbe.volume.meanVolumeDb} dB`);
    }

    return {
      findings: findings,
      artifacts: [],
      warnings: warnings,
      status: "ready",
      summary: "Signal health checks finished on the current target.",
    };
  }

  async function runSpectralArtifactsAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  ) {
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
    const artifacts = [spectrogram, waveform, descriptorArtifact].filter(Boolean);

    return {
      findings: descriptorArtifact
        ? [
            createProcessFinding(
              moduleId,
              "derived",
              "low",
              "medium",
              "Spectral descriptor baseline captured",
              "Centroid, rolloff, flatness, and flux summaries were derived from the active audio target.",
              4,
              [descriptorArtifact.id]
            ),
          ]
        : [],
      artifacts: artifacts,
      warnings: [],
      status: "ready",
      summary: "Spectral artifacts and descriptor summaries were generated for the current target.",
    };
  }

  async function runTranscriptionAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    _moduleOutputDir,
    moduleId
  ) {
    const speech = buildProcessSpeechAvailability(runtime, project);
    if (!speech.ready) {
      return {
        findings: [],
        artifacts: [],
        warnings: [],
        status: "blocked",
        summary: "Transcript tooling is not ready on this runtime.",
      };
    }

    const transcriptResult = await maybeRunWhisperProfileSample(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      45
    );
    if (transcriptResult && transcriptResult.artifact) {
      const transcriptArtifact = normalizeProcessArtifact({
        ...transcriptResult.artifact,
        moduleId: moduleId,
      });
      return {
        findings: [
          createProcessFinding(
            moduleId,
            "measured",
            "low",
            "medium",
            "Transcript sample captured",
            `Transcript sampling returned ${
              transcriptResult.text.split(/\s+/).filter(Boolean).length
            } words for the active audio target.`,
            1,
            [transcriptArtifact.id]
          ),
        ],
        artifacts: [transcriptArtifact],
        warnings: [],
        status: "ready",
        summary: "Transcript sampling finished for the active target.",
      };
    }

    return {
      findings: [],
      artifacts: [],
      warnings: [],
      status: "ready",
      summary: "Transcript tooling ran without a persisted sample artifact.",
    };
  }

  async function runProsodyAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  ) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);

    if (resolveOpenSmileProsodyRuntime(runtime) === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local openSMILE config package is unavailable on this runtime."],
        status: "blocked",
        summary: "Prosody config assets are missing from the room package.",
      };
    }

    const extraction = await runOpenSmileProsodyExtraction(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      "prosody"
    );
    const contourPath = extraction.contourPath;
    const summaryPath = `${moduleOutputDir}/${artifactBase}-prosody.json`;
    const prosodySummary = extraction.prosodySummary;
    await writeJsonFile(summaryPath, {
      generatedAt: new Date().toISOString(),
      target: clone(target),
      prosodySummary: prosodySummary,
    });

    const contourArtifact = createProcessArtifact(
      moduleId,
      "prosody-contours",
      contourPath,
      "Prosody Contours",
      {
        columnCount: prosodySummary.columns.length,
        frameCount: prosodySummary.frameCount,
      }
    );
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "prosody-summary",
      summaryPath,
      "Prosody Summary",
      {
        prosodySummary: prosodySummary,
      }
    );
    const artifacts = [contourArtifact, summaryArtifact].filter(Boolean);
    const artifactIds = artifacts.map(function (artifact) {
      return artifact.id;
    });
    const detailParts = [
      typeof prosodySummary.frameCount === "number" ? `${prosodySummary.frameCount} frames` : null,
      typeof prosodySummary.meanF0Hz === "number"
        ? `mean F0 ${Number(prosodySummary.meanF0Hz).toFixed(1)} Hz`
        : null,
      typeof prosodySummary.estimatedPauseCount === "number"
        ? `${prosodySummary.estimatedPauseCount} estimated pauses`
        : null,
    ].filter(Boolean);

    return {
      findings: [
        createProcessFinding(
          moduleId,
          "derived",
          "low",
          "medium",
          "Prosody contour baseline captured",
          detailParts.length > 0
            ? `openSMILE produced ${detailParts.join(", ")} for the active audio target.`
            : "openSMILE produced a prosody contour baseline for the active audio target.",
          detailParts.length,
          artifactIds
        ),
      ],
      artifacts: artifacts,
      warnings: [],
      status: "ready",
      summary: "Prosody contours and pacing metrics were generated for the current target.",
    };
  }

  async function runEmotionHeuristicAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  ) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);

    if (resolveOpenSmileProsodyRuntime(runtime) === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local openSMILE config package is unavailable on this runtime."],
        status: "blocked",
        summary: "Emotion heuristics need the same packaged openSMILE config assets as prosody.",
      };
    }

    const extraction = await runOpenSmileProsodyExtraction(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      "emotion-prosody"
    );
    const heuristic = buildEmotionHeuristicFromProsody(extraction.prosodySummary);
    const summaryPath = `${moduleOutputDir}/${artifactBase}-emotion.json`;
    await writeJsonFile(summaryPath, {
      generatedAt: new Date().toISOString(),
      target: clone(target),
      emotionHeuristic: heuristic,
    });

    const summaryArtifact = createProcessArtifact(
      moduleId,
      "emotion-summary",
      summaryPath,
      "Emotion Heuristic Summary",
      {
        emotionHeuristic: heuristic,
      }
    );
    const artifacts = [summaryArtifact].filter(Boolean);
    const artifactIds = artifacts.map(function (artifact) {
      return artifact.id;
    });
    const cueText =
      Array.isArray(heuristic.cues) && heuristic.cues.length > 0 ? heuristic.cues.join(" ") : null;

    return {
      findings: [
        createProcessFinding(
          moduleId,
          "heuristic",
          "low",
          heuristic.confidence,
          "Heuristic emotion label generated",
          cueText !== null
            ? `${heuristic.label}. ${cueText} ${heuristic.disclaimer}`
            : `${heuristic.label}. ${heuristic.disclaimer}`,
          Array.isArray(heuristic.cues) ? heuristic.cues.length : 0,
          artifactIds
        ),
      ],
      artifacts: artifacts,
      warnings: [heuristic.disclaimer],
      status: "ready",
      summary: "A coarse heuristic emotion label was derived from prosody signals.",
    };
  }

  return {
    runEmotionHeuristicAudioAnalyzer: runEmotionHeuristicAudioAnalyzer,
    runProsodyAudioAnalyzer: runProsodyAudioAnalyzer,
    runSignalHealthAudioAnalyzer: runSignalHealthAudioAnalyzer,
    runSpectralArtifactsAudioAnalyzer: runSpectralArtifactsAudioAnalyzer,
    runTranscriptionAudioAnalyzer: runTranscriptionAudioAnalyzer,
  };
}
