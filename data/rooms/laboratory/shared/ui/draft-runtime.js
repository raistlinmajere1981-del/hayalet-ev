export function createLaboratoryUiDraftRuntime(deps) {
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
  const asRecord = function asRecord2(value) {
    return toRecord(value);
  };
  function sortStageJobs(entries, actionOrder) {
    return entries.sort(function(left, right) {
      const leftRank = Object.prototype.hasOwnProperty.call(actionOrder, left.action) ? actionOrder[left.action] : 99;
      const rightRank = Object.prototype.hasOwnProperty.call(actionOrder, right.action) ? actionOrder[right.action] : 99;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      const leftId = String(left.jobId || left.requestId || left.action || "");
      const rightId = String(right.jobId || right.requestId || right.action || "");
      return leftId.localeCompare(rightId);
    });
  }
  function collectEditStageJobs(projectJobs) {
    const editJobs = Array.isArray(projectJobs) ? projectJobs.map(asRecord).filter(function(entry) {
      return entry.featureStage === "edit" || String(entry.action || "").startsWith("edit-");
    }) : [];
    return sortStageJobs(editJobs, {
      "edit-preview": 0,
      "edit-apply": 1
    });
  }
  function collectProfileStageJobs(projectJobs) {
    const profileJobs = Array.isArray(projectJobs) ? projectJobs.map(asRecord).filter(function(entry) {
      return entry.featureStage === "profile" || String(entry.action || "").startsWith("profile-");
    }) : [];
    return sortStageJobs(profileJobs, {
      "profile-run-preflight": 0,
      "profile-model-install": 1,
      "profile-model-remove": 2
    });
  }
  function collectProcessStageJobs(projectJobs) {
    return (Array.isArray(projectJobs) ? projectJobs : []).map(asRecord).filter(function(entry) {
      return entry.featureStage === "process" || String(entry.action || "").includes("process");
    }).sort(function(left, right) {
      return String(left.jobId || left.requestId || left.action || "").localeCompare(
        String(right.jobId || right.requestId || right.action || "")
      );
    });
  }
  function collectReportStageJobs(projectJobs) {
    return (Array.isArray(projectJobs) ? projectJobs : []).map(asRecord).filter(function(entry) {
      return entry.featureStage === "report" || String(entry.action || "").includes("report");
    }).sort(function(left, right) {
      return String(left.jobId || left.requestId || left.action || "").localeCompare(
        String(right.jobId || right.requestId || right.action || "")
      );
    });
  }
  function getCurrentDrafts() {
    if (isSubtitleAnalysisFeature()) {
      const drafts2 = toRecord(getSubtitleWorkspace().drafts);
      if (state.ui.localSubtitleDraftProjectId !== getSourceSnapshot().activeProjectId) {
        state.ui.localSubtitleDraftProjectId = getSourceSnapshot().activeProjectId;
        state.ui.localSubtitleDrafts = {
          urlInput: typeof drafts2.urlInput === "string" ? drafts2.urlInput : "",
          youtubeUrl: typeof drafts2.youtubeUrl === "string" ? drafts2.youtubeUrl : "",
          subtitleMode: typeof drafts2.subtitleMode === "string" && drafts2.subtitleMode.trim() !== "" ? drafts2.subtitleMode : "manual",
          subtitlesLang: typeof drafts2.subtitlesLang === "string" && drafts2.subtitlesLang.trim() !== "" ? drafts2.subtitlesLang : "all",
          publishedAfter: typeof drafts2.publishedAfter === "string" ? drafts2.publishedAfter : "",
          publishedBefore: typeof drafts2.publishedBefore === "string" ? drafts2.publishedBefore : "",
          weekdays: typeof drafts2.weekdays === "string" ? drafts2.weekdays : "",
          durationMinSeconds: typeof drafts2.durationMinSeconds === "number" ? drafts2.durationMinSeconds : null,
          durationMaxSeconds: typeof drafts2.durationMaxSeconds === "number" ? drafts2.durationMaxSeconds : null,
          shortsMode: typeof drafts2.shortsMode === "string" && drafts2.shortsMode.trim() !== "" ? drafts2.shortsMode : "all",
          liveMode: typeof drafts2.liveMode === "string" && drafts2.liveMode.trim() !== "" ? drafts2.liveMode : "all",
          titleInclude: typeof drafts2.titleInclude === "string" ? drafts2.titleInclude : "",
          titleExclude: typeof drafts2.titleExclude === "string" ? drafts2.titleExclude : "",
          playlistItems: typeof drafts2.playlistItems === "string" ? drafts2.playlistItems : "",
          limitCount: typeof drafts2.limitCount === "number" ? drafts2.limitCount : null
        };
      }
      return {
        ...drafts2,
        ...state.ui.localSubtitleDrafts
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
        youtubePreset: typeof drafts.youtubePreset === "string" && drafts.youtubePreset.trim() !== "" ? drafts.youtubePreset : null,
        youtubeCustom: { ...toRecord(drafts.youtubeCustom) }
      };
    }
    return {
      ...drafts,
      ...state.ui.localDrafts,
      youtubeCustom: {
        ...toRecord(drafts.youtubeCustom),
        ...toRecord(state.ui.localDrafts.youtubeCustom)
      }
    };
  }
  function getCurrentEditDraft() {
    if (isSubtitleAnalysisFeature()) {
      const project2 = getActiveProject();
      const subtitleEdit = getSubtitleEditState();
      const projectId2 = project2 ? project2.id : null;
      const projectUpdatedAt2 = project2 && typeof project2.updatedAt === "string" ? project2.updatedAt : null;
      if (state.ui.localSubtitleEditProjectId !== projectId2 || state.ui.localSubtitleEditUpdatedAt !== projectUpdatedAt2 || state.ui.localSubtitleEditDraft === null) {
        state.ui.localSubtitleEditProjectId = projectId2;
        state.ui.localSubtitleEditUpdatedAt = projectUpdatedAt2;
        state.ui.localSubtitleEditDraft = deepClone(subtitleEdit);
      }
      return toRecord(state.ui.localSubtitleEditDraft);
    }
    const project = getActiveProject();
    const projectEdit = getProjectEdit();
    const projectId = project ? project.id : null;
    const projectUpdatedAt = project && typeof project.updatedAt === "string" ? project.updatedAt : null;
    if (state.ui.localEditProjectId !== projectId || state.ui.localEditUpdatedAt !== projectUpdatedAt || state.ui.localEditDraft === null) {
      state.ui.localEditProjectId = projectId;
      state.ui.localEditUpdatedAt = projectUpdatedAt;
      state.ui.localEditDraft = deepClone(projectEdit);
    }
    return toRecord(state.ui.localEditDraft);
  }
  function setNestedValue(target, path, value) {
    const segments = String(path || "").split(".").filter(Boolean);
    if (segments.length === 0) {
      return;
    }
    let current = target;
    while (segments.length > 1) {
      const segment = segments.shift();
      if (!current[segment] || typeof current[segment] !== "object" || Array.isArray(current[segment])) {
        current[segment] = {};
      }
      current = current[segment];
    }
    current[segments[0]] = value;
  }
  function buildNestedPatch(path, value) {
    const patch = {};
    setNestedValue(patch, path, value);
    return patch;
  }
  function syncLocalEditField(path, value) {
    if (isSubtitleAnalysisFeature()) {
      const draft2 = getCurrentEditDraft();
      setNestedValue(draft2, path, value);
      state.ui.localSubtitleEditDraft = draft2;
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
        limitCount: state.ui.localSubtitleDrafts.limitCount
      };
    }
    return {
      urlInput: state.ui.localDrafts.urlInput,
      youtubeUrl: state.ui.localDrafts.youtubeUrl,
      fileNameHint: state.ui.localDrafts.fileNameHint,
      youtubePreset: state.ui.localDrafts.youtubePreset,
      youtubeCustom: { ...state.ui.localDrafts.youtubeCustom }
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
    syncLocalEditField
  };
}
