import { createLaboratorySourceStageIntakeRuntime } from "./source-stage-intake.js";
import { createLaboratorySourceStageProjectRuntime } from "./source-stage-project.js";
export function createLaboratorySourceStageUi(deps) {
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
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function toToolStateRecord(value) {
    return toRecord(value);
  }
  function toToolDescriptorRecord(value) {
    return toRecord(value);
  }
  function toString(value) {
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
    return Array.isArray(state.context.workbench.selectedModuleIds) ? state.context.workbench.selectedModuleIds.filter(function(entry) {
      return typeof entry === "string" && entry.trim() !== "";
    }) : [activeFeatureId];
  }
  function getFeatureLabel(featureId) {
    return text(["features", featureId]) || featureId;
  }
  function getModuleSummary(featureId) {
    const localized = toString(
      toRecord(toRecord(state.translations)["workbench"])["modules"] ? toRecord(toRecord(toRecord(state.translations)["workbench"])["modules"])[featureId] : null
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
  function getWorkbenchOverview() {
    const selectedModuleIds = getSelectedModuleIds();
    const toolRegistry = Array.isArray(state.sourceSnapshot.toolRegistry) ? state.sourceSnapshot.toolRegistry.map(toToolDescriptorRecord) : [];
    const tools = toRecord(state.sourceSnapshot.toolState.tools);
    const installedCount = toolRegistry.filter(function(entry) {
      const toolId = toString(entry.toolId);
      if (!toolId) {
        return false;
      }
      const toolState = toToolStateRecord(tools[toolId]);
      return toolState.installed === true;
    }).length;
    const manualCount = toolRegistry.filter(function(entry) {
      return toString(entry.installStrategy) === "manual";
    }).length;
    const blockers = toolRegistry.filter(function(entry) {
      const toolId = toString(entry.toolId);
      if (!toolId) {
        return false;
      }
      const toolState = toToolStateRecord(tools[toolId]);
      return toolState.installed !== true && toString(entry.availability) !== "planned" && toString(entry.readinessImpact) !== null;
    });
    const modelState = toRecord(state.sourceSnapshot.profileModelState);
    const modelEntries = Object.values(toRecord(modelState["models"]));
    const readyModels = modelEntries.filter(function(entry) {
      return toToolStateRecord(entry).installed === true;
    }).length;
    return {
      blockers,
      installedCount,
      manualCount,
      modelEntries,
      readyModels,
      selectedModuleIds,
      toolRegistry
    };
  }
  function renderOrientationMetric(label, value) {
    return `
      <article class="lab-orientation__metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `;
  }
  function renderWorkbenchOrientationPanel() {
    const activeFeatureId = getActiveFeatureId();
    const activeProject = getProjectRecord();
    const overview = getWorkbenchOverview();
    const selectedModulesMarkup = overview.selectedModuleIds.length > 0 ? overview.selectedModuleIds.map(function(featureId) {
      return `<span class="lab-chip">${escapeHtml(getFeatureLabel(featureId))}</span>`;
    }).join("") : `<span class="lab-panel__hint">${escapeHtml(text(["workbench", "selectedModulesEmpty"]))}</span>`;
    const blockerMarkup = overview.blockers.length > 0 ? `
            <div class="lab-orientation__alert">
              <strong>${escapeHtml(text(["workbench", "blockerTitle"]))}</strong>
              <ul class="lab-bullet-list">
                ${overview.blockers.slice(0, 3).map(function(entry) {
      const toolId = toString(entry.toolId) || "";
      const label = text(["mediaAnalysis", "settings", "tools", toolId]) || toolId;
      const hint = toString(entry.readinessImpact) || "";
      return `<li>${escapeHtml(`${label}: ${hint}`)}</li>`;
    }).join("")}
              </ul>
            </div>
          ` : `
            <div class="lab-orientation__alert lab-orientation__alert--ready">
              <strong>${escapeHtml(text(["workbench", "dependencyFocus"]))}</strong>
              <p class="lab-panel__hint">${escapeHtml(text(["workbench", "readyHint"]))}</p>
            </div>
          `;
    return `
      <section class="lab-panel lab-panel--orientation">
        <div class="lab-orientation__header">
          <div class="lab-orientation__intro">
            ${renderStageIntro("source")}
          </div>
          <section class="lab-orientation__focus">
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "dependencyOverview"]))}</p>
            <strong>${escapeHtml(getFeatureLabel(activeFeatureId))}</strong>
            <p class="lab-panel__hint">${escapeHtml(
      toString(activeProject.name) || text(["mediaAnalysis", "projects", "empty"])
    )}</p>
            <span class="lab-orientation__focus-meta">${escapeHtml(
      toString(activeProject.updatedAt) || "--"
    )}</span>
            <button
              class="lab-button lab-button--ghost lab-button--tight"
              type="button"
              data-action="open-settings"
            >
              ${escapeHtml(text(["workbench", "dependencyAction"]))}
            </button>
          </section>
        </div>
        <div class="lab-orientation__body">
          <div class="lab-orientation__modules">
            <span class="lab-field__label">${escapeHtml(text(["workbench", "selectedModulesTitle"]))}</span>
            <div class="lab-chip-row lab-chip-row--tight">${selectedModulesMarkup}</div>
            <p class="lab-panel__hint">${escapeHtml(text(["workbench", "moduleSelectionHint"]))}</p>
          </div>
          <div class="lab-orientation__metrics">
            ${renderOrientationMetric(
      text(["workbench", "selectedModulesTitle"]),
      String(overview.selectedModuleIds.length)
    )}
            ${renderOrientationMetric(
      text(["workbench", "cards", "toolCoverage"]),
      `${overview.installedCount}/${overview.toolRegistry.length || 0}`
    )}
            ${renderOrientationMetric(
      text(["workbench", "cards", "models"]),
      `${overview.readyModels}/${overview.modelEntries.length || 0}`
    )}
            ${renderOrientationMetric(
      text(["workbench", "cards", "blockers"]),
      String(overview.blockers.length)
    )}
          </div>
        </div>
        ${blockerMarkup}
      </section>
    `;
  }
  function renderModuleSelectionPanel() {
    const activeFeatureId = getActiveFeatureId();
    const overview = getWorkbenchOverview();
    const selectedModuleIds = overview.selectedModuleIds;
    const availableModuleIds = Array.isArray(state.context.workbench.availableModuleIds) ? state.context.workbench.availableModuleIds : [activeFeatureId];
    const project = getProjectRecord();
    const audioAnalysis = toRecord(project.audioAnalysis);
    const subtitleAnalysis = toRecord(project.subtitleAnalysis);
    const sourceRecord = toRecord(project.source);
    return `
      <section class="lab-panel lab-panel--dense lab-module-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "moduleRailLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "moduleTitle"]))}</h2>
          </div>
        </div>
        <div class="lab-module-grid">
          ${availableModuleIds.map(function(featureId) {
      const isSelected = selectedModuleIds.includes(featureId);
      const isActive = featureId === activeFeatureId;
      const statusHint = featureId === "audio-analysis" ? `${Object.keys(toRecord(audioAnalysis["results"])).length} ${text([
        "workbench",
        "cards",
        "resultsSuffix"
      ])}` : featureId === "subtitle-analysis" ? `${Array.isArray(subtitleAnalysis["entries"]) ? subtitleAnalysis["entries"].length : 0} ${text(
        ["workbench", "cards", "entriesSuffix"]
      )}` : toString(sourceRecord["status"]) || text(["mediaAnalysis", "shared", "idle"]);
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
        isSelected ? text(["workbench", "excludeAction"]) : text(["workbench", "includeAction"])
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
        isActive ? text(["workbench", "activeTag"]) : text(["workbench", "focusAction"])
      )}
                    </button>
                  </div>
                </article>
              `;
    }).join("")}
        </div>
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
      <div class="lab-layout lab-layout--source-console">
        <section class="lab-main-stack lab-main-stack--source">
          ${renderWorkbenchOrientationPanel()}
          <div class="lab-source-workbench">
            <section class="lab-source-workbench__flow">
              ${renderProjectPanel()}
              ${renderActiveModuleSidebar()}
            </section>
            <aside class="lab-source-workbench__modules">
              ${renderModuleSelectionPanel()}
            </aside>
          </div>
        </section>
        <aside class="lab-side-stack lab-side-stack--source">
          ${renderActiveModulePanels()}
        </aside>
      </div>
    `;
  }
  return {
    renderSourceStage
  };
}
