export function createLaboratoryUiActionHandlers(deps) {
  const {
    advanceStage,
    buildCurrentDraftPayload,
    buildCurrentEditRecipePatch,
    closeSettingsOverlay,
    getActiveEditOutput,
    getProfileTargetSummary,
    getSourceSnapshot,
    getToolRegistry,
    isAudioAnalysisFeature,
    openReport,
    openSettingsOverlay,
    persistDrafts,
    render,
    resetJourney,
    restartProcess,
    setActiveWorkbenchModule,
    setBlockingStatus,
    setResultStatus,
    sendMediaAction,
    sendSourceAction,
    state,
    syncDraftField,
    text,
    toggleEventLog,
    toggleWorkbenchModuleSelection
  } = deps;
  function toRecord(value) {
    return value !== null && typeof value === "object" && Array.isArray(value) === false ? value : {};
  }
  function toString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return toString(entry).trim();
    }).filter(function(entry) {
      return entry !== "";
    });
  }
  function normalizeHelperPlatform(value) {
    if (value === "windows") {
      return value;
    }
    return "linux";
  }
  function getToolDescriptor(toolId) {
    return getToolRegistry().find(function(entry) {
      return toString(entry.toolId).trim() === toolId;
    }) || null;
  }
  function getManualGuidePlatformRecord(descriptor, platform) {
    const manualGuide = toRecord(descriptor?.manualGuide);
    return toRecord(manualGuide[platform]);
  }
  function getInstallCommand(toolId, platform, index) {
    const descriptor = getToolDescriptor(toolId);
    const commands = toStringArray(
      getManualGuidePlatformRecord(descriptor, platform).installCommands
    );
    return commands[index] || null;
  }
  async function copyInstallCommand(toolId, platform, index) {
    const command = getInstallCommand(toolId, platform, index);
    const toolLabel = text(["mediaAnalysis", "settings", "tools", toolId]) || toString(getToolDescriptor(toolId)?.displayName) || toolId;
    if (command === null) {
      setBlockingStatus(text(["mediaAnalysis", "settings", "helper", "copyFailure"]));
      render();
      return;
    }
    try {
      const navigatorRef = globalThis.navigator;
      const clipboard = navigatorRef?.clipboard;
      if (typeof clipboard?.writeText !== "function") {
        throw new Error("Clipboard API is unavailable");
      }
      await clipboard.writeText(command);
      setResultStatus(
        `${text(["mediaAnalysis", "settings", "helper", "copySuccess"])} ${toolLabel}`
      );
      render();
    } catch {
      setBlockingStatus(text(["mediaAnalysis", "settings", "helper", "copyFailure"]));
      render();
    }
  }
  function getDerivedProfileOutputId() {
    const targetSummary = getProfileTargetSummary();
    const activeOutput = getActiveEditOutput();
    if (typeof targetSummary.outputId === "string" && targetSummary.outputId.trim() !== "") {
      return targetSummary.outputId;
    }
    if (activeOutput && typeof activeOutput.id === "string" && activeOutput.id.trim() !== "") {
      return activeOutput.id;
    }
    return null;
  }
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
        state.ui.settingsHelperToolId = null;
        closeSettingsOverlay();
        return;
      case "tools-refresh":
        sendSourceAction("tools-refresh");
        return;
      case "tool-update-all":
        sendMediaAction("tool-update-all", { featureStage: state.activeStage });
        return;
      case "tool-helper-toggle": {
        const toolId = String(value || "").trim();
        if (toolId === "") {
          return;
        }
        state.ui.settingsHelperToolId = state.ui.settingsHelperToolId === toolId ? null : toolId;
        render();
        return;
      }
      case "tool-helper-platform": {
        const [toolId, platformValue] = String(value || "").split("::");
        state.ui.settingsHelperPlatform = normalizeHelperPlatform(platformValue);
        if (typeof toolId === "string" && toolId.trim() !== "") {
          state.ui.settingsHelperToolId = toolId.trim();
        }
        render();
        return;
      }
      case "tool-helper-copy-install": {
        const [toolId, platformValue, indexValue] = String(value || "").split("::");
        const normalizedToolId = typeof toolId === "string" ? toolId.trim() : "";
        const commandIndex = Number.parseInt(indexValue || "", 10);
        if (normalizedToolId === "") {
          return;
        }
        void copyInstallCommand(
          normalizedToolId,
          normalizeHelperPlatform(platformValue),
          Number.isFinite(commandIndex) ? commandIndex : 0
        );
        return;
      }
      case "toggle-event-log":
        toggleEventLog();
        render();
        return;
      case "workbench-activate-module":
        setActiveWorkbenchModule(String(value || ""));
        return;
      case "workbench-toggle-module":
        toggleWorkbenchModuleSelection(String(value || ""));
        return;
      case "project-create":
        state.ui.pendingDeleteProjectId = null;
        sendSourceAction("project-create");
        return;
      case "project-delete-arm": {
        const sourceSnapshot = getSourceSnapshot();
        const activeProjectId = sourceSnapshot["activeProjectId"];
        state.ui.pendingDeleteProjectId = typeof activeProjectId === "string" ? activeProjectId : null;
        render();
        return;
      }
      case "project-delete-confirm":
        sendSourceAction("project-delete", {
          projectId: state.ui.pendingDeleteProjectId
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
          fields: buildCurrentDraftPayload()
        });
        return;
      case "subtitle-source-pick-folder":
        sendSourceAction("subtitle-source-pick-folder", {
          fields: buildCurrentDraftPayload()
        });
        return;
      case "source-download-url":
        sendSourceAction("source-download-url", {
          fields: buildCurrentDraftPayload()
        });
        return;
      case "subtitle-source-download-url":
        sendSourceAction("subtitle-source-download-url", {
          fields: buildCurrentDraftPayload()
        });
        return;
      case "subtitle-source-discover-youtube":
        sendSourceAction("subtitle-source-discover-youtube", {
          fields: buildCurrentDraftPayload()
        });
        return;
      case "source-download-youtube":
        sendSourceAction("source-download-youtube", {
          fields: buildCurrentDraftPayload()
        });
        return;
      case "subtitle-source-download-youtube":
        sendSourceAction("subtitle-source-download-youtube", {
          fields: buildCurrentDraftPayload()
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
          featureStage: "edit"
        });
        return;
      case "subtitle-edit-preview":
        sendMediaAction("subtitle-edit-preview", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit"
        });
        return;
      case "subtitle-edit-apply":
        sendMediaAction("subtitle-edit-apply", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit"
        });
        return;
      case "edit-mode":
        sendMediaAction("edit-set-mode", {
          mode: value,
          featureStage: "edit"
        });
        return;
      case "edit-preset":
        sendMediaAction("edit-apply-preset", {
          presetId: value,
          featureStage: "edit"
        });
        return;
      case "edit-preview":
        sendMediaAction("edit-preview", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit"
        });
        return;
      case "edit-apply":
        sendMediaAction("edit-apply", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit"
        });
        return;
      case "edit-cancel-preview":
        sendMediaAction("edit-cancel-preview", {
          featureStage: "edit"
        });
        return;
      case "edit-cancel-apply":
        sendMediaAction("edit-cancel-apply", {
          featureStage: "edit"
        });
        return;
      case "edit-select-output":
        sendMediaAction("edit-set-output", {
          outputId: value,
          featureStage: "edit"
        });
        return;
      case "edit-handoff":
        sendMediaAction("edit-set-handoff", {
          mode: value,
          featureStage: "edit"
        });
        return;
      case "profile-mode":
        sendMediaAction("profile-set-mode", {
          mode: value,
          featureStage: "profile"
        });
        return;
      case "profile-preset":
        sendMediaAction("profile-apply-preset", {
          presetId: value,
          outputId: getDerivedProfileOutputId(),
          featureStage: "profile"
        });
        return;
      case "profile-target-mode":
        sendMediaAction("profile-set-target", {
          mode: value,
          outputId: value === "derived" ? getDerivedProfileOutputId() : null,
          featureStage: "profile"
        });
        return;
      case "profile-run":
        sendMediaAction("profile-run-preflight", {
          featureStage: "profile"
        });
        return;
      case "profile-cancel":
        sendMediaAction("profile-cancel-preflight", {
          featureStage: "profile"
        });
        return;
      case "profile-model-install":
        sendMediaAction("profile-model-install", {
          modelId: value,
          featureStage: "profile"
        });
        return;
      case "profile-model-remove":
        sendMediaAction("profile-model-remove", {
          modelId: value,
          featureStage: "profile"
        });
        return;
      case "tool-install":
        sendMediaAction("tool-install", { toolId: value, featureStage: state.activeStage });
        return;
      case "tool-update":
        sendMediaAction("tool-update", { toolId: value, featureStage: state.activeStage });
        return;
      case "tool-check-updates":
        sendMediaAction("tool-check-updates", {
          toolId: value,
          featureStage: state.activeStage
        });
        return;
      case "job-cancel":
        sendMediaAction("job-cancel", { jobId: value, featureStage: state.activeStage });
        return;
      case "restart-process":
        restartProcess();
        return;
      case "process-cancel":
        sendMediaAction(isAudioAnalysisFeature() ? "audio-process-cancel" : "process-cancel", {
          featureStage: "process"
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
          featureStage: "report"
        });
        return;
      default:
        break;
    }
  }
  return {
    handleAction
  };
}
