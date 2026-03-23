import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type {
  LaboratoryAnalysisMode,
  LaboratoryAnalyzerReport,
  LaboratoryAnalyzerStatus,
  LaboratoryDownloadPreset,
  LaboratoryEvidenceItem,
  LaboratoryHistoryEntryRecord,
  LaboratoryHistoryEntrySummary,
  LaboratoryMediaProbe,
  LaboratoryMetricItem,
  LaboratoryProjectRecord,
  LaboratoryProjectStatus,
  LaboratoryProjectSummary,
  LaboratoryPreviewPolicy,
  LaboratoryReportLocale,
  LaboratoryRiskLevel,
  LaboratoryAnalysisFocus,
  LaboratorySourceDescriptor,
  LaboratorySourceKind,
  LaboratoryTechnicalReport,
  LaboratoryTechnicalSection,
  LaboratoryTimeRangeSelection,
  LaboratoryRegionSelection,
  LaboratoryUserReport,
  LaboratoryWorkflowSettings,
  LaboratoryWorkspaceCacheState,
} from "@shared/index.js";
import { Paths } from "../paths.ts";

const ROOM_ID = "laboratory";
const WORKSPACES_DIR = "workspaces";
const PROJECTS_DIR = "projects";
const HISTORY_INDEX_FILE = "history-index.json";
const PROJECT_INDEX_FILE = "project-index.json";
const DEFAULT_REPORT_LOCALE: LaboratoryReportLocale = "en";

interface SaveLaboratoryHistoryEntryInput {
  source: LaboratorySourceDescriptor;
  selection: LaboratoryTechnicalReport["selection"];
  userReport: LaboratoryUserReport;
  technicalReport: LaboratoryTechnicalReport;
}

interface PersistLaboratorySourceOptions {
  reportLocale?: LaboratoryReportLocale;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeReportLocale(value: unknown): LaboratoryReportLocale {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function normalizeProjectStatus(value: unknown): LaboratoryProjectStatus {
  if (value === "completed" || value === "ready") {
    return value;
  }
  return "draft";
}

function normalizeSourceKind(value: unknown): LaboratorySourceKind {
  if (value === "direct-url" || value === "youtube-url") {
    return value;
  }
  return "local-file";
}

function normalizeOptionalSourceKind(value: unknown): LaboratorySourceKind | null {
  return value === "local-file" || value === "direct-url" || value === "youtube-url" ? value : null;
}

function normalizeAnalysisMode(value: unknown): LaboratoryAnalysisMode {
  if (value === "fast" || value === "deep") {
    return value;
  }
  return "balanced";
}

function normalizeRiskLevel(value: unknown): LaboratoryRiskLevel {
  if (value === "high" || value === "medium") {
    return value;
  }
  return "low";
}

function normalizeAnalyzerStatus(value: unknown): LaboratoryAnalyzerStatus {
  if (
    value === "ok" ||
    value === "not-run" ||
    value === "unsupported" ||
    value === "no-audio" ||
    value === "error"
  ) {
    return value;
  }
  return "not-run";
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
}

function normalizeMetricItems(value: unknown): LaboratoryMetricItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const label = asNonEmptyString(item["label"]);
      const metricValue = asNonEmptyString(item["value"]);
      if (label === null || metricValue === null) {
        return null;
      }
      return {
        label,
        value: metricValue,
      };
    })
    .filter((item): item is LaboratoryMetricItem => item !== null);
}

function normalizeEvidenceItems(value: unknown): LaboratoryEvidenceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const id = asNonEmptyString(item["id"]);
      const title = asNonEmptyString(item["title"]);
      const summary = asNonEmptyString(item["summary"]);
      if (id === null || title === null || summary === null) {
        return null;
      }

      return {
        id,
        title,
        summary,
        score: asNumber(item["score"]),
        ...(typeof item["timestampStartSec"] === "number"
          ? { timestampStartSec: item["timestampStartSec"] }
          : {}),
        ...(typeof item["timestampEndSec"] === "number"
          ? { timestampEndSec: item["timestampEndSec"] }
          : {}),
      };
    })
    .filter((item): item is LaboratoryEvidenceItem => item !== null);
}

function normalizeAnalyzerReport(value: unknown): LaboratoryAnalyzerReport {
  const raw = isRecord(value) ? value : {};

  return {
    status: normalizeAnalyzerStatus(raw["status"]),
    score: asNumber(raw["score"]),
    summary: asNonEmptyString(raw["summary"]) ?? "",
    findings: normalizeStringArray(raw["findings"]),
    metrics: normalizeMetricItems(raw["metrics"]),
    evidence: normalizeEvidenceItems(raw["evidence"]),
    details: isRecord(raw["details"]) ? raw["details"] : {},
  };
}

function normalizeSelection(value: unknown): {
  timeRange: LaboratoryTimeRangeSelection | null;
  region: LaboratoryRegionSelection | null;
} {
  const raw = isRecord(value) ? value : {};
  const timeRangeRaw = isRecord(raw["timeRange"]) ? raw["timeRange"] : null;
  const regionRaw = isRecord(raw["region"]) ? raw["region"] : null;

  return {
    timeRange:
      timeRangeRaw === null
        ? null
        : {
            startSec: asNumber(timeRangeRaw["startSec"]),
            endSec: asNumber(timeRangeRaw["endSec"]),
          },
    region:
      regionRaw === null
        ? null
        : {
            xPct: asNumber(regionRaw["xPct"]),
            yPct: asNumber(regionRaw["yPct"]),
            widthPct: asNumber(regionRaw["widthPct"]),
            heightPct: asNumber(regionRaw["heightPct"]),
          },
  };
}

