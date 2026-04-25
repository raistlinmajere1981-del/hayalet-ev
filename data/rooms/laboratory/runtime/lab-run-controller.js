import {
  asLabRecord,
  asNonEmptyString,
  createLabEventId,
  WORKSPACE_INTENTS
} from "../models/lab-types.js";
import { createLabWaveformTimelineVisualizer } from "../ui/lab-waveform-timeline.js";
import {
  getActionOutputs,
  deriveLegacyStage,
  getActiveEditOutput,
  getAnalysisActionBlockReason,
  getCurrentRun,
  getDualPreviewVolume,
  getEditActionBlockReason,
  getReportActionBlockReason,
  getSelectedDualPreviewAudioAsset,
  getSourceActionBlockReason,
  getSourceReady,
  getSourceMode,
  getSourceProbeStatus,
  getSourceStatus,
  getUserActions,
  getWaveformTimelineModel,
  getWorkbench,
  hasReportPayload,
  isDualPreviewActive,
  isRunActive,
  isRunComplete
} from "./lab-selectors.js";
import {
  LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS,
  getTrackedLabUserActionDefinition
} from "./lab-user-actions.js";
function toStringValue(value) {
  return typeof value === "string" ? value : "";
}
function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => typeof entry === "string" && entry.trim() !== "");
}
function pad2(value) {
  return String(value).padStart(2, "0");
}
function formatProjectTimestamp(dateValue) {
  const date = new Date(
    typeof dateValue === "string" || typeof dateValue === "number" || dateValue instanceof Date ? dateValue : Date.now()
  );
  const fallbackDate = Number.isNaN(date.getTime()) ? /* @__PURE__ */ new Date() : date;
  return `${fallbackDate.getFullYear()}-${pad2(fallbackDate.getMonth() + 1)}-${pad2(
    fallbackDate.getDate()
  )} ${pad2(fallbackDate.getHours())}-${pad2(fallbackDate.getMinutes())}`;
}
function buildAutoProjectName(dateValue, sourceLabel) {
  return `${formatProjectTimestamp(dateValue)} - ${sourceLabel}`;
}
function isTextControl(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}
function buildUiEvent(message, severity = "info") {
  return {
    id: createLabEventId("ui"),
    kind: "activity",
    severity,
    message,
    detail: null,
    timestamp: Date.now(),
    source: "ui",
    action: null,
    stage: null,
    scope: "global",
    moduleId: null,
    rawLine: null
  };
}
function toDraftScope(workbench) {
  const currentScope = asLabRecord(workbench["analysisScope"]);
  return {
    ...currentScope,
    lifecycle: {
      mutable: true,
      processId: null,
      frozenAt: null
    }
  };
}
function getFeatureIdForCapability(capabilityId) {
  return capabilityId === "visual-structure" || capabilityId === "visual-forensics" ? "media-analysis" : "audio-analysis";
}
function deriveFeatureSelectionFromCapabilities(capabilityIds) {
  const featureIds = Array.from(
    new Set(
      capabilityIds.map(function(capabilityId) {
        return getFeatureIdForCapability(capabilityId);
      })
    )
  );
  return {
    activeFeatureId: featureIds[0] || "media-analysis",
    featureIds
  };
}
export function createLabRunController(deps) {
  let attached = false;
  const hubDismissTimers = /* @__PURE__ */ new Map();
  let boundDualPreviewMaster = null;
  let boundDualPreviewSlave = null;
  let boundTimelineSyncMedia = null;
  let dualPreviewStateSnapshot = {
    enabled: false,
    audioAssetId: null,
    sourceKey: null,
    volume: 1
  };
  let dualPreviewSlaveAutoplayBlocked = false;
  let dualPreviewPendingSlaveSeekSeconds = null;
  const getWorkspaceWaveformTimelineModel = () => getWaveformTimelineModel(deps.store.getState());
  const workspaceAudioVisualizer = createLabWaveformTimelineVisualizer({
    documentRef: deps.documentRef,
    getTimelineModel: getWorkspaceWaveformTimelineModel,
    windowRef: deps.windowRef
  });
  function dispatch(event) {
    deps.eventBus.emit(event);
  }
  function formatClockTime(totalSeconds) {
    const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor(safeSeconds % 3600 / 60);
    const seconds = safeSeconds % 60;
    if (hours > 0) {
      return `${String(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
    }
    return `${pad2(minutes)}:${pad2(seconds)}`;
  }
  function isMediaLikeElement(value) {
    if (!value || typeof value !== "object") {
      return false;
    }
    return typeof value.currentTime === "number";
  }
  function isMediaMetadataReady(media) {
    if (media === null) {
      return false;
    }
    if (typeof media.readyState === "number") {
      return media.readyState >= 1;
    }
    return typeof media.duration === "number" && Number.isFinite(media.duration);
  }
  function formatTimelineTimeMs(totalMs) {
    const safeMs = Number.isFinite(totalMs) && totalMs > 0 ? Math.round(totalMs) : 0;
    const minutes = Math.floor(safeMs / 6e4);
    const seconds = Math.floor(safeMs % 6e4 / 1e3);
    const millis = safeMs % 1e3;
    return `${pad2(minutes)}:${pad2(seconds)}.${String(millis).padStart(3, "0")}`;
  }
  function getPrimaryWorkspacePreviewMedia() {
    const selectors = [
      'audio[data-lab-preserve-media="workspace-preview"]',
      'video[data-lab-preserve-media="workspace-preview"]',
      'video[data-lab-preserve-media="workspace-preview-dual-video"]'
    ];
    for (const selector of selectors) {
      const candidate = deps.documentRef.querySelector?.(selector);
      if (isMediaLikeElement(candidate)) {
        return candidate;
      }
    }
    return null;
  }
  function getTimelineSyncMedia() {
    const state = deps.store.getState();
    if (isDualPreviewActive(state) === true) {
      return getDualPreviewMaster();
    }
    return getPrimaryWorkspacePreviewMedia();
  }
  function getTimelinePlayhead() {
    const candidate = deps.documentRef.querySelector?.('[data-lab-role="timeline-playhead"]');
    return candidate && typeof candidate === "object" ? candidate : null;
  }
  function getTimelinePlayheadLabel() {
    const candidate = deps.documentRef.querySelector?.('[data-lab-role="timeline-playhead-label"]');
    return candidate && typeof candidate === "object" ? candidate : null;
  }
  function getTimelineDurationMs(media) {
    const timeline = deps.documentRef.querySelector?.(".labx-timeline");
    const timelineDurationMs = Number(timeline?.dataset?.["duration"] || 0);
    if (Number.isFinite(timelineDurationMs) && timelineDurationMs > 0) {
      return timelineDurationMs;
    }
    if (media && typeof media.duration === "number" && Number.isFinite(media.duration)) {
      return Math.max(0, Math.round(media.duration * 1e3));
    }
    return 0;
  }
  function updateTimelinePlaybackUi() {
    const media = getTimelineSyncMedia();
    const playhead = getTimelinePlayhead();
    const playheadLabel = getTimelinePlayheadLabel();
    const durationMs = Math.max(1, getTimelineDurationMs(media));
    const currentMs = media && typeof media.currentTime === "number" && Number.isFinite(media.currentTime) ? Math.max(0, Math.round(media.currentTime * 1e3)) : 0;
    const clampedCurrentMs = Math.max(0, Math.min(durationMs, currentMs));
    const leftPct = Math.max(0, Math.min(100, clampedCurrentMs / durationMs * 100));
    if (playhead?.style) {
      playhead.style.left = `${String(leftPct)}%`;
      playhead.style.opacity = media === null ? "0" : "1";
    }
    playhead?.setAttribute?.("data-active", media === null ? "false" : "true");
    if (playheadLabel) {
      playheadLabel.textContent = formatTimelineTimeMs(clampedCurrentMs);
    }
  }
  function handleTimelineMediaPlaybackChange() {
    updateTimelinePlaybackUi();
  }
  function bindTimelinePlaybackListeners() {
    const nextMedia = getTimelineSyncMedia();
    if (boundTimelineSyncMedia === nextMedia) {
      return;
    }
    if (boundTimelineSyncMedia?.removeEventListener) {
      boundTimelineSyncMedia.removeEventListener("timeupdate", handleTimelineMediaPlaybackChange);
      boundTimelineSyncMedia.removeEventListener("play", handleTimelineMediaPlaybackChange);
      boundTimelineSyncMedia.removeEventListener("pause", handleTimelineMediaPlaybackChange);
      boundTimelineSyncMedia.removeEventListener("seeking", handleTimelineMediaPlaybackChange);
      boundTimelineSyncMedia.removeEventListener("seeked", handleTimelineMediaPlaybackChange);
      boundTimelineSyncMedia.removeEventListener(
        "loadedmetadata",
        handleTimelineMediaPlaybackChange
      );
      boundTimelineSyncMedia.removeEventListener(
        "durationchange",
        handleTimelineMediaPlaybackChange
      );
      boundTimelineSyncMedia.removeEventListener("ended", handleTimelineMediaPlaybackChange);
    }
    if (nextMedia?.addEventListener) {
      nextMedia.addEventListener("timeupdate", handleTimelineMediaPlaybackChange);
      nextMedia.addEventListener("play", handleTimelineMediaPlaybackChange);
      nextMedia.addEventListener("pause", handleTimelineMediaPlaybackChange);
      nextMedia.addEventListener("seeking", handleTimelineMediaPlaybackChange);
      nextMedia.addEventListener("seeked", handleTimelineMediaPlaybackChange);
      nextMedia.addEventListener("loadedmetadata", handleTimelineMediaPlaybackChange);
      nextMedia.addEventListener("durationchange", handleTimelineMediaPlaybackChange);
      nextMedia.addEventListener("ended", handleTimelineMediaPlaybackChange);
    }
    boundTimelineSyncMedia = nextMedia;
  }
  function syncTimelinePlaybackUiFromState() {
    bindTimelinePlaybackListeners();
    updateTimelinePlaybackUi();
  }
  function getRoomApi() {
    return deps.windowRef.roomAPI;
  }
  function createActionRequestId(action) {
    return `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function sendMediaAction(action, payload = {}, options = {}) {
    const roomApi = getRoomApi();
    if (!roomApi || typeof roomApi.sendEvent !== "function") {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Room API bridge is not connected.", "error")
      });
      return null;
    }
    const state = deps.store.getState();
    const requestId = options.requestId || createActionRequestId(action);
    roomApi.sendEvent("media-action", {
      requestId,
      action,
      payload: {
        featureId: state.featureId,
        ...payload
      }
    });
    return requestId;
  }
  function startTrackedUserAction(action, payload = {}) {
    const definition = getTrackedLabUserActionDefinition(action);
    if (!definition) {
      return sendMediaAction(action, payload);
    }
    const state = deps.store.getState();
    const requestId = createActionRequestId(action);
    const sentRequestId = sendMediaAction(action, payload, { requestId });
    if (sentRequestId === null) {
      return null;
    }
    dispatch({
      type: "user-action-added",
      actionEvent: {
        id: createLabEventId("user-action"),
        type: definition.type,
        label: definition.label,
        status: "running",
        startedAt: Date.now(),
        dismissedFromHubAt: null,
        projectId: state.projectIndex.activeProjectId,
        requestId: sentRequestId,
        sourceAction: action
      }
    });
    return sentRequestId;
  }
  function startTrackedReportExport() {
    const state = deps.store.getState();
    return startTrackedUserAction(
      state.featureId === "audio-analysis" ? "audio-report-export" : "report-export"
    );
  }
  function getCurrentRunIntentPayload(state = deps.store.getState()) {
    const intentIds = toStringArray(getCurrentRun(state)?.analysisScope?.intentIds);
    return intentIds.length > 0 ? { intentIds } : {};
  }
  function clearHubDismissTimer(actionId) {
    const timer = hubDismissTimers.get(actionId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    hubDismissTimers.delete(actionId);
  }
  function scheduleHubDismiss(actionId) {
    if (hubDismissTimers.has(actionId)) {
      return;
    }
    hubDismissTimers.set(
      actionId,
      setTimeout(function() {
        hubDismissTimers.delete(actionId);
        dispatch({
          type: "user-action-hub-dismissed",
          id: actionId
        });
      }, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS)
    );
  }
  function syncUserActionHubTimers() {
    const state = deps.store.getState();
    const activeUserActionIds = /* @__PURE__ */ new Set();
    getUserActions(state).forEach(function(entry) {
      activeUserActionIds.add(entry.id);
      if (entry.status === "success" && entry.dismissedFromHubAt == null) {
        if (Array.isArray(entry.resultAssetIds) && entry.resultAssetIds.length > 0 && getActionOutputs(state, entry.id).length === 0) {
          clearHubDismissTimer(entry.id);
          return;
        }
        scheduleHubDismiss(entry.id);
        return;
      }
      clearHubDismissTimer(entry.id);
    });
    Array.from(hubDismissTimers.keys()).forEach(function(actionId) {
      if (!activeUserActionIds.has(actionId)) {
        clearHubDismissTimer(actionId);
      }
    });
  }
  function handleBusEvent(_event) {
    syncUserActionHubTimers();
  }
  function sendHostContext(payload) {
    const roomApi = getRoomApi();
    if (!roomApi || typeof roomApi.sendEvent !== "function") {
      return;
    }
    roomApi.sendEvent("host-context", payload);
  }
  function updateWorkbench(update) {
    const state = deps.store.getState();
    const currentWorkbench = {
      ...getWorkbench(state)
    };
    const nextWorkbench = update(currentWorkbench);
    dispatch({
      type: "workbench-updated",
      workbench: nextWorkbench
    });
    sendHostContext({
      ...state.context,
      workbench: nextWorkbench
    });
  }
  function findBlankProjectId(state) {
    const blankProject = state.projectIndex.projects.find(function(project) {
      return project["hasSource"] === false;
    });
    return asNonEmptyString(blankProject?.["id"]) || null;
  }
  function getActiveProjectCreatedAt(state) {
    const snapshot = asLabRecord(state.snapshot);
    const activeProject = asLabRecord(snapshot["activeProject"]);
    return activeProject["createdAt"];
  }
  function getSourcePresets(state) {
    return asLabRecord(asLabRecord(state.snapshot)["sourcePresets"]);
  }
  function getSourceModeOptions(state, kind) {
    const sourcePresets = getSourcePresets(state);
    const sourceTypes = asLabRecord(sourcePresets["sourceTypes"]);
    const sourceConfig = asLabRecord(sourceTypes[toStringValue(kind)]);
    const configuredModes = toStringArray(sourceConfig["modes"]);
    return configuredModes.length > 0 ? configuredModes : ["local"];
  }
  function getDefaultSourceMode(state, kind) {
    const sourcePresets = getSourcePresets(state);
    const sourceTypes = asLabRecord(sourcePresets["sourceTypes"]);
    const sourceConfig = asLabRecord(sourceTypes[toStringValue(kind)]);
    const configuredDefault = asNonEmptyString(sourceConfig["defaultMode"]);
    if (configuredDefault) {
      return configuredDefault;
    }
    return getSourceModeOptions(state, kind)[0] || "local";
  }
  function getDefaultSourceKind(state) {
    const sourcePresets = getSourcePresets(state);
    const configuredDefault = asNonEmptyString(sourcePresets["defaultSourceType"]);
    if (configuredDefault) {
      return configuredDefault;
    }
    const sourceTypes = asLabRecord(sourcePresets["sourceTypes"]);
    const firstConfiguredKind = Object.keys(sourceTypes).find(function(entry) {
      return entry.trim() !== "";
    });
    return firstConfiguredKind || "video";
  }
  function getDefaultYoutubePreset(state) {
    const sourcePresets = getSourcePresets(state);
    const presets = asLabRecord(sourcePresets["youtubePresets"]);
    if (asLabRecord(presets)["medium"]) {
      return "medium";
    }
    if (asLabRecord(presets)["custom"]) {
      return "custom";
    }
    return Object.keys(presets)[0] || "medium";
  }
  function getYoutubePresetDefaults(state, presetId) {
    const sourcePresets = getSourcePresets(state);
    const presets = asLabRecord(sourcePresets["youtubePresets"]);
    const resolvedPresetId = presetId || getDefaultYoutubePreset(state);
    return asLabRecord(asLabRecord(presets[resolvedPresetId])["defaultCustomValues"]);
  }
  function buildEmptySourceState(state) {
    const kind = getDefaultSourceKind(state);
    const mode = getDefaultSourceMode(state, kind);
    const youtubePreset = getDefaultYoutubePreset(state);
    return {
      kind,
      mode,
      status: "idle",
      storedPath: null,
      storedFileName: null,
      sourceUrl: null,
      mimeType: null,
      routeLabel: null,
      lastError: null,
      metadata: null,
      metadataError: null,
      previewUrl: null,
      drafts: {
        fileNameHint: "",
        urlInput: "",
        youtubeUrl: "",
        youtubePreset,
        youtubeCustom: {
          ...getYoutubePresetDefaults(state, youtubePreset)
        }
      }
    };
  }
  function mergeSourceDrafts(state, patch) {
    const currentDrafts = state.ui.sourceDrafts;
    return {
      ...currentDrafts,
      ...patch,
      youtubeCustom: patch.youtubeCustom !== void 0 ? {
        ...asLabRecord(currentDrafts.youtubeCustom),
        ...asLabRecord(patch.youtubeCustom)
      } : asLabRecord(currentDrafts.youtubeCustom)
    };
  }
  function buildSourceDraftPatch(state, field, value) {
    const currentDrafts = state.ui.sourceDrafts;
    switch (field) {
      case "source.fileNameHint":
        return {
          fileNameHint: typeof value === "string" ? value : ""
        };
      case "source.urlInput":
        return {
          urlInput: typeof value === "string" ? value : ""
        };
      case "source.youtubeUrl":
        return {
          youtubeUrl: typeof value === "string" ? value : ""
        };
      case "source.youtubePreset": {
        const presetId = typeof value === "string" && value.trim() !== "" ? value : getDefaultYoutubePreset(state);
        return {
          youtubePreset: presetId,
          youtubeCustom: Object.keys(asLabRecord(currentDrafts.youtubeCustom)).length > 0 ? asLabRecord(currentDrafts.youtubeCustom) : { ...getYoutubePresetDefaults(state, presetId) }
        };
      }
      case "source.youtubeCaptureMode": {
        const mode = value === "audio-only" || value === "video-only" ? value : "video+audio";
        return {
          youtubeCaptureMode: mode
        };
      }
      default:
        if (field.startsWith("source.youtubeCustom.")) {
          const customField = field.replace("source.youtubeCustom.", "");
          const presetId = asNonEmptyString(currentDrafts.youtubePreset) || getDefaultYoutubePreset(state);
          return {
            youtubeCustom: {
              ...getYoutubePresetDefaults(state, presetId),
              ...asLabRecord(currentDrafts.youtubeCustom),
              [customField]: value
            }
          };
        }
        return null;
    }
  }
  function persistSourceDraftField(field, value) {
    const state = deps.store.getState();
    const patch = buildSourceDraftPatch(state, field, value);
    if (patch === null) {
      return;
    }
    dispatch({
      type: "source-drafts-updated",
      patch
    });
    sendMediaAction("source-update-draft", {
      fields: mergeSourceDrafts(state, patch)
    });
  }
  function selectProjectByValue(projectValue) {
    const state = deps.store.getState();
    if (projectValue === "new") {
      const resetSourceState = buildEmptySourceState(state);
      dispatch({
        type: "source-config-patched",
        patch: resetSourceState
      });
      dispatch({
        type: "source-drafts-updated",
        patch: resetSourceState.drafts
      });
      dispatch({
        type: "source-drafts-committed"
      });
      const blankProjectId = findBlankProjectId(state);
      if (blankProjectId !== null) {
        sendMediaAction("project-select", { projectId: blankProjectId, resetSourceState });
        return;
      }
      sendMediaAction("project-create");
      return;
    }
    if (projectValue.trim() !== "") {
      sendMediaAction("project-select", { projectId: projectValue });
    }
  }
  function updateAnalysisScopeField(field, value) {
    updateWorkbench(function(workbench) {
      const nextScope = toDraftScope(workbench);
      const nextTimeRange = { ...asLabRecord(nextScope["timeRange"]) };
      const nextFrameRange = { ...asLabRecord(nextScope["frameRange"]) };
      const nextRegion = { ...asLabRecord(nextScope["region"]) };
      function readNumeric(nextValue) {
        if (nextValue === null || nextValue === "") {
          return null;
        }
        const numericValue = Number(nextValue);
        return Number.isFinite(numericValue) ? numericValue : null;
      }
      switch (field) {
        case "focus":
          if (typeof value === "string" && value.trim() !== "") {
            nextScope["focus"] = value;
          } else {
            delete nextScope["focus"];
          }
          break;
        case "hypothesis":
          if (typeof value === "string" && value.trim() !== "") {
            nextScope["hypothesis"] = value.trim();
          } else {
            delete nextScope["hypothesis"];
          }
          break;
        case "intentIds": {
          const nextIntentIds = Array.isArray(value) ? value.filter((entry) => typeof entry === "string").map(function(entry) {
            return entry.trim();
          }).filter(function(entry) {
            return entry !== "";
          }) : [];
          if (nextIntentIds.length > 0) {
            nextScope["intentIds"] = Array.from(new Set(nextIntentIds));
          } else {
            delete nextScope["intentIds"];
          }
          break;
        }
        case "timeStartMs":
        case "timeEndMs": {
          const nextValue = readNumeric(value);
          const targetKey = field === "timeStartMs" ? "startMs" : "endMs";
          if (nextValue === null) {
            delete nextTimeRange[targetKey];
          } else {
            nextTimeRange[targetKey] = Math.max(0, Math.round(nextValue));
          }
          if (typeof nextTimeRange["startMs"] === "number" && typeof nextTimeRange["endMs"] === "number" && nextTimeRange["endMs"] > nextTimeRange["startMs"]) {
            nextScope["timeRange"] = nextTimeRange;
          } else {
            delete nextScope["timeRange"];
          }
          break;
        }
        case "frameStart":
        case "frameEnd": {
          const nextValue = readNumeric(value);
          const targetKey = field === "frameStart" ? "startFrame" : "endFrame";
          if (nextValue === null) {
            delete nextFrameRange[targetKey];
          } else {
            nextFrameRange[targetKey] = Math.max(0, Math.round(nextValue));
          }
          if (typeof nextFrameRange["startFrame"] === "number" && typeof nextFrameRange["endFrame"] === "number") {
            nextScope["frameRange"] = nextFrameRange;
          } else {
            delete nextScope["frameRange"];
          }
          break;
        }
        case "regionX":
        case "regionY":
        case "regionWidth":
        case "regionHeight": {
          const nextValue = readNumeric(value);
          const targetKey = field === "regionX" ? "x" : field === "regionY" ? "y" : field === "regionWidth" ? "width" : "height";
          if (nextValue === null) {
            delete nextRegion[targetKey];
          } else {
            nextRegion[targetKey] = targetKey === "width" || targetKey === "height" ? Math.max(1, Math.round(nextValue)) : Math.max(0, Math.round(nextValue));
          }
          if (typeof nextRegion["x"] === "number" && typeof nextRegion["y"] === "number" && typeof nextRegion["width"] === "number" && typeof nextRegion["height"] === "number") {
            nextScope["region"] = nextRegion;
          } else {
            delete nextScope["region"];
          }
          break;
        }
        default:
          break;
      }
      if (nextScope["focus"] === void 0 && nextScope["hypothesis"] === void 0 && nextScope["timeRange"] === void 0 && nextScope["frameRange"] === void 0 && nextScope["region"] === void 0 && nextScope["intentIds"] === void 0) {
        return {
          ...workbench,
          analysisScope: null
        };
      }
      return {
        ...workbench,
        analysisScope: nextScope
      };
    });
  }
  function toggleModule(moduleId) {
    if (moduleId.trim() === "") {
      return;
    }
    updateWorkbench(function(workbench) {
      const moduleToggles = {
        ...asLabRecord(workbench["moduleToggles"])
      };
      moduleToggles[moduleId] = moduleToggles[moduleId] === false;
      return {
        ...workbench,
        moduleToggles
      };
    });
  }
  function activateFeature(featureId) {
    dispatch({
      type: "feature-changed",
      featureId
    });
    updateWorkbench(function(workbench) {
      const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"]) ? workbench["selectedModuleIds"].filter(
        (entry) => typeof entry === "string"
      ) : [];
      return {
        ...workbench,
        activeModuleId: featureId,
        selectedModuleIds: selectedModuleIds.includes(featureId) ? selectedModuleIds : [featureId].concat(selectedModuleIds)
      };
    });
  }
  function toggleFeature(featureId) {
    updateWorkbench(function(workbench) {
      const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"]) ? workbench["selectedModuleIds"].filter(
        (entry) => typeof entry === "string"
      ) : [];
      const activeModuleId = asNonEmptyString(workbench["activeModuleId"]) || featureId;
      const nextSelected = selectedModuleIds.includes(featureId) ? selectedModuleIds.filter(function(entry) {
        return entry !== featureId;
      }) : selectedModuleIds.concat(featureId);
      const safeSelected = nextSelected.length > 0 ? nextSelected : [featureId];
      return {
        ...workbench,
        activeModuleId: safeSelected.includes(activeModuleId) ? activeModuleId : safeSelected[0],
        selectedModuleIds: safeSelected
      };
    });
  }
  function syncCapabilities(nextCapabilities) {
    const normalizedCapabilities = Array.from(
      new Set(
        nextCapabilities.filter(function(entry) {
          return entry.trim() !== "";
        })
      )
    );
    const { activeFeatureId, featureIds } = deriveFeatureSelectionFromCapabilities(normalizedCapabilities);
    dispatch({
      type: "capability-set",
      capabilities: normalizedCapabilities
    });
    dispatch({
      type: "feature-changed",
      featureId: activeFeatureId
    });
    updateWorkbench(function(workbench) {
      return {
        ...workbench,
        activeModuleId: activeFeatureId,
        selectedModuleIds: featureIds,
        selectedCapabilityIds: normalizedCapabilities
      };
    });
  }
  function runSourcePrimaryAction() {
    const state = deps.store.getState();
    const sourceDrafts = state.ui.sourceDrafts;
    function startProbe(action, payload) {
      sendMediaAction(action, payload);
    }
    const mode = getSourceMode(state);
    const fields = {
      fileNameHint: sourceDrafts.fileNameHint,
      urlInput: sourceDrafts.urlInput,
      youtubeUrl: sourceDrafts.youtubeUrl,
      youtubePreset: sourceDrafts.youtubePreset,
      youtubeCustom: sourceDrafts.youtubeCustom,
      youtubeCaptureMode: sourceDrafts.youtubeCaptureMode
    };
    if (mode === "url") {
      startProbe("source-download-url", { fields });
      return;
    }
    if (mode === "youtube") {
      startProbe("source-download-youtube", { fields });
      return;
    }
    startProbe("source-pick-local", { fields });
  }
  function collectIntentCapabilities(selectedIntents) {
    const intentCapabilities = [];
    WORKSPACE_INTENTS.forEach(function(intent) {
      if (selectedIntents.includes(intent.id)) {
        intent.internalCapabilities.forEach(function(capId) {
          if (!intentCapabilities.includes(capId)) {
            intentCapabilities.push(capId);
          }
        });
      }
    });
    return intentCapabilities;
  }
  function startDeepAnalysis(state) {
    const ws = state.ui.workspace;
    const intentCapabilities = ws.selectedIntents.length > 0 ? collectIntentCapabilities(ws.selectedIntents) : state.selectedCapabilities.slice();
    const { activeFeatureId } = deriveFeatureSelectionFromCapabilities(intentCapabilities);
    syncCapabilities(intentCapabilities);
    updateAnalysisScopeField("timeStartMs", ws.timelineStartMs);
    updateAnalysisScopeField("timeEndMs", ws.timelineEndMs);
    updateAnalysisScopeField("hypothesis", ws.hypothesis);
    updateAnalysisScopeField("intentIds", ws.selectedIntents);
    const sourceRecord = asLabRecord(state.source);
    if (asNonEmptyString(sourceRecord["previewUrl"]) === null) {
      sendMediaAction("edit-preview");
    }
    sendMediaAction("profile-run-preflight");
    dispatch({
      type: "workspace-process-view-toggled",
      force: true
    });
    sendMediaAction(activeFeatureId === "audio-analysis" ? "audio-process-run" : "process-run");
  }
  function runPrimaryAction() {
    const state = deps.store.getState();
    if (hasReportPayload(state) && (state.ui.workspace.reportOverlayOpen || isRunComplete(state))) {
      startTrackedReportExport();
      return;
    }
    if (isRunActive(state)) {
      sendMediaAction(
        state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel"
      );
      return;
    }
    if (getSourceReady(state) && getAnalysisActionBlockReason(state) === null) {
      startDeepAnalysis(state);
      return;
    }
    if (getSourceReady(state) && getEditActionBlockReason(state) === null) {
      sendMediaAction("edit-preview");
      return;
    }
    runSourcePrimaryAction();
  }
  function findAsset(assetId) {
    return deps.store.getState().assets.find(function(asset) {
      return asset.id === assetId;
    }) || null;
  }
  function getAssetHref(assetId) {
    const asset = findAsset(assetId);
    if (asset === null) {
      return null;
    }
    return asNonEmptyString(asset.url) || asNonEmptyString(asset.localPath);
  }
  function previewAsset(assetId) {
    const href = getAssetHref(assetId);
    if (href === null) {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Asset preview is unavailable.", "warning")
      });
      return;
    }
    dispatch({ type: "asset-preview-opened", assetId });
  }
  function downloadAsset(assetId) {
    const asset = findAsset(assetId);
    const href = getAssetHref(assetId);
    if (asset === null || href === null) {
      return;
    }
    const link = deps.documentRef.createElement("a");
    link.href = href;
    link.download = asset.name;
    link.rel = "noopener";
    deps.documentRef.body.appendChild(link);
    link.click();
    link.remove();
  }
  function focusSourcePreview() {
    const preview = deps.documentRef.querySelector?.("#lab-workspace-preview");
    if (!preview || typeof preview.scrollIntoView !== "function") {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Source preview is unavailable.", "warning")
      });
      return;
    }
    preview.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    if (typeof preview.focus === "function") {
      preview.focus();
    }
  }
  function getDualPreviewMaster() {
    const candidate = deps.documentRef.querySelector?.(
      '[data-lab-role="dual-preview-master"]'
    );
    return isMediaLikeElement(candidate) ? candidate : null;
  }
  function getDualPreviewSlave() {
    const candidate = deps.documentRef.querySelector?.(
      '[data-lab-role="dual-preview-slave"]'
    );
    return isMediaLikeElement(candidate) ? candidate : null;
  }
  function getDualPreviewProgressInput() {
    return deps.documentRef.querySelector?.(
      '[data-lab-role="dual-preview-progress"]'
    );
  }
  function getDualPreviewVolumeInput() {
    return deps.documentRef.querySelector?.(
      '[data-lab-role="dual-preview-volume"]'
    );
  }
  function getDualPreviewPlayLabel() {
    return deps.documentRef.querySelector?.(
      '[data-lab-role="dual-preview-play-label"]'
    );
  }
  function getDualPreviewTimeLabel() {
    return deps.documentRef.querySelector?.(
      '[data-lab-role="dual-preview-time"]'
    );
  }
  function getDualPreviewSourceKey() {
    const state = deps.store.getState();
    const sourceRecord = asLabRecord(state.source);
    return asNonEmptyString(sourceRecord["storedPath"]) || asNonEmptyString(sourceRecord["previewUrl"]) || asNonEmptyString(sourceRecord["storedFileName"]);
  }
  function getDualPreviewOffsetSeconds() {
    const selectedAudio = getSelectedDualPreviewAudioAsset(deps.store.getState());
    if (selectedAudio === null) {
      return 0;
    }
    const metadata = asLabRecord(selectedAudio.metadata);
    return typeof metadata["startOffsetMs"] === "number" ? metadata["startOffsetMs"] / 1e3 : 0;
  }
  function getDualPreviewDurationSeconds(master) {
    if (master && typeof master.duration === "number" && Number.isFinite(master.duration)) {
      return Math.max(0, master.duration);
    }
    const metadata = asLabRecord(asLabRecord(deps.store.getState().source)["metadata"]);
    return typeof metadata["durationSeconds"] === "number" ? Math.max(0, metadata["durationSeconds"]) : 0;
  }
  function clampMediaTime(media, seconds) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    if (media && typeof media.duration === "number" && Number.isFinite(media.duration)) {
      return Math.max(0, Math.min(media.duration, safeSeconds));
    }
    return safeSeconds;
  }
  function safePlay(media) {
    try {
      const result = media?.play?.();
      if (result && typeof result.then === "function") {
        void result.then(
          function() {
          },
          function() {
          }
        );
      }
    } catch {
    }
  }
  function attemptDualPreviewSlavePlayback(slave, explicitAttempt) {
    if (slave.paused === false) {
      dualPreviewSlaveAutoplayBlocked = false;
      return;
    }
    if (explicitAttempt !== true && dualPreviewSlaveAutoplayBlocked) {
      return;
    }
    try {
      const result = slave.play?.();
      if (result && typeof result.then === "function") {
        void result.then(
          function() {
            dualPreviewSlaveAutoplayBlocked = false;
          },
          function() {
            dualPreviewSlaveAutoplayBlocked = true;
          }
        );
      } else {
        dualPreviewSlaveAutoplayBlocked = false;
      }
    } catch {
      dualPreviewSlaveAutoplayBlocked = true;
    }
  }
  function flushPendingDualPreviewSlaveSeek() {
    const slave = getDualPreviewSlave();
    if (slave === null || dualPreviewPendingSlaveSeekSeconds === null || isMediaMetadataReady(slave) !== true) {
      return;
    }
    slave.currentTime = clampMediaTime(slave, dualPreviewPendingSlaveSeekSeconds);
    dualPreviewPendingSlaveSeekSeconds = null;
  }
  function updateDualPreviewTransportUi() {
    const state = deps.store.getState();
    const master = getDualPreviewMaster();
    const playLabel = getDualPreviewPlayLabel();
    const progressInput = getDualPreviewProgressInput();
    const volumeInput = getDualPreviewVolumeInput();
    const timeLabel = getDualPreviewTimeLabel();
    const durationSeconds = getDualPreviewDurationSeconds(master);
    const currentSeconds = master && typeof master.currentTime === "number" && Number.isFinite(master.currentTime) ? Math.max(0, master.currentTime) : 0;
    if (playLabel) {
      playLabel.textContent = master && master.paused === false ? "❚❚" : "▶";
    }
    if (progressInput) {
      progressInput.max = String(Math.max(0, Math.round(durationSeconds * 1e3)));
      progressInput.value = String(Math.max(0, Math.round(currentSeconds * 1e3)));
    }
    if (volumeInput) {
      volumeInput.value = String(getDualPreviewVolume(state));
    }
    if (timeLabel) {
      timeLabel.textContent = `${formatClockTime(currentSeconds)} / ${formatClockTime(
        durationSeconds
      )}`;
    }
    updateTimelinePlaybackUi();
  }
  function syncDualPreviewVolume() {
    const state = deps.store.getState();
    const master = getDualPreviewMaster();
    const slave = getDualPreviewSlave();
    const volume = getDualPreviewVolume(state);
    if (master) {
      master.muted = true;
      if (typeof master.volume === "number") {
        master.volume = 0;
      }
    }
    if (slave && typeof slave.volume === "number") {
      slave.volume = volume;
    }
  }
  function syncSlaveToMaster(options = {}) {
    const state = deps.store.getState();
    if (isDualPreviewActive(state) !== true) {
      return;
    }
    const master = getDualPreviewMaster();
    const slave = getDualPreviewSlave();
    if (master === null || slave === null) {
      return;
    }
    const offsetSeconds = getDualPreviewOffsetSeconds();
    const targetSeconds = clampMediaTime(slave, master.currentTime + offsetSeconds);
    if (isMediaMetadataReady(slave) !== true) {
      dualPreviewPendingSlaveSeekSeconds = targetSeconds;
      syncDualPreviewVolume();
      updateDualPreviewTransportUi();
      return;
    }
    const driftSeconds = Math.abs(slave.currentTime - targetSeconds);
    if (options.force === true || driftSeconds > 0.2) {
      slave.currentTime = targetSeconds;
    }
    dualPreviewPendingSlaveSeekSeconds = null;
    syncDualPreviewVolume();
    if (options.play === true || master.paused === false && slave.paused === true) {
      attemptDualPreviewSlavePlayback(slave, options.explicitPlaybackAttempt === true);
    } else {
      slave.pause?.();
    }
    updateDualPreviewTransportUi();
  }
  function seekDualPreviewToMs(timeMs) {
    const state = deps.store.getState();
    if (isDualPreviewActive(state) !== true) {
      return false;
    }
    const master = getDualPreviewMaster();
    if (master === null) {
      return false;
    }
    master.currentTime = clampMediaTime(master, timeMs / 1e3);
    syncSlaveToMaster({ force: true });
    updateDualPreviewTransportUi();
    return true;
  }
  function seekSinglePreviewToMs(timeMs) {
    const media = getPrimaryWorkspacePreviewMedia();
    if (media !== null) {
      media.currentTime = clampMediaTime(media, timeMs / 1e3);
      updateTimelinePlaybackUi();
      return true;
    }
    const mediaEls = deps.documentRef.querySelectorAll(".labx-preview-media");
    mediaEls.forEach(function(el) {
      el.currentTime = timeMs / 1e3;
    });
    updateTimelinePlaybackUi();
    return mediaEls.length > 0;
  }
  function seekTimelineToMs(timeMs) {
    const state = deps.store.getState();
    if (isDualPreviewActive(state) === true) {
      if (seekDualPreviewToMs(timeMs)) {
        return true;
      }
      dispatch({
        type: "push-event",
        event: buildUiEvent("Dual preview seek is unavailable until media is ready.", "warning")
      });
      return false;
    }
    return seekSinglePreviewToMs(timeMs);
  }
  function handleDualPreviewMasterPlay() {
    syncSlaveToMaster({ force: true, play: true, explicitPlaybackAttempt: true });
  }
  function handleDualPreviewMasterPause() {
    getDualPreviewSlave()?.pause?.();
    updateDualPreviewTransportUi();
  }
  function handleDualPreviewMasterTimeUpdate() {
    syncSlaveToMaster();
  }
  function handleDualPreviewMasterSeeked() {
    syncSlaveToMaster({ force: true });
  }
  function handleDualPreviewMasterLoadedMetadata() {
    updateDualPreviewTransportUi();
    syncSlaveToMaster({ force: true });
  }
  function handleDualPreviewMasterEnded() {
    const slave = getDualPreviewSlave();
    slave?.pause?.();
    dualPreviewSlaveAutoplayBlocked = false;
    dualPreviewPendingSlaveSeekSeconds = null;
    updateDualPreviewTransportUi();
  }
  function handleDualPreviewSlaveLoadedMetadata() {
    flushPendingDualPreviewSlaveSeek();
    syncSlaveToMaster({ force: true });
  }
  function handleDualPreviewSlaveEnded() {
    const master = getDualPreviewMaster();
    if (master?.paused === false) {
      master.pause?.();
    }
    dualPreviewSlaveAutoplayBlocked = false;
    dualPreviewPendingSlaveSeekSeconds = null;
    updateDualPreviewTransportUi();
  }
  function bindDualPreviewMediaListeners() {
    const nextMaster = getDualPreviewMaster();
    if (boundDualPreviewMaster !== nextMaster) {
      if (boundDualPreviewMaster?.removeEventListener) {
        boundDualPreviewMaster.removeEventListener("play", handleDualPreviewMasterPlay);
        boundDualPreviewMaster.removeEventListener("pause", handleDualPreviewMasterPause);
        boundDualPreviewMaster.removeEventListener("timeupdate", handleDualPreviewMasterTimeUpdate);
        boundDualPreviewMaster.removeEventListener("seeking", handleDualPreviewMasterSeeked);
        boundDualPreviewMaster.removeEventListener("seeked", handleDualPreviewMasterSeeked);
        boundDualPreviewMaster.removeEventListener(
          "loadedmetadata",
          handleDualPreviewMasterLoadedMetadata
        );
        boundDualPreviewMaster.removeEventListener("ended", handleDualPreviewMasterEnded);
      }
      if (nextMaster?.addEventListener) {
        nextMaster.addEventListener("play", handleDualPreviewMasterPlay);
        nextMaster.addEventListener("pause", handleDualPreviewMasterPause);
        nextMaster.addEventListener("timeupdate", handleDualPreviewMasterTimeUpdate);
        nextMaster.addEventListener("seeking", handleDualPreviewMasterSeeked);
        nextMaster.addEventListener("seeked", handleDualPreviewMasterSeeked);
        nextMaster.addEventListener("loadedmetadata", handleDualPreviewMasterLoadedMetadata);
        nextMaster.addEventListener("ended", handleDualPreviewMasterEnded);
      }
      boundDualPreviewMaster = nextMaster;
    }
    const nextSlave = getDualPreviewSlave();
    if (boundDualPreviewSlave !== nextSlave) {
      if (boundDualPreviewSlave?.removeEventListener) {
        boundDualPreviewSlave.removeEventListener(
          "loadedmetadata",
          handleDualPreviewSlaveLoadedMetadata
        );
        boundDualPreviewSlave.removeEventListener("ended", handleDualPreviewSlaveEnded);
      }
      if (nextSlave?.addEventListener) {
        nextSlave.addEventListener("loadedmetadata", handleDualPreviewSlaveLoadedMetadata);
        nextSlave.addEventListener("ended", handleDualPreviewSlaveEnded);
      }
      boundDualPreviewSlave = nextSlave;
    }
  }
  function syncDualPreviewFromState() {
    bindDualPreviewMediaListeners();
    const state = deps.store.getState();
    const nextSnapshot = {
      enabled: isDualPreviewActive(state),
      audioAssetId: getSelectedDualPreviewAudioAsset(state)?.id || null,
      sourceKey: getDualPreviewSourceKey(),
      volume: getDualPreviewVolume(state)
    };
    const shouldForceSync = dualPreviewStateSnapshot.enabled !== nextSnapshot.enabled || dualPreviewStateSnapshot.audioAssetId !== nextSnapshot.audioAssetId || dualPreviewStateSnapshot.sourceKey !== nextSnapshot.sourceKey;
    if (nextSnapshot.enabled !== true) {
      boundDualPreviewSlave?.pause?.();
      dualPreviewSlaveAutoplayBlocked = false;
      dualPreviewPendingSlaveSeekSeconds = null;
      updateDualPreviewTransportUi();
      dualPreviewStateSnapshot = nextSnapshot;
      return;
    }
    syncDualPreviewVolume();
    syncSlaveToMaster({ force: shouldForceSync });
    updateDualPreviewTransportUi();
    dualPreviewStateSnapshot = nextSnapshot;
  }
  let timelineDragMode = "none";
  let timelineDragTrack = null;
  let timelineDragDurationMs = 0;
  let timelineDragAnchorMs = 0;
  let timelineDragBodyOffsetStart = 0;
  let timelineDragBodyOffsetEnd = 0;
  let timelineDragBodyPointerOffsetMs = 0;
  let timelinePendingClientX = 0;
  let timelinePendingShiftKey = false;
  const TIMELINE_DRAG_THRESHOLD_PX = 4;
  function msFromTrackClientX(track, durationMs, clientX) {
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = x / rect.width;
    return Math.max(0, Math.round(durationMs * pct));
  }
  function msFromTrackX(clientX) {
    if (!timelineDragTrack) return 0;
    return msFromTrackClientX(timelineDragTrack, timelineDragDurationMs, clientX);
  }
  function startTimelineDrag(track, anchorMs, durationMs) {
    timelineDragMode = "rail";
    timelineDragTrack = track;
    timelineDragDurationMs = durationMs;
    timelineDragAnchorMs = anchorMs;
    dispatch({ type: "workspace-timeline-updated", startMs: anchorMs, endMs: anchorMs });
  }
  function startTimelinePendingSeek(track, anchorMs, durationMs, clientX, shiftKey, event) {
    event.preventDefault();
    timelineDragMode = "pending-seek";
    timelineDragTrack = track;
    timelineDragDurationMs = durationMs;
    timelineDragAnchorMs = anchorMs;
    timelinePendingClientX = clientX;
    timelinePendingShiftKey = shiftKey;
  }
  function startTimelineHandleDrag(track, mode, durationMs, event) {
    event.preventDefault();
    event.stopPropagation();
    timelineDragMode = mode;
    timelineDragTrack = track;
    timelineDragDurationMs = durationMs;
  }
  function startTimelineBodyDrag(track, durationMs, event) {
    event.preventDefault();
    event.stopPropagation();
    const state = deps.store.getState();
    const currentStart = state.ui.workspace.timelineStartMs ?? 0;
    const currentEnd = state.ui.workspace.timelineEndMs ?? durationMs;
    const pointerMs = msFromTrackClientX(track, durationMs, event.clientX);
    timelineDragMode = "body";
    timelineDragTrack = track;
    timelineDragDurationMs = durationMs;
    timelineDragBodyOffsetStart = currentStart;
    timelineDragBodyOffsetEnd = currentEnd;
    timelineDragBodyPointerOffsetMs = Math.max(
      0,
      Math.min(currentEnd - currentStart, pointerMs - currentStart)
    );
  }
  function extendTimelineSelectionToMs(timeMs) {
    const state = deps.store.getState();
    const existingStart = state.ui.workspace.timelineStartMs;
    const existingEnd = state.ui.workspace.timelineEndMs;
    if (existingStart !== null && existingEnd !== null) {
      const distStart = Math.abs(timeMs - existingStart);
      const distEnd = Math.abs(timeMs - existingEnd);
      if (distStart <= distEnd) {
        dispatch({ type: "workspace-timeline-updated", startMs: timeMs, endMs: existingEnd });
      } else {
        dispatch({ type: "workspace-timeline-updated", startMs: existingStart, endMs: timeMs });
      }
      return;
    }
    dispatch({ type: "workspace-timeline-updated", startMs: timeMs, endMs: timeMs });
  }
  function handleMouseDown(event) {
    if (!(event instanceof MouseEvent)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const handleEl = target.closest(
      "[data-lab-action='timeline-interact'], [data-lab-action='timeline-drag-start'], [data-lab-action='timeline-drag-end'], [data-lab-action='timeline-drag-body']"
    );
    if (!handleEl) return;
    const action = toStringValue(handleEl.dataset["labAction"]);
    const timeline = handleEl.closest(".labx-timeline");
    const track = timeline?.querySelector(".labx-timeline__track");
    if (!timeline || !track) return;
    const durationMs = Number(timeline.dataset["duration"] || 0);
    if (action === "timeline-interact") {
      const ms = msFromTrackClientX(track, durationMs, event.clientX);
      startTimelinePendingSeek(track, ms, durationMs, event.clientX, event.shiftKey, event);
    } else if (action === "timeline-drag-start" || action === "timeline-drag-end") {
      startTimelineHandleDrag(
        track,
        action === "timeline-drag-start" ? "start" : "end",
        durationMs,
        event
      );
    } else if (action === "timeline-drag-body") {
      startTimelineBodyDrag(track, durationMs, event);
    }
  }
  function handleTimelineMouseMove(event) {
    if (timelineDragMode === "none" || !timelineDragTrack) return;
    if (timelineDragMode === "pending-seek") {
      const shiftPx = Math.abs(event.clientX - timelinePendingClientX);
      if (shiftPx < TIMELINE_DRAG_THRESHOLD_PX) {
        return;
      }
      startTimelineDrag(timelineDragTrack, timelineDragAnchorMs, timelineDragDurationMs);
    }
    const ms = msFromTrackX(event.clientX);
    const state = deps.store.getState();
    if (timelineDragMode === "rail") {
      const startMs = Math.min(timelineDragAnchorMs, ms);
      const endMs = Math.max(timelineDragAnchorMs, ms);
      dispatch({ type: "workspace-timeline-updated", startMs, endMs });
    } else if (timelineDragMode === "start") {
      const currentEnd = state.ui.workspace.timelineEndMs ?? timelineDragDurationMs;
      const nextStart = Math.max(0, Math.min(ms, currentEnd));
      dispatch({ type: "workspace-timeline-updated", startMs: nextStart, endMs: currentEnd });
    } else if (timelineDragMode === "end") {
      const currentStart = state.ui.workspace.timelineStartMs ?? 0;
      const nextEnd = Math.max(currentStart, Math.min(ms, timelineDragDurationMs));
      dispatch({ type: "workspace-timeline-updated", startMs: currentStart, endMs: nextEnd });
    } else if (timelineDragMode === "body") {
      const rangeWidth = timelineDragBodyOffsetEnd - timelineDragBodyOffsetStart;
      const newStart = Math.max(
        0,
        Math.min(ms - timelineDragBodyPointerOffsetMs, timelineDragDurationMs - rangeWidth)
      );
      const newEnd = newStart + rangeWidth;
      dispatch({ type: "workspace-timeline-updated", startMs: newStart, endMs: newEnd });
    }
  }
  function handleTimelineMouseUp() {
    if (timelineDragMode === "none") return;
    if (timelineDragMode === "pending-seek") {
      if (timelinePendingShiftKey === true) {
        extendTimelineSelectionToMs(timelineDragAnchorMs);
      } else {
        seekTimelineToMs(timelineDragAnchorMs);
      }
    }
    timelineDragMode = "none";
    timelineDragTrack = null;
    timelineDragBodyPointerOffsetMs = 0;
    timelinePendingClientX = 0;
    timelinePendingShiftKey = false;
  }
  function handleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const stageButton = target.closest("[data-lab-stage]");
    if (stageButton) {
      return;
    }
    const actionButton = target.closest("[data-lab-action]");
    if (!actionButton) {
      return;
    }
    const action = toStringValue(actionButton.dataset["labAction"]);
    const value = toStringValue(actionButton.dataset["labValue"]);
    const state = deps.store.getState();
    switch (action) {
      case "primary-action":
        runPrimaryAction();
        return;
      case "load-source":
        if (isRunActive(state)) {
          return;
        }
        runSourcePrimaryAction();
        return;
      case "workspace-toggle-source-intake":
        dispatch({ type: "workspace-source-intake-toggled" });
        return;
      case "source-youtube-preset":
        if (value.trim() !== "") {
          persistSourceDraftField("source.youtubePreset", value);
        }
        return;
      case "toggle-tool-manager":
      case "toggle-module-manager":
        dispatch({ type: "tool-manager-toggled" });
        return;
      case "close-tool-manager":
      case "dismiss-tool-manager":
      case "close-module-manager":
      case "dismiss-module-manager":
        dispatch({ type: "tool-manager-toggled", open: false });
        return;
      case "tools-refresh":
        sendMediaAction("tools-refresh");
        return;
      case "tool-update-all":
        sendMediaAction("tool-update-all", {
          featureStage: deriveLegacyStage(state),
          actionFamily: "tool-lifecycle"
        });
        return;
      case "tool-install":
      case "tool-update":
      case "tool-check-updates":
        if (value.trim() === "") {
          return;
        }
        sendMediaAction(action, {
          toolId: value,
          featureStage: deriveLegacyStage(state),
          actionFamily: "tool-lifecycle"
        });
        return;
      case "feature-activate":
        activateFeature(value);
        return;
      case "feature-toggle":
        toggleFeature(value);
        return;
      case "capability-select":
        syncCapabilities(
          deps.store.getState().selectedCapabilities.concat(
            value
          )
        );
        return;
      case "capability-deselect":
        syncCapabilities(
          deps.store.getState().selectedCapabilities.filter(function(entry) {
            return entry !== value;
          })
        );
        return;
      case "capability-toggle": {
        const caps = deps.store.getState().selectedCapabilities;
        syncCapabilities(
          caps.includes(value) ? caps.filter(function(entry) {
            return entry !== value;
          }) : caps.concat(value)
        );
        return;
      }
      case "module-toggle":
        toggleModule(value);
        return;
      case "edit-mode":
        sendMediaAction("edit-set-mode", { mode: value });
        return;
      case "profile-mode":
        sendMediaAction("profile-set-mode", { mode: value });
        return;
      case "report-view":
        dispatch({
          type: "report-view-changed",
          view: value === "ai" ? "ai" : "user"
        });
        return;
      case "toggle-artifacts":
        dispatch({ type: "toggle-artifacts" });
        return;
      case "toggle-event-feed":
        dispatch({ type: "toggle-event-feed" });
        return;
      case "event-feed-next":
        dispatch({ type: "advance-event-feed" });
        return;
      case "event-feed-reset":
        dispatch({ type: "reset-event-feed" });
        return;
      case "toggle-live-findings":
        dispatch({ type: "live-findings-expanded" });
        return;
      case "toggle-analysis-controls":
        dispatch({ type: "analysis-controls-collapsed" });
        return;
      case "toggle-edit-side-panel":
        dispatch({ type: "edit-side-panel-toggled" });
        return;
      case "toggle-raw-log":
        dispatch({ type: "raw-log-toggled" });
        return;
      case "show-more-artifacts":
        dispatch({ type: "show-more-artifacts" });
        return;
      case "preview-artifact":
        dispatch({
          type: "preview-artifact-activated",
          artifactId: value.trim() !== "" ? value : null
        });
        return;
      case "new-run-from-report": {
        const run = getCurrentRun(state);
        if (run?.analysisScope) {
          updateWorkbench(function(workbench) {
            return {
              ...workbench,
              forkedFromRunId: run.id,
              analysisScope: {
                ...run.analysisScope,
                lifecycle: {
                  mutable: true,
                  processId: null,
                  frozenAt: null
                }
              }
            };
          });
        }
        dispatch({ type: "preview-artifact-activated", artifactId: null });
        dispatch({ type: "report-overlay-toggled", open: false });
        return;
      }
      case "save-project": {
        const sourceRecord = asLabRecord(state.source);
        const sourceLabel = asNonEmptyString(sourceRecord["storedFileName"]) || asNonEmptyString(sourceRecord["routeLabel"]);
        if (sourceLabel === null || state.projectIndex.activeProjectId === null) {
          return;
        }
        sendMediaAction("project-rename", {
          name: buildAutoProjectName(getActiveProjectCreatedAt(state), sourceLabel)
        });
        updateWorkbench(function(workbench) {
          return {
            ...workbench,
            lastManualSaveAt: (/* @__PURE__ */ new Date()).toISOString()
          };
        });
        dispatch({
          type: "push-event",
          event: buildUiEvent("Proje mevcut checkpoint durumu ile kaydedildi.", "success")
        });
        return;
      }
      // V2.3 workspace actions
      case "run-deep-analysis": {
        const run = getCurrentRun(state);
        if (run && run.state === "running") {
          sendMediaAction(
            state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel"
          );
          return;
        }
        const blockReason = getAnalysisActionBlockReason(state);
        if (blockReason !== null) {
          dispatch({
            type: "push-event",
            event: buildUiEvent(blockReason, "warning")
          });
          return;
        }
        startDeepAnalysis(state);
        return;
      }
      case "project-select": {
        selectProjectByValue(value);
        return;
      }
      case "project-delete": {
        const activeProjectId = state.projectIndex.activeProjectId;
        const sourceRecord = asLabRecord(state.source);
        const hasActiveSource = asNonEmptyString(sourceRecord["storedFileName"]) !== null || asNonEmptyString(sourceRecord["routeLabel"]) !== null;
        if (!activeProjectId || !hasActiveSource) {
          return;
        }
        const activeProjectSummary = state.projectIndex.projects.find(function(project) {
          return asNonEmptyString(project["id"]) === activeProjectId;
        });
        const projectLabel = asNonEmptyString(activeProjectSummary?.["name"]) || "seçili proje kaydı";
        const confirmed = typeof deps.windowRef.confirm === "function" ? deps.windowRef.confirm(`"${projectLabel}" kaydı silinsin mi?`) : true;
        if (confirmed) {
          sendMediaAction("project-delete", { projectId: activeProjectId });
        }
        return;
      }
      case "workspace-roi-toggle":
        if (value.trim() !== "") {
          dispatch({ type: "workspace-roi-toggled", regionId: value });
        }
        return;
      case "workspace-roi-remove":
        if (value.trim() !== "") {
          dispatch({ type: "workspace-roi-removed", regionId: value });
        }
        return;
      case "workspace-roi-export": {
        const roiState = deps.store.getState();
        const roiRegions = roiState.ui.workspace.roiRegions;
        const roiRegion = roiRegions.find(function(r) {
          return r.id === value;
        });
        if (roiRegion) {
          startTrackedUserAction("export-roi-image", {
            regionId: roiRegion.id,
            x: roiRegion.x,
            y: roiRegion.y,
            width: roiRegion.width,
            height: roiRegion.height,
            ...getCurrentRunIntentPayload(roiState)
          });
        }
        return;
      }
      case "timeline-export-clip": {
        const clipState = deps.store.getState();
        const clipWs = clipState.ui.workspace;
        if (clipWs.timelineStartMs !== null && clipWs.timelineEndMs !== null) {
          startTrackedUserAction("export-timeline-clip", {
            startMs: clipWs.timelineStartMs,
            endMs: clipWs.timelineEndMs,
            ...getCurrentRunIntentPayload(clipState)
          });
        }
        return;
      }
      case "timeline-grab-frame": {
        const frameState = deps.store.getState();
        const frameWs = frameState.ui.workspace;
        const seekMs = frameWs.timelineStartMs !== null ? frameWs.timelineStartMs : 0;
        startTrackedUserAction("export-frame-grab", {
          seekMs,
          ...getCurrentRunIntentPayload(frameState)
        });
        return;
      }
      case "timeline-extract-audio":
        startTrackedUserAction("export-audio-track", getCurrentRunIntentPayload(state));
        return;
      case "asset-preview":
        if (value.trim() !== "") {
          previewAsset(value);
        }
        return;
      case "close-asset-preview":
        dispatch({ type: "asset-preview-closed" });
        return;
      case "focus-source-preview":
        if (value.trim() !== "") {
          focusSourcePreview();
        }
        return;
      case "workspace-open-dual-preview":
        dispatch({
          type: "workspace-dual-preview-toggled",
          force: true,
          audioAssetId: value.trim() !== "" ? value : null
        });
        return;
      case "workspace-close-dual-preview":
        dispatch({
          type: "workspace-dual-preview-toggled",
          force: false
        });
        return;
      case "workspace-dual-preview-audio-select":
        dispatch({
          type: "workspace-dual-preview-audio-selected",
          audioAssetId: value.trim() !== "" ? value : null
        });
        return;
      case "dual-preview-toggle-play": {
        const master = getDualPreviewMaster();
        if (master === null) {
          return;
        }
        if (master.paused === false) {
          master.pause?.();
        } else {
          safePlay(master);
          syncSlaveToMaster({ force: true, play: true, explicitPlaybackAttempt: true });
        }
        updateDualPreviewTransportUi();
        return;
      }
      case "asset-download":
        if (value.trim() !== "") {
          downloadAsset(value);
        }
        return;
      case "asset-use-as-source":
        if (value.trim() !== "") {
          sendMediaAction("asset-use-as-source", { assetId: value });
        }
        return;
      case "asset-remove":
        if (value.trim() !== "") {
          sendMediaAction("asset-remove", { assetId: value });
        }
        return;
      case "workspace-intent-toggle":
        if (value.trim() !== "") {
          dispatch({
            type: "workspace-intent-toggled",
            intentId: value
          });
        }
        return;
      case "workspace-toggle-right-panel":
        dispatch({ type: "workspace-right-panel-toggled" });
        return;
      case "workspace-image-analysis":
        dispatch({ type: "workspace-image-analysis-requested" });
        sendMediaAction("edit-preview");
        return;
      case "workspace-reset-controls":
        dispatch({
          type: "workspace-interactive-updated",
          patch: {
            brightness: 100,
            contrast: 100,
            gamma: 1,
            saturation: 100,
            hueRotate: 0,
            sharpness: 100,
            channelR: true,
            channelG: true,
            channelB: true,
            edgeHighlight: false,
            invert: false
          }
        });
        return;
      case "workspace-add-bookmark": {
        const bookmarkId = `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        dispatch({
          type: "workspace-bookmark-added",
          bookmark: {
            id: bookmarkId,
            timeMs: 0,
            frameIndex: null,
            note: "",
            createdAt: Date.now()
          }
        });
        return;
      }
      case "workspace-remove-bookmark":
        if (value.trim() !== "") {
          dispatch({ type: "workspace-bookmark-removed", bookmarkId: value });
        }
        return;
      case "timeline-seek":
        if (value.trim() !== "") {
          const timeMs = Number(value);
          if (Number.isFinite(timeMs) !== true) {
            return;
          }
          seekTimelineToMs(timeMs);
        }
        return;
      case "timeline-interact":
      case "timeline-drag-start":
      case "timeline-drag-end":
      case "timeline-drag-body":
        return;
      case "timeline-finetune": {
        const parts = value.split(":");
        if (parts.length === 2) {
          const prefix = parts[0];
          const delta = Number(parts[1]);
          if ((prefix === "start" || prefix === "end") && Number.isFinite(delta)) {
            const currentStart = state.ui.workspace.timelineStartMs;
            const currentEnd = state.ui.workspace.timelineEndMs;
            const timelineEl = target.closest(".labx-timeline");
            const finetuneDurationMs = timelineEl ? Number(timelineEl.dataset["duration"] || 0) : 0;
            if (prefix === "start" && currentStart !== null) {
              const next = Math.max(
                0,
                Math.min(currentEnd ?? finetuneDurationMs, currentStart + delta)
              );
              dispatch({ type: "workspace-timeline-updated", startMs: next, endMs: currentEnd });
            } else if (prefix === "end" && currentEnd !== null) {
              const maxMs = finetuneDurationMs || currentEnd + Math.abs(delta);
              const next = Math.max(currentStart ?? 0, Math.min(maxMs, currentEnd + delta));
              dispatch({ type: "workspace-timeline-updated", startMs: currentStart, endMs: next });
            }
          }
        }
        return;
      }
      case "timeline-clear": {
        dispatch({ type: "workspace-timeline-updated", startMs: null, endMs: null });
        return;
      }
      case "workspace-step-preview":
        dispatch({
          type: "workspace-step-preview-activated",
          stepId: value.trim() !== "" ? value : null
        });
        return;
      case "toggle-report-view":
        dispatch({ type: "report-overlay-toggled", open: true });
        return;
      case "workspace-process-section-toggle":
        if (value.trim() !== "") {
          dispatch({
            type: "workspace-process-section-toggled",
            sectionId: value
          });
        }
        return;
      case "open-report-overlay":
        dispatch({ type: "report-overlay-toggled", open: true });
        return;
      case "close-report-overlay":
        dispatch({ type: "report-overlay-toggled", open: false });
        return;
      case "report-tab-switch":
        dispatch({
          type: "report-view-changed",
          view: value === "ai" ? "ai" : "user"
        });
        return;
      case "report-export-json":
        startTrackedReportExport();
        return;
      case "report-export-pdf":
        startTrackedReportExport();
        return;
      default:
        return;
    }
  }
  function handleInput(event) {
    const target = event.target;
    if (!isTextControl(target)) {
      return;
    }
    const action = target.dataset["labAction"];
    if (action === "dual-preview-seek") {
      const timeMs = Number(target.value);
      if (Number.isFinite(timeMs)) {
        seekDualPreviewToMs(timeMs);
      }
      return;
    }
    const field = target.dataset["labField"];
    if (!field) {
      return;
    }
    if (field === "source.fileNameHint" || field === "source.urlInput" || field === "source.youtubeUrl" || field.startsWith("source.youtubeCustom.")) {
      const rawValue = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target instanceof HTMLInputElement && target.type === "number" ? target.value === "" ? null : Number(target.value) : target.value;
      const patch = buildSourceDraftPatch(deps.store.getState(), field, rawValue);
      if (patch !== null) {
        dispatch({
          type: "source-drafts-updated",
          patch
        });
      }
      return;
    }
    if (field.startsWith("edit.")) {
      dispatch({
        type: "edit-drafts-updated",
        patch: {
          [field.replace("edit.", "")]: target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value
        }
      });
      return;
    }
    if (field.startsWith("profile.")) {
      const rawValue = target.value;
      const value = target instanceof HTMLInputElement && target.type === "number" ? rawValue === "" ? null : Number(rawValue) : rawValue;
      dispatch({
        type: "profile-drafts-updated",
        patch: {
          [field.replace("profile.", "")]: value
        }
      });
      return;
    }
    if (field.startsWith("scope.")) {
      const rawValue = target instanceof HTMLInputElement && target.type === "number" ? target.value === "" ? null : Number(target.value) : target.value;
      updateAnalysisScopeField(field.replace("scope.", ""), rawValue);
      return;
    }
    if (field.startsWith("workspace.")) {
      const workspaceField = field.replace("workspace.", "");
      const rawValue = target instanceof HTMLInputElement && target.type === "number" ? target.value === "" ? null : Number(target.value) : target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target instanceof HTMLInputElement && target.type === "range" ? Number(target.value) : target.value;
      if (workspaceField === "timelineStartMs" || workspaceField === "timelineEndMs") {
        const state = deps.store.getState();
        dispatch({
          type: "workspace-timeline-updated",
          startMs: workspaceField === "timelineStartMs" ? rawValue : state.ui.workspace.timelineStartMs,
          endMs: workspaceField === "timelineEndMs" ? rawValue : state.ui.workspace.timelineEndMs
        });
        return;
      }
      if (workspaceField === "dualPreviewVolume") {
        dispatch({
          type: "workspace-dual-preview-volume-updated",
          volume: typeof rawValue === "number" ? rawValue : Number(rawValue)
        });
        syncDualPreviewVolume();
        updateDualPreviewTransportUi();
        return;
      }
      if (workspaceField === "hypothesis") {
        dispatch({ type: "workspace-hypothesis-updated", text: String(rawValue || "") });
        return;
      }
      if (workspaceField.startsWith("interactive.")) {
        const settingKey = workspaceField.replace("interactive.", "");
        dispatch({
          type: "workspace-interactive-updated",
          patch: { [settingKey]: rawValue }
        });
        return;
      }
      if (workspaceField.startsWith("audioFocus.")) {
        const audioKey = workspaceField.replace("audioFocus.", "");
        if (audioKey.startsWith("eqBands.")) {
          const eqState = deps.store.getState();
          const currentBands = eqState.ui.workspace.audioFocus.eqBands.map(function(b) {
            return { ...b };
          });
          const parts = audioKey.split(".");
          const bandIndex = parts.length > 1 ? parseInt(parts[1], 10) : NaN;
          const bandProp = parts.length > 2 ? parts[2] : "";
          if (!isNaN(bandIndex) && bandIndex >= 0 && bandIndex < currentBands.length && bandProp) {
            const numValue = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue));
            if (!isNaN(numValue)) {
              currentBands[bandIndex][bandProp] = numValue;
            }
          }
          dispatch({
            type: "workspace-audio-updated",
            patch: { eqBands: currentBands }
          });
        } else {
          dispatch({
            type: "workspace-audio-updated",
            patch: { [audioKey]: rawValue }
          });
        }
        return;
      }
    }
  }
  function handleContextMenu(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const assetRow = target.closest("[data-lab-asset-id]");
    if (!assetRow) {
      return;
    }
    const menu = assetRow.querySelector(".labx-project-assets__menu");
    if (!menu) {
      return;
    }
    event.preventDefault();
    menu.open = true;
    const summary = menu.querySelector("summary");
    summary?.focus();
  }
  function handleChange(event) {
    const target = event.target;
    if (!isTextControl(target)) {
      return;
    }
    const field = target.dataset["labField"];
    if (!field) {
      return;
    }
    const state = deps.store.getState();
    const targetValue = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target instanceof HTMLInputElement && target.type === "number" ? target.value === "" ? null : Number(target.value) : target.value;
    switch (field) {
      case "scope.focus":
      case "scope.timeStartMs":
      case "scope.timeEndMs":
      case "scope.frameStart":
      case "scope.frameEnd":
      case "scope.regionX":
      case "scope.regionY":
      case "scope.regionWidth":
      case "scope.regionHeight":
      case "scope.hypothesis":
        updateAnalysisScopeField(field.replace("scope.", ""), targetValue);
        return;
      case "project.id":
        selectProjectByValue(String(targetValue || ""));
        return;
      case "source.kind":
        dispatch({
          type: "source-config-patched",
          patch: {
            kind: targetValue,
            mode: getDefaultSourceMode(state, targetValue),
            status: "idle",
            storedPath: null,
            storedFileName: null,
            sourceUrl: null,
            mimeType: null,
            routeLabel: null,
            lastError: null,
            metadata: null,
            metadataError: null
          }
        });
        sendMediaAction("source-set-kind", { kind: targetValue });
        return;
      case "source.mode":
        dispatch({
          type: "source-config-patched",
          patch: {
            mode: targetValue,
            status: "idle",
            storedPath: null,
            storedFileName: null,
            sourceUrl: null,
            mimeType: null,
            routeLabel: null,
            lastError: null,
            metadata: null,
            metadataError: null,
            previewUrl: null
          }
        });
        sendMediaAction("source-set-mode", { mode: targetValue });
        return;
      case "source.fileNameHint":
      case "source.urlInput":
      case "source.youtubeUrl":
      case "source.youtubePreset":
        persistSourceDraftField(field, targetValue);
        return;
      default:
        if (field.startsWith("source.youtubeCustom.")) {
          persistSourceDraftField(field, targetValue);
          return;
        }
        switch (field) {
          case "edit.outputNameHint":
            sendMediaAction("edit-update-recipe", {
              patch: {
                common: {
                  outputNameHint: targetValue
                }
              }
            });
            return;
          case "edit.notes":
            sendMediaAction("edit-update-recipe", {
              patch: {
                common: {
                  notes: targetValue
                }
              }
            });
            return;
          case "edit.handoffMode":
            sendMediaAction("edit-set-handoff", {
              mode: targetValue
            });
            return;
          case "edit.activeSourceRef":
            dispatch({
              type: "edit-drafts-updated",
              patch: {
                activeSourceRef: targetValue === "preview" ? "preview" : "original"
              }
            });
            return;
          case "edit.activeOutputId":
            sendMediaAction("edit-set-output", {
              outputId: targetValue
            });
            return;
          case "edit.advancedOpen":
            dispatch({
              type: "edit-drafts-updated",
              patch: {
                advancedOpen: targetValue === true
              }
            });
            return;
          case "profile.targetMode":
            sendMediaAction("profile-set-target", {
              mode: targetValue,
              outputId: targetValue === "derived" ? asNonEmptyString(getActiveEditOutput(state)?.["id"]) : null
            });
            return;
          case "profile.targetOutputId":
            sendMediaAction("profile-set-target", {
              mode: "derived",
              outputId: targetValue || null
            });
            return;
          case "profile.depth":
          case "profile.frameSampleDensity":
          case "profile.sensitivity":
          case "profile.transcriptSampleSeconds":
            sendMediaAction("profile-update", {
              patch: {
                [field.replace("profile.", "")]: targetValue
              }
            });
            return;
          case "profile.modelId":
            sendMediaAction("profile-set-model", {
              modelId: targetValue || null
            });
            return;
          default:
            return;
        }
    }
  }
  function attach() {
    if (attached) {
      return;
    }
    attached = true;
    deps.documentRef.addEventListener("click", handleClick);
    deps.documentRef.addEventListener("contextmenu", handleContextMenu);
    deps.documentRef.addEventListener("input", handleInput);
    deps.documentRef.addEventListener("change", handleChange);
    deps.documentRef.addEventListener("mousedown", handleMouseDown);
    deps.windowRef.addEventListener("mousemove", handleTimelineMouseMove);
    deps.windowRef.addEventListener("mouseup", handleTimelineMouseUp);
    deps.store.subscribe(function() {
      syncDualPreviewFromState();
      syncTimelinePlaybackUiFromState();
      workspaceAudioVisualizer.sync();
    });
    queueMicrotask(function() {
      syncDualPreviewFromState();
      syncTimelinePlaybackUiFromState();
      workspaceAudioVisualizer.sync();
    });
  }
  function getPrimaryActionState() {
    const state = deps.store.getState();
    if (hasReportPayload(state) && (state.ui.workspace.reportOverlayOpen || isRunComplete(state))) {
      const reportBlock = getReportActionBlockReason(state);
      return {
        disabled: reportBlock !== null,
        detail: reportBlock || "Structured rapor dışa aktarılır",
        label: "Raporları Dışa Aktar"
      };
    }
    if (isRunActive(state)) {
      return {
        disabled: false,
        detail: "Aktif run iptal edilir",
        label: "Çalışmayı İptal Et"
      };
    }
    if (getSourceReady(state) && getAnalysisActionBlockReason(state) === null) {
      return {
        disabled: false,
        detail: "Sadece enabled modüller çalışır",
        label: "Analizi Başlat"
      };
    }
    if (getSourceReady(state)) {
      const editBlock = getEditActionBlockReason(state);
      if (editBlock === null) {
        return {
          disabled: false,
          detail: "Preview completion fake edilemez",
          label: "Önizleme Üret"
        };
      }
    }
    const sourceStatus = getSourceStatus(state);
    const sourceProbeStatus = getSourceProbeStatus(state);
    const sourceBlock = getSourceActionBlockReason(state);
    return {
      disabled: sourceBlock !== null,
      detail: sourceBlock || (sourceProbeStatus === "running" ? "Gerçek probe tamamlanıyor" : sourceProbeStatus === "completed" || sourceStatus === "ready" ? "Probe tamamlandı" : "Source probe başlatılır"),
      label: sourceProbeStatus === "completed" || sourceStatus === "ready" ? "Kaynağı Yenile" : "Kaynağı Hazırla"
    };
  }
  deps.eventBus.subscribe(handleBusEvent);
  return {
    attach,
    getPrimaryActionState
  };
}
