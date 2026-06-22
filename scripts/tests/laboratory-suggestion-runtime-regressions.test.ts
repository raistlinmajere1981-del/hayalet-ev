import {
  __testOnlyResetExecutionPatternRegistry,
  assert,
  buildSuggestionPreview,
  createMockExecutionResult,
  createLabStore,
  getActiveExecutionAlternatives,
  getActiveExecutionCandidate,
  getActiveExecutionCommitment,
  getActiveExecutionGoalEvaluation,
  getActiveExecutionIntent,
  getActiveExecutionResult,
  getActiveExecutionPayloadPreview,
  getActiveExecutionPlan,
  getActiveExecutionReadiness,
  getActiveExecutionReflection,
  getActiveExecutionResultInterpretation,
  getActiveExecutionStaging,
  getActiveSuggestionPreview,
  getExecutionDispatchCandidate,
  getEffectiveActiveSelection,
  getSelectionSuggestions,
  getWaveformTimelineModel,
  renderWorkspaceSurface,
  importLabRootModuleWithDomStub,
  test,
} from "./laboratory-runtime-truth.helpers.ts";

import type { LabActionSuggestion, LabSelection } from "./laboratory-runtime-truth.helpers.ts";

function collectPersistedKeys(value: unknown, keys: string[] = []) {
  if (value === null || typeof value !== "object") {
    return keys;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPersistedKeys(item, keys);
    }
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    collectPersistedKeys(child, keys);
  }
  return keys;
}

function hydrateReadySource(
  store: ReturnType<typeof createLabStore>,
  source: {
    kind: "audio" | "video" | "image";
    metadata?: Record<string, unknown>;
    path: string;
  }
) {
  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: `project-default-${source.kind}`,
        projects: [],
      },
      workbench: {},
      source: {
        status: "ready",
        kind: source.kind,
        mode: "local",
        routeLabel: "Local Copy",
        storedPath: source.path,
        metadata: source.metadata ?? {},
      },
      sourceProbeStatus: "completed",
      workspace: {},
      reports: {
        user: null,
        ai: null,
        emptyReason: null,
      },
      activityFeed: [],
      lastRun: null,
    },
  });
}
