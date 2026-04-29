import { asLabRecord } from "../models/lab-types.js";
import type {
  LabEventFeedItem,
  LabProjectImportKind,
  LabProjectImportMethod,
  LabSourceDrafts,
  LabStoreState,
  LabYoutubeImportCustomFormat,
  LabYoutubeImportCustomResolution,
} from "../models/lab-types.js";

export const LAB_PROJECT_IMPORT_KINDS: LabProjectImportKind[] = ["video", "audio", "image"];

export type LabProjectImportHostAction = {
  action: "source-pick-local" | "source-download-url" | "source-download-youtube";
  disabledReason: string | null;
  fields: Record<string, unknown>;
  kind: LabProjectImportKind;
  method: LabProjectImportMethod;
};

function getSnapshotRecord(state: LabStoreState) {
  return asLabRecord(state.snapshot);
}

function getSourcePresets(state: LabStoreState) {
  return asLabRecord(getSnapshotRecord(state)["sourcePresets"]);
}

function getSourceTypes(state: LabStoreState) {
  return asLabRecord(getSourcePresets(state)["sourceTypes"]);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

function getYoutubePresetDefaults(state: LabStoreState, presetId: string) {
  const presetRecord = asLabRecord(getSourcePresets(state)["youtubePresets"]);
  return asLabRecord(asLabRecord(presetRecord[presetId])["defaultCustomValues"]);
}

function getToolInstalled(state: LabStoreState, toolId: string) {
  const toolState = asLabRecord(state.toolState);
  const tools = asLabRecord(toolState["tools"]);
  return asLabRecord(tools[toolId])["installed"] === true;
}

export function normalizeProjectImportKindValue(value: unknown): LabProjectImportKind | null {
  return value === "video" || value === "audio" || value === "image" ? value : null;
}

export function normalizeProjectImportMethodValue(
  value: unknown,
  kind: LabProjectImportKind
): LabProjectImportMethod | null {
  if (value === "youtube") {
    return kind === "video" ? "youtube" : null;
  }
  return value === "local" || value === "url" ? value : null;
}

export function getProjectImportMethodOptions(
  state: LabStoreState,
  kind: LabProjectImportKind
): LabProjectImportMethod[] {
  const sourceConfig = asLabRecord(getSourceTypes(state)[kind]);
  const configuredModes = toStringArray(sourceConfig["modes"]).filter(function (
    mode
  ): mode is LabProjectImportMethod {
    return normalizeProjectImportMethodValue(mode, kind) !== null;
  });
  if (configuredModes.length > 0) {
    return configuredModes;
  }
  return kind === "video" ? ["local", "url", "youtube"] : ["local", "url"];
}

export function getProjectImportRoute(state: LabStoreState) {
  const kind = state.ui.projectImport.activeKind;
  const methods = getProjectImportMethodOptions(state, kind);
  const configuredMethod = state.ui.projectImport.methods[kind];
  const method = methods.includes(configuredMethod) ? configuredMethod : methods[0] || "local";
  return {
    kind,
    method,
    methods,
    draft: state.ui.projectImport.drafts[kind],
  };
}

function getProjectImportActionForMethod(method: LabProjectImportMethod) {
  if (method === "youtube") {
    return "source-download-youtube" as const;
  }
  if (method === "url") {
    return "source-download-url" as const;
  }
  return "source-pick-local" as const;
}

function getCustomFormat(format: LabYoutubeImportCustomFormat) {
  switch (format) {
    case "webm":
      return "webm";
    case "mkv":
      return "mkv";
    case "mp4":
    default:
      return "mp4";
  }
}

function getCustomResolutionFormat(resolution: LabYoutubeImportCustomResolution) {
  switch (resolution) {
    case "1080p":
      return "best[height<=1080][ext=mp4]/best[height<=1080]/best";
    case "720p":
      return "best[height<=720][ext=mp4]/best[height<=720]/best";
    case "480p":
      return "best[height<=480][ext=mp4]/best[height<=480]/best";
    case "best":
    default:
      return "bestvideo*+bestaudio/best";
  }
}

function buildYoutubeStrategyFields(state: LabStoreState, draft: LabSourceDrafts) {
  const youtubeState = state.ui.youtubeImport;
  if (youtubeState.strategy === "audio_only") {
    return {
      youtubePreset: "custom",
      youtubeCaptureMode: "audio-only",
      youtubeCustom: {
        ...getYoutubePresetDefaults(state, "custom"),
        ...asLabRecord(draft.youtubeCustom),
        audioFormat: "mp3",
        audioQuality: "2",
      },
    };
  }
  if (youtubeState.strategy === "low_size") {
    return {
      youtubePreset: "low",
      youtubeCaptureMode: "video+audio",
      youtubeCustom: {
        ...getYoutubePresetDefaults(state, "low"),
        ...asLabRecord(draft.youtubeCustom),
      },
    };
  }
  if (youtubeState.strategy === "custom") {
    const customFormat = getCustomFormat(youtubeState.custom.format);
    return {
      youtubePreset: "custom",
      youtubeCaptureMode: youtubeState.custom.audioExtraction ? "audio-only" : "video+audio",
      youtubeCustom: {
        ...getYoutubePresetDefaults(state, "custom"),
        ...asLabRecord(draft.youtubeCustom),
        format: getCustomResolutionFormat(youtubeState.custom.resolution),
        mergeOutputFormat: customFormat,
        recodeVideo: customFormat,
        audioFormat: youtubeState.custom.audioExtraction ? "mp3" : "none",
      },
    };
  }
  return {
    youtubePreset: "best",
    youtubeCaptureMode: "video+audio",
    youtubeCustom: {
      ...getYoutubePresetDefaults(state, "best"),
      ...asLabRecord(draft.youtubeCustom),
    },
  };
}

export function buildProjectImportHostAction(
  state: LabStoreState
): LabProjectImportHostAction {
  const route = getProjectImportRoute(state);
  const action = getProjectImportActionForMethod(route.method);
  const baseFields: Record<string, unknown> = {
    kind: route.kind,
    mode: route.method,
    fileNameHint: route.draft.fileNameHint,
    urlInput: route.draft.urlInput,
    youtubeUrl: route.draft.youtubeUrl,
    youtubePreset: route.draft.youtubePreset,
    youtubeCustom: route.draft.youtubeCustom,
    youtubeCaptureMode: route.draft.youtubeCaptureMode,
  };

  let disabledReason: string | null = null;
  if (route.method === "url" && route.draft.urlInput.trim() === "") {
    disabledReason = "Direct URL is required.";
  }
  if (route.method === "youtube") {
    const youtubeUrl = state.ui.youtubeImport.url || route.draft.youtubeUrl;
    const ytDlpInstalled = getToolInstalled(state, "yt-dlp") === true;
    Object.assign(baseFields, buildYoutubeStrategyFields(state, route.draft), {
      youtubeUrl,
    });
    if (!ytDlpInstalled) {
      disabledReason = "yt-dlp is required.";
    } else if (String(youtubeUrl || "").trim() === "") {
      disabledReason = "YouTube URL is required.";
    }
  }

  return {
    action,
    disabledReason,
    fields: baseFields,
    kind: route.kind,
    method: route.method,
  };
}

export function getLatestProjectImportEvent(
  state: LabStoreState,
  action: string
): LabEventFeedItem | null {
  const requestId = state.ui.projectImport.lastRequestId;
  if (requestId !== null) {
    return (
      state.activityFeed.find(function (entry) {
        return entry.requestId === requestId && entry.action === action;
      }) || null
    );
  }
  return (
    state.activityFeed.find(function (entry) {
      return entry.action === action;
    }) || null
  );
}

export function hasProjectImportDraftValue(state: LabStoreState) {
  const route = getProjectImportRoute(state);
  const draft = route.draft;
  return (
    draft.fileNameHint.trim() !== "" ||
    draft.urlInput.trim() !== "" ||
    draft.youtubeUrl.trim() !== "" ||
    (route.method === "youtube" && state.ui.youtubeImport.url !== null)
  );
}
