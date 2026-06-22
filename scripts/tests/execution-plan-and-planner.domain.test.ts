import {
  __testOnlyBuildExecutionPatternKey,
  __testOnlyResetExecutionPatternRegistry,
  assert,
  buildAdaptiveDecisionSignal,
  buildCounterfactualProjection,
  buildDecisionPosture,
  buildDecisionCoherence,
  __testOnlyResolveLabI18nFromDictionaries,
  buildExecutionAlternatives,
  buildExecutionAlternativesFromResolved,
  buildExecutionBridge,
  buildExecutionCandidateFromResolved,
  buildExecutionDescriptor,
  buildExecutionReadinessSignal,
  buildGuidedAlternativeSignal,
  buildExecutionPayloadPreview,
  buildExecutionPayloadPreviewFromResolved,
  buildExecutionPlan,
  buildExecutionReadiness,
  buildExecutionReflection,
  buildExecutionReflectionFromResolved,
  buildExecutionResultInterpretation,
  buildExecutionSimulation,
  buildExecutionStagingFromResolved,
  createLabExecutionDispatcher,
  createMockExecutionResult,
  createLabStore,
  createTestAudioFocusSettings,
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
  getActiveExecutionSimulation,
  getActiveExecutionStaging,
  getActiveExecutionResultInterpretation,
  getActiveSuggestionPreviewId,
  getExecutionDispatchCandidate,
  getExecutionGoalEvaluation,
  getLaboratoryProcessSummary,
  getLaboratoryRightPanelContext,
  formatExecutionBridgeAdvisory,
  formatDecisionCoherenceAdvisory,
  formatDecisionPostureLabel,
  formatExecutionDescriptorAdvisory,
  formatExecutionReadinessSignalAdvisory,
  installTimerMock,
  prependDecisionPostureLabel,
  reorderDecisionSummary,
  resolveLabI18n,
  test,
} from "./laboratory-runtime-truth.helpers.ts";

import type {
  LabActionSuggestion,
  LabAudioFocusSettings,
  LabExecutionCommitment,
  LabExecutionDispatchCandidate,
  LabExecutionPayloadPreview,
  LabExecutionResult,
  LabSelection,
} from "./laboratory-runtime-truth.helpers.ts";

describe("execution plan and planner", () => {
  void test("execution plan is derived only from accepted intents and survives preview clear", () => {
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

    assert.equal(getActiveExecutionPlan(store.getState()), null);

    store.dispatch({
      type: "workspace-selection-suggestion-queued",
      suggestionId: "audio-inspect",
    });
    assert.equal(getActiveExecutionPlan(store.getState()), null);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-accepted",
      suggestionId: "audio-inspect",
    });

    assert.equal(getActiveExecutionPlan(store.getState())?.suggestionId, "audio-inspect");
    assert.equal(getActiveExecutionPlan(store.getState())?.title, "Audio inspection plan");

    store.dispatch({
      type: "workspace-selection-suggestion-preview-cleared",
    });
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
    assert.equal(getActiveExecutionPlan(store.getState())?.suggestionId, "audio-inspect");

    store.dispatch({
      type: "workspace-selection-suggestion-dismissed",
      suggestionId: "audio-inspect",
    });
    assert.equal(getActiveExecutionPlan(store.getState()), null);
  });

  void test("execution plan lifecycle ignores passive inspection changes and clears on structural changes", () => {
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

    assert.equal(getActiveExecutionPlan(store.getState())?.suggestionId, "audio-inspect");

    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "audio",
    });
    assert.equal(store.getState().ui.activeExecutionIntentId, "audio-inspect");
    assert.equal(getActiveExecutionPlan(store.getState())?.suggestionId, "audio-inspect");

    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-accepted",
      suggestionId: "audio-inspect",
    });
    assert.equal(getActiveExecutionPlan(store.getState())?.suggestionId, "audio-inspect");

    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        x: 0.2,
        y: 0.2,
        width: 0.3,
        height: 0.3,
      },
    });
    assert.equal(store.getState().ui.activeExecutionIntentId, null);
    assert.equal(getActiveExecutionPlan(store.getState()), null);
  });

  void test("execution planner is deterministic and resolves ROI tool-hint intents", () => {
    const baseSelection: LabSelection = {
      id: "selection-1",
      startMs: 1200,
      endMs: 4800,
      type: "inspect",
      roi: {
        x: 0.18,
        y: 0.22,
        width: 0.24,
        height: 0.28,
      },
      createdAt: 1,
    };

    const inspectRegionPlan = buildExecutionPlan({
      suggestion: {
        id: "inspect-region",
        label: "Secili bolgeyi incele",
        toolHint: "Focus region",
        actionType: "focus-region",
        confidence: 0.82,
      },
      activeSelection: baseSelection,
      inspectionMode: "motion",
      sourceKind: "video",
    });
    const inspectRegionPlanRepeat = buildExecutionPlan({
      suggestion: {
        id: "inspect-region",
        label: "Secili bolgeyi incele",
        toolHint: "Focus region",
        actionType: "focus-region",
        confidence: 0.82,
      },
      activeSelection: baseSelection,
      inspectionMode: "motion",
      sourceKind: "video",
    });

    assert.deepEqual(inspectRegionPlan, inspectRegionPlanRepeat);
    assert.equal(
      inspectRegionPlan.id,
      "plan:inspect-region:focus-region:video:motion:inspect:1200:4800:180-220-240-280"
    );
    assert.equal(inspectRegionPlan.suggestionId, "inspect-region");
    assert.match(inspectRegionPlan.title, /Region focus plan/);

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
      startMs: 1200,
      endMs: 4800,
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "motion",
    });
    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        x: 0.18,
        y: 0.22,
        width: 0.24,
        height: 0.28,
      },
    });
    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "inspect-region",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-accepted",
      suggestionId: "inspect-region",
    });

    assert.equal(getActiveExecutionPlan(store.getState())?.suggestionId, "inspect-region");
    assert.match(getActiveExecutionPlan(store.getState())?.title ?? "", /Region focus plan/);
  });

  void test("execution planner falls back safely for unknown action types", () => {
    const plan = buildExecutionPlan({
      suggestion: {
        id: "custom-unknown",
        label: "Unknown",
        actionType: "unknown-action" as unknown as LabActionSuggestion["actionType"],
        confidence: 0.41,
      },
      activeSelection: {
        id: "selection-x",
        startMs: 400,
        endMs: 1200,
        type: "clip",
        createdAt: 1,
      },
      inspectionMode: "none",
      sourceKind: "audio",
    });

    assert.equal(plan.title, "Generic execution plan");
    assert.equal(plan.expectedOutputs[0], "Review notes");
    assert.equal(plan.steps.length, 3);
  });
});
