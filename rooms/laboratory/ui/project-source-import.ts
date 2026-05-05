import { asLabRecord, asNonEmptyString, escapeHtml, formatBytes } from "../models/lab-types.js";
import type { LabEventFeedItem, LabProjectImportKind, LabStoreState } from "../models/lab-types.js";
import {
  buildProjectImportHostAction,
  buildProjectImportLocalHostAction,
  buildProjectImportUrlCheckAction,
  getLatestProjectImportEvent,
  getProjectImportRoute,
  getProjectImportUrlInput,
  hasProjectImportDraftValue,
} from "../runtime/lab-project-import.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

type YtDlpFormFieldOption = {
  labelKey: string;
  value: string;
};

type YtDlpFormField = {
  id: string;
  labelKey: string;
  max?: number;
  min?: number;
  options?: YtDlpFormFieldOption[];
  placeholderKey?: string;
  span?: string;
  type: "number" | "select" | "text" | "toggle";
};

type YtDlpFormSection = {
  fields: YtDlpFormField[];
  id: string;
};

type YtDlpFormSchema = {
  sections: YtDlpFormSection[];
};

const YT_DLP_FORM_SCHEMA = {
  sections: [
    {
      id: "download",
      fields: [
        {
          id: "captureMode",
          type: "select",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.captureMode",
          options: [
            {
              value: "video+audio",
              labelKey: "mediaAnalysis.source.youtubeForm.options.captureMode.videoAudio",
            },
            {
              value: "audio-only",
              labelKey: "mediaAnalysis.source.youtubeForm.options.captureMode.audioOnly",
            },
            {
              value: "video-only",
              labelKey: "mediaAnalysis.source.youtubeForm.options.captureMode.videoOnly",
            },
          ],
        },
        {
          id: "format",
          type: "select",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.format",
          options: [
            {
              value: "bestvideo*+bestaudio/best",
              labelKey: "mediaAnalysis.source.youtubeForm.options.format.best",
            },
            {
              value: "best[height<=1080][ext=mp4]/best[height<=1080]/best",
              labelKey: "mediaAnalysis.source.youtubeForm.options.format.mp4_1080",
            },
            {
              value: "best[height<=720][ext=mp4]/best[height<=720]/best",
              labelKey: "mediaAnalysis.source.youtubeForm.options.format.mp4_720",
            },
            {
              value: "best[height<=480][ext=mp4]/best[height<=480]/best",
              labelKey: "mediaAnalysis.source.youtubeForm.options.format.mp4_480",
            },
            {
              value: "best[height<=360][ext=mp4]/best[height<=360]/worst[ext=mp4]/worst",
              labelKey: "mediaAnalysis.source.youtubeForm.options.format.low",
            },
          ],
        },
        {
          id: "mergeOutputFormat",
          type: "select",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.mergeOutputFormat",
          options: [
            {
              value: "auto",
              labelKey: "mediaAnalysis.source.youtubeForm.options.container.auto",
            },
            {
              value: "mp4",
              labelKey: "mediaAnalysis.source.youtubeForm.options.container.mp4",
            },
            {
              value: "mkv",
              labelKey: "mediaAnalysis.source.youtubeForm.options.container.mkv",
            },
            {
              value: "webm",
              labelKey: "mediaAnalysis.source.youtubeForm.options.container.webm",
            },
          ],
        },
        {
          id: "recodeVideo",
          type: "select",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.recodeVideo",
          options: [
            {
              value: "none",
              labelKey: "mediaAnalysis.source.youtubeForm.options.recode.none",
            },
            {
              value: "mp4",
              labelKey: "mediaAnalysis.source.youtubeForm.options.recode.mp4",
            },
            {
              value: "mkv",
              labelKey: "mediaAnalysis.source.youtubeForm.options.recode.mkv",
            },
            {
              value: "webm",
              labelKey: "mediaAnalysis.source.youtubeForm.options.recode.webm",
            },
          ],
        },
        {
          id: "audioFormat",
          type: "select",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.audioFormat",
          options: [
            {
              value: "none",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audio.none",
            },
            {
              value: "mp3",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audio.mp3",
            },
            {
              value: "aac",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audio.aac",
            },
            {
              value: "m4a",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audio.m4a",
            },
            {
              value: "opus",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audio.opus",
            },
            {
              value: "wav",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audio.wav",
            },
            {
              value: "flac",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audio.flac",
            },
          ],
        },
        {
          id: "audioQuality",
          type: "select",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.audioQuality",
          options: [
            {
              value: "best",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audioQuality.best",
            },
            {
              value: "0",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audioQuality.max",
            },
            {
              value: "2",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audioQuality.high",
            },
            {
              value: "5",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audioQuality.medium",
            },
            {
              value: "7",
              labelKey: "mediaAnalysis.source.youtubeForm.options.audioQuality.small",
            },
          ],
        },
      ],
    },
    {
      id: "captions",
      fields: [
        {
          id: "writeSubtitles",
          type: "toggle",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.writeSubtitles",
        },
        {
          id: "writeAutoSubtitles",
          type: "toggle",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.writeAutoSubtitles",
        },
        {
          id: "subtitlesLang",
          type: "text",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.subtitlesLang",
          placeholderKey: "mediaAnalysis.source.youtubeForm.placeholders.subtitlesLang",
          span: "full",
        },
      ],
    },
    {
      id: "network",
      fields: [
        {
          id: "playlistItems",
          type: "text",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.playlistItems",
          placeholderKey: "mediaAnalysis.source.youtubeForm.placeholders.playlistItems",
        },
        {
          id: "limitRate",
          type: "text",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.limitRate",
          placeholderKey: "mediaAnalysis.source.youtubeForm.placeholders.limitRate",
        },
        {
          id: "retries",
          type: "number",
          labelKey: "mediaAnalysis.source.youtubeForm.fields.retries",
          min: 1,
          max: 50,
        },
      ],
    },
  ],
} satisfies YtDlpFormSchema;

