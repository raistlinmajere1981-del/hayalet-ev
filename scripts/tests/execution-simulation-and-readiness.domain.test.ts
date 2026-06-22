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

describe("execution simulation and readiness", () => {
  void test("execution simulation is derived only from active plans and survives preview clear", () => {
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

    assert.equal(getActiveExecutionSimulation(store.getState()), null);

    store.dispatch({
      type: "workspace-selection-suggestion-queued",
      suggestionId: "audio-inspect",
    });
    assert.equal(getActiveExecutionSimulation(store.getState()), null);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-accepted",
      suggestionId: "audio-inspect",
    });

    const activePlan = getActiveExecutionPlan(store.getState());
    const activeSimulation = getActiveExecutionSimulation(store.getState());
    assert.equal(activePlan?.suggestionId, "audio-inspect");
    assert.equal(activeSimulation?.planId, activePlan.id);
    assert.equal(activeSimulation.id, `simulation:${activePlan.id}`);
    assert.equal(activeSimulation.predictedEffects.length > 0, true);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-cleared",
    });
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
    assert.equal(getActiveExecutionSimulation(store.getState())?.planId, activePlan.id);

    store.dispatch({
      type: "workspace-selection-suggestion-dismissed",
      suggestionId: "audio-inspect",
    });
    assert.equal(getActiveExecutionSimulation(store.getState()), null);
  });

  void test("execution simulation is deterministic and stays stable across audio-focus-only updates", () => {
    const selection: LabSelection = {
      id: "selection-audio-sim",
      startMs: 1000,
      endMs: 3000,
      type: "clip",
      createdAt: 1,
    };
    const plan = buildExecutionPlan({
      suggestion: {
        id: "audio-inspect",
        label: "Ses detaylarini incele",
        actionType: "inspect-audio",
        confidence: 0.9,
      },
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    });
    const baselineFocus = createTestAudioFocusSettings({
      gain: 1,
      playbackRate: 1,
    });
    const boostedFocus = createTestAudioFocusSettings({
      gain: 2.2,
      playbackRate: 0.4,
      preservePitch: false,
      filterType: "lowpass",
      filterFrequency: 320,
    });

    const simulationA = buildExecutionSimulation({
      executionPlan: plan,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
      audioFocus: baselineFocus,
    });
    const simulationARepeat = buildExecutionSimulation({
      executionPlan: plan,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
      audioFocus: baselineFocus,
    });
    const simulationB = buildExecutionSimulation({
      executionPlan: plan,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
      audioFocus: boostedFocus,
    });

    assert.deepEqual(simulationA, simulationARepeat);
    assert.equal(simulationA.id, `simulation:${plan.id}`);
    assert.equal(simulationB.id, simulationA.id);
    assert.notDeepEqual(simulationB, simulationA);
    assert.equal(
      simulationB.warnings?.some(function (warning) {
        return warning.includes("High preview gain");
      }),
      true
    );

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

    const initialSimulation = getActiveExecutionSimulation(store.getState());
    store.dispatch({
      type: "workspace-audio-updated",
      patch: {
        gain: 2.2,
        playbackRate: 0.4,
        preservePitch: false,
        filterType: "lowpass",
        filterFrequency: 320,
      },
    });
    const updatedSimulation = getActiveExecutionSimulation(store.getState());

    assert.equal(updatedSimulation?.id, initialSimulation?.id);
    assert.notDeepEqual(updatedSimulation, initialSimulation);
    assert.equal(
      updatedSimulation?.warnings?.some(function (warning) {
        return warning.includes("High preview gain");
      }),
      true
    );
  });

  void test("execution readiness is deterministic across ready, needs-review, and blocked states", () => {
    const readySelection: LabSelection = {
      id: "selection-ready",
      startMs: 1000,
      endMs: 3200,
      type: "clip",
      createdAt: 1,
    };
    const readyPlan = buildExecutionPlan({
      suggestion: {
        id: "extract-clip",
        label: "Clip",
        actionType: "extract-clip",
        confidence: 0.78,
      },
      activeSelection: readySelection,
      inspectionMode: "none",
      sourceKind: "video",
    });
    const readySimulation = buildExecutionSimulation({
      executionPlan: readyPlan,
      activeSelection: readySelection,
      inspectionMode: "none",
      sourceKind: "video",
      audioFocus: createTestAudioFocusSettings(),
    });
    const readyReadiness = buildExecutionReadiness({
      executionPlan: readyPlan,
      executionSimulation: readySimulation,
      activeSelection: readySelection,
      inspectionMode: "none",
      sourceKind: "video",
      audioFocus: createTestAudioFocusSettings(),
    });
    const readyReadinessRepeat = buildExecutionReadiness({
      executionPlan: readyPlan,
      executionSimulation: readySimulation,
      activeSelection: readySelection,
      inspectionMode: "none",
      sourceKind: "video",
      audioFocus: createTestAudioFocusSettings(),
    });

    assert.deepEqual(readyReadiness, readyReadinessRepeat);
    assert.equal(readyReadiness.id, `readiness:${readyPlan.id}`);
    assert.equal(readyReadiness.status, "ready");

    const reviewSelection: LabSelection = {
      id: "selection-review",
      startMs: 100,
      endMs: 450,
      type: "clip",
      createdAt: 1,
    };
    const reviewPlan = buildExecutionPlan({
      suggestion: {
        id: "analyze-anomaly",
        label: "Analyze",
        actionType: "analyze-segment",
        confidence: 0.72,
      },
      activeSelection: reviewSelection,
      inspectionMode: "none",
      sourceKind: "video",
    });
    const reviewSimulation = buildExecutionSimulation({
      executionPlan: reviewPlan,
      activeSelection: reviewSelection,
      inspectionMode: "none",
      sourceKind: "video",
      audioFocus: createTestAudioFocusSettings(),
    });
    const reviewReadiness = buildExecutionReadiness({
      executionPlan: reviewPlan,
      executionSimulation: reviewSimulation,
      activeSelection: reviewSelection,
      inspectionMode: "none",
      sourceKind: "video",
      audioFocus: createTestAudioFocusSettings(),
    });
    assert.equal(reviewReadiness.status, "needs-review");
    assert.equal((reviewReadiness.notes?.length ?? 0) > 0, true);

    const blockedSelection: LabSelection = {
      id: "selection-blocked",
      startMs: 1200,
      endMs: 4800,
      type: "inspect",
      roi: {
        x: 0.3,
        y: 0.25,
        width: 0.05,
        height: 0.08,
      },
      createdAt: 1,
    };
    const blockedPlan = buildExecutionPlan({
      suggestion: {
        id: "inspect-region",
        label: "Region",
        actionType: "focus-region",
        confidence: 0.8,
      },
      activeSelection: blockedSelection,
      inspectionMode: "visual",
      sourceKind: "video",
    });
    const blockedSimulation = buildExecutionSimulation({
      executionPlan: blockedPlan,
      activeSelection: blockedSelection,
      inspectionMode: "visual",
      sourceKind: "video",
      audioFocus: createTestAudioFocusSettings(),
    });
    const blockedReadiness = buildExecutionReadiness({
      executionPlan: blockedPlan,
      executionSimulation: blockedSimulation,
      activeSelection: blockedSelection,
      inspectionMode: "visual",
      sourceKind: "video",
      audioFocus: createTestAudioFocusSettings(),
    });

    assert.equal(blockedReadiness.status, "blocked");
    assert.equal((blockedReadiness.blockers?.length ?? 0) > 0, true);
  });

  void test("execution readiness is derived only from active plan and simulation", () => {
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

    assert.equal(getActiveExecutionReadiness(store.getState()), null);

    store.dispatch({
      type: "workspace-selection-suggestion-queued",
      suggestionId: "audio-inspect",
    });
    assert.equal(getActiveExecutionReadiness(store.getState()), null);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-accepted",
      suggestionId: "audio-inspect",
    });
    const activePlan = getActiveExecutionPlan(store.getState());
    const activeReadiness = getActiveExecutionReadiness(store.getState());
    assert.equal(activeReadiness?.planId, activePlan?.id);
    assert.equal(activeReadiness?.id, `readiness:${activePlan?.id ?? ""}`);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-cleared",
    });
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
    assert.equal(getActiveExecutionReadiness(store.getState())?.planId, activePlan?.id);

    store.dispatch({
      type: "workspace-selection-suggestion-dismissed",
      suggestionId: "audio-inspect",
    });
    assert.equal(getActiveExecutionReadiness(store.getState()), null);
  });

  void test("execution readiness follows upstream invalidation instead of persisting independently", () => {
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

    assert.equal(getActiveExecutionReadiness(store.getState())?.status === "ready", true);

    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "motion",
    });
    assert.equal(store.getState().ui.activeExecutionIntentId, "inspect-region");
    assert.notEqual(getActiveExecutionReadiness(store.getState()), null);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "inspect-region",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-accepted",
      suggestionId: "inspect-region",
    });
    assert.notEqual(getActiveExecutionReadiness(store.getState()), null);

    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1400,
      endMs: 4900,
    });
    assert.equal(getActiveExecutionReadiness(store.getState()), null);
  });
});
