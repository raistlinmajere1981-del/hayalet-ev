import { readBooleanSetting, readStringSetting } from "./settings-readers.js";
import { createManagedMediaVisualHelpers } from "./process-managed-media-visual-helpers.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryManagedMediaRuntime = LaboratoryRecord & {
  profileCapabilities?: unknown;
};

type LaboratoryManagedMediaProjectRecord = LaboratoryRecord & {
  edit?: unknown;
  profile?: unknown;
  source?: unknown;
  workbench?: unknown;
};

type LaboratoryManagedMediaTargetRecord = LaboratoryRecord & {
  metadata?: unknown;
  path?: unknown;
};

type LaboratoryManagedMediaProcessRecord = LaboratoryRecord & {
  analysisSettings?: unknown;
  analysisScope?: unknown;
  modules?: unknown;
};

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  metadata?: unknown;
  id?: unknown;
  status?: unknown;
};

type LaboratoryProcessArtifactRecord = LaboratoryRecord & {
  id?: unknown;
  label?: unknown;
  moduleId?: unknown;
  path?: unknown;
};

type LaboratoryProcessFindingRecord = LaboratoryRecord & {
  detail?: unknown;
  moduleId?: unknown;
  title?: unknown;
};

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

type LaboratoryManagedMediaUpdateEmitter = ((payload: LaboratoryRecord) => void) | null;

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
  generateProcessFramePreviewArtifact: (
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryManagedMediaTargetRecord,
    artifactBase: string,
    outputDir: string,
    moduleId: string,
    sampleWindowSeconds: number,
    tileCount: unknown,
    label?: string,
    filterGraph?: string | null
  ) => Promise<unknown>;
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
  generateProcessVisualTransformArtifact: (
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryManagedMediaTargetRecord,
    artifactBase: string,
    outputDir: string,
    moduleId: string,
    filterGraph: string,
    label: string,
    metadata?: LaboratoryRecord
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
  normalizeProcessFinding: (rawValue: unknown) => LaboratoryProcessFindingRecord;
  partitionVisualAnalysisModuleIds: (
    runtime: LaboratoryManagedMediaRuntime,
    moduleIds: string[]
  ) => LaboratoryRecord;
  resolveEnabledVisualAnalysisModuleIds: (
    runtime: LaboratoryManagedMediaRuntime,
    project: LaboratoryManagedMediaProjectRecord,
    sourceKind: string | null
  ) => string[];
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

  const {
    applyRoiScopeFilter,
    buildVisualFindingDetail,
    createMediaFinding,
    getAnalysisModuleSettings,
    getRevealFilterConfig,
    getSamplingTileCount,
    getSamplingWindowSeconds,
    getScopeCropFilter,
    getScopeReference,
    getSensitivityAdjustedLevel,
  } = createManagedMediaVisualHelpers({
    asNonEmptyString,
    createProcessFinding,
    normalizeProcessFinding,
    toRecord,
  });

  function getSourceKind(project: LaboratoryManagedMediaProjectRecord): string {
    return asNonEmptyString(toRecord(project.source)["kind"]) || "video";
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
    processRecord: LaboratoryManagedMediaProcessRecord,
    emitRuntimeUpdate: LaboratoryManagedMediaUpdateEmitter = null
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
          timestamp: new Date().toISOString(),
          message: "Intake preview artifact ready",
          detail: asNonEmptyString(metadataArtifact.label),
        },
        throttleWindow: "intake-module-batch",
      });
    }

    updateProcessModule(processRecord, "cleanup", {
      status: "ready",
      completedAt: new Date().toISOString(),
      summary:
        asNonEmptyString(toRecord(project.edit)["handoffMode"]) === "derived"
          ? "Derived handoff remained selected during the managed run."
          : "The original source remained selected during the managed run.",
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
      const structureModuleIds = toUnknownArray(visualPartitions["structure"])
        .map(asNonEmptyString)
        .filter((entry): entry is string => entry !== null);
      const roiScopedStructureSettings =
        structureModuleIds
          .map(function (visualModuleId) {
            return getAnalysisModuleSettings(processRecord, visualModuleId);
          })
          .find(function (settings) {
            return readBooleanSetting(settings, "roiOnly", false) === true;
          }) || null;
      const previewStructureSettings =
        roiScopedStructureSettings ||
        getAnalysisModuleSettings(processRecord, structureModuleIds[0] || "frame-consistency");
      const previewScopeFilter =
        readBooleanSetting(previewStructureSettings, "roiOnly", false) === true
          ? getScopeCropFilter(processRecord)
          : null;

      updateProcessModule(processRecord, "motion", {
        status: "running",
        startedAt: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
          message: "motion module started",
          detail: null,
        },
        throttleWindow: "motion-module-batch",
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
          getSamplingWindowSeconds(previewStructureSettings),
          getSamplingTileCount(previewStructureSettings),
          sourceKind === "image" ? "Visual Reference Frame" : "Structure Frame Preview",
          previewScopeFilter
        )
      );
      if (framePreview !== null) {
        artifacts.push(framePreview);
      }

      const videoProbe =
        sourceKind === "video"
          ? toVideoProbeRecord(
              await runVideoStructureProbe(runtime, project, requestId, jobId, target)
            )
          : toVideoProbeRecord({});
      const freezeCount = getProbeCount(videoProbe.freeze);
      const blackCount = getProbeCount(videoProbe.black);
      const structureArtifactIds =
        framePreview && typeof framePreview.id === "string" ? [framePreview.id] : [];
      structureModuleIds.forEach(function (visualModuleId) {
        const moduleSettings = getAnalysisModuleSettings(processRecord, visualModuleId);
        const descriptor = buildVisualFindingDetail(
          visualModuleId,
          freezeCount,
          blackCount,
          sourceKind
        );
        findings.push(
          createMediaFinding(processRecord, "motion", visualModuleId, {
            artifactIds: structureArtifactIds,
            detail: `${descriptor.detail} Sampling used ${readStringSetting(
              moduleSettings,
              "samplingDensity",
              "balanced"
            )} density with a ${String(getSamplingTileCount(moduleSettings))}-tile preview.`,
            evidenceCount:
              descriptor.level === "medium" ? Math.max(1, freezeCount + blackCount) : 1,
            level: getSensitivityAdjustedLevel(
              descriptor.level,
              moduleSettings,
              freezeCount + blackCount
            ),
            settingsUsed: {
              ...moduleSettings,
              roiOnly: readBooleanSetting(moduleSettings, "roiOnly", false),
              sampleWindowSeconds: getSamplingWindowSeconds(moduleSettings),
              tileCount: getSamplingTileCount(moduleSettings),
            },
            title: descriptor.title,
          })
        );
      });
      const motionFindings = findings.filter(function (entry) {
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
            timestamp: new Date().toISOString(),
            message: "motion preview artifact ready",
            detail: asNonEmptyString(framePreview.label),
          },
          throttleWindow: "motion-module-batch",
        });
      }
      if (motionFindings.length > 0) {
        const primaryMotionFinding = motionFindings[0];
        if (primaryMotionFinding) {
          emitRuntimeUpdate?.({
            kind: "live-finding",
            moduleId: "motion",
            message: "motion findings updated",
            detail:
              motionFindings.length > 1
                ? `${motionFindings.length} visual findings were aggregated for the motion window.`
                : asNonEmptyString(primaryMotionFinding.detail) ||
                  asNonEmptyString(primaryMotionFinding.title) ||
                  "Motion finding emitted.",
            finding: primaryMotionFinding,
            moduleTrace: {
              id: `motion-finding-${Date.now()}`,
              moduleId: "motion",
              stage: "process",
              status: "finding",
              timestamp: new Date().toISOString(),
              message: "motion findings updated",
              detail:
                motionFindings.length > 1
                  ? `${motionFindings.length} visual findings were aggregated for the motion window.`
                  : asNonEmptyString(primaryMotionFinding.detail) ||
                    asNonEmptyString(primaryMotionFinding.title) ||
                    "Motion finding emitted.",
            },
            throttleWindow: "motion-module-batch",
          });
        }
      }

      updateProcessModule(processRecord, "motion", {
        status: "ready",
        completedAt: new Date().toISOString(),
        summary:
          structureModuleIds.length > 0
            ? `${structureModuleIds.length} structural visual module(s) completed on the active target.`
            : "Structural visual checks finished for the active target.",
        artifactIds: collectArtifactIdsForModule(artifacts, "motion"),
      });
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId: "motion",
        message: "motion module completed",
        detail:
          structureModuleIds.length > 0
            ? `${structureModuleIds.length} structural visual module(s) completed on the active target.`
            : "Video structure checks finished for the active target.",
        moduleTrace: {
          id: `motion-completed-${Date.now()}`,
          moduleId: "motion",
          stage: "process",
          status: "ready",
          timestamp: new Date().toISOString(),
          message: "motion module completed",
          detail:
            structureModuleIds.length > 0
              ? `${structureModuleIds.length} structural visual module(s) completed on the active target.`
              : "Video structure checks finished for the active target.",
        },
        throttleWindow: "motion-module-batch",
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
      const revealModuleIds = toUnknownArray(visualPartitions["reveal"])
        .map(asNonEmptyString)
        .filter((entry): entry is string => entry !== null);

      updateProcessModule(processRecord, "visual-signal", {
        status: "running",
        startedAt: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
          message: "visual-signal module started",
          detail: null,
        },
        throttleWindow: "visual-signal-module-batch",
      });

      const revealArtifacts: LaboratoryProcessArtifactRecord[] = [];
      await revealModuleIds.reduce<Promise<void>>(async (previous, visualModuleId) => {
        await previous;
        if (!visualModuleId) {
          return;
        }
        const moduleSettings = getAnalysisModuleSettings(processRecord, visualModuleId);
        const filterConfig = getRevealFilterConfig(visualModuleId, moduleSettings);
        const filterGraph = applyRoiScopeFilter(
          processRecord,
          moduleSettings,
          filterConfig.filterGraph
        );
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
            filterGraph,
            filterConfig.label,
            {
              scopeReference: getScopeReference(processRecord),
              sourceModule: visualModuleId,
              sourceKind,
              settingsUsed: moduleSettings,
            }
          )
        );
        if (transformArtifact !== null) {
          revealArtifacts.push(transformArtifact);
          artifacts.push(transformArtifact);
        }
      }, Promise.resolve());

      const comparisonVariants: LaboratoryRecord[] = [];
      revealModuleIds.forEach(function (visualModuleId, index) {
        const moduleSettings = getAnalysisModuleSettings(processRecord, visualModuleId);
        const filterConfig = getRevealFilterConfig(visualModuleId, moduleSettings);
        const transformArtifact = revealArtifacts[index] || revealArtifacts[0] || null;
        const artifactIds =
          transformArtifact && typeof transformArtifact.id === "string"
            ? [transformArtifact.id]
            : [];
        const comparisonVariant = {
          id: `visual-variant-${visualModuleId}`,
          moduleId: "visual-signal",
          sourceModule: visualModuleId,
          label: filterConfig.label,
          settingsUsed: moduleSettings,
          artifactId: transformArtifact ? asNonEmptyString(transformArtifact.id) : null,
          artifactPath: transformArtifact ? asNonEmptyString(transformArtifact.path) : null,
          active: index === 0,
        };
        comparisonVariants.push(comparisonVariant);
        findings.push(
          createMediaFinding(processRecord, "visual-signal", visualModuleId, {
            artifactIds,
            detail: `${filterConfig.label} generated a reveal-oriented preview variant for the selected scope.`,
            title: `${filterConfig.label} variant generated`,
          })
        );
      });

      if (comparisonVariants.length > 0) {
        emitRuntimeUpdate?.({
          kind: "module-artifact",
          moduleId: "visual-signal",
          message: "visual signal comparison variants ready",
          detail:
            comparisonVariants.length > 1
              ? `${comparisonVariants.length} reveal variants were batched for the current scope.`
              : asNonEmptyString(comparisonVariants[0]?.["label"]) ||
                "Visual comparison variant ready",
          artifact: revealArtifacts[0] || undefined,
          comparisonVariant: comparisonVariants[0] || undefined,
          comparisonVariants,
          throttleWindow: "visual-signal-module-batch",
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
            active: true,
          },
          moduleTrace: {
            id: `visual-signal-preview-${Date.now()}`,
            moduleId: "visual-signal",
            stage: "process",
            status: "preview-ready",
            timestamp: new Date().toISOString(),
            message: "visual signal preview artifact ready",
            detail: asNonEmptyString(revealArtifacts[0].label),
          },
          throttleWindow: "visual-signal-module-batch",
        });
      }

      const revealFindings = findings.filter(function (entry) {
        return asNonEmptyString(entry.moduleId) === "visual-signal";
      });
      if (revealFindings.length > 0) {
        const primaryRevealFinding = revealFindings[0];
        if (primaryRevealFinding) {
          emitRuntimeUpdate?.({
            kind: "live-finding",
            moduleId: "visual-signal",
            message: "visual-signal findings updated",
            detail:
              revealFindings.length > 1
                ? `${revealFindings.length} reveal findings were aggregated for the current preview batch.`
                : asNonEmptyString(primaryRevealFinding.detail) ||
                  asNonEmptyString(primaryRevealFinding.title) ||
                  "Visual reveal finding emitted.",
            finding: primaryRevealFinding,
            moduleTrace: {
              id: `visual-signal-finding-${Date.now()}`,
              moduleId: "visual-signal",
              stage: "process",
              status: "finding",
              timestamp: new Date().toISOString(),
              message: "visual-signal findings updated",
              detail:
                revealFindings.length > 1
                  ? `${revealFindings.length} reveal findings were aggregated for the current preview batch.`
                  : asNonEmptyString(primaryRevealFinding.detail) ||
                    asNonEmptyString(primaryRevealFinding.title) ||
                    "Visual reveal finding emitted.",
            },
            throttleWindow: "visual-signal-module-batch",
          });
        }
      }

      updateProcessModule(processRecord, "visual-signal", {
        status: "ready",
        completedAt: new Date().toISOString(),
        summary:
          revealModuleIds.length > 0
            ? `${revealModuleIds.length} visual reveal module(s) generated preview variants.`
            : "Visual signal amplification checks finished for the active target.",
        artifactIds: collectArtifactIdsForModule(artifacts, "visual-signal"),
      });
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId: "visual-signal",
        message: "visual-signal module completed",
        detail:
          revealModuleIds.length > 0
            ? `${revealModuleIds.length} visual reveal module(s) generated preview variants.`
            : "Visual signal amplification checks finished for the active target.",
        moduleTrace: {
          id: `visual-signal-completed-${Date.now()}`,
          moduleId: "visual-signal",
          stage: "process",
          status: "ready",
          timestamp: new Date().toISOString(),
          message: "visual-signal module completed",
          detail:
            revealModuleIds.length > 0
              ? `${revealModuleIds.length} visual reveal module(s) generated preview variants.`
              : "Visual signal amplification checks finished for the active target.",
        },
        throttleWindow: "visual-signal-module-batch",
      });
    }

    if (getModuleStatus(processRecord, "audio") === "queued") {
      updateProcessModule(processRecord, "audio", {
        status: "running",
        startedAt: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
          message: "audio module started",
          detail: null,
        },
        throttleWindow: "audio-module-batch",
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
            timestamp: new Date().toISOString(),
            message: "audio preview artifact ready",
            detail: asNonEmptyString(spectrogram.label),
          },
          throttleWindow: "audio-module-batch",
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
      const audioFindings = findings.filter(function (entry) {
        return asNonEmptyString(entry.moduleId) === "audio";
      });
      if (audioFindings.length > 0) {
        const primaryAudioFinding = audioFindings[0];
        if (primaryAudioFinding) {
          emitRuntimeUpdate?.({
            kind: "live-finding",
            moduleId: "audio",
            message: "audio findings updated",
            detail:
              audioFindings.length > 1
                ? `${audioFindings.length} audio findings were aggregated for the current sweep.`
                : asNonEmptyString(primaryAudioFinding.detail) ||
                  asNonEmptyString(primaryAudioFinding.title) ||
                  "Audio finding emitted.",
            finding: primaryAudioFinding,
            moduleTrace: {
              id: `audio-finding-${Date.now()}`,
              moduleId: "audio",
              stage: "process",
              status: "finding",
              timestamp: new Date().toISOString(),
              message: "audio findings updated",
              detail:
                audioFindings.length > 1
                  ? `${audioFindings.length} audio findings were aggregated for the current sweep.`
                  : asNonEmptyString(primaryAudioFinding.detail) ||
                    asNonEmptyString(primaryAudioFinding.title) ||
                    "Audio finding emitted.",
            },
            throttleWindow: "audio-module-batch",
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
            timestamp: new Date().toISOString(),
            message: "audio module warning",
            detail: warnings.join(" | "),
          },
          throttleWindow: "audio-module-batch",
        });
      }

      updateProcessModule(processRecord, "audio", {
        status: "ready",
        completedAt: new Date().toISOString(),
        summary: "Audio continuity checks finished for the active target.",
        artifactIds: collectArtifactIdsForModule(artifacts, "audio"),
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
          timestamp: new Date().toISOString(),
          message: "audio module completed",
          detail: "Audio continuity checks finished for the active target.",
        },
        throttleWindow: "audio-module-batch",
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
