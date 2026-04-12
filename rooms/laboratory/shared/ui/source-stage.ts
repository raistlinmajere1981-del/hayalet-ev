import { createLaboratorySourceStageIntakeRuntime } from "./source-stage-intake.js";
import { createLaboratorySourceStageProjectRuntime } from "./source-stage-project.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryToolStateRecord = LaboratoryRecord & {
  installed?: unknown;
};

type LaboratoryToolDescriptorRecord = LaboratoryRecord & {
  availability?: unknown;
  installStrategy?: unknown;
  readinessImpact?: unknown;
  stageSupport?: unknown;
  toolId?: unknown;
};

type LaboratoryProjectRecord = LaboratoryRecord & {
  audioAnalysis?: unknown;
  process?: unknown;
  report?: unknown;
  source?: unknown;
  subtitleAnalysis?: unknown;
};

type LaboratorySourceStageUiDeps = Parameters<typeof createLaboratorySourceStageIntakeRuntime>[0] &
  Parameters<typeof createLaboratorySourceStageProjectRuntime>[0] & {
    isAudioAnalysisFeature: () => boolean;
    isSubtitleAnalysisFeature: () => boolean;
    renderAudioAnalysisCatalogPanel: () => string;
    renderAudioAnalysisNoticePanel: () => string;
    renderAudioAnalysisProviderPanel: () => string;
    renderPreviewSurface: () => string;
    renderStageIntro: (stageId: string) => string;
    renderSubtitleCatalogPanel: () => string;
    renderSubtitleDiscoveryPanel: () => string;
    renderSubtitleEntryPanel: () => string;
    renderSubtitleProviderPanel: () => string;
    renderSubtitleSourceIntakePanel: () => string;
    renderSubtitleSourceWorkspacePanel: () => string;
  };

