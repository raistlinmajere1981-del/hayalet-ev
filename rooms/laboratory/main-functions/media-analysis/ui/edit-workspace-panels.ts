import type { createLaboratoryUiBootstrapStateRuntime } from "../../../ui/bootstrap-state-runtime.js";
import type {
  LaboratoryMediaAnalysisAsset,
  LaboratoryMediaAnalysisEditDraftRecord,
  LaboratoryMediaAnalysisEditPreviewRecord,
  LaboratoryMediaAnalysisEditRecipeRecord,
  LaboratoryMediaAnalysisProjectSourceRecord,
  LaboratoryMediaAnalysisSourceKind,
} from "./source-edit-runtime.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratoryCropRecord = LaboratoryRecord & {
  height?: unknown;
  width?: unknown;
  x?: unknown;
  y?: unknown;
};

type LaboratoryAssetMetadataRecord = LaboratoryRecord & {
  codec?: unknown;
  durationSeconds?: unknown;
  formatName?: unknown;
  height?: unknown;
  width?: unknown;
};

type LaboratoryFocusRegionRecord = LaboratoryRecord & {
  labelKey?: unknown;
};

type LaboratoryEditStageJobRecord = LaboratoryRecord & {
  action?: unknown;
  message?: unknown;
  percent?: unknown;
  stage?: unknown;
};

type LaboratoryRelevantJobsRecord = LaboratoryRecord & {
  project?: unknown;
};

type LaboratoryEditTextFieldOptions = {
  placeholder?: string;
};

