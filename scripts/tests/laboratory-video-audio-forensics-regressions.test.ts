import assert from "node:assert/strict";
import test from "node:test";

import { createVideoAudioForensicsArtifactRuntime } from "../../rooms/laboratory/features/media-analysis/host/video-audio-forensics-artifacts.ts";

void test("video audio forensics emits a shared source/difference plus aligned spectral artifacts", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const runtime = createVideoAudioForensicsArtifactRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    buildBaselineEditCommand(_runtime, _project, targetPath) {
      return [
        "-y",
        "-i",
        "/source/input.mp4",
        "-c:a",
        "aac",
        "-c:v",
        "libx264",
        targetPath,
      ];
    },
    async callRoomTools(payload) {
      calls.push(payload);
      return { run: { exitCode: 0 } };
    },
    getProjectEditDir() {
      return "/project/edit";
    },
    getProjectEditPreviewDir() {
      return "/project/edit/preview";
    },
    roomId: "laboratory",
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    },
  });

  const artifacts = await runtime.buildAuxiliaryArtifacts(
    {},
    {
      source: { kind: "video" },
      edit: {
        recipe: {
          video: { includeAudio: true },
          audio: {
            transformStages: [
              {
                id: "noise-1",
                kind: "noise-profile",
                enabled: true,
                params: {
                  profileStartSec: 0.5,
                  profileEndSec: 1.5,
                  reductionDb: 12,
                  noiseFloorDb: -50,
                },
              },
            ],
          },
        },
      },
    },
    {
      baseName: "video-preview",
      jobId: "job-video-audio",
      mode: "preview",
      outputPath: "/project/edit/preview/video-preview.mp4",
      requestId: "req-video-audio",
    }
  );

  assert.deepEqual(
    artifacts.map((entry) => entry.kind),
    [
      "transform-source-baseline",
      "transform-difference",
      "spectrogram-source",
      "spectrogram",
      "waveform-source",
      "waveform",
    ]
  );

  const combinedDifference = calls.find((call) => {
    const args = ((call["args"] as string[]) || []).join(" ");
    return args.includes("blend=all_mode=difference") && args.includes("c0=c0-c2|c1=c1-c3");
  });
  assert.ok(combinedDifference);
  assert.match(
    ((combinedDifference?.["args"] as string[]) || []).join(" "),
    /-map \[vd\].*-map \[ad\]/
  );

  const spectrogramCalls = calls.filter((call) =>
    ((call["args"] as string[]) || []).some((entry) => entry.includes("showspectrumpic"))
  );
  assert.equal(spectrogramCalls.length, 2);
  for (const call of spectrogramCalls) {
    assert.match(((call["args"] as string[]) || []).join(" "), /start=20:stop=20000/);
  }

  const waveformCalls = calls.filter((call) =>
    ((call["args"] as string[]) || []).some((entry) => entry.includes("showwavespic"))
  );
  assert.equal(waveformCalls.length, 2);
});

void test("video audio sweep renders variants from the reusable baseline audio track", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const runtime = createVideoAudioForensicsArtifactRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    buildBaselineEditCommand(_runtime, _project, targetPath) {
      return ["-y", "-i", "/source/input.mp4", "-c:a", "aac", "-c:v", "libx264", targetPath];
    },
    async callRoomTools(payload) {
      calls.push(payload);
      return { run: { exitCode: 0 } };
    },
    getProjectEditDir() {
      return "/project/edit";
    },
    getProjectEditPreviewDir() {
      return "/project/edit/preview";
    },
    roomId: "laboratory",
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    },
  });

  const artifacts = await runtime.buildAuxiliaryArtifacts(
    {},
    {
      source: { kind: "video" },
      edit: {
        recipe: {
          video: { includeAudio: true },
          audio: {
            transformStages: [
              {
                id: "sweep-1",
                kind: "parameter-sweep",
                enabled: true,
                params: {
                  primaryAxis: "pitch",
                  secondaryAxis: "speed",
                  pitchStart: 0,
                  pitchEnd: 1,
                  pitchStep: 1,
                  speedStart: 1,
                  speedEnd: 1,
                  speedStep: 1,
                  maxVariants: 4,
                },
              },
            ],
          },
        },
      },
    },
    {
      baseName: "video-sweep",
      mode: "preview",
      outputPath: "/project/edit/preview/video-sweep.mp4",
    }
  );

  const variants = artifacts.filter((entry) => entry.kind === "audio-sweep-variant");
  assert.equal(variants.length, 2);
  const sweepCalls = calls.filter((call) => {
    const args = (call["args"] as string[]) || [];
    return args.some((entry) => entry.includes("video-sweep-audio-sweep"));
  });
  assert.equal(sweepCalls.length, 2);
  assert.ok(
    sweepCalls.every((call) => ((call["args"] as string[]) || []).includes("0:a:0"))
  );
});
