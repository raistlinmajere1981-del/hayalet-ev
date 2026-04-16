type LaboratoryRecord = Record<string, unknown>;

type LaboratoryManagedMediaRuntime = LaboratoryRecord & {
  profileCapabilities?: unknown;
};

type LaboratoryManagedMediaProjectRecord = LaboratoryRecord & {
  edit?: unknown;
  profile?: unknown;
};

type LaboratoryManagedMediaTargetRecord = LaboratoryRecord;

type LaboratoryManagedMediaProcessRecord = LaboratoryRecord & {
  modules?: unknown;
};

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  id?: unknown;
  status?: unknown;
};

type LaboratoryProcessArtifactRecord = LaboratoryRecord & {
  id?: unknown;
  moduleId?: unknown;
};

type LaboratoryProcessFindingRecord = LaboratoryRecord;

type LaboratorySpeechAvailabilityRecord = LaboratoryRecord & {
  ready?: unknown;
};

type LaboratoryProbeBucketRecord = LaboratoryRecord & {
  count?: unknown;
};

type LaboratoryVideoProbeRecord = LaboratoryRecord & {
  black?: unknown;
  freeze?: unknown;
};

type LaboratoryAudioProbeRecord = LaboratoryRecord & {
  silence?: unknown;
};

type LaboratoryTranscriptResultRecord = LaboratoryRecord & {
  artifact?: unknown;
};

type LaboratoryManagedMediaRunnerResult = {
  findings: LaboratoryProcessFindingRecord[];
  artifacts: LaboratoryProcessArtifactRecord[];
  warnings: string[];
};

type LaboratoryManagedMediaRunnerDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  buildProcessSpeechAvailability: (
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord
  ) => LaboratorySpeechAvailabilityRecord;
  clampProfileTranscriptSampleSeconds: (...args: unknown[]) => number;
  createProcessFinding: (
    moduleId: string,
    kind: string,
    level: string,
    confidence: string,
    title: string,
    detail: string,
    evidenceCount: number,
    artifactIds: string[]
  ) => LaboratoryProcessFindingRecord;
  generateProcessMetadataArtifact: (
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord,
    target: LaboratoryManagedMediaTargetRecord,
    artifactBase: string,
    outputDir: string,
    moduleId: string
  ) => Promise<unknown>;
  generateProcessSpectrogram: (
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryManagedMediaTargetRecord,
    artifactBase: string,
    outputDir: string,
    moduleId: string
  ) => Promise<unknown>;
  maybeRunWhisperProfileSample: (
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryManagedMediaTargetRecord,
    artifactBase: string,
    transcriptSampleSeconds: number
  ) => Promise<unknown>;
  normalizeProcessArtifact: (rawValue: unknown) => LaboratoryProcessArtifactRecord;
  runAudioStructureProbe: (
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryManagedMediaTargetRecord
  ) => Promise<unknown>;
  runVideoStructureProbe: (
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryManagedMediaTargetRecord
  ) => Promise<unknown>;
  toRecord: (value: unknown) => LaboratoryRecord;
  updateProcessModule: (
    processRecord: LaboratoryManagedMediaProcessRecord,
    moduleId: string,
    patch: LaboratoryRecord
  ) => LaboratoryManagedMediaProcessRecord;
};

