import { escapeHtml } from "../models/lab-types.js";
import type {
  CapabilityFamilyId,
  LabDrawerMode,
  LabPipelineBlock,
  LabStoreState,
  LabWorkspaceSurface,
} from "../models/lab-types.js";
import {
  buildIntentPreviewSentence,
  getActiveExecutionAlternatives,
  getActiveExecutionCandidate,
  getActiveExecutionIntent,
  getActiveExecutionPayloadPreview,
  getActiveExecutionPlan,
  getActiveExecutionReadiness,
  getAnalysisActionBlockReason,
  getAnalysisPreparationGroups,
  getAvailableIntents,
  getDrawerCollapsed,
  getLaboratoryRightPanelContext,
  getPreflightSeverity,
  getPreflightWarnings,
  getReportFreshness,
  getSelectedIntents,
  getSourceReady,
  getWorkspaceDiff,
  isRunComplete,
  isWorkspaceDirty,
  resolveDrawerMode,
} from "../runtime/lab-selectors.js";
import { buildExecutionBridge } from "../runtime/lab-execution-bridge.js";
import { formatExecutionBridgeAdvisory } from "../runtime/lab-execution-bridge.js";
import { formatDecisionCoherenceAdvisory } from "../runtime/lab-decision-coherence.js";
import { buildExecutionDescriptor } from "../runtime/lab-execution-descriptor.js";
import { formatExecutionReadinessSignalAdvisory } from "../runtime/lab-execution-readiness-signal.js";
import type { LabExecutionReadinessSignal } from "../runtime/lab-execution-readiness-signal.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderContextPanel, renderPipeline } from "./laboratory-layout.js";
import { formatLabExpectedOutputLabel, translateLabRuntimeText } from "./lab-runtime-i18n.js";
import { renderLabSettingsFields } from "./lab-settings-controls.js";

type AnalysisPreparationGroup = ReturnType<typeof getAnalysisPreparationGroups>[number];
type AvailableIntent = ReturnType<typeof getAvailableIntents>[number];

// ---------------------------------------------------------------------------
// Mode headers
// ---------------------------------------------------------------------------

const MODE_HEADERS: Record<
  LabDrawerMode,
  { eyebrowKey: string; eyebrowFallback: string; titleKey: string; titleFallback: string }
> = {
  setup: {
    eyebrowKey: "mediaAnalysis.drawer.setup.eyebrow",
    eyebrowFallback: "Configuration",
    titleKey: "mediaAnalysis.drawer.setup.title",
    titleFallback: "Analysis Preparation",
  },
  running: {
    eyebrowKey: "mediaAnalysis.drawer.running.eyebrow",
    eyebrowFallback: "Running",
    titleKey: "mediaAnalysis.drawer.running.title",
    titleFallback: "Analysis Progress",
  },
  result: {
    eyebrowKey: "mediaAnalysis.drawer.result.eyebrow",
    eyebrowFallback: "Result",
    titleKey: "mediaAnalysis.drawer.result.title",
    titleFallback: "Decision Surface",
  },
  explore: {
    eyebrowKey: "mediaAnalysis.drawer.explore.eyebrow",
    eyebrowFallback: "Explore",
    titleKey: "mediaAnalysis.drawer.explore.title",
    titleFallback: "Alternatives and Comparison",
  },
};

function renderDrawerHeader(mode: LabDrawerMode, copy: LabI18n) {
  const h = MODE_HEADERS[mode];
  return `
    <div class="labx-drawer__header">
      <p class="labx-card__eyebrow">${escapeHtml(copy.t(h.eyebrowKey, h.eyebrowFallback))}</p>
      <h2>${escapeHtml(copy.t(h.titleKey, h.titleFallback))}</h2>
    </div>
  `;
}

function renderDrawerBody(blocks: LabPipelineBlock[], mode: LabDrawerMode) {
  return `
    <div class="labx-drawer__body">
      ${renderPipeline(blocks, mode)}
    </div>
  `;
}

function getIntentCopy(intent: AvailableIntent, copy: LabI18n) {
  return {
    label: copy.t(`mediaAnalysis.workspace.intents.${intent.id}.label`, intent.label),
    description: copy.t(
      `mediaAnalysis.workspace.intents.${intent.id}.description`,
      intent.description
    ),
  };
}

function getAnalysisModuleLabel(
  module: AnalysisPreparationGroup["modules"][number],
  copy: LabI18n
) {
  if (module.capabilityId === "visual-structure" || module.capabilityId === "visual-forensics") {
    return copy.t(`visualAnalysis.catalog.modules.${module.moduleId}.title`, module.label);
  }
  return copy.t(`audioAnalysis.catalog.modules.${module.moduleId}.title`, module.label);
}

function getReportSectionLabel(module: AnalysisPreparationGroup["modules"][number], copy: LabI18n) {
  return copy.t(
    `mediaAnalysis.drawer.setup.reportSections.${module.capabilityId}`,
    module.reportSection
  );
}

// ---------------------------------------------------------------------------
// Setup mode
// ---------------------------------------------------------------------------