function normalizeDownloadPreset(value: unknown): LaboratoryDownloadPreset {
  if (value === "best" || value === "fast") {
    return value;
  }
  return "balanced";
}

function normalizePreviewPolicy(value: unknown): LaboratoryPreviewPolicy {
  return value === "dense" ? "dense" : "smart";
}

function normalizeAnalysisFocus(value: unknown): LaboratoryAnalysisFocus {
  const raw = isRecord(value) ? value : {};
  return {
    visual: typeof raw["visual"] === "boolean" ? raw["visual"] : true,
    audio: typeof raw["audio"] === "boolean" ? raw["audio"] : true,
    image: typeof raw["image"] === "boolean" ? raw["image"] : true,
    motion: typeof raw["motion"] === "boolean" ? raw["motion"] : true,
  };
}

function normalizeWorkflowSettings(value: unknown): LaboratoryWorkflowSettings {
  const raw = isRecord(value) ? value : {};

  return {
    downloadPreset: normalizeDownloadPreset(raw["downloadPreset"]),
    previewPolicy: normalizePreviewPolicy(raw["previewPolicy"]),
    focus: normalizeAnalysisFocus(raw["focus"]),
  };
}

function normalizeWorkspaceCacheState(
  value: unknown,
  fallback: Partial<LaboratoryWorkspaceCacheState> = {}
): LaboratoryWorkspaceCacheState {
  const raw = isRecord(value) ? value : {};

  return {
    sourcePresent:
      typeof raw["sourcePresent"] === "boolean"
        ? raw["sourcePresent"]
        : (fallback.sourcePresent ?? false),
    previewPresent:
      typeof raw["previewPresent"] === "boolean"
        ? raw["previewPresent"]
        : (fallback.previewPresent ?? false),
    derivedMediaPresent:
      typeof raw["derivedMediaPresent"] === "boolean"
        ? raw["derivedMediaPresent"]
        : (fallback.derivedMediaPresent ?? false),
    cleanedAt: asOptionalString(raw["cleanedAt"]) ?? fallback.cleanedAt ?? null,
  };
}

function buildDefaultProbe(): LaboratoryMediaProbe {
  return {
    durationSec: 0,
    width: 0,
    height: 0,
    fps: 0,
    avgFrameRateRaw: "0/0",
    realFrameRateRaw: "0/0",
    frameCount: null,
    bitrate: null,
    container: "",
    formatName: "",
    videoCodec: "",
    audioCodec: null,
    encoder: null,
    hasVideo: true,
    hasAudio: false,
  };
}

function normalizeSourceDescriptor(value: unknown): LaboratorySourceDescriptor | null {
  const raw = isRecord(value) ? value : null;
  const workspaceId = raw ? asNonEmptyString(raw["workspaceId"]) : null;
  if (workspaceId === null) {
    return null;
  }

  const probeRaw = raw && isRecord(raw["probe"]) ? raw["probe"] : {};
  const previewPath = raw ? asOptionalString(raw["previewPath"]) : null;
  const projectId = raw ? (asNonEmptyString(raw["projectId"]) ?? workspaceId) : workspaceId;

  return {
    projectId,
    workspaceId,
    workspaceDir: raw
      ? (asNonEmptyString(raw["workspaceDir"]) ?? getLaboratoryWorkspaceDir(workspaceId))
      : getLaboratoryWorkspaceDir(workspaceId),
    kind: raw ? normalizeSourceKind(raw["kind"]) : "local-file",
    label: raw ? (asNonEmptyString(raw["label"]) ?? workspaceId) : workspaceId,
    originalInput: raw ? (asNonEmptyString(raw["originalInput"]) ?? "") : "",
    originalFileName: raw ? (asNonEmptyString(raw["originalFileName"]) ?? "") : "",
    workingSourcePath: raw ? (asNonEmptyString(raw["workingSourcePath"]) ?? "") : "",
    previewPath,
    createdAt: raw
      ? (asNonEmptyString(raw["createdAt"]) ?? new Date().toISOString())
      : new Date().toISOString(),
    sizeBytes: raw ? asNumber(raw["sizeBytes"]) : 0,
    probe: {
      ...buildDefaultProbe(),
      durationSec: asNumber(probeRaw["durationSec"]),
      width: asNumber(probeRaw["width"]),
      height: asNumber(probeRaw["height"]),
      fps: asNumber(probeRaw["fps"]),
      avgFrameRateRaw: asNonEmptyString(probeRaw["avgFrameRateRaw"]) ?? "0/0",
      realFrameRateRaw: asNonEmptyString(probeRaw["realFrameRateRaw"]) ?? "0/0",
      frameCount: typeof probeRaw["frameCount"] === "number" ? probeRaw["frameCount"] : null,
      bitrate: typeof probeRaw["bitrate"] === "number" ? probeRaw["bitrate"] : null,
      container: asNonEmptyString(probeRaw["container"]) ?? "",
      formatName: asNonEmptyString(probeRaw["formatName"]) ?? "",
      videoCodec: asNonEmptyString(probeRaw["videoCodec"]) ?? "",
      audioCodec: asOptionalString(probeRaw["audioCodec"]),
      encoder: asOptionalString(probeRaw["encoder"]),
      hasVideo: typeof probeRaw["hasVideo"] === "boolean" ? probeRaw["hasVideo"] : true,
      hasAudio: typeof probeRaw["hasAudio"] === "boolean" ? probeRaw["hasAudio"] : false,
    },
    workflowSettings: normalizeWorkflowSettings(raw ? raw["workflowSettings"] : null),
    cacheState: normalizeWorkspaceCacheState(raw ? raw["cacheState"] : null, {
      sourcePresent: true,
      previewPresent: previewPath !== null,
      derivedMediaPresent: previewPath !== null,
      cleanedAt: null,
    }),
  };
}

