import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryNestedRecord = Record<string, unknown>;

type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];
type LaboratoryUiDraftState = LaboratoryUiState["ui"]["localDrafts"];
type LaboratoryUiSubtitleDraftState = LaboratoryUiState["ui"]["localSubtitleDrafts"];

type LaboratoryProjectRecord = LaboratoryRecord & {
  id?: unknown;
  updatedAt?: unknown;
};

type LaboratoryProjectSourceRecord = LaboratoryRecord & {
  drafts?: unknown;
};

type LaboratorySubtitleWorkspaceRecord = LaboratoryRecord & {
  drafts?: unknown;
};

type LaboratoryFocusRegionRecord = LaboratoryRecord & {
  cropNormalized?: unknown;
};

export type LaboratoryDraftStageJobRecord = LaboratoryRecord & {
  action?: unknown;
  featureStage?: unknown;
  jobId?: unknown;
  requestId?: unknown;
};

type LaboratoryUiDraftRuntimeDeps = {
  deepClone: <T>(value: T) => T;
  getActiveProject: () => LaboratoryProjectRecord | null;
  getEditPresets: () => LaboratoryRecord;
  getProjectEdit: () => LaboratoryRecord;
  getProjectSource: () => LaboratoryProjectSourceRecord;
  getSourceSnapshot: () => LaboratoryRecord & { activeProjectId?: unknown };
  getSubtitleEditState: () => LaboratoryRecord;
  getSubtitleWorkspace: () => LaboratorySubtitleWorkspaceRecord;
  isSubtitleAnalysisFeature: () => boolean;
  state: LaboratoryUiState;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryUiDraftRuntime(deps: LaboratoryUiDraftRuntimeDeps) {
  const {
    deepClone,
    getActiveProject,
    getEditPresets,
    getProjectEdit,
    getProjectSource,
    getSourceSnapshot,
    getSubtitleEditState,
    getSubtitleWorkspace,
    isSubtitleAnalysisFeature,
    state,
    toRecord,
  } = deps;

  function asRecord(value: unknown): LaboratoryRecord {
    return toRecord(value);
  }

  function asNonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }

  function asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function isNestedRecord(value: unknown): value is LaboratoryNestedRecord {
    return value !== null && typeof value === "object" && Array.isArray(value) === false;
  }

  function toJobRecord(value: unknown): LaboratoryDraftStageJobRecord {
    return asRecord(value);
  }

  function toProjectRecord(value: unknown): LaboratoryProjectRecord {
    return asRecord(value);
  }

  function toProjectSourceRecord(value: unknown): LaboratoryProjectSourceRecord {
    return asRecord(value);
  }

  function toSubtitleWorkspaceRecord(value: unknown): LaboratorySubtitleWorkspaceRecord {
    return asRecord(value);
  }

  function toFocusRegionRecord(value: unknown): LaboratoryFocusRegionRecord {
    return asRecord(value);
  }

  function getActiveProjectId() {
    return getSourceSnapshot().activeProjectId;
  }

  function createSubtitleLocalDraftState(drafts: LaboratoryRecord): LaboratoryUiSubtitleDraftState {
    return {
      durationMaxSeconds: asNumber(drafts["durationMaxSeconds"]),
      durationMinSeconds: asNumber(drafts["durationMinSeconds"]),
      limitCount: asNumber(drafts["limitCount"]),
      liveMode: asNonEmptyString(drafts["liveMode"]) || "all",
      playlistItems: typeof drafts["playlistItems"] === "string" ? drafts["playlistItems"] : "",
      publishedAfter: typeof drafts["publishedAfter"] === "string" ? drafts["publishedAfter"] : "",
      publishedBefore:
        typeof drafts["publishedBefore"] === "string" ? drafts["publishedBefore"] : "",
      shortsMode: asNonEmptyString(drafts["shortsMode"]) || "all",
      subtitleMode: asNonEmptyString(drafts["subtitleMode"]) || "manual",
      subtitlesLang: asNonEmptyString(drafts["subtitlesLang"]) || "all",
      titleExclude: typeof drafts["titleExclude"] === "string" ? drafts["titleExclude"] : "",
      titleInclude: typeof drafts["titleInclude"] === "string" ? drafts["titleInclude"] : "",
      urlInput: typeof drafts["urlInput"] === "string" ? drafts["urlInput"] : "",
      weekdays: typeof drafts["weekdays"] === "string" ? drafts["weekdays"] : "",
      youtubeUrl: typeof drafts["youtubeUrl"] === "string" ? drafts["youtubeUrl"] : "",
    };
  }

  function createLocalDraftState(drafts: LaboratoryRecord): LaboratoryUiDraftState {
    return {
      fileNameHint: typeof drafts["fileNameHint"] === "string" ? drafts["fileNameHint"] : "",
      urlInput: typeof drafts["urlInput"] === "string" ? drafts["urlInput"] : "",
      youtubeCustom: { ...asRecord(drafts["youtubeCustom"]) },
      youtubePreset: asNonEmptyString(drafts["youtubePreset"]),
      youtubeUrl: typeof drafts["youtubeUrl"] === "string" ? drafts["youtubeUrl"] : "",
    };
  }

  function sortStageJobs(
    entries: LaboratoryDraftStageJobRecord[],
    actionOrder: Record<string, number>
  ) {
    return entries.sort(function (left, right) {
      const leftRankValue = actionOrder[asNonEmptyString(left.action) || ""];
      const rightRankValue = actionOrder[asNonEmptyString(right.action) || ""];
      const leftRank = typeof leftRankValue === "number" ? leftRankValue : 99;
      const rightRank = typeof rightRankValue === "number" ? rightRankValue : 99;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftId =
        asNonEmptyString(left.jobId) ||
        asNonEmptyString(left.requestId) ||
        asNonEmptyString(left.action) ||
        "";
      const rightId =
        asNonEmptyString(right.jobId) ||
        asNonEmptyString(right.requestId) ||
        asNonEmptyString(right.action) ||
        "";
      return leftId.localeCompare(rightId);
    });
  }

  function collectEditStageJobs(projectJobs: unknown[]) {
    const editJobs = Array.isArray(projectJobs)
      ? projectJobs.map(toJobRecord).filter(function (entry) {
          return (
            entry.featureStage === "edit" ||
            (asNonEmptyString(entry.action) || "").startsWith("edit-")
          );
        })
      : [];
    return sortStageJobs(editJobs, {
      "edit-preview": 0,
      "edit-apply": 1,
    });
  }

  function collectProfileStageJobs(projectJobs: unknown[]) {
    const profileJobs = Array.isArray(projectJobs)
      ? projectJobs.map(toJobRecord).filter(function (entry) {
          return (
            entry.featureStage === "profile" ||
            (asNonEmptyString(entry.action) || "").startsWith("profile-")
          );
        })
      : [];
    return sortStageJobs(profileJobs, {
      "profile-run-preflight": 0,
      "profile-model-install": 1,
      "profile-model-remove": 2,
    });
  }

  function collectProcessStageJobs(projectJobs: unknown[]) {
    return (Array.isArray(projectJobs) ? projectJobs : [])
      .map(toJobRecord)
      .filter(function (entry) {
        return (
          entry.featureStage === "process" ||
          (asNonEmptyString(entry.action) || "").includes("process")
        );
      })
      .sort(function (left, right) {
        const leftId =
          asNonEmptyString(left.jobId) ||
          asNonEmptyString(left.requestId) ||
          asNonEmptyString(left.action) ||
          "";
        const rightId =
          asNonEmptyString(right.jobId) ||
          asNonEmptyString(right.requestId) ||
          asNonEmptyString(right.action) ||
          "";
        return leftId.localeCompare(rightId);
      });
  }

  function collectReportStageJobs(projectJobs: unknown[]) {
    return (Array.isArray(projectJobs) ? projectJobs : [])
      .map(toJobRecord)
      .filter(function (entry) {
        return (
          entry.featureStage === "report" ||
          (asNonEmptyString(entry.action) || "").includes("report")
        );
      })
      .sort(function (left, right) {
        const leftId =
          asNonEmptyString(left.jobId) ||
          asNonEmptyString(left.requestId) ||
          asNonEmptyString(left.action) ||
          "";
        const rightId =
          asNonEmptyString(right.jobId) ||
          asNonEmptyString(right.requestId) ||
          asNonEmptyString(right.action) ||
          "";
        return leftId.localeCompare(rightId);
      });
  }

  function getCurrentDrafts() {
    if (isSubtitleAnalysisFeature()) {
      const drafts = asRecord(toSubtitleWorkspaceRecord(getSubtitleWorkspace()).drafts);
      const activeProjectId = asNonEmptyString(getActiveProjectId());

      if (state.ui.localSubtitleDraftProjectId !== activeProjectId) {
        state.ui.localSubtitleDraftProjectId = activeProjectId;
        state.ui.localSubtitleDrafts = createSubtitleLocalDraftState(drafts);
      }

      return {
        ...drafts,
        ...state.ui.localSubtitleDrafts,
      };
    }

    const source = toProjectSourceRecord(getProjectSource());
    const drafts = asRecord(source.drafts);
    const activeProjectId = asNonEmptyString(getActiveProjectId());

    if (state.ui.localDraftProjectId !== activeProjectId) {
      state.ui.localDraftProjectId = activeProjectId;
      state.ui.localDrafts = createLocalDraftState(drafts);
    }

    return {
      ...drafts,
      ...state.ui.localDrafts,
      youtubeCustom: {
        ...asRecord(drafts["youtubeCustom"]),
        ...asRecord(state.ui.localDrafts.youtubeCustom),
      },
    };
  }

  function getCurrentEditDraft() {
    if (isSubtitleAnalysisFeature()) {
      const project = toProjectRecord(getActiveProject());
      const subtitleEdit = getSubtitleEditState();
      const projectId = asNonEmptyString(project.id);
      const projectUpdatedAt = asNonEmptyString(project.updatedAt);

      if (
        state.ui.localSubtitleEditProjectId !== projectId ||
        state.ui.localSubtitleEditUpdatedAt !== projectUpdatedAt ||
        state.ui.localSubtitleEditDraft === null
      ) {
        state.ui.localSubtitleEditProjectId = projectId;
        state.ui.localSubtitleEditUpdatedAt = projectUpdatedAt;
        state.ui.localSubtitleEditDraft = deepClone(subtitleEdit);
      }

      return asRecord(state.ui.localSubtitleEditDraft);
    }

    const project = toProjectRecord(getActiveProject());
    const projectEdit = getProjectEdit();
    const projectId = asNonEmptyString(project.id);
    const projectUpdatedAt = asNonEmptyString(project.updatedAt);

    if (
      state.ui.localEditProjectId !== projectId ||
      state.ui.localEditUpdatedAt !== projectUpdatedAt ||
      state.ui.localEditDraft === null
    ) {
      state.ui.localEditProjectId = projectId;
      state.ui.localEditUpdatedAt = projectUpdatedAt;
      state.ui.localEditDraft = deepClone(projectEdit);
    }

    return asRecord(state.ui.localEditDraft);
  }

  function setNestedValue(target: LaboratoryNestedRecord, path: string, value: unknown) {
    const segments = String(path || "")
      .split(".")
      .filter(Boolean);
    if (segments.length === 0) {
      return;
    }

    let current = target;
    for (const segment of segments.slice(0, -1)) {
      const nextValue = current[segment];
      if (!isNestedRecord(nextValue)) {
        current[segment] = {};
      }
      current = current[segment] as LaboratoryNestedRecord;
    }

    const finalSegment = segments[segments.length - 1];
    if (finalSegment !== undefined) {
      current[finalSegment] = value;
    }
  }

  function buildNestedPatch(path: string, value: unknown) {
    const patch: LaboratoryNestedRecord = {};
    setNestedValue(patch, path, value);
    return patch;
  }

  function syncLocalEditField(path: string, value: unknown) {
    if (isSubtitleAnalysisFeature()) {
      const draft = getCurrentEditDraft();
      setNestedValue(draft, path, value);
      state.ui.localSubtitleEditDraft = draft;
      return;
    }

    const draft = getCurrentEditDraft();
    setNestedValue(draft, path, value);

    if (path === "recipe.common.focusRegionId") {
      const focusRegions = asRecord(getEditPresets()["focusRegions"]);
      const focusRegion = toFocusRegionRecord(focusRegions[String(value || "")]);
      const cropNormalized = asRecord(focusRegion["cropNormalized"]);
      if (Object.keys(cropNormalized).length > 0) {
        const recipe = asRecord(draft["recipe"]);
        const common = asRecord(recipe["common"]);
        common["cropNormalized"] = deepClone(cropNormalized);
        recipe["common"] = common;
        draft["recipe"] = recipe;
      }
    }

    state.ui.localEditDraft = draft;
  }

  function buildCurrentDraftPayload() {
    if (isSubtitleAnalysisFeature()) {
      return {
        durationMaxSeconds: state.ui.localSubtitleDrafts.durationMaxSeconds,
        durationMinSeconds: state.ui.localSubtitleDrafts.durationMinSeconds,
        limitCount: state.ui.localSubtitleDrafts.limitCount,
        liveMode: state.ui.localSubtitleDrafts.liveMode,
        playlistItems: state.ui.localSubtitleDrafts.playlistItems,
        publishedAfter: state.ui.localSubtitleDrafts.publishedAfter,
        publishedBefore: state.ui.localSubtitleDrafts.publishedBefore,
        shortsMode: state.ui.localSubtitleDrafts.shortsMode,
        subtitleMode: state.ui.localSubtitleDrafts.subtitleMode,
        subtitlesLang: state.ui.localSubtitleDrafts.subtitlesLang,
        titleExclude: state.ui.localSubtitleDrafts.titleExclude,
        titleInclude: state.ui.localSubtitleDrafts.titleInclude,
        urlInput: state.ui.localSubtitleDrafts.urlInput,
        weekdays: state.ui.localSubtitleDrafts.weekdays,
        youtubeUrl: state.ui.localSubtitleDrafts.youtubeUrl,
      };
    }

    return {
      fileNameHint: state.ui.localDrafts.fileNameHint,
      urlInput: state.ui.localDrafts.urlInput,
      youtubeCustom: { ...asRecord(state.ui.localDrafts.youtubeCustom) },
      youtubePreset: state.ui.localDrafts.youtubePreset,
      youtubeUrl: state.ui.localDrafts.youtubeUrl,
    };
  }

  return {
    buildCurrentDraftPayload,
    buildNestedPatch,
    collectEditStageJobs,
    collectProcessStageJobs,
    collectProfileStageJobs,
    collectReportStageJobs,
    getCurrentDrafts,
    getCurrentEditDraft,
    syncLocalEditField,
  };
}
