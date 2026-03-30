import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";
import { createLaboratorySettingsProfileModelRuntime } from "./settings-profile-model.js";
import { createLaboratorySettingsToolCardRuntime } from "./settings-tool-card.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratoryToolDescriptorRecord = LaboratoryRecord & {
  toolId?: unknown;
};

type LaboratoryProfileModelRecord = LaboratoryRecord & {
  modelId?: unknown;
};

type LaboratorySettingsUiDeps = {
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  formatBytes: (value: unknown) => string;
  formatCleanupPolicy: (value: unknown) => string;
  formatPlatformList: (value: unknown) => string;
  getProfileModelEntries: () => LaboratoryProfileModelRecord[];
  getProfileSelectedModel: () => LaboratoryProfileModelRecord | null;
  getStageToolIds: (stageId: string) => string[];
  getToolEntry: (toolId: string) => LaboratoryRecord;
  getToolRegistry: () => LaboratoryToolDescriptorRecord[];
  isAudioAnalysisFeature: () => boolean;
  renderAudioAnalysisProviderPanel: () => string;
  renderPreviewMetaRow: (label: string, value: unknown) => string;
  stageOrder: string[];
  state: LaboratoryUiState;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratorySettingsUi(deps: LaboratorySettingsUiDeps) {
  const {
    escapeHtml,
    featureText,
    formatBytes,
    formatCleanupPolicy,
    formatPlatformList,
    getProfileModelEntries,
    getProfileSelectedModel,
    getStageToolIds,
    getToolEntry,
    getToolRegistry,
    isAudioAnalysisFeature,
    renderAudioAnalysisProviderPanel,
    renderPreviewMetaRow,
    stageOrder,
    state,
    text,
    textFromKey,
    toRecord,
  } = deps;

  const laboratorySettingsToolCardRuntime = createLaboratorySettingsToolCardRuntime({
    escapeHtml,
    getToolEntry,
    getToolRegistry,
    renderPreviewMetaRow,
    text,
    toRecord,
  });
  const laboratorySettingsProfileModelRuntime = createLaboratorySettingsProfileModelRuntime({
    escapeHtml,
    formatBytes,
    formatCleanupPolicy,
    formatPlatformList,
    getToolEntry,
    renderPreviewMetaRow,
    text,
    textFromKey,
    toRecord,
  });

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function getAllToolIds(): string[] {
    return getToolRegistry()
      .map(function (entry) {
        const toolId = toString(entry.toolId).trim();
        return toolId !== "" ? toolId : null;
      })
      .filter((toolId): toolId is string => toolId !== null);
  }

  function renderToolCard(toolId: string, stageId: string) {
    return laboratorySettingsToolCardRuntime.renderToolCard(toolId, stageId);
  }

  function renderProfileModelCard(entry: LaboratoryProfileModelRecord) {
    return laboratorySettingsProfileModelRuntime.renderProfileModelCard(entry);
  }

  function renderSettingsOverlay() {
    if (state.ui.settingsOpen !== true) {
      return "";
    }

    const stageId = stageOrder.includes(state.activeStage) ? state.activeStage : "source";
    const currentStageToolIds = getStageToolIds(stageId);
    const otherToolIds = getAllToolIds().filter(function (toolId) {
      return currentStageToolIds.includes(toolId) === false;
    });
    const profileModelEntries = getProfileModelEntries();

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
            stageId === "profile" && profileModelEntries.length > 0
              ? `
                <section class="lab-panel">
                  <div class="lab-panel__header">
                    <div>
                      <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "modelTitle"]))}</p>
                      <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "modelSubtitle"]))}</h2>
                    </div>
                  </div>
                  <div class="lab-tool-grid">
                    ${profileModelEntries
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
    return toString(getProfileSelectedModel()?.modelId) || null;
  }

  return {
    getSelectedProfileModelId,
    renderToolCard,
    renderProfileModelCard,
    renderSettingsOverlay,
  };
}

export type LaboratorySettingsUiApi = ReturnType<typeof createLaboratorySettingsUi>;
