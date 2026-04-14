import { createLaboratorySourceStageIntakeRuntime } from "./source-stage-intake.js";
import { createLaboratorySourceStageProjectRuntime } from "./source-stage-project.js";
export function createLaboratorySourceStageUi(deps) {
  const renderStageIntro = deps.renderStageIntro;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const renderSubtitleSourceIntakePanel = deps.renderSubtitleSourceIntakePanel;
  const text = deps.text;
  const state = deps.state;
  const escapeHtml = deps.escapeHtml;
  const laboratorySourceStageProjectRuntime = createLaboratorySourceStageProjectRuntime(deps);
  const laboratorySourceStageIntakeRuntime = createLaboratorySourceStageIntakeRuntime(deps);
  function toString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }
  function renderProjectPanelBody() {
    return laboratorySourceStageProjectRuntime.renderProjectPanelBody();
  }
  function renderSourceKindPanelBody() {
    return laboratorySourceStageProjectRuntime.renderSourceKindPanelBody();
  }
  function renderSourceIntakePanelBody() {
    return laboratorySourceStageIntakeRuntime.renderSourceIntakePanelBody();
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
  function getWorkbenchOverview() {
    return {
      selectedModuleIds: getSelectedModuleIds()
    };
  }
  function renderModuleSelectionPanel() {
    const activeFeatureId = getActiveFeatureId();
    const overview = getWorkbenchOverview();
    const selectedModuleIds = overview.selectedModuleIds;
    const availableModuleIds = Array.isArray(state.context.workbench.availableModuleIds) ? state.context.workbench.availableModuleIds : [activeFeatureId];
    return `
      <section class="lab-panel lab-panel--dense lab-module-panel lab-module-panel--context">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "moduleRailLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "moduleTitle"]))}</h2>
          </div>
          <button
            class="lab-button lab-button--ghost lab-button--tight"
            type="button"
            data-action="open-settings"
          >
            ${escapeHtml(text(["workbench", "dependencyAction"]))}
          </button>
        </div>
        <div class="lab-module-rail">
          ${availableModuleIds.map(function(featureId) {
      const isSelected = selectedModuleIds.includes(featureId);
      const isActive = featureId === activeFeatureId;
      return `
                <article
                  class="lab-module-pill"
                  data-active="${isActive ? "true" : "false"}"
                  data-selected="${isSelected ? "true" : "false"}"
                >
                  <div class="lab-module-pill__row">
                    <span class="lab-module-pill__title">${escapeHtml(getFeatureLabel(featureId))}</span>
                    ${isActive ? `<span class="lab-module-pill__flag">${escapeHtml(text(["workbench", "activeTag"]))}</span>` : ""}
                  </div>
                  <div class="lab-module-pill__actions">
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
  function renderActiveModuleSidebar() {
    if (isSubtitleAnalysisFeature()) {
      return renderSubtitleSourceIntakePanel();
    }
    if (isAudioAnalysisFeature()) {
      return `
        <section class="lab-intake-canvas__section">
          ${renderSourceKindPanelBody()}
          ${renderSourceIntakePanelBody()}
        </section>
      `;
    }
    return `
      <section class="lab-intake-canvas__section">
        ${renderSourceKindPanelBody()}
        ${renderSourceIntakePanelBody()}
      </section>
    `;
  }
  function renderPrimaryIntakeCanvas() {
    return `
      <section class="lab-panel lab-panel--primary-canvas lab-intake-canvas">
        <div class="lab-intake-canvas__sections">
          <section class="lab-intake-canvas__section">
            <div class="lab-intake-canvas__label-row">
              <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "projects", "title"]))}</span>
              <button
                class="lab-button lab-button--ghost lab-button--tight"
                type="button"
                data-action="project-create"
              >
                ${escapeHtml(text(["mediaAnalysis", "projects", "newAction"]))}
              </button>
            </div>
            ${renderProjectPanelBody()}
          </section>
          <div class="lab-intake-canvas__group lab-intake-canvas__group--setup">
            <div class="lab-intake-canvas__label-row">
              <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "source", "intakeTitle"]))}</span>
            </div>
            ${renderActiveModuleSidebar()}
          </div>
        </div>
      </section>
    `;
  }
  function renderSourceMain() {
    return `
      <div class="lab-stage-stack lab-stage-stack--source">
        ${renderStageIntro("source")}
        ${renderPrimaryIntakeCanvas()}
      </div>
    `;
  }
  function renderSourceInspector() {
    return `
      <div class="lab-stage-stack lab-stage-stack--inspector">
        ${renderModuleSelectionPanel()}
      </div>
    `;
  }
  function renderSourceStage() {
    return {
      inspector: renderSourceInspector(),
      inspectorClassName: "lab-workspace__inspector--source",
      main: renderSourceMain(),
      mainClassName: "lab-workspace__main--source"
    };
  }
  return {
    renderSourceInspector,
    renderSourceMain,
    renderSourceStage
  };
}
