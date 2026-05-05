import type { AnalysisReference, AnalysisScope } from "../shared/types/analysis-scope.js";

export type LabRecord = Record<string, unknown>;

export type LabAssetType = "source" | "clip" | "frame" | "audio" | "image" | "report" | "artifact";
export type LabFocusLayer = "preview" | "timeline" | "inspector";

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
export type LabDecisionIntent =
  | "idle"
  | "preparing-analysis"
  | "ready-to-run"
  | "running-analysis"
  | "reviewing-results"
  | "exploring-alternatives";
export type LabDecisionSignal = "has-selection" | "has-source" | "is-running" | "has-result";
export type LabDecisionState = "idle" | "ready" | "running" | "done";
export type LabDecisionSnapshot = {
  mode: LabDrawerMode;
  intent: LabDecisionIntent;
  triggers: LabDecisionSignal[];
  activeBlocks: string[];
  state: LabDecisionState;
  timestamp: number;
};
export type LabPipelineBlock = {
  id: string;
  type: "section" | "action" | "status" | "output";
  render: () => string;
  visible?: () => boolean;
};

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
  flowKind?: LabCapabilityFlowKind;
  operationCapabilityId?: LabOperationCapabilityId;
  analysisCapabilityId?: CapabilityFamilyId;
  toolIds?: string[];
  outputKind?: LabOperationOutputKind;
  actionType:
    | "analyze-segment"
    | "extract-clip"
    | "focus-region"
    | "inspect-motion"
    | "inspect-audio"
    | "enhance-visual"
    | "enhance-frame"
    | "crop-region"
    | "clean-audio"
    | "separate-stems"
    | "stabilize-segment"
    | "ocr-region"
    | "metadata-audit"
    | "detect-scenes"
    | "detect-objects";
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
export type LabWorkspaceControlTab = "audio" | "visual" | "operations";

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
  previewVolume: number;
  hypothesis: string;
  bookmarks: LabBookmark[];
  selectedIntents: LabIntentId[];
  analysisPrepExpandedIntentIds: LabIntentId[];
  sourceIntakeCollapsed: boolean;
  selectionMicroZoomOpen: boolean;
  controlsDrawerOpen: boolean;
  controlsDrawerTab: LabWorkspaceControlTab;
  processViewActive: boolean;
  reportOverlayOpen: boolean;
  selectionTabActive: boolean;
  /** V3 explore toggle — user manually switches Result ↔ Explore */
  userExploreToggle: boolean;
  /** V3 top-bar requested mode, constrained by derived drawer mode rules */
  drawerModeOverride: LabDrawerModeOverride | null;
  /** V3 drawer collapsed state */
  drawerCollapsed: boolean;
  /** V4B inspector pinned state — push vs popover */
  inspectorPinned: boolean;
  /** V4B active icon rail slot */
  activeIconRailSlot: LabIconRailSlotId | null;
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
export type LabCapabilityFlowKind = "operation-result" | "analysis-report";
export type LabOperationOutputKind = LabAssetType | "variant" | "stem";

export type LabOperationCapabilityId =
  | "clip-export"
  | "frame-grab"
  | "roi-crop"
  | "enhanced-frame"
  | "before-after-variant"
  | "audio-extract"
  | "audio-cleanup"
  | "band-pass-voice"
  | "stem-separation"
  | "segment-stabilization";

/** V4B Icon rail slot identifiers */
export type LabIconRailSlotId =
  | "roi-select"
  | "audio-focus"
  | "frame-export"
  | "denoise"
  | "stabilize"
  | "visual-adjust"
  | "clip-export"
  | "enhanced-frame"
  | "before-after"
  | "audio-extract"
  | "band-pass"
  | "stem-separate";

export type LabIconRailGroup = "realtime" | "post-process";

/**
 * V5A — Icon rail slot content kind:
 *  - "operation": popover renders the matching operation capability card
 *  - "audio-focus": popover renders Audio Focus controls
 *  - "visual-adjust": popover renders Visual (Interactive) Controls
 */
export type LabIconRailSlotContent = "operation" | "audio-focus" | "visual-adjust";

export interface LabIconRailSlot {
  id: LabIconRailSlotId;
  group: LabIconRailGroup;
  capabilityId: LabOperationCapabilityId | null;
  content: LabIconRailSlotContent;
  draft: boolean;
}

export const ICON_RAIL_SLOTS: readonly LabIconRailSlot[] = [
  {
    id: "roi-select",
    group: "realtime",
    capabilityId: "roi-crop",
    content: "operation",
    draft: false,
  },
  {
    id: "audio-focus",
    group: "realtime",
    capabilityId: null,
    content: "audio-focus",
    draft: false,
  },
  {
    id: "frame-export",
    group: "realtime",
    capabilityId: "frame-grab",
    content: "operation",
    draft: false,
  },
  {
    id: "clip-export",
    group: "post-process",
    capabilityId: "clip-export",
    content: "operation",
    draft: false,
  },
  {
    id: "enhanced-frame",
    group: "post-process",
    capabilityId: "enhanced-frame",
    content: "operation",
    draft: false,
  },
  {
    id: "before-after",
    group: "post-process",
    capabilityId: "before-after-variant",
    content: "operation",
    draft: false,
  },
  {
    id: "audio-extract",
    group: "post-process",
    capabilityId: "audio-extract",
    content: "operation",
    draft: false,
  },
  {
    id: "band-pass",
    group: "post-process",
    capabilityId: "band-pass-voice",
    content: "operation",
    draft: false,
  },
  {
    id: "denoise",
    group: "post-process",
    capabilityId: "audio-cleanup",
    content: "operation",
    draft: false,
  },
  {
    id: "stem-separate",
    group: "post-process",
    capabilityId: "stem-separation",
    content: "operation",
    draft: false,
  },
  {
    id: "stabilize",
    group: "post-process",
    capabilityId: "segment-stabilization",
    content: "operation",
    draft: false,
  },
  {
    id: "visual-adjust",
    group: "post-process",
    capabilityId: null,
    content: "visual-adjust",
    draft: false,
  },
];

export type LabSettingsValue = string | number | boolean | null;
export type LabSettingsRecord = Record<string, LabSettingsValue>;

export interface LabSettingsFieldOption {
  label: string;
  value: string;
}

