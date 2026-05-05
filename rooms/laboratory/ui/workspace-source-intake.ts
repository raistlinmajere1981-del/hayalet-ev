import { asLabRecord, asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import type {
  LabInteractiveSettings,
  LabSourceRetryBlockReason,
  LabStoreState,
} from "../models/lab-types.js";
import {
  getProjectSource,
  getSourceKind,
  getSourceMode,
  getWorkspaceLockState,
  isLoadedSourceMatchingMode,
} from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { formatSourceRetryBlockReason } from "./lab-source-retry-copy.js";

function getSourceKindLabel(kind: string, copy: LabI18n = LAB_FALLBACK_I18N) {
  switch (kind) {
    case "audio":
      return copy.t("mediaAnalysis.source.kinds.audio", "Audio");
    case "image":
      return copy.t("mediaAnalysis.source.kinds.image", "Image");
    case "video":
      return copy.t("mediaAnalysis.source.kinds.video", "Video");
    default:
      return kind;
  }
}

function getSourceModeLabel(mode: string, copy: LabI18n = LAB_FALLBACK_I18N) {
  switch (mode) {
    case "url":
      return copy.t("mediaAnalysis.source.modes.url", "Direct URL");
    case "youtube":
      return copy.t("mediaAnalysis.source.modes.youtube", "YouTube");
    case "local":
      return copy.t("mediaAnalysis.source.modes.localCopy", "Local Copy");
    default:
      return mode;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

function getSnapshotRecord(state: LabStoreState) {
  return asLabRecord(state.snapshot);
}

function getSourcePresets(state: LabStoreState) {
  return asLabRecord(getSnapshotRecord(state)["sourcePresets"]);
}

function getSourceKindOptions(state: LabStoreState) {
  const sourceTypes = asLabRecord(getSourcePresets(state)["sourceTypes"]);
  const configuredKinds = Object.keys(sourceTypes).filter(function (entry) {
    return entry.trim() !== "";
  });
  return configuredKinds.length > 0 ? configuredKinds : ["video", "audio", "image"];
}

function getSourceModeOptions(state: LabStoreState, kind: string) {
  const sourceTypes = asLabRecord(getSourcePresets(state)["sourceTypes"]);
  const sourceConfig = asLabRecord(sourceTypes[kind]);
  const configuredModes = toStringArray(sourceConfig["modes"]);
  return configuredModes.length > 0 ? configuredModes : ["local"];
}

export function getEffectiveSourceMode(state: LabStoreState, kind: string) {
  const sourceMode = getSourceMode(state);
  const availableModes = getSourceModeOptions(state, kind);
  if (availableModes.includes(sourceMode)) {
    return sourceMode;
  }
  return availableModes[0] || "local";
}

function getToolInstalled(state: LabStoreState, toolId: string) {
  const toolState = asLabRecord(state.toolState);
  const tools = asLabRecord(toolState["tools"]);
  return asLabRecord(tools[toolId])["installed"] === true;
}

function getYoutubePresetIds(state: LabStoreState) {
  const presetRecord = asLabRecord(getSourcePresets(state)["youtubePresets"]);
  const configuredIds = Object.keys(presetRecord).filter(function (entry) {
    return entry.trim() !== "";
  });
  const orderedIds = ["low", "medium", "best", "custom"].filter(function (entry) {
    return configuredIds.includes(entry);
  });
  configuredIds.forEach(function (entry) {
    if (!orderedIds.includes(entry)) {
      orderedIds.push(entry);
    }
  });
  return orderedIds.length > 0 ? orderedIds : ["medium"];
}

function getDefaultYoutubePreset(state: LabStoreState) {
  const presetIds = getYoutubePresetIds(state);
  if (presetIds.includes("medium")) {
    return "medium";
  }
  if (presetIds.includes("custom")) {
    return "custom";
  }
  return presetIds[0] || "medium";
}

function getYoutubePresetDefaults(state: LabStoreState, presetId: string) {
  const presets = asLabRecord(getSourcePresets(state)["youtubePresets"]);
  return asLabRecord(asLabRecord(presets[presetId])["defaultCustomValues"]);
}

function getYoutubeFormSections(state: LabStoreState) {
  const ytDlpForm = asLabRecord(getSnapshotRecord(state)["ytDlpForm"]);
  return Array.isArray(ytDlpForm["sections"]) ? (ytDlpForm["sections"] as unknown[]) : [];
}

function getYoutubePresetLabel(presetId: string, copy: LabI18n = LAB_FALLBACK_I18N) {
  switch (presetId) {
    case "low":
      return copy.t("mediaAnalysis.source.youtubePresets.low", "Low");
    case "medium":
      return copy.t("mediaAnalysis.source.youtubePresets.medium", "Medium");
    case "best":
      return copy.t("mediaAnalysis.source.youtubePresets.best", "Best");
    case "custom":
      return copy.t("mediaAnalysis.source.youtubePresets.custom", "Custom");
    default:
      return presetId;
  }
}

function getYoutubeSectionMeta(sectionId: string, copy: LabI18n = LAB_FALLBACK_I18N) {
  switch (sectionId) {
    case "download":
      return {
        title: copy.t("mediaAnalysis.source.youtubeForm.sections.download.title", "Capture Shape"),
        hint: copy.t(
          "mediaAnalysis.source.youtubeForm.sections.download.subtitle",
          "Video profile, container handling, and optional audio extraction stay together here."
        ),
      };
    case "captions":
      return {
        title: copy.t(
          "mediaAnalysis.source.youtubeForm.sections.captions.title",
          "Subtitle Capture"
        ),
        hint: copy.t(
          "mediaAnalysis.source.youtubeForm.sections.captions.subtitle",
          "Manual and auto subtitle switches share the same language filter frame."
        ),
      };
    case "network":
      return {
        title: copy.t(
          "mediaAnalysis.source.youtubeForm.sections.network.title",
          "Transfer Controls"
        ),
        hint: copy.t(
          "mediaAnalysis.source.youtubeForm.sections.network.subtitle",
          "Playlist scope, rate limit, and retry behavior stay compact in one place."
        ),
      };
    default:
      return {
        title: sectionId,
        hint: copy.t(
          "mediaAnalysis.source.youtubeForm.defaultSectionHint",
          "Room-approved yt-dlp controls."
        ),
      };
  }
}

function getYoutubeFieldLabel(fieldId: string, copy: LabI18n = LAB_FALLBACK_I18N) {
  switch (fieldId) {
    case "captureMode":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.captureMode", "Capture Mode");
    case "format":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.format", "Format");
    case "mergeOutputFormat":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.mergeOutputFormat", "Container");
    case "recodeVideo":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.recodeVideo", "Recode Video");
    case "audioFormat":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.audioFormat", "Audio Format");
    case "audioQuality":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.audioQuality", "Audio Quality");
    case "writeSubtitles":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.writeSubtitles", "Write Subtitles");
    case "writeAutoSubtitles":
      return copy.t(
        "mediaAnalysis.source.youtubeForm.fields.writeAutoSubtitles",
        "Write Auto Subtitles"
      );
    case "subtitlesLang":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.subtitlesLang", "Subtitle Languages");
    case "playlistItems":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.playlistItems", "Playlist Items");
    case "limitRate":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.limitRate", "Rate Limit");
    case "retries":
      return copy.t("mediaAnalysis.source.youtubeForm.fields.retries", "Retries");
    default:
      return fieldId;
  }
}

function getYoutubePlaceholder(fieldId: string, copy: LabI18n = LAB_FALLBACK_I18N) {
  switch (fieldId) {
    case "subtitlesLang":
      return copy.t("mediaAnalysis.source.youtubeForm.placeholders.subtitlesLang", "en.*,tr.*");
    case "playlistItems":
      return copy.t("mediaAnalysis.source.youtubeForm.placeholders.playlistItems", "1,3-5");
    case "limitRate":
      return copy.t("mediaAnalysis.source.youtubeForm.placeholders.limitRate", "2M");
    default:
      return "";
  }
}

function getYoutubeOptionLabel(
  fieldId: string,
  optionValue: string,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  if (fieldId === "captureMode") {
    switch (optionValue) {
      case "video+audio":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.captureMode.videoAudio",
          "Video + Audio"
        );
      case "audio-only":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.captureMode.audioOnly",
          "Audio Only"
        );
      case "video-only":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.captureMode.videoOnly",
          "Video Only"
        );
      default:
        return optionValue;
    }
  }
  if (fieldId === "format") {
    switch (optionValue) {
      case "bestvideo*+bestaudio/best":
        return copy.t("mediaAnalysis.source.youtubeForm.options.format.best", "Best available");
      case "best[height<=1080][ext=mp4]/best[height<=1080]/best":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.format.mp4_1080",
          "1080p MP4 or lower"
        );
      case "best[height<=720][ext=mp4]/best[height<=720]/best":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.format.mp4_720",
          "720p MP4 or lower"
        );
      case "best[height<=480][ext=mp4]/best[height<=480]/best":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.format.mp4_480",
          "480p MP4 or lower"
        );
      case "best[height<=360][ext=mp4]/best[height<=360]/worst[ext=mp4]/worst":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.format.low",
          "360p / low bandwidth"
        );
      default:
        return optionValue;
    }
  }
  if (fieldId === "audioFormat") {
    if (optionValue === "none") {
      return copy.t("mediaAnalysis.source.youtubeForm.options.audio.none", "Keep original media");
    }
    return optionValue.toUpperCase();
  }
  if (fieldId === "mergeOutputFormat") {
    return optionValue === "auto"
      ? copy.t("mediaAnalysis.source.youtubeForm.options.container.auto", "Auto")
      : optionValue.toUpperCase();
  }
  if (fieldId === "recodeVideo") {
    return optionValue === "none"
      ? copy.t("mediaAnalysis.source.youtubeForm.options.recode.none", "No recode")
      : optionValue.toUpperCase();
  }
  if (fieldId === "audioQuality") {
    switch (optionValue) {
      case "best":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.audioQuality.best",
          "Use extractor default"
        );
      case "0":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.audioQuality.max",
          "0 · Max quality"
        );
      case "2":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.audioQuality.high",
          "2 · High quality"
        );
      case "5":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.audioQuality.medium",
          "5 · Balanced"
        );
      case "7":
        return copy.t(
          "mediaAnalysis.source.youtubeForm.options.audioQuality.small",
          "7 · Smaller file"
        );
      default:
        return optionValue;
    }
  }
  return optionValue;
}

