import {
  assert,
  createDualPreviewSnapshot,
  createLabEventBus,
  createLabRunController,
  createLabStore,
  createLabWaveformTimelineVisualizer,
  createTestAudioFocusSettings,
  FakeCanvasElement,
  FakeControllerDocument,
  FakeMediaElement,
  FakeVisualizerAudioContext,
  FakeVisualizerDocument,
  FakeVisualizerWindow,
  flushVisualizerWork,
  getWaveformTimelineModel,
  renderLabWaveformTimeline,
  test,
} from "./laboratory-runtime-truth.helpers.ts";

import type { LabArtifactProjection } from "./laboratory-runtime-truth.helpers.ts";
import type { LabWaveformTimelineModel } from "../../rooms/laboratory/ui/lab-waveform-timeline-types.ts";
import type { LabBookmark } from "../../rooms/laboratory/domain/lab-types.ts";


describe("laboratory run controller renders loadable audio visualization artifacts before ", () => {
void test("laboratory run controller renders loadable audio visualization artifacts before play", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new (class extends FakeControllerDocument {
    querySelector(selector: string) {
      if (selector === 'audio[data-lab-preserve-media="workspace-preview"]') {
        return audioPreview;
      }
      if (selector === "#lab-audio-viz") {
        return canvas;
      }
      return null;
    }
  })();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const windowRef = new FakeVisualizerWindow();

  eventBus.subscribe(function (event) {
    store.dispatch(event);
  });

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio-artifact",
      kind: "module-artifact",
      severity: "info",
      message: "Waveform artifact ready",
      detail: "Audio waveform rendered",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: "spectral-artifacts",
      rawLine: null,
      artifact: {
        id: "artifact-waveform-controller",
        moduleId: "spectral-artifacts",
        kind: "waveform",
        path: "/tmp/controller-waveform.png",
        fileName: "controller-waveform.png",
        previewUrl: "file:///tmp/controller-waveform.png",
        createdAt: new Date().toISOString(),
      },
    },
  });

  const controller = createLabRunController({
    documentRef: documentRef as unknown as Document,
    eventBus,
    store,
    windowRef: windowRef as unknown as Window,
  });

  controller.attach();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 0);
  assert.equal(windowRef.scheduledFrames.size, 0);
  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/controller-waveform.png");
});
void test("laboratory run controller renders decoded waveform peaks before play when the preview source is available", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  audioPreview.currentSrc = "file:///tmp/controller-waveform-source.wav";
  const canvas = new FakeCanvasElement();
  const documentRef = new (class extends FakeControllerDocument {
    querySelector(selector: string) {
      if (selector === 'audio[data-lab-preserve-media="workspace-preview"]') {
        return audioPreview;
      }
      if (selector === "#lab-audio-viz") {
        return canvas;
      }
      return null;
    }
  })();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const windowRef = new FakeVisualizerWindow();

  eventBus.subscribe(function (event) {
    store.dispatch(event);
  });

  const controller = createLabRunController({
    documentRef: documentRef as unknown as Document,
    eventBus,
    store,
    windowRef: windowRef as unknown as Window,
  });

  controller.attach();
  await Promise.resolve();
  await flushVisualizerWork();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.deepEqual(windowRef.fetchCalls, ["file:///tmp/controller-waveform-source.wav"]);
  assert.equal(windowRef.scheduledFrames.size, 0);
  assert.equal(canvas.context.strokeStyleHistory.at(-1), "#5cd7df");
});
void test("laboratory run controller keeps live spectrum rendering when a loadable artifact arrives", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new (class extends FakeControllerDocument {
    querySelector(selector: string) {
      if (selector === 'audio[data-lab-preserve-media="workspace-preview"]') {
        return audioPreview;
      }
      if (selector === "#lab-audio-viz") {
        return canvas;
      }
      return null;
    }
  })();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const windowRef = new FakeVisualizerWindow();

  eventBus.subscribe(function (event) {
    store.dispatch(event);
  });

  audioPreview.paused = false;
  const controller = createLabRunController({
    documentRef: documentRef as unknown as Document,
    eventBus,
    store,
    windowRef: windowRef as unknown as Window,
  });

  controller.attach();
  await flushVisualizerWork();
  await audioPreview.play();
  await flushVisualizerWork();

  const audioContext = FakeVisualizerAudioContext.constructed[0];
  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(windowRef.scheduledFrames.size, 1);

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio-artifact-arrival",
      kind: "module-artifact",
      severity: "info",
      message: "Spectrogram artifact ready",
      detail: "Audio spectrogram rendered",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: "spectral-artifacts",
      rawLine: null,
      artifact: {
        id: "artifact-spectrogram-controller",
        moduleId: "spectral-artifacts",
        kind: "spectrogram",
        path: "/tmp/controller-spectrogram.png",
        fileName: "controller-spectrogram.png",
        previewUrl: "file:///tmp/controller-spectrogram.png",
        createdAt: new Date().toISOString(),
      },
    },
  });
  store.getState().ui.workspace.audioFocus.visualizationMode = "spectrum";

  await flushVisualizerWork();
  windowRef.flushFrame();
  await flushVisualizerWork();

  assert.equal(windowRef.scheduledFrames.size, 1);
  assert.equal(canvas.context.drawImageCalls, 0);
  assert.ok(canvas.context.fillRectCalls > 0);
  assert.equal(
    audioContext?.sourceNodes[0]?.connectedTargets[
      audioContext.sourceNodes[0].connectedTargets.length - 1
    ],
    audioContext?.gainNodes[0]
  );
});
void test("laboratory run controller pauses realtime rendering while hidden and resumes on visibility restore", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new (class extends FakeControllerDocument {
    hidden = false;

    querySelector(selector: string) {
      if (selector === 'audio[data-lab-preserve-media="workspace-preview"]') {
        return audioPreview;
      }
      if (selector === "#lab-audio-viz") {
        return canvas;
      }
      return null;
    }
  })();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const windowRef = new FakeVisualizerWindow();

  eventBus.subscribe(function (event) {
    store.dispatch(event);
  });

  audioPreview.paused = false;
  const controller = createLabRunController({
    documentRef: documentRef as unknown as Document,
    eventBus,
    store,
    windowRef: windowRef as unknown as Window,
  });

  controller.attach();
  await flushVisualizerWork();
  await audioPreview.play();
  await flushVisualizerWork();

  const audioContext = FakeVisualizerAudioContext.constructed[0];
  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(windowRef.scheduledFrames.size, 1);

  documentRef.hidden = true;
  documentRef.listeners.get("visibilitychange")?.({ type: "visibilitychange" } as unknown as Event);
  await Promise.resolve();
  assert.equal(windowRef.scheduledFrames.size, 0);

  documentRef.hidden = false;
  documentRef.listeners.get("visibilitychange")?.({ type: "visibilitychange" } as unknown as Event);
  await flushVisualizerWork();
  assert.equal(windowRef.scheduledFrames.size, 1);
  assert.equal(
    audioContext?.sourceNodes[0]?.connectedTargets[
      audioContext.sourceNodes[0].connectedTargets.length - 1
    ],
    audioContext?.gainNodes[0]
  );
});
});
