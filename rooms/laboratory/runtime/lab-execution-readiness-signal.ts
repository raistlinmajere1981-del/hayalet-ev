import type {
  LabExecutionDecisionPressure,
  LabExecutionGoalEvaluation,
  LabExecutionPatternStrength,
} from "../models/lab-types.js";
import type { LabCounterfactualProjection } from "./lab-adaptive-decision.js";
import { resolveLabI18n, type LabI18nKey, type LabI18nLocale } from "./lab-i18n.js";

export type LabExecutionReadinessSignalAlignment =
  | "matches-simulation"
  | "partial"
  | "deviates"
  | "none";

export type LabExecutionReadinessSignalLevel = "steady" | "guarded" | "strained";

export type LabExecutionReadinessSignalConfidenceBand = "high" | "medium" | "low" | "unknown";

export type LabExecutionReadinessSignalProjectionAlignment =
  | LabCounterfactualProjection["expectedAlignment"]
  | "none";

export type LabExecutionReadinessSignal = {
  level: LabExecutionReadinessSignalLevel;
  decisionPressure: LabExecutionDecisionPressure;
  goalOutcome: LabExecutionGoalEvaluation["outcome"] | "neutral";
  patternStrength: LabExecutionPatternStrength;
  alignment: LabExecutionReadinessSignalAlignment;
  alternativesConfidenceBand: LabExecutionReadinessSignalConfidenceBand;
  projectionAlignment: LabExecutionReadinessSignalProjectionAlignment;
  score: number;
  reasons: string[];
};

export type LabExecutionReadinessSignalInput = {
  decisionPressure: LabExecutionDecisionPressure;
  goalEvaluation?: LabExecutionGoalEvaluation | null;
  patternStrength?: LabExecutionPatternStrength | null;
  alignment?: LabExecutionReadinessSignalAlignment | null;
  alternativesConfidence?: number | null;
  projection?: LabCounterfactualProjection | null;
};

function getGoalOutcome(input: LabExecutionReadinessSignalInput) {
  return input.goalEvaluation?.outcome ?? "neutral";
}

function getPatternStrength(input: LabExecutionReadinessSignalInput) {
  return input.patternStrength ?? input.goalEvaluation?.patternSignal?.strength ?? "neutral";
}

function getAlignment(
  input: LabExecutionReadinessSignalInput
): LabExecutionReadinessSignalAlignment {
  return input.alignment ?? "none";
}

function getAlternativesConfidenceBand(
  value: number | null | undefined
): LabExecutionReadinessSignalConfidenceBand {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "unknown";
  }
  if (value >= 0.75) {
    return "high";
  }
  if (value >= 0.45) {
    return "medium";
  }
  return "low";
}

function getProjectionAlignment(
  projection: LabCounterfactualProjection | null | undefined
): LabExecutionReadinessSignalProjectionAlignment {
  return projection?.expectedAlignment ?? "none";
}

function getProjectionStability(projection: LabCounterfactualProjection | null | undefined) {
  return projection?.expectedStability ?? "similar";
}

function scoreDecisionPressure(pressure: LabExecutionDecisionPressure) {
  if (pressure === "high") {
    return 3;
  }
  if (pressure === "medium") {
    return 1;
  }
  return 0;
}

function scoreGoalOutcome(outcome: LabExecutionReadinessSignal["goalOutcome"]) {
  if (outcome === "failed") {
    return 2;
  }
  if (outcome === "successful") {
    return -1;
  }
  return 0;
}

function scorePatternStrength(patternStrength: LabExecutionPatternStrength) {
  if (patternStrength === "weak") {
    return 2;
  }
  if (patternStrength === "strong") {
    return -1;
  }
  return 0;
}

function scoreAlignment(alignment: LabExecutionReadinessSignalAlignment) {
  if (alignment === "deviates") {
    return 2;
  }
  if (alignment === "partial") {
    return 1;
  }
  if (alignment === "matches-simulation") {
    return -1;
  }
  return 0;
}

function scoreAlternativesConfidence(band: LabExecutionReadinessSignalConfidenceBand) {
  if (band === "low") {
    return 1;
  }
  if (band === "high") {
    return -1;
  }
  return 0;
}

function scoreProjection(
  projectionAlignment: LabExecutionReadinessSignalProjectionAlignment,
  projectionStability: LabCounterfactualProjection["expectedStability"] | "similar"
) {
  let score = 0;
  if (projectionAlignment === "better") {
    score -= 1;
  } else if (projectionAlignment === "worse") {
    score += 1;
  }
  if (projectionStability === "higher") {
    score -= 1;
  } else if (projectionStability === "lower") {
    score += 1;
  }
  return score;
}

