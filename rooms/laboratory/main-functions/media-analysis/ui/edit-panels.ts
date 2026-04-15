import { createMediaAnalysisEditFieldControls } from "./edit-field-controls.js";
import { createMediaAnalysisEditModePanels } from "./edit-mode-panels.js";
import { createMediaAnalysisEditOutputPanels } from "./edit-output-panels.js";
import { createMediaAnalysisEditWorkspacePanels } from "./edit-workspace-panels.js";

type MediaAnalysisEditPanelsDeps = Parameters<typeof createMediaAnalysisEditFieldControls>[0] &
  Omit<Parameters<typeof createMediaAnalysisEditWorkspacePanels>[0], "renderEditTextField"> &
  Omit<
    Parameters<typeof createMediaAnalysisEditModePanels>[0],
    "renderEditRangeField" | "renderEditSelectField" | "renderEditTextField" | "renderEditToggle"
  > &
  Parameters<typeof createMediaAnalysisEditOutputPanels>[0];

export function createMediaAnalysisEditPanels(deps: MediaAnalysisEditPanelsDeps) {
  const mediaAnalysisEditFieldControls = createMediaAnalysisEditFieldControls(deps);
  const { renderEditRangeField, renderEditSelectField, renderEditTextField, renderEditToggle } =
    mediaAnalysisEditFieldControls;

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
    renderEditAdvancedPanel,
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
    renderEditProgressPanel,
    renderEditSummaryPanel,
  } = mediaAnalysisEditOutputPanels;

  return {
    renderEditActionsPanel,
    renderEditAdvancedPanel,
    renderEditAudioPanel,
    renderEditCommonPanel,
    renderEditControlsPanel,
    renderEditMediaMarkup,
    renderEditModePanel,
    renderEditOutputsPanel,
    renderEditPresetChooser,
    renderEditProgressPanel,
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
