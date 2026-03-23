import { randomUUID } from "crypto";
import type {
  LaboratoryProgressEvent,
  LaboratorySourcePreparationSnapshot,
  LaboratorySourceResolveInput,
} from "@shared/index.js";
import { resolveLaboratorySource } from "./source-resolver.ts";

interface ActiveLaboratorySourceJob {
  jobId: string;
  projectId: string;
  workspaceId: string;
  input: LaboratorySourceResolveInput;
  status: LaboratorySourcePreparationSnapshot["status"];
  progress: LaboratoryProgressEvent | null;
  source: LaboratorySourcePreparationSnapshot["source"];
  error: string;
  controller: AbortController | null;
  terminal: boolean;
}

const activeSourceJobs = new Map<string, ActiveLaboratorySourceJob>();
const SOURCE_CANCELLED_ERROR = "LABORATORY_SOURCE_PREPARATION_CANCELLED";

function createWorkspaceId(): string {
  return `lab-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function normalizePercent(value: number): number {
  if (Number.isFinite(value) === false) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createProgress(
  jobId: string,
  workspaceId: string,
  status: LaboratorySourcePreparationSnapshot["status"],
  phase: LaboratoryProgressEvent["phase"],
  percent: number,
  summary: string,
  detail: string
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
    currentAnalyzer: null,
  };
}

function cloneSourceSnapshot(
  record: ActiveLaboratorySourceJob
): LaboratorySourcePreparationSnapshot {
  return {
    jobId: record.jobId,
    projectId: record.projectId,
    workspaceId: record.workspaceId,
    status: record.status,
    progress: record.progress === null ? null : { ...record.progress },
    source: record.source,
    error: record.error,
  };
}

function finalizeFailure(
  record: ActiveLaboratorySourceJob,
  status: "failed" | "cancelled",
  message: string
): void {
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
        phase: status === "cancelled" ? "cleanup" : record.progress.phase,
        summary:
          status === "cancelled" ? "Source preparation cancelled." : "Source preparation failed.",
        detail: message,
        updatedAt: new Date().toISOString(),
      }
    : createProgress(
        record.jobId,
        record.workspaceId,
        status,
        status === "cancelled" ? "cleanup" : "source-resolve",
        0,
        status === "cancelled" ? "Source preparation cancelled." : "Source preparation failed.",
        message
      );
  record.controller = null;
}

async function runSourcePreparation(record: ActiveLaboratorySourceJob): Promise<void> {
  try {
    const source = await resolveLaboratorySource(record.input, {
      workspaceId: record.workspaceId,
      ...(record.controller ? { signal: record.controller.signal } : {}),
      onProgress: (update) => {
        if (record.terminal) {
          return;
        }

        record.status = "resolving-source";
        record.progress = {
          ...(record.progress ??
            createProgress(
              record.jobId,
              record.workspaceId,
              "resolving-source",
              update.phase,
              update.percent,
              update.summary,
              update.detail
            )),
          status: "resolving-source",
          phase: update.phase,
          percent: normalizePercent(update.percent),
          summary: update.summary,
          detail: update.detail,
          updatedAt: new Date().toISOString(),
          currentAnalyzer: null,
        };
      },
    });

    if (record.terminal) {
      return;
    }

    record.source = source;
    record.status = "ready";
    record.error = "";
    record.progress = {
      ...(record.progress ??
        createProgress(
          record.jobId,
          record.workspaceId,
          "ready",
          "preview-prep",
          100,
          "Source ready.",
          "Preview and analysis controls are ready."
        )),
      status: "ready",
      phase: "preview-prep",
      percent: 100,
      summary: "Source ready.",
      detail: "Preview and analysis controls are ready.",
      updatedAt: new Date().toISOString(),
      currentAnalyzer: null,
    };
    record.controller = null;
    record.terminal = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finalizeFailure(
      record,
      message === SOURCE_CANCELLED_ERROR ? "cancelled" : "failed",
      message === SOURCE_CANCELLED_ERROR
        ? "The source preparation was cancelled by the user."
        : message
    );
  }
}

export function startLaboratorySourcePreparation(
  input: LaboratorySourceResolveInput
): LaboratorySourcePreparationSnapshot {
  const jobId = randomUUID();
  const workspaceId = createWorkspaceId();
  const trimmedProjectId = input.projectId?.trim();
  const projectId =
    trimmedProjectId !== undefined && trimmedProjectId !== "" ? trimmedProjectId : workspaceId;
  const record: ActiveLaboratorySourceJob = {
    jobId,
    projectId,
    workspaceId,
    input,
    status: "resolving-source",
    progress: createProgress(
      jobId,
      workspaceId,
      "resolving-source",
      "source-resolve",
      6,
      "Preparing source.",
      "Validation and workspace setup are starting."
    ),
    source: null,
    error: "",
    controller: new AbortController(),
    terminal: false,
  };

  activeSourceJobs.set(jobId, record);
  void runSourcePreparation(record);
  return cloneSourceSnapshot(record);
}

export function getLaboratorySourcePreparationJobSnapshot(
  jobId: string
): LaboratorySourcePreparationSnapshot | null {
  const record = activeSourceJobs.get(jobId);
  return record ? cloneSourceSnapshot(record) : null;
}

export function cancelLaboratorySourcePreparation(
  jobId: string
): LaboratorySourcePreparationSnapshot | null {
  const record = activeSourceJobs.get(jobId);
  if (record === undefined) {
    return null;
  }

  if (record.terminal || record.controller === null) {
    return cloneSourceSnapshot(record);
  }

  record.controller.abort();
  finalizeFailure(record, "cancelled", "The source preparation was cancelled by the user.");
  return cloneSourceSnapshot(record);
}
