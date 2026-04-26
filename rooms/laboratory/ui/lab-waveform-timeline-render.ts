import { escapeHtml } from "../models/lab-types.js";
import type {
  LabExecutionAlternatives,
  LabExecutionCandidate,
  LabExecutionCommitment,
  LabExecutionPayloadPreview,
  LabExecutionPlan,
  LabExecutionReadiness,
  LabExecutionReflection,
  LabExecutionSimulation,
  LabExecutionStaging,
  LabInterpretationItem,
} from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import type { LabWaveformTimelineModel } from "./lab-waveform-timeline-types.js";
import {
  INSPECTION_MODE_OPTIONS,
  SELECTION_INTENT_OPTIONS,
  formatInspectionMode,
  formatSelectionIntent,
  formatSelectionType,
  renderExecutionIntentStrip,
  renderInspectionSnapshot,
  renderInspectionToolHints,
  renderSelectionRegionTools,
  renderSelectionSuggestions,
  renderSuggestionPreview,
  renderWaveformInspectionLens,
  supportsInspectionMode,
} from "./timeline/timeline-selection.js";

type ExecutionPanelId =
  | "alternatives"
  | "candidate"
  | "commitment"
  | "payload"
  | "plan"
  | "readiness"
  | "reflection"
  | "simulation"
  | "staging";

const DEFAULT_COLLAPSED_PANELS: Partial<Record<ExecutionPanelId, boolean>> = {
  alternatives: true,
  payload: true,
  reflection: true,
  simulation: true,
};

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

function getPanelCollapsed(model: LabWaveformTimelineModel, panelId: ExecutionPanelId) {
  const modelValue = model.collapsedPanels?.[panelId];
  if (typeof modelValue === "boolean") {
    return modelValue;
  }
  return DEFAULT_COLLAPSED_PANELS[panelId] === true;
}

const SECONDARY_PANELS: ExecutionPanelId[] = [
  "simulation",
  "reflection",
  "alternatives",
  "payload",
];

function renderCollapsibleExecutionPanel(options: {
  body: string;
  copy: LabI18n;
  defaultCollapsed: boolean;
  panelId: ExecutionPanelId;
  title: string;
}) {
  if (options.body.trim() === "") {
    return "";
  }
  const isSecondary = SECONDARY_PANELS.includes(options.panelId);
  return `
    <details
      class="lab-execution-collapsible${isSecondary ? " lab-execution-collapsible--secondary" : ""}"
      data-lab-collapsible-panel="true"
      data-panel-id="${escapeHtml(options.panelId)}"
      ${options.defaultCollapsed ? "" : "open"}
    >
      <summary class="lab-execution-collapsible__summary">
        <span>${escapeHtml(options.title)}</span>
        <span class="lab-execution-collapsible__toggle">${escapeHtml(options.copy.t("mediaAnalysis.executionPanels.toggle", "Details"))}</span>
      </summary>
      <div class="lab-execution-collapsible__body">
        ${options.body}
      </div>
    </details>
  `;
}

function formatConfidencePercent(confidence: number | undefined, copy: LabI18n) {
  if (typeof confidence !== "number" || Number.isFinite(confidence) !== true) {
    return null;
  }
  return copy.t("mediaAnalysis.executionPanels.shared.confidenceValue", "{value}% confidence", {
    value: String(Math.round(confidence * 100)),
  });
}

function formatMetricValue(value: "high" | "low" | "medium", copy: LabI18n) {
  const fallback = (
    {
      high: "High",
      low: "Low",
      medium: "Medium",
    } as const
  )[value];
  return copy.t(`mediaAnalysis.executionPanels.metricValues.${value}`, fallback);
}

