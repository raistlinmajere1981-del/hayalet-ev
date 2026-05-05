import { asLabRecord, asNonEmptyString } from "../../models/lab-types.js";
import type { LabSourceDrafts, LabStoreState } from "../../models/lab-types.js";
import { toStringArray, toStringValue } from "./lab-controller-helpers.js";

export function getActiveProjectCreatedAt(state: LabStoreState): unknown {
  const snapshot = asLabRecord(state.snapshot);
  const activeProject = asLabRecord(snapshot["activeProject"]);
  return activeProject["createdAt"];
}

function getSourcePresets(state: LabStoreState) {
  return asLabRecord(asLabRecord(state.snapshot)["sourcePresets"]);
}

export function getSourceModeOptions(state: LabStoreState, kind: unknown): string[] {
  const sourcePresets = getSourcePresets(state);
  const sourceTypes = asLabRecord(sourcePresets["sourceTypes"]);
  const sourceConfig = asLabRecord(sourceTypes[toStringValue(kind)]);
  const configuredModes = toStringArray(sourceConfig["modes"]);
  return configuredModes.length > 0 ? configuredModes : ["local"];
}

export function getDefaultSourceMode(state: LabStoreState, kind: unknown): string {
  const sourcePresets = getSourcePresets(state);
  const sourceTypes = asLabRecord(sourcePresets["sourceTypes"]);
  const sourceConfig = asLabRecord(sourceTypes[toStringValue(kind)]);
  const configuredDefault = asNonEmptyString(sourceConfig["defaultMode"]);
  if (configuredDefault) {
    return configuredDefault;
  }
  return getSourceModeOptions(state, kind)[0] || "local";
}

function getDefaultSourceKind(state: LabStoreState): string {
  const sourcePresets = getSourcePresets(state);
  const configuredDefault = asNonEmptyString(sourcePresets["defaultSourceType"]);
  if (configuredDefault) {
    return configuredDefault;
  }
  const sourceTypes = asLabRecord(sourcePresets["sourceTypes"]);
  const firstConfiguredKind = Object.keys(sourceTypes).find(function (entry) {
    return entry.trim() !== "";
  });
  return firstConfiguredKind || "video";
}

function getDefaultYoutubePreset(state: LabStoreState): string {
  const sourcePresets = getSourcePresets(state);
  const presets = asLabRecord(sourcePresets["youtubePresets"]);
  if (asLabRecord(presets)["medium"]) {
    return "medium";
  }
  if (asLabRecord(presets)["custom"]) {
    return "custom";
  }
  return Object.keys(presets)[0] || "medium";
}

function getYoutubePresetDefaults(state: LabStoreState, presetId: string | null) {
  const sourcePresets = getSourcePresets(state);
  const presets = asLabRecord(sourcePresets["youtubePresets"]);
  const resolvedPresetId = presetId || getDefaultYoutubePreset(state);
  return asLabRecord(asLabRecord(presets[resolvedPresetId])["defaultCustomValues"]);
}

export function buildEmptySourceState(state: LabStoreState) {
  const kind = getDefaultSourceKind(state);
  const mode = getDefaultSourceMode(state, kind);
  const youtubePreset = getDefaultYoutubePreset(state);
  return {
    kind,
    mode,
    status: "idle",
    storedPath: null,
    storedFileName: null,
    sourceUrl: null,
    mimeType: null,
    routeLabel: null,
    lastError: null,
    metadata: null,
    metadataError: null,
    previewUrl: null,
    drafts: {
      urlInput: "",
      youtubeUrl: "",
      youtubePreset,
      youtubeCustom: {
        ...getYoutubePresetDefaults(state, youtubePreset),
      },
    },
  };
}

export function mergeSourceDrafts(
  state: LabStoreState,
  patch: Partial<LabSourceDrafts>
): LabSourceDrafts {
  const currentDrafts = state.ui.sourceDrafts;
  return {
    ...currentDrafts,
    ...patch,
    youtubeCustom:
      patch.youtubeCustom !== undefined
        ? {
            ...asLabRecord(currentDrafts.youtubeCustom),
            ...asLabRecord(patch.youtubeCustom),
          }
        : asLabRecord(currentDrafts.youtubeCustom),
  };
}

export function buildSourceDraftPatch(
  state: LabStoreState,
  field: string,
  value: unknown
): Partial<LabSourceDrafts> | null {
  const currentDrafts = state.ui.sourceDrafts;
  switch (field) {
    case "source.urlInput":
      if (currentDrafts.urlInput === value) {
        return null;
      }
      return {
        urlInput: typeof value === "string" ? value : "",
      };
    case "source.youtubeUrl":
      if (currentDrafts.youtubeUrl === value) {
        return null;
      }
      return {
        youtubeUrl: typeof value === "string" ? value : "",
      };
    case "source.youtubePreset": {
      const presetId =
        typeof value === "string" && value.trim() !== "" ? value : getDefaultYoutubePreset(state);
      return {
        youtubePreset: presetId,
        youtubeCustom:
          Object.keys(asLabRecord(currentDrafts.youtubeCustom)).length > 0
            ? asLabRecord(currentDrafts.youtubeCustom)
            : { ...getYoutubePresetDefaults(state, presetId) },
      };
    }
    case "source.youtubeCaptureMode": {
      const mode = value === "audio-only" || value === "video-only" ? value : "video+audio";
      return {
        youtubeCaptureMode: mode,
      };
    }
    default:
      if (field.startsWith("source.youtubeCustom.")) {
        const customField = field.replace("source.youtubeCustom.", "");
        const presetId =
          asNonEmptyString(currentDrafts.youtubePreset) || getDefaultYoutubePreset(state);
        return {
          youtubeCustom: {
            ...getYoutubePresetDefaults(state, presetId),
            ...asLabRecord(currentDrafts.youtubeCustom),
            [customField]: value,
          },
        };
      }
      return null;
  }
}

export function buildProjectImportDraftPatch(
  state: LabStoreState,
  field: string,
  value: unknown
): Partial<LabSourceDrafts> | null {
  const currentDrafts = state.ui.projectImport.drafts[state.ui.projectImport.activeKind];
  switch (field) {
    case "project-import.urlInput":
      if (currentDrafts.urlInput === value) {
        return null;
      }
      return {
        urlInput: typeof value === "string" ? value : "",
      };
    case "project-import.youtubeUrl":
      if (currentDrafts.youtubeUrl === value) {
        return null;
      }
      return {
        youtubeUrl: typeof value === "string" ? value : "",
      };
    case "project-import.youtubeCaptureMode": {
      const mode = value === "audio-only" || value === "video-only" ? value : "video+audio";
      return {
        youtubeCaptureMode: mode,
      };
    }
    default:
      if (field.startsWith("project-import.youtubeCustom.")) {
        const customField = field.replace("project-import.youtubeCustom.", "");
        const presetId =
          asNonEmptyString(currentDrafts.youtubePreset) || getDefaultYoutubePreset(state);
        return {
          youtubeCustom: {
            ...getYoutubePresetDefaults(state, presetId),
            ...asLabRecord(currentDrafts.youtubeCustom),
            [customField]: value,
          },
        };
      }
      return null;
  }
}
