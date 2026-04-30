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

/** V2.3 workspace mode — replaces stage navigation */
export type WorkspaceMode = "loading" | "workspace" | "analyzing" | "complete";
export type LabFeatureStage = "source" | "edit" | "process" | "report";
export type LabMediaViewportState = "empty" | "loading" | "active" | "error";
export type LabSourceRetryBlockReason =
  | "active-run"
  | "not-failed"
  | "missing-url"
  | "missing-youtube-url"
  | "missing-yt-dlp"
  | "local-reselect-required";

/** V2.4 report freshness — condition-driven, never gates UI */
export type ReportFreshnessState = "current" | "stale" | "previous-run";
export interface ReportFreshness {
  state: ReportFreshnessState;
  workspaceDirty: boolean;
}

/** V2.5 preflight severity — shared contract between UI + controller */
export type PreflightSeverity = "clear" | "warning" | "will-fail";

/** V3 drawer mode — derived from system state, never manually toggled */
export type LabDrawerMode = "setup" | "running" | "result" | "explore";
export type LabDrawerModeOverride = "setup" | "result";

export interface LabWorkspaceLockState {
  source: boolean;
  timeline: boolean;
  roi: boolean;
  intents: boolean;
  hypothesis: boolean;
  focusControls: boolean;
}

export interface LabTimelineHighlight {
  assetId: string;
  startMs: number;
  endMs: number;
  label?: string;
}

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
  projectId?: string | null;
  sourceKey?: string | null;
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
export type LabInspectionMode = "none" | "visual" | "audio" | "motion";

export interface LabSelectionROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabSelection {
  id: string;
  startMs: number;
  endMs: number;
  type: LabSelectionType;
  intent: LabSelectionIntent;
  label?: string;
  roi?: LabSelectionROI;
  createdAt: number;
}

export interface LabActionSuggestion {
  id: string;
  label: string;
  description?: string;
  toolHint?: string;
  actionType:
    | "analyze-segment"
    | "extract-clip"
    | "focus-region"
    | "inspect-motion"
    | "inspect-audio"
    | "enhance-visual"
    | "stabilize-segment";
  confidence: number;
}

export interface LabSuggestionPreview {
  suggestionId: string;
  title: string;
  steps: string[];
  expectedOutputs: string[];
  estimatedCost?: "low" | "medium" | "high";
}

export type LabExecutionPlan = {
  id: string;
  suggestionId: string;
  actionType: LabActionSuggestion["actionType"];
  title: string;
  steps: Array<{
    id: string;
    label: string;
    description?: string;
    tool?: string;
  }>;
  expectedOutputs: string[];
  riskNotes?: string[];
  confidence?: number;
};

export interface LabExecutionSimulation {
  id: string;
  planId: string;
  summary: string;
  predictedEffects: string[];
  warnings?: string[];
  metrics?: {
    intensity?: "low" | "medium" | "high";
    risk?: "low" | "medium" | "high";
    confidence?: number;
  };
}

export interface LabExecutionReadiness {
  id: string;
  planId: string;
  status: "ready" | "needs-review" | "blocked";
  summary: string;
  blockers?: string[];
  notes?: string[];
  confidence?: number;
}

export interface LabExecutionPayloadPreview {
  id: string;
  planId: string;
  actionType: LabActionSuggestion["actionType"] | string;
  summary: string;
  dryRunShape: {
    previewInput: Record<string, unknown>;
    previewParameters: Record<string, unknown>;
    previewExpectedOutputs: string[];
  };
  notes?: string[];
  readinessStatus: LabExecutionReadiness["status"];
  readinessPassesPreview: boolean;
}

export interface LabExecutionReflection {
  id: string;
  planId: string;
  summary: string;
  decision: "proceed" | "review" | "avoid";
  reasoning: string[];
  tradeoffs?: string[];
  alternatives?: string[];
  confidence?: number;
}

export interface LabExecutionAlternative {
  actionType: string;
  label: string;
  summary: string;
  tradeoff: string;
  relativeAdvantage?:
    | "higher-precision"
    | "higher-coverage"
    | "lower-risk"
    | "faster"
    | "more-stable";
}

