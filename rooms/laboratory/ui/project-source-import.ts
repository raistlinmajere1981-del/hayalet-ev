import { escapeHtml, formatBytes } from "../models/lab-types.js";
import type {
  LabProjectImportKind,
  LabStoreState,
  LabYoutubeImportFormat,
} from "../models/lab-types.js";
import {
  buildProjectImportHostAction,
  buildProjectImportLocalHostAction,
  buildProjectImportUrlCheckAction,
  getProjectImportRoute,
  getProjectImportUrlInput,
} from "../runtime/lab-project-import.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function selectedAttr(current: string | null, value: string) {
  return current === value ? " selected" : "";
}

function getKindLabel(kind: LabProjectImportKind, copy: LabI18n) {
  switch (kind) {
    case "audio":
      return copy.t("mediaAnalysis.projectImport.tabs.audio", "Sound");
    case "image":
      return copy.t("mediaAnalysis.projectImport.tabs.image", "Image");
    case "video":
    default:
      return copy.t("mediaAnalysis.projectImport.tabs.video", "Video");
  }
}

function getMethodLabel(method: string, copy: LabI18n) {
  switch (method) {
    case "youtube":
      return copy.t("mediaAnalysis.projectImport.methods.youtube.label", "YouTube");
    case "url":
      return copy.t("mediaAnalysis.projectImport.methods.url.label", "Direct URL");
    case "local":
    default:
      return copy.t("mediaAnalysis.projectImport.methods.local.label", "Local File");
  }
}

function formatDuration(totalSeconds: unknown) {
  const seconds =
    typeof totalSeconds === "number" && Number.isFinite(totalSeconds) ? totalSeconds : 0;
  if (seconds <= 0) {
    return null;
  }
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  if (hours > 0) {
    return `${String(hours)}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${String(minutes)}:${String(remainder).padStart(2, "0")}`;
}

function formatBitrate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `${Math.round(value)} kbps`
    : null;
}

function getFormatSize(format: LabYoutubeImportFormat) {
  return format.filesizeBytes || format.filesizeApproxBytes || null;
}

