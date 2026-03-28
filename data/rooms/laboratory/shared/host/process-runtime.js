export function createLaboratoryProcessRuntime(deps) {
  const {
    asNonEmptyString,
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    buildSubtitleAnalysisStats,
    buildSubtitleProcessModules,
    cancelProcessJobsForProject,
    clampProfileTranscriptSampleSeconds,
    clearJob,
    clone,
    composeFeatureReport,
    createEmptyFeatureProcessRecord,
    createEmptyProcessRun,
    createProcessArtifact,
    createProcessFinding,
    ensureEditToolReady,
    ensureProcessJobSlotAvailable,
    ensureProjectDirectories,
    generateProcessMetadataArtifact,
    generateProcessSpectrogram,
    getActiveProject,
    getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner,
    getFeatureProcessDir,
    getFeatureProcessJobAction,
    getFeatureProcessRecord,
    getProjectSubtitleProcessDir,
    maybeRunWhisperProfileSample,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    patchActiveProject,
    pushJobState,
    registerJob,
    resolveProcessTarget,
    runAudioStructureProbe,
    runVideoStructureProbe,
    sanitizeFileSegment,
    setFeatureProcessRecord,
    setFeatureReportRecord,
    toRecord,
    updateProcessModule,
    updateProcessRecordPercent,
    writeJsonFile,
    writeTextFile,
    markFeatureReportStale,
    audioFeatureId,
    subtitleFeatureId,
  } = deps;

  async function runSubtitleManagedProcess(runtime, project, target, artifactBase, processRecord) {
    const findings = [];
    const artifacts = [];
    const warnings = [];
    const stats = await buildSubtitleAnalysisStats(runtime, project, target);
    const subtitleProcessDir = getProjectSubtitleProcessDir(runtime, project);
    const summaryPath = `${subtitleProcessDir}/${artifactBase}-subtitle-summary.json`;
    const topWordsPath = `${subtitleProcessDir}/${artifactBase}-top-words.txt`;
    const moduleArtifactIds = {};

    await writeJsonFile(summaryPath, {
      generatedAt: new Date().toISOString(),
      target: clone(processRecord.targetSummary),
      stats: clone(stats),
    });

    const summaryArtifact = createProcessArtifact(
      "batch-summary",
      "subtitle-summary",
      summaryPath,
      "Subtitle Summary",
      {
        totalFiles: stats.totalFiles,
        totalCues: stats.totalCues,
      }
    );
    if (summaryArtifact) {
      artifacts.push(summaryArtifact);
      moduleArtifactIds["batch-summary"] = [summaryArtifact.id];
    }

    if (Array.isArray(stats.topWords) && stats.topWords.length > 0) {
      await writeTextFile(
        topWordsPath,
        stats.topWords
          .map(function (entry) {
            return `${entry.word}\t${entry.count}`;
          })
          .join("\n")
      );
      const topWordsArtifact = createProcessArtifact(
        "lexical-frequency",
        "subtitle-top-words",
        topWordsPath,
        "Top Subtitle Terms",
        {
          topWord: stats.topWords[0] ? stats.topWords[0].word : null,
        }
      );
      if (topWordsArtifact) {
        artifacts.push(topWordsArtifact);
        moduleArtifactIds["lexical-frequency"] = [topWordsArtifact.id];
      }
    }

    for (let index = 0; index < processRecord.modules.length; index += 1) {
      const moduleEntry = toRecord(processRecord.modules[index]);
      const moduleId = asNonEmptyString(moduleEntry.id) || `subtitle-module-${index}`;
      const moduleStatus = asNonEmptyString(moduleEntry.status) || "queued";
      if (["planned", "gated", "blocked", "skipped"].includes(moduleStatus)) {
        continue;
      }

      updateProcessModule(processRecord, moduleId, {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
      });

      const moduleFindings = [];
      let summary = "";

      if (moduleId === "format-qc") {
        summary = `${stats.totalCues} cues checked across ${stats.totalFiles} subtitle file(s).`;
        if (stats.totalCues === 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "high",
              "medium",
              "No subtitle cues were parsed",
              "The current subtitle selection does not expose parseable cues.",
              stats.totalFiles,
              []
            )
          );
        }
        if (stats.emptyCueCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "low",
              "medium",
              "Empty subtitle cues detected",
              `${stats.emptyCueCount} cue(s) contain no visible text after parsing.`,
              stats.emptyCueCount,
              []
            )
          );
        }
      } else if (moduleId === "readability-density") {
        summary = `Average line density is ${Number(stats.averageCharsPerLine || 0).toFixed(1)} chars/line.`;
        if (stats.longLineCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              stats.longLineCount > 12 ? "high" : "medium",
              "medium",
              "Long subtitle lines found",
              `${stats.longLineCount} line(s) exceed the 42 character readability budget.`,
              stats.longLineCount,
              []
            )
          );
        }
        if (typeof stats.averageCps === "number" && stats.averageCps > 17) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              stats.averageCps > 20 ? "high" : "medium",
              "medium",
              "Average subtitle CPS is elevated",
              `Average character density is ${stats.averageCps.toFixed(1)} characters per second.`,
              Math.round(stats.averageCps),
              []
            )
          );
        }
      } else if (moduleId === "cue-timing-structure") {
        summary = `Timing checks found ${stats.overlapCount} overlap(s) and ${stats.invalidDurationCount} invalid duration cue(s).`;
        if (stats.overlapCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "high",
              "medium",
              "Subtitle overlaps detected",
              `${stats.overlapCount} cue overlap(s) were found in the active selection.`,
              stats.overlapCount,
              []
            )
          );
        }
        if (stats.invalidDurationCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "medium",
              "medium",
              "Invalid cue durations detected",
              `${stats.invalidDurationCount} cue(s) have zero or negative duration.`,
              stats.invalidDurationCount,
              []
            )
          );
        }
      } else if (moduleId === "lexical-frequency") {
        const topWord = stats.topWords[0];
        summary =
          topWord && topWord.word
            ? `Top lexical term is "${topWord.word}" with ${topWord.count} hits.`
            : "No lexical frequency signal was extracted from the active selection.";
      } else if (moduleId === "batch-summary") {
        summary = `${stats.totalFiles} file(s), ${stats.totalCues} cues, ${stats.uniqueFormats.join(", ") || "--"} format(s).`;
        if (stats.uniqueLanguages.length > 1) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "derived",
              "low",
              "medium",
              "Multiple subtitle languages detected",
              `The current selection mixes ${stats.uniqueLanguages.join(", ")} subtitle tracks.`,
              stats.uniqueLanguages.length,
              moduleArtifactIds["batch-summary"] || []
            )
          );
        }
      } else {
        summary = "Subtitle analysis module finished on the current selection.";
      }

      moduleFindings.forEach(function (finding) {
        findings.push(normalizeProcessFinding(finding));
      });
      updateProcessModule(processRecord, moduleId, {
        status: "ready",
        percent: 100,
        completedAt: new Date().toISOString(),
        summary: summary,
        artifactIds: moduleArtifactIds[moduleId] || [],
        findingIds: moduleFindings.map(function (finding) {
          return finding.id;
        }),
      });
    }

    return {
      findings: findings,
      artifacts: artifacts,
      warnings: warnings,
    };
  }

  async function runAudioManagedProcess(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    processRecord
  ) {
    const findings = [];
    const artifacts = [];
    const warnings = [];

    for (let index = 0; index < processRecord.modules.length; index += 1) {
      const moduleEntry = toRecord(processRecord.modules[index]);
      const moduleId = asNonEmptyString(moduleEntry.id) || `audio-module-${index}`;
      const moduleStatus = asNonEmptyString(moduleEntry.status) || "queued";
      if (["planned", "gated", "blocked", "skipped"].includes(moduleStatus)) {
        continue;
      }

      updateProcessModule(processRecord, moduleId, {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
      });

      const moduleRunner = getAudioAnalysisModuleRunner(moduleId);
      if (typeof moduleRunner !== "function") {
        updateProcessModule(processRecord, moduleId, {
          status: "skipped",
          percent: 100,
          completedAt: new Date().toISOString(),
          summary: "A generic audio runner is not registered for this module yet.",
        });
        continue;
      }

      const moduleOutputDir = getAudioAnalysisModuleProcessDir(runtime, project, moduleId);
      const moduleResult = await moduleRunner(
        runtime,
        project,
        requestId,
        jobId,
        target,
        sanitizeFileSegment(`${artifactBase}-${moduleId}`, moduleId),
        moduleOutputDir,
        moduleId
      );

      (Array.isArray(moduleResult.findings) ? moduleResult.findings : []).forEach(function (finding) {
        findings.push(normalizeProcessFinding(finding));
      });
      (Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : []).forEach(function (artifact) {
        artifacts.push(normalizeProcessArtifact(artifact));
      });
      (Array.isArray(moduleResult.warnings) ? moduleResult.warnings : []).forEach(function (warning) {
        warnings.push(String(warning));
      });

      updateProcessModule(processRecord, moduleId, {
        status: asNonEmptyString(moduleResult.status) || "ready",
        percent: 100,
        completedAt: new Date().toISOString(),
        summary: asNonEmptyString(moduleResult.summary) || "",
        artifactIds: (Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : [])
          .map(function (artifact) {
            return asNonEmptyString(toRecord(artifact).id);
          })
          .filter(Boolean),
      });
    }

    return {
      findings: findings,
      artifacts: artifacts,
      warnings: warnings,
    };
  }

  async function runMediaManagedProcess(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    outputDir,
    processRecord
  ) {
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
      completedAt: new Date().toISOString(),
      summary: "The active target was pinned and its metadata snapshot was saved.",
      artifactIds: metadataArtifact ? [metadataArtifact.id] : [],
    });

    updateProcessModule(processRecord, "cleanup", {
      status: "ready",
      percent: 100,
      completedAt: new Date().toISOString(),
      summary:
        asNonEmptyString(toRecord(project.edit).handoffMode) === "derived"
          ? "Derived handoff remained selected during the managed run."
          : "The original source remained selected during the managed run.",
    });

    if (toRecord(processRecord.modules.find(function (entry) { return entry.id === "motion"; })).status === "queued") {
      updateProcessModule(processRecord, "motion", {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
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
        completedAt: new Date().toISOString(),
        summary: "Video structure checks finished for the active target.",
      });
    }

    if (toRecord(processRecord.modules.find(function (entry) { return entry.id === "audio"; })).status === "queued") {
      updateProcessModule(processRecord, "audio", {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
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
            clampProfileTranscriptSampleSeconds(runtime.profileCapabilities, project.profile.transcriptSampleSeconds)
          );
          if (transcriptResult && transcriptResult.artifact) {
            const transcriptArtifact = normalizeProcessArtifact({
              ...transcriptResult.artifact,
              moduleId: "audio",
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
        completedAt: new Date().toISOString(),
        summary: "Audio continuity checks finished for the active target.",
        artifactIds: artifacts
          .filter(function (entry) {
            return asNonEmptyString(entry.moduleId) === "audio";
          })
          .map(function (entry) {
            return entry.id;
          }),
      });
    }

    updateProcessModule(processRecord, "report", {
      status: "ready",
      percent: 100,
      completedAt: new Date().toISOString(),
      summary: "A report-ready summary was synthesized from the managed run.",
    });

    return {
      findings: findings,
      artifacts: artifacts,
      warnings: warnings,
    };
  }

  async function runManagedProcess(runtime, project, requestId, jobId, featureId, outputDir) {
    const target = resolveProcessTarget(project, featureId);
    if (featureId === subtitleFeatureId) {
      if (!Array.isArray(target.entries) || target.entries.length === 0) {
        throw new Error("Import subtitle files before starting subtitle analysis.");
      }
    } else if (target.path === null) {
      throw new Error("Prepare a valid target before starting the process stage.");
    }

    const artifactBase = sanitizeFileSegment(
      `${project.slug}-${featureId}-${Date.now()}`,
      featureId === audioFeatureId ? "audio-process" : "media-process"
    );
    const processRecord = createEmptyProcessRun(featureId);
    processRecord.status = "running";
    processRecord.requestId = requestId;
    processRecord.jobId = jobId;
    processRecord.runId = `${featureId}-run-${Date.now()}`;
    processRecord.startedAt = new Date().toISOString();
    processRecord.targetSummary = {
      requestedMode: target.requestedMode,
      mode: target.mode,
      outputId: target.outputId,
      signature: target.signature,
      label: target.label,
      fileName: target.fileName,
      mimeType: target.mimeType,
      path: target.path,
      entryCount: Array.isArray(target.entries) ? target.entries.length : null,
    };
    processRecord.modules =
      featureId === audioFeatureId
        ? buildAudioAnalysisModules(runtime, project, target)
        : featureId === subtitleFeatureId
          ? buildSubtitleProcessModules(runtime, target)
          : buildMediaProcessModules(runtime, project, target);

    const results =
      featureId === subtitleFeatureId
        ? await runSubtitleManagedProcess(runtime, project, target, artifactBase, processRecord)
        : featureId === audioFeatureId
          ? await runAudioManagedProcess(runtime, project, requestId, jobId, target, artifactBase, processRecord)
          : await runMediaManagedProcess(
              runtime,
              project,
              requestId,
              jobId,
              target,
              artifactBase,
              outputDir,
              processRecord
            );

    processRecord.findings = results.findings;
    processRecord.artifacts = results.artifacts;
    processRecord.warnings = results.warnings;
    processRecord.status = "ready";
    processRecord.completedAt = new Date().toISOString();
    updateProcessRecordPercent(processRecord);
    return processRecord;
  }

  async function runFeatureProcess(api, runtime, requestId, featureId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    if (
      featureId !== audioFeatureId &&
      featureId !== subtitleFeatureId &&
      asNonEmptyString(toRecord(toRecord(project.profile).preflight).status) !== "ready"
    ) {
      throw new Error("Run the profile preflight before starting the process stage.");
    }

    if (featureId !== subtitleFeatureId) {
      ensureEditToolReady(runtime);
    }
    await ensureProjectDirectories(runtime, project, requestId);
    const action = getFeatureProcessJobAction(featureId);
    ensureProcessJobSlotAvailable(runtime, project.id, action);
    const jobId = `room-process-${featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: action,
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "process",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "process",
      stage: "queued",
      percent: 0,
    });

    await patchActiveProject(runtime, function (nextProject) {
      setFeatureProcessRecord(nextProject, featureId, {
        ...createEmptyFeatureProcessRecord(featureId),
        featureId: featureId,
        status: "running",
        jobId: jobId,
        requestId: requestId,
        percent: 0,
      });
      markFeatureReportStale(nextProject, featureId, "A new process run is now in progress.");
      return nextProject;
    });

    try {
      const nextProcessRecord = await runManagedProcess(
        runtime,
        clone(project),
        requestId,
        jobId,
        featureId,
        getFeatureProcessDir(runtime, project, featureId)
      );
      await patchActiveProject(runtime, function (nextProject) {
        setFeatureProcessRecord(nextProject, featureId, nextProcessRecord);
        setFeatureReportRecord(nextProject, featureId, composeFeatureReport(runtime, nextProject, featureId));
        return nextProject;
      });
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project.id,
        toolId: "ffmpeg",
        featureStage: "process",
        stage: "completed",
        percent: 100,
      });
    } catch (error) {
      await patchActiveProject(runtime, function (nextProject) {
        setFeatureProcessRecord(nextProject, featureId, {
          ...getFeatureProcessRecord(nextProject, featureId),
          status: "error",
          jobId: null,
          requestId: null,
          error: error instanceof Error ? error.message : String(error),
        });
        return nextProject;
      });
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project.id,
        toolId: "ffmpeg",
        featureStage: "process",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  async function cancelFeatureProcess(api, runtime, requestId, featureId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    const action = getFeatureProcessJobAction(featureId);
    await cancelProcessJobsForProject(api, runtime, project.id, requestId, action);
    await patchActiveProject(runtime, function (nextProject) {
      setFeatureProcessRecord(nextProject, featureId, {
        ...getFeatureProcessRecord(nextProject, featureId),
        status: "cancelled",
        jobId: null,
        requestId: null,
        error: null,
      });
      return nextProject;
    });
  }

  return {
    cancelFeatureProcess,
    runFeatureProcess,
    runManagedProcess,
  };
}