export interface LabExecutionAlternatives {
  id: string;
  planId: string;
  summary: string;
  alternatives: LabExecutionAlternative[];
  comparisonNote?: string;
  confidence?: number;
}

export type LabExecutionDecisionPressure = "low" | "medium" | "high";

export interface LabExecutionCandidate {
  id: string;
  planId: string;
  status: "viable" | "unstable" | "not-viable";
  summary: string;
  adaptiveDecisionHint: string;
  decisionPressure: LabExecutionDecisionPressure;
  structuralIntegrity: "complete" | "partial" | "insufficient";
  readinessStatus: LabExecutionReadiness["status"];
  reflectionDecision: LabExecutionReflection["decision"];
  notes?: string[];
  uncertainties?: string[];
  confidence?: number;
}

export type LabExecutionCommitmentStatus = "inactive" | "committed" | "revoked";

export interface LabExecutionCommitment {
  id: string;
  planId: string;
  status: LabExecutionCommitmentStatus;
  candidateStatus: LabExecutionCandidate["status"];
  summary: string;
  committedAt?: number;
  notes?: string[];
  uncertainties?: string[];
  confidence?: number;
}

export type LabExecutionStagingStatus = "staged" | "not-staged";

export interface LabExecutionStaging {
  id: string;
  planId: string;
  status: LabExecutionStagingStatus;
  summary: string;
  commitmentStatus: "committed" | "none";
  candidateStatus: LabExecutionCandidate["status"];
  readinessStatus: LabExecutionReadiness["status"];
  notes?: string[];
  warnings?: string[];
  confidence?: number;
}

export interface LabExecutionArtifactTimeRange {
  start: number;
  end: number;
}

export type LabExecutionArtifactType = "marker" | "segment" | "annotation";

export interface LabExecutionArtifact {
  type: LabExecutionArtifactType;
  label: string;
  timeRange?: LabExecutionArtifactTimeRange;
}

export interface LabExecutionResultMetrics {
  coverage?: number;
  confidence?: number;
}

export interface LabExecutionSelectionSnapshot {
  startMs: number;
  endMs: number;
  type: LabSelectionType;
  intent: LabSelectionIntent;
  inspectionMode: LabInspectionMode;
  sourceKind: string;
  roi?: LabSelectionROI;
}

export interface LabExecutionResult {
  summary: string;
  insights: string[];
  artifacts: LabExecutionArtifact[];
  metrics: LabExecutionResultMetrics;
}

export type LabActiveExecutionResult = LabExecutionResult & {
  selectionSnapshot: LabExecutionSelectionSnapshot;
};

export type LabExecutionGoalOutcome = "successful" | "neutral" | "failed";
export type LabExecutionPatternStrength = "neutral" | "weak" | "strong";

export interface LabExecutionPatternSignal {
  executionCount: number;
  averageCoverage: number;
  successRatio: number;
  failureRatio: number;
  strength: LabExecutionPatternStrength;
  note?: string;
}

export interface LabExecutionGoalEvaluation {
  outcome: LabExecutionGoalOutcome;
  goalAlignment: number;
  summary: string;
  patternSignal?: LabExecutionPatternSignal;
}

export type LabExecutionRuntimeStatus = "idle" | "running" | "completed";

export interface LabExecutionRuntime {
  status: LabExecutionRuntimeStatus;
  activePlanId?: string;
  dispatchId?: string;
  progress?: number;
  result?: LabExecutionResult;
}

export interface LabExecutionDispatchCandidate {
  dispatchId: string;
  planId: string;
  actionType: LabExecutionPayloadPreview["actionType"];
  payloadPreview: LabExecutionPayloadPreview;
  selectionSnapshot: LabExecutionSelectionSnapshot;
  staging: LabExecutionStaging;
}

export type LabGlobalProcessState = "idle" | "processing" | "analyzing" | "staging";

