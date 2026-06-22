import test from "node:test";
import assert from "node:assert/strict";

import type { LabRun } from "../../rooms/laboratory/domain/lab-types.ts";
import { createAudioAnalysisParserRuntime } from "../../rooms/laboratory/features/audio-analysis/host/analysis-parsers.ts";
import { buildForensicSignatureMapping } from "../../rooms/laboratory/services/forensic-signature-mapper.ts";
import { buildAiReport, buildUserReport } from "../../rooms/laboratory/services/report-builder.ts";
import { createLaboratoryReportExportRuntime } from "../../rooms/laboratory/shared/host/reporting-export.ts";

function createReportExportHarness(
  options: {
    getElectronApi?: () => {
      showOpenDialog?: (dialogOptions: Record<string, unknown>) => Promise<{
        canceled?: boolean;
        filePaths?: string[];
      }>;
    } | null;
  } = {}
) {
  const writes: Array<{ path: string; value: string }> = [];
  let persistedExports: Array<Record<string, unknown>> = [];
  const project = {
    id: "project-1",
    slug: "lab-project",
    report: {
      records: {
        "media-analysis": {
          exports: [],
        },
      },
    },
  };
  const deps: Parameters<typeof createLaboratoryReportExportRuntime>[0] = {
    buildReportMarkdown() {
      return "# Laboratory Report";
    },
    clearJob() {},
    composeFeatureReport() {
      return {
        status: "ready",
        aiReport: { version: 2 },
        userReport: { summary: "User report", audience: "user" },
        artifacts: [
          {
            kind: "legacy-ai-payload",
            path: "/tmp/legacy-ai-payload.json",
            fileName: "legacy-ai-payload.json",
          },
          {
            kind: "legacy-channel-batch",
            path: "/tmp/legacy-channel-batch.json",
            fileName: "legacy-channel-batch.json",
          },
        ],
        exports: [],
      };
    },
    async ensureProjectDirectories() {
      await Promise.resolve();
    },
    ensureReportJobSlotAvailable() {},
    getActiveProject() {
      return project;
    },
    getFeatureReportDir() {
      return "/tmp/reports";
    },
    getFeatureReportExportAction() {
      return "report-export";
    },
    getFeatureReportRecord(nextProject: Record<string, unknown>, featureId: string) {
      const records = (nextProject["report"] as Record<string, unknown>)["records"] as Record<string, unknown>;
      const value = records[featureId];
      return (value ?? {}) as Record<string, unknown>;
    },
    normalizeReportExport(value: unknown) {
      const source = value as Record<string, unknown>;
      return {
        id: String((source["fileName"] as string | undefined) ?? (source["path"] as string | undefined) ?? "export"),
        format: String((source["format"] as string | undefined) ?? "md"),
        path: (source["path"]) ?? null,
        fileName: (source["fileName"]) ?? null,
        reportView: (source["reportView"]) ?? null,
        createdAt: "2026-04-20T10:00:00.000Z",
        status: String((source["status"] as string | undefined) ?? "ready"),
      };
    },
    async patchActiveProject(_runtime, patcher) {
      patcher(project);
      await Promise.resolve();
    },
    pushJobState() {},
    registerJob() {
      return {};
    },
    sanitizeFileSegment(value: unknown, fallback: string) {
      return typeof value === "string" && value.trim() !== "" ? value : fallback;
    },
    setFeatureReportRecord(nextProject: Record<string, unknown>, featureId: string, record) {
      ((nextProject["report"] as Record<string, unknown>)["records"] as Record<string, unknown>)[
        featureId
      ] = record;
      persistedExports = Array.isArray((record as Record<string, unknown>)["exports"])
        ? ((record as Record<string, unknown>)["exports"] as Array<Record<string, unknown>>)
        : [];
    },
    async writeTextFile(path: string, value: string) {
      writes.push({ path, value });
      await Promise.resolve();
    },
  };
  if (options.getElectronApi !== undefined) {
    deps.getElectronApi = options.getElectronApi;
  }
  const runtime = createLaboratoryReportExportRuntime(deps);

  return {
    get persistedExports() {
      return persistedExports;
    },
    runtime,
    writes,
  };
}

function createInsightRun(overrides: Partial<LabRun> = {}): LabRun {
  const baseRun: LabRun = {
    id: "run-insight",
    state: "ready",
    startedAt: 1_000,
    endedAt: 4_000,
    modules: {
      audio: { id: "audio", status: "ready" },
      motion: { id: "motion", status: "ready" },
      "visual-signal": { id: "visual-signal", status: "ready" },
    },
    moduleOrder: ["motion", "audio", "visual-signal"],
    events: [],
    rawLog: [],
    artifacts: [],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: "clip.mp4",
    progress: 100,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [],
    confidence: "medium",
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  return {
    ...baseRun,
    ...overrides,
    artifacts: overrides.artifacts ?? baseRun.artifacts,
    findings: overrides.findings ?? baseRun.findings,
    moduleOrder: overrides.moduleOrder ?? baseRun.moduleOrder,
    modules: overrides.modules ?? baseRun.modules,
  };
}
