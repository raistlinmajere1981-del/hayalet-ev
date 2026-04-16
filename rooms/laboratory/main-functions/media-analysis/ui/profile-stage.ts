type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProfileMode = "advanced" | "beginner";
type LaboratoryTargetMode = "derived" | "source";
type LaboratoryTargetAssetKind = "audio" | "image" | "video";

type LaboratoryMediaAnalysisUiStateRecord = LaboratoryRecord & {
  audioAnalysis?: unknown;
};

type LaboratoryMediaAnalysisStateRecord = LaboratoryRecord & {
  ui?: unknown;
};

type LaboratoryAudioAnalysisStateRecord = LaboratoryRecord & {
  bars?: unknown;
};

type LaboratoryProfileEstimateRecord = LaboratoryRecord & {
  runtimeSeconds?: unknown;
  sampleWindowSeconds?: unknown;
};

type LaboratoryProfileSignalRecord = LaboratoryRecord & {
  confidence?: unknown;
  detail?: unknown;
  evidenceCount?: unknown;
  kind?: unknown;
  laneId?: unknown;
  level?: unknown;
  title?: unknown;
};

type LaboratoryProfileArtifactRecord = LaboratoryRecord & {
  fileName?: unknown;
  kind?: unknown;
  label?: unknown;
  previewUrl?: unknown;
};

type LaboratoryProfileReadinessRecord = LaboratoryRecord & {
  blockers?: unknown;
  enabledLaneCount?: unknown;
  stageReady?: unknown;
  warnings?: unknown;
};

type LaboratoryProfilePreflightRecord = LaboratoryRecord & {
  status?: unknown;
};

type LaboratoryProfileJobRecord = LaboratoryRecord & {
  action?: unknown;
  message?: unknown;
  stage?: unknown;
};

type LaboratoryProfileSelectedModelRecord = LaboratoryRecord & {
  labelKey?: unknown;
  ready?: unknown;
};

type LaboratoryProjectSourceRecord = LaboratoryRecord & {
  storedPath?: unknown;
};

type LaboratoryProfileTargetSummaryRecord = LaboratoryRecord & {
  outputId?: unknown;
  reason?: unknown;
  usingFallback?: unknown;
};

type LaboratoryProfileTargetAssetRecord = LaboratoryRecord & {
  fileName?: unknown;
  kind?: unknown;
  label?: unknown;
  previewUrl?: unknown;
};

type LaboratoryProfileTargetOutputOptionRecord = LaboratoryRecord & {
  fileName?: unknown;
  id?: unknown;
  label?: unknown;
};

type LaboratorySummaryRow = [string, string];

type MediaAnalysisProfileStageDeps = {
  escapeHtml: (value: string) => string;
  formatDuration: (value: number | null | undefined) => string;
  getCurrentProfileMode: () => unknown;
  getFocusLabel: () => string;
  getPreferredAssetCodec: (asset: LaboratoryProfileTargetAssetRecord) => unknown;
  getPreferredAssetDuration: (asset: LaboratoryProfileTargetAssetRecord) => unknown;
  getPreferredAssetResolution: (asset: LaboratoryProfileTargetAssetRecord) => unknown;
  getProfileArtifacts: () => unknown;
  getProfileConfidenceLabel: (confidence: unknown) => string;
  getProfileEstimate: () => unknown;
  getProfileJobs: () => unknown;
  getProfileLabel: () => string;
  getProfilePreflight: () => unknown;
  getProfileReadiness: () => unknown;
  getProfileSelectedModel: () => unknown;
  getProfileSignalKindLabel: (kind: unknown) => string;
  getProfileSignals: () => unknown;
  getProfileTargetAsset: () => unknown;
  getProfileTargetMode: () => unknown;
  getProfileTargetOutputOptions: () => unknown;
  getProfileTargetSummary: () => unknown;
  getProjectSource: () => unknown;
  renderProfileAdvancedPanel: () => string;
  renderProfilePresetPanel: () => string;
  renderStageIntro: (stageId: string) => string;
  renderSummaryRows: (rows: LaboratorySummaryRow[]) => string;
  sortProfileSignals: (signals: LaboratoryProfileSignalRecord[]) => LaboratoryProfileSignalRecord[];
  state: LaboratoryMediaAnalysisStateRecord;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
};