export interface LabGlobalProcessSummary {
  state: LabGlobalProcessState;
  completedCount: number;
  totalCount: number;
  activeTaskKey?: "sourcePreparation" | null;
  activeTaskLabel: string | null;
  progressKey?: "oneActiveTask" | null;
  progressLabel: string | null;
  tone: "neutral" | "running" | "success" | "warning" | "error";
}

export interface LabRightPanelContext {
  activeIntentLabel: string | null;
  candidateStatus: LabExecutionCandidate["status"] | null;
  commitmentStatus: LabExecutionCommitment["status"] | "none";
  processSummary: LabGlobalProcessSummary;
  selectionLabel: string | null;
  selectionRangeLabel: string | null;
  stagingStatus: LabExecutionStaging["status"] | "none";
}

export interface LabInspectionSnapshot {
  id: string;
  objectUrl: string;
  width: number;
  height: number;
  sourceKind: "image" | "video";
  roi: LabSelectionROI;
  createdAt: number;
  timeMs: number | null;
}

export interface LabInterpretationItem {
  id: string;
  type: "info" | "warning" | "hint";
  message: string;
  confidence: number;
  recommendation?: string;
  severity?: "low" | "medium" | "high";
  relatedAction?: string;
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
  playbackRate: number;
  preservePitch: boolean;
  visualizationMode: AudioVisualizationMode;
  eqBands: LabParametricEQBand[];
}

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
  processViewActive: boolean;
  reportOverlayOpen: boolean;
  /** V3 explore toggle — user manually switches Result ↔ Explore */
  userExploreToggle: boolean;
  /** V3 top-bar requested mode, constrained by derived drawer mode rules */
  drawerModeOverride: LabDrawerModeOverride | null;
  /** V3 drawer collapsed state */
  drawerCollapsed: boolean;
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
export type LabFeatureId = "media-analysis" | "audio-analysis";
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
  bytesReceived?: number | null;
  bytesTotal?: number | null;
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
  result?: LabRecord | null;
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

export type LabMode = "normal" | "import-youtube";
export type LabYoutubeImportStatus = "idle" | "parsing" | "ready" | "error";
export type LabYoutubeImportStrategy = "video_best" | "audio_only" | "low_size" | "custom";
export type LabYoutubeImportCustomResolution = "best" | "1080p" | "720p" | "480p";
export type LabYoutubeImportCustomFormat = "mp4" | "webm" | "mkv";

export interface LabYoutubeImportPreview {
  title?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  webpageUrl?: string;
}

export type LabYoutubeImportFormatKind = "video" | "audio" | "muxed" | "unknown";

export interface LabYoutubeImportFormat {
  formatId: string;
  label: string;
  kind: LabYoutubeImportFormatKind;
  extension?: string | null;
  resolution?: string | null;
  fps?: number | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  bitrateKbps?: number | null;
  filesizeBytes?: number | null;
  filesizeApproxBytes?: number | null;
  note?: string | null;
}

export interface LabYoutubeImportCustomSettings {
  resolution: LabYoutubeImportCustomResolution;
  format: LabYoutubeImportCustomFormat;
  audioExtraction: boolean;
}

export interface LabYoutubeImportState {
  url: string | null;
  status: LabYoutubeImportStatus;
  preview: LabYoutubeImportPreview | null;
  formats: LabYoutubeImportFormat[];
  selectedVideoFormatId: string | null;
  selectedAudioFormatId: string | null;
  strategy: LabYoutubeImportStrategy;
  custom: LabYoutubeImportCustomSettings;
}

export type LabProjectImportKind = "video" | "audio" | "image";
export type LabProjectImportMethod = "local" | "url" | "youtube";
export type LabProjectImportReviewFocus = "idle" | "draft" | "running" | "completed";
export type LabProjectImportUrlCheckStatus = "idle" | "checking" | "ready" | "error";

export interface LabProjectImportUrlCheckState {
  status: LabProjectImportUrlCheckStatus;
  url: string | null;
  isYoutube: boolean | null;
  kind: LabProjectImportKind | null;
  error: string | null;
}

