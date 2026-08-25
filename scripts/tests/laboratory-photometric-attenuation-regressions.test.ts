import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createLaboratoryPhotometricAttenuationRuntime } from "../../rooms/laboratory/features/media-analysis/host/photometric-attenuation.ts";
import { renderWorkspaceStressTestSummaries } from "../../rooms/laboratory/ui/workspace-stress-test-summary.ts";
import { renderWorkspaceTransformStack } from "../../rooms/laboratory/ui/workspace-transform-stack.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function createRuntime() {
  return createLaboratoryPhotometricAttenuationRuntime({
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
    toRecord,
  });
}

void test("photometric commands measure source darkness and use a zero-preserving 8x luma lift", () => {
  const runtime = createRuntime();
  const request = {
    startSeconds: 10,
    endSeconds: 14,
    sampleFps: 5,
    roi: { x: 0.2, y: 0.25, width: 0.4, height: 0.5 },
  };
  const source = runtime.buildCommand("/source/input.mp4", request, false).join(" ");
  const lifted = runtime.buildCommand("/source/input.mp4", request, true).join(" ");

  assert.match(source, /-ss 10 -t 4 -i \/source\/input\.mp4/);
  assert.match(source, /crop=iw\*0\.4:ih\*0\.5:iw\*0\.2:ih\*0\.25/);
  assert.match(source, /signalstats/);
  assert.match(source, /lavfi\.signalstats\.YLOW/);
  assert.match(source, /blackframe=amount=0:threshold=32/);
  assert.doesNotMatch(source, /lutyuv=/);
  assert.match(lifted, /lutyuv=y=val\*8/);
  assert.match(lifted, /blackframe=amount=0:threshold=32/);
  assert.doesNotMatch(lifted, /brightness=/);
});

void test("photometric parser merges signal and blackframe metadata at the same timestamp", () => {
  const runtime = createRuntime();
  const frames = runtime.parsePhotometricText(`
frame:0 pts:0 pts_time:0
lavfi.signalstats.YMIN=0
frame:0 pts:0 pts_time:0
lavfi.signalstats.YLOW=8
frame:0 pts:0 pts_time:0
lavfi.signalstats.YAVG=20
frame:0 pts:0 pts_time:0
lavfi.signalstats.YHIGH=40
frame:0 pts:0 pts_time:0
lavfi.signalstats.YMAX=60
frame:0 pts:0 pts_time:0
lavfi.signalstats.UAVG=128
frame:0 pts:0 pts_time:0
lavfi.signalstats.VAVG=128
frame:0 pts:0 pts_time:0
lavfi.blackframe.pblack=75
`);
  assert.deepEqual(frames, [
    {
      timeSeconds: 0,
      values: {
        YMIN: 0,
        YLOW: 8,
        YAVG: 20,
        YHIGH: 40,
        YMAX: 60,
        UAVG: 128,
        VAVG: 128,
        pblack: 75,
      },
    },
  ]);
});

void test("photometric result separates recoverable darkness from persistent near-black floor", () => {
  const runtime = createRuntime();
  const request = {
    startSeconds: 20,
    endSeconds: 21,
    sampleFps: 5,
    roi: null,
  };
  const result = runtime.buildPhotometricResult(
    request,
    [
      {
        timeSeconds: 0,
        values: { YLOW: 8, YAVG: 20, YHIGH: 40, UAVG: 128, VAVG: 128, pblack: 80 },
      },
      {
        timeSeconds: 0.2,
        values: { YLOW: 10, YAVG: 24, YHIGH: 44, UAVG: 128, VAVG: 128, pblack: 70 },
      },
    ],
    [
      { timeSeconds: 0, values: { pblack: 20 } },
      { timeSeconds: 0.2, values: { pblack: 10 } },
    ]
  );

  assert.equal(result.summary.sampleCount, 2);
  assert.equal(result.summary.liftedSampleCount, 2);
  assert.equal(result.summary.meanNearBlackFraction, 0.75);
  assert.ok(
    Math.abs(result.summary.persistentNearBlackFraction - 0.15) <= 1e-9,
    `${result.summary.persistentNearBlackFraction} was not near 0.15`
  );
  assert.equal(result.summary.recoveredDarkFraction, 0.6);
  assert.ok(result.summary.meanLuma < 0.1);
  const interpretation = runtime.interpretPhotometricSummary(result.summary);
  assert.equal(interpretation.dataQuality, "sufficient");
  assert.equal(interpretation.darkness, "very-dark");
  assert.equal(interpretation.recoverability, "high");
  assert.equal(interpretation.persistentFloor, "moderate");
});