function renderAnalysisPreparationGroupBody(
  group: AnalysisPreparationGroup,
  activeCapabilityIds: CapabilityFamilyId[],
  copy: LabI18n
) {
  const outputSummary =
    group.expectedOutputs.length > 0
      ? group.expectedOutputs
          .map(function (output) {
            return formatLabExpectedOutputLabel(output, copy);
          })
          .join(", ")
      : copy.t("mediaAnalysis.drawer.setup.defaultReportOutput", "Report evidence");

  return `
    <div
      class="labx-analysis-group"
      data-selected="${group.selected ? "true" : "false"}"
      data-readiness="${escapeHtml(group.readiness)}"
    >
      <div class="labx-analysis-group__modules">
        ${group.modules
          .map(function (module) {
            const moduleLabel = getAnalysisModuleLabel(module, copy);
            const reportSection = getReportSectionLabel(module, copy);
            const blockReason = module.blockReason
              ? translateLabRuntimeText(module.blockReason, copy)
              : "";
            return `
              <div
                class="labx-analysis-module"
                data-readiness="${escapeHtml(module.readiness)}"
                data-active="${activeCapabilityIds.includes(module.capabilityId) ? "true" : "false"}"
              >
                <label class="labx-analysis-module__toggle">
                  <input
                    type="checkbox"
                    ${module.enabled ? "checked" : ""}
                    data-lab-action="module-toggle"
                    data-lab-value="${escapeHtml(module.moduleId)}"
                  />
                  <span>
                    <strong>${escapeHtml(moduleLabel)}</strong>
                    <small>${escapeHtml(reportSection)}${blockReason !== "" ? ` · ${escapeHtml(blockReason)}` : ""}</small>
                  </span>
                </label>
                ${renderLabSettingsFields({
                  fields: module.settingsFields,
                  prefix: `analysisSettings.modules.${module.moduleId}`,
                  resetAction: "analysis-settings-reset",
                  resetLabel: copy.t("mediaAnalysis.settings.reset", "Reset"),
                  resetValue: module.moduleId,
                  settings: module.settings,
                  title: copy.t("mediaAnalysis.drawer.setup.moduleSettings", "Settings"),
                  toggleLabel: copy.t("mediaAnalysis.settings.edit", "Edit"),
                  translate: copy.t,
                })}
              </div>
            `;
          })
          .join("")}
      </div>
      <p class="labx-analysis-group__outputs">${escapeHtml(copy.t("mediaAnalysis.drawer.setup.reportOutputs", "Report outputs"))}: ${escapeHtml(outputSummary)}</p>
    </div>
  `;
}

function renderAnalysisPreparationAccordion(
  intent: AvailableIntent,
  group: AnalysisPreparationGroup | undefined,
  expanded: boolean,
  activeCapabilityIds: CapabilityFamilyId[],
  copy: LabI18n
) {
  const selected = intent.selected;
  const blocked = intent.readiness === "blocked";
  const groupActive =
    group?.modules.some(function (module) {
      return activeCapabilityIds.includes(module.capabilityId);
    }) === true;
  const readiness = group?.readiness ?? intent.readiness;
  const moduleCount = group?.modules.length ?? 0;
  const enabledModuleCount =
    group?.modules.filter(function (module) {
      return module.enabled;
    }).length ?? 0;
  const toggleLabel = expanded
    ? copy.t("mediaAnalysis.drawer.setup.collapseGroup", "Collapse")
    : copy.t("mediaAnalysis.drawer.setup.expandGroup", "Expand");
  const intentCopy = getIntentCopy(intent, copy);
  const intentBlockReason = intent.blockReason
    ? translateLabRuntimeText(intent.blockReason, copy)
    : "";

  return `
    <div
      class="labx-drawer__intent-cluster"
      data-selected="${String(selected)}"
      data-expanded="${String(expanded)}"
      data-readiness="${escapeHtml(readiness)}"
      data-active="${String(groupActive)}"
    >
      <div class="labx-drawer__intent-head">
        <label class="labx-drawer__intent-item" data-blocked="${String(blocked)}">
          <input
            type="checkbox"
            ${selected ? "checked" : ""}
            ${blocked ? "disabled" : ""}
            data-lab-action="workspace-intent-toggle"
            data-lab-value="${escapeHtml(intent.id)}"
          />
          <span>
            <strong>${escapeHtml(intentCopy.label)}</strong>
            <small>${escapeHtml(intentCopy.description)}</small>
          </span>
          ${intentBlockReason !== "" ? `<small class="labx-drawer__intent-block">${escapeHtml(intentBlockReason)}</small>` : ""}
        </label>
        ${
          group
            ? `<button
                class="labx-drawer__intent-toggle"
                type="button"
                data-lab-action="analysis-prep-group-toggle"
                data-lab-value="${escapeHtml(intent.id)}"
                aria-expanded="${String(expanded)}"
                aria-label="${escapeHtml(toggleLabel)}"
                title="${escapeHtml(toggleLabel)}"
              >
                ${expanded ? "-" : "+"}
              </button>`
            : ""
        }
      </div>
      <div class="labx-drawer__intent-summary">
        <span>${escapeHtml(readiness)}</span>
        ${
          moduleCount > 0
            ? `<span>${escapeHtml(String(enabledModuleCount))}/${escapeHtml(String(moduleCount))}</span>`
            : ""
        }
      </div>
      ${expanded && group ? renderAnalysisPreparationGroupBody(group, activeCapabilityIds, copy) : ""}
    </div>
  `;
}

function getRunningPlanModuleStatus(state: LabStoreState, moduleId: string) {
  return state.run?.modules[moduleId]?.status ?? "idle";
}