function buildDefaultSection(
  id: LaboratoryTechnicalSection["id"],
  title: string,
  report: LaboratoryAnalyzerReport
): LaboratoryTechnicalSection {
  return {
    id,
    title,
    status: report.status,
    score: report.score,
    summary: report.summary,
    findings: report.findings.slice(),
    metrics: report.metrics.slice(),
    evidence: report.evidence.slice(),
  };
}

function normalizeTechnicalSections(
  value: unknown,
  reports: {
    metadata: LaboratoryAnalyzerReport;
    motion: LaboratoryAnalyzerReport;
    visual: LaboratoryAnalyzerReport;
    audio: LaboratoryAnalyzerReport;
  }
): LaboratoryTechnicalSection[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      buildDefaultSection("metadata", "Metadata Analysis", reports.metadata),
      buildDefaultSection("motion", "Motion Analysis", reports.motion),
      buildDefaultSection("visual", "Visual Analysis", reports.visual),
      buildDefaultSection("audio", "Audio Analysis", reports.audio),
    ];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const id = item["id"];
      if (id !== "metadata" && id !== "motion" && id !== "visual" && id !== "audio") {
        return null;
      }

      return {
        id,
        title: asNonEmptyString(item["title"]) ?? `${id} analysis`,
        status: normalizeAnalyzerStatus(item["status"]),
        score: asNumber(item["score"]),
        summary: asNonEmptyString(item["summary"]) ?? "",
        findings: normalizeStringArray(item["findings"]),
        metrics: normalizeMetricItems(item["metrics"]),
        evidence: normalizeEvidenceItems(item["evidence"]),
      };
    })
    .filter((item): item is LaboratoryTechnicalSection => item !== null);
}

function normalizeUserReport(
  value: unknown,
  fallbackLocale: LaboratoryReportLocale,
  fallbackRiskLevel: LaboratoryRiskLevel
): LaboratoryUserReport {
  const raw = isRecord(value) ? value : {};

  return {
    reportLocale: normalizeReportLocale(raw["reportLocale"] ?? fallbackLocale),
    riskLevel: normalizeRiskLevel(raw["riskLevel"] ?? fallbackRiskLevel),
    headline: asNonEmptyString(raw["headline"]) ?? "",
    summary: asNonEmptyString(raw["summary"]) ?? "",
    highlights: normalizeStringArray(raw["highlights"]),
    caveats: normalizeStringArray(raw["caveats"]),
  };
}

function normalizeTechnicalReport(
  value: unknown,
  source: LaboratorySourceDescriptor,
  fallbackSelection: ReturnType<typeof normalizeSelection>
): LaboratoryTechnicalReport {
  const raw = isRecord(value) ? value : {};
  const metadata = normalizeAnalyzerReport(raw["metadata"]);
  const motion = normalizeAnalyzerReport(raw["motion"]);
  const visual = normalizeAnalyzerReport(raw["visual"]);
  const audio = normalizeAnalyzerReport(raw["audio"]);
  const reportLocale = normalizeReportLocale(raw["reportLocale"]);
  const workspaceId = asNonEmptyString(raw["workspaceId"]) ?? source.workspaceId;

  return {
    ...(raw as Partial<LaboratoryTechnicalReport>),
    schemaVersion: raw["schemaVersion"] === 3 ? 3 : raw["schemaVersion"] === 2 ? 2 : 1,
    projectId: asNonEmptyString(raw["projectId"]) ?? source.projectId,
    entryId: asNonEmptyString(raw["entryId"]) ?? workspaceId,
    workspaceId,
    createdAt: asNonEmptyString(raw["createdAt"]) ?? source.createdAt,
    overallScore: asNumber(raw["overallScore"]),
    riskLevel: normalizeRiskLevel(raw["riskLevel"]),
    interpretation: asNonEmptyString(raw["interpretation"]) ?? "",
    mode: normalizeAnalysisMode(raw["mode"]),
    reportLocale,
    source,
    workflowSettings: normalizeWorkflowSettings(raw["workflowSettings"] ?? source.workflowSettings),
    selection: normalizeSelection(raw["selection"] ?? fallbackSelection),
    metadata,
    motion,
    visual,
    audio,
    sections: normalizeTechnicalSections(raw["sections"], {
      metadata,
      motion,
      visual,
      audio,
    }),
  };
}

