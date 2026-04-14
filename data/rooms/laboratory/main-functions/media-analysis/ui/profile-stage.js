export function createMediaAnalysisProfileStage(deps) {
  const {
    escapeHtml,
    formatDuration,
    getCurrentProfileMode,
    getFocusLabel,
    getPreferredAssetCodec,
    getPreferredAssetDuration,
    getPreferredAssetResolution,
    getProfileArtifacts,
    getProfileConfidenceLabel,
    getProfileEstimate,
    getProfileJobs,
    getProfileLabel,
    getProfilePreflight,
    getProfileReadiness,
    getProfileSelectedModel,
    getProfileSignalKindLabel,
    getProfileSignals,
    getProfileTargetAsset,
    getProfileTargetMode,
    getProfileTargetOutputOptions,
    getProfileTargetSummary,
    getProjectSource,
    renderProfileAdvancedPanel,
    renderProfilePresetPanel,
    renderStageIntro,
    renderSummaryRows,
    sortProfileSignals,
    state,
    text,
    textFromKey
  } = deps;
  function toRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value;
  }
  function asNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return asNonEmptyString(entry);
    }).filter((entry) => entry !== null);
  }
  function toNumberArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return asNumber(entry);
    }).filter((entry) => entry !== null);
  }
  function toUiStateRecord(value) {
    return toRecord(value);
  }
  function toAudioAnalysisStateRecord(value) {
    return toRecord(value);
  }
  function toProfileEstimateRecord(value) {
    return toRecord(value);
  }
  function toProfileSignalRecord(value) {
    return toRecord(value);
  }
  function toProfileArtifactRecord(value) {
    return toRecord(value);
  }
  function toProfileReadinessRecord(value) {
    return toRecord(value);
  }
  function toProfilePreflightRecord(value) {
    return toRecord(value);
  }
  function toProfileJobRecord(value) {
    return toRecord(value);
  }
  function toProfileSelectedModelRecord(value) {
    return toRecord(value);
  }
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toProfileTargetSummaryRecord(value) {
    return toRecord(value);
  }
  function toProfileTargetAssetRecord(value) {
    return toRecord(value);
  }
  function toProfileTargetOutputOptionRecord(value) {
    return toRecord(value);
  }
  function getProfileMode() {
    return getCurrentProfileMode() === "advanced" ? "advanced" : "beginner";
  }
  function getEstimate() {
    return toProfileEstimateRecord(getProfileEstimate());
  }
  function getSignals() {
    const signals = getProfileSignals();
    return Array.isArray(signals) ? signals.map(toProfileSignalRecord) : [];
  }
  function getArtifacts() {
    const artifacts = getProfileArtifacts();
    return Array.isArray(artifacts) ? artifacts.map(toProfileArtifactRecord) : [];
  }
  function getReadiness() {
    return toProfileReadinessRecord(getProfileReadiness());
  }
  function getPreflight() {
    return toProfilePreflightRecord(getProfilePreflight());
  }
  function getJobs() {
    const jobs = getProfileJobs();
    return Array.isArray(jobs) ? jobs.map(toProfileJobRecord) : [];
  }
  function getSelectedModel() {
    const model = getProfileSelectedModel();
    return model ? toProfileSelectedModelRecord(model) : null;
  }
  function getSource() {
    return toProjectSourceRecord(getProjectSource());
  }
  function getTargetSummary() {
    return toProfileTargetSummaryRecord(getProfileTargetSummary());
  }
  function getTargetAsset() {
    return toProfileTargetAssetRecord(getProfileTargetAsset());
  }
  function getTargetMode() {
    return getProfileTargetMode() === "derived" ? "derived" : "source";
  }
  function getTargetOutputOptions() {
    const options = getProfileTargetOutputOptions();
    return Array.isArray(options) ? options.map(toProfileTargetOutputOptionRecord) : [];
  }
  function getAudioBars() {
    const uiState = toUiStateRecord(state.ui);
    const audioAnalysis = toAudioAnalysisStateRecord(uiState.audioAnalysis);
    return toNumberArray(audioAnalysis.bars);
  }
  function getAudioBarsForPreview() {
    const audioBars = getAudioBars();
    return audioBars.length > 0 ? audioBars : Array.from({ length: 36 }, function() {
      return 20;
    });
  }
  function getTargetAssetKind(asset) {
    const assetKind = asNonEmptyString(asset.kind);
    if (assetKind === "image" || assetKind === "audio") {
      return assetKind;
    }
    return "video";
  }
  function renderProfileTargetPanel() {
    const target = getTargetSummary();
    const asset = getTargetAsset();
    const targetMode = getTargetMode();
    const outputOptions = getTargetOutputOptions();
    const assetPreviewUrl = asNonEmptyString(asset.previewUrl);
    const assetKind = getTargetAssetKind(asset);
    let mediaMarkup = `
      <div class="lab-empty-preview">
        <strong>${escapeHtml(text(["mediaAnalysis", "profile", "targetEmptyTitle"]))}</strong>
        <p>${escapeHtml(text(["mediaAnalysis", "profile", "targetEmptyBody"]))}</p>
      </div>
    `;
    if (assetPreviewUrl !== null) {
      if (assetKind === "image") {
        mediaMarkup = `<img class="lab-preview-media lab-preview-media--image" data-preview-media="image" src="${assetPreviewUrl}" alt="" />`;
      } else if (assetKind === "audio") {
        const audioBars = getAudioBarsForPreview();
        mediaMarkup = `
          <div class="lab-audio-workbench">
            <div class="lab-audio-bars">
              ${audioBars.map(function(value) {
          return `<span style="height:${Math.max(10, value)}px"></span>`;
        }).join("")}
            </div>
            <audio class="lab-preview-media lab-preview-media--audio" data-preview-media="audio" controls src="${assetPreviewUrl}"></audio>
          </div>
        `;
      } else {
        mediaMarkup = `<video class="lab-preview-media lab-preview-media--video" data-preview-media="video" controls src="${assetPreviewUrl}"></video>`;
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
          ${["source", "derived"].map(function(modeId) {
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
    }).join("")}
        </div>
        ${targetMode === "derived" ? `
              <label class="lab-field">
                <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "targetOutputLabel"]))}</span>
                <select class="lab-select" data-profile-field="targetOutputId">
                  <option value="">${escapeHtml(text(["mediaAnalysis", "profile", "targetOutputEmpty"]))}</option>
                  ${outputOptions.map(function(entry) {
      const entryId = asNonEmptyString(entry.id) || "";
      const entryLabel = asNonEmptyString(entry.label) || asNonEmptyString(entry.fileName) || entryId || "--";
      return `
                        <option value="${escapeHtml(entryId)}" ${entryId === asNonEmptyString(target.outputId) ? "selected" : ""}>
                          ${escapeHtml(entryLabel)}
                        </option>
                      `;
    }).join("")}
                </select>
              </label>
            ` : ""}
        <div class="lab-preview-card">
          <div class="lab-preview-frame">${mediaMarkup}</div>
          <section class="lab-panel lab-panel--dense">
            ${renderSummaryRows([
      [
        text(["mediaAnalysis", "profile", "summary", "target"]),
        asNonEmptyString(asset.label) || "--"
      ],
      [
        text(["mediaAnalysis", "shared", "duration"]),
        formatDuration(asNumber(getPreferredAssetDuration(asset)))
      ],
      [
        text(["mediaAnalysis", "shared", "resolution"]),
        asNonEmptyString(getPreferredAssetResolution(asset)) || "--"
      ],
      [
        text(["mediaAnalysis", "shared", "codec"]),
        asNonEmptyString(getPreferredAssetCodec(asset)) || "--"
      ]
    ])}
            ${target.usingFallback === true && asNonEmptyString(target.reason) ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(asNonEmptyString(target.reason) || "")}</p>` : ""}
          </section>
        </div>
      </section>
    `;
  }
  function renderProfileModePanel() {
    const mode = getProfileMode();
    const estimate = getEstimate();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "modeTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "modeSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented">
          ${["beginner", "advanced"].map(function(modeId) {
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
    }).join("")}
        </div>
        ${renderSummaryRows([
      [text(["mediaAnalysis", "profile", "summary", "preset"]), getProfileLabel()],
      [
        text(["mediaAnalysis", "profile", "summary", "sampleWindow"]),
        formatDuration(asNumber(estimate.sampleWindowSeconds))
      ],
      [
        text(["mediaAnalysis", "profile", "summary", "runtime"]),
        formatDuration(asNumber(estimate.runtimeSeconds))
      ]
    ])}
      </section>
    `;
  }
  function renderProfileSignalsPanel() {
    const signals = sortProfileSignals(getSignals());
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "signalsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "signalsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-finding-list">
          ${signals.length > 0 ? signals.map(function(signal) {
      const signalTitle = asNonEmptyString(signal.title) || asNonEmptyString(signal.laneId) || "--";
      const signalLevel = asNonEmptyString(signal.level) || "low";
      const signalDetail = asNonEmptyString(signal.detail) || "";
      return `
                      <article class="lab-finding">
                        <div class="lab-finding__head">
                          <strong>${escapeHtml(signalTitle)}</strong>
                          <span class="lab-chip">${escapeHtml(text(["mediaAnalysis", "profile", "levels", signalLevel]))}</span>
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
          asNumber(signal.evidenceCount) || 0
        )}`
      )}
                        </p>
                        <p class="lab-finding__detail">${escapeHtml(signalDetail)}</p>
                      </article>
                    `;
    }).join("") : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "signalsEmpty"]))}</p>`}
        </div>
      </section>
    `;
  }
  function renderProfileArtifactsPanel() {
    const artifacts = getArtifacts();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-artifact-grid">
          ${artifacts.length > 0 ? artifacts.map(function(artifact) {
      const previewUrl = asNonEmptyString(artifact.previewUrl);
      const fileName = asNonEmptyString(artifact.fileName) || "";
      const previewable = previewUrl !== null && /\.(png|jpe?g|webp|gif)$/i.test(fileName);
      const artifactLabel = asNonEmptyString(artifact.label) || asNonEmptyString(artifact.fileName) || asNonEmptyString(artifact.kind) || "--";
      const artifactMeta = asNonEmptyString(artifact.fileName) || asNonEmptyString(artifact.kind) || "--";
      return `
                      <article class="lab-artifact-card">
                        ${previewable ? `<img class="lab-artifact-card__image" src="${previewUrl}" alt="" />` : ""}
                        <strong>${escapeHtml(artifactLabel)}</strong>
                        <span>${escapeHtml(artifactMeta)}</span>
                      </article>
                    `;
    }).join("") : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsEmpty"]))}</p>`}
        </div>
      </section>
    `;
  }
  function getRunningProfileJob() {
    const jobs = getJobs();
    return jobs.find(function(job) {
      return asNonEmptyString(job.action) === "profile-run-preflight" && !["completed", "failed", "cancelled"].includes(asNonEmptyString(job.stage) || "");
    }) || null;
  }
  function renderProfileActionsPanel() {
    const preflight = getPreflight();
    const runningJob = getRunningProfileJob();
    const readiness = getReadiness();
    const estimate = getEstimate();
    const signals = getSignals();
    const artifacts = getArtifacts();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "preflightTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "preflightSubtitle"]))}</h2>
          </div>
        </div>
        ${renderSummaryRows([
      [
        text(["mediaAnalysis", "shared", "status"]),
        text([
          "mediaAnalysis",
          "profile",
          "status",
          asNonEmptyString(preflight.status) || "idle"
        ])
      ],
      [text(["mediaAnalysis", "profile", "summary", "signals"]), String(signals.length)],
      [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(artifacts.length)],
      [
        text(["mediaAnalysis", "profile", "summary", "runtime"]),
        formatDuration(asNumber(estimate.runtimeSeconds))
      ]
    ])}
        <div class="lab-action-stack">
          <button
            class="lab-button lab-button--primary"
            type="button"
            data-action="profile-run"
            ${readiness.stageReady !== true || runningJob ? "disabled" : ""}
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
        ${runningJob && asNonEmptyString(runningJob.message) ? `<p class="lab-panel__hint">${escapeHtml(asNonEmptyString(runningJob.message) || "")}</p>` : ""}
      </section>
    `;
  }
  function renderProfileSummaryPanel() {
    const readiness = getReadiness();
    const estimate = getEstimate();
    const selectedModel = getSelectedModel();
    const selectedModelLabelKey = selectedModel ? asNonEmptyString(selectedModel.labelKey) : null;
    const blockers = toStringArray(readiness.blockers);
    const warnings = toStringArray(readiness.warnings);
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "summaryTitle"]))}</p>
        </div>
        ${renderSummaryRows([
      [text(["mediaAnalysis", "profile", "summary", "target"]), getFocusLabel()],
      [text(["mediaAnalysis", "profile", "summary", "preset"]), getProfileLabel()],
      [
        text(["mediaAnalysis", "profile", "summary", "lanes"]),
        String(asNumber(readiness.enabledLaneCount) || 0)
      ],
      [
        text(["mediaAnalysis", "profile", "summary", "runtime"]),
        formatDuration(asNumber(estimate.runtimeSeconds))
      ],
      [
        text(["mediaAnalysis", "profile", "summary", "model"]),
        selectedModelLabelKey ? textFromKey(selectedModelLabelKey) : "--"
      ]
    ])}
        ${blockers.length > 0 ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(text(["mediaAnalysis", "profile", "blockersTitle"]))}</strong>
                <ul class="lab-bullet-list">
                  ${blockers.map(function(entry) {
      return `<li>${escapeHtml(entry)}</li>`;
    }).join("")}
                </ul>
              </div>
            ` : ""}
        ${warnings.length > 0 ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(text(["mediaAnalysis", "profile", "warningsTitle"]))}</strong>
                <ul class="lab-bullet-list">
                  ${warnings.slice(0, 4).map(function(entry) {
      return `<li>${escapeHtml(entry)}</li>`;
    }).join("")}
                </ul>
              </div>
            ` : ""}
      </section>
    `;
  }
  function renderProfileReadinessPanel() {
    const readiness = getReadiness();
    const blockers = toStringArray(readiness.blockers);
    const warnings = toStringArray(readiness.warnings);
    const selectedModel = getSelectedModel();
    const selectedModelLabelKey = selectedModel ? asNonEmptyString(selectedModel.labelKey) : null;
    return `
      <section class="lab-panel lab-panel--orientation">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "readinessTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "summaryTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(text(["mediaAnalysis", "profile", "preflightSubtitle"]))}</p>
          </div>
        </div>
        <section class="lab-signal-grid">
          <article class="lab-signal-card">
            <strong>${escapeHtml(
      text([
        "mediaAnalysis",
        "profile",
        "status",
        readiness.stageReady === true ? "ready" : "stale"
      ])
    )}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "preflightTitle"]))}</span>
          </article>
          <article class="lab-signal-card">
            <strong>${escapeHtml(String(blockers.length))}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "blockersTitle"]))}</span>
          </article>
          <article class="lab-signal-card">
            <strong>${escapeHtml(String(warnings.length))}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "warningsTitle"]))}</span>
          </article>
          <article class="lab-signal-card">
            <strong>${escapeHtml(selectedModelLabelKey ? textFromKey(selectedModelLabelKey) : "--")}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "summary", "model"]))}</span>
          </article>
        </section>
      </section>
    `;
  }
  function renderProfileStage() {
    const source = getSource();
    const sourceReady = asNonEmptyString(source.storedPath) !== null;
    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("profile")}
          ${renderProfileReadinessPanel()}
          ${renderProfileTargetPanel()}
          ${renderProfileModePanel()}
          ${renderProfilePresetPanel()}
          ${getProfileMode() === "advanced" ? renderProfileAdvancedPanel() : ""}
          <div class="lab-subgrid lab-subgrid--profile">
            ${renderProfileSignalsPanel()}
            ${renderProfileArtifactsPanel()}
            ${renderProfileActionsPanel()}
          </div>
          ${sourceReady !== true ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "profile", "sourceRequired"]))}</div>` : ""}
        </section>
        <aside class="lab-side-stack">
          ${renderProfileSummaryPanel()}
        </aside>
      </div>
    `;
  }
  return {
    renderProfileActionsPanel,
    renderProfileArtifactsPanel,
    renderProfileModePanel,
    renderProfileReadinessPanel,
    renderProfileSignalsPanel,
    renderProfileStage,
    renderProfileSummaryPanel,
    renderProfileTargetPanel
  };
}
