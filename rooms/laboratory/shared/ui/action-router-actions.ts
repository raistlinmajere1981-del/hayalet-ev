import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratorySourceSnapshotRecord = LaboratoryRecord & {
  activeProjectId?: unknown;
};

type LaboratoryProfileTargetSummaryRecord = LaboratoryRecord & {
  outputId?: unknown;
};

type LaboratoryOutputRecord = LaboratoryRecord & {
  id?: unknown;
};

type LaboratoryToolDescriptorRecord = LaboratoryRecord & {
  displayName?: unknown;
  manualGuide?: unknown;
  toolId?: unknown;
};

type LaboratoryManualGuidePlatformRecord = LaboratoryRecord & {
  installCommands?: unknown;
};

type LaboratoryManualGuidePlatform = "linux" | "macos" | "windows";

type LaboratoryUiActionPayload = LaboratoryRecord & {
  featureStage?: string;
};

type LaboratoryUiActionHandlersDeps = {
  advanceStage: (delta: number) => void;
  buildCurrentDraftPayload: () => LaboratoryRecord;
  buildCurrentEditRecipePatch: () => LaboratoryRecord;
  closeSettingsOverlay: () => void;
  getActiveEditOutput: () => LaboratoryOutputRecord | null;
  getProfileTargetSummary: () => LaboratoryProfileTargetSummaryRecord;
  getSourceSnapshot: () => LaboratorySourceSnapshotRecord;
  getToolRegistry: () => LaboratoryToolDescriptorRecord[];
  isAudioAnalysisFeature: () => boolean;
  openReport: () => void;
  openSettingsOverlay: () => void;
  persistDrafts: (extraFields: unknown) => void;
  render: () => void;
  resetJourney: () => void;
  restartProcess: () => void;
  setActiveWorkbenchModule: (featureId: string) => void;
  sendMediaAction: (action: string, payload?: LaboratoryUiActionPayload | null) => string | null;
  sendSourceAction: (action: string, payload?: LaboratoryUiActionPayload | null) => string | null;
  state: LaboratoryUiState;
  syncDraftField: (path: string, value: unknown) => void;
  text: (path: string[]) => string;
  toggleWorkbenchModuleSelection: (featureId: string) => void;
};

export function createLaboratoryUiActionHandlers(deps: LaboratoryUiActionHandlersDeps) {
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
    sendMediaAction,
    sendSourceAction,
    state,
    syncDraftField,
    text,
    toggleWorkbenchModuleSelection,
  } = deps;

  function toRecord(value: unknown): LaboratoryRecord {
    return value !== null && typeof value === "object" && Array.isArray(value) === false
      ? (value as LaboratoryRecord)
      : {};
  }

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return toString(entry).trim();
      })
      .filter(function (entry) {
        return entry !== "";
      });
  }

  function normalizeHelperPlatform(value: unknown): LaboratoryManualGuidePlatform {
    if (value === "macos" || value === "windows") {
      return value;
    }
    return "linux";
  }

  function getToolDescriptor(toolId: string): LaboratoryToolDescriptorRecord | null {
    return (
      getToolRegistry().find(function (entry) {
        return toString(entry.toolId).trim() === toolId;
      }) || null
    );
  }

  function getManualGuidePlatformRecord(
    descriptor: LaboratoryToolDescriptorRecord | null,
    platform: LaboratoryManualGuidePlatform
  ): LaboratoryManualGuidePlatformRecord {
    const manualGuide = toRecord(descriptor?.manualGuide);
    return toRecord(manualGuide[platform]);
  }

  function getInstallCommand(
    toolId: string,
    platform: LaboratoryManualGuidePlatform,
    index: number
  ): string | null {
    const descriptor = getToolDescriptor(toolId);
    const commands = toStringArray(
      getManualGuidePlatformRecord(descriptor, platform).installCommands
    );
    return commands[index] || null;
  }

  async function copyInstallCommand(
    toolId: string,
    platform: LaboratoryManualGuidePlatform,
    index: number
  ) {
    const command = getInstallCommand(toolId, platform, index);
    const toolLabel =
      text(["mediaAnalysis", "settings", "tools", toolId]) ||
      toString(getToolDescriptor(toolId)?.displayName) ||
      toolId;

    if (command === null) {
      state.ui.lastActionMessage = text(["mediaAnalysis", "settings", "helper", "copyFailure"]);
      render();
      return;
    }

    try {
      const navigatorRef = globalThis.navigator as Navigator | undefined;
      const clipboard = navigatorRef?.clipboard;
      if (typeof clipboard?.writeText !== "function") {
        throw new Error("Clipboard API is unavailable");
      }
      await clipboard.writeText(command);
      state.ui.lastActionMessage = `${text(["mediaAnalysis", "settings", "helper", "copySuccess"])} ${toolLabel}`;
      render();
    } catch {
      state.ui.lastActionMessage = text(["mediaAnalysis", "settings", "helper", "copyFailure"]);
      render();
    }
  }

  function getDerivedProfileOutputId(): string | null {
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

  function handleAction(action: string, value: unknown) {
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
        state.ui.pendingDeleteProjectId =
          typeof activeProjectId === "string" ? activeProjectId : null;
        render();
        return;
      }
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
          outputId: getDerivedProfileOutputId(),
          featureStage: "profile",
        });
        return;
      case "profile-target-mode":
        sendMediaAction("profile-set-target", {
          mode: value,
          outputId: value === "derived" ? getDerivedProfileOutputId() : null,
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
      case "job-cancel":
        sendMediaAction("job-cancel", { jobId: value, featureStage: state.activeStage });
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
