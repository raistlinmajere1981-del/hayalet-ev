import {
  asLabRecord,
  asNonEmptyString,
  asNumber,
  createLabEventId,
  LAB_OPERATION_CAPABILITIES,
  LAB_OPERATION_SETTINGS_DEFAULTS,
  LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS,
  WORKSPACE_INTENTS,
  normalizeLabAnalysisModuleSettings,
  normalizeLabOperationSettings,
} from "../models/lab-types.js";
import type {
  CapabilityFamilyId,
  LabFeatureId,
  LabIntentId,
  LabAudioFocusSettings,
  LabAssetType,
  LabInteractiveSettings,
  LabOperationCapabilityId,
  LabSourceDrafts,
  LabStoreEvent,
  LabWorkspaceControlTab,
  LabUserActionEvent,
  LabYoutubeImportCustomSettings,
  LabYoutubeImportPreview,
  LabYoutubeImportStrategy,
} from "../models/lab-types.js";
import { createLabWaveformTimelineVisualizer } from "../ui/lab-waveform-timeline.js";
import { createLabI18n } from "../ui/lab-i18n.js";
import { formatSourceRetryBlockReason } from "../ui/lab-source-retry-copy.js";
import { getTrackedOperationActionId } from "./lab-operation-action-map.js";
import {
  getActionOutputs,
  getActiveEditOutput,
  getAnalysisActionBlockReason,
  getCurrentRun,
  getEditActionBlockReason,
  getPreviewVolume,
  getReportActionBlockReason,
  getSourceActionBlockReason,
  getSourceReady,
  getSourceMode,
  getSourceProbeStatus,
  getSourceRetryBlockReason,
  getSourceStatus,
  getToolLifecycleStage,
  getUserActions,
  getWaveformTimelineModel,
  getWorkbench,
  getWorkspaceLockState,
  hasReportPayload,
  isRunActive,
  isRunComplete,
} from "./lab-selectors.js";
import type { createLabEventBus } from "./lab-event-bus.js";
import type { createLabStore } from "./lab-store.js";
import {
  LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS,
  getTrackedLabUserActionDefinition,
} from "./lab-user-actions.js";
import {
  buildAutoProjectName,
  buildUiEvent,
  deriveFeatureSelectionFromCapabilities,
  isTextControl,
  pad2,
  toDraftScope,
  toStringArray,
  toStringValue,
} from "./controller/lab-controller-helpers.js";
import {
  buildProjectImportHostAction,
  buildProjectImportLocalHostAction,
  buildProjectImportUrlCheckAction,
  hasProjectImportDraftValue,
  normalizeProjectImportKindValue,
  normalizeProjectImportMethodValue,
} from "./lab-project-import.js";
import { getWorkspaceSourceSelectionResetKey } from "./lab-workspace-selection.js";
import { DEFAULT_AUDIO_FOCUS_SETTINGS } from "./lab-audio-focus-normalization.js";

const DEFAULT_INTERACTIVE_SETTINGS: LabInteractiveSettings = {
  brightness: 100,
  contrast: 100,
  gamma: 1.0,
  saturation: 100,
  hueRotate: 0,
  sharpness: 100,
  channelR: true,
  channelG: true,
  channelB: true,
  edgeHighlight: false,
  invert: false,
};
const FALLBACK_TIMELINE_FRAME_DURATION_SECONDS = 1 / 30;

type LabRoomApi = {
  onHostMessage?: (listener: (message: unknown) => void) => void;
  ready?: (payload: { feature: string; room: string; stage: string }) => void;
  sendEvent?: (eventName: string, payload: Record<string, unknown>) => void;
};

type ControllerWindow = Window & {
  roomAPI?: LabRoomApi;
};

type LabRunControllerDeps = {
  documentRef: Document;
  eventBus: ReturnType<typeof createLabEventBus>;
  store: ReturnType<typeof createLabStore>;
  windowRef: ControllerWindow;
};

const YOUTUBE_IMPORT_PARSE_DELAY_MS = 800;