function getRunningPlanStatusLabel(status: string, copy: LabI18n) {
  switch (status) {
    case "running":
      return copy.t("mediaAnalysis.drawer.running.planStatus.running", "Analiz ediliyor");
    case "queued":
      return copy.t("mediaAnalysis.drawer.running.planStatus.queued", "Sırada");
    case "completed":
      return copy.t("mediaAnalysis.drawer.running.planStatus.completed", "Tamamlandı");
    case "failed":
      return copy.t("mediaAnalysis.drawer.running.planStatus.failed", "Hata verdi");
    case "cancelled":
      return copy.t("mediaAnalysis.drawer.running.planStatus.cancelled", "İptal edildi");
    case "skipped":
      return copy.t("mediaAnalysis.drawer.running.planStatus.skipped", "Atlandı");
    default:
      return copy.t("mediaAnalysis.drawer.running.planStatus.ready", "Hazır");
  }
}

function getRunningPlanGroupStatus(group: AnalysisPreparationGroup, state: LabStoreState): string {
  const statuses = group.modules
    .filter(function (module) {
      return module.enabled;
    })
    .map(function (module) {
      return getRunningPlanModuleStatus(state, module.moduleId);
    });
  if (statuses.some((status) => status === "running")) return "running";
  if (statuses.some((status) => status === "queued")) return "queued";
  if (statuses.some((status) => status === "failed")) return "failed";
  if (statuses.some((status) => status === "cancelled")) return "cancelled";
  if (statuses.length > 0 && statuses.every((status) => status === "completed")) return "completed";
  return "ready";
}

function renderRunningPlanModule(
  module: AnalysisPreparationGroup["modules"][number],
  state: LabStoreState,
  copy: LabI18n
) {
  const runModule = state.run?.modules[module.moduleId];
  const status = runModule?.status ?? "idle";
  const active = status === "running" || status === "queued";
  const statusLabel = getRunningPlanStatusLabel(status, copy);
  const moduleLabel = getAnalysisModuleLabel(module, copy);
  const message = runModule?.message
    ? translateLabRuntimeText(runModule.message, copy)
    : getReportSectionLabel(module, copy);

  return `
    <div
      class="labx-analysis-module labx-analysis-module--locked"
      data-readiness="${escapeHtml(module.readiness)}"
      data-status="${escapeHtml(status)}"
      data-active="${active ? "true" : "false"}"
    >
      <span class="labx-analysis-module__status" aria-hidden="true"></span>
      <span>
        <strong>${escapeHtml(moduleLabel)}</strong>
        <small>${escapeHtml(statusLabel)}${message ? ` · ${escapeHtml(message)}` : ""}</small>
      </span>
    </div>
  `;
}

