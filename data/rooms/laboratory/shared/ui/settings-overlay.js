import { createLaboratorySettingsProfileModelRuntime } from "./settings-profile-model.js";
import { createLaboratorySettingsToolCardRuntime } from "./settings-tool-card.js";
export function createLaboratorySettingsUi(deps) {
  const {
    escapeHtml,
    featureText,
    formatBytes,
    formatCleanupPolicy,
    formatPlatformList,
    getProfileModelEntries,
    getProfileSelectedModel,
    getToolEntry,
    getToolRegistry,
    isAudioAnalysisFeature,
    renderAudioAnalysisProviderPanel,
    renderPreviewMetaRow,
    state,
    text,
    textFromKey,
    toRecord
  } = deps;
  const laboratorySettingsToolCardRuntime = createLaboratorySettingsToolCardRuntime({
    escapeHtml,
    getToolEntry,
    getToolRegistry,
    renderPreviewMetaRow,
    state,
    text,
    toRecord
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
    toRecord
  });
  function toString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }
  function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  function toJobRecord(value) {
    return toRecord(value);
  }
  function readText(path, fallback = "") {
    const resolved = text(path);
    const leaf = path[path.length - 1] || "";
    return resolved === leaf ? fallback || resolved : resolved;
  }
  function prettifyToken(value) {
    return value.split(/[-_]/).filter(function(entry) {
      return entry.trim() !== "";
    }).map(function(entry) {
      return entry.charAt(0).toUpperCase() + entry.slice(1);
    }).join(" ");
  }
  function formatJobActionLabel(action) {
    return readText(["workbench", "operationsMeta", "actions", action], prettifyToken(action));
  }
  function formatJobOperationLabel(operation) {
    return readText(
      ["workbench", "operationsMeta", "operations", operation],
      prettifyToken(operation)
    );
  }
  function formatJobStageLabel(stage) {
    return readText(["workbench", "operationsMeta", "stages", stage], prettifyToken(stage));
  }
  function getJobPrimaryLabel(job) {
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
  function getJobTransferLabel(job) {
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
  function getJobFeatureStageLabel(job) {
    const featureStageId = toString(job.featureStage).trim();
    if (featureStageId === "") {
      return "";
    }
    return featureText(["stages", featureStageId]) || featureStageId;
  }
  function isJobInlineCancelable(job) {
    const jobId = toString(job.jobId).trim();
    const actionId = toString(job.action).trim();
    if (jobId === "" || actionId === "") {
      return false;
    }
    return actionId.startsWith("tool-") || actionId === "profile-model-install" || actionId.startsWith("source-") || actionId.startsWith("subtitle-source-");
  }
  function getAllToolIds() {
    return getToolRegistry().map(function(entry) {
      const toolId = toString(entry.toolId).trim();
      return toolId !== "" ? toolId : null;
    }).filter((toolId) => toolId !== null);
  }
  function getInstalledToolIds() {
    return getAllToolIds().filter(function(toolId) {
      const toolEntry = getToolEntry(toolId);
      return toolEntry.installed === true;
    });
  }
  function renderToolStream(toolIds) {
    if (toolIds.length === 0) {
      return "";
    }
    return `
      <section class="lab-panel">
        <div class="lab-tool-stream">
          ${toolIds.map(function(toolId) {
      return renderToolCard(toolId);
    }).join("")}
        </div>
      </section>
    `;
  }
  function getRunningJobs() {
    return (Array.isArray(state.sourceSnapshot.jobs) ? state.sourceSnapshot.jobs : []).map(toJobRecord).filter(function(job) {
      return !["completed", "failed", "cancelled"].includes(toString(job.stage));
    });
  }
  function hasRunningToolJob(jobs) {
    return jobs.some(function(job) {
      return toString(job.action).trim().startsWith("tool-");
    });
  }
  function getJobPercent(job) {
    if (typeof job.percent !== "number" || Number.isFinite(job.percent) !== true) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(job.percent)));
  }
  function renderToolCard(toolId) {
    return laboratorySettingsToolCardRuntime.renderToolCard(toolId);
  }
  function renderProfileModelCard(entry) {
    return laboratorySettingsProfileModelRuntime.renderProfileModelCard(entry);
  }
  function renderSettingsOverlay() {
    if (state.ui.settingsOpen !== true) {
      return "";
    }
    const toolIds = getAllToolIds();
    const installedToolIds = getInstalledToolIds();
    const runningJobs = getRunningJobs();
    const hasToolJobs = hasRunningToolJob(runningJobs);
    const profileModelEntries = getProfileModelEntries();
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
              <h2 class="lab-panel__title" id="lab-dependency-center-title">${escapeHtml(
      text(["workbench", "dependencyTitle"])
    )}</h2>
            </div>
            <div class="lab-overlay__actions">
              <button
                class="lab-button lab-button--primary lab-button--tight"
                type="button"
                data-action="tool-update-all"
                ${installedToolIds.length === 0 || hasToolJobs ? "disabled" : ""}
              >
                ${escapeHtml(text(["mediaAnalysis", "settings", "bulkUpdateAction"]))}
              </button>
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="tools-refresh">
                ${escapeHtml(text(["mediaAnalysis", "settings", "refreshAction"]))}
              </button>
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="close-settings">
                ${escapeHtml(closeActionLabel)}
              </button>
            </div>
          </header>
          <div class="lab-center-layout">
            <aside class="lab-center-sidebar lab-center-sidebar--management">
              <section class="lab-panel lab-center-sidebar__panel lab-center-sidebar__panel--fill">
                <div class="lab-panel__header">
                  <div>
                    <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "operationsTitle"]))}</h2>
                  </div>
                </div>
                ${runningJobs.length > 0 ? `
                      <div class="lab-ops-feed">
                        ${runningJobs.map(function(job) {
      const label = getJobPrimaryLabel(job);
      const percent = getJobPercent(job);
      const jobId = toString(job.jobId).trim();
      const stageLabel = formatJobStageLabel(toString(job.stage, "queued"));
      const operationLabel = toString(job.operation).trim();
      const detailLabel = toString(job.message, "").trim();
      const featureStageLabel = getJobFeatureStageLabel(job);
      const transferLabel = getJobTransferLabel(job);
      const cancelMarkup = isJobInlineCancelable(job) && jobId !== "" ? `
                                  <button
                                    class="lab-button lab-button--danger lab-button--tight"
                                    type="button"
                                    data-action="job-cancel"
                                    data-value="${escapeHtml(jobId)}"
                                  >
                                    ${escapeHtml(text(["workbench", "operationsMeta", "cancelAction"]))}
                                  </button>
                                ` : "";
      const metaRows = [
        operationLabel ? [
          text(["workbench", "operationsMeta", "operationLabel"]),
          formatJobOperationLabel(operationLabel)
        ] : null,
        featureStageLabel !== "" ? [
          text(["workbench", "operationsMeta", "stepLabel"]),
          featureStageLabel
        ] : null,
        transferLabel !== "" ? [
          text(["workbench", "operationsMeta", "transferLabel"]),
          transferLabel
        ] : null
      ].filter((entry) => entry !== null);
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
                                ${metaRows.length > 0 ? `
                                      <dl class="lab-op-row__meta">
                                        ${metaRows.map(function(entry) {
        return `
                                              <div>
                                                <dt>${escapeHtml(entry[0])}</dt>
                                                <dd>${escapeHtml(entry[1])}</dd>
                                              </div>
                                            `;
      }).join("")}
                                      </dl>
                                    ` : ""}
                                ${detailLabel !== "" ? `<p class="lab-op-row__detail">${escapeHtml(detailLabel)}</p>` : ""}
                                <div class="lab-progress-bar lab-progress-bar--wide" aria-hidden="true">
                                  <span style="width:${Math.max(4, percent || 4)}%"></span>
                                </div>
                              </article>
                            `;
    }).join("")}
                      </div>
                    ` : `<p class="lab-panel__hint">${escapeHtml(text(["workbench", "operationsEmpty"]))}</p>`}
              </section>
            </aside>
            <div class="lab-center-content lab-center-content--stack">
              ${renderToolStream(toolIds)}
              ${profileModelEntries.length > 0 ? `
                    <section class="lab-panel">
                      <div class="lab-panel__header">
                        <div>
                          <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "modelTitle"]))}</h2>
                        </div>
                      </div>
                      <div class="lab-tool-stream">
                        ${profileModelEntries.map(function(entry) {
      return renderProfileModelCard(entry);
    }).join("")}
                      </div>
                    </section>
                  ` : ""}
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
    renderToolCard
  };
}
