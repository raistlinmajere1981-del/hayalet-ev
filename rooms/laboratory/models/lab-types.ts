export type LabRecord = Record<string, unknown>;

export type LabStage = "source" | "edit" | "profile" | "process" | "report";
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

export const LAB_STAGES: LabStage[] = ["source", "edit", "profile", "process", "report"];
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
    id: "subtitle-analysis",
    label: "Altyazi Analizi",
    shortLabel: "Altyazi",
    description: "Altyazı girişi, seçim, analiz ve rapor akışı.",
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
  timestamp: number;
  source: "host" | "ui" | "system";
  action: string | null;
  stage: string | null;
  scope: LabEventScope;
  moduleId: string | null;
  rawLine: string | null;
}

export interface LabSourceDrafts {
  fileNameHint: string;
  urlInput: string;
  youtubeUrl: string;
  youtubePreset: string | null;
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
}

export interface LabFindingProjection {
  id: string;
  moduleId: string | null;
  title: string;
  detail: string;
  level: string;
  confidence: string;
  kind: "measured" | "derived" | "heuristic";
  evidenceCount: number;
  artifactIds: string[];
}

export interface LabArtifactProjection {
  id: string;
  kind: string;
  path: string | null;
  fileName: string | null;
  previewUrl: string | null;
  createdAt: string | null;
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
  warnings: string[];
  error: string | null;
  targetLabel: string | null;
  progress: number | null;
  emptyReason: string | null;
}

export interface LabUserReportFinding {
  id: string;
  title: string;
  detail: string;
  confidence: string;
  evidence: string[];
}

export interface LabUserReport {
  summary: string;
  confidence: string;
  topFindings: LabUserReportFinding[];
}

export interface LabAiReport {
  manifest: LabRecord;
  findings: LabFindingProjection[];
  artifacts: LabArtifactProjection[];
  warnings: string[];
  errors: string[];
  degradedConditions: string[];
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
  moduleManagerOpen: boolean;
  toolManagerOpen: boolean;
  eventFeedExpanded: boolean;
  eventFeedCursor: number;
  artifactListExpanded: boolean;
  artifactRenderCount: number;
  reportView: "user" | "ai";
  lastHydratedProjectId: string | null;
}

export interface LabPersistedState {
  schemaVersion?: number;
  currentStage: LabStage;
  featureId: LabFeatureId;
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
}

export interface LabStoreState {
  currentStage: LabStage;
  featureId: LabFeatureId;
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
  profileModels: LabRecord[];
  toolState: LabRecord;
  activityFeed: LabEventFeedItem[];
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
  | { type: "push-event"; event: LabEventFeedItem }
  | { type: "clear-events" };

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
