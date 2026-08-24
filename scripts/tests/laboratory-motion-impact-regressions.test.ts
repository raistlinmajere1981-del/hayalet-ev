import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  analyzeLaboratoryMotionFrames,
  buildLaboratoryMotionExtractionCommand,
  createLaboratoryMotionImpactProbeRuntime,
} from "../../rooms/laboratory/features/media-analysis/host/motion-impact-probe.ts";
import { renderWorkspaceMotionImpactSummaries } from "../../rooms/laboratory/ui/workspace-motion-impact-summary.ts";
import { renderWorkspaceTransformStack } from "../../rooms/laboratory/ui/workspace-transform-stack.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function makeTextureFrame(width: number, height: number) {
  const frame = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      frame[y * width + x] = (x * 29 + y * 47 + x * y * 3) % 251;
    }
  }
  return frame;
}

function shiftFrame(
  source: Uint8Array,
  width: number,
  height: number,
  dx: number,
  dy: number
) {
  const frame = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetX = x + dx;
      const targetY = y + dy;
      if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) {
        continue;
      }
      frame[targetY * width + targetX] = source[y * width + x] ?? 0;
    }
  }
  return frame;
}

function concatenateFrames(frames: Uint8Array[]) {
  const total = frames.reduce((sum, frame) => sum + frame.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const frame of frames) {
    bytes.set(frame, offset);
    offset += frame.byteLength;
  }
  return bytes;
}

void test("motion block matching recovers direction and calibrates vectors to source pixels", () => {
  const geometry = { width: 32, height: 24 };
  const first = makeTextureFrame(geometry.width, geometry.height);
  const second = shiftFrame(first, geometry.width, geometry.height, 2, -1);
  const result = analyzeLaboratoryMotionFrames({
    frames: [first, second],
    geometry,
    scaleX: 2,
    scaleY: 3,
    startSeconds: 4,
  });

  assert.equal(result.summary.pairCount, 1);
  assert.ok(Math.abs(result.summary.dx - 4) < 0.01, `dx=${result.summary.dx}`);
  assert.ok(Math.abs(result.summary.dy + 3) < 0.01, `dy=${result.summary.dy}`);
  assert.ok(Math.abs(result.summary.magnitude - 5) < 0.01);
  assert.ok(result.summary.confidence > 0.05, `confidence=${result.summary.confidence}`);
  assert.ok(Math.abs((result.summary.peakTimeSeconds ?? 0) - 4.1) < 1e-9);
});

void test("motion extraction command is deterministic grayscale rawvideo with ROI crop", () => {
  const args = buildLaboratoryMotionExtractionCommand({
    sourcePath: "/source/input.mp4",
    startSeconds: 10,
    endSeconds: 11,
    roi: { x: 0.1, y: 0.2, width: 0.4, height: 0.5 },
    geometry: { width: 96, height: 68 },
    outputPath: "/project/edit/output/motion.gray",
  }).join(" ");

  assert.match(args, /-ss 10 -t 1 -i \/source\/input\.mp4/);
  assert.match(args, /crop=iw\*0\.4:ih\*0\.5:iw\*0\.1:ih\*0\.2/);
  assert.match(args, /fps=10/);
  assert.match(args, /scale=96:68:flags=bilinear/);
  assert.match(args, /format=gray/);
  assert.match(args, /-f rawvideo/);
});