export interface LabProjectImportUiState {
  activeKind: LabProjectImportKind;
  methods: Record<LabProjectImportKind, LabProjectImportMethod>;
  drafts: Record<LabProjectImportKind, LabSourceDrafts>;
  urlCheck: LabProjectImportUrlCheckState;
  reviewFocus: LabProjectImportReviewFocus;
  lastAction: string | null;
  lastRequestId: string | null;
}

export interface LabStoreUiState {
  labMode: LabMode;
  youtubeImport: LabYoutubeImportState;
  projectImport: LabProjectImportUiState;
  sourceDrafts: LabSourceDrafts;
  editDrafts: LabEditDrafts;
  profileDrafts: LabProfileDrafts;
  sourceDraftDirty: boolean;
  editDraftDirty: boolean;
  profileDraftDirty: boolean;
  toolManagerOpen: boolean;
  eventFeedExpanded: boolean;
  eventFeedCursor: number;
  artifactListExpanded: boolean;
  artifactRenderCount: number;
  reportView: "user" | "ai";
  lastHydratedProjectId: string | null;
  activeExecutionCommitment: LabExecutionCommitment | null;
  executionRuntime: LabExecutionRuntime;
  activeExecutionIntentId: string | null;
  activeSuggestionPreviewId: string | null;
  activeInspectionSnapshot: LabInspectionSnapshot | null;
  activePreviewArtifactId: string | null;
  activeAssetPreviewId: string | null;
  inspectionMode: LabInspectionMode;
  roiFocusActive: boolean;
  liveFindingsExpanded: boolean;
  analysisControlsCollapsed: boolean;
  /** Workspace side panel collapsed state (Edit stage) */
  editSidePanelCollapsed: boolean;
  /** Raw log section collapsed in Process stage */
  rawLogCollapsed: boolean;
  /** V2.3 workspace state */
  workspace: LabWorkspaceUiState;
  /** V4 project & entity workspace overlay */
  projectWorkspaceOpen: boolean;
  projectWorkspaceSelectedEntityIds: string[];
  projectWorkspaceSort: "createdAt" | "name" | "type";
  projectWorkspaceFilter: LabAssetType | null;
  projectWorkspaceGroup: "type" | "run" | "intent" | null;
  projectWorkspaceSearch: string;
  projectWorkspaceConfirmReplace: string | null;
  projectWorkspaceTimelineHighlight: LabTimelineHighlight | null;
}

export interface LabPersistedState {
  schemaVersion?: number;
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
  projectImport?: Partial<LabProjectImportUiState>;
}