function getLoadSourceActionLabel(
  mode: string,
  hasSource: boolean,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  if (mode === "url") {
    return hasSource
      ? copy.t("mediaAnalysis.source.actions.replaceUrl", "Replace URL Source")
      : copy.t("mediaAnalysis.source.actions.downloadUrl", "Download URL Source");
  }
  if (mode === "youtube") {
    return hasSource
      ? copy.t("mediaAnalysis.source.actions.replaceYoutube", "Replace YouTube Source")
      : copy.t("mediaAnalysis.source.actions.downloadYoutube", "Capture from YouTube");
  }
  return hasSource
    ? copy.t("mediaAnalysis.source.actions.replaceLocal", "Replace Local Source")
    : copy.t("mediaAnalysis.source.actions.pickLocal", "Copy Local Source");
}

function getLoadSourceDisabled(state: LabStoreState, mode: string) {
  const drafts = state.ui.sourceDrafts;
  if (mode === "url") {
    return drafts.urlInput.trim() === "";
  }
  if (mode === "youtube") {
    return drafts.youtubeUrl.trim() === "" || getToolInstalled(state, "yt-dlp") !== true;
  }
  return false;
}

function renderSourceActionPanel(
  state: LabStoreState,
  mode: string,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const source = getProjectSource(state);
  const hasSource =
    asNonEmptyString(source["storedFileName"]) !== null ||
    asNonEmptyString(source["storedPath"]) !== null;
  const hasSourceForMode = hasSource && isLoadedSourceMatchingMode(source, mode);
  const sourceLocked = getWorkspaceLockState(state).source === true;
  const disabledAttr = sourceLocked || getLoadSourceDisabled(state, mode) ? "disabled" : "";
  const lockHint = sourceLocked
    ? copy.t("mediaAnalysis.source.lockedHint", "Source locked during analysis")
    : "";
  return `
    <div class="labx-source-intake__action">
      <button class="labx-inline-action labx-source-intake__action-button" type="button" data-lab-action="load-source" ${disabledAttr} ${lockHint ? `title="${escapeHtml(lockHint)}"` : ""}>
        ${escapeHtml(getLoadSourceActionLabel(mode, hasSourceForMode, copy))}
      </button>
      ${sourceLocked ? `<span class="labx-source-locked-hint">${escapeHtml(lockHint)}</span>` : ""}
    </div>
  `;
}

