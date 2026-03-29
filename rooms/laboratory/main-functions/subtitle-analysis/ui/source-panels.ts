// @ts-nocheck
import { createSubtitleAnalysisSourcePanelPrimitives } from "./source-panel-primitives.js";
import { createSubtitleAnalysisSourceProcessPanels } from "./source-panel-process.js";
import { createSubtitleAnalysisSourceIntakePanels } from "./source-panel-intake.js";
import { createSubtitleAnalysisSourceWorkspacePanels } from "./source-panel-workspace.js";

export function createSubtitleAnalysisSourcePanels(deps) {
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
