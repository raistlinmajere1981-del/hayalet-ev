import type {
  LabExecutionAlternative,
  LabExecutionAlternatives,
  LabExecutionGoalEvaluation,
  LabExecutionPlan,
  LabExecutionReadiness,
  LabExecutionReflection,
  LabExecutionSimulation,
  LabInspectionMode,
  LabSelection,
} from "../models/lab-types.js";
import {
  buildAdaptiveDecisionSignal,
  buildGuidedAlternativeSignal,
  type LabGuidedAlternativeSignal,
} from "./lab-adaptive-decision.js";

export type LabExecutionAlternativesResultInterpretation = {
  coverageLevel: "low" | "medium" | "high";
  anomalyLevel: "none" | "moderate" | "high";
  alignment: "matches-simulation" | "partial" | "deviates";
};

type LabExecutionAlternativesInput = {
  activeSelection: LabSelection;
  executionPlan: LabExecutionPlan;
  executionReadiness: LabExecutionReadiness;
  executionReflection: LabExecutionReflection;
  executionGoalEvaluation?: LabExecutionGoalEvaluation | null;
  executionResultInterpretation?: LabExecutionAlternativesResultInterpretation | null;
  executionSimulation: LabExecutionSimulation;
  inspectionMode: LabInspectionMode;
  sourceKind: string;
};

export type LabExecutionAlternativesResolvedInput = {
  activeSelection: LabSelection | null;
  executionPlan: LabExecutionPlan | null;
  executionReadiness: LabExecutionReadiness | null;
  executionReflection: LabExecutionReflection | null;
  executionGoalEvaluation?: LabExecutionGoalEvaluation | null;
  executionResultInterpretation?: LabExecutionAlternativesResultInterpretation | null;
  executionSimulation: LabExecutionSimulation | null;
  inspectionMode: LabInspectionMode;
  sourceKind: string;
};

function clampConfidence(value: number) {
  return Math.max(0.25, Math.min(0.98, Number(value.toFixed(2))));
}

function createAlternativesId(input: LabExecutionAlternativesInput) {
  return `alternatives:${input.executionPlan.id}`;
}

function getSelectionDurationMs(selection: LabSelection) {
  return Math.max(0, selection.endMs - selection.startMs);
}

function isAudioOriented(input: LabExecutionAlternativesInput) {
  return (
    input.sourceKind === "audio" ||
    input.inspectionMode === "audio" ||
    input.activeSelection.intent === "audio" ||
    input.executionPlan.actionType === "inspect-audio"
  );
}

function isVideoOriented(input: LabExecutionAlternativesInput) {
  return (
    input.sourceKind === "video" ||
    input.inspectionMode === "motion" ||
    input.activeSelection.intent === "motion" ||
    input.executionPlan.actionType === "inspect-motion"
  );
}

function isVisualOriented(input: LabExecutionAlternativesInput) {
  return (
    input.sourceKind === "image" ||
    input.sourceKind === "video" ||
    input.inspectionMode === "visual" ||
    input.activeSelection.intent === "visual" ||
    input.executionPlan.actionType === "focus-region" ||
    input.executionPlan.actionType === "enhance-visual"
  );
}

function pushAlternative(target: LabExecutionAlternative[], alternative: LabExecutionAlternative) {
  if (
    target.some(function (entry) {
      return entry.actionType === alternative.actionType && entry.label === alternative.label;
    })
  ) {
    return;
  }
  target.push(alternative);
}

function capAlternatives(alternatives: LabExecutionAlternative[]) {
  return alternatives.slice(0, 3);
}

function broadSegmentAlternative(): LabExecutionAlternative {
  return {
    actionType: "analyze-segment",
    label: "Broader segment review",
    summary:
      "An alternative approach would evaluate the full selected window before narrowing the evidence.",
    tradeoff: "This path would trade local clarity for higher contextual coverage.",
    relativeAdvantage: "higher-coverage",
  };
}