function renderExecutionPlan(plan: LabExecutionPlan | null, copy: LabI18n) {
  if (plan === null) {
    return "";
  }
  const confidenceLabel = formatConfidencePercent(plan.confidence, copy);
  return `
    <div class="lab-execution-plan" data-lab-execution-plan="true">
      <div class="lab-execution-plan__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.plan.eyebrow", "Execution plan"))}</div>
      <div class="lab-execution-plan__title">${escapeHtml(plan.title)}</div>
      <div class="lab-execution-plan__intro">${escapeHtml(copy.t("mediaAnalysis.executionPanels.plan.intro", "The system would approach this by:"))}</div>
      <div class="lab-execution-plan__section">
        <div class="lab-execution-plan__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.shared.steps", "Steps"))}</div>
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
          <div class="lab-execution-plan__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.shared.expectedOutputs", "Expected outputs"))}</div>
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
          <div class="lab-execution-plan__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.plan.notes", "Planning notes"))}</div>
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

function renderExecutionSimulation(simulation: LabExecutionSimulation | null, copy: LabI18n) {
  if (simulation === null) {
    return "";
  }
  const metrics = simulation.metrics;
  const confidenceLabel = formatConfidencePercent(metrics?.confidence, copy);
  return `
    <div class="lab-execution-simulation" data-lab-execution-simulation="true">
      <div class="lab-execution-simulation__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.simulation.eyebrow", "Simulation preview"))}</div>
      <div class="lab-execution-simulation__summary">${escapeHtml(simulation.summary)}</div>
      ${
        simulation.predictedEffects.length > 0
          ? `
        <div class="lab-execution-simulation__section">
          <div class="lab-execution-simulation__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.simulation.effects", "What would happen"))}</div>
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
          <div class="lab-execution-simulation__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.simulation.warnings", "Simulation warnings"))}</div>
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
              ? `<span class="lab-execution-simulation__metric">${escapeHtml(copy.t("mediaAnalysis.executionPanels.simulation.intensity", "Intensity"))}: ${escapeHtml(formatMetricValue(metrics.intensity, copy))}</span>`
              : ""
          }
          ${
            metrics.risk
              ? `<span class="lab-execution-simulation__metric">${escapeHtml(copy.t("mediaAnalysis.executionPanels.simulation.risk", "Risk"))}: ${escapeHtml(formatMetricValue(metrics.risk, copy))}</span>`
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
      <div class="lab-execution-simulation__outro">${escapeHtml(copy.t("mediaAnalysis.executionPanels.simulation.outro", "If applied, you would observe the forecast above without starting any real execution."))}</div>
    </div>
  `;
}

function formatReadinessStatus(status: LabExecutionReadiness["status"], copy: LabI18n) {
  const fallback = (
    {
      blocked: "Blocked",
      "needs-review": "Needs review",
      ready: "Ready",
    } as const
  )[status];
  return copy.t(`mediaAnalysis.executionPanels.readiness.status.${status}`, fallback);
}

