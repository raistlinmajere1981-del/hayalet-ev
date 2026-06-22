import { assert, createLabWaveformTimelineVisualizer, createTestAudioFocusSettings, FakeCanvasElement, FakeMediaElement, FakeVisualizerAudioContext, FakeVisualizerDocument, FakeVisualizerWindow, flushVisualizerWork, test } from "./laboratory-runtime-truth.helpers.ts";

import type { LabArtifactProjection } from "./laboratory-runtime-truth.helpers.ts";
import type { LabWaveformTimelineModel } from "../../rooms/laboratory/ui/lab-waveform-timeline-types.ts";
import type { LabBookmark } from "../../rooms/laboratory/domain/lab-types.ts";


describe("workspace audio visualizer initializes lazily and disconnects on source changes", () => {
void test("workspace audio visualizer initializes lazily and disconnects on source changes", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const firstAudio = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(firstAudio, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getVisualizationArtifact() {
      return null;
    },
    getVisualizationMode() {
      return "waveform";
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  assert.equal(FakeVisualizerAudioContext.constructed.length, 0);
  assert.equal(windowRef.scheduledFrames.size, 0);

  await firstAudio.play();
  await flushVisualizerWork();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  const audioContext = FakeVisualizerAudioContext.constructed[0];
  assert.equal(audioContext?.resumeCalls, 1);
  assert.equal(audioContext.sourceNodes.length, 1);
  assert.equal(windowRef.scheduledFrames.size, 1);

  windowRef.flushFrame();
  await flushVisualizerWork();
  assert.ok(canvas.context.clearRectCalls > 0);
  assert.ok(canvas.context.strokeCalls > 0);
  assert.equal(windowRef.scheduledFrames.size, 1);

  const secondAudio = new FakeMediaElement();
  documentRef.primaryMediaPreview = secondAudio;
  visualizer.sync();

  assert.equal(audioContext.sourceNodes[0]?.disconnectCalls, 1);
  assert.equal(windowRef.scheduledFrames.size, 0);

  visualizer.dispose();
});
void test("workspace audio visualizer updates preview audio focus without recreating the live controller", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  let audioFocus = createTestAudioFocusSettings({
    gain: 1.6,
    filterType: "lowpass",
    filterFrequency: 1400,
    filterQ: 1.8,
    playbackRate: 1.4,
    preservePitch: false,
    visualizationMode: "waveform" as const,
    eqBands: [
      { frequency: 60, gain: 1.5, Q: 1, type: "lowshelf" as const },
      { frequency: 250, gain: -2, Q: 0.9, type: "peaking" as const },
      { frequency: 1000, gain: 0, Q: 1.2, type: "peaking" as const },
      { frequency: 4000, gain: 3, Q: 1.4, type: "peaking" as const },
      { frequency: 12000, gain: 2, Q: 1, type: "highshelf" as const },
    ],
  });
  let bookmarkCount = 0;
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getTimelineModel(): LabWaveformTimelineModel {
      return {
        audioFocus,
        bookmarks: Array.from({ length: bookmarkCount }, function (_, index) {
          return {
            id: `bookmark-${String(index)}`,
            label: `Bookmark ${String(index)}`,
            timeMs: index * 500,
          } as unknown as LabBookmark;
        }),
        durationMs: 0,
        endMs: null,
        startMs: null,
        visualizationArtifact: null,
        visualizationMode: "waveform",
        waveformCropEndRatio: 1,
        waveformCropStartRatio: 0,
        waveformSourceLabel: "Waveform",
        waveformSyncLabel: "Preview and waveform share the same master axis.",
        waveformWindowDurationMs: 0,
        waveformWindowStartMs: 0,
      };
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await audioPreview.play();
  await flushVisualizerWork();

  const audioContext = FakeVisualizerAudioContext.constructed[0];
  const gainNode = audioContext?.gainNodes[0];
  const primaryFilter = audioContext?.biquadFilters[0];
  const initialGainCalls = gainNode?.gain.setTargetCalls.length ?? 0;
  const initialFilterCalls = primaryFilter?.frequency.setTargetCalls.length ?? 0;
  const initialPlaybackSetCalls = audioPreview.playbackRateSetCalls;
  const initialPitchSetCalls = audioPreview.pitchSetCalls;

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(audioContext?.sourceNodes.length, 1);
  assert.equal(audioPreview.playbackRate, 1.4);
  assert.equal(audioPreview.preservesPitch, false);
  assert.deepEqual(gainNode?.gain.setTargetCalls.at(-1), [1.6, 0, 0.01]);
  assert.deepEqual(primaryFilter?.frequency.setTargetCalls.at(-1), [1400, 0, 0.01]);

  bookmarkCount = 2;
  visualizer.sync();
  await flushVisualizerWork();

  assert.equal(gainNode.gain.setTargetCalls.length, initialGainCalls);
  assert.equal(primaryFilter.frequency.setTargetCalls.length, initialFilterCalls);
  assert.equal(audioPreview.playbackRateSetCalls, initialPlaybackSetCalls);
  assert.equal(audioPreview.pitchSetCalls, initialPitchSetCalls);
  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);

  audioFocus = {
    ...audioFocus,
    gain: 0.7,
    filterQ: 4.2,
    playbackRate: 0.7,
    preservePitch: true,
    eqBands: audioFocus.eqBands.map(function (band, index) {
      return index === 3 ? { ...band, gain: 5 } : band;
    }),
  };
  visualizer.sync();
  await flushVisualizerWork();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(audioContext.sourceNodes.length, 1);
  assert.equal(audioPreview.playbackRate, 0.7);
  assert.equal(audioPreview.preservesPitch, true);
  assert.deepEqual(gainNode.gain.setTargetCalls.at(-1), [0.7, 0, 0.01]);
  assert.deepEqual(primaryFilter.Q.setTargetCalls.at(-1), [4.2, 0, 0.01]);
  assert.deepEqual(audioContext.biquadFilters[4]?.gain.setTargetCalls.at(-1), [5, 0, 0.01]);
  assert.equal(gainNode.gain.setTargetCalls.length, initialGainCalls + 1);
  assert.equal(audioPreview.playbackRateSetCalls > initialPlaybackSetCalls, true);
  assert.equal(audioPreview.pitchSetCalls > initialPitchSetCalls, true);

  visualizer.dispose();
});
void test("workspace audio visualizer prioritizes live spectrum rendering over artifact fallback during playback", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  let artifact: LabArtifactProjection | null = {
    id: "artifact-spectrogram",
    kind: "spectrogram",
    previewUrl: "file:///tmp/spectrogram-artifact.png",
    path: "/tmp/spectrogram-artifact.png",
    fileName: "spectrogram-artifact.png",
    createdAt: new Date().toISOString(),
  };
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getVisualizationArtifact() {
      return artifact;
    },
    getVisualizationMode() {
      return "spectrum";
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(canvas.context.drawImageCalls, 1);

  await audioPreview.play();
  await flushVisualizerWork();
  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  windowRef.flushFrame();
  await flushVisualizerWork();
  assert.ok(canvas.context.fillRectCalls > 0);

  artifact = null;
  visualizer.sync();
  await flushVisualizerWork();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(windowRef.scheduledFrames.size, 1);
});
void test("workspace audio visualizer ignores stale artifact image loads after the selection changes", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  FakeVisualizerWindow.imageLoadBehavior.set("file:///tmp/slow-waveform.png", "defer");
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  let artifact: LabArtifactProjection | null = {
    id: "artifact-waveform-slow",
    kind: "waveform",
    previewUrl: "file:///tmp/slow-waveform.png",
    path: "/tmp/slow-waveform.png",
    fileName: "slow-waveform.png",
    createdAt: new Date(Date.now() - 1000).toISOString(),
  };
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getVisualizationArtifact() {
      return artifact;
    },
    getVisualizationMode() {
      return "waveform";
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await Promise.resolve();
  assert.equal(canvas.context.drawImageCalls, 0);

  artifact = {
    id: "artifact-waveform-fast",
    kind: "waveform",
    previewUrl: "file:///tmp/fast-waveform.png",
    path: "/tmp/fast-waveform.png",
    fileName: "fast-waveform.png",
    createdAt: new Date().toISOString(),
  };
  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/fast-waveform.png");

  windowRef.flushDeferredImage("file:///tmp/slow-waveform.png");
  await Promise.resolve();

  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/fast-waveform.png");
});
});
