import { assert, createLabStore, getAssetById, getAssets, getAssetsByRun, getAssetsBySource, getAssetsByType, test } from "./laboratory-runtime-truth.helpers.ts";

describe("store export and hydrate actions", () => {
  void test("laboratory store keeps export user actions separate from analysis run state", () => {
    const store = createLabStore();

    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-1",
        type: "export-clip",
        label: "Klip çıkarılıyor",
        status: "running",
        startedAt: Date.now() - 1000,
        projectId: "project-1",
        requestId: "req-export-1",
        sourceAction: "export-timeline-clip",
      },
    });
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-export",
        kind: "activity",
        severity: "success",
        message: "Klip çıkarılıyor tamamlandı",
        detail: null,
        timestamp: Date.now(),
        source: "host",
        action: "export-timeline-clip",
        stage: "completed",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: "req-export-1",
        jobId: "job-export-1",
        projectId: "project-1",
        resultAssetIds: ["asset-clip-export-1"],
      },
    });
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-run",
        kind: "activity",
        severity: "info",
        message: "Analiz basladi",
        detail: null,
        timestamp: Date.now(),
        source: "host",
        action: "process-run",
        stage: "running",
        scope: "run",
        moduleId: null,
        rawLine: null,
      },
    });

    const state = store.getState();
    assert.equal(state.userActions[0]?.status, "success");
    assert.equal(state.userActions[0].message, "Klip hazır");
    assert.deepEqual(state.userActions[0].resultAssetIds, ["asset-clip-export-1"]);
    assert.equal(state.run?.state, "running");
    assert.equal(state.run.events.length, 1);
    assert.equal(state.run.events[0]?.action, "process-run");
  });
  void test("laboratory store keeps tracked export failures and cancellations UI-safe", () => {
    const store = createLabStore();

    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-failed",
        type: "export-clip",
        label: "Klip çıkarılıyor",
        status: "running",
        startedAt: Date.now() - 1000,
        requestId: "req-export-failed",
        sourceAction: "export-timeline-clip",
      },
    });
    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-cancelled",
        type: "export-clip",
        label: "Klip çıkarılıyor",
        status: "running",
        startedAt: Date.now() - 1000,
        requestId: "req-export-cancelled",
        sourceAction: "export-timeline-clip",
      },
    });

    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-export-failed",
        kind: "activity",
        severity: "error",
        message: "Klip çıkarılıyor hata verdi",
        detail: "ffmpeg version n6.1 -i /tmp/source.mp4 leaked command output",
        timestamp: Date.now(),
        source: "host",
        action: "export-timeline-clip",
        stage: "failed",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: "req-export-failed",
        jobId: "job-export-failed",
      },
    });
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-export-cancelled",
        kind: "activity",
        severity: "warning",
        message: "Klip çıkarılıyor iptal edildi",
        detail: "ffmpeg version n6.1 -i /tmp/source.mp4 leaked command output",
        timestamp: Date.now(),
        source: "host",
        action: "export-timeline-clip",
        stage: "cancelled",
        scope: "global",
        moduleId: null,
        rawLine: null,
        requestId: "req-export-cancelled",
        jobId: "job-export-cancelled",
      },
    });

    const failedAction = store.getState().userActions.find(function (entry) {
      return entry.id === "user-action-failed";
    });
    const cancelledAction = store.getState().userActions.find(function (entry) {
      return entry.id === "user-action-cancelled";
    });
    assert.equal(failedAction?.status, "error");
    assert.equal(failedAction.message, "Klip çıkarılamadı");
    assert.equal(cancelledAction?.status, "idle");
    assert.equal(cancelledAction.message, "İşlem iptal edildi.");
  });
  void test("laboratory store hydrates project assets and selectors keep registry lookups scoped", () => {
    const store = createLabStore();

    store.dispatch({
      type: "snapshot-received",
      payload: {
        ready: true,
        featureId: "media-analysis",
        activeProjectId: "project-asset-1",
        projects: [],
        activeProject: {
          id: "project-asset-1",
          source: {
            status: "ready",
            kind: "video",
            mode: "local",
            storedPath: "/tmp/source.mp4",
            drafts: {},
          },
          edit: {},
          profile: {},
          process: {
            records: {},
          },
          report: {
            records: {},
          },
          assets: [
            {
              id: "asset-source-1",
              type: "source",
              name: "source.mp4",
              localPath: "/tmp/source.mp4",
              createdAt: 100,
              sourceId: "source-1",
            },
            {
              id: "asset-clip-1",
              type: "clip",
              name: "clip_01.mp4",
              localPath: "/tmp/clip_01.mp4",
              createdAt: 200,
              sourceId: "source-1",
              runId: "run-1",
            },
            {
              id: "asset-frame-1",
              type: "frame",
              name: "frame_001.png",
              localPath: "/tmp/frame_001.png",
              createdAt: 300,
              sourceId: "source-1",
              runId: "run-2",
            },
          ],
        },
      },
    });

    const state = store.getState();
    const assets = getAssets(state);
    assert.equal(assets.length, 3);
    assets.pop();
    assert.equal(getAssets(store.getState()).length, 3);
    assert.deepEqual(
      getAssetsByType(state, "clip").map((asset) => asset.id),
      ["asset-clip-1"]
    );
    assert.deepEqual(
      getAssetsBySource(state, "source-1").map((asset) => asset.id),
      ["asset-source-1", "asset-clip-1", "asset-frame-1"]
    );
    assert.deepEqual(
      getAssetsByRun(state, "run-1").map((asset) => asset.id),
      ["asset-clip-1"]
    );

    store.dispatch({
      type: "asset-updated",
      id: "asset-clip-1",
      patch: {
        name: "clip_renamed.mp4",
      },
    });
    assert.equal(getAssetsByType(store.getState(), "clip")[0]?.name, "clip_renamed.mp4");

    store.dispatch({ type: "asset-removed", id: "asset-frame-1" });
    assert.deepEqual(
      getAssets(store.getState()).map((asset) => asset.id),
      ["asset-source-1", "asset-clip-1"]
    );
    assert.equal(getAssetById(store.getState(), "asset-clip-1")?.name, "clip_renamed.mp4");
    assert.equal(getAssetById(store.getState(), "asset-missing"), null);
  });
});
