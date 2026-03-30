import { createLaboratorySnapshotAudioSelectors } from "./source-snapshot-audio-selectors.js";
import { createLaboratorySnapshotProjectSelectors } from "./source-snapshot-project-selectors.js";
import { createLaboratorySnapshotSubtitleSelectors } from "./source-snapshot-subtitle-selectors.js";
import { createLaboratorySnapshotToolSelectors } from "./source-snapshot-tool-selectors.js";

type LaboratorySourceSnapshotSelectorCompositionDeps = {
  getState: () => Record<string, unknown>;
  toRecord: (value: unknown) => Record<string, unknown>;
  getActiveFeatureId: () => string;
  subtitleText: (path: string[], trFallback?: string, enFallback?: string) => string;
  subtitleTemplate: (
    path: string[],
    replacements: Record<string, string>,
    trFallback: string,
    enFallback: string
  ) => string;
  formatStatusLabel: (status: string) => string;
};

export function createSourceSnapshotSelectors(
  deps: LaboratorySourceSnapshotSelectorCompositionDeps
) {
  const projectSelectors = createLaboratorySnapshotProjectSelectors({
    getState: deps.getState,
    toRecord: deps.toRecord,
    getActiveFeatureId: deps.getActiveFeatureId,
  });
  const subtitleSelectors = createLaboratorySnapshotSubtitleSelectors({
    toRecord: deps.toRecord,
    subtitleText: deps.subtitleText,
    subtitleTemplate: deps.subtitleTemplate,
    formatStatusLabel: deps.formatStatusLabel,
    getSourceSnapshot: projectSelectors.getSourceSnapshot,
    getProjectSubtitleAnalysis: projectSelectors.getProjectSubtitleAnalysis,
  });
  const audioSelectors = createLaboratorySnapshotAudioSelectors({
    toRecord: deps.toRecord,
    getSourceSnapshot: projectSelectors.getSourceSnapshot,
    getProjectAudioAnalysis: projectSelectors.getProjectAudioAnalysis,
  });
  const toolSelectors = createLaboratorySnapshotToolSelectors({
    toRecord: deps.toRecord,
    getSourceSnapshot: projectSelectors.getSourceSnapshot,
    getToolRegistry: projectSelectors.getToolRegistry,
    getEditCapabilities: projectSelectors.getEditCapabilities,
  });

  return {
    ...projectSelectors,
    ...subtitleSelectors,
    ...audioSelectors,
    ...toolSelectors,
  };
}

export type LaboratorySourceSnapshotSelectorsApi = ReturnType<typeof createSourceSnapshotSelectors>;