function renderExecutionReadiness(readiness: LabExecutionReadiness | null, copy: LabI18n) {
  if (readiness === null) {
    return "";
  }
  const confidenceLabel = formatConfidencePercent(readiness.confidence, copy);
  const intro =
    readiness.status === "ready"
      ? copy.t(
          "mediaAnalysis.executionPanels.readiness.readyIntro",
          "Execution readiness looks stable"
        )
      : readiness.status === "needs-review"
        ? copy.t(
            "mediaAnalysis.executionPanels.readiness.reviewIntro",
            "This path needs review before any execution step"
          )
        : copy.t(
            "mediaAnalysis.executionPanels.readiness.blockedIntro",
            "This path is not yet execution-ready"
          );
  return `
    <div class="lab-execution-readiness" data-lab-execution-readiness="true">
      <div class="lab-execution-readiness__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.readiness.eyebrow", "Execution readiness"))}</div>
      <div class="lab-execution-readiness__header">
        <span class="lab-execution-readiness__status" data-status="${escapeHtml(readiness.status)}">${escapeHtml(formatReadinessStatus(readiness.status, copy))}</span>
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
          <div class="lab-execution-readiness__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.readiness.blockers", "Readiness blockers"))}</div>
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
          <div class="lab-execution-readiness__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.readiness.notes", "Review notes"))}</div>
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

function renderExecutionPayloadPreview(payload: LabExecutionPayloadPreview | null, copy: LabI18n) {
  if (payload === null) {
    return "";
  }
  const readinessLabel = formatReadinessStatus(payload.readinessStatus, copy);
  const readinessSignal = payload.readinessPassesPreview
    ? copy.t(
        "mediaAnalysis.executionPanels.payload.readinessPass",
        "Readiness signal passes this preview"
      )
    : copy.t(
        "mediaAnalysis.executionPanels.payload.readinessReview",
        "Readiness signal asks for review"
      );
  return `
    <div class="lab-execution-payload" data-lab-execution-payload-preview="true">
      <div class="lab-execution-payload__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.payload.eyebrow", "Execution payload (preview)"))}</div>
      <div class="lab-execution-payload__summary">${escapeHtml(payload.summary)}</div>
      <div class="lab-execution-payload__intro">${escapeHtml(copy.t("mediaAnalysis.executionPanels.payload.intro", "This is how the system would structure the execution input. No execution is performed."))}</div>
      <div class="lab-execution-payload__meta">
        <span class="lab-execution-payload__chip">${escapeHtml(copy.t("mediaAnalysis.executionPanels.payload.action", "Action"))}: ${escapeHtml(payload.actionType)}</span>
        <span class="lab-execution-payload__chip" data-status="${escapeHtml(payload.readinessStatus)}">${escapeHtml(readinessLabel)}</span>
        <span class="lab-execution-payload__chip">${escapeHtml(readinessSignal)}</span>
      </div>
      <div class="lab-execution-payload__grid">
        <div class="lab-execution-payload__section">
          <div class="lab-execution-payload__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.payload.input", "Preview input"))}</div>
          <pre class="lab-execution-payload__code">${escapeHtml(formatPayloadPreviewJson(payload.dryRunShape.previewInput))}</pre>
        </div>
        <div class="lab-execution-payload__section">
          <div class="lab-execution-payload__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.payload.parameters", "Preview parameters"))}</div>
          <pre class="lab-execution-payload__code">${escapeHtml(formatPayloadPreviewJson(payload.dryRunShape.previewParameters))}</pre>
        </div>
      </div>
      ${
        payload.dryRunShape.previewExpectedOutputs.length > 0
          ? `
        <div class="lab-execution-payload__section">
          <div class="lab-execution-payload__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.payload.expectedOutputs", "Preview expected outputs"))}</div>
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
          <div class="lab-execution-payload__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.payload.notes", "Preview notes"))}</div>
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

function formatReflectionDecision(decision: LabExecutionReflection["decision"], copy: LabI18n) {
  const fallback = (
    {
      avoid: "Avoid",
      proceed: "Proceed",
      review: "Review",
    } as const
  )[decision];
  return copy.t(`mediaAnalysis.executionPanels.reflection.decisions.${decision}`, fallback);
}

function getReflectionDecisionCopy(decision: LabExecutionReflection["decision"], copy: LabI18n) {
  if (decision === "proceed") {
    return copy.t("mediaAnalysis.executionPanels.reflection.proceed", "This path appears stable");
  }
  if (decision === "review") {
    return copy.t(
      "mediaAnalysis.executionPanels.reflection.review",
      "This path may require additional review"
    );
  }
  return copy.t(
    "mediaAnalysis.executionPanels.reflection.avoid",
    "This path is not recommended in its current form"
  );
}

function renderExecutionReflection(reflection: LabExecutionReflection | null, copy: LabI18n) {
  if (reflection === null) {
    return "";
  }
  const confidenceLabel = formatConfidencePercent(reflection.confidence, copy);
  return `
    <div class="lab-execution-reflection" data-lab-execution-reflection="true">
      <div class="lab-execution-reflection__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.reflection.eyebrow", "Execution reflection"))}</div>
      <div class="lab-execution-reflection__header">
        <span class="lab-execution-reflection__decision" data-decision="${escapeHtml(reflection.decision)}">${escapeHtml(formatReflectionDecision(reflection.decision, copy))}</span>
        ${
          confidenceLabel
            ? `<span class="lab-execution-reflection__confidence">${escapeHtml(confidenceLabel)}</span>`
            : ""
        }
      </div>
      <div class="lab-execution-reflection__intro">${escapeHtml(getReflectionDecisionCopy(reflection.decision, copy))}</div>
      <div class="lab-execution-reflection__summary">${escapeHtml(reflection.summary)}</div>
      <div class="lab-execution-reflection__section">
        <div class="lab-execution-reflection__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.reflection.reasoning", "Reasoning"))}</div>
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
          <div class="lab-execution-reflection__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.reflection.tradeoffs", "Tradeoffs"))}</div>
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
          <div class="lab-execution-reflection__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.reflection.alternatives", "Alternatives"))}</div>
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

function formatRelativeAdvantage(
  advantage: NonNullable<LabExecutionAlternatives["alternatives"][number]["relativeAdvantage"]>,
  copy: LabI18n
) {
  const fallback = (
    {
      "higher-coverage": "Higher Coverage",
      "higher-precision": "Higher Precision",
      "lower-risk": "Lower Risk",
      faster: "Faster",
      "more-stable": "More Stable",
    } as const
  )[advantage];
  return copy.t(`mediaAnalysis.executionPanels.relativeAdvantages.${advantage}`, fallback);
}

