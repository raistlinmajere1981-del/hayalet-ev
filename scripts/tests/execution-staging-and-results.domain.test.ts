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

describe("execution staging and results", () => {
  void test("execution staging derives a passive staged state from committed viable and unstable chains", () => {
    const selection: LabSelection = {
      id: "selection-staging-viable",
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
    assert.equal(unstableStaging.candidateStatus, "unstable");
    assert.match(unstableStaging.warnings?.join(" ") ?? "", /unstable/i);
  });

  void test("execution staging returns null for invalid or stale upstream chains", () => {
    const selection: LabSelection = {
      id: "selection-staging-invalid",
      startMs: 1000,
      endMs: 3000,
      type: "clip",
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

  void test("execution staging can represent a coherent committed path that is not staged yet", () => {
    const selection: LabSelection = {
      id: "selection-staging-review",
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
    assert.equal(staging.readinessStatus, "needs-review");
    assert.match(staging.warnings?.join(" ") ?? "", /readiness check|unstable/i);
  });

  void test("execution staging is selector-derived and clears with its upstream chain", () => {
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
      assert.equal(
        artifact.timeRange.end <= candidate.selectionSnapshot.endMs,
        true,
        artifact.label
      );
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

  void test("execution result interpretation maps deterministic outcome buckets", () => {
    const selectionSnapshot = {
      endMs: 3000,
      inspectionMode: "audio" as const,
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

  void test("execution goal evaluation maps deterministic action-aware outcomes", () => {
    const analyzeSelectionSnapshot = {
      endMs: 4200,
      inspectionMode: "none" as const,
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

  void test("execution dispatch candidate exists only for a valid committed staged chain", () => {
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
      inspectionMode: "audio",
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

  void test("execution runtime lifecycle is identity-gated and exposes the active result", () => {
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

  void test("completed execution result feeds passive reflection candidate and alternatives output", () => {
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
});