function getFormatTechnicalLabel(format: LabYoutubeImportFormat) {
  const parts = [
    format.formatId,
    format.extension ? format.extension.toUpperCase() : null,
    format.resolution,
    typeof format.fps === "number" && format.fps > 0 ? `${Math.round(format.fps)} fps` : null,
    format.videoCodec && format.videoCodec !== "none" ? `V:${format.videoCodec}` : null,
    format.audioCodec && format.audioCodec !== "none" ? `A:${format.audioCodec}` : null,
    formatBitrate(format.bitrateKbps),
    getFormatSize(format) !== null ? formatBytes(getFormatSize(format) || 0) : null,
    format.note,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  return parts.join(" · ");
}

function getYoutubeVideoFormats(formats: LabYoutubeImportFormat[]) {
  return formats.filter((format) => format.kind === "video" || format.kind === "muxed");
}

function getYoutubeAudioFormats(formats: LabYoutubeImportFormat[]) {
  return formats.filter((format) => format.kind === "audio" || format.kind === "muxed");
}

function renderYoutubeFormatSelect(
  label: string,
  field: string,
  selectedFormatId: string | null,
  formats: LabYoutubeImportFormat[],
  emptyLabel: string
) {
  return `
    <label class="labx-field labx-project-import__format-select">
      <span>${escapeHtml(label)}</span>
      <select data-lab-field="${escapeHtml(field)}">
        <option value="">${escapeHtml(emptyLabel)}</option>
        ${formats
          .map(function (format) {
            const technical = getFormatTechnicalLabel(format);
            return `<option value="${escapeHtml(format.formatId)}"${selectedAttr(selectedFormatId, format.formatId)}>${escapeHtml(format.label || technical || format.formatId)}${technical !== "" ? ` — ${escapeHtml(technical)}` : ""}</option>`;
          })
          .join("")}
      </select>
    </label>
  `;
}

function renderYoutubeCheckResult(state: LabStoreState, copy: LabI18n) {
  const youtube = state.ui.youtubeImport;
  if (youtube.status === "parsing" || state.ui.projectImport.urlCheck.status === "checking") {
    return `<p class="labx-project-import__status" role="status">${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.statusParsing", "Analyzing video metadata..."))}</p>`;
  }
  if (youtube.status === "error" || state.ui.projectImport.urlCheck.status === "error") {
    const error =
      state.ui.projectImport.urlCheck.error ||
      copy.t("mediaAnalysis.source.youtubeImport.statusError", "Invalid YouTube URL or network error");
    return `<p class="labx-project-import__status" data-tone="error" role="alert">${escapeHtml(error)}</p>`;
  }
  if (
    state.ui.projectImport.urlCheck.status !== "ready" ||
    state.ui.projectImport.urlCheck.isYoutube !== true
  ) {
    return "";
  }

  const preview = youtube.preview;
  const title =
    preview?.title ||
    copy.t("mediaAnalysis.source.youtubeImport.previewFallbackTitle", "YouTube video");
  const videoFormats = getYoutubeVideoFormats(youtube.formats);
  const audioFormats = getYoutubeAudioFormats(youtube.formats);
  return `
    <div class="labx-project-import__youtube-result">
      <div class="labx-project-import__youtube-preview">
        ${
          preview?.thumbnail
            ? `<img src="${escapeHtml(preview.thumbnail)}" alt="${escapeHtml(title)}" />`
            : `<div class="labx-project-import__thumb-placeholder">YouTube</div>`
        }
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(
            [
              preview?.uploader || null,
              formatDuration(preview?.duration),
              youtube.formats.length > 0
                ? copy.t("mediaAnalysis.projectImport.url.formatCount", "{count} formats", {
                    count: String(youtube.formats.length),
                  })
                : null,
            ]
              .filter((entry): entry is string => typeof entry === "string" && entry !== "")
              .join(" · ")
          )}</span>
        </div>
      </div>
      <div class="labx-project-import__format-grid">
        ${renderYoutubeFormatSelect(
          copy.t("mediaAnalysis.projectImport.url.videoFormat", "Video stream"),
          "project-import.youtubeVideoFormat",
          youtube.selectedVideoFormatId,
          videoFormats,
          copy.t("mediaAnalysis.projectImport.url.noVideo", "No video, audio only")
        )}
        ${renderYoutubeFormatSelect(
          copy.t("mediaAnalysis.projectImport.url.audioFormat", "Audio stream"),
          "project-import.youtubeAudioFormat",
          youtube.selectedAudioFormatId,
          audioFormats,
          copy.t("mediaAnalysis.projectImport.url.noAudio", "No separate audio")
        )}
      </div>
    </div>
  `;
}

function renderDirectUrlCheckResult(state: LabStoreState, copy: LabI18n) {
  const check = state.ui.projectImport.urlCheck;
  if (check.status !== "ready" || check.isYoutube === true) {
    return "";
  }
  return `
    <p class="labx-project-import__status" data-tone="success">
      ${escapeHtml(
        copy.t("mediaAnalysis.projectImport.url.directReady", "Direct URL ready as {type}", {
          type: getKindLabel(check.kind || "video", copy),
        })
      )}
    </p>
  `;
}

function renderLocalImportSection(state: LabStoreState, copy: LabI18n) {
  const localAction = buildProjectImportLocalHostAction(state);
  const disabledAttr = localAction.disabledReason !== null ? " disabled" : "";
  return `
    <section class="labx-project-import__panel" data-panel="local">
      <div>
        <h3>${escapeHtml(copy.t("mediaAnalysis.projectImport.localUnifiedTitle", "Local Dosya Ekle"))}</h3>
        <p>${escapeHtml(copy.t("mediaAnalysis.projectImport.localUnifiedHint", "Video, ses veya görsel dosyası seç; seçilen dosya aktif projeye kopyalanır."))}</p>
      </div>
      <button class="labx-project-import__btn labx-project-import__btn--accent" type="button" data-lab-action="project-import-local-add"${disabledAttr}>
        ${escapeHtml(copy.t("mediaAnalysis.projectImport.localUnifiedButton", "Local Dosya Ekle"))}
      </button>
    </section>
  `;
}

function renderUrlImportSection(state: LabStoreState, copy: LabI18n) {
  const checkAction = buildProjectImportUrlCheckAction(state);
  const addAction = buildProjectImportHostAction(state);
  const check = state.ui.projectImport.urlCheck;
  const ready = check.status === "ready";
  const checking = check.status === "checking";
  const buttonAction = ready ? "project-import-url-add" : "project-import-check-url";
  const disabledReason = ready ? addAction.disabledReason : checkAction.disabledReason;
  const disabledAttr = checking || disabledReason !== null ? " disabled" : "";
  const disabledTitle = disabledReason !== null ? ` title="${escapeHtml(disabledReason)}"` : "";
  const buttonLabel = checking
    ? copy.t("mediaAnalysis.projectImport.url.checking", "Kontrol ediliyor")
    : ready
      ? copy.t("mediaAnalysis.projectImport.url.add", "Projeye Ekle")
      : copy.t("mediaAnalysis.projectImport.url.check", "Kontrol Et");
  return `
    <section class="labx-project-import__panel" data-panel="url">
      <div class="labx-project-import__url-row">
        <label class="labx-field">
          <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.urlInput", "Source URL"))}</span>
          <input class="labx-input" data-lab-field="project-import.urlInput" value="${escapeHtml(getProjectImportUrlInput(state))}" placeholder="https://..." />
        </label>
        <button class="labx-project-import__btn labx-project-import__btn--accent" type="button" data-lab-action="${escapeHtml(buttonAction)}"${disabledAttr}${disabledTitle}>
          ${escapeHtml(buttonLabel)}
        </button>
      </div>
      ${renderYoutubeCheckResult(state, copy)}
      ${renderDirectUrlCheckResult(state, copy)}
    </section>
  `;
}

export function renderProjectSourceImport(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  const route = getProjectImportRoute(state);
  return `
    <section class="labx-project-import" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.title", "Source Import Workspace"))}">
      <div class="labx-project-import__header">
        <div>
          <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.projectImport.eyebrow", "Project Source"))}</p>
          <h2>${escapeHtml(copy.t("mediaAnalysis.projectImport.title", "Source Import Workspace"))}</h2>
        </div>
        <span class="labx-project-import__route">${escapeHtml(getKindLabel(route.kind, copy))} / ${escapeHtml(getMethodLabel(route.method, copy))}</span>
      </div>
      <div class="labx-project-import__body labx-project-import__body--unified">
        ${renderLocalImportSection(state, copy)}
        ${renderUrlImportSection(state, copy)}
      </div>
      <div class="labx-project-import__footer">
        <button class="labx-project-import__btn" type="button" data-lab-action="project-import-clear">
          ${escapeHtml(copy.t("mediaAnalysis.projectImport.clear", "Clear"))}
        </button>
      </div>
    </section>
  `;
}
