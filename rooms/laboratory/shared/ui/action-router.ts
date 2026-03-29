// @ts-nocheck
import { createLaboratoryUiActionHandlers } from "./action-router-actions.js";
import { createLaboratoryUiActionEventRuntime } from "./action-router-events.js";

export function createLaboratoryUiActionRouter(deps) {
  const {
    advanceStage,
    buildCurrentDraftPayload,
    buildCurrentEditRecipePatch,
    buildNestedPatch,
    closeSettingsOverlay,
    commitEditPatch,
    getActiveEditOutput,
    getCurrentEditDraft,
    getProfileTargetSummary,
    getProjectProfile,
    getSourceSnapshot,
    isAudioAnalysisFeature,
    openReport,
    openSettingsOverlay,
    persistDrafts,
    readFormValue,
    render,
    resetJourney,
    restartProcess,
    sendMediaAction,
    sendSourceAction,
    setStage,
    state,
    syncDraftField,
    syncLocalEditField,
    toRecord,
    toggleCleanup,
  } = deps;

  const laboratoryUiActionHandlers = createLaboratoryUiActionHandlers({
    advanceStage,
    buildCurrentDraftPayload,
    buildCurrentEditRecipePatch,
    closeSettingsOverlay,
    getActiveEditOutput,
    getProfileTargetSummary,
    getSourceSnapshot,
    isAudioAnalysisFeature,
    openReport,
    openSettingsOverlay,
    persistDrafts,
    render,
    resetJourney,
    restartProcess,
    sendMediaAction,
    sendSourceAction,
    state,
    syncDraftField,
  });
  const handleAction = laboratoryUiActionHandlers.handleAction;

  const laboratoryUiActionEventRuntime = createLaboratoryUiActionEventRuntime({
    buildNestedPatch,
    commitEditPatch,
    getCurrentEditDraft,
    getProjectProfile,
    handleAction,
    persistDrafts,
    readFormValue,
    render,
    sendMediaAction,
    sendSourceAction,
    setStage,
    state,
    syncDraftField,
    syncLocalEditField,
    toRecord,
    toggleCleanup,
  });

  return {
    handleAction,
    handleChange: laboratoryUiActionEventRuntime.handleChange,
    handleClick: laboratoryUiActionEventRuntime.handleClick,
    handleInput: laboratoryUiActionEventRuntime.handleInput,
  };
}
