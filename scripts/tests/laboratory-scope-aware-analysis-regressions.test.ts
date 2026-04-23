import test from "node:test";
import assert from "node:assert/strict";

import {
  createLaboratoryWorkbenchState,
} from "../../rooms/laboratory/shared/host/runtime-primitives.ts";
import { createLaboratoryProcessReportStateRuntime } from "../../rooms/laboratory/shared/host/process-report-state.ts";
import {
  freezeAnalysisScope,
  normalizeAnalysisScope,
} from "../../rooms/laboratory/shared/types/analysis-scope.ts";
import { asNonEmptyString, asNumber } from "../../rooms/laboratory/models/lab-types.ts";

function toRecord(value: unknown) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as Record<string, unknown>)
    : {};
}

const featureIds = ["media-analysis", "audio-analysis", "subtitle-analysis"];

test("analysis scope normalization keeps ordered ranges, intent ids, and freeze lifecycle", () => {
  const normalized = normalizeAnalysisScope({
    timeRange: {
      startMs: 4200,
      endMs: 1200,
    },
    frameRange: {
      startFrame: 84,
      endFrame: 12,
    },
    region: {
      x: 40,
      y: 16,
      width: 96,
      height: 64,
    },
    focus: "visual",
    hypothesis: "su aralikta gorunmeyen obje olabilir",
    intentIds: ["visual-inspection"],
  });

  assert.deepEqual(normalized?.timeRange, {
    startMs: 1200,
    endMs: 4200,
  });
  assert.deepEqual(normalized?.frameRange, {
    startFrame: 12,
    endFrame: 84,
  });
  assert.equal(normalized?.focus, "visual");
  assert.deepEqual(normalized?.intentIds, ["visual-inspection"]);

  const frozen = freezeAnalysisScope(normalized, "media-analysis-run-1", "2026-04-20T10:00:00.000Z");
  assert.equal(frozen?.lifecycle?.mutable, false);
  assert.equal(frozen?.lifecycle?.processId, "media-analysis-run-1");
  assert.equal(frozen?.lifecycle?.frozenAt, "2026-04-20T10:00:00.000Z");
});

test("laboratory workbench preserves scope and density controls without dropping the guided shell", () => {
  const workbench = createLaboratoryWorkbenchState({
    activeModuleId: "media-analysis",
    selectedModuleIds: ["media-analysis", "audio-analysis"],
    analysisScope: {
      frameRange: {
        startFrame: 10,
        endFrame: 30,
      },
      focus: "visual",
      hypothesis: "kenarda gizli detay olabilir",
      intentIds: ["visual-inspection"],
    },
    activePreviewArtifactId: "preview-1",
    activeLiveFindingsStreamId: "media-analysis",
    controlsCollapsed: true,
  });

  assert.equal(workbench.activeModuleId, "media-analysis");
  assert.equal(workbench.analysisScope?.focus, "visual");
  assert.equal(workbench.analysisScope?.lifecycle?.mutable, true);
  assert.equal(workbench.activePreviewArtifactId, "preview-1");
  assert.equal(workbench.activeLiveFindingsStreamId, "media-analysis");
  assert.equal(workbench.controlsCollapsed, true);
});

test("process normalization freezes scope snapshots after process start and carries v2 report fields", () => {
  const runtime = createLaboratoryProcessReportStateRuntime({
    asNonEmptyString,
    asNumber,
    featureIds,
    normalizeProfileArtifact(rawValue: unknown) {
      const source = toRecord(rawValue);
      return {
        id: asNonEmptyString(source["id"]) || "artifact-1",
        kind: asNonEmptyString(source["kind"]) || "artifact",
        path: asNonEmptyString(source["path"]),
        fileName: asNonEmptyString(source["fileName"]),
        label: asNonEmptyString(source["label"]),
        createdAt: asNonEmptyString(source["createdAt"]) || "2026-04-20T10:00:00.000Z",
        metadata: toRecord(source["metadata"]),
      };
    },
    normalizeProfileSignal(rawValue: unknown) {
      const source = toRecord(rawValue);
      return {
        id: asNonEmptyString(source["id"]) || "signal-1",
        laneId: asNonEmptyString(source["laneId"]) || "metadata-lineage",
        kind: asNonEmptyString(source["kind"]) || "derived",
        level: asNonEmptyString(source["level"]) || "low",
        confidence: asNonEmptyString(source["confidence"]) || "low",
        title: asNonEmptyString(source["title"]) || "Signal",
        detail: asNonEmptyString(source["detail"]) || "",
        evidenceCount: Math.max(0, Math.round(asNumber(source["evidenceCount"]) || 0)),
        artifactIds: Array.isArray(source["artifactIds"])
          ? source["artifactIds"].map(function (entry) {
              return asNonEmptyString(entry);
            }).filter(Boolean)
          : [],
      };
    },
    toRecord,
  });

  const processState = runtime.normalizeProcessState({
    records: {
      "media-analysis": {
        status: "running",
        runId: "media-analysis-run-7",
        startedAt: "2026-04-20T10:00:00.000Z",
        analysisScope: {
          timeRange: {
            startMs: 9000,
            endMs: 1200,
          },
          focus: "visual",
          hypothesis: "su aralikta yeni obje olabilir",
        },
        liveFindings: [
          {
            id: "live-1",
            moduleId: "motion",
            title: "Anomali",
            detail: "Batch finding",
            level: "medium",
            confidence: "medium",
            artifactIds: [],
            evidenceCount: 2,
            emittedAt: 1200,
            windowKey: "batch-1",
            streamId: "media-analysis",
          },
        ],
        previewArtifacts: [
          {
            id: "preview-1",
            moduleId: "motion",
            kind: "frame-preview",
            path: "/tmp/frame.png",
            fileName: "frame.png",
            label: "Frame preview",
            active: true,
          },
        ],
        moduleTrace: [
          {
            id: "trace-1",
            moduleId: "motion",
            stage: "process",
            status: "running",
            timestamp: "2026-04-20T10:00:02.000Z",
            message: "Window batch emitted",
          },
        ],
        comparisonVariants: [
          {
            id: "variant-1",
            kind: "gamma-scan",
            label: "Gamma Scan",
            status: "ready",
            artifactIds: ["preview-1"],
          },
        ],
      },
      "audio-analysis": {},
      "subtitle-analysis": {},
    },
  }) as {
    records: Record<string, Record<string, unknown>>;
  };

  const mediaRecord = processState.records["media-analysis"] || {};
  assert.equal(
    toRecord(mediaRecord["analysisScope"])["lifecycle"] &&
      toRecord(toRecord(mediaRecord["analysisScope"])["lifecycle"])["mutable"],
    false
  );
  assert.equal(
    toRecord(toRecord(mediaRecord["analysisScope"])["timeRange"])["startMs"],
    1200
  );
  assert.equal(
    Array.isArray(mediaRecord["liveFindings"]) && (mediaRecord["liveFindings"] as unknown[]).length,
    1
  );
  assert.equal(
    Array.isArray(mediaRecord["previewArtifacts"]) &&
      (mediaRecord["previewArtifacts"] as unknown[]).length,
    1
  );
  assert.equal(
    Array.isArray(mediaRecord["moduleTrace"]) && (mediaRecord["moduleTrace"] as unknown[]).length,
    1
  );
  assert.equal(
    Array.isArray(mediaRecord["comparisonVariants"]) &&
      (mediaRecord["comparisonVariants"] as unknown[]).length,
    1
  );
  assert.equal(mediaRecord["hypothesisSummary"], "su aralikta yeni obje olabilir");
});
