import {
  asLabRecord,
  asNonEmptyString,
  escapeHtml,
  formatBytes,
  formatDurationSeconds,
  getIntentLabel,
  getIntentPreviewDescription,
} from "../models/lab-types.js";
import type {
  LabStageSurface,
  LabStoreState,
  LabAsset,
  LabInteractiveSettings,
} from "../models/lab-types.js";
import {
  getActiveSelection,
  getAudioFocusSettings,
  getBookmarks,
  getCurrentSourceAsset,
  getDualPreviewLinkedAudioAssets,
  getDualPreviewVolume,
  getEffectivePreviewAudioFocusSettings,
  getHypothesis,
  getInspectionMode,
  getInteractiveSettings,
  getLaboratoryProcessSummary,
  getLinkedAudioAssets,
  getProjectSource,
  getReportFreshness,
  getROIRegions,
  getSelectedDualPreviewAudioAsset,
  getSourceKind,
  getSourceMode,
  getSourceMetadata,
  getSourceProbeStatus,
  getSelectedIntents,
  getWaveformTimelineModel,
  hasReportPayload,
  isDualPreviewActive,
  isDualPreviewAvailable,
  isRunActive,
} from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";
import { renderLabWaveformTimeline } from "./lab-waveform-timeline.js";
import { renderWorkspaceROIOverlay } from "./workspace-roi-overlay.js";
import { renderWorkspaceInteractiveControls } from "./workspace-interactive-controls.js";
import { renderWorkspaceAudioFocus } from "./workspace-audio-focus.js";
import { renderWorkspaceHypothesis } from "./workspace-hypothesis.js";
import { renderWorkspaceBookmarks } from "./workspace-bookmarks.js";
import { renderLabTopbarActions } from "./lab-topbar-actions.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import type { LabWaveformTimelineModel } from "./lab-waveform-timeline-types.js";

type WorkspaceSurfaceOptions = {
  activeOverlay?: LabWaveformTimelineModel["activeOverlay"];
  collapsedPanels?: Record<string, boolean>;
  copy?: LabI18n;
};

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

function getWorkspaceIntentLabel(intentId: string, copy: LabI18n): string {
  return copy.t(`mediaAnalysis.workspace.intents.${intentId}.label`, getIntentLabel(intentId));
}

function getWorkspaceIntentPreviewDescription(intentId: string, copy: LabI18n): string {
  return copy.t(
    `mediaAnalysis.workspace.intents.${intentId}.preview`,
    getIntentPreviewDescription(intentId)
  );
}

