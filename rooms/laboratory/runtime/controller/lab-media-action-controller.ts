import {
  asLabRecord,
  createLabEventId,
  LAB_OPERATION_CAPABILITIES,
  normalizeLabOperationSettings,
} from "../../models/lab-types.js";
import type { LabOperationCapabilityId, LabUserActionEvent } from "../../models/lab-types.js";
import { getTrackedOperationActionId } from "../lab-operation-action-map.js";
import { getActionOutputs, getCurrentRun, getUserActions } from "../lab-selectors.js";
import type { createLabStore } from "../lab-store.js";
import {
  LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS,
  getTrackedLabUserActionDefinition,
} from "../lab-user-actions.js";
import { buildUiEvent, toStringArray } from "./lab-controller-helpers.js";

type LabRoomApi = {
  sendEvent?: (eventName: string, payload: Record<string, unknown>) => void;
};

type LabMediaActionWindow = {
  roomAPI?: LabRoomApi;
};

type LabMediaActionControllerDeps = {
  dispatch: ReturnType<typeof createLabStore>["dispatch"];
  store: ReturnType<typeof createLabStore>;
  windowRef: LabMediaActionWindow;
};

function createActionRequestId(action: string) {
  return `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLabMediaActionController(deps: LabMediaActionControllerDeps) {
  const hubDismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function getRoomApi() {
    return deps.windowRef.roomAPI;
  }

  function sendMediaAction(
    action: string,
    payload: Record<string, unknown> = {},
    options: { requestId?: string } = {}
  ) {
    const roomApi = getRoomApi();
    if (!roomApi || typeof roomApi.sendEvent !== "function") {
      deps.dispatch({
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

  function startTrackedUserAction(action: string, payload: Record<string, unknown> = {}) {
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

    deps.dispatch({
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

  function isOperationCapabilityId(value: string): value is LabOperationCapabilityId {
    return LAB_OPERATION_CAPABILITIES.some(function (capability) {
      return capability.id === value;
    });
  }

  function cancelTrackedOperation(capabilityId: string) {
    if (!isOperationCapabilityId(capabilityId)) {
      return;
    }
    const state = deps.store.getState();
    const capability =
      LAB_OPERATION_CAPABILITIES.find(function (entry) {
        return entry.id === capabilityId;
      }) || null;
    const trackedActionId = getTrackedOperationActionId(capability?.actionId);
    if (trackedActionId === null) {
      return;
    }
    const activeAction =
      getUserActions(state).find(function (entry) {
        return entry.sourceAction === trackedActionId && entry.status === "running";
      }) || null;
    if (activeAction === null) {
      deps.dispatch({
        type: "push-event",
        event: buildUiEvent("İptal edilecek aktif işlem bulunamadı.", "warning"),
      });
      return;
    }

    deps.dispatch({
      type: "user-action-updated",
      id: activeAction.id,
      patch: {
        message: "İptal isteği gönderildi.",
        progress: null,
      },
    });
    sendMediaAction("job-cancel", {
      actionId: trackedActionId,
      jobId: activeAction.jobId || null,
      projectId: activeAction.projectId || state.projectIndex.activeProjectId || null,
      sourceRequestId: activeAction.requestId || null,
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
        deps.dispatch({
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

  function handleBusEvent() {
    syncUserActionHubTimers();
  }

  return {
    cancelTrackedOperation,
    getActiveSelectionOperationPayload,
    getCurrentRunIntentPayload,
    getRoomApi,
    handleBusEvent,
    isOperationCapabilityId,
    sendMediaAction,
    startTrackedOperationForUiAction,
    startTrackedReportExport,
    syncUserActionHubTimers,
  };
}
