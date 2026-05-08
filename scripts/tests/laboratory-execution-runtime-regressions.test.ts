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
  createDualPreviewSnapshot,
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

test("laboratory process summary derives a single deterministic state", () => {
  const store = createLabStore();

  assert.equal(getLaboratoryProcessSummary(store.getState()).state, "idle");

  store.dispatch({
    type: "source-probe-started",
    action: "probe",
  });
  const processingSummary = getLaboratoryProcessSummary(store.getState());
  assert.equal(processingSummary.state, "processing");
  assert.equal(processingSummary.activeTaskKey, "sourcePreparation");
  assert.equal(processingSummary.progressKey, "oneActiveTask");

  store.dispatch({
    type: "source-probe-completed",
    action: "probe",
  });
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  const activeCandidate = getActiveExecutionCandidate(store.getState());
  assert.ok(activeCandidate);
  const activeAlternatives = getActiveExecutionAlternatives(store.getState());
  assert.ok(activeAlternatives);
  assert.match(activeCandidate.summary, /Descriptor view:/);
  assert.match(activeAlternatives.summary, /Descriptor view:/);
  assert.doesNotMatch(activeCandidate.summary, /Tanımlayıcı görünümü:/);
  assert.doesNotMatch(activeAlternatives.summary, /Tanımlayıcı görünümü:/);
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: activeCandidate.planId,
  });

  const stagingSummary = getLaboratoryProcessSummary(store.getState());
  assert.equal(stagingSummary.state, "idle");
  assert.equal(
    (getLaboratoryRightPanelContext(store.getState()) as Record<string, unknown>)[
      "stagingStatus"
    ],
    undefined
  );

  store.dispatch({
    type: "run-started",
    action: "analysis",
  });
  store.dispatch({
    type: "module-started",
    action: "analysis",
    moduleId: "audio",
  });
  const analyzingSummary = getLaboratoryProcessSummary(store.getState());
  assert.equal(analyzingSummary.state, "analyzing");
  assert.equal(analyzingSummary.totalCount, 1);
  assert.equal(analyzingSummary.activeTaskLabel, "audio");
});

test("store accepts execution intents only from the exact active suggestion preview", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });

  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "extract-clip",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "missing-suggestion",
  });
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  assert.equal(store.getState().ui.activeExecutionIntentId, "audio-inspect");
  assert.equal(getActiveExecutionIntent(store.getState())?.id, "audio-inspect");

  store.dispatch({
    type: "workspace-selection-suggestion-dismissed",
    suggestionId: " audio-inspect ",
  });
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: " audio-inspect ",
  });
  assert.equal(getActiveSuggestionPreviewId(store.getState()), "audio-inspect");

  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: " audio-inspect ",
  });
  assert.equal(store.getState().ui.activeExecutionIntentId, "audio-inspect");
  assert.equal(getActiveExecutionIntent(store.getState())?.id, "audio-inspect");

  const activeCandidate = getActiveExecutionCandidate(store.getState());
  assert.ok(activeCandidate);
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: activeCandidate.planId,
  });
  assert.equal(getActiveExecutionCommitment(store.getState())?.planId, activeCandidate.planId);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "extract-clip",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "extract-clip",
  });
  assert.equal(store.getState().ui.activeExecutionIntentId, "extract-clip");
  assert.equal(store.getState().ui.activeExecutionCommitment, null);
  assert.equal(getActiveExecutionCommitment(store.getState()), null);

  store.dispatch({
    type: "selection-roi-updated",
    roi: {
      x: 0.2,
      y: 0.2,
      width: 0.24,
      height: 0.24,
    },
  });
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);
});

test("execution plan is derived only from accepted intents and survives preview clear", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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

test("execution plan lifecycle follows soft intent resets instead of re-deriving across invalidating changes", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
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

test("execution planner is deterministic and resolves ROI tool-hint intents", () => {
  const baseSelection: LabSelection = {
    id: "selection-1",
    startMs: 1200,
    endMs: 4800,
    type: "inspect",
    intent: "motion",
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
    "plan:inspect-region:focus-region:video:motion:inspect:motion:1200:4800:180-220-240-280"
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
    type: "workspace-selection-intent-updated",
    intent: "motion",
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
  assert.match(getActiveExecutionPlan(store.getState())?.title || "", /Region focus plan/);
});

test("execution planner falls back safely for unknown action types", () => {
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
      intent: "general",
      createdAt: 1,
    },
    inspectionMode: "none",
    sourceKind: "audio",
  });

  assert.equal(plan.title, "Generic execution plan");
  assert.equal(plan.expectedOutputs[0], "Review notes");
  assert.equal(plan.steps.length, 3);
});

test("execution simulation is derived only from active plans and survives preview clear", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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
  assert.equal(activeSimulation?.planId, activePlan?.id);
  assert.equal(activeSimulation?.id, `simulation:${activePlan?.id}`);
  assert.equal((activeSimulation?.predictedEffects.length ?? 0) > 0, true);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-cleared",
  });
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(getActiveExecutionSimulation(store.getState())?.planId, activePlan?.id);

  store.dispatch({
    type: "workspace-selection-suggestion-dismissed",
    suggestionId: "audio-inspect",
  });
  assert.equal(getActiveExecutionSimulation(store.getState()), null);
});

