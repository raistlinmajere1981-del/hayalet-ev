type LaboratoryRecord = Record<string, unknown>;

type LaboratoryToolEntryRecord = LaboratoryRecord & {
  installed?: unknown;
};

type LaboratorySourceRecord = LaboratoryRecord & {
  storedPath?: string | null;
};

type LaboratoryEditRecord = LaboratoryRecord & {
  handoffMode?: string | null;
  lastError?: string | null;
  lastActionAt?: string | null;
  preview?: unknown;
};

type LaboratoryJobRecord = LaboratoryRecord & {
  action?: string | null;
  message?: unknown;
  percent?: unknown;
  stage?: string | null;
};

type LaboratoryRelevantJobs = {
  project: LaboratoryJobRecord[];
};

type LaboratoryEditPreviewRecord = LaboratoryRecord & {
  status?: unknown;
  updatedAt?: unknown;
};

type LaboratoryEditOutputRecord = LaboratoryRecord & {
  fileName?: string | null;
  id?: string | null;
  label?: string | null;
};

type MediaAnalysisEditOutputPanelsDeps = {
  collectEditStageJobs: (projectJobs: unknown[]) => LaboratoryJobRecord[];
  escapeHtml: (value: string) => string;
  formatEditWindowLabel: () => string;
  getActiveEditOutput: () => LaboratoryEditOutputRecord | null;
  getCurrentFocusLabel: () => string;
  getCurrentResizeLabel: () => string;
  getEditJobLabel: (job: LaboratoryJobRecord) => string;
  getEditOutputs: () => LaboratoryEditOutputRecord[];
  getProjectEdit: () => LaboratoryEditRecord;
  getProjectSource: () => LaboratorySourceRecord;
  getRelevantJobs: () => LaboratoryRelevantJobs;
  getToolEntry: (toolId: string) => LaboratoryToolEntryRecord;
  renderSummaryRows: (rows: Array<[string, string]>) => string;
  text: (path: string[]) => string;
};

