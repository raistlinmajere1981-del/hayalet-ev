import { assert, createLabStore, test } from "./laboratory-runtime-truth.helpers.ts";
import { loadLabPersistedState } from "../../rooms/laboratory/runtime/lab-persistence.ts";

describe("persistence and state management", () => {
  void test("laboratory persistence drops stale runtime snapshots before boot hydrate", () => {
    const storage = new Map<string, string>();
    const windowRef = {
      localStorage: {
        getItem(key: string) {
          return storage.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          storage.set(key, value);
        },
      },
    } as unknown as Window & typeof globalThis;

    storage.set(
      "hayalet-ev:laboratory-refactor:v4",
      JSON.stringify({
        schemaVersion: 4,
        selectedCapabilities: ["visual"],
        projectIndex: {
          activeProjectId: "project-old",
          projects: [{ id: "project-old", name: "Old Project" }],
        },
        workbench: {
          activeModuleId: "media-analysis",
          activePreviewArtifactId: "preview-old",
        },
        source: {
          kind: "video",
          status: "ready",
          storedPath: "/tmp/old.mp4",
        },
        sourceProbeStatus: "completed",
        editConfig: { output: "old" },
        profileConfig: { preflight: { status: "ready" } },
        preflight: { status: "ready" },
        lastRun: { id: "run-old", state: "completed" },
        reports: { user: { summary: "old" }, ai: null, emptyReason: null },
        reportExports: [{ id: "report-old" }],
        assets: [{ id: "asset-old", type: "source" }],
        profileModels: [{ modelId: "model-old" }],
        toolState: { ffmpeg: { installed: true } },
        activityFeed: [{ id: "event-old", message: "old" }],
        activePreviewArtifactId: "preview-old",
        sourceDrafts: {
          urlInput: "",
          youtubeUrl: "https://youtube.com/watch?v=abc123",
          youtubePreset: "custom",
          youtubeCustom: {},
          youtubeCaptureMode: "video+audio",
        },
        projectImport: {
          activeKind: "image",
          methods: { video: "local", audio: "local", image: "url" },
        },
        workspace: {
          timelineStartMs: 1000,
          timelineEndMs: 2000,
          activeSelection: { id: "selection-old" },
          roiRegions: [{ id: "roi-old" }],
          hypothesis: "old clue",
          previewVolume: 0.42,
          controlsDrawerTab: "operations",
          drawerCollapsed: true,
          activeIconRailSlot: "stabilize",
        },
      })
    );

    const loaded = loadLabPersistedState(windowRef) as Record<string, unknown>;
    assert.deepEqual(loaded["selectedCapabilities"], []);
    assert.deepEqual(loaded["projectIndex"], { activeProjectId: null, projects: [] });
    assert.equal(Object.keys((loaded["workbench"] ?? {}) as Record<string, unknown>).length, 0);
    assert.equal(loaded["source"], null);
    assert.equal(loaded["sourceProbeStatus"], "idle");
    assert.equal(loaded["editConfig"], null);
    assert.equal(loaded["profileConfig"], null);
    assert.equal(loaded["preflight"], null);
    assert.equal(loaded["lastRun"], null);
    assert.deepEqual(loaded["reportExports"], []);
    assert.deepEqual(loaded["assets"], []);
    assert.deepEqual(loaded["profileModels"], []);
    assert.deepEqual(loaded["toolState"], {});
    assert.deepEqual(loaded["activityFeed"], []);
    assert.equal(loaded["activePreviewArtifactId"], null);

    const workspace = loaded["workspace"] as Record<string, unknown>;
    assert.equal("timelineStartMs" in workspace, false);
    assert.equal("activeSelection" in workspace, false);
    assert.equal("roiRegions" in workspace, false);
    assert.equal("hypothesis" in workspace, false);
    assert.equal(workspace["previewVolume"], 0.42);
    assert.equal(workspace["controlsDrawerTab"], "operations");
    assert.equal(workspace["drawerCollapsed"], true);
    assert.equal(workspace["activeIconRailSlot"], "stabilize");

    const sourceDrafts = loaded["sourceDrafts"] as Record<string, unknown>;
    assert.equal(sourceDrafts["youtubeUrl"], "https://youtube.com/watch?v=abc123");
    const projectImport = loaded["projectImport"] as Record<string, unknown>;
    assert.equal(projectImport["activeKind"], "image");
  });
  void test("laboratory store tracks comparison capture controls without changing the reference", () => {
    const store = createLabStore();

    store.dispatch({ type: "workspace-comparison-reference-set", assetId: "asset-b" });
    store.dispatch({
      type: "workspace-comparison-updated",
      patch: {
        comparisonFindingNote: "Sol göz çevresi farkı",
        comparisonSplitPercent: 132,
        comparisonViewMode: "split",
      },
    });

    const workspace = store.getState().ui.workspace;
    assert.equal(workspace.comparisonReferenceAssetId, "asset-b");
    assert.equal(workspace.comparisonFindingNote, "Sol göz çevresi farkı");
    assert.equal(workspace.comparisonSplitPercent, 100);
    assert.equal(workspace.comparisonViewMode, "split");
    assert.equal(workspace.comparisonRois.activeSide, "reference");
    assert.equal(workspace.comparisonRois.reference, null);
  });
  void test("laboratory store keeps checked YouTube import state UI-only and non-persistent", () => {
    const store = createLabStore();
    assert.equal(store.getState().ui.labMode, "normal");
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
    });

    store.dispatch({
      type: "source-drafts-updated",
      patch: {
        youtubeUrl: "https://youtube.com/watch?v=abc123",
        youtubePreset: "custom",
        youtubeCustom: {
          format: "best",
        },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-source",
        type: "source",
        name: "source.mp4",
        createdAt: Date.now(),
        localPath: "/tmp/source.mp4",
        url: "file:///tmp/source.mp4",
        metadata: {},
      },
    });
    store.dispatch({
      type: "youtube-import-set-url",
      url: " https://www.youtube.com/watch?v=abc123DEF45 ",
    });
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: "https://www.youtube.com/watch?v=abc123DEF45",
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
    });
    const formatSelectionSnapshots = {
      sourceDrafts: JSON.parse(JSON.stringify(store.getState().ui.sourceDrafts)) as Record<
        string,
        unknown
      >,
      youtubeImportStableFields: {
        url: store.getState().ui.youtubeImport.url,
        status: store.getState().ui.youtubeImport.status,
        preview: store.getState().ui.youtubeImport.preview,
      },
      source: JSON.parse(JSON.stringify(store.getState().source)) as Record<string, unknown>,
      assets: JSON.parse(JSON.stringify(store.getState().assets)) as Record<string, unknown>,
      run: JSON.parse(JSON.stringify(store.getState().run)) as Record<string, unknown>,
      reports: JSON.parse(JSON.stringify(store.getState().reports)) as Record<string, unknown>,
    };
    assert.deepEqual(
      {
        url: store.getState().ui.youtubeImport.url,
        status: store.getState().ui.youtubeImport.status,
        preview: store.getState().ui.youtubeImport.preview,
      },
      formatSelectionSnapshots.youtubeImportStableFields
    );
    assert.deepEqual(store.getState().ui.sourceDrafts, formatSelectionSnapshots.sourceDrafts);
    assert.deepEqual(store.getState().source, formatSelectionSnapshots.source);
    assert.deepEqual(store.getState().assets, formatSelectionSnapshots.assets);
    assert.deepEqual(store.getState().run, formatSelectionSnapshots.run);
    assert.deepEqual(store.getState().reports, formatSelectionSnapshots.reports);
    store.dispatch({ type: "youtube-import-parse-start" });
    assert.equal(store.getState().ui.youtubeImport.status, "parsing");
    store.dispatch({
      type: "youtube-import-parse-success",
      url: "https://www.youtube.com/watch?v=stale00000",
      preview: {
        title: "Stale Video",
        duration: 1,
        thumbnail: "https://img.youtube.com/vi/stale00000/hqdefault.jpg",
      },
    });
    assert.equal(store.getState().ui.youtubeImport.status, "parsing");
    assert.equal(store.getState().ui.youtubeImport.preview, null);
    store.dispatch({
      type: "youtube-import-parse-success",
      url: "https://www.youtube.com/watch?v=abc123DEF45",
      preview: {
        title: "Sample Video Title",
        duration: 154,
        thumbnail: "https://img.youtube.com/vi/abc123DEF45/hqdefault.jpg",
      },
      formats: [
        { formatId: "137", label: "Video 1080p", kind: "video" },
        { formatId: "140", label: "Audio m4a", kind: "audio" },
      ],
      selectedVideoFormatId: "137",
      selectedAudioFormatId: "140",
    });
    assert.deepEqual(store.getState().ui.youtubeImport.preview, {
      title: "Sample Video Title",
      duration: 154,
      thumbnail: "https://img.youtube.com/vi/abc123DEF45/hqdefault.jpg",
    });
    assert.equal(store.getState().ui.youtubeImport.status, "ready");
    assert.equal(store.getState().ui.youtubeImport.selectedVideoFormatId, "137");
    assert.equal(store.getState().ui.youtubeImport.selectedAudioFormatId, "140");
    store.dispatch({
      type: "youtube-import-format-selected",
      videoFormatId: "999",
      audioFormatId: "140",
    });
    assert.equal(store.getState().ui.youtubeImport.selectedVideoFormatId, null);
    assert.equal(store.getState().ui.youtubeImport.selectedAudioFormatId, "140");
    store.dispatch({ type: "youtube-import-parse-error", reason: "invalid-url" });
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: "https://www.youtube.com/watch?v=abc123DEF45",
      status: "error",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
    });
    store.dispatch({ type: "youtube-import-set-url", url: "   " });
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
    });
    store.dispatch({ type: "youtube-import-clear" });
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
    });
    store.dispatch({
      type: "youtube-import-set-url",
      url: "https://youtu.be/abc123DEF45",
    });
    store.dispatch({ type: "youtube-import-parse-start" });
    store.dispatch({ type: "youtube-import-clear" });
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
    });

    const sourceDraftsBefore = store.getState().ui.sourceDrafts;
    const assetsBefore = store.getState().assets;
    assert.deepEqual(store.getState().ui.sourceDrafts, sourceDraftsBefore);
    assert.deepEqual(store.getState().assets, assetsBefore);

    store.dispatch({
      type: "youtube-import-set-url",
      url: "https://youtu.be/ready12345",
    });
    store.dispatch({
      type: "youtube-import-parse-success",
      url: "https://youtu.be/ready12345",
      preview: {
        title: "Ready Video",
        duration: 44,
        thumbnail: "https://img.youtube.com/vi/ready12345/hqdefault.jpg",
      },
      formats: [{ formatId: "18", label: "Muxed 360p", kind: "muxed" }],
      selectedVideoFormatId: "18",
      selectedAudioFormatId: "18",
    });
    assert.equal(store.getState().ui.labMode, "normal");

    store.dispatch({ type: "youtube-import-set-url", url: "https://youtu.be/abc123DEF45" });
    store.dispatch({ type: "youtube-import-parse-start" });
    store.dispatch({
      type: "hydrate",
      payload: {
        source: {
          kind: "video",
          mode: "youtube",
          status: "idle",
        },
        sourceDrafts: {
          urlInput: "",
          youtubeUrl: "https://youtube.com/watch?v=abc123",
          youtubePreset: "custom",
          youtubeCustom: {
            format: "best",
          },
          youtubeCaptureMode: "video+audio",
        },
      },
    });

    assert.equal(store.getState().ui.labMode, "normal");
    assert.deepEqual(store.getState().ui.youtubeImport, {
      url: null,
      status: "idle",
      preview: null,
      formats: [],
      selectedVideoFormatId: null,
      selectedAudioFormatId: null,
    });
    assert.equal(
      "youtubeImport" in (store.getState().persisted as unknown as Record<string, unknown>),
      false
    );
    assert.equal(store.getState().ui.sourceDrafts.youtubeUrl, "https://youtube.com/watch?v=abc123");
  });
});
