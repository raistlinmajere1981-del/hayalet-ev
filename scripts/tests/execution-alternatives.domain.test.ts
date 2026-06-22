import { assert, buildExecutionAlternatives, buildExecutionAlternativesFromResolved, buildExecutionCandidateFromResolved, createLabStore, createTestAudioFocusSettings, getActiveExecutionAlternatives, getActiveExecutionPlan, test } from "./laboratory-runtime-truth.helpers.ts";

import type { LabActionSuggestion, LabSelection } from "./laboratory-runtime-truth.helpers.ts";

describe("execution alternatives", () => {
  void test("execution alternatives compare deterministic counterfactuals across decisions", () => {
    const proceedSelection: LabSelection = {
      id: "selection-alternatives-proceed",
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

  void test("passive descriptor and bridge advisories are summary-only and avoid execution verbs", () => {
    const selection: LabSelection = {
      id: "selection-peb-summary-advisory",
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
    const candidateCoherenceAdvisory = extractDecisionCoherenceAdvisoryText(
      candidate?.summary ?? ""
    );
    const alternativesCoherenceAdvisory = extractDecisionCoherenceAdvisoryText(
      alternatives.summary
    );

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
    assert.equal(countOccurrences(candidate.summary, "Readiness view:"), 1);
    assert.equal(countOccurrences(alternatives.summary, "Readiness view:"), 1);
    assert.equal(countOccurrences(candidate.summary, "Execution bridge:"), 1);
    assert.equal(countOccurrences(alternatives.summary, "Execution bridge:"), 1);
    assert.equal(countOccurrences(candidate.summary, "Coherence view:"), 1);
    assert.equal(countOccurrences(alternatives.summary, "Coherence view:"), 1);
    assert.equal(
      candidate.summary.indexOf(candidateAdvisory) <
        candidate.summary.indexOf(candidateReadinessAdvisory),
      true
    );
    assert.equal(
      candidate.summary.indexOf(candidateReadinessAdvisory) <
        candidate.summary.indexOf(candidateBridgeAdvisory),
      true
    );
    assert.equal(
      candidate.summary.indexOf(candidateBridgeAdvisory) <
        candidate.summary.indexOf(candidateCoherenceAdvisory),
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
    assert.notEqual(localizedCandidate.summary, candidate.summary);
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

  void test("execution alternatives re-weight summary tone without changing structure", () => {
    const selection: LabSelection = {
      id: "selection-alternatives-feedback",
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

  void test("execution alternatives cover known action mappings and fallback", () => {
    const videoSelection: LabSelection = {
      id: "selection-alternatives-video",
      startMs: 2000,
      endMs: 5200,
      type: "inspect",
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

  void test("execution alternatives are derived only from the complete active reflection chain", () => {
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
    assert.equal(activeAlternatives?.id, `alternatives:${activePlan?.id ?? ""}`);
    assert.equal(activeAlternatives.planId, activePlan?.id);
    assert.equal(activeAlternatives.alternatives.length > 0, true);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-cleared",
    });
    assert.equal(getActiveExecutionAlternatives(store.getState())?.id, activeAlternatives.id);

    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1500,
      endMs: 2800,
    });
    assert.equal(getActiveExecutionAlternatives(store.getState()), null);
  });

  void test("execution alternatives helper returns null for missing upstream objects", () => {
    const selection: LabSelection = {
      id: "selection-alternatives-missing",
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
});
