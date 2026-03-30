type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProjectRecord = LaboratoryRecord & {
  edit?: unknown;
  name?: unknown;
  profile?: unknown;
  source?: unknown;
  subtitleAnalysis?: unknown;
};

type LaboratoryProjectProfileRecord = LaboratoryRecord & {
  readiness?: unknown;
};

type LaboratoryProjectSourceRecord = LaboratoryRecord & {
  kind?: unknown;
};

type LaboratoryProjectEditRecord = LaboratoryRecord & {
  handoffMode?: unknown;
};

type LaboratoryProfileReadinessRecord = LaboratoryRecord & {
  enabledLaneIds?: unknown;
};

type LaboratorySubtitleStateRecord = LaboratoryRecord & {
  analysis?: unknown;
};

type LaboratorySubtitleAnalysisRecord = LaboratoryRecord & {
  sourceSelection?: unknown;
};

type LaboratorySubtitleEntryRecord = LaboratoryRecord & {
  fileName?: unknown;
  id?: unknown;
  language?: unknown;
  metadata?: unknown;
  path?: unknown;
};

type LaboratoryProcessTargetRecord = LaboratoryRecord & {
  path?: unknown;
};

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  id?: unknown;
  status?: unknown;
};

type LaboratoryProfileModelSummaryEntry = LaboratoryRecord & {
  ready?: unknown;
  selected?: unknown;
};

type LaboratoryProcessSpeechAvailability = {
  model: LaboratoryProfileModelSummaryEntry | null;
  ready: boolean;
};

