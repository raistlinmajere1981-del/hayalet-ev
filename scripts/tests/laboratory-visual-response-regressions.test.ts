import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getLaboratoryResponseSweepValues,
  normalizeLaboratoryVisualResponseProbeRequest,
} from "../../rooms/laboratory/shared/visual-response-probe-model.ts";
import {
  buildLaboratoryResponseAxisFilter,
  buildLaboratoryResponseRegionMetrics,
  parseLaboratoryResponseMetricText,
} from "../../rooms/laboratory/features/media-analysis/host/visual-response-probe.ts";
import { createLaboratoryControlInjectionRuntime } from "../../rooms/laboratory/features/media-analysis/host/control-injection.ts";
import { renderWorkspaceTransformStack } from "../../rooms/laboratory/ui/workspace-transform-stack.ts";
import { renderWorkspaceVisualResponseSummaries } from "../../rooms/laboratory/ui/workspace-visual-response-summary.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const temporalRequest = {
  startSeconds: 10,
  endSeconds: 12,
  sampleFps: 5,
  roi: { x: 0.1, y: 0.2, width: 0.25, height: 0.3 },
};
const backgroundRoi = { x: 0.4, y: 0.2, width: 0.25, height: 0.3 };

void test("response model normalizes target/background ROI and keeps controlled sweep axes", () => {
  const request = normalizeLaboratoryVisualResponseProbeRequest({
    axis: "exposure",
    temporalRequest,
    backgroundRoi,
  });
  assert.ok(request);
  assert.deepEqual(request?.backgroundRoi, backgroundRoi);
  assert.deepEqual(getLaboratoryResponseSweepValues("exposure"), [-3, -2, -1, 0, 1, 2, 3]);
  assert.deepEqual(getLaboratoryResponseSweepValues("black-level"), [0, 0.02, 0.04, 0.06, 0.1, 0.14, 0.2]);
  assert.deepEqual(getLaboratoryResponseSweepValues("denoise"), [0, 1.5, 3, 4.5, 6, 9, 12]);
});

void test("response axis filters isolate the requested transform family", () => {
  assert.match(buildLaboratoryResponseAxisFilter("exposure", 2) || "", /val\*4/);
  assert.match(buildLaboratoryResponseAxisFilter("gamma", 1.6) || "", /eq=gamma=1\.6/);
  assert.match(buildLaboratoryResponseAxisFilter("black-level", 0.1) || "", /if\(lt\(val,26\),0,val\)/);
  assert.match(buildLaboratoryResponseAxisFilter("denoise", 6) || "", /hqdn3d=6:4\.5:9:6\.75/);
  assert.match(buildLaboratoryResponseAxisFilter("sharpen", 1.4) || "", /unsharp=5:5:1\.4/);
  assert.equal(buildLaboratoryResponseAxisFilter("blur", 0), null);
});

void test("response parser and metrics retain near-black recovery, frame change, and edge persistence", () => {
  const source = parseLaboratoryResponseMetricText(`
frame:0 pts:0 pts_time:0
lavfi.signalstats.YMIN=0
lavfi.signalstats.YLOW=8
lavfi.signalstats.YAVG=20
lavfi.signalstats.YHIGH=45
lavfi.signalstats.YMAX=80
lavfi.signalstats.UAVG=128
lavfi.signalstats.VAVG=128
lavfi.blackframe.pblack=80
frame:1 pts:1 pts_time:0.2
lavfi.signalstats.YMIN=0
lavfi.signalstats.YLOW=10
lavfi.signalstats.YAVG=24
lavfi.signalstats.YHIGH=48
lavfi.signalstats.YMAX=84
lavfi.signalstats.UAVG=130
lavfi.signalstats.VAVG=126
lavfi.blackframe.pblack=70
`);
  const edge = parseLaboratoryResponseMetricText(`
frame:0 pts:0 pts_time:0
lavfi.signalstats.YAVG=30
frame:1 pts:1 pts_time:0.2
lavfi.signalstats.YAVG=34
`);
  const lifted = parseLaboratoryResponseMetricText(`
frame:0 pts:0 pts_time:0
lavfi.blackframe.pblack=20
frame:1 pts:1 pts_time:0.2
lavfi.blackframe.pblack=10
`);
  const result = buildLaboratoryResponseRegionMetrics(source, edge, lifted);
  assert.equal(result.sampleCount, 2);
  assert.ok(Math.abs(result.nearBlackFraction - 0.75) < 1e-9);
  assert.ok(Math.abs(result.persistentNearBlackFraction - 0.15) < 1e-9);
  assert.ok(Math.abs(result.recoveredDarkFraction - 0.6) < 1e-9);
  assert.ok(result.frameDifferenceEnergy > 0);
  assert.ok(result.edgePersistence > 0);
  assert.ok(result.visibilityScore >= 0 && result.visibilityScore <= 1);
});

