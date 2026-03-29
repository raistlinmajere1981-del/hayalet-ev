import { createMediaAnalysisEditFieldControls } from "./edit-field-controls.js";
import { createMediaAnalysisEditModePanels } from "./edit-mode-panels.js";
import { createMediaAnalysisEditOutputPanels } from "./edit-output-panels.js";
import { createMediaAnalysisEditWorkspacePanels } from "./edit-workspace-panels.js";

export function createMediaAnalysisEditPanels(deps) {
  const mediaAnalysisEditFieldControls = createMediaAnalysisEditFieldControls(deps);
  const {
    renderEditRangeField,
    renderEditSelectField,
    renderEditTextField,
    renderEditToggle,
  } = mediaAnalysisEditFieldControls;

  const mediaAnalysisEditWorkspacePanels = createMediaAnalysisEditWorkspacePanels({
    ...deps,
    renderEditTextField,
  });
  const {
    renderEditCommonPanel,
    renderEditMediaMarkup,
    renderEditPresetChooser,
    renderEditWorkspacePanel,
  } = mediaAnalysisEditWorkspacePanels;

  const mediaAnalysisEditModePanels = createMediaAnalysisEditModePanels({
    ...deps,
    renderEditToggle,
    renderEditTextField,
    renderEditSelectField,
    renderEditRangeField,
  });
  const {
    renderEditAudioPanel,
    renderEditControlsPanel,
    renderEditModePanel,
    renderEditVideoPanel,
    renderImageEditPanel,
  } = mediaAnalysisEditModePanels;

  const mediaAnalysisEditOutputPanels = createMediaAnalysisEditOutputPanels(deps);
  const {
    renderEditActionsPanel,
    renderEditOutputsPanel,
    renderEditSummaryPanel,
  } = mediaAnalysisEditOutputPanels;

  return {
    renderEditActionsPanel,
    renderEditAudioPanel,
    renderEditCommonPanel,
    renderEditControlsPanel,
    renderEditMediaMarkup,
    renderEditModePanel,
    renderEditOutputsPanel,
    renderEditPresetChooser,
    renderEditRangeField,
    renderEditSelectField,
    renderEditSummaryPanel,
    renderEditTextField,
    renderEditToggle,
    renderEditVideoPanel,
    renderEditWorkspacePanel,
    renderImageEditPanel,
  };
}
