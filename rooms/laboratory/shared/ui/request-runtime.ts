export function createLaboratoryRequestRuntime(deps) {
  const {
    bootstrapText,
    buildCurrentDraftPayload,
    getActiveFeatureId,
    getRoomApi,
    isSubtitleAnalysisFeature,
    render,
    requestOverlayScrollReset,
    state,
    toRecord,
  } = deps;

  function setLastAction(message) {
    state.ui.lastActionMessage = message;
  }

  function getActionDomain(action) {
    switch (action) {
      case "project-create":
      case "project-select":
      case "project-delete":
        return "project";
      case "source-set-kind":
      case "source-set-mode":
      case "source-update-draft":
      case "subtitle-source-set-mode":
      case "subtitle-source-update-drafts":
      case "refresh":
        return "source-config";
      case "source-pick-local":
      case "source-download-url":
      case "source-download-youtube":
      case "subtitle-source-pick-local":
      case "subtitle-source-pick-folder":
      case "subtitle-source-download-url":
      case "subtitle-source-discover-youtube":
      case "subtitle-source-download-youtube":
      case "subtitle-source-toggle-discovery":
      case "subtitle-source-select-all-discovery":
      case "subtitle-source-clear-discovery-selection":
      case "subtitle-source-select-entry":
      case "subtitle-source-toggle-selection":
        return "source-acquire";
      case "edit-set-mode":
      case "edit-apply-preset":
      case "edit-update-recipe":
      case "edit-set-output":
      case "edit-set-handoff":
      case "subtitle-edit-apply-preset":
      case "subtitle-edit-update-recipe":
        return "edit-config";
      case "edit-preview":
      case "subtitle-edit-preview":
        return "edit-preview";
      case "edit-apply":
      case "subtitle-edit-apply":
        return "edit-apply";
      case "edit-cancel-preview":
        return "edit-preview-cancel";
      case "edit-cancel-apply":
        return "edit-apply-cancel";
      case "profile-set-mode":
      case "profile-apply-preset":
      case "profile-update":
      case "profile-set-target":
      case "profile-set-model":
        return "profile-config";
      case "profile-run-preflight":
        return "profile-run";
      case "profile-cancel-preflight":
        return "profile-cancel";
      case "profile-model-install":
      case "profile-model-remove":
        return "profile-model";
      case "process-run":
      case "audio-process-run":
        return "process-run";
      case "process-cancel":
      case "audio-process-cancel":
        return "process-cancel";
      case "report-export":
      case "audio-report-export":
        return "report-export";
      case "tool-install":
      case "tool-update":
      case "tools-refresh":
        return "tools";
      default:
        return "misc";
    }
  }

  function rememberRequest(requestId, action) {
    const domain = getActionDomain(action);
    const nextSequence = state.ui.requestCounter + 1;
    state.ui.requestCounter = nextSequence;
    state.ui.latestRequestByDomain[domain] = nextSequence;
    state.ui.requestLookup[requestId] = {
      domain: domain,
      sequence: nextSequence,
    };

    const lookupEntries = Object.entries(state.ui.requestLookup);
    if (lookupEntries.length > 120) {
      lookupEntries
        .sort(function (left, right) {
          return Number(toRecord(right[1]).sequence) - Number(toRecord(left[1]).sequence);
        })
        .slice(100)
        .forEach(function (entry) {
          delete state.ui.requestLookup[entry[0]];
        });
    }
  }

  function shouldIgnoreCorrelatedPayload(requestId, action) {
    if (typeof requestId !== "string" || requestId.trim() === "") {
      return false;
    }

    const tracked = toRecord(state.ui.requestLookup[requestId]);
    const trackedDomain =
      typeof tracked.domain === "string" && tracked.domain.trim() !== "" ? tracked.domain : null;
    const trackedSequence =
      typeof tracked.sequence === "number" && Number.isFinite(tracked.sequence)
        ? tracked.sequence
        : null;

    if (trackedDomain === null || trackedSequence === null) {
      return false;
    }

    const domain = getActionDomain(action || trackedDomain);
    const latestSequence = Number(state.ui.latestRequestByDomain[domain] || 0);
    return trackedDomain === domain && trackedSequence < latestSequence;
  }

  function nextRequestId(action) {
    return [action, Date.now(), Math.random().toString(36).slice(2, 8)].join("-");
  }

  function sendMediaAction(action, payload) {
    const roomApi = getRoomApi();
    if (!roomApi || typeof roomApi.sendEvent !== "function") {
      setLastAction(bootstrapText("roomApiUnavailable"));
      render();
      return null;
    }

    const requestId = nextRequestId(action);
    state.ui.lastRequestId = requestId;
    rememberRequest(requestId, action);
    roomApi.sendEvent("media-action", {
      requestId: requestId,
      action: action,
      payload: {
        featureId: getActiveFeatureId(),
        ...(payload || {}),
      },
    });
    return requestId;
  }

  function sendSourceAction(action, payload) {
    return sendMediaAction(action, payload);
  }

  function syncDraftField(path, value) {
    if (isSubtitleAnalysisFeature()) {
      state.ui.localSubtitleDrafts[path] = value;
      return;
    }
    if (path === "youtubePreset") {
      state.ui.localDrafts.youtubePreset = value;
      return;
    }
    if (path.indexOf("youtubeCustom.") === 0) {
      const key = path.replace("youtubeCustom.", "");
      state.ui.localDrafts.youtubeCustom[key] = value;
      return;
    }
    state.ui.localDrafts[path] = value;
  }

  function persistDrafts(extraFields) {
    const nextFields = {
      ...buildCurrentDraftPayload(),
      ...toRecord(extraFields),
    };
    if (isSubtitleAnalysisFeature()) {
      sendSourceAction("subtitle-source-update-drafts", { fields: nextFields });
      return;
    }

    nextFields.youtubeCustom = {
      ...toRecord(buildCurrentDraftPayload().youtubeCustom),
      ...toRecord(toRecord(extraFields).youtubeCustom),
    };
    sendSourceAction("source-update-draft", { fields: nextFields });
  }

  function openSettingsOverlay() {
    state.ui.settingsOpen = true;
    requestOverlayScrollReset();
    render();
    sendSourceAction("tools-refresh", {});
  }

  function closeSettingsOverlay() {
    state.ui.settingsOpen = false;
    render();
  }

  return {
    closeSettingsOverlay,
    openSettingsOverlay,
    persistDrafts,
    sendMediaAction,
    sendSourceAction,
    setLastAction,
    shouldIgnoreCorrelatedPayload,
    syncDraftField,
  };
}
