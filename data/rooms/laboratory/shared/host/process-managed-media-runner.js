export function createLaboratoryManagedMediaRunnerRuntime(deps) {
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
    updateProcessModule
  } = deps;
  function toUnknownArray(value) {
    return Array.isArray(value) ? value.map(function(entry) {
      return entry;
    }) : [];
  }
  function toProcessModuleRecord(value) {
    return toRecord(value);
  }
  function toProcessArtifactRecord(value) {
    return toRecord(value);
  }
  function toSpeechAvailabilityRecord(value) {
    return toRecord(value);
  }
  function toVideoProbeRecord(value) {
    return toRecord(value);
  }
  function toAudioProbeRecord(value) {
    return toRecord(value);
  }
  function toProbeBucketRecord(value) {
    return toRecord(value);
  }
  function toTranscriptResultRecord(value) {
    return toRecord(value);
  }
  function getModuleStatus(processRecord, moduleId) {
    const modules = toUnknownArray(processRecord.modules).map(toProcessModuleRecord);
    const moduleRecord = modules.find(function(entry) {
      return asNonEmptyString(entry.id) === moduleId;
    }) || null;
    return moduleRecord ? asNonEmptyString(moduleRecord.status) : null;
  }
  function getProbeCount(value) {
    const bucket = toProbeBucketRecord(value);
    return typeof bucket.count === "number" && Number.isFinite(bucket.count) ? bucket.count : 0;
  }
  function normalizeOptionalArtifact(value) {
    if (value === null || value === void 0) {
      return null;
    }
    return toProcessArtifactRecord(normalizeProcessArtifact(value));
  }
  function collectArtifactIdsForModule(artifacts, moduleId) {
    return artifacts.filter(function(entry) {
      return asNonEmptyString(entry.moduleId) === moduleId;
    }).map(function(entry) {
      return asNonEmptyString(entry.id);
    }).filter((artifactId) => artifactId !== null);
  }
  async function runMediaManagedProcess(runtime, project, requestId, jobId, target, artifactBase, outputDir, processRecord) {
    const findings = [];
    const artifacts = [];
    const warnings = [];
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
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      summary: "The active target was pinned and its metadata snapshot was saved.",
      artifactIds: metadataArtifact ? [String(metadataArtifact.id || "")] : []
    });
    updateProcessModule(processRecord, "cleanup", {
      status: "ready",
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      summary: asNonEmptyString(toRecord(project.edit)["handoffMode"]) === "derived" ? "Derived handoff remained selected during the managed run." : "The original source remained selected during the managed run."
    });
    if (getModuleStatus(processRecord, "motion") === "queued") {
      updateProcessModule(processRecord, "motion", {
        status: "running",
        startedAt: (/* @__PURE__ */ new Date()).toISOString()
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
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary: "Video structure checks finished for the active target."
      });
    }
    if (getModuleStatus(processRecord, "audio") === "queued") {
      updateProcessModule(processRecord, "audio", {
        status: "running",
        startedAt: (/* @__PURE__ */ new Date()).toISOString()
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
          if (transcriptResult !== null && transcriptResult !== void 0) {
            const transcriptArtifact = normalizeOptionalArtifact(
              toTranscriptResultRecord(transcriptResult).artifact
            );
            if (transcriptArtifact !== null) {
              artifacts.push(
                toProcessArtifactRecord(
                  normalizeProcessArtifact({
                    ...transcriptArtifact,
                    moduleId: "audio"
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
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary: "Audio continuity checks finished for the active target.",
        artifactIds: collectArtifactIdsForModule(artifacts, "audio")
      });
    }
    updateProcessModule(processRecord, "report", {
      status: "ready",
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      summary: "A report-ready summary was synthesized from the managed run."
    });
    return {
      findings,
      artifacts,
      warnings
    };
  }
  return {
    runMediaManagedProcess
  };
}