function renderYoutubeCustomField(
  fieldRecord: Record<string, unknown>,
  youtubeCustomDrafts: Record<string, unknown>,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const fieldId = asNonEmptyString(fieldRecord["id"]);
  if (fieldId === null) {
    return "";
  }
  const fieldType = asNonEmptyString(fieldRecord["type"]) || "text";
  const fieldValue = youtubeCustomDrafts[fieldId];
  const fieldLabel = getYoutubeFieldLabel(fieldId, copy);
  const itemClassName =
    asNonEmptyString(fieldRecord["span"]) === "full"
      ? "labx-source-intake__custom-item labx-source-intake__custom-item--full"
      : "labx-source-intake__custom-item";

  if (fieldType === "toggle") {
    return `
      <label class="labx-field ${itemClassName}">
        <span>${escapeHtml(fieldLabel)}</span>
        <span class="labx-source-intake__checkbox">
          <input type="checkbox" data-lab-field="source.youtubeCustom.${escapeHtml(fieldId)}" ${
            fieldValue === true ? "checked" : ""
          } />
        </span>
      </label>
    `;
  }

  if (fieldType === "select") {
    const options = Array.isArray(fieldRecord["options"])
      ? (fieldRecord["options"] as unknown[])
      : [];
    const labFieldName =
      fieldId === "captureMode"
        ? "source.youtubeCaptureMode"
        : `source.youtubeCustom.${escapeHtml(fieldId)}`;
    return `
      <label class="labx-field ${itemClassName}">
        <span>${escapeHtml(fieldLabel)}</span>
        <select class="labx-select" data-lab-field="${labFieldName}">
          ${options
            .map(function (optionValue) {
              const optionRecord = asLabRecord(optionValue);
              const rawValue = asNonEmptyString(optionRecord["value"]) || "";
              return `<option value="${escapeHtml(rawValue)}" ${
                String(fieldValue || "") === rawValue ? "selected" : ""
              }>${escapeHtml(getYoutubeOptionLabel(fieldId, rawValue, copy))}</option>`;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  return `
    <label class="labx-field ${itemClassName}">
      <span>${escapeHtml(fieldLabel)}</span>
      <input
        class="labx-input"
        type="${fieldType === "number" ? "number" : "text"}"
        data-lab-field="source.youtubeCustom.${escapeHtml(fieldId)}"
        value="${fieldValue === null || fieldValue === undefined ? "" : escapeHtml(String(fieldValue))}"
        placeholder="${escapeHtml(getYoutubePlaceholder(fieldId, copy))}"
      />
    </label>
  `;
}

function renderYoutubeCustomSection(
  sectionRecord: Record<string, unknown>,
  youtubeCustomDrafts: Record<string, unknown>,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const sectionId = asNonEmptyString(sectionRecord["id"]) || "custom";
  const sectionMeta = getYoutubeSectionMeta(sectionId, copy);
  const fields = Array.isArray(sectionRecord["fields"])
    ? (sectionRecord["fields"] as unknown[])
    : [];
  const fieldMarkup = fields
    .map(function (fieldValue) {
      return renderYoutubeCustomField(asLabRecord(fieldValue), youtubeCustomDrafts, copy);
    })
    .join("");

  if (fieldMarkup.trim() === "") {
    return "";
  }

  return `
    <section class="labx-source-intake__custom-frame">
      <div class="labx-source-intake__frame-head">
        <div>
          <strong>${escapeHtml(sectionMeta.title)}</strong>
          <p class="labx-panel-hint">${escapeHtml(sectionMeta.hint)}</p>
        </div>
      </div>
      <div class="labx-source-intake__custom-grid">${fieldMarkup}</div>
    </section>
  `;
}

function buildSvgChannelFilter(settings: LabInteractiveSettings) {
  const r = settings.channelR ? 1 : 0;
  const g = settings.channelG ? 1 : 0;
  const b = settings.channelB ? 1 : 0;
  const needsChannelFilter = !settings.channelR || !settings.channelG || !settings.channelB;
  if (!needsChannelFilter) {
    return "";
  }
  return `
    <svg class="labx-channel-filter" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="labx-ch-isolate">
          <feColorMatrix type="matrix" values="${String(r)} 0 0 0 0  0 ${String(g)} 0 0 0  0 0 ${String(b)} 0 0  0 0 0 1 0"/>
        </filter>
      </defs>
    </svg>
  `;
}

function buildPreviewFilterState(settings: LabInteractiveSettings) {
  const filterParts: string[] = [];
  if (settings.brightness !== 100) {
    filterParts.push(`brightness(${String(settings.brightness / 100)})`);
  }
  if (settings.contrast !== 100) {
    filterParts.push(`contrast(${String(settings.contrast / 100)})`);
  }
  if (settings.gamma !== 1.0) {
    const gammaVal = Math.pow(settings.gamma, 0.45);
    filterParts.push(`brightness(${String(gammaVal.toFixed(2))})`);
  }
  if (settings.saturation !== 100) {
    filterParts.push(`saturate(${String(settings.saturation / 100)})`);
  }
  if (settings.hueRotate !== 0) {
    filterParts.push(`hue-rotate(${String(settings.hueRotate)}deg)`);
  }
  if (settings.sharpness !== 100) {
    const sharpVal = (settings.sharpness - 100) / 100;
    if (sharpVal > 0) {
      filterParts.push(`contrast(${String((1 + sharpVal * 0.3).toFixed(2))})`);
    } else if (sharpVal < 0) {
      filterParts.push(`blur(${String(Math.abs(sharpVal * 0.5).toFixed(2))}px)`);
    }
  }
  if (settings.invert) {
    filterParts.push("invert(1)");
  }
  if (!settings.channelR || !settings.channelG || !settings.channelB) {
    filterParts.push("url(#labx-ch-isolate)");
  }
  if (settings.edgeHighlight) {
    filterParts.push("contrast(1.8)");
  }
  const svgFilter = buildSvgChannelFilter(settings);
  const filterCss = filterParts.length > 0 ? `filter: ${filterParts.join(" ")};` : "";
  return {
    svgFilter,
    filterCss,
  };
}

function renderVideoPreviewMedia(
  previewUrl: string,
  settings: LabInteractiveSettings,
  options: {
    controls?: boolean;
    muted?: boolean;
    preserveKey?: string;
    role?: string;
    className?: string;
    selectionRoiStage?: boolean;
  } = {}
) {
  const { svgFilter, filterCss } = buildPreviewFilterState(settings);
  const controls = options.controls === true ? "controls" : "";
  const muted = options.muted === true ? "muted" : "";
  const preserveKey = options.preserveKey || "workspace-preview";
  const roleAttr = options.role ? `data-lab-role="${escapeHtml(options.role)}"` : "";
  const className = options.className || "labx-preview-media--workspace-video";
  const selectionRoiStageAttr =
    options.selectionRoiStage === true
      ? `data-lab-selection-roi-stage="true" data-lab-selection-roi-controls-reserve="${controls ? "56" : "0"}"`
      : "";
  return `
    ${svgFilter}
    <div class="labx-preview-filter-wrap" style="${filterCss}" ${selectionRoiStageAttr}>
      <video class="labx-preview-media ${escapeHtml(className)}" data-lab-preserve-media="${escapeHtml(preserveKey)}" ${roleAttr} src="${escapeHtml(previewUrl)}" ${controls} ${muted} preload="metadata" playsinline></video>
    </div>
  `;
}

function renderAudioPreviewMedia(
  previewUrl: string,
  options: {
    controls?: boolean;
    preserveKey?: string;
    role?: string;
    className?: string;
  } = {}
) {
  const controls = options.controls !== false ? "controls" : "";
  const preserveKey = options.preserveKey || "workspace-preview";
  const roleAttr = options.role ? `data-lab-role="${escapeHtml(options.role)}"` : "";
  const className = options.className || "labx-preview-media--audio";
  return `
    <audio class="labx-preview-media ${escapeHtml(className)}" data-lab-preserve-media="${escapeHtml(preserveKey)}" ${roleAttr} src="${escapeHtml(previewUrl)}" ${controls} preload="metadata"></audio>
  `;
}

export function renderPreviewMedia(
  sourceKind: string,
  previewUrl: string | null,
  settings: LabInteractiveSettings,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  if (previewUrl === null) {
    return `
      <div class="labx-empty-state labx-workspace-empty">
        <strong class="labx-empty-state__title">${escapeHtml(copy.t("mediaAnalysis.source.previewEmptyTitle", "Select a source to begin"))}</strong>
      </div>
    `;
  }

  if (sourceKind === "image") {
    const { svgFilter, filterCss } = buildPreviewFilterState(settings);
    return `
      ${svgFilter}
      <img class="labx-preview-media labx-preview-media--workspace-image" data-lab-preserve-media="workspace-preview" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(copy.t("mediaAnalysis.source.workspacePreviewAlt", "Workspace preview"))}" style="${filterCss}" />
    `;
  }
  if (sourceKind === "audio") {
    return `
      <div class="labx-audio-visualizer">
        ${renderAudioPreviewMedia(previewUrl)}
      </div>
    `;
  }
  return renderVideoPreviewMedia(previewUrl, settings);
}

export function renderViewportStatePanel(
  viewportState: "empty" | "loading" | "error",
  retryBlockReason: LabSourceRetryBlockReason | null,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  if (viewportState === "loading") {
    return `
      <div class="labx-empty-state labx-workspace-loading" data-media-viewport-state="loading">
        <div class="labx-viewport-skeleton" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <strong class="labx-empty-state__title">${escapeHtml(copy.t("mediaAnalysis.source.viewport.loadingTitle", "Source preparation in progress"))}</strong>
        <p>${escapeHtml(copy.t("mediaAnalysis.source.viewport.loadingBody", "The preview will unlock after the probe completes."))}</p>
      </div>
    `;
  }
  if (viewportState === "error") {
    const retryBlockMessage =
      retryBlockReason === null ? null : formatSourceRetryBlockReason(retryBlockReason, copy);
    return `
      <div class="labx-empty-state labx-workspace-error" data-media-viewport-state="error">
        <strong class="labx-empty-state__title">${escapeHtml(copy.t("mediaAnalysis.source.viewport.errorTitle", "Source preparation failed"))}</strong>
        <p>${escapeHtml(copy.t("mediaAnalysis.source.viewport.errorBody", "Check the source settings and retry the source probe."))}</p>
        <button
          class="labx-inline-action"
          type="button"
          data-lab-action="source-probe-retry"
          ${retryBlockReason !== null ? "disabled" : ""}
          ${retryBlockMessage !== null ? `title="${escapeHtml(retryBlockMessage)}"` : ""}
        >
          ${escapeHtml(copy.t("mediaAnalysis.source.viewport.retry", "Retry Source Probe"))}
        </button>
        ${retryBlockMessage !== null ? `<small>${escapeHtml(retryBlockMessage)}</small>` : ""}
      </div>
    `;
  }
  return `
    <div class="labx-empty-state labx-workspace-empty" data-media-viewport-state="empty">
      <strong class="labx-empty-state__title">${escapeHtml(copy.t("mediaAnalysis.source.previewEmptyTitle", "Select a source to begin"))}</strong>
    </div>
  `;
}

export function renderSourceIntake(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  const source = getProjectSource(state);
  const sourceKind = getSourceKind(state);
  const sourceMode = getEffectiveSourceMode(state, sourceKind);
  const sourceDrafts = state.ui.sourceDrafts;
  const ytDlpInstalled = getToolInstalled(state, "yt-dlp");
  const kindOptions = getSourceKindOptions(state);
  const modeOptions = getSourceModeOptions(state, sourceKind);
  const presetIds = getYoutubePresetIds(state);
  const youtubePreset =
    asNonEmptyString(sourceDrafts.youtubePreset) || getDefaultYoutubePreset(state);
  const sourceReadyForMode =
    asNonEmptyString(source["storedPath"]) !== null &&
    isLoadedSourceMatchingMode(source, sourceMode);
  const sourceLocked = getWorkspaceLockState(state).source;
  const sourceFieldDisabledAttr = sourceLocked ? 'disabled aria-disabled="true"' : "";
  const collapsed = state.ui.workspace.sourceIntakeCollapsed === true;
  const sourceSummaryLabel =
    asNonEmptyString(source["storedFileName"]) ||
    asNonEmptyString(source["routeLabel"]) ||
    copy.t("mediaAnalysis.source.currentSource", "current source");
  const youtubeCustomDrafts = {
    ...getYoutubePresetDefaults(state, youtubePreset),
    ...asLabRecord(sourceDrafts.youtubeCustom),
  };
  const customFields = getYoutubeFormSections(state)
    .map(function (section) {
      return renderYoutubeCustomSection(asLabRecord(section), youtubeCustomDrafts, copy);
    })
    .join("");
  const secondaryRowContent =
    sourceMode === "url"
      ? `
        <section class="labx-source-intake__frame labx-source-intake__frame--mode">
            <div class="labx-source-intake__frame-head">
              <div>
              <strong>${escapeHtml(copy.t("mediaAnalysis.source.directUrl.title", "Direct URL Source"))}</strong>
              <p class="labx-panel-hint">${escapeHtml(copy.t("mediaAnalysis.source.directUrl.hint", "Paste a remote URL."))}</p>
            </div>
          </div>
          <div class="labx-source-intake__mode-grid">
            <label class="labx-field">
              <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.urlInput", "Source URL"))}</span>
              <input class="labx-input" data-lab-field="source.urlInput" value="${escapeHtml(sourceDrafts.urlInput)}" placeholder="https://..." ${sourceFieldDisabledAttr} />
            </label>
          </div>
        </section>
      `
      : sourceMode === "youtube"
        ? `
          <section class="labx-source-intake__frame labx-source-intake__frame--mode">
            <div class="labx-source-intake__frame-head">
              <div>
                <strong>${escapeHtml(copy.t("mediaAnalysis.source.youtubeCapture.title", "YouTube Capture"))}</strong>
                <p class="labx-panel-hint">${escapeHtml(copy.t("mediaAnalysis.source.youtubeCapture.hint", "yt-dlp controls in one place."))}</p>
              </div>
            </div>
            <div class="labx-source-intake__youtube-stack">
              <div class="labx-source-intake__youtube-main">
                <label class="labx-field labx-source-intake__youtube-main-item labx-source-intake__youtube-main-item--wide">
                  <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.youtubeUrl", "YouTube URL"))}</span>
                  <input class="labx-input" data-lab-field="source.youtubeUrl" value="${escapeHtml(sourceDrafts.youtubeUrl)}" placeholder="https://youtube.com/watch?v=..." ${sourceFieldDisabledAttr} />
                </label>
                <label class="labx-field labx-source-intake__youtube-main-item">
                  <span>${escapeHtml(copy.t("mediaAnalysis.source.youtubeForm.fields.captureMode", "Capture Mode"))}</span>
                  <select class="labx-select" data-lab-field="source.youtubeCaptureMode" ${sourceFieldDisabledAttr}>
                    <option value="video+audio" ${sourceDrafts.youtubeCaptureMode === "video+audio" ? "selected" : ""}>${escapeHtml(getYoutubeOptionLabel("captureMode", "video+audio", copy))}</option>
                    <option value="audio-only" ${sourceDrafts.youtubeCaptureMode === "audio-only" ? "selected" : ""}>${escapeHtml(getYoutubeOptionLabel("captureMode", "audio-only", copy))}</option>
                    <option value="video-only" ${sourceDrafts.youtubeCaptureMode === "video-only" ? "selected" : ""}>${escapeHtml(getYoutubeOptionLabel("captureMode", "video-only", copy))}</option>
                  </select>
                </label>
              </div>
              <section class="labx-source-intake__frame labx-source-intake__frame--sub">
                <div class="labx-source-intake__frame-head">
                  <div>
                    <strong>${escapeHtml(copy.t("mediaAnalysis.source.youtubePresetLabel", "YouTube Preset"))}</strong>
                    <p class="labx-panel-hint">${escapeHtml(copy.t("mediaAnalysis.source.youtubePresetHint", "Pick a preset or Custom."))}</p>
                  </div>
                </div>
                <div class="labx-chip-row">
                  ${presetIds
                    .map(function (presetId) {
                      return `
                        <button
                          class="labx-chip-button"
                          type="button"
                          data-lab-action="source-youtube-preset"
                          data-lab-value="${escapeHtml(presetId)}"
                          data-selected="${presetId === youtubePreset ? "true" : "false"}"
                          ${sourceFieldDisabledAttr}
                        >
                          ${escapeHtml(getYoutubePresetLabel(presetId, copy))}
                        </button>
                      `;
                    })
                    .join("")}
                </div>
              </section>
              ${
                youtubePreset === "custom" && customFields.trim() !== ""
                  ? `
                    <section class="labx-source-intake__frame labx-source-intake__frame--sub">
                      <div class="labx-source-intake__frame-head">
                        <div>
                          <strong>${escapeHtml(copy.t("mediaAnalysis.source.youtubeCustomTitle", "Custom yt-dlp Settings"))}</strong>
                          <p class="labx-panel-hint">${escapeHtml(copy.t("mediaAnalysis.source.youtubeCustomHint", "Fine-tune yt-dlp options."))}</p>
                        </div>
                      </div>
                      <div class="labx-source-intake__custom-shell">${customFields}</div>
                    </section>
                  `
                  : ""
              }
              ${
                ytDlpInstalled
                  ? ""
                  : `<p class="labx-panel-hint">${escapeHtml(copy.t("mediaAnalysis.source.youtubeDisabled", "yt-dlp is required for YouTube capture. Install it from Tool Manager to enable this import method."))}</p>`
              }
            </div>
          </section>
        `
        : `
          <section class="labx-source-intake__frame labx-source-intake__frame--mode">
            <div class="labx-source-intake__frame-head">
              <div>
                <strong>${escapeHtml(copy.t("mediaAnalysis.source.localCopy.title", "Local Source Copy"))}</strong>
              </div>
            </div>
          </section>
        `;

  return `
    <section
      class="labx-workspace-strip labx-source-intake"
      aria-label="${escapeHtml(copy.t("mediaAnalysis.source.intakeTitle", "Source intake"))}"
      data-collapsed="${collapsed ? "true" : "false"}"
    >
      <div class="labx-source-intake__header">
        <div class="labx-source-intake__header-copy">
          <span class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.source.intakeTitle", "Source Intake"))}</span>
          <strong class="labx-source-intake__title">${escapeHtml(copy.t("mediaAnalysis.source.intakeFrame.title", "Source setup controls"))}</strong>
          ${
            sourceReadyForMode
              ? `<p class="labx-panel-hint">${escapeHtml(copy.t("mediaAnalysis.source.intakeFrame.readyLabel", "Active"))}: ${escapeHtml(sourceSummaryLabel)}</p>`
              : ""
          }
        </div>
        <div class="labx-source-intake__header-meta">
          <div class="labx-source-intake__tags">
            ${renderStatusChip(getSourceKindLabel(sourceKind, copy), "neutral")}
            ${renderStatusChip(getSourceModeLabel(sourceMode, copy), sourceReadyForMode ? "success" : "neutral")}
            <span class="labx-source-intake__status" data-tone="${sourceReadyForMode ? "success" : "idle"}">
              ${escapeHtml(sourceReadyForMode ? copy.t("mediaAnalysis.source.intakeFrame.statusReady", "Source ready") : copy.t("mediaAnalysis.source.intakeFrame.statusPending", "Awaiting source"))}
            </span>
          </div>
          <button
            class="labx-inline-action"
            type="button"
            data-lab-action="workspace-toggle-source-intake"
          >
            ${escapeHtml(collapsed ? copy.t("mediaAnalysis.source.intakeFrame.showAction", "Show source setup") : copy.t("mediaAnalysis.source.intakeFrame.hideAction", "Hide source setup"))}
          </button>
        </div>
      </div>
      ${
        collapsed
          ? ""
          : `
            <div class="labx-source-intake__body">
              <section class="labx-source-intake__frame">
                <div class="labx-source-intake__frame-head">
                  <div>
                    <strong>${escapeHtml(copy.t("mediaAnalysis.source.importRoute", "Import Route"))}</strong>
                  </div>
                </div>
                <div class="labx-source-intake__top">
                  <label class="labx-field">
                    <span>${escapeHtml(copy.t("mediaAnalysis.source.formatLabel", "Source Type"))}</span>
                    <select class="labx-select" data-lab-field="source.kind" ${sourceFieldDisabledAttr}>
                      ${kindOptions
                        .map(function (entry) {
                          return `<option value="${escapeHtml(entry)}" ${
                            entry === sourceKind ? "selected" : ""
                          }>${escapeHtml(getSourceKindLabel(entry, copy))}</option>`;
                        })
                        .join("")}
                    </select>
                  </label>
                  <label class="labx-field">
                    <span>${escapeHtml(copy.t("mediaAnalysis.source.modeLabel", "Import Method"))}</span>
                    <select class="labx-select" data-lab-field="source.mode" ${sourceFieldDisabledAttr}>
                      ${modeOptions
                        .map(function (entry) {
                          return `<option value="${escapeHtml(entry)}" ${
                            entry === sourceMode ? "selected" : ""
                          }>${escapeHtml(getSourceModeLabel(entry, copy))}</option>`;
                        })
                        .join("")}
                    </select>
                  </label>
                  ${renderSourceActionPanel(state, sourceMode, copy)}
                </div>
              </section>
              ${secondaryRowContent}
            </div>
          `
      }
    </section>
  `;
}
