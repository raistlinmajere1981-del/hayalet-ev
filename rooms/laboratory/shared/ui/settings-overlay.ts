import { createLaboratorySettingsProfileModelRuntime } from "./settings-profile-model.js";
import { createLaboratorySettingsToolCardRuntime } from "./settings-tool-card.js";

export function createLaboratorySettingsUi(deps) {
  const stageOrder = Array.isArray(deps.stageOrder) ? deps.stageOrder : [];
  const state = deps.state;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const featureText = deps.featureText;
  const getToolRegistry = deps.getToolRegistry;
  const getStageToolIds = deps.getStageToolIds;
  const getProfileModelEntries = deps.getProfileModelEntries;
  const getProfileSelectedModel = deps.getProfileSelectedModel;
  const renderAudioAnalysisProviderPanel = deps.renderAudioAnalysisProviderPanel;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const laboratorySettingsToolCardRuntime = createLaboratorySettingsToolCardRuntime(deps);
  const laboratorySettingsProfileModelRuntime = createLaboratorySettingsProfileModelRuntime(deps);

  function renderToolCard(toolId, stageId) {
    return laboratorySettingsToolCardRuntime.renderToolCard(toolId, stageId);
  }

  function renderProfileModelCard(entry) {
    return laboratorySettingsProfileModelRuntime.renderProfileModelCard(entry);
  }

  function renderSettingsOverlay() {
    if (state.ui.settingsOpen !== true) {
      return "";
    }

    const stageId = stageOrder.includes(state.activeStage) ? state.activeStage : "source";
    const allToolIds = getToolRegistry().map(function (entry) {
      return entry.toolId;
    });
    const currentStageToolIds = getStageToolIds(stageId);
    const otherToolIds = allToolIds.filter(function (toolId) {
      return currentStageToolIds.includes(toolId) === false;
    });

    return `
      <div class="lab-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(
        featureText(["settings", "title"])
      )}">
        <div class="lab-overlay__scrim" data-action="close-settings"></div>
        <section class="lab-overlay__panel">
          <header class="lab-overlay__header">
            <div>
              <p class="lab-panel__eyebrow">${escapeHtml(featureText(["settings", "eyebrow"]))}</p>
              <h2 class="lab-panel__title">${escapeHtml(featureText(["settings", "title"]))}</h2>
              <p class="lab-panel__subtitle">${escapeHtml(
                `${featureText(["settings", "subtitle"])} ${featureText(["stages", stageId])}`
              )}</p>
            </div>
            <div class="lab-overlay__actions">
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="tools-refresh">
                ${escapeHtml(text(["mediaAnalysis", "settings", "refreshAction"]))}
              </button>
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="close-settings">
                ${escapeHtml(text(["mediaAnalysis", "settings", "closeAction"]))}
              </button>
            </div>
          </header>
          <section class="lab-panel">
            <div class="lab-panel__header">
              <div>
                <p class="lab-panel__eyebrow">${escapeHtml(featureText(["settings", "currentStageTitle"]))}</p>
                <h2 class="lab-panel__title">${escapeHtml(featureText(["stages", stageId]))}</h2>
              </div>
            </div>
            <div class="lab-tool-grid">
              ${
                currentStageToolIds.length > 0
                  ? currentStageToolIds
                      .map(function (toolId) {
                        return renderToolCard(toolId, stageId);
                      })
                      .join("")
                  : `<p class="lab-panel__hint">${escapeHtml(
                      text(["mediaAnalysis", "settings", "noStageTools"])
                    )}</p>`
              }
            </div>
          </section>
          ${
            otherToolIds.length > 0
              ? `
                <section class="lab-panel">
                  <div class="lab-panel__header">
                    <div>
                      <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "settings", "otherToolsTitle"]))}</p>
                      <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "settings", "otherToolsSubtitle"]))}</h2>
                    </div>
                  </div>
                  <div class="lab-tool-grid">
                    ${otherToolIds
                      .map(function (toolId) {
                        return renderToolCard(toolId, stageId);
                      })
                      .join("")}
                  </div>
                </section>
              `
              : ""
          }
          ${isAudioAnalysisFeature() ? renderAudioAnalysisProviderPanel() : ""}
          ${
            stageId === "profile" && getProfileModelEntries().length > 0
              ? `
                <section class="lab-panel">
                  <div class="lab-panel__header">
                    <div>
                      <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "modelTitle"]))}</p>
                      <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "modelSubtitle"]))}</h2>
                    </div>
                  </div>
                  <div class="lab-tool-grid">
                    ${getProfileModelEntries()
                      .map(function (entry) {
                        return renderProfileModelCard(entry);
                      })
                      .join("")}
                  </div>
                </section>
              `
              : ""
          }
        </section>
      </div>
    `;
  }

  function getSelectedProfileModelId() {
    const selectedModel = getProfileSelectedModel();
    return selectedModel && typeof selectedModel.modelId === "string" ? selectedModel.modelId : null;
  }

  return {
    getSelectedProfileModelId: getSelectedProfileModelId,
    renderToolCard: renderToolCard,
    renderProfileModelCard: renderProfileModelCard,
    renderSettingsOverlay: renderSettingsOverlay,
  };
}
