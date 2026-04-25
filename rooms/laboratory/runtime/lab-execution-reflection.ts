import type {
  LabExecutionPayloadPreview,
  LabExecutionPlan,
  LabExecutionReadiness,
  LabExecutionReflection,
  LabExecutionSimulation,
  LabInspectionMode,
  LabSelection,
} from "../models/lab-types.js";

type LabExecutionReflectionInput = {
  activeSelection: LabSelection;
  executionPayloadPreview: LabExecutionPayloadPreview;
  executionPlan: LabExecutionPlan;
  executionReadiness: LabExecutionReadiness;
  executionSimulation: LabExecutionSimulation;
  inspectionMode: LabInspectionMode;
  sourceKind: string;
};

export type LabExecutionReflectionResolvedInput = {
  activeSelection: LabSelection | null;
  executionPayloadPreview: LabExecutionPayloadPreview | null;
  executionPlan: LabExecutionPlan | null;
  executionReadiness: LabExecutionReadiness | null;
  executionSimulation: LabExecutionSimulation | null;
  inspectionMode: LabInspectionMode;
  sourceKind: string;
};

function clampConfidence(value: number) {
  return Math.max(0.25, Math.min(0.98, Number(value.toFixed(2))));
}

function createReflectionId(input: LabExecutionReflectionInput) {
  return `reflection:${input.executionPlan.id}`;
}

function getSelectionDurationMs(selection: LabSelection) {
  return Math.max(0, selection.endMs - selection.startMs);
}

function getRoiArea(selection: LabSelection) {
  return selection.roi ? selection.roi.width * selection.roi.height : 0;
}

function getRoiAspectRatio(selection: LabSelection) {
  if (selection.roi === undefined) {
    return null;
  }
  const { height, width } = selection.roi;
  if (height <= 0 || width <= 0) {
    return Infinity;
  }
  return Math.max(width / height, height / width);
}

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function getSimulationRisk(input: LabExecutionReflectionInput) {
  return input.executionSimulation.metrics?.risk ?? "low";
}

function getBaseConfidence(input: LabExecutionReflectionInput) {
  return (
    input.executionReadiness.confidence ??
    input.executionSimulation.metrics?.confidence ??
    input.executionPlan.confidence ??
    0.66
  );
}

function decide(input: LabExecutionReflectionInput): LabExecutionReflection["decision"] {
  const durationMs = getSelectionDurationMs(input.activeSelection);
  const roiArea = getRoiArea(input.activeSelection);
  const readinessBlockers = input.executionReadiness.blockers ?? [];
  const simulationRisk = getSimulationRisk(input);

  if (
    input.executionReadiness.status === "blocked" ||
    simulationRisk === "high" ||
    readinessBlockers.length > 0 ||
    (durationMs > 0 && durationMs < 200) ||
    (roiArea > 0 && roiArea < 0.01)
  ) {
    return "avoid";
  }

  if (
    input.executionReadiness.status === "needs-review" ||
    input.executionPayloadPreview.readinessPassesPreview === false ||
    input.executionPayloadPreview.readinessStatus === "needs-review" ||
    (input.executionSimulation.warnings?.length ?? 0) > 0 ||
    getBaseConfidence(input) < 0.68 ||
    (durationMs > 0 && durationMs < 500) ||
    (roiArea >= 0.01 && roiArea < 0.03) ||
    roiArea > 0.6
  ) {
    return "review";
  }

  return "proceed";
}

function buildSummary(decision: LabExecutionReflection["decision"]) {
  if (decision === "proceed") {
    return "This path appears stable as a passive dry-run decision.";
  }
  if (decision === "review") {
    return "This path may require additional review before it is carried further.";
  }
  return "This path is not recommended in its current form.";
}

function buildReasoning(
  input: LabExecutionReflectionInput,
  decision: LabExecutionReflection["decision"]
) {
  const reasoning: string[] = [];
  const durationMs = getSelectionDurationMs(input.activeSelection);
  const roiArea = getRoiArea(input.activeSelection);
  const roiAspectRatio = getRoiAspectRatio(input.activeSelection);
  const simulationRisk = getSimulationRisk(input);

  if (decision === "proceed") {
    pushUnique(reasoning, "Readiness and simulation signals align with a stable dry-run path.");
  }

  pushUnique(
    reasoning,
    input.executionPayloadPreview.readinessPassesPreview
      ? "Payload preview reports a passing readiness signal."
      : "Payload preview asks for additional review before this path is carried further."
  );

  if (input.executionReadiness.status !== "ready") {
    pushUnique(reasoning, `Readiness status is ${input.executionReadiness.status}.`);
  }

  for (const blocker of input.executionReadiness.blockers ?? []) {
    pushUnique(reasoning, `Readiness blocker: ${blocker}`);
  }

  for (const note of input.executionReadiness.notes ?? []) {
    pushUnique(reasoning, `Review note: ${note}`);
  }

  for (const warning of input.executionSimulation.warnings ?? []) {
    pushUnique(reasoning, `Simulation warning: ${warning}`);
  }

  if (simulationRisk !== "low") {
    pushUnique(reasoning, `Simulation risk is ${simulationRisk}.`);
  }

  if (durationMs > 0 && durationMs < 500) {
    pushUnique(reasoning, "Selection window may be too narrow for reliable interpretation.");
  } else if (durationMs > 10000) {
    pushUnique(reasoning, "Selection window is broad enough to trade precision for context.");
  }

  if (roiArea > 0 && roiArea < 0.03) {
    pushUnique(reasoning, "ROI coverage is tight and may leave limited surrounding context.");
  } else if (roiArea >= 0.03 && roiArea <= 0.6) {
    pushUnique(reasoning, "ROI coverage is sufficient for focused inspection.");
  } else if (roiArea > 0.6) {
    pushUnique(reasoning, "ROI coverage is broad and may dilute local detail.");
  }

  if (roiAspectRatio !== null && Number.isFinite(roiAspectRatio) && roiAspectRatio > 3.5) {
    pushUnique(reasoning, "ROI aspect ratio is extreme enough to affect framing judgment.");
  }

  if (reasoning.length === 0) {
    pushUnique(reasoning, "The dry-run path has enough context for a passive decision.");
  }

  return reasoning;
}