export function createLaboratorySourceStageUi(deps: LaboratorySourceStageUiDeps) {
  const renderStageIntro = deps.renderStageIntro;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const renderPreviewSurface = deps.renderPreviewSurface;
  const renderAudioAnalysisCatalogPanel = deps.renderAudioAnalysisCatalogPanel;
  const renderAudioAnalysisProviderPanel = deps.renderAudioAnalysisProviderPanel;
  const renderAudioAnalysisNoticePanel = deps.renderAudioAnalysisNoticePanel;
  const renderSubtitleSourceWorkspacePanel = deps.renderSubtitleSourceWorkspacePanel;
  const renderSubtitleDiscoveryPanel = deps.renderSubtitleDiscoveryPanel;
  const renderSubtitleCatalogPanel = deps.renderSubtitleCatalogPanel;
  const renderSubtitleProviderPanel = deps.renderSubtitleProviderPanel;
  const renderSubtitleSourceIntakePanel = deps.renderSubtitleSourceIntakePanel;
  const renderSubtitleEntryPanel = deps.renderSubtitleEntryPanel;
  const text = deps.text;
  const toRecord = deps.toRecord;
  const state = deps.state;
  const getActiveProject = deps.getActiveProject;
  const escapeHtml = deps.escapeHtml;
  const laboratorySourceStageProjectRuntime = createLaboratorySourceStageProjectRuntime(deps);
  const laboratorySourceStageIntakeRuntime = createLaboratorySourceStageIntakeRuntime(deps);

  function toProjectRecord(value: unknown): LaboratoryProjectRecord {
    return toRecord(value);
  }

  function toToolStateRecord(value: unknown): LaboratoryToolStateRecord {
    return toRecord(value);
  }

  function toToolDescriptorRecord(value: unknown): LaboratoryToolDescriptorRecord {
    return toRecord(value);
  }

  function toString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }

  function renderProjectPanel() {
    return laboratorySourceStageProjectRuntime.renderProjectPanel();
  }

  function renderSourceKindPanel() {
    return laboratorySourceStageProjectRuntime.renderSourceKindPanel();
  }

  function renderSourceIntakePanel() {
    return laboratorySourceStageIntakeRuntime.renderSourceIntakePanel();
  }

  function getActiveFeatureId() {
    return toString(state.context.featureId) || "media-analysis";
  }

  function getSelectedModuleIds() {
    const activeFeatureId = getActiveFeatureId();
    return Array.isArray(state.context.workbench.selectedModuleIds)
      ? state.context.workbench.selectedModuleIds.filter(function (entry): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [activeFeatureId];
  }

  function getFeatureLabel(featureId: string) {
    return text(["features", featureId]) || featureId;
  }

  function getModuleSummary(featureId: string) {
    const localized = toString(
      toRecord(toRecord(state.translations)["workbench"])["modules"]
        ? toRecord(toRecord(toRecord(state.translations)["workbench"])["modules"])[featureId]
        : null
    );
    if (localized) {
      return localized;
    }
    if (featureId === "audio-analysis") {
      return text(["workbench", "modules", featureId, "summary"]);
    }
    if (featureId === "subtitle-analysis") {
      return text(["workbench", "modules", featureId, "summary"]);
    }
    return text(["workbench", "modules", featureId, "summary"]);
  }

  function getProjectRecord() {
    return toProjectRecord(getActiveProject());
  }

  function renderModuleSelectionPanel() {
    const activeFeatureId = getActiveFeatureId();
    const selectedModuleIds = getSelectedModuleIds();
    const availableModuleIds = Array.isArray(state.context.workbench.availableModuleIds)
      ? state.context.workbench.availableModuleIds
      : [activeFeatureId];
    const project = getProjectRecord();
    const audioAnalysis = toRecord(project.audioAnalysis);
    const subtitleAnalysis = toRecord(project.subtitleAnalysis);
    const sourceRecord = toRecord(project.source);

    return `
      <section class="lab-panel lab-panel--dense">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "moduleRailLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "moduleTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(text(["workbench", "moduleSelectionHint"]))}</p>
          </div>
        </div>
        <div class="lab-chip-row">
          ${selectedModuleIds
            .map(function (featureId) {
              return `<span class="lab-chip">${escapeHtml(getFeatureLabel(featureId))}</span>`;
            })
            .join("")}
        </div>
        <div class="lab-module-grid">
          ${availableModuleIds
            .map(function (featureId) {
              const isSelected = selectedModuleIds.includes(featureId);
              const isActive = featureId === activeFeatureId;
              const statusHint =
                featureId === "audio-analysis"
                  ? `${Object.keys(toRecord(audioAnalysis["results"])).length} ${text([
                      "workbench",
                      "cards",
                      "resultsSuffix",
                    ])}`
                  : featureId === "subtitle-analysis"
                    ? `${Array.isArray(subtitleAnalysis["entries"]) ? subtitleAnalysis["entries"].length : 0} ${text(
                        ["workbench", "cards", "entriesSuffix"]
                      )}`
                    : toString(sourceRecord["status"]) || text(["mediaAnalysis", "shared", "idle"]);
              return `
                <article
                  class="lab-module-card"
                  data-active="${isActive ? "true" : "false"}"
                  data-selected="${isSelected ? "true" : "false"}"
                >
                  <span class="lab-module-card__title">${escapeHtml(getFeatureLabel(featureId))}</span>
                  <span class="lab-module-card__summary">${escapeHtml(getModuleSummary(featureId))}</span>
                  <span class="lab-module-card__meta">${escapeHtml(statusHint)}</span>
                  <div class="lab-module-card__actions">
                    <button
                      class="lab-button ${isSelected ? "lab-button--ghost" : "lab-button--primary"} lab-button--tight"
                      type="button"
                      data-action="workbench-toggle-module"
                      data-value="${featureId}"
                    >
                      ${escapeHtml(
                        isSelected
                          ? text(["workbench", "excludeAction"])
                          : text(["workbench", "includeAction"])
                      )}
                    </button>
                    <button
                      class="lab-button lab-button--ghost lab-button--tight"
                      type="button"
                      data-action="workbench-activate-module"
                      data-value="${featureId}"
                      ${isActive ? "disabled" : ""}
                    >
                      ${escapeHtml(
                        isActive
                          ? text(["workbench", "activeTag"])
                          : text(["workbench", "focusAction"])
                      )}
                    </button>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderWorkbenchSummaryPanel() {
    const selectedModuleIds = getSelectedModuleIds();
    const toolRegistry = Array.isArray(state.sourceSnapshot.toolRegistry)
      ? state.sourceSnapshot.toolRegistry.map(toToolDescriptorRecord)
      : [];
    const tools = toRecord(state.sourceSnapshot.toolState.tools);
    const installedCount = toolRegistry.filter(function (entry) {
      const toolId = toString(entry.toolId);
      if (!toolId) {
        return false;
      }
      const toolState = toToolStateRecord(tools[toolId]);
      return toolState.installed === true;
    }).length;
    const manualCount = toolRegistry.filter(function (entry) {
      return toString(entry.installStrategy) === "manual";
    }).length;
    const blockers = toolRegistry.filter(function (entry) {
      const toolId = toString(entry.toolId);
      if (!toolId) {
        return false;
      }
      const toolState = toToolStateRecord(tools[toolId]);
      return (
        toolState.installed !== true &&
        toString(entry.availability) !== "planned" &&
        toString(entry.readinessImpact) !== null
      );
    });
    const modelState = toRecord(state.sourceSnapshot.profileModelState);
    const modelEntries = Object.values(toRecord(modelState["models"]));
    const readyModels = modelEntries.filter(function (entry) {
      return toToolStateRecord(entry).installed === true;
    }).length;

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "readinessTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "readinessSubtitle"]))}</h2>
          </div>
        </div>
        <ul class="lab-summary-list">
          <li><span>${escapeHtml(text(["workbench", "selectedModulesTitle"]))}</span><strong>${selectedModuleIds.length}</strong></li>
          <li><span>${escapeHtml(text(["workbench", "cards", "toolCoverage"]))}</span><strong>${installedCount}/${toolRegistry.length || 0}</strong></li>
          <li><span>${escapeHtml(text(["workbench", "cards", "manualFlows"]))}</span><strong>${manualCount}</strong></li>
          <li><span>${escapeHtml(text(["workbench", "cards", "models"]))}</span><strong>${readyModels}/${modelEntries.length || 0}</strong></li>
          <li><span>${escapeHtml(text(["workbench", "cards", "blockers"]))}</span><strong>${blockers.length}</strong></li>
        </ul>
        <p class="lab-panel__hint">${escapeHtml(
          selectedModuleIds.length > 0
            ? `${text(["workbench", "selectedModulesTitle"])}: ${selectedModuleIds
                .map(getFeatureLabel)
                .join(", ")}`
            : text(["workbench", "selectedModulesEmpty"])
        )}</p>
        ${
          blockers.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(text(["workbench", "blockerTitle"]))}</strong>
                <ul class="lab-bullet-list">
                  ${blockers
                    .slice(0, 3)
                    .map(function (entry) {
                      const toolId = toString(entry.toolId) || "";
                      const label = text(["mediaAnalysis", "settings", "tools", toolId]) || toolId;
                      const hint = toString(entry.readinessImpact) || "";
                      return `<li>${escapeHtml(`${label}: ${hint}`)}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : `<p class="lab-panel__hint">${escapeHtml(text(["workbench", "readyHint"]))}</p>`
        }
      </section>
    `;
  }

  function renderActiveModulePanels() {
    if (isSubtitleAnalysisFeature()) {
      return `
        ${renderSubtitleSourceWorkspacePanel()}
        ${renderSubtitleDiscoveryPanel()}
        ${renderSubtitleCatalogPanel()}
      `;
    }

    if (isAudioAnalysisFeature()) {
      return `
        ${renderAudioAnalysisCatalogPanel()}
        ${renderAudioAnalysisProviderPanel()}
      `;
    }

    return renderPreviewSurface();
  }

  function renderActiveModuleSidebar() {
    if (isSubtitleAnalysisFeature()) {
      return `
        ${renderSubtitleSourceIntakePanel()}
        ${renderSubtitleEntryPanel()}
        ${renderSubtitleProviderPanel()}
      `;
    }

    if (isAudioAnalysisFeature()) {
      return `
        ${renderSourceKindPanel()}
        ${renderSourceIntakePanel()}
        ${renderAudioAnalysisNoticePanel()}
      `;
    }

    return `
      ${renderSourceKindPanel()}
      ${renderSourceIntakePanel()}
    `;
  }

  function renderSourceStage() {
    return `
      <div class="lab-layout lab-layout--workbench">
        <section class="lab-main-stack">
          ${renderStageIntro("source")}
          ${renderProjectPanel()}
          ${renderModuleSelectionPanel()}
          ${renderActiveModuleSidebar()}
          ${renderWorkbenchSummaryPanel()}
        </section>
        <aside class="lab-side-stack">
          ${renderActiveModulePanels()}
        </aside>
      </div>
    `;
  }

  return {
    renderSourceStage: renderSourceStage,
  };
}