function renderIntentPreview(intentIds: string[], copy: LabI18n) {
  if (!Array.isArray(intentIds) || intentIds.length === 0) {
    return `
      <div class="labx-intent-preview">
        <strong class="labx-intent-preview__title">${escapeHtml(copy.t("mediaAnalysis.intentPreview.title", "Bu analiz şunları yapacak:"))}</strong>
        <p class="labx-intent-preview__empty">${escapeHtml(copy.t("mediaAnalysis.intentPreview.empty", "Analiz için intent seçin"))}</p>
      </div>
    `;
  }

  return `
    <div class="labx-intent-preview">
      <div class="labx-intent-preview__section">
        <strong class="labx-intent-preview__title">${escapeHtml(copy.t("mediaAnalysis.intentPreview.title", "Bu analiz şunları yapacak:"))}</strong>
        <ul class="labx-intent-preview__list">
          ${intentIds
            .map(function (intentId) {
              return `<li><strong>${escapeHtml(getWorkspaceIntentLabel(intentId, copy))}</strong> · ${escapeHtml(getWorkspaceIntentPreviewDescription(intentId, copy))}</li>`;
            })
            .join("")}
        </ul>
      </div>
      <div class="labx-intent-preview__section">
        <strong class="labx-intent-preview__title">${escapeHtml(copy.t("mediaAnalysis.intentPreview.outputsTitle", "Beklenen çıktılar:"))}</strong>
        <ul class="labx-intent-preview__list">
          <li>${escapeHtml(copy.t("mediaAnalysis.intentPreview.outputs.objectDetection", "Nesne tespiti"))}</li>
          <li>${escapeHtml(copy.t("mediaAnalysis.intentPreview.outputs.anomalyReport", "Anomali raporu"))}</li>
          <li>${escapeHtml(copy.t("mediaAnalysis.intentPreview.outputs.visualFindings", "Görsel bulgular"))}</li>
          <li>${escapeHtml(copy.t("mediaAnalysis.intentPreview.outputs.recommendations", "Öneriler"))}</li>
        </ul>
      </div>
    </div>
  `;
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

function getEffectiveSourceMode(state: LabStoreState, kind: string) {
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

function getSourceActionForMode(mode: string) {
  if (mode === "url") {
    return "source-download-url";
  }
  if (mode === "youtube") {
    return "source-download-youtube";
  }
  return "source-pick-local";
}

function normalizeModeToken(value: string | null) {
  return (value || "").replaceAll(/\s+/g, "").toLowerCase();
}

function isLocalSourceRouteLabel(routeLabel: string) {
  return routeLabel === "localcopy" || routeLabel === "assetreuse";
}

function isLoadedSourceMatchingMode(source: Record<string, unknown>, mode: string) {
  const routeLabel = normalizeModeToken(asNonEmptyString(source["routeLabel"]));
  if (routeLabel === "") {
    return false;
  }
  if (mode === "url") {
    return routeLabel === "directurl";
  }
  if (mode === "youtube") {
    return routeLabel === "youtube";
  }
  return isLocalSourceRouteLabel(routeLabel);
}

function getSourceProgressModel(
  state: LabStoreState,
  mode: string,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const source = getProjectSource(state);
  const probeStatus = getSourceProbeStatus(state);
  const expectedAction = getSourceActionForMode(mode);
  const latestEvent =
    state.activityFeed.find(function (entry) {
      return entry.action === expectedAction;
    }) || null;
  const hasSource =
    asNonEmptyString(source["storedFileName"]) !== null ||
    asNonEmptyString(source["storedPath"]) !== null;
  const loadedSourceMatchesMode = isLoadedSourceMatchingMode(source, mode);
  const hasSourceForMode = hasSource && loadedSourceMatchesMode;
  const showRunningState = probeStatus === "running";
  const showCompletedState = probeStatus === "completed" && loadedSourceMatchesMode;
  const showFailedState = probeStatus === "failed";
  const visibleEvent =
    showRunningState || showCompletedState || showFailedState ? latestEvent : null;
  const latestStage = asNonEmptyString(visibleEvent?.stage) || null;
  const tone = showFailedState
    ? "error"
    : showCompletedState
      ? "success"
      : showRunningState
        ? "running"
        : "idle";

  let percent =
    typeof visibleEvent?.percent === "number"
      ? Math.max(0, Math.min(100, visibleEvent.percent))
      : 0;
  if (showRunningState) {
    if (percent <= 0) {
      percent = latestStage === "queued" ? 12 : 48;
    }
  } else if (showCompletedState) {
    percent = 100;
  } else if (showFailedState && percent <= 0) {
    percent = 100;
  } else {
    percent = 0;
  }

  const detail =
    asNonEmptyString(source["lastError"]) ||
    asNonEmptyString(visibleEvent?.detail) ||
    (showCompletedState
      ? null
      : showRunningState
        ? copy.t(
            "mediaAnalysis.source.progress.runningDetail",
            "Import is running. The source will be saved into this project."
          )
        : hasSourceForMode
          ? copy.t(
              "mediaAnalysis.source.progress.readyToReplace",
              "Ready to replace the current project source."
            )
          : null);

  const label = showCompletedState
    ? copy.t("mediaAnalysis.source.progress.complete", "Import complete")
    : showFailedState
      ? copy.t("mediaAnalysis.source.progress.failed", "Import failed")
      : showRunningState
        ? `${String(percent)}%`
        : copy.t("mediaAnalysis.source.progress.awaiting", "Awaiting import");

  return {
    detail,
    label,
    percent,
    tone,
  };
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
  const sourceLocked = isRunActive(state);
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

function renderSourceProgressPanel(
  state: LabStoreState,
  mode: string,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const progress = getSourceProgressModel(state, mode, copy);
  return `
    <div class="labx-source-bar__progress" data-tone="${escapeHtml(progress.tone)}">
      <div class="labx-source-bar__progress-head">
        <span>${escapeHtml(progress.label)}</span>
      </div>
      <div class="labx-progress labx-source-bar__progress-bar">
        <span style="width:${String(progress.percent)}%"></span>
      </div>
      ${
        progress.detail
          ? `<p class="labx-source-bar__progress-detail">${escapeHtml(progress.detail)}</p>`
          : ""
      }
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
  const controls = options.controls !== false ? "controls" : "";
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

function renderPreviewMedia(
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

function formatDurationMs(durationMs: number | null) {
  if (typeof durationMs !== "number" || Number.isFinite(durationMs) !== true) {
    return "00:00";
  }
  return formatDurationSeconds(durationMs / 1000);
}

function renderDualPreviewAudioPane(
  selectedAudio: LabAsset,
  linkedAudioAssets: LabAsset[],
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const metadata = asLabRecord(selectedAudio.metadata);
  const durationMs =
    typeof metadata["durationMs"] === "number"
      ? Math.max(0, Math.round(metadata["durationMs"]))
      : null;
  const startOffsetMs =
    typeof metadata["startOffsetMs"] === "number" ? Math.round(metadata["startOffsetMs"]) : 0;
  const offsetLabel =
    startOffsetMs === 0
      ? copy.t("mediaAnalysis.dualPreview.syncSameAxis", "Senkron: ✓ Aynı zaman ekseni")
      : copy.t("mediaAnalysis.dualPreview.syncOffset", "Senkron: Ofset {offset} ms", {
          offset: `${startOffsetMs > 0 ? "+" : ""}${String(startOffsetMs)}`,
        });
  return `
    <aside class="labx-dual-preview-audio">
      <div class="labx-dual-preview-audio__header">
        <span class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.dualPreview.linkedAudio", "LINKED AUDIO"))}</span>
        <strong>${escapeHtml(selectedAudio.name)}</strong>
        <p class="labx-panel-hint">${escapeHtml(copy.t("mediaAnalysis.dualPreview.audioHint", "Video master, audio slave. Ayrı kontrol hissi korunur."))}</p>
      </div>
      ${
        linkedAudioAssets.length > 1
          ? `
      <div class="labx-dual-preview-audio__switcher">
        ${linkedAudioAssets
          .map(function (asset) {
            return `
              <button
                class="labx-chip-button"
                type="button"
                data-lab-action="workspace-dual-preview-audio-select"
                data-lab-value="${escapeHtml(asset.id)}"
                data-selected="${asset.id === selectedAudio.id ? "true" : "false"}"
              >
                ${escapeHtml(asset.name)}
              </button>
            `;
          })
          .join("")}
      </div>
      `
          : ""
      }
      <div class="labx-dual-preview-audio__meta">
        <span>${escapeHtml(offsetLabel)}</span>
        ${
          durationMs === null
            ? ""
            : `<span>${escapeHtml(copy.t("mediaAnalysis.dualPreview.duration", "Süre"))} ${escapeHtml(formatDurationMs(durationMs))}</span>`
        }
      </div>
      ${renderAudioPreviewMedia(
        asNonEmptyString(selectedAudio.url) || asNonEmptyString(selectedAudio.localPath) || "",
        {
          controls: false,
          preserveKey: "workspace-preview-dual-audio",
          role: "dual-preview-slave",
          className: "labx-preview-media--dual-audio",
        }
      )}
    </aside>
  `;
}

function renderDualPreviewTransportBar(
  state: LabStoreState,
  durationMs: number,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  return `
    <div class="labx-dual-preview-transport">
      <button
        class="labx-dual-preview-transport__play"
        type="button"
        data-lab-action="dual-preview-toggle-play"
      >
        <span data-lab-role="dual-preview-play-label">▶</span>
      </button>
      <div class="labx-dual-preview-transport__scrub">
        <input
          class="labx-dual-preview-transport__range"
          type="range"
          min="0"
          max="${String(durationMs)}"
          step="10"
          value="0"
          data-lab-action="dual-preview-seek"
          data-lab-role="dual-preview-progress"
        />
        <span class="labx-dual-preview-transport__time" data-lab-role="dual-preview-time">00:00 / ${escapeHtml(formatDurationMs(durationMs))}</span>
      </div>
      <label class="labx-dual-preview-transport__volume">
        <span>${escapeHtml(copy.t("mediaAnalysis.dualPreview.volume", "Volume"))}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value="${String(getDualPreviewVolume(state))}"
          data-lab-field="workspace.dualPreviewVolume"
          data-lab-role="dual-preview-volume"
        />
      </label>
      <button
        class="labx-inline-action labx-inline-action--small"
        type="button"
        data-lab-action="workspace-close-dual-preview"
      >
        ${escapeHtml(copy.t("mediaAnalysis.dualPreview.singlePreview", "Tek preview"))}
      </button>
    </div>
  `;
}

function renderGlobalProcessSummary(state: LabStoreState, copy: LabI18n) {
  const summary = getLaboratoryProcessSummary(state);
  const stateLabel = copy.t(
    `mediaAnalysis.processSummary.states.${summary.state}`,
    summary.state.charAt(0).toUpperCase() + summary.state.slice(1)
  );
  const activeTaskLabel =
    summary.activeTaskLabel ??
    (summary.activeTaskKey
      ? copy.t(`mediaAnalysis.processSummary.tasks.${summary.activeTaskKey}`, summary.activeTaskKey)
      : copy.t("mediaAnalysis.processSummary.noActiveTask", "No active task"));
  const progressLabel =
    summary.progressLabel ??
    (summary.progressKey
      ? copy.t(`mediaAnalysis.processSummary.progress.${summary.progressKey}`, summary.progressKey)
      : copy.t("mediaAnalysis.processSummary.noProgress", "No progress in motion"));
  return `
    <section
      class="labx-global-process"
      data-lab-global-process="true"
      data-process-state="${escapeHtml(summary.state)}"
      data-tone="${escapeHtml(summary.tone)}"
      aria-label="${escapeHtml(copy.t("mediaAnalysis.processSummary.ariaLabel", "Laboratory process state"))}"
    >
      <div class="labx-global-process__state">
        <span class="labx-global-process__dot" aria-hidden="true"></span>
        <span class="labx-global-process__label">${escapeHtml(stateLabel)}</span>
      </div>
      <div class="labx-global-process__task">
        <span class="labx-global-process__eyebrow">${escapeHtml(copy.t("mediaAnalysis.processSummary.activeTask", "Active task"))}</span>
        <strong>${escapeHtml(activeTaskLabel)}</strong>
      </div>
      <div class="labx-global-process__progress">
        <span>${escapeHtml(progressLabel)}</span>
      </div>
    </section>
  `;
}

function renderDualPreviewShell(
  previewUrl: string,
  settings: LabInteractiveSettings,
  overlayMarkup: string,
  roiFocusActive: boolean,
  selectedAudio: LabAsset,
  linkedAudioAssets: LabAsset[],
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  return `
    <div class="labx-workspace-preview__dual-shell">
      <div class="labx-workspace-preview__video-pane">
        <div
          class="labx-workspace-preview__video-stage"
          data-lab-selection-roi-stage="true"
          data-lab-selection-roi-controls-reserve="0"
          data-lab-preview-inspection-stage="true"
          data-lab-preview-inspection-topology="dual-video"
          data-lab-roi-focus-active="${roiFocusActive ? "true" : "false"}"
        >
          <div class="labx-workspace-preview__inspection-viewport" data-lab-preview-inspection-viewport="true">
            <div class="labx-workspace-preview__inspection-content" data-lab-preview-inspection-content="true">
              ${renderVideoPreviewMedia(previewUrl, settings, {
                controls: false,
                muted: true,
                preserveKey: "workspace-preview-dual-video",
                role: "dual-preview-master",
                className: "labx-preview-media--workspace-video",
              })}
              ${overlayMarkup}
            </div>
          </div>
        </div>
      </div>
      <div class="labx-workspace-preview__audio-pane">
        ${renderDualPreviewAudioPane(selectedAudio, linkedAudioAssets, copy)}
      </div>
    </div>
  `;
}

function renderSourceBar(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  const source = getProjectSource(state);
  const sourceKind = getSourceKind(state);
  const sourceMode = getEffectiveSourceMode(state, sourceKind);
  const metadata = getSourceMetadata(state);
  const probeStatus = getSourceProbeStatus(state);
  const hasStoredSource =
    asNonEmptyString(source["storedFileName"]) !== null ||
    asNonEmptyString(source["storedPath"]) !== null;
  const hasSourceForMode = hasStoredSource && isLoadedSourceMatchingMode(source, sourceMode);
  const storedFileName =
    asNonEmptyString(source["storedFileName"]) ||
    asNonEmptyString(source["routeLabel"]) ||
    copy.t("mediaAnalysis.source.noSource", "No source");

  const statusTone =
    probeStatus === "completed" && hasSourceForMode
      ? "success"
      : probeStatus === "failed"
        ? "error"
        : probeStatus === "running"
          ? "running"
          : "neutral";

  const resolution =
    typeof metadata["width"] === "number" && typeof metadata["height"] === "number"
      ? `${String(metadata["width"])}×${String(metadata["height"])}`
      : null;

  return `
    <div class="labx-source-bar">
      <div class="labx-source-bar__info">
        <strong>${escapeHtml(storedFileName)}</strong>
        <div class="labx-source-bar__meta">
          ${renderStatusChip(getSourceKindLabel(sourceKind, copy), statusTone)}
          ${renderStatusChip(getSourceModeLabel(sourceMode, copy), "neutral")}
          ${resolution ? `<span>${escapeHtml(resolution)}</span>` : ""}
          <span>${escapeHtml(formatDurationSeconds(metadata["durationSeconds"]))}</span>
          <span>${escapeHtml(formatBytes(metadata["sizeBytes"]))}</span>
        </div>
      </div>
      ${renderSourceProgressPanel(state, sourceMode, copy)}
    </div>
  `;
}

function renderSourceIntake(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
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
              <p class="labx-panel-hint">${escapeHtml(copy.t("mediaAnalysis.source.directUrl.hint", "Paste a remote URL and optionally rename."))}</p>
            </div>
          </div>
          <div class="labx-source-intake__mode-grid">
            <label class="labx-field">
              <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.urlInput", "Source URL"))}</span>
              <input class="labx-input" data-lab-field="source.urlInput" value="${escapeHtml(sourceDrafts.urlInput)}" placeholder="https://..." />
            </label>
            <label class="labx-field">
              <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.fileNameHint", "Stored File Name"))}</span>
              <input class="labx-input" data-lab-field="source.fileNameHint" value="${escapeHtml(sourceDrafts.fileNameHint)}" placeholder="downloaded-source.mp4" />
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
                  <input class="labx-input" data-lab-field="source.youtubeUrl" value="${escapeHtml(sourceDrafts.youtubeUrl)}" placeholder="https://youtube.com/watch?v=..." />
                </label>
                <label class="labx-field labx-source-intake__youtube-main-item">
                  <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.fileNameHint", "Stored File Name"))}</span>
                  <input class="labx-input" data-lab-field="source.fileNameHint" value="${escapeHtml(sourceDrafts.fileNameHint)}" placeholder="youtube-source.mp4" />
                </label>
                <label class="labx-field labx-source-intake__youtube-main-item">
                  <span>${escapeHtml(copy.t("mediaAnalysis.source.youtubeForm.fields.captureMode", "Capture Mode"))}</span>
                  <select class="labx-select" data-lab-field="source.youtubeCaptureMode">
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
            <div class="labx-source-intake__mode-grid">
              <label class="labx-field">
                <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.fileNameHint", "Stored File Name"))}</span>
                <input class="labx-input" data-lab-field="source.fileNameHint" value="${escapeHtml(sourceDrafts.fileNameHint)}" placeholder="project-source.mp4" />
              </label>
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
                    <select class="labx-select" data-lab-field="source.kind">
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
                    <select class="labx-select" data-lab-field="source.mode">
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

function renderLinkedAudioBar(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  const currentSourceAsset = getCurrentSourceAsset(state);
  if (currentSourceAsset === null) {
    return "";
  }

  const linkedAudioAssets = getLinkedAudioAssets(state, currentSourceAsset.id);
  if (linkedAudioAssets.length === 0) {
    return "";
  }
  const dualPreviewAvailable = isDualPreviewAvailable(state);
  const dualPreviewActive = isDualPreviewActive(state);
  const selectedAudio = getSelectedDualPreviewAudioAsset(state);

  const label =
    linkedAudioAssets.length === 1
      ? copy.t("mediaAnalysis.linkedAudio.single", "Bu kaynağın ses çıktısı mevcut:")
      : copy.t("mediaAnalysis.linkedAudio.multiple", "Bu kaynağın ses çıktıları mevcut:");

  return `
    <div class="labx-linked-audio-bar">
      <span class="labx-linked-audio-bar__label">${escapeHtml(label)}</span>
      <div class="labx-linked-audio-bar__items">
        ${
          dualPreviewAvailable
            ? `
              <button
                class="labx-inline-action"
                type="button"
                data-lab-action="${dualPreviewActive ? "workspace-close-dual-preview" : "workspace-open-dual-preview"}"
                data-lab-value="${escapeHtml(selectedAudio?.id || linkedAudioAssets[0]?.id || "")}"
              >
                ${escapeHtml(
                  dualPreviewActive
                    ? copy.t("mediaAnalysis.linkedAudio.closeDualPreview", "Tek preview'a dön")
                    : copy.t("mediaAnalysis.linkedAudio.openDualPreview", "🎧 Ses ile birlikte aç")
                )}
              </button>
            `
            : ""
        }
        ${linkedAudioAssets
          .map(function (asset) {
            return `
              <span class="labx-linked-audio-bar__item">
                <strong>${escapeHtml(asset.name)}</strong>
                <button
                  class="labx-inline-action labx-inline-action--small"
                  type="button"
                  data-lab-action="asset-preview"
                  data-lab-value="${escapeHtml(asset.id)}"
                >
                  ${escapeHtml(copy.t("mediaAnalysis.linkedAudio.openAsset", "Aç"))}
                </button>
              </span>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

export function renderWorkspaceSurface(
  state: LabStoreState,
  options: WorkspaceSurfaceOptions = {}
): LabStageSurface {
  const copy = options.copy ?? LAB_FALLBACK_I18N;
  const source = getProjectSource(state);
  const sourceKind = getSourceKind(state);
  const sourceMode = getEffectiveSourceMode(state, sourceKind);
  const metadata = getSourceMetadata(state);
  const probeStatus = getSourceProbeStatus(state);
  const previewUrl = asNonEmptyString(source["previewUrl"]);
  const settings = getInteractiveSettings(state);
  const audioFocus = getAudioFocusSettings(state);
  const effectivePreviewAudioFocus = getEffectivePreviewAudioFocusSettings(state);
  const roiRegions = getROIRegions(state);
  const activeSelection = getActiveSelection(state);
  const inspectionMode = getInspectionMode(state);
  const timeline = getWaveformTimelineModel(state);
  const timelineModel: LabWaveformTimelineModel = {
    ...timeline,
    activeOverlay: options.activeOverlay ?? "none",
    collapsedPanels: options.collapsedPanels ?? {},
    copy,
  };
  const roiFocusActive = timeline.roiFocusActive === true;
  const bookmarks = getBookmarks(state);
  const hypothesis = getHypothesis(state);
  const runActive = isRunActive(state);
  const hasReport = hasReportPayload(state);
  const hasAudio = sourceKind === "audio" || sourceKind === "video";
  const sourceReady = probeStatus === "completed" && isLoadedSourceMatchingMode(source, sourceMode);
  const dualPreviewAvailable = isDualPreviewAvailable(state);
  const dualPreviewActive = sourceReady && isDualPreviewActive(state);
  const dualPreviewLinkedAudioAssets = getDualPreviewLinkedAudioAssets(state);
  const selectedDualPreviewAudioAsset = getSelectedDualPreviewAudioAsset(state);
  const hasVisualControls = sourceReady && (sourceKind === "video" || sourceKind === "image");
  const durationMs =
    sourceReady && typeof metadata["durationSeconds"] === "number"
      ? Math.round(metadata["durationSeconds"] * 1000)
      : 0;
  const focusPanels = [
    hasAudio && sourceReady
      ? renderWorkspaceAudioFocus(
          audioFocus,
          {
            previewTarget: sourceKind === "video" ? "video" : "audio",
            temporalAudioFocus: effectivePreviewAudioFocus,
            temporalControlsEnabled: dualPreviewActive !== true,
          },
          copy
        )
      : "",
    hasVisualControls ? renderWorkspaceInteractiveControls(settings, copy) : "",
  ].filter(Boolean);
  const focusSection =
    focusPanels.length > 0
      ? `
        <div class="labx-workspace-focus-row" data-layout="${focusPanels.length > 1 ? "split" : "single"}">
          ${focusPanels.join("")}
        </div>
      `
      : "";
  const roiOverlayMarkup =
    sourceReady && (sourceKind === "video" || sourceKind === "image")
      ? renderWorkspaceROIOverlay(
          {
            inspectionMode,
            legacyRegions: roiRegions,
            roiFocusActive,
            selectionRoi: activeSelection?.roi ?? null,
            selectionRoiEnabled:
              sourceKind === "image" ||
              (activeSelection !== null && activeSelection.endMs > activeSelection.startMs),
            showInlineInspectionControls: sourceKind === "image",
            sourceKind,
          },
          copy
        )
      : "";
  const previewMediaMarkup =
    sourceReady &&
    dualPreviewActive &&
    previewUrl !== null &&
    selectedDualPreviewAudioAsset !== null &&
    dualPreviewLinkedAudioAssets.length > 0
      ? renderDualPreviewShell(
          previewUrl,
          settings,
          roiOverlayMarkup,
          roiFocusActive,
          selectedDualPreviewAudioAsset,
          dualPreviewLinkedAudioAssets,
          copy
        )
      : renderPreviewMedia(sourceKind, sourceReady ? previewUrl : null, settings, copy);
  const previewMarkup =
    sourceReady && (sourceKind === "video" || sourceKind === "image") && dualPreviewActive !== true
      ? `
        <div
          class="labx-workspace-preview__single-stage"
          data-lab-selection-roi-stage="true"
          data-lab-selection-roi-controls-reserve="${sourceKind === "video" ? "56" : "0"}"
          data-lab-preview-inspection-stage="true"
          data-lab-preview-inspection-topology="single-${escapeHtml(sourceKind)}"
          data-lab-roi-focus-active="${roiFocusActive ? "true" : "false"}"
        >
          <div class="labx-workspace-preview__inspection-viewport" data-lab-preview-inspection-viewport="true">
            <div class="labx-workspace-preview__inspection-content" data-lab-preview-inspection-content="true">
              ${previewMediaMarkup}
              ${roiOverlayMarkup}
            </div>
          </div>
        </div>
      `
      : previewMediaMarkup;
  const dualPreviewTransport =
    dualPreviewActive && selectedDualPreviewAudioAsset !== null && durationMs > 0
      ? renderDualPreviewTransportBar(state, durationMs, copy)
      : "";

  const main = `
    ${renderSourceBar(state, copy)}
    ${renderGlobalProcessSummary(state, copy)}
    ${renderLabTopbarActions(state, copy)}
    ${renderSourceIntake(state, copy)}
    <section class="labx-workspace-main" id="lab-workspace-main">
      ${renderLinkedAudioBar(state, copy)}
      <div class="labx-workspace-preview" id="lab-workspace-preview" data-preview-mode="${dualPreviewActive ? "dual" : "single"}" data-dual-preview-available="${dualPreviewAvailable ? "true" : "false"}">
        ${previewMarkup}
      </div>
      ${dualPreviewTransport}
      ${durationMs > 0 ? renderLabWaveformTimeline(timelineModel) : ""}
      ${renderWorkspaceHypothesis(hypothesis, copy)}
      ${focusSection}
      ${renderWorkspaceBookmarks(bookmarks, copy)}
    </section>
  `;

  const freshness = getReportFreshness(state);
  const freshnessLabel =
    freshness?.state === "current"
      ? copy.t("mediaAnalysis.reportFreshness.current", "\u2713 Güncel")
      : freshness?.state === "previous-run"
        ? runActive
          ? copy.t(
              "mediaAnalysis.reportFreshness.previousRunActive",
              "\u2298 Önceki çalışma \u00b7 Analiz devam ediyor"
            )
          : copy.t("mediaAnalysis.reportFreshness.previousRun", "\u2298 Önceki çalışma")
        : freshness?.state === "stale"
          ? copy.t(
              "mediaAnalysis.reportFreshness.stale",
              "\u2298 Eski çalışma \u00b7 Son analiz başarısız"
            )
          : "";
  const freshnessMeta =
    freshness && freshness.workspaceDirty
      ? `${freshnessLabel} \u00b7 ${copy.t("mediaAnalysis.reportFreshness.workspaceDirty", "Workspace farklı")}`
      : freshnessLabel;

  const reportButton = `
    <div class="labx-analysis-trigger">
      <button
        class="labx-primary-cta labx-primary-cta--compact"
        type="button"
        data-lab-action="open-report-overlay"
        ${hasReport ? "" : "disabled"}
      >
        <strong>${escapeHtml(copy.t("mediaAnalysis.analysisActions.viewReport", "Raporu Görüntüle"))}</strong>
      </button>
      ${
        hasReport && freshnessMeta
          ? `<span class="labx-report-freshness" data-freshness="${escapeHtml(freshness?.state || "")}" data-workspace-dirty="${freshness?.workspaceDirty === true ? "true" : "false"}">${escapeHtml(freshnessMeta)}</span>`
          : ""
      }
    </div>
  `;

  const intentPreview = sourceReady ? renderIntentPreview(getSelectedIntents(state), copy) : "";

  const analysisButton = sourceReady
    ? `
      <div class="labx-analysis-trigger">
        <button
          class="labx-primary-cta labx-primary-cta--compact"
          type="button"
          data-lab-action="run-deep-analysis"
        >
          <strong>${escapeHtml(
            runActive
              ? copy.t("mediaAnalysis.analysisActions.cancel", "Analizi İptal Et")
              : copy.t("mediaAnalysis.analysisActions.start", "Derin Analiz Başlat")
          )}</strong>
        </button>
        ${intentPreview}
      </div>
    `
    : "";
  const imageAnalysisButton =
    sourceReady && sourceKind === "image"
      ? `
        <div class="labx-analysis-trigger">
          <button class="labx-secondary-cta" type="button" data-lab-action="workspace-image-analysis">
            ${escapeHtml(copy.t("mediaAnalysis.analysisActions.imageAnalysis", "Görsel Analiz Et"))}
          </button>
        </div>
      `
      : "";

  const side = `
    ${analysisButton}
    ${reportButton}
    ${imageAnalysisButton}
  `;

  return { main, side };
}