function normalizeHistoryEntrySummary(
  value: unknown,
  fallback: {
    projectId: string;
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
): LaboratoryHistoryEntrySummary {
  const raw = isRecord(value) ? value : {};
  const workspaceId = asNonEmptyString(raw["workspaceId"]) ?? fallback.workspaceId;

  return {
    projectId: asNonEmptyString(raw["projectId"]) ?? fallback.projectId,
    entryId: asNonEmptyString(raw["entryId"]) ?? workspaceId,
    revisionId: asNonEmptyString(raw["revisionId"]),
    workspaceId,
    reportLocale: normalizeReportLocale(raw["reportLocale"] ?? fallback.reportLocale),
    createdAt: asNonEmptyString(raw["createdAt"]) ?? fallback.createdAt,
    updatedAt: asNonEmptyString(raw["updatedAt"]) ?? fallback.updatedAt,
    sourceLabel: asNonEmptyString(raw["sourceLabel"]) ?? fallback.sourceLabel,
    sourceKind: normalizeSourceKind(raw["sourceKind"] ?? fallback.sourceKind),
    mode: normalizeAnalysisMode(raw["mode"] ?? fallback.mode),
    overallScore: asNumber(raw["overallScore"], fallback.overallScore),
    riskLevel: normalizeRiskLevel(raw["riskLevel"] ?? fallback.riskLevel),
    previewPath: asOptionalString(raw["previewPath"]) ?? fallback.previewPath,
    durationSec: asNumber(raw["durationSec"], fallback.durationSec),
    cacheState: normalizeWorkspaceCacheState(raw["cacheState"], fallback.cacheState),
  };
}

function normalizeProjectSummary(value: unknown): LaboratoryProjectSummary | null {
  const raw = isRecord(value) ? value : null;
  if (raw === null) {
    return null;
  }
  const projectId = asNonEmptyString(raw["projectId"]);
  const workspaceId = asNonEmptyString(raw["workspaceId"]);
  if (projectId === null || workspaceId === null) {
    return null;
  }

  return {
    schemaVersion: 1,
    projectId,
    workspaceId,
    createdAt: asNonEmptyString(raw["createdAt"]) ?? new Date().toISOString(),
    updatedAt: asNonEmptyString(raw["updatedAt"]) ?? new Date().toISOString(),
    lastOpenedAt: asOptionalString(raw["lastOpenedAt"]),
    sourceLabel: asNonEmptyString(raw["sourceLabel"]) ?? projectId,
    sourceKind: normalizeOptionalSourceKind(raw["sourceKind"]),
    reportLocale: normalizeReportLocale(raw["reportLocale"]),
    status: normalizeProjectStatus(raw["status"]),
    latestEntryId: asNonEmptyString(raw["latestEntryId"]),
    latestRevisionId: asNonEmptyString(raw["latestRevisionId"]),
    latestOverallScore:
      typeof raw["latestOverallScore"] === "number" ? raw["latestOverallScore"] : null,
    latestRiskLevel:
      raw["latestRiskLevel"] === "low" ||
      raw["latestRiskLevel"] === "medium" ||
      raw["latestRiskLevel"] === "high"
        ? raw["latestRiskLevel"]
        : null,
    previewPath: asOptionalString(raw["previewPath"]),
    durationSec: typeof raw["durationSec"] === "number" ? raw["durationSec"] : null,
    cacheState:
      raw["cacheState"] === null || raw["cacheState"] === undefined
        ? null
        : normalizeWorkspaceCacheState(raw["cacheState"]),
  };
}

function normalizeHistoryEntryRecord(value: unknown): LaboratoryHistoryEntryRecord | null {
  const raw = isRecord(value) ? value : null;
  const source = normalizeSourceDescriptor(raw?.["source"]);
  if (raw === null || source === null) {
    return null;
  }

  const selection = normalizeSelection(raw["selection"]);
  const technicalReport = normalizeTechnicalReport(raw["technicalReport"], source, selection);
  const userReport = normalizeUserReport(
    raw["userReport"],
    technicalReport.reportLocale,
    technicalReport.riskLevel
  );
  const summary = normalizeHistoryEntrySummary(raw["summary"], {
    projectId: technicalReport.projectId,
    workspaceId: technicalReport.workspaceId,
    reportLocale: technicalReport.reportLocale,
    createdAt: technicalReport.createdAt,
    updatedAt: technicalReport.createdAt,
    sourceLabel: source.label,
    sourceKind: source.kind,
    mode: technicalReport.mode,
    overallScore: technicalReport.overallScore,
    riskLevel: technicalReport.riskLevel,
    previewPath: source.previewPath,
    durationSec: source.probe.durationSec,
    cacheState: source.cacheState,
  });

  return {
    summary,
    source,
    selection,
    userReport,
    technicalReport,
    userReportPath:
      asNonEmptyString(raw["userReportPath"]) ?? getWorkspaceUserReportPath(summary.workspaceId),
    technicalReportPath:
      asNonEmptyString(raw["technicalReportPath"]) ??
      getWorkspaceTechnicalReportPath(summary.workspaceId),
  };
}

function normalizeProjectRecord(value: unknown): LaboratoryProjectRecord | null {
  const raw = isRecord(value) ? value : null;
  const summary = normalizeProjectSummary(raw?.["summary"]);
  if (raw === null || summary === null) {
    return null;
  }

  const source = normalizeSourceDescriptor(raw["source"]);
  const latestEntry = normalizeHistoryEntryRecord(raw["latestEntry"]);
  const entries = Array.isArray(raw["entries"])
    ? raw["entries"]
        .map((item) =>
          normalizeHistoryEntrySummary(item, {
            projectId: summary.projectId,
            workspaceId: summary.workspaceId,
            reportLocale: summary.reportLocale,
            createdAt: summary.createdAt,
            updatedAt: summary.updatedAt,
            sourceLabel: summary.sourceLabel,
            sourceKind: summary.sourceKind ?? "local-file",
            mode: "balanced",
            overallScore: summary.latestOverallScore ?? 0,
            riskLevel: summary.latestRiskLevel ?? "low",
            previewPath: summary.previewPath,
            durationSec: summary.durationSec ?? 0,
            cacheState:
              summary.cacheState ??
              normalizeWorkspaceCacheState(null, {
                sourcePresent: false,
                previewPresent: false,
                derivedMediaPresent: false,
                cleanedAt: null,
              }),
          })
        )
        .filter(Boolean)
    : latestEntry
      ? [latestEntry.summary]
      : [];

  return {
    schemaVersion: 1,
    summary,
    source,
    latestEntry,
    entries: sortHistory(entries),
  };
}

function getLegacyLaboratoryRootDir(): string {
  return Paths.getRoomStorageDir(ROOM_ID);
}

function getLaboratoryRootDir(): string {
  return Paths.getInstalledRoomDir(ROOM_ID);
}

function getLaboratoryWorkspacesDir(): string {
  return join(getLaboratoryRootDir(), WORKSPACES_DIR);
}

function getLaboratoryProjectsDir(): string {
  return join(getLaboratoryRootDir(), PROJECTS_DIR);
}

function getLaboratoryHistoryIndexPath(): string {
  return join(getLaboratoryRootDir(), HISTORY_INDEX_FILE);
}

function getLaboratoryProjectIndexPath(): string {
  return join(getLaboratoryRootDir(), PROJECT_INDEX_FILE);
}

export function getLaboratoryWorkspaceDir(workspaceId: string): string {
  return join(getLaboratoryWorkspacesDir(), workspaceId);
}

function getLaboratoryProjectDir(projectId: string): string {
  return join(getLaboratoryProjectsDir(), projectId);
}

function getWorkspaceReportsDir(workspaceId: string): string {
  return join(getLaboratoryWorkspaceDir(workspaceId), "reports");
}

function getWorkspaceSourceDir(workspaceId: string): string {
  return join(getLaboratoryWorkspaceDir(workspaceId), "source");
}

function getWorkspacePreviewDir(workspaceId: string): string {
  return join(getLaboratoryWorkspaceDir(workspaceId), "preview");
}

function getWorkspaceDerivedDir(workspaceId: string): string {
  return join(getLaboratoryWorkspaceDir(workspaceId), "derived");
}

function getWorkspaceRecordPath(workspaceId: string): string {
  return join(getWorkspaceReportsDir(workspaceId), "record.json");
}

function getWorkspaceSourceRecordPath(workspaceId: string): string {
  return join(getWorkspaceReportsDir(workspaceId), "source.json");
}

function getWorkspaceUserReportPath(workspaceId: string): string {
  return join(getWorkspaceReportsDir(workspaceId), "user-report.json");
}

function getWorkspaceTechnicalReportPath(workspaceId: string): string {
  return join(getWorkspaceReportsDir(workspaceId), "technical-report.json");
}

function getProjectRecordPath(projectId: string): string {
  return join(getLaboratoryProjectDir(projectId), "project.json");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sortHistory(entries: LaboratoryHistoryEntrySummary[]): LaboratoryHistoryEntrySummary[] {
  return entries
    .slice()
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function sortProjectSummaries(entries: LaboratoryProjectSummary[]): LaboratoryProjectSummary[] {
  return entries
    .slice()
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function rewriteLegacyStoragePath(
  value: string,
  legacyRootDir: string,
  currentRootDir: string
): string {
  if (value === legacyRootDir) {
    return currentRootDir;
  }

  return value.startsWith(`${legacyRootDir}/`)
    ? `${currentRootDir}${value.slice(legacyRootDir.length)}`
    : value;
}

function rewriteLegacyStoragePaths(
  value: unknown,
  legacyRootDir: string,
  currentRootDir: string
): unknown {
  if (typeof value === "string") {
    return rewriteLegacyStoragePath(value, legacyRootDir, currentRootDir);
  }

  if (Array.isArray(value)) {
    return value.map((item) => rewriteLegacyStoragePaths(item, legacyRootDir, currentRootDir));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        rewriteLegacyStoragePaths(nestedValue, legacyRootDir, currentRootDir),
      ])
    );
  }

  return value;
}

async function rewriteJsonFilePaths(
  filePath: string,
  legacyRootDir: string,
  currentRootDir: string
): Promise<void> {
  if (!(await pathExists(filePath))) {
    return;
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const rewritten = rewriteLegacyStoragePaths(parsed, legacyRootDir, currentRootDir);
  await writeJsonFile(filePath, rewritten);
}

async function listJsonFiles(directoryPath: string): Promise<string[]> {
  if (!(await pathExists(directoryPath))) {
    return [];
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return await listJsonFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    })
  );

  return nestedFiles.flat();
}

