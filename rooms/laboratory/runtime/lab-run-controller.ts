import {
  asLabRecord,
  asNonEmptyString,
  createLabEventId,
} from "../models/lab-types.js";
import type { LabFeatureId, LabStage } from "../models/lab-types.js";
import {
  canAdvanceToStage,
  getActiveEditOutput,
  getCurrentPreflight,
  getCurrentRun,
  getStageBlockReason,
  getSnapshot,
  getSourceMode,
  getSourceProbeStatus,
  getSourceStatus,
  getWorkbench,
} from "./lab-selectors.js";
import type { createLabEventBus } from "./lab-event-bus.js";
import type { createLabStore } from "./lab-store.js";

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

function isTextControl(target: EventTarget | null): target is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

function buildUiEvent(message: string, severity: "info" | "warning" | "error" | "success" = "info") {
  return {
    id: createLabEventId("ui"),
    kind: "ui",
    severity,
    message,
    detail: null,
    timestamp: Date.now(),
    source: "ui" as const,
    action: null,
    stage: null,
  };
}

export function createLabRunController(deps: LabRunControllerDeps) {
  let attached = false;

  function dispatch(event: Parameters<ReturnType<typeof createLabStore>["dispatch"]>[0]) {
    deps.eventBus.emit(event);
  }

  function getRoomApi() {
    return deps.windowRef.roomAPI;
  }

  function sendMediaAction(action: string, payload: Record<string, unknown> = {}) {
    const roomApi = getRoomApi();
    if (!roomApi || typeof roomApi.sendEvent !== "function") {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Room API bridge is not connected.", "error"),
      });
      return false;
    }

    const state = deps.store.getState();
    roomApi.sendEvent("media-action", {
      requestId: `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      payload: {
        featureId: state.featureId,
        ...payload,
      },
    });
    return true;
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
    sendHostContext({
      ...state.context,
      workbench: update(currentWorkbench),
    });
  }

  function setStage(stage: LabStage) {
    const state = deps.store.getState();
    if (canAdvanceToStage(state, stage)) {
      dispatch({ type: "stage-changed", stage });
      return;
    }
    const blockReason = getStageBlockReason(state, stage) || `Stage blocked: ${stage}`;

    dispatch({
      type: "push-event",
      event: buildUiEvent(blockReason, "warning"),
    });
  }

  function activateFeature(featureId: string) {
    dispatch({
      type: "feature-changed",
      featureId: featureId as LabFeatureId,
    });
    updateWorkbench(function (workbench) {
      const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"])
        ? (workbench["selectedModuleIds"] as unknown[]).filter((entry): entry is string => typeof entry === "string")
        : [];
      return {
        ...workbench,
        activeModuleId: featureId,
        selectedModuleIds:
          selectedModuleIds.includes(featureId) ? selectedModuleIds : [featureId].concat(selectedModuleIds),
      };
    });
  }

  function toggleFeature(featureId: string) {
    updateWorkbench(function (workbench) {
    const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"])
      ? (workbench["selectedModuleIds"] as unknown[]).filter((entry): entry is string => typeof entry === "string")
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

  function runSourcePrimaryAction() {
    const state = deps.store.getState();
    const featureId = state.featureId;
    const sourceDrafts = state.ui.sourceDrafts;

    function startProbe(action: string, detail: string, payload: Record<string, unknown>) {
      dispatch({
        type: "source-probe-started",
        action,
        detail,
      });
      if (sendMediaAction(action, payload) !== true) {
        dispatch({
          type: "source-probe-failed",
          action,
          detail: "Room API bridge is not connected.",
        });
      }
    }

    if (featureId === "subtitle-analysis") {
      const activeProject = asLabRecord(getSnapshot(state)["activeProject"]);
      const subtitleWorkspace = asLabRecord(asLabRecord(activeProject["subtitleAnalysis"])["workspace"]);
      const subtitleMode = asNonEmptyString(subtitleWorkspace["mode"]) || "local-file";
      const fields = {
        fileNameHint: sourceDrafts.fileNameHint,
        urlInput: sourceDrafts.urlInput,
        youtubeUrl: sourceDrafts.youtubeUrl,
      };
      if (subtitleMode === "local-folder") {
        startProbe("subtitle-source-pick-folder", "Local subtitle probe started.", { fields });
        return;
      }
      if (subtitleMode === "url") {
        startProbe("subtitle-source-download-url", "Subtitle URL probe started.", { fields });
        return;
      }
      if (subtitleMode.startsWith("youtube-")) {
        startProbe("subtitle-source-download-youtube", "Subtitle YouTube probe started.", { fields });
        return;
      }
      startProbe("subtitle-source-pick-local", "Local subtitle probe started.", { fields });
      return;
    }

    const mode = getSourceMode(state);
    const fields = {
      fileNameHint: sourceDrafts.fileNameHint,
      urlInput: sourceDrafts.urlInput,
      youtubeUrl: sourceDrafts.youtubeUrl,
      youtubePreset: sourceDrafts.youtubePreset,
    };
    if (mode === "url") {
      startProbe("source-download-url", "Direct URL probe started.", { fields });
      return;
    }
    if (mode === "youtube") {
      startProbe("source-download-youtube", "YouTube probe started.", { fields });
      return;
    }
    startProbe("source-pick-local", "Local source probe started.", { fields });
  }

  function runPrimaryAction() {
    const state = deps.store.getState();
    switch (state.currentStage) {
      case "source":
        runSourcePrimaryAction();
        return;
      case "edit":
        dispatch({
          type: "preview-started",
          action: state.featureId === "subtitle-analysis" ? "subtitle-edit-preview" : "edit-preview",
          detail: "Preview job requested.",
        });
        sendMediaAction(state.featureId === "subtitle-analysis" ? "subtitle-edit-preview" : "edit-preview");
        return;
      case "profile":
        dispatch({
          type: "preflight-started",
          action: "profile-run-preflight",
          detail: "Preflight requested.",
        });
        sendMediaAction("profile-run-preflight");
        return;
      case "process": {
        const run = getCurrentRun(state);
        if (run && run.state === "running") {
          dispatch({
            type: "run-cancelled",
            action: state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel",
            detail: "Cancellation requested.",
          });
          sendMediaAction(state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel");
          return;
        }
        dispatch({
          type: "run-started",
          action: state.featureId === "audio-analysis" ? "audio-process-run" : "process-run",
          detail: "Pipeline run requested.",
        });
        sendMediaAction(state.featureId === "audio-analysis" ? "audio-process-run" : "process-run");
        return;
      }
      case "report":
        sendMediaAction(state.featureId === "audio-analysis" ? "audio-report-export" : "report-export");
        return;
      default:
        return;
    }
  }

  function handleClick(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }

    const stageButton = target.closest<HTMLElement>("[data-lab-stage]");
    if (stageButton) {
      setStage(toStringValue(stageButton.dataset["labStage"]) as LabStage);
      return;
    }

    const actionButton = target.closest<HTMLElement>("[data-lab-action]");
    if (!actionButton) {
      return;
    }

    const action = toStringValue(actionButton.dataset["labAction"]);
    const value = toStringValue(actionButton.dataset["labValue"]);
    switch (action) {
      case "primary-action":
        runPrimaryAction();
        return;
      case "feature-activate":
        activateFeature(value);
        return;
      case "feature-toggle":
        toggleFeature(value);
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
      case "show-more-artifacts":
        dispatch({ type: "show-more-artifacts" });
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

    if (field.startsWith("source.")) {
      dispatch({
        type: "source-drafts-updated",
        patch: {
          [field.replace("source.", "")]: target.value,
        },
      });
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
      const value = target instanceof HTMLInputElement && target.type === "number"
        ? rawValue === "" ? null : Number(rawValue)
        : rawValue;
      dispatch({
        type: "profile-drafts-updated",
        patch: {
          [field.replace("profile.", "")]: value,
        },
      });
    }
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
      case "project.id":
        sendMediaAction("project-select", { projectId: targetValue });
        return;
      case "source.kind":
        sendMediaAction("source-set-kind", { kind: targetValue });
        return;
      case "source.mode":
        sendMediaAction(
          state.featureId === "subtitle-analysis" ? "subtitle-source-set-mode" : "source-set-mode",
          { mode: targetValue }
        );
        return;
      case "source.fileNameHint":
      case "source.urlInput":
      case "source.youtubeUrl":
        sendMediaAction(
          state.featureId === "subtitle-analysis" ? "subtitle-source-update-drafts" : "source-update-draft",
          {
            fields: {
              ...state.ui.sourceDrafts,
              [field.replace("source.", "")]: targetValue,
            },
          }
        );
        return;
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

  function attach() {
    if (attached) {
      return;
    }
    attached = true;
    deps.documentRef.addEventListener("click", handleClick);
    deps.documentRef.addEventListener("input", handleInput);
    deps.documentRef.addEventListener("change", handleChange);
  }

  function getPrimaryActionState() {
    const state = deps.store.getState();
    switch (state.currentStage) {
      case "source": {
        const sourceStatus = getSourceStatus(state);
        const sourceProbeStatus = getSourceProbeStatus(state);
        const sourceMode = getSourceMode(state);
        const drafts = state.ui.sourceDrafts;
        if (sourceMode === "url" && drafts.urlInput.trim() === "") {
          return {
            disabled: true,
            detail: "Kaynak URL gerekli",
            label: sourceStatus === "ready" ? "Kaynağı Yenile" : "Kaynağı Hazırla",
          };
        }
        if (sourceMode === "youtube" && drafts.youtubeUrl.trim() === "") {
          return {
            disabled: true,
            detail: "YouTube URL gerekli",
            label: sourceStatus === "ready" ? "Kaynağı Yenile" : "Kaynağı Hazırla",
          };
        }
        return {
          disabled: false,
          detail:
            sourceProbeStatus === "running"
              ? "Gerçek probe tamamlanıyor"
              : sourceProbeStatus === "completed" || sourceStatus === "ready"
                ? "Probe tamamlandı"
                : "Source probe başlatılır",
          label: sourceProbeStatus === "completed" || sourceStatus === "ready" ? "Kaynağı Yenile" : "Kaynağı Hazırla",
        };
      }
      case "edit":
        {
          const blockReason = getStageBlockReason(state, "edit");
          return {
            disabled: blockReason !== null,
            detail: blockReason || "Preview completion fake edilemez",
            label: "Önizleme Üret",
          };
        }
      case "profile": {
        const preflight = getCurrentPreflight(state);
        const blockReason = getStageBlockReason(state, "profile");
        return {
          disabled: blockReason !== null,
          detail:
            blockReason ||
            (preflight.status === "blocked"
              ? "Bloklayıcı dependency mevcut"
              : "Preflight gerçek readiness üretir"),
          label: "Ön Kontrol Çalıştır",
        };
      }
      case "process": {
        const run = getCurrentRun(state);
        const blockReason = getStageBlockReason(state, "process");
        return {
          disabled: blockReason !== null,
          detail:
            blockReason ||
            (run && run.state === "running"
              ? "Aktif run iptal edilir"
              : "Sadece enabled modüller çalışır"),
          label: run && run.state === "running" ? "Çalışmayı İptal Et" : "Analizi Başlat",
        };
      }
      case "report":
        {
          const blockReason = getStageBlockReason(state, "report");
          return {
            disabled: blockReason !== null,
            detail: blockReason || "Structured rapor dışa aktarılır",
            label: "Raporları Dışa Aktar",
          };
        }
      default:
        return {
          disabled: false,
          detail: null,
          label: "Devam",
        };
    }
  }

  return {
    attach,
    getPrimaryActionState,
  };
}
