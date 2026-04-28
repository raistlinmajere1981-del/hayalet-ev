import type {
  LabActiveExecutionResult,
  LabExecutionAlternatives,
  LabExecutionCandidate,
  LabExecutionGoalEvaluation,
  LabExecutionPayloadPreview,
  LabExecutionPlan,
  LabExecutionReadiness,
  LabExecutionReflection,
  LabExecutionSimulation,
  LabInspectionMode,
  LabSelection,
  LabSelectionROI,
} from "../models/lab-types.js";
import {
  buildAdaptiveDecisionSignal,
  buildCounterfactualProjection,
  buildDecisionPosture,
  buildGuidedAlternativeSignal,
  prependDecisionPostureLabel,
} from "./lab-adaptive-decision.js";
import {
  buildExecutionDescriptor,
  formatExecutionDescriptorAdvisory,
} from "./lab-execution-descriptor.js";
import { buildExecutionBridge, formatExecutionBridgeAdvisory } from "./lab-execution-bridge.js";
import {
  buildExecutionReadinessSignal,
  formatExecutionReadinessSignalAdvisory,
} from "./lab-execution-readiness-signal.js";
import { buildDecisionCoherence } from "./lab-decision-coherence.js";

export type LabExecutionCandidateResultInterpretation = {
  coverageLevel: "low" | "medium" | "high";
  anomalyLevel: "none" | "moderate" | "high";
  alignment: "matches-simulation" | "partial" | "deviates";
};

type LabExecutionCandidateInput = {
  activeSelection: LabSelection;
  executionAlternatives: LabExecutionAlternatives;
  executionPayloadPreview: LabExecutionPayloadPreview;
  executionPlan: LabExecutionPlan;
  executionReadiness: LabExecutionReadiness;
  executionReflection: LabExecutionReflection;
  executionResult?: LabActiveExecutionResult | null;
  executionGoalEvaluation?: LabExecutionGoalEvaluation | null;
  executionResultInterpretation?: LabExecutionCandidateResultInterpretation | null;
  executionSimulation: LabExecutionSimulation;
  inspectionMode: LabInspectionMode;
  sourceKind: string;
};

export type LabExecutionCandidateResolvedInput = {
  activeSelection: LabSelection | null;
  executionAlternatives: LabExecutionAlternatives | null;
  executionPayloadPreview: LabExecutionPayloadPreview | null;
  executionPlan: LabExecutionPlan | null;
  executionReadiness: LabExecutionReadiness | null;
  executionReflection: LabExecutionReflection | null;
  executionResult?: LabActiveExecutionResult | null;
  executionGoalEvaluation?: LabExecutionGoalEvaluation | null;
  executionResultInterpretation?: LabExecutionCandidateResultInterpretation | null;
  executionSimulation: LabExecutionSimulation | null;
  inspectionMode: LabInspectionMode;
  sourceKind: string;
};

function clampConfidence(value: number) {
  return Math.max(0.25, Math.min(0.98, Number(value.toFixed(2))));
}

