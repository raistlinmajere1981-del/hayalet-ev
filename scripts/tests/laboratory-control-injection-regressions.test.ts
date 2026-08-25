import assert from "node:assert/strict";
import test from "node:test";

import { createLaboratoryControlInjectionRuntime } from "../../rooms/laboratory/features/media-analysis/host/control-injection.ts";
import { createLaboratoryTemporalStressTestRuntime } from "../../rooms/laboratory/features/media-analysis/host/temporal-stress-test.ts";
import {
  getLaboratoryControlInjectionDefinitions,
  normalizeLaboratoryControlInjectionRequest,
} from "../../rooms/laboratory/shared/control-injection-model.ts";
import { createLaboratoryPresetEditRuntime } from "../../rooms/laboratory/shared/host/preset-edit-runtime.ts";
import { renderWorkspaceTransformStack } from "../../rooms/laboratory/ui/workspace-transform-stack.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function createTemporalHelpers() {
  return createLaboratoryTemporalStressTestRuntime({
    async callRoomTools() {
      return { run: { exitCode: 0, stderr: "" } };
    },
    async ensureProjectDirectories() {},
    getActiveProject() {
      return null;
    },
    getPreparedSourcePath() {
      return "/source/input.mp4";
    },
    getProjectEditOutputDir() {
      return "/project/edit/output";
    },
    async patchActiveProject() {},
    roomId: "laboratory",
    toRecord,
  });
}

type MetricKind = "signal" | "difference" | "edge" | "edge-difference";

function metricText(kind: MetricKind, injected: boolean) {
  if (kind === "signal") {
    const firstY = injected ? 102 : 127.5;
    return `
frame:0 pts:0 pts_time:0
lavfi.signalstats.YAVG=${firstY}
lavfi.signalstats.UAVG=96
lavfi.signalstats.VAVG=160
frame:1 pts:1 pts_time:0.2
lavfi.signalstats.YAVG=153
lavfi.signalstats.UAVG=128
lavfi.signalstats.VAVG=128
`;
  }

  const value =
    kind === "edge"
      ? injected
        ? 76.5
        : 51
      : kind === "edge-difference"
        ? injected
          ? 51
          : 25.5
        : injected
          ? 51
          : 25.5;
  return `
frame:0 pts:0 pts_time:0
lavfi.signalstats.YAVG=${value}
frame:1 pts:1 pts_time:0.2
lavfi.signalstats.YAVG=${value}
`;
}

void test("destruction control definitions are fixed and canonical payload params cannot override them", () => {
  assert.deepEqual(
    getLaboratoryControlInjectionDefinitions()
      .filter((entry) => entry.group === "destruction")
      .map((entry) => entry.kind),
    [
      "noise",
      "blur",
      "sharpen",
      "denoise",
      "gamma",
      "black-crush",
      "highlight-clipping",
      "chroma-suppression",
      "low-light",
      "recompression",
      "recompression-ladder",
    ]
  );
  const normalized = normalizeLaboratoryControlInjectionRequest({
    kind: "noise",
    params: { strength: 99 },
    temporalRequest: {
      startSeconds: 2,
      endSeconds: 4,
      sampleFps: 5,
      roi: null,
    },
  });
  const recompression = normalizeLaboratoryControlInjectionRequest({
    kind: "recompression",
    params: { baselineCrf: 1, injectedCrf: 51 },
    temporalRequest: {
      startSeconds: 2,
      endSeconds: 4,
      sampleFps: 5,
      roi: null,
    },
  });
  assert.equal(normalized?.params["strength"], 12);
  assert.equal(normalized?.temporalRequest.startSeconds, 2);
  assert.equal(recompression?.params["baselineCrf"], 18);
  assert.equal(recompression?.params["injectedCrf"], 36);
});

void test("paired filter controls keep trim ROI and codec equal while injection exists only on the injected side", () => {
  const runtime = createLaboratoryControlInjectionRuntime({
    async callRoomTools() {
      return { run: { exitCode: 0, stderr: "" } };
    },
    getActiveProject() {
      return null;
    },
    getPreparedSourcePath() {
      return "/source/input.mp4";
    },
    getProjectEditOutputDir() {
      return "/project/edit/output";
    },
    async patchActiveProject() {},
    roomId: "laboratory",
    temporalRuntime: createTemporalHelpers(),
    toRecord,
  });
  const request = normalizeLaboratoryControlInjectionRequest({
    kind: "noise",
    temporalRequest: {
      startSeconds: 10,
      endSeconds: 14,
      sampleFps: 5,
      roi: { x: 0.2, y: 0.25, width: 0.4, height: 0.5 },
    },
  });
  assert.notEqual(request, null);

  const baseline = runtime.buildPairCommand(
    "/source/input.mp4",
    "/out/baseline.mp4",
    request!,
    false
  );
  const injected = runtime.buildPairCommand(
    "/source/input.mp4",
    "/out/injected.mp4",
    request!,
    true
  );
  const baselineText = baseline.join(" ");
  const injectedText = injected.join(" ");

  assert.match(baselineText, /-ss 10 -t 4 -i \/source\/input\.mp4/);
  assert.match(baselineText, /crop=trunc\(iw\*0\.4\/2\)\*2:trunc\(ih\*0\.5\/2\)\*2/);
  assert.match(injectedText, /crop=trunc\(iw\*0\.4\/2\)\*2:trunc\(ih\*0\.5\/2\)\*2/);
  assert.doesNotMatch(baselineText, /noise=alls=12/);
  assert.match(injectedText, /noise=alls=12:allf=t\+u:all_seed=4242/);
  assert.match(baselineText, /-c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p/);
  assert.match(injectedText, /-c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p/);
});