function renderRunningPlanGroup(
  intent: AvailableIntent,
  group: AnalysisPreparationGroup,
  state: LabStoreState,
  copy: LabI18n
) {
  const enabledModules = group.modules.filter(function (module) {
    return module.enabled;
  });
  const status = getRunningPlanGroupStatus(group, state);
  const active = status === "running" || status === "queued";
  const statusLabel = getRunningPlanStatusLabel(status, copy);
  const intentCopy = getIntentCopy(intent, copy);

  return `
    <div
      class="labx-drawer__intent-cluster labx-drawer__intent-cluster--locked"
      data-selected="true"
      data-expanded="true"
      data-readiness="${escapeHtml(group.readiness)}"
      data-status="${escapeHtml(status)}"
      data-active="${active ? "true" : "false"}"
    >
      <div class="labx-drawer__intent-head labx-drawer__intent-head--locked">
        <div class="labx-drawer__intent-item labx-drawer__intent-item--static">
          <span>
            <strong>${escapeHtml(intentCopy.label)}</strong>
            <small>${escapeHtml(intentCopy.description)}</small>
          </span>
        </div>
      </div>
      <div class="labx-drawer__intent-summary">
        <span>${escapeHtml(statusLabel)}</span>
        <span>${escapeHtml(String(enabledModules.length))}/${escapeHtml(String(group.modules.length))}</span>
      </div>
      <div class="labx-analysis-group labx-analysis-group--locked" data-selected="true" data-readiness="${escapeHtml(group.readiness)}">
        <div class="labx-analysis-group__modules">
          ${enabledModules
            .map(function (module) {
              return renderRunningPlanModule(module, state, copy);
            })
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderRunningAnalysisPlan(state: LabStoreState, copy: LabI18n) {
  const runIntentIds = state.run?.analysisScope?.intentIds ?? [];
  const selectedIntentIds = runIntentIds.length > 0 ? runIntentIds : getSelectedIntents(state);
  const intents = getAvailableIntents(state).filter(function (intent) {
    return selectedIntentIds.includes(intent.id);
  });
  const analysisGroups = getAnalysisPreparationGroups(state);
  const groupsMarkup = intents
    .map(function (intent) {
      const group = analysisGroups.find(function (entry) {
        return entry.intentId === intent.id;
      });
      return group ? renderRunningPlanGroup(intent, group, state, copy) : "";
    })
    .join("");

  return `
    <section
      class="labx-drawer__section labx-drawer__intents labx-drawer__intents--running"
      data-lab-running-plan="true"
      aria-disabled="true"
    >
      <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.setup.intentsTitle", "Analysis Goals"))}</h3>
      ${
        groupsMarkup !== ""
          ? `<div class="labx-drawer__intent-list">${groupsMarkup}</div>`
          : `<p class="labx-drawer__ok">${escapeHtml(copy.t("mediaAnalysis.drawer.running.planResolving", "Analiz planı hazırlanıyor."))}</p>`
      }
    </section>
  `;
}

function getActiveAnalysisCapabilityIds(state: LabStoreState): CapabilityFamilyId[] {
  const activeExecutionIntent = getActiveExecutionIntent(state);
  if (activeExecutionIntent?.flowKind === "operation-result") {
    return [];
  }
  switch (activeExecutionIntent?.actionType) {
    case "inspect-audio":
      return ["audio-signal", "audio-recovery"];
    case "inspect-motion":
    case "detect-scenes":
    case "detect-objects":
      return ["visual-structure"];
    case "focus-region":
    case "ocr-region":
    case "metadata-audit":
      return ["visual-forensics"];
    case "analyze-segment":
      return ["visual-structure", "visual-forensics", "audio-signal"];
    case "extract-clip":
    case "enhance-visual":
    case "enhance-frame":
    case "crop-region":
    case "clean-audio":
    case "separate-stems":
    case "stabilize-segment":
    case undefined:
      return [];
    default:
      return [];
  }
}

function renderSetupMode(state: LabStoreState, surface: LabWorkspaceSurface, copy: LabI18n) {
  const sourceReady = getSourceReady(state);
  const intents = getAvailableIntents(state);
  const analysisGroups = getAnalysisPreparationGroups(state);
  const activeAnalysisCapabilityIds = getActiveAnalysisCapabilityIds(state);
  const selectedIntents = getSelectedIntents(state);
  const blockReason = getAnalysisActionBlockReason(state);
  const preflightSeverity = getPreflightSeverity(state);
  const preflightWarnings = getPreflightWarnings(state);
  const previewSentence = buildIntentPreviewSentence(state);

  const intentsMarkup = sourceReady
    ? `<section class="labx-drawer__section labx-drawer__intents">
        <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.setup.intentsTitle", "Analysis Goals"))}</h3>
        <div class="labx-drawer__intent-list">
          ${intents
            .map(function (intent) {
              const analysisGroup = analysisGroups.find(function (group) {
                return group.intentId === intent.id;
              });
              const expanded = state.ui.workspace.analysisPrepExpandedIntentIds.includes(intent.id);
              return renderAnalysisPreparationAccordion(
                intent,
                analysisGroup,
                expanded,
                activeAnalysisCapabilityIds,
                copy
              );
            })
            .join("")}
        </div>
      </section>`
    : "";

  const preflightSection =
    selectedIntents.length > 0
      ? `<section class="labx-drawer__section labx-drawer__preflight" data-severity="${escapeHtml(preflightSeverity)}">
          <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.setup.preflightTitle", "Preflight"))}</h3>
          ${
            preflightWarnings.length > 0
              ? `<ul class="labx-drawer__preflight-list">${preflightWarnings
                  .map(function (w) {
                    return `<li>${escapeHtml(w)}</li>`;
                  })
                  .join("")}</ul>`
              : `<p class="labx-drawer__ok">${escapeHtml(copy.t("mediaAnalysis.drawer.setup.preflightOk", "All tools are ready"))}</p>`
          }
        </section>`
      : "";

  const previewMarkup =
    previewSentence !== ""
      ? `<p class="labx-drawer__preview">${escapeHtml(previewSentence)}</p>`
      : "";

  const ctaMarkup = `
    <div class="labx-drawer__cta">
      <button
        class="labx-cta"
        type="button"
        data-lab-action="run-deep-analysis"
        ${blockReason !== null ? "disabled" : ""}
        ${blockReason !== null ? `title="${escapeHtml(blockReason)}"` : ""}
      >
        ${escapeHtml(copy.t("mediaAnalysis.drawer.setup.cta", "Start Analysis"))}
      </button>
      ${previewMarkup}
      ${preflightSeverity === "warning" ? `<p class="labx-drawer__cta-warn">${escapeHtml(copy.t("mediaAnalysis.drawer.setup.partialWarn", "Some tools are missing; results may be partial."))}</p>` : ""}
    </div>
  `;

  const sideControls =
    surface.side.trim() !== ""
      ? `<div class="labx-drawer__side-controls">${surface.side}</div>`
      : "";

  const blocks: LabPipelineBlock[] = [
    {
      id: "analysis-prep",
      render() {
        return intentsMarkup;
      },
      type: "section",
      visible() {
        return sourceReady;
      },
    },
    {
      id: "preflight",
      render() {
        return preflightSection;
      },
      type: "status",
      visible() {
        return selectedIntents.length > 0;
      },
    },
    {
      id: "analysis-cta",
      render() {
        return ctaMarkup;
      },
      type: "action",
    },
    {
      id: "selection-panel",
      render() {
        return sideControls;
      },
      type: "section",
      visible() {
        return surface.side.trim() !== "";
      },
    },
  ];

  return renderPipeline(blocks, "setup");
}

// ---------------------------------------------------------------------------
// Running mode
// ---------------------------------------------------------------------------

function renderRunningMode(state: LabStoreState, copy: LabI18n) {
  const cancelPending = state.ui.analysisCancelPending === true;
  const cancelLabel = cancelPending
    ? copy.t("mediaAnalysis.drawer.running.cancelPending", "Analiz iptal ediliyor")
    : copy.t("mediaAnalysis.drawer.running.cancel", "Analizi İptal Et");
  const cancelSub = cancelPending
    ? copy.t("mediaAnalysis.drawer.running.cancelPendingSub", "İptal isteği işleniyor")
    : copy.t("mediaAnalysis.drawer.running.cancelSub", "Çalışan analiz durdurulacak");

  const cancelCta = `
    <div class="labx-drawer__cta">
      <button class="labx-cta labx-cta--danger" type="button" data-lab-action="cancel-analysis" ${cancelPending ? 'disabled aria-busy="true"' : ""}>
        ${escapeHtml(cancelLabel)}
      </button>
      <p class="labx-drawer__cta-sub">${escapeHtml(cancelSub)}</p>
    </div>
  `;

  const blocks: LabPipelineBlock[] = [
    {
      id: "execution-status",
      render() {
        return renderRunningAnalysisPlan(state, copy);
      },
      type: "status",
    },
    {
      id: "cancel-analysis",
      render() {
        return cancelCta;
      },
      type: "action",
    },
  ];

  return renderPipeline(blocks, "running");
}

// ---------------------------------------------------------------------------
// Result mode — Decision Surface
// ---------------------------------------------------------------------------

type DrawerCandidateStatus = "viable" | "unstable" | "not-viable" | null;
type DrawerCommitmentStatus = "inactive" | "committed" | "revoked" | "none" | null;
type DrawerStagingStatus = "staged" | "not-staged" | "none" | null;
type RuntimeLocale = "en" | "tr";

function assertUnhandledDrawerStatus(status: never): never {
  throw new Error(`Unhandled drawer status: ${String(status)}`);
}

function getCandidateAccent(status: DrawerCandidateStatus): string {
  switch (status) {
    case "viable":
      return "success";
    case "unstable":
      return "warning";
    case "not-viable":
      return "error";
    case null:
      return "none";
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getRuntimeLocale(copy: LabI18n): RuntimeLocale {
  return copy.locale === "tr" ? "tr" : "en";
}

function getCandidateDisplayLabel(status: DrawerCandidateStatus, copy: LabI18n): string {
  switch (status) {
    case "viable":
      return copy.t("mediaAnalysis.rightContext.status.viable", "Valid");
    case "unstable":
      return copy.t("mediaAnalysis.rightContext.status.unstable", "Unstable");
    case "not-viable":
      return copy.t("mediaAnalysis.rightContext.status.notViable", "Invalid");
    case null:
      return copy.t("mediaAnalysis.rightContext.status.none", "-");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getCommitmentDisplayLabel(status: DrawerCommitmentStatus, copy: LabI18n): string {
  switch (status) {
    case "committed":
      return copy.t("mediaAnalysis.rightContext.status.committed", "Approved");
    case "revoked":
      return copy.t("mediaAnalysis.rightContext.status.revoked", "Revoked");
    case "inactive":
    case "none":
    case null:
      return copy.t("mediaAnalysis.rightContext.status.none", "-");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getStagingDisplayLabel(status: DrawerStagingStatus, copy: LabI18n): string {
  switch (status) {
    case "staged":
      return copy.t("mediaAnalysis.rightContext.status.staged", "Ready");
    case "not-staged":
      return copy.t("mediaAnalysis.rightContext.status.notStaged", "Pending");
    case "none":
    case null:
      return copy.t("mediaAnalysis.rightContext.status.none", "-");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getCommitmentAccent(status: DrawerCommitmentStatus): string {
  if (status === "committed") return "success";
  if (status === "revoked") return "error";
  return "none";
}

function getStagingAccent(status: DrawerStagingStatus): string {
  if (status === "staged") return "success";
  if (status === "not-staged") return "warning";
  return "none";
}

function getCandidateImplication(status: DrawerCandidateStatus, copy: LabI18n): string {
  switch (status) {
    case "viable":
      return copy.t(
        "mediaAnalysis.drawer.result.impl.candidateViable",
        "Yapısal olarak çalıştırılabilir"
      );
    case "unstable":
      return copy.t(
        "mediaAnalysis.drawer.result.impl.candidateUnstable",
        "Yapı eksik \u2014 değerlendirme gerekli"
      );
    case "not-viable":
      return copy.t(
        "mediaAnalysis.drawer.result.impl.candidateNotViable",
        "Geçersiz \u2014 yol revizyonu gerekli"
      );
    case null:
      return copy.t("mediaAnalysis.drawer.result.impl.candidateNone", "Değerlendirme bekleniyor");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getCommitmentImplication(status: DrawerCommitmentStatus, copy: LabI18n): string {
  switch (status) {
    case "committed":
      return copy.t(
        "mediaAnalysis.drawer.result.impl.commitmentCommitted",
        "Yol staging için seçildi"
      );
    case "revoked":
      return copy.t("mediaAnalysis.drawer.result.impl.commitmentRevoked", "Onay geri çekildi");
    case "inactive":
    case "none":
    case null:
      return copy.t("mediaAnalysis.drawer.result.impl.commitmentNone", "Henüz onaylanmış yol yok");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getStagingImplication(status: DrawerStagingStatus, copy: LabI18n): string {
  switch (status) {
    case "staged":
      return copy.t("mediaAnalysis.drawer.result.impl.stagingStaged", "Çalıştırma için hazırlandı");
    case "not-staged":
      return copy.t("mediaAnalysis.drawer.result.impl.stagingNotStaged", "Henüz hazırlanmadı");
    case "none":
    case null:
      return copy.t("mediaAnalysis.drawer.result.impl.stagingNone", "Staging hazırlığı bekleniyor");
    default:
      return assertUnhandledDrawerStatus(status);
  }
}

function getCoherenceState(status: DrawerCandidateStatus): "aligned" | "mixed" | "conflicted" {
  if (status === "viable") return "aligned";
  if (status === "not-viable") return "conflicted";
  return "mixed";
}

function getReadinessSignalLevel(status: string | undefined): LabExecutionReadinessSignal["level"] {
  if (status === "ready") return "steady";
  if (status === "blocked") return "strained";
  return "guarded";
}

function buildReadinessSignalSummary(
  candidate: ReturnType<typeof getActiveExecutionCandidate>,
  readiness: ReturnType<typeof getActiveExecutionReadiness>,
  locale: RuntimeLocale
) {
  if (candidate === null || readiness === null) {
    return null;
  }
  const signal: LabExecutionReadinessSignal = {
    level: getReadinessSignalLevel(readiness.status),
    decisionPressure: candidate.decisionPressure,
    goalOutcome: "neutral",
    patternStrength: "neutral",
    alignment: readiness.status === "ready" ? "matches-simulation" : "partial",
    alternativesConfidenceBand:
      typeof readiness.confidence === "number"
        ? readiness.confidence >= 0.75
          ? "high"
          : readiness.confidence >= 0.45
            ? "medium"
            : "low"
        : "unknown",
    projectionAlignment: "none",
    score: typeof readiness.confidence === "number" ? readiness.confidence : 0,
    reasons: readiness.blockers ?? [],
  };
  return formatExecutionReadinessSignalAdvisory(signal, locale);
}

function renderResultMode(state: LabStoreState, copy: LabI18n) {
  const context = getLaboratoryRightPanelContext(state);
  const runtimeLocale = getRuntimeLocale(copy);
  const freshness = getReportFreshness(state);
  const dirty = isWorkspaceDirty(state);
  const candidate = getActiveExecutionCandidate(state);
  const readiness = getActiveExecutionReadiness(state);
  const plan = getActiveExecutionPlan(state);
  const payloadPreview = getActiveExecutionPayloadPreview(state);
  const bridge =
    plan !== null
      ? buildExecutionBridge(
          buildExecutionDescriptor({
            actionType: plan.actionType,
            executionPayloadPreview: payloadPreview,
            executionPlan: plan,
          })
        )
      : null;
  const coherenceState = getCoherenceState(context.candidateStatus);
  const coherenceSummary =
    candidate !== null
      ? formatDecisionCoherenceAdvisory(
          {
            state: coherenceState,
            dominantAxis: candidate.decisionPressure === "high" ? "safety" : "neutral",
            confidence: typeof candidate.confidence === "number" ? candidate.confidence : 0,
            summary: "",
          },
          runtimeLocale
        )
      : null;
  const readinessSummary = buildReadinessSignalSummary(candidate, readiness, runtimeLocale);
  const bridgeSummary =
    bridge !== null ? formatExecutionBridgeAdvisory(bridge, runtimeLocale) : null;
  const run = state.run;
  const runWarnings = run?.warnings ?? [];

  const warningsBanner =
    runWarnings.length > 0 && isRunComplete(state)
      ? `<div class="labx-drawer__banner labx-drawer__banner--warning">
        <p>${escapeHtml(copy.t("mediaAnalysis.drawer.result.partialWarn", "Analiz tamamlandı ancak bazı modüller uyarı verdi."))}</p>
        <ul>${runWarnings
          .map(function (w) {
            return `<li>${escapeHtml(w)}</li>`;
          })
          .join("")}</ul>
      </div>`
      : "";

  const tier1 = `
    <div class="labx-right-context__tier-1">
      <div class="labx-right-context__item">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.selection", "Selection"))}</span>
        <strong>${escapeHtml(context.selectionRangeLabel ?? copy.t("mediaAnalysis.rightContext.emptySelection", "No active selection"))}</strong>
      </div>
      <div class="labx-right-context__item">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.intent", "Intent"))}</span>
        <strong>${escapeHtml(context.activeIntentLabel ?? copy.t("mediaAnalysis.rightContext.emptyIntent", "No intent selected"))}</strong>
      </div>
    </div>
  `;

  const tier2 = `
    <div class="labx-right-context__tier-2">
      <div class="labx-right-context__decision-card" data-accent="${getCandidateAccent(context.candidateStatus)}" data-decision-card="candidate">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.candidate", "Candidate"))}</span>
        <strong>${escapeHtml(getCandidateDisplayLabel(context.candidateStatus, copy))}</strong>
        <p class="labx-right-context__implication">${escapeHtml(getCandidateImplication(context.candidateStatus, copy))}</p>
      </div>
      <div class="labx-right-context__decision-card" data-accent="${getCommitmentAccent(context.commitmentStatus)}" data-decision-card="commitment">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.commitment", "Commitment"))}</span>
        <strong>${escapeHtml(getCommitmentDisplayLabel(context.commitmentStatus, copy))}</strong>
        <p class="labx-right-context__implication">${escapeHtml(getCommitmentImplication(context.commitmentStatus, copy))}</p>
      </div>
      <div class="labx-right-context__decision-card" data-accent="${getStagingAccent(context.stagingStatus)}" data-decision-card="staging">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.staging", "Staging"))}</span>
        <strong>${escapeHtml(getStagingDisplayLabel(context.stagingStatus, copy))}</strong>
        <p class="labx-right-context__implication">${escapeHtml(getStagingImplication(context.stagingStatus, copy))}</p>
      </div>
    </div>
  `;

  const coherenceSection =
    candidate !== null
      ? `<details class="labx-drawer__advisory-details"${coherenceState === "conflicted" ? " open" : ""}>
        <summary>${escapeHtml(coherenceSummary ?? candidate.summary)}</summary>
        <div class="labx-drawer__advisory-body">
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.coherenceState", "State"))}</strong> ${escapeHtml(coherenceState)}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.coherenceAxis", "Dominant axis"))}</strong> ${escapeHtml(candidate.decisionPressure === "high" ? "safety" : "neutral")}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.coherenceIntegrity", "Yapısal Bütünlük"))}</strong> ${escapeHtml(candidate.structuralIntegrity)}</p>
          ${typeof candidate.confidence === "number" ? `<p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.coherenceConfidence", "Güven"))}</strong> ${String(Math.round(candidate.confidence * 100))}%</p>` : ""}
          <div class="labx-drawer__polarity-bar" data-polarity="${escapeHtml(coherenceState)}">
            <div class="labx-drawer__polarity-fill" style="width:${String(typeof candidate.confidence === "number" ? Math.round(candidate.confidence * 100) : 50)}%"></div>
          </div>
        </div>
      </details>`
      : "";

  const readinessSection =
    readiness !== null
      ? `<details class="labx-drawer__advisory-details"${getReadinessSignalLevel(readiness.status) === "strained" ? " open" : ""}>
        <summary>${escapeHtml(readinessSummary ?? readiness.summary)}</summary>
        <div class="labx-drawer__advisory-body">
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.readinessLevel", "Seviye"))}</strong> ${escapeHtml(readiness.status)}</p>
          ${candidate !== null ? `<p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.readinessPressure", "Decision pressure"))}</strong> ${escapeHtml(candidate.decisionPressure)}</p>` : ""}
          ${typeof readiness.confidence === "number" ? `<p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.readinessConfidence", "Güven"))}</strong> ${String(Math.round(readiness.confidence * 100))}%</p>` : ""}
          ${
            (readiness.blockers ?? []).length > 0
              ? `<ul>${(readiness.blockers ?? [])
                  .map(function (b) {
                    return `<li>${escapeHtml(b)}</li>`;
                  })
                  .join("")}</ul>`
              : ""
          }
        </div>
      </details>`
      : "";

  const bridgeSection =
    bridge !== null
      ? `<details class="labx-drawer__advisory-details">
        <summary>${escapeHtml(bridgeSummary ?? plan?.title ?? bridge.summary)}</summary>
        <div class="labx-drawer__advisory-body">
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.bridgeAdapter", "Adapter"))}</strong> ${escapeHtml(bridge.adapter)}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.bridgeOperation", "Operation"))}</strong> ${escapeHtml(bridge.operation)}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.bridgeRequired", "Required"))}</strong> ${escapeHtml(bridge.inputContract.required.join(", ") || "general")}</p>
          <p><strong>${escapeHtml(copy.t("mediaAnalysis.drawer.result.bridgeOutput", "Output"))}</strong> ${escapeHtml(bridge.outputContract.type)}</p>
        </div>
      </details>`
      : "";

  const advisories =
    coherenceSection !== "" || readinessSection !== "" || bridgeSection !== ""
      ? `<section class="labx-drawer__section labx-drawer__advisories">
        <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.result.advisoriesTitle", "Değerlendirmeler"))}</h3>
        ${coherenceSection}${readinessSection}${bridgeSection}
      </section>`
      : "";

  const freshnessLabel =
    freshness?.state === "current"
      ? copy.t("mediaAnalysis.drawer.result.fresh", "Güncel")
      : freshness?.state === "stale"
        ? copy.t("mediaAnalysis.drawer.result.stale", "Eski")
        : "";
  const dirtyBadge = dirty
    ? `<span class="labx-drawer__dirty-badge">${escapeHtml(copy.t("mediaAnalysis.drawer.result.dirty", "Workspace farklı"))}</span>`
    : "";

  const reportCta = `
    <div class="labx-drawer__cta">
      <button class="labx-cta" type="button" data-lab-action="open-report-overlay">
        ${escapeHtml(copy.t("mediaAnalysis.drawer.result.reportCta", "Raporu Görüntüle"))}
      </button>
      ${freshnessLabel !== "" ? `<p class="labx-drawer__cta-sub">${escapeHtml(freshnessLabel)} ${dirtyBadge}</p>` : dirtyBadge}
    </div>
  `;

  const exploreCta = `
    <button class="labx-drawer__explore-toggle" type="button" data-lab-action="drawer-explore-toggled">
      ${escapeHtml(copy.t("mediaAnalysis.drawer.result.explore", "Keşif Moduna Geç"))}
    </button>
  `;

  const blocks: LabPipelineBlock[] = [
    {
      id: "run-warnings",
      render() {
        return warningsBanner;
      },
      type: "status",
      visible() {
        return warningsBanner.trim() !== "";
      },
    },
    {
      id: "context-summary",
      render() {
        return tier1;
      },
      type: "section",
    },
    {
      id: "decision-status",
      render() {
        return tier2;
      },
      type: "status",
    },
    {
      id: "execution-advisories",
      render() {
        return advisories;
      },
      type: "status",
      visible() {
        return advisories.trim() !== "";
      },
    },
    {
      id: "report-action",
      render() {
        return reportCta;
      },
      type: "action",
    },
    {
      id: "explore-toggle",
      render() {
        return exploreCta;
      },
      type: "action",
    },
  ];

  return renderPipeline(blocks, "result");
}

// ---------------------------------------------------------------------------
// Explore mode
// ---------------------------------------------------------------------------

function renderExploreMode(state: LabStoreState, copy: LabI18n) {
  const diff = getWorkspaceDiff(state);
  const changedKeys = diff?.changedKeys ?? [];
  const alternatives = getActiveExecutionAlternatives(state);

  const comparisonMarkup =
    changedKeys.length > 0
      ? `<section class="labx-drawer__section labx-drawer__comparison">
        <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.explore.comparisonTitle", "Değişiklikler"))}</h3>
        <ul>${changedKeys
          .map(function (k) {
            return `<li>${escapeHtml(k)}</li>`;
          })
          .join("")}</ul>
      </section>`
      : `<section class="labx-drawer__section"><p>${escapeHtml(copy.t("mediaAnalysis.drawer.explore.noDiff", "Parametrelerde değişiklik yok"))}</p></section>`;

  const run = state.run;
  const emptyReason = run?.emptyReason;
  const warningBanner = emptyReason
    ? `<div class="labx-drawer__banner labx-drawer__banner--warning">${escapeHtml(emptyReason)}</div>`
    : "";

  const runWarnings = run?.warnings ?? [];
  const warningsMarkup =
    runWarnings.length > 0
      ? `<div class="labx-drawer__banner labx-drawer__banner--info">
        <p>${escapeHtml(copy.t("mediaAnalysis.drawer.explore.partialWarn", "Analiz tamamlandı ancak bazı modüller uyarı verdi."))}</p>
        <ul>${runWarnings
          .map(function (w) {
            return `<li>${escapeHtml(w)}</li>`;
          })
          .join("")}</ul>
      </div>`
      : "";

  const alternativesMarkup =
    alternatives !== null && alternatives.alternatives.length > 0
      ? `<section class="labx-drawer__section labx-drawer__alternatives" data-lab-drawer-alternatives="true">
          <h3>${escapeHtml(copy.t("mediaAnalysis.drawer.explore.alternativesTitle", "Alternatifler"))}</h3>
          <p>${escapeHtml(alternatives.summary)}</p>
          <ul>
            ${alternatives.alternatives
              .map(function (alternative) {
                return `<li><strong>${escapeHtml(alternative.label)}</strong><span>${escapeHtml(alternative.tradeoff)}</span></li>`;
              })
              .join("")}
          </ul>
          ${alternatives.comparisonNote ? `<p>${escapeHtml(alternatives.comparisonNote)}</p>` : ""}
        </section>`
      : "";

  const reanalyzeCta = `
    <div class="labx-drawer__cta">
      <button class="labx-cta" type="button" data-lab-action="run-deep-analysis">
        ${escapeHtml(copy.t("mediaAnalysis.drawer.explore.reanalyze", "Tekrar Analiz Et"))}
      </button>
      <p class="labx-drawer__cta-sub">${escapeHtml(copy.t("mediaAnalysis.drawer.explore.reanalyzeSub", "Güncel parametrelerle yeni analiz başlat"))}</p>
    </div>
  `;

  const backToggle = `
    <button class="labx-drawer__explore-toggle" type="button" data-lab-action="drawer-explore-toggled">
      ${escapeHtml(copy.t("mediaAnalysis.drawer.explore.backToResult", "Sonuç Moduna Dön"))}
    </button>
  `;

  const blocks: LabPipelineBlock[] = [
    {
      id: "empty-warning",
      render() {
        return warningBanner;
      },
      type: "status",
      visible() {
        return warningBanner.trim() !== "";
      },
    },
    {
      id: "run-warnings",
      render() {
        return warningsMarkup;
      },
      type: "status",
      visible() {
        return warningsMarkup.trim() !== "";
      },
    },
    {
      id: "workspace-comparison",
      render() {
        return comparisonMarkup;
      },
      type: "section",
    },
    {
      id: "execution-alternatives",
      render() {
        return alternativesMarkup;
      },
      type: "output",
      visible() {
        return alternativesMarkup.trim() !== "";
      },
    },
    {
      id: "reanalyze-action",
      render() {
        return reanalyzeCta;
      },
      type: "action",
    },
    {
      id: "result-toggle",
      render() {
        return backToggle;
      },
      type: "action",
    },
  ];

  return renderPipeline(blocks, "explore");
}

// ---------------------------------------------------------------------------
// Skeleton (loading)
// ---------------------------------------------------------------------------

function renderDrawerSkeleton() {
  return `
    <div class="labx-drawer-skeleton">
      <div class="labx-skeleton-block" style="height: 2.5rem"></div>
      <div class="labx-skeleton-block" style="height: 8rem"></div>
      <div class="labx-skeleton-block" style="height: 3rem"></div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Public render
