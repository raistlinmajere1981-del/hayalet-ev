function clampConfidence(value) {
  return Math.max(0.25, Math.min(0.98, Number(value.toFixed(2))));
}
function createAlternativesId(input) {
  return `alternatives:${input.executionPlan.id}`;
}
function getSelectionDurationMs(selection) {
  return Math.max(0, selection.endMs - selection.startMs);
}
function isAudioOriented(input) {
  return input.sourceKind === "audio" || input.inspectionMode === "audio" || input.activeSelection.intent === "audio" || input.executionPlan.actionType === "inspect-audio";
}
function isVideoOriented(input) {
  return input.sourceKind === "video" || input.inspectionMode === "motion" || input.activeSelection.intent === "motion" || input.executionPlan.actionType === "inspect-motion";
}
function isVisualOriented(input) {
  return input.sourceKind === "image" || input.sourceKind === "video" || input.inspectionMode === "visual" || input.activeSelection.intent === "visual" || input.executionPlan.actionType === "focus-region" || input.executionPlan.actionType === "enhance-visual";
}
function pushAlternative(target, alternative) {
  if (target.some(function(entry) {
    return entry.actionType === alternative.actionType && entry.label === alternative.label;
  })) {
    return;
  }
  target.push(alternative);
}
function capAlternatives(alternatives) {
  return alternatives.slice(0, 3);
}
function broadSegmentAlternative() {
  return {
    actionType: "analyze-segment",
    label: "Broader segment review",
    summary: "An alternative approach would evaluate the full selected window before narrowing the evidence.",
    tradeoff: "This path would trade local clarity for higher contextual coverage.",
    relativeAdvantage: "higher-coverage"
  };
}
function focusedRegionAlternative(hasRoi) {
  return {
    actionType: "focus-region",
    label: hasRoi ? "Region-focused inspection" : "Region-first inspection",
    summary: hasRoi ? "An alternative approach would isolate the active ROI and compare local detail against the selected span." : "An alternative approach would define a smaller visual region before comparing local detail.",
    tradeoff: "This path would trade broad coverage for higher spatial precision.",
    relativeAdvantage: "higher-precision"
  };
}
function audioInspectionAlternative() {
  return {
    actionType: "inspect-audio",
    label: "Spectral audio inspection",
    summary: "An alternative approach would shift attention from the current path into frequency and transient behavior.",
    tradeoff: "This path would trade cross-modal coverage for clearer signal detail.",
    relativeAdvantage: "higher-precision"
  };
}
function narrowedInspectionAlternative() {
  return {
    actionType: "narrowed-inspection",
    label: "Narrowed inspection window",
    summary: "An alternative approach would reduce the reviewed span before comparing the evidence again.",
    tradeoff: "This path would trade coverage for a more precise, lower-noise comparison.",
    relativeAdvantage: "higher-precision"
  };
}
function slowerPlaybackAlternative() {
  return {
    actionType: "slow-playback-inspection",
    label: "Slower temporal inspection",
    summary: "An alternative approach would slow preview review to make transient or motion detail easier to compare.",
    tradeoff: "This path would trade speed for temporal clarity and steadier interpretation.",
    relativeAdvantage: "more-stable"
  };
}
function motionInspectionAlternative() {
  return {
    actionType: "inspect-motion",
    label: "Motion continuity inspection",
    summary: "An alternative approach would compare frame-to-frame continuity instead of prioritizing static detail.",
    tradeoff: "This path would trade still-frame clarity for motion stability evidence.",
    relativeAdvantage: "more-stable"
  };
}
function visualClarityAlternative() {
  return {
    actionType: "enhance-visual",
    label: "Visual clarity comparison",
    summary: "An alternative approach would emphasize visual readability before deeper comparison.",
    tradeoff: "This path would trade neutral observation for clearer local structure.",
    relativeAdvantage: "higher-precision"
  };
}
function stabilizationAlternative() {
  return {
    actionType: "stabilize-segment",
    label: "Stability-first comparison",
    summary: "An alternative approach would align the inspected frames before judging detail or motion.",
    tradeoff: "This path would trade immediacy for a more stable comparison surface.",
    relativeAdvantage: "more-stable"
  };
}
function semanticReviewAlternative() {
  return {
    actionType: "analyze-segment",
    label: "Semantic pre-review",
    summary: "An alternative approach would inspect the selected range for meaning before treating it as a handoff candidate.",
    tradeoff: "This path would trade speed for lower risk and better context.",
    relativeAdvantage: "lower-risk"
  };
}
function genericNarrowAlternative() {
  return {
    actionType: "generic-narrowed-inspection",
    label: "Narrowed evidence pass",
    summary: "An alternative approach would reduce the evidence window and compare fewer signals at once.",
    tradeoff: "This path would trade breadth for a simpler interpretation surface.",
    relativeAdvantage: "higher-precision"
  };
}
function buildAnalyzeSegmentAlternatives(input) {
  const alternatives = [];
  const durationMs = getSelectionDurationMs(input.activeSelection);
  const hasRoi = input.activeSelection.roi !== void 0;
  if (hasRoi) {
    pushAlternative(alternatives, focusedRegionAlternative(true));
  }
  if (isAudioOriented(input)) {
    pushAlternative(alternatives, audioInspectionAlternative());
  }
  if (durationMs > 1e4 || alternatives.length === 0) {
    pushAlternative(alternatives, narrowedInspectionAlternative());
  }
  return capAlternatives(alternatives);
}
function buildFocusRegionAlternatives(input) {
  const alternatives = [];
  pushAlternative(alternatives, broadSegmentAlternative());
  if (isVideoOriented(input)) {
    pushAlternative(alternatives, motionInspectionAlternative());
  }
  if (isVisualOriented(input)) {
    pushAlternative(alternatives, visualClarityAlternative());
  }
  return capAlternatives(alternatives);
}
function buildInspectAudioAlternatives(input) {
  const alternatives = [];
  pushAlternative(alternatives, broadSegmentAlternative());
  pushAlternative(alternatives, slowerPlaybackAlternative());
  if (input.activeSelection.roi !== void 0 && isVideoOriented(input)) {
    pushAlternative(alternatives, focusedRegionAlternative(true));
  }
  return capAlternatives(alternatives);
}
function buildExtractClipAlternatives(input) {
  const alternatives = [];
  pushAlternative(alternatives, semanticReviewAlternative());
  if (isAudioOriented(input)) {
    pushAlternative(alternatives, audioInspectionAlternative());
  }
  if (input.activeSelection.roi !== void 0 || isVisualOriented(input)) {
    pushAlternative(
      alternatives,
      focusedRegionAlternative(input.activeSelection.roi !== void 0)
    );
  }
  return capAlternatives(alternatives);
}
function buildInspectMotionAlternatives(input) {
  const alternatives = [];
  if (input.activeSelection.roi !== void 0 || isVideoOriented(input)) {
    pushAlternative(
      alternatives,
      focusedRegionAlternative(input.activeSelection.roi !== void 0)
    );
  }
  pushAlternative(alternatives, slowerPlaybackAlternative());
  pushAlternative(alternatives, broadSegmentAlternative());
  return capAlternatives(alternatives);
}
function buildVisualAlternatives(input) {
  const alternatives = [];
  pushAlternative(alternatives, focusedRegionAlternative(input.activeSelection.roi !== void 0));
  pushAlternative(alternatives, broadSegmentAlternative());
  if (isVideoOriented(input)) {
    pushAlternative(alternatives, stabilizationAlternative());
  }
  return capAlternatives(alternatives);
}
function buildStabilizeAlternatives(input) {
  const alternatives = [];
  pushAlternative(alternatives, motionInspectionAlternative());
  if (input.activeSelection.roi !== void 0 || isVisualOriented(input)) {
    pushAlternative(
      alternatives,
      focusedRegionAlternative(input.activeSelection.roi !== void 0)
    );
  }
  pushAlternative(alternatives, visualClarityAlternative());
  return capAlternatives(alternatives);
}
function buildFallbackAlternatives() {
  return [broadSegmentAlternative(), genericNarrowAlternative()];
}
function buildAlternatives(input) {
  switch (input.executionPlan.actionType) {
    case "analyze-segment":
      return buildAnalyzeSegmentAlternatives(input);
    case "extract-clip":
      return buildExtractClipAlternatives(input);
    case "focus-region":
      return buildFocusRegionAlternatives(input);
    case "inspect-audio":
      return buildInspectAudioAlternatives(input);
    case "inspect-motion":
      return buildInspectMotionAlternatives(input);
    case "enhance-visual":
      return buildVisualAlternatives(input);
    case "stabilize-segment":
      return buildStabilizeAlternatives(input);
    default:
      return buildFallbackAlternatives();
  }
}
function buildSummary(input) {
  if (input.executionReflection.decision === "proceed") {
    return "The selected path appears stable; alternatives mainly trade precision, coverage, or tempo against that stable baseline.";
  }
  if (input.executionReflection.decision === "review") {
    return "The selected path still needs review; alternatives may reduce uncertainty or add context before carrying it further.";
  }
  return "The selected path is not recommended in its current form; alternatives outline safer counterfactual routes.";
}
function buildComparisonNote(input) {
  if (input.executionReflection.decision === "proceed") {
    return "Compared to the selected path, these alternatives can expose different evidence at the cost of changing the current balance.";
  }
  if (input.executionReflection.decision === "review") {
    return "Compared to the selected path, these alternatives trade the current uncertainty for clearer scope or steadier context.";
  }
  return "Compared to the selected path, these alternatives lower risk by changing scope, method, or intensity before any future handoff.";
}
function buildConfidence(input, alternativeCount) {
  let confidence = input.executionReflection.confidence ?? input.executionReadiness.confidence ?? input.executionSimulation.metrics?.confidence ?? input.executionPlan.confidence ?? 0.66;
  if (input.executionReflection.decision === "proceed") {
    confidence += 0.02;
  } else if (input.executionReflection.decision === "review") {
    confidence -= 0.04;
  } else {
    confidence -= 0.1;
  }
  if (input.executionReadiness.status === "blocked") {
    confidence -= 0.06;
  } else if (input.executionReadiness.status === "needs-review") {
    confidence -= 0.03;
  }
  if (input.executionSimulation.metrics?.risk === "high") {
    confidence -= 0.06;
  } else if (input.executionSimulation.metrics?.risk === "medium") {
    confidence -= 0.03;
  }
  if (alternativeCount < 2) {
    confidence -= 0.03;
  }
  return clampConfidence(confidence);
}
export function buildExecutionAlternatives(input) {
  const alternatives = buildAlternatives(input);
  return {
    id: createAlternativesId(input),
    planId: input.executionPlan.id,
    summary: buildSummary(input),
    alternatives,
    comparisonNote: buildComparisonNote(input),
    confidence: buildConfidence(input, alternatives.length)
  };
}
export function buildExecutionAlternativesFromResolved(input) {
  if (input.activeSelection === null || input.executionPlan === null || input.executionReadiness === null || input.executionReflection === null || input.executionSimulation === null || input.activeSelection.endMs <= input.activeSelection.startMs) {
    return null;
  }
  return buildExecutionAlternatives({
    activeSelection: input.activeSelection,
    executionPlan: input.executionPlan,
    executionReadiness: input.executionReadiness,
    executionReflection: input.executionReflection,
    executionSimulation: input.executionSimulation,
    inspectionMode: input.inspectionMode,
    sourceKind: input.sourceKind
  });
}
