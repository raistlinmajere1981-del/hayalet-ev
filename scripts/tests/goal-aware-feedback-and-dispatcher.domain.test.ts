import { assert, buildExecutionAlternatives, buildExecutionCandidateFromResolved, createLabExecutionDispatcher, createMockExecutionResult, getActiveExecutionGoalEvaluation, getActiveExecutionResult, getExecutionDispatchCandidate, installTimerMock, test } from "./laboratory-runtime-truth.helpers.ts";

import type { LabExecutionDispatchCandidate, LabSelection , createLabStore} from "./laboratory-runtime-truth.helpers.ts";

describe("goal-aware feedback and dispatcher", () => {
  void test("goal-aware feedback stays additive when goal success coexists with divergent interpretation", () => {
    const selection: LabSelection = {
      id: "selection-goal-mixed-signal",
      startMs: 1200,
      endMs: 4200,
      type: "clip",
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

  void test("goal-aware feedback tightens failed outcomes without changing structure or status", () => {
    const selection: LabSelection = {
      id: "selection-goal-failed-branch",
      startMs: 1000,
      endMs: 3400,
      type: "inspect",
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
    } as any);
    const failedGoalCandidate = buildExecutionCandidateFromResolved({
      ...baseInput,
      executionResultInterpretation: interpretation,
      executionGoalEvaluation: goalEvaluation,
    } as any);
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
    } as any);
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
    } as any);

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

  void test("decision posture integration stays additive and leaves inputs immutable", () => {
    const selection: LabSelection = {
      id: "selection-posture-immutable",
      startMs: 1200,
      endMs: 4400,
      type: "inspect",
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
    const alternativesCoherenceAdvisory = extractDecisionCoherenceAdvisoryText(
      alternatives.summary
    );
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

  void test("execution dispatcher emits deterministic mock progress and cleans up stale timers", () => {
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

  void test("execution mock materialization is deterministic and action-aware", () => {
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

  void test("focus-region materialization stays segment-scoped when ROI is absent", () => {
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
        roi: undefined,
      } as unknown as LabExecutionDispatchCandidate["selectionSnapshot"],
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

  void test("execution dispatcher invalidation prevents late mock completion", () => {
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

  void test("execution runtime clears on upstream invalidation edges", () => {
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
        name: "suggestion change",
        mutate(store) {
          store.dispatch({
            type: "workspace-selection-suggestion-preview-set",
            suggestionId: "metadata-audit",
          });
          store.dispatch({
            type: "workspace-selection-suggestion-accepted",
            suggestionId: "metadata-audit",
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
    ];

    scenarios.forEach(function (scenario) {
      const { store } = createCommittedAudioExecutionStore();
      completeMockExecutionRuntime(store);
      assert.equal(getActiveExecutionResult(store.getState()) !== null, true, scenario.name);
      assert.equal(
        getActiveExecutionGoalEvaluation(store.getState()) !== null,
        true,
        scenario.name
      );

      scenario.mutate(store);

      assert.equal(store.getState().ui.executionRuntime.status, "idle", scenario.name);
      assert.equal(getActiveExecutionResult(store.getState()), null, scenario.name);
      assert.equal(getActiveExecutionGoalEvaluation(store.getState()), null, scenario.name);
    });
  });
});