void test("recompression control changes only encode quality between paired outputs", () => {
  const runtime = createLaboratoryControlInjectionRuntime({
    async callRoomTools() {
      return { run: { exitCode: 0, stderr: "" } };
    },
    getActiveProject() {
      return null;
    },
    getPreparedSourcePath() {
      return "/source/input.mp4";
    },
    getProjectEditOutputDir() {
      return "/project/edit/output";
    },
    async patchActiveProject() {},
    roomId: "laboratory",
    temporalRuntime: createTemporalHelpers(),
    toRecord,
  });
  const request = normalizeLaboratoryControlInjectionRequest({
    kind: "recompression",
    temporalRequest: {
      startSeconds: 10,
      endSeconds: 14,
      sampleFps: 5,
      roi: { x: 0.2, y: 0.25, width: 0.4, height: 0.5 },
    },
  });
  assert.notEqual(request, null);

  const baselineText = runtime
    .buildPairCommand("/source/input.mp4", "/out/baseline.mp4", request!, false)
    .join(" ");
  const injectedText = runtime
    .buildPairCommand("/source/input.mp4", "/out/injected.mp4", request!, true)
    .join(" ");

  assert.match(baselineText, /-ss 10 -t 4 -i \/source\/input\.mp4/);
  assert.match(injectedText, /-ss 10 -t 4 -i \/source\/input\.mp4/);
  assert.match(baselineText, /crop=trunc\(iw\*0\.4\/2\)\*2:trunc\(ih\*0\.5\/2\)\*2/);
  assert.match(injectedText, /crop=trunc\(iw\*0\.4\/2\)\*2:trunc\(ih\*0\.5\/2\)\*2/);
  assert.match(baselineText, /-c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p/);
  assert.match(injectedText, /-c:v libx264 -preset veryfast -crf 36 -pix_fmt yuv420p/);
  assert.equal(runtime.buildControlFilter(request!), null);
  assert.equal(runtime.buildEncodeProfile(request!, false).crf, 18);
  assert.equal(runtime.buildEncodeProfile(request!, true).crf, 36);
});

void test("destruction control measures spatial edge persistence on both sides and persists the paired result", async () => {
  const calls: Array<Record<string, unknown>> = [];
  let project: Record<string, unknown> = {
    source: {
      kind: "video",
      storedPath: "/source/input.mp4",
      metadata: { durationSeconds: 30 },
    },
    edit: {
      temporalStressTests: [{ id: "older-baseline", request: { startSeconds: 1, endSeconds: 2 } }],
    },
  };
  const temporalRuntime = createTemporalHelpers();
  const runtime = createLaboratoryControlInjectionRuntime({
    async callRoomTools(payload) {
      calls.push(payload);
      const args = Array.isArray(payload["args"]) ? (payload["args"] as string[]) : [];
      const joined = args.join(" ");
      if (!joined.includes("metadata=mode=print:key=lavfi.signalstats")) {
        return { run: { exitCode: 0, stderr: "" } };
      }
      const inputIndex = args.indexOf("-i");
      const inputPath = inputIndex >= 0 ? args[inputIndex + 1] || "" : "";
      const injected = inputPath.includes("-injected.mp4");
      const hasEdge = joined.includes("edgedetect=low=0.1:high=0.4");
      const hasDifference = joined.includes("tblend=all_mode=difference");
      const kind: MetricKind =
        hasEdge && hasDifference
          ? "edge-difference"
          : hasEdge
            ? "edge"
            : hasDifference
              ? "difference"
              : "signal";
      return { run: { exitCode: 0, stderr: metricText(kind, injected) } };
    },
    getActiveProject() {
      return project;
    },
    getPreparedSourcePath() {
      return "/source/input.mp4";
    },
    getProjectEditOutputDir() {
      return "/project/edit/output";
    },
    async patchActiveProject(_runtime, updater) {
      project = updater(project);
      return project;
    },
    roomId: "laboratory",
    temporalRuntime,
    toRecord,
  });

  const result = await runtime.runControlInjection({}, "req-control", {
    kind: "blur",
    temporalRequest: {
      startSeconds: 5,
      endSeconds: 7,
      sampleFps: 5,
      roi: null,
    },
  });

  assert.equal(calls.length, 10);
  assert.equal(result.kind, "control-injection");
  assert.equal(result.request.kind, "blur");
  assert.equal(result.comparisonMethod, "paired-reencode-baseline");
  assert.ok(Number(result.delta["meanFrameDifferenceEnergy"]) > 0);
  assert.ok(Number(result.delta["spatialEdgePersistenceRatio"]) < 0);
  assert.equal(result.metrics.baseline.summary.edgePersistenceMethod, "adjacent-edge-map-iou");
  assert.equal(result.metrics.injected.summary.edgePersistenceMethod, "adjacent-edge-map-iou");
  assert.equal(result.encodeProfiles.baseline.crf, 18);
  assert.equal(result.encodeProfiles.injected.crf, 18);
  assert.equal(result.interpretation.schemaVersion, 1);
  assert.equal(result.interpretation.kind, "control-injection");
  assert.equal(result.interpretation.dataQuality, "sufficient");
  const history = toRecord(project["edit"])["temporalStressTests"] as unknown[];
  assert.equal(toRecord(history[0])["kind"], "control-injection");
  assert.equal(toRecord(toRecord(history[0])["interpretation"])["dataQuality"], "sufficient");
  assert.equal(toRecord(history[1])["id"], "older-baseline");
});