export interface LabSettingsFieldMeta {
  id: string;
  label: string;
  kind: "number" | "select" | "toggle";
  options?: LabSettingsFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export type LabOperationSettingsMap = Record<LabOperationCapabilityId, LabSettingsRecord>;

export interface LabAnalysisSettingsMap {
  families: Partial<Record<CapabilityFamilyId, LabSettingsRecord>>;
  modules: Record<string, LabSettingsRecord>;
}

function cloneSettingsRecord(record: LabSettingsRecord): LabSettingsRecord {
  return { ...record };
}

function pickOption(value: unknown, options: readonly string[], fallback: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return options.includes(normalized) ? normalized : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickNumber(value: unknown, fallback: number, min: number, max: number, step = 1): number {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  const numeric = Number.isFinite(raw) ? raw : fallback;
  const clamped = Math.max(min, Math.min(max, numeric));
  const stepped = step > 0 ? Math.round(clamped / step) * step : clamped;
  const [, decimal = ""] = String(step).split(".");
  return Number(stepped.toFixed(Math.min(6, decimal.length + 2)));
}

export const LAB_OPERATION_SETTINGS_DEFAULTS: LabOperationSettingsMap = {
  "clip-export": {
    format: "mp4",
    quality: "balanced",
    fps: "source",
    includeAudio: true,
    applyRoiCrop: false,
    scale: "source",
  },
  "segment-stabilization": {
    shakiness: "medium",
    smoothing: 12,
    cropMode: "keep",
    quality: "balanced",
  },
  "frame-grab": {
    frameMode: "current",
    burstCount: 1,
    format: "png",
    quality: 92,
    timestampLabel: false,
  },
  "roi-crop": {
    padding: 0,
    aspectLock: "free",
    outputSize: "source",
    format: "png",
  },
  "enhanced-frame": {
    preset: "clarity",
    strength: 1,
    applyPreviewSettings: false,
    format: "png",
  },
  "before-after-variant": {
    layout: "side-by-side",
    revealPreset: "clarity",
    strength: 1,
    format: "png",
  },
  "audio-extract": {
    format: "wav",
    channels: "stereo",
    sampleRate: 48000,
    timelineOnly: false,
  },
  "audio-cleanup": {
    denoise: "medium",
    highpassHz: 80,
    lowpassHz: 12000,
    normalizeTargetDb: -16,
    compressor: true,
  },
  "band-pass-voice": {
    lowHz: 120,
    highHz: 3800,
    widthQ: 1,
    gain: 1,
    channels: "mono",
  },
  "stem-separation": {
    model: "htdemucs",
    device: "cpu",
    stems: "all",
    segmentPreset: "balanced",
  },
};

export const LAB_OPERATION_SETTINGS_FIELDS: Record<
  LabOperationCapabilityId,
  LabSettingsFieldMeta[]
> = {
  "clip-export": [
    {
      id: "format",
      label: "Format",
      kind: "select",
      options: ["mp4", "webm", "gif"].map((value) => ({ label: value.toUpperCase(), value })),
    },
    {
      id: "quality",
      label: "Quality",
      kind: "select",
      options: ["compact", "balanced", "high"].map((value) => ({ label: value, value })),
    },
    {
      id: "fps",
      label: "FPS",
      kind: "select",
      options: ["source", "12", "24", "30"].map((value) => ({ label: value, value })),
    },
    { id: "includeAudio", label: "Include audio", kind: "toggle" },
    { id: "applyRoiCrop", label: "Apply ROI crop", kind: "toggle" },
    {
      id: "scale",
      label: "Scale",
      kind: "select",
      options: ["source", "480p", "720p", "1080p"].map((value) => ({ label: value, value })),
    },
  ],
  "segment-stabilization": [
    {
      id: "shakiness",
      label: "Shakiness",
      kind: "select",
      options: ["low", "medium", "high"].map((value) => ({ label: value, value })),
    },
    { id: "smoothing", label: "Smoothing", kind: "number", min: 1, max: 30, step: 1 },
    {
      id: "cropMode",
      label: "Crop",
      kind: "select",
      options: ["keep", "adaptive", "fixed"].map((value) => ({ label: value, value })),
    },
    {
      id: "quality",
      label: "Quality",
      kind: "select",
      options: ["compact", "balanced", "high"].map((value) => ({ label: value, value })),
    },
  ],
  "frame-grab": [
    {
      id: "frameMode",
      label: "Frame",
      kind: "select",
      options: ["current", "middle", "burst"].map((value) => ({ label: value, value })),
    },
    { id: "burstCount", label: "Burst", kind: "number", min: 1, max: 12, step: 1 },
    {
      id: "format",
      label: "Format",
      kind: "select",
      options: ["png", "jpg", "webp"].map((value) => ({ label: value.toUpperCase(), value })),
    },
    { id: "quality", label: "Quality", kind: "number", min: 1, max: 100, step: 1, unit: "%" },
    { id: "timestampLabel", label: "Timestamp label", kind: "toggle" },
  ],
  "roi-crop": [
    { id: "padding", label: "Padding", kind: "number", min: 0, max: 100, step: 1, unit: "px" },
    {
      id: "aspectLock",
      label: "Aspect",
      kind: "select",
      options: ["free", "square", "16:9", "4:3"].map((value) => ({ label: value, value })),
    },
    {
      id: "outputSize",
      label: "Size",
      kind: "select",
      options: ["source", "512", "1024", "2048"].map((value) => ({ label: value, value })),
    },
    {
      id: "format",
      label: "Format",
      kind: "select",
      options: ["png", "jpg", "webp"].map((value) => ({ label: value.toUpperCase(), value })),
    },
  ],
  "enhanced-frame": [
    {
      id: "preset",
      label: "Preset",
      kind: "select",
      options: ["clarity", "low-light", "edge", "forensic"].map((value) => ({
        label: value,
        value,
      })),
    },
    { id: "strength", label: "Strength", kind: "number", min: 0.25, max: 2, step: 0.05 },
    { id: "applyPreviewSettings", label: "Apply preview", kind: "toggle" },
    {
      id: "format",
      label: "Format",
      kind: "select",
      options: ["png", "jpg", "webp"].map((value) => ({ label: value.toUpperCase(), value })),
    },
  ],
  "before-after-variant": [
    {
      id: "layout",
      label: "Layout",
      kind: "select",
      options: ["side-by-side", "stacked", "wipe"].map((value) => ({ label: value, value })),
    },
    {
      id: "revealPreset",
      label: "Reveal",
      kind: "select",
      options: ["clarity", "low-light", "edge", "forensic"].map((value) => ({
        label: value,
        value,
      })),
    },
    { id: "strength", label: "Strength", kind: "number", min: 0.25, max: 2, step: 0.05 },
    {
      id: "format",
      label: "Format",
      kind: "select",
      options: ["png", "jpg", "webp"].map((value) => ({ label: value.toUpperCase(), value })),
    },
  ],
  "audio-extract": [
    {
      id: "format",
      label: "Format",
      kind: "select",
      options: ["wav", "flac", "mp3"].map((value) => ({ label: value.toUpperCase(), value })),
    },
    {
      id: "channels",
      label: "Channels",
      kind: "select",
      options: ["mono", "stereo", "source"].map((value) => ({ label: value, value })),
    },
    {
      id: "sampleRate",
      label: "Sample rate",
      kind: "select",
      options: ["16000", "44100", "48000"].map((value) => ({ label: `${value} Hz`, value })),
    },
    { id: "timelineOnly", label: "Selection only", kind: "toggle" },
  ],
  "audio-cleanup": [
    {
      id: "denoise",
      label: "Denoise",
      kind: "select",
      options: ["light", "medium", "strong"].map((value) => ({ label: value, value })),
    },
    {
      id: "highpassHz",
      label: "High-pass",
      kind: "number",
      min: 20,
      max: 1000,
      step: 10,
      unit: "Hz",
    },
    {
      id: "lowpassHz",
      label: "Low-pass",
      kind: "number",
      min: 1000,
      max: 20000,
      step: 100,
      unit: "Hz",
    },
    {
      id: "normalizeTargetDb",
      label: "Normalize",
      kind: "number",
      min: -30,
      max: -6,
      step: 1,
      unit: "dB",
    },
    { id: "compressor", label: "Compressor", kind: "toggle" },
  ],
  "band-pass-voice": [
    { id: "lowHz", label: "Low", kind: "number", min: 20, max: 1000, step: 10, unit: "Hz" },
    { id: "highHz", label: "High", kind: "number", min: 1000, max: 10000, step: 100, unit: "Hz" },
    { id: "widthQ", label: "Q", kind: "number", min: 0.1, max: 10, step: 0.1 },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 8, step: 0.1, unit: "x" },
    {
      id: "channels",
      label: "Channels",
      kind: "select",
      options: ["mono", "stereo"].map((value) => ({ label: value, value })),
    },
  ],
  "stem-separation": [
    {
      id: "model",
      label: "Model",
      kind: "select",
      options: ["htdemucs", "htdemucs_ft", "mdx_extra"].map((value) => ({ label: value, value })),
    },
    {
      id: "device",
      label: "Device",
      kind: "select",
      options: ["cpu", "cuda"].map((value) => ({ label: value, value })),
    },
    {
      id: "stems",
      label: "Stems",
      kind: "select",
      options: ["all", "vocals", "drums", "bass", "other"].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      id: "segmentPreset",
      label: "Segment",
      kind: "select",
      options: ["fast", "balanced", "quality"].map((value) => ({ label: value, value })),
    },
  ],
};

export interface LabOperationCapabilityMeta {
  id: LabOperationCapabilityId;
  flowKind: "operation-result";
  label: string;
  description: string;
  sourceKinds: Array<"video" | "audio" | "image">;
  outputKinds: LabOperationOutputKind[];
  providerIds: string[];
  toolIds: string[];
  actionId: string | null;
  groupId: "clip" | "frame" | "audio" | "stems";
  requiresSelection?: boolean;
  requiresRoi?: boolean;
  planned?: boolean;
}

export interface LabOperationCapabilityProjection extends LabOperationCapabilityMeta {
  readiness: CapabilityReadiness;
  blockReason: string | null;
  settings: LabSettingsRecord;
  settingsFields: LabSettingsFieldMeta[];
  actionStatus: "idle" | "running" | "success" | "error";
  activeActionLabel: string | null;
  activeActionMessage: string | null;
  activeJobId: string | null;
  activeRequestId: string | null;
  resultAssetIds?: string[];
  progress?: number | null;
}

export interface LabProcessingOverlayState {
  active: boolean;
  label: string;
  progress: number | null;
  indeterminate: boolean;
  elapsedSeconds: number;
  cancelAction: "cancel-analysis" | "operation-cancel" | null;
  cancelValue: string;
}

export interface LabAnalysisCapabilityModuleProjection {
  capabilityId: CapabilityFamilyId;
  moduleId: string;
  label: string;
  flowKind: "analysis-report";
  requiredTools: string[];
  readiness: CapabilityReadiness;
  blockReason: string | null;
  enabled: boolean;
  settings: LabSettingsRecord;
  settingsFields: LabSettingsFieldMeta[];
  reportSection: string;
}

export interface LabAnalysisPreparationGroup {
  intentId: LabIntentId;
  label: string;
  description: string;
  selected: boolean;
  readiness: CapabilityReadiness;
  blockReason: string | null;
  expectedOutputs: LabExpectedOutput[];
  modules: LabAnalysisCapabilityModuleProjection[];
}

export interface CapabilityFamilyMeta {
  id: CapabilityFamilyId;
  label: string;
  sourceKinds: Array<"video" | "audio" | "image">;
  primaryTool: string;
  requiredTools: string[];
}

export const LAB_OPERATION_CAPABILITIES: LabOperationCapabilityMeta[] = [
  {
    id: "clip-export",
    flowKind: "operation-result",
    label: "Clip Export",
    description: "Create a standalone clip from the active timeline selection.",
    sourceKinds: ["video"],
    outputKinds: ["clip"],
    providerIds: ["ffmpeg-export"],
    toolIds: ["ffmpeg"],
    actionId: "timeline-export-clip",
    groupId: "clip",
    requiresSelection: true,
  },
  {
    id: "segment-stabilization",
    flowKind: "operation-result",
    label: "Stabilized Review Clip",
    description: "Prepare a stabilized clip variant for motion readability.",
    sourceKinds: ["video"],
    outputKinds: ["clip", "variant"],
    providerIds: ["ffmpeg-stabilization"],
    toolIds: ["ffmpeg"],
    actionId: null,
    groupId: "clip",
    requiresSelection: true,
    planned: true,
  },
  {
    id: "frame-grab",
    flowKind: "operation-result",
    label: "Frame Grab",
    description: "Capture the current video frame as a project asset.",
    sourceKinds: ["video"],
    outputKinds: ["frame"],
    providerIds: ["ffmpeg-export"],
    toolIds: ["ffmpeg"],
    actionId: "timeline-grab-frame",
    groupId: "frame",
  },
  {
    id: "roi-crop",
    flowKind: "operation-result",
    label: "Crop ROI",
    description: "Export the active inspection region as an image asset.",
    sourceKinds: ["video", "image"],
    outputKinds: ["image"],
    providerIds: ["ffmpeg-export"],
    toolIds: ["ffmpeg"],
    actionId: "workspace-selection-roi-export",
    groupId: "frame",
    requiresRoi: true,
  },
  {
    id: "enhanced-frame",
    flowKind: "operation-result",
    label: "Enhanced Frame",
    description: "Generate a clarity-focused frame or ROI variant.",
    sourceKinds: ["video", "image"],
    outputKinds: ["frame", "image", "variant"],
    providerIds: ["ffmpeg-visual-reveal"],
    toolIds: ["ffmpeg"],
    actionId: "workspace-enhanced-frame-export",
    groupId: "frame",
  },
  {
    id: "before-after-variant",
    flowKind: "operation-result",
    label: "Before/After Variant",
    description: "Prepare an original-versus-enhanced comparison asset for review.",
    sourceKinds: ["video", "image"],
    outputKinds: ["image", "variant"],
    providerIds: ["ffmpeg-visual-reveal"],
    toolIds: ["ffmpeg"],
    actionId: null,
    groupId: "frame",
    planned: true,
  },
  {
    id: "audio-extract",
    flowKind: "operation-result",
    label: "Extract Audio",
    description: "Export the source audio track as a WAV asset.",
    sourceKinds: ["video", "audio"],
    outputKinds: ["audio"],
    providerIds: ["ffmpeg-export"],
    toolIds: ["ffmpeg"],
    actionId: "timeline-extract-audio",
    groupId: "audio",
  },
  {
    id: "audio-cleanup",
    flowKind: "operation-result",
    label: "Clean Audio",
    description: "Create a denoised or band-pass focused audio variant.",
    sourceKinds: ["video", "audio"],
    outputKinds: ["audio", "variant"],
    providerIds: ["ffmpeg-signal-recovery"],
    toolIds: ["ffmpeg"],
    actionId: "workspace-audio-cleanup-export",
    groupId: "audio",
  },
  {
    id: "band-pass-voice",
    flowKind: "operation-result",
    label: "Band-pass Voice",
    description: "Create a voice-focused audio variant with a constrained frequency pass.",
    sourceKinds: ["video", "audio"],
    outputKinds: ["audio", "variant"],
    providerIds: ["ffmpeg-signal-recovery"],
    toolIds: ["ffmpeg"],
    actionId: "workspace-band-pass-voice-export",
    groupId: "audio",
  },
  {
    id: "stem-separation",
    flowKind: "operation-result",
    label: "Separate Sources",
    description: "Create isolated stems for speech, ambience, or music review.",
    sourceKinds: ["video", "audio"],
    outputKinds: ["audio", "stem"],
    providerIds: ["source-separation-runner"],
    toolIds: ["demucs", "ffmpeg"],
    actionId: null,
    groupId: "stems",
    planned: true,
  },
];

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

export const LAB_ANALYSIS_FAMILY_SETTINGS_DEFAULTS: Record<CapabilityFamilyId, LabSettingsRecord> =
  {
    "visual-structure": {
      samplingDensity: "balanced",
      frameStep: 24,
      sensitivity: "medium",
      roiOnly: false,
    },
    "visual-forensics": {
      samplingDensity: "balanced",
      sensitivity: "medium",
      roiOnly: false,
      revealStrength: 1,
    },
    "audio-signal": {
      sampleWindowSeconds: 60,
      silenceThresholdDb: -38,
      sensitivity: "medium",
    },
    "audio-recovery": {
      sampleWindowSeconds: 60,
      recoveryPreset: "speech",
      denoise: "medium",
      gain: 2,
    },
    transcription: {
      modelPolicy: "selected",
      language: "auto",
      sampleSeconds: 45,
      selectedRangeOnly: true,
    },
    "speaker-analysis": {
      speakerCount: "auto",
      minSegmentSeconds: 1.5,
      sensitivity: "medium",
    },
    "prosody-emotion": {
      windowSeconds: 3,
      silenceThresholdDb: -38,
      heuristicSensitivity: "medium",
    },
    "sound-classification": {
      topK: 8,
      threshold: 0.15,
    },
    "source-separation": {
      model: "htdemucs",
      device: "cpu",
      stems: "all",
    },
    "music-analysis": {
      sampleRate: 22050,
      focus: "balanced",
      essentiaFallback: true,
    },
  };

export const LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS: Record<string, LabSettingsRecord> = {
  "frame-consistency": { samplingDensity: "balanced", frameStep: 24, sensitivity: "medium" },
  "lighting-consistency": { samplingDensity: "balanced", sensitivity: "medium", roiOnly: false },
  "background-consistency": { samplingDensity: "balanced", sensitivity: "medium", roiOnly: false },
  "occlusion-inconsistency": { samplingDensity: "balanced", sensitivity: "medium", roiOnly: false },
  "object-insert-remove-anomaly": {
    samplingDensity: "balanced",
    sensitivity: "medium",
    roiOnly: false,
  },
  "temporal-noise-pattern": { samplingDensity: "balanced", frameStep: 24, sensitivity: "medium" },
  "motion-anomaly": { samplingDensity: "dense", frameStep: 12, sensitivity: "medium" },
  "visual-signal-amplification": { revealStrength: 1, channelMode: "rgb", roiOnly: false },
  "color-channel-isolation": { channelMode: "red", revealStrength: 1, roiOnly: false },
  "gamma-scan": { gammaMin: 0.7, gammaMax: 1.7, revealStrength: 1, roiOnly: false },
  "contrast-scan": { contrastMin: 1.1, contrastMax: 1.6, revealStrength: 1, roiOnly: false },
  "edge-enhancement": { edgeStrength: 1, roiOnly: false },
  "histogram-equalization": { histogramStrength: 0.35, roiOnly: false },
  "hidden-detail-reveal": { revealStrength: 1.25, roiOnly: false },
  "ai-artifact-detection": { sensitivity: "medium", roiOnly: false },
  "signal-health": { sampleWindowSeconds: 60, silenceThresholdDb: -38, sensitivity: "medium" },
  "spectral-artifacts": { sampleWindowSeconds: 60, sensitivity: "medium" },
  "signal-recovery": { recoveryPreset: "speech", denoise: "medium", gain: 2.2 },
  "frequency-shift-reversal": { shiftHz: -120, lowHz: 100, highHz: 5200, gain: 2.1 },
  "band-pass-exploration": { centerHz: 1700, widthHz: 1800, gain: 6 },
  "spectrogram-guided-recovery": { lowHz: 120, highHz: 4200, denoise: "medium", gain: 2.6 },
  "hidden-pattern-extraction": { lowHz: 220, highHz: 6400, gain: 5.5, compression: "strong" },
  "phase-recovery-experiment": { phaseMode: "side", lowHz: 100, highHz: 5200, gain: 8 },
  transcription: {
    modelPolicy: "selected",
    language: "auto",
    sampleSeconds: 45,
    selectedRangeOnly: true,
  },
  "transcript-support": {
    modelPolicy: "selected",
    language: "auto",
    sampleSeconds: 45,
    selectedRangeOnly: true,
  },
  "speaker-diarization": {
    speakerCount: "auto",
    minSegmentSeconds: 1.5,
    sensitivity: "medium",
  },
  prosody: { windowSeconds: 3, silenceThresholdDb: -38, sensitivity: "medium" },
  emotion: { windowSeconds: 3, heuristicSensitivity: "medium" },
  "sound-events": { topK: 8, threshold: 0.15 },
  "source-separation": { model: "htdemucs", device: "cpu", stems: "all" },
  "music-rhythm-tonal": { sampleRate: 22050, focus: "balanced", essentiaFallback: true },
};

export const LAB_ANALYSIS_MODULE_SETTINGS_FIELDS: Record<string, LabSettingsFieldMeta[]> = {
  "frame-consistency": [
    {
      id: "samplingDensity",
      label: "Sampling",
      kind: "select",
      options: ["sparse", "balanced", "dense"].map((value) => ({ label: value, value })),
    },
    { id: "frameStep", label: "Frame step", kind: "number", min: 1, max: 120, step: 1 },
    {
      id: "sensitivity",
      label: "Sensitivity",
      kind: "select",
      options: ["low", "medium", "high"].map((value) => ({ label: value, value })),
    },
  ],
  "visual-signal-amplification": [
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
    {
      id: "channelMode",
      label: "Channel",
      kind: "select",
      options: ["rgb", "red", "green", "blue"].map((value) => ({ label: value, value })),
    },
    { id: "roiOnly", label: "ROI only", kind: "toggle" },
  ],
  "color-channel-isolation": [
    {
      id: "channelMode",
      label: "Channel",
      kind: "select",
      options: ["red", "green", "blue"].map((value) => ({ label: value, value })),
    },
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
  ],
  "gamma-scan": [
    { id: "gammaMin", label: "Gamma min", kind: "number", min: 0.1, max: 2, step: 0.05 },
    { id: "gammaMax", label: "Gamma max", kind: "number", min: 0.2, max: 5, step: 0.05 },
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
  ],
  "contrast-scan": [
    { id: "contrastMin", label: "Contrast min", kind: "number", min: 0.5, max: 2, step: 0.05 },
    { id: "contrastMax", label: "Contrast max", kind: "number", min: 0.6, max: 3, step: 0.05 },
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
  ],
  "edge-enhancement": [
    { id: "edgeStrength", label: "Edge", kind: "number", min: 0.25, max: 2, step: 0.05 },
    { id: "roiOnly", label: "ROI only", kind: "toggle" },
  ],
  "histogram-equalization": [
    {
      id: "histogramStrength",
      label: "Strength",
      kind: "number",
      min: 0.05,
      max: 1,
      step: 0.05,
    },
    { id: "roiOnly", label: "ROI only", kind: "toggle" },
  ],
  "hidden-detail-reveal": [
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
    { id: "roiOnly", label: "ROI only", kind: "toggle" },
  ],
  "signal-health": [
    {
      id: "sampleWindowSeconds",
      label: "Window",
      kind: "number",
      min: 5,
      max: 600,
      step: 5,
      unit: "s",
    },
    {
      id: "silenceThresholdDb",
      label: "Silence",
      kind: "number",
      min: -80,
      max: -10,
      step: 1,
      unit: "dB",
    },
  ],
  "spectral-artifacts": [
    {
      id: "sampleWindowSeconds",
      label: "Window",
      kind: "number",
      min: 5,
      max: 600,
      step: 5,
      unit: "s",
    },
    {
      id: "sensitivity",
      label: "Sensitivity",
      kind: "select",
      options: ["low", "medium", "high"].map((value) => ({ label: value, value })),
    },
  ],
  "signal-recovery": [
    {
      id: "recoveryPreset",
      label: "Preset",
      kind: "select",
      options: ["speech", "broadband", "hidden"].map((value) => ({ label: value, value })),
    },
    {
      id: "denoise",
      label: "Denoise",
      kind: "select",
      options: ["light", "medium", "strong"].map((value) => ({ label: value, value })),
    },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 8, step: 0.1, unit: "x" },
  ],
  "frequency-shift-reversal": [
    { id: "shiftHz", label: "Shift", kind: "number", min: -600, max: 600, step: 10, unit: "Hz" },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 8, step: 0.1, unit: "x" },
  ],
  "band-pass-exploration": [
    { id: "centerHz", label: "Center", kind: "number", min: 100, max: 6000, step: 50, unit: "Hz" },
    { id: "widthHz", label: "Width", kind: "number", min: 100, max: 8000, step: 50, unit: "Hz" },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "x" },
  ],
  "spectrogram-guided-recovery": [
    { id: "lowHz", label: "Low", kind: "number", min: 20, max: 2000, step: 10, unit: "Hz" },
    { id: "highHz", label: "High", kind: "number", min: 1000, max: 12000, step: 100, unit: "Hz" },
    {
      id: "denoise",
      label: "Denoise",
      kind: "select",
      options: ["light", "medium", "strong"].map((value) => ({ label: value, value })),
    },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "x" },
  ],
  "hidden-pattern-extraction": [
    { id: "lowHz", label: "Low", kind: "number", min: 20, max: 2000, step: 10, unit: "Hz" },
    { id: "highHz", label: "High", kind: "number", min: 1000, max: 12000, step: 100, unit: "Hz" },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "x" },
    {
      id: "compression",
      label: "Compression",
      kind: "select",
      options: ["off", "light", "medium", "strong"].map((value) => ({ label: value, value })),
    },
  ],
  "phase-recovery-experiment": [
    {
      id: "phaseMode",
      label: "Phase",
      kind: "select",
      options: ["side", "left", "right", "mono"].map((value) => ({ label: value, value })),
    },
    { id: "lowHz", label: "Low", kind: "number", min: 20, max: 2000, step: 10, unit: "Hz" },
    { id: "highHz", label: "High", kind: "number", min: 1000, max: 12000, step: 100, unit: "Hz" },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "x" },
  ],
  transcription: [
    {
      id: "modelPolicy",
      label: "Model",
      kind: "select",
      options: ["selected", "fastest", "best-ready"].map((value) => ({ label: value, value })),
    },
    {
      id: "language",
      label: "Language",
      kind: "select",
      options: ["auto", "tr", "en"].map((value) => ({ label: value, value })),
    },
    { id: "sampleSeconds", label: "Sample", kind: "number", min: 5, max: 600, step: 5, unit: "s" },
  ],
  "speaker-diarization": [
    {
      id: "speakerCount",
      label: "Speakers",
      kind: "select",
      options: ["auto", "2", "3", "4", "5"].map((value) => ({ label: value, value })),
    },
    {
      id: "minSegmentSeconds",
      label: "Min segment",
      kind: "number",
      min: 0.2,
      max: 10,
      step: 0.1,
      unit: "s",
    },
  ],
  prosody: [
    {
      id: "windowSeconds",
      label: "Window",
      kind: "number",
      min: 0.5,
      max: 10,
      step: 0.5,
      unit: "s",
    },
    {
      id: "silenceThresholdDb",
      label: "Silence",
      kind: "number",
      min: -80,
      max: -10,
      step: 1,
      unit: "dB",
    },
  ],
  emotion: [
    {
      id: "heuristicSensitivity",
      label: "Sensitivity",
      kind: "select",
      options: ["low", "medium", "high"].map((value) => ({ label: value, value })),
    },
  ],
  "sound-events": [
    { id: "topK", label: "Top K", kind: "number", min: 1, max: 30, step: 1 },
    { id: "threshold", label: "Threshold", kind: "number", min: 0.01, max: 0.95, step: 0.01 },
  ],
  "source-separation": LAB_OPERATION_SETTINGS_FIELDS["stem-separation"].slice(0, 3),
  "music-rhythm-tonal": [
    {
      id: "sampleRate",
      label: "Sample rate",
      kind: "select",
      options: ["16000", "22050", "44100"].map((value) => ({ label: `${value} Hz`, value })),
    },
    {
      id: "focus",
      label: "Focus",
      kind: "select",
      options: ["balanced", "rhythm", "tonal"].map((value) => ({ label: value, value })),
    },
    { id: "essentiaFallback", label: "Essentia fallback", kind: "toggle" },
  ],
};

