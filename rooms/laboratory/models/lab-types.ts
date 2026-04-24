import type { AnalysisReference, AnalysisScope } from "../shared/types/analysis-scope.js";

export type LabRecord = Record<string, unknown>;

export type LabAssetType = "source" | "clip" | "frame" | "audio" | "image" | "report" | "artifact";

export interface LabAsset {
  id: string;
  type: LabAssetType;
  name: string;
  url?: string;
  localPath?: string;
  createdAt: number;
  sourceId?: string;
  derivedFromAssetId?: string;
  derivedFromSourceId?: string;
  runId?: string;
  intentIds?: string[];
  metadata?: LabRecord;
}

export interface LabExpectedOutput {
  intentId: string;
  label: string;
  assetTypes: LabAssetType[];
}

/** @deprecated V2.3 uses WorkspaceMode — kept for hydration and internal pipeline compat */
export type LabStage = "source" | "edit" | "process" | "report";

/** V2.3 workspace mode — replaces stage navigation */
export type WorkspaceMode = "loading" | "workspace" | "analyzing" | "complete";

/** V2.4 report freshness — condition-driven, never gates UI */
export type ReportFreshnessState = "current" | "stale" | "previous-run";
export interface ReportFreshness {
  state: ReportFreshnessState;
  workspaceDirty: boolean;
}

/** V2.5 preflight severity — shared contract between UI + controller */
export type PreflightSeverity = "clear" | "warning" | "will-fail";

/** V2.3 user-facing intent identifiers — NO tool names exposed */
export type LabIntentId =
  | "visual-inspection"
  | "audio-investigation"
  | "detail-enhancement"
  | "anomaly-detection";

export interface LabIntent {
  id: LabIntentId;
  label: string;
  description: string;
  sourceKinds: Array<"video" | "audio" | "image">;
  internalCapabilities: CapabilityFamilyId[];
}

export const WORKSPACE_INTENTS: LabIntent[] = [
  {
    id: "visual-inspection",
    label: "Visual inspection",
    description: "Examine visual structure, frame composition, and forensic markers.",
    sourceKinds: ["video", "image"],
    internalCapabilities: ["visual-structure", "visual-forensics"],
  },
  {
    id: "audio-investigation",
    label: "Audio investigation",
    description: "Analyze audio signals, recover details, and identify speakers.",
    sourceKinds: ["video", "audio"],
    internalCapabilities: ["audio-signal", "audio-recovery", "speaker-analysis"],
  },
  {
    id: "detail-enhancement",
    label: "Detail enhancement",
    description: "Generate transcripts and separate audio sources for deeper review.",
    sourceKinds: ["video", "audio"],
    internalCapabilities: ["transcription", "source-separation"],
  },
  {
    id: "anomaly-detection",
    label: "Anomaly detection",
    description: "Detect visual and audio anomalies, classify sounds, and analyze prosody.",
    sourceKinds: ["video", "audio", "image"],
    internalCapabilities: [
      "visual-forensics",
      "sound-classification",
      "prosody-emotion",
      "music-analysis",
    ],
  },
];

export function getIntentLabel(intentId: string): string {
  return (
    WORKSPACE_INTENTS.find(function (intent) {
      return intent.id === intentId;
    })?.label || intentId
  );
}

export function getIntentPreviewDescription(intentId: string): string {
  switch (intentId) {
    case "visual-inspection":
      return "Görsel yapı ve anomaliler analiz edilir";
    case "audio-investigation":
      return "Ses sinyali ve anomaliler analiz edilir";
    case "detail-enhancement":
      return "Görüntü detayları iyileştirilir";
    case "anomaly-detection":
      return "Olası anormallikler tespit edilir";
    default:
      return getIntentLabel(intentId);
  }
}

export function getCapabilityFamilyIdsForIntentId(intentId: LabIntentId): CapabilityFamilyId[] {
  const intent = WORKSPACE_INTENTS.find(function (entry) {
    return entry.id === intentId;
  });
  return Array.isArray(intent?.internalCapabilities) ? intent.internalCapabilities.slice() : [];
}

export interface LabBookmark {
  id: string;
  timeMs: number;
  frameIndex: number | null;
  note: string;
  createdAt: number;
}

export interface LabROIRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  active: boolean;
}

