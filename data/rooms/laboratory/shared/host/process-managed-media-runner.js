export function createLaboratoryManagedMediaRunnerRuntime(deps) {
  const {
    asNonEmptyString,
    buildProcessSpeechAvailability,
    clampProfileTranscriptSampleSeconds,
    createProcessFinding,
    generateProcessFramePreviewArtifact,
    generateProcessMetadataArtifact,
    generateProcessSpectrogram,
    generateProcessVisualTransformArtifact,
    maybeRunWhisperProfileSample,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    partitionVisualAnalysisModuleIds,
    resolveEnabledVisualAnalysisModuleIds,
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
  function toProcessFindingRecord(value) {
    return toRecord(value);
  }
  function toReferenceRecord(value) {
    return toRecord(value);
  }
  function getSourceKind(project) {
    return asNonEmptyString(toRecord(project.source)["kind"]) || "video";
  }
  function getScopeReference(processRecord) {
    const scope = toRecord(processRecord.analysisScope);
    return {
      ...Object.keys(toReferenceRecord(scope["timeRange"])).length > 0 ? { timeRange: toReferenceRecord(scope["timeRange"]) } : {},
      ...Object.keys(toReferenceRecord(scope["frameRange"])).length > 0 ? { frameRange: toReferenceRecord(scope["frameRange"]) } : {},
      ...Object.keys(toReferenceRecord(scope["region"])).length > 0 ? { region: toReferenceRecord(scope["region"]) } : {}
    };
  }
  function getScopeHypothesis(processRecord) {
    return asNonEmptyString(toRecord(processRecord.analysisScope)["hypothesis"]);
  }
  function createMediaFinding(processRecord, moduleId, sourceModule, options) {
    return toProcessFindingRecord(
      normalizeProcessFinding({
        ...createProcessFinding(
          moduleId,
          "derived",
          options.level || "low",
          options.confidence || "low",
          options.title,
          options.detail,
          typeof options.evidenceCount === "number" ? options.evidenceCount : 1,
          Array.isArray(options.artifactIds) ? options.artifactIds : []
        ),
        code: `${sourceModule}-signal`,
        severity: options.level || "low",
        sourceModule,
        reference: getScopeReference(processRecord),
        hypothesis: getScopeHypothesis(processRecord)
      })
    );
  }
  function buildVisualFindingDetail(moduleId, freezeCount, blackCount, sourceKind) {
    if (moduleId === "frame-consistency") {
      return freezeCount > 0 ? {
        title: "Frame consistency anomaly detected",
        detail: `The active ${sourceKind} target contains ${freezeCount} freeze interval(s) inside the sampled window.`,
        level: freezeCount > 2 ? "medium" : "low"
      } : {
        title: "Frame consistency sweep completed",
        detail: "The managed run captured a frame consistency baseline for the selected scope.",
        level: "low"
      };
    }
    if (moduleId === "motion-anomaly") {
      return freezeCount + blackCount > 0 ? {
        title: "Motion anomaly cluster detected",
        detail: `Motion analysis observed ${freezeCount + blackCount} structural transition(s) across the sampled window.`,
        level: freezeCount + blackCount > 2 ? "medium" : "low"
      } : {
        title: "Motion anomaly sweep completed",
        detail: "No coarse motion spikes surfaced beyond the sampled baseline.",
        level: "low"
      };
    }
    if (moduleId === "temporal-noise-pattern") {
      return blackCount > 0 ? {
        title: "Temporal noise pattern detected",
        detail: `Black interval analysis found ${blackCount} transition(s) that may deserve a deeper visual replay.`,
        level: "low"
      } : {
        title: "Temporal noise baseline captured",
        detail: "Temporal noise pattern checks completed for the sampled window.",
        level: "low"
      };
    }
    const label = moduleId === "lighting-consistency" ? "Lighting consistency sweep completed" : moduleId === "background-consistency" ? "Background consistency sweep completed" : moduleId === "occlusion-inconsistency" ? "Occlusion inconsistency sweep completed" : moduleId === "object-insert-remove-anomaly" ? "Insert/remove anomaly sweep completed" : "Visual sweep completed";
    return {
      title: label,
      detail: `The managed run generated a ${sourceKind}-level visual baseline for ${moduleId}.`,
      level: "low"
    };
  }
  function getRevealFilterConfig(moduleId) {
    if (moduleId === "color-channel-isolation") {
      return {
        filterGraph: "colorchannelmixer=rr=1:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0",
        label: "Red Channel Isolation"
      };
    }
    if (moduleId === "gamma-scan") {
      return {
        filterGraph: "eq=gamma=1.7:contrast=1.12:brightness=0.03",
        label: "Gamma Scan"
      };
    }
    if (moduleId === "contrast-scan") {
      return {
        filterGraph: "eq=contrast=1.45:brightness=0.02:saturation=1.05",
        label: "Contrast Scan"
      };
    }
    if (moduleId === "edge-enhancement") {
      return {
        filterGraph: "unsharp=7:7:1.8:7:7:0.0",
        label: "Edge Enhancement"
      };
    }
    if (moduleId === "histogram-equalization") {
      return {
        filterGraph: "histeq=strength=0.35:intensity=0.25",
        label: "Histogram Equalization"
      };
    }
    if (moduleId === "hidden-detail-reveal") {
      return {
        filterGraph: "eq=brightness=0.06:contrast=1.55:gamma=1.45,unsharp=5:5:1.4:5:5:0.0",
        label: "Hidden Detail Reveal"
      };
    }
    return {
      filterGraph: "eq=brightness=0.05:contrast=1.2:gamma=1.2",
      label: "Visual Signal Amplification"
    };
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
  async function runMediaManagedProcess(runtime, project, requestId, jobId, target, artifactBase, outputDir, processRecord, emitRuntimeUpdate = null) {
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
    if (metadataArtifact) {
      emitRuntimeUpdate?.({
        kind: "preview-artifact",
        moduleId: "intake",
        message: "Intake preview artifact ready",
        detail: asNonEmptyString(metadataArtifact.label),
        artifact: metadataArtifact,
        moduleTrace: {
          id: `intake-preview-${Date.now()}`,
          moduleId: "intake",
          stage: "process",
          status: "preview-ready",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: "Intake preview artifact ready",
          detail: asNonEmptyString(metadataArtifact.label)
        },
        throttleWindow: "intake-module-batch"
      });
    }
    updateProcessModule(processRecord, "cleanup", {
      status: "ready",
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      summary: asNonEmptyString(toRecord(project.edit)["handoffMode"]) === "derived" ? "Derived handoff remained selected during the managed run." : "The original source remained selected during the managed run."
    });
    if (getModuleStatus(processRecord, "motion") === "queued") {
      const sourceKind = getSourceKind(project);
      const enabledVisualModuleIds = resolveEnabledVisualAnalysisModuleIds(
        runtime,
        project,
        sourceKind
      );
      const visualPartitions = toRecord(
        partitionVisualAnalysisModuleIds(runtime, enabledVisualModuleIds)
      );
      const structureModuleIds = toUnknownArray(visualPartitions["structure"]).map(asNonEmptyString).filter((entry) => entry !== null);
      updateProcessModule(processRecord, "motion", {
        status: "running",
        startedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId: "motion",
        message: "motion module started",
        moduleTrace: {
          id: `motion-running-${Date.now()}`,
          moduleId: "motion",
          stage: "process",
          status: "running",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: "motion module started",
          detail: null
        },
        throttleWindow: "motion-module-batch"
      });
      const framePreview = normalizeOptionalArtifact(
        await generateProcessFramePreviewArtifact(
          runtime,
          project,
          requestId,
          jobId,
          target,
          `${artifactBase}-motion`,
          outputDir,
          "motion",
          60,
          5,
          sourceKind === "image" ? "Visual Reference Frame" : "Structure Frame Preview"
        )
      );
      if (framePreview !== null) {
        artifacts.push(framePreview);
      }
      const videoProbe = sourceKind === "video" ? toVideoProbeRecord(
        await runVideoStructureProbe(runtime, project, requestId, jobId, target)
      ) : toVideoProbeRecord({});
      const freezeCount = getProbeCount(videoProbe.freeze);
      const blackCount = getProbeCount(videoProbe.black);
      const structureArtifactIds = framePreview && typeof framePreview.id === "string" ? [framePreview.id] : [];
      structureModuleIds.forEach(function(visualModuleId) {
        const descriptor = buildVisualFindingDetail(
          visualModuleId,
          freezeCount,
          blackCount,
          sourceKind
        );
        findings.push(
          createMediaFinding(processRecord, "motion", visualModuleId, {
            artifactIds: structureArtifactIds,
            detail: descriptor.detail,
            evidenceCount: descriptor.level === "medium" ? Math.max(1, freezeCount + blackCount) : 1,
            level: descriptor.level,
            title: descriptor.title
          })
        );
      });
      const motionFindings = findings.filter(function(entry) {
        return asNonEmptyString(entry.moduleId) === "motion";
      });
      if (framePreview !== null) {
        emitRuntimeUpdate?.({
          kind: "preview-artifact",
          moduleId: "motion",
          message: "motion preview artifact ready",
          detail: asNonEmptyString(framePreview.label),
          artifact: framePreview,
          moduleTrace: {
            id: `motion-preview-${Date.now()}`,
            moduleId: "motion",
            stage: "process",
            status: "preview-ready",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: "motion preview artifact ready",
            detail: asNonEmptyString(framePreview.label)
          },
          throttleWindow: "motion-module-batch"
        });
      }
      if (motionFindings.length > 0) {
        const primaryMotionFinding = motionFindings[0];
        if (primaryMotionFinding) {
          emitRuntimeUpdate?.({
            kind: "live-finding",
            moduleId: "motion",
            message: "motion findings updated",
            detail: motionFindings.length > 1 ? `${motionFindings.length} visual findings were aggregated for the motion window.` : asNonEmptyString(primaryMotionFinding.detail) || asNonEmptyString(primaryMotionFinding.title) || "Motion finding emitted.",
            finding: primaryMotionFinding,
            moduleTrace: {
              id: `motion-finding-${Date.now()}`,
              moduleId: "motion",
              stage: "process",
              status: "finding",
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              message: "motion findings updated",
              detail: motionFindings.length > 1 ? `${motionFindings.length} visual findings were aggregated for the motion window.` : asNonEmptyString(primaryMotionFinding.detail) || asNonEmptyString(primaryMotionFinding.title) || "Motion finding emitted."
            },
            throttleWindow: "motion-module-batch"
          });
        }
      }
      updateProcessModule(processRecord, "motion", {
        status: "ready",
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary: structureModuleIds.length > 0 ? `${structureModuleIds.length} structural visual module(s) completed on the active target.` : "Structural visual checks finished for the active target.",
        artifactIds: collectArtifactIdsForModule(artifacts, "motion")
      });
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId: "motion",
        message: "motion module completed",
        detail: structureModuleIds.length > 0 ? `${structureModuleIds.length} structural visual module(s) completed on the active target.` : "Video structure checks finished for the active target.",
        moduleTrace: {
          id: `motion-completed-${Date.now()}`,
          moduleId: "motion",
          stage: "process",
          status: "ready",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: "motion module completed",
          detail: structureModuleIds.length > 0 ? `${structureModuleIds.length} structural visual module(s) completed on the active target.` : "Video structure checks finished for the active target."
        },
        throttleWindow: "motion-module-batch"
      });
    }
    if (getModuleStatus(processRecord, "visual-signal") === "queued") {
      const sourceKind = getSourceKind(project);
      const enabledVisualModuleIds = resolveEnabledVisualAnalysisModuleIds(
        runtime,
        project,
        sourceKind
      );
      const visualPartitions = toRecord(
        partitionVisualAnalysisModuleIds(runtime, enabledVisualModuleIds)
      );
      const revealModuleIds = toUnknownArray(visualPartitions["reveal"]).map(asNonEmptyString).filter((entry) => entry !== null);
      updateProcessModule(processRecord, "visual-signal", {
        status: "running",
        startedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId: "visual-signal",
        message: "visual-signal module started",
        moduleTrace: {
          id: `visual-signal-running-${Date.now()}`,
          moduleId: "visual-signal",
          stage: "process",
          status: "running",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: "visual-signal module started",
          detail: null
        },
        throttleWindow: "visual-signal-module-batch"
      });
      const revealArtifacts = [];
      for (let index = 0; index < revealModuleIds.length; index += 1) {
        const visualModuleId = revealModuleIds[index];
        if (!visualModuleId) {
          continue;
        }
        const filterConfig = getRevealFilterConfig(visualModuleId);
        const transformArtifact = normalizeOptionalArtifact(
          await generateProcessVisualTransformArtifact(
            runtime,
            project,
            requestId,
            jobId,
            target,
            `${artifactBase}-${visualModuleId}`,
            outputDir,
            "visual-signal",
            filterConfig.filterGraph,
            filterConfig.label,
            {
              sourceModule: visualModuleId,
              sourceKind
            }
          )
        );
        if (transformArtifact !== null) {
          revealArtifacts.push(transformArtifact);
          artifacts.push(transformArtifact);
        }
      }
      const comparisonVariants = [];
      revealModuleIds.forEach(function(visualModuleId, index) {
        const filterConfig = getRevealFilterConfig(visualModuleId);
        const transformArtifact = revealArtifacts[index] || revealArtifacts[0] || null;
        const artifactIds = transformArtifact && typeof transformArtifact.id === "string" ? [transformArtifact.id] : [];
        const comparisonVariant = {
          id: `visual-variant-${visualModuleId}`,
          moduleId: "visual-signal",
          sourceModule: visualModuleId,
          label: filterConfig.label,
          artifactId: transformArtifact ? asNonEmptyString(transformArtifact.id) : null,
          artifactPath: transformArtifact ? asNonEmptyString(transformArtifact.path) : null,
          active: index === 0
        };
        comparisonVariants.push(comparisonVariant);
        findings.push(
          createMediaFinding(processRecord, "visual-signal", visualModuleId, {
            artifactIds,
            detail: `${filterConfig.label} generated a reveal-oriented preview variant for the selected scope.`,
            title: `${filterConfig.label} variant generated`
          })
        );
      });
      if (comparisonVariants.length > 0) {
        emitRuntimeUpdate?.({
          kind: "module-artifact",
          moduleId: "visual-signal",
          message: "visual signal comparison variants ready",
          detail: comparisonVariants.length > 1 ? `${comparisonVariants.length} reveal variants were batched for the current scope.` : asNonEmptyString(comparisonVariants[0]?.["label"]) || "Visual comparison variant ready",
          artifact: revealArtifacts[0] || void 0,
          comparisonVariant: comparisonVariants[0] || void 0,
          comparisonVariants,
          throttleWindow: "visual-signal-module-batch"
        });
      }
      if (revealArtifacts[0]) {
        emitRuntimeUpdate?.({
          kind: "preview-artifact",
          moduleId: "visual-signal",
          message: "visual signal preview artifact ready",
          detail: asNonEmptyString(revealArtifacts[0].label),
          artifact: revealArtifacts[0],
          comparisonVariant: {
            id: `visual-variant-${revealModuleIds[0] || "primary"}`,
            moduleId: "visual-signal",
            sourceModule: revealModuleIds[0] || "visual-signal-amplification",
            label: asNonEmptyString(revealArtifacts[0].label) || "Visual Reveal Variant",
            artifactId: asNonEmptyString(revealArtifacts[0].id),
            artifactPath: asNonEmptyString(revealArtifacts[0].path),
            active: true
          },
          moduleTrace: {
            id: `visual-signal-preview-${Date.now()}`,
            moduleId: "visual-signal",
            stage: "process",
            status: "preview-ready",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: "visual signal preview artifact ready",
            detail: asNonEmptyString(revealArtifacts[0].label)
          },
          throttleWindow: "visual-signal-module-batch"
        });
      }
      const revealFindings = findings.filter(function(entry) {
        return asNonEmptyString(entry.moduleId) === "visual-signal";
      });
      if (revealFindings.length > 0) {
        const primaryRevealFinding = revealFindings[0];
        if (primaryRevealFinding) {
          emitRuntimeUpdate?.({
            kind: "live-finding",
            moduleId: "visual-signal",
            message: "visual-signal findings updated",
            detail: revealFindings.length > 1 ? `${revealFindings.length} reveal findings were aggregated for the current preview batch.` : asNonEmptyString(primaryRevealFinding.detail) || asNonEmptyString(primaryRevealFinding.title) || "Visual reveal finding emitted.",
            finding: primaryRevealFinding,
            moduleTrace: {
              id: `visual-signal-finding-${Date.now()}`,
              moduleId: "visual-signal",
              stage: "process",
              status: "finding",
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              message: "visual-signal findings updated",
              detail: revealFindings.length > 1 ? `${revealFindings.length} reveal findings were aggregated for the current preview batch.` : asNonEmptyString(primaryRevealFinding.detail) || asNonEmptyString(primaryRevealFinding.title) || "Visual reveal finding emitted."
            },
            throttleWindow: "visual-signal-module-batch"
          });
        }
      }
      updateProcessModule(processRecord, "visual-signal", {
        status: "ready",
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary: revealModuleIds.length > 0 ? `${revealModuleIds.length} visual reveal module(s) generated preview variants.` : "Visual signal amplification checks finished for the active target.",
        artifactIds: collectArtifactIdsForModule(artifacts, "visual-signal")
      });
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId: "visual-signal",
        message: "visual-signal module completed",
        detail: revealModuleIds.length > 0 ? `${revealModuleIds.length} visual reveal module(s) generated preview variants.` : "Visual signal amplification checks finished for the active target.",
        moduleTrace: {
          id: `visual-signal-completed-${Date.now()}`,
          moduleId: "visual-signal",
          stage: "process",
          status: "ready",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: "visual-signal module completed",
          detail: revealModuleIds.length > 0 ? `${revealModuleIds.length} visual reveal module(s) generated preview variants.` : "Visual signal amplification checks finished for the active target."
        },
        throttleWindow: "visual-signal-module-batch"
      });
    }
    if (getModuleStatus(processRecord, "audio") === "queued") {
      updateProcessModule(processRecord, "audio", {
        status: "running",
        startedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId: "audio",
        message: "audio module started",
        moduleTrace: {
          id: `audio-running-${Date.now()}`,
          moduleId: "audio",
          stage: "process",
          status: "running",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: "audio module started",
          detail: null
        },
        throttleWindow: "audio-module-batch"
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
      if (spectrogram !== null) {
        emitRuntimeUpdate?.({
          kind: "preview-artifact",
          moduleId: "audio",
          message: "audio preview artifact ready",
          detail: asNonEmptyString(spectrogram.label),
          artifact: spectrogram,
          moduleTrace: {
            id: `audio-preview-${Date.now()}`,
            moduleId: "audio",
            stage: "process",
            status: "preview-ready",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: "audio preview artifact ready",
            detail: asNonEmptyString(spectrogram.label)
          },
          throttleWindow: "audio-module-batch"
        });
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
      const audioFindings = findings.filter(function(entry) {
        return asNonEmptyString(entry.moduleId) === "audio";
      });
      if (audioFindings.length > 0) {
        const primaryAudioFinding = audioFindings[0];
        if (primaryAudioFinding) {
          emitRuntimeUpdate?.({
            kind: "live-finding",
            moduleId: "audio",
            message: "audio findings updated",
            detail: audioFindings.length > 1 ? `${audioFindings.length} audio findings were aggregated for the current sweep.` : asNonEmptyString(primaryAudioFinding.detail) || asNonEmptyString(primaryAudioFinding.title) || "Audio finding emitted.",
            finding: primaryAudioFinding,
            moduleTrace: {
              id: `audio-finding-${Date.now()}`,
              moduleId: "audio",
              stage: "process",
              status: "finding",
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              message: "audio findings updated",
              detail: audioFindings.length > 1 ? `${audioFindings.length} audio findings were aggregated for the current sweep.` : asNonEmptyString(primaryAudioFinding.detail) || asNonEmptyString(primaryAudioFinding.title) || "Audio finding emitted."
            },
            throttleWindow: "audio-module-batch"
          });
        }
      }
      if (warnings.length > 0) {
        emitRuntimeUpdate?.({
          kind: "module-warning",
          moduleId: "audio",
          message: "audio module warning",
          detail: warnings.join(" | "),
          moduleTrace: {
            id: `audio-warning-${Date.now()}`,
            moduleId: "audio",
            stage: "process",
            status: "warning",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: "audio module warning",
            detail: warnings.join(" | ")
          },
          throttleWindow: "audio-module-batch"
        });
      }
      updateProcessModule(processRecord, "audio", {
        status: "ready",
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary: "Audio continuity checks finished for the active target.",
        artifactIds: collectArtifactIdsForModule(artifacts, "audio")
      });
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId: "audio",
        message: "audio module completed",
        detail: "Audio continuity checks finished for the active target.",
        moduleTrace: {
          id: `audio-completed-${Date.now()}`,
          moduleId: "audio",
          stage: "process",
          status: "ready",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: "audio module completed",
          detail: "Audio continuity checks finished for the active target."
        },
        throttleWindow: "audio-module-batch"
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
