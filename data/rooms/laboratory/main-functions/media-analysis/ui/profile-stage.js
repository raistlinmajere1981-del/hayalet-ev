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
  function looksLikeVerboseToolOutput(message) {
    if (message === null) {
      return false;
    }
    return message.length > 180 || message.includes("\n") || /ffmpeg version|configuration:|libav|(^|\s)-i\s|scale=|crop=|--[a-z0-9-]+|aac\b|h264\b/i.test(
      message
    );
  }
  function getSafeJobMessage(message) {
    if (message === null || looksLikeVerboseToolOutput(message)) {
      return null;
    }
    return message;
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
      <section class="lab-panel lab-panel--support-canvas lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "targetTitle"]))}</h2>
            <p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "targetSubtitle"]))}</p>
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
        <div class="lab-preview-card lab-preview-card--source lab-profile-preview-card">
          <div class="lab-preview-frame">${mediaMarkup}</div>
          <div class="lab-preview-copy lab-preview-copy--details">
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
        </div>
      </section>
    `;
  }
  function renderProfileModePanel() {
    const mode = getProfileMode();
    const estimate = getEstimate();
    return `
      <section class="lab-panel lab-panel--orientation">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "modeTitle"]))}</h2>
            <p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "modeSubtitle"]))}</p>
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
        <section class="lab-summary-cards lab-profile-mode-metrics">
          <article class="lab-signal-card">
            <strong>${escapeHtml(getProfileLabel())}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "summary", "preset"]))}</span>
          </article>
          <article class="lab-signal-card">
            <strong>${escapeHtml(formatDuration(asNumber(estimate.sampleWindowSeconds)))}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "summary", "sampleWindow"]))}</span>
          </article>
          <article class="lab-signal-card">
            <strong>${escapeHtml(formatDuration(asNumber(estimate.runtimeSeconds)))}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "summary", "runtime"]))}</span>
          </article>
        </section>
      </section>
    `;
  }
  function renderProfileSignalsPanel() {
    const signals = sortProfileSignals(getSignals());
    return `
      <section class="lab-panel lab-panel--dense">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "signalsTitle"]))}</h2>
            <p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "signalsSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-profile-insight-list">
          ${signals.length > 0 ? signals.map(function(signal) {
      const signalTitle = asNonEmptyString(signal.title) || asNonEmptyString(signal.laneId) || "--";
      const signalLevel = asNonEmptyString(signal.level) || "low";
      const signalDetail = asNonEmptyString(signal.detail) || "";
      return `
                      <article class="lab-profile-insight">
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
                        ${signalDetail !== "" ? `<p class="lab-finding__detail">${escapeHtml(signalDetail)}</p>` : ""}
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
      <section class="lab-panel lab-panel--dense">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsTitle"]))}</h2>
            <p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-profile-artifact-list">
          ${artifacts.length > 0 ? artifacts.map(function(artifact) {
      const artifactLabel = asNonEmptyString(artifact.label) || asNonEmptyString(artifact.fileName) || asNonEmptyString(artifact.kind) || "--";
      const artifactMeta = asNonEmptyString(artifact.fileName) || asNonEmptyString(artifact.kind) || "--";
      return `
                      <article class="lab-profile-artifact">
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
    const blockers = toStringArray(readiness.blockers);
    const selectedModel = getSelectedModel();
    const selectedModelReady = selectedModel ? selectedModel.ready === true : false;
    const safeJobMessage = runningJob ? getSafeJobMessage(asNonEmptyString(runningJob.message)) : null;
    return `
      <section class="lab-panel lab-panel--orientation">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "preflightTitle"]))}</h2>
            <p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "preflightSubtitle"]))}</p>
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
        ${readiness.stageReady !== true ? `
              <p class="lab-panel__hint">${escapeHtml(
      blockers[0] || (selectedModelReady !== true ? text(["mediaAnalysis", "profile", "modelVerificationHint"]) : text(["workbench", "stageGuards", "profileRequired"]))
    )}</p>
            ` : ""}
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
        ${safeJobMessage ? `<p class="lab-panel__hint">${escapeHtml(safeJobMessage)}</p>` : ""}
      </section>
    `;
  }
  function renderProfileSummaryPanel() {
    const readiness = getReadiness();
    const estimate = getEstimate();
    const signals = getSignals();
    const artifacts = getArtifacts();
    const selectedModel = getSelectedModel();
    const selectedModelLabelKey = selectedModel ? asNonEmptyString(selectedModel.labelKey) : null;
    const blockers = toStringArray(readiness.blockers);
    const warnings = toStringArray(readiness.warnings);
    const statusId = readiness.stageReady === true ? "ready" : "stale";
    const summaryHint = blockers[0] || warnings[0] || "";
    const enabledLaneCount = asNumber(readiness.enabledLaneCount) || 0;
    return `
      <section class="lab-panel lab-panel--dense">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "summaryTitle"]))}</h2>
          </div>
        </div>
        ${renderSummaryRows([
      [text(["mediaAnalysis", "profile", "summary", "target"]), getFocusLabel()],
      [
        text(["mediaAnalysis", "shared", "status"]),
        text(["mediaAnalysis", "profile", "status", statusId])
      ],
      [text(["mediaAnalysis", "profile", "summary", "preset"]), getProfileLabel()],
      [
        text(["mediaAnalysis", "profile", "summary", "model"]),
        selectedModelLabelKey ? textFromKey(selectedModelLabelKey) : "--"
      ],
      [
        text(["mediaAnalysis", "profile", "summary", "sampleWindow"]),
        formatDuration(asNumber(estimate.sampleWindowSeconds))
      ],
      [
        text(["mediaAnalysis", "profile", "summary", "runtime"]),
        formatDuration(asNumber(estimate.runtimeSeconds))
      ],
      [text(["mediaAnalysis", "profile", "summary", "lanes"]), String(enabledLaneCount)],
      [text(["mediaAnalysis", "profile", "summary", "signals"]), String(signals.length)],
      [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(artifacts.length)],
      [text(["mediaAnalysis", "profile", "blockersTitle"]), String(blockers.length)],
      [text(["mediaAnalysis", "profile", "warningsTitle"]), String(warnings.length)]
    ])}
        ${summaryHint !== "" ? `<p class="lab-panel__hint">${escapeHtml(summaryHint)}</p>` : `<p class="lab-panel__hint">${escapeHtml(text(["workbench", "readyHint"]))}</p>`}
      </section>
    `;
  }
  function renderProfileReadinessPanel() {
    const readiness = getReadiness();
    const blockers = toStringArray(readiness.blockers);
    const warnings = toStringArray(readiness.warnings);
    const selectedModel = getSelectedModel();
    const selectedModelLabelKey = selectedModel ? asNonEmptyString(selectedModel.labelKey) : null;
    const enabledLaneCount = asNumber(readiness.enabledLaneCount) || 0;
    const statusLabel = text([
      "mediaAnalysis",
      "profile",
      "status",
      readiness.stageReady === true ? "ready" : "stale"
    ]);
    const alertMarkup = blockers.length > 0 || warnings.length > 0 ? `
            <div class="lab-profile-alert-list">
              ${blockers[0] ? `
                    <article class="lab-profile-alert" data-tone="danger">
                      <strong>${escapeHtml(text(["mediaAnalysis", "profile", "blockersTitle"]))}</strong>
                      <span>${escapeHtml(blockers[0])}</span>
                    </article>
                  ` : ""}
              ${warnings[0] ? `
                    <article class="lab-profile-alert" data-tone="warning">
                      <strong>${escapeHtml(text(["mediaAnalysis", "profile", "warningsTitle"]))}</strong>
                      <span>${escapeHtml(warnings[0])}</span>
                    </article>
                  ` : ""}
            </div>
          ` : `<p class="lab-panel__hint">${escapeHtml(text(["workbench", "readyHint"]))}</p>`;
    return `
      <section class="lab-panel lab-panel--orientation">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "readinessTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "summaryTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(text(["mediaAnalysis", "profile", "preflightSubtitle"]))}</p>
          </div>
        </div>
        <section class="lab-summary-cards lab-profile-summary-cards">
          <article class="lab-signal-card">
            <strong>${escapeHtml(statusLabel)}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "summary", "preflight"]))}</span>
          </article>
          <article class="lab-signal-card">
            <strong>${escapeHtml(getFocusLabel())}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "summary", "target"]))}</span>
          </article>
          <article class="lab-signal-card">
            <strong>${escapeHtml(String(enabledLaneCount))}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "summary", "lanes"]))}</span>
          </article>
          <article class="lab-signal-card">
            <strong>${escapeHtml(selectedModelLabelKey ? textFromKey(selectedModelLabelKey) : "--")}</strong>
            <span>${escapeHtml(text(["mediaAnalysis", "profile", "summary", "model"]))}</span>
          </article>
        </section>
        ${alertMarkup}
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
          ${renderProfileModePanel()}
          ${getProfileMode() === "advanced" ? renderProfileAdvancedPanel() : renderProfilePresetPanel()}
          ${sourceReady !== true ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "profile", "sourceRequired"]))}</div>` : ""}
        </section>
        <aside class="lab-side-stack lab-side-stack--profile">
          ${renderProfileTargetPanel()}
          ${renderProfileSummaryPanel()}
          ${renderProfileActionsPanel()}
          ${renderProfileSignalsPanel()}
          ${renderProfileArtifactsPanel()}
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
