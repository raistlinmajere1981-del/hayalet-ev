import type {
  LabActiveExecutionResult,
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

export type LabCounterfactualProjection = {
  expectedCoverage: "increase" | "decrease" | "stable";
  expectedAlignment: "better" | "worse" | "similar";
  expectedStability: "higher" | "lower" | "similar";
  summary: string;
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

type LabCounterfactualProjectionContext = LabAdaptiveDecisionInput & {
  executionResult?: LabActiveExecutionResult | null;
  decisionPressure?: LabExecutionDecisionPressure;
};

function getNeutralCounterfactualProjection(): LabCounterfactualProjection {
  return {
    expectedCoverage: "stable",
    expectedAlignment: "similar",
    expectedStability: "similar",
    summary: "",
  };
}

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

function getCounterfactualCoverage(
  alternative: LabExecutionAlternative,
  executionResult: LabActiveExecutionResult | null
): LabCounterfactualProjection["expectedCoverage"] {
  const coverage = executionResult?.metrics.coverage ?? 0.5;
  if (alternative.relativeAdvantage === "higher-coverage") {
    return coverage < 0.8 ? "increase" : "stable";
  }
  if (alternative.relativeAdvantage === "higher-precision") {
    return coverage > 0.7 ? "decrease" : "stable";
  }
  if (alternative.relativeAdvantage === "lower-risk") {
    return coverage < 0.45 ? "increase" : "stable";
  }
  if (alternative.relativeAdvantage === "more-stable") {
    return coverage < 0.35 ? "increase" : "stable";
  }
  return "stable";
}

function getCounterfactualAlignment(
  alternative: LabExecutionAlternative,
  alignment: LabAdaptiveDecisionResultInterpretation["alignment"] | null,
  decisionPressure: LabExecutionDecisionPressure,
  outcome: LabExecutionGoalEvaluation["outcome"] | "neutral",
  patternStrength: LabExecutionPatternStrength
): LabCounterfactualProjection["expectedAlignment"] {
  const saferAlternative =
    alternative.relativeAdvantage === "lower-risk" ||
    alternative.relativeAdvantage === "more-stable" ||
    alternative.relativeAdvantage === "higher-coverage";

  if (alignment === "deviates") {
    return saferAlternative || alternative.relativeAdvantage === "higher-precision"
      ? "better"
      : "similar";
  }
  if (alignment === "partial") {
    if (saferAlternative) {
      return "better";
    }
    return alternative.relativeAdvantage === "higher-precision" ? "similar" : "worse";
  }
  if (
    alignment === "matches-simulation" &&
    decisionPressure === "medium" &&
    outcome === "neutral" &&
    patternStrength === "weak" &&
    alternative.relativeAdvantage === "higher-coverage"
  ) {
    return "worse";
  }
  return "similar";
}

function getCounterfactualStability(
  alternative: LabExecutionAlternative,
  decisionPressure: LabExecutionDecisionPressure,
  outcome: LabExecutionGoalEvaluation["outcome"] | "neutral",
  patternStrength: LabExecutionPatternStrength
): LabCounterfactualProjection["expectedStability"] {
  if (
    alternative.relativeAdvantage === "more-stable" ||
    alternative.relativeAdvantage === "lower-risk"
  ) {
    return "higher";
  }
  if (alternative.relativeAdvantage === "higher-precision") {
    return decisionPressure === "high" || outcome === "failed" || patternStrength === "weak"
      ? "lower"
      : "similar";
  }
  if (alternative.relativeAdvantage === "higher-coverage") {
    return decisionPressure === "high" || outcome === "failed" ? "higher" : "similar";
  }
  return "similar";
}

function buildCounterfactualSummary(projection: LabCounterfactualProjection) {
  if (
    projection.expectedCoverage === "stable" &&
    projection.expectedAlignment === "similar" &&
    projection.expectedStability === "similar"
  ) {
    return "";
  }
  return `Projected outcome suggests ${projection.expectedStability} stability, ${projection.expectedAlignment} alignment, and ${projection.expectedCoverage} coverage.`;
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

export function buildCounterfactualProjection(
  alternative: LabExecutionAlternative,
  context: LabCounterfactualProjectionContext
): LabCounterfactualProjection {
  const goalEvaluation = context.executionGoalEvaluation ?? null;
  const interpretation = context.executionResultInterpretation ?? null;
  const executionResult = context.executionResult ?? null;
  if (executionResult === null || (goalEvaluation === null && interpretation === null)) {
    return getNeutralCounterfactualProjection();
  }
  const decisionPressure =
    context.decisionPressure ??
    buildAdaptiveDecisionSignal({
      executionGoalEvaluation: goalEvaluation,
      executionResultInterpretation: interpretation,
    }).decisionPressure;
  const outcome = goalEvaluation?.outcome ?? "neutral";
  const patternStrength = goalEvaluation?.patternSignal?.strength ?? "neutral";
  const projection = {
    expectedCoverage: getCounterfactualCoverage(alternative, executionResult),
    expectedAlignment: getCounterfactualAlignment(
      alternative,
      interpretation?.alignment ?? null,
      decisionPressure,
      outcome,
      patternStrength
    ),
    expectedStability: getCounterfactualStability(
      alternative,
      decisionPressure,
      outcome,
      patternStrength
    ),
    summary: "",
  } satisfies LabCounterfactualProjection;

  if (decisionPressure === "high" && outcome === "failed") {
    projection.expectedAlignment = "better";
    if (projection.expectedStability !== "lower") {
      projection.expectedStability = "higher";
    }
  }

  if (patternStrength === "weak") {
    if (projection.expectedStability === "similar") {
      projection.expectedStability = "higher";
    }
    if (projection.expectedAlignment === "worse") {
      projection.expectedAlignment = "similar";
    }
  }

  if (
    interpretation?.alignment === "deviates" &&
    projection.expectedAlignment === "similar" &&
    alternative.relativeAdvantage !== "higher-precision"
  ) {
    projection.expectedAlignment = "better";
  }

  projection.summary = buildCounterfactualSummary(projection);
  return projection;
}
