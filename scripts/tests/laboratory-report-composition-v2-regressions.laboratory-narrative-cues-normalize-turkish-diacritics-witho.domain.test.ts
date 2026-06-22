import test from "node:test";
import assert from "node:assert/strict";

import type { LabRun } from "../../rooms/laboratory/domain/lab-types.ts";
import { createAudioAnalysisParserRuntime } from "../../rooms/laboratory/features/audio-analysis/host/analysis-parsers.ts";
import { buildAiReport } from "../../rooms/laboratory/services/report-builder.ts";
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


describe("laboratory narrative cues normalize Turkish diacritics without broad-scope over-", () => {
void test("laboratory narrative cues normalize Turkish diacritics without broad-scope over-correlation", () => {
  const findings: LabRun["findings"] = [
    {
      id: "freeze-finding",
      moduleId: "motion",
      sourceModule: "frame-consistency",
      title: "Frame consistency anomaly detected",
      detail: "Freeze interval detected.",
      level: "medium",
      confidence: "medium",
      kind: "measured",
      evidenceCount: 1,
      artifactIds: [],
      metadata: {
        correlation: { signalType: "freeze", label: "freeze", window: { startSeconds: 12 } },
        temporalSegments: [{ startSeconds: 12, endSeconds: 12.5, durationSeconds: 0.5 }],
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
          window: { startSeconds: 12.2 },
        },
        temporalSegments: [{ startSeconds: 12.2, endSeconds: 12.7, durationSeconds: 0.5 }],
      },
    },
  ];
  const run = createInsightRun({
    analysisScope: {
      focus: "visual",
      hypothesis: "şimdi kayboldu ve çığlık duyuldu",
      timeRange: { startMs: 0, endMs: 120_000 },
    },
    findings,
    hypothesisSummary: "şimdi kayboldu ve çığlık duyuldu",
  });

  const aiReport = buildAiReport(run, {
    featureId: "media-analysis",
    findings,
    generatedAt: "2026-05-20T10:00:00.000Z",
    status: "ready",
  });
  const phrases = aiReport?.narrativeCues?.map((cue) => cue.phrase) ?? [];

  assert.equal(phrases.includes("simdi"), true);
  assert.equal(phrases.includes("kaybol"), true);
  assert.equal(phrases.includes("ciglik"), true);
  assert.equal(
    aiReport?.correlationClusters?.[0]?.signalTypes.includes("narrative-trigger"),
    false
  );
});
void test("laboratory baseline language does not create correlation signals", () => {
  const findings: LabRun["findings"] = [
    {
      id: "no-freeze",
      moduleId: "motion",
      sourceModule: "frame-consistency",
      title: "No freeze anomaly detected",
      detail: "No freeze or frame anomaly was found in the inspected window.",
      level: "medium",
      confidence: "medium",
      kind: "heuristic",
      evidenceCount: 1,
      artifactIds: [],
      reference: { timeRange: { startMs: 12_000, endMs: 13_000 } },
    },
    {
      id: "no-audio",
      moduleId: "audio",
      title: "No audio anomaly found",
      detail: "No silence trigger or spike was detected in the same window.",
      level: "medium",
      confidence: "medium",
      kind: "heuristic",
      evidenceCount: 1,
      artifactIds: [],
      reference: { timeRange: { startMs: 12_000, endMs: 13_000 } },
    },
  ];
  const run = createInsightRun({ findings });

  const aiReport = buildAiReport(run, {
    featureId: "media-analysis",
    findings,
    generatedAt: "2026-05-20T10:00:00.000Z",
    status: "ready",
  });

  assert.equal(aiReport?.correlationClusters?.length, 0);
});
void test("laboratory report keeps text-only transcript triggers as narrative cues", () => {
  const findings: LabRun["findings"] = [
    {
      id: "transcript-trigger",
      moduleId: "audio",
      title: "Narrative trigger phrase detected",
      detail: "Transcript sampling surfaced trigger phrases.",
      level: "medium",
      confidence: "low",
      kind: "heuristic",
      evidenceCount: 2,
      artifactIds: [],
      metadata: {
        narrativeCues: ["şimdi kayboldu"],
        narrativeTemporalBasis: "text-only",
      },
    },
  ];
  const run = createInsightRun({ findings });

  const aiReport = buildAiReport(run, {
    featureId: "media-analysis",
    findings,
    generatedAt: "2026-05-20T10:00:00.000Z",
    status: "ready",
  });
  const phrases = aiReport?.narrativeCues?.map((cue) => cue.phrase) ?? [];

  assert.equal(phrases.includes("simdi"), true);
  assert.equal(phrases.includes("kaybol"), true);
  assert.equal(aiReport?.correlationClusters?.length, 0);
});
void test("laboratory detection parser preserves temporal segments without double-counting close lines", () => {
  const parserRuntime = createAudioAnalysisParserRuntime();
  const freeze = parserRuntime.parseFreezeDetectLog(
    "[freezedetect] freeze_start: 12.000\n[freezedetect] freeze_duration: 0.700\n[freezedetect] freeze_end: 12.700"
  ) as Record<string, unknown>;
  const black = parserRuntime.parseBlackDetectLog(
    "[blackdetect] black_start:13 black_end:13.4 black_duration:0.4"
  ) as Record<string, unknown>;

  assert.equal(freeze["count"], 1);
  assert.equal(black["count"], 1);
  assert.deepEqual((freeze["segments"] as Array<Record<string, unknown>>)[0], {
    durationSeconds: 0.7,
    endSeconds: 12.7,
    startSeconds: 12,
  });
  assert.equal(freeze["maxDurationSeconds"], 0.7);
});
});
