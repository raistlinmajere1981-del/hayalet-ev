import { createLaboratorySourceStageIntakeRuntime } from "./source-stage-intake.js";
import { createLaboratorySourceStageProjectRuntime } from "./source-stage-project.js";
export function createLaboratorySourceStageUi(deps) {
  const renderStageIntro = deps.renderStageIntro;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const renderPreviewSurface = deps.renderPreviewSurface;
  const renderSubtitleSourceIntakePanel = deps.renderSubtitleSourceIntakePanel;
  const renderSubtitleSourceWorkspacePanel = deps.renderSubtitleSourceWorkspacePanel;
  const getActiveProject = deps.getActiveProject;
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
  function renderSourceIntakePanel() {
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
  function getAvailableModuleIds() {
    const activeFeatureId = getActiveFeatureId();
    return Array.isArray(state.context.workbench.availableModuleIds) ? state.context.workbench.availableModuleIds.filter(function(entry) {
      return typeof entry === "string" && entry.trim() !== "";
    }) : [activeFeatureId];
  }
  function getFeatureLabel(featureId) {
    return text(["features", featureId]) || featureId;
  }
  function getFeatureSummary(featureId) {
    return text(["workbench", "modules", featureId, "summary"]);
  }
  function getRunOrderModuleIds(activeFeatureId, selectedModuleIds) {
    if (selectedModuleIds.length === 0) {
      return [activeFeatureId];
    }
    if (selectedModuleIds.includes(activeFeatureId) === false) {
      return selectedModuleIds;
    }
    return [
      activeFeatureId,
      ...selectedModuleIds.filter(function(featureId) {
        return featureId !== activeFeatureId;
      })
    ];
  }
  function renderRunScopeMetric(label, value) {
    return `
      <article class="lab-source-scope__metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `;
  }
  function renderRunScopePanel() {
    const activeFeatureId = getActiveFeatureId();
    const selectedModuleIds = getSelectedModuleIds();
    const availableModuleIds = getAvailableModuleIds();
    const runOrderModuleIds = getRunOrderModuleIds(activeFeatureId, selectedModuleIds);
    const runOrderSummary = runOrderModuleIds.length > 0 ? runOrderModuleIds.map(getFeatureLabel).join(" -> ") : text(["workbench", "sourceScope", "orderEmpty"]);
    const selectedCountLabel = `${String(selectedModuleIds.length)} ${text([
      "workbench",
      "sourceScope",
      "countSuffix"
    ])}`;
    const moduleMarkup = availableModuleIds.map(function(featureId) {
      const isActive = featureId === activeFeatureId;
      const isSelected = selectedModuleIds.includes(featureId);
      const runIndex = runOrderModuleIds.indexOf(featureId);
      const statusDetail = isActive ? text(["workbench", "sourceScope", "states", "active"]) : isSelected ? text(["workbench", "sourceScope", "states", "included"]) : text(["workbench", "sourceScope", "states", "excluded"]);
      const statusTags = [
        isActive ? `<span class="lab-source-scope__tag" data-tone="active">${escapeHtml(
          text(["workbench", "sourceScope", "statusTags", "active"])
        )}</span>` : "",
        `<span class="lab-source-scope__tag" data-tone="${isSelected ? "included" : "excluded"}">${escapeHtml(
          text([
            "workbench",
            "sourceScope",
            "statusTags",
            isSelected ? "included" : "excluded"
          ])
        )}</span>`,
        isSelected && runIndex >= 0 ? `<span class="lab-source-scope__tag" data-tone="order">${escapeHtml(
          `${text(["workbench", "sourceScope", "statusTags", "order"])} ${String(
            runIndex + 1
          )}`
        )}</span>` : ""
      ].filter(Boolean).join("");
      return `
          <article class="lab-source-scope__module" data-state="${escapeHtml(
        isActive ? "active" : isSelected ? "included" : "excluded"
      )}">
            <div class="lab-source-scope__module-head">
              <div class="lab-source-scope__module-copy">
                <strong>${escapeHtml(getFeatureLabel(featureId))}</strong>
                <p class="lab-panel__hint">${escapeHtml(getFeatureSummary(featureId))}</p>
              </div>
              <div class="lab-source-scope__module-tags">${statusTags}</div>
            </div>
            <p class="lab-source-scope__module-status">${escapeHtml(statusDetail)}</p>
            <div class="lab-source-scope__module-actions">
              <button
                class="lab-button ${isSelected ? "lab-button--ghost" : "lab-button--primary"} lab-button--tight"
                type="button"
                data-action="workbench-toggle-module"
                data-value="${escapeHtml(featureId)}"
              >
                ${escapeHtml(
        text([
          "workbench",
          "sourceScope",
          "actions",
          isSelected ? "exclude" : "include"
        ])
      )}
              </button>
              <button
                class="lab-button lab-button--ghost lab-button--tight"
                type="button"
                data-action="workbench-activate-module"
                data-value="${escapeHtml(featureId)}"
                ${isActive ? "disabled" : ""}
              >
                ${escapeHtml(
        text([
          "workbench",
          "sourceScope",
          "actions",
          isActive ? "active" : "activate"
        ])
      )}
              </button>
            </div>
          </article>
        `;
    }).join("");
    return `
      <section class="lab-panel lab-source-scope">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "sourceScope", "title"]))}</h2>
          </div>
        </div>
        <div class="lab-source-scope__metrics">
          ${renderRunScopeMetric(
      text(["workbench", "sourceScope", "metrics", "active"]),
      getFeatureLabel(activeFeatureId)
    )}
          ${renderRunScopeMetric(
      text(["workbench", "sourceScope", "metrics", "included"]),
      selectedCountLabel
    )}
          ${renderRunScopeMetric(
      text(["workbench", "sourceScope", "metrics", "order"]),
      runOrderSummary
    )}
        </div>
        <div class="lab-source-scope__modules">${moduleMarkup}</div>
      </section>
    `;
  }
  function renderSourceContextPanel() {
    const activeProject = getActiveProject();
    const activeFeatureId = getActiveFeatureId();
    const selectedModuleIds = getSelectedModuleIds();
    const activeProjectName = activeProject && typeof activeProject["name"] === "string" && activeProject["name"].trim() !== "" ? activeProject["name"].trim() : text(["mediaAnalysis", "projects", "empty"]);
    const selectedSummary = selectedModuleIds.length > 0 ? selectedModuleIds.map(getFeatureLabel).join(", ") : text(["workbench", "selectedModulesEmpty"]);
    const contextHint = activeProject && typeof activeProject["id"] === "string" && activeProject["id"].trim() !== "" ? "" : text(["workbench", "stageGuards", "noProject"]);
    return `
      <section class="lab-panel lab-panel--dense lab-module-panel lab-module-panel--context">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(
      text(["mediaAnalysis", "projects", "detailsTitle"])
    )}</h2>
          </div>
          <button
            class="lab-button lab-button--ghost lab-button--tight"
            type="button"
            data-action="open-settings"
          >
            ${escapeHtml(text(["workbench", "dependencyAction"]))}
          </button>
        </div>
        <div class="lab-summary-list">
          <div class="lab-summary-list__row">
            <span>${escapeHtml(text(["mediaAnalysis", "projects", "title"]))}</span>
            <strong>${escapeHtml(activeProjectName)}</strong>
          </div>
          <div class="lab-summary-list__row">
            <span>${escapeHtml(text(["workbench", "moduleTitle"]))}</span>
            <strong>${escapeHtml(getFeatureLabel(activeFeatureId))}</strong>
          </div>
          <div class="lab-summary-list__row">
            <span>${escapeHtml(text(["workbench", "selectedModulesTitle"]))}</span>
            <strong>${escapeHtml(selectedSummary)}</strong>
          </div>
        </div>
        ${contextHint.trim() !== "" ? `<p class="lab-panel__hint">${escapeHtml(contextHint)}</p>` : ""}
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
          ${renderSourceIntakePanel()}
        </section>
      `;
    }
    return `
      <section class="lab-intake-canvas__section">
        ${renderSourceKindPanelBody()}
        ${renderSourceIntakePanel()}
      </section>
    `;
  }
  function renderPrimaryIntakeCanvas() {
    const activeProject = getActiveProject();
    const activeProjectReady = activeProject && typeof activeProject["id"] === "string" && activeProject["id"].trim() !== "";
    return `
      <section class="lab-panel lab-panel--primary-canvas lab-intake-canvas">
        <div class="lab-intake-canvas__sections">
          <section class="lab-intake-canvas__section">
            <div class="lab-intake-canvas__label-row">
              <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "projects", "title"]))}</span>
            </div>
            ${renderProjectPanelBody()}
          </section>
          ${activeProjectReady ? `
                <section class="lab-intake-canvas__section">
                  ${renderRunScopePanel()}
                </section>
                <div class="lab-intake-canvas__group lab-intake-canvas__group--setup">
                  <div class="lab-intake-canvas__label-row">
                    <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "source", "intakeTitle"]))}</span>
                  </div>
                  ${renderActiveModuleSidebar()}
                </div>
              ` : `
                <div class="lab-notice">
                  ${escapeHtml(text(["workbench", "stageGuards", "noProject"]))}
                </div>
              `}
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
        ${renderSourceContextPanel()}
        ${isSubtitleAnalysisFeature() ? renderSubtitleSourceWorkspacePanel() : renderPreviewSurface()}
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