void test("temporal history normalizer preserves typed destruction-control records across restart", () => {
  const presetRuntime = createLaboratoryPresetEditRuntime({
    asNonEmptyString(value) {
      return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    },
    normalizeSourceMetadata(value) {
      return value && typeof value === "object" && !Array.isArray(value) ? toRecord(value) : null;
    },
    toRecord,
  });
  const editPresets = {
    defaultMode: "beginner",
    focusRegions: { "full-frame": { cropNormalized: { x: 0, y: 0, width: 1, height: 1 } } },
    resizePresets: { analysis: { width: 1280 } },
    presets: { video: { beginner: [] }, audio: { beginner: [] }, image: { beginner: [] } },
  };
  const defaults = presetRuntime.createDefaultEditState(editPresets, "video");
  const normalized = presetRuntime.normalizeEditState(
    {
      ...defaults,
      temporalStressTests: [
        {
          kind: "control-injection",
          id: "control-one",
          comparisonMethod: "paired-reencode-baseline",
          delta: {
            meanFrameDifferenceEnergy: 0.1,
            spatialEdgePersistenceRatio: -0.2,
          },
          interpretation: {
            schemaVersion: 1,
            kind: "control-injection",
            dataQuality: "sufficient",
            overallImpact: "strong",
          },
        },
      ],
    },
    editPresets,
    "video"
  );
  assert.equal(normalized.temporalStressTests[0]?.["kind"], "control-injection");
  assert.equal(
    toRecord(normalized.temporalStressTests[0]?.["delta"])["meanFrameDifferenceEnergy"],
    0.1
  );
  assert.equal(
    toRecord(normalized.temporalStressTests[0]?.["delta"])["spatialEdgePersistenceRatio"],
    -0.2
  );
  assert.equal(
    toRecord(normalized.temporalStressTests[0]?.["interpretation"])["dataQuality"],
    "sufficient"
  );
});

void test("video transform inspector exposes destruction controls only when a real temporal request exists", () => {
  const markup = renderWorkspaceTransformStack({
    editConfig: { recipe: { video: { transformStages: [] } } },
    featureId: "media-analysis",
    locked: false,
    sourceKind: "video",
    scope: "visual",
    temporalRequest: {
      startSeconds: 2,
      endSeconds: 4,
      sampleFps: 5,
      roi: null,
    },
  });
  assert.match(markup, /data-lab-control-injection="true"/);
  assert.match(markup, /data-lab-control-injection-kind="true"/);
  assert.match(markup, /workspace-control-injection-run/);
  assert.match(markup, /value="noise"/);
  assert.match(markup, /value="low-light"/);
  assert.match(markup, /value="recompression"/);

  const disabledMarkup = renderWorkspaceTransformStack({
    editConfig: { recipe: { video: { transformStages: [] } } },
    featureId: "media-analysis",
    locked: false,
    sourceKind: "video",
    scope: "visual",
    temporalRequest: null,
  });
  assert.match(disabledMarkup, /data-lab-action="workspace-control-injection-run"[\s\S]*?disabled/);
});
