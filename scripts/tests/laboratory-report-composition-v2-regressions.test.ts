import test from "node:test";
import assert from "node:assert/strict";

import type { LabRun } from "../../rooms/laboratory/domain/lab-types.ts";
import { createAudioAnalysisParserRuntime } from "../../rooms/laboratory/features/audio-analysis/host/analysis-parsers.ts";
import { buildAiReport, buildUserReport } from "../../rooms/laboratory/services/report-builder.ts";
import { createLaboratoryReportExportRuntime } from "../../rooms/laboratory/shared/host/reporting-export.ts";

function createReportExportHarness(options: {
  getElectronApi?: () => {
    showOpenDialog?: (dialogOptions: Record<string, unknown>) => Promise<{
      canceled?: boolean;
      filePaths?: string[];
    }>;
  } | null;
} = {}) {
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
  const runtime = createLaboratoryReportExportRuntime({
    buildReportMarkdown() {
      return "# Laboratory Report";
    },
    clearJob() {},
    composeFeatureReport() {
      return {
        status: "ready",
        aiReport: { version: 2 },
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
    ensureProjectDirectories() {
      return Promise.resolve();
    },
    ensureReportJobSlotAvailable() {},
    getActiveProject() {
      return project as unknown as { id: string; slug: string };
    },
    getElectronApi: options.getElectronApi,
    getFeatureReportDir() {
      return "/tmp/reports";
    },
    getFeatureReportExportAction() {
      return "report-export";
    },
    getFeatureReportRecord(nextProject: Record<string, unknown>, featureId: string) {
      return (
        (((nextProject["report"] as Record<string, unknown>)["records"] as Record<string, unknown>)[
          featureId
        ] as Record<string, unknown>) || {}
      );
    },
    normalizeReportExport(value: unknown) {
      const source = value as Record<string, unknown>;
      return {
        id: String(source["fileName"] || source["path"] || "export"),
        format: String(source["format"] || "md"),
        path: source["path"] || null,
        fileName: source["fileName"] || null,
        createdAt: "2026-04-20T10:00:00.000Z",
        status: String(source["status"] || "ready"),
      };
    },
    patchActiveProject(_runtime, patcher) {
      patcher(project as unknown as { id: string; slug: string });
      return Promise.resolve();
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
    writeTextFile(path: string, value: string) {
      writes.push({ path, value });
      return Promise.resolve();
    },
  });

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

test("laboratory report export persists only canonical user and AI report files", async () => {
  const harness = createReportExportHarness();

  await harness.runtime.exportFeatureReport({}, {}, "req-1", "media-analysis");

  assert.equal(harness.writes.length, 2);
  assert.equal(harness.persistedExports.length, 2);
  assert.equal(
    harness.persistedExports.some((entry) => entry["fileName"] === "legacy-ai-payload.json"),
    false
  );
  assert.equal(
    harness.persistedExports.some((entry) => entry["fileName"] === "legacy-channel-batch.json"),
    false
  );
});

test("laboratory report JSON overlay export writes one selected-folder JSON file", async () => {
  const harness = createReportExportHarness();

  await harness.runtime.exportFeatureReport({}, {}, "req-json", "media-analysis", {
    format: "json",
    targetDirectory: "/selected/reports",
  });

  assert.equal(harness.writes.length, 1);
  assert.match(harness.writes[0]?.path || "", /^\/selected\/reports\/lab-project-media-analysis-/);
  assert.match(harness.writes[0]?.path || "", /-ai\.json$/);
  assert.deepEqual(JSON.parse(harness.writes[0]?.value || "{}"), { version: 2 });
  assert.equal(harness.persistedExports.length, 1);
  assert.equal(harness.persistedExports[0]?.["format"], "json");
});

test("laboratory report JSON overlay export opens a host folder picker", async () => {
  const dialogOptions: Array<Record<string, unknown>> = [];
  const harness = createReportExportHarness({
    getElectronApi() {
      return {
        async showOpenDialog(options) {
          dialogOptions.push(options);
          return { canceled: false, filePaths: ["/picked/reports"] };
        },
      };
    },
  });

  await harness.runtime.exportFeatureReport({}, {}, "req-json-picker", "media-analysis", {
    format: "json",
  });

  assert.equal(dialogOptions.length, 1);
  assert.deepEqual(dialogOptions[0]?.["properties"], ["openDirectory", "createDirectory"]);
  assert.match(harness.writes[0]?.path || "", /^\/picked\/reports\/lab-project-media-analysis-/);
  assert.match(harness.writes[0]?.path || "", /-ai\.json$/);
});

test("laboratory report overlay export cancels cleanly when folder picking is cancelled", async () => {
  const harness = createReportExportHarness({
    getElectronApi() {
      return {
        async showOpenDialog() {
          return { canceled: true, filePaths: [] };
        },
      };
    },
  });

  const result = await harness.runtime.exportFeatureReport(
    {},
    {},
    "req-json-cancel",
    "media-analysis",
    {
      format: "json",
    }
  );

  assert.deepEqual(result, { cancelled: true });
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.persistedExports.length, 0);
});

test("laboratory report PDF overlay export writes one selected-folder PDF file", async () => {
  const harness = createReportExportHarness();

  await harness.runtime.exportFeatureReport({}, {}, "req-pdf", "media-analysis", {
    format: "pdf",
    targetDirectory: "/selected/reports",
  });

  assert.equal(harness.writes.length, 1);
  assert.match(harness.writes[0]?.path || "", /^\/selected\/reports\/lab-project-media-analysis-/);
  assert.match(harness.writes[0]?.path || "", /-user\.pdf$/);
  assert.equal(harness.writes[0]?.value.startsWith("%PDF-1.4"), true);
  assert.equal(harness.persistedExports.length, 1);
  assert.equal(harness.persistedExports[0]?.["format"], "pdf");
});

test("laboratory reports surface temporal correlation, narrative cues, and forensic notes", () => {
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
      intentIds: ["anomaly-detection"],
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

  assert.match(userReport?.summary || "", /Composite anomaly cluster/);
  assert.equal(aiReport?.correlationClusters?.[0]?.signalTypes.includes("freeze"), true);
  assert.equal(
    aiReport?.correlationClusters?.[0]?.signalTypes.includes("audio-discontinuity"),
    true
  );
  assert.equal(
    aiReport?.correlationClusters?.[0]?.signalTypes.includes("luminance-collapse"),
    true
  );
  assert.equal(
    aiReport?.narrativeCues?.some((cue) => cue.phrase === "kaybol"),
    true
  );
  assert.match(aiReport?.forensicNotes?.[0]?.detail || "", /duplicate-frame ratio/);
});

test("laboratory composite correlation requires distinct signal families", () => {
  const findings: LabRun["findings"] = [
    {
      id: "freeze-a",
      moduleId: "motion",
      sourceModule: "frame-consistency",
      title: "Frame consistency anomaly detected",
      detail: "Freeze interval detected near the reviewed frame.",
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
      id: "freeze-b",
      moduleId: "motion",
      sourceModule: "frame-consistency",
      title: "Freeze repetition detected",
      detail: "Another freeze interval was measured in the same review window.",
      level: "medium",
      confidence: "medium",
      kind: "measured",
      evidenceCount: 1,
      artifactIds: [],
      metadata: {
        correlation: { signalType: "freeze", label: "freeze", window: { startSeconds: 12.4 } },
        temporalSegments: [{ startSeconds: 12.4, endSeconds: 12.9, durationSeconds: 0.5 }],
      },
    },
  ];
  const run = createInsightRun({ findings });

  const userReport = buildUserReport(run, { findings });
  const aiReport = buildAiReport(run, {
    featureId: "media-analysis",
    findings,
    generatedAt: "2026-05-20T10:00:00.000Z",
    status: "ready",
  });

  assert.equal(aiReport?.correlationClusters?.length, 0);
  assert.doesNotMatch(userReport?.summary || "", /Composite anomaly cluster/);
});

test("laboratory narrative cues normalize Turkish diacritics without broad-scope over-correlation", () => {
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
      intentIds: ["anomaly-detection"],
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
  const phrases = aiReport?.narrativeCues?.map((cue) => cue.phrase) || [];

  assert.equal(phrases.includes("simdi"), true);
  assert.equal(phrases.includes("kaybol"), true);
  assert.equal(phrases.includes("ciglik"), true);
  assert.equal(
    aiReport?.correlationClusters?.[0]?.signalTypes.includes("narrative-trigger"),
    false
  );
});

test("laboratory baseline language does not create correlation signals", () => {
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

test("laboratory report keeps text-only transcript triggers as narrative cues", () => {
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
  const phrases = aiReport?.narrativeCues?.map((cue) => cue.phrase) || [];

  assert.equal(phrases.includes("simdi"), true);
  assert.equal(phrases.includes("kaybol"), true);
  assert.equal(aiReport?.correlationClusters?.length, 0);
});

test("laboratory detection parser preserves temporal segments without double-counting close lines", () => {
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
