import type {
  LabExecutionAlternative,
  LabExecutionDecisionPressure,
  LabExecutionGoalEvaluation,
  LabExecutionPatternStrength,
} from "../models/lab-types.js";

export type LabAdaptiveDecisionResultInterpretation = {
  alignment: "matches-simulation" | "partial" | "deviates";
};

export type LabAdaptiveDecisionSignal = {
  adaptiveDecisionHint: string;
  decisionPressure: LabExecutionDecisionPressure;
};

export type LabGuidedAlternativeSignal = {
  candidateGuidanceText: string;
  guidanceText: string;
  preferredAlternativeIndex: number | null;
  preferredAlternativeLabel: string | null;
};

type LabAdaptiveDecisionInput = {
  executionGoalEvaluation?: LabExecutionGoalEvaluation | null;
  executionResultInterpretation?: LabAdaptiveDecisionResultInterpretation | null;
};

type LabGuidedAlternativeInput = LabAdaptiveDecisionInput & {
  alternatives: ReadonlyArray<LabExecutionAlternative>;
  alternativesConfidence?: number | null;
  decisionPressure?: LabExecutionDecisionPressure;
};

function getAdaptiveDecisionHint(
  pressure: LabExecutionDecisionPressure,
  patternStrength: LabExecutionPatternStrength
) {
  if (pressure === "high") {
    if (patternStrength === "weak") {
      return "This path has historically underperformed under similar conditions.";
    }
    return "Current execution feedback indicates this path needs careful review.";
  }
  if (pressure === "medium") {
    return "Alternative strategies may yield more stable results.";
  }
  return "";
}

function getEmptyGuidedAlternativeSignal(): LabGuidedAlternativeSignal {
  return {
    candidateGuidanceText: "",
    guidanceText: "",
    preferredAlternativeIndex: null,
    preferredAlternativeLabel: null,
  };
}

function scoreAlternative(
  alternative: LabExecutionAlternative,
  input: LabGuidedAlternativeInput,
  decisionPressure: LabExecutionDecisionPressure
) {
  const goalEvaluation = input.executionGoalEvaluation ?? null;
  const interpretation = input.executionResultInterpretation ?? null;
  const patternStrength = goalEvaluation?.patternSignal?.strength ?? "neutral";
  const outcome = goalEvaluation?.outcome ?? "neutral";
  const alignment = interpretation?.alignment ?? null;
  let score = 0;

  if (decisionPressure === "high") {
    if (alternative.relativeAdvantage === "lower-risk") score += 5;
    if (alternative.relativeAdvantage === "more-stable") score += 4;
    if (alternative.relativeAdvantage === "higher-coverage") score += 3;
    if (alternative.relativeAdvantage === "higher-precision") score += 1;
  } else if (decisionPressure === "medium") {
    if (alternative.relativeAdvantage === "more-stable") score += 3;
    if (alternative.relativeAdvantage === "lower-risk") score += 2;
    if (alternative.relativeAdvantage === "higher-coverage") score += 2;
    if (alternative.relativeAdvantage === "higher-precision") score += 1;
  }

  if (patternStrength === "weak" || outcome === "failed") {
    if (alternative.relativeAdvantage === "lower-risk") score += 2;
    if (alternative.relativeAdvantage === "higher-coverage") score += 2;
    if (alternative.relativeAdvantage === "more-stable") score += 2;
  }

  if (alignment === "deviates" || alignment === "partial") {
    if (alternative.relativeAdvantage === "more-stable") score += 2;
    if (alternative.relativeAdvantage === "higher-coverage") score += 2;
  }

  return score;
}

export function buildAdaptiveDecisionSignal(
  input: LabAdaptiveDecisionInput
): LabAdaptiveDecisionSignal {
  const goalEvaluation = input.executionGoalEvaluation ?? null;
  const interpretation = input.executionResultInterpretation ?? null;
  const patternStrength = goalEvaluation?.patternSignal?.strength ?? "neutral";
  const outcome = goalEvaluation?.outcome ?? "neutral";
  const alignment = interpretation?.alignment ?? null;

  let decisionPressure: LabExecutionDecisionPressure = "low";

  if (
    (patternStrength === "weak" && outcome === "failed") ||
    (outcome === "failed" && alignment === "deviates")
  ) {
    decisionPressure = "high";
  } else if (
    (patternStrength === "strong" && outcome === "successful" && alignment !== "deviates") ||
    (outcome === "neutral" && alignment === null && patternStrength !== "weak")
  ) {
    decisionPressure = "low";
  } else if (
    patternStrength === "weak" ||
    outcome === "failed" ||
    alignment === "deviates" ||
    alignment === "partial"
  ) {
    decisionPressure = "medium";
  }

  return {
    adaptiveDecisionHint: getAdaptiveDecisionHint(decisionPressure, patternStrength),
    decisionPressure,
  };
}

export function buildGuidedAlternativeSignal(
  input: LabGuidedAlternativeInput
): LabGuidedAlternativeSignal {
  const alternatives = input.alternatives;
  const decisionPressure =
    input.decisionPressure ??
    buildAdaptiveDecisionSignal({
      executionGoalEvaluation: input.executionGoalEvaluation ?? null,
      executionResultInterpretation: input.executionResultInterpretation ?? null,
    }).decisionPressure;

  if (
    decisionPressure === "low" ||
    alternatives.length === 0 ||
    (decisionPressure === "medium" && (input.alternativesConfidence ?? 0.66) < 0.45)
  ) {
    return getEmptyGuidedAlternativeSignal();
  }

  let preferredAlternativeIndex = 0;
  let preferredAlternativeScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < alternatives.length; index += 1) {
    const alternative = alternatives[index];
    if (alternative === undefined) {
      continue;
    }
    const score = scoreAlternative(alternative, input, decisionPressure);
    if (score > preferredAlternativeScore) {
      preferredAlternativeIndex = index;
      preferredAlternativeScore = score;
    }
  }

  const preferredAlternative = alternatives[preferredAlternativeIndex];
  if (preferredAlternative === undefined) {
    return getEmptyGuidedAlternativeSignal();
  }

  const guidanceText =
    decisionPressure === "high"
      ? `A more stable alternative under current conditions is: ${preferredAlternative.label}.`
      : `A softer alternative to compare next is: ${preferredAlternative.label}.`;
  return {
    candidateGuidanceText: `Consider comparing ${preferredAlternative.label} for steadier context.`,
    guidanceText,
    preferredAlternativeIndex,
    preferredAlternativeLabel: preferredAlternative.label,
  };
}
