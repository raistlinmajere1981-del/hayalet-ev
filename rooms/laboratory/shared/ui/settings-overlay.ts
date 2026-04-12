import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";
import { createLaboratorySettingsProfileModelRuntime } from "./settings-profile-model.js";
import { createLaboratorySettingsToolCardRuntime } from "./settings-tool-card.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratoryToolDescriptorRecord = LaboratoryRecord & {
  availability?: unknown;
  installStrategy?: unknown;
  toolId?: unknown;
};

type LaboratoryProfileModelRecord = LaboratoryRecord & {
  busy?: unknown;
  modelId?: unknown;
  ready?: unknown;
};

type LaboratoryJobRecord = LaboratoryRecord & {
  action?: unknown;
  featureStage?: unknown;
  message?: unknown;
  percent?: unknown;
  requestId?: unknown;
  stage?: unknown;
  toolId?: unknown;
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
    getToolRegistry,
    renderPreviewMetaRow,
    text,
    textFromKey,
    toRecord,
  });

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function toJobRecord(value: unknown): LaboratoryJobRecord {
    return toRecord(value);
  }

  function getAllToolIds(): string[] {
    return getToolRegistry()
      .map(function (entry) {
        const toolId = toString(entry.toolId).trim();
        return toolId !== "" ? toolId : null;
      })
      .filter((toolId): toolId is string => toolId !== null);
  }

  function getRunningJobs(): LaboratoryJobRecord[] {
    return (Array.isArray(state.sourceSnapshot.jobs) ? state.sourceSnapshot.jobs : [])
      .map(toJobRecord)
      .filter(function (job) {
        return !["completed", "failed", "cancelled"].includes(toString(job.stage));
      });
  }

  function getJobPercent(job: LaboratoryJobRecord): number {
    if (typeof job.percent !== "number" || Number.isFinite(job.percent) !== true) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(job.percent)));
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
    const toolIds = getAllToolIds();
    const toolDescriptors = getToolRegistry();
    const currentStageToolIds = getStageToolIds(stageId);
    const autoManagedCount = toolDescriptors.filter(function (entry) {
      return toString(entry.installStrategy) === "automatic";
    }).length;
    const manualCount = toolDescriptors.filter(function (entry) {
      return toString(entry.installStrategy) === "manual";
    }).length;
    const runningJobs = getRunningJobs();
    const profileModelEntries = getProfileModelEntries();
    const readyModels = profileModelEntries.filter(function (entry) {
      return entry.ready === true;
    }).length;
    const closeActionLabel = text(["mediaAnalysis", "settings", "closeAction"]);

    return `
      <section
        class="lab-overlay lab-overlay--center"
        data-animate="${state.ui.settingsAnimateIn === true ? "enter" : "idle"}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-dependency-center-title"
      >
        <button
          class="lab-overlay__scrim"
          type="button"
          data-action="close-settings"
          aria-label="${escapeHtml(closeActionLabel)}"
        ></button>
        <section class="lab-overlay__panel lab-center-panel__scroll">
          <header class="lab-overlay__header">
            <div>
              <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "dependencyEyebrow"]))}</p>
              <h2 class="lab-panel__title" id="lab-dependency-center-title">${escapeHtml(
                text(["workbench", "dependencyTitle"])
              )}</h2>
              <p class="lab-panel__subtitle">${escapeHtml(text(["workbench", "dependencySubtitle"]))}</p>
            </div>
            <div class="lab-overlay__actions">
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="tools-refresh">
                ${escapeHtml(text(["mediaAnalysis", "settings", "refreshAction"]))}
              </button>
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="close-settings">
                ${escapeHtml(closeActionLabel)}
              </button>
            </div>
          </header>
          <div class="lab-center-grid">
            <section class="lab-panel">
              <div class="lab-panel__header">
                <div>
                  <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "readinessTitle"]))}</p>
                  <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "dependencyOverview"]))}</h2>
                </div>
              </div>
              <div class="lab-summary-cards">
                <article class="lab-signal-card">
                  <strong>${autoManagedCount}</strong>
                  <span>${escapeHtml(text(["workbench", "cards", "autoManaged"]))}</span>
                </article>
                <article class="lab-signal-card">
                  <strong>${manualCount}</strong>
                  <span>${escapeHtml(text(["workbench", "cards", "manualFlows"]))}</span>
                </article>
                <article class="lab-signal-card">
                  <strong>${runningJobs.length}</strong>
                  <span>${escapeHtml(text(["workbench", "cards", "operations"]))}</span>
                </article>
                <article class="lab-signal-card">
                  <strong>${readyModels}/${profileModelEntries.length || 0}</strong>
                  <span>${escapeHtml(text(["workbench", "cards", "models"]))}</span>
                </article>
              </div>
              <p class="lab-panel__hint">${escapeHtml(
                `${text(["workbench", "dependencyFocus"])} ${featureText(["stages", stageId])}`
              )}</p>
              ${
                currentStageToolIds.length > 0
                  ? `
                    <div class="lab-chip-row">
                      ${currentStageToolIds
                        .map(function (toolId) {
                          const label =
                            text(["mediaAnalysis", "settings", "tools", toolId]) || toolId;
                          return `<span class="lab-chip">${escapeHtml(label)}</span>`;
                        })
                        .join("")}
                    </div>
                  `
                  : ""
              }
            </section>
            <section class="lab-panel">
              <div class="lab-panel__header">
                <div>
                  <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "cards", "operations"]))}</p>
                  <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "operationsTitle"]))}</h2>
                </div>
              </div>
              ${
                runningJobs.length > 0
                  ? `
                    <div class="lab-ops-feed">
                      ${runningJobs
                        .slice(0, 6)
                        .map(function (job) {
                          const toolId = toString(job.toolId);
                          const label = toolId
                            ? text(["mediaAnalysis", "settings", "tools", toolId]) || toolId
                            : text(["workbench", "operationsFallback"]);
                          const percent = getJobPercent(job);
                          const stageLabel = toString(job.stage, "--");
                          const actionLabel = toString(job.action, "");
                          const featureStageLabel = toString(job.featureStage, "");
                          return `
                            <article class="lab-op-row">
                              <strong>${escapeHtml(label)}</strong>
                              <span>${escapeHtml(
                                `${stageLabel}${percent > 0 ? ` · ${String(percent)}%` : ""}`
                              )}</span>
                              <p>${escapeHtml(
                                [featureStageLabel, actionLabel]
                                  .filter(function (entry) {
                                    return entry.trim() !== "";
                                  })
                                  .join(" · ")
                              )}</p>
                              <p>${escapeHtml(toString(job.message, ""))}</p>
                              <div class="lab-progress-bar lab-progress-bar--wide" aria-hidden="true">
                                <span style="width:${Math.max(4, percent || 4)}%"></span>
                              </div>
                            </article>
                          `;
                        })
                        .join("")}
                    </div>
                  `
                  : `<p class="lab-panel__hint">${escapeHtml(text(["workbench", "operationsEmpty"]))}</p>`
              }
            </section>
          </div>
          <section class="lab-panel">
            <div class="lab-panel__header">
              <div>
                <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "dependencyTitle"]))}</p>
                <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "toolGridTitle"]))}</h2>
              </div>
            </div>
            <div class="lab-tool-grid">
              ${toolIds
                .map(function (toolId) {
                  return renderToolCard(toolId, stageId);
                })
                .join("")}
            </div>
          </section>
          ${
            profileModelEntries.length > 0
              ? `
                <section class="lab-panel">
                  <div class="lab-panel__header">
                    <div>
                      <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "modelTitle"]))}</p>
                      <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "modelGridTitle"]))}</h2>
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
          ${isAudioAnalysisFeature() ? renderAudioAnalysisProviderPanel() : ""}
        </section>
      </section>
    `;
  }

  function getSelectedProfileModelId() {
    return toString(getProfileSelectedModel()?.modelId) || null;
  }

  return {
    getSelectedProfileModelId,
    renderProfileModelCard,
    renderSettingsOverlay,
    renderToolCard,
  };
}

export type LaboratorySettingsUiApi = ReturnType<typeof createLaboratorySettingsUi>;