[
  "lighting-consistency",
  "background-consistency",
  "occlusion-inconsistency",
  "object-insert-remove-anomaly",
  "temporal-noise-pattern",
  "motion-anomaly",
  "ai-artifact-detection",
  "spectral-artifacts",
  "spectrogram-guided-recovery",
  "hidden-pattern-extraction",
  "phase-recovery-experiment",
  "transcript-support",
].forEach(function (moduleId) {
  if (LAB_ANALYSIS_MODULE_SETTINGS_FIELDS[moduleId] === undefined) {
    const capabilityId = CAPABILITY_MODULE_GROUPS.find(function (entry) {
      return entry.moduleIds.includes(moduleId);
    })?.capabilityId;
    LAB_ANALYSIS_MODULE_SETTINGS_FIELDS[moduleId] =
      capabilityId === "visual-structure"
        ? LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["frame-consistency"]!.slice()
        : capabilityId === "visual-forensics"
          ? LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["visual-signal-amplification"]!.slice()
          : capabilityId === "audio-signal"
            ? LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["signal-health"]!.slice()
            : capabilityId === "audio-recovery"
              ? LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["signal-recovery"]!.slice()
              : [];
  }
});

export function normalizeLabOperationSettings(
  capabilityId: LabOperationCapabilityId,
  value: unknown
): LabSettingsRecord {
  const defaults = LAB_OPERATION_SETTINGS_DEFAULTS[capabilityId];
  const record = asLabRecord(value);
  const source = asLabRecord(record[capabilityId] ?? record);
  switch (capabilityId) {
    case "clip-export":
      return {
        format: pickOption(source["format"], ["mp4", "webm", "gif"], String(defaults["format"])),
        quality: pickOption(
          source["quality"],
          ["compact", "balanced", "high"],
          String(defaults["quality"])
        ),
        fps: pickOption(source["fps"], ["source", "12", "24", "30"], String(defaults["fps"])),
        includeAudio: pickBoolean(source["includeAudio"], Boolean(defaults["includeAudio"])),
        applyRoiCrop: pickBoolean(source["applyRoiCrop"], Boolean(defaults["applyRoiCrop"])),
        scale: pickOption(
          source["scale"],
          ["source", "480p", "720p", "1080p"],
          String(defaults["scale"])
        ),
      };
    case "frame-grab":
      return {
        frameMode: pickOption(
          source["frameMode"],
          ["current", "middle", "burst"],
          String(defaults["frameMode"])
        ),
        burstCount: pickNumber(source["burstCount"], Number(defaults["burstCount"]), 1, 12, 1),
        format: pickOption(source["format"], ["png", "jpg", "webp"], String(defaults["format"])),
        quality: pickNumber(source["quality"], Number(defaults["quality"]), 1, 100, 1),
        timestampLabel: pickBoolean(source["timestampLabel"], Boolean(defaults["timestampLabel"])),
      };
    case "roi-crop":
      return {
        padding: pickNumber(source["padding"], Number(defaults["padding"]), 0, 100, 1),
        aspectLock: pickOption(
          source["aspectLock"],
          ["free", "square", "16:9", "4:3"],
          String(defaults["aspectLock"])
        ),
        outputSize: pickOption(
          source["outputSize"],
          ["source", "512", "1024", "2048"],
          String(defaults["outputSize"])
        ),
        format: pickOption(source["format"], ["png", "jpg", "webp"], String(defaults["format"])),
      };
    case "enhanced-frame":
    case "before-after-variant":
      return {
        ...cloneSettingsRecord(defaults),
        ...(capabilityId === "before-after-variant"
          ? {
              layout: pickOption(
                source["layout"],
                ["side-by-side", "stacked", "wipe"],
                String(defaults["layout"])
              ),
              revealPreset: pickOption(
                source["revealPreset"],
                ["clarity", "low-light", "edge", "forensic"],
                String(defaults["revealPreset"])
              ),
            }
          : {
              preset: pickOption(
                source["preset"],
                ["clarity", "low-light", "edge", "forensic"],
                String(defaults["preset"])
              ),
              applyPreviewSettings: pickBoolean(
                source["applyPreviewSettings"],
                Boolean(defaults["applyPreviewSettings"])
              ),
            }),
        strength: pickNumber(source["strength"], Number(defaults["strength"]), 0.25, 2, 0.05),
        format: pickOption(source["format"], ["png", "jpg", "webp"], String(defaults["format"])),
      };
    case "audio-extract":
      return {
        format: pickOption(source["format"], ["wav", "flac", "mp3"], String(defaults["format"])),
        channels: pickOption(
          source["channels"],
          ["mono", "stereo", "source"],
          String(defaults["channels"])
        ),
        sampleRate: pickNumber(
          source["sampleRate"],
          Number(defaults["sampleRate"]),
          8000,
          96000,
          1
        ),
        timelineOnly: pickBoolean(source["timelineOnly"], Boolean(defaults["timelineOnly"])),
      };
    case "audio-cleanup": {
      const highpassHz = pickNumber(
        source["highpassHz"],
        Number(defaults["highpassHz"]),
        20,
        1000,
        10
      );
      const lowpassHz = pickNumber(
        source["lowpassHz"],
        Number(defaults["lowpassHz"]),
        highpassHz + 100,
        20000,
        100
      );
      return {
        denoise: pickOption(
          source["denoise"],
          ["light", "medium", "strong"],
          String(defaults["denoise"])
        ),
        highpassHz,
        lowpassHz: Math.max(highpassHz + 100, lowpassHz),
        normalizeTargetDb: pickNumber(
          source["normalizeTargetDb"],
          Number(defaults["normalizeTargetDb"]),
          -30,
          -6,
          1
        ),
        compressor: pickBoolean(source["compressor"], Boolean(defaults["compressor"])),
      };
    }
    case "band-pass-voice": {
      const lowHz = pickNumber(source["lowHz"], Number(defaults["lowHz"]), 20, 1000, 10);
      const highHz = pickNumber(
        source["highHz"],
        Number(defaults["highHz"]),
        lowHz + 200,
        10000,
        100
      );
      return {
        lowHz,
        highHz: Math.max(lowHz + 200, highHz),
        widthQ: pickNumber(source["widthQ"], Number(defaults["widthQ"]), 0.1, 10, 0.1),
        gain: pickNumber(source["gain"], Number(defaults["gain"]), 0.5, 8, 0.1),
        channels: pickOption(source["channels"], ["mono", "stereo"], String(defaults["channels"])),
      };
    }
    case "stem-separation":
      return {
        model: pickOption(
          source["model"],
          ["htdemucs", "htdemucs_ft", "mdx_extra"],
          String(defaults["model"])
        ),
        device: pickOption(source["device"], ["cpu", "cuda"], String(defaults["device"])),
        stems: pickOption(
          source["stems"],
          ["all", "vocals", "drums", "bass", "other"],
          String(defaults["stems"])
        ),
        segmentPreset: pickOption(
          source["segmentPreset"],
          ["fast", "balanced", "quality"],
          String(defaults["segmentPreset"])
        ),
      };
    case "segment-stabilization":
      return {
        shakiness: pickOption(
          source["shakiness"],
          ["low", "medium", "high"],
          String(defaults["shakiness"])
        ),
        smoothing: pickNumber(source["smoothing"], Number(defaults["smoothing"]), 1, 30, 1),
        cropMode: pickOption(
          source["cropMode"],
          ["keep", "adaptive", "fixed"],
          String(defaults["cropMode"])
        ),
        quality: pickOption(
          source["quality"],
          ["compact", "balanced", "high"],
          String(defaults["quality"])
        ),
      };
    default:
      return cloneSettingsRecord(defaults);
  }
}

