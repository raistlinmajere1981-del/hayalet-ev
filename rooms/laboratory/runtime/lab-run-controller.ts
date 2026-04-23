import {
  asLabRecord,
  asNonEmptyString,
  createLabEventId,
  WORKSPACE_INTENTS,
} from "../models/lab-types.js";
import type {
  CapabilityFamilyId,
  LabFeatureId,
  LabIntentId,
  LabSourceDrafts,
  LabStoreEvent,
  LabUserActionEvent,
} from "../models/lab-types.js";
import {
  deriveLegacyStage,
  getActiveEditOutput,
  getAnalysisActionBlockReason,
  getCurrentRun,
  getEditActionBlockReason,
  getReportActionBlockReason,
  getSourceActionBlockReason,
  getSourceReady,
  getSourceMode,
  getSourceProbeStatus,
  getSourceStatus,
  getUserActions,
  getWorkbench,
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

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatProjectTimestamp(dateValue: unknown): string {
  const date = new Date(
    typeof dateValue === "string" || typeof dateValue === "number" || dateValue instanceof Date
      ? dateValue
      : Date.now()
  );
  const fallbackDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${fallbackDate.getFullYear()}-${pad2(fallbackDate.getMonth() + 1)}-${pad2(
    fallbackDate.getDate()
  )} ${pad2(fallbackDate.getHours())}-${pad2(fallbackDate.getMinutes())}`;
}

function buildAutoProjectName(dateValue: unknown, sourceLabel: string): string {
  return `${formatProjectTimestamp(dateValue)} - ${sourceLabel}`;
}

function isTextControl(
  target: EventTarget | null
): target is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

function buildUiEvent(
  message: string,
  severity: "info" | "warning" | "error" | "success" = "info"
) {
  return {
    id: createLabEventId("ui"),
    kind: "activity",
    severity,
    message,
    detail: null,
    timestamp: Date.now(),
    source: "ui" as const,
    action: null,
    stage: null,
    scope: "global" as const,
    moduleId: null,
    rawLine: null,
  };
}

function toDraftScope(workbench: Record<string, unknown>): Record<string, unknown> {
  const currentScope = asLabRecord(workbench["analysisScope"]);
  return {
    ...currentScope,
    lifecycle: {
      mutable: true,
      processId: null,
      frozenAt: null,
    },
  };
}

function getFeatureIdForCapability(capabilityId: string): LabFeatureId {
  return capabilityId === "visual-structure" || capabilityId === "visual-forensics"
    ? "media-analysis"
    : "audio-analysis";
}

function deriveFeatureSelectionFromCapabilities(capabilityIds: string[]) {
  const featureIds = Array.from(
    new Set(
      capabilityIds.map(function (capabilityId) {
        return getFeatureIdForCapability(capabilityId);
      })
    )
  );
  return {
    activeFeatureId: (featureIds[0] || "media-analysis") as LabFeatureId,
    featureIds,
  };
}

export function createLabRunController(deps: LabRunControllerDeps) {
  let attached = false;
  const hubDismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function dispatch(event: Parameters<ReturnType<typeof createLabStore>["dispatch"]>[0]) {
    deps.eventBus.emit(event);
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
    const activeUserActionIds = new Set<string>();
    getUserActions(deps.store.getState()).forEach(function (entry) {
      activeUserActionIds.add(entry.id);
      if (entry.status === "success" && entry.dismissedFromHubAt == null) {
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

  function findBlankProjectId(state: ReturnType<typeof deps.store.getState>): string | null {
    const blankProject = state.projectIndex.projects.find(function (project) {
      return (project as Record<string, unknown>)["hasSource"] === false;
    }) as Record<string, unknown> | undefined;
    return asNonEmptyString(blankProject?.["id"]) || null;
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
        fileNameHint: "",
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
      case "source.fileNameHint":
        return {
          fileNameHint: typeof value === "string" ? value : "",
        };
      case "source.urlInput":
        return {
          urlInput: typeof value === "string" ? value : "",
        };
      case "source.youtubeUrl":
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

  function persistSourceDraftField(field: string, value: unknown) {
    const state = deps.store.getState();
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

  function selectProjectByValue(projectValue: string) {
    const state = deps.store.getState();
    if (projectValue === "new") {
      const resetSourceState = buildEmptySourceState(state);
      // Reset real source state first; legacy stage is projected automatically
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
            typeof nextTimeRange["endMs"] === "number"
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
      fileNameHint: sourceDrafts.fileNameHint,
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
    dispatch({
      type: "workspace-process-view-toggled",
      force: true,
    });
    sendMediaAction(activeFeatureId === "audio-analysis" ? "audio-process-run" : "process-run");
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

    // Source action — default fallback
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
    return asNonEmptyString(asset.url) || asNonEmptyString(asset.localPath);
  }

  function previewAsset(assetId: string) {
    const href = getAssetHref(assetId);
    if (href === null) {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Asset preview is unavailable.", "warning"),
      });
      return;
    }
    deps.windowRef.open(href, "_blank", "noopener,noreferrer");
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

  // --- Timeline drag state ---
  type TimelineDragMode = "none" | "rail" | "start" | "end" | "body";
  let timelineDragMode: TimelineDragMode = "none";
  let timelineDragTrack: HTMLElement | null = null;
  let timelineDragDurationMs: number = 0;
  let timelineDragAnchorMs: number = 0;
  let timelineDragBodyOffsetStart: number = 0;
  let timelineDragBodyOffsetEnd: number = 0;

  function msFromTrackX(clientX: number): number {
    if (!timelineDragTrack) return 0;
    const rect = timelineDragTrack.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = x / rect.width;
    return Math.max(0, Math.round(timelineDragDurationMs * pct));
  }

  function startTimelineDrag(
    track: Element,
    _timeline: HTMLElement,
    anchorMs: number,
    durationMs: number
  ) {
    timelineDragMode = "rail";
    timelineDragTrack = track as HTMLElement;
    timelineDragDurationMs = durationMs;
    timelineDragAnchorMs = anchorMs;
    dispatch({ type: "workspace-timeline-updated", startMs: anchorMs, endMs: anchorMs });
  }

  function startTimelineHandleDrag(
    track: Element,
    _timeline: HTMLElement,
    mode: "start" | "end",
    durationMs: number,
    event: MouseEvent
  ) {
    event.preventDefault();
    event.stopPropagation();
    timelineDragMode = mode;
    timelineDragTrack = track as HTMLElement;
    timelineDragDurationMs = durationMs;
  }

  function startTimelineBodyDrag(
    track: Element,
    _timeline: HTMLElement,
    durationMs: number,
    event: MouseEvent
  ) {
    event.preventDefault();
    event.stopPropagation();
    const state = deps.store.getState();
    const currentStart = state.ui.workspace.timelineStartMs ?? 0;
    const currentEnd = state.ui.workspace.timelineEndMs ?? durationMs;
    timelineDragMode = "body";
    timelineDragTrack = track as HTMLElement;
    timelineDragDurationMs = durationMs;
    timelineDragBodyOffsetStart = currentStart;
    timelineDragBodyOffsetEnd = currentEnd;
  }

  function handleMouseDown(event: Event) {
    if (!(event instanceof MouseEvent)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const handleEl = target.closest<HTMLElement>(
      "[data-lab-action='timeline-drag-start'], [data-lab-action='timeline-drag-end'], [data-lab-action='timeline-drag-body']"
    );
    if (!handleEl) return;

    const action = toStringValue(handleEl.dataset["labAction"]);
    const timeline = handleEl.closest<HTMLElement>(".labx-timeline");
    const track = timeline?.querySelector(".labx-timeline__track");
    if (!timeline || !track) return;

    const durationMs = Number(timeline.dataset["duration"] || 0);

    if (action === "timeline-drag-start" || action === "timeline-drag-end") {
      startTimelineHandleDrag(
        track,
        timeline,
        action === "timeline-drag-start" ? "start" : "end",
        durationMs,
        event
      );
    } else if (action === "timeline-drag-body") {
      startTimelineBodyDrag(track, timeline, durationMs, event);
    }
  }

  function handleTimelineMouseMove(event: MouseEvent) {
    if (timelineDragMode === "none" || !timelineDragTrack) return;

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
      const rect = timelineDragTrack.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
      const initialCenterPct =
        (timelineDragBodyOffsetStart / timelineDragDurationMs +
          timelineDragBodyOffsetEnd / timelineDragDurationMs) /
        2;
      const initialCenterX = initialCenterPct * rect.width;
      const shiftPx = currentX - initialCenterX;
      const shiftMs = Math.round((shiftPx / rect.width) * timelineDragDurationMs);
      const newStart = Math.max(
        0,
        Math.min(timelineDragBodyOffsetStart + shiftMs, timelineDragDurationMs - rangeWidth)
      );
      const newEnd = newStart + rangeWidth;
      dispatch({ type: "workspace-timeline-updated", startMs: newStart, endMs: newEnd });
    }
  }

  function handleTimelineMouseUp() {
    if (timelineDragMode === "none") return;
    timelineDragMode = "none";
    timelineDragTrack = null;
  }

  function handleClick(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }

    const stageButton = target.closest<HTMLElement>("[data-lab-stage]");
    if (stageButton) {
      // Neutralized: stage clicks are legacy-only compat.
      // The store projection via deriveLegacyStage() owns currentStage.
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
          featureStage: deriveLegacyStage(state),
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
        // Seed editable workspace state; legacy stage is projected automatically
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
        const run = getCurrentRun(state);
        if (run && run.state === "running") {
          sendMediaAction(
            state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel"
          );
          return;
        }
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
      case "project-select": {
        selectProjectByValue(value);
        return;
      }
      case "project-delete": {
        const activeProjectId = state.projectIndex.activeProjectId;
        const sourceRecord = asLabRecord(state.source);
        const hasActiveSource =
          asNonEmptyString(sourceRecord["storedFileName"]) !== null ||
          asNonEmptyString(sourceRecord["routeLabel"]) !== null;
        if (!activeProjectId || !hasActiveSource) {
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
        const roiRegion = roiRegions.find(function (r) {
          return r.id === value;
        });
        if (roiRegion) {
          startTrackedUserAction("export-roi-image", {
            regionId: roiRegion.id,
            x: roiRegion.x,
            y: roiRegion.y,
            width: roiRegion.width,
            height: roiRegion.height,
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
          });
        }
        return;
      }
      case "timeline-grab-frame": {
        const frameState = deps.store.getState();
        const frameWs = frameState.ui.workspace;
        const seekMs = frameWs.timelineStartMs !== null ? frameWs.timelineStartMs : 0;
        startTrackedUserAction("export-frame-grab", {
          seekMs: seekMs,
        });
        return;
      }
      case "timeline-extract-audio":
        startTrackedUserAction("export-audio-track");
        return;
      case "asset-preview":
        if (value.trim() !== "") {
          previewAsset(value);
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
        if (value.trim() !== "") {
          sendMediaAction("asset-remove", { assetId: value });
        }
        return;
      case "workspace-intent-toggle":
        if (value.trim() !== "") {
          dispatch({
            type: "workspace-intent-toggled",
            intentId: value as import("../models/lab-types.js").LabIntentId,
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
            gamma: 1.0,
            saturation: 100,
            hueRotate: 0,
            sharpness: 100,
            channelR: true,
            channelG: true,
            channelB: true,
            edgeHighlight: false,
            invert: false,
          },
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
            createdAt: Date.now(),
          },
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
          const mediaEls =
            deps.documentRef.querySelectorAll<HTMLMediaElement>(".labx-preview-media");
          mediaEls.forEach(function (el) {
            el.currentTime = timeMs / 1000;
          });
        }
        return;
      case "timeline-interact": {
        const timeline = target.closest<HTMLElement>(".labx-timeline");
        const track = timeline?.querySelector(".labx-timeline__track");
        if (timeline && track && event instanceof MouseEvent) {
          const rect = track.getBoundingClientRect();
          const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
          const pct = x / rect.width;
          const durationMs = Number(timeline.dataset["duration"] || 0);
          const ms = Math.round(durationMs * pct);

          if (event.shiftKey) {
            // Shift-click extends existing range or creates new one
            const existingStart = state.ui.workspace.timelineStartMs;
            const existingEnd = state.ui.workspace.timelineEndMs;
            if (existingStart !== null && existingEnd !== null) {
              // Extend nearest boundary
              const distStart = Math.abs(ms - existingStart);
              const distEnd = Math.abs(ms - existingEnd);
              if (distStart <= distEnd) {
                dispatch({ type: "workspace-timeline-updated", startMs: ms, endMs: existingEnd });
              } else {
                dispatch({ type: "workspace-timeline-updated", startMs: existingStart, endMs: ms });
              }
            } else {
              dispatch({ type: "workspace-timeline-updated", startMs: ms, endMs: ms });
            }
          } else {
            // Normal click starts a drag selection
            startTimelineDrag(track, timeline, ms, durationMs);
          }
        }
        return;
      }
      case "timeline-drag-start":
      case "timeline-drag-end": {
        const timeline = target.closest<HTMLElement>(".labx-timeline");
        const track = timeline?.querySelector(".labx-timeline__track");
        if (timeline && track && event instanceof MouseEvent) {
          const durationMs = Number(timeline.dataset["duration"] || 0);
          const mode = action === "timeline-drag-start" ? "start" : "end";
          startTimelineHandleDrag(track, timeline, mode, durationMs, event);
        }
        return;
      }
      case "timeline-drag-body": {
        const timeline = target.closest<HTMLElement>(".labx-timeline");
        const track = timeline?.querySelector(".labx-timeline__track");
        if (timeline && track && event instanceof MouseEvent) {
          const durationMs = Number(timeline.dataset["duration"] || 0);
          startTimelineBodyDrag(track, timeline, durationMs, event);
        }
        return;
      }
      case "timeline-finetune": {
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
        dispatch({ type: "workspace-timeline-updated", startMs: null, endMs: null });
        return;
      }
      case "workspace-step-preview":
        dispatch({
          type: "workspace-step-preview-activated",
          stepId: value.trim() !== "" ? value : null,
        });
        return;
      case "toggle-report-view":
        // Report overlay controls report UI; legacy stage is projected automatically
        dispatch({ type: "report-overlay-toggled", open: true });
        return;
      case "workspace-process-section-toggle":
        if (value.trim() !== "") {
          dispatch({
            type: "workspace-process-section-toggled",
            sectionId: value as import("../models/lab-types.js").LabProcessSectionId,
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
          view: value === "ai" ? "ai" : "user",
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

  function handleInput(event: Event) {
    const target = event.target;
    if (!isTextControl(target)) {
      return;
    }

    const field = target.dataset["labField"];
    if (!field) {
      return;
    }

    if (
      field === "source.fileNameHint" ||
      field === "source.urlInput" ||
      field === "source.youtubeUrl" ||
      field.startsWith("source.youtubeCustom.")
    ) {
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
        const state = deps.store.getState();
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
          patch: { [settingKey]: rawValue } as Partial<
            import("../models/lab-types.js").LabInteractiveSettings
          >,
        });
        return;
      }
      if (workspaceField.startsWith("audioFocus.")) {
        const audioKey = workspaceField.replace("audioFocus.", "");
        if (audioKey.startsWith("eqBands.")) {
          const eqState = deps.store.getState();
          const currentBands = eqState.ui.workspace.audioFocus.eqBands.map(function (b) {
            return { ...b };
          });
          const parts = audioKey.split(".");
          const bandIndex = parts.length > 1 ? parseInt(parts[1] as string, 10) : NaN;
          const bandProp = parts.length > 2 ? parts[2] : "";
          if (!isNaN(bandIndex) && bandIndex >= 0 && bandIndex < currentBands.length && bandProp) {
            const numValue = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue));
            if (!isNaN(numValue)) {
              (currentBands[bandIndex] as Record<string, unknown>)[bandProp] = numValue;
            }
          }
          dispatch({
            type: "workspace-audio-updated",
            patch: { eqBands: currentBands } as Partial<
              import("../models/lab-types.js").LabAudioFocusSettings
            >,
          });
        } else {
          dispatch({
            type: "workspace-audio-updated",
            patch: { [audioKey]: rawValue } as Partial<
              import("../models/lab-types.js").LabAudioFocusSettings
            >,
          });
        }
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

    const state = deps.store.getState();
    const targetValue =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target instanceof HTMLInputElement && target.type === "number"
          ? target.value === ""
            ? null
            : Number(target.value)
          : target.value;

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
            metadataError: null,
          },
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
            previewUrl: null,
          },
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
    deps.documentRef.addEventListener("contextmenu", handleContextMenu);
    deps.documentRef.addEventListener("input", handleInput);
    deps.documentRef.addEventListener("change", handleChange);
    deps.documentRef.addEventListener("mousedown", handleMouseDown);
    deps.windowRef.addEventListener("mousemove", handleTimelineMouseMove as EventListener);
    deps.windowRef.addEventListener("mouseup", handleTimelineMouseUp as EventListener);
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
