import { escapeHtml } from "../models/lab-types.js";
import type { LabOperationCapabilityProjection, LabSettingsRecord } from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderLabSettingsFields } from "./lab-settings-controls.js";

export type LabOperationScopeState = {
  hasRoi: boolean;
  hasTimeRange: boolean;
};

export type LabOperationComparisonState = {
  findingNote: string;
  primaryLabel: string | null;
  referenceLabel: string | null;
  splitPercent: number;
  viewMode: string;
};

const GROUP_LABEL_FALLBACKS: Record<LabOperationCapabilityProjection["groupId"], string> = {
  audio: "Audio Outputs",
  clip: "Clip Outputs",
  frame: "Frame & Region",
  stems: "Stem Outputs",
};

const GROUP_ORDER: LabOperationCapabilityProjection["groupId"][] = [
  "clip",
  "frame",
  "audio",
  "stems",
];

function getCapabilityCopy(capability: LabOperationCapabilityProjection, copy: LabI18n) {
  return {
    label: copy.t(`mediaAnalysis.operations.capabilities.${capability.id}.label`, capability.label),
    description: copy.t(
      `mediaAnalysis.operations.capabilities.${capability.id}.description`,
      capability.description
    ),
  };
}

function formatOutputKinds(capability: LabOperationCapabilityProjection, copy: LabI18n) {
  return capability.outputKinds
    .map(function (kind) {
      return copy.t(`mediaAnalysis.operations.outputs.${kind}`, kind);
    })
    .join(", ");
}

function renderOperationButton(capability: LabOperationCapabilityProjection, copy: LabI18n) {
  const running = capability.actionStatus === "running";
  const ready = capability.readiness === "ready" && capability.actionId !== null && !running;
  const actionable = ready || running;
  const actionId = running ? "operation-cancel" : capability.actionId || "";
  const reason = capability.blockReason || copy.t("mediaAnalysis.operations.notReady", "Not ready");
  const label = running
    ? copy.t("mediaAnalysis.operations.cancelAction", "Cancel")
    : capability.actionStatus === "success"
      ? capability.activeActionMessage || copy.t("mediaAnalysis.operations.successAction", "Ready")
      : capability.actionStatus === "error"
        ? copy.t("mediaAnalysis.operations.errorAction", "Retry")
        : capability.planned === true
          ? copy.t("mediaAnalysis.operations.plannedAction", "Planned")
          : copy.t("mediaAnalysis.operations.runAction", "Run");
  const title =
    capability.actionStatus === "error"
      ? capability.activeActionMessage || reason
      : running
        ? copy.t("mediaAnalysis.operations.cancelTitle", "Cancel this operation")
        : reason;

  return `
    <button
      class="labx-operation-card__action"
      type="button"
      ${actionable ? `data-lab-action="${escapeHtml(actionId)}"` : "disabled"}
      ${running ? `data-lab-value="${escapeHtml(capability.id)}"` : ""}
      data-action-status="${escapeHtml(capability.actionStatus)}"
      data-lab-operation-capability="${escapeHtml(capability.id)}"
      ${running ? 'aria-busy="true"' : ""}
      ${ready && capability.actionStatus !== "error" ? "" : `title="${escapeHtml(title)}"`}
    >${escapeHtml(label)}</button>
  `;
}

