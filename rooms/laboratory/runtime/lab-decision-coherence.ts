export type LabDecisionCoherence = {
  state: "aligned" | "mixed" | "conflicted";
  dominantAxis: "safety" | "exploration" | "neutral";
  confidence: number;
  summary: string;
};

type LabDecisionCoherenceInput = {
  posture?: "proceed" | "proceed-with-caution" | "reconsider";
  readiness?: {
    level: "steady" | "guarded" | "strained";
    score: number;
  };
  projection?: {
    expectedAlignment?: "better" | "worse" | "similar";
    expectedStability?: "higher" | "lower" | "similar";
    expectedCoverage?: "increase" | "decrease" | "stable";
  };
};

type LabDecisionCoherenceProjection = NonNullable<LabDecisionCoherenceInput["projection"]>;

function scorePosture(posture: LabDecisionCoherenceInput["posture"]) {
  if (posture === "proceed") {
    return 1;
  }
  if (posture === "reconsider") {
    return -1;
  }
  return 0;
}

function scoreReadiness(readiness: LabDecisionCoherenceInput["readiness"]) {
  if (readiness?.level === "steady") {
    return 1;
  }
  if (readiness?.level === "strained") {
    return -1;
  }
  return 0;
}

function scoreProjectionAlignment(alignment: LabDecisionCoherenceProjection["expectedAlignment"]) {
  if (alignment === "better") {
    return 1;
  }
  if (alignment === "worse") {
    return -1;
  }
  return 0;
}

function scoreProjectionStability(stability: LabDecisionCoherenceProjection["expectedStability"]) {
  if (stability === "higher") {
    return 1;
  }
  if (stability === "lower") {
    return -1;
  }
  return 0;
}

function scoreProjection(projection: LabDecisionCoherenceInput["projection"]) {
  const projectionScore =
    scoreProjectionAlignment(projection?.expectedAlignment) +
    scoreProjectionStability(projection?.expectedStability);
  if (projectionScore >= 1) {
    return 1;
  }
  if (projectionScore <= -1) {
    return -1;
  }
  return 0;
}

function resolveState(totalScore: number): LabDecisionCoherence["state"] {
  if (totalScore >= 2) {
    return "aligned";
  }
  if (totalScore <= -2) {
    return "conflicted";
  }
  return "mixed";
}

function resolveDominantAxis(
  readiness: LabDecisionCoherenceInput["readiness"],
  projection: LabDecisionCoherenceInput["projection"]
): LabDecisionCoherence["dominantAxis"] {
  if (projection?.expectedCoverage === "increase") {
    return "exploration";
  }
  if (readiness?.level === "strained") {
    return "safety";
  }
  return "neutral";
}

function formatAxisHint(axis: LabDecisionCoherence["dominantAxis"]) {
  if (axis === "exploration") {
    return " with exploratory tendencies";
  }
  if (axis === "safety") {
    return " with cautionary signals";
  }
  return "";
}

export function formatDecisionCoherenceAdvisory(coherence: LabDecisionCoherence): string {
  const axisHint = formatAxisHint(coherence.dominantAxis);
  if (coherence.state === "aligned") {
    return `Coherence view: Signals are aligned toward a stable path${axisHint}.`;
  }
  if (coherence.state === "conflicted") {
    return `Coherence view: Signals are conflicted, indicating a high-risk and unstable path${axisHint}.`;
  }
  return `Coherence view: Signals are mixed, with trade-offs between stability and coverage${axisHint}.`;
}

export function buildDecisionCoherence(
  input: LabDecisionCoherenceInput
): LabDecisionCoherence {
  const totalScore =
    scorePosture(input.posture) + scoreReadiness(input.readiness) + scoreProjection(input.projection);
  const coherence = {
    state: resolveState(totalScore),
    dominantAxis: resolveDominantAxis(input.readiness, input.projection),
    confidence: Math.min(1, Math.abs(totalScore) / 3),
    summary: "",
  } satisfies LabDecisionCoherence;
  return {
    ...coherence,
    summary: formatDecisionCoherenceAdvisory(coherence),
  };
}