test("execution simulation is deterministic and stays stable across audio-focus-only updates", () => {
  const selection: LabSelection = {
    id: "selection-audio-sim",
    startMs: 1000,
    endMs: 3000,
    type: "clip",
    intent: "audio",
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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

test("execution readiness is deterministic across ready, needs-review, and blocked states", () => {
  const readySelection: LabSelection = {
    id: "selection-ready",
    startMs: 1000,
    endMs: 3200,
    type: "clip",
    intent: "general",
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
    intent: "anomaly",
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
    intent: "visual",
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

test("execution readiness is derived only from active plan and simulation", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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
  assert.equal(activeReadiness?.id, `readiness:${activePlan?.id}`);

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

test("execution readiness follows upstream invalidation instead of persisting independently", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "motion",
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
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionReadiness(store.getState()), null);

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

test("execution payload preview is derived only from active readiness", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });

  assert.equal(getActiveExecutionPayloadPreview(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-queued",
    suggestionId: "audio-inspect",
  });
  assert.equal(getActiveExecutionPayloadPreview(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });

  const activePlan = getActiveExecutionPlan(store.getState());
  const activePayload = getActiveExecutionPayloadPreview(store.getState());
  assert.equal(activePayload?.id, `payload:${activePlan?.id}`);
  assert.equal(activePayload?.planId, activePlan?.id);
  assert.equal(activePayload?.actionType, "inspect-audio");
  assert.equal(
    activePayload?.readinessStatus,
    getActiveExecutionReadiness(store.getState())?.status
  );
  assert.equal(typeof activePayload?.readinessPassesPreview, "boolean");
  assert.equal(activePayload?.dryRunShape.previewExpectedOutputs[0], "frequencyClusters");
  assert.deepEqual(Object.keys(activePayload?.dryRunShape.previewInput || {}), ["audioWindow"]);
  assert.match(activePayload?.summary || "", /dry-run bridge/);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-cleared",
  });
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(getActiveExecutionPayloadPreview(store.getState())?.id, activePayload?.id);

  store.dispatch({
    type: "workspace-selection-suggestion-dismissed",
    suggestionId: "audio-inspect",
  });
  assert.equal(getActiveExecutionPayloadPreview(store.getState()), null);
});

test("execution payload bridge is deterministic and covers ROI plus fallback shapes", () => {
  const roiSelection: LabSelection = {
    id: "selection-payload-roi",
    startMs: 1200,
    endMs: 4800,
    type: "inspect",
    intent: "motion",
    roi: {
      x: 0.18,
      y: 0.22,
      width: 0.24,
      height: 0.28,
    },
    createdAt: 1,
  };
  const focusPlan = buildExecutionPlan({
    suggestion: {
      id: "inspect-region",
      label: "Region",
      actionType: "focus-region",
      confidence: 0.82,
    },
    activeSelection: roiSelection,
    inspectionMode: "visual",
    sourceKind: "video",
  });
  const focusSimulation = buildExecutionSimulation({
    executionPlan: focusPlan,
    activeSelection: roiSelection,
    inspectionMode: "visual",
    sourceKind: "video",
    audioFocus: createTestAudioFocusSettings(),
  });
  const focusReadiness = buildExecutionReadiness({
    executionPlan: focusPlan,
    executionSimulation: focusSimulation,
    activeSelection: roiSelection,
    inspectionMode: "visual",
    sourceKind: "video",
    audioFocus: createTestAudioFocusSettings(),
  });
  const focusPayload = buildExecutionPayloadPreview({
    executionPlan: focusPlan,
    executionSimulation: focusSimulation,
    executionReadiness: focusReadiness,
    activeSelection: roiSelection,
    inspectionMode: "visual",
    sourceKind: "video",
  });
  const focusPayloadRepeat = buildExecutionPayloadPreview({
    executionPlan: focusPlan,
    executionSimulation: focusSimulation,
    executionReadiness: focusReadiness,
    activeSelection: roiSelection,
    inspectionMode: "visual",
    sourceKind: "video",
  });

  assert.deepEqual(focusPayload, focusPayloadRepeat);
  assert.equal(focusPayload.id, `payload:${focusPlan.id}`);
  assert.equal(focusPayload.readinessPassesPreview, focusReadiness.status === "ready");
  assert.deepEqual(
    (focusPayload.dryRunShape.previewInput["roi"] as Record<string, unknown>) || {},
    {
      height: 0.28,
      width: 0.24,
      x: 0.18,
      y: 0.22,
    }
  );
  assert.equal(focusPayload.dryRunShape.previewParameters["detailPass"], "region-local");

  const fallbackPlan = buildExecutionPlan({
    suggestion: {
      id: "custom-unknown",
      label: "Unknown",
      actionType: "unknown-action" as unknown as LabActionSuggestion["actionType"],
      confidence: 0.41,
    },
    activeSelection: roiSelection,
    inspectionMode: "none",
    sourceKind: "video",
  });
  const fallbackSimulation = buildExecutionSimulation({
    executionPlan: fallbackPlan,
    activeSelection: roiSelection,
    inspectionMode: "none",
    sourceKind: "video",
    audioFocus: createTestAudioFocusSettings(),
  });
  const fallbackReadiness = buildExecutionReadiness({
    executionPlan: fallbackPlan,
    executionSimulation: fallbackSimulation,
    activeSelection: roiSelection,
    inspectionMode: "none",
    sourceKind: "video",
    audioFocus: createTestAudioFocusSettings(),
  });
  const fallbackPayload = buildExecutionPayloadPreview({
    executionPlan: fallbackPlan,
    executionSimulation: fallbackSimulation,
    executionReadiness: fallbackReadiness,
    activeSelection: roiSelection,
    inspectionMode: "none",
    sourceKind: "video",
  });

  assert.equal(fallbackPayload.dryRunShape.previewExpectedOutputs[0], "generalObservations");
  assert.equal(
    fallbackPayload.notes?.some(function (note) {
      return note.includes("not recognized");
    }),
    true
  );
});

test("execution payload preview helper returns null for missing upstream objects", () => {
  const selection: LabSelection = {
    id: "selection-payload-missing",
    startMs: 1000,
    endMs: 3000,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const plan = buildExecutionPlan({
    suggestion: {
      id: "audio-inspect",
      label: "Inspect audio",
      actionType: "inspect-audio",
      confidence: 0.9,
    },
    activeSelection: selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const simulation = buildExecutionSimulation({
    executionPlan: plan,
    activeSelection: selection,
    inspectionMode: "audio",
    sourceKind: "audio",
    audioFocus: createTestAudioFocusSettings(),
  });
  const readiness = buildExecutionReadiness({
    executionPlan: plan,
    executionSimulation: simulation,
    activeSelection: selection,
    inspectionMode: "audio",
    sourceKind: "audio",
    audioFocus: createTestAudioFocusSettings(),
  });

  assert.equal(
    buildExecutionPayloadPreviewFromResolved({
      executionPlan: null,
      executionSimulation: simulation,
      executionReadiness: readiness,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
  assert.equal(
    buildExecutionPayloadPreviewFromResolved({
      executionPlan: plan,
      executionSimulation: null,
      executionReadiness: readiness,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
  assert.equal(
    buildExecutionPayloadPreviewFromResolved({
      executionPlan: plan,
      executionSimulation: simulation,
      executionReadiness: null,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
});

test("execution reflection maps readiness and simulation into passive decisions", () => {
  const proceedSelection: LabSelection = {
    id: "selection-reflection-proceed",
    startMs: 1000,
    endMs: 3000,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const proceedPlan = buildExecutionPlan({
    suggestion: {
      id: "audio-inspect",
      label: "Inspect audio",
      actionType: "inspect-audio",
      confidence: 0.9,
    },
    activeSelection: proceedSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const proceedSimulation = buildExecutionSimulation({
    executionPlan: proceedPlan,
    activeSelection: proceedSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
    audioFocus: createTestAudioFocusSettings(),
  });
  const proceedReadiness = buildExecutionReadiness({
    executionPlan: proceedPlan,
    executionSimulation: proceedSimulation,
    activeSelection: proceedSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
    audioFocus: createTestAudioFocusSettings(),
  });
  const proceedPayload = buildExecutionPayloadPreview({
    executionPlan: proceedPlan,
    executionSimulation: proceedSimulation,
    executionReadiness: proceedReadiness,
    activeSelection: proceedSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const proceedReflection = buildExecutionReflection({
    executionPlan: proceedPlan,
    executionSimulation: proceedSimulation,
    executionReadiness: proceedReadiness,
    executionPayloadPreview: proceedPayload,
    activeSelection: proceedSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const proceedReflectionRepeat = buildExecutionReflection({
    executionPlan: proceedPlan,
    executionSimulation: proceedSimulation,
    executionReadiness: proceedReadiness,
    executionPayloadPreview: proceedPayload,
    activeSelection: proceedSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });

  assert.deepEqual(proceedReflection, proceedReflectionRepeat);
  assert.equal(proceedReflection.id, `reflection:${proceedPlan.id}`);
  assert.equal(proceedReflection.decision, "proceed");
  assert.match(proceedReflection.summary, /stable/);
  assert.equal(proceedReflection.reasoning.length > 0, true);
  assert.equal(proceedReflection.alternatives, undefined);

  const reviewSelection: LabSelection = {
    id: "selection-reflection-review",
    startMs: 1000,
    endMs: 18000,
    type: "clip",
    intent: "general",
    createdAt: 1,
  };
  const reviewPlan = buildExecutionPlan({
    suggestion: {
      id: "analyze-segment",
      label: "Analyze segment",
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
  const reviewPayload = buildExecutionPayloadPreview({
    executionPlan: reviewPlan,
    executionSimulation: reviewSimulation,
    executionReadiness: reviewReadiness,
    activeSelection: reviewSelection,
    inspectionMode: "none",
    sourceKind: "video",
  });
  const reviewReflection = buildExecutionReflection({
    executionPlan: reviewPlan,
    executionSimulation: reviewSimulation,
    executionReadiness: reviewReadiness,
    executionPayloadPreview: reviewPayload,
    activeSelection: reviewSelection,
    inspectionMode: "none",
    sourceKind: "video",
  });

  assert.equal(reviewReflection.decision, "review");
  assert.equal(reviewReflection.alternatives?.includes("Narrow selection range"), true);
  assert.equal(
    reviewReflection.reasoning.some(function (reason) {
      return reason.includes("Simulation warning");
    }),
    true
  );

  const avoidSelection: LabSelection = {
    id: "selection-reflection-avoid",
    startMs: 1000,
    endMs: 2600,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const avoidPlan = buildExecutionPlan({
    suggestion: {
      id: "audio-inspect",
      label: "Inspect audio",
      actionType: "inspect-audio",
      confidence: 0.86,
    },
    activeSelection: avoidSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const avoidAudioFocus = createTestAudioFocusSettings({ gain: 2.6 });
  const avoidSimulation = buildExecutionSimulation({
    executionPlan: avoidPlan,
    activeSelection: avoidSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
    audioFocus: avoidAudioFocus,
  });
  const avoidReadiness = buildExecutionReadiness({
    executionPlan: avoidPlan,
    executionSimulation: avoidSimulation,
    activeSelection: avoidSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
    audioFocus: avoidAudioFocus,
  });
  const avoidPayload = buildExecutionPayloadPreview({
    executionPlan: avoidPlan,
    executionSimulation: avoidSimulation,
    executionReadiness: avoidReadiness,
    activeSelection: avoidSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const avoidReflection = buildExecutionReflection({
    executionPlan: avoidPlan,
    executionSimulation: avoidSimulation,
    executionReadiness: avoidReadiness,
    executionPayloadPreview: avoidPayload,
    activeSelection: avoidSelection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });

  assert.equal(avoidReflection.decision, "avoid");
  assert.equal(avoidReflection.alternatives?.includes("Lower preview gain"), true);
  assert.equal(
    avoidReflection.reasoning.some(function (reason) {
      return reason.includes("Readiness blocker") || reason.includes("Simulation risk is high");
    }),
    true
  );
});

test("execution reflection is derived only from the complete active dry-run chain", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });

  assert.equal(getActiveExecutionReflection(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-queued",
    suggestionId: "audio-inspect",
  });
  assert.equal(getActiveExecutionReflection(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });

  const activePlan = getActiveExecutionPlan(store.getState());
  const activeReflection = getActiveExecutionReflection(store.getState());
  assert.equal(activeReflection?.id, `reflection:${activePlan?.id}`);
  assert.equal(activeReflection?.planId, activePlan?.id);
  assert.equal(activeReflection?.decision, "proceed");
  assert.equal((activeReflection?.reasoning.length ?? 0) > 0, true);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-cleared",
  });
  assert.equal(getActiveExecutionReflection(store.getState())?.id, activeReflection?.id);

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1500,
    endMs: 2800,
  });
  assert.equal(getActiveExecutionReflection(store.getState()), null);
});

test("execution reflection helper returns null for missing upstream objects", () => {
  const selection: LabSelection = {
    id: "selection-reflection-missing",
    startMs: 1000,
    endMs: 3000,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const plan = buildExecutionPlan({
    suggestion: {
      id: "audio-inspect",
      label: "Inspect audio",
      actionType: "inspect-audio",
      confidence: 0.9,
    },
    activeSelection: selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const simulation = buildExecutionSimulation({
    executionPlan: plan,
    activeSelection: selection,
    inspectionMode: "audio",
    sourceKind: "audio",
    audioFocus: createTestAudioFocusSettings(),
  });
  const readiness = buildExecutionReadiness({
    executionPlan: plan,
    executionSimulation: simulation,
    activeSelection: selection,
    inspectionMode: "audio",
    sourceKind: "audio",
    audioFocus: createTestAudioFocusSettings(),
  });
  const payload = buildExecutionPayloadPreview({
    executionPlan: plan,
    executionSimulation: simulation,
    executionReadiness: readiness,
    activeSelection: selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });

  assert.equal(
    buildExecutionReflectionFromResolved({
      executionPlan: null,
      executionSimulation: simulation,
      executionReadiness: readiness,
      executionPayloadPreview: payload,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
  assert.equal(
    buildExecutionReflectionFromResolved({
      executionPlan: plan,
      executionSimulation: null,
      executionReadiness: readiness,
      executionPayloadPreview: payload,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
  assert.equal(
    buildExecutionReflectionFromResolved({
      executionPlan: plan,
      executionSimulation: simulation,
      executionReadiness: null,
      executionPayloadPreview: payload,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
  assert.equal(
    buildExecutionReflectionFromResolved({
      executionPlan: plan,
      executionSimulation: simulation,
      executionReadiness: readiness,
      executionPayloadPreview: null,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
});

function createExecutionAlternativesChain(params: {
  actionType: LabActionSuggestion["actionType"];
  audioFocus?: LabAudioFocusSettings;
  inspectionMode: "none" | "visual" | "audio" | "motion";
  selection: LabSelection;
  sourceKind: string;
  suggestionId: string;
}) {
  const plan = buildExecutionPlan({
    suggestion: {
      id: params.suggestionId,
      label: params.suggestionId,
      actionType: params.actionType,
      confidence: 0.86,
    },
    activeSelection: params.selection,
    inspectionMode: params.inspectionMode,
    sourceKind: params.sourceKind,
  });
  const simulation = buildExecutionSimulation({
    executionPlan: plan,
    activeSelection: params.selection,
    inspectionMode: params.inspectionMode,
    sourceKind: params.sourceKind,
    audioFocus: params.audioFocus ?? createTestAudioFocusSettings(),
  });
  const readiness = buildExecutionReadiness({
    executionPlan: plan,
    executionSimulation: simulation,
    activeSelection: params.selection,
    inspectionMode: params.inspectionMode,
    sourceKind: params.sourceKind,
    audioFocus: params.audioFocus ?? createTestAudioFocusSettings(),
  });
  const payload = buildExecutionPayloadPreview({
    executionPlan: plan,
    executionSimulation: simulation,
    executionReadiness: readiness,
    activeSelection: params.selection,
    inspectionMode: params.inspectionMode,
    sourceKind: params.sourceKind,
  });
  const reflection = buildExecutionReflection({
    executionPlan: plan,
    executionSimulation: simulation,
    executionReadiness: readiness,
    executionPayloadPreview: payload,
    activeSelection: params.selection,
    inspectionMode: params.inspectionMode,
    sourceKind: params.sourceKind,
  });
  const alternatives = buildExecutionAlternatives({
    executionPlan: plan,
    executionSimulation: simulation,
    executionReadiness: readiness,
    executionReflection: reflection,
    activeSelection: params.selection,
    inspectionMode: params.inspectionMode,
    sourceKind: params.sourceKind,
  });
  return {
    alternatives,
    payload,
    plan,
    readiness,
    reflection,
    selection: params.selection,
    simulation,
  };
}

function cloneForMutationCheck<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

const DESCRIPTOR_EXECUTION_VERB_PATTERN =
  /\b(auto|commit|dispatch|execute|run|apply|switch|select|activate|choose|trigger|invoke)\b/i;

const ADVISORY_MARKERS = [
  "Descriptor view:",
  "Readiness view:",
  "Execution bridge:",
  "Coherence view:",
] as const;

function getLocalizedAdvisoryMarkers(locale: "en" | "tr") {
  return [
    `${resolveLabI18n("descriptor.view", locale)}:`,
    `${resolveLabI18n("readiness.view", locale)}:`,
    `${resolveLabI18n("bridge.view", locale)}:`,
    `${resolveLabI18n("coherence.view", locale)}:`,
  ];
}

function sliceAdvisoryText(summary: string, marker: (typeof ADVISORY_MARKERS)[number]) {
  const index = summary.indexOf(marker);
  if (index === -1) {
    return "";
  }
  const searchStart = index + marker.length;
  const stopIndex = ADVISORY_MARKERS.reduce<number | null>(function (current, stopMarker) {
    if (stopMarker === marker) {
      return current;
    }
    const markerIndex = summary.indexOf(` ${stopMarker}`, searchStart);
    if (markerIndex === -1) {
      return current;
    }
    return current === null ? markerIndex : Math.min(current, markerIndex);
  }, null);
  return stopIndex === null ? summary.slice(index) : summary.slice(index, stopIndex);
}

function extractDescriptorAdvisoryText(summary: string) {
  return sliceAdvisoryText(summary, "Descriptor view:");
}

function extractReadinessSignalAdvisoryText(summary: string) {
  return sliceAdvisoryText(summary, "Readiness view:");
}

function extractExecutionBridgeAdvisoryText(summary: string) {
  return sliceAdvisoryText(summary, "Execution bridge:");
}

function extractDecisionCoherenceAdvisoryText(summary: string) {
  return sliceAdvisoryText(summary, "Coherence view:");
}

function countOccurrences(value: string, needle: string) {
  if (needle === "") {
    return 0;
  }
  return value.split(needle).length - 1;
}

function assertSummaryOrder(summary: string, orderedParts: string[]) {
  let previousIndex = -1;
  for (const part of orderedParts) {
    const index = summary.indexOf(part);
    assert.notEqual(index, -1);
    assert.equal(index > previousIndex, true);
    previousIndex = index;
  }
}

function assertLocalizedAdvisoryOrder(summary: string, locale: "en" | "tr") {
  assertSummaryOrder(summary, getLocalizedAdvisoryMarkers(locale));
}

function countLocalizedAdvisories(summary: string, locale: "en" | "tr") {
  return getLocalizedAdvisoryMarkers(locale).reduce(function (total, marker) {
    return total + countOccurrences(summary, marker);
  }, 0);
}

function hasObjectKey(value: unknown, keyName: string): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(function (entry) {
      return hasObjectKey(entry, keyName);
    });
  }
  return Object.entries(value as Record<string, unknown>).some(function ([key, entry]) {
    return key === keyName || hasObjectKey(entry, keyName);
  });
}

test("passive execution descriptor maps conceptual classes deterministically", () => {
  const selection: LabSelection = {
    id: "selection-peb-descriptor-map",
    startMs: 1000,
    endMs: 3600,
    type: "inspect",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const descriptor = buildExecutionDescriptor({
    actionType: chain.plan.actionType,
    executionPayloadPreview: chain.payload,
    executionPlan: chain.plan,
  });

  assert.deepEqual(descriptor, {
    tool: "audio-analysis",
    intent: "spectral-variation-inspection",
    paramShape: {
      type: "spectral-window",
      fields: ["timeWindow", "frequencyBands", "signalFocus"],
    },
  });
  assert.deepEqual(
    buildExecutionDescriptor({
      actionType: chain.plan.actionType,
      executionPayloadPreview: chain.payload,
      executionPlan: chain.plan,
    }),
    descriptor
  );
  assert.deepEqual(buildExecutionDescriptor({ actionType: "inspect-motion" }), {
    tool: "motion-analysis",
    intent: "motion-continuity-inspection",
    paramShape: {
      type: "motion-window",
      fields: ["timeWindow", "motionScope", "referenceFrame"],
    },
  });
  assert.deepEqual(buildExecutionDescriptor({ actionType: "unknown-action" }), {
    tool: "signal-inspection",
    intent: "evidence-shape-description",
    paramShape: {
      type: "generic-evidence-window",
      fields: ["scope", "evidenceWindow", "reviewSurface"],
    },
  });

  const advisory = formatExecutionDescriptorAdvisory({
    actionType: chain.plan.actionType,
    descriptor,
  });
  assert.equal(advisory, "Descriptor view: aligns with audio-analysis (spectral-window shape).");
  assert.doesNotMatch(advisory, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(advisory, /\b(ffmpeg|yt-dlp|opencv|sharp)\b/i);
});

test("execution bridge maps descriptors to passive contracts deterministically", () => {
  const descriptor = buildExecutionDescriptor({ actionType: "inspect-audio" });
  const bridge = buildExecutionBridge(descriptor);

  assert.deepEqual(bridge, {
    adapter: "librosa",
    operation: "spectral_features_analysis",
    inputContract: {
      required: ["timeWindow", "frequencyBands"],
      optional: ["signalFocus"],
      constraints: {
        timeWindow: "seconds-range",
        frequencyBands: "hz-range",
      },
    },
    outputContract: {
      type: "timeseries",
      fields: ["timestamp", "spectralCentroid", "bandwidth"],
      interpretationHint: "spectral variation over time",
    },
    summary:
      "maps to librosa using spectral_features_analysis, with a spectral-window shaped input and time-series output",
  });
  assert.deepEqual(buildExecutionBridge(descriptor), bridge);
  assert.equal(
    formatExecutionBridgeAdvisory(bridge),
    `Execution bridge: This path ${bridge.summary}.`
  );
  assert.doesNotMatch(formatExecutionBridgeAdvisory(bridge), DESCRIPTOR_EXECUTION_VERB_PATTERN);

  assert.deepEqual(
    buildExecutionBridge(buildExecutionDescriptor({ actionType: "analyze-segment" })),
    {
      adapter: "ffmpeg",
      operation: "temporal_window_scan",
      inputContract: {
        required: ["timeWindow"],
        optional: ["signalScope", "variationSurface"],
        constraints: {
          timeWindow: "seconds-range",
        },
      },
      outputContract: {
        type: "segments",
        fields: ["start", "end"],
        interpretationHint: "time-based segment boundaries",
      },
      summary:
        "maps to ffmpeg using temporal_window_scan, with a temporal-window shaped input and segment output",
    }
  );
  assert.equal(
    buildExecutionBridge(buildExecutionDescriptor({ actionType: "inspect-motion" })).operation,
    "frame_diff_analysis"
  );
  assert.equal(
    buildExecutionBridge(buildExecutionDescriptor({ actionType: "inspect-motion" })).adapter,
    "pyAudioAnalysis"
  );
  assert.equal(
    buildExecutionBridge({
      tool: "embedding-extraction",
      intent: "embedding-summary",
      paramShape: {
        type: "generic-evidence-window",
        fields: ["scope", "evidenceWindow", "reviewSurface"],
      },
    }).adapter,
    "yamnet"
  );
  assert.deepEqual(
    buildExecutionBridge({
      tool: "speech-transcription",
      intent: "speech-segment-description",
      paramShape: {
        type: "temporal-window",
        fields: ["timeWindow", "signalScope", "variationSurface"],
      },
    }).outputContract,
    {
      type: "segments",
      fields: ["timestamp", "text"],
      interpretationHint: "transcribed speech segments",
    }
  );
});

test("execution bridge derives input shape without runtime payload values", () => {
  const selection: LabSelection = {
    id: "selection-bridge-param-shape",
    startMs: 1000,
    endMs: 3600,
    type: "inspect",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const descriptor = buildExecutionDescriptor({
    actionType: chain.plan.actionType,
    executionPayloadPreview: chain.payload,
    executionPlan: chain.plan,
  });
  const bridge = buildExecutionBridge(descriptor);
  const serializedContract = JSON.stringify(bridge.inputContract);

  assert.deepEqual(bridge.inputContract.required, ["timeWindow", "frequencyBands"]);
  assert.deepEqual(bridge.inputContract.optional, ["signalFocus"]);
  assert.equal(serializedContract.includes("selection-bridge-param-shape"), false);
  assert.equal(serializedContract.includes("1000"), false);
  assert.equal(serializedContract.includes("3600"), false);
  assert.equal(hasObjectKey(bridge.inputContract, "previewInput"), false);
  assert.equal(hasObjectKey(bridge.inputContract, "previewParameters"), false);
});

test("execution readiness signal maps pressure and projection deterministically", () => {
  const steadySignal = buildExecutionReadinessSignal({
    decisionPressure: "low",
    goalEvaluation: {
      outcome: "successful",
      goalAlignment: 0.92,
      summary: "Goal achieved",
      patternSignal: {
        averageCoverage: 0.86,
        executionCount: 3,
        failureRatio: 0,
        strength: "strong",
        successRatio: 1,
      },
    },
    alignment: "matches-simulation",
    alternativesConfidence: 0.82,
  });
  assert.deepEqual(steadySignal, {
    level: "steady",
    decisionPressure: "low",
    goalOutcome: "successful",
    patternStrength: "strong",
    alignment: "matches-simulation",
    alternativesConfidenceBand: "high",
    projectionAlignment: "none",
    score: -4,
    reasons: [
      "low-pressure",
      "successful-goal",
      "strong-pattern",
      "matches-simulation-alignment",
      "high-alternative-confidence",
      "none-projection",
    ],
  });
  assert.deepEqual(
    buildExecutionReadinessSignal({
      decisionPressure: "low",
      goalEvaluation: {
        outcome: "successful",
        goalAlignment: 0.92,
        summary: "Goal achieved",
        patternSignal: {
          averageCoverage: 0.86,
          executionCount: 3,
          failureRatio: 0,
          strength: "strong",
          successRatio: 1,
        },
      },
      alignment: "matches-simulation",
      alternativesConfidence: 0.82,
    }),
    steadySignal
  );
  assert.equal(
    formatExecutionReadinessSignalAdvisory(steadySignal),
    "Readiness view: steady signal from low pressure, strong pattern, matched alignment, high alternative confidence, and neutral projection."
  );
  assert.deepEqual(
    buildExecutionReadinessSignal({
      decisionPressure: "medium",
      patternStrength: "weak",
      alignment: "partial",
      alternativesConfidence: 0.5,
    }).level,
    "guarded"
  );
  assert.deepEqual(
    buildExecutionReadinessSignal({
      decisionPressure: "high",
      goalEvaluation: {
        outcome: "failed",
        goalAlignment: 0.2,
        summary: "Goal failed",
        patternSignal: {
          averageCoverage: 0.32,
          executionCount: 2,
          failureRatio: 1,
          strength: "weak",
          successRatio: 0,
        },
      },
      alignment: "deviates",
      alternativesConfidence: 0.2,
      projection: {
        expectedAlignment: "worse",
        expectedCoverage: "decrease",
        expectedStability: "lower",
        summary:
          "Projected outcome suggests lower stability, worse alignment, and decrease coverage.",
      },
    }).level,
    "strained"
  );
  assert.equal(
    buildExecutionReadinessSignal({
      decisionPressure: "low",
      goalEvaluation: {
        outcome: "failed",
        goalAlignment: 0.3,
        summary: "Goal failed",
      },
      alignment: "partial",
      alternativesConfidence: 0.5,
      projection: {
        expectedAlignment: "better",
        expectedCoverage: "stable",
        expectedStability: "higher",
        summary:
          "Projected outcome suggests higher stability, better alignment, and stable coverage.",
      },
    }).level,
    "steady"
  );
  assert.equal(
    buildExecutionReadinessSignal({
      decisionPressure: "low",
      goalEvaluation: {
        outcome: "failed",
        goalAlignment: 0.3,
        summary: "Goal failed",
      },
      alignment: "partial",
      alternativesConfidence: 0.5,
      projection: {
        expectedAlignment: "worse",
        expectedCoverage: "stable",
        expectedStability: "lower",
        summary:
          "Projected outcome suggests lower stability, worse alignment, and stable coverage.",
      },
    }).level,
    "strained"
  );
  assert.doesNotMatch(
    formatExecutionReadinessSignalAdvisory(steadySignal),
    DESCRIPTOR_EXECUTION_VERB_PATTERN
  );
});

test("laboratory advisory i18n resolves semantic keys without leaking selectors", () => {
  assert.equal(resolveLabI18n("descriptor.view", "en"), "Descriptor view");
  assert.equal(resolveLabI18n("descriptor.view", "tr"), "Tanımlayıcı görünümü");
  assert.notEqual(resolveLabI18n("readiness.view", "en"), resolveLabI18n("readiness.view", "tr"));
  assert.equal(
    __testOnlyResolveLabI18nFromDictionaries("bridge.view", "tr", {
      en: {
        "bridge.view": "Execution bridge",
      },
    }),
    "Execution bridge"
  );
  assert.equal(
    __testOnlyResolveLabI18nFromDictionaries("bridge.view", "tr", {}),
    "Execution bridge"
  );

  const descriptor = buildExecutionDescriptor({ actionType: "inspect-audio" });
  const bridge = buildExecutionBridge(descriptor);
  const readinessSignal = buildExecutionReadinessSignal({
    decisionPressure: "low",
    goalEvaluation: {
      outcome: "successful",
      goalAlignment: 0.92,
      summary: "Goal achieved",
      patternSignal: {
        averageCoverage: 0.86,
        executionCount: 3,
        failureRatio: 0,
        strength: "strong",
        successRatio: 1,
      },
    },
    alignment: "matches-simulation",
    alternativesConfidence: 0.82,
  });
  const coherence = buildDecisionCoherence({
    posture: "proceed",
    readiness: {
      level: "steady",
      score: -2,
    },
    projection: {
      expectedAlignment: "better",
      expectedStability: "higher",
      expectedCoverage: "stable",
    },
  });

  const englishOutputs = [
    formatDecisionPostureLabel("proceed-with-caution"),
    formatExecutionDescriptorAdvisory({ actionType: "inspect-audio", descriptor }),
    formatExecutionReadinessSignalAdvisory(readinessSignal),
    formatExecutionBridgeAdvisory(bridge),
    formatDecisionCoherenceAdvisory(coherence),
  ];
  const turkishOutputs = [
    formatDecisionPostureLabel("proceed-with-caution", "tr"),
    formatExecutionDescriptorAdvisory({ actionType: "inspect-audio", descriptor, locale: "tr" }),
    formatExecutionReadinessSignalAdvisory(readinessSignal, "tr"),
    formatExecutionBridgeAdvisory(bridge, "tr"),
    formatDecisionCoherenceAdvisory(coherence, "tr"),
  ];

  assert.equal(
    englishOutputs[1],
    "Descriptor view: aligns with audio-analysis (spectral-window shape)."
  );
  assert.equal(
    englishOutputs[2],
    "Readiness view: steady signal from low pressure, strong pattern, matched alignment, high alternative confidence, and neutral projection."
  );
  assert.equal(englishOutputs[3], `Execution bridge: This path ${bridge.summary}.`);
  assert.equal(englishOutputs[4], coherence.summary);
  assert.notDeepEqual(englishOutputs, turkishOutputs);
  assert.deepEqual(turkishOutputs, [
    formatDecisionPostureLabel("proceed-with-caution", "tr"),
    formatExecutionDescriptorAdvisory({ actionType: "inspect-audio", descriptor, locale: "tr" }),
    formatExecutionReadinessSignalAdvisory(readinessSignal, "tr"),
    formatExecutionBridgeAdvisory(bridge, "tr"),
    formatDecisionCoherenceAdvisory(coherence, "tr"),
  ]);
  assert.equal(turkishOutputs[3].includes(bridge.summary), false);

  const rendered = [...englishOutputs, ...turkishOutputs].join(" ");
  for (const key of [
    "posture.caution",
    "descriptor.view",
    "readiness.view",
    "bridge.view",
    "coherence.view",
    "coherence.aligned",
    "projection.stable",
  ]) {
    assert.equal(rendered.includes(key), false);
  }
});

test("decision coherence compresses posture readiness and projection deterministically", () => {
  const aligned = buildDecisionCoherence({
    posture: "proceed",
    readiness: {
      level: "steady",
      score: -2,
    },
    projection: {
      expectedAlignment: "better",
      expectedStability: "higher",
      expectedCoverage: "stable",
    },
  });
  const mixed = buildDecisionCoherence({
    posture: "proceed-with-caution",
    readiness: {
      level: "guarded",
      score: 2,
    },
    projection: {
      expectedAlignment: "similar",
      expectedStability: "similar",
      expectedCoverage: "increase",
    },
  });
  const conflicted = buildDecisionCoherence({
    posture: "reconsider",
    readiness: {
      level: "strained",
      score: 6,
    },
    projection: {
      expectedAlignment: "worse",
      expectedStability: "lower",
      expectedCoverage: "decrease",
    },
  });

  assert.deepEqual(
    buildDecisionCoherence({
      posture: "proceed",
      readiness: {
        level: "steady",
        score: -2,
      },
      projection: {
        expectedAlignment: "better",
        expectedStability: "higher",
        expectedCoverage: "stable",
      },
    }),
    aligned
  );
  assert.deepEqual(aligned, {
    state: "aligned",
    dominantAxis: "neutral",
    confidence: 1,
    summary: "Coherence view: Signals are aligned toward a stable path.",
  });
  assert.deepEqual(mixed, {
    state: "mixed",
    dominantAxis: "exploration",
    confidence: 0,
    summary:
      "Coherence view: Signals are mixed, with trade-offs between stability and coverage with exploratory tendencies.",
  });
  assert.deepEqual(conflicted, {
    state: "conflicted",
    dominantAxis: "safety",
    confidence: 1,
    summary:
      "Coherence view: Signals are conflicted, indicating a high-risk and unstable path with cautionary signals.",
  });
  assert.equal(buildDecisionCoherence({ posture: "proceed" }).confidence, 1 / 3);
  assert.deepEqual(buildDecisionCoherence({}), {
    state: "mixed",
    dominantAxis: "neutral",
    confidence: 0,
    summary: "Coherence view: Signals are mixed, with trade-offs between stability and coverage.",
  });
  assert.equal(formatDecisionCoherenceAdvisory(aligned), aligned.summary);
  assert.doesNotMatch(aligned.summary, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(mixed.summary, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(conflicted.summary, DESCRIPTOR_EXECUTION_VERB_PATTERN);
});

test("decision priority reorders advisory summaries without mutating text", () => {
  const parts = {
    posturePrefix: "Proceed with caution:",
    descriptor: "Descriptor view: describes a stable pattern.",
    readiness: "Readiness view: guarded signal from medium pressure.",
    bridge: "Execution bridge: This path maps to a passive contract.",
    coherence: "Coherence view: Signals are conflicted.",
  };
  const conflictedInput = deepFreeze({
    summaryParts: parts,
    coherenceState: "conflicted" as const,
  });
  const before = cloneForMutationCheck(conflictedInput);
  const conflicted = reorderDecisionSummary(conflictedInput);

  assert.equal(
    conflicted,
    "Proceed with caution: Coherence view: Signals are conflicted. Readiness view: guarded signal from medium pressure. Descriptor view: describes a stable pattern. Execution bridge: This path maps to a passive contract."
  );
  assert.equal(reorderDecisionSummary(conflictedInput), conflicted);
  assert.deepEqual(conflictedInput, before);
  assert.equal(countOccurrences(conflicted, parts.descriptor), 1);
  assert.equal(countOccurrences(conflicted, parts.readiness), 1);
  assert.equal(countOccurrences(conflicted, parts.bridge), 1);
  assert.equal(countOccurrences(conflicted, parts.coherence), 1);
  assert.equal(conflicted.startsWith(`${parts.posturePrefix} ${parts.coherence}`), true);

  const mixed = reorderDecisionSummary({
    summaryParts: parts,
    coherenceState: "mixed",
  });
  assert.equal(
    mixed,
    "Proceed with caution: Descriptor view: describes a stable pattern. Readiness view: guarded signal from medium pressure. Coherence view: Signals are conflicted. Execution bridge: This path maps to a passive contract."
  );

  const aligned = reorderDecisionSummary({
    summaryParts: parts,
    coherenceState: "aligned",
  });
  const defaultOrder = reorderDecisionSummary({
    summaryParts: parts,
  });
  assert.equal(aligned, defaultOrder);
  assert.equal(
    aligned,
    "Proceed with caution: Descriptor view: describes a stable pattern. Readiness view: guarded signal from medium pressure. Execution bridge: This path maps to a passive contract. Coherence view: Signals are conflicted."
  );

  assert.equal(
    reorderDecisionSummary({
      summaryParts: {
        posturePrefix: "Proceed:",
        descriptor: "",
        readiness: "Readiness view: steady.",
        bridge: undefined,
        coherence: "Coherence view: aligned.",
      },
      coherenceState: "conflicted",
    }),
    "Proceed: Coherence view: aligned. Readiness view: steady."
  );

  const preservedDescriptor = "Descriptor view: keeps  internal spacing.";
  const preserved = reorderDecisionSummary({
    summaryParts: {
      descriptor: preservedDescriptor,
      readiness: "Readiness view: steady.",
    },
  });
  assert.equal(preserved.includes(preservedDescriptor), true);
  assert.equal(countOccurrences(preserved, preservedDescriptor), 1);
  assert.equal(
    reorderDecisionSummary({
      summaryParts: {
        descriptor: " Descriptor view: trims only boundary spacing. ",
        readiness: "Readiness view: steady.",
      },
    }),
    "Descriptor view: trims only boundary spacing. Readiness view: steady."
  );
});

test("passive execution descriptor remains stable across equivalent feedback contexts", () => {
  const selection: LabSelection = {
    id: "selection-peb-equivalent-feedback",
    startMs: 1000,
    endMs: 3200,
    type: "inspect",
    intent: "visual",
    roi: {
      x: 0.22,
      y: 0.2,
      width: 0.24,
      height: 0.2,
    },
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "focus-region",
    inspectionMode: "visual",
    selection,
    sourceKind: "video",
    suggestionId: "inspect-region",
  });
  const descriptor = buildExecutionDescriptor({
    actionType: chain.plan.actionType,
    executionPayloadPreview: chain.payload,
    executionPlan: chain.plan,
  });
  const advisory = formatExecutionDescriptorAdvisory({
    actionType: chain.plan.actionType,
    descriptor,
  });
  const baseInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    activeSelection: chain.selection,
    inspectionMode: "visual" as const,
    sourceKind: "video",
  };
  const weakPatternCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionGoalEvaluation: {
      outcome: "neutral",
      goalAlignment: 0.48,
      summary: "Goal remains inconclusive",
      patternSignal: {
        averageCoverage: 0.42,
        executionCount: 2,
        failureRatio: 0.5,
        strength: "weak",
        successRatio: 0.5,
      },
    },
    executionResultInterpretation: {
      alignment: "partial",
      anomalyLevel: "moderate",
      coverageLevel: "medium",
    },
  });
  const failedDeviationCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionGoalEvaluation: {
      outcome: "failed",
      goalAlignment: 0.22,
      summary: "Goal missed the expected coverage",
    },
    executionResultInterpretation: {
      alignment: "deviates",
      anomalyLevel: "high",
      coverageLevel: "low",
    },
  });

  assert.ok(weakPatternCandidate);
  assert.ok(failedDeviationCandidate);
  assert.deepEqual(
    buildExecutionDescriptor({
      actionType: chain.plan.actionType,
      executionPayloadPreview: chain.payload,
      executionPlan: chain.plan,
    }),
    descriptor
  );
  assert.equal(weakPatternCandidate.summary.includes(advisory), true);
  assert.equal(failedDeviationCandidate.summary.includes(advisory), true);
  assert.equal(extractDescriptorAdvisoryText(weakPatternCandidate.summary), advisory);
  assert.equal(extractDescriptorAdvisoryText(failedDeviationCandidate.summary), advisory);
});

test("execution alternatives compare deterministic counterfactuals across decisions", () => {
  const proceedSelection: LabSelection = {
    id: "selection-alternatives-proceed",
    startMs: 1000,
    endMs: 3600,
    type: "inspect",
    intent: "audio",
    roi: {
      x: 0.2,
      y: 0.24,
      width: 0.22,
      height: 0.24,
    },
    createdAt: 1,
  };
  const proceedChain = createExecutionAlternativesChain({
    actionType: "analyze-segment",
    inspectionMode: "audio",
    selection: proceedSelection,
    sourceKind: "video",
    suggestionId: "analyze-segment",
  });
  const proceedRepeat = buildExecutionAlternatives({
    executionPlan: proceedChain.plan,
    executionSimulation: proceedChain.simulation,
    executionReadiness: proceedChain.readiness,
    executionReflection: proceedChain.reflection,
    activeSelection: proceedChain.selection,
    inspectionMode: "audio",
    sourceKind: "video",
  });

  assert.deepEqual(proceedChain.alternatives, proceedRepeat);
  assert.equal(proceedChain.alternatives.id, `alternatives:${proceedChain.plan.id}`);
  assert.equal(proceedChain.alternatives.planId, proceedChain.plan.id);
  assert.equal(proceedChain.reflection.decision, "proceed");
  assert.doesNotMatch(
    proceedChain.alternatives.summary,
    /^(Proceed|Proceed with caution|Reconsider):/
  );
  assert.match(proceedChain.alternatives.summary, /selected path appears stable/i);
  assert.equal(proceedChain.alternatives.alternatives.length <= 3, true);
  assert.equal(
    proceedChain.alternatives.alternatives.some(function (alternative) {
      return alternative.actionType === "focus-region";
    }),
    true
  );
  assert.equal(
    proceedChain.alternatives.alternatives.some(function (alternative) {
      return alternative.actionType === "inspect-audio";
    }),
    true
  );

  const reviewSelection: LabSelection = {
    id: "selection-alternatives-review",
    startMs: 1000,
    endMs: 18000,
    type: "clip",
    intent: "visual",
    roi: {
      x: 0.04,
      y: 0.04,
      width: 0.82,
      height: 0.82,
    },
    createdAt: 1,
  };
  const reviewChain = createExecutionAlternativesChain({
    actionType: "focus-region",
    inspectionMode: "visual",
    selection: reviewSelection,
    sourceKind: "video",
    suggestionId: "inspect-region",
  });

  assert.equal(reviewChain.reflection.decision, "review");
  assert.match(reviewChain.alternatives.summary, /needs review/i);
  assert.doesNotMatch(reviewChain.alternatives.summary, /preferred/i);
  assert.equal(
    reviewChain.alternatives.alternatives.some(function (alternative) {
      return alternative.actionType === "analyze-segment";
    }),
    true
  );

  const avoidSelection: LabSelection = {
    id: "selection-alternatives-avoid",
    startMs: 1000,
    endMs: 2600,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const avoidChain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    audioFocus: createTestAudioFocusSettings({ gain: 2.6 }),
    inspectionMode: "audio",
    selection: avoidSelection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });

  assert.equal(avoidChain.reflection.decision, "avoid");
  assert.match(avoidChain.alternatives.summary, /not recommended/i);
  assert.doesNotMatch(avoidChain.alternatives.summary, /counterfactual/i);
  assert.doesNotMatch(avoidChain.alternatives.summary, /preferred/i);
  assert.equal(
    avoidChain.alternatives.alternatives.some(function (alternative) {
      return alternative.actionType === "slow-playback-inspection";
    }),
    true
  );
});

test("passive descriptor and bridge advisories are summary-only and avoid execution verbs", () => {
  const selection: LabSelection = {
    id: "selection-peb-summary-advisory",
    startMs: 1000,
    endMs: 3600,
    type: "inspect",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const candidate = buildExecutionCandidateFromResolved({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    activeSelection: chain.selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const alternatives = buildExecutionAlternatives({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionReflection: chain.reflection,
    activeSelection: chain.selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const candidateAdvisory = extractDescriptorAdvisoryText(candidate?.summary ?? "");
  const alternativesAdvisory = extractDescriptorAdvisoryText(alternatives.summary);
  const candidateReadinessAdvisory = extractReadinessSignalAdvisoryText(candidate?.summary ?? "");
  const alternativesReadinessAdvisory = extractReadinessSignalAdvisoryText(alternatives.summary);
  const candidateBridgeAdvisory = extractExecutionBridgeAdvisoryText(candidate?.summary ?? "");
  const alternativesBridgeAdvisory = extractExecutionBridgeAdvisoryText(alternatives.summary);
  const candidateCoherenceAdvisory = extractDecisionCoherenceAdvisoryText(candidate?.summary ?? "");
  const alternativesCoherenceAdvisory = extractDecisionCoherenceAdvisoryText(alternatives.summary);

  assert.ok(candidate);
  assert.match(candidate.summary, /This path is structurally ready for execution\./);
  assert.match(alternatives.summary, /selected path appears stable/i);
  assert.equal(
    candidateAdvisory,
    "Descriptor view: aligns with audio-analysis (spectral-window shape)."
  );
  assert.equal(
    alternativesAdvisory,
    "Descriptor view: describes a media-segmentation pattern with temporal-window shape."
  );
  assert.equal(
    candidateReadinessAdvisory,
    "Readiness view: steady signal from low pressure, neutral pattern, unmeasured alignment, high alternative confidence, and neutral projection."
  );
  assert.equal(
    alternativesReadinessAdvisory,
    "Readiness view: steady signal from low pressure, neutral pattern, unmeasured alignment, high alternative confidence, and neutral projection."
  );
  assert.equal(
    candidateBridgeAdvisory,
    "Execution bridge: This path maps to librosa using spectral_features_analysis, with a spectral-window shaped input and time-series output."
  );
  assert.equal(
    alternativesBridgeAdvisory,
    "Execution bridge: This path maps to ffmpeg using temporal_window_scan, with a temporal-window shaped input and segment output."
  );
  assert.equal(
    candidateCoherenceAdvisory,
    "Coherence view: Signals are mixed, with trade-offs between stability and coverage."
  );
  assert.equal(
    alternativesCoherenceAdvisory,
    "Coherence view: Signals are mixed, with trade-offs between stability and coverage."
  );
  assert.equal(countOccurrences(candidate?.summary ?? "", "Readiness view:"), 1);
  assert.equal(countOccurrences(alternatives.summary, "Readiness view:"), 1);
  assert.equal(countOccurrences(candidate?.summary ?? "", "Execution bridge:"), 1);
  assert.equal(countOccurrences(alternatives.summary, "Execution bridge:"), 1);
  assert.equal(countOccurrences(candidate?.summary ?? "", "Coherence view:"), 1);
  assert.equal(countOccurrences(alternatives.summary, "Coherence view:"), 1);
  assert.equal(
    (candidate?.summary ?? "").indexOf(candidateAdvisory) <
      (candidate?.summary ?? "").indexOf(candidateReadinessAdvisory),
    true
  );
  assert.equal(
    (candidate?.summary ?? "").indexOf(candidateReadinessAdvisory) <
      (candidate?.summary ?? "").indexOf(candidateBridgeAdvisory),
    true
  );
  assert.equal(
    (candidate?.summary ?? "").indexOf(candidateBridgeAdvisory) <
      (candidate?.summary ?? "").indexOf(candidateCoherenceAdvisory),
    true
  );
  assert.equal(
    alternatives.summary.indexOf(alternativesAdvisory) <
      alternatives.summary.indexOf(alternativesReadinessAdvisory),
    true
  );
  assert.equal(
    alternatives.summary.indexOf(alternativesReadinessAdvisory) <
      alternatives.summary.indexOf(alternativesBridgeAdvisory),
    true
  );
  assert.equal(
    alternatives.summary.indexOf(alternativesBridgeAdvisory) <
      alternatives.summary.indexOf(alternativesCoherenceAdvisory),
    true
  );

  const localizedCandidate = buildExecutionCandidateFromResolved({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    activeSelection: chain.selection,
    inspectionMode: "audio",
    locale: "tr",
    sourceKind: "audio",
  });
  const localizedAlternatives = buildExecutionAlternatives({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionReflection: chain.reflection,
    activeSelection: chain.selection,
    inspectionMode: "audio",
    locale: "tr",
    sourceKind: "audio",
  });

  assert.ok(localizedCandidate);
  assert.notEqual(localizedCandidate.summary, candidate?.summary);
  assert.notEqual(localizedAlternatives.summary, alternatives.summary);
  assert.equal(localizedCandidate.status, candidate.status);
  assert.equal(localizedCandidate.confidence, candidate.confidence);
  assert.notDeepEqual(localizedAlternatives.alternatives, alternatives.alternatives);
  assert.doesNotMatch(
    [
      localizedCandidate.summary,
      ...(localizedCandidate.notes ?? []),
      localizedAlternatives.summary,
      ...localizedAlternatives.alternatives.flatMap(function (alternative) {
        return [alternative.label, alternative.summary, alternative.tradeoff];
      }),
      localizedAlternatives.comparisonNote ?? "",
    ].join(" "),
    /This path may require|Readiness status is|Payload preview asks|Broader segment review|An alternative approach|The selected path still needs review/
  );
  assert.equal(countLocalizedAdvisories(candidate.summary, "en"), 4);
  assert.equal(countLocalizedAdvisories(localizedCandidate.summary, "tr"), 4);
  assert.equal(countLocalizedAdvisories(alternatives.summary, "en"), 4);
  assert.equal(countLocalizedAdvisories(localizedAlternatives.summary, "tr"), 4);
  assertLocalizedAdvisoryOrder(candidate.summary, "en");
  assertLocalizedAdvisoryOrder(localizedCandidate.summary, "tr");
  assertLocalizedAdvisoryOrder(alternatives.summary, "en");
  assertLocalizedAdvisoryOrder(localizedAlternatives.summary, "tr");
  assert.doesNotMatch(
    `${localizedCandidate.summary} ${localizedAlternatives.summary}`,
    /descriptor\.view|readiness\.view|bridge\.view|coherence\.(view|aligned|mixed|conflicted)/
  );
  assert.doesNotMatch(candidateAdvisory, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(alternativesAdvisory, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(candidateReadinessAdvisory, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(alternativesReadinessAdvisory, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(candidateBridgeAdvisory, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(alternativesBridgeAdvisory, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(candidateCoherenceAdvisory, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.doesNotMatch(alternativesCoherenceAdvisory, DESCRIPTOR_EXECUTION_VERB_PATTERN);
  assert.equal(hasObjectKey(candidate, "descriptor"), false);
  assert.equal(hasObjectKey(candidate, "readinessSignal"), false);
  assert.equal(hasObjectKey(candidate, "signal"), false);
  assert.equal(hasObjectKey(candidate, "adapter"), false);
  assert.equal(hasObjectKey(candidate, "operation"), false);
  assert.equal(hasObjectKey(candidate, "inputContract"), false);
  assert.equal(hasObjectKey(candidate, "outputContract"), false);
  assert.equal(hasObjectKey(candidate, "tool"), false);
  assert.equal(hasObjectKey(candidate, "intent"), false);
  assert.equal(hasObjectKey(candidate, "paramShape"), false);
  assert.equal(hasObjectKey(candidate, "level"), false);
  assert.equal(hasObjectKey(candidate, "reasons"), false);
  assert.equal(hasObjectKey(candidate, "coherence"), false);
  assert.equal(hasObjectKey(candidate, "dominantAxis"), false);
  assert.equal(hasObjectKey(candidate, "coherenceState"), false);
  assert.equal(hasObjectKey(candidate, "coherenceConfidence"), false);
  assert.equal(hasObjectKey(alternatives, "descriptor"), false);
  assert.equal(hasObjectKey(alternatives, "readinessSignal"), false);
  assert.equal(hasObjectKey(alternatives, "signal"), false);
  assert.equal(hasObjectKey(alternatives, "adapter"), false);
  assert.equal(hasObjectKey(alternatives, "operation"), false);
  assert.equal(hasObjectKey(alternatives, "inputContract"), false);
  assert.equal(hasObjectKey(alternatives, "outputContract"), false);
  assert.equal(hasObjectKey(alternatives, "tool"), false);
  assert.equal(hasObjectKey(alternatives, "intent"), false);
  assert.equal(hasObjectKey(alternatives, "paramShape"), false);
  assert.equal(hasObjectKey(alternatives, "level"), false);
  assert.equal(hasObjectKey(alternatives, "reasons"), false);
  assert.equal(hasObjectKey(alternatives, "coherence"), false);
  assert.equal(hasObjectKey(alternatives, "dominantAxis"), false);
  assert.equal(hasObjectKey(alternatives, "coherenceState"), false);
  assert.equal(hasObjectKey(alternatives, "coherenceConfidence"), false);
});

test("execution alternatives re-weight summary tone without changing structure", () => {
  const selection: LabSelection = {
    id: "selection-alternatives-feedback",
    startMs: 1000,
    endMs: 3600,
    type: "inspect",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const stableFeedback = buildExecutionAlternatives({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionReflection: chain.reflection,
    executionResultInterpretation: {
      alignment: "matches-simulation",
      anomalyLevel: "moderate",
      coverageLevel: "high",
    },
    activeSelection: chain.selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const divergentFeedback = buildExecutionAlternatives({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionReflection: chain.reflection,
    executionResultInterpretation: {
      alignment: "deviates",
      anomalyLevel: "high",
      coverageLevel: "high",
    },
    activeSelection: chain.selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });

  assert.deepEqual(stableFeedback.alternatives, chain.alternatives.alternatives);
  assert.deepEqual(divergentFeedback.alternatives, chain.alternatives.alternatives);
  assert.match(stableFeedback.summary, /current path stability/i);
  assert.match(stableFeedback.comparisonNote ?? "", /backup routes/i);
  assert.match(divergentFeedback.summary, /alternative paths may yield better outcomes/i);
  assert.match(divergentFeedback.comparisonNote ?? "", /improve coverage or reduce divergence/i);
});

test("execution alternatives cover known action mappings and fallback", () => {
  const videoSelection: LabSelection = {
    id: "selection-alternatives-video",
    startMs: 2000,
    endMs: 5200,
    type: "inspect",
    intent: "motion",
    roi: {
      x: 0.18,
      y: 0.18,
      width: 0.24,
      height: 0.28,
    },
    createdAt: 1,
  };
  const extractChain = createExecutionAlternativesChain({
    actionType: "extract-clip",
    inspectionMode: "visual",
    selection: videoSelection,
    sourceKind: "video",
    suggestionId: "extract-clip",
  });
  const motionChain = createExecutionAlternativesChain({
    actionType: "inspect-motion",
    inspectionMode: "motion",
    selection: videoSelection,
    sourceKind: "video",
    suggestionId: "inspect-motion",
  });
  const visualChain = createExecutionAlternativesChain({
    actionType: "enhance-visual",
    inspectionMode: "visual",
    selection: videoSelection,
    sourceKind: "video",
    suggestionId: "enhance-visual",
  });
  const stabilizeChain = createExecutionAlternativesChain({
    actionType: "stabilize-segment",
    inspectionMode: "motion",
    selection: videoSelection,
    sourceKind: "video",
    suggestionId: "stabilize-segment",
  });
  const fallbackChain = createExecutionAlternativesChain({
    actionType: "unknown-action" as unknown as LabActionSuggestion["actionType"],
    inspectionMode: "none",
    selection: videoSelection,
    sourceKind: "video",
    suggestionId: "unknown-action",
  });

  assert.equal(extractChain.alternatives.alternatives[0]?.actionType, "analyze-segment");
  assert.equal(
    extractChain.alternatives.alternatives.some(function (alternative) {
      return alternative.relativeAdvantage === "lower-risk";
    }),
    true
  );
  assert.equal(
    motionChain.alternatives.alternatives.some(function (alternative) {
      return alternative.actionType === "slow-playback-inspection";
    }),
    true
  );
  assert.equal(
    visualChain.alternatives.alternatives.some(function (alternative) {
      return alternative.actionType === "stabilize-segment";
    }),
    true
  );
  assert.equal(
    stabilizeChain.alternatives.alternatives.some(function (alternative) {
      return alternative.actionType === "inspect-motion";
    }),
    true
  );
  assert.deepEqual(
    fallbackChain.alternatives.alternatives.map(function (alternative) {
      return alternative.actionType;
    }),
    ["analyze-segment", "generic-narrowed-inspection"]
  );
});

test("execution alternatives are derived only from the complete active reflection chain", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });

  assert.equal(getActiveExecutionAlternatives(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-queued",
    suggestionId: "audio-inspect",
  });
  assert.equal(getActiveExecutionAlternatives(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });

  const activePlan = getActiveExecutionPlan(store.getState());
  const activeAlternatives = getActiveExecutionAlternatives(store.getState());
  assert.equal(activeAlternatives?.id, `alternatives:${activePlan?.id}`);
  assert.equal(activeAlternatives?.planId, activePlan?.id);
  assert.equal((activeAlternatives?.alternatives.length ?? 0) > 0, true);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-cleared",
  });
  assert.equal(getActiveExecutionAlternatives(store.getState())?.id, activeAlternatives?.id);

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1500,
    endMs: 2800,
  });
  assert.equal(getActiveExecutionAlternatives(store.getState()), null);
});

test("execution alternatives helper returns null for missing upstream objects", () => {
  const selection: LabSelection = {
    id: "selection-alternatives-missing",
    startMs: 1000,
    endMs: 3000,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });

  assert.equal(
    buildExecutionAlternativesFromResolved({
      executionPlan: null,
      executionSimulation: chain.simulation,
      executionReadiness: chain.readiness,
      executionReflection: chain.reflection,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
  assert.equal(
    buildExecutionAlternativesFromResolved({
      executionPlan: chain.plan,
      executionSimulation: null,
      executionReadiness: chain.readiness,
      executionReflection: chain.reflection,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
  assert.equal(
    buildExecutionAlternativesFromResolved({
      executionPlan: chain.plan,
      executionSimulation: chain.simulation,
      executionReadiness: null,
      executionReflection: chain.reflection,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
  assert.equal(
    buildExecutionAlternativesFromResolved({
      executionPlan: chain.plan,
      executionSimulation: chain.simulation,
      executionReadiness: chain.readiness,
      executionReflection: null,
      activeSelection: selection,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
  assert.equal(
    buildExecutionAlternativesFromResolved({
      executionPlan: chain.plan,
      executionSimulation: chain.simulation,
      executionReadiness: chain.readiness,
      executionReflection: chain.reflection,
      activeSelection: null,
      inspectionMode: "audio",
      sourceKind: "audio",
    }),
    null
  );
});

test("execution candidate synthesizes structural viability without downgrading stable alternatives", () => {
  const proceedSelection: LabSelection = {
    id: "selection-candidate-proceed",
    startMs: 1000,
    endMs: 3600,
    type: "inspect",
    intent: "audio",
    roi: {
      x: 0.2,
      y: 0.24,
      width: 0.22,
      height: 0.24,
    },
    createdAt: 1,
  };
  const proceedChain = createExecutionAlternativesChain({
    actionType: "analyze-segment",
    inspectionMode: "audio",
    selection: proceedSelection,
    sourceKind: "video",
    suggestionId: "analyze-segment",
  });
  const proceedCandidate = buildExecutionCandidateFromResolved({
    executionPlan: proceedChain.plan,
    executionSimulation: proceedChain.simulation,
    executionReadiness: proceedChain.readiness,
    executionPayloadPreview: proceedChain.payload,
    executionReflection: proceedChain.reflection,
    executionAlternatives: proceedChain.alternatives,
    activeSelection: proceedChain.selection,
    inspectionMode: "audio",
    sourceKind: "video",
  });
  const proceedRepeat = buildExecutionCandidateFromResolved({
    executionPlan: proceedChain.plan,
    executionSimulation: proceedChain.simulation,
    executionReadiness: proceedChain.readiness,
    executionPayloadPreview: proceedChain.payload,
    executionReflection: proceedChain.reflection,
    executionAlternatives: proceedChain.alternatives,
    activeSelection: proceedChain.selection,
    inspectionMode: "audio",
    sourceKind: "video",
  });

  assert.ok(proceedCandidate);
  assert.ok(proceedRepeat);
  assert.deepEqual(proceedCandidate, proceedRepeat);
  assert.equal(proceedCandidate.id, `candidate:${proceedChain.plan.id}`);
  assert.equal(proceedCandidate.status, "viable");
  assert.equal(proceedCandidate.structuralIntegrity, "complete");
  assert.equal(proceedCandidate.readinessStatus, "ready");
  assert.equal(proceedCandidate.reflectionDecision, "proceed");
  assert.equal(proceedCandidate.uncertainties, undefined);
  assert.match(proceedCandidate.summary, /^Proceed with caution: /);
  assert.match(proceedCandidate.summary, /structurally ready/i);
  assert.equal(proceedChain.alternatives.alternatives.length > 0, true);

  const reviewSelection: LabSelection = {
    id: "selection-candidate-review",
    startMs: 1000,
    endMs: 18000,
    type: "clip",
    intent: "visual",
    roi: {
      x: 0.04,
      y: 0.04,
      width: 0.82,
      height: 0.82,
    },
    createdAt: 1,
  };
  const reviewChain = createExecutionAlternativesChain({
    actionType: "focus-region",
    inspectionMode: "visual",
    selection: reviewSelection,
    sourceKind: "video",
    suggestionId: "inspect-region",
  });
  const reviewCandidate = buildExecutionCandidateFromResolved({
    executionPlan: reviewChain.plan,
    executionSimulation: reviewChain.simulation,
    executionReadiness: reviewChain.readiness,
    executionPayloadPreview: reviewChain.payload,
    executionReflection: reviewChain.reflection,
    executionAlternatives: reviewChain.alternatives,
    activeSelection: reviewChain.selection,
    inspectionMode: "visual",
    sourceKind: "video",
  });

  assert.ok(reviewCandidate);
  assert.equal(reviewCandidate.status, "unstable");
  assert.equal(reviewCandidate.structuralIntegrity, "partial");
  assert.equal(reviewCandidate.readinessStatus, "needs-review");
  assert.equal(reviewCandidate.reflectionDecision, "review");
  assert.match(reviewCandidate.uncertainties?.join(" ") || "", /warning|tradeoffs|risk/i);

  const avoidSelection: LabSelection = {
    id: "selection-candidate-avoid",
    startMs: 1000,
    endMs: 2600,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const avoidChain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    audioFocus: createTestAudioFocusSettings({ gain: 2.6 }),
    inspectionMode: "audio",
    selection: avoidSelection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const avoidCandidate = buildExecutionCandidateFromResolved({
    executionPlan: avoidChain.plan,
    executionSimulation: avoidChain.simulation,
    executionReadiness: avoidChain.readiness,
    executionPayloadPreview: avoidChain.payload,
    executionReflection: avoidChain.reflection,
    executionAlternatives: avoidChain.alternatives,
    activeSelection: avoidChain.selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });

  assert.ok(avoidCandidate);
  assert.equal(avoidCandidate.status, "not-viable");
  assert.equal(avoidCandidate.structuralIntegrity, "insufficient");
  assert.equal(avoidCandidate.readinessStatus, "blocked");
  assert.equal(avoidCandidate.reflectionDecision, "avoid");
});

test("execution candidate adjusts confidence from interpreted result without changing status", () => {
  const selection: LabSelection = {
    id: "selection-candidate-feedback",
    startMs: 1000,
    endMs: 3600,
    type: "inspect",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const baseInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    activeSelection: chain.selection,
    inspectionMode: "audio" as const,
    sourceKind: "audio",
  };
  const baseCandidate = buildExecutionCandidateFromResolved(baseInput);
  const alignedCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionResultInterpretation: {
      alignment: "matches-simulation" as const,
      anomalyLevel: "moderate" as const,
      coverageLevel: "high" as const,
    },
  });
  const partialCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionResultInterpretation: {
      alignment: "partial" as const,
      anomalyLevel: "moderate" as const,
      coverageLevel: "medium" as const,
    },
  });
  const deviatingCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionResultInterpretation: {
      alignment: "deviates" as const,
      anomalyLevel: "high" as const,
      coverageLevel: "high" as const,
    },
  });
  const clamp = function (value: number) {
    return Math.max(0.25, Math.min(0.98, Number(value.toFixed(2))));
  };

  assert.ok(baseCandidate);
  assert.ok(alignedCandidate);
  assert.ok(partialCandidate);
  assert.ok(deviatingCandidate);
  assert.equal(alignedCandidate.status, baseCandidate.status);
  assert.equal(partialCandidate.status, baseCandidate.status);
  assert.equal(deviatingCandidate.status, baseCandidate.status);
  assert.equal(alignedCandidate.confidence, clamp((baseCandidate.confidence ?? 0) + 0.04));
  assert.equal(partialCandidate.confidence, clamp((baseCandidate.confidence ?? 0) + 0.01));
  assert.equal(deviatingCandidate.confidence, 0.94);
  assert.equal((deviatingCandidate.confidence ?? 0) < (baseCandidate.confidence ?? 0), true);
});

test("execution candidate validates upstream coherence and payload preview shape", () => {
  const selection: LabSelection = {
    id: "selection-candidate-payload",
    startMs: 1000,
    endMs: 3000,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const baseInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    activeSelection: selection,
    inspectionMode: "audio" as const,
    sourceKind: "audio",
  };

  assert.equal(
    buildExecutionCandidateFromResolved({
      ...baseInput,
      executionSimulation: {
        ...chain.simulation,
        planId: "plan:mismatch",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionCandidateFromResolved({
      ...baseInput,
      executionReadiness: {
        ...chain.readiness,
        planId: "plan:mismatch",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionCandidateFromResolved({
      ...baseInput,
      executionPayloadPreview: {
        ...chain.payload,
        planId: "plan:mismatch",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionCandidateFromResolved({
      ...baseInput,
      executionReflection: {
        ...chain.reflection,
        planId: "plan:mismatch",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionCandidateFromResolved({
      ...baseInput,
      executionAlternatives: {
        ...chain.alternatives,
        planId: "plan:mismatch",
      },
    }),
    null
  );

  const createPayloadVariant = (
    patch: Partial<LabExecutionPayloadPreview>
  ): LabExecutionPayloadPreview => ({
    ...chain.payload,
    ...patch,
    dryRunShape: {
      ...chain.payload.dryRunShape,
      ...(patch.dryRunShape ?? {}),
    },
  });
  const emptyInputCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionPayloadPreview: createPayloadVariant({
      dryRunShape: {
        ...chain.payload.dryRunShape,
        previewInput: {},
      },
    }),
  });
  const emptyParametersCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionPayloadPreview: createPayloadVariant({
      dryRunShape: {
        ...chain.payload.dryRunShape,
        previewParameters: {},
      },
    }),
  });
  const emptyOutputsCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionPayloadPreview: createPayloadVariant({
      dryRunShape: {
        ...chain.payload.dryRunShape,
        previewExpectedOutputs: [],
      },
    }),
  });
  const readinessMismatchCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionPayloadPreview: createPayloadVariant({
      readinessPassesPreview: false,
    }),
  });
  const actionMismatchCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionPayloadPreview: createPayloadVariant({
      actionType: "focus-region",
    }),
  });

  assert.equal(emptyInputCandidate?.structuralIntegrity, "insufficient");
  assert.equal(emptyInputCandidate?.status, "not-viable");
  assert.equal(emptyParametersCandidate?.structuralIntegrity, "insufficient");
  assert.equal(emptyOutputsCandidate?.structuralIntegrity, "insufficient");
  assert.equal(readinessMismatchCandidate?.structuralIntegrity, "partial");
  assert.equal(readinessMismatchCandidate?.status, "unstable");
  assert.equal(actionMismatchCandidate?.structuralIntegrity, "insufficient");
  assert.equal(actionMismatchCandidate?.status, "not-viable");
});

test("execution candidate is derived only from the complete active alternatives chain", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });

  assert.equal(getActiveExecutionCandidate(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-queued",
    suggestionId: "audio-inspect",
  });
  assert.equal(getActiveExecutionCandidate(store.getState()), null);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });

  const activePlan = getActiveExecutionPlan(store.getState());
  const activeCandidate = getActiveExecutionCandidate(store.getState());
  assert.equal(activeCandidate?.id, `candidate:${activePlan?.id}`);
  assert.equal(activeCandidate?.planId, activePlan?.id);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-cleared",
  });
  assert.equal(getActiveExecutionCandidate(store.getState())?.id, activeCandidate?.id);

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1500,
    endMs: 2800,
  });
  assert.equal(getActiveExecutionCandidate(store.getState()), null);
});

test("execution candidate helper returns null for missing upstream objects", () => {
  const selection: LabSelection = {
    id: "selection-candidate-missing",
    startMs: 1000,
    endMs: 3000,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const baseInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    activeSelection: selection,
    inspectionMode: "audio" as const,
    sourceKind: "audio",
  };

  assert.equal(buildExecutionCandidateFromResolved({ ...baseInput, executionPlan: null }), null);
  assert.equal(
    buildExecutionCandidateFromResolved({ ...baseInput, executionSimulation: null }),
    null
  );
  assert.equal(
    buildExecutionCandidateFromResolved({ ...baseInput, executionReadiness: null }),
    null
  );
  assert.equal(
    buildExecutionCandidateFromResolved({ ...baseInput, executionPayloadPreview: null }),
    null
  );
  assert.equal(
    buildExecutionCandidateFromResolved({ ...baseInput, executionReflection: null }),
    null
  );
  assert.equal(
    buildExecutionCandidateFromResolved({ ...baseInput, executionAlternatives: null }),
    null
  );
  assert.equal(buildExecutionCandidateFromResolved({ ...baseInput, activeSelection: null }), null);
});

function createCommittedAudioExecutionStore(
  params: {
    endMs?: number;
    roi?: LabSelection["roi"];
    startMs?: number;
  } = {}
) {
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
    startMs: params.startMs ?? 1000,
    endMs: params.endMs ?? 3000,
  });
  if (params.roi !== undefined) {
    store.dispatch({
      type: "selection-roi-updated",
      roi: params.roi,
    });
  }
  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });

  const candidate = getActiveExecutionCandidate(store.getState());
  if (candidate === null || candidate.status === "not-viable") {
    throw new Error("Expected a committable execution candidate");
  }

  const beforeCommit = Date.now();
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: ` ${candidate.planId} `,
  });
  const afterCommit = Date.now();
  const commitment = store.getState().ui.activeExecutionCommitment;
  if (commitment === null) {
    throw new Error("Expected an active execution commitment");
  }

  return {
    afterCommit,
    beforeCommit,
    candidate,
    commitment,
    store,
  };
}

test("execution commitment is explicit, candidate-gated, and revocable", () => {
  const { afterCommit, beforeCommit, candidate, commitment, store } =
    createCommittedAudioExecutionStore();

  assert.equal(commitment.id, `commitment:${candidate.planId}`);
  assert.equal(commitment.planId, candidate.planId);
  assert.equal(commitment.status, "committed");
  assert.equal(commitment.candidateStatus, candidate.status);
  assert.equal(commitment.confidence, candidate.confidence);
  assert.deepEqual(commitment.notes, candidate.notes);
  assert.deepEqual(commitment.uncertainties, candidate.uncertainties);
  assert.equal(typeof commitment.committedAt, "number");
  assert.equal((commitment.committedAt ?? 0) >= beforeCommit, true);
  assert.equal((commitment.committedAt ?? 0) <= afterCommit, true);
  assert.equal(getActiveExecutionCommitment(store.getState())?.id, commitment.id);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-cleared",
  });
  assert.equal(getActiveExecutionCommitment(store.getState())?.id, commitment.id);

  store.dispatch({
    type: "workspace-execution-commitment-revoked",
  });
  assert.equal(store.getState().ui.activeExecutionCommitment, null);
  assert.equal(getActiveExecutionCommitment(store.getState()), null);
  assert.equal(store.getState().ui.activeExecutionIntentId, "audio-inspect");
});

test("execution commitment rejects missing, mismatched, stale, and not-viable candidates", () => {
  const emptyStore = createLabStore();
  emptyStore.dispatch({
    type: "workspace-execution-commitment-set",
    planId: "plan:missing",
  });
  assert.equal(emptyStore.getState().ui.activeExecutionCommitment, null);

  const { candidate, commitment, store } = createCommittedAudioExecutionStore();
  store.dispatch({
    type: "workspace-execution-commitment-revoked",
  });
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: "plan:mismatch",
  });
  assert.equal(store.getState().ui.activeExecutionCommitment, null);

  store.getState().ui.activeExecutionCommitment = {
    ...commitment,
    status: "revoked",
  } satisfies LabExecutionCommitment;
  assert.equal(getActiveExecutionCommitment(store.getState()), null);

  store.getState().ui.activeExecutionCommitment = {
    ...commitment,
    status: "committed",
    candidateStatus: candidate.status === "viable" ? "unstable" : "viable",
  };
  assert.equal(getActiveExecutionCommitment(store.getState()), null);

  const blockedStore = createLabStore();
  blockedStore.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "audio",
      mode: "local",
      storedPath: "/tmp/source.wav",
    },
  });
  blockedStore.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 2600,
  });
  blockedStore.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  blockedStore.dispatch({
    type: "workspace-audio-updated",
    patch: {
      gain: 2.6,
    },
  });
  blockedStore.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  blockedStore.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  const blockedCandidate = getActiveExecutionCandidate(blockedStore.getState());
  assert.equal(blockedCandidate?.status, "not-viable");
  blockedStore.dispatch({
    type: "workspace-execution-commitment-set",
    planId: blockedCandidate?.planId ?? "missing",
  });
  assert.equal(blockedStore.getState().ui.activeExecutionCommitment, null);
  assert.equal(getActiveExecutionCommitment(blockedStore.getState()), null);
});

test("execution commitment clears on upstream context changes but not preview clear", () => {
  const keepStore = createCommittedAudioExecutionStore();
  keepStore.store.dispatch({
    type: "workspace-selection-suggestion-preview-cleared",
  });
  assert.equal(
    getActiveExecutionCommitment(keepStore.store.getState())?.id,
    keepStore.commitment.id
  );

  const timelineStore = createCommittedAudioExecutionStore();
  timelineStore.store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1200,
    endMs: 3200,
  });
  assert.equal(timelineStore.store.getState().ui.activeExecutionCommitment, null);
  assert.equal(getActiveExecutionCommitment(timelineStore.store.getState()), null);

  const roiStore = createCommittedAudioExecutionStore();
  roiStore.store.dispatch({
    type: "selection-roi-updated",
    roi: {
      x: 0.2,
      y: 0.2,
      width: 0.24,
      height: 0.24,
    },
  });
  assert.equal(roiStore.store.getState().ui.activeExecutionCommitment, null);
  assert.equal(getActiveExecutionCommitment(roiStore.store.getState()), null);

  const inspectionStore = createCommittedAudioExecutionStore();
  inspectionStore.store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });
  assert.equal(inspectionStore.store.getState().ui.activeExecutionCommitment, null);
  assert.equal(getActiveExecutionCommitment(inspectionStore.store.getState()), null);

  const sourceStore = createCommittedAudioExecutionStore();
  sourceStore.store.dispatch({
    type: "source-config-patched",
    patch: {
      storedPath: "/tmp/next-source.wav",
    },
  });
  assert.equal(sourceStore.store.getState().ui.activeExecutionCommitment, null);
  assert.equal(getActiveExecutionCommitment(sourceStore.store.getState()), null);

  const intentStore = createCommittedAudioExecutionStore();
  intentStore.store.dispatch({
    type: "workspace-execution-intent-cleared",
  });
  assert.equal(intentStore.store.getState().ui.activeExecutionCommitment, null);
  assert.equal(getActiveExecutionCommitment(intentStore.store.getState()), null);
});

function createExecutionStagingChain(params: {
  actionType: LabActionSuggestion["actionType"];
  audioFocus?: LabAudioFocusSettings;
  inspectionMode: "none" | "visual" | "audio" | "motion";
  selection: LabSelection;
  sourceKind: string;
  suggestionId: string;
}) {
  const chain = createExecutionAlternativesChain(params);
  const candidate = buildExecutionCandidateFromResolved({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    activeSelection: chain.selection,
    inspectionMode: params.inspectionMode,
    sourceKind: params.sourceKind,
  });
  if (candidate === null) {
    throw new Error("Expected an execution candidate for staging tests");
  }
  const commitment: LabExecutionCommitment = {
    id: `commitment:${candidate.planId}`,
    planId: candidate.planId,
    status: "committed",
    candidateStatus: candidate.status,
    summary: "This path has been consciously chosen for passive staging.",
    committedAt: 1,
    notes: candidate.notes,
    uncertainties: candidate.uncertainties,
    confidence: candidate.confidence,
  };

  return {
    ...chain,
    candidate,
    commitment,
  };
}

test("execution staging derives a passive staged state from committed viable and unstable chains", () => {
  const selection: LabSelection = {
    id: "selection-staging-viable",
    startMs: 1000,
    endMs: 3600,
    type: "inspect",
    intent: "audio",
    roi: {
      x: 0.2,
      y: 0.24,
      width: 0.22,
      height: 0.24,
    },
    createdAt: 1,
  };
  const chain = createExecutionStagingChain({
    actionType: "analyze-segment",
    inspectionMode: "audio",
    selection,
    sourceKind: "video",
    suggestionId: "analyze-segment",
  });
  const baseInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    executionCandidate: chain.candidate,
    executionCommitment: chain.commitment,
    activeSelection: selection,
  };
  const staging = buildExecutionStagingFromResolved(baseInput);
  const repeat = buildExecutionStagingFromResolved(baseInput);

  assert.ok(staging);
  assert.deepEqual(staging, repeat);
  assert.equal(staging.id, `staging:${chain.plan.id}`);
  assert.equal(staging.planId, chain.plan.id);
  assert.equal(staging.status, "staged");
  assert.equal(staging.commitmentStatus, "committed");
  assert.equal(staging.candidateStatus, "viable");
  assert.equal(staging.readinessStatus, "ready");
  assert.match(staging.summary, /prepared and can be staged/i);

  const unstableCandidate = {
    ...chain.candidate,
    status: "unstable" as const,
  };
  const unstableStaging = buildExecutionStagingFromResolved({
    ...baseInput,
    executionCandidate: unstableCandidate,
    executionCommitment: {
      ...chain.commitment,
      candidateStatus: "unstable",
    },
  });
  assert.equal(unstableStaging?.status, "staged");
  assert.equal(unstableStaging?.candidateStatus, "unstable");
  assert.match(unstableStaging?.warnings?.join(" ") || "", /unstable/i);
});

test("execution staging returns null for invalid or stale upstream chains", () => {
  const selection: LabSelection = {
    id: "selection-staging-invalid",
    startMs: 1000,
    endMs: 3000,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionStagingChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const baseInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    executionCandidate: chain.candidate,
    executionCommitment: chain.commitment,
    activeSelection: selection,
  };

  assert.equal(
    buildExecutionStagingFromResolved({ ...baseInput, executionCommitment: null }),
    null
  );
  assert.equal(
    buildExecutionStagingFromResolved({
      ...baseInput,
      executionCommitment: {
        ...chain.commitment,
        status: "inactive",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionStagingFromResolved({
      ...baseInput,
      executionCommitment: {
        ...chain.commitment,
        status: "revoked",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionStagingFromResolved({
      ...baseInput,
      executionCandidate: {
        ...chain.candidate,
        status: "not-viable",
      },
      executionCommitment: {
        ...chain.commitment,
        candidateStatus: "not-viable",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionStagingFromResolved({
      ...baseInput,
      executionReadiness: {
        ...chain.readiness,
        status: "blocked",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionStagingFromResolved({
      ...baseInput,
      executionPayloadPreview: {
        ...chain.payload,
        planId: "plan:mismatch",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionStagingFromResolved({
      ...baseInput,
      executionCommitment: {
        ...chain.commitment,
        candidateStatus: chain.candidate.status === "viable" ? "unstable" : "viable",
      },
    }),
    null
  );
  assert.equal(
    buildExecutionStagingFromResolved({
      ...baseInput,
      activeSelection: {
        ...selection,
        endMs: selection.startMs,
      },
    }),
    null
  );
});

test("execution staging can represent a coherent committed path that is not staged yet", () => {
  const selection: LabSelection = {
    id: "selection-staging-review",
    startMs: 1000,
    endMs: 18000,
    type: "clip",
    intent: "visual",
    roi: {
      x: 0.04,
      y: 0.04,
      width: 0.82,
      height: 0.82,
    },
    createdAt: 1,
  };
  const chain = createExecutionStagingChain({
    actionType: "focus-region",
    inspectionMode: "visual",
    selection,
    sourceKind: "video",
    suggestionId: "inspect-region",
  });
  const staging = buildExecutionStagingFromResolved({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    executionCandidate: chain.candidate,
    executionCommitment: chain.commitment,
    activeSelection: selection,
  });

  assert.equal(chain.candidate.status, "unstable");
  assert.equal(chain.payload.readinessPassesPreview, false);
  assert.equal(staging?.status, "not-staged");
  assert.equal(staging?.readinessStatus, "needs-review");
  assert.match(staging?.warnings?.join(" ") || "", /readiness check|unstable/i);
});

test("execution staging is selector-derived and clears with its upstream chain", () => {
  const { commitment, store } = createCommittedAudioExecutionStore();
  const staging = getActiveExecutionStaging(store.getState());

  assert.ok(staging);
  assert.equal(staging.id, `staging:${commitment.planId}`);
  assert.equal(staging.status, "staged");

  store.dispatch({
    type: "workspace-selection-suggestion-preview-cleared",
  });
  assert.equal(getActiveExecutionStaging(store.getState())?.id, staging.id);

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1200,
    endMs: 3200,
  });
  assert.equal(getActiveExecutionStaging(store.getState()), null);
});

function completeMockExecutionRuntime(store: ReturnType<typeof createLabStore>) {
  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  if (dispatchCandidate === null) {
    throw new Error("Expected a dispatch candidate");
  }
  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });
  store.dispatch({
    type: "workspace-execution-progress",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    progress: 50,
  });
  store.dispatch({
    type: "workspace-execution-completed",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    result: createMockExecutionResult(dispatchCandidate),
  });
  return dispatchCandidate;
}

function completeExecutionRuntimeWithResult(
  store: ReturnType<typeof createLabStore>,
  result: LabExecutionResult
) {
  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  if (dispatchCandidate === null) {
    throw new Error("Expected a dispatch candidate");
  }
  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });
  store.dispatch({
    type: "workspace-execution-completed",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    result,
  });
  return dispatchCandidate;
}

function createAudioExecutionResult(params: {
  artifactCount?: number;
  confidence: number;
  coverage: number;
  summary?: string;
}): LabExecutionResult {
  const markerLabels = ["Frequency cluster marker", "Transient frequency marker"];
  return {
    summary: params.summary ?? "Inspected selected audio",
    insights: ["Frequency cluster detected"],
    artifacts: markerLabels.slice(0, params.artifactCount ?? 1).map(function (label) {
      return {
        type: "marker" as const,
        label,
      };
    }),
    metrics: {
      confidence: params.confidence,
      coverage: params.coverage,
    },
  };
}

function assertArtifactsInsideSelection(
  result: LabExecutionResult,
  candidate: LabExecutionDispatchCandidate
) {
  result.artifacts.forEach(function (artifact) {
    if (artifact.timeRange === undefined) {
      return;
    }
    assert.equal(
      artifact.timeRange.start >= candidate.selectionSnapshot.startMs,
      true,
      artifact.label
    );
    assert.equal(artifact.timeRange.end <= candidate.selectionSnapshot.endMs, true, artifact.label);
    assert.equal(artifact.timeRange.end >= artifact.timeRange.start, true, artifact.label);
  });
}

function withCandidateContext(
  candidate: LabExecutionDispatchCandidate,
  overrides: Partial<LabExecutionDispatchCandidate>
): LabExecutionDispatchCandidate {
  return {
    ...candidate,
    ...overrides,
    payloadPreview: {
      ...candidate.payloadPreview,
      ...(overrides.payloadPreview ?? {}),
    },
    selectionSnapshot: {
      ...candidate.selectionSnapshot,
      ...(overrides.selectionSnapshot ?? {}),
    },
    staging: {
      ...candidate.staging,
      ...(overrides.staging ?? {}),
    },
  };
}

test("execution result interpretation maps deterministic outcome buckets", () => {
  const selectionSnapshot = {
    endMs: 3000,
    inspectionMode: "audio" as const,
    intent: "audio" as const,
    sourceKind: "audio",
    startMs: 1000,
    type: "clip" as const,
  };
  const alignedResult = {
    actionType: "inspect-audio",
    selectionSnapshot,
    summary: "Inspected selected audio",
    insights: ["Frequency cluster detected"],
    artifacts: [
      {
        type: "marker" as const,
        label: "Frequency cluster marker",
        timeRange: { start: 1800, end: 1900 },
      },
    ],
    metrics: {
      coverage: 0.86,
      confidence: 0.82,
    },
  };

  assert.deepEqual(buildExecutionResultInterpretation(alignedResult), {
    alignment: "matches-simulation",
    anomalyLevel: "moderate",
    coverageLevel: "high",
  });
  assert.deepEqual(
    buildExecutionResultInterpretation({
      ...alignedResult,
      actionType: "analyze-segment",
      artifacts: [
        ...alignedResult.artifacts,
        {
          type: "marker" as const,
          label: "Boundary variance marker",
          timeRange: { start: 2100, end: 2200 },
        },
        {
          type: "marker" as const,
          label: "Mid-range anomaly marker",
          timeRange: { start: 2400, end: 2500 },
        },
      ],
      metrics: {
        coverage: 0.95,
        confidence: 0.9,
      },
    }),
    {
      alignment: "deviates",
      anomalyLevel: "high",
      coverageLevel: "high",
    }
  );
  assert.deepEqual(
    buildExecutionResultInterpretation({
      ...alignedResult,
      artifacts: [],
      metrics: {
        coverage: 0.4,
      },
    }),
    {
      alignment: "deviates",
      anomalyLevel: "none",
      coverageLevel: "low",
    }
  );
  assert.deepEqual(
    buildExecutionResultInterpretation({
      ...alignedResult,
      metrics: {
        coverage: 0.72,
      },
    }),
    {
      alignment: "partial",
      anomalyLevel: "moderate",
      coverageLevel: "medium",
    }
  );
});

test("execution goal evaluation maps deterministic action-aware outcomes", () => {
  const analyzeSelectionSnapshot = {
    endMs: 4200,
    inspectionMode: "none" as const,
    intent: "anomaly" as const,
    sourceKind: "video",
    startMs: 1200,
    type: "clip" as const,
  };
  const analyzeSuccessfulInput = {
    summary: "Analyzed selected segment",
    insights: ["Detected structural variation", "Potential anomaly in mid-range"],
    artifacts: [
      {
        type: "marker" as const,
        label: "Structural variation marker",
        timeRange: { start: 1700, end: 1800 },
      },
      {
        type: "marker" as const,
        label: "Mid-range anomaly marker",
        timeRange: { start: 2400, end: 2500 },
      },
      {
        type: "marker" as const,
        label: "Boundary variance marker",
        timeRange: { start: 3100, end: 3200 },
      },
    ],
    metrics: {
      coverage: 0.95,
      confidence: 0.9,
    },
    selectionSnapshot: analyzeSelectionSnapshot,
  };

  assert.deepEqual(
    getExecutionGoalEvaluation(analyzeSuccessfulInput, "analyze-segment"),
    getExecutionGoalEvaluation(analyzeSuccessfulInput, "analyze-segment")
  );
  assert.deepEqual(getExecutionGoalEvaluation(analyzeSuccessfulInput, "analyze-segment"), {
    outcome: "successful",
    goalAlignment: 0.95,
    summary: "Segment goal achieved through high-coverage anomaly detection",
  });
  assert.deepEqual(
    getExecutionGoalEvaluation(
      {
        ...analyzeSuccessfulInput,
        artifacts: [],
        metrics: {
          coverage: 0.4,
          confidence: 0.45,
        },
      },
      "analyze-segment"
    ),
    {
      outcome: "failed",
      goalAlignment: 0.25,
      summary: "Segment goal remains unmet because coverage is too limited",
    }
  );

  const focusSelectionSnapshot = {
    endMs: 3600,
    inspectionMode: "visual" as const,
    intent: "visual" as const,
    roi: {
      x: 0.15,
      y: 0.2,
      width: 0.3,
      height: 0.25,
    },
    sourceKind: "video",
    startMs: 1200,
    type: "inspect" as const,
  };
  assert.deepEqual(
    getExecutionGoalEvaluation(
      {
        summary: "Focused selected region",
        insights: ["Focused region shows localized activity"],
        artifacts: [
          {
            type: "annotation" as const,
            label: "Left upper ROI annotation",
            timeRange: { start: 2000, end: 2300 },
          },
        ],
        metrics: {
          coverage: 0.84,
          confidence: 0.82,
        },
        selectionSnapshot: focusSelectionSnapshot,
      },
      "focus-region"
    ),
    {
      outcome: "successful",
      goalAlignment: 0.9,
      summary: "Region goal achieved with high ROI coverage",
    }
  );
  assert.deepEqual(
    getExecutionGoalEvaluation(
      {
        summary: "Focused selected region",
        insights: ["Focused region shows localized activity"],
        artifacts: [
          {
            type: "annotation" as const,
            label: "Left upper ROI annotation",
            timeRange: { start: 2000, end: 2300 },
          },
        ],
        metrics: {
          coverage: 0.42,
          confidence: 0.67,
        },
        selectionSnapshot: focusSelectionSnapshot,
      },
      "focus-region"
    ),
    {
      outcome: "failed",
      goalAlignment: 0.25,
      summary: "Region goal remains unmet because ROI coverage is limited",
    }
  );
  assert.deepEqual(
    getExecutionGoalEvaluation(
      {
        summary: "Focused selected segment",
        insights: ["Focused segment remains region-neutral"],
        artifacts: [],
        metrics: {
          coverage: 0.72,
        },
      },
      "focus-region"
    ),
    {
      outcome: "neutral",
      goalAlignment: 0.5,
      summary: "Region goal remains neutral without an ROI snapshot",
    }
  );

  const audioSelectionSnapshot = {
    endMs: 3000,
    inspectionMode: "audio" as const,
    intent: "audio" as const,
    sourceKind: "audio",
    startMs: 1000,
    type: "clip" as const,
  };
  assert.deepEqual(
    getExecutionGoalEvaluation(
      {
        summary: "Inspected selected audio",
        insights: ["Frequency cluster detected"],
        artifacts: [
          {
            type: "marker" as const,
            label: "Frequency cluster marker",
            timeRange: { start: 1700, end: 1800 },
          },
          {
            type: "marker" as const,
            label: "Transient frequency marker",
            timeRange: { start: 2200, end: 2300 },
          },
        ],
        metrics: {
          coverage: 0.82,
          confidence: 0.79,
        },
        selectionSnapshot: audioSelectionSnapshot,
      },
      "inspect-audio"
    ),
    {
      outcome: "successful",
      goalAlignment: 0.88,
      summary: "Audio goal achieved through repeated frequency evidence",
    }
  );
  assert.deepEqual(
    getExecutionGoalEvaluation(
      {
        summary: "Inspected selected audio",
        insights: ["Frequency cluster detected"],
        artifacts: [
          {
            type: "marker" as const,
            label: "Frequency cluster marker",
            timeRange: { start: 1700, end: 1800 },
          },
        ],
        metrics: {
          coverage: 0.62,
          confidence: 0.52,
        },
        selectionSnapshot: audioSelectionSnapshot,
      },
      "inspect-audio"
    ),
    {
      outcome: "failed",
      goalAlignment: 0.25,
      summary: "Audio goal remains unmet because confidence is too low",
    }
  );
  assert.deepEqual(
    getExecutionGoalEvaluation(
      {
        summary: "Execution completed for selected context",
        insights: [],
        artifacts: [],
        metrics: {},
      },
      "enhance-visual"
    ),
    {
      outcome: "neutral",
      goalAlignment: 0.5,
      summary: "Goal evaluation remains neutral for this action",
    }
  );
});

test("execution dispatch candidate exists only for a valid committed staged chain", () => {
  const store = createLabStore();

  assert.equal(getExecutionDispatchCandidate(store.getState()), null);

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
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });

  assert.equal(getExecutionDispatchCandidate(store.getState()), null);

  const activeCandidate = getActiveExecutionCandidate(store.getState());
  assert.ok(activeCandidate);
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: activeCandidate.planId,
  });

  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(dispatchCandidate);
  assert.equal(dispatchCandidate.planId, activeCandidate.planId);
  assert.equal(dispatchCandidate.actionType, "inspect-audio");
  assert.equal(dispatchCandidate.payloadPreview.planId, activeCandidate.planId);
  assert.deepEqual(dispatchCandidate.selectionSnapshot, {
    endMs: 3000,
    inspectionMode: "none",
    intent: "audio",
    sourceKind: "audio",
    startMs: 1000,
    type: "clip",
  });
  assert.equal(dispatchCandidate.staging.status, "staged");
  assert.match(dispatchCandidate.dispatchId, /^dispatch:/);
  assert.equal("id" in dispatchCandidate.selectionSnapshot, false);
  assert.equal("createdAt" in dispatchCandidate.selectionSnapshot, false);

  const originalSelection = store.getState().ui.workspace.activeSelection;
  assert.ok(originalSelection);
  store.getState().ui.workspace.activeSelection = {
    ...originalSelection,
    id: "selection-transient-replacement",
    createdAt: originalSelection.createdAt + 9999,
  };
  const transientDispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(transientDispatchCandidate);
  assert.equal(transientDispatchCandidate.dispatchId, dispatchCandidate.dispatchId);

  store.dispatch({
    type: "workspace-execution-commitment-revoked",
  });
  assert.equal(getExecutionDispatchCandidate(store.getState()), null);
});

test("execution runtime lifecycle is identity-gated and exposes the active result", () => {
  const { store } = createCommittedAudioExecutionStore();
  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(dispatchCandidate);

  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: "dispatch:stale",
  });
  assert.equal(store.getState().ui.executionRuntime.status, "idle");

  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });
  assert.equal(store.getState().ui.executionRuntime.status, "running");
  assert.equal(store.getState().ui.executionRuntime.progress, 0);

  store.dispatch({
    type: "workspace-execution-progress",
    planId: dispatchCandidate.planId,
    dispatchId: "dispatch:stale",
    progress: 75,
  });
  assert.equal(store.getState().ui.executionRuntime.progress, 0);

  store.dispatch({
    type: "workspace-execution-progress",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    progress: 52.4,
  });
  assert.equal(store.getState().ui.executionRuntime.progress, 52);

  const result = createMockExecutionResult(dispatchCandidate);
  store.dispatch({
    type: "workspace-execution-completed",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    result,
  });
  assert.equal(store.getState().ui.executionRuntime.status, "completed");
  assert.equal(store.getState().ui.executionRuntime.progress, 100);
  assert.deepEqual(getActiveExecutionResult(store.getState()), {
    ...result,
    selectionSnapshot: dispatchCandidate.selectionSnapshot,
  });

  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });
  assert.equal(store.getState().ui.executionRuntime.status, "running");
  assert.equal(store.getState().ui.executionRuntime.result, undefined);
  assert.equal(getActiveExecutionResult(store.getState()), null);
});

test("completed execution result feeds passive reflection candidate and alternatives output", () => {
  const { candidate: baseCandidate, store } = createCommittedAudioExecutionStore();
  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(dispatchCandidate);
  const beforeReflection = getActiveExecutionReflection(store.getState());
  const beforeAlternatives = getActiveExecutionAlternatives(store.getState());
  assert.ok(beforeReflection);
  assert.ok(beforeAlternatives);
  const beforeDispatchId = dispatchCandidate.dispatchId;

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

  assert.deepEqual(getActiveExecutionResultInterpretation(store.getState()), {
    alignment: "partial",
    anomalyLevel: "moderate",
    coverageLevel: "medium",
  });
  assert.deepEqual(getActiveExecutionGoalEvaluation(store.getState()), {
    outcome: "neutral",
    goalAlignment: 0.55,
    summary: "Audio goal remains inconclusive for the current result",
  });
  const afterReflection = getActiveExecutionReflection(store.getState());
  const afterCandidate = getActiveExecutionCandidate(store.getState());
  const afterAlternatives = getActiveExecutionAlternatives(store.getState());
  const afterStaging = getActiveExecutionStaging(store.getState());
  const afterDispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(afterReflection);
  assert.ok(afterCandidate);
  assert.ok(afterAlternatives);
  assert.ok(afterStaging);
  assert.ok(afterDispatchCandidate);
  assert.equal(
    afterReflection.summary,
    `${beforeReflection.summary} Result partially aligns with simulated expectations Audio goal remains inconclusive for the current result`
  );
  assert.equal(afterCandidate.status, baseCandidate.status);
  assert.equal(
    afterCandidate.confidence,
    Math.max(0.25, Math.min(0.98, Number(((baseCandidate.confidence ?? 0) + 0.01).toFixed(2))))
  );
  assert.match(afterAlternatives.summary, /execution feedback is mixed/i);
  assert.match(afterAlternatives.comparisonNote ?? "", /mixed execution signal/i);
  assert.match(afterStaging.notes?.join(" ") ?? "", /mixed execution signal/i);
  assert.equal(afterStaging.status, "staged");
  assert.equal(afterDispatchCandidate.dispatchId, beforeDispatchId);
  assert.equal(getActiveExecutionResult(store.getState())?.summary, "Inspected selected audio");
  assert.match(
    afterAlternatives.summary,
    /Projected outcome suggests higher stability, better alignment, and stable coverage\./i
  );
  assert.doesNotMatch(afterCandidate.adaptiveDecisionHint, /Projected outcome suggests/i);
});

test("counterfactual projection stays hidden until execution completes", () => {
  const { store } = createCommittedAudioExecutionStore();
  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(dispatchCandidate);

  const beforeCandidate = getActiveExecutionCandidate(store.getState());
  const beforeAlternatives = getActiveExecutionAlternatives(store.getState());
  assert.ok(beforeCandidate);
  assert.ok(beforeAlternatives);
  assert.doesNotMatch(beforeCandidate.summary, /Projected outcome suggests/i);
  assert.doesNotMatch(beforeAlternatives.summary, /Projected outcome suggests/i);

  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });

  const runningCandidate = getActiveExecutionCandidate(store.getState());
  const runningAlternatives = getActiveExecutionAlternatives(store.getState());
  assert.ok(runningCandidate);
  assert.ok(runningAlternatives);
  assert.equal(getActiveExecutionResult(store.getState()), null);
  assert.doesNotMatch(runningCandidate.summary, /Projected outcome suggests/i);
  assert.doesNotMatch(runningAlternatives.summary, /Projected outcome suggests/i);

  store.dispatch({
    type: "workspace-execution-completed",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    result: createMockExecutionResult(dispatchCandidate),
  });

  const completedCandidate = getActiveExecutionCandidate(store.getState());
  const completedAlternatives = getActiveExecutionAlternatives(store.getState());
  assert.ok(completedCandidate);
  assert.ok(completedAlternatives);
  assert.match(completedAlternatives.summary, /Projected outcome suggests/i);
  assert.doesNotMatch(completedCandidate.adaptiveDecisionHint, /Projected outcome suggests/i);
});

test("session pattern awareness records completed samples idempotently", () => {
  __testOnlyResetExecutionPatternRegistry();

  const first = createCommittedAudioExecutionStore();
  completeExecutionRuntimeWithResult(
    first.store,
    createAudioExecutionResult({
      confidence: 0.52,
      coverage: 0.42,
    })
  );
  const firstEvaluation = getActiveExecutionGoalEvaluation(first.store.getState());
  assert.ok(firstEvaluation);
  assert.equal(firstEvaluation.patternSignal, undefined);

  getActiveExecutionGoalEvaluation(first.store.getState());
  getActiveExecutionCandidate(first.store.getState());
  getActiveExecutionAlternatives(first.store.getState());

  const dispatchCandidate = getExecutionDispatchCandidate(first.store.getState());
  assert.ok(dispatchCandidate);
  first.store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });
  first.store.dispatch({
    type: "workspace-execution-completed",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    result: createAudioExecutionResult({
      artifactCount: 2,
      confidence: 0.8,
      coverage: 0.86,
      summary: "Inspected selected audio again",
    }),
  });

  const rerunEvaluation = getActiveExecutionGoalEvaluation(first.store.getState());
  assert.ok(rerunEvaluation);
  assert.equal(rerunEvaluation.patternSignal?.executionCount, 1);
  assert.equal(rerunEvaluation.patternSignal?.strength, "weak");
  assert.match(rerunEvaluation.summary, /Historically similar evaluations show low coverage/);
  assert.equal(
    getActiveExecutionGoalEvaluation(first.store.getState())?.patternSignal?.executionCount,
    1
  );

  const next = createCommittedAudioExecutionStore();
  completeExecutionRuntimeWithResult(
    next.store,
    createAudioExecutionResult({
      artifactCount: 2,
      confidence: 0.82,
      coverage: 0.88,
      summary: "Inspected selected audio third pass",
    })
  );
  const nextEvaluation = getActiveExecutionGoalEvaluation(next.store.getState());
  assert.ok(nextEvaluation);
  assert.equal(nextEvaluation.patternSignal?.executionCount, 2);
  assert.equal(nextEvaluation.patternSignal?.successRatio, 0.5);
  assert.equal(nextEvaluation.patternSignal?.failureRatio, 0.5);
  assert.equal(nextEvaluation.patternSignal?.strength, "neutral");
  assert.doesNotMatch(nextEvaluation.summary, /Historically similar evaluations/);

  __testOnlyResetExecutionPatternRegistry();
});

test("session pattern awareness separates duration buckets roi presence and neutral ratios", () => {
  const weakResult = createAudioExecutionResult({
    confidence: 0.5,
    coverage: 0.4,
  });
  const strongResult = createAudioExecutionResult({
    artifactCount: 2,
    confidence: 0.82,
    coverage: 0.88,
  });

  const patternKeyForDuration = function (durationMs: number, hasRoi = false) {
    return __testOnlyBuildExecutionPatternKey({
      actionType: "inspect-audio",
      selectionSnapshot: {
        endMs: 1000 + durationMs,
        inspectionMode: "audio",
        intent: "audio",
        sourceKind: "audio",
        startMs: 1000,
        type: "clip",
        ...(hasRoi
          ? {
              roi: {
                x: 0.2,
                y: 0.2,
                width: 0.24,
                height: 0.24,
              },
            }
          : {}),
      },
    });
  };

  assert.notEqual(patternKeyForDuration(999), patternKeyForDuration(1000));
  assert.notEqual(patternKeyForDuration(4999), patternKeyForDuration(5000));
  assert.notEqual(patternKeyForDuration(14999), patternKeyForDuration(15000));
  assert.notEqual(patternKeyForDuration(2000), patternKeyForDuration(2000, true));

  __testOnlyResetExecutionPatternRegistry();
  const noRoiSeed = createCommittedAudioExecutionStore();
  completeExecutionRuntimeWithResult(noRoiSeed.store, weakResult);
  getActiveExecutionGoalEvaluation(noRoiSeed.store.getState());

  const roiCurrent = createCommittedAudioExecutionStore({
    roi: {
      x: 0.2,
      y: 0.2,
      width: 0.24,
      height: 0.24,
    },
  });
  completeExecutionRuntimeWithResult(roiCurrent.store, strongResult);
  assert.equal(
    getActiveExecutionGoalEvaluation(roiCurrent.store.getState())?.patternSignal,
    undefined
  );

  __testOnlyResetExecutionPatternRegistry();
  const neutralSeed = createCommittedAudioExecutionStore();
  completeExecutionRuntimeWithResult(
    neutralSeed.store,
    createAudioExecutionResult({
      confidence: 0.82,
      coverage: 0.9,
    })
  );
  getActiveExecutionGoalEvaluation(neutralSeed.store.getState());

  const neutralCurrent = createCommittedAudioExecutionStore();
  completeExecutionRuntimeWithResult(neutralCurrent.store, strongResult);
  const neutralPatternEvaluation = getActiveExecutionGoalEvaluation(
    neutralCurrent.store.getState()
  );
  assert.ok(neutralPatternEvaluation);
  assert.equal(neutralPatternEvaluation.patternSignal?.executionCount, 1);
  assert.equal(neutralPatternEvaluation.patternSignal?.successRatio, 0);
  assert.equal(neutralPatternEvaluation.patternSignal?.failureRatio, 0);
  assert.equal(neutralPatternEvaluation.patternSignal?.strength, "neutral");
  assert.doesNotMatch(neutralPatternEvaluation.summary, /Historically similar evaluations/);

  __testOnlyResetExecutionPatternRegistry();
});

test("session pattern signal softly biases candidate confidence and alternatives tone", () => {
  const selection: LabSelection = {
    id: "selection-pattern-signal-feedback",
    startMs: 1000,
    endMs: 3000,
    type: "clip",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const interpretation = {
    alignment: "matches-simulation" as const,
    anomalyLevel: "moderate" as const,
    coverageLevel: "high" as const,
  };
  const baseGoalEvaluation = {
    outcome: "successful" as const,
    goalAlignment: 0.88,
    summary: "Audio goal achieved through repeated frequency evidence",
  };
  const strongGoalEvaluation = {
    ...baseGoalEvaluation,
    patternSignal: {
      averageCoverage: 0.86,
      executionCount: 2,
      failureRatio: 0,
      strength: "strong" as const,
      successRatio: 1,
      note: "Historically similar evaluations usually complete successfully",
    },
  };
  const weakGoalEvaluation = {
    ...baseGoalEvaluation,
    patternSignal: {
      averageCoverage: 0.42,
      executionCount: 2,
      failureRatio: 1,
      strength: "weak" as const,
      successRatio: 0,
      note: "Historically similar evaluations show low coverage",
    },
  };
  const baseInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: {
      ...chain.reflection,
      confidence: 0.72,
    },
    executionAlternatives: chain.alternatives,
    activeSelection: chain.selection,
    inspectionMode: "audio" as const,
    sourceKind: "audio",
  };
  const baseCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionGoalEvaluation: baseGoalEvaluation,
    executionResultInterpretation: interpretation,
  });
  const strongCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionGoalEvaluation: strongGoalEvaluation,
    executionResultInterpretation: interpretation,
  });
  const weakCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionGoalEvaluation: weakGoalEvaluation,
    executionResultInterpretation: interpretation,
  });
  const strongAlternatives = buildExecutionAlternatives({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionReflection: chain.reflection,
    executionGoalEvaluation: strongGoalEvaluation,
    executionResultInterpretation: interpretation,
    activeSelection: chain.selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });
  const weakAlternatives = buildExecutionAlternatives({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionReflection: chain.reflection,
    executionGoalEvaluation: weakGoalEvaluation,
    executionResultInterpretation: interpretation,
    activeSelection: chain.selection,
    inspectionMode: "audio",
    sourceKind: "audio",
  });

  assert.ok(baseCandidate);
  assert.ok(strongCandidate);
  assert.ok(weakCandidate);
  assert.equal(baseCandidate.decisionPressure, "low");
  assert.equal(baseCandidate.adaptiveDecisionHint, "");
  assert.equal(strongCandidate.decisionPressure, "low");
  assert.equal(strongCandidate.adaptiveDecisionHint, "");
  assert.equal(weakCandidate.decisionPressure, "medium");
  assert.equal(
    weakCandidate.adaptiveDecisionHint,
    "Alternative strategies may yield more stable results. Consider comparing Slower temporal inspection for steadier context."
  );
  assert.match(weakCandidate.summary, /Alternative strategies may yield more stable results/);
  assert.match(weakCandidate.summary, /Slower temporal inspection/);
  assert.equal(strongCandidate.status, baseCandidate.status);
  assert.equal(weakCandidate.status, baseCandidate.status);
  assert.equal((strongCandidate.confidence ?? 0) > (baseCandidate.confidence ?? 0), true);
  assert.equal((weakCandidate.confidence ?? 0) < (baseCandidate.confidence ?? 0), true);
  assert.deepEqual(strongAlternatives.alternatives, chain.alternatives.alternatives);
  assert.deepEqual(weakAlternatives.alternatives, chain.alternatives.alternatives);
  assert.match(strongAlternatives.summary, /^Proceed: /);
  assert.match(weakAlternatives.summary, /^Proceed with caution: /);
  assert.match(strongAlternatives.summary, /historical execution feedback reinforces/i);
  assert.match(strongAlternatives.comparisonNote ?? "", /already stable pattern/i);
  assert.match(weakAlternatives.summary, /historical execution feedback shows similar paths/i);
  assert.match(
    weakAlternatives.summary,
    /A softer alternative to compare next is: Slower temporal inspection/i
  );
  assert.match(weakAlternatives.comparisonNote ?? "", /historically weak similar results/i);
  assert.match(weakAlternatives.comparisonNote ?? "", /Slower temporal inspection/i);
});

test("adaptive decision signal maps goal pattern and alignment deterministically", () => {
  const weakFailed = buildAdaptiveDecisionSignal({
    executionGoalEvaluation: {
      outcome: "failed",
      goalAlignment: 0.2,
      summary: "Goal failed",
      patternSignal: {
        averageCoverage: 0.42,
        executionCount: 2,
        failureRatio: 1,
        strength: "weak",
        successRatio: 0,
      },
    },
    executionResultInterpretation: {
      alignment: "matches-simulation",
    },
  });
  assert.deepEqual(weakFailed, {
    adaptiveDecisionHint: "This path has historically underperformed under similar conditions.",
    decisionPressure: "high",
  });

  const failedAndDeviates = buildAdaptiveDecisionSignal({
    executionGoalEvaluation: {
      outcome: "failed",
      goalAlignment: 0.25,
      summary: "Goal failed",
    },
    executionResultInterpretation: {
      alignment: "deviates",
    },
  });
  assert.deepEqual(failedAndDeviates, {
    adaptiveDecisionHint: "Current execution feedback indicates this path needs careful review.",
    decisionPressure: "high",
  });

  const weakPartial = buildAdaptiveDecisionSignal({
    executionGoalEvaluation: {
      outcome: "neutral",
      goalAlignment: 0.5,
      summary: "Goal inconclusive",
      patternSignal: {
        averageCoverage: 0.48,
        executionCount: 2,
        failureRatio: 0.5,
        strength: "weak",
        successRatio: 0.5,
      },
    },
    executionResultInterpretation: {
      alignment: "partial",
    },
  });
  assert.deepEqual(weakPartial, {
    adaptiveDecisionHint: "Alternative strategies may yield more stable results.",
    decisionPressure: "medium",
  });

  const strongSuccess = buildAdaptiveDecisionSignal({
    executionGoalEvaluation: {
      outcome: "successful",
      goalAlignment: 0.9,
      summary: "Goal achieved",
      patternSignal: {
        averageCoverage: 0.88,
        executionCount: 3,
        failureRatio: 0,
        strength: "strong",
        successRatio: 1,
      },
    },
    executionResultInterpretation: {
      alignment: "matches-simulation",
    },
  });
  assert.deepEqual(strongSuccess, {
    adaptiveDecisionHint: "",
    decisionPressure: "low",
  });

  assert.deepEqual(
    buildAdaptiveDecisionSignal({
      executionGoalEvaluation: {
        outcome: "successful",
        goalAlignment: 0.85,
        summary: "Goal achieved with weak history",
        patternSignal: {
          averageCoverage: 0.44,
          executionCount: 2,
          failureRatio: 0.5,
          strength: "weak",
          successRatio: 0.5,
        },
      },
      executionResultInterpretation: {
        alignment: "matches-simulation",
      },
    }),
    {
      adaptiveDecisionHint: "Alternative strategies may yield more stable results.",
      decisionPressure: "medium",
    }
  );
  assert.deepEqual(buildAdaptiveDecisionSignal({}), {
    adaptiveDecisionHint: "",
    decisionPressure: "low",
  });
});

test("decision posture compresses adaptive feedback into deterministic labels", () => {
  assert.deepEqual(
    buildDecisionPosture({
      decisionPressure: "low",
      executionGoalEvaluation: {
        outcome: "successful",
        goalAlignment: 0.9,
        summary: "Goal achieved",
        patternSignal: {
          averageCoverage: 0.88,
          executionCount: 3,
          failureRatio: 0,
          strength: "strong",
          successRatio: 1,
        },
      },
      executionResultInterpretation: {
        alignment: "matches-simulation",
      },
    }),
    {
      posture: "proceed",
      shortLabel: "Proceed",
    }
  );
  assert.deepEqual(
    buildDecisionPosture({
      decisionPressure: "high",
      executionGoalEvaluation: {
        outcome: "failed",
        goalAlignment: 0.2,
        summary: "Goal failed",
        patternSignal: {
          averageCoverage: 0.38,
          executionCount: 2,
          failureRatio: 1,
          strength: "weak",
          successRatio: 0,
        },
      },
      executionResultInterpretation: {
        alignment: "deviates",
      },
    }),
    {
      posture: "reconsider",
      shortLabel: "Reconsider",
    }
  );
  assert.deepEqual(
    buildDecisionPosture({
      decisionPressure: "low",
    }),
    {
      posture: "proceed-with-caution",
      shortLabel: "Proceed with caution",
    }
  );
  assert.deepEqual(
    buildDecisionPosture({
      decisionPressure: "medium",
      executionGoalEvaluation: {
        outcome: "successful",
        goalAlignment: 0.8,
        summary: "Goal achieved with divergence",
        patternSignal: {
          averageCoverage: 0.72,
          executionCount: 2,
          failureRatio: 0.5,
          strength: "neutral",
          successRatio: 0.5,
        },
      },
      executionResultInterpretation: {
        alignment: "deviates",
      },
    }),
    {
      posture: "proceed-with-caution",
      shortLabel: "Proceed with caution",
    }
  );
});

test("decision posture prefix formatter stays idempotent across rerenders", () => {
  const caution = buildDecisionPosture({
    decisionPressure: "low",
  });
  const proceed = buildDecisionPosture({
    decisionPressure: "low",
    executionGoalEvaluation: {
      outcome: "successful",
      goalAlignment: 0.9,
      summary: "Goal achieved",
      patternSignal: {
        averageCoverage: 0.88,
        executionCount: 3,
        failureRatio: 0,
        strength: "strong",
        successRatio: 1,
      },
    },
    executionResultInterpretation: {
      alignment: "matches-simulation",
    },
  });

  assert.equal(
    prependDecisionPostureLabel("This path is structurally ready for execution.", caution),
    "Proceed with caution: This path is structurally ready for execution."
  );
  assert.equal(
    prependDecisionPostureLabel(
      "Proceed with caution: This path is structurally ready for execution.",
      caution
    ),
    "Proceed with caution: This path is structurally ready for execution."
  );
  assert.equal(
    prependDecisionPostureLabel(
      "Reconsider: This path is structurally ready for execution.",
      proceed
    ),
    "Proceed: This path is structurally ready for execution."
  );
});

test("guided alternative signal ranks advisory alternatives deterministically", () => {
  const alternatives = [
    {
      actionType: "analyze-segment",
      label: "Broader segment review",
      relativeAdvantage: "higher-coverage" as const,
      summary: "Review broader context.",
      tradeoff: "Trades precision for coverage.",
    },
    {
      actionType: "stabilize-segment",
      label: "Stability-first comparison",
      relativeAdvantage: "more-stable" as const,
      summary: "Compare steadier evidence first.",
      tradeoff: "Trades immediacy for stability.",
    },
    {
      actionType: "focus-region",
      label: "Region-focused inspection",
      relativeAdvantage: "higher-precision" as const,
      summary: "Review the selected region.",
      tradeoff: "Trades coverage for precision.",
    },
  ];
  const highGuidance = buildGuidedAlternativeSignal({
    alternatives,
    alternativesConfidence: 0.72,
    decisionPressure: "high",
    executionGoalEvaluation: {
      outcome: "failed",
      goalAlignment: 0.2,
      summary: "Goal failed",
      patternSignal: {
        averageCoverage: 0.42,
        executionCount: 2,
        failureRatio: 1,
        strength: "weak",
        successRatio: 0,
      },
    },
    executionResultInterpretation: {
      alignment: "deviates",
    },
  });
  assert.deepEqual(highGuidance, {
    candidateGuidanceText: "Consider comparing Stability-first comparison for steadier context.",
    guidanceText:
      "A more stable alternative under current conditions is: Stability-first comparison.",
    preferredAlternativeIndex: 1,
    preferredAlternativeLabel: "Stability-first comparison",
  });

  const mediumGuidance = buildGuidedAlternativeSignal({
    alternatives,
    alternativesConfidence: 0.72,
    decisionPressure: "medium",
    executionGoalEvaluation: {
      outcome: "neutral",
      goalAlignment: 0.5,
      summary: "Goal inconclusive",
    },
    executionResultInterpretation: {
      alignment: "partial",
    },
  });
  assert.equal(mediumGuidance.preferredAlternativeLabel, "Stability-first comparison");
  assert.match(mediumGuidance.guidanceText, /A softer alternative to compare next is/);

  assert.deepEqual(
    buildGuidedAlternativeSignal({
      alternatives,
      decisionPressure: "low",
    }),
    {
      candidateGuidanceText: "",
      guidanceText: "",
      preferredAlternativeIndex: null,
      preferredAlternativeLabel: null,
    }
  );
  assert.deepEqual(
    buildGuidedAlternativeSignal({
      alternatives: [],
      decisionPressure: "high",
    }),
    {
      candidateGuidanceText: "",
      guidanceText: "",
      preferredAlternativeIndex: null,
      preferredAlternativeLabel: null,
    }
  );
  assert.equal(
    buildGuidedAlternativeSignal({
      alternatives: [
        {
          actionType: "a",
          label: "First equal path",
          relativeAdvantage: "higher-coverage",
          summary: "First.",
          tradeoff: "Equal.",
        },
        {
          actionType: "b",
          label: "Second equal path",
          relativeAdvantage: "higher-coverage",
          summary: "Second.",
          tradeoff: "Equal.",
        },
      ],
      decisionPressure: "high",
    }).preferredAlternativeIndex,
    0
  );
  assert.doesNotMatch(
    `${highGuidance.guidanceText} ${highGuidance.candidateGuidanceText}`,
    /\b(auto|commit|dispatch|execute|run|apply|switch|select|activate|choose)\b/i
  );
});

test("counterfactual projection remains deterministic and pressure-aware", () => {
  const selectionSnapshot = {
    endMs: 4400,
    inspectionMode: "visual" as const,
    intent: "visual" as const,
    sourceKind: "video",
    startMs: 1200,
    type: "inspect" as const,
  };
  const stableProjection = buildCounterfactualProjection(
    {
      actionType: "inspect-motion",
      label: "Motion continuity inspection",
      relativeAdvantage: "more-stable",
      summary: "Compare motion continuity.",
      tradeoff: "Trades still detail for steadier motion evidence.",
    },
    {
      decisionPressure: "high",
      executionGoalEvaluation: {
        outcome: "failed",
        goalAlignment: 0.2,
        summary: "Goal failed",
        patternSignal: {
          averageCoverage: 0.38,
          executionCount: 3,
          failureRatio: 1,
          strength: "weak",
          successRatio: 0,
        },
      },
      executionResult: {
        summary: "Focused region remained unstable",
        insights: ["Coverage remained narrow"],
        artifacts: [],
        metrics: {
          confidence: 0.44,
          coverage: 0.32,
        },
        selectionSnapshot,
      },
      executionResultInterpretation: {
        alignment: "deviates",
      },
    }
  );
  assert.deepEqual(stableProjection, {
    expectedCoverage: "increase",
    expectedAlignment: "better",
    expectedStability: "higher",
    summary:
      "Projected outcome suggests higher stability, better alignment, and increase coverage.",
  });
  assert.deepEqual(
    buildCounterfactualProjection(
      {
        actionType: "inspect-motion",
        label: "Motion continuity inspection",
        relativeAdvantage: "more-stable",
        summary: "Compare motion continuity.",
        tradeoff: "Trades still detail for steadier motion evidence.",
      },
      {
        decisionPressure: "high",
        executionGoalEvaluation: {
          outcome: "failed",
          goalAlignment: 0.2,
          summary: "Goal failed",
          patternSignal: {
            averageCoverage: 0.38,
            executionCount: 3,
            failureRatio: 1,
            strength: "weak",
            successRatio: 0,
          },
        },
        executionResult: {
          summary: "Focused region remained unstable",
          insights: ["Coverage remained narrow"],
          artifacts: [],
          metrics: {
            confidence: 0.44,
            coverage: 0.32,
          },
          selectionSnapshot,
        },
        executionResultInterpretation: {
          alignment: "deviates",
        },
      }
    ),
    stableProjection
  );
  assert.deepEqual(
    buildCounterfactualProjection(
      {
        actionType: "inspect-motion",
        label: "Motion continuity inspection",
        relativeAdvantage: "more-stable",
        summary: "Compare motion continuity.",
        tradeoff: "Trades still detail for steadier motion evidence.",
      },
      {}
    ),
    {
      expectedCoverage: "stable",
      expectedAlignment: "similar",
      expectedStability: "similar",
      summary: "",
    }
  );
  assert.deepEqual(
    buildCounterfactualProjection(
      {
        actionType: "analyze-segment",
        label: "Broader segment review",
        relativeAdvantage: "higher-coverage",
        summary: "Compare broader context.",
        tradeoff: "Trades precision for context.",
      },
      {
        executionResult: {
          summary: "Selected audio remained mixed",
          insights: [],
          artifacts: [],
          metrics: {
            coverage: 0.88,
          },
          selectionSnapshot: {
            endMs: 3000,
            inspectionMode: "audio",
            intent: "audio",
            sourceKind: "audio",
            startMs: 1000,
            type: "clip",
          },
        },
        executionResultInterpretation: {
          alignment: "matches-simulation",
        },
      }
    ),
    {
      expectedCoverage: "stable",
      expectedAlignment: "similar",
      expectedStability: "similar",
      summary: "",
    }
  );
});

test("goal-aware feedback stays additive when goal success coexists with divergent interpretation", () => {
  const selection: LabSelection = {
    id: "selection-goal-mixed-signal",
    startMs: 1200,
    endMs: 4200,
    type: "clip",
    intent: "anomaly",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "analyze-segment",
    inspectionMode: "none",
    selection,
    sourceKind: "video",
    suggestionId: "segment-analyze",
  });
  const interpretation = {
    alignment: "deviates" as const,
    anomalyLevel: "high" as const,
    coverageLevel: "high" as const,
  };
  const goalEvaluation = {
    outcome: "successful" as const,
    goalAlignment: 0.95,
    summary: "Segment goal achieved through high-coverage anomaly detection",
  };
  const executionResult = {
    summary: "Analyzed selected segment",
    insights: ["Detected structural variation", "Potential anomaly in mid-range"],
    artifacts: [
      {
        type: "marker" as const,
        label: "Structural variance marker",
        timeRange: { start: 1800, end: 2050 },
      },
    ],
    metrics: {
      confidence: 0.78,
      coverage: 0.84,
    },
    selectionSnapshot: {
      endMs: chain.selection.endMs,
      inspectionMode: "none" as const,
      intent: chain.selection.intent,
      sourceKind: "video",
      startMs: chain.selection.startMs,
      type: chain.selection.type,
    },
  };
  const baseInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    executionResult,
    activeSelection: chain.selection,
    inspectionMode: "none" as const,
    sourceKind: "video",
  };
  const interpretationOnlyCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionResultInterpretation: interpretation,
  });
  const mixedSignalCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionResultInterpretation: interpretation,
    executionGoalEvaluation: goalEvaluation,
  });
  const mixedSignalAlternatives = buildExecutionAlternatives({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionReflection: chain.reflection,
    executionResult,
    executionGoalEvaluation: goalEvaluation,
    executionResultInterpretation: interpretation,
    activeSelection: chain.selection,
    inspectionMode: "none",
    sourceKind: "video",
  });

  assert.ok(interpretationOnlyCandidate);
  assert.ok(mixedSignalCandidate);
  assert.equal(mixedSignalCandidate.decisionPressure, "medium");
  assert.equal(
    mixedSignalCandidate.adaptiveDecisionHint,
    "Alternative strategies may yield more stable results. Consider comparing Narrowed inspection window for steadier context."
  );
  assert.equal(mixedSignalCandidate.status, interpretationOnlyCandidate.status);
  assert.equal(
    (mixedSignalCandidate.confidence ?? 0) > (interpretationOnlyCandidate.confidence ?? 0),
    true
  );
  assert.deepEqual(mixedSignalAlternatives.alternatives, chain.alternatives.alternatives);
  assert.match(mixedSignalAlternatives.summary, /intended outcome was achieved/i);
  assert.match(mixedSignalAlternatives.summary, /diverges from simulation/i);
  assert.match(mixedSignalAlternatives.summary, /Narrowed inspection window/i);
  assert.match(
    mixedSignalAlternatives.summary,
    /Projected outcome suggests similar stability, better alignment, and decrease coverage\./i
  );
  assert.match(mixedSignalAlternatives.comparisonNote ?? "", /remaining divergence/i);
});

test("goal-aware feedback tightens failed outcomes without changing structure or status", () => {
  const selection: LabSelection = {
    id: "selection-goal-failed-branch",
    startMs: 1000,
    endMs: 3400,
    type: "inspect",
    intent: "visual",
    roi: {
      x: 0.18,
      y: 0.22,
      width: 0.24,
      height: 0.18,
    },
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "focus-region",
    inspectionMode: "visual",
    selection,
    sourceKind: "video",
    suggestionId: "inspect-region",
  });
  const interpretation = {
    alignment: "deviates" as const,
    anomalyLevel: "moderate" as const,
    coverageLevel: "low" as const,
  };
  const goalEvaluation = {
    outcome: "failed" as const,
    goalAlignment: 0.25,
    summary: "Region goal remains unmet because ROI coverage is limited",
  };
  const executionResult = {
    summary: "Focused region shows localized activity",
    insights: ["Focused region shows localized activity"],
    artifacts: [
      {
        type: "annotation" as const,
        label: "Localized activity annotation",
      },
    ],
    metrics: {
      confidence: 0.46,
      coverage: 0.28,
    },
    selectionSnapshot: {
      endMs: chain.selection.endMs,
      inspectionMode: "visual" as const,
      intent: chain.selection.intent,
      roi: chain.selection.roi,
      sourceKind: "video",
      startMs: chain.selection.startMs,
      type: chain.selection.type,
    },
  };
  const baseInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    executionResult,
    activeSelection: chain.selection,
    inspectionMode: "visual" as const,
    sourceKind: "video",
  };
  const interpretationOnlyCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionResultInterpretation: interpretation,
  });
  const failedGoalCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionResultInterpretation: interpretation,
    executionGoalEvaluation: goalEvaluation,
  });
  const conflictedGoalCandidate = buildExecutionCandidateFromResolved({
    ...baseInput,
    executionResult: null,
    executionResultInterpretation: interpretation,
    executionGoalEvaluation: {
      ...goalEvaluation,
      patternSignal: {
        averageCoverage: 0.28,
        executionCount: 3,
        failureRatio: 1,
        strength: "weak" as const,
        successRatio: 0,
      },
    },
  });
  const failedGoalAlternatives = buildExecutionAlternatives({
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionReflection: chain.reflection,
    executionResult,
    executionGoalEvaluation: goalEvaluation,
    executionResultInterpretation: interpretation,
    activeSelection: chain.selection,
    inspectionMode: "visual",
    sourceKind: "video",
  });

  assert.ok(interpretationOnlyCandidate);
  assert.ok(failedGoalCandidate);
  assert.ok(conflictedGoalCandidate);
  assert.equal(failedGoalCandidate.decisionPressure, "high");
  assert.equal(
    failedGoalCandidate.adaptiveDecisionHint,
    "Current execution feedback indicates this path needs careful review. Consider comparing Motion continuity inspection for steadier context. Projected outcome suggests higher stability, better alignment, and increase coverage."
  );
  assert.equal(failedGoalCandidate.status, interpretationOnlyCandidate.status);
  assert.equal(
    failedGoalCandidate.structuralIntegrity,
    interpretationOnlyCandidate.structuralIntegrity
  );
  assert.equal(failedGoalCandidate.id, interpretationOnlyCandidate.id);
  assert.equal(failedGoalCandidate.planId, interpretationOnlyCandidate.planId);
  assert.match(failedGoalCandidate.summary, /Current execution feedback indicates/);
  assert.match(failedGoalCandidate.summary, /Motion continuity inspection/);
  const conflictedCoherenceAdvisory = extractDecisionCoherenceAdvisoryText(
    conflictedGoalCandidate.summary
  );
  assert.match(conflictedCoherenceAdvisory, /Signals are conflicted/);
  assertSummaryOrder(conflictedGoalCandidate.summary, [
    extractDescriptorAdvisoryText(conflictedGoalCandidate.summary),
    extractReadinessSignalAdvisoryText(conflictedGoalCandidate.summary),
    extractExecutionBridgeAdvisoryText(conflictedGoalCandidate.summary),
    conflictedCoherenceAdvisory,
  ]);
  assert.equal(
    (failedGoalCandidate.confidence ?? 0) < (interpretationOnlyCandidate.confidence ?? 0),
    true
  );
  assert.deepEqual(failedGoalAlternatives.alternatives, chain.alternatives.alternatives);
  assert.match(failedGoalAlternatives.summary, /adaptive decision pressure is high/i);
  assert.match(failedGoalAlternatives.summary, /Motion continuity inspection/i);
  assert.match(
    failedGoalAlternatives.summary,
    /Projected outcome suggests higher stability, better alignment, and increase coverage\./i
  );
  assert.doesNotMatch(
    `${failedGoalAlternatives.summary} ${failedGoalAlternatives.comparisonNote ?? ""}`,
    /\b(auto|commit|dispatch|execute|run|apply|switch|select|activate|choose)\b/i
  );
  assert.match(failedGoalAlternatives.comparisonNote ?? "", /Motion continuity inspection/i);
});