export interface LabStoreState {
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

export interface LabWorkspaceSurface {
  main: string;
  side: string;
}

export type LabStoreEvent =
  | { type: "hydrate"; payload: Partial<LabPersistedState> | null }
  | { type: "enter-youtube-import-mode" }
  | { type: "exit-youtube-import-mode" }
  | { type: "youtube-import-set-url"; url: string | null }
  | { type: "youtube-import-parse-start" }
  | {
      type: "youtube-import-parse-success";
      preview: LabYoutubeImportPreview;
      url?: string | null;
      formats?: LabYoutubeImportFormat[];
      selectedVideoFormatId?: string | null;
      selectedAudioFormatId?: string | null;
    }
  | { type: "youtube-import-parse-error"; reason?: string | null }
  | { type: "youtube-import-set-strategy"; strategy: LabYoutubeImportStrategy }
  | {
      type: "youtube-import-format-selected";
      audioFormatId?: string | null;
      videoFormatId?: string | null;
    }
  | { type: "youtube-import-custom-updated"; patch: Partial<LabYoutubeImportCustomSettings> }
  | { type: "youtube-import-clear" }
  | { type: "project-import-kind-changed"; kind: LabProjectImportKind }
  | {
      type: "project-import-method-changed";
      kind?: LabProjectImportKind;
      method: LabProjectImportMethod;
    }
  | {
      type: "project-import-draft-updated";
      kind?: LabProjectImportKind;
      patch: Partial<LabSourceDrafts>;
    }
  | { type: "project-import-cleared"; kind?: LabProjectImportKind }
  | { type: "project-import-url-check-started"; url: string }
  | { type: "project-import-url-check-cleared" }
  | { type: "project-import-url-check-failed"; url?: string | null; error?: string | null }
  | {
      type: "project-import-review-focused";
      focus: LabProjectImportReviewFocus;
      action?: string | null;
      requestId?: string | null;
    }
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
  | { type: "feature-changed"; featureId: LabFeatureId }
  | { type: "workbench-updated"; workbench: LabRecord }
  | { type: "source-config-patched"; patch: LabRecord }
  | { type: "source-drafts-updated"; patch: Partial<LabSourceDrafts> }
  | { type: "source-drafts-committed" }
  | { type: "edit-drafts-updated"; patch: Partial<LabEditDrafts> }
  | { type: "edit-drafts-committed" }
  | { type: "profile-drafts-updated"; patch: Partial<LabProfileDrafts> }
  | { type: "profile-drafts-committed" }
  | { type: "tool-manager-toggled"; open?: boolean }
  | { type: "toggle-event-feed"; force?: boolean }
  | { type: "advance-event-feed" }
  | { type: "reset-event-feed" }
  | { type: "toggle-artifacts"; force?: boolean }
  | { type: "show-more-artifacts" }
  | { type: "report-view-changed"; view: "user" | "ai" }
  | { type: "preview-artifact-activated"; artifactId: string | null }
  | { type: "asset-preview-opened"; assetId: string }
  | { type: "asset-preview-closed" }
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
  | { type: "workspace-selection-suggestion-accepted"; suggestionId: string }
  | { type: "workspace-selection-suggestion-dismissed"; suggestionId: string }
  | { type: "workspace-selection-suggestion-queued"; suggestionId: string }
  | { type: "workspace-execution-intent-cleared" }
  | { type: "workspace-execution-commitment-set"; planId: string }
  | { type: "workspace-execution-commitment-revoked" }
  | { type: "workspace-execution-dispatch"; planId: string; dispatchId: string }
  | {
      type: "workspace-execution-progress";
      planId: string;
      dispatchId: string;
      progress: number;
    }
  | {
      type: "workspace-execution-completed";
      planId: string;
      dispatchId: string;
      result: LabExecutionResult;
    }
  | { type: "workspace-execution-runtime-reset"; planId?: string; dispatchId?: string }
  | { type: "workspace-selection-suggestion-preview-set"; suggestionId: string }
  | { type: "workspace-selection-suggestion-preview-cleared" }
  | { type: "selection-roi-focus-set"; active: boolean }
  | { type: "selection-roi-focus-cleared" }
  | { type: "selection-roi-updated"; roi: LabSelectionROI }
  | { type: "selection-roi-cleared" }
  | { type: "selection-roi-snapshot-set"; snapshot: LabInspectionSnapshot }
  | { type: "selection-roi-snapshot-cleared" }
  | { type: "selection-inspection-mode-updated"; mode: LabInspectionMode }
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
  | { type: "workspace-process-view-toggled"; force?: boolean }
  | { type: "report-overlay-toggled"; open: boolean }
  | { type: "drawer-collapsed-toggled" }
  | { type: "drawer-explore-toggled" }
  | { type: "drawer-mode-requested"; mode: LabDrawerModeOverride | null }
  // V4 project & entity workspace events
  | { type: "project-workspace-toggled"; open?: boolean }
  | { type: "project-workspace-entity-selected"; entityIds: string[] }
  | { type: "project-workspace-sort-changed"; sort: "createdAt" | "name" | "type" }
  | { type: "project-workspace-filter-changed"; filter: LabAssetType | null }
  | { type: "project-workspace-group-changed"; group: "type" | "run" | "intent" | null }
  | { type: "project-workspace-search-changed"; search: string }
  | { type: "project-workspace-confirm-replace"; assetId: string | null }
  | { type: "project-workspace-timeline-highlighted"; highlight: LabTimelineHighlight | null };

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
  return value === "media-analysis" || value === "audio-analysis";
}

export function normalizeLabFeatureId(value: unknown, fallback: LabFeatureId = "media-analysis") {
  return isLabFeatureId(value) ? value : fallback;
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