function focusedRegionAlternative(hasRoi: boolean): LabExecutionAlternative {
  return {
    actionType: "focus-region",
    label: hasRoi ? "Region-focused inspection" : "Region-first inspection",
    summary: hasRoi
      ? "An alternative approach would isolate the active ROI and compare local detail against the selected span."
      : "An alternative approach would define a smaller visual region before comparing local detail.",
    tradeoff: "This path would trade broad coverage for higher spatial precision.",
    relativeAdvantage: "higher-precision",
  };
}

function audioInspectionAlternative(): LabExecutionAlternative {
  return {
    actionType: "inspect-audio",
    label: "Spectral audio inspection",
    summary:
      "An alternative approach would shift attention from the current path into frequency and transient behavior.",
    tradeoff: "This path would trade cross-modal coverage for clearer signal detail.",
    relativeAdvantage: "higher-precision",
  };
}

function narrowedInspectionAlternative(): LabExecutionAlternative {
  return {
    actionType: "narrowed-inspection",
    label: "Narrowed inspection window",
    summary:
      "An alternative approach would reduce the reviewed span before comparing the evidence again.",
    tradeoff: "This path would trade coverage for a more precise, lower-noise comparison.",
    relativeAdvantage: "higher-precision",
  };
}

function slowerPlaybackAlternative(): LabExecutionAlternative {
  return {
    actionType: "slow-playback-inspection",
    label: "Slower temporal inspection",
    summary:
      "An alternative approach would slow preview review to make transient or motion detail easier to compare.",
    tradeoff: "This path would trade speed for temporal clarity and steadier interpretation.",
    relativeAdvantage: "more-stable",
  };
}

function motionInspectionAlternative(): LabExecutionAlternative {
  return {
    actionType: "inspect-motion",
    label: "Motion continuity inspection",
    summary:
      "An alternative approach would compare frame-to-frame continuity instead of prioritizing static detail.",
    tradeoff: "This path would trade still-frame clarity for motion stability evidence.",
    relativeAdvantage: "more-stable",
  };
}

function visualClarityAlternative(): LabExecutionAlternative {
  return {
    actionType: "enhance-visual",
    label: "Visual clarity comparison",
    summary: "An alternative approach would emphasize visual readability before deeper comparison.",
    tradeoff: "This path would trade neutral observation for clearer local structure.",
    relativeAdvantage: "higher-precision",
  };
}

function stabilizationAlternative(): LabExecutionAlternative {
  return {
    actionType: "stabilize-segment",
    label: "Stability-first comparison",
    summary:
      "An alternative approach would align the inspected frames before judging detail or motion.",
    tradeoff: "This path would trade immediacy for a more stable comparison surface.",
    relativeAdvantage: "more-stable",
  };
}

function semanticReviewAlternative(): LabExecutionAlternative {
  return {
    actionType: "analyze-segment",
    label: "Semantic pre-review",
    summary:
      "An alternative approach would inspect the selected range for meaning before treating it as a handoff candidate.",
    tradeoff: "This path would trade speed for lower risk and better context.",
    relativeAdvantage: "lower-risk",
  };
}

function genericNarrowAlternative(): LabExecutionAlternative {
  return {
    actionType: "generic-narrowed-inspection",
    label: "Narrowed evidence pass",
    summary:
      "An alternative approach would reduce the evidence window and compare fewer signals at once.",
    tradeoff: "This path would trade breadth for a simpler interpretation surface.",
    relativeAdvantage: "higher-precision",
  };
}

function buildAnalyzeSegmentAlternatives(input: LabExecutionAlternativesInput) {
  const alternatives: LabExecutionAlternative[] = [];
  const durationMs = getSelectionDurationMs(input.activeSelection);
  const hasRoi = input.activeSelection.roi !== undefined;

  if (hasRoi) {
    pushAlternative(alternatives, focusedRegionAlternative(true));
  }
  if (isAudioOriented(input)) {
    pushAlternative(alternatives, audioInspectionAlternative());
  }
  if (durationMs > 10000 || alternatives.length === 0) {
    pushAlternative(alternatives, narrowedInspectionAlternative());
  }

  return capAlternatives(alternatives);
}

