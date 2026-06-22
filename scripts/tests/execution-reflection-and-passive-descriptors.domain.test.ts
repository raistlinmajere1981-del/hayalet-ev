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

describe("execution reflection and passive descriptors", () => {
  void test("execution reflection maps readiness and simulation into passive decisions", () => {
    const proceedSelection: LabSelection = {
      id: "selection-reflection-proceed",
      startMs: 1000,
      endMs: 3000,
      type: "clip",
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

  void test("execution reflection is derived only from the complete active dry-run chain", () => {
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
    assert.equal(activeReflection?.id, `reflection:${activePlan?.id ?? ""}`);
    assert.equal(activeReflection.planId, activePlan?.id);
    assert.equal(activeReflection.decision, "proceed");
    assert.equal(activeReflection.reasoning.length > 0, true);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-cleared",
    });
    assert.equal(getActiveExecutionReflection(store.getState())?.id, activeReflection.id);

    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1500,
      endMs: 2800,
    });
    assert.equal(getActiveExecutionReflection(store.getState()), null);
  });

  void test("execution reflection helper returns null for missing upstream objects", () => {
    const selection: LabSelection = {
      id: "selection-reflection-missing",
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

  void test("passive execution descriptor maps conceptual classes deterministically", () => {
    const selection: LabSelection = {
      id: "selection-peb-descriptor-map",
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

  void test("execution bridge maps descriptors to passive contracts deterministically", () => {
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

  void test("execution bridge derives input shape without runtime payload values", () => {
    const selection: LabSelection = {
      id: "selection-bridge-param-shape",
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

  void test("execution readiness signal maps pressure and projection deterministically", () => {
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
});
