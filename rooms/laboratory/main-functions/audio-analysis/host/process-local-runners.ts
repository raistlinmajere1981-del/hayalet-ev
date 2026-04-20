type LaboratoryRecord = Record<string, unknown>;

type LaboratoryAudioProcessRuntime = LaboratoryRecord;

type LaboratoryProjectRecord = LaboratoryRecord;

type LaboratoryAudioTargetRecord = LaboratoryRecord;

type LaboratorySpeechAvailabilityRecord = LaboratoryRecord & {
  ready?: unknown;
};

type LaboratoryAudioProbeBucketRecord = LaboratoryRecord & {
  count?: unknown;
};

type LaboratoryAudioVolumeRecord = LaboratoryRecord & {
  meanVolumeDb?: unknown;
};

type LaboratoryAudioProbeRecord = LaboratoryRecord & {
  silence?: unknown;
  volume?: unknown;
};

type LaboratoryProcessArtifactRecord = LaboratoryRecord & {
  id?: unknown;
  path?: unknown;
};

type LaboratoryTranscriptResultRecord = LaboratoryRecord & {
  artifact?: unknown;
  text?: unknown;
};

type LaboratoryProsodySummaryRecord = LaboratoryRecord & {
  columns?: unknown;
  estimatedPauseCount?: unknown;
  frameCount?: unknown;
  meanF0Hz?: unknown;
};

type LaboratoryProsodyExtractionRecord = LaboratoryRecord & {
  contourPath?: unknown;
  prosodySummary?: unknown;
};

type LaboratoryEmotionHeuristicRecord = LaboratoryRecord & {
  confidence?: unknown;
  cues?: unknown;
  disclaimer?: unknown;
  label?: unknown;
};

type LaboratoryLocalProcessResult = {
  artifacts: LaboratoryProcessArtifactRecord[];
  findings: LaboratoryRecord[];
  status: string;
  summary: string;
  warnings: string[];
};

type AudioAnalysisLocalProcessRunnerDeps = {
  buildEmotionHeuristicFromProsody: (
    prosodySummary: LaboratoryProsodySummaryRecord
  ) => LaboratoryEmotionHeuristicRecord;
  buildProcessSpeechAvailability: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord
  ) => LaboratorySpeechAvailabilityRecord;
  clone: (value: unknown) => unknown;
  createProcessArtifact: (
    moduleId: string,
    artifactKind: string,
    filePath: string,
    label: string,
    metadata: LaboratoryRecord
  ) => LaboratoryProcessArtifactRecord;
  createProcessFinding: (
    moduleId: string,
    findingKind: string,
    level: string,
    confidence: string,
    title: string,
    detail: string,
    evidenceCount: number,
    artifactIds: string[]
  ) => LaboratoryRecord;
  ensureProcessRuntimeDirectories: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    moduleOutputDir: string
  ) => Promise<unknown>;
  generateProcessSpectrogram: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ) => Promise<unknown>;
  generateProcessSpectrogramFromInputPath: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    inputPath: string,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string,
    label: string,
    metadata?: LaboratoryRecord
  ) => Promise<unknown>;
  generateProcessWaveform: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ) => Promise<unknown>;
  generateFilteredAudioArtifact: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    outputDir: string,
    moduleId: string,
    filterGraph: string,
    label: string,
    metadata: LaboratoryRecord,
    outputExtension?: string
  ) => Promise<unknown>;
  generateSpectralDescriptorArtifact: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ) => Promise<unknown>;
  maybeRunWhisperProfileSample: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    transcriptSampleSeconds: number
  ) => Promise<unknown>;
  normalizeProcessArtifact: (value: unknown) => LaboratoryProcessArtifactRecord;
  resolveOpenSmileProsodyRuntime: (runtime: LaboratoryAudioProcessRuntime) => unknown | null;
  runAudioStructureProbe: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord
  ) => Promise<unknown>;
  runOpenSmileProsodyExtraction: (
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    profileId: string
  ) => Promise<unknown>;
  toRecord: (value: unknown) => LaboratoryRecord;
  writeJsonFile: (path: string, content: LaboratoryRecord) => Promise<unknown>;
};

