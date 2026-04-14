export function createLaboratoryUiActionEventRuntime(deps) {
  const {
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
    toggleCleanup
  } = deps;
  function getDatasetValue(element, key) {
    return element.dataset[key] || "";
  }
  function getEventElementTarget(event) {
    return event.target instanceof Element ? event.target : null;
  }
  function isFormControl(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLSelectElement;
  }
  function readNestedBoolean(source, path) {
    const resolvedValue = path.reduce(function(accumulator, key) {
      if (!accumulator || typeof accumulator !== "object" || Array.isArray(accumulator)) {
        return void 0;
      }
      return toRecord(accumulator)[key];
    }, source);
    return resolvedValue === true;
  }
  function getProfileToggleState(field, entryId) {
    return toRecord(getProjectProfile()[field])[entryId] === true;
  }
  function getYoutubeCustomDrafts() {
    return toRecord(state.ui.localDrafts.youtubeCustom);
  }
  function handleClick(event) {
    const target = getEventElementTarget(event);
    if (!target) {
      return;
    }
    const actionButton = target.closest("[data-action]");
    if (actionButton instanceof HTMLElement) {
      handleAction(getDatasetValue(actionButton, "action"), getDatasetValue(actionButton, "value"));
      return;
    }
    const stageButton = target.closest("[data-stage-target]");
    if (stageButton instanceof HTMLElement) {
      setStage(getDatasetValue(stageButton, "stageTarget"));
      return;
    }
    const toggleButton = target.closest("[data-toggle]");
    if (toggleButton instanceof HTMLElement) {
      const toggleId = getDatasetValue(toggleButton, "toggle");
      if (toggleId.startsWith("cleanup-")) {
        toggleCleanup(toggleId.replace("cleanup-", ""));
        return;
      }
    }
    const editToggle = target.closest("[data-edit-toggle]");
    if (editToggle instanceof HTMLElement) {
      const fieldId = getDatasetValue(editToggle, "editToggle");
      const path = fieldId.replace(/^recipe\./, "");
      const currentValue = readNestedBoolean(getCurrentEditDraft(), fieldId.split("."));
      syncLocalEditField(fieldId, currentValue !== true);
      commitEditPatch(buildNestedPatch(path, currentValue !== true));
      render();
      return;
    }
    const profileToggle = target.closest("[data-profile-toggle]");
    if (profileToggle instanceof HTMLElement) {
      const laneId = getDatasetValue(profileToggle, "profileToggle");
      const currentValue = getProfileToggleState("laneSelection", laneId);
      sendMediaAction("profile-update", {
        patch: {
          laneSelection: {
            [laneId]: currentValue !== true
          }
        },
        featureStage: "profile"
      });
      return;
    }
    const profileArtifactToggle = target.closest("[data-profile-artifact-toggle]");
    if (profileArtifactToggle instanceof HTMLElement) {
      const artifactId = getDatasetValue(profileArtifactToggle, "profileArtifactToggle");
      const currentValue = getProfileToggleState("artifactPreferences", artifactId);
      sendMediaAction("profile-update", {
        patch: {
          artifactPreferences: {
            [artifactId]: currentValue !== true
          }
        },
        featureStage: "profile"
      });
      return;
    }
    const draftToggle = target.closest("[data-toggle-field]");
    if (draftToggle instanceof HTMLElement) {
      const fieldId = getDatasetValue(draftToggle, "toggleField");
      const currentValue = getYoutubeCustomDrafts()[fieldId.replace("youtubeCustom.", "")] === true;
      syncDraftField(fieldId, currentValue !== true);
      persistDrafts({
        youtubeCustom: {
          ...getYoutubeCustomDrafts()
        }
      });
      render();
    }
  }
  function handleInput(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset["draftField"]) {
      syncDraftField(
        target.dataset["draftField"],
        target.type === "number" ? Number(target.value) : target.value
      );
      return;
    }
    if (target instanceof HTMLSelectElement && target.dataset["draftField"]) {
      syncDraftField(target.dataset["draftField"], target.value);
      return;
    }
    if (isFormControl(target) && target.dataset["editField"]) {
      const fieldId = target.dataset["editField"];
      syncLocalEditField(fieldId, readFormValue(target));
      render();
      return;
    }
    if (isFormControl(target) && ["sensitivity", "transcriptSampleSeconds"].includes(target.dataset["profileField"] || "")) {
      render();
    }
  }
  function handleChange(event) {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.dataset["select"] === "project") {
      sendSourceAction("project-select", { projectId: target.value });
      return;
    }
    if (isFormControl(target) && target.dataset["draftField"]) {
      persistDrafts();
      return;
    }
    if (isFormControl(target) && target.dataset["editField"]) {
      const fieldId = target.dataset["editField"] || "";
      const path = fieldId.replace(/^recipe\./, "");
      const nextValue = readFormValue(target);
      syncLocalEditField(fieldId, nextValue);
      commitEditPatch(buildNestedPatch(path, nextValue));
      return;
    }
    if (isFormControl(target) && target.dataset["profileField"]) {
      const fieldId = target.dataset["profileField"] || "";
      const nextValue = readFormValue(target);
      if (fieldId === "targetOutputId") {
        sendMediaAction("profile-set-target", {
          mode: "derived",
          outputId: typeof nextValue === "string" && nextValue.trim() !== "" ? nextValue : null,
          featureStage: "profile"
        });
        return;
      }
      if (fieldId === "modelId") {
        sendMediaAction("profile-set-model", {
          modelId: typeof nextValue === "string" && nextValue.trim() !== "" ? nextValue : null,
          featureStage: "profile"
        });
        return;
      }
      sendMediaAction("profile-update", {
        patch: {
          [fieldId]: nextValue
        },
        featureStage: "profile"
      });
    }
  }
  return {
    handleChange,
    handleClick,
    handleInput
  };
}
