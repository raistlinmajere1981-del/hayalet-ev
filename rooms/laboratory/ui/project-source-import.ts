import { asLabRecord, escapeHtml } from "../models/lab-types.js";
import type {
  LabProjectImportKind,
  LabProjectImportMethod,
  LabStoreState,
  LabYoutubeImportCustomFormat,
  LabYoutubeImportCustomResolution,
  LabYoutubeImportStrategy,
} from "../models/lab-types.js";
import {
  LAB_PROJECT_IMPORT_KINDS,
  buildProjectImportHostAction,
  getProjectImportMethodOptions,
  getProjectImportRoute,
} from "../runtime/lab-project-import.js";
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

function selectedAttr(current: string, value: string) {
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

function getMethodLabel(method: LabProjectImportMethod, copy: LabI18n) {
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

function getMethodDescription(method: LabProjectImportMethod, copy: LabI18n) {
  switch (method) {
    case "youtube":
      return copy.t(
        "mediaAnalysis.projectImport.methods.youtube.description",
        "Preview and extract with strategy controls"
      );
    case "url":
      return copy.t(
        "mediaAnalysis.projectImport.methods.url.description",
        "Download from a remote media URL"
      );
    case "local":
    default:
      return copy.t(
        "mediaAnalysis.projectImport.methods.local.description",
        "Copy a file into the active project"
      );
  }
}

function getToolInstalled(state: LabStoreState, toolId: string) {
  const toolState = asLabRecord(state.toolState);
  const tools = asLabRecord(toolState["tools"]);
  return asLabRecord(tools[toolId])["installed"] === true;
}

function getMethodDisabledReason(
  state: LabStoreState,
  kind: LabProjectImportKind,
  method: LabProjectImportMethod,
  copy: LabI18n
) {
  if (method === "youtube" && kind !== "video") {
    return copy.t("mediaAnalysis.projectImport.methods.youtube.videoOnly", "Only video imports can use YouTube");
  }
  if (method === "youtube" && getToolInstalled(state, "yt-dlp") !== true) {
    return copy.t(
      "mediaAnalysis.projectImport.methods.youtube.missingTool",
      "Install yt-dlp to use YouTube imports"
    );
  }
  return null;
}

function getYoutubeStrategyView(strategy: LabYoutubeImportStrategy, copy: LabI18n) {
  switch (strategy) {
    case "audio_only":
      return {
        label: copy.t("mediaAnalysis.source.youtubeImport.strategies.audioOnly.label", "Audio Only"),
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
        label: copy.t("mediaAnalysis.source.youtubeImport.strategies.lowSize.label", "Small Size"),
        description: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.lowSize.description",
          "Compressed for quick use"
        ),
        estimatedSize: copy.t("mediaAnalysis.source.youtubeImport.strategies.lowSize.size", "~5 MB"),
        formatLabel: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.lowSize.format",
          "MP4 compressed"
        ),
      };
    case "custom":
      return {
        label: copy.t("mediaAnalysis.source.youtubeImport.strategies.custom.label", "Advanced"),
        description: copy.t(
          "mediaAnalysis.source.youtubeImport.strategies.custom.description",
          "Manual control over formats"
        ),
        estimatedSize: copy.t("mediaAnalysis.source.youtubeImport.strategies.custom.size", "Manual"),
        formatLabel: copy.t("mediaAnalysis.source.youtubeImport.strategies.custom.format", "Manual"),
      };
    case "video_best":
    default:
      return {
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

function renderKindTabs(state: LabStoreState, copy: LabI18n) {
  const activeKind = state.ui.projectImport.activeKind;
  return `
    <div class="labx-project-import__tabs" role="tablist" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.tabsLabel", "Media type"))}">
      ${LAB_PROJECT_IMPORT_KINDS.map(function (kind) {
        const active = kind === activeKind;
        return `
          <button
            class="labx-project-import__tab"
            type="button"
            role="tab"
            data-lab-action="project-import-kind"
            data-lab-value="${escapeHtml(kind)}"
            aria-selected="${active ? "true" : "false"}"
            data-active="${active ? "true" : "false"}"
          >
            ${escapeHtml(getKindLabel(kind, copy))}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderMethodCards(state: LabStoreState, copy: LabI18n) {
  const route = getProjectImportRoute(state);
  const methods = getProjectImportMethodOptions(state, route.kind);
  return `
    <div class="labx-project-import__methods" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.methodsLabel", "Import method"))}">
      ${methods
        .map(function (method) {
          const active = method === route.method;
          const disabledReason = getMethodDisabledReason(state, route.kind, method, copy);
          const disabled = disabledReason !== null;
          return `
            <button
              class="labx-project-import__method"
              type="button"
              data-lab-action="project-import-method"
              data-lab-value="${escapeHtml(method)}"
              data-active="${active ? "true" : "false"}"
              ${disabled ? `disabled title="${escapeHtml(disabledReason || "")}"` : ""}
            >
              <span>${escapeHtml(getMethodLabel(method, copy))}</span>
              <small>${escapeHtml(getMethodDescription(method, copy))}</small>
              ${disabledReason !== null ? `<small class="labx-project-import__method-warning">${escapeHtml(disabledReason)}</small>` : ""}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderYoutubeStrategyCards(activeStrategy: LabYoutubeImportStrategy, copy: LabI18n) {
  return `
    <div class="labx-strategy-list labx-project-import__strategies" aria-label="${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.strategyListLabel", "Extraction strategy"))}">
      ${YOUTUBE_IMPORT_STRATEGIES.map(function (strategy) {
        const view = getYoutubeStrategyView(strategy, copy);
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

function renderYoutubeAdvancedSettings(state: LabStoreState, copy: LabI18n) {
  if (state.ui.youtubeImport.strategy !== "custom") {
    return "";
  }
  const custom = state.ui.youtubeImport.custom;
  return `
    <div class="labx-advanced-settings labx-project-import__advanced">
      <label class="labx-import-control">
        <span>${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.advancedResolution", "Resolution"))}</span>
        <select data-lab-field="youtube-import.custom.resolution">
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
        <select data-lab-field="youtube-import.custom.format">
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

function renderYoutubeStatus(state: LabStoreState, copy: LabI18n) {
  if (state.ui.youtubeImport.status === "parsing") {
    return `<p class="labx-project-import__status" role="status">${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.statusParsing", "Analyzing video metadata..."))}</p>`;
  }
  if (state.ui.youtubeImport.status === "error") {
    return `<p class="labx-project-import__status" data-tone="error" role="alert">${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.statusError", "Invalid YouTube URL or network error"))}</p>`;
  }
  if (state.ui.youtubeImport.status === "ready") {
    const view = getYoutubeStrategyView(state.ui.youtubeImport.strategy, copy);
    return `<p class="labx-project-import__status">${escapeHtml(copy.t("mediaAnalysis.source.youtubeImport.readyEstimatedSize", "Estimated size: {size}", { size: view.estimatedSize }))}</p>`;
  }
  return "";
}

function renderRouteFields(state: LabStoreState, copy: LabI18n) {
  const route = getProjectImportRoute(state);
  const draft = route.draft;
  if (route.method === "url") {
    return `
      <div class="labx-project-import__fields" data-method="url">
        <label class="labx-field">
          <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.urlInput", "Source URL"))}</span>
          <input class="labx-input" data-lab-field="project-import.urlInput" value="${escapeHtml(draft.urlInput)}" placeholder="https://..." />
        </label>
        <label class="labx-field">
          <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.fileNameHint", "Stored File Name"))}</span>
          <input class="labx-input" data-lab-field="project-import.fileNameHint" value="${escapeHtml(draft.fileNameHint)}" placeholder="${escapeHtml(route.kind === "audio" ? "audio-source.mp3" : route.kind === "image" ? "image-source.png" : "video-source.mp4")}" />
        </label>
      </div>
    `;
  }
  if (route.method === "youtube") {
    const youtubeUrl = state.ui.youtubeImport.url || draft.youtubeUrl;
    return `
      <div class="labx-project-import__fields" data-method="youtube">
        <label class="labx-field labx-project-import__field-wide">
          <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.youtubeUrl", "YouTube URL"))}</span>
          <input class="labx-input" data-lab-field="project-import.youtubeUrl" value="${escapeHtml(youtubeUrl || "")}" placeholder="https://youtube.com/watch?v=..." />
        </label>
        <label class="labx-field">
          <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.fileNameHint", "Stored File Name"))}</span>
          <input class="labx-input" data-lab-field="project-import.fileNameHint" value="${escapeHtml(draft.fileNameHint)}" placeholder="youtube-source.mp4" />
        </label>
        ${renderYoutubeStatus(state, copy)}
        ${renderYoutubeStrategyCards(state.ui.youtubeImport.strategy, copy)}
        ${renderYoutubeAdvancedSettings(state, copy)}
      </div>
    `;
  }
  return `
    <div class="labx-project-import__fields" data-method="local">
      <label class="labx-field">
        <span>${escapeHtml(copy.t("mediaAnalysis.source.fields.fileNameHint", "Stored File Name"))}</span>
        <input class="labx-input" data-lab-field="project-import.fileNameHint" value="${escapeHtml(draft.fileNameHint)}" placeholder="${escapeHtml(route.kind === "audio" ? "audio-source.mp3" : route.kind === "image" ? "image-source.png" : "video-source.mp4")}" />
      </label>
      <p class="labx-project-import__hint">${escapeHtml(copy.t("mediaAnalysis.projectImport.localHint", "The file picker opens when you press Add."))}</p>
    </div>
  `;
}

export function renderProjectSourceImport(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const route = getProjectImportRoute(state);
  const addState = buildProjectImportHostAction(state);
  const disabledAttr = addState.disabledReason !== null ? " disabled" : "";
  const disabledTitle =
    addState.disabledReason !== null ? ` title="${escapeHtml(addState.disabledReason)}"` : "";
  return `
    <section class="labx-project-import" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.title", "Source Import Workspace"))}">
      <div class="labx-project-import__header">
        <div>
          <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.projectImport.eyebrow", "Project Source"))}</p>
          <h2>${escapeHtml(copy.t("mediaAnalysis.projectImport.title", "Source Import Workspace"))}</h2>
        </div>
        <span class="labx-project-import__route">${escapeHtml(getKindLabel(route.kind, copy))} / ${escapeHtml(getMethodLabel(route.method, copy))}</span>
      </div>
      ${renderKindTabs(state, copy)}
      <div class="labx-project-import__body">
        ${renderMethodCards(state, copy)}
        ${renderRouteFields(state, copy)}
      </div>
      <div class="labx-project-import__footer">
        <button class="labx-project-import__btn" type="button" data-lab-action="project-import-clear">
          ${escapeHtml(copy.t("mediaAnalysis.projectImport.clear", "Clear"))}
        </button>
        <button class="labx-project-import__btn labx-project-import__btn--accent" type="button" data-lab-action="project-import-add"${disabledAttr}${disabledTitle}>
          ${escapeHtml(copy.t("mediaAnalysis.projectImport.add", "Add"))}
        </button>
      </div>
    </section>
  `;
}
