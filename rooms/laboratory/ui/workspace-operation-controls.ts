import { escapeHtml } from "../models/lab-types.js";
import type { LabOperationCapabilityProjection } from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderLabSettingsFields } from "./lab-settings-controls.js";

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

function renderCapabilityCard(
  capability: LabOperationCapabilityProjection,
  activeCapabilityId: LabOperationCapabilityProjection["id"] | null,
  copy: LabI18n
) {
  const readinessLabel =
    capability.readiness === "ready"
      ? copy.t("mediaAnalysis.operations.ready", "Ready")
      : capability.readiness === "optional"
        ? copy.t("mediaAnalysis.operations.partial", "Partial")
        : copy.t("mediaAnalysis.operations.blocked", "Blocked");
  const operationCopy = getCapabilityCopy(capability, copy);
  const outputLabel = formatOutputKinds(capability, copy);
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
      ${renderLabSettingsFields({
        fields: capability.settingsFields,
        prefix: `operationSettings.${capability.id}`,
        resetAction: "operation-settings-reset",
        resetLabel: copy.t("mediaAnalysis.settings.reset", "Reset"),
        resetValue: capability.id,
        settings: capability.settings,
        title: copy.t("mediaAnalysis.operations.settings", "Settings"),
        toggleLabel: copy.t("mediaAnalysis.settings.edit", "Edit"),
        translate: copy.t,
      })}
      ${renderOperationButton(capability, copy)}
    </article>
  `;
}

export function renderWorkspaceOperationControls(
  capabilities: LabOperationCapabilityProjection[],
  activeCapabilityId: LabOperationCapabilityProjection["id"] | null = null,
  copy: LabI18n = LAB_FALLBACK_I18N
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
                      return renderCapabilityCard(capability, activeCapabilityId, copy);
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