function buildTradeoffs(
  input: LabExecutionReflectionInput,
  decision: LabExecutionReflection["decision"]
) {
  const tradeoffs: string[] = [];
  const durationMs = getSelectionDurationMs(input.activeSelection);
  const roiArea = getRoiArea(input.activeSelection);
  const actionType = input.executionPlan.actionType;

  if (actionType === "inspect-audio") {
    pushUnique(
      tradeoffs,
      "Audio-focused review can expose signal detail while amplifying preview bias."
    );
  } else if (actionType === "focus-region") {
    pushUnique(
      tradeoffs,
      "Region focus improves local detail while reducing surrounding scene context."
    );
  } else if (actionType === "inspect-motion") {
    pushUnique(
      tradeoffs,
      "Motion review clarifies continuity while depending heavily on playback cadence."
    );
  } else if (actionType === "analyze-segment") {
    pushUnique(tradeoffs, "Segment review balances anomaly coverage against selection precision.");
  }

  if (durationMs > 10000) {
    pushUnique(tradeoffs, "A wider selection keeps context but can reduce decision precision.");
  }

  if (roiArea > 0 && roiArea < 0.05) {
    pushUnique(tradeoffs, "A smaller ROI increases focus but can hide nearby evidence.");
  }

  if (decision === "proceed" && tradeoffs.length === 0) {
    pushUnique(
      tradeoffs,
      "The path is stable, but the reflection remains advisory rather than executable."
    );
  }

  return tradeoffs.length > 0 ? tradeoffs : undefined;
}

function buildAlternatives(
  input: LabExecutionReflectionInput,
  decision: LabExecutionReflection["decision"]
) {
  if (decision === "proceed") {
    return undefined;
  }

  const alternatives: string[] = [];
  const durationMs = getSelectionDurationMs(input.activeSelection);
  const roiArea = getRoiArea(input.activeSelection);
  const textSignals = [
    ...(input.executionReadiness.notes ?? []),
    ...(input.executionReadiness.blockers ?? []),
    ...(input.executionSimulation.warnings ?? []),
  ].join(" ");

  if (durationMs > 0 && durationMs < 500) {
    pushUnique(alternatives, "Expand selection range");
  }
  if (durationMs > 10000) {
    pushUnique(alternatives, "Narrow selection range");
  }
  if (roiArea > 0 && (roiArea < 0.03 || roiArea > 0.6)) {
    pushUnique(alternatives, "Refine ROI boundaries");
  }
  if (/playback|motion/i.test(textSignals)) {
    pushUnique(alternatives, "Reduce playback rate");
  }
  if (/gain|distort/i.test(textSignals)) {
    pushUnique(alternatives, "Lower preview gain");
  }

  if (alternatives.length === 0) {
    pushUnique(
      alternatives,
      "Review the selection and dry-run notes before carrying this path further"
    );
  }

  return alternatives;
}

function buildConfidence(
  input: LabExecutionReflectionInput,
  decision: LabExecutionReflection["decision"],
  reasoningCount: number
) {
  let confidence = getBaseConfidence(input);
  if (decision === "proceed") {
    confidence += 0.04;
  } else if (decision === "review") {
    confidence -= 0.05;
  } else {
    confidence -= 0.12;
  }
  confidence -= Math.min(0.08, Math.max(0, reasoningCount - 3) * 0.01);
  return clampConfidence(confidence);
}

export function buildExecutionReflection(
  input: LabExecutionReflectionInput
): LabExecutionReflection {
  const decision = decide(input);
  const reasoning = buildReasoning(input, decision);
  const tradeoffs = buildTradeoffs(input, decision);
  const alternatives = buildAlternatives(input, decision);
  return {
    id: createReflectionId(input),
    planId: input.executionPlan.id,
    summary: buildSummary(decision),
    decision,
    reasoning,
    ...(tradeoffs ? { tradeoffs } : {}),
    ...(alternatives ? { alternatives } : {}),
    confidence: buildConfidence(input, decision, reasoning.length),
  };
}

export function buildExecutionReflectionFromResolved(
  input: LabExecutionReflectionResolvedInput
): LabExecutionReflection | null {
  if (
    input.activeSelection === null ||
    input.executionPayloadPreview === null ||
    input.executionPlan === null ||
    input.executionReadiness === null ||
    input.executionSimulation === null ||
    input.activeSelection.endMs <= input.activeSelection.startMs
  ) {
    return null;
  }
  return buildExecutionReflection({
    activeSelection: input.activeSelection,
    executionPayloadPreview: input.executionPayloadPreview,
    executionPlan: input.executionPlan,
    executionReadiness: input.executionReadiness,
    executionSimulation: input.executionSimulation,
    inspectionMode: input.inspectionMode,
    sourceKind: input.sourceKind,
  });
}