type LaboratoryProcessTargetingRuntimeDeps = {
  audioFeatureId: string;
  asNonEmptyString: (value: unknown) => string | null;
  buildProfileModelSummary: (
    runtime: LaboratoryRecord,
    project: LaboratoryProjectRecord
  ) => unknown[];
  getActiveSubtitleEntry: (
    project: LaboratoryProjectRecord
  ) => LaboratorySubtitleEntryRecord | null;
  getSubtitleMimeType: (fileName: string) => string | null;
  getSubtitleSelectedEntries: (project: LaboratoryProjectRecord) => LaboratorySubtitleEntryRecord[];
  normalizeProcessModule: (rawValue: unknown) => LaboratoryProcessModuleRecord;
  normalizeSubtitleAnalysisState: (
    rawValue: unknown,
    runtime: LaboratoryRecord
  ) => LaboratorySubtitleStateRecord;
  resolveAudioFeatureTarget: (project: LaboratoryProjectRecord) => LaboratoryProcessTargetRecord;
  resolveProfileTarget: (project: LaboratoryProjectRecord) => LaboratoryProcessTargetRecord;
  subtitleFeatureId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryProcessTargetingRuntime(
  deps: LaboratoryProcessTargetingRuntimeDeps
) {
  const {
    audioFeatureId,
    subtitleFeatureId,
    asNonEmptyString,
    buildProfileModelSummary,
    getActiveSubtitleEntry,
    getSubtitleMimeType,
    getSubtitleSelectedEntries,
    normalizeProcessModule,
    normalizeSubtitleAnalysisState,
    resolveAudioFeatureTarget,
    resolveProfileTarget,
    toRecord,
  } = deps;

  function toProfileRecord(value: unknown): LaboratoryProjectProfileRecord {
    return toRecord(value);
  }

  function toSourceRecord(value: unknown): LaboratoryProjectSourceRecord {
    return toRecord(value);
  }

  function toEditRecord(value: unknown): LaboratoryProjectEditRecord {
    return toRecord(value);
  }

  function toReadinessRecord(value: unknown): LaboratoryProfileReadinessRecord {
    return toRecord(value);
  }

  function toSubtitleAnalysisRecord(value: unknown): LaboratorySubtitleAnalysisRecord {
    return toRecord(value);
  }

  function toSubtitleEntryRecord(value: unknown): LaboratorySubtitleEntryRecord {
    return toRecord(value);
  }

  function toProcessTargetRecord(value: unknown): LaboratoryProcessTargetRecord {
    return toRecord(value);
  }

  function toModelSummaryEntry(value: unknown): LaboratoryProfileModelSummaryEntry {
    return toRecord(value);
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return asNonEmptyString(entry);
      })
      .filter((entry): entry is string => entry !== null);
  }

  function resolveProcessTarget(project: LaboratoryProjectRecord, featureId: string | null) {
    if (featureId === audioFeatureId) {
      return resolveAudioFeatureTarget(project);
    }

    if (featureId === subtitleFeatureId) {
      const subtitleState = normalizeSubtitleAnalysisState(project.subtitleAnalysis, {});
      const analysis = toSubtitleAnalysisRecord(subtitleState.analysis);
      const selectedEntries = getSubtitleSelectedEntries(project).map(toSubtitleEntryRecord);
      const activeEntry = selectedEntries[0] || getActiveSubtitleEntry(project);

      return {
        requestedMode: asNonEmptyString(analysis.sourceSelection) || "active-entry",
        mode: selectedEntries.length > 1 ? "batch" : "entry",
        outputId: null,
        path: activeEntry ? activeEntry.path : null,
        fileName: activeEntry ? activeEntry.fileName : null,
        mimeType:
          activeEntry && typeof activeEntry.fileName === "string"
            ? getSubtitleMimeType(activeEntry.fileName)
            : null,
        metadata: activeEntry ? toRecord(activeEntry.metadata) : null,
        signature: selectedEntries
          .map(function (entry) {
            return `${String(entry.id || "")}:${String(entry.path || entry.fileName || "")}`;
          })
          .join("|"),
        label:
          selectedEntries.length > 1
            ? `${selectedEntries.length} subtitle files`
            : activeEntry
              ? asNonEmptyString(activeEntry.fileName) ||
                asNonEmptyString(project.name) ||
                "Project"
              : asNonEmptyString(project.name) || "Project",
        entries: selectedEntries,
        usingFallback: false,
        reason: null,
      };
    }

    return resolveProfileTarget(project);
  }

  function createQueuedProcessModule(
    id: string,
    labelKey: string,
    title: string,
    summary: string | null
  ) {
    return normalizeProcessModule({
      id,
      labelKey,
      title,
      status: "queued",
      percent: 0,
      summary: summary || "",
      warnings: [],
      artifactIds: [],
      findingIds: [],
    });
  }

  function buildMediaProcessModules(
    _runtime: LaboratoryRecord,
    project: LaboratoryProjectRecord,
    target: LaboratoryProcessTargetRecord
  ) {
    const readiness = toReadinessRecord(toProfileRecord(project.profile).readiness);
    const enabledLaneIds = toStringArray(readiness.enabledLaneIds);
    const sourceKind = asNonEmptyString(toSourceRecord(project.source).kind) || "video";
    const edit = toEditRecord(project.edit);
    const targetRecord = toProcessTargetRecord(target);
    const modules: LaboratoryProcessModuleRecord[] = [];

    modules.push(
      createQueuedProcessModule(
        "intake",
        "mediaAnalysis.process.steps.intake",
        "Source Intake",
        targetRecord.path
          ? "Target asset is pinned and ready for the managed run."
          : "Prepare a source before starting."
      )
    );
    modules.push(
      createQueuedProcessModule(
        "cleanup",
        "mediaAnalysis.process.steps.cleanup",
        "Frame Cleanup",
        asNonEmptyString(edit.handoffMode) === "derived"
          ? "Using the selected derived output as the active analysis handoff."
          : "Using the original source as the active analysis handoff."
      )
    );
    modules.push(
      normalizeProcessModule({
        ...createQueuedProcessModule(
          "motion",
          "mediaAnalysis.process.steps.motion",
          "Motion Analysis",
          ""
        ),
        status:
          sourceKind === "video" && enabledLaneIds.includes("visual-tamper") ? "queued" : "skipped",
        summary:
          sourceKind === "video" && enabledLaneIds.includes("visual-tamper")
            ? "Visual tamper checks will run on the pinned target."
            : "Motion analysis is not active for this target.",
      })
    );
    modules.push(
      normalizeProcessModule({
        ...createQueuedProcessModule(
          "audio",
          "mediaAnalysis.process.steps.audio",
          "Audio Sweep",
          ""
        ),
        status:
          (sourceKind === "video" || sourceKind === "audio") &&
          (enabledLaneIds.includes("audio-tamper") || enabledLaneIds.includes("speech-overlay"))
            ? "queued"
            : "skipped",
        summary:
          sourceKind === "video" || sourceKind === "audio"
            ? "Audio continuity, loudness, and optional transcript checks will run."
            : "Audio sweep is not applicable to this target.",
      })
    );
    modules.push(
      createQueuedProcessModule(
        "report",
        "mediaAnalysis.process.steps.report",
        "Report Synthesis",
        "The managed run will persist a report-ready summary for the final stage."
      )
    );

    return modules;
  }

  function buildProcessSpeechAvailability(
    runtime: LaboratoryRecord,
    project: LaboratoryProjectRecord
  ): LaboratoryProcessSpeechAvailability {
    const summaries = buildProfileModelSummary(runtime, project).map(toModelSummaryEntry);
    const selected =
      summaries.find(function (entry) {
        return entry.selected === true;
      }) || null;
    const readyModel =
      selected && selected.ready === true
        ? selected
        : summaries.find(function (entry) {
            return entry.ready === true;
          }) || null;
    return {
      ready: readyModel !== null,
      model: readyModel,
    };
  }

  return {
    buildMediaProcessModules,
    buildProcessSpeechAvailability,
    resolveProcessTarget,
  };
}
