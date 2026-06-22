import { __testOnlyBuildExecutionPatternKey, __testOnlyResetExecutionPatternRegistry, assert, buildExecutionAlternatives, buildExecutionCandidateFromResolved, createMockExecutionResult, getActiveExecutionAlternatives, getActiveExecutionCandidate, getActiveExecutionGoalEvaluation, getActiveExecutionResult, getExecutionDispatchCandidate, test } from "./laboratory-runtime-truth.helpers.ts";

import type { LabSelection } from "./laboratory-runtime-truth.helpers.ts";

describe("counterfactual and session pattern", () => {
  void test("counterfactual projection stays hidden until execution completes", () => {
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

  void test("session pattern awareness records completed samples idempotently", () => {
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
    assert.equal(rerunEvaluation.patternSignal.strength, "weak");
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
    assert.equal(nextEvaluation.patternSignal.successRatio, 0.5);
    assert.equal(nextEvaluation.patternSignal.failureRatio, 0.5);
    assert.equal(nextEvaluation.patternSignal.strength, "neutral");
    assert.doesNotMatch(nextEvaluation.summary, /Historically similar evaluations/);

    __testOnlyResetExecutionPatternRegistry();
  });

  void test("session pattern awareness separates duration buckets roi presence and neutral ratios", () => {
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
    assert.equal(neutralPatternEvaluation.patternSignal.successRatio, 0);
    assert.equal(neutralPatternEvaluation.patternSignal.failureRatio, 0);
    assert.equal(neutralPatternEvaluation.patternSignal.strength, "neutral");
    assert.doesNotMatch(neutralPatternEvaluation.summary, /Historically similar evaluations/);

    __testOnlyResetExecutionPatternRegistry();
  });

  void test("session pattern signal softly biases candidate confidence and alternatives tone", () => {
    const selection: LabSelection = {
      id: "selection-pattern-signal-feedback",
      startMs: 1000,
      endMs: 3000,
      type: "clip",
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
});
