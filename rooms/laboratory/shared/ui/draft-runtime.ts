type LaboratoryRecord = Record<string, unknown>;

export function createLaboratoryUiDraftRuntime(deps: any) {
  const state = deps.state;
  const toRecord = deps.toRecord;
  const deepClone = deps.deepClone;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getProjectSource = deps.getProjectSource;
  const getSubtitleWorkspace = deps.getSubtitleWorkspace;
  const getActiveProject = deps.getActiveProject;
  const getProjectEdit = deps.getProjectEdit;
  const getSubtitleEditState = deps.getSubtitleEditState;
  const getEditPresets = deps.getEditPresets;
  const asRecord = function asRecord(value: unknown): LaboratoryRecord {
    return toRecord(value) as LaboratoryRecord;
  };

  function sortStageJobs(entries: any[], actionOrder: Record<string, number>) {
    return entries.sort(function (left: any, right: any) {
      const leftRankValue = actionOrder[String(left["action"] || "")];
      const rightRankValue = actionOrder[String(right["action"] || "")];
      const leftRank = typeof leftRankValue === "number" ? leftRankValue : 99;
      const rightRank = typeof rightRankValue === "number" ? rightRankValue : 99;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftId = String(left["jobId"] || left["requestId"] || left["action"] || "");
      const rightId = String(right["jobId"] || right["requestId"] || right["action"] || "");
      return leftId.localeCompare(rightId);
    });
  }

  function collectEditStageJobs(projectJobs: unknown[]) {
    const editJobs = Array.isArray(projectJobs)
      ? projectJobs
          .map(asRecord)
          .filter(function (entry: LaboratoryRecord) {
            return entry["featureStage"] === "edit" || String(entry["action"] || "").startsWith("edit-");
          })
      : [];
    return sortStageJobs(editJobs, {
      "edit-preview": 0,
      "edit-apply": 1,
    });
  }

  function collectProfileStageJobs(projectJobs: unknown[]) {
    const profileJobs = Array.isArray(projectJobs)
      ? projectJobs
          .map(asRecord)
          .filter(function (entry: LaboratoryRecord) {
            return (
                entry["featureStage"] === "profile" || String(entry["action"] || "").startsWith("profile-")
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
      .map(asRecord)
      .filter(function (entry: LaboratoryRecord) {
        return entry["featureStage"] === "process" || String(entry["action"] || "").includes("process");
      })
      .sort(function (left: LaboratoryRecord, right: LaboratoryRecord) {
        return String(left["jobId"] || left["requestId"] || left["action"] || "").localeCompare(
          String(right["jobId"] || right["requestId"] || right["action"] || "")
        );
      });
  }

  function collectReportStageJobs(projectJobs: unknown[]) {
    return (Array.isArray(projectJobs) ? projectJobs : [])
      .map(asRecord)
      .filter(function (entry: LaboratoryRecord) {
        return entry["featureStage"] === "report" || String(entry["action"] || "").includes("report");
      })
      .sort(function (left: LaboratoryRecord, right: LaboratoryRecord) {
        return String(left["jobId"] || left["requestId"] || left["action"] || "").localeCompare(
          String(right["jobId"] || right["requestId"] || right["action"] || "")
        );
      });
  }

  function getCurrentDrafts() {
    if (isSubtitleAnalysisFeature()) {
      const drafts = toRecord(getSubtitleWorkspace().drafts);

      if (state.ui.localSubtitleDraftProjectId !== getSourceSnapshot().activeProjectId) {
        state.ui.localSubtitleDraftProjectId = getSourceSnapshot().activeProjectId;
        state.ui.localSubtitleDrafts = {
          urlInput: typeof drafts.urlInput === "string" ? drafts.urlInput : "",
          youtubeUrl: typeof drafts.youtubeUrl === "string" ? drafts.youtubeUrl : "",
          subtitleMode:
            typeof drafts.subtitleMode === "string" && drafts.subtitleMode.trim() !== ""
              ? drafts.subtitleMode
              : "manual",
          subtitlesLang:
            typeof drafts.subtitlesLang === "string" && drafts.subtitlesLang.trim() !== ""
              ? drafts.subtitlesLang
              : "all",
          publishedAfter: typeof drafts.publishedAfter === "string" ? drafts.publishedAfter : "",
          publishedBefore: typeof drafts.publishedBefore === "string" ? drafts.publishedBefore : "",
          weekdays: typeof drafts.weekdays === "string" ? drafts.weekdays : "",
          durationMinSeconds:
            typeof drafts.durationMinSeconds === "number" ? drafts.durationMinSeconds : null,
          durationMaxSeconds:
            typeof drafts.durationMaxSeconds === "number" ? drafts.durationMaxSeconds : null,
          shortsMode:
            typeof drafts.shortsMode === "string" && drafts.shortsMode.trim() !== ""
              ? drafts.shortsMode
              : "all",
          liveMode:
            typeof drafts.liveMode === "string" && drafts.liveMode.trim() !== ""
              ? drafts.liveMode
              : "all",
          titleInclude: typeof drafts.titleInclude === "string" ? drafts.titleInclude : "",
          titleExclude: typeof drafts.titleExclude === "string" ? drafts.titleExclude : "",
          playlistItems: typeof drafts.playlistItems === "string" ? drafts.playlistItems : "",
          limitCount: typeof drafts.limitCount === "number" ? drafts.limitCount : null,
        };
      }

      return {
        ...drafts,
        ...state.ui.localSubtitleDrafts,
      };
    }

    const source = getProjectSource();
    const drafts = toRecord(source.drafts);

    if (state.ui.localDraftProjectId !== getSourceSnapshot().activeProjectId) {
      state.ui.localDraftProjectId = getSourceSnapshot().activeProjectId;
      state.ui.localDrafts = {
        urlInput: typeof drafts.urlInput === "string" ? drafts.urlInput : "",
        youtubeUrl: typeof drafts.youtubeUrl === "string" ? drafts.youtubeUrl : "",
        fileNameHint: typeof drafts.fileNameHint === "string" ? drafts.fileNameHint : "",
        youtubePreset:
          typeof drafts.youtubePreset === "string" && drafts.youtubePreset.trim() !== ""
            ? drafts.youtubePreset
            : null,
        youtubeCustom: { ...toRecord(drafts.youtubeCustom) },
      };
    }

    return {
      ...drafts,
      ...state.ui.localDrafts,
      youtubeCustom: {
        ...toRecord(drafts.youtubeCustom),
        ...toRecord(state.ui.localDrafts.youtubeCustom),
      },
    };
  }

  function getCurrentEditDraft() {
    if (isSubtitleAnalysisFeature()) {
      const project = getActiveProject();
      const subtitleEdit = getSubtitleEditState();
      const projectId = project ? project.id : null;
      const projectUpdatedAt =
        project && typeof project.updatedAt === "string" ? project.updatedAt : null;

      if (
        state.ui.localSubtitleEditProjectId !== projectId ||
        state.ui.localSubtitleEditUpdatedAt !== projectUpdatedAt ||
        state.ui.localSubtitleEditDraft === null
      ) {
        state.ui.localSubtitleEditProjectId = projectId;
        state.ui.localSubtitleEditUpdatedAt = projectUpdatedAt;
        state.ui.localSubtitleEditDraft = deepClone(subtitleEdit);
      }

      return toRecord(state.ui.localSubtitleEditDraft);
    }

    const project = getActiveProject();
    const projectEdit = getProjectEdit();
    const projectId = project ? project.id : null;
    const projectUpdatedAt =
      project && typeof project.updatedAt === "string" ? project.updatedAt : null;

    if (
      state.ui.localEditProjectId !== projectId ||
      state.ui.localEditUpdatedAt !== projectUpdatedAt ||
      state.ui.localEditDraft === null
    ) {
      state.ui.localEditProjectId = projectId;
      state.ui.localEditUpdatedAt = projectUpdatedAt;
      state.ui.localEditDraft = deepClone(projectEdit);
    }

    return toRecord(state.ui.localEditDraft);
  }

  function setNestedValue(target: Record<string, any>, path: string, value: unknown) {
    const segments = String(path || "")
      .split(".")
      .filter(Boolean);
    if (segments.length === 0) {
      return;
    }

    let current: Record<string, any> = target;
    while (segments.length > 1) {
      const segment = segments.shift();
      if (segment === undefined) {
        return;
      }
      if (
        !current[segment] ||
        typeof current[segment] !== "object" ||
        Array.isArray(current[segment])
      ) {
        current[segment] = {};
      }
      current = current[segment];
    }
    const finalSegment = segments[0];
    if (finalSegment === undefined) {
      return;
    }
    current[finalSegment] = value;
  }

  function buildNestedPatch(path: string, value: unknown) {
    const patch: Record<string, any> = {};
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
      const focusRegion = toRecord(toRecord(getEditPresets().focusRegions)[String(value || "")]);
      const cropNormalized = toRecord(focusRegion.cropNormalized);
      if (Object.keys(cropNormalized).length > 0) {
        draft.recipe = toRecord(draft.recipe);
        draft.recipe.common = toRecord(draft.recipe.common);
        draft.recipe.common.cropNormalized = deepClone(cropNormalized);
      }
    }

    state.ui.localEditDraft = draft;
  }

  function buildCurrentDraftPayload() {
    if (isSubtitleAnalysisFeature()) {
      return {
        urlInput: state.ui.localSubtitleDrafts.urlInput,
        youtubeUrl: state.ui.localSubtitleDrafts.youtubeUrl,
        subtitleMode: state.ui.localSubtitleDrafts.subtitleMode,
        subtitlesLang: state.ui.localSubtitleDrafts.subtitlesLang,
        publishedAfter: state.ui.localSubtitleDrafts.publishedAfter,
        publishedBefore: state.ui.localSubtitleDrafts.publishedBefore,
        weekdays: state.ui.localSubtitleDrafts.weekdays,
        durationMinSeconds: state.ui.localSubtitleDrafts.durationMinSeconds,
        durationMaxSeconds: state.ui.localSubtitleDrafts.durationMaxSeconds,
        shortsMode: state.ui.localSubtitleDrafts.shortsMode,
        liveMode: state.ui.localSubtitleDrafts.liveMode,
        titleInclude: state.ui.localSubtitleDrafts.titleInclude,
        titleExclude: state.ui.localSubtitleDrafts.titleExclude,
        playlistItems: state.ui.localSubtitleDrafts.playlistItems,
        limitCount: state.ui.localSubtitleDrafts.limitCount,
      };
    }

    return {
      urlInput: state.ui.localDrafts.urlInput,
      youtubeUrl: state.ui.localDrafts.youtubeUrl,
      fileNameHint: state.ui.localDrafts.fileNameHint,
      youtubePreset: state.ui.localDrafts.youtubePreset,
      youtubeCustom: { ...state.ui.localDrafts.youtubeCustom },
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
