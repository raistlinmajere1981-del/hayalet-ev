import { Worker } from "worker_threads";
import { randomUUID } from "crypto";
import type {
  LaboratoryAnalysisRequest,
  LaboratoryAnalyzerReport,
  LaboratoryJobSnapshot,
  LaboratoryProgressEvent,
} from "@shared/index.js";
import { cleanupLaboratoryDerivedArtifacts, saveLaboratoryHistoryEntry } from "./history-store.ts";
import { buildLaboratoryReports } from "./report-builder.ts";

interface ActiveLaboratoryJob {
  jobId: string;
  projectId: string;
  workspaceId: string;
  request: LaboratoryAnalysisRequest;
  status: LaboratoryJobSnapshot["status"];
  progress: LaboratoryProgressEvent | null;
  result: LaboratoryJobSnapshot["result"];
  error: string;
  worker: Worker | null;
  terminal: boolean;
}

interface WorkerProgressMessage {
  type: "progress";
  phase: LaboratoryProgressEvent["phase"];
  percent: number;
  summary: string;
  detail: string;
  currentAnalyzer?: string | null;
}

interface WorkerResultMessage {
  type: "result";
  analyzers: {
    metadata: LaboratoryAnalyzerReport;
    motion: LaboratoryAnalyzerReport;
    visual: LaboratoryAnalyzerReport;
    audio: LaboratoryAnalyzerReport;
  };
}

interface WorkerErrorMessage {
  type: "error";
  error: string;
}

type WorkerMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

const activeJobs = new Map<string, ActiveLaboratoryJob>();

