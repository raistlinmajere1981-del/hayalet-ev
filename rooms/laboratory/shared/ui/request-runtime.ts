import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";
import { createLaboratoryWorkbenchState } from "../host/runtime-primitives.js";
import type {
  LaboratoryShellEventLogItem,
  LaboratoryShellStatusSource,
  LaboratoryShellStatusTone,
} from "../types/room-shell-contracts.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];
type LaboratoryActionDomain = keyof LaboratoryUiState["ui"]["latestRequestByDomain"];
type LaboratoryDraftPayload = LaboratoryRecord & {
  youtubeCustom?: unknown;
};
type LaboratoryTrackedRequest = {
  domain: LaboratoryActionDomain;
  sequence: number;
};
type LaboratoryRoomApi = {
  sendEvent: (eventName: string, payload: LaboratoryRecord) => void;
};

type LaboratoryRequestRuntimeDeps = {
  bootstrapText: (key: string) => string;
  buildCurrentDraftPayload: () => LaboratoryDraftPayload;
  getActiveFeatureId: () => string;
  getRoomApi: () => LaboratoryRoomApi | null | undefined;
  isSubtitleAnalysisFeature: () => boolean;
  render: () => void;
  requestOverlayScrollReset: () => void;
  state: LaboratoryUiState;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryRequestRuntime(deps: LaboratoryRequestRuntimeDeps) {
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

  function getRequestLookup(): Record<string, LaboratoryTrackedRequest> {
    return state.ui.requestLookup as Record<string, LaboratoryTrackedRequest>;
  }

  function normalizeStatusMessage(message: string): string {
    return message.replace(/\s+/g, " ").trim();
  }

  function extractStatusDetail(message: string): string | null {
    const normalized = message.trim();
    if (normalized === "") {
      return null;
    }
    if (normalized.length > 180 || normalized.includes("\n")) {
      return normalized;
    }
    return null;
  }

  function summarizeStatusMessage(message: string): string {
    const normalized = normalizeStatusMessage(message);
    if (normalized.length <= 180) {
      return normalized;
    }
    return `${normalized.slice(0, 177).trimEnd()}...`;
  }

  function pushEventLogEntry(
    tone: LaboratoryShellStatusTone,
    message: string,
    source: LaboratoryShellStatusSource,
    detail: string | null = null
  ) {
    const now = Date.now();
    const normalizedMessage = summarizeStatusMessage(message);
    if (normalizedMessage === "") {
      return;
    }

    const latestEntry = state.ui.eventLog[0];
    if (
      latestEntry &&
      latestEntry.tone === tone &&
      latestEntry.source === source &&
      latestEntry.message === normalizedMessage &&
      now - latestEntry.timestamp < 2000
    ) {
      latestEntry.timestamp = now;
      latestEntry.detail = detail;
      return;
    }

    const entry: LaboratoryShellEventLogItem = {
      detail,
      id: `${tone}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      message: normalizedMessage,
      source,
      timestamp: now,
      tone,
    };
    state.ui.eventLog.unshift(entry);
    if (state.ui.eventLog.length > 80) {
      state.ui.eventLog.length = 80;
    }
  }

  function setStatusChannel(
    tone: LaboratoryShellStatusTone,
    message: string,
    options: {
      detail?: string | null;
      source?: LaboratoryShellStatusSource;
      sticky?: boolean;
    } = {}
  ) {
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

  function clearStatusChannel(tone: LaboratoryShellStatusTone) {
    const channel = state.ui.status[tone];
    channel.message = "";
    channel.detail = null;
    channel.source = "system";
    channel.sticky = false;
    channel.updatedAt = null;
    channel.visible = false;
  }

  function setLastAction(message: string) {
    setStatusChannel("result", message, { source: "request", sticky: false });
  }

  function setBlockingStatus(
    message: string,
    detail?: string | null,
    source: LaboratoryShellStatusSource = "system"
  ) {
    setStatusChannel("blocking", message, { detail: detail ?? null, source, sticky: true });
  }

  function setActivityStatus(
    message: string,
    detail?: string | null,
    source: LaboratoryShellStatusSource = "system"
  ) {
    setStatusChannel("activity", message, { detail: detail ?? null, source, sticky: false });
  }

  function setResultStatus(
    message: string,
    detail?: string | null,
    source: LaboratoryShellStatusSource = "system"
  ) {
    setStatusChannel("result", message, { detail: detail ?? null, source, sticky: false });
  }

  function toggleEventLog(force?: boolean) {
    state.ui.eventLogOpen = typeof force === "boolean" ? force : !state.ui.eventLogOpen;
  }

  function getActionDomain(action: unknown): LaboratoryActionDomain {
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

  function rememberRequest(requestId: string, action: unknown) {
    const lookup = getRequestLookup();
    const domain = getActionDomain(action);
    const nextSequence = state.ui.requestCounter + 1;
    state.ui.requestCounter = nextSequence;
    state.ui.latestRequestByDomain[domain] = nextSequence;
    lookup[requestId] = {
      domain: domain,
      sequence: nextSequence,
    };

    const lookupEntries = Object.entries(lookup);
    if (lookupEntries.length > 120) {
      lookupEntries
        .sort(function ([, left], [, right]) {
          return right.sequence - left.sequence;
        })
        .slice(100)
        .forEach(function ([trackedRequestId]) {
          delete lookup[trackedRequestId];
        });
    }
  }

  function shouldIgnoreCorrelatedPayload(requestId: unknown, action: unknown) {
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

  function nextRequestId(action: string) {
    return [action, Date.now(), Math.random().toString(36).slice(2, 8)].join("-");
  }

  function sendMediaAction(action: string, payload?: LaboratoryRecord | null) {
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
      requestId: requestId,
      action: action,
      payload: {
        featureId: getActiveFeatureId(),
        ...toRecord(payload),
      },
    });
    return requestId;
  }

  function sendSourceAction(action: string, payload?: LaboratoryRecord | null) {
    return sendMediaAction(action, payload);
  }

  function syncDraftField(path: string, value: unknown) {
    if (isSubtitleAnalysisFeature()) {
      const subtitleDrafts = state.ui.localSubtitleDrafts as Record<string, unknown>;
      subtitleDrafts[path] = value;
      return;
    }

    if (path === "youtubePreset") {
      state.ui.localDrafts.youtubePreset = value;
      return;
    }

    if (path.startsWith("youtubeCustom.")) {
      const key = path.replace("youtubeCustom.", "");
      const youtubeCustom = state.ui.localDrafts.youtubeCustom as Record<string, unknown>;
      youtubeCustom[key] = value;
      return;
    }

    const localDrafts = state.ui.localDrafts as Record<string, unknown>;
    localDrafts[path] = value;
  }

  function persistDrafts(extraFields: unknown) {
    const currentDrafts = buildCurrentDraftPayload();
    const extraDraftFields = toRecord(extraFields);
    const nextFields: LaboratoryDraftPayload = {
      ...currentDrafts,
      ...extraDraftFields,
    };

    if (isSubtitleAnalysisFeature()) {
      sendSourceAction("subtitle-source-update-drafts", { fields: nextFields });
      return;
    }

    nextFields["youtubeCustom"] = {
      ...toRecord(currentDrafts["youtubeCustom"]),
      ...toRecord(extraDraftFields["youtubeCustom"]),
    };
    sendSourceAction("source-update-draft", { fields: nextFields });
  }

  function syncHostContext(payload: LaboratoryRecord) {
    const roomApi = getRoomApi();
    if (!roomApi) {
      setBlockingStatus(bootstrapText("roomApiUnavailable"));
      render();
      return;
    }
    roomApi.sendEvent("host-context", payload);
  }

  function syncWorkbenchContext(patch: LaboratoryRecord) {
    const nextWorkbench = createLaboratoryWorkbenchState({
      ...toRecord(state.context.workbench),
      ...toRecord(patch),
    });
    state.context = {
      ...state.context,
      featureId:
        typeof nextWorkbench["activeModuleId"] === "string" &&
        nextWorkbench["activeModuleId"].trim() !== ""
          ? nextWorkbench["activeModuleId"]
          : state.context.featureId,
      workbench: nextWorkbench,
    };
    state.sourceSnapshot.workbench = nextWorkbench;
    render();
    syncHostContext({
      ...state.context,
      activeFeature: {
        id: state.context.featureId,
      },
    });
  }

  function getAvailableWorkbenchModuleIds(): string[] {
    return Array.isArray(state.context.workbench["availableModuleIds"])
      ? state.context.workbench["availableModuleIds"].filter(function (entry): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [getActiveFeatureId()];
  }

  function getSelectedWorkbenchModuleIds(): string[] {
    return Array.isArray(state.context.workbench["selectedModuleIds"])
      ? state.context.workbench["selectedModuleIds"].filter(function (entry): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [getActiveFeatureId()];
  }

  function setActiveWorkbenchModule(featureId: string) {
    const selectedModuleIds = getSelectedWorkbenchModuleIds();
    syncWorkbenchContext({
      activeModuleId: featureId,
      selectedModuleIds: selectedModuleIds.includes(featureId)
        ? selectedModuleIds
        : [...selectedModuleIds, featureId],
    });
  }

  function toggleWorkbenchModuleSelection(featureId: string) {
    const availableModuleIds = getAvailableWorkbenchModuleIds();
    if (!availableModuleIds.includes(featureId)) {
      return;
    }

    const activeModuleId = getActiveFeatureId();
    const selectedModuleIds = getSelectedWorkbenchModuleIds();
    const isSelected = selectedModuleIds.includes(featureId);
    const nextSelectedModuleIds = isSelected
      ? selectedModuleIds.filter(function (entry) {
          return entry !== featureId;
        })
      : [...selectedModuleIds, featureId];
    const fallbackModuleId = availableModuleIds.find(function (entry) {
      return entry !== featureId;
    });
    const nextActiveModuleId =
      featureId === activeModuleId && isSelected
        ? nextSelectedModuleIds[0] || fallbackModuleId || activeModuleId
        : activeModuleId;

    syncWorkbenchContext({
      activeModuleId: nextActiveModuleId,
      selectedModuleIds:
        nextSelectedModuleIds.length > 0 ? nextSelectedModuleIds : [nextActiveModuleId],
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
    toggleWorkbenchModuleSelection,
  };
}