async function migrateLegacyLaboratoryStorage(): Promise<void> {
  const legacyRootDir = getLegacyLaboratoryRootDir();
  const currentRootDir = getLaboratoryRootDir();
  if (legacyRootDir === currentRootDir || !(await pathExists(legacyRootDir))) {
    return;
  }

  const legacyHistoryIndexPath = join(legacyRootDir, HISTORY_INDEX_FILE);
  const legacyWorkspacesDir = join(legacyRootDir, WORKSPACES_DIR);
  const currentHistoryIndexPath = getLaboratoryHistoryIndexPath();
  const currentWorkspacesDir = getLaboratoryWorkspacesDir();

  await mkdir(currentRootDir, { recursive: true });

  if ((await pathExists(legacyHistoryIndexPath)) && !(await pathExists(currentHistoryIndexPath))) {
    await rename(legacyHistoryIndexPath, currentHistoryIndexPath);
  }

  if ((await pathExists(legacyWorkspacesDir)) && !(await pathExists(currentWorkspacesDir))) {
    await rename(legacyWorkspacesDir, currentWorkspacesDir);
  }

  await rewriteJsonFilePaths(currentHistoryIndexPath, legacyRootDir, currentRootDir);
  const workspaceJsonFiles = await listJsonFiles(currentWorkspacesDir);
  await Promise.all(
    workspaceJsonFiles.map(async (filePath) => {
      await rewriteJsonFilePaths(filePath, legacyRootDir, currentRootDir);
    })
  );

  const remainingLegacyEntries = await readdir(legacyRootDir).catch(() => []);
  if (remainingLegacyEntries.length === 0) {
    await rm(legacyRootDir, { recursive: true, force: true });
  }
}