function getLevel(score: number): LabExecutionReadinessSignalLevel {
  if (score >= 5) {
    return "strained";
  }
  if (score >= 2) {
    return "guarded";
  }
  return "steady";
}

function buildReasons(input: {
  decisionPressure: LabExecutionDecisionPressure;
  goalOutcome: LabExecutionReadinessSignal["goalOutcome"];
  patternStrength: LabExecutionPatternStrength;
  alignment: LabExecutionReadinessSignalAlignment;
  alternativesConfidenceBand: LabExecutionReadinessSignalConfidenceBand;
  projectionAlignment: LabExecutionReadinessSignalProjectionAlignment;
}) {
  return [
    `${input.decisionPressure}-pressure`,
    `${input.goalOutcome}-goal`,
    `${input.patternStrength}-pattern`,
    `${input.alignment}-alignment`,
    `${input.alternativesConfidenceBand}-alternative-confidence`,
    `${input.projectionAlignment}-projection`,
  ];
}

function getAlignmentPhrase(
  alignment: LabExecutionReadinessSignalAlignment,
  locale: LabI18nLocale
) {
  if (locale === "tr") {
    if (alignment === "matches-simulation") {
      return "eşleşen uyum";
    }
    if (alignment === "deviates") {
      return "sapan uyum";
    }
    if (alignment === "partial") {
      return "kısmi uyum";
    }
    return "ölçülmemiş uyum";
  }
  if (alignment === "matches-simulation") {
    return "matched alignment";
  }
  if (alignment === "deviates") {
    return "deviating alignment";
  }
  if (alignment === "partial") {
    return "partial alignment";
  }
  return "unmeasured alignment";
}

function getProjectionKey(alignment: LabExecutionReadinessSignalProjectionAlignment): LabI18nKey {
  if (alignment === "better") {
    return "projection.increase";
  }
  if (alignment === "worse") {
    return "projection.decrease";
  }
  return "projection.stable";
}

function getProjectionPhrase(
  alignment: LabExecutionReadinessSignalProjectionAlignment,
  locale: LabI18nLocale
) {
  return resolveLabI18n(getProjectionKey(alignment), locale);
}

export function buildExecutionReadinessSignal(
  input: LabExecutionReadinessSignalInput
): LabExecutionReadinessSignal {
  const goalOutcome = getGoalOutcome(input);
  const patternStrength = getPatternStrength(input);
  const alignment = getAlignment(input);
  const alternativesConfidenceBand = getAlternativesConfidenceBand(input.alternativesConfidence);
  const projectionAlignment = getProjectionAlignment(input.projection);
  const projectionStability = getProjectionStability(input.projection);
  const score =
    scoreDecisionPressure(input.decisionPressure) +
    scoreGoalOutcome(goalOutcome) +
    scorePatternStrength(patternStrength) +
    scoreAlignment(alignment) +
    scoreAlternativesConfidence(alternativesConfidenceBand) +
    scoreProjection(projectionAlignment, projectionStability);

  return {
    level: getLevel(score),
    decisionPressure: input.decisionPressure,
    goalOutcome,
    patternStrength,
    alignment,
    alternativesConfidenceBand,
    projectionAlignment,
    score,
    reasons: buildReasons({
      decisionPressure: input.decisionPressure,
      goalOutcome,
      patternStrength,
      alignment,
      alternativesConfidenceBand,
      projectionAlignment,
    }),
  };
}

export function formatExecutionReadinessSignalAdvisory(
  signal: LabExecutionReadinessSignal,
  locale: LabI18nLocale = "en"
) {
  const view = resolveLabI18n("readiness.view", locale);
  if (locale === "tr") {
    return `${view}: ${signal.level} sinyal; ${signal.decisionPressure} baskı, ${signal.patternStrength} örüntü, ${getAlignmentPhrase(signal.alignment, locale)}, ${signal.alternativesConfidenceBand} alternatif güveni ve ${getProjectionPhrase(signal.projectionAlignment, locale)}.`;
  }
  return `${view}: ${signal.level} signal from ${signal.decisionPressure} pressure, ${signal.patternStrength} pattern, ${getAlignmentPhrase(signal.alignment, locale)}, ${signal.alternativesConfidenceBand} alternative confidence, and ${getProjectionPhrase(signal.projectionAlignment, locale)}.`;
}
