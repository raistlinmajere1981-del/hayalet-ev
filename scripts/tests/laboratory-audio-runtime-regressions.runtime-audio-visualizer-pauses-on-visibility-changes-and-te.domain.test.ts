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


describe("runtime audio visualizer pauses on visibility changes and tears down listeners o", () => {
void test("runtime audio visualizer pauses on visibility changes and tears down listeners on destroy", async () => {
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
  assert.equal(windowRef.scheduledFrames.size, 1);
  assert.equal(media.listenerCount("play"), 1);

  documentRef.hidden = true;
  documentRef.dispatch("visibilitychange");
  await flushVisualizerWork();
  assert.equal(windowRef.scheduledFrames.size, 0);

  documentRef.hidden = false;
  documentRef.dispatch("visibilitychange");
  await flushVisualizerWork();
  assert.equal(windowRef.scheduledFrames.size, 1);

  controller.destroy();
  assert.equal(windowRef.scheduledFrames.size, 0);
  assert.equal(media.listenerCount("play"), 0);

  media.dispatch("play");
  await flushVisualizerWork();
  assert.equal(windowRef.scheduledFrames.size, 0);
});
void test("laboratory workspace audio focus defaults to waveform visualization", () => {
  const store = createLabStore();
  assert.equal(store.getState().ui.workspace.audioFocus.visualizationMode, "waveform");
});
void test("laboratory hydration upgrades deprecated audio visualization none mode to waveform", () => {
  const store = createLabStore();
  store.dispatch({
    type: "hydrate-complete",
    payload: {
      workspace: {
        audioFocus: {
          ...store.getState().ui.workspace.audioFocus,
          visualizationMode: "none",
        },
      },
    },
  } as unknown as LabStoreEvent);

  assert.equal(store.getState().ui.workspace.audioFocus.visualizationMode, "waveform");
});
void test("laboratory audio focus updates preserve an existing spectrogram preference", () => {
  const store = createLabStore();
  store.dispatch({
    type: "workspace-audio-updated",
    patch: {
      visualizationMode: "spectrum",
    },
  });
  store.dispatch({
    type: "workspace-audio-updated",
    patch: {
      filterType: "highpass",
    },
  });

  assert.equal(store.getState().ui.workspace.audioFocus.visualizationMode, "spectrum");
});
});