export type LabSelectionType = "clip" | "focus" | "inspect" | "unknown";
export type LabSelectionIntent = "anomaly" | "motion" | "audio" | "visual" | "general" | "unknown";

export interface LabSelection {
  id: string;
  startMs: number;
  endMs: number;
  type: LabSelectionType;
  intent: LabSelectionIntent;
  label?: string;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdAt: number;
}

export interface LabActionSuggestion {
  id: string;
  label: string;
  description?: string;
  actionType:
    | "analyze-segment"
    | "extract-clip"
    | "focus-region"
    | "inspect-audio"
    | "enhance-visual";
  confidence: number;
}

export interface LabSuggestionPreview {
  suggestionId: string;
  title: string;
  steps: string[];
  expectedOutputs: string[];
  estimatedCost?: "low" | "medium" | "high";
}

export interface LabInteractiveSettings {
  brightness: number;
  contrast: number;
  gamma: number;
  saturation: number;
  hueRotate: number;
  sharpness: number;
  channelR: boolean;
  channelG: boolean;
  channelB: boolean;
  edgeHighlight: boolean;
  invert: boolean;
}

export type AudioVisualizationMode = "none" | "waveform" | "spectrum";

export interface LabParametricEQBand {
  frequency: number;
  gain: number;
  Q: number;
  type: "peaking" | "lowshelf" | "highshelf";
}

export interface LabAudioFocusSettings {
  gain: number;
  filterType: "none" | "lowpass" | "highpass" | "bandpass";
  filterFrequency: number;
  filterQ: number;
  visualizationMode: AudioVisualizationMode;
  eqBands: LabParametricEQBand[];
}

export type LabProcessSectionId = "pipeline" | "findings" | "artifacts";

export interface LabWorkspaceUiState {
  timelineStartMs: number | null;
  timelineEndMs: number | null;
  activeSelection: LabSelection | null;
  roiRegions: LabROIRegion[];
  interactiveSettings: LabInteractiveSettings;
  audioFocus: LabAudioFocusSettings;
  dualPreviewEnabled: boolean;
  dualPreviewAudioAssetId: string | null;
  dualPreviewVolume: number;
  hypothesis: string;
  bookmarks: LabBookmark[];
  selectedIntents: LabIntentId[];
  sourceIntakeCollapsed: boolean;
  rightPanelCollapsed: boolean;
  processViewActive: boolean;
  activeStepPreviewId: string | null;
  processPanelCollapsedSections: LabProcessSectionId[];
  reportOverlayOpen: boolean;
}

/** Capability families — user-facing groups that resolve to internal modules. */
export type CapabilityFamilyId =
  | "visual-structure"
  | "visual-forensics"
  | "audio-signal"
  | "audio-recovery"
  | "transcription"
  | "speaker-analysis"
  | "prosody-emotion"
  | "sound-classification"
  | "source-separation"
  | "music-analysis";

export type CapabilityReadiness = "ready" | "optional" | "blocked";

export interface CapabilityFamilyMeta {
  id: CapabilityFamilyId;
  label: string;
  sourceKinds: Array<"video" | "audio" | "image">;
  primaryTool: string;
  requiredTools: string[];
}

export const CAPABILITY_FAMILIES: CapabilityFamilyMeta[] = [
  {
    id: "visual-structure",
    label: "Visual Structure",
    sourceKinds: ["video"],
    primaryTool: "ffmpeg",
    requiredTools: ["ffmpeg"],
  },
  {
    id: "visual-forensics",
    label: "Visual Forensics",
    sourceKinds: ["video"],
    primaryTool: "ffmpeg",
    requiredTools: ["ffmpeg"],
  },
  {
    id: "audio-signal",
    label: "Audio Signal",
    sourceKinds: ["video", "audio"],
    primaryTool: "ffmpeg",
    requiredTools: ["ffmpeg"],
  },
  {
    id: "audio-recovery",
    label: "Audio Recovery",
    sourceKinds: ["video", "audio"],
    primaryTool: "ffmpeg",
    requiredTools: ["ffmpeg"],
  },
  {
    id: "transcription",
    label: "Transcription",
    sourceKinds: ["video", "audio"],
    primaryTool: "whisper.cpp",
    requiredTools: ["whisper.cpp"],
  },
  {
    id: "speaker-analysis",
    label: "Speaker Analysis",
    sourceKinds: ["video", "audio"],
    primaryTool: "pyaudioanalysis",
    requiredTools: ["pyaudioanalysis", "ffmpeg"],
  },
  {
    id: "prosody-emotion",
    label: "Prosody & Emotion",
    sourceKinds: ["video", "audio"],
    primaryTool: "opensmile",
    requiredTools: ["opensmile"],
  },
  {
    id: "sound-classification",
    label: "Sound Classification",
    sourceKinds: ["video", "audio"],
    primaryTool: "yamnet",
    requiredTools: ["yamnet", "ffmpeg"],
  },
  {
    id: "source-separation",
    label: "Source Separation",
    sourceKinds: ["video", "audio"],
    primaryTool: "demucs",
    requiredTools: ["demucs", "ffmpeg"],
  },
  {
    id: "music-analysis",
    label: "Music Analysis",
    sourceKinds: ["video", "audio"],
    primaryTool: "librosa",
    requiredTools: ["librosa", "ffmpeg"],
  },
];