function createCandidateId(input: LabExecutionCandidateInput) {
  return `candidate:${input.executionPlan.id}`;
}

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function hasEntries(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function hasValidSelection(selection: LabSelection) {
  return (
    Number.isFinite(selection.startMs) &&
    Number.isFinite(selection.endMs) &&
    selection.endMs > selection.startMs
  );
}

function hasValidRoi(roi: LabSelectionROI | undefined) {
  if (roi === undefined) {
    return false;
  }
  return (
    Number.isFinite(roi.x) &&
    Number.isFinite(roi.y) &&
    Number.isFinite(roi.width) &&
    Number.isFinite(roi.height) &&
    roi.x >= 0 &&
    roi.y >= 0 &&
    roi.width > 0 &&
    roi.height > 0 &&
    roi.x + roi.width <= 1.001 &&
    roi.y + roi.height <= 1.001
  );
}

function actionRequiresRoi(actionType: string) {
  return actionType === "focus-region";
}

function hasCoherentPlan(input: LabExecutionCandidateInput) {
  return (
    input.executionPlan.id.trim() !== "" &&
    input.executionPlan.suggestionId.trim() !== "" &&
    input.executionPlan.steps.length > 0 &&
    input.executionPlan.expectedOutputs.length > 0 &&
    input.executionPlan.actionType.trim() !== ""
  );
}

function hasCoherentPayload(input: LabExecutionCandidateInput) {
  const dryRunShape = input.executionPayloadPreview.dryRunShape;
  return (
    input.executionPayloadPreview.planId === input.executionPlan.id &&
    input.executionPayloadPreview.actionType === input.executionPlan.actionType &&
    input.executionPayloadPreview.readinessStatus === input.executionReadiness.status &&
    hasEntries(dryRunShape.previewInput) &&
    hasEntries(dryRunShape.previewParameters) &&
    dryRunShape.previewExpectedOutputs.length > 0
  );
}

function upstreamPlanIdsMatch(input: LabExecutionCandidateInput) {
  const planId = input.executionPlan.id;
  return (
    input.executionSimulation.planId === planId &&
    input.executionReadiness.planId === planId &&
    input.executionPayloadPreview.planId === planId &&
    input.executionReflection.planId === planId &&
    input.executionAlternatives.planId === planId
  );
}

function getSimulationRisk(input: LabExecutionCandidateInput) {
  return input.executionSimulation.metrics?.risk ?? "low";
}

function getBaseConfidence(input: LabExecutionCandidateInput) {
  return (
    input.executionReflection.confidence ??
    input.executionReadiness.confidence ??
    input.executionSimulation.metrics?.confidence ??
    input.executionPlan.confidence ??
    input.executionAlternatives.confidence ??
    0.66
  );
}

function hasMaterialAlternativePressure(input: LabExecutionCandidateInput) {
  const warningCount = input.executionSimulation.warnings?.length ?? 0;
  const lowConfidence = getBaseConfidence(input) < 0.68;
  const unstableUpstream =
    input.executionReadiness.status !== "ready" ||
    input.executionReflection.decision !== "proceed" ||
    getSimulationRisk(input) !== "low" ||
    warningCount > 0 ||
    lowConfidence;
  if (!unstableUpstream) {
    return false;
  }

  return input.executionAlternatives.alternatives.some(function (alternative) {
    return (
      alternative.relativeAdvantage === "lower-risk" ||
      alternative.relativeAdvantage === "higher-coverage" ||
      alternative.tradeoff.toLowerCase().includes("risk") ||
      alternative.tradeoff.toLowerCase().includes("coverage") ||
      alternative.tradeoff.toLowerCase().includes("context")
    );
  });
}

function buildNotes(input: LabExecutionCandidateInput, materialAlternativePressure: boolean) {
  const notes: string[] = [];

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

function buildUncertainties(
  input: LabExecutionCandidateInput,
  materialAlternativePressure: boolean
) {
  const uncertainties: string[] = [];
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

  return uncertainties.length > 0 ? uncertainties : undefined;
}

function evaluateStructuralIntegrity(
  input: LabExecutionCandidateInput,
  materialAlternativePressure: boolean
): LabExecutionCandidate["structuralIntegrity"] {
  const payloadComplete = hasCoherentPayload(input);
  const roiRequired = actionRequiresRoi(input.executionPlan.actionType);
  const roiValid = hasValidRoi(input.activeSelection.roi);

  if (
    !hasValidSelection(input.activeSelection) ||
    !upstreamPlanIdsMatch(input) ||
    !hasCoherentPlan(input) ||
    !payloadComplete ||
    (roiRequired && !roiValid) ||
    input.executionReadiness.status === "blocked" ||
    input.executionReflection.decision === "avoid" ||
    getSimulationRisk(input) === "high"
  ) {
    return "insufficient";
  }

  if (
    input.executionReadiness.status === "needs-review" ||
    input.executionReflection.decision === "review" ||
    input.executionPayloadPreview.readinessPassesPreview === false ||
    (input.executionSimulation.warnings?.length ?? 0) > 0 ||
    getBaseConfidence(input) < 0.68 ||
    materialAlternativePressure
  ) {
    return "partial";
  }

  return "complete";
}

function evaluateStatus(
  input: LabExecutionCandidateInput,
  structuralIntegrity: LabExecutionCandidate["structuralIntegrity"],
  materialAlternativePressure: boolean
): LabExecutionCandidate["status"] {
  if (
    structuralIntegrity === "insufficient" ||
    input.executionReadiness.status === "blocked" ||
    input.executionReflection.decision === "avoid" ||
    getSimulationRisk(input) === "high"
  ) {
    return "not-viable";
  }

  if (
    structuralIntegrity === "complete" &&
    input.executionReadiness.status === "ready" &&
    input.executionReflection.decision === "proceed" &&
    input.executionPayloadPreview.readinessPassesPreview &&
    (input.executionSimulation.warnings?.length ?? 0) === 0 &&
    !materialAlternativePressure
  ) {
    return "viable";
  }

  return "unstable";
}

function buildSummary(status: LabExecutionCandidate["status"]) {
  if (status === "viable") {
    return "This path is structurally ready for execution.";
  }
  if (status === "unstable") {
    return "This path may require refinement before execution.";
  }
  return "This path is not structurally suitable for execution.";
}

function appendAdaptiveDecisionHint(summary: string, adaptiveDecisionHint: string) {
  if (adaptiveDecisionHint === "" || summary.includes(adaptiveDecisionHint)) {
    return summary;
  }
  if (summary === "") {
    return adaptiveDecisionHint;
  }
  return `${summary} ${adaptiveDecisionHint}`;
}

function appendDescriptorAdvisory(summary: string, input: LabExecutionCandidateInput) {
  const descriptor = buildExecutionDescriptor({
    actionType: input.executionPlan.actionType,
    executionPayloadPreview: input.executionPayloadPreview,
    executionPlan: input.executionPlan,
  });
  const advisory = formatExecutionDescriptorAdvisory({
    actionType: input.executionPlan.actionType,
    descriptor,
  });
  if (summary.includes(advisory)) {
    return summary;
  }
  return `${summary} ${advisory}`;
}

function buildReadinessSignal(
  input: LabExecutionCandidateInput,
  context: {
    decisionPressure: LabExecutionCandidate["decisionPressure"];
    projection: ReturnType<typeof buildCounterfactualProjection> | null;
  }
) {
  return buildExecutionReadinessSignal({
    decisionPressure: context.decisionPressure,
    goalEvaluation: input.executionGoalEvaluation ?? null,
    alignment: input.executionResultInterpretation?.alignment ?? null,
    alternativesConfidence: input.executionAlternatives.confidence ?? null,
    projection: context.projection,
  });
}

function appendReadinessSignalAdvisory(
  summary: string,
  signal: ReturnType<typeof buildExecutionReadinessSignal>
) {
  const advisory = formatExecutionReadinessSignalAdvisory(signal);
  if (summary.includes(advisory)) {
    return summary;
  }
  return `${summary} ${advisory}`;
}

function appendExecutionBridgeAdvisory(summary: string, input: LabExecutionCandidateInput) {
  const descriptor = buildExecutionDescriptor({
    actionType: input.executionPlan.actionType,
    executionPayloadPreview: input.executionPayloadPreview,
    executionPlan: input.executionPlan,
  });
  const advisory = formatExecutionBridgeAdvisory(buildExecutionBridge(descriptor));
  if (summary.includes(advisory)) {
    return summary;
  }
  return `${summary} ${advisory}`;
}

function appendDecisionCoherenceAdvisory(
  summary: string,
  context: {
    decisionPosture: ReturnType<typeof buildDecisionPosture>;
    readinessSignal: ReturnType<typeof buildExecutionReadinessSignal>;
    projection: ReturnType<typeof buildCounterfactualProjection> | null;
  }
) {
  const advisory = buildDecisionCoherence({
    posture: context.decisionPosture.posture,
    readiness: context.readinessSignal,
    ...(context.projection === null ? {} : { projection: context.projection }),
  }).summary;
  if (summary.includes(advisory)) {
    return summary;
  }
  return `${summary} ${advisory}`;
}

function buildConfidence(
  input: LabExecutionCandidateInput,
  status: LabExecutionCandidate["status"],
  structuralIntegrity: LabExecutionCandidate["structuralIntegrity"],
  uncertaintyCount: number
) {
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

  const interpretation = input.executionResultInterpretation;
  if (interpretation !== undefined && interpretation !== null) {
    if (
      interpretation.coverageLevel === "high" &&
      interpretation.alignment === "matches-simulation"
    ) {
      confidence += 0.04;
    } else if (interpretation.coverageLevel === "low" || interpretation.alignment === "deviates") {
      confidence -= 0.08;
    } else {
      confidence += 0.01;
    }
  }

  const goalEvaluation = input.executionGoalEvaluation;
  if (goalEvaluation !== undefined && goalEvaluation !== null) {
    if (goalEvaluation.outcome === "successful") {
      confidence += 0.06;
    } else if (goalEvaluation.outcome === "failed") {
      confidence -= 0.12;
    }

    if (goalEvaluation.patternSignal?.strength === "strong") {
      confidence += 0.02;
    } else if (goalEvaluation.patternSignal?.strength === "weak") {
      confidence -= 0.03;
    }
  }

  return clampConfidence(confidence);
}

function buildExecutionCandidate(input: LabExecutionCandidateInput): LabExecutionCandidate {
  const materialAlternativePressure = hasMaterialAlternativePressure(input);
  const structuralIntegrity = evaluateStructuralIntegrity(input, materialAlternativePressure);
  const status = evaluateStatus(input, structuralIntegrity, materialAlternativePressure);
  const uncertainties = buildUncertainties(input, materialAlternativePressure);
  const adaptiveDecision = buildAdaptiveDecisionSignal({
    executionGoalEvaluation: input.executionGoalEvaluation ?? null,
    executionResultInterpretation: input.executionResultInterpretation ?? null,
  });
  const decisionPosture = buildDecisionPosture({
    decisionPressure: adaptiveDecision.decisionPressure,
    executionGoalEvaluation: input.executionGoalEvaluation ?? null,
    executionResultInterpretation: input.executionResultInterpretation ?? null,
  });
  const guidedAlternative = buildGuidedAlternativeSignal({
    alternatives: input.executionAlternatives.alternatives,
    alternativesConfidence: input.executionAlternatives.confidence ?? null,
    decisionPressure: adaptiveDecision.decisionPressure,
    executionGoalEvaluation: input.executionGoalEvaluation ?? null,
    executionResultInterpretation: input.executionResultInterpretation ?? null,
  });
  const preferredAlternative =
    guidedAlternative.preferredAlternativeIndex === null
      ? null
      : (input.executionAlternatives.alternatives[guidedAlternative.preferredAlternativeIndex] ??
        null);
  const counterfactualProjection =
    adaptiveDecision.decisionPressure !== "high" ||
    preferredAlternative === null ||
    input.executionResult === undefined ||
    input.executionResult === null
      ? null
      : buildCounterfactualProjection(preferredAlternative, {
          decisionPressure: adaptiveDecision.decisionPressure,
          executionGoalEvaluation: input.executionGoalEvaluation ?? null,
          executionResult: input.executionResult,
          executionResultInterpretation: input.executionResultInterpretation ?? null,
        });
  const adaptiveDecisionHint = appendAdaptiveDecisionHint(
    appendAdaptiveDecisionHint(
      adaptiveDecision.adaptiveDecisionHint,
      guidedAlternative.candidateGuidanceText
    ),
    counterfactualProjection?.summary ?? ""
  );
  const readinessSignal = buildReadinessSignal(input, {
    decisionPressure: adaptiveDecision.decisionPressure,
    projection: counterfactualProjection,
  });

  return {
    id: createCandidateId(input),
    planId: input.executionPlan.id,
    status,
    summary: prependDecisionPostureLabel(
      appendDecisionCoherenceAdvisory(
        appendExecutionBridgeAdvisory(
          appendReadinessSignalAdvisory(
            appendDescriptorAdvisory(
              appendAdaptiveDecisionHint(buildSummary(status), adaptiveDecisionHint),
              input
            ),
            readinessSignal
          ),
          input
        ),
        {
          decisionPosture,
          readinessSignal,
          projection: counterfactualProjection,
        }
      ),
      decisionPosture
    ),
    adaptiveDecisionHint,
    decisionPressure: adaptiveDecision.decisionPressure,
    structuralIntegrity,
    readinessStatus: input.executionReadiness.status,
    reflectionDecision: input.executionReflection.decision,
    notes: buildNotes(input, materialAlternativePressure),
    ...(uncertainties ? { uncertainties } : {}),
    confidence: buildConfidence(input, status, structuralIntegrity, uncertainties?.length ?? 0),
  };
}

export function buildExecutionCandidateFromResolved(
  input: LabExecutionCandidateResolvedInput
): LabExecutionCandidate | null {
  if (
    input.activeSelection === null ||
    input.executionAlternatives === null ||
    input.executionPayloadPreview === null ||
    input.executionPlan === null ||
    input.executionReadiness === null ||
    input.executionReflection === null ||
    input.executionSimulation === null ||
    input.activeSelection.endMs <= input.activeSelection.startMs
  ) {
    return null;
  }

  const resolvedInput = {
    activeSelection: input.activeSelection,
    executionAlternatives: input.executionAlternatives,
    executionPayloadPreview: input.executionPayloadPreview,
    executionPlan: input.executionPlan,
    executionReadiness: input.executionReadiness,
    executionReflection: input.executionReflection,
    executionResult: input.executionResult ?? null,
    executionGoalEvaluation: input.executionGoalEvaluation ?? null,
    executionResultInterpretation: input.executionResultInterpretation ?? null,
    executionSimulation: input.executionSimulation,
    inspectionMode: input.inspectionMode,
    sourceKind: input.sourceKind,
  };

  if (!upstreamPlanIdsMatch(resolvedInput)) {
    return null;
  }

  return buildExecutionCandidate(resolvedInput);
}