export function createMediaAnalysisProfileStage(deps: MediaAnalysisProfileStageDeps) {
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
    textFromKey,
  } = deps;

  function toRecord(value: unknown): LaboratoryRecord {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value as LaboratoryRecord;
  }

  function asNonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }

  function asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return asNonEmptyString(entry);
      })
      .filter((entry): entry is string => entry !== null);
  }

  function toNumberArray(value: unknown): number[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return asNumber(entry);
      })
      .filter((entry): entry is number => entry !== null);
  }

  function toUiStateRecord(value: unknown): LaboratoryMediaAnalysisUiStateRecord {
    return toRecord(value);
  }

  function toAudioAnalysisStateRecord(value: unknown): LaboratoryAudioAnalysisStateRecord {
    return toRecord(value);
  }

  function toProfileEstimateRecord(value: unknown): LaboratoryProfileEstimateRecord {
    return toRecord(value);
  }

  function toProfileSignalRecord(value: unknown): LaboratoryProfileSignalRecord {
    return toRecord(value);
  }

  function toProfileArtifactRecord(value: unknown): LaboratoryProfileArtifactRecord {
    return toRecord(value);
  }

  function toProfileReadinessRecord(value: unknown): LaboratoryProfileReadinessRecord {
    return toRecord(value);
  }

  function toProfilePreflightRecord(value: unknown): LaboratoryProfilePreflightRecord {
    return toRecord(value);
  }

  function toProfileJobRecord(value: unknown): LaboratoryProfileJobRecord {
    return toRecord(value);
  }

  function toProfileSelectedModelRecord(value: unknown): LaboratoryProfileSelectedModelRecord {
    return toRecord(value);
  }

  function toProjectSourceRecord(value: unknown): LaboratoryProjectSourceRecord {
    return toRecord(value);
  }

  function toProfileTargetSummaryRecord(value: unknown): LaboratoryProfileTargetSummaryRecord {
    return toRecord(value);
  }

  function toProfileTargetAssetRecord(value: unknown): LaboratoryProfileTargetAssetRecord {
    return toRecord(value);
  }

  function toProfileTargetOutputOptionRecord(
    value: unknown
  ): LaboratoryProfileTargetOutputOptionRecord {
    return toRecord(value);
  }

  function getProfileMode(): LaboratoryProfileMode {
    return getCurrentProfileMode() === "advanced" ? "advanced" : "beginner";
  }

  function getEstimate(): LaboratoryProfileEstimateRecord {
    return toProfileEstimateRecord(getProfileEstimate());
  }

  function getSignals(): LaboratoryProfileSignalRecord[] {
    const signals = getProfileSignals();
    return Array.isArray(signals) ? signals.map(toProfileSignalRecord) : [];
  }

  function getArtifacts(): LaboratoryProfileArtifactRecord[] {
    const artifacts = getProfileArtifacts();
    return Array.isArray(artifacts) ? artifacts.map(toProfileArtifactRecord) : [];
  }

  function getReadiness(): LaboratoryProfileReadinessRecord {
    return toProfileReadinessRecord(getProfileReadiness());
  }

  function getPreflight(): LaboratoryProfilePreflightRecord {
    return toProfilePreflightRecord(getProfilePreflight());
  }

  function getJobs(): LaboratoryProfileJobRecord[] {
    const jobs = getProfileJobs();
    return Array.isArray(jobs) ? jobs.map(toProfileJobRecord) : [];
  }

  function getSelectedModel(): LaboratoryProfileSelectedModelRecord | null {
    const model = getProfileSelectedModel();
    return model ? toProfileSelectedModelRecord(model) : null;
  }

  function getSource(): LaboratoryProjectSourceRecord {
    return toProjectSourceRecord(getProjectSource());
  }

  function getTargetSummary(): LaboratoryProfileTargetSummaryRecord {
    return toProfileTargetSummaryRecord(getProfileTargetSummary());
  }

  function getTargetAsset(): LaboratoryProfileTargetAssetRecord {
    return toProfileTargetAssetRecord(getProfileTargetAsset());
  }

  function getTargetMode(): LaboratoryTargetMode {
    return getProfileTargetMode() === "derived" ? "derived" : "source";
  }

  function getTargetOutputOptions(): LaboratoryProfileTargetOutputOptionRecord[] {
    const options = getProfileTargetOutputOptions();
    return Array.isArray(options) ? options.map(toProfileTargetOutputOptionRecord) : [];
  }

  function getAudioBars(): number[] {
    const uiState = toUiStateRecord(state.ui);
    const audioAnalysis = toAudioAnalysisStateRecord(uiState.audioAnalysis);
    return toNumberArray(audioAnalysis.bars);
  }

  function getAudioBarsForPreview(): number[] {
    const audioBars = getAudioBars();
    return audioBars.length > 0
      ? audioBars
      : Array.from({ length: 36 }, function () {
          return 20;
        });
  }

  function getTargetAssetKind(
    asset: LaboratoryProfileTargetAssetRecord
  ): LaboratoryTargetAssetKind {
    const assetKind = asNonEmptyString(asset.kind);
    if (assetKind === "image" || assetKind === "audio") {
      return assetKind;
    }
    return "video";
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

  function getSafeJobMessage(message: string | null): string | null {
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
              ${audioBars
                .map(function (value) {
                  return `<span style="height:${Math.max(10, value)}px"></span>`;
                })
                .join("")}
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
                      const entryId = asNonEmptyString(entry.id) || "";
                      const entryLabel =
                        asNonEmptyString(entry.label) ||
                        asNonEmptyString(entry.fileName) ||
                        entryId ||
                        "--";
                      return `
                        <option value="${escapeHtml(entryId)}" ${entryId === asNonEmptyString(target.outputId) ? "selected" : ""}>
                          ${escapeHtml(entryLabel)}
                        </option>
                      `;
                    })
                    .join("")}
                </select>
              </label>
            `
            : ""
        }
        <div class="lab-preview-card lab-preview-card--source lab-profile-preview-card">
          <div class="lab-preview-frame">${mediaMarkup}</div>
          <div class="lab-preview-copy lab-preview-copy--details">
            <section class="lab-panel lab-panel--dense">
              ${renderSummaryRows([
                [
                  text(["mediaAnalysis", "profile", "summary", "target"]),
                  asNonEmptyString(asset.label) || "--",
                ],
                [
                  text(["mediaAnalysis", "shared", "duration"]),
                  formatDuration(asNumber(getPreferredAssetDuration(asset))),
                ],
                [
                  text(["mediaAnalysis", "shared", "resolution"]),
                  asNonEmptyString(getPreferredAssetResolution(asset)) || "--",
                ],
                [
                  text(["mediaAnalysis", "shared", "codec"]),
                  asNonEmptyString(getPreferredAssetCodec(asset)) || "--",
                ],
              ])}
              ${
                target.usingFallback === true && asNonEmptyString(target.reason)
                  ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(asNonEmptyString(target.reason) || "")}</p>`
                  : ""
              }
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
          ${
            signals.length > 0
              ? signals
                  .map(function (signal) {
                    const signalTitle =
                      asNonEmptyString(signal.title) || asNonEmptyString(signal.laneId) || "--";
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
                        ${
                          signalDetail !== ""
                            ? `<p class="lab-finding__detail">${escapeHtml(signalDetail)}</p>`
                            : ""
                        }
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
          ${
            artifacts.length > 0
              ? artifacts
                  .map(function (artifact) {
                    const artifactLabel =
                      asNonEmptyString(artifact.label) ||
                      asNonEmptyString(artifact.fileName) ||
                      asNonEmptyString(artifact.kind) ||
                      "--";
                    const artifactMeta =
                      asNonEmptyString(artifact.fileName) ||
                      asNonEmptyString(artifact.kind) ||
                      "--";
                    return `
                      <article class="lab-profile-artifact">
                        <strong>${escapeHtml(artifactLabel)}</strong>
                        <span>${escapeHtml(artifactMeta)}</span>
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
    const jobs = getJobs();
    return (
      jobs.find(function (job) {
        return (
          asNonEmptyString(job.action) === "profile-run-preflight" &&
          !["completed", "failed", "cancelled"].includes(asNonEmptyString(job.stage) || "")
        );
      }) || null
    );
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
    const safeJobMessage = runningJob
      ? getSafeJobMessage(asNonEmptyString(runningJob.message))
      : null;
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
              asNonEmptyString(preflight.status) || "idle",
            ]),
          ],
          [text(["mediaAnalysis", "profile", "summary", "signals"]), String(signals.length)],
          [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(artifacts.length)],
          [
            text(["mediaAnalysis", "profile", "summary", "runtime"]),
            formatDuration(asNumber(estimate.runtimeSeconds)),
          ],
        ])}
        ${
          readiness.stageReady !== true
            ? `
              <p class="lab-panel__hint">${escapeHtml(
                blockers[0] ||
                  (selectedModelReady !== true
                    ? text(["mediaAnalysis", "profile", "modelVerificationHint"])
                    : text(["workbench", "stageGuards", "profileRequired"]))
              )}</p>
            `
            : ""
        }
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
            data-action="open-settings"
          >
            ${escapeHtml(text(["workbench", "dependencyAction"]))}
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
            text(["mediaAnalysis", "profile", "status", statusId]),
          ],
          [text(["mediaAnalysis", "profile", "summary", "preset"]), getProfileLabel()],
          [
            text(["mediaAnalysis", "profile", "summary", "model"]),
            selectedModelLabelKey ? textFromKey(selectedModelLabelKey) : "--",
          ],
          [
            text(["mediaAnalysis", "profile", "summary", "sampleWindow"]),
            formatDuration(asNumber(estimate.sampleWindowSeconds)),
          ],
          [
            text(["mediaAnalysis", "profile", "summary", "runtime"]),
            formatDuration(asNumber(estimate.runtimeSeconds)),
          ],
          [text(["mediaAnalysis", "profile", "summary", "lanes"]), String(enabledLaneCount)],
          [text(["mediaAnalysis", "profile", "summary", "signals"]), String(signals.length)],
          [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(artifacts.length)],
          [text(["mediaAnalysis", "profile", "blockersTitle"]), String(blockers.length)],
          [text(["mediaAnalysis", "profile", "warningsTitle"]), String(warnings.length)],
        ])}
        ${
          summaryHint !== ""
            ? `<p class="lab-panel__hint">${escapeHtml(summaryHint)}</p>`
            : `<p class="lab-panel__hint">${escapeHtml(text(["workbench", "readyHint"]))}</p>`
        }
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
      readiness.stageReady === true ? "ready" : "stale",
    ]);
    const alertMarkup =
      blockers.length > 0 || warnings.length > 0
        ? `
            <div class="lab-profile-alert-list">
              ${
                blockers[0]
                  ? `
                    <article class="lab-profile-alert" data-tone="danger">
                      <strong>${escapeHtml(text(["mediaAnalysis", "profile", "blockersTitle"]))}</strong>
                      <span>${escapeHtml(blockers[0])}</span>
                    </article>
                  `
                  : ""
              }
              ${
                warnings[0]
                  ? `
                    <article class="lab-profile-alert" data-tone="warning">
                      <strong>${escapeHtml(text(["mediaAnalysis", "profile", "warningsTitle"]))}</strong>
                      <span>${escapeHtml(warnings[0])}</span>
                    </article>
                  `
                  : ""
              }
            </div>
          `
        : `<p class="lab-panel__hint">${escapeHtml(text(["workbench", "readyHint"]))}</p>`;

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
          ${
            sourceReady !== true
              ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "profile", "sourceRequired"]))}</div>`
              : ""
          }
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
    renderProfileTargetPanel,
  };
}