async function ensureLaboratoryStorage(): Promise<void> {
  await migrateLegacyLaboratoryStorage();
  await mkdir(getLaboratoryRootDir(), { recursive: true });
  await mkdir(getLaboratoryWorkspacesDir(), { recursive: true });
  await mkdir(getLaboratoryProjectsDir(), { recursive: true });
}

async function readHistoryIndex(): Promise<LaboratoryHistoryEntrySummary[]> {
  await ensureLaboratoryStorage();
  const entries = await readJsonFile<unknown[]>(getLaboratoryHistoryIndexPath(), []);

  return sortHistory(
    Array.isArray(entries)
      ? entries.map((item) =>
          normalizeHistoryEntrySummary(item, {
            projectId:
              asNonEmptyString(isRecord(item) ? item["projectId"] : null) ??
              asNonEmptyString(isRecord(item) ? item["workspaceId"] : null) ??
              "",
            workspaceId: asNonEmptyString(isRecord(item) ? item["workspaceId"] : null) ?? "",
            reportLocale: normalizeReportLocale(isRecord(item) ? item["reportLocale"] : null),
            createdAt:
              asNonEmptyString(isRecord(item) ? item["createdAt"] : null) ??
              new Date().toISOString(),
            updatedAt:
              asNonEmptyString(isRecord(item) ? item["updatedAt"] : null) ??
              new Date().toISOString(),
            sourceLabel: asNonEmptyString(isRecord(item) ? item["sourceLabel"] : null) ?? "",
            sourceKind: normalizeSourceKind(isRecord(item) ? item["sourceKind"] : null),
            mode: normalizeAnalysisMode(isRecord(item) ? item["mode"] : null),
            overallScore: asNumber(isRecord(item) ? item["overallScore"] : null),
            riskLevel: normalizeRiskLevel(isRecord(item) ? item["riskLevel"] : null),
            previewPath: asOptionalString(isRecord(item) ? item["previewPath"] : null),
            durationSec: asNumber(isRecord(item) ? item["durationSec"] : null),
            cacheState: normalizeWorkspaceCacheState(isRecord(item) ? item["cacheState"] : null),
          })
        )
      : []
  );
}

async function writeHistoryIndex(entries: LaboratoryHistoryEntrySummary[]): Promise<void> {
  await ensureLaboratoryStorage();
  await writeJsonFile(getLaboratoryHistoryIndexPath(), sortHistory(entries));
}

function buildProjectSummaryFromEntry(
  entry: LaboratoryHistoryEntrySummary
): LaboratoryProjectSummary {
  return {
    schemaVersion: 1,
    projectId: entry.projectId,
    workspaceId: entry.workspaceId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lastOpenedAt: null,
    sourceLabel: entry.sourceLabel,
    sourceKind: entry.sourceKind,
    reportLocale: entry.reportLocale,
    status: "completed",
    latestEntryId: entry.entryId,
    latestRevisionId: entry.revisionId,
    latestOverallScore: entry.overallScore,
    latestRiskLevel: entry.riskLevel,
    previewPath: entry.previewPath,
    durationSec: entry.durationSec,
    cacheState: { ...entry.cacheState },
  };
}

async function readProjectIndex(): Promise<LaboratoryProjectSummary[]> {
  await ensureLaboratoryStorage();
  const projectIndexPath = getLaboratoryProjectIndexPath();
  const indexExists = await pathExists(projectIndexPath);
  const entries = await readJsonFile<unknown[]>(projectIndexPath, []);
  const normalized = Array.isArray(entries)
    ? entries
        .map((item) => normalizeProjectSummary(item))
        .filter((item): item is LaboratoryProjectSummary => item !== null)
    : [];

  if (normalized.length > 0 || indexExists) {
    return sortProjectSummaries(normalized);
  }

  const historyEntries = await readHistoryIndex();
  const derived = sortProjectSummaries(
    Array.from(
      new Map(
        historyEntries.map((entry) => [entry.projectId, buildProjectSummaryFromEntry(entry)])
      ).values()
    )
  );
  if (derived.length > 0) {
    await writeProjectIndex(derived);
  }
  return derived;
}

async function writeProjectIndex(entries: LaboratoryProjectSummary[]): Promise<void> {
  await ensureLaboratoryStorage();
  await writeJsonFile(getLaboratoryProjectIndexPath(), sortProjectSummaries(entries));
}

async function writeProjectRecord(record: LaboratoryProjectRecord): Promise<void> {
  await writeJsonFile(getProjectRecordPath(record.summary.projectId), record);
}

function buildProjectSummaryFromSource(
  source: LaboratorySourceDescriptor,
  existing: LaboratoryProjectRecord | null,
  reportLocale: LaboratoryReportLocale
): LaboratoryProjectSummary {
  return {
    schemaVersion: 1,
    projectId: source.projectId,
    workspaceId: source.workspaceId,
    createdAt: existing?.summary.createdAt ?? source.createdAt,
    updatedAt: source.createdAt,
    lastOpenedAt: existing?.summary.lastOpenedAt ?? null,
    sourceLabel: source.label,
    sourceKind: source.kind,
    reportLocale,
    status: existing?.summary.status === "completed" ? "completed" : "ready",
    latestEntryId: existing?.summary.latestEntryId ?? null,
    latestRevisionId: existing?.summary.latestRevisionId ?? null,
    latestOverallScore: existing?.summary.latestOverallScore ?? null,
    latestRiskLevel: existing?.summary.latestRiskLevel ?? null,
    previewPath: source.previewPath,
    durationSec: source.probe.durationSec,
    cacheState: { ...source.cacheState },
  };
}

