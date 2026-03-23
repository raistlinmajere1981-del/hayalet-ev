export type LaboratoryFeatureId = "video-analysis";
export type LaboratorySourceKind = "local-file" | "direct-url" | "youtube-url";
export type LaboratoryAnalysisMode = "fast" | "balanced" | "deep";
export type LaboratoryReportLocale = "en" | "tr";
export type LaboratoryDownloadPreset = "balanced" | "best" | "fast";
export type LaboratoryPreviewPolicy = "smart" | "dense";
export type LaboratoryProjectStatus = "draft" | "ready" | "completed";
export type LaboratoryJobStatus =
  | "idle"
  | "resolving-source"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type LaboratoryProgressPhase =
  | "idle"
  | "source-resolve"
  | "source-copy"
  | "probe"
  | "preview-prep"
  | "history-load"
  | "frame-extraction"
  | "metadata-analysis"
  | "motion-analysis"
  | "visual-analysis"
  | "audio-analysis"
  | "report-build"
  | "persist"
  | "cleanup"
  | "complete";
export type LaboratoryAnalyzerStatus = "ok" | "not-run" | "unsupported" | "no-audio" | "error";
export type LaboratoryRiskLevel = "low" | "medium" | "high";

export interface LaboratoryTimeRangeSelection {
  startSec: number;
  endSec: number;
}

