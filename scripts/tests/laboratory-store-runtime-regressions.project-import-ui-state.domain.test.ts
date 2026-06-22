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

describe("project import UI state", () => {
  void test("laboratory store tracks focus layer as guarded UI-only state", () => {
    const store = createLabStore();

    assert.equal(store.getState().ui.labFocusLayer, "preview");

    store.dispatch({ type: "lab-focus-layer-changed", layer: "timeline" });
    assert.equal(store.getState().ui.labFocusLayer, "timeline");

    store.dispatch({ type: "lab-focus-layer-changed", layer: "inspector" });
    assert.equal(store.getState().ui.labFocusLayer, "inspector");

    store.dispatch({
      type: "lab-focus-layer-changed",
      layer: "unknown",
    } as unknown as Parameters<typeof store.dispatch>[0]);
    assert.equal(store.getState().ui.labFocusLayer, "inspector");

    store.dispatch({ type: "hydrate", payload: null });
    assert.equal(store.getState().ui.labFocusLayer, "preview");
  });
  void test("laboratory store preserves persisted project import route across hydrate and source snapshots", () => {
    const store = createLabStore();

    store.dispatch({
      type: "hydrate",
      payload: {
        projectIndex: {
          activeProjectId: "project-1",
          projects: [{ id: "project-1", name: "Workspace Project", hasSource: true }],
        },
        source: {
          kind: "video",
          mode: "local",
          status: "ready",
          drafts: {
            urlInput: "",
            youtubeUrl: "",
            youtubePreset: null,
            youtubeCustom: {},
            youtubeCaptureMode: "video+audio",
          },
        },
        projectImport: {
          activeKind: "image",
          methods: {
            video: "youtube",
            audio: "url",
            image: "url",
          },
          drafts: {
            video: {
              urlInput: "",
              youtubeUrl: "",
              youtubePreset: null,
              youtubeCustom: {},
              youtubeCaptureMode: "video+audio",
            },
            audio: {
              urlInput: "",
              youtubeUrl: "",
              youtubePreset: null,
              youtubeCustom: {},
              youtubeCaptureMode: "video+audio",
            },
            image: {
              urlInput: "https://example.com/evidence.png",
              youtubeUrl: "",
              youtubePreset: null,
              youtubeCustom: {},
              youtubeCaptureMode: "video+audio",
            },
          },
          reviewFocus: "draft",
        },
      },
    });

    assert.equal(store.getState().ui.projectImport.activeKind, "image");
    assert.equal(store.getState().ui.projectImport.methods.image, "url");
    assert.equal(
      store.getState().ui.projectImport.drafts.image.urlInput,
      "https://example.com/evidence.png"
    );

    store.dispatch({
      type: "snapshot-received",
      payload: {
        ready: true,
        activeProjectId: "project-1",
        projects: [{ id: "project-1", name: "Workspace Project", hasSource: true }],
        activeProject: {
          id: "project-1",
          name: "Workspace Project",
          source: {
            kind: "video",
            mode: "local",
            status: "ready",
            drafts: {
              urlInput: "",
              youtubeUrl: "",
              youtubePreset: null,
              youtubeCustom: {},
              youtubeCaptureMode: "video+audio",
            },
          },
          edit: {},
          profile: { preflight: {} },
          process: { records: {} },
          report: { records: {} },
          assets: [],
        },
        workbench: {},
        toolState: { tools: {} },
      },
    });

    assert.equal(store.getState().ui.projectImport.activeKind, "image");
    assert.equal(store.getState().ui.projectImport.methods.image, "url");
    assert.equal(
      store.getState().ui.projectImport.drafts.image.urlInput,
      "https://example.com/evidence.png"
    );
  });
  void test("laboratory store resets project import drafts and checked YouTube state on demand", () => {
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

    assert.equal(store.getState().ui.projectImport.urlCheck.status, "ready");
    assert.equal(store.getState().ui.youtubeImport.status, "ready");

    store.dispatch({ type: "project-import-reset" });

    assert.equal(store.getState().ui.projectImport.urlCheck.status, "idle");
    assert.equal(store.getState().ui.projectImport.drafts.video.urlInput, "");
    assert.equal(store.getState().ui.projectImport.drafts.video.youtubeUrl, "");
    assert.equal(store.getState().ui.projectImport.lastAction, null);
    assert.equal(store.getState().ui.projectImport.lastRequestId, null);
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
    });
  });
  void test("laboratory store resets project import check state when active project changes", () => {
    const store = createLabStore();

    store.dispatch({
      type: "snapshot-received",
      payload: {
        ready: true,
        featureId: "media-analysis",
        activeProjectId: "project-1",
        projects: [
          { id: "project-1", name: "Import Draft", hasSource: false },
          { id: "project-2", name: "Saved Project", hasSource: true },
        ],
        activeProject: {
          id: "project-1",
          name: "Import Draft",
          source: {
            kind: "video",
            mode: "youtube",
            status: "idle",
            drafts: {
              urlInput: "",
              youtubeUrl: "",
              youtubePreset: null,
              youtubeCustom: {},
              youtubeCaptureMode: "video+audio",
            },
          },
          edit: {},
          profile: { preflight: {} },
          process: { records: {} },
          report: { records: {} },
          assets: [],
        },
        workbench: {},
        toolState: { tools: {} },
      },
    });
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
        id: "evt-project-switch-url-check",
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

    assert.equal(store.getState().ui.projectImport.urlCheck.status, "ready");
    assert.equal(store.getState().ui.youtubeImport.status, "ready");

    store.dispatch({
      type: "snapshot-received",
      payload: {
        ready: true,
        featureId: "media-analysis",
        activeProjectId: "project-2",
        projects: [
          { id: "project-1", name: "Import Draft", hasSource: false },
          { id: "project-2", name: "Saved Project", hasSource: true },
        ],
        activeProject: {
          id: "project-2",
          name: "Saved Project",
          source: {
            kind: "video",
            mode: "local",
            status: "ready",
            storedPath: "/tmp/saved.mp4",
            storedFileName: "saved.mp4",
            drafts: {
              urlInput: "",
              youtubeUrl: "",
              youtubePreset: null,
              youtubeCustom: {},
              youtubeCaptureMode: "video+audio",
            },
          },
          edit: {},
          profile: { preflight: {} },
          process: { records: {} },
          report: { records: {} },
          assets: [],
        },
        workbench: {},
        toolState: { tools: {} },
      },
    });

    assert.equal(store.getState().projectIndex.activeProjectId, "project-2");
    assert.equal(store.getState().ui.projectImport.urlCheck.status, "idle");
    assert.equal(store.getState().ui.projectImport.drafts.video.urlInput, "");
    assert.equal(store.getState().ui.projectImport.drafts.video.youtubeUrl, "");
    assert.equal(store.getState().ui.youtubeImport.status, "idle");
  });
  void test("laboratory store clears import controls after completed tracked YouTube add", () => {
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
      type: "source-config-patched",
      patch: {
        kind: "video",
        mode: "youtube",
        status: "ready",
        storedFileName: "clip.mp4",
        storedPath: "/tmp/clip.mp4",
        metadata: { duration: 12 },
      },
    });
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-youtube-add",
        kind: "activity",
        severity: "success",
        message: "YouTube import completed",
        detail: null,
        action: "source-download-youtube",
        stage: "completed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: "req-add",
      } as never,
    });

    assert.equal(store.getState().sourceProbeStatus, "completed");
    assert.equal(store.getState().ui.projectImport.reviewFocus, "completed");
    assert.equal(store.getState().ui.projectImport.lastAction, "source-download-youtube");
    assert.equal(store.getState().ui.projectImport.lastRequestId, "req-add");
    assert.equal(store.getState().ui.projectImport.urlCheck.status, "idle");
    assert.equal(store.getState().ui.projectImport.drafts.video.urlInput, "");
    assert.equal(store.getState().ui.youtubeImport.status, "idle");
    assert.equal((store.getState().source as Record<string, unknown>)["status"], "ready");
    assert.equal(
      (store.getState().source as Record<string, unknown>)["storedFileName"],
      "clip.mp4"
    );
  });
});
