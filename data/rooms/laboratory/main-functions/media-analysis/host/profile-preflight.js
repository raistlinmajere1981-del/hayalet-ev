export function createMediaProfilePreflightRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    buildSyntheticProfileSignal,
    clampNumber,
    clampProfileTranscriptSampleSeconds,
    clearJob,
    clone,
    createEmptyProfilePreflight,
    createProfileSignal,
    ensureProfileJobSlotAvailable,
    ensureProfileToolReady,
    ensureProjectDirectories,
    generateProfileFrameStrip,
    generateProfileMetadataArtifact,
    generateProfileSpectrogram,
    getActiveProject,
    getProfileFrameDensityRuntimeConfig,
    maybeRunWhisperProfileSample,
    normalizeProfileArtifactPreferences,
    normalizeSourceMetadata,
    patchActiveProject,
    pushJobState,
    registerJob,
    runAudioStructureProbe,
    runVideoStructureProbe,
    sanitizeFileSegment,
    syncProjectFeatureProjections,
    toRecord
  } = deps;
  async function runProfilePreflight(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    ensureProfileToolReady(runtime);
    ensureProfileJobSlotAvailable(runtime, project.id, "profile-run-preflight");
    await ensureProjectDirectories(runtime, project, requestId);
    const projectedProject = clone(project);
    syncProjectFeatureProjections(runtime, projectedProject);
    const readiness = toRecord(projectedProject.profile.readiness);
    if (readiness.stageReady !== true) {
      throw new Error(
        (Array.isArray(readiness.blockers) ? readiness.blockers[0] : null) || "Resolve the profile blockers before running preflight."
      );
    }
    const target = toRecord(readiness.target);
    const artifactBase = sanitizeFileSegment(
      `${project.slug}-${asNonEmptyString(projectedProject.profile.activePresetId) || "profile"}-${Date.now()}`,
      "profile-pass"
    );
    const jobId = `room-profile-preflight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sampleWindowSeconds = asNumber(toRecord(projectedProject.profile.estimate).sampleWindowSeconds) || 45;
    const sourceKind = asNonEmptyString(project.source.kind) || "video";
    const artifactPreferences = normalizeProfileArtifactPreferences(
      toRecord(projectedProject.profile.artifactPreferences),
      runtime.profileCapabilities,
      sourceKind
    );
    const frameTileCount = Math.max(
      2,
      Math.round(
        asNumber(
          toRecord(getProfileFrameDensityRuntimeConfig(runtime, projectedProject.profile.frameSampleDensity)).tileCount
        ) || 4
      )
    );
    const transcriptSampleSeconds = clampProfileTranscriptSampleSeconds(
      runtime.profileCapabilities,
      projectedProject.profile.transcriptSampleSeconds
    );
    registerJob(runtime, {
      jobId,
      requestId,
      action: "profile-run-preflight",
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "profile"
    });
    pushJobState(api, {
      requestId,
      jobId,
      action: "profile-run-preflight",
      projectId: project.id,
      toolId: "ffmpeg",
      featureStage: "profile",
      stage: "queued"
    });
    await patchActiveProject(runtime, function(nextProject) {
      nextProject.profile.lastError = null;
      nextProject.profile.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextProject.profile.preflight = {
        ...createEmptyProfilePreflight(),
        ...toRecord(nextProject.profile.preflight),
        status: "running",
        jobId,
        requestId,
        warnings: Array.isArray(readiness.warnings) ? readiness.warnings.slice() : [],
        error: null
      };
      return nextProject;
    });
    try {
      const artifacts = [];
      const signals = [];
      const metadataArtifact = artifactPreferences.metadata === true ? await generateProfileMetadataArtifact(runtime, project, target, artifactBase) : null;
      if (metadataArtifact) {
        artifacts.push(metadataArtifact);
      }
      if (artifactPreferences["frame-strip"] === true && (sourceKind === "video" || sourceKind === "image")) {
        try {
          const frameArtifact = await generateProfileFrameStrip(
            runtime,
            project,
            requestId,
            jobId,
            target,
            artifactBase,
            sampleWindowSeconds,
            frameTileCount
          );
          if (frameArtifact) {
            artifacts.push(frameArtifact);
          }
        } catch (_error) {
        }
      }
      if (artifactPreferences.spectrogram === true && (sourceKind === "video" || sourceKind === "audio")) {
        try {
          const spectrogramArtifact = await generateProfileSpectrogram(
            runtime,
            project,
            requestId,
            jobId,
            target,
            artifactBase
          );
          if (spectrogramArtifact) {
            artifacts.push(spectrogramArtifact);
          }
        } catch (_error) {
        }
      }
      const artifactIds = artifacts.map(function(artifact) {
        return artifact.id;
      });
      const metadata = normalizeSourceMetadata(target.metadata);
      const enabledLaneIds = Array.isArray(readiness.enabledLaneIds) ? readiness.enabledLaneIds : [];
      if (enabledLaneIds.includes("metadata-lineage") && (!metadata || asNonEmptyString(toRecord(metadata).formatName) === null)) {
        signals.push(
          createProfileSignal(
            "metadata-lineage",
            "measured",
            "medium",
            "medium",
            "Metadata lineage is incomplete",
            "The sampled asset is missing a clear container or format declaration from ffprobe.",
            1,
            artifactIds
          )
        );
      }
      if (sourceKind === "video" && enabledLaneIds.includes("visual-tamper")) {
        const videoProbe = await runVideoStructureProbe(runtime, project, requestId, jobId, target);
        if (videoProbe.freeze.count > 0) {
          signals.push(
            createProfileSignal(
              "visual-tamper",
              "measured",
              videoProbe.freeze.count > 2 ? "high" : "medium",
              "medium",
              "Freeze intervals detected",
              `The sampled window contains ${videoProbe.freeze.count} freeze interval(s).`,
              videoProbe.freeze.count,
              artifactIds
            )
          );
        }
        if (videoProbe.black.count > 0) {
          signals.push(
            createProfileSignal(
              "visual-tamper",
              "measured",
              "low",
              "low",
              "Black interval transitions detected",
              `Black interval analysis found ${videoProbe.black.count} transition(s).`,
              videoProbe.black.count,
              artifactIds
            )
          );
        }
      }
      if ((sourceKind === "video" || sourceKind === "audio") && (enabledLaneIds.includes("audio-tamper") || enabledLaneIds.includes("speech-overlay"))) {
        const audioProbe = await runAudioStructureProbe(runtime, project, requestId, jobId, target);
        if (audioProbe.silence.count > 0) {
          signals.push(
            createProfileSignal(
              "audio-tamper",
              "measured",
              audioProbe.silence.count > 3 ? "medium" : "low",
              "medium",
              "Silence pockets detected",
              `Silence detection found ${audioProbe.silence.count} pocket(s) in the sampled audio path.`,
              audioProbe.silence.count,
              artifactIds
            )
          );
        }
        if (typeof audioProbe.volume.meanVolumeDb === "number" && typeof audioProbe.volume.maxVolumeDb === "number" && audioProbe.volume.maxVolumeDb - audioProbe.volume.meanVolumeDb > 18) {
          signals.push(
            createProfileSignal(
              "audio-tamper",
              "heuristic",
              "low",
              "low",
              "Wide loudness spread observed",
              "The sampled loudness spread is wider than a typical continuous dialogue pass.",
              1,
              artifactIds
            )
          );
        }
        try {
          const transcriptResult = artifactPreferences.transcript === true ? await maybeRunWhisperProfileSample(
            runtime,
            project,
            requestId,
            jobId,
            target,
            artifactBase,
            transcriptSampleSeconds
          ) : null;
          if (transcriptResult && transcriptResult.artifact) {
            artifacts.push(transcriptResult.artifact);
            artifactIds.push(transcriptResult.artifact.id);
            signals.push(
              createProfileSignal(
                "speech-overlay",
                "measured",
                "low",
                "medium",
                "Transcript sample captured",
                `Whisper sample returned ${transcriptResult.text.split(/\s+/).filter(Boolean).length} words from the sampled audio window.`,
                1,
                [transcriptResult.artifact.id]
              )
            );
          }
        } catch (_error) {
        }
      }
      const syntheticSignal = buildSyntheticProfileSignal(
        signals.filter(function(entry) {
          return asNonEmptyString(toRecord(entry).laneId) !== "speech-overlay";
        }),
        clampNumber(projectedProject.profile.sensitivity, 0.1, 1, 0.58),
        artifactIds
      );
      if (syntheticSignal) {
        signals.push(syntheticSignal);
      }
      const completedAt = (/* @__PURE__ */ new Date()).toISOString();
      await patchActiveProject(runtime, function(nextProject) {
        nextProject.profile.dirty = false;
        nextProject.profile.lastError = null;
        nextProject.profile.lastActionAt = completedAt;
        nextProject.profile.signals = signals;
        nextProject.profile.artifacts = artifacts;
        nextProject.profile.preflight = {
          status: "ready",
          jobId,
          requestId,
          ranAt: completedAt,
          targetSummary: {
            requestedMode: target.requestedMode,
            mode: target.mode,
            outputId: target.outputId,
            signature: target.signature,
            label: target.label,
            fileName: target.fileName,
            mimeType: target.mimeType,
            path: target.path
          },
          warnings: Array.isArray(readiness.warnings) ? readiness.warnings.slice() : [],
          error: null
        };
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action: "profile-run-preflight",
        projectId: project.id,
        toolId: "ffmpeg",
        featureStage: "profile",
        stage: "completed",
        percent: 100
      });
    } catch (error) {
      await patchActiveProject(runtime, function(nextProject) {
        nextProject.profile.lastError = error instanceof Error ? error.message : String(error);
        nextProject.profile.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
        nextProject.profile.preflight = {
          ...createEmptyProfilePreflight(),
          ...toRecord(nextProject.profile.preflight),
          status: "error",
          jobId,
          requestId,
          error: error instanceof Error ? error.message : String(error)
        };
        return nextProject;
      });
      pushJobState(api, {
        requestId,
        jobId,
        action: "profile-run-preflight",
        projectId: project.id,
        toolId: "ffmpeg",
        featureStage: "profile",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }
  return {
    runProfilePreflight
  };
}