function buildFocusRegionAlternatives(input: LabExecutionAlternativesInput) {
  const alternatives: LabExecutionAlternative[] = [];

  pushAlternative(alternatives, broadSegmentAlternative());
  if (isVideoOriented(input)) {
    pushAlternative(alternatives, motionInspectionAlternative());
  }
  if (isVisualOriented(input)) {
    pushAlternative(alternatives, visualClarityAlternative());
  }

  return capAlternatives(alternatives);
}

function buildInspectAudioAlternatives(input: LabExecutionAlternativesInput) {
  const alternatives: LabExecutionAlternative[] = [];

  pushAlternative(alternatives, broadSegmentAlternative());
  pushAlternative(alternatives, slowerPlaybackAlternative());
  if (input.activeSelection.roi !== undefined && isVideoOriented(input)) {
    pushAlternative(alternatives, focusedRegionAlternative(true));
  }

  return capAlternatives(alternatives);
}

function buildExtractClipAlternatives(input: LabExecutionAlternativesInput) {
  const alternatives: LabExecutionAlternative[] = [];

  pushAlternative(alternatives, semanticReviewAlternative());
  if (isAudioOriented(input)) {
    pushAlternative(alternatives, audioInspectionAlternative());
  }
  if (input.activeSelection.roi !== undefined || isVisualOriented(input)) {
    pushAlternative(
      alternatives,
      focusedRegionAlternative(input.activeSelection.roi !== undefined)
    );
  }

  return capAlternatives(alternatives);
}

function buildInspectMotionAlternatives(input: LabExecutionAlternativesInput) {
  const alternatives: LabExecutionAlternative[] = [];

  if (input.activeSelection.roi !== undefined || isVideoOriented(input)) {
    pushAlternative(
      alternatives,
      focusedRegionAlternative(input.activeSelection.roi !== undefined)
    );
  }
  pushAlternative(alternatives, slowerPlaybackAlternative());
  pushAlternative(alternatives, broadSegmentAlternative());

  return capAlternatives(alternatives);
}

function buildVisualAlternatives(input: LabExecutionAlternativesInput) {
  const alternatives: LabExecutionAlternative[] = [];

  pushAlternative(alternatives, focusedRegionAlternative(input.activeSelection.roi !== undefined));
  pushAlternative(alternatives, broadSegmentAlternative());
  if (isVideoOriented(input)) {
    pushAlternative(alternatives, stabilizationAlternative());
  }

  return capAlternatives(alternatives);
}

function buildStabilizeAlternatives(input: LabExecutionAlternativesInput) {
  const alternatives: LabExecutionAlternative[] = [];

  pushAlternative(alternatives, motionInspectionAlternative());
  if (input.activeSelection.roi !== undefined || isVisualOriented(input)) {
    pushAlternative(
      alternatives,
      focusedRegionAlternative(input.activeSelection.roi !== undefined)
    );
  }
  pushAlternative(alternatives, visualClarityAlternative());

  return capAlternatives(alternatives);
}

function buildFallbackAlternatives() {
  return [broadSegmentAlternative(), genericNarrowAlternative()];
}