// ---------------------------------------------------------------------------

export function renderLabDrawer(
  state: LabStoreState,
  surface: LabWorkspaceSurface,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const collapsed = getDrawerCollapsed(state);
  const mode = resolveDrawerMode(state);

  if (collapsed) {
    return renderContextPanel({
      content: renderDrawerBody([], mode),
      drawerMode: mode,
      empty: true,
      hidden: true,
    });
  }

  if (!state.bootReady) {
    return renderContextPanel({
      content: `
        ${renderDrawerHeader(mode, copy)}
        ${renderDrawerBody(
          [
            {
              id: "drawer-skeleton",
              render: renderDrawerSkeleton,
              type: "status",
            },
          ],
          mode
        )}
      `,
      drawerMode: mode,
    });
  }

  let modeContent: string;
  switch (mode) {
    case "setup":
      modeContent = renderSetupMode(state, surface, copy);
      break;
    case "running":
      modeContent = renderRunningMode(state, copy);
      break;
    case "result":
      modeContent = renderResultMode(state, copy);
      break;
    case "explore":
      modeContent = renderExploreMode(state, copy);
      break;
    default:
      modeContent = "";
  }

  return renderContextPanel({
    content: `
      ${renderDrawerHeader(mode, copy)}
      <div class="labx-drawer__body">
        ${modeContent}
      </div>
    `,
    drawerMode: mode,
  });
}
