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
  async function runMediaManagedProcess(runtime, project, requestId, jobId, target, artifactBase, outputDir, processRecord) {
    const findings = [];
    const artifacts = [];
    const warnings = [];
    const metadataArtifact = await generateProcessMetadataArtifact(
      runtime,
      project,
      target,
      artifactBase,
      outputDir,
      "intake"
    );
    if (metadataArtifact) {
      artifacts.push(metadataArtifact);
    }
    updateProcessModule(processRecord, "intake", {
      status: "ready",
      percent: 100,
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      summary: "The active target was pinned and its metadata snapshot was saved.",
      artifactIds: metadataArtifact ? [metadataArtifact.id] : []
    });
    updateProcessModule(processRecord, "cleanup", {
      status: "ready",
      percent: 100,
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      summary: asNonEmptyString(toRecord(project.edit).handoffMode) === "derived" ? "Derived handoff remained selected during the managed run." : "The original source remained selected during the managed run."
    });
    if (toRecord(
      processRecord.modules.find(function(entry) {
        return entry.id === "motion";
      })
    ).status === "queued") {
      updateProcessModule(processRecord, "motion", {
        status: "running",
        percent: 30,
        startedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      const videoProbe = await runVideoStructureProbe(runtime, project, requestId, jobId, target);
      if (videoProbe.freeze.count > 0) {
        findings.push(
          createProcessFinding(
            "motion",
            "measured",
            videoProbe.freeze.count > 2 ? "high" : "medium",
            "medium",
            "Freeze intervals detected",
            `The managed run found ${videoProbe.freeze.count} freeze interval(s).`,
            videoProbe.freeze.count,
            []
          )
        );
      }
      if (videoProbe.black.count > 0) {
        findings.push(
          createProcessFinding(
            "motion",
            "measured",
            "low",
            "low",
            "Black interval transitions detected",
            `Black interval analysis found ${videoProbe.black.count} transition(s).`,
            videoProbe.black.count,
            []
          )
        );
      }
      updateProcessModule(processRecord, "motion", {
        status: "ready",
        percent: 100,
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary: "Video structure checks finished for the active target."
      });
    }
    if (toRecord(
      processRecord.modules.find(function(entry) {
        return entry.id === "audio";
      })
    ).status === "queued") {
      updateProcessModule(processRecord, "audio", {
        status: "running",
        percent: 30,
        startedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      const audioProbe = await runAudioStructureProbe(runtime, project, requestId, jobId, target);
      const spectrogram = await generateProcessSpectrogram(
        runtime,
        project,
        requestId,
        jobId,
        target,
        artifactBase,
        outputDir,
        "audio"
      );
      if (spectrogram) {
        artifacts.push(spectrogram);
      }
      if (audioProbe.silence.count > 0) {
        findings.push(
          createProcessFinding(
            "audio",
            "measured",
            audioProbe.silence.count > 3 ? "medium" : "low",
            "medium",
            "Silence pockets detected",
            `Silence detection found ${audioProbe.silence.count} pocket(s) during the managed run.`,
            audioProbe.silence.count,
            spectrogram ? [spectrogram.id] : []
          )
        );
      }
      const speech = buildProcessSpeechAvailability(runtime, project);
      if (speech.ready) {
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
              project.profile.transcriptSampleSeconds
            )
          );
          if (transcriptResult && transcriptResult.artifact) {
            const transcriptArtifact = normalizeProcessArtifact({
              ...transcriptResult.artifact,
              moduleId: "audio"
            });
            artifacts.push(transcriptArtifact);
          }
        } catch (_error) {
          warnings.push("Transcript sampling stayed unavailable during the managed run.");
        }
      }
      updateProcessModule(processRecord, "audio", {
        status: "ready",
        percent: 100,
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary: "Audio continuity checks finished for the active target.",
        artifactIds: artifacts.filter(function(entry) {
          return asNonEmptyString(entry.moduleId) === "audio";
        }).map(function(entry) {
          return entry.id;
        })
      });
    }
    updateProcessModule(processRecord, "report", {
      status: "ready",
      percent: 100,
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
