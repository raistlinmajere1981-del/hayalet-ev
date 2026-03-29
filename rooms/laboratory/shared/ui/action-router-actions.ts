// @ts-nocheck
export function createLaboratoryUiActionHandlers(deps) {
  const {
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
  } = deps;

  function handleAction(action, value) {
    switch (action) {
      case "nav-previous":
        advanceStage(-1);
        return;
      case "nav-next":
        advanceStage(1);
        return;
      case "open-settings":
        openSettingsOverlay();
        return;
      case "close-settings":
        closeSettingsOverlay();
        return;
      case "tools-refresh":
        sendSourceAction("tools-refresh");
        return;
      case "project-create":
        state.ui.pendingDeleteProjectId = null;
        sendSourceAction("project-create");
        return;
      case "project-delete-arm":
        state.ui.pendingDeleteProjectId = getSourceSnapshot().activeProjectId;
        render();
        return;
      case "project-delete-confirm":
        sendSourceAction("project-delete", {
          projectId: state.ui.pendingDeleteProjectId,
        });
        state.ui.pendingDeleteProjectId = null;
        render();
        return;
      case "project-delete-cancel":
        state.ui.pendingDeleteProjectId = null;
        render();
        return;
      case "source-kind":
        sendSourceAction("source-set-kind", { kind: value });
        return;
      case "source-mode":
        sendSourceAction("source-set-mode", { mode: value });
        return;
      case "subtitle-source-mode":
        sendSourceAction("subtitle-source-set-mode", { mode: value });
        return;
      case "subtitle-source-select-entry":
        sendSourceAction("subtitle-source-select-entry", { entryId: value });
        return;
      case "subtitle-source-toggle-selection":
        sendSourceAction("subtitle-source-toggle-selection", { entryId: value });
        return;
      case "youtube-preset":
        syncDraftField("youtubePreset", value);
        persistDrafts({ youtubePreset: value });
        return;
      case "source-pick-local":
        sendSourceAction("source-pick-local");
        return;
      case "subtitle-source-pick-local":
        sendSourceAction("subtitle-source-pick-local", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-pick-folder":
        sendSourceAction("subtitle-source-pick-folder", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "source-download-url":
        sendSourceAction("source-download-url", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-download-url":
        sendSourceAction("subtitle-source-download-url", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-discover-youtube":
        sendSourceAction("subtitle-source-discover-youtube", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "source-download-youtube":
        sendSourceAction("source-download-youtube", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-download-youtube":
        sendSourceAction("subtitle-source-download-youtube", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-toggle-discovery":
        sendSourceAction("subtitle-source-toggle-discovery", { candidateId: value });
        return;
      case "subtitle-source-select-all-discovery":
        sendSourceAction("subtitle-source-select-all-discovery");
        return;
      case "subtitle-source-clear-discovery-selection":
        sendSourceAction("subtitle-source-clear-discovery-selection");
        return;
      case "subtitle-edit-preset":
        sendMediaAction("subtitle-edit-apply-preset", {
          presetId: value,
          featureStage: "edit",
        });
        return;
      case "subtitle-edit-preview":
        sendMediaAction("subtitle-edit-preview", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit",
        });
        return;
      case "subtitle-edit-apply":
        sendMediaAction("subtitle-edit-apply", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit",
        });
        return;
      case "edit-mode":
        sendMediaAction("edit-set-mode", {
          mode: value,
          featureStage: "edit",
        });
        return;
      case "edit-preset":
        sendMediaAction("edit-apply-preset", {
          presetId: value,
          featureStage: "edit",
        });
        return;
      case "edit-preview":
        sendMediaAction("edit-preview", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit",
        });
        return;
      case "edit-apply":
        sendMediaAction("edit-apply", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit",
        });
        return;
      case "edit-cancel-preview":
        sendMediaAction("edit-cancel-preview", {
          featureStage: "edit",
        });
        return;
      case "edit-cancel-apply":
        sendMediaAction("edit-cancel-apply", {
          featureStage: "edit",
        });
        return;
      case "edit-select-output":
        sendMediaAction("edit-set-output", {
          outputId: value,
          featureStage: "edit",
        });
        return;
      case "edit-handoff":
        sendMediaAction("edit-set-handoff", {
          mode: value,
          featureStage: "edit",
        });
        return;
      case "profile-mode":
        sendMediaAction("profile-set-mode", {
          mode: value,
          featureStage: "profile",
        });
        return;
      case "profile-preset":
        sendMediaAction("profile-apply-preset", {
          presetId: value,
          featureStage: "profile",
        });
        return;
      case "profile-target-mode":
        sendMediaAction("profile-set-target", {
          mode: value,
          outputId:
            value === "derived"
              ? getProfileTargetSummary().outputId || (getActiveEditOutput() && getActiveEditOutput().id) || null
              : null,
          featureStage: "profile",
        });
        return;
      case "profile-run":
        sendMediaAction("profile-run-preflight", {
          featureStage: "profile",
        });
        return;
      case "profile-cancel":
        sendMediaAction("profile-cancel-preflight", {
          featureStage: "profile",
        });
        return;
      case "profile-model-install":
        sendMediaAction("profile-model-install", {
          modelId: value,
          featureStage: "profile",
        });
        return;
      case "profile-model-remove":
        sendMediaAction("profile-model-remove", {
          modelId: value,
          featureStage: "profile",
        });
        return;
      case "tool-install":
        sendMediaAction("tool-install", { toolId: value, featureStage: state.activeStage });
        return;
      case "tool-update":
        sendMediaAction("tool-update", { toolId: value, featureStage: state.activeStage });
        return;
      case "restart-process":
        restartProcess();
        return;
      case "process-cancel":
        sendMediaAction(isAudioAnalysisFeature() ? "audio-process-cancel" : "process-cancel", {
          featureStage: "process",
        });
        return;
      case "open-report":
        openReport();
        return;
      case "reset-journey":
        resetJourney();
        return;
      case "export-report":
        sendMediaAction(isAudioAnalysisFeature() ? "audio-report-export" : "report-export", {
          featureStage: "report",
        });
        return;
      default:
        break;
    }
  }

  return {
    handleAction,
  };
}
