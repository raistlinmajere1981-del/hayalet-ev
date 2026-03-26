import {
  getAudioAnalysisDiarizationDir,
  getAudioAnalysisDiarizationScriptPath,
  getAudioAnalysisMusicDir,
  getAudioAnalysisMusicScriptPath,
  getAudioAnalysisProcessRootDir,
  getAudioAnalysisYamnetDir,
  getAudioAnalysisYamnetScriptPath,
} from "../../../shared/host/project-paths.js";

export function createAudioAnalysisProcessRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    buildEmotionHeuristicFromProsody,
    buildProcessSpeechAvailability,
    clone,
    createProcessArtifact,
    createProcessFinding,
    ensureRuntimeDirectory,
    listDirectory,
    maybeRunWhisperProfileSample,
    normalizeProcessArtifact,
    parseAspectralStatsText,
    readJsonFile,
    readTextFile,
    resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe,
    runOpenSmileProsodyExtraction,
    runProfileTool,
    sanitizeFileSegment,
    toRecord,
    writeJsonFile,
  } = deps;

  function getModuleProcessDir(runtime, project, moduleId) {
    return `${getAudioAnalysisProcessRootDir(runtime, project)}/${sanitizeFileSegment(moduleId, "audio-module")}`;
  }

  async function generateProcessSpectrogram(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    outputDir,
    moduleId
  ) {
    const outputPath = `${outputDir}/${artifactBase}-spectrogram.png`;
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: ["-y", "-i", target.path, "-lavfi", "showspectrumpic=s=1600x440:legend=0", "-frames:v", "1", outputPath],
      timeoutMs: 90_000,
    });
    return createProcessArtifact(moduleId, "spectrogram", outputPath, "Spectrogram", {});
  }

  async function generateProcessWaveform(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    outputDir,
    moduleId
  ) {
    const outputPath = `${outputDir}/${artifactBase}-waveform.png`;
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: [
        "-y",
        "-i",
        target.path,
        "-filter_complex",
        "showwavespic=s=1600x440:split_channels=0",
        "-frames:v",
        "1",
        outputPath,
      ],
      timeoutMs: 90_000,
    });
    return createProcessArtifact(moduleId, "waveform", outputPath, "Waveform", {});
  }

  async function generateSpectralDescriptorArtifact(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    outputDir,
    moduleId
  ) {
    const textPath = `${outputDir}/${artifactBase}-spectral.txt`;
    const jsonPath = `${outputDir}/${artifactBase}-spectral.json`;
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: [
        "-y",
        "-i",
        target.path,
        "-af",
        `aspectralstats=measure=centroid+rolloff+flatness+flux,ametadata=mode=print:file=${textPath}:direct=1`,
        "-f",
        "null",
        "-",
      ],
      timeoutMs: 90_000,
    });

    const descriptorSummary = parseAspectralStatsText(await readTextFile(textPath));
    await writeJsonFile(jsonPath, {
      generatedAt: new Date().toISOString(),
      target: clone(target),
      descriptorSummary: descriptorSummary,
    });
    return createProcessArtifact(moduleId, "spectral-descriptors", jsonPath, "Spectral Descriptor Summary", {
      descriptorSummary: descriptorSummary,
    });
  }

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
    await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
    await ensureRuntimeDirectory(moduleOutputDir, requestId);

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
    await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
    await ensureRuntimeDirectory(moduleOutputDir, requestId);

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
    await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
    await ensureRuntimeDirectory(moduleOutputDir, requestId);

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

  async function runSoundEventsAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  ) {
    await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
    await ensureRuntimeDirectory(moduleOutputDir, requestId);

    const yamnetScriptPath = getAudioAnalysisYamnetScriptPath(runtime);
    if (yamnetScriptPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local YAMNet helper script is unavailable on this runtime."],
        status: "blocked",
        summary: "YAMNet helper assets are missing from the room package.",
      };
    }

    const wavPath = `${moduleOutputDir}/${artifactBase}-yamnet.wav`;
    const summaryPath = `${moduleOutputDir}/${artifactBase}-sound-events.json`;

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: ["-y", "-i", target.path, "-vn", "-ac", "1", "-ar", "16000", wavPath],
      timeoutMs: 3 * 60 * 1000,
    });

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "yamnet",
      cwd: getAudioAnalysisYamnetDir(runtime) || getAudioAnalysisProcessRootDir(runtime, project),
      args: [yamnetScriptPath, "--input", wavPath, "--output", summaryPath, "--top-k", "8", "--threshold", "0.15"],
      timeoutMs: 8 * 60 * 1000,
    });

    const summaryPayload = toRecord(await readJsonFile(summaryPath));
    const topClasses = Array.isArray(summaryPayload.topClasses) ? summaryPayload.topClasses.map(toRecord) : [];
    const headline = topClasses[0] || null;
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "sound-events-summary",
      summaryPath,
      "Sound Events Summary",
      {
        topClasses: topClasses,
        modelVersion: asNonEmptyString(summaryPayload.modelVersion),
        classCount: topClasses.length,
      }
    );
    const artifacts = [summaryArtifact].filter(Boolean);
    const artifactIds = artifacts.map(function (artifact) {
      return artifact.id;
    });
    const warningText =
      asNonEmptyString(summaryPayload.warning) ||
      "YAMNet predictions are broad sound-event suggestions and should be reviewed manually.";

    return {
      findings:
        headline !== null
          ? [
              createProcessFinding(
                moduleId,
                "model",
                "low",
                typeof headline.score === "number" && headline.score >= 0.35 ? "medium" : "low",
                "Top sound event candidates captured",
                `Top class: ${headline.label || headline.className || "unknown"} (${typeof headline.score === "number" ? headline.score.toFixed(3) : "n/a"}). ${warningText}`,
                topClasses.length,
                artifactIds
              ),
            ]
          : [],
      artifacts: artifacts,
      warnings: [warningText],
      status: "ready",
      summary: "Sound event candidates were generated from the active audio target.",
    };
  }

  async function runSpeakerDiarizationAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  ) {
    await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
    await ensureRuntimeDirectory(moduleOutputDir, requestId);

    const diarizationScriptPath = getAudioAnalysisDiarizationScriptPath(runtime);
    if (diarizationScriptPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local diarization helper script is unavailable on this runtime."],
        status: "blocked",
        summary: "Speaker diarization helper assets are missing from the room package.",
      };
    }

    const preparedInputBase = sanitizeFileSegment(`${artifactBase}-speaker-input`, "speaker-input");
    const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
    const summaryPath = `${moduleOutputDir}/${artifactBase}-speaker-diarization.json`;

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: ["-y", "-i", target.path, "-vn", "-ac", "1", "-ar", "16000", preparedInputPath],
      timeoutMs: 4 * 60 * 1000,
    });

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "pyaudioanalysis",
      cwd: getAudioAnalysisDiarizationDir(runtime) || getAudioAnalysisProcessRootDir(runtime, project),
      args: [diarizationScriptPath, "--input", preparedInputPath, "--output", summaryPath],
      timeoutMs: 12 * 60 * 1000,
    });

    const summaryPayload = toRecord(await readJsonFile(summaryPath));
    const segments = Array.isArray(summaryPayload.segments) ? summaryPayload.segments.map(toRecord) : [];
    const fallbackApplied = summaryPayload.fallbackApplied === true;
    const effectiveNumSpeakers = asNumber(summaryPayload.effectiveNumSpeakers);
    const diarizationSummary = {
      speakerCount: typeof summaryPayload.speakerCount === "number" ? summaryPayload.speakerCount : null,
      segmentCount: segments.length,
      durationSeconds: asNumber(summaryPayload.durationSeconds),
      purityCluster: asNumber(summaryPayload.purityCluster),
      puritySpeaker: asNumber(summaryPayload.puritySpeaker),
      effectiveNumSpeakers: effectiveNumSpeakers,
      speakerCountMode: asNonEmptyString(summaryPayload.speakerCountMode),
      fallbackApplied: fallbackApplied,
    };
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "speaker-segments-summary",
      summaryPath,
      "Speaker Diarization Summary",
      {
        diarizationSummary: diarizationSummary,
        segments: segments,
      }
    );
    const artifacts = [summaryArtifact].filter(Boolean);
    const artifactIds = artifacts.map(function (artifact) {
      return artifact.id;
    });
    const detailParts = [
      typeof diarizationSummary.speakerCount === "number"
        ? `${diarizationSummary.speakerCount} speakers`
        : null,
      `${segments.length} segments`,
      typeof diarizationSummary.durationSeconds === "number"
        ? `${Number(diarizationSummary.durationSeconds).toFixed(1)}s analyzed`
        : null,
    ].filter(Boolean);
    const fallbackWarning =
      fallbackApplied
        ? "pyAudioAnalysis HMM smoothing failed for this clip, so the room-local diarization helper fell back to a KMeans-only segmentation path."
        : null;
    const reviewWarning =
      "pyAudioAnalysis diarization is a fully local heuristic pipeline; speaker boundaries should be reviewed manually.";
    const warningText = [fallbackWarning, reviewWarning].filter(Boolean).join(" ");

    return {
      findings: [
        createProcessFinding(
          moduleId,
          "descriptor",
          "low",
          "low",
          "Speaker timeline generated",
          detailParts.length > 0
            ? `The local diarization pipeline produced ${detailParts.join(", ")}. ${warningText}`
            : `The local diarization pipeline produced a speaker timeline. ${warningText}`,
          segments.length,
          artifactIds
        ),
      ],
      artifacts: artifacts,
      warnings: [fallbackWarning, reviewWarning].filter(Boolean),
      status: "ready",
      summary: "Speaker diarization generated a local speaker timeline for the active audio target.",
    };
  }

  async function runSourceSeparationAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  ) {
    await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
    await ensureRuntimeDirectory(moduleOutputDir, requestId);

    const modelName = "htdemucs";
    const preparedInputBase = sanitizeFileSegment(`${artifactBase}-demucs-input`, "demucs-input");
    const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
    const stemDir = `${moduleOutputDir}/separated/${modelName}/${preparedInputBase}`;
    const manifestPath = `${moduleOutputDir}/${artifactBase}-stems.json`;

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: ["-y", "-i", target.path, "-vn", "-ac", "2", "-ar", "44100", preparedInputPath],
      timeoutMs: 4 * 60 * 1000,
    });

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "demucs",
      cwd: moduleOutputDir,
      args: ["-m", "demucs", "-d", "cpu", "-n", modelName, preparedInputPath],
      timeoutMs: 30 * 60 * 1000,
    });

    const stemEntries = await listDirectory(stemDir);
    const stems = stemEntries
      .filter(function (entry) {
        return entry && entry.isDirectory !== true && /\.(wav|mp3|flac|ogg|m4a)$/i.test(String(entry.name || ""));
      })
      .map(function (entry) {
        const fileName = String(entry.name || "");
        return {
          path: entry.path,
          fileName: fileName,
          stemName: fileName.replace(/\.[^.]+$/, "") || fileName,
        };
      });

    if (stems.length === 0) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Demucs finished without producing any stem files in the expected output directory."],
        status: "failed",
        summary: "Source separation did not produce any isolated stems for the current target.",
      };
    }

    await writeJsonFile(manifestPath, {
      generatedAt: new Date().toISOString(),
      target: clone(target),
      modelName: modelName,
      preparedInputPath: preparedInputPath,
      stemDir: stemDir,
      stems: stems,
    });

    const stemArtifacts = stems
      .map(function (stem) {
        return createProcessArtifact(moduleId, "isolated-track", stem.path, `Separated Stem - ${stem.stemName}`, {
          stemName: stem.stemName,
          modelName: modelName,
        });
      })
      .filter(Boolean);
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "source-separation-manifest",
      manifestPath,
      "Source Separation Manifest",
      {
        modelName: modelName,
        stemCount: stems.length,
        stemNames: stems.map(function (stem) {
          return stem.stemName;
        }),
      }
    );
    const artifacts = [summaryArtifact].concat(stemArtifacts).filter(Boolean);
    const artifactIds = artifacts.map(function (artifact) {
      return artifact.id;
    });
    const warningText =
      "Demucs stems can contain bleed or musical artifacts, so isolated tracks should be reviewed manually.";

    return {
      findings: [
        createProcessFinding(
          moduleId,
          "model",
          "low",
          "medium",
          "Separated stem bundle generated",
          `Demucs (${modelName}) produced ${stems.length} isolated stem file(s): ${stems
            .map(function (stem) {
              return stem.stemName;
            })
            .join(", ")}. ${warningText}`,
          stems.length,
          artifactIds
        ),
      ],
      artifacts: artifacts,
      warnings: [warningText],
      status: "ready",
      summary: "Source separation generated isolated stems for the active audio target.",
    };
  }

  async function runMusicRhythmAudioAnalyzer(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    moduleOutputDir,
    moduleId
  ) {
    await ensureRuntimeDirectory(getAudioAnalysisProcessRootDir(runtime, project), requestId);
    await ensureRuntimeDirectory(moduleOutputDir, requestId);

    const musicScriptPath = getAudioAnalysisMusicScriptPath(runtime);
    if (musicScriptPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Room-local music analysis helper script is unavailable on this runtime."],
        status: "blocked",
        summary: "Music analysis helper assets are missing from the room package.",
      };
    }

    const preparedInputBase = sanitizeFileSegment(`${artifactBase}-music-input`, "music-input");
    const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
    const summaryPath = `${moduleOutputDir}/${artifactBase}-music-analysis.json`;

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getAudioAnalysisProcessRootDir(runtime, project),
      args: ["-y", "-i", target.path, "-vn", "-ac", "1", "-ar", "22050", preparedInputPath],
      timeoutMs: 4 * 60 * 1000,
    });

    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "librosa",
      cwd: getAudioAnalysisMusicDir(runtime) || getAudioAnalysisProcessRootDir(runtime, project),
      args: [musicScriptPath, "--input", preparedInputPath, "--output", summaryPath],
      timeoutMs: 10 * 60 * 1000,
    });

    const summaryPayload = toRecord(await readJsonFile(summaryPath));
    const musicSummary = toRecord(summaryPayload.musicSummary);
    const essentiaSummary = toRecord(summaryPayload.essentia);
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "music-analysis-summary",
      summaryPath,
      "Music Analysis Summary",
      {
        musicSummary: musicSummary,
        essentia: essentiaSummary,
      }
    );
    const artifacts = [summaryArtifact].filter(Boolean);
    const artifactIds = artifacts.map(function (artifact) {
      return artifact.id;
    });
    const detailParts = [
      typeof musicSummary.tempoBpm === "number" ? `${Number(musicSummary.tempoBpm).toFixed(1)} BPM` : null,
      typeof musicSummary.dominantPitchClass === "string" && musicSummary.dominantPitchClass.trim() !== ""
        ? `dominant pitch class ${musicSummary.dominantPitchClass}`
        : null,
      typeof musicSummary.beatCount === "number" ? `${musicSummary.beatCount} beat markers` : null,
    ].filter(Boolean);
    const warnings = [];
    if (asNonEmptyString(essentiaSummary.error) !== null) {
      warnings.push(asNonEmptyString(essentiaSummary.error));
    }
    warnings.push(
      "Music and rhythm analysis is descriptor-driven; tonal summaries should be treated as guidance rather than a full musicology readout."
    );

    return {
      findings: [
        createProcessFinding(
          moduleId,
          "descriptor",
          "low",
          essentiaSummary.available === true ? "medium" : "low",
          "Music descriptor summary generated",
          detailParts.length > 0
            ? `The music analysis helper produced ${detailParts.join(", ")} for the active target.`
            : "The music analysis helper produced a descriptor summary for the active target.",
          detailParts.length,
          artifactIds
        ),
      ],
      artifacts: artifacts,
      warnings: warnings.filter(Boolean),
      status: "ready",
      summary: "Music and rhythm descriptors were generated for the active audio target.",
    };
  }

  function getModuleRunner(moduleId) {
    const runners = {
      "signal-health": runSignalHealthAudioAnalyzer,
      "spectral-artifacts": runSpectralArtifactsAudioAnalyzer,
      transcription: runTranscriptionAudioAnalyzer,
      "speaker-diarization": runSpeakerDiarizationAudioAnalyzer,
      prosody: runProsodyAudioAnalyzer,
      emotion: runEmotionHeuristicAudioAnalyzer,
      "sound-events": runSoundEventsAudioAnalyzer,
      "source-separation": runSourceSeparationAudioAnalyzer,
      "music-rhythm-tonal": runMusicRhythmAudioAnalyzer,
    };
    return runners[moduleId] || null;
  }

  return {
    generateProcessSpectrogram: generateProcessSpectrogram,
    getModuleProcessDir: getModuleProcessDir,
    getModuleRunner: getModuleRunner,
  };
}
