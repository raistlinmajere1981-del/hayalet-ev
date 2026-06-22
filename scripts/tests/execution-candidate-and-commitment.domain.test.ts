import { assert, buildExecutionCandidateFromResolved, createLabStore, createTestAudioFocusSettings, getActiveExecutionCandidate, getActiveExecutionCommitment, getActiveExecutionPlan, test } from "./laboratory-runtime-truth.helpers.ts";

import type { LabExecutionCommitment, LabExecutionPayloadPreview, LabSelection } from "./laboratory-runtime-truth.helpers.ts";

describe("execution candidate and commitment", () => {
  void test("execution candidate synthesizes structural viability without downgrading stable alternatives", () => {
    const proceedSelection: LabSelection = {
      id: "selection-candidate-proceed",
      startMs: 1000,
      endMs: 3600,
      type: "inspect",
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
    assert.match(reviewCandidate.uncertainties?.join(" ") ?? "", /warning|tradeoffs|risk/i);

    const avoidSelection: LabSelection = {
      id: "selection-candidate-avoid",
      startMs: 1000,
      endMs: 2600,
      type: "clip",
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

  void test("execution candidate adjusts confidence from interpreted result without changing status", () => {
    const selection: LabSelection = {
      id: "selection-candidate-feedback",
      startMs: 1000,
      endMs: 3600,
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

  void test("execution candidate validates upstream coherence and payload preview shape", () => {
    const selection: LabSelection = {
      id: "selection-candidate-payload",
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
    assert.equal(emptyInputCandidate.status, "not-viable");
    assert.equal(emptyParametersCandidate?.structuralIntegrity, "insufficient");
    assert.equal(emptyOutputsCandidate?.structuralIntegrity, "insufficient");
    assert.equal(readinessMismatchCandidate?.structuralIntegrity, "partial");
    assert.equal(readinessMismatchCandidate.status, "unstable");
    assert.equal(actionMismatchCandidate?.structuralIntegrity, "insufficient");
    assert.equal(actionMismatchCandidate.status, "not-viable");
  });

  void test("execution candidate is derived only from the complete active alternatives chain", () => {
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
    assert.equal(activeCandidate?.id, `candidate:${activePlan?.id ?? ""}`);
    assert.equal(activeCandidate.planId, activePlan?.id);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-cleared",
    });
    assert.equal(getActiveExecutionCandidate(store.getState())?.id, activeCandidate.id);

    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1500,
      endMs: 2800,
    });
    assert.equal(getActiveExecutionCandidate(store.getState()), null);
  });

  void test("execution candidate helper returns null for missing upstream objects", () => {
    const selection: LabSelection = {
      id: "selection-candidate-missing",
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
    assert.equal(
      buildExecutionCandidateFromResolved({ ...baseInput, activeSelection: null }),
      null
    );
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

  void test("execution commitment is explicit, candidate-gated, and revocable", () => {
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

  void test("execution commitment rejects missing, mismatched, stale, and not-viable candidates", () => {
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
      type: "selection-inspection-mode-updated",
      mode: "audio",
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
      planId: blockedCandidate.planId,
    });
    assert.equal(blockedStore.getState().ui.activeExecutionCommitment, null);
    assert.equal(getActiveExecutionCommitment(blockedStore.getState()), null);
  });

  void test("execution commitment clears on upstream context changes but not preview clear", () => {
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
    assert.equal(
      inspectionStore.store.getState().ui.activeExecutionCommitment?.id,
      inspectionStore.commitment.id
    );
    assert.equal(
      getActiveExecutionCommitment(inspectionStore.store.getState())?.id,
      inspectionStore.commitment.id
    );

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
});
