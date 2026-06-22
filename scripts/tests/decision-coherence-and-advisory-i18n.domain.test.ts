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

describe("decision coherence and advisory i18n", () => {
  void test("laboratory advisory i18n resolves semantic keys without leaking selectors", () => {
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
    assert.equal((turkishOutputs[3] as string).includes(bridge.summary), false);

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

  void test("decision coherence compresses posture readiness and projection deterministically", () => {
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

  void test("decision priority reorders advisory summaries without mutating text", () => {
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

  void test("passive execution descriptor remains stable across equivalent feedback contexts", () => {
    const selection: LabSelection = {
      id: "selection-peb-equivalent-feedback",
      startMs: 1000,
      endMs: 3200,
      type: "inspect",
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
});
