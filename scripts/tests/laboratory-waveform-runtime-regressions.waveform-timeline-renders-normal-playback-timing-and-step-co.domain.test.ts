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


describe("waveform timeline renders normal playback timing and step controls without a sel", () => {
void test("waveform timeline renders normal playback timing and step controls without a selection", () => {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(),
  });

  const markup = renderLabWaveformTimeline(getWaveformTimelineModel(store.getState()));

  assert.doesNotMatch(markup, /data-lab-selection-panel="true"/);
  assert.match(markup, /data-lab-role="timeline-current-time-label"/);
  assert.match(markup, /data-lab-role="timeline-total-duration-label"/);
  assert.match(markup, /data-lab-action="timeline-shift-playhead"/);
  assert.match(markup, /data-lab-value="-frame"/);
  assert.match(markup, /data-lab-value="\+frame"/);
});
void test("workspace audio visualizer renders a loadable artifact before live analyser init", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getVisualizationArtifact() {
      return {
        id: "artifact-waveform",
        kind: "waveform",
        previewUrl: null,
        fileUrl: "file:///tmp/waveform-artifact.png",
        path: "/tmp/waveform-artifact.png",
        fileName: "waveform-artifact.png",
        createdAt: new Date().toISOString(),
      } as LabArtifactProjection & { fileUrl: string };
    },
    getVisualizationMode() {
      return "waveform";
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await flushVisualizerWork();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 0);
  assert.equal(windowRef.scheduledFrames.size, 0);
  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/waveform-artifact.png");
});
void test("workspace audio visualizer crops artifact rendering to the shared waveform window", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getTimelineModel() {
      return {
        bookmarks: [],
        dualPreviewActive: true,
        durationMs: 6000,
        endMs: null,
        linkedAudioAssetId: "asset-audio-linked",
        sourceKind: "video",
        startMs: null,
        visualizationArtifact: {
          id: "artifact-waveform-cropped",
          kind: "waveform",
          previewUrl: "file:///tmp/waveform-cropped.png",
          path: "/tmp/waveform-cropped.png",
          fileName: "waveform-cropped.png",
          createdAt: new Date().toISOString(),
        },
        visualizationMode: "waveform",
        waveformContentDurationMs: 6000,
        waveformCropEndRatio: 11 / 12,
        waveformCropStartRatio: 1 / 12,
        waveformOffsetMs: -500,
        waveformSourceLabel: "audio.wav",
        waveformSyncLabel: "Linked audio offset -500 ms",
        waveformWindowDurationMs: 5500,
        waveformWindowStartMs: 0,
      };
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await flushVisualizerWork();

  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/waveform-cropped.png");
  assert.equal(canvas.context.lastDrawImageArgs?.length, 9);
  assert.equal(canvas.context.lastDrawImageArgs[1], 100);
  assert.equal(canvas.context.lastDrawImageArgs[3], 1000);
  assert.equal(canvas.context.lastDrawImageArgs[4], 120);
  assert.equal(canvas.context.lastDrawImageArgs[7], 320);
  assert.equal(canvas.context.lastDrawImageArgs[8], 80);
});
void test("workspace audio visualizer redraws when the shared waveform crop changes without changing the artifact", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  let cropStartRatio = 0;
  let cropEndRatio = 1;
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getTimelineModel() {
      return {
        bookmarks: [],
        dualPreviewActive: true,
        durationMs: 6000,
        endMs: null,
        linkedAudioAssetId: "asset-audio-linked",
        sourceKind: "video",
        startMs: null,
        visualizationArtifact: {
          id: "artifact-waveform-cropped-live",
          kind: "waveform",
          previewUrl: "file:///tmp/waveform-cropped-live.png",
          path: "/tmp/waveform-cropped-live.png",
          fileName: "waveform-cropped-live.png",
          createdAt: new Date().toISOString(),
        },
        visualizationMode: "waveform",
        waveformContentDurationMs: 6000,
        waveformCropEndRatio: cropEndRatio,
        waveformCropStartRatio: cropStartRatio,
        waveformOffsetMs: 0,
        waveformSourceLabel: "audio.wav",
        waveformSyncLabel: "Linked audio is aligned to the master axis.",
        waveformWindowDurationMs: 6000,
        waveformWindowStartMs: 0,
      };
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await flushVisualizerWork();

  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawImageArgs?.[1], 0);
  assert.equal(canvas.context.lastDrawImageArgs[3], 1200);

  cropStartRatio = 1 / 12;
  cropEndRatio = 11 / 12;
  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(canvas.context.drawImageCalls, 2);
  assert.equal(canvas.context.lastDrawImageArgs[1], 100);
  assert.equal(canvas.context.lastDrawImageArgs[3], 1000);
});
});
