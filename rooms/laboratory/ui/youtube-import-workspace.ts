import { escapeHtml } from "../models/lab-types.js";
import type {
  LabStoreState,
  LabYoutubeImportCustomFormat,
  LabYoutubeImportCustomResolution,
  LabYoutubeImportPreview,
  LabYoutubeImportStrategy,
} from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

const YOUTUBE_IMPORT_STRATEGIES: LabYoutubeImportStrategy[] = [
  "video_best",
  "audio_only",
  "low_size",
  "custom",
];

const YOUTUBE_IMPORT_CUSTOM_RESOLUTIONS: LabYoutubeImportCustomResolution[] = [
  "best",
  "1080p",
  "720p",
  "480p",
];

const YOUTUBE_IMPORT_CUSTOM_FORMATS: LabYoutubeImportCustomFormat[] = ["mp4", "webm", "mkv"];

type YoutubeImportStrategyView = {
  strategy: LabYoutubeImportStrategy;
  label: string;
  description: string;
  estimatedSize: string;
  formatLabel: string;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatPreviewDuration(totalSeconds: number | undefined) {
  const safeSeconds =
    typeof totalSeconds === "number" && Number.isFinite(totalSeconds) && totalSeconds > 0
      ? Math.floor(totalSeconds)
      : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

function formatPanelDuration(totalSeconds: number | undefined) {
  const previewDuration = formatPreviewDuration(totalSeconds);
  return previewDuration.startsWith("0") ? previewDuration.slice(1) : previewDuration;
}

function getYoutubeImportPreviewTitle(preview: LabYoutubeImportPreview | null, copy: LabI18n) {
  return (
    preview?.title ||
    copy.t("mediaAnalysis.source.youtubeImport.previewFallbackTitle", "Sample Video Title")
  );
}

function selectedAttr(current: string, value: string) {
  return current === value ? " selected" : "";
}

function checkedAttr(value: boolean) {
  return value ? " checked" : "";
}

function getYoutubeImportStrategyView(
  strategy: LabYoutubeImportStrategy,
  copy: LabI18n
): YoutubeImportStrategyView {
  switch (strategy) {
    case "audio_only":
      return {
        strategy,
        label: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.audioOnly.label",
          "Audio Only"
        ),
        description: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.audioOnly.description",
          "Extract audio track only"
        ),
        estimatedSize: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.audioOnly.size",
          "~2 MB"
        ),
        formatLabel: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.audioOnly.format",
          "MP3 / AAC"
        ),
      };
    case "low_size":
      return {
        strategy,
        label: copy.t("mediaAnalysis.source.youtubeImport.strategies.lowSize.label", "Small Size"),
        description: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.lowSize.description",
          "Compressed for quick use"
        ),
        estimatedSize: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.lowSize.size",
          "~5 MB"
        ),
        formatLabel: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.lowSize.format",
          "MP4 compressed"
        ),
      };
    case "custom":
      return {
        strategy,
        label: copy.t("mediaAnalysis.source.youtubeImport.strategies.custom.label", "Advanced"),
        description: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.custom.description",
          "Manual control over formats"
        ),
        estimatedSize: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.custom.size",
          "Manual"
        ),
        formatLabel: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.custom.format",
          "Manual"
        ),
      };
    case "video_best":
    default:
      return {
        strategy: "video_best",
        label: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.videoBest.label",
          "Best Quality"
        ),
        description: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.videoBest.description",
          "Maximum resolution and bitrate"
        ),
        estimatedSize: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.videoBest.size",
          "~14 MB"
        ),
        formatLabel: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.videoBest.format",
          "Best available"
        ),
      };
  }
}

