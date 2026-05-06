import { escapeHtml } from "../models/lab-types.js";
import type {
  CapabilityFamilyId,
  LabDecisionIntent,
  LabDecisionState,
  LabDrawerMode,
  LabPipelineBlock,
  LabStoreState,
  LabWorkspaceSurface,
} from "../models/lab-types.js";
import {
  buildIntentPreviewSentence,
  getActiveExecutionIntent,
  getAnalysisActionBlockReason,
  getAnalysisPreparationGroups,
  getAvailableIntents,
  getDrawerCollapsed,
  getPreflightSeverity,
  getPreflightWarnings,
  getSelectedIntents,
  getSourceReady,
  resolveDrawerMode,
} from "../runtime/lab-selectors.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderContextPanel, renderPipeline } from "./laboratory-layout.js";
import { formatLabExpectedOutputLabel, translateLabRuntimeText } from "./lab-runtime-i18n.js";
import { renderLabSettingsFields } from "./lab-settings-controls.js";
import { renderModePills } from "./lab-top-bar.js";
import { buildLabDecisionSnapshot } from "./lab-decision-layer.js";
import { renderExploreMode, renderResultMode } from "./lab-drawer-result-explore.js";

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

const MODE_BADGE_TONE: Record<LabDrawerMode, string> = {
  setup: "",
  running: "running",
  result: "success",
  explore: "",
};

function renderDrawerHeader(mode: LabDrawerMode, copy: LabI18n) {
  const h = MODE_HEADERS[mode];
  const badgeTone = MODE_BADGE_TONE[mode];
  const badgeLabel = copy.t(h.eyebrowKey, h.eyebrowFallback);
  const badge =
    badgeTone !== ""
      ? `<span class="labx-drawer__status-badge" data-badge-tone="${escapeHtml(badgeTone)}">${escapeHtml(badgeLabel)}</span>`
      : `<span class="labx-drawer__status-badge">${escapeHtml(badgeLabel)}</span>`;
  return `
    <div class="labx-drawer__header">
      <h2>${escapeHtml(copy.t(h.titleKey, h.titleFallback))}</h2>
      ${badge}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Decision-driven header
// ---------------------------------------------------------------------------

const DECISION_HEADER_LABELS: Record<LabDecisionIntent, { title: string; subtitle: string }> = {
  idle: { title: "Beklemede", subtitle: "Kaynak yükleyin" },
  "preparing-analysis": { title: "Hazırlanıyor", subtitle: "Kaynak veya seçim bekleniyor" },
  "ready-to-run": { title: "Hazır", subtitle: "Analiz başlatılabilir" },
  "running-analysis": { title: "Analiz Ediliyor", subtitle: "Modüller çalışıyor" },
  "reviewing-results": { title: "Sonuçlar", subtitle: "Analiz tamamlandı" },
  "exploring-alternatives": { title: "Keşif", subtitle: "Alternatifler değerlendiriliyor" },
};

function renderDecisionHeader(
  intent: LabDecisionIntent,
  decisionState: LabDecisionState,
  copy: LabI18n
) {
  const labels = DECISION_HEADER_LABELS[intent];
  const title = copy.t(`mediaAnalysis.decisionHeader.${intent}.title`, labels.title);
  const subtitle = copy.t(`mediaAnalysis.decisionHeader.${intent}.subtitle`, labels.subtitle);
  return `
    <div class="labx-decision-header" data-decision-state="${escapeHtml(decisionState)}">
      <h2 class="labx-decision-header__title">${escapeHtml(title)}</h2>
      <p class="labx-decision-header__subtitle">${escapeHtml(subtitle)}</p>
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
                    data-lab-value="${escapeHtml(`${group.intentId}::${module.moduleId}`)}"
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
  const blocked = intent.readiness === "blocked";
  const selectionState = group?.selectionState ?? (intent.selected ? "full" : "none");
  const selected = selectionState !== "none";
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
      data-selection-state="${escapeHtml(selectionState)}"
      data-expanded="${String(expanded)}"
      data-readiness="${escapeHtml(readiness)}"
      data-active="${String(groupActive)}"
    >
      <div class="labx-drawer__intent-head">
        <label class="labx-drawer__intent-item" data-blocked="${String(blocked)}">
          <input
            type="checkbox"
            ${selected ? "checked" : ""}
            aria-checked="${selectionState === "partial" ? "mixed" : String(selected)}"
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

function renderSetupMode(state: LabStoreState, copy: LabI18n) {
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

  const decisionSnapshot = buildLabDecisionSnapshot({ mode, state });
  const decisionHeader = renderDecisionHeader(
    decisionSnapshot.intent,
    decisionSnapshot.state,
    copy
  );

  const modeNav = `<nav class="labx-drawer__mode-nav" aria-label="${escapeHtml(copy.t("mediaAnalysis.topBar.navLabel", "Mode indicators"))}">${renderModePills(state, copy)}</nav>`;

  if (!state.bootReady) {
    return renderContextPanel({
      content: `
        ${modeNav}
        ${decisionHeader}
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
      modeContent = renderSetupMode(state, copy);
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

  const selectionTabActive = state.ui.workspace.selectionTabActive === true;
  const selectionBody = selectionTabActive
    ? `<div class="labx-drawer__body labx-drawer__body--selection">${surface.side || `<p class="labx-drawer__selection-empty">${escapeHtml(copy.t("mediaAnalysis.timeline.noSelection", "Zaman çizelgesinde bir alan seçin"))}</p>`}</div>`
    : "";

  return renderContextPanel({
    content: `
      ${modeNav}
      ${selectionTabActive ? selectionBody : `${decisionHeader}${renderDrawerHeader(mode, copy)}<div class="labx-drawer__body">${modeContent}</div>`}
    `,
    drawerMode: mode,
  });
}
