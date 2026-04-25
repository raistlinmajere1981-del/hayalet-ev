import type {
  LabActionSuggestion,
  LabArtifactProjection,
  LabAudioFocusSettings,
  LabBookmark,
  LabInspectionSnapshot,
  LabInspectionMode,
  LabInterpretationItem,
  LabPreviewArtifactProjection,
  LabSelection,
  LabSuggestionPreview,
} from "../models/lab-types.js";

export type LabWaveformInspectionLensModel = {
  cropEndRatio: number;
  cropStartRatio: number;
  durationMs: number;
  enabled: boolean;
  sourceLabel: string;
  windowDurationMs: number;
  windowStartMs: number;
};

export type LabWaveformTimelineModel = {
  activeExecutionIntent?: LabActionSuggestion | null;
  activeSelection?: LabSelection | null;
  activeInspectionSnapshot?: LabInspectionSnapshot | null;
  activeSuggestionPreview?: LabSuggestionPreview | null;
  audioFocus?: LabAudioFocusSettings;
  bookmarks: LabBookmark[];
  dualPreviewActive: boolean;
  durationMs: number;
  endMs: number | null;
  inspectionMode?: LabInspectionMode;
  interpretationItems?: LabInterpretationItem[];
  linkedAudioAssetId?: string | null;
  roiFocusActive?: boolean;
  selectionSuggestions?: LabActionSuggestion[];
  sourceKind?: string;
  startMs: number | null;
  visualizationArtifact?: LabArtifactProjection | LabPreviewArtifactProjection | null;
  visualizationMode?: LabAudioFocusSettings["visualizationMode"];
  waveformInspectionLens?: LabWaveformInspectionLensModel;
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
