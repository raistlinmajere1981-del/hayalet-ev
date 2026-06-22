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

describe("execution payload preview and bridge", () => {
  void test("execution payload preview is derived only from active readiness", () => {
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
    assert.equal(activePayload?.id, `payload:${activePlan?.id ?? ""}`);
    assert.equal(activePayload.planId, activePlan?.id);
    assert.equal(activePayload.actionType, "inspect-audio");
    assert.equal(
      activePayload.readinessStatus,
      getActiveExecutionReadiness(store.getState())?.status
    );
    assert.equal(typeof activePayload.readinessPassesPreview, "boolean");
    assert.equal(activePayload.dryRunShape.previewExpectedOutputs[0], "frequencyClusters");
    assert.deepEqual(Object.keys(activePayload.dryRunShape.previewInput), ["audioWindow"]);
    assert.match(activePayload.summary, /dry-run bridge/);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-cleared",
    });
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
    assert.equal(getActiveExecutionPayloadPreview(store.getState())?.id, activePayload.id);

    store.dispatch({
      type: "workspace-selection-suggestion-dismissed",
      suggestionId: "audio-inspect",
    });
    assert.equal(getActiveExecutionPayloadPreview(store.getState()), null);
  });

  void test("execution payload bridge is deterministic and covers ROI plus fallback shapes", () => {
    const roiSelection: LabSelection = {
      id: "selection-payload-roi",
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
    assert.deepEqual(focusPayload.dryRunShape.previewInput["roi"], {
      height: 0.28,
      width: 0.24,
      x: 0.18,
      y: 0.22,
    });
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

  void test("execution payload preview helper returns null for missing upstream objects", () => {
    const selection: LabSelection = {
      id: "selection-payload-missing",
      startMs: 1000,
      endMs: 3000,
      type: "clip",
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
});