function buildProjectRecordFromEntry(
  entry: LaboratoryHistoryEntryRecord,
  existing: LaboratoryProjectRecord | null
): LaboratoryProjectRecord {
  const priorEntries = existing?.entries ?? [];
  const nextEntries = sortHistory([
    ...priorEntries.filter((item) => item.entryId !== entry.summary.entryId),
    entry.summary,
  ]);

  return {
    schemaVersion: 1,
    summary: {
      schemaVersion: 1,
      projectId: entry.summary.projectId,
      workspaceId: entry.summary.workspaceId,
      createdAt: existing?.summary.createdAt ?? entry.summary.createdAt,
      updatedAt: entry.summary.updatedAt,
      lastOpenedAt: existing?.summary.lastOpenedAt ?? null,
      sourceLabel: entry.summary.sourceLabel,
      sourceKind: entry.summary.sourceKind,
      reportLocale: entry.summary.reportLocale,
      status: "completed",
      latestEntryId: entry.summary.entryId,
      latestRevisionId: entry.summary.revisionId,
      latestOverallScore: entry.summary.overallScore,
      latestRiskLevel: entry.summary.riskLevel,
      previewPath: entry.summary.previewPath,
      durationSec: entry.summary.durationSec,
      cacheState: { ...entry.summary.cacheState },
    },
    source: entry.source,
    latestEntry: entry,
    entries: nextEntries,
  };
}

export async function ensureLaboratoryWorkspaceDirs(workspaceId: string): Promise<void> {
  await mkdir(getWorkspaceSourceDir(workspaceId), { recursive: true });
  await mkdir(getWorkspacePreviewDir(workspaceId), { recursive: true });
  await mkdir(getWorkspaceDerivedDir(workspaceId), { recursive: true });
  await mkdir(getWorkspaceReportsDir(workspaceId), { recursive: true });
}

export async function persistLaboratoryResolvedSource(
  source: LaboratorySourceDescriptor,
  options: PersistLaboratorySourceOptions = {}
): Promise<void> {
  await ensureLaboratoryWorkspaceDirs(source.workspaceId);
  await writeJsonFile(getWorkspaceSourceRecordPath(source.workspaceId), source);

  const reportLocale = options.reportLocale ?? DEFAULT_REPORT_LOCALE;
  const existing = await readLaboratoryProject(source.projectId);
  const nextRecord: LaboratoryProjectRecord = {
    schemaVersion: 1,
    summary: buildProjectSummaryFromSource(source, existing, reportLocale),
    source,
    latestEntry: existing?.latestEntry ?? null,
    entries: existing?.entries ?? [],
  };

  await writeProjectRecord(nextRecord);
  const existingIndex = await readProjectIndex();
  const nextIndex = existingIndex.filter((entry) => entry.projectId !== source.projectId);
  nextIndex.unshift(nextRecord.summary);
  await writeProjectIndex(nextIndex);
}

export async function listLaboratoryHistory(): Promise<LaboratoryHistoryEntrySummary[]> {
  return await readHistoryIndex();
}

export async function listLaboratoryProjects(): Promise<LaboratoryProjectSummary[]> {
  return await readProjectIndex();
}

export async function saveLaboratoryHistoryEntry(
  input: SaveLaboratoryHistoryEntryInput
): Promise<LaboratoryHistoryEntryRecord> {
  const workspaceId = input.source.workspaceId;
  await ensureLaboratoryWorkspaceDirs(workspaceId);

  const summary = normalizeHistoryEntrySummary(null, {
    projectId: input.source.projectId,
    workspaceId,
    reportLocale: input.technicalReport.reportLocale,
    createdAt: input.technicalReport.createdAt,
    updatedAt: input.technicalReport.createdAt,
    sourceLabel: input.source.label,
    sourceKind: input.source.kind,
    mode: input.technicalReport.mode,
    overallScore: input.technicalReport.overallScore,
    riskLevel: input.technicalReport.riskLevel,
    previewPath: input.source.previewPath,
    durationSec: input.source.probe.durationSec,
    cacheState: input.source.cacheState,
  });
  const record: LaboratoryHistoryEntryRecord = {
    summary,
    source: input.source,
    selection: input.selection,
    userReport: input.userReport,
    technicalReport: input.technicalReport,
    userReportPath: getWorkspaceUserReportPath(workspaceId),
    technicalReportPath: getWorkspaceTechnicalReportPath(workspaceId),
  };

  await writeJsonFile(getWorkspaceSourceRecordPath(workspaceId), input.source);
  await writeJsonFile(record.userReportPath, input.userReport);
  await writeJsonFile(record.technicalReportPath, input.technicalReport);
  await writeJsonFile(getWorkspaceRecordPath(workspaceId), record);

  const existingHistory = await readHistoryIndex();
  const nextHistory = existingHistory.filter((entry) => entry.entryId !== record.summary.entryId);
  nextHistory.unshift(record.summary);
  await writeHistoryIndex(nextHistory);

  const existingProject = await readLaboratoryProject(input.source.projectId);
  const nextProject = buildProjectRecordFromEntry(record, existingProject);
  await writeProjectRecord(nextProject);

  const existingProjectIndex = await readProjectIndex();
  const nextProjectIndex = existingProjectIndex.filter(
    (entry) => entry.projectId !== input.source.projectId
  );
  nextProjectIndex.unshift(nextProject.summary);
  await writeProjectIndex(nextProjectIndex);

  return record;
}

