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


describe("laboratory report PDF overlay export writes one selected-folder PDF file", () => {
void test("laboratory report PDF overlay export writes one selected-folder PDF file", async () => {
  const harness = createReportExportHarness();

  await harness.runtime.exportFeatureReport({}, {}, "req-pdf", "media-analysis", {
    format: "pdf",
    targetDirectory: "/selected/reports",
  });

  assert.equal(harness.writes.length, 1);
  assert.match(harness.writes[0]?.path ?? "", /^\/selected\/reports\/lab-project-media-analysis-/);
  assert.match(harness.writes[0]?.path ?? "", /-user\.pdf$/);
  assert.equal(harness.writes[0]?.value.startsWith("%PDF-1.4"), true);
  assert.equal(harness.persistedExports.length, 1);
  assert.equal(harness.persistedExports[0]?.["format"], "pdf");
});
void test("laboratory report JSON overlay export writes the selected user report", async () => {
  const harness = createReportExportHarness();

  await harness.runtime.exportFeatureReport({}, {}, "req-user-json", "media-analysis", {
    format: "json",
    reportView: "user",
    targetDirectory: "/selected/reports",
  });

  assert.equal(harness.writes.length, 1);
  assert.match(harness.writes[0]?.path ?? "", /-user\.json$/);
  assert.deepEqual(JSON.parse(harness.writes[0]?.value ?? "{}"), {
    audience: "user",
    summary: "User report",
  });
  assert.equal(harness.persistedExports[0]?.["reportView"], "user");
});
void test("laboratory report PDF overlay export writes the selected technical report", async () => {
  const harness = createReportExportHarness();

  await harness.runtime.exportFeatureReport({}, {}, "req-ai-pdf", "media-analysis", {
    format: "pdf",
    reportView: "ai",
    targetDirectory: "/selected/reports",
  });

  assert.equal(harness.writes.length, 1);
  assert.match(harness.writes[0]?.path ?? "", /-ai\.pdf$/);
  assert.equal(harness.writes[0]?.value.startsWith("%PDF-1.4"), true);
  assert.match(harness.writes[0].value, /Technical Payload/);
  assert.equal(harness.persistedExports[0]?.["reportView"], "ai");
});
void test("laboratory reports surface temporal correlation, narrative cues, and forensic notes", () => {
  const run: LabRun = {
    id: "run-correlated",
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
    artifacts: [
      {
        id: "frame-preview",
        moduleId: "motion",
        kind: "frame-preview",
        path: "/tmp/frame.png",
        fileName: "frame.png",
        previewUrl: null,
        createdAt: "2026-05-20T10:00:00.000Z",
      },
    ],
    findings: [
      {
        id: "freeze-finding",
        moduleId: "motion",
        sourceModule: "frame-consistency",
        title: "Frame consistency anomaly detected",
        detail: "The active video target contains one freeze interval.",
        level: "medium",
        confidence: "medium",
        kind: "measured",
        evidenceCount: 1,
        artifactIds: ["frame-preview"],
        metadata: {
          correlation: { signalType: "freeze", label: "freeze", window: { startSeconds: 12 } },
          probeSummary: {
            freeze: {
              count: 1,
              maxDurationSeconds: 0.7,
              totalDurationSeconds: 0.7,
            },
          },
          temporalSegments: [{ startSeconds: 12, endSeconds: 12.7, durationSeconds: 0.7 }],
        },
      },
      {
        id: "audio-finding",
        moduleId: "audio",
        title: "Silence pockets detected",
        detail: "Silence detection found one pocket.",
        level: "medium",
        confidence: "medium",
        kind: "measured",
        evidenceCount: 1,
        artifactIds: [],
        metadata: {
          correlation: {
            signalType: "audio-discontinuity",
            label: "audio silence",
            window: { startSeconds: 12.35 },
          },
          temporalSegments: [{ startSeconds: 12.35, endSeconds: 12.9, durationSeconds: 0.55 }],
        },
      },
      {
        id: "visual-finding",
        moduleId: "motion",
        sourceModule: "temporal-noise-pattern",
        title: "Temporal noise pattern detected",
        detail: "Black interval analysis found one transition.",
        level: "medium",
        confidence: "low",
        kind: "derived",
        evidenceCount: 1,
        artifactIds: [],
        metadata: {
          correlation: {
            signalType: "luminance-collapse",
            label: "black frame",
            window: { startSeconds: 12.5 },
          },
          temporalSegments: [{ startSeconds: 12.5, endSeconds: 12.9, durationSeconds: 0.4 }],
        },
      },
    ],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: "clip.mp4",
    progress: 100,
    emptyReason: null,
    analysisScope: {
      focus: "visual",
      hypothesis: "tam o anda kayboldu",
      timeRange: { startMs: 12_000, endMs: 14_000 },
    },
    previewArtifacts: [],
    confidence: "medium",
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: "tam o anda kayboldu",
  };

  const userReport = buildUserReport(run, { findings: run.findings });
  const aiReport = buildAiReport(run, {
    featureId: "media-analysis",
    findings: run.findings,
    generatedAt: "2026-05-20T10:00:00.000Z",
    status: "ready",
  });

  assert.match(userReport?.summary ?? "", /Composite anomaly cluster/);
  assert.equal(aiReport?.correlationClusters?.[0]?.signalTypes.includes("freeze"), true);
  assert.equal(
    aiReport.correlationClusters[0].signalTypes.includes("audio-discontinuity"),
    true
  );
  assert.equal(
    aiReport.correlationClusters[0].signalTypes.includes("luminance-collapse"),
    true
  );
  assert.equal(
    aiReport.narrativeCues?.some((cue) => cue.phrase === "kaybol"),
    true
  );
  assert.match(aiReport.forensicNotes?.[0]?.detail ?? "", /duplicate-frame ratio/);
});
});