export function createLaboratoryManagedMediaRunnerRuntime(deps: LaboratoryManagedMediaRunnerDeps) {
  const {
    asNonEmptyString,
    buildProcessSpeechAvailability,
    clampProfileTranscriptSampleSeconds,
    createProcessFinding,
    generateProcessMetadataArtifact,
    generateProcessSpectrogram,
    maybeRunWhisperProfileSample,
    normalizeProcessArtifact,
    runAudioStructureProbe,
    runVideoStructureProbe,
    toRecord,
    updateProcessModule,
  } = deps;

  function toUnknownArray(value: unknown): unknown[] {
    return Array.isArray(value)
      ? value.map(function (entry): unknown {
          return entry;
        })
      : [];
  }

  function toProcessModuleRecord(value: unknown): LaboratoryProcessModuleRecord {
    return toRecord(value);
  }

  function toProcessArtifactRecord(value: unknown): LaboratoryProcessArtifactRecord {
    return toRecord(value);
  }

  function toSpeechAvailabilityRecord(value: unknown): LaboratorySpeechAvailabilityRecord {
    return toRecord(value);
  }

  function toVideoProbeRecord(value: unknown): LaboratoryVideoProbeRecord {
    return toRecord(value);
  }

  function toAudioProbeRecord(value: unknown): LaboratoryAudioProbeRecord {
    return toRecord(value);
  }

  function toProbeBucketRecord(value: unknown): LaboratoryProbeBucketRecord {
    return toRecord(value);
  }

  function toTranscriptResultRecord(value: unknown): LaboratoryTranscriptResultRecord {
    return toRecord(value);
  }

  function getModuleStatus(
    processRecord: LaboratoryManagedMediaProcessRecord,
    moduleId: string
  ): string | null {
    const modules = toUnknownArray(processRecord.modules).map(toProcessModuleRecord);
    const moduleRecord =
      modules.find(function (entry) {
        return asNonEmptyString(entry.id) === moduleId;
      }) || null;
    return moduleRecord ? asNonEmptyString(moduleRecord.status) : null;
  }

  function getProbeCount(value: unknown): number {
    const bucket = toProbeBucketRecord(value);
    return typeof bucket.count === "number" && Number.isFinite(bucket.count) ? bucket.count : 0;
  }

  function normalizeOptionalArtifact(value: unknown): LaboratoryProcessArtifactRecord | null {
    if (value === null || value === undefined) {
      return null;
    }
    return toProcessArtifactRecord(normalizeProcessArtifact(value));
  }

  function collectArtifactIdsForModule(
    artifacts: LaboratoryProcessArtifactRecord[],
    moduleId: string
  ): string[] {
    return artifacts
      .filter(function (entry) {
        return asNonEmptyString(entry.moduleId) === moduleId;
      })
      .map(function (entry) {
        return asNonEmptyString(entry.id);
      })
      .filter((artifactId): artifactId is string => artifactId !== null);
  }

  async function runMediaManagedProcess(
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryManagedMediaTargetRecord,
    artifactBase: string,
    outputDir: string,
    processRecord: LaboratoryManagedMediaProcessRecord
  ): Promise<LaboratoryManagedMediaRunnerResult> {
    const findings: LaboratoryProcessFindingRecord[] = [];
    const artifacts: LaboratoryProcessArtifactRecord[] = [];
    const warnings: string[] = [];

    const metadataArtifact = normalizeOptionalArtifact(
      await generateProcessMetadataArtifact(
        runtime,
        project,
        target,
        artifactBase,
        outputDir,
        "intake"
      )
    );
    if (metadataArtifact !== null) {
      artifacts.push(metadataArtifact);
    }

    updateProcessModule(processRecord, "intake", {
      status: "ready",
      completedAt: new Date().toISOString(),
      summary: "The active target was pinned and its metadata snapshot was saved.",
      artifactIds: metadataArtifact ? [String(metadataArtifact.id || "")] : [],
    });

    updateProcessModule(processRecord, "cleanup", {
      status: "ready",
      completedAt: new Date().toISOString(),
      summary:
        asNonEmptyString(toRecord(project.edit)["handoffMode"]) === "derived"
          ? "Derived handoff remained selected during the managed run."
          : "The original source remained selected during the managed run.",
    });

    if (getModuleStatus(processRecord, "motion") === "queued") {
      updateProcessModule(processRecord, "motion", {
        status: "running",
        startedAt: new Date().toISOString(),
      });

      const videoProbe = toVideoProbeRecord(
        await runVideoStructureProbe(runtime, project, requestId, jobId, target)
      );
      const freezeCount = getProbeCount(videoProbe.freeze);
      const blackCount = getProbeCount(videoProbe.black);

      if (freezeCount > 0) {
        findings.push(
          createProcessFinding(
            "motion",
            "measured",
            freezeCount > 2 ? "high" : "medium",
            "medium",
            "Freeze intervals detected",
            `The managed run found ${freezeCount} freeze interval(s).`,
            freezeCount,
            []
          )
        );
      }

      if (blackCount > 0) {
        findings.push(
          createProcessFinding(
            "motion",
            "measured",
            "low",
            "low",
            "Black interval transitions detected",
            `Black interval analysis found ${blackCount} transition(s).`,
            blackCount,
            []
          )
        );
      }

      updateProcessModule(processRecord, "motion", {
        status: "ready",
        completedAt: new Date().toISOString(),
        summary: "Video structure checks finished for the active target.",
      });
    }

    if (getModuleStatus(processRecord, "audio") === "queued") {
      updateProcessModule(processRecord, "audio", {
        status: "running",
        startedAt: new Date().toISOString(),
      });

      const audioProbe = toAudioProbeRecord(
        await runAudioStructureProbe(runtime, project, requestId, jobId, target)
      );
      const spectrogram = normalizeOptionalArtifact(
        await generateProcessSpectrogram(
          runtime,
          project,
          requestId,
          jobId,
          target,
          artifactBase,
          outputDir,
          "audio"
        )
      );
      if (spectrogram !== null) {
        artifacts.push(spectrogram);
      }

      const silenceCount = getProbeCount(audioProbe.silence);
      if (silenceCount > 0) {
        findings.push(
          createProcessFinding(
            "audio",
            "measured",
            silenceCount > 3 ? "medium" : "low",
            "medium",
            "Silence pockets detected",
            `Silence detection found ${silenceCount} pocket(s) during the managed run.`,
            silenceCount,
            spectrogram ? [String(spectrogram.id || "")] : []
          )
        );
      }

      const speech = toSpeechAvailabilityRecord(buildProcessSpeechAvailability(runtime, project));
      if (speech.ready === true) {
        try {
          const transcriptResult = await maybeRunWhisperProfileSample(
            runtime,
            project,
            requestId,
            jobId,
            target,
            artifactBase,
            clampProfileTranscriptSampleSeconds(
              runtime.profileCapabilities,
              toRecord(project.profile)["transcriptSampleSeconds"]
            )
          );

          if (transcriptResult !== null && transcriptResult !== undefined) {
            const transcriptArtifact = normalizeOptionalArtifact(
              toTranscriptResultRecord(transcriptResult).artifact
            );
            if (transcriptArtifact !== null) {
              artifacts.push(
                toProcessArtifactRecord(
                  normalizeProcessArtifact({
                    ...transcriptArtifact,
                    moduleId: "audio",
                  })
                )
              );
            }
          }
        } catch (_error) {
          warnings.push("Transcript sampling stayed unavailable during the managed run.");
        }
      }

      updateProcessModule(processRecord, "audio", {
        status: "ready",
        completedAt: new Date().toISOString(),
        summary: "Audio continuity checks finished for the active target.",
        artifactIds: collectArtifactIdsForModule(artifacts, "audio"),
      });
    }

    updateProcessModule(processRecord, "report", {
      status: "ready",
      completedAt: new Date().toISOString(),
      summary: "A report-ready summary was synthesized from the managed run.",
    });

    return {
      findings,
      artifacts,
      warnings,
    };
  }

  return {
    runMediaManagedProcess,
  };
}