export function createMediaAnalysisEditOutputPanels(deps: MediaAnalysisEditOutputPanelsDeps) {
  const collectEditStageJobs = deps.collectEditStageJobs;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const getProjectSource = deps.getProjectSource;
  const getToolEntry = deps.getToolEntry;
  const getProjectEdit = deps.getProjectEdit;
  const getRelevantJobs = deps.getRelevantJobs;
  const getActiveEditOutput = deps.getActiveEditOutput;
  const getEditOutputs = deps.getEditOutputs;
  const getEditJobLabel = deps.getEditJobLabel;
  const renderSummaryRows = deps.renderSummaryRows;
  const formatEditWindowLabel = deps.formatEditWindowLabel;
  const getCurrentFocusLabel = deps.getCurrentFocusLabel;
  const getCurrentResizeLabel = deps.getCurrentResizeLabel;

  function toRecord(value: unknown): LaboratoryRecord {
    return value !== null && typeof value === "object" && Array.isArray(value) === false
      ? (value as LaboratoryRecord)
      : {};
  }

  function toPreviewRecord(value: unknown): LaboratoryEditPreviewRecord {
    return toRecord(value);
  }

  function asNonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }

  function asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function looksLikeVerboseToolOutput(message: string | null): boolean {
    if (message === null) {
      return false;
    }

    return (
      message.length > 180 ||
      message.includes("\n") ||
      /ffmpeg version|configuration:|libav|(^|\s)-i\s|scale=|crop=|--[a-z0-9-]+|aac\b|h264\b/i.test(
        message
      )
    );
  }

  function getJobActionLabel(actionId: string | null): string {
    switch (actionId) {
      case null:
        return text(["mediaAnalysis", "edit", "jobsTitle"]);
      case "edit-preview":
        return text(["mediaAnalysis", "edit", "actions", "preview"]);
      case "edit-apply":
        return text(["mediaAnalysis", "edit", "actions", "apply"]);
      case "edit-cancel-preview":
        return text(["mediaAnalysis", "edit", "actions", "cancelPreview"]);
      case "edit-cancel-apply":
        return text(["mediaAnalysis", "edit", "actions", "cancelApply"]);
      default:
        return actionId || text(["mediaAnalysis", "edit", "jobsTitle"]);
    }
  }

  function getJobStageLabel(stageId: string | null): string {
    switch (stageId) {
      case null:
        return text(["mediaAnalysis", "shared", "idle"]);
      case "stdout":
      case "stderr":
        return text(["mediaAnalysis", "settings", "stages", "running"]);
      case "queued":
      case "running":
      case "completed":
      case "failed":
      case "cancelled":
        return text(["mediaAnalysis", "settings", "stages", stageId]);
      default:
        return text(["mediaAnalysis", "shared", "idle"]);
    }
  }

  function getPreviewStatusLabel(statusId: string | null): string {
    switch (statusId) {
      case null:
        return text(["mediaAnalysis", "shared", "idle"]);
      case "generating":
        return text(["mediaAnalysis", "settings", "stages", "running"]);
      case "ready":
        return text(["mediaAnalysis", "shared", "ready"]);
      case "error":
        return text(["mediaAnalysis", "settings", "status", "error"]);
      case "stale":
        return text(["mediaAnalysis", "profile", "status", "stale"]);
      default:
        return text(["mediaAnalysis", "shared", "idle"]);
    }
  }

  function getSafeDetail(message: string | null, fallback: string): string {
    if (message === null || looksLikeVerboseToolOutput(message)) {
      return fallback;
    }
    return message;
  }

  function getProgressWidth(job: LaboratoryJobRecord): number {
    const percent = asNumber(job.percent);
    if (percent !== null) {
      return Math.max(8, Math.min(100, Math.round(percent)));
    }

    switch (asNonEmptyString(job.stage)) {
      case null:
        return 38;
      case "queued":
        return 12;
      case "completed":
      case "failed":
      case "cancelled":
        return 100;
      default:
        return 38;
    }
  }

  function getFriendlyEditError(errorMessage: string | null): string | null {
    if (errorMessage === null) {
      return null;
    }

    return getSafeDetail(
      errorMessage,
      text(["mediaAnalysis", "edit", "progressToolOutputHidden"])
    );
  }

  function renderEditActionsPanel() {
    const source = getProjectSource();
    const edit = getProjectEdit();
    const activeOutput = getActiveEditOutput();
    const ffmpegInstalled = getToolEntry("ffmpeg").installed === true;
    const previewJob =
      getRelevantJobs().project.find(function (entry) {
        return entry.action === "edit-preview";
      }) || null;
    const applyJob =
      getRelevantJobs().project.find(function (entry) {
        return entry.action === "edit-apply";
      }) || null;

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "actionsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "actionsSubtitle"]))}</h2>
          </div>
        </div>
        ${
          ffmpegInstalled !== true
            ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "edit", "ffmpegMissing"]))}</div>`
            : ""
        }
        ${
          getFriendlyEditError(asNonEmptyString(edit.lastError))
            ? `<div class="lab-notice">${escapeHtml(getFriendlyEditError(asNonEmptyString(edit.lastError)) || "")}</div>`
            : ""
        }
        <div class="lab-action-stack">
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-preview"
            ${ffmpegInstalled !== true || typeof source.storedPath !== "string" || previewJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "preview"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-cancel-preview"
            ${previewJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "cancelPreview"]))}
          </button>
          <button
            class="lab-button lab-button--primary"
            type="button"
            data-action="edit-apply"
            ${ffmpegInstalled !== true || typeof source.storedPath !== "string" || applyJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "apply"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-cancel-apply"
            ${applyJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "cancelApply"]))}
          </button>
        </div>
        <div class="lab-segmented">
          ${["source", "derived"]
            .map(function (modeId) {
              const disabled = modeId === "derived" && activeOutput === null;
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="edit-handoff"
                  data-value="${modeId}"
                  data-selected="${edit.handoffMode === modeId ? "true" : "false"}"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "edit", "handoffModes", modeId]))}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderEditProgressPanel() {
    const edit = getProjectEdit();
    const preview = toPreviewRecord(edit.preview);
    const previewStatus = asNonEmptyString(preview.status);
    const previewUpdatedAt = asNonEmptyString(preview.updatedAt) || asNonEmptyString(edit.lastActionAt);
    const activeEditJobs = collectEditStageJobs(getRelevantJobs().project);

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "progressTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "progressSubtitle"]))}</h2>
          </div>
        </div>
        ${
          activeEditJobs.length > 0
            ? `
              <div class="lab-status-stack">
                ${activeEditJobs
                  .map(function (job) {
                    const stageId = asNonEmptyString(job.stage);
                    const progressPercent = asNumber(job.percent);
                    const progressLabel =
                      progressPercent !== null
                        ? `${Math.round(progressPercent)}%`
                        : getJobStageLabel(stageId);
                    const detail = getSafeDetail(
                      asNonEmptyString(job.message),
                      text(["mediaAnalysis", "edit", "progressRunningHint"])
                    );

                    return `
                      <article class="lab-status-card">
                        <div class="lab-status-card__head">
                          <strong>${escapeHtml(getEditJobLabel(job) || getJobActionLabel(asNonEmptyString(job.action)))}</strong>
                          <span>${escapeHtml(progressLabel)}</span>
                        </div>
                        <div class="lab-progress-bar lab-progress-bar--wide">
                          <span style="width:${getProgressWidth(job)}%"></span>
                        </div>
                        <p class="lab-status-card__body">${escapeHtml(
                          `${getJobActionLabel(asNonEmptyString(job.action))} · ${getJobStageLabel(stageId)}`
                        )}</p>
                        <p class="lab-status-card__body">${escapeHtml(detail)}</p>
                      </article>
                    `;
                  })
                  .join("")}
              </div>
            `
            : `
              ${renderSummaryRows([
                [text(["mediaAnalysis", "shared", "status"]), getPreviewStatusLabel(previewStatus)],
                [text(["mediaAnalysis", "edit", "outputsTitle"]), String(getEditOutputs().length)],
                [
                  text(["mediaAnalysis", "edit", "progressUpdated"]),
                  previewUpdatedAt ? previewUpdatedAt.replace("T", " ").slice(0, 16) : "--",
                ],
              ])}
              <p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "edit", "progressIdle"]))}</p>
            `
        }
      </section>
    `;
  }

  function renderEditOutputsPanel() {
    const outputs = getEditOutputs();
    const activeOutput = getActiveEditOutput();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "outputsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "outputsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-output-list">
          ${
            outputs.length > 0
              ? outputs
                  .map(function (entry) {
                    const entryId = entry.id || "";
                    const entryLabel = entry.label || entry.fileName || entryId || "--";
                    const entryFileName = entry.fileName || "--";
                    return `
                      <article class="lab-output-card" data-selected="${activeOutput && activeOutput.id === entryId ? "true" : "false"}">
                        <div>
                          <strong>${escapeHtml(entryLabel)}</strong>
                          <span>${escapeHtml(entryFileName)}</span>
                        </div>
                        <button
                          class="lab-button lab-button--ghost lab-button--tight"
                          type="button"
                          data-action="edit-select-output"
                          data-value="${escapeHtml(entryId)}"
                        >
                          ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "selectOutput"]))}
                        </button>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "edit", "outputsEmpty"]))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderEditSummaryPanel() {
    const edit = getProjectEdit();
    const activeOutput = getActiveEditOutput();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "summaryTitle"]))}</p>
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "edit", "selectedWindow"]), formatEditWindowLabel()],
          [text(["mediaAnalysis", "edit", "selectedRegion"]), getCurrentFocusLabel()],
          [text(["mediaAnalysis", "edit", "selectedResize"]), getCurrentResizeLabel()],
          [
            text(["mediaAnalysis", "edit", "selectedOutput"]),
            activeOutput
              ? activeOutput.label || activeOutput.fileName || activeOutput.id || "--"
              : "--",
          ],
          [
            text(["mediaAnalysis", "edit", "handoffLabel"]),
            text([
              "mediaAnalysis",
              "edit",
              "handoffModes",
              edit.handoffMode === "derived" ? "derived" : "source",
            ]),
          ],
        ])}
      </section>
    `;
  }

  return {
    renderEditActionsPanel,
    renderEditProgressPanel,
    renderEditOutputsPanel,
    renderEditSummaryPanel,
  };
}