function buildAlternatives(input: LabExecutionAlternativesInput) {
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

function buildBaseSummary(input: LabExecutionAlternativesInput) {
  const goalEvaluation = input.executionGoalEvaluation;
  const patternStrength = goalEvaluation?.patternSignal?.strength;
  const interpretation = input.executionResultInterpretation;
  const adaptiveDecision = buildAdaptiveDecisionSignal({
    executionGoalEvaluation: goalEvaluation ?? null,
    executionResultInterpretation: interpretation ?? null,
  });
  if (adaptiveDecision.decisionPressure === "high") {
    return "Adaptive decision pressure is high; alternatives should be evaluated before continuing this route.";
  }
  if (goalEvaluation !== undefined && goalEvaluation !== null) {
    if (patternStrength === "weak") {
      return "Historical execution feedback shows similar paths have been weak; alternative paths should be treated as stronger next routes.";
    }
    if (goalEvaluation.outcome === "failed") {
      return "Goal evaluation indicates the current result missed its intended outcome; alternative paths should be treated as stronger next routes.";
    }
    if (goalEvaluation.outcome === "successful") {
      if (patternStrength === "strong" && interpretation?.alignment !== "deviates") {
        return "Historical execution feedback reinforces this successful path; alternatives remain light comparative backups.";
      }
      if (interpretation?.alignment === "deviates") {
        return "Goal evaluation indicates the intended outcome was achieved, but execution still diverges from simulation; alternatives remain comparative safeguards.";
      }
      return "Goal evaluation indicates the intended outcome was achieved; alternatives remain comparative backup routes.";
    }
  }
  if (interpretation !== undefined && interpretation !== null) {
    if (interpretation.coverageLevel === "low" || interpretation.alignment === "deviates") {
      return "Execution feedback suggests alternative paths may yield better outcomes than the current route.";
    }
    if (
      interpretation.coverageLevel === "high" &&
      interpretation.alignment === "matches-simulation"
    ) {
      return "Execution feedback reinforces current path stability; alternatives remain comparative backup routes.";
    }
    return "Execution feedback is mixed; alternatives may clarify coverage or alignment before carrying the result further.";
  }
  if (input.executionReflection.decision === "proceed") {
    return "The selected path appears stable; alternatives mainly trade precision, coverage, or tempo against that stable baseline.";
  }
  if (input.executionReflection.decision === "review") {
    return "The selected path still needs review; alternatives may reduce uncertainty or add context before carrying it further.";
  }
  return "The selected path is not recommended in its current form; alternatives outline safer counterfactual routes.";
}

function buildSummary(
  input: LabExecutionAlternativesInput,
  guidedAlternative: LabGuidedAlternativeSignal
) {
  const baseSummary = buildBaseSummary(input);
  if (guidedAlternative.guidanceText === "") {
    return baseSummary;
  }
  if (baseSummary.includes(guidedAlternative.guidanceText)) {
    return baseSummary;
  }
  return `${baseSummary} ${guidedAlternative.guidanceText}`;
}

function buildBaseComparisonNote(input: LabExecutionAlternativesInput) {
  const goalEvaluation = input.executionGoalEvaluation;
  const patternStrength = goalEvaluation?.patternSignal?.strength;
  const interpretation = input.executionResultInterpretation;
  const adaptiveDecision = buildAdaptiveDecisionSignal({
    executionGoalEvaluation: goalEvaluation ?? null,
    executionResultInterpretation: interpretation ?? null,
  });
  if (adaptiveDecision.decisionPressure === "high") {
    return "Compared to this route, the alternatives provide safer evidence checks before carrying it further.";
  }
  if (goalEvaluation !== undefined && goalEvaluation !== null) {
    if (patternStrength === "weak") {
      return "Compared to historically weak similar results, these alternatives may recover coverage or reduce repeat failure.";
    }
    if (goalEvaluation.outcome === "failed") {
      return "Compared to the current result, these alternatives are better positioned to recover coverage or reduce divergence.";
    }
    if (goalEvaluation.outcome === "successful") {
      if (patternStrength === "strong" && interpretation?.alignment !== "deviates") {
        return "Compared to the current result, these alternatives are backup routes against an already stable pattern.";
      }
      if (interpretation?.alignment === "deviates") {
        return "Compared to the current result, these alternatives can validate the achieved outcome against the remaining divergence.";
      }
      return "Compared to the current result, these alternatives are backup routes rather than stronger paths.";
    }
  }
  if (interpretation !== undefined && interpretation !== null) {
    if (interpretation.coverageLevel === "low" || interpretation.alignment === "deviates") {
      return "Compared to the current result, these alternatives may improve coverage or reduce divergence.";
    }
    if (
      interpretation.coverageLevel === "high" &&
      interpretation.alignment === "matches-simulation"
    ) {
      return "Compared to the current result, these alternatives are backup routes rather than stronger paths.";
    }
    return "Compared to the current result, these alternatives can clarify the mixed execution signal.";
  }
  if (input.executionReflection.decision === "proceed") {
    return "Compared to the selected path, these alternatives can expose different evidence at the cost of changing the current balance.";
  }
  if (input.executionReflection.decision === "review") {
    return "Compared to the selected path, these alternatives trade the current uncertainty for clearer scope or steadier context.";
  }
  return "Compared to the selected path, these alternatives lower risk by changing scope, method, or intensity before any future handoff.";
}

function buildComparisonNote(
  input: LabExecutionAlternativesInput,
  guidedAlternative: LabGuidedAlternativeSignal
) {
  const baseComparisonNote = buildBaseComparisonNote(input);
  if (
    guidedAlternative.preferredAlternativeLabel === null ||
    baseComparisonNote.includes(guidedAlternative.preferredAlternativeLabel)
  ) {
    return baseComparisonNote;
  }
  return `${baseComparisonNote} ${guidedAlternative.preferredAlternativeLabel} is the clearest comparison point.`;
}

function buildConfidence(input: LabExecutionAlternativesInput, alternativeCount: number) {
  let confidence =
    input.executionReflection.confidence ??
    input.executionReadiness.confidence ??
    input.executionSimulation.metrics?.confidence ??
    input.executionPlan.confidence ??
    0.66;

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

export function buildExecutionAlternatives(
  input: LabExecutionAlternativesInput
): LabExecutionAlternatives {
  const alternatives = buildAlternatives(input);
  const confidence = buildConfidence(input, alternatives.length);
  const adaptiveDecision = buildAdaptiveDecisionSignal({
    executionGoalEvaluation: input.executionGoalEvaluation ?? null,
    executionResultInterpretation: input.executionResultInterpretation ?? null,
  });
  const guidedAlternative = buildGuidedAlternativeSignal({
    alternatives,
    alternativesConfidence: confidence,
    decisionPressure: adaptiveDecision.decisionPressure,
    executionGoalEvaluation: input.executionGoalEvaluation ?? null,
    executionResultInterpretation: input.executionResultInterpretation ?? null,
  });
  return {
    id: createAlternativesId(input),
    planId: input.executionPlan.id,
    summary: buildSummary(input, guidedAlternative),
    alternatives,
    comparisonNote: buildComparisonNote(input, guidedAlternative),
    confidence,
  };
}

export function buildExecutionAlternativesFromResolved(
  input: LabExecutionAlternativesResolvedInput
): LabExecutionAlternatives | null {
  if (
    input.activeSelection === null ||
    input.executionPlan === null ||
    input.executionReadiness === null ||
    input.executionReflection === null ||
    input.executionSimulation === null ||
    input.activeSelection.endMs <= input.activeSelection.startMs
  ) {
    return null;
  }
  return buildExecutionAlternatives({
    activeSelection: input.activeSelection,
    executionPlan: input.executionPlan,
    executionReadiness: input.executionReadiness,
    executionReflection: input.executionReflection,
    executionGoalEvaluation: input.executionGoalEvaluation ?? null,
    executionResultInterpretation: input.executionResultInterpretation ?? null,
    executionSimulation: input.executionSimulation,
    inspectionMode: input.inspectionMode,
    sourceKind: input.sourceKind,
  });
}
