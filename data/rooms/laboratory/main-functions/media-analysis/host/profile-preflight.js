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
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function toProjectProfileRecord(value) {
    return toRecord(value);
  }
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toProfileReadinessRecord(value) {
    return toRecord(value);
  }
  function toProfileTargetRecord(value) {
    return toRecord(value);
  }
  function toProfileEstimateRecord(value) {
    return toRecord(value);
  }
  function toFrameDensityConfigRecord(value) {
    return toRecord(value);
  }
  function toArtifactRecord(value) {
    return toRecord(value);
  }
  function toSignalRecord(value) {
    return toRecord(value);
  }
  function toVideoProbeRecord(value) {
    return toRecord(value);
  }
  function toVideoProbeBucketRecord(value) {
    return toRecord(value);
  }
  function toAudioProbeRecord(value) {
    return toRecord(value);
  }
  function toAudioProbeBucketRecord(value) {
    return toRecord(value);
  }
  function toAudioVolumeRecord(value) {
    return toRecord(value);
  }
  function toTranscriptResultRecord(value) {
    return toRecord(value);
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return asNonEmptyString(entry);
    }).filter((entry) => entry !== null);
  }
  function getProjectId(project) {
    return asNonEmptyString(project.id) || "unknown-project";
  }
  function getProjectProfile(project) {
    return toProjectProfileRecord(project.profile);
  }
  function getSourceKind(project) {
    return asNonEmptyString(toProjectSourceRecord(project.source).kind) || "video";
  }
  function getArtifactIds(artifacts) {
    return artifacts.map(function(artifact) {
      return asNonEmptyString(artifact.id);
    }).filter((artifactId) => artifactId !== null);
  }
  async function runProfilePreflight(api, runtime, requestId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }
    ensureProfileToolReady(runtime);
    const projectId = getProjectId(project);
    ensureProfileJobSlotAvailable(runtime, projectId, "profile-run-preflight");
    await ensureProjectDirectories(runtime, project, requestId);
    const projectedProject = toProjectRecord(clone(project));
    syncProjectFeatureProjections(runtime, projectedProject);
    const projectedProfile = getProjectProfile(projectedProject);
    const readiness = toProfileReadinessRecord(projectedProfile.readiness);
    const blockers = toStringArray(readiness.blockers);
    if (readiness.stageReady !== true) {
      throw new Error(blockers[0] || "Resolve the profile blockers before running preflight.");
    }
    const target = toProfileTargetRecord(readiness.target);
    const artifactBase = sanitizeFileSegment(
      `${asNonEmptyString(project.slug) || "project"}-${asNonEmptyString(projectedProfile.activePresetId) || "profile"}-${Date.now()}`,
      "profile-pass"
    );
    const jobId = `room-profile-preflight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sampleWindowSeconds = asNumber(toProfileEstimateRecord(projectedProfile.estimate).sampleWindowSeconds) || 45;
    const sourceKind = getSourceKind(project);
    const artifactPreferences = normalizeProfileArtifactPreferences(
      toRecord(projectedProfile.artifactPreferences),
      runtime.profileCapabilities,
      sourceKind
    );
    const frameDensityConfig = toFrameDensityConfigRecord(
      getProfileFrameDensityRuntimeConfig(runtime, projectedProfile.frameSampleDensity)
    );
    const frameTileCount = Math.max(2, Math.round(asNumber(frameDensityConfig.tileCount) || 4));
    const transcriptSampleSeconds = clampProfileTranscriptSampleSeconds(
      runtime.profileCapabilities,
      projectedProfile.transcriptSampleSeconds
    );
    registerJob(runtime, {
      action: "profile-run-preflight",
      featureStage: "profile",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg"
    });
    pushJobState(api, {
      action: "profile-run-preflight",
      featureStage: "profile",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg"
    });
    await patchActiveProject(runtime, function(nextProject) {
      const nextProfile = getProjectProfile(nextProject);
      nextProject.profile = nextProfile;
      nextProfile.lastError = null;
      nextProfile.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
      nextProfile.preflight = {
        ...createEmptyProfilePreflight(),
        ...toRecord(nextProfile.preflight),
        error: null,
        jobId,
        requestId,
        status: "running",
        warnings: toStringArray(readiness.warnings)
      };
      return nextProject;
    });
    try {
      const artifacts = [];
      const signals = [];
      const metadataArtifact = artifactPreferences["metadata"] ? await generateProfileMetadataArtifact(runtime, project, target, artifactBase) : null;
      if (metadataArtifact) {
        artifacts.push(toArtifactRecord(metadataArtifact));
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
            artifacts.push(toArtifactRecord(frameArtifact));
          }
        } catch (_error) {
        }
      }
      if (artifactPreferences["spectrogram"] === true && (sourceKind === "video" || sourceKind === "audio")) {
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
            artifacts.push(toArtifactRecord(spectrogramArtifact));
          }
        } catch (_error) {
        }
      }
      const artifactIds = getArtifactIds(artifacts);
      const metadata = normalizeSourceMetadata(target["metadata"]);
      const enabledLaneIds = toStringArray(readiness.enabledLaneIds);
      if (enabledLaneIds.includes("metadata-lineage") && (!metadata || asNonEmptyString(toRecord(metadata)["formatName"]) === null)) {
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
        const videoProbe = toVideoProbeRecord(
          await runVideoStructureProbe(runtime, project, requestId, jobId, target)
        );
        const freezeBucket = toVideoProbeBucketRecord(videoProbe.freeze);
        const blackBucket = toVideoProbeBucketRecord(videoProbe.black);
        const freezeCount = asNumber(freezeBucket.count) || 0;
        const blackCount = asNumber(blackBucket.count) || 0;
        if (freezeCount > 0) {
          signals.push(
            createProfileSignal(
              "visual-tamper",
              "measured",
              freezeCount > 2 ? "high" : "medium",
              "medium",
              "Freeze intervals detected",
              `The sampled window contains ${freezeCount} freeze interval(s).`,
              freezeCount,
              artifactIds
            )
          );
        }
        if (blackCount > 0) {
          signals.push(
            createProfileSignal(
              "visual-tamper",
              "measured",
              "low",
              "low",
              "Black interval transitions detected",
              `Black interval analysis found ${blackCount} transition(s).`,
              blackCount,
              artifactIds
            )
          );
        }
      }
      if ((sourceKind === "video" || sourceKind === "audio") && (enabledLaneIds.includes("audio-tamper") || enabledLaneIds.includes("speech-overlay"))) {
        const audioProbe = toAudioProbeRecord(
          await runAudioStructureProbe(runtime, project, requestId, jobId, target)
        );
        const silenceBucket = toAudioProbeBucketRecord(audioProbe.silence);
        const volume = toAudioVolumeRecord(audioProbe.volume);
        const silenceCount = asNumber(silenceBucket.count) || 0;
        const meanVolumeDb = asNumber(volume.meanVolumeDb);
        const maxVolumeDb = asNumber(volume.maxVolumeDb);
        if (silenceCount > 0) {
          signals.push(
            createProfileSignal(
              "audio-tamper",
              "measured",
              silenceCount > 3 ? "medium" : "low",
              "medium",
              "Silence pockets detected",
              `Silence detection found ${silenceCount} pocket(s) in the sampled audio path.`,
              silenceCount,
              artifactIds
            )
          );
        }
        if (typeof meanVolumeDb === "number" && typeof maxVolumeDb === "number" && maxVolumeDb - meanVolumeDb > 18) {
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
          const transcriptResult = artifactPreferences["transcript"] ? toTranscriptResultRecord(
            await maybeRunWhisperProfileSample(
              runtime,
              project,
              requestId,
              jobId,
              target,
              artifactBase,
              transcriptSampleSeconds
            )
          ) : null;
          const transcriptArtifact = transcriptResult !== null ? toArtifactRecord(transcriptResult.artifact) : null;
          if (transcriptResult && transcriptArtifact && asNonEmptyString(transcriptArtifact.id)) {
            artifacts.push(transcriptArtifact);
            artifactIds.push(asNonEmptyString(transcriptArtifact.id) || "");
            const transcriptText = asNonEmptyString(transcriptResult.text) || "";
            signals.push(
              createProfileSignal(
                "speech-overlay",
                "measured",
                "low",
                "medium",
                "Transcript sample captured",
                `Whisper sample returned ${transcriptText.split(/\s+/).filter(Boolean).length} words from the sampled audio window.`,
                1,
                [asNonEmptyString(transcriptArtifact.id) || ""]
              )
            );
          }
        } catch (_error) {
        }
      }
      const syntheticSignal = buildSyntheticProfileSignal(
        signals.filter(function(entry) {
          return asNonEmptyString(toSignalRecord(entry).laneId) !== "speech-overlay";
        }),
        clampNumber(projectedProfile.sensitivity, 0.1, 1, 0.58),
        artifactIds
      );
      if (syntheticSignal) {
        signals.push(toSignalRecord(syntheticSignal));
      }
      const completedAt = (/* @__PURE__ */ new Date()).toISOString();
      await patchActiveProject(runtime, function(nextProject) {
        const nextProfile = getProjectProfile(nextProject);
        nextProject.profile = nextProfile;
        nextProfile.dirty = false;
        nextProfile.lastError = null;
        nextProfile.lastActionAt = completedAt;
        nextProfile.signals = signals;
        nextProfile.artifacts = artifacts;
        nextProfile.preflight = {
          error: null,
          jobId,
          ranAt: completedAt,
          requestId,
          status: "ready",
          targetSummary: {
            fileName: asNonEmptyString(target.fileName),
            label: asNonEmptyString(target.label),
            mimeType: asNonEmptyString(target.mimeType),
            mode: asNonEmptyString(target.mode),
            outputId: asNonEmptyString(target.outputId),
            path: asNonEmptyString(target.path),
            requestedMode: asNonEmptyString(target.requestedMode),
            signature: asNonEmptyString(target.signature)
          },
          warnings: toStringArray(readiness.warnings)
        };
        return nextProject;
      });
      pushJobState(api, {
        action: "profile-run-preflight",
        featureStage: "profile",
        jobId,
        percent: 100,
        projectId,
        requestId,
        stage: "completed",
        toolId: "ffmpeg"
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await patchActiveProject(runtime, function(nextProject) {
        const nextProfile = getProjectProfile(nextProject);
        nextProject.profile = nextProfile;
        nextProfile.lastError = errorMessage;
        nextProfile.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
        nextProfile.preflight = {
          ...createEmptyProfilePreflight(),
          ...toRecord(nextProfile.preflight),
          error: errorMessage,
          jobId,
          requestId,
          status: "error"
        };
        return nextProject;
      });
      pushJobState(api, {
        action: "profile-run-preflight",
        featureStage: "profile",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "ffmpeg"
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
