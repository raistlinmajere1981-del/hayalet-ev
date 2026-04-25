import { escapeHtml } from "../models/lab-types.js";
import type {
  LabActionSuggestion,
  LabExecutionAlternatives,
  LabExecutionCandidate,
  LabExecutionCommitment,
  LabExecutionPayloadPreview,
  LabExecutionPlan,
  LabExecutionReadiness,
  LabExecutionReflection,
  LabExecutionSimulation,
  LabExecutionStaging,
  LabInspectionMode,
  LabInspectionSnapshot,
  LabInterpretationItem,
  LabSelection,
  LabSuggestionPreview,
} from "../models/lab-types.js";
import type { LabWaveformTimelineModel } from "./lab-waveform-timeline-types.js";

function formatTimePrecise(ms: number) {
  const totalMs = Math.round(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function formatTimeShort(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function formatSelectionType(type: LabSelection["type"] | undefined) {
  return (
    {
      clip: "Clip",
      focus: "Focus",
      inspect: "Inspect",
      unknown: "Unknown",
    } as const
  )[type ?? "unknown"];
}

const SELECTION_INTENT_OPTIONS = [
  "anomaly",
  "motion",
  "audio",
  "visual",
  "general",
] as const satisfies ReadonlyArray<LabSelection["intent"]>;

function formatSelectionIntent(intent: LabSelection["intent"] | undefined) {
  return (
    {
      anomaly: "Anomaly",
      motion: "Motion",
      audio: "Audio",
      visual: "Visual",
      general: "General",
      unknown: "Unknown",
    } as const
  )[intent ?? "unknown"];
}

function supportsInspectionMode(mode: LabInspectionMode, sourceKind: string | undefined) {
  switch (mode) {
    case "none":
      return true;
    case "audio":
      return sourceKind === "audio" || sourceKind === "video";
    case "motion":
      return sourceKind === "video";
    case "visual":
      return sourceKind === "image" || sourceKind === "video";
    default:
      return false;
  }
}

const INSPECTION_MODE_OPTIONS = [
  "none",
  "visual",
  "audio",
  "motion",
] as const satisfies ReadonlyArray<LabInspectionMode>;

function formatInspectionMode(mode: LabInspectionMode) {
  return (
    {
      none: "None",
      visual: "Visual",
      audio: "Audio",
      motion: "Motion",
    } as const
  )[mode];
}

function getSuggestionPriorityClass(suggestion: LabActionSuggestion) {
  return suggestion.confidence >= 0.8 ? "is-primary" : "is-secondary";
}

function renderSelectionSuggestions(suggestions: LabActionSuggestion[]) {
  if (suggestions.length === 0) {
    return "";
  }
  return `
    <div class="lab-selection-panel__suggestions">
      <div class="lab-selection-panel__suggestions-title">Suggested actions</div>
      <div class="lab-selection-panel__suggestions-list">
        ${suggestions
          .map(function (suggestion) {
            return `<button
              class="lab-selection-panel__suggestion ${getSuggestionPriorityClass(suggestion)}"
              type="button"
              data-lab-selection-suggestion="${escapeHtml(suggestion.id)}"
              data-suggestion-priority="${suggestion.confidence >= 0.8 ? "primary" : "secondary"}"
            >
              <span class="lab-selection-panel__suggestion-label">${escapeHtml(suggestion.label)}</span>
              ${
                typeof suggestion.description === "string" && suggestion.description.trim() !== ""
                  ? `<span class="lab-selection-panel__suggestion-description">${escapeHtml(suggestion.description)}</span>`
                  : ""
              }
            </button>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function getToolHintGlyph(suggestion: LabActionSuggestion) {
  switch (suggestion.actionType) {
    case "analyze-segment":
    case "extract-clip":
    case "focus-region":
    case "inspect-audio":
      return "+";
    case "inspect-motion":
      return ">";
    case "enhance-visual":
      return "*";
    case "stabilize-segment":
      return "=";
    default:
      return "·";
  }
}

function renderInspectionToolHints(suggestions: LabActionSuggestion[]) {
  const toolHintSuggestions = suggestions.filter(function (suggestion) {
    return typeof suggestion.toolHint === "string" && suggestion.toolHint.trim() !== "";
  });
  if (toolHintSuggestions.length === 0) {
    return "";
  }
  return `
    <div class="lab-selection-panel__tools">
      <div class="lab-selection-panel__tools-title">Inspection tools</div>
      <div class="lab-selection-panel__tools-list">
        ${toolHintSuggestions
          .map(function (suggestion) {
            return `<button
              class="lab-selection-panel__tool-hint"
              type="button"
              data-lab-selection-suggestion="${escapeHtml(suggestion.id)}"
            >
              <span class="lab-selection-panel__tool-hint-icon" aria-hidden="true">${escapeHtml(getToolHintGlyph(suggestion))}</span>
              <span class="lab-selection-panel__tool-hint-label">${escapeHtml(suggestion.toolHint || suggestion.label)}</span>
            </button>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function formatEstimatedCost(cost: LabSuggestionPreview["estimatedCost"]) {
  return (
    {
      low: "Low",
      medium: "Medium",
      high: "High",
    } as const
  )[cost ?? "low"];
}

function renderExecutionIntentStrip(activeExecutionIntent: LabActionSuggestion | null) {
  if (activeExecutionIntent === null) {
    return "";
  }
  return `
    <div class="lab-selection-panel__execution-intent">
      <div class="lab-selection-panel__execution-intent-copy">
        <span class="lab-selection-panel__execution-intent-eyebrow">Selected action</span>
        <strong class="lab-selection-panel__execution-intent-label">${escapeHtml(activeExecutionIntent.label)}</strong>
      </div>
      <button
        class="lab-selection-panel__execution-intent-clear"
        type="button"
        data-lab-execution-intent-clear="true"
      >Clear</button>
    </div>
  `;
}

function renderSuggestionPreview(
  preview: LabSuggestionPreview | null,
  activeExecutionIntent: LabActionSuggestion | null
) {
  if (preview === null) {
    return "";
  }
  const executionIntentSelected = activeExecutionIntent?.id === preview.suggestionId;
  return `
    <div class="lab-selection-preview" data-lab-selection-preview="true">
      <div class="lab-selection-preview__eyebrow">Preview</div>
      <div class="lab-selection-preview__title">${escapeHtml(preview.title)}</div>
      <div class="lab-selection-preview__section">
        <div class="lab-selection-preview__section-title">Steps</div>
        <ul class="lab-selection-preview__list lab-selection-preview__list--steps">
          ${preview.steps
            .map(function (step) {
              return `<li>${escapeHtml(step)}</li>`;
            })
            .join("")}
        </ul>
      </div>
      ${
        preview.expectedOutputs.length > 0
          ? `
        <div class="lab-selection-preview__section">
          <div class="lab-selection-preview__section-title">Outputs</div>
          <ul class="lab-selection-preview__list lab-selection-preview__list--outputs">
            ${preview.expectedOutputs
              .map(function (output) {
                return `<li>${escapeHtml(output)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        preview.estimatedCost
          ? `<div class="lab-selection-preview__cost">Estimated cost: ${escapeHtml(formatEstimatedCost(preview.estimatedCost))}</div>`
          : ""
      }
      <div class="lab-selection-preview__actions">
        <button
          class="lab-selection-preview__action lab-selection-preview__action--primary${executionIntentSelected ? " is-active" : ""}"
          type="button"
          data-lab-execution-intent-accept="${escapeHtml(preview.suggestionId)}"
          aria-pressed="${String(executionIntentSelected)}"
        >${executionIntentSelected ? "Intent selected" : "I want this"}</button>
        <button
          class="lab-selection-preview__action"
          type="button"
          data-lab-execution-intent-dismiss="${escapeHtml(preview.suggestionId)}"
        >Not now</button>
        <button
          class="lab-selection-preview__action lab-selection-preview__action--subtle"
          type="button"
          data-lab-execution-intent-queue="${escapeHtml(preview.suggestionId)}"
        >Queue for later</button>
      </div>
    </div>
  `;
}

function formatExecutionPlanConfidence(confidence: LabExecutionPlan["confidence"]) {
  if (typeof confidence !== "number" || Number.isFinite(confidence) !== true) {
    return null;
  }
  return `${Math.round(confidence * 100)}% confidence`;
}

function formatSimulationConfidence(
  confidence: NonNullable<LabExecutionSimulation["metrics"]>["confidence"]
) {
  if (typeof confidence !== "number" || Number.isFinite(confidence) !== true) {
    return null;
  }
  return `${Math.round(confidence * 100)}% confidence`;
}

function renderExecutionPlan(plan: LabExecutionPlan | null) {
  if (plan === null) {
    return "";
  }
  const confidenceLabel = formatExecutionPlanConfidence(plan.confidence);
  return `
    <div class="lab-execution-plan" data-lab-execution-plan="true">
      <div class="lab-execution-plan__eyebrow">Execution plan</div>
      <div class="lab-execution-plan__title">${escapeHtml(plan.title)}</div>
      <div class="lab-execution-plan__intro">The system would approach this by:</div>
      <div class="lab-execution-plan__section">
        <div class="lab-execution-plan__section-title">Steps</div>
        <ol class="lab-execution-plan__steps">
          ${plan.steps
            .map(function (step) {
              return `<li class="lab-execution-plan__step"${step.tool ? ` data-tool="${escapeHtml(step.tool)}"` : ""}>
                <div class="lab-execution-plan__step-label">${escapeHtml(step.label)}</div>
                ${
                  step.description
                    ? `<div class="lab-execution-plan__step-description">${escapeHtml(step.description)}</div>`
                    : ""
                }
              </li>`;
            })
            .join("")}
        </ol>
      </div>
      ${
        plan.expectedOutputs.length > 0
          ? `
        <div class="lab-execution-plan__section">
          <div class="lab-execution-plan__section-title">Expected outputs</div>
          <ul class="lab-execution-plan__outputs">
            ${plan.expectedOutputs
              .map(function (output) {
                return `<li>${escapeHtml(output)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        Array.isArray(plan.riskNotes) && plan.riskNotes.length > 0
          ? `
        <div class="lab-execution-plan__section">
          <div class="lab-execution-plan__section-title">Planning notes</div>
          <ul class="lab-execution-plan__risks">
            ${plan.riskNotes
              .map(function (note) {
                return `<li>${escapeHtml(note)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        confidenceLabel
          ? `<div class="lab-execution-plan__confidence">${escapeHtml(confidenceLabel)}</div>`
          : ""
      }
    </div>
  `;
}

function renderExecutionSimulation(simulation: LabExecutionSimulation | null) {
  if (simulation === null) {
    return "";
  }
  const metrics = simulation.metrics;
  const confidenceLabel = formatSimulationConfidence(metrics?.confidence);
  return `
    <div class="lab-execution-simulation" data-lab-execution-simulation="true">
      <div class="lab-execution-simulation__eyebrow">Simulation preview</div>
      <div class="lab-execution-simulation__summary">${escapeHtml(simulation.summary)}</div>
      ${
        simulation.predictedEffects.length > 0
          ? `
        <div class="lab-execution-simulation__section">
          <div class="lab-execution-simulation__section-title">What would happen</div>
          <ul class="lab-execution-simulation__effects">
            ${simulation.predictedEffects
              .map(function (effect) {
                return `<li>${escapeHtml(effect)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        Array.isArray(simulation.warnings) && simulation.warnings.length > 0
          ? `
        <div class="lab-execution-simulation__section">
          <div class="lab-execution-simulation__section-title">Simulation warnings</div>
          <ul class="lab-execution-simulation__warnings">
            ${simulation.warnings
              .map(function (warning) {
                return `<li>${escapeHtml(warning)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        metrics
          ? `
        <div class="lab-execution-simulation__metrics">
          ${
            metrics.intensity
              ? `<span class="lab-execution-simulation__metric">Intensity: ${escapeHtml(metrics.intensity)}</span>`
              : ""
          }
          ${
            metrics.risk
              ? `<span class="lab-execution-simulation__metric">Risk: ${escapeHtml(metrics.risk)}</span>`
              : ""
          }
          ${
            confidenceLabel
              ? `<span class="lab-execution-simulation__metric">${escapeHtml(confidenceLabel)}</span>`
              : ""
          }
        </div>
      `
          : ""
      }
      <div class="lab-execution-simulation__outro">If applied, you would observe the forecast above without starting any real execution.</div>
    </div>
  `;
}

function formatReadinessConfidence(confidence: number | undefined) {
  if (typeof confidence !== "number" || Number.isFinite(confidence) !== true) {
    return null;
  }
  return `${Math.round(confidence * 100)}% confidence`;
}

function formatReadinessStatus(status: LabExecutionReadiness["status"]) {
  return (
    {
      ready: "Ready",
      "needs-review": "Needs review",
      blocked: "Blocked",
    } as const
  )[status];
}

function renderExecutionReadiness(readiness: LabExecutionReadiness | null) {
  if (readiness === null) {
    return "";
  }
  const confidenceLabel = formatReadinessConfidence(readiness.confidence);
  const intro =
    readiness.status === "ready"
      ? "Execution readiness looks stable"
      : readiness.status === "needs-review"
        ? "This path needs review before any execution step"
        : "This path is not yet execution-ready";
  return `
    <div class="lab-execution-readiness" data-lab-execution-readiness="true">
      <div class="lab-execution-readiness__eyebrow">Execution readiness</div>
      <div class="lab-execution-readiness__header">
        <span class="lab-execution-readiness__status" data-status="${escapeHtml(readiness.status)}">${escapeHtml(formatReadinessStatus(readiness.status))}</span>
        ${
          confidenceLabel
            ? `<span class="lab-execution-readiness__confidence">${escapeHtml(confidenceLabel)}</span>`
            : ""
        }
      </div>
      <div class="lab-execution-readiness__intro">${escapeHtml(intro)}</div>
      <div class="lab-execution-readiness__summary">${escapeHtml(readiness.summary)}</div>
      ${
        Array.isArray(readiness.blockers) && readiness.blockers.length > 0
          ? `
        <div class="lab-execution-readiness__section">
          <div class="lab-execution-readiness__section-title">Readiness blockers</div>
          <ul class="lab-execution-readiness__blockers">
            ${readiness.blockers
              .map(function (blocker) {
                return `<li>${escapeHtml(blocker)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        Array.isArray(readiness.notes) && readiness.notes.length > 0
          ? `
        <div class="lab-execution-readiness__section">
          <div class="lab-execution-readiness__section-title">Review notes</div>
          <ul class="lab-execution-readiness__notes">
            ${readiness.notes
              .map(function (note) {
                return `<li>${escapeHtml(note)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function formatPayloadPreviewJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function renderExecutionPayloadPreview(payload: LabExecutionPayloadPreview | null) {
  if (payload === null) {
    return "";
  }
  const readinessLabel = formatReadinessStatus(payload.readinessStatus);
  const readinessSignal = payload.readinessPassesPreview
    ? "Readiness signal passes this preview"
    : "Readiness signal asks for review";
  return `
    <div class="lab-execution-payload" data-lab-execution-payload-preview="true">
      <div class="lab-execution-payload__eyebrow">Execution payload (preview)</div>
      <div class="lab-execution-payload__summary">${escapeHtml(payload.summary)}</div>
      <div class="lab-execution-payload__intro">This is how the system would structure the execution input. No execution is performed.</div>
      <div class="lab-execution-payload__meta">
        <span class="lab-execution-payload__chip">Action: ${escapeHtml(payload.actionType)}</span>
        <span class="lab-execution-payload__chip" data-status="${escapeHtml(payload.readinessStatus)}">${escapeHtml(readinessLabel)}</span>
        <span class="lab-execution-payload__chip">${escapeHtml(readinessSignal)}</span>
      </div>
      <div class="lab-execution-payload__grid">
        <div class="lab-execution-payload__section">
          <div class="lab-execution-payload__section-title">Preview input</div>
          <pre class="lab-execution-payload__code">${escapeHtml(formatPayloadPreviewJson(payload.dryRunShape.previewInput))}</pre>
        </div>
        <div class="lab-execution-payload__section">
          <div class="lab-execution-payload__section-title">Preview parameters</div>
          <pre class="lab-execution-payload__code">${escapeHtml(formatPayloadPreviewJson(payload.dryRunShape.previewParameters))}</pre>
        </div>
      </div>
      ${
        payload.dryRunShape.previewExpectedOutputs.length > 0
          ? `
        <div class="lab-execution-payload__section">
          <div class="lab-execution-payload__section-title">Preview expected outputs</div>
          <ul class="lab-execution-payload__outputs">
            ${payload.dryRunShape.previewExpectedOutputs
              .map(function (output) {
                return `<li>${escapeHtml(output)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        Array.isArray(payload.notes) && payload.notes.length > 0
          ? `
        <div class="lab-execution-payload__section">
          <div class="lab-execution-payload__section-title">Preview notes</div>
          <ul class="lab-execution-payload__notes">
            ${payload.notes
              .map(function (note) {
                return `<li>${escapeHtml(note)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function formatReflectionDecision(decision: LabExecutionReflection["decision"]) {
  return (
    {
      avoid: "Avoid",
      proceed: "Proceed",
      review: "Review",
    } as const
  )[decision];
}

function formatReflectionConfidence(confidence: LabExecutionReflection["confidence"]) {
  if (typeof confidence !== "number" || Number.isFinite(confidence) !== true) {
    return null;
  }
  return `${Math.round(confidence * 100)}% confidence`;
}

function getReflectionDecisionCopy(decision: LabExecutionReflection["decision"]) {
  if (decision === "proceed") {
    return "This path appears stable";
  }
  if (decision === "review") {
    return "This path may require additional review";
  }
  return "This path is not recommended in its current form";
}

function renderExecutionReflection(reflection: LabExecutionReflection | null) {
  if (reflection === null) {
    return "";
  }
  const confidenceLabel = formatReflectionConfidence(reflection.confidence);
  return `
    <div class="lab-execution-reflection" data-lab-execution-reflection="true">
      <div class="lab-execution-reflection__eyebrow">Execution reflection</div>
      <div class="lab-execution-reflection__header">
        <span class="lab-execution-reflection__decision" data-decision="${escapeHtml(reflection.decision)}">${escapeHtml(formatReflectionDecision(reflection.decision))}</span>
        ${
          confidenceLabel
            ? `<span class="lab-execution-reflection__confidence">${escapeHtml(confidenceLabel)}</span>`
            : ""
        }
      </div>
      <div class="lab-execution-reflection__intro">${escapeHtml(getReflectionDecisionCopy(reflection.decision))}</div>
      <div class="lab-execution-reflection__summary">${escapeHtml(reflection.summary)}</div>
      <div class="lab-execution-reflection__section">
        <div class="lab-execution-reflection__section-title">Reasoning</div>
        <ul class="lab-execution-reflection__reasoning">
          ${reflection.reasoning
            .map(function (reason) {
              return `<li>${escapeHtml(reason)}</li>`;
            })
            .join("")}
        </ul>
      </div>
      ${
        Array.isArray(reflection.tradeoffs) && reflection.tradeoffs.length > 0
          ? `
        <div class="lab-execution-reflection__section">
          <div class="lab-execution-reflection__section-title">Tradeoffs</div>
          <ul class="lab-execution-reflection__tradeoffs">
            ${reflection.tradeoffs
              .map(function (tradeoff) {
                return `<li>${escapeHtml(tradeoff)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        Array.isArray(reflection.alternatives) && reflection.alternatives.length > 0
          ? `
        <div class="lab-execution-reflection__section">
          <div class="lab-execution-reflection__section-title">Alternatives</div>
          <ul class="lab-execution-reflection__alternatives">
            ${reflection.alternatives
              .map(function (alternative) {
                return `<li>${escapeHtml(alternative)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function formatAlternativesConfidence(confidence: LabExecutionAlternatives["confidence"]) {
  if (typeof confidence !== "number" || Number.isFinite(confidence) !== true) {
    return null;
  }
  return `${Math.round(confidence * 100)}% confidence`;
}

function formatRelativeAdvantage(
  advantage: NonNullable<LabExecutionAlternatives["alternatives"][number]["relativeAdvantage"]>
) {
  return advantage
    .split("-")
    .map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function renderExecutionAlternatives(alternatives: LabExecutionAlternatives | null) {
  if (alternatives === null || alternatives.alternatives.length === 0) {
    return "";
  }
  const confidenceLabel = formatAlternativesConfidence(alternatives.confidence);
  return `
    <div class="lab-execution-alternatives" data-lab-execution-alternatives="true">
      <div class="lab-execution-alternatives__eyebrow">Alternative evaluation</div>
      <div class="lab-execution-alternatives__summary">${escapeHtml(alternatives.summary)}</div>
      ${
        confidenceLabel
          ? `<div class="lab-execution-alternatives__confidence">${escapeHtml(confidenceLabel)}</div>`
          : ""
      }
      <div class="lab-execution-alternatives__list">
        ${alternatives.alternatives
          .map(function (alternative) {
            return `
          <article class="lab-execution-alternatives__item">
            <div class="lab-execution-alternatives__item-head">
              <span class="lab-execution-alternatives__label">${escapeHtml(alternative.label)}</span>
              ${
                alternative.relativeAdvantage
                  ? `<span class="lab-execution-alternatives__advantage">${escapeHtml(formatRelativeAdvantage(alternative.relativeAdvantage))}</span>`
                  : ""
              }
            </div>
            <div class="lab-execution-alternatives__action">An alternative approach would be ${escapeHtml(alternative.actionType)}.</div>
            <div class="lab-execution-alternatives__body">${escapeHtml(alternative.summary)}</div>
            <div class="lab-execution-alternatives__tradeoff">${escapeHtml(alternative.tradeoff)}</div>
          </article>
        `;
          })
          .join("")}
      </div>
      ${
        alternatives.comparisonNote
          ? `<div class="lab-execution-alternatives__comparison">${escapeHtml(alternatives.comparisonNote)}</div>`
          : ""
      }
    </div>
  `;
}

function formatCandidateStatus(status: LabExecutionCandidate["status"]) {
  return (
    {
      "not-viable": "Not viable",
      unstable: "Unstable",
      viable: "Viable",
    } as const
  )[status];
}

function formatStructuralIntegrity(integrity: LabExecutionCandidate["structuralIntegrity"]) {
  return (
    {
      complete: "Complete",
      insufficient: "Insufficient",
      partial: "Partial",
    } as const
  )[integrity];
}

function formatCandidateConfidence(confidence: LabExecutionCandidate["confidence"]) {
  if (typeof confidence !== "number" || Number.isFinite(confidence) !== true) {
    return null;
  }
  return `${Math.round(confidence * 100)}% confidence`;
}

function renderExecutionCandidate(candidate: LabExecutionCandidate | null) {
  if (candidate === null) {
    return "";
  }
  const confidenceLabel = formatCandidateConfidence(candidate.confidence);
  return `
    <div class="lab-execution-candidate" data-lab-execution-candidate="true">
      <div class="lab-execution-candidate__eyebrow">Execution candidate</div>
      <div class="lab-execution-candidate__header">
        <span class="lab-execution-candidate__status" data-status="${escapeHtml(candidate.status)}">${escapeHtml(formatCandidateStatus(candidate.status))}</span>
        ${
          confidenceLabel
            ? `<span class="lab-execution-candidate__confidence">${escapeHtml(confidenceLabel)}</span>`
            : ""
        }
      </div>
      <div class="lab-execution-candidate__summary">${escapeHtml(candidate.summary)}</div>
      <div class="lab-execution-candidate__grid">
        <div class="lab-execution-candidate__metric">
          <span>Structural integrity</span>
          <strong>${escapeHtml(formatStructuralIntegrity(candidate.structuralIntegrity))}</strong>
        </div>
        <div class="lab-execution-candidate__metric">
          <span>Readiness</span>
          <strong>${escapeHtml(formatReadinessStatus(candidate.readinessStatus))}</strong>
        </div>
        <div class="lab-execution-candidate__metric">
          <span>Reflection</span>
          <strong>${escapeHtml(formatReflectionDecision(candidate.reflectionDecision))}</strong>
        </div>
      </div>
      ${
        Array.isArray(candidate.notes) && candidate.notes.length > 0
          ? `
        <div class="lab-execution-candidate__section">
          <div class="lab-execution-candidate__section-title">Notes</div>
          <ul class="lab-execution-candidate__list">
            ${candidate.notes
              .map(function (note) {
                return `<li>${escapeHtml(note)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        Array.isArray(candidate.uncertainties) && candidate.uncertainties.length > 0
          ? `
        <div class="lab-execution-candidate__section">
          <div class="lab-execution-candidate__section-title">Uncertainties</div>
          <ul class="lab-execution-candidate__list lab-execution-candidate__list--uncertainties">
            ${candidate.uncertainties
              .map(function (uncertainty) {
                return `<li>${escapeHtml(uncertainty)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function formatCommitmentTimestamp(committedAt: LabExecutionCommitment["committedAt"]) {
  if (typeof committedAt !== "number" || Number.isFinite(committedAt) !== true) {
    return null;
  }
  return "Chosen recently";
}

function renderExecutionCommitment(
  candidate: LabExecutionCandidate | null,
  commitment: LabExecutionCommitment | null
) {
  if (candidate === null) {
    return "";
  }
  if (candidate.status === "not-viable") {
    return `
      <div class="lab-execution-commitment lab-execution-commitment--blocked" data-lab-execution-commitment-control="true">
        <div class="lab-execution-commitment__eyebrow">Execution commitment</div>
        <div class="lab-execution-commitment__summary">This path is not structurally suitable for a user choice yet.</div>
      </div>
    `;
  }

  const activeCommitment =
    commitment !== null &&
    commitment.status === "committed" &&
    commitment.planId === candidate.planId
      ? commitment
      : null;

  if (activeCommitment === null) {
    return `
      <div class="lab-execution-commitment lab-execution-commitment--pending" data-lab-execution-commitment-control="true">
        <div class="lab-execution-commitment__eyebrow">Execution commitment</div>
        <div class="lab-execution-commitment__summary">No path has been consciously chosen yet.</div>
        <button
          class="lab-execution-commitment__choice"
          type="button"
          data-lab-execution-commitment-set="${escapeHtml(candidate.planId)}"
        >Choose this path</button>
      </div>
    `;
  }

  const confidenceLabel = formatCandidateConfidence(activeCommitment.confidence);
  const timestampLabel = formatCommitmentTimestamp(activeCommitment.committedAt);
  return `
    <div class="lab-execution-commitment is-committed" data-lab-execution-commitment="true">
      <div class="lab-execution-commitment__eyebrow">Execution commitment</div>
      <div class="lab-execution-commitment__header">
        <span class="lab-execution-commitment__badge">Committed</span>
        <span class="lab-execution-commitment__candidate">Candidate: ${escapeHtml(formatCandidateStatus(activeCommitment.candidateStatus))}</span>
        ${timestampLabel ? `<span class="lab-execution-commitment__time">${escapeHtml(timestampLabel)}</span>` : ""}
      </div>
      <div class="lab-execution-commitment__summary">${escapeHtml(activeCommitment.summary)}</div>
      ${
        confidenceLabel
          ? `<div class="lab-execution-commitment__confidence">${escapeHtml(confidenceLabel)}</div>`
          : ""
      }
      ${
        Array.isArray(activeCommitment.notes) && activeCommitment.notes.length > 0
          ? `
        <div class="lab-execution-commitment__section">
          <div class="lab-execution-commitment__section-title">Notes</div>
          <ul class="lab-execution-commitment__list">
            ${activeCommitment.notes
              .map(function (note) {
                return `<li>${escapeHtml(note)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        Array.isArray(activeCommitment.uncertainties) && activeCommitment.uncertainties.length > 0
          ? `
        <div class="lab-execution-commitment__section">
          <div class="lab-execution-commitment__section-title">Uncertainties</div>
          <ul class="lab-execution-commitment__list lab-execution-commitment__list--uncertainties">
            ${activeCommitment.uncertainties
              .map(function (uncertainty) {
                return `<li>${escapeHtml(uncertainty)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      <button
        class="lab-execution-commitment__choice lab-execution-commitment__choice--revoke"
        type="button"
        data-lab-execution-commitment-revoke="true"
      >Revoke choice</button>
    </div>
  `;
}

function formatStagingStatus(status: LabExecutionStaging["status"]) {
  return (
    {
      "not-staged": "Not staged",
      staged: "Staged",
    } as const
  )[status];
}

function formatStagingChoiceStatus(status: LabExecutionStaging["commitmentStatus"]) {
  return (
    {
      committed: "Chosen",
      none: "None",
    } as const
  )[status];
}

function renderExecutionStaging(staging: LabExecutionStaging | null) {
  if (staging === null) {
    return "";
  }
  const confidenceLabel = formatCandidateConfidence(staging.confidence);
  return `
    <div class="lab-execution-staging" data-lab-execution-staging="true">
      <div class="lab-execution-staging__eyebrow">Execution staging</div>
      <div class="lab-execution-staging__header">
        <span class="lab-execution-staging__badge" data-status="${escapeHtml(staging.status)}">${escapeHtml(formatStagingStatus(staging.status))}</span>
        ${
          confidenceLabel
            ? `<span class="lab-execution-staging__confidence">${escapeHtml(confidenceLabel)}</span>`
            : ""
        }
      </div>
      <div class="lab-execution-staging__summary">${escapeHtml(staging.summary)}</div>
      <div class="lab-execution-staging__grid">
        <div class="lab-execution-staging__metric">
          <span>User choice</span>
          <strong>${escapeHtml(formatStagingChoiceStatus(staging.commitmentStatus))}</strong>
        </div>
        <div class="lab-execution-staging__metric">
          <span>Candidate</span>
          <strong>${escapeHtml(formatCandidateStatus(staging.candidateStatus))}</strong>
        </div>
        <div class="lab-execution-staging__metric">
          <span>Readiness</span>
          <strong>${escapeHtml(formatReadinessStatus(staging.readinessStatus))}</strong>
        </div>
      </div>
      ${
        Array.isArray(staging.notes) && staging.notes.length > 0
          ? `
        <div class="lab-execution-staging__section">
          <div class="lab-execution-staging__section-title">Notes</div>
          <ul class="lab-execution-staging__notes">
            ${staging.notes
              .map(function (note) {
                return `<li>${escapeHtml(note)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
      ${
        Array.isArray(staging.warnings) && staging.warnings.length > 0
          ? `
        <div class="lab-execution-staging__section">
          <div class="lab-execution-staging__section-title">Warnings</div>
          <ul class="lab-execution-staging__notes lab-execution-staging__notes--warnings">
            ${staging.warnings
              .map(function (warning) {
                return `<li>${escapeHtml(warning)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function formatInterpretationType(type: LabInterpretationItem["type"]) {
  return (
    {
      info: "Info",
      warning: "Warning",
      hint: "Hint",
    } as const
  )[type];
}

function formatInterpretationSeverity(severity: LabInterpretationItem["severity"]) {
  if (severity === undefined) {
    return "";
  }
  return (
    {
      low: "Low",
      medium: "Medium",
      high: "High",
    } as const
  )[severity];
}

function getInterpretationIcon(type: LabInterpretationItem["type"]) {
  return (
    {
      info: "i",
      warning: "!",
      hint: "~",
    } as const
  )[type];
}

function renderInterpretationPanel(
  items: LabInterpretationItem[],
  variant: "embedded" | "standalone"
) {
  if (items.length === 0) {
    return "";
  }
  return `
    <details class="lab-interpretation-panel lab-interpretation-panel--${variant}" data-lab-interpretation-panel="true" open>
      <summary class="lab-interpretation-panel__summary">
        <span class="lab-interpretation-panel__eyebrow">Interpretation</span>
        <span class="lab-interpretation-panel__count">${String(items.length)}</span>
      </summary>
      <div class="lab-interpretation-panel__list">
        ${items
          .map(function (item) {
            const severityLabel = formatInterpretationSeverity(item.severity);
            return `<div class="lab-interpretation-panel__item" data-tone="${escapeHtml(item.type)}"${item.severity ? ` data-severity="${escapeHtml(item.severity)}"` : ""}>
              <span class="lab-interpretation-panel__icon" aria-hidden="true">${escapeHtml(getInterpretationIcon(item.type))}</span>
              <div class="lab-interpretation-panel__copy">
                <div class="lab-interpretation-panel__meta">${escapeHtml(formatInterpretationType(item.type))}${severityLabel ? `<span class="lab-interpretation-panel__severity">${escapeHtml(severityLabel)}</span>` : ""}</div>
                <div class="lab-interpretation-panel__message">${escapeHtml(item.message)}</div>
                ${
                  item.recommendation
                    ? `<div class="lab-interpretation-panel__recommendation">&#8594; ${escapeHtml(item.recommendation)}</div>`
                    : ""
                }
              </div>
            </div>`;
          })
          .join("")}
      </div>
    </details>
  `;
}

function renderSelectionRegionTools(options: {
  roiFocusActive: boolean;
  selectionRoi: LabSelection["roi"] | undefined;
  snapshot: LabInspectionSnapshot | null;
  sourceKind: string | undefined;
}) {
  if (options.selectionRoi === undefined && options.snapshot === null) {
    return "";
  }
  return `
    <div class="lab-selection-panel__region-tools">
      ${
        options.selectionRoi
          ? `
            <button
              class="lab-selection-panel__region-tool"
              type="button"
              ${options.roiFocusActive ? `data-lab-selection-roi-focus-reset="true"` : `data-lab-selection-roi-focus-toggle="true"`}
            >${options.roiFocusActive ? "Reset focus" : "Focus region"}</button>
            <button
              class="lab-selection-panel__region-tool"
              type="button"
              data-lab-selection-roi-capture="true"
            >Capture region</button>
            ${
              options.sourceKind === "video"
                ? `
                  <button class="lab-selection-panel__region-tool" type="button" data-lab-selection-roi-frame-step="-1">Frame -1</button>
                  <button class="lab-selection-panel__region-tool" type="button" data-lab-selection-roi-frame-step="1">Frame +1</button>
                `
                : ""
            }
          `
          : ""
      }
      ${
        options.snapshot !== null
          ? `<button class="lab-selection-panel__region-tool is-secondary" type="button" data-lab-selection-roi-snapshot-clear="true">Dismiss snapshot</button>`
          : ""
      }
    </div>
  `;
}

function renderInspectionSnapshot(snapshot: LabInspectionSnapshot | null) {
  if (snapshot === null) {
    return "";
  }
  const timeLabel = snapshot.timeMs !== null ? formatTimePrecise(snapshot.timeMs) : "Static frame";
  return `
    <div class="lab-selection-snapshot" data-lab-selection-snapshot="true">
      <div class="lab-selection-snapshot__head">
        <div class="lab-selection-snapshot__eyebrow">Region snapshot</div>
        <div class="lab-selection-snapshot__meta">${escapeHtml(timeLabel)} · ${escapeHtml(String(snapshot.width))}×${escapeHtml(String(snapshot.height))}</div>
      </div>
      <div class="lab-selection-snapshot__image-wrap">
        <img class="lab-selection-snapshot__image" src="${escapeHtml(snapshot.objectUrl)}" alt="Temporary inspection snapshot" />
      </div>
    </div>
  `;
}

function renderWaveformInspectionLens(model: LabWaveformTimelineModel) {
  const lens = model.waveformInspectionLens;
  if (!lens || lens.enabled !== true) {
    return "";
  }
  return `
    <div class="labx-timeline__inspection-lens" data-lab-timeline-inspection-lens="true">
      <div class="labx-timeline__inspection-lens-head">
        <div class="labx-timeline__inspection-lens-title">Selection micro zoom</div>
        <div class="labx-timeline__inspection-lens-meta">${escapeHtml(lens.sourceLabel)}</div>
      </div>
      <div class="labx-timeline__inspection-lens-window">
        <canvas
          id="lab-audio-viz-inspection"
          class="labx-audio-viz labx-audio-viz--inspection lab-audio-viz-canvas"
          width="960"
          height="92"
          data-lab-viz="audio-waveform-inspection"
          data-lab-viz-mode="waveform"
          data-waveform-inspection-crop-start="${String(lens.cropStartRatio)}"
          data-waveform-inspection-crop-end="${String(lens.cropEndRatio)}"
        ></canvas>
      </div>
    </div>
  `;
}

function renderFineTuneButtons(prefix: string, msValue: number) {
  return `
    <div class="labx-timeline__finetune">
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:-1000" title="-1s">&#9664;&#9664;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:-100" title="-100ms">&#9664;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:-10" title="-10ms">&#8249;</button>
      <span class="labx-timeline__finetune-value">${formatTimePrecise(msValue)}</span>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:+10" title="+10ms">&#8250;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:+100" title="+100ms">&#9654;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:+1000" title="+1s">&#9654;&#9654;</button>
    </div>
  `;
}

export function renderLabWaveformTimeline(model: LabWaveformTimelineModel) {
  const durationMs = Math.max(1, model.durationMs);
  const rawStartMs = model.startMs ?? 0;
  const rawEndMs = model.endMs ?? durationMs;
  const hasSelection =
    model.startMs !== null && model.endMs !== null && model.endMs > model.startMs;
  const activeSelection =
    hasSelection === true
      ? (model.activeSelection ?? {
          id: "selection-preview",
          startMs: rawStartMs,
          endMs: rawEndMs,
          type: "clip",
          intent: "general",
          createdAt: 0,
        })
      : null;
  const hasSemanticSelection =
    model.activeSelection !== null &&
    model.activeSelection !== undefined &&
    model.activeSelection.endMs > model.activeSelection.startMs;
  const selectionSuggestions = hasSemanticSelection ? (model.selectionSuggestions ?? []) : [];
  const activeExecutionPlan = hasSemanticSelection ? (model.activeExecutionPlan ?? null) : null;
  const activeExecutionSimulation =
    hasSemanticSelection && activeExecutionPlan !== null
      ? (model.activeExecutionSimulation ?? null)
      : null;
  const activeExecutionReadiness =
    hasSemanticSelection && activeExecutionPlan !== null && activeExecutionSimulation !== null
      ? (model.activeExecutionReadiness ?? null)
      : null;
  const activeExecutionPayloadPreview =
    hasSemanticSelection && activeExecutionReadiness !== null
      ? (model.activeExecutionPayloadPreview ?? null)
      : null;
  const activeExecutionReflection =
    hasSemanticSelection && activeExecutionPayloadPreview !== null
      ? (model.activeExecutionReflection ?? null)
      : null;
  const activeExecutionAlternatives =
    hasSemanticSelection && activeExecutionReflection !== null
      ? (model.activeExecutionAlternatives ?? null)
      : null;
  const activeExecutionCandidate =
    hasSemanticSelection &&
    activeExecutionReflection !== null &&
    activeExecutionAlternatives !== null
      ? (model.activeExecutionCandidate ?? null)
      : null;
  const activeExecutionCommitment =
    hasSemanticSelection && activeExecutionCandidate !== null
      ? (model.activeExecutionCommitment ?? null)
      : null;
  const activeExecutionStaging =
    hasSemanticSelection && activeExecutionCommitment !== null
      ? (model.activeExecutionStaging ?? null)
      : null;
  const activeExecutionIntent = hasSemanticSelection ? (model.activeExecutionIntent ?? null) : null;
  const actionSuggestions = selectionSuggestions.filter(function (suggestion) {
    return typeof suggestion.toolHint !== "string" || suggestion.toolHint.trim() === "";
  });
  const suggestionPreview = hasSemanticSelection ? (model.activeSuggestionPreview ?? null) : null;
  const activeInspectionSnapshot = model.activeInspectionSnapshot ?? null;
  const interpretationItems = model.interpretationItems ?? [];
  const inspectionMode = model.inspectionMode ?? "none";
  const roiFocusActive = model.roiFocusActive === true;
  const selectionIntent = activeSelection?.intent ?? "general";
  const startMs = hasSelection ? rawStartMs : 0;
  const endMs = hasSelection ? rawEndMs : durationMs;
  const startPct = hasSelection ? Math.max(0, Math.min(100, (startMs / durationMs) * 100)) : 0;
  const endPct = hasSelection ? Math.max(0, Math.min(100, (endMs / durationMs) * 100)) : 100;
  const selectionCenterPct = hasSelection ? startPct + (endPct - startPct) / 2 : 0;
  const selectionDurationMs = hasSelection ? Math.max(0, endMs - startMs) : 0;
  const selectionRoi = activeSelection?.roi;
  const selectionRoiLabel = selectionRoi
    ? `Region active${roiFocusActive ? " · Focused" : ""} · ${Math.round(selectionRoi.width * 100)}% × ${Math.round(selectionRoi.height * 100)}%`
    : "Region inactive";
  const waveformWindowStartPct = Math.max(
    0,
    Math.min(100, (model.waveformWindowStartMs / durationMs) * 100)
  );
  const waveformWindowWidthPct = Math.max(
    0,
    Math.min(100 - waveformWindowStartPct, (model.waveformWindowDurationMs / durationMs) * 100)
  );
  const hasVisibleWaveform = waveformWindowWidthPct > 0;
  const bookmarkPins = model.bookmarks
    .map(function (bookmark) {
      const pct = Math.max(0, Math.min(100, (bookmark.timeMs / durationMs) * 100));
      return `
        <div
          class="labx-timeline__pin"
          style="left: ${String(pct)}%"
          title="${escapeHtml(bookmark.note || formatTimePrecise(bookmark.timeMs))}"
          data-lab-action="timeline-seek"
          data-lab-value="${String(bookmark.timeMs)}"
        ></div>
      `;
    })
    .join("");
  const hintLabel =
    hasVisibleWaveform === true
      ? model.startMs !== null && model.endMs !== null && hasSelection !== true
        ? "End must be greater than start to create a valid selection."
        : "Click to seek, drag to create a selection."
      : "Waveform falls outside the visible master range.";

  return `
    <div class="labx-timeline" id="lab-timeline" data-duration="${String(durationMs)}" data-waveform-mode="${model.dualPreviewActive ? "linked-audio" : "source-audio"}">
      <div class="labx-timeline__header">
        <div class="labx-timeline__header-copy">
          <p class="labx-card__eyebrow">TIMELINE</p>
          <strong>${escapeHtml(model.waveformSourceLabel)}</strong>
        </div>
        <span class="labx-timeline__sync">${escapeHtml(model.waveformSyncLabel)}</span>
      </div>
      <div class="labx-timeline__track">
        <div class="labx-timeline__waveform-bed"></div>
        ${
          hasVisibleWaveform
            ? `
          <div
            class="labx-timeline__waveform-window"
            style="left: ${String(waveformWindowStartPct)}%; width: ${String(waveformWindowWidthPct)}%"
          >
            <canvas
              id="lab-audio-viz"
              class="labx-audio-viz labx-audio-viz--timeline lab-audio-viz-canvas"
              width="960"
              height="112"
              data-lab-viz="audio-waveform-timeline"
              data-lab-viz-mode="${escapeHtml(model.visualizationMode ?? "waveform")}"
              data-waveform-crop-start="${String(model.waveformCropStartRatio ?? 0)}"
              data-waveform-crop-end="${String(model.waveformCropEndRatio ?? 1)}"
            ></canvas>
          </div>
        `
            : ""
        }
        <div class="labx-timeline__playhead" data-lab-role="timeline-playhead" style="left: 0%">
          <span class="labx-timeline__playhead-label" data-lab-role="timeline-playhead-label">00:00.000</span>
        </div>
        <div class="labx-timeline__rail" data-lab-action="timeline-interact"></div>
        ${
          hasSelection
            ? `
          <div
            class="lab-selection-panel"
            style="left: ${String(selectionCenterPct)}%"
            data-selection-intent="${escapeHtml(selectionIntent)}"
            data-lab-selection-panel="true"
          >
            <div class="lab-selection-panel__eyebrow">Selection</div>
            <div class="lab-selection-panel__range">
              ${formatTimePrecise(startMs)} &#8594; ${formatTimePrecise(endMs)}
              <span class="lab-selection-panel__duration">(${formatDuration(selectionDurationMs)})</span>
            </div>
            <div class="lab-selection-panel__meta">Type: ${escapeHtml(formatSelectionType(activeSelection?.type))}</div>
            <div class="lab-selection-panel__intent-summary">Intent: ${escapeHtml(formatSelectionIntent(selectionIntent))}</div>
            ${
              typeof activeSelection?.label === "string" && activeSelection.label.trim() !== ""
                ? `<div class="lab-selection-panel__label">${escapeHtml(activeSelection.label)}</div>`
                : ""
            }
            <div class="lab-selection-panel__region-row">
              <span class="lab-selection-panel__region-state${selectionRoi ? " is-active" : ""}">${escapeHtml(selectionRoiLabel)}</span>
              ${
                selectionRoi
                  ? `<button class="lab-selection-panel__region-clear" type="button" data-lab-selection-roi-clear="true">Clear region</button>`
                  : ""
              }
            </div>
            ${renderSelectionRegionTools({
              roiFocusActive,
              selectionRoi,
              snapshot: activeInspectionSnapshot,
              sourceKind: model.sourceKind,
            })}
            <div class="lab-selection-panel__inspection">
              <div class="lab-selection-panel__inspection-title">Inspection mode</div>
              <div class="lab-selection-panel__inspection-modes">
                ${INSPECTION_MODE_OPTIONS.map(function (mode) {
                  const isActive = inspectionMode === mode;
                  const isSupported = supportsInspectionMode(mode, model.sourceKind);
                  return `<button
                    class="lab-selection-panel__inspection-pill${isActive ? " is-active" : ""}"
                    type="button"
                    aria-pressed="${String(isActive)}"
                    ${isSupported ? `data-lab-selection-inspection-mode="${mode}"` : "disabled"}
                  >${escapeHtml(formatInspectionMode(mode))}</button>`;
                }).join("")}
              </div>
            </div>
            <div class="lab-selection-panel__intent-picker" data-lab-role="selection-intent-picker">
              ${SELECTION_INTENT_OPTIONS.map(function (intent) {
                const isActive = selectionIntent === intent;
                return `<button
                  class="lab-selection-panel__intent-pill${isActive ? " is-active" : ""}"
                  type="button"
                  aria-pressed="${String(isActive)}"
                  data-lab-selection-intent="${intent}"
                >${escapeHtml(formatSelectionIntent(intent))}</button>`;
              }).join("")}
            </div>
            <div class="lab-selection-panel__hint">This selection will guide future analysis</div>
            ${renderExecutionIntentStrip(activeExecutionIntent)}
            ${renderInspectionToolHints(selectionSuggestions)}
            ${renderInspectionSnapshot(activeInspectionSnapshot)}
            ${renderSelectionSuggestions(actionSuggestions)}
            ${renderSuggestionPreview(suggestionPreview, activeExecutionIntent)}
            ${renderExecutionPlan(activeExecutionPlan)}
            ${renderExecutionSimulation(activeExecutionSimulation)}
            ${renderExecutionReadiness(activeExecutionReadiness)}
            ${renderExecutionPayloadPreview(activeExecutionPayloadPreview)}
            ${renderExecutionReflection(activeExecutionReflection)}
            ${renderExecutionAlternatives(activeExecutionAlternatives)}
            ${renderExecutionCandidate(activeExecutionCandidate)}
            ${renderExecutionCommitment(activeExecutionCandidate, activeExecutionCommitment)}
            ${renderExecutionStaging(activeExecutionStaging)}
            ${renderInterpretationPanel(interpretationItems, "embedded")}
          </div>
          <div
            class="labx-timeline__selection lab-selection-overlay"
            style="left: ${String(startPct)}%; width: ${String(endPct - startPct)}%"
            data-selection-intent="${escapeHtml(selectionIntent)}"
          >
            <div class="labx-timeline__handle labx-timeline__handle--start" data-lab-action="timeline-drag-start"></div>
            <div class="labx-timeline__handle labx-timeline__handle--end" data-lab-action="timeline-drag-end"></div>
            <div class="labx-timeline__selection-body" data-lab-action="timeline-drag-body"></div>
            <div class="labx-timeline__selection-duration">${formatDuration(selectionDurationMs)}</div>
          </div>
        `
            : `<div class="labx-timeline__hint">${escapeHtml(hintLabel)}</div>`
        }
        ${bookmarkPins}
      </div>
      <div class="labx-timeline__controls">
        <div class="labx-timeline__range-info">
          <span class="labx-timeline__duration">${formatTimeShort(durationMs)}</span>
          ${
            hasSelection
              ? `
            <span class="labx-timeline__range-label">
              ${formatTimePrecise(startMs)} — ${formatTimePrecise(endMs)}
            </span>
            <span class="labx-timeline__range-duration">(${formatDuration(selectionDurationMs)})</span>
          `
              : ""
          }
        </div>
        <div class="labx-timeline__actions">
          ${
            hasSelection
              ? `<button class="labx-timeline__clear-btn" type="button" data-lab-action="timeline-clear">Clear</button>
                 <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-export-clip" title="Export selected range as video clip">Export Clip</button>`
              : ""
          }
          <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-grab-frame" title="Capture current frame as image">Grab Frame</button>
          <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-extract-audio" title="Extract source audio">Extract Audio</button>
        </div>
      </div>
      ${renderWaveformInspectionLens(model)}
      ${hasSelection ? "" : renderInterpretationPanel(interpretationItems, "standalone")}
      ${
        hasSelection
          ? `
        <div class="labx-timeline__finetune-row">
          <label class="labx-timeline__finetune-label">Start</label>
          ${renderFineTuneButtons("start", startMs)}
        </div>
        <div class="labx-timeline__finetune-row">
          <label class="labx-timeline__finetune-label">End</label>
          ${renderFineTuneButtons("end", endMs)}
        </div>
      `
          : ""
      }
      <div class="labx-timeline__numeric">
        <label class="labx-field labx-field--compact">
          <span>Start (ms)</span>
          <input class="labx-input labx-input--compact" type="number" min="0" max="${String(durationMs)}" data-lab-field="workspace.timelineStartMs" value="${model.startMs !== null ? String(model.startMs) : ""}" placeholder="ms" />
        </label>
        <label class="labx-field labx-field--compact">
          <span>End (ms)</span>
          <input class="labx-input labx-input--compact" type="number" min="0" max="${String(durationMs)}" data-lab-field="workspace.timelineEndMs" value="${model.endMs !== null ? String(model.endMs) : ""}" placeholder="ms" />
        </label>
      </div>
    </div>
  `;
}