test("decision posture integration stays additive and leaves inputs immutable", () => {
  const selection: LabSelection = {
    id: "selection-posture-immutable",
    startMs: 1200,
    endMs: 4400,
    type: "inspect",
    intent: "audio",
    createdAt: 1,
  };
  const chain = createExecutionAlternativesChain({
    actionType: "inspect-audio",
    inspectionMode: "audio",
    selection,
    sourceKind: "audio",
    suggestionId: "audio-inspect",
  });
  const executionGoalEvaluation = {
    outcome: "successful" as const,
    goalAlignment: 0.9,
    summary: "Audio goal achieved",
    patternSignal: {
      averageCoverage: 0.9,
      executionCount: 3,
      failureRatio: 0,
      strength: "strong" as const,
      successRatio: 1,
    },
  };
  const executionResultInterpretation = {
    alignment: "matches-simulation" as const,
    anomalyLevel: "moderate" as const,
    coverageLevel: "high" as const,
  };
  const candidateInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionPayloadPreview: chain.payload,
    executionReflection: chain.reflection,
    executionAlternatives: chain.alternatives,
    executionGoalEvaluation,
    executionResultInterpretation,
    activeSelection: chain.selection,
    inspectionMode: "audio" as const,
    sourceKind: "audio",
  };
  const alternativesInput = {
    executionPlan: chain.plan,
    executionSimulation: chain.simulation,
    executionReadiness: chain.readiness,
    executionReflection: chain.reflection,
    executionGoalEvaluation,
    executionResultInterpretation,
    activeSelection: chain.selection,
    inspectionMode: "audio" as const,
    sourceKind: "audio",
  };
  const frozenCandidateInput = deepFreeze(cloneForMutationCheck(candidateInput));
  const frozenAlternativesInput = deepFreeze(cloneForMutationCheck(alternativesInput));
  const candidateBefore = JSON.stringify(frozenCandidateInput);
  const alternativesBefore = JSON.stringify(frozenAlternativesInput);
  const candidate = buildExecutionCandidateFromResolved(frozenCandidateInput);
  const alternatives = buildExecutionAlternatives(frozenAlternativesInput);

  assert.ok(candidate);
  assert.equal(candidate.status, "viable");
  assert.equal(candidate.decisionPressure, "low");
  assert.equal(candidate.adaptiveDecisionHint, "");
  assert.equal(candidate.confidence, 0.98);
  assert.match(candidate.summary, /^Proceed: /);
  assert.match(alternatives.summary, /^Proceed: /);
  const candidateDescriptorAdvisory = extractDescriptorAdvisoryText(candidate.summary);
  const candidateReadinessAdvisory = extractReadinessSignalAdvisoryText(candidate.summary);
  const candidateBridgeAdvisory = extractExecutionBridgeAdvisoryText(candidate.summary);
  const candidateCoherenceAdvisory = extractDecisionCoherenceAdvisoryText(candidate.summary);
  const alternativesDescriptorAdvisory = extractDescriptorAdvisoryText(alternatives.summary);
  const alternativesReadinessAdvisory = extractReadinessSignalAdvisoryText(alternatives.summary);
  const alternativesBridgeAdvisory = extractExecutionBridgeAdvisoryText(alternatives.summary);
  const alternativesCoherenceAdvisory = extractDecisionCoherenceAdvisoryText(alternatives.summary);
  assert.match(candidateCoherenceAdvisory, /Signals are aligned/);
  assert.match(alternativesCoherenceAdvisory, /Signals are aligned/);
  assertSummaryOrder(candidate.summary, [
    candidateDescriptorAdvisory,
    candidateReadinessAdvisory,
    candidateBridgeAdvisory,
    candidateCoherenceAdvisory,
  ]);
  assertSummaryOrder(alternatives.summary, [
    alternativesDescriptorAdvisory,
    alternativesReadinessAdvisory,
    alternativesBridgeAdvisory,
    alternativesCoherenceAdvisory,
  ]);
  assert.deepEqual(alternatives.alternatives, chain.alternatives.alternatives);
  assert.equal(JSON.stringify(frozenCandidateInput), candidateBefore);
  assert.equal(JSON.stringify(frozenAlternativesInput), alternativesBefore);
});

