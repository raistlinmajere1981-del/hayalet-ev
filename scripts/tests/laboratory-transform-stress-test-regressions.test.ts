import test from "node:test";
import assert from "node:assert/strict";

import {
  compileTransformStressTestFilters,
  extendEditCommandWithTransformStressTest,
} from "../../rooms/laboratory/features/media-analysis/host/transform-stress-test.ts";

function createProject(
  sourceKind: "video" | "image" | "audio",
  options: {
    videoStages?: unknown[];
    imageStages?: unknown[];
    audioStages?: unknown[];
    includeAudio?: boolean;
  } = {}
) {
  return {
    source: { kind: sourceKind },
    edit: {
      recipe: {
        video: {
          includeAudio: options.includeAudio === true,
          transformStages: options.videoStages || [],
        },
        image: { transformStages: options.imageStages || [] },
        audio: { transformStages: options.audioStages || [] },
      },
    },
  };
}

void test("visual transform stages preserve declared order and skip disabled stages", () => {
  const project = createProject("video", {
    videoStages: [
      { id: "gamma", kind: "gamma", enabled: true, params: { value: 1.8 } },
      { id: "disabled", kind: "contrast", enabled: false, params: { value: 2 } },
      { id: "blur", kind: "blur", enabled: true, params: { radius: 2 } },
      { id: "sharpen", kind: "sharpen", enabled: true, params: { amount: 0.7 } },
    ],
  });

  assert.deepEqual(compileTransformStressTestFilters(project).video, [
    "eq=gamma=1.8",
    "boxblur=2:1",
    "unsharp=5:5:0.7:5:5:0",
  ]);
});

void test("stress filters append after existing edit filters without replacing them", () => {
  const project = createProject("image", {
    imageStages: [
      { id: "brightness", kind: "brightness", enabled: true, params: { value: 0.2 } },
      { id: "gray", kind: "grayscale", enabled: true, params: {} },
    ],
  });
  const command = ["-y", "-i", "/tmp/source.png", "-vf", "crop=100:100:0:0", "-frames:v", "1", "/tmp/out.png"];

  const extended = extendEditCommandWithTransformStressTest(command, project);
  const filterIndex = extended.indexOf("-vf");
  assert.notEqual(filterIndex, -1);
  assert.equal(
    extended[filterIndex + 1],
    "crop=100:100:0:0,eq=brightness=0.2,hue=s=0"
  );
});

void test("band-pass remains adjacent in the ordered audio chain and gain follows it", () => {
  const project = createProject("audio", {
    audioStages: [
      { id: "band", kind: "band-pass", enabled: true, params: { lowHz: 120, highHz: 3200 } },
      { id: "gain", kind: "gain", enabled: true, params: { db: 6 } },
    ],
  });
  const command = ["-y", "-i", "/tmp/source.wav", "-c:a", "pcm_s16le", "/tmp/out.wav"];

  const extended = extendEditCommandWithTransformStressTest(command, project);
  const filterIndex = extended.indexOf("-af");
  assert.notEqual(filterIndex, -1);
  assert.equal(
    extended[filterIndex + 1],
    "highpass=f=120,lowpass=f=3200,volume=6dB"
  );
});

void test("video audio stress stages are omitted when includeAudio is disabled", () => {
  const project = createProject("video", {
    includeAudio: false,
    audioStages: [{ id: "gain", kind: "gain", enabled: true, params: { db: 4 } }],
  });
  const command = ["-y", "-i", "/tmp/source.mp4", "-an", "-c:v", "libx264", "/tmp/out.mp4"];

  const extended = extendEditCommandWithTransformStressTest(command, project);
  assert.equal(extended.includes("-af"), false);
});

void test("parameter bounds are clamped before reaching ffmpeg", () => {
  const project = createProject("image", {
    imageStages: [
      { id: "bright", kind: "brightness", enabled: true, params: { value: 99 } },
      { id: "denoise", kind: "denoise", enabled: true, params: { luma: -5, chroma: 99 } },
    ],
  });

  assert.deepEqual(compileTransformStressTestFilters(project).video, [
    "eq=brightness=1",
    "hqdn3d=0:20:0:20",
  ]);
});
