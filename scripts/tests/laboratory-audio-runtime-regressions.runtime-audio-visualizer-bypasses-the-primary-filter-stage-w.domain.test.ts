import { assert, createAudioVisualizer, createTestAudioFocusSettings, FakeCanvasElement, FakeMediaElement, FakeVisualizerAudioContext, FakeVisualizerDocument, FakeVisualizerWindow, flushVisualizerWork, test } from "./laboratory-runtime-truth.helpers.ts";


describe("runtime audio visualizer bypasses the primary filter stage when filter type is n", () => {
void test("runtime audio visualizer bypasses the primary filter stage when filter type is none", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const media = new FakeMediaElement();
  media.paused = false;
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(media, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  let audioFocus = createTestAudioFocusSettings({
    gain: 1.1,
    filterType: "none",
    filterFrequency: 1000,
    filterQ: 1,
    visualizationMode: "waveform",
    eqBands: [
      { frequency: 60, gain: 0, Q: 1, type: "lowshelf" },
      { frequency: 250, gain: 0, Q: 1, type: "peaking" },
      { frequency: 1000, gain: 0, Q: 1, type: "peaking" },
      { frequency: 4000, gain: 0, Q: 1, type: "peaking" },
      { frequency: 12000, gain: 0, Q: 1, type: "highshelf" },
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
  const firstEqNode = audioContext?.biquadFilters[1];

  assert.equal(gainNode?.connectedTargets.at(-1), firstEqNode);

  audioFocus = {
    ...audioFocus,
    filterType: "lowpass",
    filterFrequency: 850,
  };
  controller.start();
  await flushVisualizerWork();

  assert.equal(gainNode?.connectedTargets.at(-1), primaryFilter);
  assert.equal(primaryFilter?.type, "lowpass");
  assert.equal(primaryFilter?.connectedTargets.at(-1), firstEqNode);

  audioFocus = {
    ...audioFocus,
    filterType: "highpass",
  };
  controller.start();
  await flushVisualizerWork();

  assert.equal(primaryFilter?.type, "highpass");
  assert.equal(gainNode?.connectedTargets.at(-1), primaryFilter);

  audioFocus = {
    ...audioFocus,
    filterType: "none",
  };
  controller.start();
  await flushVisualizerWork();

  assert.equal(gainNode?.connectedTargets.at(-1), firstEqNode);

  controller.destroy();
});
void test("runtime audio visualizer preserves custom preview audio focus across pause play and seek", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const media = new FakeMediaElement();
  media.paused = false;
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(media, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  const audioFocus = createTestAudioFocusSettings({
    gain: 1.9,
    filterType: "bandpass" as const,
    filterFrequency: 1450,
    filterQ: 6.2,
    playbackRate: 0.8,
    preservePitch: false,
    visualizationMode: "waveform" as const,
    eqBands: [
      { frequency: 60, gain: -2, Q: 1.1, type: "lowshelf" as const },
      { frequency: 250, gain: 1.5, Q: 0.9, type: "peaking" as const },
      { frequency: 1000, gain: 3.5, Q: 1.4, type: "peaking" as const },
      { frequency: 4000, gain: -1, Q: 1.3, type: "peaking" as const },
      { frequency: 12000, gain: 2.5, Q: 0.8, type: "highshelf" as const },
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
  const initialEqCalls = eqNodes[2]?.gain.setTargetCalls.length ?? 0;

  assert.deepEqual(gainNode?.gain.setTargetCalls.at(-1), [1.9, 0, 0.01]);
  assert.equal(media.playbackRate, 0.8);
  assert.equal(media.preservesPitch, false);
  assert.deepEqual(primaryFilter?.frequency.setTargetCalls.at(-1), [1450, 0, 0.01]);
  assert.deepEqual(primaryFilter?.Q.setTargetCalls.at(-1), [6.2, 0, 0.01]);
  assert.deepEqual(eqNodes[2]?.gain.setTargetCalls.at(-1), [3.5, 0, 0.01]);

  media.pause();
  await flushVisualizerWork();

  assert.equal(windowRef.scheduledFrames.size, 0);
  assert.equal(gainNode?.gain.value, 1.9);
  assert.equal(media.playbackRate, 0.8);
  assert.equal(media.preservesPitch, false);
  assert.equal(primaryFilter?.type, "bandpass");
  assert.equal(primaryFilter?.frequency.value, 1450);
  assert.equal(primaryFilter?.Q.value, 6.2);
  assert.equal(eqNodes[2]?.gain.value, 3.5);

  await media.play();
  await flushVisualizerWork();

  assert.equal(windowRef.scheduledFrames.size, 1);
  assert.equal(gainNode?.gain.value, 1.9);
  assert.equal(media.playbackRate, 0.8);
  assert.equal(media.preservesPitch, false);
  assert.equal(primaryFilter?.type, "bandpass");
  assert.equal(primaryFilter?.frequency.value, 1450);
  assert.equal(primaryFilter?.Q.value, 6.2);
  assert.equal(eqNodes[2]?.gain.value, 3.5);
  assert.equal(gainNode?.gain.setTargetCalls.length ?? 0, initialGainCalls);
  assert.equal(primaryFilter?.frequency.setTargetCalls.length ?? 0, initialFilterCalls);
  assert.equal(eqNodes[2]?.gain.setTargetCalls.length ?? 0, initialEqCalls);

  media.dispatch("seeking");
  await flushVisualizerWork();

  assert.equal(windowRef.scheduledFrames.size, 1);
  assert.equal(gainNode?.gain.value, 1.9);
  assert.equal(media.playbackRate, 0.8);
  assert.equal(media.preservesPitch, false);
  assert.equal(primaryFilter?.type, "bandpass");
  assert.equal(primaryFilter?.frequency.value, 1450);
  assert.equal(primaryFilter?.Q.value, 6.2);
  assert.equal(eqNodes[2]?.gain.value, 3.5);
  assert.equal(gainNode?.gain.setTargetCalls.length ?? 0, initialGainCalls);
  assert.equal(primaryFilter?.frequency.setTargetCalls.length ?? 0, initialFilterCalls);
  assert.equal(eqNodes[2]?.gain.setTargetCalls.length ?? 0, initialEqCalls);

  controller.destroy();
});
void test("runtime audio visualizer keeps realtime rendering alive after seek while playing", async () => {
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
        return "waveform";
      },
      windowRef: windowRef as unknown as Window,
    }
  );

  controller.start();
  await flushVisualizerWork();

  const initialStrokeCalls = canvas.context.strokeCalls;
  assert.equal(windowRef.scheduledFrames.size, 1);

  media.dispatch("seeking");
  await flushVisualizerWork();
  assert.ok(canvas.context.strokeCalls > initialStrokeCalls);
  assert.equal(windowRef.scheduledFrames.size, 1);

  windowRef.flushFrame();
  await flushVisualizerWork();
  assert.equal(windowRef.scheduledFrames.size, 1);

  media.pause();
  await flushVisualizerWork();
  assert.equal(windowRef.scheduledFrames.size, 0);

  controller.destroy();
});
void test("runtime audio visualizer throttles paused seek refreshes to snapshot-only rendering", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const media = new FakeMediaElement();
  media.paused = true;
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(media, null, canvas);
  const windowRef = new FakeVisualizerWindow();
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

  const initialStrokeCalls = canvas.context.strokeCalls;
  assert.equal(windowRef.scheduledFrames.size, 0);

  media.currentTime = 12.3;
  media.dispatch("seeking");
  await flushVisualizerWork();
  assert.ok(canvas.context.strokeCalls > initialStrokeCalls);
  assert.equal(windowRef.scheduledFrames.size, 0);

  controller.destroy();
});
});
