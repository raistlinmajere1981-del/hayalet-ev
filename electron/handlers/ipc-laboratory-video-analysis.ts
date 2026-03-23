import { registerHandler } from "./ipc-helpers.ts";
import type { LaboratoryAnalysisRequest, LaboratorySourceResolveInput } from "@shared/index.js";
import {
  cleanupLaboratoryWorkspaceMedia,
  deleteLaboratoryProject,
  discardLaboratoryWorkspace,
  listLaboratoryHistory,
  listLaboratoryProjects,
  readLaboratoryHistoryEntry,
  readLaboratoryProject,
} from "../laboratory/history-store.ts";
import {
  cancelLaboratoryAnalysis,
  getLaboratoryJobSnapshot,
  startLaboratoryAnalysis,
} from "../laboratory/job-runner.ts";
import {
  cancelLaboratorySourcePreparation,
  getLaboratorySourcePreparationJobSnapshot,
  startLaboratorySourcePreparation,
} from "../laboratory/source-job-runner.ts";
import { resolveLaboratorySource } from "../laboratory/source-resolver.ts";

function toResolveInput(value: unknown): LaboratorySourceResolveInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Laboratory source payload must be an object.");
  }

  const source = value as Record<string, unknown>;
  const kind = source["kind"];
  if (kind !== "local-file" && kind !== "direct-url" && kind !== "youtube-url") {
    throw new Error("Unsupported Laboratory source kind.");
  }
  const workflowSettingsValue = source["workflowSettings"];
  const workflowSettings =
    workflowSettingsValue !== null &&
    typeof workflowSettingsValue === "object" &&
    Array.isArray(workflowSettingsValue) === false
      ? (workflowSettingsValue as NonNullable<LaboratorySourceResolveInput["workflowSettings"]>)
      : null;

  return {
    kind,
    ...(typeof source["filePath"] === "string" ? { filePath: source["filePath"] } : {}),
    ...(typeof source["url"] === "string" ? { url: source["url"] } : {}),
    ...(typeof source["label"] === "string" ? { label: source["label"] } : {}),
    ...(typeof source["projectId"] === "string" ? { projectId: source["projectId"] } : {}),
    ...(typeof source["reportLocale"] === "string"
      ? { reportLocale: source["reportLocale"] === "tr" ? "tr" : "en" }
      : {}),
    ...(workflowSettings !== null ? { workflowSettings } : {}),
  };
}

function toAnalysisRequest(value: unknown): LaboratoryAnalysisRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Laboratory analysis payload must be an object.");
  }

  return value as LaboratoryAnalysisRequest;
}

export function setupLaboratoryVideoAnalysisHandlers(): void {
  registerHandler("laboratory-resolve-source", async (_event, payload: unknown) => {
    return {
      success: true,
      source: await resolveLaboratorySource(toResolveInput(payload)),
    };
  });

  registerHandler("laboratory-start-source-preparation", (_event, payload: unknown) => {
    return {
      success: true,
      job: startLaboratorySourcePreparation(toResolveInput(payload)),
    };
  });

  registerHandler("laboratory-get-source-preparation-job", (_event, jobId: string) => {
    return {
      success: true,
      job: getLaboratorySourcePreparationJobSnapshot(jobId),
    };
  });

  registerHandler("laboratory-cancel-source-preparation-job", (_event, jobId: string) => {
    return {
      success: true,
      job: cancelLaboratorySourcePreparation(jobId),
    };
  });

  registerHandler("laboratory-start-analysis", (_event, payload: unknown) => {
    return {
      success: true,
      job: startLaboratoryAnalysis(toAnalysisRequest(payload)),
    };
  });

  registerHandler("laboratory-get-job", (_event, jobId: string) => {
    return {
      success: true,
      job: getLaboratoryJobSnapshot(jobId),
    };
  });

  registerHandler("laboratory-cancel-job", async (_event, jobId: string) => {
    return {
      success: true,
      job: await cancelLaboratoryAnalysis(jobId),
    };
  });

  registerHandler("laboratory-list-history", async () => {
    return {
      success: true,
      entries: await listLaboratoryHistory(),
    };
  });

  registerHandler("laboratory-list-projects", async () => {
    return {
      success: true,
      projects: await listLaboratoryProjects(),
    };
  });

  registerHandler("laboratory-read-history-entry", async (_event, entryId: string) => {
    return {
      success: true,
      entry: await readLaboratoryHistoryEntry(entryId),
    };
  });

  registerHandler("laboratory-read-project", async (_event, projectId: string) => {
    return {
      success: true,
      project: await readLaboratoryProject(projectId),
    };
  });

  registerHandler("laboratory-cleanup-workspace-media", async (_event, entryId: string) => {
    return {
      success: true,
      entry: await cleanupLaboratoryWorkspaceMedia(entryId),
    };
  });

  registerHandler("laboratory-delete-project", async (_event, projectId: string) => {
    await deleteLaboratoryProject(projectId);
    return { success: true };
  });

  registerHandler("laboratory-discard-workspace", async (_event, workspaceId: string) => {
    await discardLaboratoryWorkspace(workspaceId);
    return { success: true };
  });
}
