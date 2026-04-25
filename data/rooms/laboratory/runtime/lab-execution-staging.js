function clampConfidence(value) {
  return Math.max(0.25, Math.min(0.98, Number(value.toFixed(2))));
}
function pushUnique(target, value) {
  if (!target.includes(value)) {
    target.push(value);
  }
}
function hasValidSelection(selection) {
  return Number.isFinite(selection.startMs) && Number.isFinite(selection.endMs) && selection.endMs > selection.startMs;
}
function upstreamPlanIdsMatch(input) {
  const planId = input.executionPlan.id;
  return input.executionSimulation.planId === planId && input.executionReadiness.planId === planId && input.executionPayloadPreview.planId === planId && input.executionReflection.planId === planId && input.executionAlternatives.planId === planId && input.executionCandidate.planId === planId && input.executionCommitment.planId === planId;
}
function upstreamSignalsMatch(input) {
  return input.executionCommitment.candidateStatus === input.executionCandidate.status && input.executionCandidate.readinessStatus === input.executionReadiness.status && input.executionCandidate.reflectionDecision === input.executionReflection.decision && input.executionPayloadPreview.readinessStatus === input.executionReadiness.status;
}
function getBaseConfidence(input) {
  return input.executionCommitment.confidence ?? input.executionCandidate.confidence ?? input.executionReadiness.confidence ?? input.executionReflection.confidence ?? input.executionSimulation.metrics?.confidence ?? input.executionAlternatives.confidence ?? input.executionPlan.confidence ?? 0.66;
}
function getSimulationRisk(input) {
  return input.executionSimulation.metrics?.risk ?? "low";
}
function hasAlternativePressure(input) {
  if (input.executionAlternatives.alternatives.length === 0) {
    return false;
  }
  if (input.executionCandidate.status === "unstable") {
    return true;
  }
  return input.executionAlternatives.alternatives.some(function(alternative) {
    return alternative.relativeAdvantage === "lower-risk" || alternative.relativeAdvantage === "higher-coverage" || alternative.tradeoff.toLowerCase().includes("risk") || alternative.tradeoff.toLowerCase().includes("context");
  });
}
function buildNotes(input) {
  const notes = [];
  if (input.executionReadiness.status === "needs-review") {
    pushUnique(notes, "Readiness still asks for review before staging.");
  }
  if (input.executionReflection.decision === "review") {
    pushUnique(notes, "Reflection keeps this path in a review-oriented posture.");
  }
  if (hasAlternativePressure(input)) {
    pushUnique(notes, "Alternative paths remain visible for comparison before staging.");
  }
  if (input.executionAlternatives.comparisonNote) {
    pushUnique(notes, input.executionAlternatives.comparisonNote);
  }
  return notes.length > 0 ? notes : void 0;
}
function buildWarnings(input) {
  const warnings = [];
  if (input.executionCandidate.status === "unstable") {
    pushUnique(warnings, "Candidate remains unstable; staging keeps that uncertainty visible.");
  }
  if (input.executionPayloadPreview.readinessPassesPreview === false) {
    pushUnique(warnings, "Payload preview does not currently pass its readiness check.");
  }
  if (getSimulationRisk(input) !== "low") {
    pushUnique(warnings, `Simulation risk remains ${getSimulationRisk(input)}.`);
  }
  for (const warning of input.executionSimulation.warnings ?? []) {
    pushUnique(warnings, `Simulation warning: ${warning}`);
  }
  for (const uncertainty of input.executionCandidate.uncertainties ?? []) {
    pushUnique(warnings, `Candidate uncertainty: ${uncertainty}`);
  }
  return warnings.length > 0 ? warnings : void 0;
}
function buildConfidence(input, status, warningCount) {
  let confidence = getBaseConfidence(input);
  if (status === "staged") {
    confidence += 0.03;
  } else {
    confidence -= 0.08;
  }
  if (input.executionCandidate.status === "viable") {
    confidence += 0.02;
  } else if (input.executionCandidate.status === "unstable") {
    confidence -= 0.06;
  }
  if (input.executionReadiness.status === "needs-review") {
    confidence -= 0.05;
  }
  if (input.executionReflection.decision === "review") {
    confidence -= 0.04;
  }
  if (hasAlternativePressure(input)) {
    confidence -= 0.02;
  }
  confidence -= Math.min(0.08, warningCount * 0.02);
  return clampConfidence(confidence);
}
function buildExecutionStaging(input) {
  const status = input.executionPayloadPreview.readinessPassesPreview ? "staged" : "not-staged";
  const warnings = buildWarnings(input);
  const notes = buildNotes(input);
  return {
    id: `staging:${input.executionPlan.id}`,
    planId: input.executionPlan.id,
    status,
    summary: status === "staged" ? "This path is prepared and can be staged for execution." : "This path is not currently in a staged state.",
    commitmentStatus: "committed",
    candidateStatus: input.executionCandidate.status,
    readinessStatus: input.executionReadiness.status,
    ...notes ? { notes } : {},
    ...warnings ? { warnings } : {},
    confidence: buildConfidence(input, status, warnings?.length ?? 0)
  };
}
export function buildExecutionStagingFromResolved(input) {
  if (input.activeSelection === null || input.executionAlternatives === null || input.executionCandidate === null || input.executionCommitment === null || input.executionPayloadPreview === null || input.executionPlan === null || input.executionReadiness === null || input.executionReflection === null || input.executionSimulation === null || !hasValidSelection(input.activeSelection) || input.executionCommitment.status !== "committed" || input.executionCandidate.status === "not-viable" || input.executionReadiness.status === "blocked") {
    return null;
  }
  const resolvedInput = {
    activeSelection: input.activeSelection,
    executionAlternatives: input.executionAlternatives,
    executionCandidate: input.executionCandidate,
    executionCommitment: input.executionCommitment,
    executionPayloadPreview: input.executionPayloadPreview,
    executionPlan: input.executionPlan,
    executionReadiness: input.executionReadiness,
    executionReflection: input.executionReflection,
    executionSimulation: input.executionSimulation
  };
  if (!upstreamPlanIdsMatch(resolvedInput) || !upstreamSignalsMatch(resolvedInput)) {
    return null;
  }
  return buildExecutionStaging(resolvedInput);
}