export function normalizeLabOperationSettingsMap(value: unknown): LabOperationSettingsMap {
  const record = asLabRecord(value);
  return LAB_OPERATION_CAPABILITIES.reduce<LabOperationSettingsMap>(function (
    settings,
    capability
  ) {
    settings[capability.id] = normalizeLabOperationSettings(capability.id, record[capability.id]);
    return settings;
  }, {} as LabOperationSettingsMap);
}

export function getDefaultLabAnalysisModuleSettings(moduleId: string): LabSettingsRecord {
  const capabilityId = getCapabilityFamilyForModuleId(moduleId);
  return {
    ...(capabilityId === null ? {} : LAB_ANALYSIS_FAMILY_SETTINGS_DEFAULTS[capabilityId]),
    ...cloneSettingsRecord(LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS[moduleId] || {}),
  };
}

export function normalizeLabAnalysisModuleSettings(
  moduleId: string,
  value: unknown
): LabSettingsRecord {
  const defaults = getDefaultLabAnalysisModuleSettings(moduleId);
  const record = asLabRecord(value);
  const source = asLabRecord(record[moduleId] ?? record);
  const next: LabSettingsRecord = {};
  Object.keys(defaults).forEach(function (key) {
    const fallback = defaults[key];
    switch (key) {
      case "samplingDensity":
      case "sensitivity":
      case "denoise":
      case "heuristicSensitivity":
        next[key] = pickOption(
          source[key],
          ["low", "medium", "high", "sparse", "balanced", "dense", "light", "strong"],
          String(fallback)
        );
        break;
      case "recoveryPreset":
        next[key] = pickOption(source[key], ["speech", "broadband", "hidden"], String(fallback));
        break;
      case "modelPolicy":
        next[key] = pickOption(
          source[key],
          ["selected", "fastest", "best-ready"],
          String(fallback)
        );
        break;
      case "language":
        next[key] = pickOption(source[key], ["auto", "tr", "en"], String(fallback));
        break;
      case "speakerCount":
        next[key] = pickOption(source[key], ["auto", "2", "3", "4", "5"], String(fallback));
        break;
      case "channelMode":
        next[key] = pickOption(source[key], ["rgb", "red", "green", "blue"], String(fallback));
        break;
      case "phaseMode":
        next[key] = pickOption(source[key], ["side", "left", "right", "mono"], String(fallback));
        break;
      case "compression":
        next[key] = pickOption(source[key], ["off", "light", "medium", "strong"], String(fallback));
        break;
      case "model":
        next[key] = pickOption(
          source[key],
          ["htdemucs", "htdemucs_ft", "mdx_extra"],
          String(fallback)
        );
        break;
      case "device":
        next[key] = pickOption(source[key], ["cpu", "cuda"], String(fallback));
        break;
      case "stems":
        next[key] = pickOption(
          source[key],
          ["all", "vocals", "drums", "bass", "other"],
          String(fallback)
        );
        break;
      case "focus":
        next[key] = pickOption(source[key], ["balanced", "rhythm", "tonal"], String(fallback));
        break;
      case "roiOnly":
      case "selectedRangeOnly":
      case "essentiaFallback":
        next[key] = pickBoolean(source[key], Boolean(fallback));
        break;
      case "threshold":
        next[key] = pickNumber(source[key], Number(fallback), 0.01, 0.95, 0.01);
        break;
      case "sampleRate":
        next[key] = pickNumber(source[key], Number(fallback), 8000, 96000, 1);
        break;
      case "silenceThresholdDb":
        next[key] = pickNumber(source[key], Number(fallback), -80, -10, 1);
        break;
      case "sampleWindowSeconds":
      case "sampleSeconds":
        next[key] = pickNumber(source[key], Number(fallback), 5, 600, 5);
        break;
      case "topK":
        next[key] = pickNumber(source[key], Number(fallback), 1, 30, 1);
        break;
      case "frameStep":
        next[key] = pickNumber(source[key], Number(fallback), 1, 120, 1);
        break;
      case "windowSeconds":
      case "minSegmentSeconds":
        next[key] = pickNumber(source[key], Number(fallback), 0.2, 10, 0.1);
        break;
      case "gain":
        next[key] = pickNumber(source[key], Number(fallback), 0.5, 10, 0.1);
        break;
      default:
        next[key] =
          typeof fallback === "number"
            ? pickNumber(source[key], fallback, -10000, 10000, 0.01)
            : typeof fallback === "boolean"
              ? pickBoolean(source[key], fallback)
              : typeof fallback === "string"
                ? asNonEmptyString(source[key]) || fallback
                : null;
    }
  });
  return next;
}