const CAPABILITY_MODULE_GROUPS: Array<{
  capabilityId: CapabilityFamilyId;
  moduleIds: string[];
}> = [
  {
    capabilityId: "visual-structure",
    moduleIds: [
      "frame-consistency",
      "lighting-consistency",
      "background-consistency",
      "occlusion-inconsistency",
      "object-insert-remove-anomaly",
      "temporal-noise-pattern",
      "motion-anomaly",
    ],
  },
  {
    capabilityId: "visual-forensics",
    moduleIds: [
      "visual-signal-amplification",
      "color-channel-isolation",
      "gamma-scan",
      "contrast-scan",
      "edge-enhancement",
      "histogram-equalization",
      "hidden-detail-reveal",
      "ai-artifact-detection",
    ],
  },
  {
    capabilityId: "audio-signal",
    moduleIds: ["signal-health", "spectral-artifacts"],
  },
  {
    capabilityId: "audio-recovery",
    moduleIds: [
      "signal-recovery",
      "band-pass-exploration",
      "spectrogram-guided-recovery",
      "hidden-pattern-extraction",
      "frequency-shift-reversal",
      "phase-recovery-experiment",
    ],
  },
  {
    capabilityId: "transcription",
    moduleIds: ["transcription", "transcript-support"],
  },
  {
    capabilityId: "speaker-analysis",
    moduleIds: ["speaker-diarization"],
  },
  {
    capabilityId: "prosody-emotion",
    moduleIds: ["prosody", "emotion"],
  },
  {
    capabilityId: "sound-classification",
    moduleIds: ["sound-events"],
  },
  {
    capabilityId: "source-separation",
    moduleIds: ["source-separation"],
  },
  {
    capabilityId: "music-analysis",
    moduleIds: ["music-rhythm-tonal"],
  },
];

export function getModuleIdsForCapabilityFamily(capabilityId: CapabilityFamilyId): string[] {
  return (
    CAPABILITY_MODULE_GROUPS.find(function (entry) {
      return entry.capabilityId === capabilityId;
    })?.moduleIds.slice() || []
  );
}

export function getIntentIdsForCapabilityFamily(capabilityId: CapabilityFamilyId): LabIntentId[] {
  return WORKSPACE_INTENTS.filter(function (intent) {
    return intent.internalCapabilities.includes(capabilityId);
  }).map(function (intent) {
    return intent.id;
  });
}

export function getCapabilityFamilyForModuleId(
  moduleId: string | null | undefined
): CapabilityFamilyId | null {
  if (typeof moduleId !== "string" || moduleId.trim() === "") {
    return null;
  }
  const normalizedModuleId = moduleId.trim();
  if (
    CAPABILITY_FAMILIES.some(function (family) {
      return family.id === normalizedModuleId;
    })
  ) {
    return normalizedModuleId as CapabilityFamilyId;
  }
  return (
    CAPABILITY_MODULE_GROUPS.find(function (entry) {
      return entry.moduleIds.includes(normalizedModuleId);
    })?.capabilityId || null
  );
}