test("execution dispatcher emits deterministic mock progress and cleans up stale timers", () => {
  const timerMock = installTimerMock();

  try {
    const { store } = createCommittedAudioExecutionStore();
    const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
    assert.ok(dispatchCandidate);
    const emitted: string[] = [];
    const dispatcher = createLabExecutionDispatcher({
      emit(event) {
        emitted.push(event.type);
        store.dispatch(event);
      },
    });

    dispatcher.sync(dispatchCandidate);

    assert.deepEqual(
      timerMock.scheduled.map((entry) => entry.delay),
      [375, 750, 1125, 1500]
    );
    assert.deepEqual(emitted, ["workspace-execution-dispatch"]);
    assert.equal(store.getState().ui.executionRuntime.status, "running");

    timerMock.scheduled[0]?.fn();
    assert.equal(store.getState().ui.executionRuntime.progress, 25);

    timerMock.scheduled[3]?.fn();
    assert.equal(store.getState().ui.executionRuntime.status, "completed");
    const completedResult = getActiveExecutionResult(store.getState());
    assert.ok(completedResult);
    assert.equal(completedResult.summary, "Inspected selected audio");
    assert.deepEqual(completedResult.insights, ["Frequency cluster detected"]);
    assert.equal(completedResult.artifacts.length, 1);
    assert.deepEqual(completedResult.selectionSnapshot, dispatchCandidate.selectionSnapshot);

    dispatcher.sync(dispatchCandidate);
    assert.equal(timerMock.scheduled.length, 4);
  } finally {
    timerMock.restore();
  }
});