export function normalizeLabAnalysisSettingsMap(value: unknown): LabAnalysisSettingsMap {
  const record = asLabRecord(value);
  const rawFamilies = asLabRecord(record["families"]);
  const rawModules = asLabRecord(record["modules"]);
  const families = CAPABILITY_FAMILIES.reduce<
    Partial<Record<CapabilityFamilyId, LabSettingsRecord>>
  >(function (settings, family) {
    const defaults = LAB_ANALYSIS_FAMILY_SETTINGS_DEFAULTS[family.id];
    const source = asLabRecord(rawFamilies[family.id]);
    const next = cloneSettingsRecord(defaults);
    Object.keys(defaults).forEach(function (key) {
      const value = source[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        next[key] = value;
      }
    });
    settings[family.id] = next;
    return settings;
  }, {});
  const modules = Object.keys(LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS).reduce<
    Record<string, LabSettingsRecord>
  >(function (settings, moduleId) {
    settings[moduleId] = normalizeLabAnalysisModuleSettings(moduleId, rawModules[moduleId]);
    return settings;
  }, {});
  return { families, modules };
}

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
  phaseLabel?: string | null;
  phasePercent?: number | null;
  phaseIndex?: number | null;
  phaseCount?: number | null;
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
  progress?: number | null;
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
  labFocusLayer: LabFocusLayer;
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
  analysisCancelPending: boolean;
  /** Workspace side panel collapsed state (Edit stage) */
  editSidePanelCollapsed: boolean;
  /** Raw log section collapsed in Process stage */
  rawLogCollapsed: boolean;
  /** V2.3 workspace state */
  workspace: LabWorkspaceUiState;
  /** V5 source panel (left rail) */
  sourcePanelCollapsed: boolean;
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
  inspector?: string;
  main: string;
  side: string;
}

