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


describe("laboratory forensic notes surface optical-flow motion split", () => {
void test("laboratory forensic notes surface optical-flow motion split", () => {
  const findings: LabRun["findings"] = [
    {
      id: "flow-finding",
      moduleId: "motion",
      sourceModule: "motion-anomaly",
      title: "Localized motion track detected",
      detail: "Motion analysis separated subject movement from the background sample.",
      level: "medium",
      confidence: "medium",
      kind: "measured",
      evidenceCount: 2,
      artifactIds: [],
      metadata: {
        correlation: {
          signalType: "motion-discontinuity",
          label: "motion split",
          window: { startSeconds: 12 },
        },
        probeSummary: {
          freezeAttribution: {
            classification: "localized_motion_during_background_freeze",
            confidence: "medium",
            gopBoundaryOverlapCount: 0,
          },
          opticalFlow: {
            backgroundMotionEnergy: 0.005,
            confidence: "medium",
            movementClass: "localized_subject_motion",
            sampledFrameCount: 8,
            status: "measured",
            subjectBackgroundMotionRatio: 6,
            subjectMotionEnergy: 0.03,
          },
        },
        temporalSegments: [{ startSeconds: 12, endSeconds: 12.6, durationSeconds: 0.6 }],
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
  const opticalNote = aiReport?.forensicNotes?.find((note) => note.label === "optical-flow proxy");
  const attributionNote = aiReport?.forensicNotes?.find(
    (note) => note.label === "freeze attribution"
  );

  assert.match(opticalNote?.detail ?? "", /localized_subject_motion/);
  assert.equal(opticalNote?.measuredFields?.includes("subject/background motion ratio"), true);
  assert.match(attributionNote?.detail ?? "", /Motion split localized_subject_motion/);
});
void test("laboratory forensic signature mapper classifies low-light compression starvation", () => {
  const mapping = buildForensicSignatureMapping({
    black: { count: 1, totalDurationSeconds: 0.8 },
    compressionSignature: {
      estimatedBitsPerPixelFrame: 0.045,
      lowPacketFrameRatio: 0.26,
      packetSpikeRatio: 0.01,
      pictTypeCounts: { B: 0, P: 18 },
      riskFactors: ["low bits-per-pixel-frame", "many low-packet frames"],
      riskLevel: "high",
      riskScore: 0.72,
      sampledFrameCount: 18,
      status: "measured",
    },
    duplicateFrame: {
      exactDuplicateFrameCount: 0,
      exactDuplicateFrameRatio: 0,
      sampledFrameCount: 18,
      status: "measured",
    },
    frameCadence: {
      cadenceDriftRatio: 0.02,
      sampledFrameCount: 18,
      status: "measured",
    },
    opticalFlow: {
      movementClass: "low_motion_baseline",
      sampledFrameCount: 8,
      status: "measured",
    },
  });

  assert.equal(mapping["artifactFamily"], "low_light_compression_starvation");
  assert.equal(mapping["confidence"], "high");
  assert.match(String(mapping["learningFingerprint"]), /bpp:starved/);
});
void test("laboratory forensic signature mapper accepts normalized visual-forensics probe aliases", () => {
  const mapping = buildForensicSignatureMapping({
    compressionSignature: {
      estimatedBitsPerPixelFrame: 0.15,
      packetSpikeRatio: 0.2,
      pictTypeCounts: { B: 10, P: 10 },
      riskLevel: "high",
      sampledFrameCount: 20,
      status: "measured",
    },
    metadataProvenance: {
      mismatchCount: 0,
      sampledFrameCount: 1,
      status: "measured",
    },
    nearDuplicateFrame: {
      exactDuplicateFrameCount: 0,
      sampledFrameCount: 20,
      status: "measured",
    },
    opticalFlowTracking: {
      movementClass: "global_motion_or_camera_shift",
      sampledFrameCount: 8,
      status: "measured",
      subjectMotionEnergy: 0.03,
    },
    referenceQuality: {
      minDelta: 0.02,
      sampledFrameCount: 1,
      status: "measured",
    },
  });

  assert.equal(mapping["artifactFamily"], "fast_motion_encoder_smear");
  assert.equal(
    (mapping["measuredFields"] as string[]).includes("metadata provenance cross-check"),
    true
  );
  assert.match(String(mapping["learningFingerprint"]), /metadata:measured/);
});
void test("laboratory forensic signature mapper classifies remaining artifact families", () => {
  const cases = [
    {
      expectedFamily: "transport_duplicate_stream_stall",
      input: {
        compressionSignature: {
          riskLevel: "low",
          sampledFrameCount: 20,
          status: "measured",
        },
        duplicateFrame: {
          exactDuplicateFrameCount: 9,
          exactDuplicateFrameRatio: 0.47,
          longestDuplicateRunFrames: 5,
          sampledFrameCount: 20,
          status: "measured",
        },
        frameCadence: {
          cadenceDriftRatio: 0.2,
          sampledFrameCount: 20,
          status: "measured",
        },
        freeze: { count: 2 },
        freezeAttribution: {
          classification: "transport_duplicate",
          gopBoundaryOverlapCount: 0,
        },
        opticalFlow: {
          movementClass: "low_motion_baseline",
          sampledFrameCount: 8,
          status: "measured",
        },
      },
      signaturePattern: /duplicate:high/,
    },
    {
      expectedFamily: "fast_motion_encoder_smear",
      input: {
        compressionSignature: {
          estimatedBitsPerPixelFrame: 0.14,
          packetSpikeRatio: 0.18,
          pictTypeCounts: { B: 12, P: 12 },
          riskLevel: "high",
          sampledFrameCount: 24,
          status: "measured",
        },
        frameCadence: {
          cadenceDriftRatio: 0.21,
          sampledFrameCount: 24,
          status: "measured",
        },
        opticalFlow: {
          movementClass: "global_motion_or_camera_shift",
          sampledFrameCount: 8,
          status: "measured",
          subjectMotionEnergy: 0.026,
        },
      },
      signaturePattern: /packet-spike:high/,
    },
    {
      expectedFamily: "thin_edge_ringing_risk",
      input: {
        compressionSignature: {
          estimatedBitsPerPixelFrame: 0.07,
          packetSpikeRatio: 0.04,
          pictTypeCounts: { B: 10, P: 10 },
          riskLevel: "medium",
          sampledFrameCount: 20,
          status: "measured",
        },
        opticalFlow: {
          movementClass: "low_motion_baseline",
          sampledFrameCount: 8,
          status: "measured",
        },
      },
      signaturePattern: /bpp:thin/,
    },
    {
      expectedFamily: "cadence_gop_discontinuity",
      input: {
        frameCadence: {
          cadenceDriftRatio: 0.24,
          sampledFrameCount: 20,
          status: "measured",
          timestampRegressionCount: 1,
        },
        freezeAttribution: {
          classification: "cadence_drift",
          gopBoundaryOverlapCount: 2,
        },
        gopStructure: {
          keyFrameCount: 4,
          sampledFrameCount: 20,
          status: "measured",
        },
      },
      signaturePattern: /cadence:high/,
    },
  ];

  cases.forEach(function (entry) {
    const mapping = buildForensicSignatureMapping(entry.input);

    assert.equal(mapping["artifactFamily"], entry.expectedFamily);
    assert.notEqual(mapping["confidence"], "low");
    assert.match(String(mapping["learningFingerprint"]), entry.signaturePattern);
  });
});
});