export function getIntentIdsForModuleId(moduleId: string | null | undefined): LabIntentId[] {
  const capabilityId = getCapabilityFamilyForModuleId(moduleId);
  if (capabilityId === null) {
    return [];
  }
  return getIntentIdsForCapabilityFamily(capabilityId);
}
export type LabFeatureId = "media-analysis" | "audio-analysis" | "subtitle-analysis";
export type LabEventSeverity = "info" | "success" | "warning" | "error";
export type LabEventScope = "global" | "run";
export type LabModuleStatus =
  | "idle"
  | "queued"
  | "running"
  | "ready"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped"
  | "stale";
export type LabSourceProbeStatus = "idle" | "running" | "completed" | "failed";
export type LabPreflightStatus = "idle" | "ready" | "warning" | "blocked";

export const LAB_STAGES: LabStage[] = ["source", "edit", "process", "report"];
export const LAB_FEATURES: Array<{
  id: LabFeatureId;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "media-analysis",
    label: "Medya Analizi",
    shortLabel: "Medya",
    description: "Kaynak hazırlama, önizleme, profil ve final iş akışı.",
  },
  {
    id: "audio-analysis",
    label: "Ses Analizi",
    shortLabel: "Ses",
    description: "Ses odaklı analiz modülleri ve çıktı takibi.",
  },
  {
    // NOTE: subtitle-analysis remains legacy-internal only and is no longer user-facing in v2.2.
    id: "subtitle-analysis",
    label: "Transcript Support",
    shortLabel: "Transcript",
    description: "Timestamped transcript artifact support kept for backward compatibility.",
  },
];

