import type {
  LabActionSuggestion,
  LabArtifactProjection,
  LabAudioFocusSettings,
  LabBookmark,
  LabInterpretationItem,
  LabPreviewArtifactProjection,
  LabSelection,
  LabSuggestionPreview,
} from "../models/lab-types.js";

export type LabWaveformTimelineModel = {
  activeSelection?: LabSelection | null;
  activeSuggestionPreview?: LabSuggestionPreview | null;
  audioFocus?: LabAudioFocusSettings;
  bookmarks: LabBookmark[];
  dualPreviewActive: boolean;
  durationMs: number;
  endMs: number | null;
  interpretationItems?: LabInterpretationItem[];
  linkedAudioAssetId?: string | null;
  selectionSuggestions?: LabActionSuggestion[];
  sourceKind?: string;
  startMs: number | null;
  visualizationArtifact?: LabArtifactProjection | LabPreviewArtifactProjection | null;
  visualizationMode?: LabAudioFocusSettings["visualizationMode"];
  waveformContentDurationMs?: number;
  waveformCropEndRatio?: number;
  waveformCropStartRatio?: number;
  waveformOffsetMs?: number;
  waveformSourceLabel: string;
  waveformSyncLabel: string;
  waveformWindowDurationMs: number;
  waveformWindowStartMs: number;
};

export type LabWaveformTimelineVisualizerDeps = {
  documentRef: Document;
  getTimelineModel?: () => LabWaveformTimelineModel;
  getVisualizationArtifact?: () => LabArtifactProjection | LabPreviewArtifactProjection | null;
  getVisualizationMode?: () => LabAudioFocusSettings["visualizationMode"];
  windowRef: Window & {
    AudioContext?: typeof AudioContext;
    Image?: typeof Image;
    fetch?: typeof fetch;
    webkitAudioContext?: typeof AudioContext;
  };
};
