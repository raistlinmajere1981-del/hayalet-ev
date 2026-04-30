import { asLabRecord, asNonEmptyString, escapeHtml, formatBytes } from "../models/lab-types.js";
import type {
  LabEventFeedItem,
  LabProjectImportKind,
  LabStoreState,
  LabYoutubeImportFormat,
} from "../models/lab-types.js";
import {
  buildProjectImportHostAction,
  buildProjectImportLocalHostAction,
  buildProjectImportUrlCheckAction,
  getLatestProjectImportEvent,
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
      copy.t(
        "mediaAnalysis.source.youtubeImport.statusError",
        "Invalid YouTube URL or network error"
      );
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

function isProjectImportAction(action: string | null | undefined) {
  return (
    action === "source-pick-local" ||
    action === "source-download-url" ||
    action === "source-download-youtube"
  );
}

function getTrackedProjectImportAction(state: LabStoreState) {
  return isProjectImportAction(state.ui.projectImport.lastAction)
    ? state.ui.projectImport.lastAction
    : buildProjectImportHostAction(state).action;
}

function isTrackedProjectImport(state: LabStoreState) {
  return (
    state.ui.projectImport.lastRequestId !== null &&
    isProjectImportAction(state.ui.projectImport.lastAction)
  );
}

function clampPercent(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null;
}

function getMethodForAction(action: string | null, fallback: string) {
  if (action === "source-pick-local") {
    return "local";
  }
  if (action === "source-download-url") {
    return "url";
  }
  if (action === "source-download-youtube") {
    return "youtube";
  }
  return fallback;
}

function getDefaultProgressDetail(action: string | null, copy: LabI18n) {
  switch (action) {
    case "source-pick-local":
      return copy.t(
        "mediaAnalysis.projectImport.progress.localPicking",
        "Aşama: dosya seçimi bekleniyor"
      );
    case "source-download-url":
      return copy.t(
        "mediaAnalysis.projectImport.progress.urlDownloading",
        "Aşama: dosya indiriliyor"
      );
    case "source-download-youtube":
      return copy.t(
        "mediaAnalysis.projectImport.progress.youtubePreparing",
        "Aşama: YouTube aktarımı hazırlanıyor"
      );
    case null:
      return null;
    default:
      return null;
  }
}

function getSafeProgressDetail(event: LabEventFeedItem | null) {
  const detail =
    asNonEmptyString(event?.detail) ||
    asNonEmptyString(event?.message) ||
    asNonEmptyString(asLabRecord(event)["phaseLabel"]);
  if (detail === null) {
    return null;
  }
  if (
    detail.includes("--") ||
    detail.includes("/home/") ||
    detail.includes("\\") ||
    /^https?:\/\//i.test(detail)
  ) {
    return null;
  }
  return detail;
}

function renderProjectImportDetails(state: LabStoreState, copy: LabI18n) {
  const route = getProjectImportRoute(state);
  const action = getTrackedProjectImportAction(state);
  const method = getMethodForAction(action, route.method);
  const source = asLabRecord(state.source);
  const sourceMode = asNonEmptyString(source["mode"]);
  const useCommittedSource =
    state.sourceProbeStatus === "completed" &&
    isTrackedProjectImport(state) &&
    (method === "youtube" ? sourceMode === "youtube" : sourceMode === method);
  const metadata = useCommittedSource ? asLabRecord(source["metadata"]) : asLabRecord(null);
  const youtubePreview = method === "youtube" ? state.ui.youtubeImport.preview : null;
  const fileName =
    (useCommittedSource ? asNonEmptyString(source["storedFileName"]) : null) ||
    asNonEmptyString(youtubePreview?.title) ||
    copy.t("mediaAnalysis.projectImport.review.pendingFile", "Bekleyen dosya");
  const rows: Array<{ label: string; value: string }> = [
    {
      label: copy.t("mediaAnalysis.projectImport.review.kind", "Tip"),
      value: getKindLabel(route.kind, copy),
    },
    {
      label: copy.t("mediaAnalysis.projectImport.review.method", "Yöntem"),
      value: getMethodLabel(method, copy),
    },
    {
      label: copy.t("mediaAnalysis.projectWorkspace.metadataName", "Ad"),
      value: fileName,
    },
  ];
  const duration = formatDuration(
    metadata["durationSeconds"] ?? metadata["duration"] ?? youtubePreview?.duration
  );
  if (duration !== null) {
    rows.push({
      label: copy.t("mediaAnalysis.projectWorkspace.metadataDuration", "Süre"),
      value: duration,
    });
  }
  if (typeof metadata["sizeBytes"] === "number") {
    rows.push({
      label: copy.t("mediaAnalysis.projectWorkspace.metadataSize", "Boyut"),
      value: formatBytes(metadata["sizeBytes"]),
    });
  }
  return `
    <div class="labx-project-import__details" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.review.details", "Detaylar"))}">
      ${rows
        .map(function (row) {
          return `<div class="labx-project-import__detail-row"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>`;
        })
        .join("")}
    </div>
  `;
}

function renderYoutubeProgressStages(
  event: LabEventFeedItem | null,
  tracked: boolean,
  complete: boolean,
  copy: LabI18n
) {
  const eventRecord = asLabRecord(event);
  const activeIndex =
    typeof eventRecord["phaseIndex"] === "number" && Number.isFinite(eventRecord["phaseIndex"])
      ? Math.max(0, Math.min(3, Math.round(eventRecord["phaseIndex"])))
      : complete
        ? 3
        : tracked
          ? 0
          : -1;
  const phasePercent = clampPercent(eventRecord["phasePercent"]);
  const labels = [
    copy.t("mediaAnalysis.projectImport.progress.stagePrepare", "Hazırlık"),
    copy.t("mediaAnalysis.projectImport.progress.stageDownload", "İndirme"),
    copy.t("mediaAnalysis.projectImport.progress.stageProcess", "Birleştirme"),
    copy.t("mediaAnalysis.projectImport.progress.stageStore", "Kayıt"),
  ];
  return `
    <div class="labx-project-import__stages" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.progress.stages", "Aşamalar"))}">
      ${labels
        .map(function (label, index) {
          const state =
            complete || index < activeIndex ? "done" : index === activeIndex ? "active" : "idle";
          const suffix =
            index === activeIndex && phasePercent !== null ? ` · ${String(phasePercent)}%` : "";
          return `<span data-state="${escapeHtml(state)}">${escapeHtml(label + suffix)}</span>`;
        })
        .join("")}
    </div>
  `;
}

function renderProjectImportProgress(state: LabStoreState, copy: LabI18n) {
  const actionState = buildProjectImportHostAction(state);
  const action = getTrackedProjectImportAction(state);
  const latestEvent = getLatestProjectImportEvent(state, action);
  const tracked = isTrackedProjectImport(state) && state.ui.projectImport.reviewFocus !== "draft";
  const failed = tracked && state.sourceProbeStatus === "failed";
  const complete = tracked && state.sourceProbeStatus === "completed" && failed !== true;
  const running =
    tracked &&
    complete !== true &&
    failed !== true &&
    (state.ui.projectImport.reviewFocus === "running" || state.sourceProbeStatus === "running");
  const eventPercent = clampPercent(latestEvent?.percent);
  const percent = complete ? 100 : eventPercent !== null ? eventPercent : running ? 8 : 0;
  const tone = failed ? "error" : complete ? "success" : running ? "running" : "idle";
  const label = complete
    ? copy.t("mediaAnalysis.source.progress.complete", "Aktarım tamamlandı")
    : failed
      ? copy.t("mediaAnalysis.source.progress.failed", "Aktarım başarısız")
      : running
        ? eventPercent !== null
          ? `${String(percent)}%`
          : copy.t("mediaAnalysis.projectImport.progress.started", "Aktarım başladı")
        : copy.t("mediaAnalysis.source.progress.awaiting", "Aktarım bekleniyor");
  const byteDetail =
    typeof latestEvent?.bytesReceived === "number" && latestEvent.bytesReceived > 0
      ? `${formatBytes(latestEvent.bytesReceived)}${typeof latestEvent.bytesTotal === "number" && latestEvent.bytesTotal > 0 ? ` / ${formatBytes(latestEvent.bytesTotal)}` : ""}`
      : null;
  const detail =
    getSafeProgressDetail(latestEvent) ||
    byteDetail ||
    (running ? getDefaultProgressDetail(action, copy) : null) ||
    (actionState.disabledReason !== null ? actionState.disabledReason : null);
  const showYoutubeStages = action === "source-download-youtube" && (tracked || complete);

  return `
    <div class="labx-project-import__progress" data-tone="${escapeHtml(tone)}">
      <div class="labx-project-import__progress-main">
        <div class="labx-project-import__progress-head">
          <span>${escapeHtml(label)}</span>
        </div>
        <div class="labx-progress" aria-hidden="true"><span style="width:${String(percent)}%"></span></div>
        ${detail !== null ? `<p>${escapeHtml(detail)}</p>` : ""}
        ${showYoutubeStages ? renderYoutubeProgressStages(latestEvent, tracked, complete, copy) : ""}
      </div>
    </div>
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
  const checkDisabledAttr = checking || checkAction.disabledReason !== null ? " disabled" : "";
  const checkDisabledTitle =
    checkAction.disabledReason !== null ? ` title="${escapeHtml(checkAction.disabledReason)}"` : "";
  const addDisabledReason = ready ? addAction.disabledReason : "Check the URL before adding it.";
  const addDisabledAttr = addDisabledReason !== null ? " disabled" : "";
  const addDisabledTitle =
    addDisabledReason !== null ? ` title="${escapeHtml(addDisabledReason)}"` : "";
  const checkButtonLabel = checking
    ? copy.t("mediaAnalysis.projectImport.url.checking", "Kontrol ediliyor")
    : copy.t("mediaAnalysis.projectImport.url.check", "Kontrol Et");
  return `
    <section class="labx-project-import__panel" data-panel="url">
      <div class="labx-project-import__url-row">
        <label class="labx-field">
          <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.urlInput", "Source URL"))}</span>
          <input class="labx-input" data-lab-field="project-import.urlInput" value="${escapeHtml(getProjectImportUrlInput(state))}" placeholder="https://..." />
        </label>
        <button class="labx-project-import__btn" type="button" data-lab-action="project-import-check-url"${checkDisabledAttr}${checkDisabledTitle}>
          ${escapeHtml(checkButtonLabel)}
        </button>
        <button class="labx-project-import__btn labx-project-import__btn--accent" type="button" data-lab-action="project-import-url-add"${addDisabledAttr}${addDisabledTitle}>
          ${escapeHtml(copy.t("mediaAnalysis.projectImport.url.add", "Projeye Ekle"))}
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
      ${renderProjectImportDetails(state, copy)}
      <div class="labx-project-import__footer">
        ${renderProjectImportProgress(state, copy)}
        <button class="labx-project-import__btn" type="button" data-lab-action="project-import-clear">
          ${escapeHtml(copy.t("mediaAnalysis.projectImport.clear", "Clear"))}
        </button>
      </div>
    </section>
  `;
}