export interface LabFeatureMeta {
  id: LabFeatureId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface LabEventFeedItem {
  id: string;
  kind: string;
  severity: LabEventSeverity;
  message: string;
  detail: string | null;
  percent?: number | null;
  timestamp: number;
  source: "host" | "ui" | "system";
  action: string | null;
  stage: string | null;
  scope: LabEventScope;
  moduleId: string | null;
  rawLine: string | null;
  analysisScope?: AnalysisScope | null;
  finding?: LabRecord | null;
  artifact?: LabRecord | null;
  moduleTrace?: LabRecord | null;
  comparisonVariant?: LabRecord | null;
  comparisonVariants?: LabRecord[] | null;
  batchedCount?: number | null;
  throttleWindow?: string | null;
  requestId?: string | null;
  jobId?: string | null;
  projectId?: string | null;
  resultAssetIds?: string[];
}

export type LabUserActionStatus = "idle" | "running" | "success" | "error";

export type LabUserActionType = "export-clip" | "extract-audio" | "grab-frame" | "custom";

export interface LabUserActionEvent {
  id: string;
  type: LabUserActionType;
  label: string;
  status: LabUserActionStatus;
  startedAt: number;
  finishedAt?: number;
  message?: string;
  requestId?: string | null;
  jobId?: string | null;
  projectId?: string | null;
  resultAssetIds?: string[];
  sourceAction?: string | null;
  dismissedFromHubAt?: number | null;
}

export type YoutubeCaptureMode = "video+audio" | "audio-only" | "video-only";

export interface LabSourceDrafts {
  fileNameHint: string;
  urlInput: string;
  youtubeUrl: string;
  youtubePreset: string | null;
  youtubeCustom: LabRecord;
  youtubeCaptureMode: YoutubeCaptureMode;
}

export interface LabEditDrafts {
  outputNameHint: string;
  notes: string;
  activeSourceRef: "original" | "preview";
  advancedOpen: boolean;
}

export interface LabProfileDrafts {
  sensitivity: number | null;
  transcriptSampleSeconds: number | null;
  depth: string;
  frameSampleDensity: string;
}

export interface LabEditConfig extends LabRecord {
  activeOutputId?: unknown;
  handoffMode?: unknown;
  mode?: unknown;
  outputs?: unknown;
  preview?: unknown;
  recipe?: unknown;
}

export interface LabProfileConfig extends LabRecord {
  artifacts?: unknown;
  mode?: unknown;
  modelId?: unknown;
  preflight?: unknown;
  readiness?: unknown;
  targetAssetMode?: unknown;
}

export interface LabModuleState {
  id: string;
  status: LabModuleStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  progress?: number | null;
  progressMode?: "measured" | "none";
  message?: string | null;
  title?: string | null;
  summary?: string | null;
  findingIds?: string[];
  artifactIds?: string[];
  metadata?: LabRecord;
}

export interface LabFindingProjection {
  id: string;
  moduleId: string | null;
  code?: string | null;
  title: string;
  detail: string;
  level: string;
  severity?: LabEventSeverity;
  confidence: string;
  kind: "measured" | "derived" | "heuristic";
  evidenceCount: number;
  artifactIds: string[];
  sourceModule?: string | null;
  reference?: AnalysisReference | null;
  hypothesis?: string | null;
}

export interface LabArtifactProjection {
  id: string;
  moduleId?: string | null;
  kind: string;
  label?: string | null;
  path: string | null;
  fileName: string | null;
  previewUrl: string | null;
  createdAt: string | null;
  status?: string;
  variantId?: string | null;
  active?: boolean;
  reference?: AnalysisReference | null;
  metadata?: LabRecord;
}

export interface LabLiveFindingProjection extends LabFindingProjection {
  emittedAt: number;
  windowKey: string | null;
  streamId: string | null;
}

export interface LabPreviewArtifactProjection extends LabArtifactProjection {
  status: string;
  variantId: string | null;
  active: boolean;
  reference: AnalysisReference | null;
  metadata: LabRecord;
}

export interface LabModuleTraceEntry {
  id: string;
  moduleId: string | null;
  stage: string;
  status: string;
  timestamp: string;
  message: string | null;
  detail: string | null;
  eventId: string | null;
}

export interface LabComparisonVariant {
  id: string;
  kind: string;
  label: string;
  status: string;
  summary: string | null;
  artifactIds: string[];
  artifactId?: string | null;
  artifactPath?: string | null;
  sourceModule?: string | null;
  active?: boolean;
}

export interface LabRun {
  id: string;
  state: LabModuleStatus;
  startedAt: number;
  endedAt?: number;
  modules: Record<string, LabModuleState>;
  moduleOrder: string[];
  events: LabEventFeedItem[];
  rawLog: LabEventFeedItem[];
  artifacts: LabArtifactProjection[];
  findings: LabFindingProjection[];
  liveFindings: LabLiveFindingProjection[];
  warnings: string[];
  error: string | null;
  targetLabel: string | null;
  progress: number | null;
  emptyReason: string | null;
  analysisScope: AnalysisScope | null;
  previewArtifacts: LabPreviewArtifactProjection[];
  confidence: string | null;
  moduleTrace: LabModuleTraceEntry[];
  comparisonVariants: LabComparisonVariant[];
  hypothesisSummary: string | null;
}

export interface LabRunSnapshotSummary {
  focus: string | null;
  timelineStartMs: number | null;
  timelineEndMs: number | null;
  hypothesis: string | null;
  intentIds: LabIntentId[];
}

export interface LabWorkspaceDiff {
  timelineChanged: boolean;
  hypothesisChanged: boolean;
  intentsChanged: boolean;
  workspaceDirty: boolean;
  changedKeys: Array<"timeline" | "hypothesis" | "intents">;
}

export interface LabIntentDirtyState {
  intentId: LabIntentId;
  inSnapshot: boolean;
  inWorkspace: boolean;
  dirty: boolean;
  changedKeys: Array<"timeline" | "hypothesis" | "selection">;
}

export type LabIntentDirtyMap = Record<LabIntentId, LabIntentDirtyState>;

export interface LabUserReportFinding {
  id: string;
  title: string;
  detail: string;
  confidence: string;
  evidence: string[];
}

export interface LabUserReportSuspiciousFrame {
  artifactId: string;
  previewUrl: string;
  label: string;
}

export interface LabUserReportModuleSummary {
  id: string;
  title: string;
  status: string;
}

export interface LabUserReport {
  summary: string;
  confidence: string;
  topFindings: LabUserReportFinding[];
  suspiciousFrames: LabUserReportSuspiciousFrame[];
  hypothesisResult: string | null;
  elapsedSeconds: number;
  moduleSummary: LabUserReportModuleSummary[];
}

export interface LabAiReport {
  manifest: LabRecord;
  findings: LabFindingProjection[];
  artifacts: LabArtifactProjection[];
  warnings: string[];
  errors: string[];
  degradedConditions: string[];
  moduleTrace: LabModuleTraceEntry[];
  analysisScope: AnalysisScope | null;
  comparisonVariants: LabComparisonVariant[];
}

export interface LabReportSet {
  user: LabUserReport | null;
  ai: LabAiReport | null;
  emptyReason: string | null;
}

export interface LabPreflightResult {
  status: LabPreflightStatus;
  missingDependencies: string[];
  warnings: string[];
  estimatedRuntime: number | null;
  enabledModules: string[];
  stageReady: boolean;
  rawStatus: string | null;
  reason: string | null;
}

export interface LabStoreUiState {
  sourceDrafts: LabSourceDrafts;
  editDrafts: LabEditDrafts;
  profileDrafts: LabProfileDrafts;
  sourceDraftDirty: boolean;
  editDraftDirty: boolean;
  profileDraftDirty: boolean;
  /** @deprecated Module manager removed in v2.2 — kept for hydration compat */
  moduleManagerOpen: boolean;
  toolManagerOpen: boolean;
  eventFeedExpanded: boolean;
  eventFeedCursor: number;
  artifactListExpanded: boolean;
  artifactRenderCount: number;
  reportView: "user" | "ai";
  lastHydratedProjectId: string | null;
  activeSuggestionPreviewId: string | null;
  activePreviewArtifactId: string | null;
  liveFindingsExpanded: boolean;
  analysisControlsCollapsed: boolean;
  /** Workspace side panel collapsed state (Edit stage) */
  editSidePanelCollapsed: boolean;
  /** Raw log section collapsed in Process stage */
  rawLogCollapsed: boolean;
  /** V2.3 workspace state */
  workspace: LabWorkspaceUiState;
}

export interface LabPersistedState {
  schemaVersion?: number;
  currentStage: LabStage;
  featureId: LabFeatureId;
  selectedCapabilities: CapabilityFamilyId[];
  projectIndex: {
    activeProjectId: string | null;
    projects: LabRecord[];
  };
  workbench: LabRecord;
  source: LabRecord | null;
  sourceProbeStatus: LabSourceProbeStatus;
  editConfig: LabEditConfig | null;
  profileConfig: LabProfileConfig | null;
  preflight: LabPreflightResult | null;
  lastRun: LabRun | null;
  reports: LabReportSet;
  reportExports: LabRecord[];
  assets: LabAsset[];
  profileModels: LabRecord[];
  toolState: LabRecord;
  activityFeed: LabEventFeedItem[];
  sourceDrafts: LabSourceDrafts;
  editDrafts: LabEditDrafts;
  profileDrafts: LabProfileDrafts;
  reportView: "user" | "ai";
  eventFeedExpanded: boolean;
  eventFeedCursor: number;
  artifactListExpanded: boolean;
  artifactRenderCount: number;
  activePreviewArtifactId: string | null;
  liveFindingsExpanded: boolean;
  analysisControlsCollapsed: boolean;
  editSidePanelCollapsed?: boolean;
  rawLogCollapsed?: boolean;
  /** V2.3 workspace state persistence */
  workspace?: Partial<LabWorkspaceUiState>;
}

export interface LabStoreState {
  currentStage: LabStage;
  featureId: LabFeatureId;
  /** Selected capability families — replaces module selection in v2.2 */
  selectedCapabilities: CapabilityFamilyId[];
  bootReady: boolean;
  roomReadySent: boolean;
  context: LabRecord;
  snapshot: LabRecord | null;
  projectIndex: {
    activeProjectId: string | null;
    projects: LabRecord[];
  };
  workbench: LabRecord;
  source: LabRecord | null;
  sourceProbeStatus: LabSourceProbeStatus;
  editConfig: LabEditConfig | null;
  profileConfig: LabProfileConfig | null;
  preflight: LabPreflightResult | null;
  run: LabRun | null;
  reports: LabReportSet;
  reportExports: LabRecord[];
  assets: LabAsset[];
  profileModels: LabRecord[];
  toolState: LabRecord;
  activityFeed: LabEventFeedItem[];
  userActions: LabUserActionEvent[];
  ui: LabStoreUiState;
  persisted: LabPersistedState | null;
}

export interface LabStageSurface {
  main: string;
  side: string;
}

export type LabStoreEvent =
  | { type: "hydrate"; payload: Partial<LabPersistedState> | null }
  | { type: "bootstrap-ready-sent" }
  | { type: "context-received"; payload: LabRecord }
  | { type: "snapshot-received"; payload: LabRecord }
  | { type: "source-snapshot-received"; payload: LabRecord }
  | { type: "host-event-received"; event: LabEventFeedItem }
  | { type: "job-received"; payload: LabRecord; event: LabEventFeedItem | null }
  | { type: "request-result-received"; payload: LabRecord; event: LabEventFeedItem | null }
  | { type: "source-probe-started"; action: string; detail?: string | null }
  | {
      type: "source-probe-progress";
      action: string;
      detail?: string | null;
      progress?: number | null;
    }
  | { type: "source-probe-completed"; action: string; detail?: string | null }
  | { type: "source-probe-failed"; action: string; detail?: string | null }
  | { type: "preview-started"; action: string; detail?: string | null }
  | { type: "preview-progress"; action: string; detail?: string | null; progress?: number | null }
  | { type: "preview-completed"; action: string; detail?: string | null }
  | { type: "preview-failed"; action: string; detail?: string | null }
  | { type: "preflight-started"; action: string; detail?: string | null }
  | { type: "preflight-completed"; action: string; detail?: string | null }
  | { type: "preflight-failed"; action: string; detail?: string | null }
  | { type: "run-started"; action: string; detail?: string | null }
  | { type: "run-cancelled"; action: string; detail?: string | null }
  | { type: "run-failed"; action: string; detail?: string | null }
  | { type: "module-started"; action: string; moduleId: string; detail?: string | null }
  | {
      type: "module-progress";
      action: string;
      moduleId: string;
      detail?: string | null;
      progress?: number | null;
    }
  | { type: "module-finished"; action: string; moduleId: string; detail?: string | null }
  | { type: "module-failed"; action: string; moduleId: string; detail?: string | null }
  | { type: "module-skipped"; action: string; moduleId: string; detail?: string | null }
  | { type: "stage-changed"; stage: LabStage }
  | { type: "feature-changed"; featureId: LabFeatureId }
  | { type: "workbench-updated"; workbench: LabRecord }
  | { type: "source-config-patched"; patch: LabRecord }
  | { type: "source-drafts-updated"; patch: Partial<LabSourceDrafts> }
  | { type: "source-drafts-committed" }
  | { type: "edit-drafts-updated"; patch: Partial<LabEditDrafts> }
  | { type: "edit-drafts-committed" }
  | { type: "profile-drafts-updated"; patch: Partial<LabProfileDrafts> }
  | { type: "profile-drafts-committed" }
  | { type: "module-manager-toggled"; open?: boolean }
  | { type: "tool-manager-toggled"; open?: boolean }
  | { type: "toggle-event-feed"; force?: boolean }
  | { type: "advance-event-feed" }
  | { type: "reset-event-feed" }
  | { type: "toggle-artifacts"; force?: boolean }
  | { type: "show-more-artifacts" }
  | { type: "report-view-changed"; view: "user" | "ai" }
  | { type: "preview-artifact-activated"; artifactId: string | null }
  | { type: "live-findings-expanded"; force?: boolean }
  | { type: "analysis-controls-collapsed"; force?: boolean }
  | { type: "capability-select"; capabilityId: CapabilityFamilyId }
  | { type: "capability-deselect"; capabilityId: CapabilityFamilyId }
  | { type: "capability-set"; capabilities: CapabilityFamilyId[] }
  | { type: "edit-side-panel-toggled"; force?: boolean }
  | { type: "raw-log-toggled"; force?: boolean }
  | { type: "push-event"; event: LabEventFeedItem }
  | { type: "asset-added"; asset: LabAsset }
  | { type: "asset-removed"; id: string }
  | { type: "asset-updated"; id: string; patch: Partial<LabAsset> }
  | { type: "user-action-added"; actionEvent: LabUserActionEvent }
  | { type: "user-action-updated"; id: string; patch: Partial<LabUserActionEvent> }
  | { type: "user-action-hub-dismissed"; id: string }
  | { type: "clear-events" }
  // V2.3 workspace events
  | { type: "workspace-timeline-updated"; startMs: number | null; endMs: number | null }
  | { type: "workspace-selection-intent-updated"; intent: LabSelectionIntent }
  | { type: "workspace-selection-suggestion-clicked"; suggestionId: string }
  | { type: "workspace-selection-suggestion-preview-set"; suggestionId: string }
  | { type: "workspace-selection-suggestion-preview-cleared" }
  | { type: "workspace-roi-added"; region: LabROIRegion }
  | { type: "workspace-roi-updated"; region: LabROIRegion }
  | { type: "workspace-roi-removed"; regionId: string }
  | { type: "workspace-roi-toggled"; regionId: string }
  | { type: "workspace-dual-preview-toggled"; force?: boolean; audioAssetId?: string | null }
  | { type: "workspace-dual-preview-audio-selected"; audioAssetId: string | null }
  | { type: "workspace-dual-preview-volume-updated"; volume: number }
  | { type: "workspace-interactive-updated"; patch: Partial<LabInteractiveSettings> }
  | { type: "workspace-hypothesis-updated"; text: string }
  | { type: "workspace-bookmark-added"; bookmark: LabBookmark }
  | { type: "workspace-image-analysis-requested" }
  | { type: "workspace-bookmark-removed"; bookmarkId: string }
  | { type: "workspace-intent-toggled"; intentId: LabIntentId }
  | { type: "workspace-intent-set"; intents: LabIntentId[] }
  | { type: "workspace-source-intake-toggled"; force?: boolean }
  | { type: "workspace-audio-updated"; patch: Partial<LabAudioFocusSettings> }
  | { type: "workspace-right-panel-toggled"; force?: boolean }
  | { type: "workspace-process-view-toggled"; force?: boolean }
  | { type: "workspace-step-preview-activated"; stepId: string | null }
  | { type: "workspace-process-section-toggled"; sectionId: LabProcessSectionId }
  | { type: "report-overlay-toggled"; open: boolean };

export function createLabFeatureMeta(featureId: LabFeatureId): LabFeatureMeta {
  return (
    LAB_FEATURES.find(function (entry) {
      return entry.id === featureId;
    }) || LAB_FEATURES[0]!
  );
}

export function asLabRecord(value: unknown): LabRecord {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value as LabRecord;
  }
  return {};
}

