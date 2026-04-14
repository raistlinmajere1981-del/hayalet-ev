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
  bytesReceived?: unknown;
  bytesTotal?: unknown;
  featureStage?: unknown;
  jobId?: unknown;
  message?: unknown;
  operation?: unknown;
  percent?: unknown;
  projectId?: unknown;
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
  getWorkbench: () => LaboratoryRecord;
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
    getWorkbench,
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
    state,
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

  function toNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function toJobRecord(value: unknown): LaboratoryJobRecord {
    return toRecord(value);
  }

  function readText(path: string[], fallback = ""): string {
    const resolved = text(path);
    const leaf = path[path.length - 1] || "";
    return resolved === leaf ? fallback || resolved : resolved;
  }

  function prettifyToken(value: string): string {
    return value
      .split(/[-_]/)
      .filter(function (entry) {
        return entry.trim() !== "";
      })
      .map(function (entry) {
        return entry.charAt(0).toUpperCase() + entry.slice(1);
      })
      .join(" ");
  }

  function formatJobActionLabel(action: string): string {
    return readText(["workbench", "operationsMeta", "actions", action], prettifyToken(action));
  }

  function formatJobOperationLabel(operation: string): string {
    return readText(
      ["workbench", "operationsMeta", "operations", operation],
      prettifyToken(operation)
    );
  }

  function formatJobStageLabel(stage: string): string {
    return readText(["workbench", "operationsMeta", "stages", stage], prettifyToken(stage));
  }

  function getJobPrimaryLabel(job: LaboratoryJobRecord): string {
    const toolId = toString(job.toolId).trim();
    if (toolId !== "") {
      return text(["mediaAnalysis", "settings", "tools", toolId]) || toolId;
    }

    const actionId = toString(job.action).trim();
    if (actionId !== "") {
      return formatJobActionLabel(actionId);
    }

    return text(["workbench", "operationsFallback"]);
  }

  function getJobTransferLabel(job: LaboratoryJobRecord): string {
    const bytesReceived = toNumber(job.bytesReceived);
    const bytesTotal = toNumber(job.bytesTotal);
    if (bytesReceived === null && bytesTotal === null) {
      return "";
    }
    if (bytesReceived !== null && bytesTotal !== null && bytesTotal > 0) {
      return `${formatBytes(bytesReceived)} / ${formatBytes(bytesTotal)}`;
    }
    if (bytesTotal !== null) {
      return formatBytes(bytesTotal);
    }
    return formatBytes(bytesReceived);
  }

  function getJobFeatureStageLabel(job: LaboratoryJobRecord): string {
    const featureStageId = toString(job.featureStage).trim();
    if (featureStageId === "") {
      return "";
    }
    return featureText(["stages", featureStageId]) || featureStageId;
  }

  function isJobInlineCancelable(job: LaboratoryJobRecord): boolean {
    const jobId = toString(job.jobId).trim();
    const actionId = toString(job.action).trim();
    if (jobId === "" || actionId === "") {
      return false;
    }

    return (
      actionId.startsWith("tool-") ||
      actionId === "profile-model-install" ||
      actionId.startsWith("source-") ||
      actionId.startsWith("subtitle-source-")
    );
  }

  function getAllToolIds(): string[] {
    return getToolRegistry()
      .map(function (entry) {
        const toolId = toString(entry.toolId).trim();
        return toolId !== "" ? toolId : null;
      })
      .filter((toolId): toolId is string => toolId !== null);
  }

  function getToolInstallStrategy(toolId: string) {
    const descriptor =
      getToolRegistry().find(function (entry) {
        return toString(entry.toolId).trim() === toolId;
      }) || null;
    return toString(descriptor?.installStrategy).trim();
  }

  function getWorkbenchRecord() {
    return toRecord(getWorkbench());
  }

  function getSelectedModuleIds() {
    return Array.isArray(getWorkbenchRecord()["selectedModuleIds"])
      ? (getWorkbenchRecord()["selectedModuleIds"] as unknown[]).filter(function (
          entry
        ): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [];
  }

  function getAvailableModuleIds() {
    return Array.isArray(getWorkbenchRecord()["availableModuleIds"])
      ? (getWorkbenchRecord()["availableModuleIds"] as unknown[]).filter(function (
          entry
        ): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [];
  }

  function getActiveModuleId() {
    const activeModuleId = toString(getWorkbenchRecord()["activeModuleId"]).trim();
    return activeModuleId !== "" ? activeModuleId : "media-analysis";
  }

  function getModuleLabel(featureId: string) {
    return text(["features", featureId]) || featureId;
  }

  function renderModuleControlSection() {
    const activeModuleId = getActiveModuleId();
    const selectedModuleIds = getSelectedModuleIds();
    const availableModuleIds = getAvailableModuleIds();
    if (availableModuleIds.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel lab-center-sidebar__panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "moduleRailLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "selectedModulesTitle"]))}</h2>
          </div>
        </div>
        <div class="lab-tool-grid lab-tool-grid--stacked">
          ${availableModuleIds
            .map(function (featureId) {
              const isSelected = selectedModuleIds.includes(featureId);
              const isActive = featureId === activeModuleId;
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getModuleLabel(featureId))}</strong>
                      <span>${escapeHtml(isActive ? text(["workbench", "activeTag"]) : text(["workbench", "moduleTitle"]))}</span>
                    </div>
                  </div>
                  <div class="lab-action-stack lab-action-stack--inline">
                    <button
                      class="lab-button ${isSelected ? "lab-button--ghost" : "lab-button--primary"} lab-button--tight"
                      type="button"
                      data-action="workbench-toggle-module"
                      data-value="${escapeHtml(featureId)}"
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
                      data-value="${escapeHtml(featureId)}"
                      ${isActive ? "disabled" : ""}
                    >
                      ${escapeHtml(isActive ? text(["workbench", "activeTag"]) : text(["workbench", "focusAction"]))}
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

  function renderToolInventorySection(title: string, toolIds: string[], stageId: string) {
    if (toolIds.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "dependencyTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(title)}</h2>
          </div>
        </div>
        <div class="lab-tool-grid lab-tool-grid--stacked">
          ${toolIds
            .map(function (toolId) {
              return renderToolCard(toolId, stageId);
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderToolInventoryOverview(stageId: string, currentStageToolIds: string[]) {
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "dependencyTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "toolGridTitle"]))}</h2>
          </div>
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
                    const label = text(["mediaAnalysis", "settings", "tools", toolId]) || toolId;
                    return `<span class="lab-chip">${escapeHtml(label)}</span>`;
                  })
                  .join("")}
              </div>
            `
            : ""
        }
      </section>
    `;
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
    const managedToolIds = toolIds.filter(function (toolId) {
      return getToolInstallStrategy(toolId) === "automatic";
    });
    const manualToolIds = toolIds.filter(function (toolId) {
      return getToolInstallStrategy(toolId) !== "automatic";
    });
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
          <div class="lab-center-layout">
            <aside class="lab-center-sidebar">
              <section class="lab-panel lab-center-sidebar__panel">
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
              <section class="lab-panel lab-center-sidebar__panel">
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
                            const label = getJobPrimaryLabel(job);
                            const percent = getJobPercent(job);
                            const jobId = toString(job.jobId).trim();
                            const stageLabel = formatJobStageLabel(toString(job.stage, "queued"));
                            const operationLabel = toString(job.operation).trim();
                            const detailLabel = toString(job.message, "").trim();
                            const featureStageLabel = getJobFeatureStageLabel(job);
                            const transferLabel = getJobTransferLabel(job);
                            const cancelMarkup =
                              isJobInlineCancelable(job) && jobId !== ""
                                ? `
                                  <button
                                    class="lab-button lab-button--danger lab-button--tight"
                                    type="button"
                                    data-action="job-cancel"
                                    data-value="${escapeHtml(jobId)}"
                                  >
                                    ${escapeHtml(text(["workbench", "operationsMeta", "cancelAction"]))}
                                  </button>
                                `
                                : "";
                            const metaRows = [
                              operationLabel
                                ? [
                                    text(["workbench", "operationsMeta", "operationLabel"]),
                                    formatJobOperationLabel(operationLabel),
                                  ]
                                : null,
                              featureStageLabel !== ""
                                ? [
                                    text(["workbench", "operationsMeta", "stepLabel"]),
                                    featureStageLabel,
                                  ]
                                : null,
                              transferLabel !== ""
                                ? [
                                    text(["workbench", "operationsMeta", "transferLabel"]),
                                    transferLabel,
                                  ]
                                : null,
                            ].filter((entry): entry is [string, string] => entry !== null);
                            return `
                              <article class="lab-op-row">
                                <div class="lab-op-row__head">
                                  <div class="lab-op-row__summary">
                                    <strong>${escapeHtml(label)}</strong>
                                    <span>${escapeHtml(
                                      `${stageLabel}${percent > 0 ? ` · ${String(percent)}%` : ""}`
                                    )}</span>
                                  </div>
                                  ${cancelMarkup}
                                </div>
                                ${
                                  metaRows.length > 0
                                    ? `
                                      <dl class="lab-op-row__meta">
                                        ${metaRows
                                          .map(function (entry) {
                                            return `
                                              <div>
                                                <dt>${escapeHtml(entry[0])}</dt>
                                                <dd>${escapeHtml(entry[1])}</dd>
                                              </div>
                                            `;
                                          })
                                          .join("")}
                                      </dl>
                                    `
                                    : ""
                                }
                                ${
                                  detailLabel !== ""
                                    ? `<p class="lab-op-row__detail">${escapeHtml(detailLabel)}</p>`
                                    : ""
                                }
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
              ${renderModuleControlSection()}
            </aside>
            <div class="lab-center-content">
              ${renderToolInventoryOverview(stageId, currentStageToolIds)}
              ${renderToolInventorySection(
                text(["workbench", "cards", "autoManaged"]),
                managedToolIds,
                stageId
              )}
              ${renderToolInventorySection(
                text(["workbench", "cards", "manualFlows"]),
                manualToolIds,
                stageId
              )}
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
                      <div class="lab-tool-grid lab-tool-grid--stacked">
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
            </div>
          </div>
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
