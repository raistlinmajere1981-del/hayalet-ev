import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createLaboratoryTemporalStressTestRuntime } from "../../rooms/laboratory/features/media-analysis/host/temporal-stress-test.ts";
import {
  buildLaboratoryTemporalStressTestRequestFromWorkspaceSelection,
  normalizeLaboratoryTemporalStressTestRequest,
} from "../../rooms/laboratory/shared/temporal-stress-test-model.ts";
import { attachLaboratoryTransformStackRenderContext } from "../../rooms/laboratory/shared/transform-stack-render-context.ts";
import { renderWorkspaceInteractiveControls } from "../../rooms/laboratory/ui/workspace-interactive-controls.ts";
import { renderWorkspaceStressTestSummaries } from "../../rooms/laboratory/ui/workspace-stress-test-summary.ts";

function createTemporalRuntime() {
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
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    },
  });
}

function assertNear(actual: number, expected: number, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} was not near ${expected}`);
}

void test("temporal request clamps long workspace selections to a six second centered window", () => {
  const request = buildLaboratoryTemporalStressTestRequestFromWorkspaceSelection(
    {
      startMs: 1_000,
      endMs: 15_000,
      roi: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
    },
    20
  );

  assert.deepEqual(request, {
    startSeconds: 5,
    endSeconds: 11,
    sampleFps: 5,
    roi: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
  });
});

void test("temporal request clamps ROI and sample rate without accepting an invalid time window", () => {
  const request = normalizeLaboratoryTemporalStressTestRequest(
    {
      startSeconds: 2,
      endSeconds: 4,
      sampleFps: 99,
      roi: { x: -0.5, y: 0.9, width: 2, height: 0.5 },
    },
    8
  );
  assert.notEqual(request, null);
  assert.equal(request?.startSeconds, 2);
  assert.equal(request?.endSeconds, 4);
  assert.equal(request?.sampleFps, 10);
  assert.equal(request?.roi?.x, 0);
  assert.equal(request?.roi?.y, 0.9);
  assert.equal(request?.roi?.width, 1);
  assertNear(request?.roi?.height ?? -1, 0.1);
  assert.equal(
    normalizeLaboratoryTemporalStressTestRequest({ startSeconds: 4, endSeconds: 4 }),
    null
  );
});

void test("temporal FFmpeg command set uses ROI and only requested signalstats keys", () => {
  const runtime = createTemporalRuntime();
  const request = normalizeLaboratoryTemporalStressTestRequest({
    startSeconds: 10,
    endSeconds: 14,
    sampleFps: 5,
    roi: { x: 0.2, y: 0.25, width: 0.4, height: 0.5 },
  });
  assert.notEqual(request, null);
  const commands = runtime.buildCommands("/source/input.mp4", request!);

  assert.match(commands.signal.join(" "), /-ss 10 -t 4/);
  assert.match(commands.signal.join(" "), /crop=iw\*0\.4:ih\*0\.5:iw\*0\.2:ih\*0\.25/);
  assert.match(commands.signal.join(" "), /lavfi\.signalstats\.YAVG/);
  assert.match(commands.signal.join(" "), /lavfi\.signalstats\.UAVG/);
  assert.match(commands.signal.join(" "), /lavfi\.signalstats\.VAVG/);
  assert.match(commands.frameDifference.join(" "), /tblend=all_mode=difference/);
  assert.match(commands.frameDifference.join(" "), /lavfi\.signalstats\.YAVG/);
  assert.doesNotMatch(commands.frameDifference.join(" "), /lavfi\.signalstats\.UAVG/);
  assert.match(commands.edge.join(" "), /edgedetect=low=0\.1:high=0\.4/);
});

void test("signalstats parser merges repeated metadata blocks at the same timestamp", () => {
  const runtime = createTemporalRuntime();
  const frames = runtime.parseSignalStatsText(`