export function createAudioAnalysisLocalProcessRunners(deps: AudioAnalysisLocalProcessRunnerDeps) {
  const {
    buildEmotionHeuristicFromProsody,
    buildProcessSpeechAvailability,
    clone,
    createProcessArtifact,
    createProcessFinding,
    ensureProcessRuntimeDirectories,
    generateFilteredAudioArtifact,
    generateProcessSpectrogram,
    generateProcessSpectrogramFromInputPath,
    generateProcessWaveform,
    generateSpectralDescriptorArtifact,
    maybeRunWhisperProfileSample,
    normalizeProcessArtifact,
    resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe,
    runOpenSmileProsodyExtraction,
    toRecord,
    writeJsonFile,
  } = deps;

  function toAudioProbeBucketRecord(value: unknown): LaboratoryAudioProbeBucketRecord {
    return toRecord(value);
  }

  function toAudioVolumeRecord(value: unknown): LaboratoryAudioVolumeRecord {
    return toRecord(value);
  }

  function toAudioProbeRecord(value: unknown): LaboratoryAudioProbeRecord {
    return toRecord(value);
  }

  function toProcessArtifactRecord(value: unknown): LaboratoryProcessArtifactRecord {
    return toRecord(value);
  }

  function toTranscriptResultRecord(value: unknown): LaboratoryTranscriptResultRecord {
    return toRecord(value);
  }

  function toProsodySummaryRecord(value: unknown): LaboratoryProsodySummaryRecord {
    return toRecord(value);
  }

  function toProsodyExtractionRecord(value: unknown): LaboratoryProsodyExtractionRecord {
    return toRecord(value);
  }

  function toEmotionHeuristicRecord(value: unknown): LaboratoryEmotionHeuristicRecord {
    return toRecord(value);
  }

  function compactArtifacts(values: unknown[]): LaboratoryProcessArtifactRecord[] {
    return values.reduce(function (accumulator: LaboratoryProcessArtifactRecord[], value: unknown) {
      if (!value) {
        return accumulator;
      }
      accumulator.push(toProcessArtifactRecord(value));
      return accumulator;
    }, []);
  }

  function collectArtifactIds(artifacts: LaboratoryProcessArtifactRecord[]): string[] {
    return artifacts
      .map(function (artifact) {
        return typeof artifact.id === "string" && artifact.id.trim() !== "" ? artifact.id : null;
      })
      .filter((artifactId): artifactId is string => artifactId !== null);
  }

  type RecoveryExperimentConfig = {
    detail: string;
    filterGraph: string;
    label: string;
    manifestLabel: string;
    summary: string;
    title: string;
    warning: string;
  };

  async function runRecoveryExperiment(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string,
    config: RecoveryExperimentConfig
  ): Promise<LaboratoryLocalProcessResult> {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);

    const filteredAudio = toProcessArtifactRecord(
      await generateFilteredAudioArtifact(
        runtime,
        project,
        requestId,
        jobId,
        target,
        `${artifactBase}-recovery`,
        moduleOutputDir,
        moduleId,
        config.filterGraph,
        config.label,
        {
          experiment: moduleId,
          scope: "audio-recovery",
        }
      )
    );
    const filteredPath =
      typeof filteredAudio.path === "string" && filteredAudio.path.trim() !== ""
        ? filteredAudio.path
        : null;
    const spectrogram = filteredPath
      ? toProcessArtifactRecord(
          await generateProcessSpectrogramFromInputPath(
            runtime,
            project,
            requestId,
            jobId,
            filteredPath,
            `${artifactBase}-recovery`,
            moduleOutputDir,
            moduleId,
            `${config.label} Spectrogram`,
            {
              experiment: moduleId,
              sourceArtifactId: typeof filteredAudio.id === "string" ? filteredAudio.id : null,
            }
          )
        )
      : null;
    const manifestPath = `${moduleOutputDir}/${artifactBase}-recovery.json`;
    await writeJsonFile(manifestPath, {
      moduleId,
      generatedAt: new Date().toISOString(),
      target: toRecord(clone(target)),
      filterGraph: config.filterGraph,
      artifacts: [filteredAudio, spectrogram].filter(Boolean),
      detail: config.detail,
      summary: config.summary,
      warning: config.warning,
    });
    const manifestArtifact = createProcessArtifact(
      moduleId,
      "recovery-manifest",
      manifestPath,
      config.manifestLabel,
      {
        experiment: moduleId,
        filterGraph: config.filterGraph,
      }
    );
    const artifacts = compactArtifacts([spectrogram, filteredAudio, manifestArtifact]);
    const artifactIds = collectArtifactIds(artifacts);

    return {
      artifacts,
      findings: [
        createProcessFinding(
          moduleId,
          "derived",
          "medium",
          "low",
          config.title,
          config.detail,
          artifactIds.length,
          artifactIds
        ),
      ],
      status: "ready",
      summary: config.summary,
      warnings: [config.warning],
    };
  }

  async function runSignalHealthAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    _artifactBase: string,
    _moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    const audioProbe = toAudioProbeRecord(
      await runAudioStructureProbe(runtime, project, requestId, jobId, target)
    );
    const silence = toAudioProbeBucketRecord(audioProbe.silence);
    const volume = toAudioVolumeRecord(audioProbe.volume);
    const silenceCount =
      typeof silence.count === "number" && Number.isFinite(silence.count) ? silence.count : 0;
    const findings: LaboratoryRecord[] = [];
    const warnings: string[] = [];

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
      findings: findings,
      status: "ready",
      summary: "Signal health checks finished on the current target.",
      warnings: warnings,
    };
  }

  async function runSpectralArtifactsAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
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
    const descriptorArtifactRecord = descriptorArtifact
      ? toProcessArtifactRecord(descriptorArtifact)
      : null;

    return {
      artifacts: artifacts,
      findings: descriptorArtifactRecord
        ? [
            createProcessFinding(
              moduleId,
              "derived",
              "low",
              "medium",
              "Spectral descriptor baseline captured",
              "Centroid, rolloff, flatness, and flux summaries were derived from the active audio target.",
              4,
              [String(descriptorArtifactRecord.id || "")]
            ),
          ]
        : [],
      status: "ready",
      summary: "Spectral artifacts and descriptor summaries were generated for the current target.",
      warnings: [],
    };
  }

  async function runTranscriptionAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    _moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    const speech = buildProcessSpeechAvailability(runtime, project);
    if (speech.ready !== true) {
      return {
        artifacts: [],
        findings: [],
        status: "blocked",
        summary: "Transcript tooling is not ready on this runtime.",
        warnings: [],
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
    const transcriptArtifact = transcriptResult.artifact
      ? normalizeProcessArtifact({
          ...toRecord(transcriptResult.artifact),
          moduleId: moduleId,
        })
      : null;
    const transcriptArtifactRecord = transcriptArtifact
      ? toProcessArtifactRecord(transcriptArtifact)
      : null;
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
            `Transcript sampling returned ${
              transcriptText.split(/\s+/).filter(Boolean).length
            } words for the active audio target.`,
            1,
            [String(transcriptArtifactRecord.id || "")]
          ),
        ],
        status: "ready",
        summary: "Transcript sampling finished for the active target.",
        warnings: [],
      };
    }

    return {
      artifacts: [],
      findings: [],
      status: "ready",
      summary: "Transcript tooling ran without a persisted sample artifact.",
      warnings: [],
    };
  }

  async function runProsodyAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);

    if (resolveOpenSmileProsodyRuntime(runtime) === null) {
      return {
        artifacts: [],
        findings: [],
        status: "blocked",
        summary: "Prosody config assets are missing from the room package.",
        warnings: ["Room-local openSMILE config package is unavailable on this runtime."],
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
      generatedAt: new Date().toISOString(),
      prosodySummary: prosodySummary,
      target: toRecord(clone(target)),
    });

    const contourArtifact = createProcessArtifact(
      moduleId,
      "prosody-contours",
      contourPath,
      "Prosody Contours",
      {
        columnCount: Array.isArray(prosodySummary.columns) ? prosodySummary.columns.length : 0,
        frameCount:
          typeof prosodySummary.frameCount === "number" ? prosodySummary.frameCount : null,
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
    const artifacts = compactArtifacts([contourArtifact, summaryArtifact]);
    const artifactIds = artifacts
      .map(function (artifact) {
        return typeof artifact.id === "string" && artifact.id.trim() !== "" ? artifact.id : null;
      })
      .filter((artifactId): artifactId is string => artifactId !== null);
    const detailParts = [
      typeof prosodySummary.frameCount === "number" ? `${prosodySummary.frameCount} frames` : null,
      typeof prosodySummary.meanF0Hz === "number"
        ? `mean F0 ${Number(prosodySummary.meanF0Hz).toFixed(1)} Hz`
        : null,
      typeof prosodySummary.estimatedPauseCount === "number"
        ? `${prosodySummary.estimatedPauseCount} estimated pauses`
        : null,
    ].filter((entry): entry is string => entry !== null);

    return {
      artifacts: artifacts,
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
      status: "ready",
      summary: "Prosody contours and pacing metrics were generated for the current target.",
      warnings: [],
    };
  }

  async function runEmotionHeuristicAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);

    if (resolveOpenSmileProsodyRuntime(runtime) === null) {
      return {
        artifacts: [],
        findings: [],
        status: "blocked",
        summary: "Emotion heuristics need the same packaged openSMILE config assets as prosody.",
        warnings: ["Room-local openSMILE config package is unavailable on this runtime."],
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
      generatedAt: new Date().toISOString(),
      target: toRecord(clone(target)),
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
    const artifacts = compactArtifacts([summaryArtifact]);
    const artifactIds = artifacts
      .map(function (artifact) {
        return typeof artifact.id === "string" && artifact.id.trim() !== "" ? artifact.id : null;
      })
      .filter((artifactId): artifactId is string => artifactId !== null);
    const cueText =
      Array.isArray(heuristic.cues) && heuristic.cues.length > 0 ? heuristic.cues.join(" ") : null;
    const disclaimer =
      typeof heuristic.disclaimer === "string" ? heuristic.disclaimer : "Heuristic output only.";
    const label = typeof heuristic.label === "string" ? heuristic.label : "Emotion label";
    const confidence =
      typeof heuristic.confidence === "string" && heuristic.confidence.trim() !== ""
        ? heuristic.confidence
        : "low";

    return {
      artifacts: artifacts,
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
        ),
      ],
      status: "ready",
      summary: "A coarse heuristic emotion label was derived from prosody signals.",
      warnings: [disclaimer],
    };
  }

  async function runSignalRecoveryAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    return runRecoveryExperiment(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      moduleId,
      {
        filterGraph:
          "highpass=f=80,lowpass=f=4800,afftdn=nf=-25,acompressor=threshold=-18dB:ratio=2:attack=20:release=250,volume=2.2",
        label: "Signal Recovery Mix",
        manifestLabel: "Signal Recovery Manifest",
        title: "Signal recovery experiment generated",
        detail:
          "A broadband recovery pass combined denoising, band limiting, and light compression to surface masked content.",
        summary:
          "Signal recovery variants and preview artifacts were generated for the active target.",
        warning:
          "Recovery output is experimental and should be reviewed against the original source.",
      }
    );
  }

  async function runFrequencyShiftReversalAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    return runRecoveryExperiment(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      moduleId,
      {
        filterGraph: "afreqshift=shift=-120,highpass=f=100,lowpass=f=5200,volume=2.1",
        label: "Frequency Shift Reversal",
        manifestLabel: "Frequency Shift Reversal Manifest",
        title: "Frequency-shift reversal variant generated",
        detail:
          "A small inverse frequency shift was applied to probe whether heterodyned or pitch-shifted material becomes more intelligible.",
        summary: "Frequency-shift reversal outputs were generated for the active target.",
        warning: "Frequency-shift reversal is exploratory and may distort unshifted material.",
      }
    );
  }

  async function runBandPassExplorationAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    return runRecoveryExperiment(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      moduleId,
      {
        filterGraph: "bandpass=f=1700:w=1800,volume=6",
        label: "Band-pass Exploration",
        manifestLabel: "Band-pass Exploration Manifest",
        title: "Band-pass exploration variant generated",
        detail:
          "A focused mid-band isolation pass was generated to inspect speech-like or masked content inside the intelligibility range.",
        summary: "Band-pass exploration artifacts were generated for the active target.",
        warning:
          "Band-pass exploration narrows the signal and can remove low or high frequency cues.",
      }
    );
  }

  async function runSpectrogramGuidedRecoveryAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    return runRecoveryExperiment(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      moduleId,
      {
        filterGraph: "highpass=f=120,lowpass=f=4200,afftdn=nf=-18,volume=2.6",
        label: "Spectrogram-guided Recovery",
        manifestLabel: "Spectrogram-guided Recovery Manifest",
        title: "Spectrogram-guided recovery variant generated",
        detail:
          "A recovery pass emphasized the speech-intelligibility band so spectral ridges can be inspected before deeper transcription attempts.",
        summary: "Spectrogram-guided recovery outputs were generated for the active target.",
        warning:
          "Spectrogram-oriented recovery is optimized for inspection, not faithful listening playback.",
      }
    );
  }

  async function runHiddenPatternExtractionAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    return runRecoveryExperiment(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      moduleId,
      {
        filterGraph:
          "highpass=f=220,lowpass=f=6400,compand=attacks=0:decays=0.25:points=-80/-80|-30/-12|-12/-6|0/-2,volume=5.5",
        label: "Hidden Pattern Extraction",
        manifestLabel: "Hidden Pattern Extraction Manifest",
        title: "Hidden-pattern extraction variant generated",
        detail:
          "Dynamic-range expansion and band limiting were applied to expose low-level or intermittently masked audio patterns.",
        summary: "Hidden-pattern extraction artifacts were generated for the active target.",
        warning:
          "Pattern extraction can amplify noise as well as faint content, so results need manual review.",
      }
    );
  }

  async function runPhaseRecoveryExperimentAudioAnalyzer(
    runtime: LaboratoryAudioProcessRuntime,
    project: LaboratoryProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryAudioTargetRecord,
    artifactBase: string,
    moduleOutputDir: string,
    moduleId: string
  ): Promise<LaboratoryLocalProcessResult> {
    return runRecoveryExperiment(
      runtime,
      project,
      requestId,
      jobId,
      target,
      artifactBase,
      moduleOutputDir,
      moduleId,
      {
        filterGraph:
          "aformat=channel_layouts=stereo,pan=mono|c0=0.5*c0-0.5*c1,highpass=f=100,lowpass=f=5200,volume=8",
        label: "Phase Recovery Experiment",
        manifestLabel: "Phase Recovery Manifest",
        title: "Phase-isolation recovery variant generated",
        detail:
          "A side-channel phase isolation experiment was generated to inspect content that may cancel in mono or sit between stereo channels.",
        summary: "Phase-recovery experiment artifacts were generated for the active target.",
        warning:
          "Phase-isolation experiments can collapse on mono or tightly correlated stereo sources.",
      }
    );
  }

  return {
    runBandPassExplorationAudioAnalyzer: runBandPassExplorationAudioAnalyzer,
    runEmotionHeuristicAudioAnalyzer: runEmotionHeuristicAudioAnalyzer,
    runFrequencyShiftReversalAudioAnalyzer: runFrequencyShiftReversalAudioAnalyzer,
    runHiddenPatternExtractionAudioAnalyzer: runHiddenPatternExtractionAudioAnalyzer,
    runPhaseRecoveryExperimentAudioAnalyzer: runPhaseRecoveryExperimentAudioAnalyzer,
    runProsodyAudioAnalyzer: runProsodyAudioAnalyzer,
    runSignalHealthAudioAnalyzer: runSignalHealthAudioAnalyzer,
    runSignalRecoveryAudioAnalyzer: runSignalRecoveryAudioAnalyzer,
    runSpectrogramGuidedRecoveryAudioAnalyzer: runSpectrogramGuidedRecoveryAudioAnalyzer,
    runSpectralArtifactsAudioAnalyzer: runSpectralArtifactsAudioAnalyzer,
    runTranscriptionAudioAnalyzer: runTranscriptionAudioAnalyzer,
  };
}
