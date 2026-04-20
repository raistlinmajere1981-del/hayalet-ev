import { createLaboratoryWorkbenchState } from "../host/runtime-primitives.js";
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
    toRecord
  } = deps;
  function getRequestLookup() {
    return state.ui.requestLookup;
  }
  function normalizeStatusMessage(message) {
    return message.replace(/\s+/g, " ").trim();
  }
  function extractStatusDetail(message) {
    const normalized = message.trim();
    if (normalized === "") {
      return null;
    }
    if (normalized.length > 180 || normalized.includes("\n")) {
      return normalized;
    }
    return null;
  }
  function summarizeStatusMessage(message) {
    const normalized = normalizeStatusMessage(message);
    if (normalized.length <= 180) {
      return normalized;
    }
    return `${normalized.slice(0, 177).trimEnd()}...`;
  }
  function pushEventLogEntry(tone, message, source, detail = null) {
    const now = Date.now();
    const normalizedMessage = summarizeStatusMessage(message);
    if (normalizedMessage === "") {
      return;
    }
    const latestEntry = state.ui.eventLog[0];
    if (latestEntry && latestEntry.tone === tone && latestEntry.source === source && latestEntry.message === normalizedMessage && now - latestEntry.timestamp < 2e3) {
      latestEntry.timestamp = now;
      latestEntry.detail = detail;
      return;
    }
    const entry = {
      detail,
      id: `${tone}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      message: normalizedMessage,
      source,
      timestamp: now,
      tone
    };
    state.ui.eventLog.unshift(entry);
    if (state.ui.eventLog.length > 80) {
      state.ui.eventLog.length = 80;
    }
  }
  function setStatusChannel(tone, message, options = {}) {
    const normalizedMessage = summarizeStatusMessage(message);
    if (normalizedMessage === "") {
      return;
    }
    const source = options.source || "system";
    const detail = options.detail ?? extractStatusDetail(message);
    const channel = state.ui.status[tone];
    channel.message = normalizedMessage;
    channel.detail = detail;
    channel.source = source;
    channel.sticky = options.sticky ?? tone === "blocking";
    channel.updatedAt = Date.now();
    channel.visible = true;
    if (tone !== "activity") {
      const activityChannel = state.ui.status["activity"];
      activityChannel.message = "";
      activityChannel.detail = null;
      activityChannel.source = "system";
      activityChannel.sticky = false;
      activityChannel.updatedAt = null;
      activityChannel.visible = false;
    }
    state.ui.lastActionMessage = normalizedMessage;
    pushEventLogEntry(tone, normalizedMessage, source, detail);
  }
  function clearStatusChannel(tone) {
    const channel = state.ui.status[tone];
    channel.message = "";
    channel.detail = null;
    channel.source = "system";
    channel.sticky = false;
    channel.updatedAt = null;
    channel.visible = false;
  }
  function setLastAction(message) {
    setStatusChannel("result", message, { source: "request", sticky: false });
  }
  function setBlockingStatus(message, detail, source = "system") {
    setStatusChannel("blocking", message, { detail: detail ?? null, source, sticky: true });
  }
  function setActivityStatus(message, detail, source = "system") {
    setStatusChannel("activity", message, { detail: detail ?? null, source, sticky: false });
  }
  function setResultStatus(message, detail, source = "system") {
    setStatusChannel("result", message, { detail: detail ?? null, source, sticky: false });
  }
  function toggleEventLog(force) {
    state.ui.eventLogOpen = typeof force === "boolean" ? force : !state.ui.eventLogOpen;
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
      case "tool-check-updates":
      case "tool-update-all":
      case "tools-refresh":
        return "tools";
      default:
        return "misc";
    }
  }
  function rememberRequest(requestId, action) {
    const lookup = getRequestLookup();
    const domain = getActionDomain(action);
    const nextSequence = state.ui.requestCounter + 1;
    state.ui.requestCounter = nextSequence;
    state.ui.latestRequestByDomain[domain] = nextSequence;
    lookup[requestId] = {
      domain,
      sequence: nextSequence
    };
    const lookupEntries = Object.entries(lookup);
    if (lookupEntries.length > 120) {
      lookupEntries.sort(function([, left], [, right]) {
        return right.sequence - left.sequence;
      }).slice(100).forEach(function([trackedRequestId]) {
        delete lookup[trackedRequestId];
      });
    }
  }
  function shouldIgnoreCorrelatedPayload(requestId, action) {
    if (typeof requestId !== "string" || requestId.trim() === "") {
      return false;
    }
    const tracked = getRequestLookup()[requestId];
    if (!tracked) {
      return false;
    }
    const domain = getActionDomain(action ?? tracked.domain);
    const latestSequence = state.ui.latestRequestByDomain[domain] || 0;
    return tracked.domain === domain && tracked.sequence < latestSequence;
  }
  function nextRequestId(action) {
    return [action, Date.now(), Math.random().toString(36).slice(2, 8)].join("-");
  }
  function sendMediaAction(action, payload) {
    const roomApi = getRoomApi();
    if (!roomApi) {
      setBlockingStatus(bootstrapText("roomApiUnavailable"));
      render();
      return null;
    }
    const requestId = nextRequestId(action);
    state.ui.lastRequestId = requestId;
    rememberRequest(requestId, action);
    roomApi.sendEvent("media-action", {
      requestId,
      action,
      payload: {
        featureId: getActiveFeatureId(),
        ...toRecord(payload)
      }
    });
    return requestId;
  }
  function sendSourceAction(action, payload) {
    return sendMediaAction(action, payload);
  }
  function syncDraftField(path, value) {
    if (isSubtitleAnalysisFeature()) {
      const subtitleDrafts = state.ui.localSubtitleDrafts;
      subtitleDrafts[path] = value;
      return;
    }
    if (path === "youtubePreset") {
      state.ui.localDrafts.youtubePreset = value;
      return;
    }
    if (path.startsWith("youtubeCustom.")) {
      const key = path.replace("youtubeCustom.", "");
      const youtubeCustom = state.ui.localDrafts.youtubeCustom;
      youtubeCustom[key] = value;
      return;
    }
    const localDrafts = state.ui.localDrafts;
    localDrafts[path] = value;
  }
  function persistDrafts(extraFields) {
    const currentDrafts = buildCurrentDraftPayload();
    const extraDraftFields = toRecord(extraFields);
    const nextFields = {
      ...currentDrafts,
      ...extraDraftFields
    };
    if (isSubtitleAnalysisFeature()) {
      sendSourceAction("subtitle-source-update-drafts", { fields: nextFields });
      return;
    }
    nextFields["youtubeCustom"] = {
      ...toRecord(currentDrafts["youtubeCustom"]),
      ...toRecord(extraDraftFields["youtubeCustom"])
    };
    sendSourceAction("source-update-draft", { fields: nextFields });
  }
  function syncHostContext(payload) {
    const roomApi = getRoomApi();
    if (!roomApi) {
      setBlockingStatus(bootstrapText("roomApiUnavailable"));
      render();
      return;
    }
    roomApi.sendEvent("host-context", payload);
  }
  function syncWorkbenchContext(patch) {
    const nextWorkbench = createLaboratoryWorkbenchState({
      ...toRecord(state.context.workbench),
      ...toRecord(patch)
    });
    state.context = {
      ...state.context,
      featureId: typeof nextWorkbench["activeModuleId"] === "string" && nextWorkbench["activeModuleId"].trim() !== "" ? nextWorkbench["activeModuleId"] : state.context.featureId,
      workbench: nextWorkbench
    };
    state.sourceSnapshot.workbench = nextWorkbench;
    render();
    syncHostContext({
      ...state.context,
      activeFeature: {
        id: state.context.featureId
      }
    });
  }
  function getAvailableWorkbenchModuleIds() {
    return Array.isArray(state.context.workbench["availableModuleIds"]) ? state.context.workbench["availableModuleIds"].filter(function(entry) {
      return typeof entry === "string" && entry.trim() !== "";
    }) : [getActiveFeatureId()];
  }
  function getSelectedWorkbenchModuleIds() {
    return Array.isArray(state.context.workbench["selectedModuleIds"]) ? state.context.workbench["selectedModuleIds"].filter(function(entry) {
      return typeof entry === "string" && entry.trim() !== "";
    }) : [getActiveFeatureId()];
  }
  function setActiveWorkbenchModule(featureId) {
    const selectedModuleIds = getSelectedWorkbenchModuleIds();
    syncWorkbenchContext({
      activeModuleId: featureId,
      selectedModuleIds: selectedModuleIds.includes(featureId) ? selectedModuleIds : [...selectedModuleIds, featureId]
    });
  }
  function toggleWorkbenchModuleSelection(featureId) {
    const availableModuleIds = getAvailableWorkbenchModuleIds();
    if (!availableModuleIds.includes(featureId)) {
      return;
    }
    const activeModuleId = getActiveFeatureId();
    const selectedModuleIds = getSelectedWorkbenchModuleIds();
    const isSelected = selectedModuleIds.includes(featureId);
    const nextSelectedModuleIds = isSelected ? selectedModuleIds.filter(function(entry) {
      return entry !== featureId;
    }) : [...selectedModuleIds, featureId];
    const fallbackModuleId = availableModuleIds.find(function(entry) {
      return entry !== featureId;
    });
    const nextActiveModuleId = featureId === activeModuleId && isSelected ? nextSelectedModuleIds[0] || fallbackModuleId || activeModuleId : activeModuleId;
    syncWorkbenchContext({
      activeModuleId: nextActiveModuleId,
      selectedModuleIds: nextSelectedModuleIds.length > 0 ? nextSelectedModuleIds : [nextActiveModuleId]
    });
  }
  function openSettingsOverlay() {
    if (state.ui.settingsOpen === true) {
      return;
    }
    state.ui.settingsOpen = true;
    state.ui.settingsAnimateIn = true;
    requestOverlayScrollReset();
    render();
    state.ui.settingsAnimateIn = false;
  }
  function closeSettingsOverlay() {
    state.ui.settingsOpen = false;
    state.ui.settingsAnimateIn = false;
    render();
  }
  return {
    clearStatusChannel,
    closeSettingsOverlay,
    openSettingsOverlay,
    persistDrafts,
    sendMediaAction,
    sendSourceAction,
    setActiveWorkbenchModule,
    setActivityStatus,
    setBlockingStatus,
    setLastAction,
    setResultStatus,
    shouldIgnoreCorrelatedPayload,
    syncHostContext,
    syncWorkbenchContext,
    syncDraftField,
    toggleEventLog,
    toggleWorkbenchModuleSelection
  };
}