export type LabStoreEvent =
  | { type: "hydrate"; payload: Partial<LabPersistedState> | null }
  | { type: "lab-focus-layer-changed"; layer: LabFocusLayer }
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
  | { type: "project-import-reset" }
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
  | { type: "analysis-cancel-requested" }
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
  | { type: "workspace-preview-volume-updated"; volume: number }
  | { type: "workspace-interactive-updated"; patch: Partial<LabInteractiveSettings> }
  | { type: "workspace-hypothesis-updated"; text: string }
  | { type: "workspace-bookmark-added"; bookmark: LabBookmark }
  | { type: "workspace-image-analysis-requested" }
  | { type: "workspace-bookmark-removed"; bookmarkId: string }
  | { type: "workspace-intent-toggled"; intentId: LabIntentId }
  | { type: "workspace-intent-set"; intents: LabIntentId[] }
  | { type: "analysis-prep-group-toggled"; intentId: LabIntentId }
  | { type: "analysis-prep-group-expanded"; intentIds: LabIntentId[] }
  | { type: "workspace-source-intake-toggled"; force?: boolean }
  | { type: "workspace-selection-micro-zoom-toggled"; force?: boolean }
  | { type: "workspace-controls-drawer-toggled"; force?: boolean }
  | { type: "workspace-controls-tab-selected"; tab: LabWorkspaceControlTab }
  | { type: "workspace-audio-updated"; patch: Partial<LabAudioFocusSettings> }
  | { type: "workspace-process-view-toggled"; force?: boolean }
  | { type: "report-overlay-toggled"; open: boolean }
  | { type: "selection-tab-toggled"; active: boolean }
  | { type: "source-panel-toggled" }
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
  | { type: "project-workspace-timeline-highlighted"; highlight: LabTimelineHighlight | null }
  // V4B icon rail inspector events
  | { type: "inspector-pin-toggle" }
  | { type: "icon-rail-slot-selected"; slotId: LabIconRailSlotId | null };

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