function renderImageComparisonCaptureControls(
  comparison: LabOperationComparisonState | null,
  copy: LabI18n
) {
  if (comparison === null) {
    return "";
  }
  const referenceReady = comparison.referenceLabel !== null;
  const disabled = referenceReady ? "" : " disabled";
  const disabledTitle = referenceReady
    ? ""
    : ` title="${escapeHtml(copy.t("mediaAnalysis.operations.comparison.referenceRequired", "Önce ikinci bir resim referansı seçilmelidir."))}"`;
  const viewModeOptions = ["side-by-side", "stacked", "split", "difference", "roi-detail"]
    .map(function (value) {
      return `<option value="${escapeHtml(value)}" ${comparison.viewMode === value ? "selected" : ""}>${escapeHtml(copy.t(`mediaAnalysis.operations.comparison.viewModes.${value}`, value))}</option>`;
    })
    .join("");

  return `
    <div class="labx-operation-card__comparison" data-reference-ready="${referenceReady ? "true" : "false"}">
      <div class="labx-operation-card__comparison-pair">
        <span><strong>A</strong> ${escapeHtml(comparison.primaryLabel || copy.t("mediaAnalysis.operations.comparison.activeImageMissing", "Aktif resim yok"))}</span>
        <span><strong>B</strong> ${escapeHtml(comparison.referenceLabel || copy.t("mediaAnalysis.operations.comparison.referenceMissing", "Referans seçilmedi"))}</span>
      </div>
      <label class="labx-operation-card__comparison-field">
        <span>${escapeHtml(copy.t("mediaAnalysis.operations.comparison.viewMode", "Görünüm"))}</span>
        <select data-lab-field="workspace.comparison.viewMode">${viewModeOptions}</select>
      </label>
      <label class="labx-operation-card__comparison-field">
        <span>${escapeHtml(copy.t("mediaAnalysis.operations.comparison.split", "Split"))}</span>
        <input type="number" min="5" max="95" step="1" value="${escapeHtml(String(Math.round(comparison.splitPercent)))}" data-lab-field="workspace.comparison.splitPercent" />
      </label>
      <label class="labx-operation-card__comparison-note">
        <span>${escapeHtml(copy.t("mediaAnalysis.operations.comparison.note", "Bulgu notu"))}</span>
        <textarea rows="3" maxlength="1000" data-lab-field="workspace.comparison.findingNote">${escapeHtml(comparison.findingNote)}</textarea>
      </label>
      <div class="labx-operation-card__comparison-actions">
        <button class="labx-operation-card__action" type="button" data-lab-action="workspace-comparison-moment-capture"${disabled}${disabledTitle}>${escapeHtml(copy.t("mediaAnalysis.operations.comparison.captureMoment", "Anı Yakala"))}</button>
        <button class="labx-operation-card__action" type="button" data-lab-action="workspace-comparison-finding-save"${disabled}${disabledTitle}>${escapeHtml(copy.t("mediaAnalysis.operations.comparison.saveFinding", "Bulgu Kaydet"))}</button>
      </div>
    </div>
  `;
}

function getCapabilityScopeUses(
  capability: LabOperationCapabilityProjection,
  scope: LabOperationScopeState
) {
  const usesTimeRange =
    scope.hasTimeRange &&
    (capability.requiresSelection === true ||
      capability.id === "audio-extract" ||
      capability.id === "audio-cleanup" ||
      capability.id === "band-pass-voice");
  const usesRoi =
    scope.hasRoi &&
    (capability.requiresRoi === true ||
      capability.id === "clip-export" ||
      capability.id === "enhanced-frame" ||
      capability.id === "image-comparison");
  return { usesRoi, usesTimeRange };
}

function renderOperationScopeChecklist(
  capability: LabOperationCapabilityProjection,
  scope: LabOperationScopeState,
  copy: LabI18n
) {
  const scopeUses = getCapabilityScopeUses(capability, scope);
  if (scopeUses.usesTimeRange !== true && scopeUses.usesRoi !== true) {
    return "";
  }
  const items = [
    scopeUses.usesTimeRange
      ? {
          id: "timeRange",
          label: copy.t("mediaAnalysis.operations.scope.selectedRange", "Seçili zaman aralığı"),
        }
      : null,
    scopeUses.usesRoi
      ? {
          id: "roi",
          label: copy.t("mediaAnalysis.operations.scope.selectedRoi", "Seçili ROI"),
        }
      : null,
  ].filter((item): item is { id: string; label: string } => item !== null);

  return `
    <div class="labx-operation-card__scope" aria-label="${escapeHtml(copy.t("mediaAnalysis.operations.scope.title", "Kapsam"))}">
      ${items
        .map(function (item) {
          return `
            <label class="labx-operation-card__scope-item">
              <input type="checkbox" checked disabled data-lab-operation-scope="${escapeHtml(item.id)}" />
              <span>${escapeHtml(item.label)}</span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;
}

function getScopedOperationSettings(
  capability: LabOperationCapabilityProjection,
  scope: LabOperationScopeState
): LabSettingsRecord {
  const settings = { ...capability.settings };
  if (scope.hasRoi && capability.id === "clip-export") {
    settings["applyRoiCrop"] = true;
  }
  if (scope.hasTimeRange && capability.id === "audio-extract") {
    settings["timelineOnly"] = true;
  }
  return settings;
}