function selectedAttr(current: string | null, value: string) {
  return current === value ? " selected" : "";
}

function checkedAttr(value: boolean) {
  return value ? " checked" : "";
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

function getLabelFallback(labelKey: string, fallback: string) {
  const leaf = labelKey.split(".").filter(Boolean).pop();
  return leaf || fallback;
}

function getProjectImportYoutubeDraft(state: LabStoreState) {
  const route = getProjectImportRoute(state);
  return route.kind === "video" ? route.draft : state.ui.projectImport.drafts.video;
}

function getYoutubeCustomDefaults(state: LabStoreState) {
  const snapshot = asLabRecord(state.snapshot);
  const sourcePresets = asLabRecord(snapshot["sourcePresets"]);
  const youtubePresets = asLabRecord(sourcePresets["youtubePresets"]);
  return asLabRecord(asLabRecord(youtubePresets["custom"])["defaultCustomValues"]);
}

function getYoutubeCustomValue(state: LabStoreState, fieldId: string) {
  const draft = getProjectImportYoutubeDraft(state);
  if (fieldId === "captureMode") {
    return draft.youtubeCaptureMode;
  }
  const custom = asLabRecord(draft.youtubeCustom);
  const defaults = getYoutubeCustomDefaults(state);
  return custom[fieldId] ?? defaults[fieldId] ?? "";
}

function getYoutubeControlFieldName(fieldId: string) {
  return fieldId === "captureMode"
    ? "project-import.youtubeCaptureMode"
    : `project-import.youtubeCustom.${fieldId}`;
}

function renderYoutubeFormField(field: YtDlpFormField, state: LabStoreState, copy: LabI18n) {
  const label = copy.t(field.labelKey, getLabelFallback(field.labelKey, field.id));
  const value = getYoutubeCustomValue(state, field.id);
  const fieldName = getYoutubeControlFieldName(field.id);
  const spanAttr = field.span === "full" ? ' data-span="full"' : "";

  if (field.type === "toggle") {
    return `
      <label class="labx-field labx-project-import__yt-field labx-project-import__yt-field--toggle"${spanAttr}>
        <input type="checkbox" data-lab-field="${escapeHtml(fieldName)}"${checkedAttr(value === true)} />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  if (field.type === "select") {
    const selectedValue = typeof value === "string" ? value : String(value);
    return `
      <label class="labx-field labx-project-import__yt-field"${spanAttr}>
        <span>${escapeHtml(label)}</span>
        <select data-lab-field="${escapeHtml(fieldName)}">
          ${(field.options || [])
            .map(function (option) {
              const optionLabel = copy.t(
                option.labelKey,
                getLabelFallback(option.labelKey, option.value)
              );
              return `<option value="${escapeHtml(option.value)}"${selectedAttr(selectedValue, option.value)}>${escapeHtml(optionLabel)}</option>`;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  const placeholder =
    field.placeholderKey !== undefined
      ? copy.t(field.placeholderKey, getLabelFallback(field.placeholderKey, ""))
      : "";
  const numberAttrs =
    field.type === "number"
      ? `${typeof field.min === "number" ? ` min="${String(field.min)}"` : ""}${typeof field.max === "number" ? ` max="${String(field.max)}"` : ""}`
      : "";
  return `
    <label class="labx-field labx-project-import__yt-field"${spanAttr}>
      <span>${escapeHtml(label)}</span>
      <input
        class="labx-input"
        type="${field.type === "number" ? "number" : "text"}"
        data-lab-field="${escapeHtml(fieldName)}"
        value="${escapeHtml(String(value))}"
        placeholder="${escapeHtml(placeholder)}"${numberAttrs}
      />
    </label>
  `;
}

function renderYoutubeDetailedControls(state: LabStoreState, copy: LabI18n) {
  return `
    <div class="labx-project-import__yt-controls">
      ${YT_DLP_FORM_SCHEMA.sections
        .map(function (section) {
          const title = copy.t(
            `mediaAnalysis.source.youtubeForm.sections.${section.id}.title`,
            section.id
          );
          const subtitle = copy.t(
            `mediaAnalysis.source.youtubeForm.sections.${section.id}.subtitle`,
            ""
          );
          return `
            <fieldset class="labx-project-import__yt-section">
              <legend>${escapeHtml(title)}</legend>
              ${subtitle !== "" ? `<p>${escapeHtml(subtitle)}</p>` : ""}
              <div class="labx-project-import__yt-grid">
                ${section.fields
                  .map(function (field) {
                    return renderYoutubeFormField(field, state, copy);
                  })
                  .join("")}
              </div>
            </fieldset>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderYoutubeCheckResult(state: LabStoreState, copy: LabI18n) {
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
      ${renderProjectImportDetails(state, copy)}
      ${renderYoutubeDetailedControls(state, copy)}
    </div>
  `;
}

export function renderDirectUrlCheckResult(state: LabStoreState, copy: LabI18n) {
  const check = state.ui.projectImport.urlCheck;
  if (check.status !== "ready" || check.isYoutube === true) {
    return "";
  }
  return `
    <div class="labx-project-import__direct-result">
      <p class="labx-project-import__status" data-tone="success">
        ${escapeHtml(
          copy.t("mediaAnalysis.projectImport.url.directReady", "Direct URL ready as {type}", {
            type: getKindLabel(check.kind || "video", copy),
          })
        )}
      </p>
      ${renderProjectImportDetails(state, copy)}
    </div>
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
  const check = state.ui.projectImport.urlCheck;
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
    (method === "url" ? asNonEmptyString(check.url) : null) ||
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

export function renderProjectImportProgress(state: LabStoreState, copy: LabI18n) {
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
  const primaryAction = ready ? "project-import-url-add" : "project-import-check-url";
  const primaryDisabledReason = ready
    ? addAction.disabledReason
    : checking
      ? copy.t("mediaAnalysis.projectImport.url.checking", "Kontrol ediliyor")
      : checkAction.disabledReason;
  const primaryDisabledAttr = primaryDisabledReason !== null ? " disabled" : "";
  const primaryDisabledTitle =
    primaryDisabledReason !== null ? ` title="${escapeHtml(primaryDisabledReason)}"` : "";
  const primaryButtonLabel = ready
    ? copy.t("mediaAnalysis.projectImport.url.add", "Projeye Ekle")
    : checking
      ? copy.t("mediaAnalysis.projectImport.url.checking", "Kontrol ediliyor")
      : copy.t("mediaAnalysis.projectImport.url.check", "Kontrol Et");
  const clearDisabled = hasProjectImportDraftValue(state) !== true;
  return `
    <section class="labx-project-import__panel" data-panel="url">
      <div class="labx-project-import__url-row">
        <label class="labx-field">
          <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.urlInput", "Source URL"))}</span>
          <input class="labx-input" data-lab-field="project-import.urlInput" value="${escapeHtml(getProjectImportUrlInput(state))}" placeholder="https://..." />
        </label>
        <button class="labx-project-import__btn labx-project-import__btn--accent" type="button" data-lab-action="${escapeHtml(primaryAction)}"${primaryDisabledAttr}${primaryDisabledTitle}>
          ${escapeHtml(primaryButtonLabel)}
        </button>
        <button class="labx-project-import__btn" type="button" data-lab-action="project-import-clear"${clearDisabled ? " disabled" : ""}>
          ${escapeHtml(copy.t("mediaAnalysis.projectImport.clear", "Clear"))}
        </button>
      </div>
      ${renderYoutubeCheckResult(state, copy)}
      ${renderDirectUrlCheckResult(state, copy)}
    </section>
  `;
}

export function renderProjectSourceImport(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  return `
    <section class="labx-project-import" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.ariaLabel", "Project source import"))}">
      <div class="labx-project-import__body labx-project-import__body--unified">
        ${renderLocalImportSection(state, copy)}
        ${renderUrlImportSection(state, copy)}
      </div>
      <div class="labx-project-import__footer">
        ${renderProjectImportProgress(state, copy)}
      </div>
    </section>
  `;
}