function renderYoutubeImportStrategyCards(activeStrategy: LabYoutubeImportStrategy, copy: LabI18n) {
  return `
    <div class="labx-strategy-list" aria-label="${escapeHtml(
      copy.t("mediaAnalysis.source.youtubeImport.strategyListLabel", "Extraction strategy")
    )}">
      ${YOUTUBE_IMPORT_STRATEGIES.map(function (strategy) {
        const view = getYoutubeImportStrategyView(strategy, copy);
        const active = strategy === activeStrategy;
        return `
          <button
            class="strategy-card labx-strategy-card${active ? " active" : ""}"
            type="button"
            data-lab-action="youtube-import-set-strategy"
            data-lab-value="${escapeHtml(strategy)}"
            aria-pressed="${active ? "true" : "false"}"
          >
            <span class="labx-strategy-card__main">
              <span class="labx-strategy-card__label">${escapeHtml(view.label)}</span>
              <span class="labx-strategy-card__description">${escapeHtml(view.description)}</span>
            </span>
            <span class="labx-strategy-card__size">${escapeHtml(view.estimatedSize)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderYoutubeImportAdvancedSettings(state: LabStoreState, copy: LabI18n) {
  if (state.ui.youtubeImport.strategy !== "custom") {
    return "";
  }
  const custom = state.ui.youtubeImport.custom;
  return `
    <div class="labx-advanced-settings">
      <label class="labx-import-control">
        <span>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.advancedResolution", "Resolution"))}</span>
        <select data-lab-field="youtube-import.custom.resolution" aria-label="${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.advancedResolution", "Resolution"))}">
          ${YOUTUBE_IMPORT_CUSTOM_RESOLUTIONS.map(function (resolution) {
            const label = copy.t(
              `mediaAnalysis.source.youtubeImport.resolutions.${resolution}`,
              resolution === "best" ? "Best available" : resolution
            );
            return `<option value="${escapeHtml(resolution)}"${selectedAttr(custom.resolution, resolution)}>${escapeHtml(label)}</option>`;
          }).join("")}
        </select>
      </label>
      <label class="labx-import-control">
        <span>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.advancedFormat", "Format"))}</span>
        <select data-lab-field="youtube-import.custom.format" aria-label="${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.advancedFormat", "Format"))}">
          ${YOUTUBE_IMPORT_CUSTOM_FORMATS.map(function (format) {
            return `<option value="${escapeHtml(format)}"${selectedAttr(custom.format, format)}>${escapeHtml(format.toUpperCase())}</option>`;
          }).join("")}
        </select>
      </label>
      <label class="labx-import-check">
        <input type="checkbox" data-lab-field="youtube-import.custom.audioExtraction"${checkedAttr(custom.audioExtraction)} />
        <span>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.advancedAudioExtraction", "Extract audio only"))}</span>
      </label>
    </div>
  `;
}

function renderYoutubeImportStatus(state: LabStoreState, copy: LabI18n) {
  switch (state.ui.youtubeImport.status) {
    case "parsing":
      return `
        <div class="labx-import-status" id="5zfn1x" role="status" aria-live="polite">
          ${escapeHtml(
            copy.t(
              "mediaAnalysis.source.youtubeImport.statusParsing",
              "Analyzing video metadata..."
            )
          )}
        </div>
      `;
    case "error":
      return `
        <div class="labx-import-status labx-import-status--error" id="b8nq4m" role="alert">
          ${escapeHtml(
            copy.t(
              "mediaAnalysis.source.youtubeImport.statusError",
              "Invalid YouTube URL or network error"
            )
          )}
        </div>
      `;
    case "idle":
    case "ready":
      return `<div class="labx-import-status" aria-hidden="true"></div>`;
    default:
      return `<div class="labx-import-status" aria-hidden="true"></div>`;
  }
}

function renderYoutubeImportEmpty(copy: LabI18n) {
  return `
    <div class="labx-import-empty">
      <div class="labx-import-empty-title">
        ${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.emptyTitle", "Paste YouTube URL to begin"))}
      </div>
      <div class="labx-import-hint">
        <p>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.hintIntro", "This workspace allows you to:"))}</p>
        <ul>
          <li>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.hintPreview", "Preview video before download"))}</li>
          <li>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.hintStrategy", "Control extraction strategy"))}</li>
          <li>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.hintFormats", "Select output formats"))}</li>
        </ul>
      </div>
    </div>
  `;
}

function renderYoutubeImportPreview(preview: LabYoutubeImportPreview, copy: LabI18n) {
  const title = getYoutubeImportPreviewTitle(preview, copy);
  const duration = formatPreviewDuration(preview.duration);
  const thumbnail = preview.thumbnail || "";
  return `
    <div class="labx-import-preview-card">
      ${
        thumbnail.trim() !== ""
          ? `<img class="labx-import-thumb" src="${escapeHtml(thumbnail)}" alt="${escapeHtml(title)}" loading="lazy" />`
          : `<div class="labx-import-thumb labx-import-thumb--fallback" aria-hidden="true"></div>`
      }
      <div class="labx-import-meta">
        <div class="title">${escapeHtml(title)}</div>
        <div class="duration">${escapeHtml(duration)}</div>
      </div>
    </div>
  `;
}

function renderYoutubeImportCenter(state: LabStoreState, copy: LabI18n) {
  const importState = state.ui.youtubeImport;
  if (importState.status === "ready" && importState.preview !== null) {
    return renderYoutubeImportPreview(importState.preview, copy);
  }
  return renderYoutubeImportEmpty(copy);
}

function renderYoutubeImportReadyPanel(state: LabStoreState, copy: LabI18n) {
  const preview = state.ui.youtubeImport.preview;
  const title = getYoutubeImportPreviewTitle(preview, copy);
  const duration = formatPanelDuration(preview?.duration);
  const strategyView = getYoutubeImportStrategyView(state.ui.youtubeImport.strategy, copy);
  return `
    <div class="labx-import-ready" id="0zznv2">
      <div>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.readyFormat", "Format: {format}", { format: strategyView.formatLabel }))}</div>
      <div>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.readyEstimatedSize", "Estimated size: {size}", { size: strategyView.estimatedSize }))}</div>
      <div>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.readyDescription", "Strategy: {description}", { description: strategyView.description }))}</div>
      <div>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.readyDuration", "Duration: {duration}", { duration }))}</div>
    </div>
    <div class="labx-import-control-group">
      ${renderYoutubeImportStrategyCards(state.ui.youtubeImport.strategy, copy)}
      ${renderYoutubeImportAdvancedSettings(state, copy)}
      <div class="labx-import-context-note">${escapeHtml(title)}</div>
    </div>
  `;
}

function renderYoutubeImportConfig(state: LabStoreState, copy: LabI18n) {
  const status = state.ui.youtubeImport.status;
  if (status === "parsing") {
    return `
      <div class="labx-import-context-message" id="jp9w3v" role="status" aria-live="polite">
        ${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.panelParsing", "Analyzing video..."))}
      </div>
      <div class="labx-import-context-message">
        ${escapeHtml(
          copy.t(
            "mediaAnalysis.source.youtubeImport.panelStrategyPending",
            "Strategy selection appears after metadata is ready."
          )
        )}
      </div>
    `;
  }

  if (status === "ready") {
    return renderYoutubeImportReadyPanel(state, copy);
  }

  if (status === "error") {
    return `
      <div class="labx-import-context-message labx-import-context-message--error">
        ${escapeHtml(
          copy.t(
            "mediaAnalysis.source.youtubeImport.panelError",
            "Check the URL and paste a valid YouTube link."
          )
        )}
      </div>
    `;
  }

  return `
    <div class="labx-import-context-message">
      ${escapeHtml(
        copy.t(
          "mediaAnalysis.source.youtubeImport.panelIdle",
          "Paste a YouTube URL to preview available import options."
        )
      )}
    </div>
  `;
}

export function renderYoutubeImportWorkspaceMarkup(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const importState = state.ui.youtubeImport;
  const hasPreview = importState.status === "ready" && importState.preview !== null;
  const urlValue = importState.url || "";
  const clearDisabled = urlValue.trim() === "" && importState.preview === null;
  const executionDisabled = hasPreview ? "" : " disabled";
  const strategyView = getYoutubeImportStrategyView(importState.strategy, copy);
  const downloadLabel = hasPreview
    ? copy.t(
        "mediaAnalysis.source.youtubeImport.downloadWithStrategy",
        "Download ({strategy} · {size})",
        {
          strategy: strategyView.label,
          size: strategyView.estimatedSize,
        }
      )
    : copy.t("mediaAnalysis.source.youtubeImport.download", "Download");
  const downloadAnalyzeLabel = hasPreview
    ? copy.t(
        "mediaAnalysis.source.youtubeImport.downloadAnalyzeWithStrategy",
        "Download & Analyze ({strategy})",
        { strategy: strategyView.label }
      )
    : copy.t("mediaAnalysis.source.youtubeImport.downloadAnalyze", "Download + Analyze");
  return `
    <div class="labx-import-workspace" data-lab-mode="${escapeHtml(state.ui.labMode)}" data-import-status="${escapeHtml(importState.status)}" data-has-preview="${hasPreview ? "true" : "false"}">
      <div class="labx-import-header">
        <div class="labx-import-title">
          ${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.title", "YouTube Import Workspace"))}
        </div>
        <button
          class="labx-import-back"
          type="button"
          data-lab-action="exit-youtube-import-mode"
          aria-label="${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.back", "Back to Laboratory"))}"
        >
          <span aria-hidden="true">&larr;</span>
          <span>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.back", "Back to Laboratory"))}</span>
        </button>
      </div>

      <div class="labx-import-body" data-has-preview="${hasPreview ? "true" : "false"}">
        <div class="labx-import-preview">
          <div class="labx-import-url-zone">
            <div class="labx-import-url-row">
              <input
                class="labx-import-url-input"
                type="url"
                inputmode="url"
                data-lab-field="youtube-import.url"
                value="${escapeHtml(urlValue)}"
                placeholder="${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.urlPlaceholder", "https://youtube.com/watch?v=..."))}"
                aria-label="${escapeHtml(copy.t("mediaAnalysis.source.fields.youtubeUrl", "YouTube URL"))}"
                autocomplete="off"
                spellcheck="false"
              />
              <button class="labx-import-clear" type="button" data-lab-action="youtube-import-clear"${clearDisabled ? " disabled" : ""}>
                ${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.clear", "Clear"))}
              </button>
            </div>
            ${renderYoutubeImportStatus(state, copy)}
          </div>
          <div class="labx-import-stage">
            ${renderYoutubeImportCenter(state, copy)}
          </div>
        </div>

        <div class="labx-import-config" data-import-status="${escapeHtml(importState.status)}">
          ${renderYoutubeImportConfig(state, copy)}
        </div>
      </div>

      <div class="labx-import-footer">
        <button type="button"${executionDisabled}>
          ${escapeHtml(downloadLabel)}
        </button>
        <button type="button"${executionDisabled}>
          ${escapeHtml(downloadAnalyzeLabel)}
        </button>
      </div>
    </div>
  `;
}

export function renderYoutubeImportWorkspace(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N,
  documentRef?: Document
): HTMLElement {
  const ambientDocument = (globalThis as { document?: Document }).document;
  const targetDocument = documentRef ?? ambientDocument;
  if (targetDocument === undefined) {
    throw new Error(
      "YouTube import workspace requires a browser Document to render an HTMLElement."
    );
  }
  const template = targetDocument.createElement("template");
  template.innerHTML = renderYoutubeImportWorkspaceMarkup(state, copy).trim();
  const element = template.content.firstElementChild;
  if (element === null) {
    throw new Error("YouTube import workspace could not be rendered.");
  }
  return element as HTMLElement;
}