function renderExecutionAlternatives(alternatives: LabExecutionAlternatives | null, copy: LabI18n) {
  if (alternatives === null || alternatives.alternatives.length === 0) {
    return "";
  }
  const confidenceLabel = formatConfidencePercent(alternatives.confidence, copy);
  return `
    <div class="lab-execution-alternatives" data-lab-execution-alternatives="true">
      <div class="lab-execution-alternatives__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.alternatives.eyebrow", "Alternative evaluation"))}</div>
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
                  ? `<span class="lab-execution-alternatives__advantage">${escapeHtml(formatRelativeAdvantage(alternative.relativeAdvantage, copy))}</span>`
                  : ""
              }
            </div>
            <div class="lab-execution-alternatives__action">${escapeHtml(copy.t("mediaAnalysis.executionPanels.alternatives.actionPrefix", "An alternative approach would be {actionType}.", { actionType: alternative.actionType }))}</div>
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

function formatCandidateStatus(status: LabExecutionCandidate["status"], copy: LabI18n) {
  const fallback = (
    {
      "not-viable": "Not viable",
      unstable: "Unstable",
      viable: "Viable",
    } as const
  )[status];
  return copy.t(`mediaAnalysis.executionPanels.candidate.status.${status}`, fallback);
}

function formatStructuralIntegrity(
  integrity: LabExecutionCandidate["structuralIntegrity"],
  copy: LabI18n
) {
  const fallback = (
    {
      complete: "Complete",
      insufficient: "Insufficient",
      partial: "Partial",
    } as const
  )[integrity];
  return copy.t(`mediaAnalysis.executionPanels.candidate.integrity.${integrity}`, fallback);
}

function renderExecutionCandidate(candidate: LabExecutionCandidate | null, copy: LabI18n) {
  if (candidate === null) {
    return "";
  }
  const confidenceLabel = formatConfidencePercent(candidate.confidence, copy);
  return `
    <div class="lab-execution-candidate" data-lab-execution-candidate="true">
      <div class="lab-execution-candidate__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.candidate.eyebrow", "Execution candidate"))}</div>
      <div class="lab-execution-candidate__header">
        <span class="lab-execution-candidate__status" data-status="${escapeHtml(candidate.status)}">${escapeHtml(formatCandidateStatus(candidate.status, copy))}</span>
        ${
          confidenceLabel
            ? `<span class="lab-execution-candidate__confidence">${escapeHtml(confidenceLabel)}</span>`
            : ""
        }
      </div>
      <div class="lab-execution-candidate__summary">${escapeHtml(candidate.summary)}</div>
      <div class="lab-execution-candidate__grid">
        <div class="lab-execution-candidate__metric">
          <span>${escapeHtml(copy.t("mediaAnalysis.executionPanels.candidate.structuralIntegrity", "Structural integrity"))}</span>
          <strong>${escapeHtml(formatStructuralIntegrity(candidate.structuralIntegrity, copy))}</strong>
        </div>
        <div class="lab-execution-candidate__metric">
          <span>${escapeHtml(copy.t("mediaAnalysis.executionPanels.candidate.readiness", "Readiness"))}</span>
          <strong>${escapeHtml(formatReadinessStatus(candidate.readinessStatus, copy))}</strong>
        </div>
        <div class="lab-execution-candidate__metric">
          <span>${escapeHtml(copy.t("mediaAnalysis.executionPanels.candidate.reflection", "Reflection"))}</span>
          <strong>${escapeHtml(formatReflectionDecision(candidate.reflectionDecision, copy))}</strong>
        </div>
      </div>
      ${
        Array.isArray(candidate.notes) && candidate.notes.length > 0
          ? `
        <div class="lab-execution-candidate__section">
          <div class="lab-execution-candidate__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.shared.notes", "Notes"))}</div>
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
          <div class="lab-execution-candidate__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.shared.uncertainties", "Uncertainties"))}</div>
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

function formatCommitmentTimestamp(
  committedAt: LabExecutionCommitment["committedAt"],
  copy: LabI18n
) {
  if (typeof committedAt !== "number" || Number.isFinite(committedAt) !== true) {
    return null;
  }
  return copy.t("mediaAnalysis.executionPanels.commitment.chosenRecently", "Chosen recently");
}

function renderExecutionCommitment(
  candidate: LabExecutionCandidate | null,
  commitment: LabExecutionCommitment | null,
  copy: LabI18n
) {
  if (candidate === null) {
    return "";
  }
  if (candidate.status === "not-viable") {
    return `
      <div class="lab-execution-commitment lab-execution-commitment--blocked" data-lab-execution-commitment-control="true">
        <div class="lab-execution-commitment__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.commitment.eyebrow", "Execution commitment"))}</div>
        <div class="lab-execution-commitment__summary">${escapeHtml(copy.t("mediaAnalysis.executionPanels.commitment.blocked", "This path is not structurally suitable for a user choice yet."))}</div>
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
        <div class="lab-execution-commitment__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.commitment.eyebrow", "Execution commitment"))}</div>
        <div class="lab-execution-commitment__summary">${escapeHtml(copy.t("mediaAnalysis.executionPanels.commitment.pending", "No path has been consciously chosen yet."))}</div>
        <button
          class="lab-execution-commitment__choice"
          type="button"
          data-lab-execution-commitment-set="${escapeHtml(candidate.planId)}"
        >${escapeHtml(copy.t("mediaAnalysis.executionPanels.commitment.choose", "Choose this path"))}</button>
      </div>
    `;
  }

  const confidenceLabel = formatConfidencePercent(activeCommitment.confidence, copy);
  const timestampLabel = formatCommitmentTimestamp(activeCommitment.committedAt, copy);
  return `
    <div class="lab-execution-commitment is-committed" data-lab-execution-commitment="true">
      <div class="lab-execution-commitment__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.commitment.eyebrow", "Execution commitment"))}</div>
      <div class="lab-execution-commitment__header">
        <span class="lab-execution-commitment__badge">${escapeHtml(copy.t("mediaAnalysis.executionPanels.commitment.committed", "Committed"))}</span>
        <span class="lab-execution-commitment__candidate">${escapeHtml(copy.t("mediaAnalysis.executionPanels.candidate.eyebrow", "Candidate"))}: ${escapeHtml(formatCandidateStatus(activeCommitment.candidateStatus, copy))}</span>
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
          <div class="lab-execution-commitment__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.shared.notes", "Notes"))}</div>
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
          <div class="lab-execution-commitment__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.shared.uncertainties", "Uncertainties"))}</div>
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
      >${escapeHtml(copy.t("mediaAnalysis.executionPanels.commitment.revoke", "Revoke choice"))}</button>
    </div>
  `;
}

function formatStagingStatus(status: LabExecutionStaging["status"], copy: LabI18n) {
  const fallback = (
    {
      "not-staged": "Not staged",
      staged: "Staged",
    } as const
  )[status];
  return copy.t(`mediaAnalysis.executionPanels.staging.status.${status}`, fallback);
}

function formatStagingChoiceStatus(status: LabExecutionStaging["commitmentStatus"], copy: LabI18n) {
  const fallback = (
    {
      committed: "Chosen",
      none: "None",
    } as const
  )[status];
  return copy.t(`mediaAnalysis.executionPanels.staging.choiceStatus.${status}`, fallback);
}

function renderExecutionStaging(staging: LabExecutionStaging | null, copy: LabI18n) {
  if (staging === null) {
    return "";
  }
  const confidenceLabel = formatConfidencePercent(staging.confidence, copy);
  return `
    <div class="lab-execution-staging" data-lab-execution-staging="true">
      <div class="lab-execution-staging__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionPanels.staging.eyebrow", "Execution staging"))}</div>
      <div class="lab-execution-staging__header">
        <span class="lab-execution-staging__badge" data-status="${escapeHtml(staging.status)}">${escapeHtml(formatStagingStatus(staging.status, copy))}</span>
        ${
          confidenceLabel
            ? `<span class="lab-execution-staging__confidence">${escapeHtml(confidenceLabel)}</span>`
            : ""
        }
      </div>
      <div class="lab-execution-staging__summary">${escapeHtml(staging.summary)}</div>
      <div class="lab-execution-staging__grid">
        <div class="lab-execution-staging__metric">
          <span>${escapeHtml(copy.t("mediaAnalysis.executionPanels.staging.userChoice", "User choice"))}</span>
          <strong>${escapeHtml(formatStagingChoiceStatus(staging.commitmentStatus, copy))}</strong>
        </div>
        <div class="lab-execution-staging__metric">
          <span>${escapeHtml(copy.t("mediaAnalysis.executionPanels.candidate.eyebrow", "Candidate"))}</span>
          <strong>${escapeHtml(formatCandidateStatus(staging.candidateStatus, copy))}</strong>
        </div>
        <div class="lab-execution-staging__metric">
          <span>${escapeHtml(copy.t("mediaAnalysis.executionPanels.candidate.readiness", "Readiness"))}</span>
          <strong>${escapeHtml(formatReadinessStatus(staging.readinessStatus, copy))}</strong>
        </div>
      </div>
      ${
        Array.isArray(staging.notes) && staging.notes.length > 0
          ? `
        <div class="lab-execution-staging__section">
          <div class="lab-execution-staging__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.shared.notes", "Notes"))}</div>
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
          <div class="lab-execution-staging__section-title">${escapeHtml(copy.t("mediaAnalysis.executionPanels.shared.warnings", "Warnings"))}</div>
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

function formatInterpretationType(type: LabInterpretationItem["type"], copy: LabI18n) {
  const fallback = (
    {
      hint: "Hint",
      info: "Info",
      warning: "Warning",
    } as const
  )[type];
  return copy.t(`mediaAnalysis.timeline.interpretationTypes.${type}`, fallback);
}

function formatInterpretationSeverity(severity: LabInterpretationItem["severity"], copy: LabI18n) {
  if (severity === undefined) {
    return "";
  }
  const fallback = (
    {
      high: "High",
      low: "Low",
      medium: "Medium",
    } as const
  )[severity];
  return copy.t(`mediaAnalysis.timeline.severity.${severity}`, fallback);
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
  variant: "embedded" | "standalone",
  copy: LabI18n
) {
  if (items.length === 0) {
    return "";
  }
  return `
    <details class="lab-interpretation-panel lab-interpretation-panel--${variant}" data-lab-interpretation-panel="true" open>
      <summary class="lab-interpretation-panel__summary">
        <span class="lab-interpretation-panel__eyebrow">${escapeHtml(copy.t("mediaAnalysis.timeline.interpretation", "Interpretation"))}</span>
        <span class="lab-interpretation-panel__count">${String(items.length)}</span>
      </summary>
      <div class="lab-interpretation-panel__list">
        ${items
          .map(function (item) {
            const severityLabel = formatInterpretationSeverity(item.severity, copy);
            return `<div class="lab-interpretation-panel__item" data-tone="${escapeHtml(item.type)}"${item.severity ? ` data-severity="${escapeHtml(item.severity)}"` : ""}>
              <span class="lab-interpretation-panel__icon" aria-hidden="true">${escapeHtml(getInterpretationIcon(item.type))}</span>
              <div class="lab-interpretation-panel__copy">
                <div class="lab-interpretation-panel__meta">${escapeHtml(formatInterpretationType(item.type, copy))}${severityLabel ? `<span class="lab-interpretation-panel__severity">${escapeHtml(severityLabel)}</span>` : ""}</div>
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

function renderExecutionDetailsTrigger(copy: LabI18n, hasDetails: boolean) {
  if (hasDetails !== true) {
    return "";
  }
  return `
    <button
      class="lab-execution-details-trigger"
      type="button"
      data-lab-execution-details-open="true"
    >
      ${escapeHtml(copy.t("mediaAnalysis.executionDetails.open", "View details"))}
    </button>
  `;
}

function renderExecutionDetailsOverlay(
  copy: LabI18n,
  model: LabWaveformTimelineModel,
  body: string
) {
  if (model.activeOverlay !== "execution-details" || body.trim() === "") {
    return "";
  }
  return `
    <div class="lab-execution-details-overlay" data-lab-execution-details-overlay="true" role="dialog" aria-modal="false">
      <div class="lab-execution-details-overlay__backdrop" data-lab-execution-details-close="true"></div>
      <section class="lab-execution-details-overlay__panel">
        <div class="lab-execution-details-overlay__header">
          <div>
            <p class="lab-execution-details-overlay__eyebrow">${escapeHtml(copy.t("mediaAnalysis.executionDetails.eyebrow", "Execution chain"))}</p>
            <h2>${escapeHtml(copy.t("mediaAnalysis.executionDetails.title", "Execution details"))}</h2>
          </div>
          <button
            class="lab-execution-details-overlay__close"
            type="button"
            data-lab-execution-details-close="true"
            aria-label="${escapeHtml(copy.t("mediaAnalysis.executionDetails.close", "Close details"))}"
          >×</button>
        </div>
        <div class="lab-execution-details-overlay__body">
          ${body}
        </div>
      </section>
    </div>
  `;
}

export function renderLabWaveformTimeline(model: LabWaveformTimelineModel) {
  const copy = model.copy ?? LAB_FALLBACK_I18N;
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
    ? copy.t(
        roiFocusActive
          ? "mediaAnalysis.timeline.regionActiveFocused"
          : "mediaAnalysis.timeline.regionActive",
        roiFocusActive
          ? "Region active · Focused · {width}% × {height}%"
          : "Region active · {width}% × {height}%",
        {
          width: String(Math.round(selectionRoi.width * 100)),
          height: String(Math.round(selectionRoi.height * 100)),
        }
      )
    : copy.t("mediaAnalysis.timeline.regionInactive", "Region inactive");
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
        ? copy.t(
            "mediaAnalysis.timeline.invalidRangeHint",
            "End must be greater than start to create a valid selection."
          )
        : copy.t(
            "mediaAnalysis.timeline.seekDragHint",
            "Click to seek, drag to create a selection."
          )
      : copy.t(
          "mediaAnalysis.timeline.outsideRangeHint",
          "Waveform falls outside the visible master range."
        );
  const executionPlanMarkup = renderExecutionPlan(activeExecutionPlan, copy);
  const executionSimulationMarkup = renderExecutionSimulation(activeExecutionSimulation, copy);
  const executionReadinessMarkup = renderExecutionReadiness(activeExecutionReadiness, copy);
  const executionPayloadMarkup = renderExecutionPayloadPreview(activeExecutionPayloadPreview, copy);
  const executionReflectionMarkup = renderExecutionReflection(activeExecutionReflection, copy);
  const executionAlternativesMarkup = renderExecutionAlternatives(
    activeExecutionAlternatives,
    copy
  );
  const executionCandidateMarkup = renderExecutionCandidate(activeExecutionCandidate, copy);
  const executionCommitmentMarkup = renderExecutionCommitment(
    activeExecutionCandidate,
    activeExecutionCommitment,
    copy
  );
  const executionStagingMarkup = renderExecutionStaging(activeExecutionStaging, copy);
  const executionDetailsBody = [
    executionPlanMarkup,
    executionSimulationMarkup,
    executionReadinessMarkup,
    executionReflectionMarkup,
    executionAlternativesMarkup,
  ]
    .filter(function (entry) {
      return entry.trim() !== "";
    })
    .join("");
  const hasExecutionDetails = executionDetailsBody.trim() !== "";

  return `
    <div class="labx-timeline" id="lab-timeline" data-duration="${String(durationMs)}" data-waveform-mode="${model.dualPreviewActive ? "linked-audio" : "source-audio"}">
      <div class="labx-timeline__header">
        <div class="labx-timeline__header-copy">
          <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.timeline.eyebrow", "Timeline"))}</p>
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
            <div class="lab-selection-panel__eyebrow">${escapeHtml(copy.t("mediaAnalysis.timeline.selection", "Selection"))}</div>
            <div class="lab-selection-panel__range">
              ${formatTimePrecise(startMs)} &#8594; ${formatTimePrecise(endMs)}
              <span class="lab-selection-panel__duration">(${formatDuration(selectionDurationMs)})</span>
            </div>
            <div class="lab-selection-panel__meta">${escapeHtml(copy.t("mediaAnalysis.timeline.type", "Type"))}: ${escapeHtml(formatSelectionType(activeSelection?.type, copy))}</div>
            <div class="lab-selection-panel__intent-summary">${escapeHtml(copy.t("mediaAnalysis.timeline.intent", "Intent"))}: ${escapeHtml(formatSelectionIntent(selectionIntent, copy))}</div>
            ${
              typeof activeSelection?.label === "string" && activeSelection.label.trim() !== ""
                ? `<div class="lab-selection-panel__label">${escapeHtml(activeSelection.label)}</div>`
                : ""
            }
            <div class="lab-selection-panel__region-row">
              <span class="lab-selection-panel__region-state${selectionRoi ? " is-active" : ""}">${escapeHtml(selectionRoiLabel)}</span>
              ${
                selectionRoi
                  ? `<button class="lab-selection-panel__region-clear" type="button" data-lab-selection-roi-clear="true">${escapeHtml(copy.t("mediaAnalysis.timeline.clearRegion", "Clear region"))}</button>`
                  : ""
              }
            </div>
            ${renderSelectionRegionTools({
              copy,
              roiFocusActive,
              selectionRoi,
              snapshot: activeInspectionSnapshot,
              sourceKind: model.sourceKind,
            })}
            <div class="lab-selection-panel__inspection">
              <div class="lab-selection-panel__inspection-title">${escapeHtml(copy.t("mediaAnalysis.timeline.inspectionMode", "Inspection mode"))}</div>
              <div class="lab-selection-panel__inspection-modes">
                ${INSPECTION_MODE_OPTIONS.map(function (mode) {
                  const isActive = inspectionMode === mode;
                  const isSupported = supportsInspectionMode(mode, model.sourceKind);
                  return `<button
                    class="lab-selection-panel__inspection-pill${isActive ? " is-active" : ""}"
                    type="button"
                    aria-pressed="${String(isActive)}"
                    ${isSupported ? `data-lab-selection-inspection-mode="${mode}"` : "disabled"}
                  >${escapeHtml(formatInspectionMode(mode, copy))}</button>`;
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
                >${escapeHtml(formatSelectionIntent(intent, copy))}</button>`;
              }).join("")}
            </div>
            <div class="lab-selection-panel__hint">${escapeHtml(copy.t("mediaAnalysis.timeline.selectionHint", "This selection will guide future analysis"))}</div>
            ${renderExecutionIntentStrip(activeExecutionIntent, copy)}
            ${renderInspectionToolHints(selectionSuggestions, copy)}
            ${renderInspectionSnapshot(activeInspectionSnapshot, copy)}
            ${renderSelectionSuggestions(actionSuggestions, copy)}
            ${renderSuggestionPreview(suggestionPreview, activeExecutionIntent, copy)}
            ${renderExecutionDetailsTrigger(copy, hasExecutionDetails)}
            ${renderCollapsibleExecutionPanel({
              body: executionSimulationMarkup,
              copy,
              defaultCollapsed: getPanelCollapsed(model, "simulation"),
              panelId: "simulation",
              title: copy.t(
                "mediaAnalysis.executionPanels.simulation.eyebrow",
                "Simulation preview"
              ),
            })}
            ${renderCollapsibleExecutionPanel({
              body: executionPayloadMarkup,
              copy,
              defaultCollapsed: getPanelCollapsed(model, "payload"),
              panelId: "payload",
              title: copy.t(
                "mediaAnalysis.executionPanels.payload.eyebrow",
                "Execution payload (preview)"
              ),
            })}
            ${renderCollapsibleExecutionPanel({
              body: executionReflectionMarkup,
              copy,
              defaultCollapsed: getPanelCollapsed(model, "reflection"),
              panelId: "reflection",
              title: copy.t(
                "mediaAnalysis.executionPanels.reflection.eyebrow",
                "Execution reflection"
              ),
            })}
            ${renderCollapsibleExecutionPanel({
              body: executionAlternativesMarkup,
              copy,
              defaultCollapsed: getPanelCollapsed(model, "alternatives"),
              panelId: "alternatives",
              title: copy.t(
                "mediaAnalysis.executionPanels.alternatives.eyebrow",
                "Alternative evaluation"
              ),
            })}
            ${renderCollapsibleExecutionPanel({
              body: executionCandidateMarkup,
              copy,
              defaultCollapsed: getPanelCollapsed(model, "candidate"),
              panelId: "candidate",
              title: copy.t(
                "mediaAnalysis.executionPanels.candidate.eyebrow",
                "Execution candidate"
              ),
            })}
            ${renderCollapsibleExecutionPanel({
              body: executionCommitmentMarkup,
              copy,
              defaultCollapsed: getPanelCollapsed(model, "commitment"),
              panelId: "commitment",
              title: copy.t(
                "mediaAnalysis.executionPanels.commitment.eyebrow",
                "Execution commitment"
              ),
            })}
            ${renderCollapsibleExecutionPanel({
              body: executionStagingMarkup,
              copy,
              defaultCollapsed: getPanelCollapsed(model, "staging"),
              panelId: "staging",
              title: copy.t("mediaAnalysis.executionPanels.staging.eyebrow", "Execution staging"),
            })}
            ${renderInterpretationPanel(interpretationItems, "embedded", copy)}
            ${renderExecutionDetailsOverlay(copy, model, executionDetailsBody)}
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
      ${renderWaveformInspectionLens(model, copy)}
      ${hasSelection ? "" : renderInterpretationPanel(interpretationItems, "standalone", copy)}
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