frame:0 pts:0 pts_time:0
lavfi.signalstats.YAVG=127.5
frame:0 pts:0 pts_time:0
lavfi.signalstats.UAVG=64
frame:0 pts:0 pts_time:0
lavfi.signalstats.VAVG=192
frame:1 pts:1 pts_time:0.2
lavfi.signalstats.YAVG=255
frame:1 pts:1 pts_time:0.2
lavfi.signalstats.UAVG=128
frame:1 pts:1 pts_time:0.2
lavfi.signalstats.VAVG=128
`);

  assert.deepEqual(frames, [
    { timeSeconds: 0, values: { YAVG: 127.5, UAVG: 64, VAVG: 192 } },
    { timeSeconds: 0.2, values: { YAVG: 255, UAVG: 128, VAVG: 128 } },
  ]);
});

void test("temporal result exposes normalized luma chroma difference and edge persistence metrics", () => {
  const runtime = createTemporalRuntime();
  const request = normalizeLaboratoryTemporalStressTestRequest({
    startSeconds: 20,
    endSeconds: 21,
    sampleFps: 5,
    roi: null,
  });
  assert.notEqual(request, null);
  const result = runtime.buildTemporalResult(
    request!,
    [
      { timeSeconds: 0, values: { YAVG: 127.5, UAVG: 64, VAVG: 192 } },
      { timeSeconds: 0.2, values: { YAVG: 255, UAVG: 128, VAVG: 128 } },
    ],
    [
      { timeSeconds: 0.2, values: { YAVG: 25.5 } },
      { timeSeconds: 0.4, values: { YAVG: 51 } },
    ],
    [
      { timeSeconds: 0, values: { YAVG: 25.5 } },
      { timeSeconds: 0.2, values: { YAVG: 51 } },
      { timeSeconds: 0.4, values: { YAVG: 0 } },
    ]
  );

  assert.equal(result.signal[0]?.timeSeconds, 20);
  assert.equal(result.signal[0]?.luma, 0.5);
  assert.equal(result.frameDifference[0]?.energy, 0.1);
  assertNear(result.summary.meanFrameDifferenceEnergy, 0.15);
  assert.equal(result.summary.peakFrameDifferenceEnergy, 0.2);
  assertNear(result.summary.meanEdgeEnergy, 0.1);
  assert.ok(result.summary.edgePersistenceRatio > 0);
  assert.ok(result.summary.edgePersistenceRatio <= 1);
});

void test("temporal scan runs three FFmpeg passes and persists the measured result", async () => {
  const project: Record<string, unknown> = {
    source: {
      kind: "video",
      storedPath: "/source/input.mp4",
      metadata: { durationSeconds: 30 },
    },
    edit: { temporalStressTests: [] },
  };
  const commands: string[][] = [];
  const signalText = `frame:0 pts:0 pts_time:0\nlavfi.signalstats.YAVG=128\nframe:0 pts:0 pts_time:0\nlavfi.signalstats.UAVG=128\nframe:0 pts:0 pts_time:0\nlavfi.signalstats.VAVG=128`;
  const yOnlyText = `frame:0 pts:0 pts_time:0\nlavfi.signalstats.YAVG=25.5`;
  const runtime = createLaboratoryTemporalStressTestRuntime({
    async callRoomTools(payload) {
      const args = payload["args"] as string[];
      commands.push(args);
      return {
        run: {
          exitCode: 0,
          stderr: args.join(" ").includes("metadata=mode=print:key=lavfi.signalstats.UAVG")
            ? signalText
            : yOnlyText,
        },
      };
    },
    async ensureProjectDirectories() {},
    getActiveProject() {
      return project;
    },
    getPreparedSourcePath() {
      return "/source/input.mp4";
    },
    getProjectEditOutputDir() {
      return "/project/edit/output";
    },
    async patchActiveProject(_runtime, patcher) {
      patcher(project);
    },
    roomId: "laboratory",
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    },
  });

  const result = await runtime.runTemporalStressTest({}, "req-temporal", {
    startSeconds: 4,
    endSeconds: 6,
    sampleFps: 5,
    roi: null,
  });

  assert.equal(commands.length, 3);
  assert.match(commands[1]?.join(" ") ?? "", /tblend=all_mode=difference/);
  assert.match(commands[2]?.join(" ") ?? "", /edgedetect=/);
  const history = (project["edit"] as Record<string, unknown>)["temporalStressTests"] as unknown[];
  assert.equal(history.length, 1);
  assert.equal(history[0], result);
  assert.equal(result.metrics.summary.sampleCount, 1);
});

void test("video transform inspector exposes Temporal Scan only for a valid selection request", () => {
  const settings = attachLaboratoryTransformStackRenderContext(
    {
      brightness: 100,
      contrast: 100,
      gamma: 1,
      saturation: 100,
      hueRotate: 0,
      sharpness: 100,
      channelR: true,
      channelG: true,
      channelB: true,
      edgeHighlight: false,
      invert: false,
    },
    {
      editConfig: { recipe: { video: { transformStages: [] } } },
      featureId: "media-analysis",
      locked: false,
      sourceKind: "video",
      temporalRequest: {
        startSeconds: 3,
        endSeconds: 6,
        sampleFps: 5,
        roi: null,
      },
    }
  );
  const markup = renderWorkspaceInteractiveControls(settings, {
    locale: "en",
    t(_key: string, fallback = "") {
      return fallback;
    },
  } as never);
  assert.match(markup, /data-lab-action="workspace-transform-temporal-scan"/);
  assert.match(markup, /data-lab-temporal-request-json=/);
  assert.match(markup, /3\.00–6\.00 s/);
  assert.doesNotMatch(
    markup.match(/data-lab-action="workspace-transform-temporal-scan"[^>]*>/)?.[0] ?? "",
    /disabled/
  );
});

void test("latest temporal measurement is rendered as a compact numeric live-results summary", () => {
  const markup = renderWorkspaceStressTestSummaries(
    {
      temporalStressTests: [
        {
          request: { startSeconds: 2, endSeconds: 5, sampleFps: 5, roi: null },
          metrics: {
            summary: {
              meanFrameDifferenceEnergy: 0.125,
              peakFrameDifferenceEnergy: 0.4,
              edgePersistenceRatio: 0.75,
              lumaRange: 0.2,
              chromaURange: 0.1,
              chromaVRange: 0.08,
            },
          },
        },
      ],
    } as never,
    {
      locale: "en",
      t(_key: string, fallback = "") {
        return fallback;
      },
    } as never
  );
  assert.match(markup, /data-lab-temporal-stress-summary="true"/);
  assert.match(markup, /Frame Δ mean \/ peak/);
  assert.match(markup, /0\.125 \/ 0\.400/);
  assert.match(markup, /75%/);
  assert.match(markup, /0\.100 \/ 0\.080/);
});

void test("temporal action is wired from live controller through the host action router", async () => {
  const liveController = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  const actionRouter = await readFile("rooms/laboratory/shared/host/action-router.ts", "utf8");
  assert.match(liveController, /edit-temporal-stress-test/);
  assert.match(liveController, /request: state\.temporalRequest/);
  assert.match(actionRouter, /case "edit-temporal-stress-test"/);
  assert.match(actionRouter, /runTemporalStressTest/);
});
