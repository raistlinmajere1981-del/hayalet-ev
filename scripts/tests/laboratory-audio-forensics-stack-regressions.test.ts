import assert from "node:assert/strict";
import test from "node:test";

import { createMediaEditArtifactRuntime } from "../../rooms/laboratory/features/media-analysis/host/edit-artifacts.ts";
import {
  buildLaboratoryAudioSweepPlan,
  compileTransformStressTestFilters,
} from "../../rooms/laboratory/features/media-analysis/host/transform-stress-test.ts";
import {
  getLaboratoryTransformStageDefinitions,
  normalizeLaboratoryTransformStages,
} from "../../rooms/laboratory/shared/transform-stress-test-model.ts";
import { attachLaboratoryTransformStackRenderContext } from "../../rooms/laboratory/shared/transform-stack-render-context.ts";
import { renderWorkspaceAudioFocus } from "../../rooms/laboratory/ui/workspace-audio-focus.ts";

function createArtifactRuntime(calls: Array<Record<string, unknown>>) {
  return createMediaEditArtifactRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    asNumber(value: unknown) {
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    buildBaselineEditCommand(_runtime, _project, targetPath) {
      return ["-y", "-i", "/source/input.wav", "-c:a", "pcm_s16le", targetPath];
    },
    async callRoomTools(payload) {
      calls.push(payload);
      return { run: { exitCode: 0 } };
    },
    clampNumber(value: unknown, min: number, max: number, fallback: number) {
      const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
      return Math.max(min, Math.min(max, numeric));
    },
    getProjectEditDir() {
      return "/project/edit";
    },
    getProjectEditOutputDir() {
      return "/project/edit/output";
    },
    getProjectEditPreviewDir() {
      return "/project/edit/preview";
    },
    async listDirectory() {
      return [];
    },
    roomId: "laboratory",
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    },
  });
}

void test("audio transform stack exposes reconstruction, channel, phase and sweep stages", () => {
  const kinds = getLaboratoryTransformStageDefinitions("audio").map((entry) => entry.kind);
  for (const expected of [
    "speed",
    "pitch-shift",
    "band-pass",
    "eq",
    "formant-shift",
    "spectral-envelope",
    "audio-denoise",
    "noise-profile",
    "compressor",
    "channel-matrix",
    "polarity",
    "parameter-sweep",
  ]) {
    assert.ok(kinds.includes(expected as never), `missing ${expected}`);
  }
});

void test("audio transform compiler preserves user stage order and separates speed from pitch", () => {
  const filters = compileTransformStressTestFilters({
    source: { kind: "audio" },
    edit: {
      recipe: {
        audio: {
          transformStages: [
            { id: "speed-1", kind: "speed", enabled: true, params: { factor: 0.5 } },
            {
              id: "pitch-1",
              kind: "pitch-shift",
              enabled: true,
              params: { semitones: 6, formantMode: "shifted" },
            },
            {
              id: "band-1",
              kind: "band-pass",
              enabled: true,
              params: { mode: "center-q", centerHz: 1200, q: 4 },
            },
            {
              id: "eq-1",
              kind: "eq",
              enabled: true,
              params: { frequencyHz: 1500, gainDb: 6, q: 2 },
            },
            {
              id: "side-1",
              kind: "channel-matrix",
              enabled: true,
              params: { mode: "side" },
            },
          ],
        },
      },
    },
  }).audio;

  assert.match(filters[0] || "", /^atempo=/);
  assert.equal(filters[1], "aresample=48000");
  assert.match(filters.join(","), /asetrate=/);
  assert.ok(filters.findIndex((entry) => entry.startsWith("highpass=")) > 1);
  assert.ok(filters.findIndex((entry) => entry.startsWith("equalizer=")) > 1);
  assert.match(filters.at(-1) || "", /pan=mono\|c0=0\.5\*c0-0\.5\*c1/);
});

void test("pitch x speed sweep builds a bounded Cartesian variant set with provenance-ready stages", () => {
  const stages = normalizeLaboratoryTransformStages(
    [
      {
        id: "sweep-1",
        kind: "parameter-sweep",
        enabled: true,
        params: {
          primaryAxis: "pitch",
          secondaryAxis: "speed",
          pitchStart: -1,
          pitchEnd: 1,
          pitchStep: 1,
          speedStart: 0.5,
          speedEnd: 1,
          speedStep: 0.5,
          maxVariants: 20,
        },
      },
    ],
    "audio"
  );
  const plan = buildLaboratoryAudioSweepPlan(stages);

  assert.ok(plan);
  assert.equal(plan?.requestedVariantCount, 6);
  assert.equal(plan?.variants.length, 6);
  assert.equal(plan?.truncated, false);
  assert.ok(
    plan?.variants.every((variant) =>
      variant.stages.every((stage) => stage.kind !== "parameter-sweep")
    )
  );
  assert.ok(
    plan?.variants.some((variant) => variant.filters.some((filter) => filter.startsWith("atempo=")))
  );
  assert.ok(
    plan?.variants.some((variant) =>
      variant.filters.some((filter) => filter.startsWith("asetrate="))
    )
  );
});