void test("sensor and codec controls expose added denoise, clipping, chroma and threshold filters", () => {
  const runtime = createLaboratoryControlInjectionRuntime({
    async callRoomTools() {
      return { run: { exitCode: 0, stderr: "" } };
    },
    getActiveProject() {
      return null;
    },
    getPreparedSourcePath() {
      return null;
    },
    getProjectEditOutputDir() {
      return "/tmp";
    },
    async patchActiveProject() {},
    roomId: "laboratory",
    temporalRuntime: {
      buildCommands() {
        return { signal: [], frameDifference: [], edge: [], edgeDifference: [] };
      },
      buildTemporalResult() {
        return {} as never;
      },
      parseSignalStatsText() {
        return [];
      },
    } as never,
    toRecord,
  });
  const base = { temporalRequest };
  assert.match(runtime.buildControlFilter({ ...base, kind: "denoise", params: { luma: 6, chroma: 4.5 } }) || "", /hqdn3d/);
  assert.match(runtime.buildControlFilter({ ...base, kind: "gamma", params: { gamma: 1.8 } }) || "", /eq=gamma=1\.8/);
  assert.match(runtime.buildControlFilter({ ...base, kind: "black-crush", params: { threshold: 0.1 } }) || "", /if\(lt\(val,26\),0,val\)/);
  assert.match(runtime.buildControlFilter({ ...base, kind: "highlight-clipping", params: { threshold: 0.85 } }) || "", /if\(gt\(val,217\),255,val\)/);
  assert.match(runtime.buildControlFilter({ ...base, kind: "chroma-suppression", params: { saturation: 0.15 } }) || "", /saturation=0\.15/);
});

void test("visual stress UI exposes grouped response, transition, codec ladder and shared background reference", () => {
  const markup = renderWorkspaceTransformStack({
    editConfig: { recipe: { video: { transformStages: [] } } },
    featureId: "media-analysis",
    locked: false,
    sourceKind: "video",
    scope: "visual",
    temporalRequest,
  });
  assert.match(markup, /Reference \/ Background ROI/);
  assert.match(markup, /Response Curves/);
  assert.match(markup, /response-exposure/);
  assert.match(markup, /response-black-level/);
  assert.match(markup, /recompression-ladder/);
  assert.match(markup, /appearance-transition/);
});

void test("response result surface renders target/background curves without making a real-fake verdict", () => {
  const point = (value: number, target: number, background: number) => ({
    value,
    target: {
      visibilityScore: target,
      edgeEnergy: 0.2,
      recoveredDarkFraction: 0.4,
      nearBlackFraction: 0.3,
    },
    background: {
      visibilityScore: background,
      edgeEnergy: 0.15,
      recoveredDarkFraction: 0.3,
      nearBlackFraction: 0.25,
    },
    differential: {
      visibilityScore: target - background,
      edgeEnergy: 0.05,
      recoveredDarkFraction: 0.1,
      nearBlackFraction: 0.05,
    },
  });
  const markup = renderWorkspaceVisualResponseSummaries(
    {
      temporalStressTests: [
        {
          kind: "visibility-response",
          request: {
            axis: "exposure",
            temporalRequest,
            backgroundRoi,
          },
          points: [point(-1, 0.4, 0.35), point(0, 0.55, 0.5), point(1, 0.7, 0.65)],
          interpretation: {
            classification: "target-and-background-change-together",
            sensorCompatibility: "low-light-sensor-compatible",
          },
        },
      ],
    } as never,
    {
      locale: "tr",
      t(_key: string, fallback = "") {
        return fallback;
      },
    } as never
  );
  assert.match(markup, /TARGET/);
  assert.match(markup, /BACKGROUND/);
  assert.match(markup, /DIFFERENCE/);
  assert.match(markup, /Target ve background birlikte değişiyor/);
  assert.match(markup, /düşük ışık \/ sensör açıklamasıyla uyumlu/);
  assert.doesNotMatch(markup, /paranormal/i);
  assert.doesNotMatch(markup, /gerçek.*sahte|real.*fake/i);
});

void test("composite host routing keeps response and codec ladder inside edit-control-injection contract", async () => {
  const handlers = await readFile(
    "rooms/laboratory/features/media-analysis/host/action-handlers.ts",
    "utf8"
  );
  const controller = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  assert.match(handlers, /startsWith\("response-"\)/);
  assert.match(handlers, /appearance-transition/);
  assert.match(handlers, /recompression-ladder/);
  assert.match(handlers, /\[18, 24, 30, 36, 42\]/);
  assert.match(controller, /edit-control-injection/);
});
