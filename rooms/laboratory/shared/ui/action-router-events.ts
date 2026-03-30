export function createLaboratoryUiActionEventRuntime(deps: any) {
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
    toggleCleanup,
  } = deps;

  function handleClick(event: any) {
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
        fieldId.split(".").reduce(function (accumulator: any, key: any) {
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
      const currentValue =
        toRecord(state.ui.localDrafts.youtubeCustom)[fieldId.replace("youtubeCustom.", "")] ===
        true;
      syncDraftField(fieldId, currentValue !== true);
      persistDrafts({
        youtubeCustom: {
          ...toRecord(state.ui.localDrafts.youtubeCustom),
        },
      });
      render();
    }
  }

  function handleInput(event: any) {
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

  function handleChange(event: any) {
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
    handleChange,
    handleClick,
    handleInput,
  };
}