void test("reference lock feeds motion subtraction and impact midpoint windows", async () => {
  let project: Record<string, unknown> = {
    source: {
      kind: "video",
      storedPath: "/source/input.mp4",
      metadata: { durationSeconds: 30, width: 1920, height: 1080 },
    },
    edit: { temporalStressTests: [] },
  };
  const calls: string[][] = [];
  const geometry = { width: 96, height: 54 };
  const first = makeTextureFrame(geometry.width, geometry.height);
  const second = shiftFrame(first, geometry.width, geometry.height, 1, 0);
  const rawFrames = concatenateFrames([first, second]);

  const runtime = createLaboratoryMotionImpactProbeRuntime({
    async callRoomTools(payload) {
      const args = Array.isArray(payload["args"]) ? (payload["args"] as string[]) : [];
      calls.push(args);
      return { run: { exitCode: 0, stderr: "" } };
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
    async readBinaryFileBytes() {
      return rawFrames;
    },
    roomId: "laboratory",
    toRecord,
  });

  const referenceRequest = {
    startSeconds: 4,
    endSeconds: 6,
    sampleFps: 5,
    roi: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  };
  const lock = await runtime.lockReferenceRegion({}, "req-lock", referenceRequest);
  assert.equal(lock.kind, "motion-reference-lock");

  const motion = await runtime.runMotionProbe({}, "req-motion", referenceRequest);
  assert.equal(motion.kind, "motion-vector-probe");
  assert.equal(motion.method.vectorSpace, "source-pixels-per-frame");
  assert.ok(motion.reference !== null);
  assert.ok(motion.relative !== null);
  assert.ok(Math.abs(motion.relative?.magnitude ?? 1) < 1e-9);

  const beforeImpactCallCount = calls.length;
  const impact = await runtime.runImpactWindowCompare({}, "req-impact", referenceRequest);
  assert.equal(impact.kind, "impact-window-compare");
  assert.equal(impact.impactTimeSeconds, 5);
  assert.equal(impact.before.startSeconds, 4.5);
  assert.equal(impact.before.endSeconds, 5);
  assert.equal(impact.after.startSeconds, 5);
  assert.equal(impact.after.endSeconds, 5.5);
  assert.ok(Math.abs(impact.compare.referenceLagMs ?? 1) < 1e-9);
  assert.equal(calls.length - beforeImpactCallCount, 4);

  const impactArgs = calls.slice(beforeImpactCallCount).map((args) => args.join(" "));
  assert.ok(impactArgs.some((args) => args.includes("-ss 4.5 -t 0.5")));
  assert.ok(impactArgs.some((args) => args.includes("-ss 5 -t 0.5")));

  const history = toRecord(project["edit"])["temporalStressTests"] as unknown[];
  assert.equal(toRecord(history[0])["kind"], "impact-window-compare");
  assert.ok(history.some((entry) => toRecord(entry)["kind"] === "motion-vector-probe"));
  assert.ok(history.some((entry) => toRecord(entry)["kind"] === "motion-reference-lock"));
});

void test("motion and impact controls are exposed and wired through host actions", async () => {
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
      roi: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 },
    },
  } as never);
  assert.match(markup, /workspace-motion-reference-lock/);
  assert.match(markup, /workspace-motion-probe/);
  assert.match(markup, /workspace-impact-window-compare/);

  const controller = await readFile(
    "rooms/laboratory/runtime/controller/lab-transform-stack-live-controller.ts",
    "utf8"
  );
  const router = await readFile("rooms/laboratory/shared/host/action-router.ts", "utf8");
  assert.match(controller, /edit-motion-reference-lock/);
  assert.match(controller, /edit-motion-probe/);
  assert.match(controller, /edit-impact-window-compare/);
  assert.match(router, /case "edit-motion-reference-lock"/);
  assert.match(router, /case "edit-motion-probe"/);
  assert.match(router, /case "edit-impact-window-compare"/);
});

void test("motion and impact summaries render measured vectors without causal claims", () => {
  const markup = renderWorkspaceMotionImpactSummaries(
    {
      temporalStressTests: [
        {
          kind: "impact-window-compare",
          impactTimeSeconds: 5,
          before: {
            target: { summary: { magnitude: 1, frameDifferenceMean: 0.01 } },
            reference: { summary: { magnitude: 0.5, frameDifferenceMean: 0.005 } },
            relative: { magnitude: 0.5, angleDegrees: 0 },
          },
          after: {
            target: { summary: { magnitude: 3, frameDifferenceMean: 0.02 } },
            reference: { summary: { magnitude: 1, frameDifferenceMean: 0.006 } },
            relative: { magnitude: 2, angleDegrees: 20 },
          },
          compare: {
            relativeMagnitudeDelta: 1.5,
            relativeDirectionDeltaDegrees: 20,
            targetPeakTimeSeconds: 4.9,
            referencePeakTimeSeconds: 5.1,
            referenceLagMs: 200,
            targetFrameDifferenceDelta: 0.01,
            referenceFrameDifferenceDelta: 0.001,
          },
        },
        {
          kind: "motion-vector-probe",
          request: {
            startSeconds: 4,
            endSeconds: 6,
            roi: { x: 0.2, y: 0.2, width: 0.4, height: 0.4 },
          },
          target: {
            summary: {
              dx: 3,
              dy: -2,
              magnitude: Math.hypot(3, 2),
              angleDegrees: -33.69,
              confidence: 0.8,
              frameDifferenceMean: 0.01,
              frameDifferencePeak: 0.02,
            },
          },
          reference: {
            summary: {
              dx: 1,
              dy: -1,
              magnitude: Math.SQRT2,
              angleDegrees: -45,
              confidence: 0.7,
            },
          },
          relative: {
            dx: 2,
            dy: -1,
            magnitude: Math.sqrt(5),
            angleDegrees: -26.565,
            confidence: 0.7,
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

  assert.match(markup, /data-lab-motion-probe-summary="true"/);
  assert.match(markup, /data-lab-impact-window-summary="true"/);
  assert.match(markup, /Göreli dx \/ dy/);
  assert.match(markup, /Reference lag/);
  assert.match(markup, /\+200 ms/);
  assert.match(markup, /nedensellik kanıtı değildir/);
});
