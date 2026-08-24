import assert from "node:assert/strict";
import test from "node:test";

import { createLaboratoryTemporalStressTestRuntime } from "../../rooms/laboratory/features/media-analysis/host/temporal-stress-test.ts";
import {
  buildLaboratoryTemporalStressTestRequestFromWorkspaceSelection,
  normalizeLaboratoryTemporalStressTestRequest,
} from "../../rooms/laboratory/shared/temporal-stress-test-model.ts";

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
    async writeJsonFile() {},
  });
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
  assert.deepEqual(
    normalizeLaboratoryTemporalStressTestRequest(
      {
        startSeconds: 2,
        endSeconds: 4,
        sampleFps: 99,
        roi: { x: -0.5, y: 0.9, width: 2, height: 0.5 },
      },
      8
    ),
    {
      startSeconds: 2,
      endSeconds: 4,
      sampleFps: 10,
      roi: { x: 0, y: 0.9, width: 1, height: 0.09999999999999998 },
    }
  );
  assert.equal(
    normalizeLaboratoryTemporalStressTestRequest({ startSeconds: 4, endSeconds: 4 }),
    null
  );
});

void test("temporal FFmpeg command set uses ROI, signalstats, frame difference and edge passes", () => {
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
  assert.match(commands.signal.join(" "), /signalstats,metadata=mode=print/);
  assert.match(commands.frameDifference.join(" "), /tblend=all_mode=difference/);
  assert.match(commands.edge.join(" "), /edgedetect=low=0\.1:high=0\.4/);
});

void test("signalstats parser keeps frame timestamps and requested metrics", () => {
  const runtime = createTemporalRuntime();
  const frames = runtime.parseSignalStatsText(`
frame:0 pts:0 pts_time:0
lavfi.signalstats.YAVG=127.5
lavfi.signalstats.UAVG=64
lavfi.signalstats.VAVG=192
frame:1 pts:1 pts_time:0.2
lavfi.signalstats.YAVG=255
lavfi.signalstats.UAVG=128
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
  assert.equal(result.summary.meanFrameDifferenceEnergy, 0.15000000000000002);
  assert.equal(result.summary.peakFrameDifferenceEnergy, 0.2);
  assert.equal(result.summary.meanEdgeEnergy, 0.10000000000000002);
  assert.ok(result.summary.edgePersistenceRatio > 0);
  assert.ok(result.summary.edgePersistenceRatio <= 1);
});