export function renderCapabilityCard(
  capability: LabOperationCapabilityProjection,
  activeCapabilityId: LabOperationCapabilityProjection["id"] | null,
  copy: LabI18n,
  scope: LabOperationScopeState = { hasRoi: false, hasTimeRange: false },
  comparison: LabOperationComparisonState | null = null
) {
  const readinessLabel =
    capability.readiness === "ready"
      ? copy.t("mediaAnalysis.operations.ready", "Ready")
      : capability.readiness === "optional"
        ? copy.t("mediaAnalysis.operations.partial", "Partial")
        : copy.t("mediaAnalysis.operations.blocked", "Blocked");
  const operationCopy = getCapabilityCopy(capability, copy);
  const outputLabel = formatOutputKinds(capability, copy);
  const settings = getScopedOperationSettings(capability, scope);
  const actionStateMessage =
    capability.activeActionMessage ||
    (capability.actionStatus === "running" ? capability.activeActionLabel : null);
  return `
    <article
      class="labx-operation-card"
      data-readiness="${escapeHtml(capability.readiness)}"
      data-action-status="${escapeHtml(capability.actionStatus)}"
      data-operation-id="${escapeHtml(capability.id)}"
      data-active="${activeCapabilityId === capability.id ? "true" : "false"}"
    >
      <div class="labx-operation-card__main">
        <div>
          <h3>${escapeHtml(operationCopy.label)}</h3>
          <p>${escapeHtml(operationCopy.description)}</p>
        </div>
        <span class="labx-operation-card__status">${escapeHtml(readinessLabel)}</span>
      </div>
      <div class="labx-operation-card__meta">
        <span>${escapeHtml(copy.t("mediaAnalysis.operations.output", "Output"))}: ${escapeHtml(outputLabel)}</span>
        ${
          capability.toolIds.length > 0
            ? `<span>${escapeHtml(copy.t("mediaAnalysis.operations.tools", "Tools"))}: ${escapeHtml(capability.toolIds.join(", "))}</span>`
            : ""
        }
      </div>
      ${
        capability.blockReason
          ? `<p class="labx-operation-card__reason">${escapeHtml(capability.blockReason)}</p>`
          : ""
      }
      ${
        capability.actionStatus !== "idle" && actionStateMessage
          ? `<p class="labx-operation-card__action-state">${escapeHtml(actionStateMessage)}</p>`
          : ""
      }
      ${renderOperationScopeChecklist(capability, scope, copy)}
      ${renderLabSettingsFields({
        fields: capability.settingsFields,
        prefix: `operationSettings.${capability.id}`,
        resetAction: "operation-settings-reset",
        resetLabel: copy.t("mediaAnalysis.settings.reset", "Reset"),
        resetValue: capability.id,
        settings,
        title: copy.t("mediaAnalysis.operations.settings", "Settings"),
        toggleLabel: copy.t("mediaAnalysis.settings.edit", "Edit"),
        translate: copy.t,
        variant: "inline",
      })}
      ${
        capability.id === "image-comparison"
          ? renderImageComparisonCaptureControls(comparison, copy)
          : ""
      }
      ${renderOperationButton(capability, copy)}
    </article>
  `;
}

export function renderWorkspaceOperationControls(
  capabilities: LabOperationCapabilityProjection[],
  activeCapabilityId: LabOperationCapabilityProjection["id"] | null = null,
  copy: LabI18n = LAB_FALLBACK_I18N,
  scope: LabOperationScopeState = { hasRoi: false, hasTimeRange: false },
  comparison: LabOperationComparisonState | null = null
) {
  if (capabilities.length === 0) {
    return "";
  }
  return `
    <section class="labx-card labx-operation-controls labx-workspace-focus-row__panel" data-tone="accent">
      <div class="labx-card__header">
        <div>
          <h2 class="labx-card__title">${escapeHtml(copy.t("mediaAnalysis.operations.title", "Operations"))}</h2>
        </div>
      </div>
      <div class="labx-card__body">
        <div class="labx-operation-groups">
          ${GROUP_ORDER.map(function (groupId) {
            const groupCapabilities = capabilities.filter(function (capability) {
              return capability.groupId === groupId;
            });
            if (groupCapabilities.length === 0) {
              return "";
            }
            return `
              <section class="labx-operation-group">
                <p class="labx-card__eyebrow">${escapeHtml(copy.t(`mediaAnalysis.operations.groups.${groupId}`, GROUP_LABEL_FALLBACKS[groupId]))}</p>
                <div class="labx-operation-group__list">
                  ${groupCapabilities
                    .map(function (capability) {
                      return renderCapabilityCard(
                        capability,
                        activeCapabilityId,
                        copy,
                        scope,
                        comparison
                      );
                    })
                    .join("")}
                </div>
              </section>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;
}
