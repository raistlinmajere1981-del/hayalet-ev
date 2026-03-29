export function createMediaAnalysisProfileStage(deps) {
  const state = deps.state;
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const formatDuration = deps.formatDuration;
  const renderStageIntro = deps.renderStageIntro;
  const renderSummaryRows = deps.renderSummaryRows;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const getCurrentSourceLabel = deps.getCurrentSourceLabel;
  const getCurrentProfileMode = deps.getCurrentProfileMode;
  const getProfileEstimate = deps.getProfileEstimate;
  const getProfileLabel = deps.getProfileLabel;
  const renderProfilePresetPanel = deps.renderProfilePresetPanel;
  const renderProfileAdvancedPanel = deps.renderProfileAdvancedPanel;
  const getProfileSignals = deps.getProfileSignals;
  const sortProfileSignals = deps.sortProfileSignals;
  const getProfileSignalKindLabel = deps.getProfileSignalKindLabel;
  const getProfileConfidenceLabel = deps.getProfileConfidenceLabel;
  const getProfileArtifacts = deps.getProfileArtifacts;
  const getProfileReadiness = deps.getProfileReadiness;
  const getProfilePreflight = deps.getProfilePreflight;
  const getProfileJobs = deps.getProfileJobs;
  const getProfileSelectedModel = deps.getProfileSelectedModel;
  const getProjectSource = deps.getProjectSource;
  const getPreferredAssetDuration = deps.getPreferredAssetDuration;
  const getPreferredAssetResolution = deps.getPreferredAssetResolution;
  const getPreferredAssetCodec = deps.getPreferredAssetCodec;
  const getProfileTargetSummary = deps.getProfileTargetSummary;
  const getProfileTargetAsset = deps.getProfileTargetAsset;
  const getProfileTargetMode = deps.getProfileTargetMode;
  const getProfileTargetOutputOptions = deps.getProfileTargetOutputOptions;
  const getFocusLabel = deps.getFocusLabel;

  function renderProfileTargetPanel() {
    const target = getProfileTargetSummary();
    const asset = getProfileTargetAsset();
    const targetMode = getProfileTargetMode();
    const outputOptions = getProfileTargetOutputOptions();
    let mediaMarkup = `
      <div class="lab-empty-preview">
        <strong>${escapeHtml(text(["mediaAnalysis", "profile", "targetEmptyTitle"]))}</strong>
        <p>${escapeHtml(text(["mediaAnalysis", "profile", "targetEmptyBody"]))}</p>
      </div>
    `;

    if (typeof asset.previewUrl === "string" && asset.previewUrl.trim() !== "") {
      if (asset.kind === "image") {
        mediaMarkup = `<img class="lab-preview-media lab-preview-media--image" data-preview-media="image" src="${asset.previewUrl}" alt="" />`;
      } else if (asset.kind === "audio") {
        mediaMarkup = `
          <div class="lab-audio-workbench">
            <div class="lab-audio-bars">
              ${(state.ui.audioAnalysis.bars.length > 0 ? state.ui.audioAnalysis.bars : new Array(36).fill(20))
                .map(function (value) {
                  return `<span style="height:${Math.max(10, Number(value) || 10)}px"></span>`;
                })
                .join("")}
            </div>
            <audio class="lab-preview-media lab-preview-media--audio" data-preview-media="audio" controls src="${asset.previewUrl}"></audio>
          </div>
        `;
      } else {
        mediaMarkup = `<video class="lab-preview-media lab-preview-media--video" data-preview-media="video" controls src="${asset.previewUrl}"></video>`;
      }
    }

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "targetTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "targetSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented">
          ${["source", "derived"]
            .map(function (modeId) {
              const disabled = modeId === "derived" && outputOptions.length === 0;
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="profile-target-mode"
                  data-value="${modeId}"
                  data-selected="${modeId === targetMode ? "true" : "false"}"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "targetModes", modeId]))}
                </button>
              `;
            })
            .join("")}
        </div>
        ${
          targetMode === "derived"
            ? `
              <label class="lab-field">
                <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "targetOutputLabel"]))}</span>
                <select class="lab-select" data-profile-field="targetOutputId">
                  <option value="">${escapeHtml(text(["mediaAnalysis", "profile", "targetOutputEmpty"]))}</option>
                  ${outputOptions
                    .map(function (entry) {
                      return `
                        <option value="${escapeHtml(entry.id)}" ${entry.id === target.outputId ? "selected" : ""}>
                          ${escapeHtml(entry.label || entry.fileName || entry.id)}
                        </option>
                      `;
                    })
                    .join("")}
                </select>
              </label>
            `
            : ""
        }
        <div class="lab-preview-card">
          <div class="lab-preview-frame">${mediaMarkup}</div>
          <section class="lab-panel lab-panel--dense">
            ${renderSummaryRows([
              [text(["mediaAnalysis", "profile", "summary", "target"]), asset.label || "--"],
              [text(["mediaAnalysis", "shared", "duration"]), formatDuration(getPreferredAssetDuration(asset))],
              [text(["mediaAnalysis", "shared", "resolution"]), getPreferredAssetResolution(asset)],
              [text(["mediaAnalysis", "shared", "codec"]), getPreferredAssetCodec(asset)],
            ])}
            ${
              target.usingFallback === true && typeof target.reason === "string"
                ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(target.reason)}</p>`
                : ""
            }
          </section>
        </div>
      </section>
    `;
  }

  function renderProfileModePanel() {
    const mode = getCurrentProfileMode();
    const estimate = getProfileEstimate();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "modeTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "modeSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented">
          ${["beginner", "advanced"]
            .map(function (modeId) {
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="profile-mode"
                  data-value="${modeId}"
                  data-selected="${modeId === mode ? "true" : "false"}"
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modes", modeId]))}
                </button>
              `;
            })
            .join("")}
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "profile", "summary", "preset"]), getProfileLabel()],
          [text(["mediaAnalysis", "profile", "summary", "sampleWindow"]), formatDuration(estimate.sampleWindowSeconds)],
          [text(["mediaAnalysis", "profile", "summary", "runtime"]), formatDuration(estimate.runtimeSeconds)],
        ])}
      </section>
    `;
  }

  function renderProfileSignalsPanel() {
    const signals = sortProfileSignals(getProfileSignals());
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "signalsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "signalsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-finding-list">
          ${
            signals.length > 0
              ? signals
                  .map(function (signal) {
                    return `
                      <article class="lab-finding">
                        <div class="lab-finding__head">
                          <strong>${escapeHtml(signal.title || signal.laneId || "--")}</strong>
                          <span class="lab-chip">${escapeHtml(text(["mediaAnalysis", "profile", "levels", signal.level || "low"]))}</span>
                        </div>
                        <p class="lab-panel__hint">
                          ${escapeHtml(
                            `${text(["mediaAnalysis", "profile", "signalMeta", "kind"])}: ${getProfileSignalKindLabel(signal.kind)}`
                          )}
                          ·
                          ${escapeHtml(
                            `${text(["mediaAnalysis", "profile", "signalMeta", "confidence"])}: ${getProfileConfidenceLabel(signal.confidence)}`
                          )}
                          ·
                          ${escapeHtml(
                            `${text(["mediaAnalysis", "profile", "signalMeta", "evidence"])}: ${String(
                              Number(signal.evidenceCount) || 0
                            )}`
                          )}
                        </p>
                        <p class="lab-finding__detail">${escapeHtml(signal.detail || "")}</p>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "signalsEmpty"]))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderProfileArtifactsPanel() {
    const artifacts = getProfileArtifacts();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-artifact-grid">
          ${
            artifacts.length > 0
              ? artifacts
                  .map(function (artifact) {
                    const previewable =
                      typeof artifact.previewUrl === "string" &&
                      /\.(png|jpe?g|webp|gif)$/i.test(String(artifact.fileName || ""));
                    return `
                      <article class="lab-artifact-card">
                        ${previewable ? `<img class="lab-artifact-card__image" src="${artifact.previewUrl}" alt="" />` : ""}
                        <strong>${escapeHtml(artifact.label || artifact.fileName || artifact.kind || "--")}</strong>
                        <span>${escapeHtml(artifact.fileName || artifact.kind || "--")}</span>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsEmpty"]))}</p>`
          }
        </div>
      </section>
    `;
  }

  function getRunningProfileJob() {
    const jobs = getProfileJobs();
    return (
      jobs.find(function (job) {
        return job.action === "profile-run-preflight" && !["completed", "failed", "cancelled"].includes(String(job.stage || ""));
      }) || null
    );
  }

  function renderProfileActionsPanel() {
    const readiness = getProfileReadiness();
    const preflight = getProfilePreflight();
    const runningJob = getRunningProfileJob();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "preflightTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "preflightSubtitle"]))}</h2>
          </div>
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "shared", "status"]), text(["mediaAnalysis", "profile", "status", preflight.status || "idle"])],
          [text(["mediaAnalysis", "profile", "summary", "signals"]), String(getProfileSignals().length)],
          [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(getProfileArtifacts().length)],
          [text(["mediaAnalysis", "profile", "summary", "runtime"]), formatDuration(getProfileEstimate().runtimeSeconds)],
        ])}
        <div class="lab-action-stack">
          <button
            class="lab-button lab-button--primary"
            type="button"
            data-action="profile-run"
            ${getProfileReadiness().stageReady !== true || runningJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "profile", "actions", "run"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="profile-cancel"
            ${runningJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "profile", "actions", "cancel"]))}
          </button>
        </div>
        ${
          runningJob && typeof runningJob.message === "string" && runningJob.message.trim() !== ""
            ? `<p class="lab-panel__hint">${escapeHtml(runningJob.message)}</p>`
            : ""
        }
      </section>
    `;
  }

  function renderProfileSummaryPanel() {
    const readiness = getProfileReadiness();
    const estimate = getProfileEstimate();
    const selectedModel = getProfileSelectedModel();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "summaryTitle"]))}</p>
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "profile", "summary", "target"]), getFocusLabel()],
          [text(["mediaAnalysis", "profile", "summary", "preset"]), getProfileLabel()],
          [text(["mediaAnalysis", "profile", "summary", "lanes"]), String(readiness.enabledLaneCount || 0)],
          [text(["mediaAnalysis", "profile", "summary", "runtime"]), formatDuration(estimate.runtimeSeconds)],
          [text(["mediaAnalysis", "profile", "summary", "model"]), selectedModel ? textFromKey(selectedModel.labelKey || "") : "--"],
        ])}
        ${
          Array.isArray(readiness.blockers) && readiness.blockers.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(text(["mediaAnalysis", "profile", "blockersTitle"]))}</strong>
                <ul class="lab-bullet-list">
                  ${readiness.blockers
                    .map(function (entry) {
                      return `<li>${escapeHtml(entry)}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
        ${
          Array.isArray(readiness.warnings) && readiness.warnings.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(text(["mediaAnalysis", "profile", "warningsTitle"]))}</strong>
                <ul class="lab-bullet-list">
                  ${readiness.warnings
                    .slice(0, 4)
                    .map(function (entry) {
                      return `<li>${escapeHtml(entry)}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
      </section>
    `;
  }

  function renderProfileStage() {
    const sourceReady =
      typeof getProjectSource().storedPath === "string" && getProjectSource().storedPath.trim() !== "";
    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("profile")}
          ${renderProfileTargetPanel()}
          ${renderProfileModePanel()}
          ${renderProfilePresetPanel()}
          ${getCurrentProfileMode() === "advanced" ? renderProfileAdvancedPanel() : ""}
          <div class="lab-subgrid lab-subgrid--profile">
            ${renderProfileSignalsPanel()}
            ${renderProfileArtifactsPanel()}
            ${renderProfileActionsPanel()}
          </div>
          ${
            sourceReady !== true
              ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "profile", "sourceRequired"]))}</div>`
              : ""
          }
        </section>
        <aside class="lab-side-stack">
          ${renderProfileSummaryPanel()}
        </aside>
      </div>
    `;
  }

  return {
    renderProfileActionsPanel: renderProfileActionsPanel,
    renderProfileArtifactsPanel: renderProfileArtifactsPanel,
    renderProfileModePanel: renderProfileModePanel,
    renderProfileSignalsPanel: renderProfileSignalsPanel,
    renderProfileStage: renderProfileStage,
    renderProfileSummaryPanel: renderProfileSummaryPanel,
    renderProfileTargetPanel: renderProfileTargetPanel,
  };
}
