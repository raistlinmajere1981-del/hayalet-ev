import type { LabStoreEvent } from "../../rooms/laboratory/domain/lab-types.ts";
import {
  assert,
  createAudioVisualizer,
  createLabStore,
  createTestAudioFocusSettings,
  FakeCanvasElement,
  FakeMediaElement,
  FakeVisualizerAudioContext,
  FakeVisualizerDocument,
  FakeVisualizerWindow,
  flushVisualizerWork,
  getAudioVisualizationArtifact,
  renderWorkspaceAudioFocus,
  test,
} from "./laboratory-runtime-truth.helpers.ts";


describe("runtime audio visualizer draws waveform frames and scales with device pixel rati", () => {
void test("runtime audio visualizer draws waveform frames and scales with device pixel ratio", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const media = new FakeMediaElement();
  media.paused = false;
  const canvas = new FakeCanvasElement();
  canvas.clientWidth = 200;
  canvas.clientHeight = 60;
  const documentRef = new FakeVisualizerDocument(media, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  windowRef.devicePixelRatio = 3;
  const controller = createAudioVisualizer(
    media as unknown as HTMLMediaElement,
    canvas as unknown as HTMLCanvasElement,
    {
      documentRef: documentRef as unknown as Document,
      getMode() {
        return "waveform";
      },
      windowRef: windowRef as unknown as Window,
    }
  );

  controller.start();
  await flushVisualizerWork();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(canvas.width, 600);
  assert.equal(canvas.height, 180);
  assert.deepEqual(canvas.context.transformCalls.at(-1), [3, 0, 0, 3, 0, 0]);
  assert.ok(canvas.context.strokeCalls > 0);
  assert.equal(windowRef.scheduledFrames.size, 1);

  controller.destroy();
});
void test("runtime audio visualizer renders frequency data in spectrum mode", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const media = new FakeMediaElement();
  media.paused = false;
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(media, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  const controller = createAudioVisualizer(
    media as unknown as HTMLMediaElement,
    canvas as unknown as HTMLCanvasElement,
    {
      documentRef: documentRef as unknown as Document,
      getMode() {
        return "spectrum";
      },
      windowRef: windowRef as unknown as Window,
    }
  );

  controller.start();
  await flushVisualizerWork();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.ok(canvas.context.fillRectCalls > 0);
  assert.equal(windowRef.scheduledFrames.size, 1);

  controller.destroy();
});
void test("runtime audio visualizer applies preview audio focus through a stable processing graph", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const media = new FakeMediaElement();
  media.paused = false;
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(media, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  const audioFocus = createTestAudioFocusSettings({
    gain: 2.4,
    filterType: "highpass",
    filterFrequency: 1280,
    filterQ: 7.5,
    playbackRate: 0.65,
    preservePitch: false,
    visualizationMode: "waveform",
    eqBands: [
      { frequency: 60, gain: -6, Q: 1.4, type: "lowshelf" },
      { frequency: 250, gain: -3.5, Q: 0.8, type: "peaking" },
      { frequency: 1000, gain: 2.5, Q: 1.2, type: "peaking" },
      { frequency: 4000, gain: 4.5, Q: 1.6, type: "peaking" },
      { frequency: 12000, gain: 3, Q: 0.9, type: "highshelf" },
    ],
  });
  const controller = createAudioVisualizer(
    media as unknown as HTMLMediaElement,
    canvas as unknown as HTMLCanvasElement,
    {
      documentRef: documentRef as unknown as Document,
      getAudioFocus() {
        return audioFocus;
      },
      getMode() {
        return "waveform";
      },
      windowRef: windowRef as unknown as Window,
    }
  );

  controller.start();
  await flushVisualizerWork();

  const audioContext = FakeVisualizerAudioContext.constructed[0];
  const gainNode = audioContext?.gainNodes[0];
  const primaryFilter = audioContext?.biquadFilters[0];
  const eqNodes = audioContext?.biquadFilters.slice(1) ?? [];

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(audioContext?.sourceNodes.length, 1);
  assert.equal(audioContext?.gainNodes.length, 1);
  assert.equal(audioContext?.biquadFilters.length, 6);
  assert.equal(audioContext?.sourceNodes[0]?.connectedTargets[0], gainNode);
  assert.equal(gainNode?.connectedTargets[0], primaryFilter);
  assert.equal(primaryFilter?.connectedTargets[0], eqNodes[0]);
  assert.equal(eqNodes.at(-1)?.connectedTargets[0], audioContext?.analyser);
  assert.equal(audioContext?.analyser.connectedTargets[0], audioContext?.destination);
  assert.equal(media.playbackRate, 0.65);
  assert.equal(media.preservesPitch, false);
  assert.equal(media.mozPreservesPitch, false);
  assert.equal(media.webkitPreservesPitch, false);
  assert.deepEqual(gainNode?.gain.setTargetCalls.at(-1), [2.4, 0, 0.01]);
  assert.equal(primaryFilter?.type, "highpass");
  assert.deepEqual(primaryFilter?.frequency.setTargetCalls.at(-1), [1280, 0, 0.01]);
  assert.deepEqual(primaryFilter?.Q.setTargetCalls.at(-1), [7.5, 0, 0.01]);
  assert.equal(eqNodes[0]?.type, "lowshelf");
  assert.deepEqual(eqNodes[0]?.gain.setTargetCalls.at(-1), [-6, 0, 0.01]);
  assert.equal(eqNodes[4]?.type, "highshelf");
  assert.deepEqual(eqNodes[4]?.gain.setTargetCalls.at(-1), [3, 0, 0.01]);

  controller.destroy();
});
void test("runtime audio visualizer clamps preview audio focus values and skips unchanged param reapply", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const media = new FakeMediaElement();
  media.paused = false;
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(media, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  let audioFocus = createTestAudioFocusSettings({
    gain: 9,
    filterType: "bandpass",
    filterFrequency: 40_000,
    filterQ: 0.01,
    playbackRate: 5,
    preservePitch: false,
    visualizationMode: "waveform",
    eqBands: [
      { frequency: 5, gain: -30, Q: 99, type: "lowshelf" },
      { frequency: 250, gain: 15, Q: 0.01, type: "peaking" },
      { frequency: 1000, gain: 0, Q: 1, type: "peaking" },
      { frequency: 4000, gain: -18, Q: 25, type: "peaking" },
      { frequency: 50_000, gain: 22, Q: 0.02, type: "highshelf" },
    ],
  });
  const controller = createAudioVisualizer(
    media as unknown as HTMLMediaElement,
    canvas as unknown as HTMLCanvasElement,
    {
      documentRef: documentRef as unknown as Document,
      getAudioFocus() {
        return audioFocus;
      },
      getMode() {
        return "waveform";
      },
      windowRef: windowRef as unknown as Window,
    }
  );

  controller.start();
  await flushVisualizerWork();

  const audioContext = FakeVisualizerAudioContext.constructed[0];
  const gainNode = audioContext?.gainNodes[0];
  const primaryFilter = audioContext?.biquadFilters[0];
  const eqNodes = audioContext?.biquadFilters.slice(1) ?? [];
  const initialGainCalls = gainNode?.gain.setTargetCalls.length ?? 0;
  const initialFilterCalls = primaryFilter?.frequency.setTargetCalls.length ?? 0;
  const initialPlaybackSetCalls = media.playbackRateSetCalls;
  const initialPitchSetCalls = media.pitchSetCalls;

  assert.equal(media.playbackRate, 2);
  assert.equal(media.preservesPitch, false);
  assert.deepEqual(gainNode?.gain.setTargetCalls.at(-1), [3, 0, 0.01]);
  assert.deepEqual(primaryFilter?.frequency.setTargetCalls.at(-1), [20000, 0, 0.01]);
  assert.deepEqual(primaryFilter?.Q.setTargetCalls.at(-1), [0.1, 0, 0.01]);
  assert.deepEqual(eqNodes[0]?.frequency.setTargetCalls.at(-1), [20, 0, 0.01]);
  assert.deepEqual(eqNodes[0]?.gain.setTargetCalls.at(-1), [-12, 0, 0.01]);
  assert.deepEqual(eqNodes[4]?.frequency.setTargetCalls.at(-1), [20000, 0, 0.01]);
  assert.deepEqual(eqNodes[4]?.gain.setTargetCalls.at(-1), [12, 0, 0.01]);

  controller.start();
  await flushVisualizerWork();
  assert.equal(gainNode?.gain.setTargetCalls.length ?? 0, initialGainCalls);
  assert.equal(primaryFilter?.frequency.setTargetCalls.length ?? 0, initialFilterCalls);
  assert.equal(media.playbackRateSetCalls, initialPlaybackSetCalls);
  assert.equal(media.pitchSetCalls, initialPitchSetCalls);

  audioFocus = {
    ...audioFocus,
    playbackRate: 0.5,
    preservePitch: true,
  };
  controller.start();
  await flushVisualizerWork();

  const playbackOnlySetCalls = media.playbackRateSetCalls;
  const pitchOnlySetCalls = media.pitchSetCalls;
  assert.equal(media.playbackRate, 0.5);
  assert.equal(media.preservesPitch, true);
  assert.equal(gainNode?.gain.setTargetCalls.length ?? 0, initialGainCalls);
  assert.equal(primaryFilter?.frequency.setTargetCalls.length ?? 0, initialFilterCalls);
  assert.equal(media.playbackRateSetCalls, initialPlaybackSetCalls + 1);
  assert.equal(pitchOnlySetCalls > initialPitchSetCalls, true);

  audioFocus = {
    ...audioFocus,
    gain: 0.4,
    filterFrequency: 880,
    filterQ: 4.5,
    eqBands: audioFocus.eqBands.map(function (band, index) {
      return index === 1 ? { ...band, gain: -4 } : band;
    }),
  };
  controller.start();
  await flushVisualizerWork();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(audioContext?.sourceNodes.length, 1);
  assert.deepEqual(gainNode?.gain.setTargetCalls.at(-1), [0.4, 0, 0.01]);
  assert.deepEqual(primaryFilter?.frequency.setTargetCalls.at(-1), [880, 0, 0.01]);
  assert.deepEqual(primaryFilter?.Q.setTargetCalls.at(-1), [4.5, 0, 0.01]);
  assert.deepEqual(eqNodes[1]?.gain.setTargetCalls.at(-1), [-4, 0, 0.01]);
  assert.equal(gainNode?.gain.setTargetCalls.length ?? 0, initialGainCalls + 1);
  assert.equal(media.playbackRateSetCalls, playbackOnlySetCalls);
  assert.equal(media.pitchSetCalls, pitchOnlySetCalls);

  controller.destroy();
});
});