type MediaAnalysisEditWorkspacePanelsDeps = {
  collectEditStageJobs: (projectJobs: unknown[]) => LaboratoryEditStageJobRecord[];
  escapeHtml: (value: string) => string;
  formatDuration: (value: number | null | undefined) => string;
  getCurrentEditDraft: () => LaboratoryMediaAnalysisEditDraftRecord;
  getCurrentEditPresetOptions: () => LaboratoryRecord[];
  getCurrentEditRecipe: () => LaboratoryMediaAnalysisEditRecipeRecord;
  getCurrentFocusRegionId: () => string;
  getCurrentSourceKind: () => LaboratoryMediaAnalysisSourceKind;
  getEditJobLabel: (job: LaboratoryEditStageJobRecord) => string;
  getEditPresets: () => LaboratoryRecord;
  getEditPreview: () => LaboratoryMediaAnalysisEditPreviewRecord;
  getEffectiveMediaAsset: () => LaboratoryMediaAnalysisAsset;
  getPreferredSourceCodec: () => string;
  getPreferredSourceDuration: (previewUrl: string | null) => number | null;
  getPreferredSourceFormat: () => string;
  getPreferredSourceResolution: (previewUrl: string | null) => string;
  getProjectSource: () => LaboratoryMediaAnalysisProjectSourceRecord;
  getRelevantJobs: () => LaboratoryRelevantJobsRecord;
  renderEditTextField: (
    fieldId: string,
    value: string | number,
    label: string,
    extra?: LaboratoryEditTextFieldOptions
  ) => string;
  renderPreviewMetaRow: (label: string, value: string) => string;
  state: LaboratoryUiState;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createMediaAnalysisEditWorkspacePanels(deps: MediaAnalysisEditWorkspacePanelsDeps) {
  const {
    collectEditStageJobs,
    escapeHtml,
    formatDuration,
    getCurrentEditDraft,
    getCurrentEditPresetOptions,
    getCurrentEditRecipe,
    getCurrentFocusRegionId,
    getCurrentSourceKind,
    getEditJobLabel,
    getEditPresets,
    getEditPreview,
    getEffectiveMediaAsset,
    getPreferredSourceCodec,
    getPreferredSourceDuration,
    getPreferredSourceFormat,
    getPreferredSourceResolution,
    getProjectSource,
    getRelevantJobs,
    renderEditTextField,
    renderPreviewMetaRow,
    state,
    text,
    textFromKey,
    toRecord,
  } = deps;

  function asRecord(value: unknown): LaboratoryRecord {
    return toRecord(value);
  }

  function asNonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }

  function asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function toCropRecord(value: unknown): LaboratoryCropRecord {
    return asRecord(value);
  }

  function toAssetMetadataRecord(value: unknown): LaboratoryAssetMetadataRecord {
    return asRecord(value);
  }

  function toFocusRegionRecord(value: unknown): LaboratoryFocusRegionRecord {
    return asRecord(value);
  }

  function toEditStageJobRecord(value: unknown): LaboratoryEditStageJobRecord {
    return asRecord(value);
  }

  function getCropPercent(value: unknown, minimumPercent: number) {
    return Math.max(minimumPercent, (asNumber(value) || 0) * 100);
  }

  function getAudioBars(previewUrl: string) {
    const audioAnalysis = state.ui.audioAnalysis;
    if (audioAnalysis.url === previewUrl && audioAnalysis.bars.length > 0) {
      return audioAnalysis.bars;
    }

    return Array.from({ length: 42 }, function (_, index) {
      return 16 + ((index * 11) % 36);
    });
  }

  function getSpectrogramPreviewUrl(asset: LaboratoryMediaAnalysisAsset) {
    const spectrogram =
      asset.artifacts.find(function (entry) {
        return (
          asNonEmptyString(entry.kind) === "spectrogram" &&
          asNonEmptyString(entry.previewUrl) !== null
        );
      }) || null;
    return spectrogram ? asNonEmptyString(spectrogram.previewUrl) : null;
  }

  function renderEditMediaMarkup(asset: LaboratoryMediaAnalysisAsset, cropNormalized: unknown) {
    const previewUrl = asNonEmptyString(asset.previewUrl);
    if (previewUrl === null) {
      return `
        <div class="lab-empty-preview">
          <strong>${escapeHtml(text(["mediaAnalysis", "edit", "previewEmptyTitle"]))}</strong>
          <p>${escapeHtml(text(["mediaAnalysis", "edit", "previewEmptyBody"]))}</p>
        </div>
      `;
    }

    const kind = getCurrentSourceKind();
    const crop = toCropRecord(cropNormalized);
    const focusStyle =
      kind === "audio"
        ? ""
        : `style="left:${getCropPercent(crop.x, 0)}%; top:${getCropPercent(
            crop.y,
            0
          )}%; width:${getCropPercent(crop.width, 2)}%; height:${getCropPercent(
            crop.height,
            2
          )}%;"`;

    if (kind === "image") {
      return `
        <img class="lab-preview-media lab-preview-media--image" data-preview-media="image" src="${previewUrl}" alt="" />
        <div class="lab-edit-overlay__focus" ${focusStyle}></div>
      `;
    }

    if (kind === "audio") {
      const bars = getAudioBars(previewUrl);
      const spectrogramPreviewUrl = getSpectrogramPreviewUrl(asset);
      return `
        <div class="lab-audio-workbench">
          ${spectrogramPreviewUrl ? `<img class="lab-audio-spectrogram" src="${spectrogramPreviewUrl}" alt="" />` : ""}
          <div class="lab-audio-bars">
            ${bars
              .map(function (height) {
                return `<span style="height:${height}px"></span>`;
              })
              .join("")}
          </div>
          <audio class="lab-preview-media lab-preview-media--audio" data-preview-media="audio" src="${previewUrl}" controls preload="metadata"></audio>
        </div>
      `;
    }

    return `
      <video class="lab-preview-media lab-preview-media--video" data-preview-media="video" src="${previewUrl}" controls preload="metadata"></video>
      <div class="lab-edit-overlay__focus" ${focusStyle}></div>
    `;
  }

  function renderEditPresetChooser() {
    const presetOptions = getCurrentEditPresetOptions();
    const activePresetId = asNonEmptyString(getCurrentEditDraft().activePresetId);

    if (presetOptions.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "presetTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "presetSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-chip-row">
          ${presetOptions
            .map(function (preset) {
              const presetId = asNonEmptyString(preset["id"]) || "";
              const labelKey = asNonEmptyString(preset["labelKey"]);
              return `
                <button
                  class="lab-choice-chip"
                  type="button"
                  data-action="edit-preset"
                  data-value="${escapeHtml(presetId)}"
                  data-selected="${presetId === activePresetId ? "true" : "false"}"
                >
                  ${escapeHtml(labelKey ? textFromKey(labelKey) : presetId)}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderEditWorkspacePanel() {
    const source = getProjectSource();
    const recipe = getCurrentEditRecipe();
    const common = asRecord(recipe.common);
    const asset = getEffectiveMediaAsset();
    const preview = getEditPreview();
    const relevantJobs = getRelevantJobs();
    const projectJobs: unknown[] = Array.isArray(relevantJobs["project"])
      ? (relevantJobs["project"] as unknown[])
      : [];
    const activeEditJobs = collectEditStageJobs(projectJobs).map(toEditStageJobRecord);
    const assetMetadata = toAssetMetadataRecord(asset.metadata);
    const assetLabel = asset.label || text(["mediaAnalysis", "edit", "sourceAsset"]);
    const previewStatus =
      asNonEmptyString(preview.status) || text(["mediaAnalysis", "shared", "idle"]);
    const sourceStatus = source.status === "error" ? "error" : "ready";
    const durationValue =
      asNumber(assetMetadata.durationSeconds) ||
      getPreferredSourceDuration(asNonEmptyString(asset.previewUrl));
    const resolutionValue =
      asNumber(assetMetadata.width) !== null && asNumber(assetMetadata.height) !== null
        ? `${asNumber(assetMetadata.width)} x ${asNumber(assetMetadata.height)}`
        : getPreferredSourceResolution(asNonEmptyString(getProjectSource().previewUrl));
    const codecValue = asNonEmptyString(assetMetadata.codec) || getPreferredSourceCodec();
    const formatValue =
      asNonEmptyString(assetMetadata.formatName) ||
      asNonEmptyString(asset.mimeType) ||
      getPreferredSourceFormat();

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "workspaceTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(assetLabel)}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              asNonEmptyString(preview.status) === "stale"
                ? text(["mediaAnalysis", "edit", "previewStates", "stale"])
                : text(["mediaAnalysis", "edit", "workspaceHint"])
            )}</p>
          </div>
          <span class="lab-chip">${escapeHtml(text(["mediaAnalysis", "settings", "status", sourceStatus]))}</span>
        </div>
        <div class="lab-preview-card">
          <div class="lab-preview-frame lab-edit-frame">
            ${renderEditMediaMarkup(asset, common["cropNormalized"])}
          </div>
          <div class="lab-preview-copy">
            <ul class="lab-meta-list">
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "status"]), previewStatus)}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "duration"]), formatDuration(durationValue))}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "resolution"]), resolutionValue)}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "codec"]), codecValue)}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "format"]), formatValue)}
            </ul>
            ${
              activeEditJobs.length > 0
                ? `
                  <div class="lab-status-stack">
                    ${activeEditJobs
                      .map(function (activeEditJob) {
                        const progressLabel =
                          asNumber(activeEditJob.percent) !== null
                            ? `${Math.round(asNumber(activeEditJob.percent) || 0)}%`
                            : asNonEmptyString(activeEditJob.stage) || "--";
                        const progressWidth = Math.max(6, asNumber(activeEditJob.percent) || 8);
                        const message =
                          asNonEmptyString(activeEditJob.message) ||
                          asNonEmptyString(activeEditJob.action) ||
                          "";
                        return `
                          <div class="lab-status-card">
                            <div class="lab-status-card__head">
                              <strong>${escapeHtml(getEditJobLabel(activeEditJob))}</strong>
                              <span>${escapeHtml(progressLabel)}</span>
                            </div>
                            <div class="lab-progress-bar">
                              <span style="width:${progressWidth}%"></span>
                            </div>
                            <p class="lab-status-card__body">${escapeHtml(message)}</p>
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                `
                : ""
            }
          </div>
        </div>
      </section>
    `;
  }

  function renderEditCommonPanel() {
    const kind = getCurrentSourceKind();
    const common = asRecord(getCurrentEditRecipe().common);
    const focusRegions = asRecord(getEditPresets()["focusRegions"]);

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "commonTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "commonSubtitle"]))}</h2>
          </div>
        </div>
        ${
          kind !== "audio"
            ? `
          <div class="lab-chip-row">
            ${Object.keys(focusRegions)
              .map(function (regionId) {
                const focusRegion = toFocusRegionRecord(focusRegions[regionId]);
                const labelKey = asNonEmptyString(focusRegion.labelKey);
                return `
                  <button
                    class="lab-choice-chip"
                    type="button"
                    data-action="edit-focus-region"
                    data-value="${regionId}"
                    data-selected="${regionId === getCurrentFocusRegionId() ? "true" : "false"}"
                  >
                    ${escapeHtml(labelKey ? textFromKey(labelKey) : regionId)}
                  </button>
                `;
              })
              .join("")}
          </div>
        `
            : ""
        }
        <div class="lab-form-grid">
          ${renderEditTextField(
            "recipe.common.outputNameHint",
            asNonEmptyString(common["outputNameHint"]) || "",
            text(["mediaAnalysis", "edit", "fields", "outputNameHint"]),
            { placeholder: text(["mediaAnalysis", "edit", "placeholders", "outputNameHint"]) }
          )}
          ${renderEditTextField(
            "recipe.common.notes",
            asNonEmptyString(common["notes"]) || "",
            text(["mediaAnalysis", "edit", "fields", "notes"]),
            { placeholder: text(["mediaAnalysis", "edit", "placeholders", "notes"]) }
          )}
        </div>
      </section>
    `;
  }

  return {
    renderEditCommonPanel,
    renderEditMediaMarkup,
    renderEditPresetChooser,
    renderEditWorkspacePanel,
  };
}