test("execution mock materialization is deterministic and action-aware", () => {
  const { store } = createCommittedAudioExecutionStore();
  const baseCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(baseCandidate);

  const analyzeCandidate = withCandidateContext(baseCandidate, {
    actionType: "analyze-segment",
    payloadPreview: {
      ...baseCandidate.payloadPreview,
      actionType: "analyze-segment",
    },
    selectionSnapshot: {
      ...baseCandidate.selectionSnapshot,
      startMs: 1203,
      endMs: 4203,
      intent: "anomaly",
    },
  });
  const analyzeResult = createMockExecutionResult(analyzeCandidate);
  assert.deepEqual(analyzeResult, createMockExecutionResult(analyzeCandidate));
  assert.equal(analyzeResult.summary, "Analyzed selected segment");
  assert.deepEqual(analyzeResult.insights, [
    "Detected structural variation",
    "Potential anomaly in mid-range",
  ]);
  assert.equal(analyzeResult.artifacts.length, 3);
  assert.equal(analyzeResult.metrics.coverage, 0.95);
  assert.equal(analyzeResult.metrics.confidence, 0.9);
  assertArtifactsInsideSelection(analyzeResult, analyzeCandidate);

  const focusCandidate = withCandidateContext(baseCandidate, {
    actionType: "focus-region",
    payloadPreview: {
      ...baseCandidate.payloadPreview,
      actionType: "focus-region",
    },
    selectionSnapshot: {
      ...baseCandidate.selectionSnapshot,
      intent: "visual",
      roi: {
        x: 0.15,
        y: 0.2,
        width: 0.3,
        height: 0.25,
      },
    },
  });
  const focusResult = createMockExecutionResult(focusCandidate);
  assert.equal(focusResult.summary, "Focused selected region");
  assert.deepEqual(focusResult.insights, [
    "Focused region shows localized activity",
    "Tight ROI coverage",
  ]);
  assert.deepEqual(
    focusResult.artifacts.map(function (artifact) {
      return artifact.label;
    }),
    ["Left upper ROI annotation"]
  );
  assert.equal(focusResult.metrics.coverage, 0.76);
  assert.equal(focusResult.metrics.confidence, 0.82);
  assertArtifactsInsideSelection(focusResult, focusCandidate);

  const alternateFocusCandidate = withCandidateContext(focusCandidate, {
    selectionSnapshot: {
      ...focusCandidate.selectionSnapshot,
      roi: {
        x: 0.72,
        y: 0.12,
        width: 0.12,
        height: 0.12,
      },
    },
  });
  const alternateFocusResult = createMockExecutionResult(alternateFocusCandidate);
  assert.notDeepEqual(alternateFocusResult, focusResult);
  assert.deepEqual(alternateFocusResult.insights, [
    "Focused region shows localized activity",
    "Tight ROI coverage",
  ]);
  assert.deepEqual(
    alternateFocusResult.artifacts.map(function (artifact) {
      return artifact.label;
    }),
    ["Right upper ROI annotation"]
  );
  assert.equal(alternateFocusResult.metrics.coverage, 0.71);
  assert.equal(alternateFocusResult.metrics.confidence, 0.82);
  assertArtifactsInsideSelection(alternateFocusResult, alternateFocusCandidate);

  const audioResult = createMockExecutionResult(baseCandidate);
  assert.equal(audioResult.summary, "Inspected selected audio");
  assert.deepEqual(audioResult.insights, ["Frequency cluster detected"]);
  assert.equal(audioResult.artifacts[0]?.label, "Frequency cluster marker");
  assertArtifactsInsideSelection(audioResult, baseCandidate);

  const fallbackResult = createMockExecutionResult(
    withCandidateContext(baseCandidate, {
      actionType: "enhance-visual",
      payloadPreview: {
        ...baseCandidate.payloadPreview,
        actionType: "enhance-visual",
      },
    })
  );
  assert.deepEqual(fallbackResult, {
    summary: "Execution completed for selected context",
    insights: ["Local mock execution completed without action-specific materialization."],
    artifacts: [],
    metrics: {},
  });
});

