function clampConfidence(value) {
  return Math.max(0.25, Math.min(0.98, Number(value.toFixed(2))));
}
function createCandidateId(input) {
  return `candidate:${input.executionPlan.id}`;
}
function pushUnique(target, value) {
  if (!target.includes(value)) {
    target.push(value);
  }
}
function hasEntries(value) {
  return Object.keys(value).length > 0;
}
function hasValidSelection(selection) {
  return Number.isFinite(selection.startMs) && Number.isFinite(selection.endMs) && selection.endMs > selection.startMs;
}
function hasValidRoi(roi) {
  if (roi === void 0) {
    return false;
  }
  return Number.isFinite(roi.x) && Number.isFinite(roi.y) && Number.isFinite(roi.width) && Number.isFinite(roi.height) && roi.x >= 0 && roi.y >= 0 && roi.width > 0 && roi.height > 0 && roi.x + roi.width <= 1.001 && roi.y + roi.height <= 1.001;
}
function actionRequiresRoi(actionType) {
  return actionType === "focus-region";
}
function hasCoherentPlan(input) {
  return input.executionPlan.id.trim() !== "" && input.executionPlan.suggestionId.trim() !== "" && input.executionPlan.steps.length > 0 && input.executionPlan.expectedOutputs.length > 0 && input.executionPlan.actionType.trim() !== "";
}
function hasCoherentPayload(input) {
  const dryRunShape = input.executionPayloadPreview.dryRunShape;
  return input.executionPayloadPreview.planId === input.executionPlan.id && input.executionPayloadPreview.actionType === input.executionPlan.actionType && input.executionPayloadPreview.readinessStatus === input.executionReadiness.status && hasEntries(dryRunShape.previewInput) && hasEntries(dryRunShape.previewParameters) && dryRunShape.previewExpectedOutputs.length > 0;
}
function upstreamPlanIdsMatch(input) {
  const planId = input.executionPlan.id;
  return input.executionSimulation.planId === planId && input.executionReadiness.planId === planId && input.executionPayloadPreview.planId === planId && input.executionReflection.planId === planId && input.executionAlternatives.planId === planId;
}
function getSimulationRisk(input) {
  return input.executionSimulation.metrics?.risk ?? "low";
}
function getBaseConfidence(input) {
  return input.executionReflection.confidence ?? input.executionReadiness.confidence ?? input.executionSimulation.metrics?.confidence ?? input.executionPlan.confidence ?? input.executionAlternatives.confidence ?? 0.66;
}
function hasMaterialAlternativePressure(input) {
  const warningCount = input.executionSimulation.warnings?.length ?? 0;
  const lowConfidence = getBaseConfidence(input) < 0.68;
  const unstableUpstream = input.executionReadiness.status !== "ready" || input.executionReflection.decision !== "proceed" || getSimulationRisk(input) !== "low" || warningCount > 0 || lowConfidence;
  if (!unstableUpstream) {
    return false;
  }
  return input.executionAlternatives.alternatives.some(function(alternative) {
    return alternative.relativeAdvantage === "lower-risk" || alternative.relativeAdvantage === "higher-coverage" || alternative.tradeoff.toLowerCase().includes("risk") || alternative.tradeoff.toLowerCase().includes("coverage") || alternative.tradeoff.toLowerCase().includes("context");
  });
}
function buildNotes(input, materialAlternativePressure) {
  const notes = [];
  pushUnique(notes, `Readiness status is ${input.executionReadiness.status}.`);
  pushUnique(notes, `Reflection decision is ${input.executionReflection.decision}.`);
  if (input.executionPayloadPreview.readinessPassesPreview) {
    pushUnique(notes, "Payload preview is structurally aligned with the readiness signal.");
  } else {
    pushUnique(notes, "Payload preview still reports a readiness mismatch.");
  }
  if (input.executionAlternatives.alternatives.length > 0) {
    pushUnique(notes, "Alternative paths are documented for comparison without changing state.");
  }
  if (materialAlternativePressure) {
    pushUnique(notes, "Alternative tradeoffs materially affect this candidate assessment.");
  }
  return notes;
}
function buildUncertainties(input, materialAlternativePressure) {
  const uncertainties = [];
  const simulationRisk = getSimulationRisk(input);
  for (const blocker of input.executionReadiness.blockers ?? []) {
    pushUnique(uncertainties, `Readiness blocker: ${blocker}`);
  }
  for (const warning of input.executionSimulation.warnings ?? []) {
    pushUnique(uncertainties, `Simulation warning: ${warning}`);
  }
  if (input.executionPayloadPreview.readinessPassesPreview === false) {
    pushUnique(uncertainties, "Payload preview does not yet pass its readiness check.");
  }
  if (simulationRisk !== "low") {
    pushUnique(uncertainties, `Simulation risk remains ${simulationRisk}.`);
  }
  if (getBaseConfidence(input) < 0.68) {
    pushUnique(uncertainties, "Upstream confidence is low enough to keep structural uncertainty.");
  }
  if (materialAlternativePressure) {
    pushUnique(uncertainties, "Alternative paths expose meaningful tradeoffs for this route.");
  }
  return uncertainties.length > 0 ? uncertainties : void 0;
}
function evaluateStructuralIntegrity(input, materialAlternativePressure) {
  const payloadComplete = hasCoherentPayload(input);
  const roiRequired = actionRequiresRoi(input.executionPlan.actionType);
  const roiValid = hasValidRoi(input.activeSelection.roi);
  if (!hasValidSelection(input.activeSelection) || !upstreamPlanIdsMatch(input) || !hasCoherentPlan(input) || !payloadComplete || roiRequired && !roiValid || input.executionReadiness.status === "blocked" || input.executionReflection.decision === "avoid" || getSimulationRisk(input) === "high") {
    return "insufficient";
  }
  if (input.executionReadiness.status === "needs-review" || input.executionReflection.decision === "review" || input.executionPayloadPreview.readinessPassesPreview === false || (input.executionSimulation.warnings?.length ?? 0) > 0 || getBaseConfidence(input) < 0.68 || materialAlternativePressure) {
    return "partial";
  }
  return "complete";
}
function evaluateStatus(input, structuralIntegrity, materialAlternativePressure) {
  if (structuralIntegrity === "insufficient" || input.executionReadiness.status === "blocked" || input.executionReflection.decision === "avoid" || getSimulationRisk(input) === "high") {
    return "not-viable";
  }
  if (structuralIntegrity === "complete" && input.executionReadiness.status === "ready" && input.executionReflection.decision === "proceed" && input.executionPayloadPreview.readinessPassesPreview && (input.executionSimulation.warnings?.length ?? 0) === 0 && !materialAlternativePressure) {
    return "viable";
  }
  return "unstable";
}
function buildSummary(status) {
  if (status === "viable") {
    return "This path is structurally ready for execution.";
  }
  if (status === "unstable") {
    return "This path may require refinement before execution.";
  }
  return "This path is not structurally suitable for execution.";
}
function buildConfidence(input, status, structuralIntegrity, uncertaintyCount) {
  let confidence = getBaseConfidence(input);
  if (status === "viable") {
    confidence += 0.04;
  } else if (status === "unstable") {
    confidence -= 0.05;
  } else {
    confidence -= 0.14;
  }
  if (structuralIntegrity === "complete") {
    confidence += 0.03;
  } else if (structuralIntegrity === "partial") {
    confidence -= 0.04;
  } else {
    confidence -= 0.12;
  }
  confidence -= Math.min(0.08, uncertaintyCount * 0.02);
  return clampConfidence(confidence);
}
function buildExecutionCandidate(input) {
  const materialAlternativePressure = hasMaterialAlternativePressure(input);
  const structuralIntegrity = evaluateStructuralIntegrity(input, materialAlternativePressure);
  const status = evaluateStatus(input, structuralIntegrity, materialAlternativePressure);
  const uncertainties = buildUncertainties(input, materialAlternativePressure);
  return {
    id: createCandidateId(input),
    planId: input.executionPlan.id,
    status,
    summary: buildSummary(status),
    structuralIntegrity,
    readinessStatus: input.executionReadiness.status,
    reflectionDecision: input.executionReflection.decision,
    notes: buildNotes(input, materialAlternativePressure),
    ...uncertainties ? { uncertainties } : {},
    confidence: buildConfidence(input, status, structuralIntegrity, uncertainties?.length ?? 0)
  };
}
export function buildExecutionCandidateFromResolved(input) {
  if (input.activeSelection === null || input.executionAlternatives === null || input.executionPayloadPreview === null || input.executionPlan === null || input.executionReadiness === null || input.executionReflection === null || input.executionSimulation === null || input.activeSelection.endMs <= input.activeSelection.startMs) {
    return null;
  }
  const resolvedInput = {
    activeSelection: input.activeSelection,
    executionAlternatives: input.executionAlternatives,
    executionPayloadPreview: input.executionPayloadPreview,
    executionPlan: input.executionPlan,
    executionReadiness: input.executionReadiness,
    executionReflection: input.executionReflection,
    executionSimulation: input.executionSimulation,
    inspectionMode: input.inspectionMode,
    sourceKind: input.sourceKind
  };
  if (!upstreamPlanIdsMatch(resolvedInput)) {
    return null;
  }
  return buildExecutionCandidate(resolvedInput);
}