void test("audio preview emits aligned source transform difference waveform and 20 Hz-20 kHz spectrogram artifacts", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const runtime = createArtifactRuntime(calls);
  const artifacts = await runtime.buildAuxiliaryArtifacts(
    {},
    {
      source: { kind: "audio" },
      edit: {
        recipe: {
          audio: {
            transformStages: [{ id: "gain-1", kind: "gain", enabled: true, params: { db: 3 } }],
          },
        },
      },
    },
    {
      baseName: "audio-preview",
      jobId: "job-audio",
      mode: "preview",
      outputPath: "/project/edit/preview/audio-preview.wav",
      requestId: "req-audio",
    }
  );

  assert.deepEqual(
    artifacts.map((entry) => entry.kind),
    [
      "transform-source-baseline",
      "transform-difference",
      "spectrogram",
      "spectrogram-source",
      "waveform",
      "waveform-source",
    ]
  );
  const differenceArgs = calls[1]?.["args"] as string[];
  assert.match(differenceArgs.join(" "), /c0=c0-c2\|c1=c1-c3/);
  const spectrogramCalls = calls.filter((call) =>
    ((call["args"] as string[]) || []).some((entry) => entry.includes("showspectrumpic"))
  );
  assert.equal(spectrogramCalls.length, 2);
  for (const call of spectrogramCalls) {
    assert.match((call["args"] as string[]).join(" "), /start=20:stop=20000/);
  }
  const waveformCalls = calls.filter((call) =>
    ((call["args"] as string[]) || []).some((entry) => entry.includes("showwavespic"))
  );
  assert.equal(waveformCalls.length, 2);
});

void test("audio forensic UI keeps waveform context beside spectrogram, three-way listening and A/B sweep controls", () => {
  const audioFocus = attachLaboratoryTransformStackRenderContext(
    {
      gain: 1,
      filterType: "none" as const,
      filterFrequency: 1000,
      filterQ: 1,
      playbackRate: 1,
      preservePitch: true,
      visualizationMode: "waveform" as const,
      eqBands: [
        { frequency: 60, gain: 0, Q: 1, type: "lowshelf" as const },
        { frequency: 250, gain: 0, Q: 1, type: "peaking" as const },
        { frequency: 1000, gain: 0, Q: 1, type: "peaking" as const },
        { frequency: 4000, gain: 0, Q: 1, type: "peaking" as const },
        { frequency: 12000, gain: 0, Q: 1, type: "highshelf" as const },
      ],
    },
    {
      editConfig: {
        recipe: { audio: { transformStages: [] } },
        preview: {
          previewUrl: "file:///transform.wav",
          artifacts: [
            { kind: "transform-source-baseline", previewUrl: "file:///source.wav" },
            { kind: "transform-difference", previewUrl: "file:///difference.wav" },
            { kind: "waveform-source", previewUrl: "file:///source-wave.png" },
            { kind: "waveform", previewUrl: "file:///transform-wave.png" },
            { kind: "spectrogram-source", previewUrl: "file:///source-spectrum.png" },
            { kind: "spectrogram", previewUrl: "file:///transform-spectrum.png" },
            {
              kind: "audio-sweep-variant",
              previewUrl: "file:///variant.wav",
              metadata: { label: "pitch +1 st", requestedVariantCount: 1 },
            },
          ],
        },
      } as never,
      featureId: "audio-analysis",
      locked: false,
      sourceKind: "audio",
    }
  );

  const markup = renderWorkspaceAudioFocus(audioFocus, { temporalAudioFocus: audioFocus });
  assert.match(markup, /Waveform \+ Spectrogram · 20 Hz–20 kHz/);
  assert.match(markup, />Source</);
  assert.match(markup, />Transform</);
  assert.match(markup, /Audio Difference/);
  assert.match(markup, /data-lab-action="workspace-noise-profile-capture"/);
  assert.match(markup, /data-lab-action="workspace-audio-sweep-ab"/);
  assert.match(markup, /data-lab-transform-stack="audio"/);
});

void test("audio forensic UI remains available for embedded video audio", () => {
  const audioFocus = attachLaboratoryTransformStackRenderContext(
    {
      gain: 1,
      filterType: "none" as const,
      filterFrequency: 1000,
      filterQ: 1,
      playbackRate: 1,
      preservePitch: true,
      visualizationMode: "waveform" as const,
      eqBands: [],
    },
    {
      editConfig: {
        recipe: { audio: { transformStages: [] } },
      } as never,
      featureId: "audio-analysis",
      locked: false,
      sourceKind: "video",
    }
  );

  const markup = renderWorkspaceAudioFocus(audioFocus, {
    previewTarget: "video",
    temporalAudioFocus: audioFocus,
  });
  assert.match(markup, /data-lab-audio-forensics="true"/);
  assert.match(markup, /data-lab-action="workspace-noise-profile-capture"/);
  assert.match(markup, /data-lab-transform-stack="audio"/);
});
