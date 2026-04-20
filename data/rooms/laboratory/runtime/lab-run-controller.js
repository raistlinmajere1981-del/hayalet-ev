import { asLabRecord, asNonEmptyString, createLabEventId } from "../models/lab-types.js";
import {
  canAdvanceToStage,
  getActiveEditOutput,
  getCurrentRun,
  getStageBlockReason,
  getSnapshot,
  getSourceMode,
  getSourceProbeStatus,
  getSourceStatus,
  getWorkbench
} from "./lab-selectors.js";
function toStringValue(value) {
  return typeof value === "string" ? value : "";
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
  function dispatch(event) {
    deps.eventBus.emit(event);
  }
  function getRoomApi() {
    return deps.windowRef.roomAPI;
  }
  function sendMediaAction(action, payload = {}) {
    const roomApi = getRoomApi();
    if (!roomApi || typeof roomApi.sendEvent !== "function") {
      dispatch({
        type: "push-event",
        event: buildUiEvent("Room API bridge is not connected.", "error")
      });
      return false;
    }
    const state = deps.store.getState();
    roomApi.sendEvent("media-action", {
      requestId: `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      payload: {
        featureId: state.featureId,
        ...payload
      }
    });
    return true;
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
        case "timeStartMs":
        case "timeEndMs": {
          const nextValue = readNumeric(value);
          const targetKey = field === "timeStartMs" ? "startMs" : "endMs";
          if (nextValue === null) {
            delete nextTimeRange[targetKey];
          } else {
            nextTimeRange[targetKey] = Math.max(0, Math.round(nextValue));
          }
          if (typeof nextTimeRange["startMs"] === "number" && typeof nextTimeRange["endMs"] === "number") {
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
      if (nextScope["focus"] === void 0 && nextScope["hypothesis"] === void 0 && nextScope["timeRange"] === void 0 && nextScope["frameRange"] === void 0 && nextScope["region"] === void 0) {
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
  function setStage(stage) {
    const state = deps.store.getState();
    if (canAdvanceToStage(state, stage)) {
      dispatch({ type: "stage-changed", stage });
      return;
    }
    const blockReason = getStageBlockReason(state, stage) || `Stage blocked: ${stage}`;
    dispatch({
      type: "push-event",
      event: buildUiEvent(blockReason, "warning")
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
    const { activeFeatureId, featureIds } = deriveFeatureSelectionFromCapabilities(
      normalizedCapabilities
    );
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
    const featureId = state.featureId;
    const sourceDrafts = state.ui.sourceDrafts;
    function startProbe(action, payload) {
      sendMediaAction(action, payload);
    }
    if (featureId === "subtitle-analysis") {
      const activeProject = asLabRecord(getSnapshot(state)["activeProject"]);
      const subtitleWorkspace = asLabRecord(
        asLabRecord(activeProject["subtitleAnalysis"])["workspace"]
      );
      const subtitleMode = asNonEmptyString(subtitleWorkspace["mode"]) || "local-file";
      const fields2 = {
        fileNameHint: sourceDrafts.fileNameHint,
        urlInput: sourceDrafts.urlInput,
        youtubeUrl: sourceDrafts.youtubeUrl
      };
      if (subtitleMode === "local-folder") {
        startProbe("subtitle-source-pick-folder", { fields: fields2 });
        return;
      }
      if (subtitleMode === "url") {
        startProbe("subtitle-source-download-url", { fields: fields2 });
        return;
      }
      if (subtitleMode.startsWith("youtube-")) {
        startProbe("subtitle-source-download-youtube", { fields: fields2 });
        return;
      }
      startProbe("subtitle-source-pick-local", { fields: fields2 });
      return;
    }
    const mode = getSourceMode(state);
    const fields = {
      fileNameHint: sourceDrafts.fileNameHint,
      urlInput: sourceDrafts.urlInput,
      youtubeUrl: sourceDrafts.youtubeUrl,
      youtubePreset: sourceDrafts.youtubePreset
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
  function runPrimaryAction() {
    const state = deps.store.getState();
    switch (state.currentStage) {
      case "source":
        runSourcePrimaryAction();
        return;
      case "edit":
        sendMediaAction(
          state.featureId === "subtitle-analysis" ? "subtitle-edit-preview" : "edit-preview"
        );
        return;
      case "process": {
        const run = getCurrentRun(state);
        if (run && run.state === "running") {
          sendMediaAction(
            state.featureId === "audio-analysis" ? "audio-process-cancel" : "process-cancel"
          );
          return;
        }
        sendMediaAction(state.featureId === "audio-analysis" ? "audio-process-run" : "process-run");
        return;
      }
      case "report":
        sendMediaAction(
          state.featureId === "audio-analysis" ? "audio-report-export" : "report-export"
        );
        return;
      default:
        return;
    }
  }
  function handleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const stageButton = target.closest("[data-lab-stage]");
    if (stageButton) {
      setStage(toStringValue(stageButton.dataset["labStage"]));
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
        sendMediaAction("tool-update-all", { featureStage: state.currentStage });
        return;
      case "tool-install":
      case "tool-update":
      case "tool-check-updates":
        if (value.trim() === "") {
          return;
        }
        sendMediaAction(action, {
          toolId: value,
          featureStage: state.currentStage
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
        dispatch({ type: "stage-changed", stage: "edit" });
        return;
      }
      case "save-project":
        dispatch({
          type: "push-event",
          event: buildUiEvent("Proje mevcut checkpoint durumu ile kaydedildi.", "success")
        });
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
    const field = target.dataset["labField"];
    if (!field) {
      return;
    }
    if (field.startsWith("source.")) {
      dispatch({
        type: "source-drafts-updated",
        patch: {
          [field.replace("source.", "")]: target.value
        }
      });
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
    }
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
        sendMediaAction("project-select", { projectId: targetValue });
        return;
      case "source.kind":
        dispatch({
          type: "source-config-patched",
          patch: {
            kind: targetValue
          }
        });
        sendMediaAction("source-set-kind", { kind: targetValue });
        return;
      case "source.mode":
        dispatch({
          type: "source-config-patched",
          patch: {
            mode: targetValue
          }
        });
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
              [field.replace("source.", "")]: targetValue
            }
          }
        );
        return;
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
            label: sourceStatus === "ready" ? "Kaynağı Yenile" : "Kaynağı Hazırla"
          };
        }
        if (sourceMode === "youtube" && drafts.youtubeUrl.trim() === "") {
          return {
            disabled: true,
            detail: "YouTube URL gerekli",
            label: sourceStatus === "ready" ? "Kaynağı Yenile" : "Kaynağı Hazırla"
          };
        }
        return {
          disabled: false,
          detail: sourceProbeStatus === "running" ? "Gerçek probe tamamlanıyor" : sourceProbeStatus === "completed" || sourceStatus === "ready" ? "Probe tamamlandı" : "Source probe başlatılır",
          label: sourceProbeStatus === "completed" || sourceStatus === "ready" ? "Kaynağı Yenile" : "Kaynağı Hazırla"
        };
      }
      case "edit": {
        const blockReason = getStageBlockReason(state, "edit");
        return {
          disabled: blockReason !== null,
          detail: blockReason || "Preview completion fake edilemez",
          label: "Önizleme Üret"
        };
      }
      case "process": {
        const run = getCurrentRun(state);
        const blockReason = getStageBlockReason(state, "process");
        return {
          disabled: blockReason !== null,
          detail: blockReason || (run && run.state === "running" ? "Aktif run iptal edilir" : "Sadece enabled modüller çalışır"),
          label: run && run.state === "running" ? "Çalışmayı İptal Et" : "Analizi Başlat"
        };
      }
      case "report": {
        const blockReason = getStageBlockReason(state, "report");
        return {
          disabled: blockReason !== null,
          detail: blockReason || "Structured rapor dışa aktarılır",
          label: "Raporları Dışa Aktar"
        };
      }
      default:
        return {
          disabled: false,
          detail: null,
          label: "Devam"
        };
    }
  }
  return {
    attach,
    getPrimaryActionState
  };
}
