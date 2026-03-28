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
      case "edit-focus-region":
        syncLocalEditField("recipe.common.focusRegionId", value);
        commitEditPatch(buildNestedPatch("common.focusRegionId", value));
        render();
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

  function handleClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionButton = target.closest("[data-action]");
    if (actionButton instanceof HTMLElement) {
      handleAction(actionButton.dataset["action"] || "", actionButton.dataset["value"] || "");
      return;
    }

    const stageButton = target.closest("[data-stage-target]");
    if (stageButton instanceof HTMLElement) {
      setStage(stageButton.dataset["stageTarget"] || "");
      return;
    }

    const toggleButton = target.closest("[data-toggle]");
    if (toggleButton instanceof HTMLElement) {
      const toggleId = toggleButton.dataset["toggle"] || "";
      if (toggleId.startsWith("cleanup-")) {
        toggleCleanup(toggleId.replace("cleanup-", ""));
        return;
      }
    }

    const editToggle = target.closest("[data-edit-toggle]");
    if (editToggle instanceof HTMLElement) {
      const fieldId = editToggle.dataset["editToggle"] || "";
      const path = fieldId.replace(/^recipe\./, "");
      const currentValue =
        fieldId
          .split(".")
          .reduce(function (accumulator, key) {
            return accumulator && typeof accumulator === "object" ? accumulator[key] : undefined;
          }, getCurrentEditDraft()) === true;
      syncLocalEditField(fieldId, currentValue !== true);
      commitEditPatch(buildNestedPatch(path, currentValue !== true));
      render();
      return;
    }

    const profileToggle = target.closest("[data-profile-toggle]");
    if (profileToggle instanceof HTMLElement) {
      const laneId = profileToggle.dataset["profileToggle"] || "";
      const currentValue = toRecord(getProjectProfile().laneSelection)[laneId] === true;
      sendMediaAction("profile-update", {
        patch: {
          laneSelection: {
            [laneId]: currentValue !== true,
          },
        },
        featureStage: "profile",
      });
      return;
    }

    const profileArtifactToggle = target.closest("[data-profile-artifact-toggle]");
    if (profileArtifactToggle instanceof HTMLElement) {
      const artifactId = profileArtifactToggle.dataset["profileArtifactToggle"] || "";
      const currentValue = toRecord(getProjectProfile().artifactPreferences)[artifactId] === true;
      sendMediaAction("profile-update", {
        patch: {
          artifactPreferences: {
            [artifactId]: currentValue !== true,
          },
        },
        featureStage: "profile",
      });
      return;
    }

    const draftToggle = target.closest("[data-toggle-field]");
    if (draftToggle instanceof HTMLElement) {
      const fieldId = draftToggle.dataset["toggleField"] || "";
      const currentValue = toRecord(state.ui.localDrafts.youtubeCustom)[fieldId.replace("youtubeCustom.", "")] === true;
      syncDraftField(fieldId, currentValue !== true);
      persistDrafts({
        youtubeCustom: {
          ...toRecord(state.ui.localDrafts.youtubeCustom),
        },
      });
      render();
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset["draftField"]) {
      syncDraftField(target.dataset["draftField"], target.type === "number" ? Number(target.value) : target.value);
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset["draftField"]) {
      syncDraftField(target.dataset["draftField"], target.value);
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset["editField"]
    ) {
      const fieldId = target.dataset["editField"];
      const nextValue = readFormValue(target);
      syncLocalEditField(fieldId, nextValue);
      render();
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      ["sensitivity", "transcriptSampleSeconds"].includes(target.dataset["profileField"] || "")
    ) {
      render();
    }
  }

  function handleChange(event) {
    const target = event.target;

    if (target instanceof HTMLSelectElement && target.dataset["select"] === "project") {
      sendSourceAction("project-select", { projectId: target.value });
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset["draftField"]
    ) {
      persistDrafts();
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset["editField"]
    ) {
      const fieldId = target.dataset["editField"] || "";
      const path = fieldId.replace(/^recipe\./, "");
      const nextValue = readFormValue(target);
      syncLocalEditField(fieldId, nextValue);
      commitEditPatch(buildNestedPatch(path, nextValue));
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset["profileField"]
    ) {
      const fieldId = target.dataset["profileField"] || "";
      const nextValue = readFormValue(target);
      if (fieldId === "targetOutputId") {
        sendMediaAction("profile-set-target", {
          mode: "derived",
          outputId: typeof nextValue === "string" && nextValue.trim() !== "" ? nextValue : null,
          featureStage: "profile",
        });
        return;
      }
      if (fieldId === "modelId") {
        sendMediaAction("profile-set-model", {
          modelId: typeof nextValue === "string" && nextValue.trim() !== "" ? nextValue : null,
          featureStage: "profile",
        });
        return;
      }
      sendMediaAction("profile-update", {
        patch: {
          [fieldId]: nextValue,
        },
        featureStage: "profile",
      });
    }
  }

  return {
    handleAction,
    handleChange,
    handleClick,
    handleInput,
  };
}
