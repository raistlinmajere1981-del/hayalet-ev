import { createLaboratorySourceStageIntakeRuntime } from "./source-stage-intake.js";
import { createLaboratorySourceStageProjectRuntime } from "./source-stage-project.js";

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
  const renderSubtitleSourceIntakePanel = deps.renderSubtitleSourceIntakePanel;
  const getActiveProject = deps.getActiveProject;
  const text = deps.text;
  const state = deps.state;
  const escapeHtml = deps.escapeHtml;
  const laboratorySourceStageProjectRuntime = createLaboratorySourceStageProjectRuntime(deps);
  const laboratorySourceStageIntakeRuntime = createLaboratorySourceStageIntakeRuntime(deps);

  function toString(value: unknown): string | null {
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
    return Array.isArray(state.context.workbench.selectedModuleIds)
      ? state.context.workbench.selectedModuleIds.filter(function (entry): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [activeFeatureId];
  }

  function getFeatureLabel(featureId: string) {
    return text(["features", featureId]) || featureId;
  }

  function getWorkbenchOverview() {
    return {
      selectedModuleIds: getSelectedModuleIds(),
    };
  }

  function renderSourceContextPanel() {
    const activeProject = getActiveProject();
    const activeFeatureId = getActiveFeatureId();
    const overview = getWorkbenchOverview();
    const selectedModuleIds = overview.selectedModuleIds;
    const activeProjectName =
      activeProject && typeof activeProject["name"] === "string" && activeProject["name"].trim() !== ""
        ? activeProject["name"].trim()
        : text(["mediaAnalysis", "projects", "empty"]);
    const selectedSummary =
      selectedModuleIds.length > 0
        ? selectedModuleIds.map(getFeatureLabel).join(", ")
        : text(["workbench", "selectedModulesEmpty"]);
    const contextHint =
      activeProject && typeof activeProject["id"] === "string" && activeProject["id"].trim() !== ""
        ? text(["workbench", "readyHint"])
        : text(["workbench", "stageGuards", "noProject"]);

    return `
      <section class="lab-panel lab-panel--dense lab-module-panel lab-module-panel--context">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "projects", "eyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "shared", "summary"]))}</h2>
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
        <p class="lab-panel__hint">${escapeHtml(contextHint)}</p>
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
    const activeProjectReady =
      activeProject && typeof activeProject["id"] === "string" && activeProject["id"].trim() !== "";

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
          ${
            activeProjectReady
              ? `
                <div class="lab-intake-canvas__group lab-intake-canvas__group--setup">
                  <div class="lab-intake-canvas__label-row">
                    <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "source", "intakeTitle"]))}</span>
                  </div>
                  ${renderActiveModuleSidebar()}
                </div>
              `
              : `
                <div class="lab-notice">
                  ${escapeHtml(text(["workbench", "stageGuards", "noProject"]))}
                </div>
              `
          }
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
      </div>
    `;
  }

  function renderSourceStage() {
    return {
      inspector: renderSourceInspector(),
      inspectorClassName: "lab-workspace__inspector--source",
      main: renderSourceMain(),
      mainClassName: "lab-workspace__main--source",
    };
  }

  return {
    renderSourceInspector,
    renderSourceMain,
    renderSourceStage: renderSourceStage,
  };
}
