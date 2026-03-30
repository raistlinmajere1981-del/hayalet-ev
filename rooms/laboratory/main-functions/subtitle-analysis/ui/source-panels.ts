import { createSubtitleAnalysisSourcePanelPrimitives } from "./source-panel-primitives.js";
import { createSubtitleAnalysisSourceProcessPanels } from "./source-panel-process.js";
import { createSubtitleAnalysisSourceIntakePanels } from "./source-panel-intake.js";
import { createSubtitleAnalysisSourceWorkspacePanels } from "./source-panel-workspace.js";

type SubtitleAnalysisSourcePanelsDeps = Parameters<
  typeof createSubtitleAnalysisSourcePanelPrimitives
>[0] &
  Parameters<typeof createSubtitleAnalysisSourceProcessPanels>[0] &
  Parameters<typeof createSubtitleAnalysisSourceIntakePanels>[0] &
  Parameters<typeof createSubtitleAnalysisSourceWorkspacePanels>[0];

type SubtitleAnalysisSourcePanelsRuntime = ReturnType<
  typeof createSubtitleAnalysisSourcePanelPrimitives
> &
  ReturnType<typeof createSubtitleAnalysisSourceProcessPanels> &
  ReturnType<typeof createSubtitleAnalysisSourceIntakePanels> &
  ReturnType<typeof createSubtitleAnalysisSourceWorkspacePanels>;

export function createSubtitleAnalysisSourcePanels(
  deps: SubtitleAnalysisSourcePanelsDeps
): SubtitleAnalysisSourcePanelsRuntime {
  const primitives = createSubtitleAnalysisSourcePanelPrimitives(deps);
  const processPanels = createSubtitleAnalysisSourceProcessPanels(deps);
  const intakePanels = createSubtitleAnalysisSourceIntakePanels(deps);
  const workspacePanels = createSubtitleAnalysisSourceWorkspacePanels(deps);

  return {
    ...primitives,
    ...processPanels,
    ...intakePanels,
    ...workspacePanels,
  };
}
