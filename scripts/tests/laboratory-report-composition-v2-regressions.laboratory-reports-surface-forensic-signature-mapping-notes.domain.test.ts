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


describe("laboratory reports surface forensic signature mapping notes", () => {
void test("laboratory reports surface forensic signature mapping notes", () => {
  const findings: LabRun["findings"] = [
    {
      id: "signature-finding",
      moduleId: "motion",
      sourceModule: "temporal-noise-pattern",
      title: "Compression artifact cluster detected",
      detail: "Packet and luminance probes suggest compression starvation.",
      level: "medium",
      confidence: "medium",
      kind: "measured",
      evidenceCount: 3,
      artifactIds: [],
      metadata: {
        correlation: {
          signalType: "luminance-collapse",
          label: "compression signature",
          window: { startSeconds: 7 },
        },
        probeSummary: {
          forensicSignature: {
            artifactFamily: "low_light_compression_starvation",
            artifactLabel: "Low-light compression starvation",
            confidence: "high",
            counterEvidence: ["no repeated decoded-frame hashes were measured"],
            evidence: [
              "compression risk high",
              "estimated bits-per-pixel-frame 0.04500",
              "low packet-frame ratio 26.0%",
            ],
            manualReviewPrompts: ["Check the same window against a pre-upload source."],
            measuredFields: ["compression packet signature", "blackdetect intervals"],
            score: 0.91,
            signatureKey: "compression:high|bpp:starved|motion:low_motion_baseline",
            status: "measured",
          },
        },
        temporalSegments: [{ startSeconds: 7, endSeconds: 7.8, durationSeconds: 0.8 }],
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
  const signatureNote = aiReport?.forensicNotes?.find(
    (note) => note.label === "compression signature mapping"
  );

  assert.match(signatureNote?.detail ?? "", /Low-light compression starvation/);
  assert.match(signatureNote?.detail ?? "", /Learning fingerprint compression:high/);
  assert.equal(signatureNote?.measuredFields?.includes("compression packet signature"), true);
});
void test("laboratory reports surface triage decision, evidence matrix, and counter-evidence ledger", () => {
  const findings: LabRun["findings"] = [
    {
      id: "triage-finding",
      moduleId: "motion",
      sourceModule: "compression-signature-mapping",
      title: "Compression signature mapped",
      detail: "Low-light compression starvation was mapped in the sampled window.",
      level: "medium",
      confidence: "medium",
      kind: "measured",
      evidenceCount: 3,
      artifactIds: [],
      metadata: {
        probeSummary: {
          compressionSignature: {
            riskLevel: "high",
            sampledFrameCount: 18,
            status: "measured",
          },
          compressionSignatureMapping: {
            artifactFamily: "low_light_compression_starvation",
            artifactLabel: "Low-light compression starvation",
            confidence: "high",
            counterEvidence: ["no repeated decoded-frame hashes were measured"],
            evidence: ["compression risk high", "low packet-frame ratio 26.0%"],
            manualReviewPrompts: ["Check the same window against a pre-upload source."],
            measuredFields: ["compression packet signature"],
            score: 0.81,
            status: "measured",
          },
          metadataProvenance: {
            reason: "ExifTool/MediaInfo metadata provenance cross-check is not wired.",
            sampledFrameCount: 0,
            status: "unavailable",
          },
          nearDuplicateFrame: {
            exactDuplicateFrameCount: 0,
            sampledFrameCount: 18,
            status: "measured",
          },
          referenceQuality: {
            reason: "Reference/pre-upload source was not provided.",
            sampledFrameCount: 0,
            status: "unavailable",
          },
        },
      },
    },
  ];
  const run = createInsightRun({ findings });

  const userReport = buildUserReport(run, { findings });
  const aiReport = buildAiReport(run, { findings, featureId: "media-analysis" });

  assert.equal(userReport?.decisionSummary?.anomaly, "inconclusive");
  assert.equal(userReport.decisionSummary.needsFollowUp, true);
  assert.equal(
    aiReport?.evidenceStrength?.find((entry) => entry.id === "extraordinary")?.strength,
    "not-testable"
  );
  assert.equal(
    userReport.evidenceStrength?.find((entry) => entry.id === "compression-artifact")?.strength,
    "strong"
  );
  assert.equal(
    userReport.counterEvidenceLedger?.entries.some(
      (entry) => entry.id === "duplicate-not-found" && entry.status === "measured-not-found"
    ),
    true
  );
  assert.equal(
    aiReport.counterEvidenceLedger?.entries.some(
      (entry) => entry.id === "metadata-provenance-not-measured"
    ),
    true
  );
});
void test("laboratory counter-evidence ledger surfaces partial metadata and reference coverage", () => {
  const findings: LabRun["findings"] = [
    {
      id: "partial-cross-check",
      moduleId: "motion",
      sourceModule: "metadata-provenance-audit",
      title: "Metadata provenance audit",
      detail: "ffprobe metadata was measured with optional host tools missing.",
      level: "low",
      confidence: "medium",
      kind: "measured",
      evidenceCount: 1,
      artifactIds: [],
      metadata: {
        probeSummary: {
          metadataProvenance: {
            coverage: "ffprobe-only",
            measuredSourceIds: ["ffprobe"],
            missingToolIds: ["exiftool", "mediainfo"],
            sampledFrameCount: 1,
            status: "measured",
          },
          referenceQuality: {
            sampledFrameCount: 1,
            status: "measured",
            toolResults: {
              ssim: { sampledFrameCount: 1, status: "measured" },
              vmaf: { reason: "libvmaf filter missing", sampledFrameCount: 0, status: "unavailable" },
            },
          },
        },
      },
    },
  ];
  const userReport = buildUserReport(createInsightRun({ findings }), { findings });

  assert.equal(
    userReport?.counterEvidenceLedger?.entries.some(
      (entry) => entry.id === "metadata-provenance-partial" && entry.status === "measured-weak"
    ),
    true
  );
  assert.equal(
    userReport.counterEvidenceLedger.entries.some(
      (entry) => entry.id === "reference-quality-partial" && entry.status === "measured-weak"
    ),
    true
  );
});
void test("laboratory composite correlation requires distinct signal families", () => {
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
  assert.doesNotMatch(userReport?.summary ?? "", /Composite anomaly cluster/);
});
});