export interface LaboratoryRegionSelection {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

export interface LaboratoryMediaProbe {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  avgFrameRateRaw: string;
  realFrameRateRaw: string;
  frameCount: number | null;
  bitrate: number | null;
  container: string;
  formatName: string;
  videoCodec: string;
  audioCodec: string | null;
  encoder: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface LaboratoryWorkspaceCacheState {
  sourcePresent: boolean;
  previewPresent: boolean;
  derivedMediaPresent: boolean;
  cleanedAt: string | null;
}

export interface LaboratoryAnalysisFocus {
  visual: boolean;
  audio: boolean;
  image: boolean;
  motion: boolean;
}

export interface LaboratoryWorkflowSettings {
  downloadPreset: LaboratoryDownloadPreset;
  previewPolicy: LaboratoryPreviewPolicy;
  focus: LaboratoryAnalysisFocus;
}

export interface LaboratorySourceDescriptor {
  projectId: string;
  workspaceId: string;
  workspaceDir: string;
  kind: LaboratorySourceKind;
  label: string;
  originalInput: string;
  originalFileName: string;
  workingSourcePath: string;
  previewPath: string | null;
  createdAt: string;
  sizeBytes: number;
  probe: LaboratoryMediaProbe;
  workflowSettings: LaboratoryWorkflowSettings;
  cacheState: LaboratoryWorkspaceCacheState;
}

export interface LaboratoryProgressEvent {
  jobId: string;
  workspaceId: string;
  status: LaboratoryJobStatus;
  phase: LaboratoryProgressPhase;
  percent: number;
  summary: string;
  detail: string;
  startedAt: string;
  updatedAt: string;
  currentAnalyzer: string | null;
}

export interface LaboratoryMetricItem {
  label: string;
  value: string;
}

export interface LaboratoryEvidenceItem {
  id: string;
  title: string;
  summary: string;
  score: number;
  timestampStartSec?: number;
  timestampEndSec?: number;
}

export interface LaboratoryAnalyzerReport {
  status: LaboratoryAnalyzerStatus;
  score: number;
  summary: string;
  findings: string[];
  metrics: LaboratoryMetricItem[];
  evidence: LaboratoryEvidenceItem[];
  details: Record<string, unknown>;
}

export interface LaboratoryUserReport {
  reportLocale: LaboratoryReportLocale;
  riskLevel: LaboratoryRiskLevel;
  headline: string;
  summary: string;
  highlights: string[];
  caveats: string[];
}

export interface LaboratoryTechnicalSection {
  id: "metadata" | "motion" | "visual" | "audio";
  title: string;
  status: LaboratoryAnalyzerStatus;
  score: number;
  summary: string;
  findings: string[];
  metrics: LaboratoryMetricItem[];
  evidence: LaboratoryEvidenceItem[];
}

export interface LaboratoryTechnicalReport {
  schemaVersion: 1 | 2 | 3;
  projectId: string;
  entryId: string;
  workspaceId: string;
  createdAt: string;
  overallScore: number;
  riskLevel: LaboratoryRiskLevel;
  interpretation: string;
  mode: LaboratoryAnalysisMode;
  reportLocale: LaboratoryReportLocale;
  source: LaboratorySourceDescriptor;
  workflowSettings: LaboratoryWorkflowSettings;
  selection: {
    timeRange: LaboratoryTimeRangeSelection | null;
    region: LaboratoryRegionSelection | null;
  };
  metadata: LaboratoryAnalyzerReport;
  motion: LaboratoryAnalyzerReport;
  visual: LaboratoryAnalyzerReport;
  audio: LaboratoryAnalyzerReport;
  sections: LaboratoryTechnicalSection[];
}

export interface LaboratoryHistoryEntrySummary {
  projectId: string;
  entryId: string;
  revisionId: string | null;
  workspaceId: string;
  reportLocale: LaboratoryReportLocale;
  createdAt: string;
  updatedAt: string;
  sourceLabel: string;
  sourceKind: LaboratorySourceKind;
  mode: LaboratoryAnalysisMode;
  overallScore: number;
  riskLevel: LaboratoryRiskLevel;
  previewPath: string | null;
  durationSec: number;
  cacheState: LaboratoryWorkspaceCacheState;
}

export interface LaboratoryHistoryEntryRecord {
  summary: LaboratoryHistoryEntrySummary;
  source: LaboratorySourceDescriptor;
  selection: {
    timeRange: LaboratoryTimeRangeSelection | null;
    region: LaboratoryRegionSelection | null;
  };
  userReport: LaboratoryUserReport;
  technicalReport: LaboratoryTechnicalReport;
  userReportPath: string;
  technicalReportPath: string;
}

export interface LaboratoryProjectSummary {
  schemaVersion: 1;
  projectId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  sourceLabel: string;
  sourceKind: LaboratorySourceKind | null;
  reportLocale: LaboratoryReportLocale;
  status: LaboratoryProjectStatus;
  latestEntryId: string | null;
  latestRevisionId: string | null;
  latestOverallScore: number | null;
  latestRiskLevel: LaboratoryRiskLevel | null;
  previewPath: string | null;
  durationSec: number | null;
  cacheState: LaboratoryWorkspaceCacheState | null;
}

export interface LaboratoryProjectRecord {
  schemaVersion: 1;
  summary: LaboratoryProjectSummary;
  source: LaboratorySourceDescriptor | null;
  latestEntry: LaboratoryHistoryEntryRecord | null;
  entries: LaboratoryHistoryEntrySummary[];
}

export interface LaboratoryRuntimeState {
  locale: string;
  reportLocale: LaboratoryReportLocale;
  workflowSettings: LaboratoryWorkflowSettings;
  source: LaboratorySourceDescriptor | null;
  progress: LaboratoryProgressEvent | null;
  history: LaboratoryHistoryEntrySummary[];
  projects: LaboratoryProjectSummary[];
  pendingSourceJobId: string | null;
  activeEntryId: string | null;
  activeEntry: LaboratoryHistoryEntryRecord | null;
  activeProjectId: string | null;
  activeProject: LaboratoryProjectRecord | null;
  error: string;
}

export interface LaboratorySourceResolveInput {
  kind: "local-file" | "direct-url" | "youtube-url";
  filePath?: string;
  url?: string;
  label?: string;
  projectId?: string;
  reportLocale?: LaboratoryReportLocale;
  workflowSettings?: LaboratoryWorkflowSettings;
}

export interface LaboratoryAnalysisRequest {
  source: LaboratorySourceDescriptor;
  mode: LaboratoryAnalysisMode;
  reportLocale?: LaboratoryReportLocale;
  workflowSettings?: LaboratoryWorkflowSettings;
  selection: {
    timeRange: LaboratoryTimeRangeSelection | null;
    region: LaboratoryRegionSelection | null;
  };
}

export interface LaboratoryJobSnapshot {
  jobId: string;
  projectId: string;
  workspaceId: string;
  status: LaboratoryJobStatus;
  progress: LaboratoryProgressEvent | null;
  result: LaboratoryHistoryEntryRecord | null;
  error: string;
}

export interface LaboratorySourcePreparationSnapshot {
  jobId: string;
  projectId: string;
  workspaceId: string;
  status: LaboratoryJobStatus;
  progress: LaboratoryProgressEvent | null;
  source: LaboratorySourceDescriptor | null;
  error: string;
}