function normalizePercent(value: number): number {
  if (Number.isFinite(value) === false) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createProgress(
  jobId: string,
  workspaceId: string,
  status: LaboratoryJobSnapshot["status"],
  phase: LaboratoryProgressEvent["phase"],
  percent: number,
  summary: string,
  detail: string,
  currentAnalyzer: string | null = null
): LaboratoryProgressEvent {
  const timestamp = new Date().toISOString();
  return {
    jobId,
    workspaceId,
    status,
    phase,
    percent: normalizePercent(percent),
    summary,
    detail,
    startedAt: timestamp,
    updatedAt: timestamp,
    currentAnalyzer,
  };
}

function cloneJobSnapshot(record: ActiveLaboratoryJob): LaboratoryJobSnapshot {
  return {
    jobId: record.jobId,
    projectId: record.projectId,
    workspaceId: record.workspaceId,
    status: record.status,
    progress: record.progress === null ? null : { ...record.progress },
    result: record.result,
    error: record.error,
  };
}

async function finalizeFailure(
  record: ActiveLaboratoryJob,
  status: "failed" | "cancelled",
  message: string
): Promise<void> {
  if (record.terminal) {
    return;
  }

  record.terminal = true;
  record.status = status;
  record.error = message;
  record.progress = record.progress
    ? {
        ...record.progress,
        status,
        percent:
          status === "cancelled" ? record.progress.percent : Math.max(record.progress.percent, 10),
        phase: status === "cancelled" ? "cleanup" : record.progress.phase,
        summary: status === "cancelled" ? "Analysis cancelled." : "Analysis failed.",
        detail: message,
        updatedAt: new Date().toISOString(),
      }
    : createProgress(
        record.jobId,
        record.workspaceId,
        status,
        status === "cancelled" ? "cleanup" : "idle",
        0,
        status === "cancelled" ? "Analysis cancelled." : "Analysis failed.",
        message
      );
  record.worker = null;
  await cleanupLaboratoryDerivedArtifacts(record.workspaceId);
}

async function handleWorkerMessage(
  record: ActiveLaboratoryJob,
  message: WorkerMessage
): Promise<void> {
  if (record.terminal) {
    return;
  }

  if (message.type === "progress") {
    record.status = "running";
    record.progress = {
      ...(record.progress ??
        createProgress(
          record.jobId,
          record.workspaceId,
          "running",
          message.phase,
          message.percent,
          message.summary,
          message.detail,
          message.currentAnalyzer ?? null
        )),
      status: "running",
      phase: message.phase,
      percent: normalizePercent(message.percent),
      summary: message.summary,
      detail: message.detail,
      currentAnalyzer: message.currentAnalyzer ?? null,
      updatedAt: new Date().toISOString(),
    };
    return;
  }

  if (message.type === "error") {
    await finalizeFailure(record, "failed", message.error);
    return;
  }

  const reportLocale = record.request.reportLocale;
  const workflowSettings = record.request.workflowSettings;
  const reports = buildLaboratoryReports({
    projectId: record.projectId,
    entryId: record.workspaceId,
    source: record.request.source,
    mode: record.request.mode,
    ...(reportLocale !== undefined ? { reportLocale } : {}),
    ...(workflowSettings !== undefined ? { workflowSettings } : {}),
    selection: record.request.selection,
    analyzers: message.analyzers,
  });
  const saved = await saveLaboratoryHistoryEntry({
    source: record.request.source,
    selection: record.request.selection,
    userReport: reports.userReport,
    technicalReport: reports.technicalReport,
  });

  record.result = saved;
  record.status = "completed";
  record.error = "";
  record.progress = {
    ...(record.progress ??
      createProgress(
        record.jobId,
        record.workspaceId,
        "completed",
        "complete",
        100,
        "Analysis complete.",
        "Reports were built and saved."
      )),
    status: "completed",
    phase: "complete",
    percent: 100,
    summary: "Analysis complete.",
    detail: "Reports were built and saved.",
    currentAnalyzer: null,
    updatedAt: new Date().toISOString(),
  };
  record.terminal = true;
  record.worker = null;
  await cleanupLaboratoryDerivedArtifacts(record.workspaceId);
}

export function getLaboratoryJobSnapshot(jobId: string): LaboratoryJobSnapshot | null {
  const record = activeJobs.get(jobId);
  return record ? cloneJobSnapshot(record) : null;
}

export function startLaboratoryAnalysis(request: LaboratoryAnalysisRequest): LaboratoryJobSnapshot {
  const jobId = randomUUID();
  const projectId = request.source.projectId;
  const workspaceId = request.source.workspaceId;
  const record: ActiveLaboratoryJob = {
    jobId,
    projectId,
    workspaceId,
    request,
    status: "running",
    progress: createProgress(
      jobId,
      workspaceId,
      "running",
      "frame-extraction",
      6,
      "Preparing analysis worker.",
      "Sampling profiles and analyzer contracts are being prepared."
    ),
    result: null,
    error: "",
    worker: null,
    terminal: false,
  };

  const worker = new Worker(new URL("./laboratory/analysis-worker.cjs", import.meta.url), {
    workerData: {
      jobId,
      workspaceId,
      sourcePath: request.source.workingSourcePath,
      workspaceDir: request.source.workspaceDir,
      mode: request.mode,
      selection: request.selection,
      probe: request.source.probe,
    },
  });

  record.worker = worker;
  activeJobs.set(jobId, record);

  worker.on("message", (message: WorkerMessage) => {
    void handleWorkerMessage(record, message);
  });
  worker.on("error", (error: unknown) => {
    void finalizeFailure(record, "failed", error instanceof Error ? error.message : String(error));
  });
  worker.on("exit", (code) => {
    if (record.terminal || code === 0) {
      return;
    }
    void finalizeFailure(record, "failed", `Analysis worker exited with code ${String(code)}.`);
  });

  return cloneJobSnapshot(record);
}

export async function cancelLaboratoryAnalysis(
  jobId: string
): Promise<LaboratoryJobSnapshot | null> {
  const record = activeJobs.get(jobId);
  if (record === undefined) {
    return null;
  }

  if (record.terminal || record.worker === null) {
    return cloneJobSnapshot(record);
  }

  try {
    record.worker.postMessage({ type: "cancel" });
  } catch {
    // Ignore postMessage failures during teardown.
  }

  await record.worker.terminate();
  await finalizeFailure(record, "cancelled", "The analysis job was cancelled by the user.");
  return cloneJobSnapshot(record);
}