export async function readLaboratoryHistoryEntry(
  entryId: string
): Promise<LaboratoryHistoryEntryRecord | null> {
  const record = await readJsonFile<unknown>(getWorkspaceRecordPath(entryId), null);
  return normalizeHistoryEntryRecord(record);
}

export async function readLaboratoryProject(
  projectId: string
): Promise<LaboratoryProjectRecord | null> {
  const record = normalizeProjectRecord(
    await readJsonFile<unknown>(getProjectRecordPath(projectId), null)
  );
  if (record !== null) {
    return record;
  }

  const historyEntries = (await readHistoryIndex()).filter(
    (entry) => entry.projectId === projectId
  );
  if (historyEntries.length === 0) {
    return null;
  }
  const latestSummary = historyEntries[0];
  if (latestSummary === undefined) {
    return null;
  }

  const latestEntry = await readLaboratoryHistoryEntry(latestSummary.entryId);
  if (latestEntry === null) {
    return {
      schemaVersion: 1,
      summary: buildProjectSummaryFromEntry(latestSummary),
      source: null,
      latestEntry: null,
      entries: historyEntries,
    };
  }

  return buildProjectRecordFromEntry(latestEntry, {
    schemaVersion: 1,
    summary: buildProjectSummaryFromEntry(latestSummary),
    source: latestEntry.source,
    latestEntry,
    entries: historyEntries,
  });
}

export async function cleanupLaboratoryDerivedArtifacts(workspaceId: string): Promise<void> {
  await rm(getWorkspaceDerivedDir(workspaceId), { recursive: true, force: true });
  await mkdir(getWorkspaceDerivedDir(workspaceId), { recursive: true });
}

export async function cleanupLaboratoryWorkspaceMedia(
  entryId: string
): Promise<LaboratoryHistoryEntryRecord | null> {
  const record = await readLaboratoryHistoryEntry(entryId);
  if (record === null) {
    return null;
  }

  await rm(getWorkspaceSourceDir(entryId), { recursive: true, force: true });
  await rm(getWorkspacePreviewDir(entryId), { recursive: true, force: true });
  await rm(getWorkspaceDerivedDir(entryId), { recursive: true, force: true });

  await ensureLaboratoryWorkspaceDirs(entryId);

  const cleanedAt = new Date().toISOString();
  const cacheState = {
    sourcePresent: false,
    previewPresent: false,
    derivedMediaPresent: false,
    cleanedAt,
  };

  const nextRecord: LaboratoryHistoryEntryRecord = {
    ...record,
    summary: {
      ...record.summary,
      updatedAt: cleanedAt,
      previewPath: null,
      cacheState,
    },
    source: {
      ...record.source,
      previewPath: null,
      cacheState,
    },
  };

  await writeJsonFile(getWorkspaceSourceRecordPath(entryId), nextRecord.source);
  await writeJsonFile(getWorkspaceRecordPath(entryId), nextRecord);

  const existingHistory = await readHistoryIndex();
  const nextHistory = existingHistory.map((entry) =>
    entry.entryId === entryId ? nextRecord.summary : entry
  );
  await writeHistoryIndex(nextHistory);

  const projectRecord = await readLaboratoryProject(nextRecord.summary.projectId);
  if (projectRecord !== null) {
    const projectSource = projectRecord.source;
    const nextProject: LaboratoryProjectRecord = {
      ...projectRecord,
      summary: {
        ...projectRecord.summary,
        updatedAt: cleanedAt,
        previewPath: null,
        cacheState,
      },
      source:
        projectSource?.workspaceId === entryId
          ? {
              ...projectSource,
              previewPath: null,
              cacheState,
            }
          : projectSource,
      latestEntry:
        projectRecord.latestEntry?.summary.entryId === entryId
          ? nextRecord
          : projectRecord.latestEntry,
      entries: projectRecord.entries.map((entry) =>
        entry.entryId === entryId ? nextRecord.summary : entry
      ),
    };
    await writeProjectRecord(nextProject);

    const existingProjectIndex = await readProjectIndex();
    const nextProjectIndex = existingProjectIndex.map((entry) =>
      entry.projectId === nextProject.summary.projectId ? nextProject.summary : entry
    );
    await writeProjectIndex(nextProjectIndex);
  }

  return nextRecord;
}

export async function deleteLaboratoryProject(projectId: string): Promise<void> {
  const record = await readLaboratoryProject(projectId);
  if (record === null) {
    return;
  }

  const workspaceIds = Array.from(
    new Set([
      record.summary.workspaceId,
      ...(record.source ? [record.source.workspaceId] : []),
      ...record.entries.map((entry) => entry.workspaceId),
    ])
  );

  const existingHistory = await readHistoryIndex();
  await writeHistoryIndex(existingHistory.filter((entry) => entry.projectId !== projectId));

  const existingProjectIndex = await readProjectIndex();
  await writeProjectIndex(existingProjectIndex.filter((entry) => entry.projectId !== projectId));

  await rm(getLaboratoryProjectDir(projectId), { recursive: true, force: true });
  await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      await rm(getLaboratoryWorkspaceDir(workspaceId), { recursive: true, force: true });
    })
  );
}

export async function discardLaboratoryWorkspace(workspaceId: string): Promise<void> {
  const recordPath = getWorkspaceRecordPath(workspaceId);
  const hasHistoryRecord = await pathExists(recordPath);

  if (hasHistoryRecord) {
    return;
  }

  const projectIndex = await readProjectIndex();
  const hasProjectRecord = projectIndex.some((entry) => entry.workspaceId === workspaceId);
  if (hasProjectRecord) {
    return;
  }

  await rm(getLaboratoryWorkspaceDir(workspaceId), { recursive: true, force: true });
}