export function createLabRunController(deps: LabRunControllerDeps) {
  let attached = false;
  let youtubeImportParseTimer: ReturnType<typeof setTimeout> | null = null;
  let youtubeImportParseUrl: string | null = null;
  const hubDismissTimers = new Map<string, ReturnType<typeof setTimeout>>();
  type MediaLikeElement = {
    currentTime: number;
    duration?: number;
    readyState?: number;
    muted?: boolean;
    paused?: boolean;
    play?: () => Promise<void> | void;
    pause?: () => void;
    volume?: number;
    getVideoPlaybackQuality?: () => { totalVideoFrames?: number };
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };

  type RangeLikeElement = {
    value: string;
    max?: string;
  };

  type TextLikeElement = {
    textContent: string | null;
  };

  type BookmarkNoteInputElement = {
    value: string;
  };

  let boundTimelineSyncMedia: MediaLikeElement | null = null;
  const getWorkspaceWaveformTimelineModel = () => getWaveformTimelineModel(deps.store.getState());
  const workspaceAudioVisualizer = createLabWaveformTimelineVisualizer({
    documentRef: deps.documentRef,
    getTimelineModel: getWorkspaceWaveformTimelineModel,
    windowRef: deps.windowRef,
  });

  function dispatch(event: Parameters<ReturnType<typeof createLabStore>["dispatch"]>[0]) {
    deps.eventBus.emit(event);
  }

  function normalizeYoutubeImportUrlInput(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }
    const normalizedUrl = value.trim();
    return normalizedUrl === "" ? null : normalizedUrl;
  }

  function extractYoutubeImportVideoId(urlText: string): string | null {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlText);
    } catch {
      return null;
    }

    const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    let candidate: string | null = null;
    if (host === "youtu.be") {
      candidate = parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (parsedUrl.pathname === "/watch") {
        candidate = parsedUrl.searchParams.get("v");
      } else {
        const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
        if (pathParts[0] === "embed" || pathParts[0] === "shorts" || pathParts[0] === "live") {
          candidate = pathParts[1] ?? null;
        }
      }
    }

    if (candidate === null || /^[A-Za-z0-9_-]{3,32}$/.test(candidate) !== true) {
      return null;
    }
    return candidate;
  }

  function buildYoutubeImportPreview(urlText: string): LabYoutubeImportPreview | null {
    const videoId = extractYoutubeImportVideoId(urlText);
    if (videoId === null) {
      return null;
    }
    return {
      title: "Sample Video Title",
      duration: 154,
      thumbnail: `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    };
  }

  function clearYoutubeImportParseTimer() {
    if (youtubeImportParseTimer !== null) {
      clearTimeout(youtubeImportParseTimer);
      youtubeImportParseTimer = null;
    }
    youtubeImportParseUrl = null;
  }

  function normalizeYoutubeImportStrategyValue(value: string): LabYoutubeImportStrategy | null {
    switch (value) {
      case "video_best":
      case "audio_only":
      case "low_size":
      case "custom":
        return value;
      default:
        return null;
    }
  }

  function normalizeWorkspaceControlTab(value: string): LabWorkspaceControlTab | null {
    return value === "audio" || value === "visual" || value === "operations" ? value : null;
  }

  function buildYoutubeImportCustomPatch(
    field: string,
    value: unknown
  ): Partial<LabYoutubeImportCustomSettings> | null {
    const customField = field.replace("youtube-import.custom.", "");
    switch (customField) {
      case "resolution":
      case "format":
      case "audioExtraction":
        return { [customField]: value } as Partial<LabYoutubeImportCustomSettings>;
      default:
        return null;
    }
  }

  function updateYoutubeImportCustomField(field: string, value: unknown) {
    const patch = buildYoutubeImportCustomPatch(field, value);
    if (patch === null) {
      return;
    }
    dispatch({
      type: "youtube-import-custom-updated",
      patch,
    });
  }

  function scheduleYoutubeImportParse(rawUrl: string) {
    const url = normalizeYoutubeImportUrlInput(rawUrl);
    clearYoutubeImportParseTimer();
    if (url === null) {
      dispatch({ type: "youtube-import-set-url", url: null });
      return;
    }

    dispatch({ type: "youtube-import-set-url", url });
    const preview = buildYoutubeImportPreview(url);
    if (preview === null) {
      dispatch({ type: "youtube-import-parse-error", reason: "invalid-url" });
      return;
    }

    dispatch({ type: "youtube-import-parse-start" });
    youtubeImportParseUrl = url;
    youtubeImportParseTimer = setTimeout(function () {
      youtubeImportParseTimer = null;
      const state = deps.store.getState();
      if (
        youtubeImportParseUrl !== url ||
        state.ui.labMode !== "import-youtube" ||
        state.ui.youtubeImport.url !== url ||
        state.ui.youtubeImport.status !== "parsing"
      ) {
        return;
      }
      youtubeImportParseUrl = null;
      dispatch({
        type: "youtube-import-parse-success",
        url,
        preview,
      });
    }, YOUTUBE_IMPORT_PARSE_DELAY_MS);
  }

  function isMediaLikeElement(value: unknown): value is MediaLikeElement {
    if (!value || typeof value !== "object") {
      return false;
    }
    return typeof (value as MediaLikeElement).currentTime === "number";
  }

  function formatTimelineTimeMs(totalMs: number) {
    const safeMs = Number.isFinite(totalMs) && totalMs > 0 ? Math.round(totalMs) : 0;
    const minutes = Math.floor(safeMs / 60000);
    const seconds = Math.floor((safeMs % 60000) / 1000);
    const millis = safeMs % 1000;
    return `${pad2(minutes)}:${pad2(seconds)}.${String(millis).padStart(3, "0")}`;
  }

  function getPrimaryWorkspacePreviewMedia() {
    const selectors = [
      'audio[data-lab-preserve-media="workspace-preview"]',
      'video[data-lab-preserve-media="workspace-preview"]',
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
    return getPrimaryWorkspacePreviewMedia();
  }

  function getTimelinePlayhead() {
    const candidate = deps.documentRef.querySelector?.('[data-lab-role="timeline-playhead"]');
    return candidate && typeof candidate === "object"
      ? (candidate as {
          setAttribute?: (name: string, value: string) => void;
          style?: { left?: string; opacity?: string };
        })
      : null;
  }

  function getTimelinePlayheadLabel() {
    const candidate = deps.documentRef.querySelector?.('[data-lab-role="timeline-playhead-label"]');
    return candidate && typeof candidate === "object"
      ? (candidate as { textContent: string | null })
      : null;
  }

  function getTimelineCurrentTimeLabel() {
    return deps.documentRef.querySelector?.(
      '[data-lab-role="timeline-current-time-label"]'
    ) as TextLikeElement | null;
  }

  function getTimelineTotalDurationLabel() {
    return deps.documentRef.querySelector?.(
      '[data-lab-role="timeline-total-duration-label"]'
    ) as TextLikeElement | null;
  }

  function getTimelinePlayToggleLabel() {
    return deps.documentRef.querySelector?.(
      '[data-lab-role="timeline-play-toggle-label"]'
    ) as TextLikeElement | null;
  }

  function getTimelineVolumeInput() {
    return deps.documentRef.querySelector?.(
      '[data-lab-role="timeline-volume"]'
    ) as RangeLikeElement | null;
  }

  function getTimelineBookmarkNoteInput() {
    return deps.documentRef.querySelector?.(
      '[data-lab-role="timeline-bookmark-note"]'
    ) as BookmarkNoteInputElement | null;
  }

  function syncTimelineTransportVolume() {
    const state = deps.store.getState();
    const volume = getPreviewVolume(state);
    const volumeInput = getTimelineVolumeInput();

    if (volumeInput) {
      volumeInput.value = String(volume);
    }

    const media = getPrimaryWorkspacePreviewMedia();
    if (media) {
      media.muted = volume <= 0;
      if (typeof media.volume === "number") {
        media.volume = volume;
      }
    }
  }

  function getTimelineDurationMs(media: MediaLikeElement | null) {
    const timeline = deps.documentRef.querySelector?.(".labx-timeline") as {
      dataset?: Record<string, string | undefined>;
    } | null;
    const timelineDurationMs = Number(timeline?.dataset?.["duration"] || 0);
    if (Number.isFinite(timelineDurationMs) && timelineDurationMs > 0) {
      return timelineDurationMs;
    }
    if (media && typeof media.duration === "number" && Number.isFinite(media.duration)) {
      return Math.max(0, Math.round(media.duration * 1000));
    }
    return 0;
  }

  function updateTimelinePlaybackUi() {
    const media = getTimelineSyncMedia();
    const playhead = getTimelinePlayhead();
    const playheadLabel = getTimelinePlayheadLabel();
    const currentTimeLabel = getTimelineCurrentTimeLabel();
    const totalDurationLabel = getTimelineTotalDurationLabel();
    const playToggleLabel = getTimelinePlayToggleLabel();
    const rawDurationMs = getTimelineDurationMs(media);
    const durationMs = Math.max(1, rawDurationMs);
    const currentMs =
      media && typeof media.currentTime === "number" && Number.isFinite(media.currentTime)
        ? Math.max(0, Math.round(media.currentTime * 1000))
        : 0;
    const clampedCurrentMs = Math.max(0, Math.min(durationMs, currentMs));
    const leftPct = Math.max(0, Math.min(100, (clampedCurrentMs / durationMs) * 100));
    const currentTimeText = formatTimelineTimeMs(clampedCurrentMs);

    if (playhead?.style) {
      playhead.style.left = `${String(leftPct)}%`;
      playhead.style.opacity = media === null ? "0" : "1";
    }
    playhead?.setAttribute?.("data-active", media === null ? "false" : "true");
    if (playheadLabel) {
      playheadLabel.textContent = currentTimeText;
    }
    if (currentTimeLabel) {
      currentTimeLabel.textContent = currentTimeText;
    }
    if (totalDurationLabel) {
      totalDurationLabel.textContent = formatTimelineTimeMs(Math.max(0, rawDurationMs));
    }
    if (playToggleLabel) {
      playToggleLabel.textContent = media && media.paused === false ? "❚❚" : "▶";
    }
    syncTimelineTransportVolume();
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

  function toggleTimelinePlayback() {
    const media = getTimelineSyncMedia();
    if (media === null) {
      return;
    }
    syncTimelineTransportVolume();
    if (media.paused === false) {
      media.pause?.();
    } else {
      safePlay(media);
    }
    updateTimelinePlaybackUi();
  }

  function getTimelineBookmarkFrameIndex(timeMs: number) {
    const metadata = asLabRecord(asLabRecord(deps.store.getState().source)["metadata"]);
    const fps = typeof metadata["fps"] === "number" ? metadata["fps"] : null;
    if (fps === null || Number.isFinite(fps) !== true || fps <= 0) {
      return null;
    }
    return Math.max(0, Math.round((timeMs / 1000) * fps));
  }

  function addCurrentTimelineBookmark() {
    const media = getTimelineSyncMedia();
    if (
      media === null ||
      typeof media.currentTime !== "number" ||
      Number.isFinite(media.currentTime) !== true
    ) {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Önizleme zamanı okunamadı.", "warning"),
      });
      return;
    }

    const durationMs = getTimelineDurationMs(media);
    const rawTimeMs = Math.max(0, Math.round(media.currentTime * 1000));
    const timeMs = durationMs > 0 ? Math.min(durationMs, rawTimeMs) : rawTimeMs;
    const noteInput = getTimelineBookmarkNoteInput();
    const state = deps.store.getState();
    const copy = createLabI18n(state.context);
    const timeLabel = formatTimelineTimeMs(timeMs);
    const note =
      asNonEmptyString(noteInput?.value) ||
      copy.t("mediaAnalysis.timeline.bookmarkDefaultNote", "Mark {time}", {
        time: timeLabel,
      });
    const bookmarkId = `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    dispatch({
      type: "workspace-bookmark-added",
      bookmark: {
        id: bookmarkId,
        timeMs,
        frameIndex: getTimelineBookmarkFrameIndex(timeMs),
        note,
        createdAt: Date.now(),
        projectId: state.projectIndex.activeProjectId,
        sourceKey: getWorkspaceSourceSelectionResetKey(state.source),
      },
    });
    if (noteInput) {
      noteInput.value = "";
    }
    updateTimelinePlaybackUi();
  }

  function canUseAssetAsSource(assetId: string) {
    const asset = deps.store.getState().assets.find(function (entry) {
      return entry.id === assetId;
    });
    if (!asset || asNonEmptyString(asset.localPath) === null) {
      return false;
    }
    return (
      asset.type === "source" ||
      asset.type === "clip" ||
      asset.type === "frame" ||
      asset.type === "audio" ||
      asset.type === "image"
    );
  }

  function getProjectWorkspaceActionIds(value: string) {
    const ids = value
      .split(",")
      .map(function (entry) {
        return entry.trim();
      })
      .filter(function (entry, index, allEntries) {
        return entry !== "" && allEntries.indexOf(entry) === index;
      });
    return ids.length > 0
      ? ids
      : deps.store.getState().ui.projectWorkspaceSelectedEntityIds.slice();
  }

  function findFirstSourceCapableAssetId(ids: string[]) {
    return (
      ids.find(function (assetId) {
        return canUseAssetAsSource(assetId);
      }) || null
    );
  }

  function findFirstReportAssetId(ids: string[]) {
    return (
      ids.find(function (assetId) {
        return deps.store.getState().assets.some(function (asset) {
          return asset.id === assetId && asset.type === "report";
        });
      }) || null
    );
  }

  function isProjectWorkspaceSelectionToggle(event: Event) {
    const candidate = event as Event & {
      ctrlKey?: boolean;
      metaKey?: boolean;
    };
    return candidate.ctrlKey === true || candidate.metaKey === true;
  }

  function selectProjectWorkspaceEntity(assetId: string, event: Event) {
    if (assetId.trim() === "") {
      return;
    }
    const state = deps.store.getState();
    if (isProjectWorkspaceSelectionToggle(event) !== true) {
      if (
        state.ui.projectWorkspaceSelectedEntityIds.length === 1 &&
        state.ui.projectWorkspaceSelectedEntityIds[0] === assetId
      ) {
        return;
      }
      dispatch({
        type: "project-workspace-entity-selected",
        entityIds: [assetId],
      });
      return;
    }
    const selectedIds = state.ui.projectWorkspaceSelectedEntityIds.slice();
    const existingIndex = selectedIds.indexOf(assetId);
    if (existingIndex >= 0) {
      selectedIds.splice(existingIndex, 1);
    } else {
      selectedIds.push(assetId);
    }
    dispatch({
      type: "project-workspace-entity-selected",
      entityIds: selectedIds,
    });
  }

  function normalizeProjectWorkspaceSortValue(value: unknown): "createdAt" | "name" | "type" {
    return String(value) === "name" || String(value) === "type"
      ? (String(value) as "name" | "type")
      : "createdAt";
  }

  function normalizeProjectWorkspaceFilterValue(value: unknown): LabAssetType | null {
    return String(value || "").trim() !== "" ? (String(value) as LabAssetType) : null;
  }

  function normalizeProjectWorkspaceGroupValue(value: unknown): "type" | "run" | "intent" | null {
    return String(value) === "type" || String(value) === "run" || String(value) === "intent"
      ? (String(value) as "type" | "run" | "intent")
      : null;
  }

  function readProjectWorkspaceCardTimelineHighlight(card: HTMLElement) {
    const assetId = toStringValue(card.dataset["labValue"]);
    const startMs = Number(card.dataset["labTimelineStartMs"]);
    const endMs = Number(card.dataset["labTimelineEndMs"]);
    if (assetId.trim() === "" || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return null;
    }
    if (endMs <= startMs) {
      return null;
    }
    const label = card.getAttribute("aria-label") || null;
    const highlight = {
      assetId,
      startMs: Math.max(0, Math.round(startMs)),
      endMs: Math.max(0, Math.round(endMs)),
    };
    return label !== null ? { ...highlight, label } : highlight;
  }

  function handleProjectWorkspaceCardHover(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const card = target.closest<HTMLElement>("[data-lab-action='project-workspace-entity-click']");
    if (!card) {
      return;
    }
    const highlight = readProjectWorkspaceCardTimelineHighlight(card);
    if (highlight === null) {
      return;
    }
    dispatch({
      type: "project-workspace-timeline-highlighted",
      highlight,
    });
  }

  function handleProjectWorkspaceCardLeave(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const card = target.closest<HTMLElement>("[data-lab-action='project-workspace-entity-click']");
    if (!card) {
      return;
    }
    const relatedTarget = (event as FocusEvent | MouseEvent).relatedTarget;
    if (relatedTarget instanceof Element && card.contains(relatedTarget)) {
      return;
    }
    if (readProjectWorkspaceCardTimelineHighlight(card) === null) {
      return;
    }
    dispatch({
      type: "project-workspace-timeline-highlighted",
      highlight: null,
    });
  }

  function getRoomApi() {
    return deps.windowRef.roomAPI;
  }

  function createActionRequestId(action: string) {
    return `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function sendMediaAction(
    action: string,
    payload: Record<string, unknown> = {},
    options: { requestId?: string } = {}
  ) {
    const roomApi = getRoomApi();
    if (!roomApi || typeof roomApi.sendEvent !== "function") {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Room API bridge is not connected.", "error"),
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
        ...payload,
      },
    });
    return requestId;
  }

  function startTrackedUserAction(
    action: string,
    payload: Record<string, unknown> = {}
  ): string | null {
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
        sourceAction: action,
      } satisfies LabUserActionEvent,
    });
    return sentRequestId;
  }

  function startTrackedReportExport() {
    const state = deps.store.getState();
    return startTrackedUserAction(
      state.featureId === "audio-analysis" ? "audio-report-export" : "report-export"
    );
  }

  function getCurrentRunIntentPayload(state = deps.store.getState()): Record<string, unknown> {
    const intentIds = toStringArray(getCurrentRun(state)?.analysisScope?.intentIds);
    return intentIds.length > 0 ? { intentIds } : {};
  }

  function getOperationCapabilityIdForUiAction(
    uiActionId: string
  ): LabOperationCapabilityId | null {
    return (
      LAB_OPERATION_CAPABILITIES.find(function (capability) {
        return capability.actionId === uiActionId;
      })?.id || null
    );
  }

  function getOperationSettingsPayload(
    capabilityId: LabOperationCapabilityId | null,
    state = deps.store.getState()
  ): Record<string, unknown> {
    if (capabilityId === null) {
      return {};
    }
    const operationSettings = asLabRecord(state.workbench["operationSettings"]);
    const normalizedSettings = normalizeLabOperationSettings(
      capabilityId,
      operationSettings[capabilityId]
    );
    return {
      operationSettings: normalizedSettings,
      ...(capabilityId === "enhanced-frame" && normalizedSettings["applyPreviewSettings"] === true
        ? { previewSettings: state.ui.workspace.interactiveSettings }
        : {}),
    };
  }

  function getActiveSelectionOperationPayload(state = deps.store.getState()) {
    const selection = state.ui.workspace.activeSelection;
    const seekMs =
      state.ui.workspace.timelineStartMs !== null
        ? state.ui.workspace.timelineStartMs
        : (selection?.startMs ?? 0);
    return {
      seekMs,
      ...(selection?.roi
        ? {
            normalizedRoi: {
              height: selection.roi.height,
              width: selection.roi.width,
              x: selection.roi.x,
              y: selection.roi.y,
            },
          }
        : {}),
      ...getCurrentRunIntentPayload(state),
    };
  }

  function startTrackedOperationForUiAction(uiActionId: string, payload?: Record<string, unknown>) {
    const trackedActionId = getTrackedOperationActionId(uiActionId);
    if (trackedActionId === null) {
      return null;
    }
    const capabilityId = getOperationCapabilityIdForUiAction(uiActionId);
    return startTrackedUserAction(trackedActionId, {
      ...(payload || {}),
      ...getOperationSettingsPayload(capabilityId),
    });
  }

  function clearHubDismissTimer(actionId: string) {
    const timer = hubDismissTimers.get(actionId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    hubDismissTimers.delete(actionId);
  }

  function scheduleHubDismiss(actionId: string) {
    if (hubDismissTimers.has(actionId)) {
      return;
    }
    hubDismissTimers.set(
      actionId,
      setTimeout(function () {
        hubDismissTimers.delete(actionId);
        dispatch({
          type: "user-action-hub-dismissed",
          id: actionId,
        });
      }, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS)
    );
  }

  function syncUserActionHubTimers() {
    const state = deps.store.getState();
    const activeUserActionIds = new Set<string>();
    getUserActions(state).forEach(function (entry) {
      activeUserActionIds.add(entry.id);
      if (entry.status === "success" && entry.dismissedFromHubAt == null) {
        if (
          Array.isArray(entry.resultAssetIds) &&
          entry.resultAssetIds.length > 0 &&
          getActionOutputs(state, entry.id).length === 0
        ) {
          clearHubDismissTimer(entry.id);
          return;
        }
        scheduleHubDismiss(entry.id);
        return;
      }
      clearHubDismissTimer(entry.id);
    });
    Array.from(hubDismissTimers.keys()).forEach(function (actionId) {
      if (!activeUserActionIds.has(actionId)) {
        clearHubDismissTimer(actionId);
      }
    });
  }

  function handleBusEvent(_event: LabStoreEvent) {
    syncUserActionHubTimers();
  }

  function sendHostContext(payload: Record<string, unknown>) {
    const roomApi = getRoomApi();
    if (!roomApi || typeof roomApi.sendEvent !== "function") {
      return;
    }
    roomApi.sendEvent("host-context", payload);
  }

  function updateWorkbench(
    update: (currentWorkbench: Record<string, unknown>) => Record<string, unknown>
  ) {
    const state = deps.store.getState();
    const currentWorkbench = {
      ...getWorkbench(state),
    };
    const nextWorkbench = update(currentWorkbench);
    dispatch({
      type: "workbench-updated",
      workbench: nextWorkbench,
    });
    sendHostContext({
      ...state.context,
      workbench: nextWorkbench,
    });
  }

  function getActiveProjectCreatedAt(state: ReturnType<typeof deps.store.getState>): unknown {
    const snapshot = asLabRecord(state.snapshot);
    const activeProject = asLabRecord(snapshot["activeProject"]);
    return activeProject["createdAt"];
  }

  function getSourcePresets(state: ReturnType<typeof deps.store.getState>) {
    return asLabRecord(asLabRecord(state.snapshot)["sourcePresets"]);
  }

  function getSourceModeOptions(
    state: ReturnType<typeof deps.store.getState>,
    kind: unknown
  ): string[] {
    const sourcePresets = getSourcePresets(state);
    const sourceTypes = asLabRecord(sourcePresets["sourceTypes"]);
    const sourceConfig = asLabRecord(sourceTypes[toStringValue(kind)]);
    const configuredModes = toStringArray(sourceConfig["modes"]);
    return configuredModes.length > 0 ? configuredModes : ["local"];
  }

  function getDefaultSourceMode(
    state: ReturnType<typeof deps.store.getState>,
    kind: unknown
  ): string {
    const sourcePresets = getSourcePresets(state);
    const sourceTypes = asLabRecord(sourcePresets["sourceTypes"]);
    const sourceConfig = asLabRecord(sourceTypes[toStringValue(kind)]);
    const configuredDefault = asNonEmptyString(sourceConfig["defaultMode"]);
    if (configuredDefault) {
      return configuredDefault;
    }
    return getSourceModeOptions(state, kind)[0] || "local";
  }

  function getDefaultSourceKind(state: ReturnType<typeof deps.store.getState>): string {
    const sourcePresets = getSourcePresets(state);
    const configuredDefault = asNonEmptyString(sourcePresets["defaultSourceType"]);
    if (configuredDefault) {
      return configuredDefault;
    }
    const sourceTypes = asLabRecord(sourcePresets["sourceTypes"]);
    const firstConfiguredKind = Object.keys(sourceTypes).find(function (entry) {
      return entry.trim() !== "";
    });
    return firstConfiguredKind || "video";
  }

  function getDefaultYoutubePreset(state: ReturnType<typeof deps.store.getState>): string {
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

  function getYoutubePresetDefaults(
    state: ReturnType<typeof deps.store.getState>,
    presetId: string | null
  ) {
    const sourcePresets = getSourcePresets(state);
    const presets = asLabRecord(sourcePresets["youtubePresets"]);
    const resolvedPresetId = presetId || getDefaultYoutubePreset(state);
    return asLabRecord(asLabRecord(presets[resolvedPresetId])["defaultCustomValues"]);
  }

  function buildEmptySourceState(state: ReturnType<typeof deps.store.getState>) {
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
        urlInput: "",
        youtubeUrl: "",
        youtubePreset,
        youtubeCustom: {
          ...getYoutubePresetDefaults(state, youtubePreset),
        },
      },
    };
  }

  function mergeSourceDrafts(
    state: ReturnType<typeof deps.store.getState>,
    patch: Partial<LabSourceDrafts>
  ): LabSourceDrafts {
    const currentDrafts = state.ui.sourceDrafts;
    return {
      ...currentDrafts,
      ...patch,
      youtubeCustom:
        patch.youtubeCustom !== undefined
          ? {
              ...asLabRecord(currentDrafts.youtubeCustom),
              ...asLabRecord(patch.youtubeCustom),
            }
          : asLabRecord(currentDrafts.youtubeCustom),
    };
  }

  function buildSourceDraftPatch(
    state: ReturnType<typeof deps.store.getState>,
    field: string,
    value: unknown
  ): Partial<LabSourceDrafts> | null {
    const currentDrafts = state.ui.sourceDrafts;
    switch (field) {
      case "source.urlInput":
        if (currentDrafts.urlInput === value) {
          return null;
        }
        return {
          urlInput: typeof value === "string" ? value : "",
        };
      case "source.youtubeUrl":
        if (currentDrafts.youtubeUrl === value) {
          return null;
        }
        return {
          youtubeUrl: typeof value === "string" ? value : "",
        };
      case "source.youtubePreset": {
        const presetId =
          typeof value === "string" && value.trim() !== "" ? value : getDefaultYoutubePreset(state);
        return {
          youtubePreset: presetId,
          youtubeCustom:
            Object.keys(asLabRecord(currentDrafts.youtubeCustom)).length > 0
              ? asLabRecord(currentDrafts.youtubeCustom)
              : { ...getYoutubePresetDefaults(state, presetId) },
        };
      }
      case "source.youtubeCaptureMode": {
        const mode = value === "audio-only" || value === "video-only" ? value : "video+audio";
        return {
          youtubeCaptureMode: mode,
        };
      }
      default:
        if (field.startsWith("source.youtubeCustom.")) {
          const customField = field.replace("source.youtubeCustom.", "");
          const presetId =
            asNonEmptyString(currentDrafts.youtubePreset) || getDefaultYoutubePreset(state);
          return {
            youtubeCustom: {
              ...getYoutubePresetDefaults(state, presetId),
              ...asLabRecord(currentDrafts.youtubeCustom),
              [customField]: value,
            },
          };
        }
        return null;
    }
  }

  function buildProjectImportDraftPatch(
    state: ReturnType<typeof deps.store.getState>,
    field: string,
    value: unknown
  ): Partial<LabSourceDrafts> | null {
    const currentDrafts = state.ui.projectImport.drafts[state.ui.projectImport.activeKind];
    switch (field) {
      case "project-import.urlInput":
        if (currentDrafts.urlInput === value) {
          return null;
        }
        return {
          urlInput: typeof value === "string" ? value : "",
        };
      case "project-import.youtubeUrl":
        if (currentDrafts.youtubeUrl === value) {
          return null;
        }
        return {
          youtubeUrl: typeof value === "string" ? value : "",
        };
      case "project-import.youtubeCaptureMode": {
        const mode = value === "audio-only" || value === "video-only" ? value : "video+audio";
        return {
          youtubeCaptureMode: mode,
        };
      }
      default:
        if (field.startsWith("project-import.youtubeCustom.")) {
          const customField = field.replace("project-import.youtubeCustom.", "");
          const presetId =
            asNonEmptyString(currentDrafts.youtubePreset) || getDefaultYoutubePreset(state);
          return {
            youtubeCustom: {
              ...getYoutubePresetDefaults(state, presetId),
              ...asLabRecord(currentDrafts.youtubeCustom),
              [customField]: value,
            },
          };
        }
        return null;
    }
  }

  function persistSourceDraftField(field: string, value: unknown) {
    const state = deps.store.getState();
    if (getWorkspaceLockState(state).source === true) {
      pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
      return;
    }
    const patch = buildSourceDraftPatch(state, field, value);
    if (patch === null) {
      return;
    }
    dispatch({
      type: "source-drafts-updated",
      patch,
    });
    sendMediaAction("source-update-draft", {
      fields: mergeSourceDrafts(state, patch),
    });
  }

  function startCleanProjectSession() {
    const state = deps.store.getState();
    const resetSourceState = buildEmptySourceState(state);
    dispatch({ type: "project-import-reset" });
    dispatch({
      type: "source-config-patched",
      patch: resetSourceState,
    });
    dispatch({
      type: "source-drafts-updated",
      patch: resetSourceState.drafts,
    });
    dispatch({
      type: "source-drafts-committed",
    });
    sendMediaAction("project-create");
  }

  function selectProjectByValue(projectValue: string) {
    if (projectValue === "new") {
      startCleanProjectSession();
      return;
    }
    if (projectValue.trim() !== "") {
      sendMediaAction("project-select", { projectId: projectValue });
    }
  }

  function updateAnalysisScopeField(field: string, value: unknown) {
    updateWorkbench(function (workbench) {
      const nextScope = toDraftScope(workbench);
      const nextTimeRange = { ...asLabRecord(nextScope["timeRange"]) };
      const nextFrameRange = { ...asLabRecord(nextScope["frameRange"]) };
      const nextRegion = { ...asLabRecord(nextScope["region"]) };

      function readNumeric(nextValue: unknown) {
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
          const nextIntentIds = Array.isArray(value)
            ? value
                .filter((entry): entry is string => typeof entry === "string")
                .map(function (entry) {
                  return entry.trim();
                })
                .filter(function (entry) {
                  return entry !== "";
                })
            : [];
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
          if (
            typeof nextTimeRange["startMs"] === "number" &&
            typeof nextTimeRange["endMs"] === "number" &&
            nextTimeRange["endMs"] > nextTimeRange["startMs"]
          ) {
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
          if (
            typeof nextFrameRange["startFrame"] === "number" &&
            typeof nextFrameRange["endFrame"] === "number"
          ) {
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
          const targetKey =
            field === "regionX"
              ? "x"
              : field === "regionY"
                ? "y"
                : field === "regionWidth"
                  ? "width"
                  : "height";
          if (nextValue === null) {
            delete nextRegion[targetKey];
          } else {
            nextRegion[targetKey] =
              targetKey === "width" || targetKey === "height"
                ? Math.max(1, Math.round(nextValue))
                : Math.max(0, Math.round(nextValue));
          }
          if (
            typeof nextRegion["x"] === "number" &&
            typeof nextRegion["y"] === "number" &&
            typeof nextRegion["width"] === "number" &&
            typeof nextRegion["height"] === "number"
          ) {
            nextScope["region"] = nextRegion;
          } else {
            delete nextScope["region"];
          }
          break;
        }
        default:
          break;
      }

      if (
        nextScope["focus"] === undefined &&
        nextScope["hypothesis"] === undefined &&
        nextScope["timeRange"] === undefined &&
        nextScope["frameRange"] === undefined &&
        nextScope["region"] === undefined &&
        nextScope["intentIds"] === undefined
      ) {
        return {
          ...workbench,
          analysisScope: null,
        };
      }

      return {
        ...workbench,
        analysisScope: nextScope,
      };
    });
  }

  function toggleModule(moduleId: string) {
    if (moduleId.trim() === "") {
      return;
    }
    updateWorkbench(function (workbench) {
      const moduleToggles = {
        ...asLabRecord(workbench["moduleToggles"]),
      };
      moduleToggles[moduleId] = moduleToggles[moduleId] === false;
      return {
        ...workbench,
        moduleToggles,
      };
    });
  }

  function activateFeature(featureId: string) {
    dispatch({
      type: "feature-changed",
      featureId: featureId as LabFeatureId,
    });
    updateWorkbench(function (workbench) {
      const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"])
        ? (workbench["selectedModuleIds"] as unknown[]).filter(
            (entry): entry is string => typeof entry === "string"
          )
        : [];
      return {
        ...workbench,
        activeModuleId: featureId,
        selectedModuleIds: selectedModuleIds.includes(featureId)
          ? selectedModuleIds
          : [featureId].concat(selectedModuleIds),
      };
    });
  }

  function toggleFeature(featureId: string) {
    updateWorkbench(function (workbench) {
      const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"])
        ? (workbench["selectedModuleIds"] as unknown[]).filter(
            (entry): entry is string => typeof entry === "string"
          )
        : [];
      const activeModuleId = asNonEmptyString(workbench["activeModuleId"]) || featureId;
      const nextSelected = selectedModuleIds.includes(featureId)
        ? selectedModuleIds.filter(function (entry) {
            return entry !== featureId;
          })
        : selectedModuleIds.concat(featureId);
      const safeSelected = nextSelected.length > 0 ? nextSelected : [featureId];
      return {
        ...workbench,
        activeModuleId: safeSelected.includes(activeModuleId) ? activeModuleId : safeSelected[0],
        selectedModuleIds: safeSelected,
      };
    });
  }

  function syncCapabilities(nextCapabilities: string[]) {
    const normalizedCapabilities = Array.from(
      new Set(
        nextCapabilities.filter(function (entry) {
          return entry.trim() !== "";
        })
      )
    );
    const { activeFeatureId, featureIds } =
      deriveFeatureSelectionFromCapabilities(normalizedCapabilities);
    dispatch({
      type: "capability-set",
      capabilities: normalizedCapabilities as import("../models/lab-types.js").CapabilityFamilyId[],
    });
    dispatch({
      type: "feature-changed",
      featureId: activeFeatureId,
    });
    updateWorkbench(function (workbench) {
      return {
        ...workbench,
        activeModuleId: activeFeatureId,
        selectedModuleIds: featureIds,
        selectedCapabilityIds: normalizedCapabilities,
      };
    });
  }

  function runSourcePrimaryAction() {
    const state = deps.store.getState();
    const sourceDrafts = state.ui.sourceDrafts;

    function startProbe(action: string, payload: Record<string, unknown>) {
      sendMediaAction(action, payload);
    }

    const mode = getSourceMode(state);
    const fields = {
      urlInput: sourceDrafts.urlInput,
      youtubeUrl: sourceDrafts.youtubeUrl,
      youtubePreset: sourceDrafts.youtubePreset,
      youtubeCustom: sourceDrafts.youtubeCustom,
      youtubeCaptureMode: sourceDrafts.youtubeCaptureMode,
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

  function runProjectImportAction(importAction: ReturnType<typeof buildProjectImportHostAction>) {
    const state = deps.store.getState();
    if (getWorkspaceLockState(state).source === true || isRunActive(state)) {
      pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
      return;
    }
    if (importAction.disabledReason !== null) {
      dispatch({
        type: "push-event",
        event: buildUiEvent(importAction.disabledReason, "warning"),
      });
      return;
    }
    const requestId = sendMediaAction(importAction.action, { fields: importAction.fields });
    dispatch({
      type: "project-import-review-focused",
      focus: requestId === null ? "draft" : "running",
      action: importAction.action,
      requestId,
    });
  }

  function runProjectImportAdd() {
    runProjectImportAction(buildProjectImportHostAction(deps.store.getState()));
  }

  function runProjectImportLocalAdd() {
    runProjectImportAction(buildProjectImportLocalHostAction(deps.store.getState()));
  }

  function runProjectImportUrlCheck() {
    const state = deps.store.getState();
    if (getWorkspaceLockState(state).source === true || isRunActive(state)) {
      pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
      return;
    }
    const checkAction = buildProjectImportUrlCheckAction(state);
    if (checkAction.disabledReason !== null) {
      dispatch({
        type: "push-event",
        event: buildUiEvent(checkAction.disabledReason, "warning"),
      });
      return;
    }
    const requestId = sendMediaAction("project-import-check-url", {
      fields: checkAction.fields,
    });
    if (requestId === null) {
      dispatch({
        type: "project-import-url-check-failed",
        url: checkAction.url,
        error: "Room API bridge is not connected.",
      });
      return;
    }
    dispatch({
      type: "project-import-url-check-started",
      url: checkAction.url,
    });
  }

  function clearProjectImportDraft() {
    const state = deps.store.getState();
    if (hasProjectImportDraftValue(state) !== true) {
      return;
    }
    const route = state.ui.projectImport;
    clearYoutubeImportParseTimer();
    dispatch({ type: "project-import-cleared", kind: route.activeKind });
    if (route.activeKind === "video" && route.methods.video === "youtube") {
      dispatch({ type: "youtube-import-clear" });
    }
  }

  function getRetrySourceFields(state: ReturnType<typeof deps.store.getState>) {
    const source = asLabRecord(state.source);
    const drafts = state.ui.sourceDrafts;
    return {
      urlInput:
        drafts.urlInput ||
        asNonEmptyString(source["sourceUrl"]) ||
        asNonEmptyString(source["url"]) ||
        "",
      youtubeUrl:
        drafts.youtubeUrl ||
        asNonEmptyString(source["youtubeUrl"]) ||
        asNonEmptyString(source["sourceUrl"]) ||
        asNonEmptyString(source["url"]) ||
        "",
      youtubePreset: drafts.youtubePreset,
      youtubeCustom: drafts.youtubeCustom,
      youtubeCaptureMode: drafts.youtubeCaptureMode,
    };
  }

  function runSourceRetryAction() {
    const state = deps.store.getState();
    const blockReason = getSourceRetryBlockReason(state);
    if (blockReason !== null) {
      const copy = createLabI18n(state.context);
      dispatch({
        type: "push-event",
        event: buildUiEvent(formatSourceRetryBlockReason(blockReason, copy), "warning"),
      });
      return;
    }
    const mode = getSourceMode(state);
    const fields = getRetrySourceFields(state);
    if (mode === "url") {
      sendMediaAction("source-download-url", { fields });
      return;
    }
    if (mode === "youtube") {
      sendMediaAction("source-download-youtube", { fields });
      return;
    }
    sendMediaAction("source-pick-local", { fields, retry: true });
  }

  function collectIntentCapabilities(selectedIntents: LabIntentId[]): CapabilityFamilyId[] {
    const intentCapabilities: CapabilityFamilyId[] = [];
    WORKSPACE_INTENTS.forEach(function (intent) {
      if (selectedIntents.includes(intent.id)) {
        intent.internalCapabilities.forEach(function (capId) {
          if (!intentCapabilities.includes(capId)) {
            intentCapabilities.push(capId);
          }
        });
      }
    });
    return intentCapabilities;
  }

  function startDeepAnalysis(state: ReturnType<typeof deps.store.getState>) {
    const ws = state.ui.workspace;
    const intentCapabilities =
      ws.selectedIntents.length > 0
        ? collectIntentCapabilities(ws.selectedIntents)
        : state.selectedCapabilities.slice();
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
    const runAction = activeFeatureId === "audio-analysis" ? "audio-process-run" : "process-run";
    dispatch({ type: "run-started", action: runAction });
    if (sendMediaAction(runAction) === null) {
      dispatch({
        type: "run-failed",
        action: runAction,
        detail: "Room API bridge is not connected.",
      });
    }
  }

  function runPrimaryAction() {
    const state = deps.store.getState();

    // Report export — if report payload exists and overlay is open or run is complete
    if (hasReportPayload(state) && (state.ui.workspace.reportOverlayOpen || isRunComplete(state))) {
      startTrackedReportExport();
      return;
    }

    // Process cancel/run — if run is active, cancel; if analysis is ready, start
    if (isRunActive(state)) {
      if (state.ui.analysisCancelPending === true) {
        return;
      }
      dispatch({ type: "analysis-cancel-requested" });
      sendMediaAction(
        state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel"
      );
      return;
    }
    if (getSourceReady(state) && getAnalysisActionBlockReason(state) === null) {
      startDeepAnalysis(state);
      return;
    }

    // Edit preview — if source is ready but analysis isn't ready yet
    if (getSourceReady(state) && getEditActionBlockReason(state) === null) {
      sendMediaAction("edit-preview");
      return;
    }

    // Source action — default route
    runSourcePrimaryAction();
  }

  function findAsset(assetId: string) {
    return (
      deps.store.getState().assets.find(function (asset) {
        return asset.id === assetId;
      }) || null
    );
  }

  function getAssetHref(assetId: string) {
    const asset = findAsset(assetId);
    if (asset === null) {
      return null;
    }
    const metadata = asLabRecord(asset.metadata);
    return (
      asNonEmptyString(asset.url) ||
      asNonEmptyString(asset.localPath) ||
      asNonEmptyString(metadata["thumbnailUrl"])
    );
  }

  function previewAsset(assetId: string) {
    const href = getAssetHref(assetId);
    if (href === null) {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Asset preview is unavailable.", "warning"),
      });
      return false;
    }
    dispatch({ type: "asset-preview-opened", assetId });
    return true;
  }

  function confirmAssetRemoval(assetIds: string[]) {
    const ids = assetIds.filter(function (assetId, index, allIds) {
      return assetId.trim() !== "" && allIds.indexOf(assetId) === index;
    });
    if (ids.length === 0) {
      return false;
    }
    if (typeof deps.windowRef.confirm !== "function") {
      return true;
    }

    const labels = ids.map(function (assetId) {
      const asset = findAsset(assetId);
      return asset ? asNonEmptyString(asset.name) || assetId : assetId;
    });
    const message =
      labels.length === 1
        ? `"${labels[0]}" varlığı silinsin mi?`
        : `${labels.length} varlık silinsin mi?\n${labels.join("\n")}`;
    return deps.windowRef.confirm(message);
  }

  function removeAssetsWithConfirmation(assetIds: string[]) {
    const ids = assetIds.filter(function (assetId, index, allIds) {
      return assetId.trim() !== "" && allIds.indexOf(assetId) === index;
    });
    if (!confirmAssetRemoval(ids)) {
      return false;
    }
    ids.forEach(function (assetId) {
      sendMediaAction("asset-remove", { assetId });
    });
    return ids.length > 0;
  }

  function downloadAsset(assetId: string) {
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
    const preview = deps.documentRef.querySelector?.("#lab-workspace-preview") as {
      focus?: () => void;
      scrollIntoView?: (options?: ScrollIntoViewOptions) => void;
    } | null;
    if (!preview || typeof preview.scrollIntoView !== "function") {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Source preview is unavailable.", "warning"),
      });
      return;
    }
    preview.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
    if (typeof preview.focus === "function") {
      preview.focus();
    }
  }

  function clampMediaTime(media: MediaLikeElement | null, seconds: number) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    if (media && typeof media.duration === "number" && Number.isFinite(media.duration)) {
      return Math.max(0, Math.min(media.duration, safeSeconds));
    }
    return safeSeconds;
  }

  function getTimelineFrameDurationSeconds(media: MediaLikeElement | null) {
    const sourceMetadata = asLabRecord(asLabRecord(deps.store.getState().source)["metadata"]);
    const metadataFps = asNumber(sourceMetadata["fps"]);
    if (metadataFps !== null && metadataFps >= 12 && metadataFps <= 240) {
      return 1 / metadataFps;
    }

    const totalFrames =
      typeof media?.getVideoPlaybackQuality === "function"
        ? (media.getVideoPlaybackQuality().totalVideoFrames ?? 0)
        : 0;
    if (media !== null && totalFrames > 1 && media.currentTime > 0) {
      const inferredFps = totalFrames / media.currentTime;
      if (Number.isFinite(inferredFps) && inferredFps >= 12 && inferredFps <= 240) {
        return 1 / inferredFps;
      }
    }

    return FALLBACK_TIMELINE_FRAME_DURATION_SECONDS;
  }

  function getTimelinePlayheadShiftMs(value: string, media: MediaLikeElement | null) {
    if (value === "-frame" || value === "+frame") {
      const frameMs = Math.max(1, Math.round(getTimelineFrameDurationSeconds(media) * 1000));
      return value === "-frame" ? -frameMs : frameMs;
    }
    const deltaMs = Number(value);
    return Number.isFinite(deltaMs) ? deltaMs : null;
  }

  function safePlay(media: MediaLikeElement | null) {
    try {
      const result = media?.play?.();
      if (result && typeof (result as PromiseLike<void>).then === "function") {
        void (result as PromiseLike<void>).then(
          function () {},
          function () {}
        );
      }
    } catch {
      // NOTE: Media playback retries are best-effort only.
    }
  }

  function seekSinglePreviewToMs(timeMs: number) {
    const media = getPrimaryWorkspacePreviewMedia();
    if (media !== null) {
      media.currentTime = clampMediaTime(media, timeMs / 1000);
      updateTimelinePlaybackUi();
      return true;
    }
    const mediaEls =
      deps.documentRef.querySelectorAll?.<HTMLMediaElement>(".labx-preview-media") || [];
    mediaEls.forEach(function (el) {
      el.currentTime = timeMs / 1000;
    });
    updateTimelinePlaybackUi();
    return mediaEls.length > 0;
  }

  function seekTimelineToMs(timeMs: number) {
    return seekSinglePreviewToMs(timeMs);
  }

  function shiftTimelinePlayhead(value: string) {
    const media = getTimelineSyncMedia();
    if (media === null || typeof media.currentTime !== "number") {
      return;
    }
    const deltaMs = getTimelinePlayheadShiftMs(value, media);
    if (deltaMs === null) {
      return;
    }
    if ((value === "-frame" || value === "+frame") && media.paused !== true) {
      media.pause?.();
    }
    const durationMs = getTimelineDurationMs(media);
    const currentMs = Math.max(0, Math.round(media.currentTime * 1000));
    const unclampedNextMs = currentMs + deltaMs;
    const nextMs =
      durationMs > 0
        ? Math.max(0, Math.min(durationMs, unclampedNextMs))
        : Math.max(0, unclampedNextMs);
    seekTimelineToMs(nextMs);
  }

  function centerTimelineTarget(target: Element) {
    const track = target.closest<HTMLElement>(".labx-timeline__track");
    if (!track || track.scrollWidth <= track.clientWidth) {
      return;
    }
    const targetRect = (target as HTMLElement).getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const targetCenter = targetRect.left - trackRect.left + targetRect.width / 2;
    track.scrollLeft = Math.max(0, targetCenter - track.clientWidth / 2);
  }

  // --- Timeline drag state ---
  type TimelineDragMode = "none" | "pending-seek" | "rail" | "start" | "end" | "body";
  type TimelineTrackGeometry = {
    left: number;
    width: number;
  };
  let timelineDragMode: TimelineDragMode = "none";
  let timelineDragTrack: HTMLElement | null = null;
  let timelineDragTrackGeometry: TimelineTrackGeometry | null = null;
  let timelineDragDurationMs: number = 0;
  let timelineDragAnchorMs: number = 0;
  let timelineDragFinalMs: number = 0;
  let timelineDragBodyOffsetStart: number = 0;
  let timelineDragBodyOffsetEnd: number = 0;
  let timelineDragBodyPointerOffsetMs: number = 0;
  let timelinePendingClientX: number = 0;
  let timelinePendingShiftKey = false;
  const TIMELINE_DRAG_THRESHOLD_PX = 4;

  function getTimelineTrackGeometry(track: Element): TimelineTrackGeometry | null {
    const rect = (track as HTMLElement).getBoundingClientRect();
    if (rect.width <= 0 || Number.isFinite(rect.width) !== true) {
      return null;
    }
    return {
      left: rect.left,
      width: rect.width,
    };
  }

  function msFromTrackGeometry(
    geometry: TimelineTrackGeometry,
    durationMs: number,
    clientX: number
  ): number {
    const x = Math.max(0, Math.min(clientX - geometry.left, geometry.width));
    const pct = x / geometry.width;
    return Math.max(0, Math.round(durationMs * pct));
  }

  function msFromTrackClientX(track: Element, durationMs: number, clientX: number): number {
    const geometry = getTimelineTrackGeometry(track);
    return geometry === null ? 0 : msFromTrackGeometry(geometry, durationMs, clientX);
  }

  function msFromTrackX(clientX: number): number {
    if (!timelineDragTrack) return 0;
    const geometry = timelineDragTrackGeometry ?? getTimelineTrackGeometry(timelineDragTrack);
    return geometry === null ? 0 : msFromTrackGeometry(geometry, timelineDragDurationMs, clientX);
  }

  function isWorkspaceMutationLocked(lockKey: keyof ReturnType<typeof getWorkspaceLockState>) {
    return getWorkspaceLockState(deps.store.getState())[lockKey] === true;
  }

  function pushLockedWorkspaceEvent(message: string) {
    dispatch({
      type: "push-event",
      event: buildUiEvent(message, "warning"),
    });
  }

  function startTimelineDrag(track: Element, anchorMs: number, durationMs: number) {
    timelineDragMode = "rail";
    timelineDragTrack = track as HTMLElement;
    timelineDragTrackGeometry = timelineDragTrackGeometry ?? getTimelineTrackGeometry(track);
    timelineDragDurationMs = durationMs;
    timelineDragAnchorMs = anchorMs;
    timelineDragFinalMs = anchorMs;
    dispatch({ type: "workspace-timeline-updated", startMs: anchorMs, endMs: anchorMs });
    seekTimelineToMs(anchorMs);
  }

  function startTimelinePendingSeek(
    track: Element,
    anchorMs: number,
    durationMs: number,
    clientX: number,
    shiftKey: boolean,
    event: MouseEvent
  ) {
    event.preventDefault();
    timelineDragMode = "pending-seek";
    timelineDragTrack = track as HTMLElement;
    timelineDragTrackGeometry = getTimelineTrackGeometry(track);
    timelineDragDurationMs = durationMs;
    timelineDragAnchorMs = anchorMs;
    timelinePendingClientX = clientX;
    timelinePendingShiftKey = shiftKey;
  }

  function startTimelineHandleDrag(
    track: Element,
    mode: "start" | "end",
    durationMs: number,
    event: MouseEvent
  ) {
    event.preventDefault();
    event.stopPropagation();
    timelineDragMode = mode;
    timelineDragTrack = track as HTMLElement;
    timelineDragTrackGeometry = getTimelineTrackGeometry(track);
    timelineDragDurationMs = durationMs;
  }

  function startTimelineBodyDrag(track: Element, durationMs: number, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const state = deps.store.getState();
    const currentStart = state.ui.workspace.timelineStartMs ?? 0;
    const currentEnd = state.ui.workspace.timelineEndMs ?? durationMs;
    const pointerMs = msFromTrackClientX(track, durationMs, event.clientX);
    timelineDragMode = "body";
    timelineDragTrack = track as HTMLElement;
    timelineDragTrackGeometry = getTimelineTrackGeometry(track);
    timelineDragDurationMs = durationMs;
    timelineDragBodyOffsetStart = currentStart;
    timelineDragBodyOffsetEnd = currentEnd;
    timelineDragBodyPointerOffsetMs = Math.max(
      0,
      Math.min(currentEnd - currentStart, pointerMs - currentStart)
    );
  }

  function extendTimelineSelectionToMs(timeMs: number) {
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

  function handleMouseDown(event: Event) {
    if (!(event instanceof MouseEvent)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const handleEl = target.closest<HTMLElement>(
      "[data-lab-action='timeline-interact'], [data-lab-action='timeline-drag-start'], [data-lab-action='timeline-drag-end'], [data-lab-action='timeline-drag-body']"
    );
    if (!handleEl) return;
    if (isWorkspaceMutationLocked("timeline")) {
      return;
    }

    const action = toStringValue(handleEl.dataset["labAction"]);
    const timeline = handleEl.closest<HTMLElement>(".labx-timeline");
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

  function handleTimelineMouseMove(event: MouseEvent) {
    if (timelineDragMode === "none" || !timelineDragTrack) return;
    if (isWorkspaceMutationLocked("timeline")) {
      timelineDragMode = "none";
      timelineDragTrack = null;
      timelineDragTrackGeometry = null;
      return;
    }

    const ms = msFromTrackX(event.clientX);

    if (timelineDragMode === "pending-seek") {
      const shiftPx = Math.abs(event.clientX - timelinePendingClientX);
      if (shiftPx < TIMELINE_DRAG_THRESHOLD_PX) {
        return;
      }
      startTimelineDrag(timelineDragTrack, timelineDragAnchorMs, timelineDragDurationMs);
    }

    const state = deps.store.getState();

    if (timelineDragMode === "rail") {
      const startMs = Math.min(timelineDragAnchorMs, ms);
      const endMs = Math.max(timelineDragAnchorMs, ms);
      timelineDragFinalMs = ms;
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
    if (isWorkspaceMutationLocked("timeline")) {
      timelineDragMode = "none";
      timelineDragTrack = null;
      timelineDragTrackGeometry = null;
      return;
    }
    if (timelineDragMode === "pending-seek") {
      if (timelinePendingShiftKey === true) {
        extendTimelineSelectionToMs(timelineDragAnchorMs);
        seekTimelineToMs(timelineDragAnchorMs);
      } else {
        seekTimelineToMs(timelineDragAnchorMs);
      }
    } else if (timelineDragMode === "rail") {
      seekTimelineToMs(timelineDragFinalMs);
    } else {
      const state = deps.store.getState();
      const selectionStart = state.ui.workspace.timelineStartMs;
      const selectionEnd = state.ui.workspace.timelineEndMs;
      if (timelineDragMode === "end" && typeof selectionEnd === "number") {
        seekTimelineToMs(selectionEnd);
      } else if (typeof selectionStart === "number") {
        seekTimelineToMs(selectionStart);
      }
    }
    timelineDragMode = "none";
    timelineDragTrack = null;
    timelineDragTrackGeometry = null;
    timelineDragFinalMs = 0;
    timelineDragBodyPointerOffsetMs = 0;
    timelinePendingClientX = 0;
    timelinePendingShiftKey = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey !== true || event.key.toLowerCase() !== "b") {
      return;
    }
    if (isTextControl(event.target)) {
      return;
    }
    event.preventDefault();
    dispatch({ type: "drawer-collapsed-toggled" });
  }

  function parseFiniteNumber(value: string | undefined, fallback: number) {
    if (value === undefined || value.trim() === "") {
      return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function roundForStep(value: number, step: number) {
    const [, decimalPart = ""] = String(step).split(".");
    const precision = Math.min(6, decimalPart.length + 2);
    return Number(value.toFixed(precision));
  }

  function clampAdjustedValue(value: number, min: number, max: number, step: number) {
    return roundForStep(Math.max(min, Math.min(max, value)), step);
  }

  function readWorkspaceSetting(field: string): unknown {
    const state = deps.store.getState();
    if (field.startsWith("workspace.interactive.")) {
      const settingKey = field.replace("workspace.interactive.", "");
      return (state.ui.workspace.interactiveSettings as unknown as Record<string, unknown>)[
        settingKey
      ];
    }
    if (field.startsWith("workspace.audioFocus.eqBands.")) {
      const parts = field.replace("workspace.audioFocus.", "").split(".");
      const bandIndex = parts.length > 1 ? parseInt(parts[1] as string, 10) : NaN;
      const bandProp = parts.length > 2 ? parts[2] : undefined;
      if (!Number.isNaN(bandIndex) && bandIndex >= 0 && typeof bandProp === "string") {
        return (
          state.ui.workspace.audioFocus.eqBands[bandIndex] as Record<string, unknown> | undefined
        )?.[bandProp];
      }
      return undefined;
    }
    if (field.startsWith("workspace.audioFocus.")) {
      const audioKey = field.replace("workspace.audioFocus.", "");
      return (state.ui.workspace.audioFocus as unknown as Record<string, unknown>)[audioKey];
    }
    return undefined;
  }

  function patchInteractiveSetting(settingKey: string, rawValue: unknown) {
    dispatch({
      type: "workspace-interactive-updated",
      patch: { [settingKey]: rawValue } as Partial<LabInteractiveSettings>,
    });
  }

  function patchAudioFocusSetting(audioKey: string, rawValue: unknown) {
    if (audioKey.startsWith("eqBands.")) {
      const eqState = deps.store.getState();
      const currentBands = eqState.ui.workspace.audioFocus.eqBands.map(function (band) {
        return { ...band };
      });
      const parts = audioKey.split(".");
      const bandIndex = parts.length > 1 ? parseInt(parts[1] as string, 10) : NaN;
      const bandProp = parts.length > 2 ? parts[2] : "";
      if (
        !Number.isNaN(bandIndex) &&
        bandIndex >= 0 &&
        bandIndex < currentBands.length &&
        bandProp
      ) {
        const numValue = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue));
        if (!Number.isNaN(numValue)) {
          (currentBands[bandIndex] as Record<string, unknown>)[bandProp] = numValue;
        }
      }
      dispatch({
        type: "workspace-audio-updated",
        patch: { eqBands: currentBands } as Partial<LabAudioFocusSettings>,
      });
      return;
    }
    dispatch({
      type: "workspace-audio-updated",
      patch: { [audioKey]: rawValue } as Partial<LabAudioFocusSettings>,
    });
  }

  function patchWorkspaceSetting(field: string, rawValue: unknown) {
    if (field.startsWith("workspace.interactive.")) {
      patchInteractiveSetting(field.replace("workspace.interactive.", ""), rawValue);
      return;
    }
    if (field.startsWith("workspace.audioFocus.")) {
      patchAudioFocusSetting(field.replace("workspace.audioFocus.", ""), rawValue);
    }
  }

  function isOperationCapabilityId(value: string): value is LabOperationCapabilityId {
    return LAB_OPERATION_CAPABILITIES.some(function (capability) {
      return capability.id === value;
    });
  }

  function patchOperationSetting(field: string, rawValue: unknown) {
    if (isRunActive(deps.store.getState())) {
      pushLockedWorkspaceEvent("İşlem ayarları aktif analiz sırasında kilitli.");
      return;
    }
    const parts = field.replace("operationSettings.", "").split(".");
    const capabilityId = parts[0] || "";
    const settingKey = parts[1] || "";
    if (!isOperationCapabilityId(capabilityId) || settingKey === "") {
      return;
    }
    updateWorkbench(function (workbench) {
      const operationSettings = { ...asLabRecord(workbench["operationSettings"]) };
      const currentSettings = asLabRecord(operationSettings[capabilityId]);
      operationSettings[capabilityId] = normalizeLabOperationSettings(capabilityId, {
        ...currentSettings,
        [settingKey]: rawValue,
      });
      return {
        ...workbench,
        operationSettings,
      };
    });
  }

  function resetOperationSettings(capabilityId: string) {
    if (isRunActive(deps.store.getState())) {
      pushLockedWorkspaceEvent("İşlem ayarları aktif analiz sırasında kilitli.");
      return;
    }
    if (!isOperationCapabilityId(capabilityId)) {
      return;
    }
    updateWorkbench(function (workbench) {
      return {
        ...workbench,
        operationSettings: {
          ...asLabRecord(workbench["operationSettings"]),
          [capabilityId]: normalizeLabOperationSettings(
            capabilityId,
            LAB_OPERATION_SETTINGS_DEFAULTS[capabilityId]
          ),
        },
      };
    });
  }

  function patchAnalysisModuleSetting(field: string, rawValue: unknown) {
    if (isRunActive(deps.store.getState())) {
      pushLockedWorkspaceEvent("Analiz ayarları aktif analiz sırasında kilitli.");
      return;
    }
    const parts = field.replace("analysisSettings.modules.", "").split(".");
    const moduleId = parts[0] || "";
    const settingKey = parts[1] || "";
    if (moduleId === "" || settingKey === "") {
      return;
    }
    updateWorkbench(function (workbench) {
      const analysisSettings = { ...asLabRecord(workbench["analysisSettings"]) };
      const modules = { ...asLabRecord(analysisSettings["modules"]) };
      const currentSettings = asLabRecord(modules[moduleId]);
      modules[moduleId] = normalizeLabAnalysisModuleSettings(moduleId, {
        ...currentSettings,
        [settingKey]: rawValue,
      });
      return {
        ...workbench,
        analysisSettings: {
          ...analysisSettings,
          modules,
        },
      };
    });
  }

  function resetAnalysisModuleSettings(moduleId: string) {
    if (isRunActive(deps.store.getState())) {
      pushLockedWorkspaceEvent("Analiz ayarları aktif analiz sırasında kilitli.");
      return;
    }
    if (moduleId.trim() === "") {
      return;
    }
    updateWorkbench(function (workbench) {
      const analysisSettings = { ...asLabRecord(workbench["analysisSettings"]) };
      const modules = { ...asLabRecord(analysisSettings["modules"]) };
      modules[moduleId] = normalizeLabAnalysisModuleSettings(
        moduleId,
        LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS[moduleId] || {}
      );
      return {
        ...workbench,
        analysisSettings: {
          ...analysisSettings,
          modules,
        },
      };
    });
  }

  function readControlValue(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    return target instanceof HTMLInputElement && target.type === "number"
      ? target.value === ""
        ? null
        : Number(target.value)
      : target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target instanceof HTMLInputElement && target.type === "range"
          ? Number(target.value)
          : target.value;
  }

  function applyWorkspaceSettingAdjustment(actionButton: HTMLElement) {
    const field = toStringValue(actionButton.dataset["labField"]);
    if (field.trim() === "") {
      return;
    }
    const resetRequested = actionButton.dataset["labReset"] === "true";
    const optionValues = toStringValue(actionButton.dataset["labOptions"])
      .split("|")
      .filter(function (entry) {
        return entry.trim() !== "";
      });
    if (optionValues.length > 0) {
      const currentValue = String(readWorkspaceSetting(field) ?? optionValues[0]);
      const resetValue =
        toStringValue(actionButton.dataset["labResetValue"]) || optionValues[0] || "";
      if (resetRequested) {
        patchWorkspaceSetting(field, resetValue);
        return;
      }
      const delta = parseFiniteNumber(actionButton.dataset["labDelta"], 0);
      const currentIndex = Math.max(0, optionValues.indexOf(currentValue));
      const nextIndex = Math.max(
        0,
        Math.min(optionValues.length - 1, currentIndex + (delta < 0 ? -1 : 1))
      );
      patchWorkspaceSetting(field, optionValues[nextIndex]);
      return;
    }

    const min = parseFiniteNumber(actionButton.dataset["labMin"], Number.NEGATIVE_INFINITY);
    const max = parseFiniteNumber(actionButton.dataset["labMax"], Number.POSITIVE_INFINITY);
    const step = parseFiniteNumber(actionButton.dataset["labStep"], 1);
    const currentValue = parseFiniteNumber(String(readWorkspaceSetting(field) ?? ""), 0);
    const resetValue = parseFiniteNumber(actionButton.dataset["labResetValue"], currentValue);
    const delta = parseFiniteNumber(actionButton.dataset["labDelta"], 0);
    const nextValue = resetRequested
      ? resetValue
      : clampAdjustedValue(currentValue + delta, min, max, step);
    patchWorkspaceSetting(field, clampAdjustedValue(nextValue, min, max, step));
  }

  function handleClick(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }

    const actionButton = target.closest<HTMLElement>("[data-lab-action]");
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
      case "project-import-kind": {
        const kind = normalizeProjectImportKindValue(value);
        if (kind !== null && state.ui.projectImport.activeKind !== kind) {
          dispatch({ type: "project-import-kind-changed", kind });
        }
        return;
      }
      case "project-import-method": {
        const activeKind = deps.store.getState().ui.projectImport.activeKind;
        const method = normalizeProjectImportMethodValue(value, activeKind);
        if (method !== null && state.ui.projectImport.methods[activeKind] !== method) {
          dispatch({ type: "project-import-method-changed", kind: activeKind, method });
        }
        return;
      }
      case "project-import-clear":
        clearProjectImportDraft();
        return;
      case "project-import-local-add":
        runProjectImportLocalAdd();
        return;
      case "project-import-check-url":
        runProjectImportUrlCheck();
        return;
      case "project-import-url-add":
      case "project-import-add":
        runProjectImportAdd();
        return;
      case "project-import-youtube-video-format":
        dispatch({
          type: "youtube-import-format-selected",
          videoFormatId: value.trim() === "" ? null : value,
        });
        return;
      case "project-import-youtube-audio-format":
        dispatch({
          type: "youtube-import-format-selected",
          audioFormatId: value.trim() === "" ? null : value,
        });
        return;
      case "source-probe-retry":
        runSourceRetryAction();
        return;
      case "workspace-toggle-source-intake":
        dispatch({ type: "workspace-source-intake-toggled" });
        return;
      case "workspace-controls-drawer-toggle":
        dispatch({ type: "workspace-controls-drawer-toggled" });
        return;
      case "workspace-controls-tab-select": {
        const tab = normalizeWorkspaceControlTab(value);
        if (tab !== null && state.ui.workspace.controlsDrawerTab !== tab) {
          dispatch({ type: "workspace-controls-tab-selected", tab });
        } else if (tab !== null && state.ui.workspace.controlsDrawerOpen !== true) {
          dispatch({ type: "workspace-controls-drawer-toggled", force: true });
        }
        return;
      }
      case "enter-youtube-import-mode":
        dispatch({ type: "enter-youtube-import-mode" });
        return;
      case "exit-youtube-import-mode":
        clearYoutubeImportParseTimer();
        if (state.ui.youtubeImport.status === "parsing") {
          dispatch({ type: "youtube-import-clear" });
        }
        dispatch({ type: "exit-youtube-import-mode" });
        return;
      case "youtube-import-clear":
        clearYoutubeImportParseTimer();
        dispatch({ type: "youtube-import-clear" });
        return;
      case "youtube-import-set-strategy": {
        const strategy = normalizeYoutubeImportStrategyValue(value);
        if (strategy !== null && state.ui.youtubeImport.strategy !== strategy) {
          dispatch({ type: "youtube-import-set-strategy", strategy });
        }
        return;
      }
      case "source-youtube-preset":
        if (value.trim() !== "" && state.ui.sourceDrafts.youtubePreset !== value) {
          persistSourceDraftField("source.youtubePreset", value);
        }
        return;
      case "toggle-tool-manager":
        dispatch({ type: "tool-manager-toggled" });
        return;
      case "drawer-collapsed-toggled":
        dispatch({ type: "drawer-collapsed-toggled" });
        return;
      case "drawer-explore-toggled":
        dispatch({ type: "drawer-explore-toggled" });
        return;
      case "topbar-pill-source":
        if (isRunActive(state) !== true) {
          dispatch({ type: "drawer-mode-requested", mode: "setup" });
        }
        return;
      case "topbar-pill-analyze":
        return;
      case "topbar-pill-results":
        if (hasReportPayload(state)) {
          dispatch({ type: "drawer-mode-requested", mode: "result" });
        }
        return;
      case "close-tool-manager":
      case "dismiss-tool-manager":
        dispatch({ type: "tool-manager-toggled", open: false });
        return;
      case "tools-refresh":
        sendMediaAction("tools-refresh");
        return;
      case "tool-update-all":
        sendMediaAction("tool-update-all", {
          featureStage: getToolLifecycleStage(state),
          actionFamily: "tool-lifecycle",
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
          featureStage: getToolLifecycleStage(state),
          actionFamily: "tool-lifecycle",
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
          deps.store
            .getState()
            .selectedCapabilities.concat(
              value as import("../models/lab-types.js").CapabilityFamilyId
            )
        );
        return;
      case "capability-deselect":
        syncCapabilities(
          deps.store.getState().selectedCapabilities.filter(function (entry) {
            return entry !== value;
          })
        );
        return;
      case "capability-toggle": {
        const caps = deps.store.getState().selectedCapabilities;
        syncCapabilities(
          caps.includes(value as import("../models/lab-types.js").CapabilityFamilyId)
            ? caps.filter(function (entry) {
                return entry !== value;
              })
            : caps.concat(value as import("../models/lab-types.js").CapabilityFamilyId)
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
          view: value === "ai" ? "ai" : "user",
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
          artifactId: value.trim() !== "" ? value : null,
        });
        return;
      case "new-run-from-report": {
        const run = getCurrentRun(state);
        if (run?.analysisScope) {
          updateWorkbench(function (workbench) {
            return {
              ...workbench,
              forkedFromRunId: run.id,
              analysisScope: {
                ...run.analysisScope,
                lifecycle: {
                  mutable: true,
                  processId: null,
                  frozenAt: null,
                },
              },
            };
          });
        }
        dispatch({ type: "preview-artifact-activated", artifactId: null });
        dispatch({ type: "report-overlay-toggled", open: false });
        return;
      }
      case "save-project": {
        const sourceRecord = asLabRecord(state.source);
        const sourceLabel =
          asNonEmptyString(sourceRecord["storedFileName"]) ||
          asNonEmptyString(sourceRecord["routeLabel"]);
        if (sourceLabel === null || state.projectIndex.activeProjectId === null) {
          return;
        }
        sendMediaAction("project-rename", {
          name: buildAutoProjectName(getActiveProjectCreatedAt(state), sourceLabel),
        });
        updateWorkbench(function (workbench) {
          return {
            ...workbench,
            lastManualSaveAt: new Date().toISOString(),
          };
        });
        dispatch({
          type: "push-event",
          event: buildUiEvent("Proje mevcut checkpoint durumu ile kaydedildi.", "success"),
        });
        return;
      }
      // V2.3 workspace actions
      case "run-deep-analysis": {
        // Controller guard — shared contract with UI
        const blockReason = getAnalysisActionBlockReason(state);
        if (blockReason !== null) {
          dispatch({
            type: "push-event",
            event: buildUiEvent(blockReason, "warning"),
          });
          return;
        }
        startDeepAnalysis(state);
        return;
      }
      case "cancel-analysis": {
        const run = getCurrentRun(state);
        if (
          run &&
          (run.state === "running" || run.state === "queued") &&
          state.ui.analysisCancelPending !== true
        ) {
          dispatch({ type: "analysis-cancel-requested" });
          sendMediaAction(
            state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel"
          );
        }
        return;
      }
      case "project-select": {
        selectProjectByValue(value);
        return;
      }
      case "project-create": {
        startCleanProjectSession();
        return;
      }
      case "project-delete": {
        const activeProjectId = state.projectIndex.activeProjectId;
        if (!activeProjectId) {
          return;
        }
        const activeProjectSummary = state.projectIndex.projects.find(function (project) {
          return asNonEmptyString((project as Record<string, unknown>)["id"]) === activeProjectId;
        }) as Record<string, unknown> | undefined;
        const projectLabel =
          asNonEmptyString(activeProjectSummary?.["name"]) || "seçili proje kaydı";
        const confirmed =
          typeof deps.windowRef.confirm === "function"
            ? deps.windowRef.confirm(`"${projectLabel}" kaydı silinsin mi?`)
            : true;
        if (confirmed) {
          sendMediaAction("project-delete", { projectId: activeProjectId });
        }
        return;
      }
      case "workspace-roi-toggle":
        if (isWorkspaceMutationLocked("roi")) {
          pushLockedWorkspaceEvent("ROI düzenleme aktif analiz sırasında kilitli.");
          return;
        }
        if (value.trim() !== "") {
          dispatch({ type: "workspace-roi-toggled", regionId: value });
        }
        return;
      case "workspace-roi-remove":
        if (isWorkspaceMutationLocked("roi")) {
          pushLockedWorkspaceEvent("ROI düzenleme aktif analiz sırasında kilitli.");
          return;
        }
        if (value.trim() !== "") {
          dispatch({ type: "workspace-roi-removed", regionId: value });
        }
        return;
      case "workspace-roi-export": {
        const roiState = deps.store.getState();
        const roiRegions = roiState.ui.workspace.roiRegions;
        const roiRegion = roiRegions.find(function (r) {
          return r.id === value;
        });
        if (roiRegion) {
          startTrackedOperationForUiAction("workspace-selection-roi-export", {
            regionId: roiRegion.id,
            x: roiRegion.x,
            y: roiRegion.y,
            width: roiRegion.width,
            height: roiRegion.height,
            ...getCurrentRunIntentPayload(roiState),
          });
        }
        return;
      }
      case "workspace-selection-roi-export": {
        const roiState = deps.store.getState();
        const selection = roiState.ui.workspace.activeSelection;
        if (selection?.roi === undefined) {
          dispatch({
            type: "push-event",
            event: buildUiEvent("ROI çıktısı için önce görüntü üzerinde bölge seç.", "warning"),
          });
          return;
        }
        startTrackedOperationForUiAction("workspace-selection-roi-export", {
          regionId: "selection",
          ...getActiveSelectionOperationPayload(roiState),
        });
        return;
      }
      case "workspace-enhanced-frame-export": {
        const frameState = deps.store.getState();
        startTrackedOperationForUiAction(
          "workspace-enhanced-frame-export",
          getActiveSelectionOperationPayload(frameState)
        );
        return;
      }
      case "timeline-export-clip": {
        if (isWorkspaceMutationLocked("timeline")) {
          pushLockedWorkspaceEvent("Zaman aralığı dışa aktarımı aktif analiz sırasında kilitli.");
          return;
        }
        const clipState = deps.store.getState();
        const clipWs = clipState.ui.workspace;
        if (clipWs.timelineStartMs !== null && clipWs.timelineEndMs !== null) {
          startTrackedOperationForUiAction("timeline-export-clip", {
            startMs: clipWs.timelineStartMs,
            endMs: clipWs.timelineEndMs,
            ...getCurrentRunIntentPayload(clipState),
          });
        }
        return;
      }
      case "timeline-grab-frame": {
        const frameState = deps.store.getState();
        const frameWs = frameState.ui.workspace;
        const seekMs = frameWs.timelineStartMs !== null ? frameWs.timelineStartMs : 0;
        startTrackedOperationForUiAction("timeline-grab-frame", {
          seekMs: seekMs,
          startMs: frameWs.timelineStartMs,
          endMs: frameWs.timelineEndMs,
          ...getCurrentRunIntentPayload(frameState),
        });
        return;
      }
      case "timeline-extract-audio":
        startTrackedOperationForUiAction("timeline-extract-audio", {
          startMs: state.ui.workspace.timelineStartMs,
          endMs: state.ui.workspace.timelineEndMs,
          ...getCurrentRunIntentPayload(state),
        });
        return;
      case "workspace-audio-cleanup-export":
        startTrackedOperationForUiAction(
          "workspace-audio-cleanup-export",
          getCurrentRunIntentPayload(deps.store.getState())
        );
        return;
      case "workspace-band-pass-voice-export":
        startTrackedOperationForUiAction(
          "workspace-band-pass-voice-export",
          getCurrentRunIntentPayload(deps.store.getState())
        );
        return;
      case "timeline-toggle-micro-zoom":
        dispatch({ type: "workspace-selection-micro-zoom-toggled" });
        return;
      case "timeline-toggle-playback":
        toggleTimelinePlayback();
        return;
      case "timeline-shift-playhead":
        if (isWorkspaceMutationLocked("timeline")) {
          return;
        }
        shiftTimelinePlayhead(value);
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
        removeAssetsWithConfirmation([value]);
        return;
      case "workspace-intent-toggle":
        if (isWorkspaceMutationLocked("intents")) {
          pushLockedWorkspaceEvent("Analiz amaçları aktif analiz sırasında kilitli.");
          return;
        }
        if (value.trim() !== "") {
          dispatch({
            type: "workspace-intent-toggled",
            intentId: value as import("../models/lab-types.js").LabIntentId,
          });
        }
        return;
      case "analysis-prep-group-toggle":
        if (value.trim() !== "") {
          dispatch({
            type: "analysis-prep-group-toggled",
            intentId: value as import("../models/lab-types.js").LabIntentId,
          });
        }
        return;
      case "workspace-process-view-toggled":
        dispatch({ type: "workspace-process-view-toggled" });
        return;
      case "workspace-setting-adjust":
        applyWorkspaceSettingAdjustment(actionButton);
        return;
      case "operation-settings-reset":
        resetOperationSettings(value);
        return;
      case "analysis-settings-reset":
        resetAnalysisModuleSettings(value);
        return;
      case "workspace-image-analysis":
        dispatch({ type: "workspace-image-analysis-requested" });
        sendMediaAction("edit-preview");
        return;
      case "workspace-reset-controls":
        dispatch({
          type: "workspace-interactive-updated",
          patch: DEFAULT_INTERACTIVE_SETTINGS,
        });
        return;
      case "workspace-reset-audio-focus":
        dispatch({
          type: "workspace-audio-updated",
          patch: DEFAULT_AUDIO_FOCUS_SETTINGS,
        });
        return;
      case "timeline-add-bookmark":
        addCurrentTimelineBookmark();
        return;
      case "timeline-remove-bookmark":
        if (value.trim() !== "") {
          dispatch({ type: "workspace-bookmark-removed", bookmarkId: value });
        }
        return;
      case "timeline-seek":
        if (isWorkspaceMutationLocked("timeline")) {
          return;
        }
        if (value.trim() !== "") {
          const timeMs = Number(value);
          if (Number.isFinite(timeMs) !== true) {
            return;
          }
          seekTimelineToMs(timeMs);
          centerTimelineTarget(actionButton);
        }
        return;
      case "timeline-interact":
      case "timeline-drag-start":
      case "timeline-drag-end":
      case "timeline-drag-body":
        return;
      case "timeline-finetune": {
        if (isWorkspaceMutationLocked("timeline")) {
          pushLockedWorkspaceEvent("Zaman aralığı aktif analiz sırasında kilitli.");
          return;
        }
        const parts = value.split(":");
        if (parts.length === 2) {
          const prefix = parts[0];
          const delta = Number(parts[1]);
          if ((prefix === "start" || prefix === "end") && Number.isFinite(delta)) {
            const currentStart = state.ui.workspace.timelineStartMs;
            const currentEnd = state.ui.workspace.timelineEndMs;
            const timelineEl = target.closest<HTMLElement>(".labx-timeline");
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
        if (isWorkspaceMutationLocked("timeline")) {
          pushLockedWorkspaceEvent("Zaman aralığı aktif analiz sırasında kilitli.");
          return;
        }
        dispatch({ type: "workspace-timeline-updated", startMs: null, endMs: null });
        return;
      }
      case "toggle-report-view":
        dispatch({ type: "report-overlay-toggled", open: true });
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
          view: value === "ai" ? "ai" : "user",
        });
        return;
      case "report-export-json":
        startTrackedReportExport();
        return;
      case "report-export-pdf":
        startTrackedReportExport();
        return;
      // V4 project & entity workspace actions
      case "project-workspace-open":
        if (state.ui.projectWorkspaceOpen === true) {
          return;
        }
        dispatch({ type: "project-workspace-toggled", open: true });
        return;
      case "project-workspace-close":
        if (state.ui.projectWorkspaceOpen !== true) {
          return;
        }
        dispatch({ type: "project-workspace-toggled", open: false });
        return;
      case "project-workspace-entity-click":
        selectProjectWorkspaceEntity(value, event);
        return;
      case "project-workspace-switch":
        if (value === state.projectIndex.activeProjectId) {
          return;
        }
        dispatch({ type: "project-import-reset" });
        selectProjectByValue(value);
        return;
      case "project-workspace-use-source":
        {
          const sourceAssetId = findFirstSourceCapableAssetId(getProjectWorkspaceActionIds(value));
          if (sourceAssetId !== null && state.ui.projectWorkspaceConfirmReplace !== sourceAssetId) {
            dispatch({ type: "project-workspace-confirm-replace", assetId: sourceAssetId });
          }
        }
        return;
      case "project-workspace-confirm-use-source":
        if (canUseAssetAsSource(value)) {
          sendMediaAction("asset-use-as-source", { assetId: value });
          dispatch({ type: "project-workspace-toggled", open: false });
        }
        return;
      case "project-workspace-cancel-replace":
        if (state.ui.projectWorkspaceConfirmReplace === null) {
          return;
        }
        dispatch({ type: "project-workspace-confirm-replace", assetId: null });
        return;
      case "project-workspace-open-report":
        {
          const reportAssetId = findFirstReportAssetId(getProjectWorkspaceActionIds(value));
          if (reportAssetId !== null && getAssetHref(reportAssetId) !== null) {
            previewAsset(reportAssetId);
            dispatch({ type: "project-workspace-toggled", open: false });
          } else if (reportAssetId !== null) {
            dispatch({ type: "project-workspace-toggled", open: false });
            dispatch({ type: "report-overlay-toggled", open: true });
          }
        }
        return;
      case "project-workspace-delete":
        {
          const assetIds = getProjectWorkspaceActionIds(value);
          const removed = removeAssetsWithConfirmation(assetIds);
          if (removed && state.ui.projectWorkspaceSelectedEntityIds.length > 0) {
            dispatch({
              type: "project-workspace-entity-selected",
              entityIds: [],
            });
          }
        }
        return;
      case "project-workspace-jump-timeline": {
        const timeMs = Number(value);
        if (Number.isFinite(timeMs)) {
          dispatch({ type: "project-workspace-toggled", open: false });
          seekTimelineToMs(timeMs);
        }
        return;
      }
      case "project-workspace-send-to-ai":
        return;
      default:
        return;
    }
  }

  function handleInput(event: Event) {
    const target = event.target;
    if (!isTextControl(target)) {
      return;
    }

    const field = target.dataset["labField"];
    if (!field) {
      return;
    }

    if (field.startsWith("operationSettings.")) {
      patchOperationSetting(field, readControlValue(target));
      return;
    }

    if (field.startsWith("analysisSettings.modules.")) {
      patchAnalysisModuleSetting(field, readControlValue(target));
      return;
    }

    // V4 project workspace search (live input)
    if (field === "project-workspace-search") {
      dispatch({
        type: "project-workspace-search-changed",
        search: target.value || "",
      });
      return;
    }

    if (field === "youtube-import.url") {
      scheduleYoutubeImportParse(target.value || "");
      return;
    }

    if (field === "project-import.youtubeVideoFormat") {
      dispatch({
        type: "youtube-import-format-selected",
        videoFormatId: target.value.trim() === "" ? null : target.value,
      });
      return;
    }

    if (field === "project-import.youtubeAudioFormat") {
      dispatch({
        type: "youtube-import-format-selected",
        audioFormatId: target.value.trim() === "" ? null : target.value,
      });
      return;
    }

    if (field.startsWith("project-import.")) {
      if (isWorkspaceMutationLocked("source")) {
        pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
        return;
      }
      const rawValue =
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target instanceof HTMLInputElement && target.type === "number"
            ? target.value === ""
              ? null
              : Number(target.value)
            : target.value;
      const patch = buildProjectImportDraftPatch(deps.store.getState(), field, rawValue);
      if (patch !== null) {
        dispatch({
          type: "project-import-draft-updated",
          patch,
        });
        if (field === "project-import.youtubeUrl") {
          scheduleYoutubeImportParse(String(rawValue || ""));
        }
      }
      return;
    }

    if (field.startsWith("youtube-import.custom.")) {
      const rawValue =
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target.value;
      updateYoutubeImportCustomField(field, rawValue);
      return;
    }

    if (
      field === "source.urlInput" ||
      field === "source.youtubeUrl" ||
      field.startsWith("source.youtubeCustom.")
    ) {
      if (isWorkspaceMutationLocked("source")) {
        pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
        return;
      }
      const rawValue =
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target instanceof HTMLInputElement && target.type === "number"
            ? target.value === ""
              ? null
              : Number(target.value)
            : target.value;
      const patch = buildSourceDraftPatch(deps.store.getState(), field, rawValue);
      if (patch !== null) {
        dispatch({
          type: "source-drafts-updated",
          patch,
        });
      }
      return;
    }

    if (field.startsWith("edit.")) {
      dispatch({
        type: "edit-drafts-updated",
        patch: {
          [field.replace("edit.", "")]:
            target instanceof HTMLInputElement && target.type === "checkbox"
              ? target.checked
              : target.value,
        },
      });
      return;
    }

    if (field.startsWith("profile.")) {
      const rawValue = target.value;
      const value =
        target instanceof HTMLInputElement && target.type === "number"
          ? rawValue === ""
            ? null
            : Number(rawValue)
          : rawValue;
      dispatch({
        type: "profile-drafts-updated",
        patch: {
          [field.replace("profile.", "")]: value,
        },
      });
      return;
    }

    if (field.startsWith("scope.")) {
      const rawValue =
        target instanceof HTMLInputElement && target.type === "number"
          ? target.value === ""
            ? null
            : Number(target.value)
          : target.value;
      updateAnalysisScopeField(field.replace("scope.", ""), rawValue);
      return;
    }

    // V2.3 workspace field handling
    if (field.startsWith("workspace.")) {
      const workspaceField = field.replace("workspace.", "");
      const rawValue =
        target instanceof HTMLInputElement && target.type === "number"
          ? target.value === ""
            ? null
            : Number(target.value)
          : target instanceof HTMLInputElement && target.type === "checkbox"
            ? target.checked
            : target instanceof HTMLInputElement && target.type === "range"
              ? Number(target.value)
              : target.value;

      if (workspaceField === "timelineStartMs" || workspaceField === "timelineEndMs") {
        if (isWorkspaceMutationLocked("timeline")) {
          pushLockedWorkspaceEvent("Zaman aralığı aktif analiz sırasında kilitli.");
          return;
        }
        const state = deps.store.getState();
        const requestedSeekMs =
          typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : null;
        dispatch({
          type: "workspace-timeline-updated",
          startMs:
            workspaceField === "timelineStartMs"
              ? (rawValue as number | null)
              : state.ui.workspace.timelineStartMs,
          endMs:
            workspaceField === "timelineEndMs"
              ? (rawValue as number | null)
              : state.ui.workspace.timelineEndMs,
        });
        const acceptedWorkspace = deps.store.getState().ui.workspace;
        const acceptedSeekMs =
          workspaceField === "timelineStartMs"
            ? acceptedWorkspace.timelineStartMs
            : acceptedWorkspace.timelineEndMs;
        if (requestedSeekMs !== null && acceptedSeekMs === requestedSeekMs) {
          seekTimelineToMs(requestedSeekMs);
        }
        return;
      }
      if (workspaceField === "previewVolume") {
        dispatch({
          type: "workspace-preview-volume-updated",
          volume: typeof rawValue === "number" ? rawValue : Number(rawValue),
        });
        syncTimelineTransportVolume();
        updateTimelinePlaybackUi();
        return;
      }
      if (workspaceField === "hypothesis") {
        if (isWorkspaceMutationLocked("hypothesis")) {
          pushLockedWorkspaceEvent("Hipotez aktif analiz sırasında kilitli.");
          return;
        }
        dispatch({ type: "workspace-hypothesis-updated", text: String(rawValue || "") });
        return;
      }
      if (workspaceField.startsWith("interactive.")) {
        const settingKey = workspaceField.replace("interactive.", "");
        patchInteractiveSetting(settingKey, rawValue);
        return;
      }
      if (workspaceField.startsWith("audioFocus.")) {
        const audioKey = workspaceField.replace("audioFocus.", "");
        patchAudioFocusSetting(audioKey, rawValue);
        return;
      }
    }
  }

  function handleContextMenu(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const assetRow = target.closest<HTMLElement>("[data-lab-asset-id]");
    if (!assetRow) {
      return;
    }
    const menu = assetRow.querySelector<HTMLDetailsElement>(".labx-project-assets__menu");
    if (!menu) {
      return;
    }
    event.preventDefault();
    menu.open = true;
    const summary = menu.querySelector<HTMLElement>("summary");
    summary?.focus();
  }

  function handleChange(event: Event) {
    const target = event.target;
    if (!isTextControl(target)) {
      return;
    }

    const field = target.dataset["labField"];
    if (!field) {
      return;
    }

    if (field.startsWith("operationSettings.")) {
      patchOperationSetting(field, readControlValue(target));
      return;
    }

    if (field.startsWith("analysisSettings.modules.")) {
      patchAnalysisModuleSetting(field, readControlValue(target));
      return;
    }

    const state = deps.store.getState();
    const targetValue =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target instanceof HTMLInputElement && target.type === "number"
          ? target.value === ""
            ? null
            : Number(target.value)
          : target.value;

    if (field.startsWith("project-import.youtubeCustom.")) {
      if (isWorkspaceMutationLocked("source")) {
        pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
        return;
      }
      const patch = buildProjectImportDraftPatch(state, field, targetValue);
      if (patch !== null) {
        dispatch({
          type: "project-import-draft-updated",
          patch,
        });
      }
      return;
    }

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
      case "youtube-import.url":
        scheduleYoutubeImportParse(String(targetValue || ""));
        return;
      case "youtube-import.custom.resolution":
      case "youtube-import.custom.format":
      case "youtube-import.custom.audioExtraction":
        updateYoutubeImportCustomField(field, targetValue);
        return;
      // V4 project workspace toolbar fields
      case "project-workspace-sort": {
        const sort = normalizeProjectWorkspaceSortValue(targetValue);
        if (state.ui.projectWorkspaceSort === sort) {
          return;
        }
        dispatch({
          type: "project-workspace-sort-changed",
          sort,
        });
        return;
      }
      case "project-workspace-filter": {
        const filter = normalizeProjectWorkspaceFilterValue(targetValue);
        if (state.ui.projectWorkspaceFilter === filter) {
          return;
        }
        dispatch({
          type: "project-workspace-filter-changed",
          filter,
        });
        return;
      }
      case "project-workspace-group": {
        const group = normalizeProjectWorkspaceGroupValue(targetValue);
        if (state.ui.projectWorkspaceGroup === group) {
          return;
        }
        dispatch({
          type: "project-workspace-group-changed",
          group,
        });
        return;
      }
      case "project-workspace-search":
        if (state.ui.projectWorkspaceSearch === String(targetValue || "")) {
          return;
        }
        dispatch({
          type: "project-workspace-search-changed",
          search: String(targetValue || ""),
        });
        return;
      case "project-import.urlInput":
      case "project-import.youtubeUrl":
      case "project-import.youtubeCaptureMode": {
        if (isWorkspaceMutationLocked("source")) {
          pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
          return;
        }
        const patch = buildProjectImportDraftPatch(state, field, targetValue);
        if (patch !== null) {
          dispatch({
            type: "project-import-draft-updated",
            patch,
          });
          if (field === "project-import.youtubeUrl") {
            scheduleYoutubeImportParse(String(targetValue || ""));
          }
        }
        return;
      }
      case "project-import.youtubeVideoFormat":
        dispatch({
          type: "youtube-import-format-selected",
          videoFormatId: String(targetValue || "").trim() === "" ? null : String(targetValue),
        });
        return;
      case "project-import.youtubeAudioFormat":
        dispatch({
          type: "youtube-import-format-selected",
          audioFormatId: String(targetValue || "").trim() === "" ? null : String(targetValue),
        });
        return;
      case "source.kind":
        if (isWorkspaceMutationLocked("source")) {
          pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
          return;
        }
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
            metadataError: null,
          },
        });
        sendMediaAction("source-set-kind", { kind: targetValue });
        return;
      case "source.mode":
        if (targetValue === "youtube") {
          dispatch({ type: "enter-youtube-import-mode" });
          return;
        }
        if (isWorkspaceMutationLocked("source")) {
          pushLockedWorkspaceEvent("Kaynak ayarları aktif analiz sırasında kilitli.");
          return;
        }
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
            previewUrl: null,
          },
        });
        sendMediaAction("source-set-mode", { mode: targetValue });
        return;
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
                  outputNameHint: targetValue,
                },
              },
            });
            return;
          case "edit.notes":
            sendMediaAction("edit-update-recipe", {
              patch: {
                common: {
                  notes: targetValue,
                },
              },
            });
            return;
          case "edit.handoffMode":
            sendMediaAction("edit-set-handoff", {
              mode: targetValue,
            });
            return;
          case "edit.activeSourceRef":
            dispatch({
              type: "edit-drafts-updated",
              patch: {
                activeSourceRef: targetValue === "preview" ? "preview" : "original",
              },
            });
            return;
          case "edit.activeOutputId":
            sendMediaAction("edit-set-output", {
              outputId: targetValue,
            });
            return;
          case "edit.advancedOpen":
            dispatch({
              type: "edit-drafts-updated",
              patch: {
                advancedOpen: targetValue === true,
              },
            });
            return;
          case "profile.targetMode":
            sendMediaAction("profile-set-target", {
              mode: targetValue,
              outputId:
                targetValue === "derived"
                  ? asNonEmptyString(getActiveEditOutput(state)?.["id"])
                  : null,
            });
            return;
          case "profile.targetOutputId":
            sendMediaAction("profile-set-target", {
              mode: "derived",
              outputId: targetValue || null,
            });
            return;
          case "profile.depth":
          case "profile.frameSampleDensity":
          case "profile.sensitivity":
          case "profile.transcriptSampleSeconds":
            sendMediaAction("profile-update", {
              patch: {
                [field.replace("profile.", "")]: targetValue,
              },
            });
            return;
          case "profile.modelId":
            sendMediaAction("profile-set-model", {
              modelId: targetValue || null,
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
    deps.documentRef.addEventListener("dblclick", function (event: Event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }
      const card = target.closest<HTMLElement>(
        "[data-lab-action='project-workspace-entity-click']"
      );
      if (card) {
        const assetId = card.dataset["labValue"] || "";
        if (canUseAssetAsSource(assetId)) {
          sendMediaAction("asset-use-as-source", { assetId });
          dispatch({ type: "project-workspace-toggled", open: false });
        }
      }
    });
    deps.documentRef.addEventListener("mouseover", handleProjectWorkspaceCardHover);
    deps.documentRef.addEventListener("mouseout", handleProjectWorkspaceCardLeave);
    deps.documentRef.addEventListener("focusin", handleProjectWorkspaceCardHover);
    deps.documentRef.addEventListener("focusout", handleProjectWorkspaceCardLeave);
    deps.documentRef.addEventListener("contextmenu", handleContextMenu);
    deps.documentRef.addEventListener("input", handleInput);
    deps.documentRef.addEventListener("change", handleChange);
    deps.documentRef.addEventListener("mousedown", handleMouseDown);
    deps.documentRef.addEventListener("keydown", handleKeyDown as EventListener);
    deps.windowRef.addEventListener("mousemove", handleTimelineMouseMove as EventListener);
    deps.windowRef.addEventListener("mouseup", handleTimelineMouseUp as EventListener);
    deps.store.subscribe(function () {
      syncTimelinePlaybackUiFromState();
      workspaceAudioVisualizer.sync();
    });
    queueMicrotask(function () {
      syncTimelinePlaybackUiFromState();
      workspaceAudioVisualizer.sync();
    });
  }

  function getPrimaryActionState() {
    const state = deps.store.getState();

    // Report CTA
    if (hasReportPayload(state) && (state.ui.workspace.reportOverlayOpen || isRunComplete(state))) {
      const reportBlock = getReportActionBlockReason(state);
      return {
        disabled: reportBlock !== null,
        detail: reportBlock || "Structured rapor dışa aktarılır",
        label: "Raporları Dışa Aktar",
      };
    }

    // Process CTA (cancel or start)
    if (isRunActive(state)) {
      return {
        disabled: false,
        detail: "Aktif run iptal edilir",
        label: "Çalışmayı İptal Et",
      };
    }
    if (getSourceReady(state) && getAnalysisActionBlockReason(state) === null) {
      return {
        disabled: false,
        detail: "Sadece enabled modüller çalışır",
        label: "Analizi Başlat",
      };
    }

    // Edit CTA
    if (getSourceReady(state)) {
      const editBlock = getEditActionBlockReason(state);
      if (editBlock === null) {
        return {
          disabled: false,
          detail: "Preview completion fake edilemez",
          label: "Önizleme Üret",
        };
      }
    }

    // Source CTA (default)
    const sourceStatus = getSourceStatus(state);
    const sourceProbeStatus = getSourceProbeStatus(state);
    const sourceBlock = getSourceActionBlockReason(state);
    return {
      disabled: sourceBlock !== null,
      detail:
        sourceBlock ||
        (sourceProbeStatus === "running"
          ? "Gerçek probe tamamlanıyor"
          : sourceProbeStatus === "completed" || sourceStatus === "ready"
            ? "Probe tamamlandı"
            : "Source probe başlatılır"),
      label:
        sourceProbeStatus === "completed" || sourceStatus === "ready"
          ? "Kaynağı Yenile"
          : "Kaynağı Hazırla",
    };
  }

  deps.eventBus.subscribe(handleBusEvent);

  return {
    attach,
    getPrimaryActionState,
  };
}
