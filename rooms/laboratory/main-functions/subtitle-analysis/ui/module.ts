import { createSubtitleAnalysisSourcePanels } from "./source-panels.js";
import { createSubtitleAnalysisEditPanels } from "./edit-panels.js";

type SubtitleAnalysisUiDeps =
  & Parameters<typeof createSubtitleAnalysisSourcePanels>[0]
  & Parameters<typeof createSubtitleAnalysisEditPanels>[0];

type SubtitleAnalysisUiRuntime =
  & ReturnType<typeof createSubtitleAnalysisSourcePanels>
  & ReturnType<typeof createSubtitleAnalysisEditPanels>;

export function createSubtitleAnalysisUi(
  deps: SubtitleAnalysisUiDeps,
): SubtitleAnalysisUiRuntime {
  const sourcePanels = createSubtitleAnalysisSourcePanels(deps);
  const editPanels = createSubtitleAnalysisEditPanels(deps);

  return {
    ...sourcePanels,
    ...editPanels,
  };
}
