import { createLaboratoryUiActionHandlers } from "./action-router-actions.js";
import { createLaboratoryUiActionEventRuntime } from "./action-router-events.js";

type LaboratoryUiActionHandlersDeps = Parameters<typeof createLaboratoryUiActionHandlers>[0];
type LaboratoryUiActionEventRuntimeDeps = Omit<
  Parameters<typeof createLaboratoryUiActionEventRuntime>[0],
  "handleAction"
>;

type LaboratoryUiActionRouterDeps = LaboratoryUiActionHandlersDeps &
  LaboratoryUiActionEventRuntimeDeps;

export function createLaboratoryUiActionRouter(deps: LaboratoryUiActionRouterDeps) {
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

  const { handleAction } = createLaboratoryUiActionHandlers({
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
