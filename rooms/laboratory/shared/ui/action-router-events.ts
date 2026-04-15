import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratoryProjectProfileRecord = LaboratoryRecord & {
  artifactPreferences?: unknown;
  laneSelection?: unknown;
};

type LaboratoryUiActionEventRuntimeDeps = {
  buildNestedPatch: (path: string, value: unknown) => LaboratoryRecord;
  commitEditPatch: (patch: LaboratoryRecord) => unknown;
  getCurrentEditDraft: () => LaboratoryRecord;
  getProjectProfile: () => LaboratoryProjectProfileRecord;
  handleAction: (action: string, value: string) => unknown;
  persistDrafts: (extraFields?: unknown) => unknown;
  readFormValue: (target: HTMLInputElement | HTMLSelectElement) => unknown;
  render: () => unknown;
  sendMediaAction: (action: string, payload?: LaboratoryRecord | null) => string | null;
  sendSourceAction: (action: string, payload?: LaboratoryRecord | null) => string | null;
  setStage: (stageId: string) => unknown;
  state: LaboratoryUiState;
  syncDraftField: (path: string, value: unknown) => unknown;
  syncLocalEditField: (path: string, value: unknown) => unknown;
  toRecord: (value: unknown) => LaboratoryRecord;
  toggleCleanup: (cleanupId: string) => unknown;
};

export function createLaboratoryUiActionEventRuntime(deps: LaboratoryUiActionEventRuntimeDeps) {
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

  function getDatasetValue(element: HTMLElement, key: string): string {
    return element.dataset[key] || "";
  }

  function getEventElementTarget(event: Event): Element | null {
    return event.target instanceof Element ? event.target : null;
  }

  function isFormControl(
    target: EventTarget | null
  ): target is HTMLInputElement | HTMLSelectElement {
    return target instanceof HTMLInputElement || target instanceof HTMLSelectElement;
  }

  function readNestedBoolean(source: LaboratoryRecord, path: string[]): boolean {
    const resolvedValue = path.reduce<unknown>(function (accumulator, key) {
      if (!accumulator || typeof accumulator !== "object" || Array.isArray(accumulator)) {
        return undefined;
      }
      return toRecord(accumulator)[key];
    }, source);
    return resolvedValue === true;
  }

  function getProfileToggleState(field: "laneSelection" | "artifactPreferences", entryId: string) {
    return toRecord(getProjectProfile()[field])[entryId] === true;
  }

  function getYoutubeCustomDrafts() {
    return toRecord(state.ui.localDrafts.youtubeCustom);
  }

  function handleClick(event: Event) {
    const target = getEventElementTarget(event);
    if (!target) {
      return;
    }

    const editFocusRegionButton = target.closest('[data-action="edit-focus-region"]');
    if (editFocusRegionButton instanceof HTMLElement) {
      const focusRegionId = getDatasetValue(editFocusRegionButton, "value");
      if (focusRegionId !== "") {
        syncLocalEditField("recipe.common.focusRegionId", focusRegionId);
        commitEditPatch(buildNestedPatch("common.focusRegionId", focusRegionId));
        render();
      }
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
            [laneId]: currentValue !== true,
          },
        },
        featureStage: "profile",
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
            [artifactId]: currentValue !== true,
          },
        },
        featureStage: "profile",
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
          ...getYoutubeCustomDrafts(),
        },
      });
      render();
    }
  }

  function handleInput(event: Event) {
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

    if (
      isFormControl(target) &&
      ["sensitivity", "transcriptSampleSeconds"].includes(target.dataset["profileField"] || "")
    ) {
      render();
    }
  }

  function handleChange(event: Event) {
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