test("focus-region materialization stays segment-scoped when ROI is absent", () => {
  const { store } = createCommittedAudioExecutionStore();
  const baseCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(baseCandidate);
  const focusCandidate = withCandidateContext(baseCandidate, {
    actionType: "focus-region",
    payloadPreview: {
      ...baseCandidate.payloadPreview,
      actionType: "focus-region",
    },
    selectionSnapshot: {
      ...baseCandidate.selectionSnapshot,
      intent: "visual",
      roi: undefined,
    },
  });

  const result = createMockExecutionResult(focusCandidate);

  assert.equal(result.summary, "Focused selected segment");
  assert.deepEqual(result.insights, ["Focused segment remains region-neutral"]);
  assert.deepEqual(result.artifacts, [
    {
      type: "annotation",
      label: "Segment-scoped focus annotation",
      timeRange: {
        start: focusCandidate.selectionSnapshot.startMs,
        end: focusCandidate.selectionSnapshot.endMs,
      },
    },
  ]);
});

test("execution dispatcher invalidation prevents late mock completion", () => {
  const timerMock = installTimerMock();

  try {
    const { store } = createCommittedAudioExecutionStore();
    const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
    assert.ok(dispatchCandidate);
    const dispatcher = createLabExecutionDispatcher({
      emit(event) {
        store.dispatch(event);
      },
    });

    dispatcher.sync(dispatchCandidate);
    assert.equal(store.getState().ui.executionRuntime.status, "running");

    dispatcher.sync(null);
    assert.equal(store.getState().ui.executionRuntime.status, "idle");

    timerMock.scheduled.forEach(function (entry) {
      entry.fn();
    });

    assert.equal(store.getState().ui.executionRuntime.status, "idle");
    assert.equal(getActiveExecutionResult(store.getState()), null);
  } finally {
    timerMock.restore();
  }
});

