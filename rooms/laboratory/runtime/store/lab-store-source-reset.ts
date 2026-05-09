import { asLabRecord } from "../../models/lab-types.js";
import type { LabStoreState } from "../../models/lab-types.js";
import { clearExecutionIntent, clearSuggestionPreview } from "./lab-store-execution-state.js";
import { createDefaultWorkspaceUiState } from "./lab-store-defaults.js";
import { clearInspectionDepth, resetInspectionMode } from "./lab-store-workspace-state.js";

type WorkspaceSourceResetOptions = {
  activeWorkspaceAssetId?: string | null;
  sourceIntakeCollapsed?: boolean | undefined;
};

export function resetWorkspaceForSourceActivation(
  state: LabStoreState,
  options: WorkspaceSourceResetOptions = {}
) {
  const defaultWorkspace = createDefaultWorkspaceUiState();
  clearExecutionIntent(state);
  clearSuggestionPreview(state);
  resetInspectionMode(state);
  clearInspectionDepth(state);

  state.selectedCapabilities = [];
  state.ui.activeWorkspaceAssetId = options.activeWorkspaceAssetId ?? null;
  state.ui.activePreviewArtifactId = null;
  state.ui.liveFindingsExpanded = false;
  state.ui.analysisControlsCollapsed = true;
  state.ui.analysisCancelPending = false;
  state.ui.workspace = {
    ...defaultWorkspace,
    bookmarks: state.ui.workspace.bookmarks,
    sourceIntakeCollapsed:
      typeof options.sourceIntakeCollapsed === "boolean"
        ? options.sourceIntakeCollapsed
        : defaultWorkspace.sourceIntakeCollapsed,
  };

  state.workbench = {
    ...asLabRecord(state.workbench),
    activeLiveFindingsStreamId: null,
    activePreviewArtifactId: null,
    analysisScope: null,
    analysisSettings: {},
    controlsCollapsed: true,
    moduleToggles: {},
    operationSettings: {},
  };
}
