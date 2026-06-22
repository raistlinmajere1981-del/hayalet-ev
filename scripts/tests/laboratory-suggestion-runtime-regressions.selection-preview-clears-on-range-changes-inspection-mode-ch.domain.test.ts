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


describe("selection preview clears on range changes, inspection mode changes, and explicit", () => {
void test("selection preview clears on range changes, inspection mode changes, and explicit dismiss events", () => {
  const store = createLabStore();

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "audio",
      mode: "local",
      storedPath: "/tmp/source.wav",
    },
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });

  assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");
  assert.equal(store.getState().ui.activeExecutionIntentId, "audio-inspect");
  assert.equal(getActiveExecutionIntent(store.getState())?.id, "audio-inspect");

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1200,
    endMs: 3200,
  });
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(store.getState().ui.activeExecutionCommitment, null);
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);

  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");
  assert.equal(store.getState().ui.activeExecutionIntentId, "audio-inspect");

  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "visual",
  });
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);

  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-cleared",
  });
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(store.getState().ui.activeExecutionIntentId, "audio-inspect");
  assert.equal(getActiveExecutionIntent(store.getState())?.id, "audio-inspect");
});
void test("selection suggestion accept and queue cannot mutate source analysis while a run is active", () => {
  const store = createLabStore();

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      storedPath: "/tmp/source.mp4",
    },
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "motion",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "motion-check",
  });
  store.dispatch({ type: "run-started", action: "process-run" });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "motion-check",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-queued",
    suggestionId: "motion-check",
  });

  const state = store.getState();
  assert.deepEqual(state.selectedCapabilities, []);
  assert.equal(state.ui.activeExecutionIntentId, null);
});
void test("terminal analysis events clear source selections while preserving the run analysis scope", () => {
  const store = createLabStore();

  hydrateReadySource(store, {
    kind: "audio",
    path: "/tmp/source.wav",
    metadata: { durationSeconds: 4 },
  });
  store.dispatch({ type: "analysis-prep-group-toggled", capabilityId: "audio-signal" });
  store.dispatch({
    type: "workbench-updated",
    workbench: {
      ...store.getState().workbench,
      analysisScope: {
        focus: "audio",
        timeRange: {
          startMs: 500,
          endMs: 2500,
        },
        hypothesis: "voice clue",
      },
    },
  });

  let moduleToggles = store.getState().workbench["moduleToggles"] as Record<string, unknown>;
  assert.equal(moduleToggles["signal-health"], true);

  store.dispatch({ type: "run-started", action: "audio-process-run" });
  store.dispatch({
    type: "run-failed",
    action: "audio-process-run",
    detail: "Room API bridge is not connected.",
  });

  let state = store.getState();
  moduleToggles = state.workbench["moduleToggles"] as Record<string, unknown>;
  assert.deepEqual(state.selectedCapabilities, []);
  assert.equal(moduleToggles["signal-health"], false);

  store.dispatch({ type: "analysis-prep-group-toggled", capabilityId: "audio-signal" });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-scope",
      kind: "analysis-scope-updated",
      severity: "info",
      message: "Analysis scope locked",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "audio-process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
      analysisScope: {
        focus: "audio",
        timeRange: {
          startMs: 500,
          endMs: 2500,
        },
        hypothesis: "voice clue",
      },
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-completed",
      kind: "activity",
      severity: "success",
      message: "Analysis completed",
      detail: null,
      timestamp: Date.now() + 1,
      source: "host",
      action: "audio-process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  state = store.getState();
  moduleToggles = state.workbench["moduleToggles"] as Record<string, unknown>;
  assert.deepEqual(state.selectedCapabilities, []);
  assert.equal(moduleToggles["signal-health"], false);
});
void test("hydrate keeps selection previews and execution intents ephemeral", async () => {
  const store = createLabStore();
  const labRootModule = await importLabRootModuleWithDomStub<{
    __testOnlyLabRootPersistence: {
      readPersistableState: (state: ReturnType<typeof store.getState>) => Record<string, unknown>;
    };
  }>();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "audio",
      mode: "local",
      storedPath: "/tmp/source.wav",
    },
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");
  assert.equal(store.getState().ui.activeExecutionIntentId, "audio-inspect");
  assert.equal(getActiveExecutionPlan(store.getState())?.suggestionId, "audio-inspect");
  const activeHydrateCandidate = getActiveExecutionCandidate(store.getState());
  assert.ok(activeHydrateCandidate);
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: activeHydrateCandidate.planId,
  });
  assert.equal(
    getActiveExecutionCommitment(store.getState())?.planId,
    activeHydrateCandidate.planId
  );
  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(dispatchCandidate);
  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });
  store.dispatch({
    type: "workspace-execution-completed",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    result: createMockExecutionResult(dispatchCandidate),
  });
  assert.equal(store.getState().ui.executionRuntime.status, "completed");
  assert.equal(getActiveExecutionResult(store.getState()) !== null, true);
  assert.equal(getActiveExecutionGoalEvaluation(store.getState()) !== null, true);
  assert.equal(getActiveExecutionResultInterpretation(store.getState()) !== null, true);

  const persistedState = labRootModule.__testOnlyLabRootPersistence.readPersistableState(
    store.getState()
  );
  assert.equal("adaptiveDecisionHint" in persistedState, false);
  assert.equal("activeExecutionGoalEvaluation" in persistedState, false);
  assert.equal("activeExecutionIntentId" in persistedState, false);
  assert.equal("activeExecutionAlternatives" in persistedState, false);
  assert.equal("activeExecutionCandidate" in persistedState, false);
  assert.equal("activeExecutionCommitment" in persistedState, false);
  assert.equal("activeExecutionPlan" in persistedState, false);
  assert.equal("activeExecutionPayloadPreview" in persistedState, false);
  assert.equal("activeExecutionReadiness" in persistedState, false);
  assert.equal("activeExecutionReflection" in persistedState, false);
  assert.equal("activeExecutionSimulation" in persistedState, false);
  assert.equal("activeExecutionStaging" in persistedState, false);
  assert.equal("executionGoalEvaluation" in persistedState, false);
  assert.equal("executionPatternRegistry" in persistedState, false);
  assert.equal("executionPatternSignal" in persistedState, false);
  assert.equal("executionRuntime" in persistedState, false);
  assert.equal("patternSignal" in persistedState, false);
  assert.equal("decisionPressure" in persistedState, false);
  assert.equal("decisionPosture" in persistedState, false);
  assert.equal("decisionPostureSignal" in persistedState, false);
  assert.equal("posture" in persistedState, false);
  assert.equal("shortLabel" in persistedState, false);
  assert.equal("counterfactualProjection" in persistedState, false);
  assert.equal("expectedCoverage" in persistedState, false);
  assert.equal("expectedAlignment" in persistedState, false);
  assert.equal("expectedStability" in persistedState, false);
  assert.equal("preferredAlternative" in persistedState, false);
  assert.equal("preferredAlternativeIndex" in persistedState, false);
  assert.equal("preferredAlternativeLabel" in persistedState, false);
  assert.equal(
    "adaptiveDecisionHint" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionGoalEvaluation" in
      ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionIntentId" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionAlternatives" in
      ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionCandidate" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionCommitment" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionReadiness" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionPlan" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionPayloadPreview" in
      ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionReflection" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionSimulation" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "activeExecutionStaging" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "executionGoalEvaluation" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "executionPatternRegistry" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "executionPatternSignal" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "executionRuntime" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "patternSignal" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "decisionPressure" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "decisionPosture" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "decisionPostureSignal" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "posture" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "shortLabel" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "counterfactualProjection" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "expectedCoverage" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "expectedAlignment" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "expectedStability" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "preferredAlternative" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "preferredAlternativeIndex" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  assert.equal(
    "preferredAlternativeLabel" in ((persistedState["workspace"] as Record<string, unknown>) ),
    false
  );
  const persistedKeys = collectPersistedKeys(persistedState);
  for (const key of ["decisionPosture", "decisionPostureSignal", "posture", "shortLabel"]) {
    assert.equal(persistedKeys.includes(key), false);
  }
  assert.doesNotMatch(
    JSON.stringify(persistedState),
    /\b(Proceed with caution|Proceed|Reconsider)\b/
  );

  __testOnlyResetExecutionPatternRegistry();

  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      source: {
        kind: "audio",
        mode: "local",
        storedPath: "/tmp/source.wav",
      },
      sourceProbeStatus: "completed",
      workspace: {
        ...baseWorkspace,
        timelineStartMs: 1000,
        timelineEndMs: 3000,
      },
      reports: {
        user: null,
        ai: null,
        emptyReason: null,
      },
      activityFeed: [],
      lastRun: null,
    },
  });

  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveSuggestionPreview(store.getState()), null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);
  assert.equal(getActiveExecutionPlan(store.getState()), null);
  assert.equal(getActiveExecutionAlternatives(store.getState()), null);
  assert.equal(getActiveExecutionCandidate(store.getState()), null);
  assert.equal(getActiveExecutionCommitment(store.getState()), null);
  assert.equal(getActiveExecutionPayloadPreview(store.getState()), null);
  assert.equal(getActiveExecutionReadiness(store.getState()), null);
  assert.equal(getActiveExecutionReflection(store.getState()), null);
  assert.equal(getActiveExecutionStaging(store.getState()), null);
  assert.equal(store.getState().ui.executionRuntime.status, "idle");
  assert.equal(getActiveExecutionGoalEvaluation(store.getState()), null);
  assert.equal(getActiveExecutionResult(store.getState()), null);
  assert.equal(getActiveExecutionResultInterpretation(store.getState()), null);

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  const freshCandidate = getActiveExecutionCandidate(store.getState());
  assert.ok(freshCandidate);
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: freshCandidate.planId,
  });
  const freshDispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(freshDispatchCandidate);
  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: freshDispatchCandidate.planId,
    dispatchId: freshDispatchCandidate.dispatchId,
  });
  store.dispatch({
    type: "workspace-execution-completed",
    planId: freshDispatchCandidate.planId,
    dispatchId: freshDispatchCandidate.dispatchId,
    result: createMockExecutionResult(freshDispatchCandidate),
  });
  assert.equal(getActiveExecutionGoalEvaluation(store.getState())?.patternSignal, undefined);
});
});