export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

export function asNonEmptyString(value: unknown): string | null {
  const text = asString(value).trim();
  return text !== "" ? text : null;
}

export function asNumber(value: unknown): number | null {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function (entry) {
      return asNonEmptyString(entry);
    })
    .filter((entry): entry is string => entry !== null);
}

export function escapeHtml(value: unknown): string {
  return asString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDateTime(value: unknown): string {
  const text = asNonEmptyString(value);
  if (text === null) {
    return "--";
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toLocaleString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatDurationSeconds(value: unknown): string {
  const seconds = asNumber(value);
  if (seconds === null) {
    return "--";
  }
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  if (minutes <= 0) {
    return `${String(remainder)} sn`;
  }
  return `${String(minutes)} dk ${String(remainder).padStart(2, "0")} sn`;
}

export function formatBytes(value: unknown): string {
  const bytes = asNumber(value);
  if (bytes === null) {
    return "--";
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function clampPercent(value: unknown): number | null {
  const percent = asNumber(value);
  if (percent === null) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function toTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = asNonEmptyString(value);
  if (text === null) {
    return Date.now();
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
}

export function createLabEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isLabFeatureId(value: unknown): value is LabFeatureId {
  return value === "media-analysis" || value === "audio-analysis" || value === "subtitle-analysis";
}

export function normalizeLabFeatureId(value: unknown, fallback: LabFeatureId = "media-analysis") {
  return isLabFeatureId(value) ? value : fallback;
}

export function normalizeLabStage(value: unknown, fallback: LabStage = "source"): LabStage {
  return LAB_STAGES.includes(value as LabStage) ? (value as LabStage) : fallback;
}

export function formatStatusLabel(value: unknown): string {
  const status = asNonEmptyString(value) || "idle";
  switch (status) {
    case "idle":
      return "Hazır";
    case "queued":
      return "Sırada";
    case "running":
      return "Çalışıyor";
    case "ready":
      return "Hazır";
    case "completed":
      return "Tamamlandı";
    case "failed":
      return "Hata";
    case "cancelled":
      return "İptal";
    case "skipped":
      return "Atlandı";
    case "stale":
      return "Yenile";
    default:
      return status;
  }
}

export function normalizeFindingKind(value: unknown): "measured" | "derived" | "heuristic" {
  if (value === "measured" || value === "heuristic") {
    return value;
  }
  return "derived";
}