test("execution runtime clears on upstream invalidation edges", () => {
  const scenarios: Array<{
    name: string;
    mutate: (store: ReturnType<typeof createLabStore>) => void;
  }> = [
    {
      name: "hydrate",
      mutate(store) {
        store.dispatch({ type: "hydrate", payload: null });
      },
    },
    {
      name: "source change",
      mutate(store) {
        store.dispatch({
          type: "source-config-patched",
          patch: {
            storedPath: "/tmp/source-2.wav",
          },
        });
      },
    },
    {
      name: "timeline change",
      mutate(store) {
        store.dispatch({
          type: "workspace-timeline-updated",
          startMs: 1200,
          endMs: 3200,
        });
      },
    },
    {
      name: "selection intent change",
      mutate(store) {
        store.dispatch({
          type: "workspace-selection-intent-updated",
          intent: "general",
        });
      },
    },
    {
      name: "suggestion change",
      mutate(store) {
        store.dispatch({
          type: "workspace-selection-suggestion-preview-set",
          suggestionId: "clean-audio",
        });
        store.dispatch({
          type: "workspace-selection-suggestion-accepted",
          suggestionId: "clean-audio",
        });
      },
    },
    {
      name: "suggestion dismissal",
      mutate(store) {
        store.dispatch({
          type: "workspace-selection-suggestion-dismissed",
          suggestionId: "audio-inspect",
        });
      },
    },
    {
      name: "intent clear",
      mutate(store) {
        store.dispatch({
          type: "workspace-execution-intent-cleared",
        });
      },
    },
    {
      name: "new commitment",
      mutate(store) {
        const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
        assert.ok(dispatchCandidate);
        store.dispatch({
          type: "workspace-execution-commitment-set",
          planId: dispatchCandidate.planId,
        });
      },
    },
    {
      name: "commitment revoke",
      mutate(store) {
        store.dispatch({
          type: "workspace-execution-commitment-revoked",
        });
      },
    },
    {
      name: "roi update",
      mutate(store) {
        store.dispatch({
          type: "selection-roi-updated",
          roi: {
            x: 0.1,
            y: 0.1,
            width: 0.2,
            height: 0.2,
          },
        });
      },
    },
    {
      name: "roi clear",
      mutate(store) {
        store.dispatch({
          type: "selection-roi-cleared",
        });
      },
    },
    {
      name: "inspection mode change",
      mutate(store) {
        store.dispatch({
          type: "selection-inspection-mode-updated",
          mode: "audio",
        });
      },
    },
  ];

  scenarios.forEach(function (scenario) {
    const { store } = createCommittedAudioExecutionStore();
    completeMockExecutionRuntime(store);
    assert.equal(getActiveExecutionResult(store.getState()) !== null, true, scenario.name);
    assert.equal(getActiveExecutionGoalEvaluation(store.getState()) !== null, true, scenario.name);

    scenario.mutate(store);

    assert.equal(store.getState().ui.executionRuntime.status, "idle", scenario.name);
    assert.equal(getActiveExecutionResult(store.getState()), null, scenario.name);
    assert.equal(getActiveExecutionGoalEvaluation(store.getState()), null, scenario.name);
  });
});
