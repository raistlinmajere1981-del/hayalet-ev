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

describe("process summary and execution intents", () => {
  void test("laboratory process summary derives a single deterministic state", () => {
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
      (getLaboratoryRightPanelContext(store.getState()) as unknown as Record<string, unknown>)[
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

  void test("store accepts execution intents only from the exact active suggestion preview", () => {
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
    assert.equal(store.getState().ui.activeExecutionIntentId, "audio-inspect");
    assert.equal(store.getState().ui.activeExecutionCommitment?.planId, activeCandidate.planId);
    assert.equal(getActiveExecutionCommitment(store.getState())?.planId, activeCandidate.planId);

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
});
