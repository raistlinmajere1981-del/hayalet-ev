import { createSubtitleAnalysisSourcePanels } from "./source-panels.js";
import { createSubtitleAnalysisEditPanels } from "./edit-panels.js";
export function createSubtitleAnalysisUi(deps) {
  const sourcePanels = createSubtitleAnalysisSourcePanels(deps);
  const editPanels = createSubtitleAnalysisEditPanels(deps);
  return {
    ...sourcePanels,
    ...editPanels
  };
}