void test("photometric probe runs two FFmpeg passes and persists a separate hypothesis record", async () => {
  let project: Record<string, unknown> = {
    source: {
      kind: "video",
      storedPath: "/source/input.mp4",
      metadata: { durationSeconds: 30 },
    },
    edit: { temporalStressTests: [] },
  };
  const calls: string[][] = [];
  const sourceText = `
frame:0 pts:0 pts_time:0
lavfi.signalstats.YMIN=0
lavfi.signalstats.YLOW=8
lavfi.signalstats.YAVG=20
lavfi.signalstats.YHIGH=40
lavfi.signalstats.YMAX=60
lavfi.signalstats.UAVG=128
lavfi.signalstats.VAVG=128
lavfi.blackframe.pblack=75
`;
  const liftedText = `frame:0 pts:0 pts_time:0\nlavfi.blackframe.pblack=15`;
  const runtime = createLaboratoryPhotometricAttenuationRuntime({
    async callRoomTools(payload) {
      const args = Array.isArray(payload["args"]) ? (payload["args"] as string[]) : [];
      calls.push(args);
      return {
        run: {
          exitCode: 0,
          stderr: args.join(" ").includes("lutyuv=y=val*8") ? liftedText : sourceText,
        },
      };
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
    toRecord,
  });

  const result = await runtime.runPhotometricAttenuationProbe({}, "req-photo", {
    startSeconds: 4,
    endSeconds: 6,
    sampleFps: 5,
    roi: null,
  });

  assert.equal(calls.length, 2);
  assert.equal(result.kind, "photometric-attenuation");
  assert.equal(result.hypothesis, "persistent-photometric-attenuation");
  assert.equal(result.method.nearBlackThreshold8Bit, 32);
  assert.equal(result.method.recoveryOperation, "luma-multiply-8x");
  const history = toRecord(project["edit"])["temporalStressTests"] as unknown[];
  assert.equal(toRecord(history[0])["kind"], "photometric-attenuation");
});

void test("visual stress-test UI exposes a photometric probe only with the temporal selection surface", () => {
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
  assert.match(markup, /workspace-photometric-attenuation/);
  assert.match(markup, /Photometric Probe/);
});

void test("photometric result renders separately and cannot replace the latest temporal summary", () => {
  const markup = renderWorkspaceStressTestSummaries(
    {
      temporalStressTests: [
        {
          kind: "photometric-attenuation",
          request: { startSeconds: 2, endSeconds: 5, sampleFps: 5, roi: null },
          metrics: {
            summary: {
              sampleCount: 15,
              liftedSampleCount: 15,
              meanLuma: 0.08,
              meanNearBlackFraction: 0.7,
              recoveredDarkFraction: 0.5,
              persistentNearBlackFraction: 0.2,
              lumaLowHighSpread: 0.1,
            },
          },
          interpretation: {
            schemaVersion: 1,
            kind: "photometric-attenuation",
            dataQuality: "sufficient",
            darkness: "very-dark",
            recoverability: "high",
            persistentFloor: "moderate",
            internalLumaStructure: "present",
          },
        },
        {
          request: { startSeconds: 2, endSeconds: 5, sampleFps: 5, roi: null },
          metrics: {
            summary: {
              sampleCount: 15,
              frameDifferenceSampleCount: 14,
              edgeSampleCount: 15,
              meanFrameDifferenceEnergy: 0.005,
              peakFrameDifferenceEnergy: 0.008,
              edgePersistenceRatio: 0.3,
              lumaRange: 0.02,
              chromaURange: 0.01,
              chromaVRange: 0.01,
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
  assert.match(markup, /data-lab-photometric-attenuation-summary="true"/);
  assert.match(markup, /Photometric Attenuation Probe/);
  assert.match(markup, /70%/);
  assert.match(markup, /50%/);
  assert.match(markup, /20%/);
});

void test("photometric action is wired through controller and host router", async () => {
  const controller = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  const router = await readFile("rooms/laboratory/shared/host/action-router.ts", "utf8");
  assert.match(controller, /edit-photometric-attenuation/);
  assert.match(controller, /workspace-photometric-attenuation/);
  assert.match(router, /case "edit-photometric-attenuation"/);
  assert.match(router, /runPhotometricAttenuation/);
});
