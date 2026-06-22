import {
  assert,
  createLabHostBridge,
  createLabStore,
  extractFindings,
  getActionOutputs,
  getAssetById,
  getAssets,
  getAssetsByRun,
  getAssetsBySource,
  getAssetsByType,
  getCurrentSourceAsset,
  getDualPreviewVolume,
  getLinkedAudioAssets,
  getParentSourceForAsset,
  getSelectedDualPreviewAudioAsset,
  isDualPreviewActive,
  isDualPreviewAvailable,
  parseProcessOutput,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { loadLabPersistedState } from "../../rooms/laboratory/runtime/lab-persistence.ts";

describe("youtube add and process output", () => {
  void test("laboratory store preserves URL draft after failed tracked YouTube add", () => {
    const store = createLabStore();

    store.dispatch({
      type: "project-import-draft-updated",
      kind: "video",
      patch: { urlInput: "https://youtube.com/watch?v=abc123" },
    });
    store.dispatch({
      type: "project-import-url-check-started",
      url: "https://youtube.com/watch?v=abc123",
    });
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-url-check",
        kind: "request-result",
        severity: "success",
        message: "URL check completed",
        detail: null,
        action: "project-import-check-url",
        stage: "completed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        result: {
          url: "https://youtube.com/watch?v=abc123",
          isYoutube: true,
          kind: "video",
          preview: { title: "Evidence clip" },
          formats: [{ formatId: "18", label: "MP4 360p", kind: "muxed", extension: "mp4" }],
          selectedVideoFormatId: "18",
        },
      } as never,
    });
    store.dispatch({
      type: "project-import-review-focused",
      focus: "running",
      action: "source-download-youtube",
      requestId: "req-add",
    });
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-youtube-add-failed",
        kind: "activity",
        severity: "error",
        message: "YouTube import failed",
        detail: "Network error",
        action: "source-download-youtube",
        stage: "failed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: "req-add",
      } as never,
    });

    assert.equal(store.getState().sourceProbeStatus, "failed");
    assert.equal(store.getState().ui.projectImport.urlCheck.status, "ready");
    assert.equal(
      store.getState().ui.projectImport.drafts.video.urlInput,
      "https://youtube.com/watch?v=abc123"
    );
    assert.equal(store.getState().ui.youtubeImport.status, "ready");
  });
  void test("laboratory process output parser translates known ffmpeg and download lines", () => {
    const blackdetectEvent = parseProcessOutput("blackdetect=duration:0.42");
    const frameEvent = parseProcessOutput("frame= 248 fps=24");
    const downloadEvent = parseProcessOutput("[download] 42.1% of 12.31MiB");
    const mergeEvent = parseProcessOutput('Merging formats into "clip.mp4"');

    assert.equal(blackdetectEvent?.message, "Siyah sahne tespiti calisiyor");
    assert.equal(blackdetectEvent.moduleId, "motion");
    assert.equal(frameEvent?.detail, "248 kare incelendi");
    assert.equal(downloadEvent?.message, "Kaynak indiriliyor");
    assert.equal(downloadEvent.scope, "global");
    assert.equal(mergeEvent?.message, "Kaynak birlestiriliyor");
  });
  void test("laboratory process output parser leaves unknown lines in raw-log only flow", () => {
    const unknownEvent = parseProcessOutput("totally unknown tool output");
    assert.equal(unknownEvent, null);
  });
});
