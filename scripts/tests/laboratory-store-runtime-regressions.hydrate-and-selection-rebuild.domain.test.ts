import { assert, createLabStore, getAssetById, getCurrentSourceAsset, getDualPreviewVolume, getLinkedAudioAssets, getParentSourceForAsset, getSelectedDualPreviewAudioAsset, isDualPreviewActive, isDualPreviewAvailable, test } from "./laboratory-runtime-truth.helpers.ts";

describe("hydrate and selection rebuild", () => {
  void test("laboratory lineage selectors resolve current source, linked audio, and parent assets", () => {
    const store = createLabStore();

    store.dispatch({
      type: "snapshot-received",
      payload: {
        ready: true,
        featureId: "media-analysis",
        activeProjectId: "project-lineage",
        projects: [],
        activeProject: {
          id: "project-lineage",
          source: {
            status: "ready",
            kind: "video",
            mode: "local",
            storedPath: "/tmp/source-active.mp4",
            storedFileName: "source-active.mp4",
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
              id: "source-old",
              type: "source",
              name: "source-old.mp4",
              localPath: "/tmp/source-old.mp4",
              createdAt: 100,
              sourceId: "source-old",
            },
            {
              id: "source-active",
              type: "source",
              name: "source-active.mp4",
              localPath: "/tmp/source-active.mp4",
              createdAt: 200,
              sourceId: "source-active",
              metadata: {
                storedFileName: "source-active.mp4",
              },
            },
            {
              id: "asset-audio-linked",
              type: "audio",
              name: "audio.wav",
              localPath: "/tmp/audio.wav",
              createdAt: 300,
              sourceId: "source-active",
              derivedFromAssetId: "source-active",
              derivedFromSourceId: "source-active",
              metadata: {
                durationMs: 1400,
                startOffsetMs: 0,
              },
            },
            {
              id: "asset-audio-stale",
              type: "audio",
              name: "stale.wav",
              localPath: "/tmp/stale.wav",
              createdAt: 400,
              sourceId: "source-active",
              derivedFromAssetId: "asset-missing",
              derivedFromSourceId: "source-missing",
            },
          ],
        },
      },
    });

    const state = store.getState();
    assert.equal(getCurrentSourceAsset(state)?.id, "source-active");
    assert.deepEqual(
      getLinkedAudioAssets(state, "source-active").map((asset) => asset.id),
      ["asset-audio-linked"]
    );
    assert.equal(getParentSourceForAsset(state, "asset-audio-linked")?.id, "source-active");
    assert.equal(getParentSourceForAsset(state, "asset-audio-stale"), null);
    assert.equal(isDualPreviewAvailable(state), true);
    assert.equal(isDualPreviewActive(state), false);
    assert.equal(getSelectedDualPreviewAudioAsset(state)?.id, "asset-audio-linked");
    assert.equal(getDualPreviewVolume(state), 1);

    store.dispatch({
      type: "asset-updated",
      id: "asset-audio-linked",
      patch: {
        name: "audio-linked.wav",
      },
    });
    assert.equal(
      getAssetById(store.getState(), "asset-audio-linked")?.derivedFromAssetId,
      "source-active"
    );
    assert.equal(
      getAssetById(store.getState(), "asset-audio-linked")?.derivedFromSourceId,
      "source-active"
    );
  });
  void test("laboratory hydrate ignores retired module manager persisted ui flags", () => {
    const store = createLabStore();
    const legacyPersistedPayload = {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: null,
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      moduleManagerOpen: true,
      workspace: {},
    } as unknown as NonNullable<ReturnType<typeof store.getState>["persisted"]>;

    store.dispatch({
      type: "hydrate",
      payload: legacyPersistedPayload,
    });

    assert.equal(store.getState().ui.toolManagerOpen, false);
  });
  void test("laboratory hydrate reconstructs an active selection from a valid persisted primitive range", () => {
    const store = createLabStore();

    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: null,
          projects: [],
        },
        workbench: {},
        sourceProbeStatus: "idle",
        reports: {
          user: null,
          ai: null,
          emptyReason: "Rapor henüz üretilmedi.",
        },
        activityFeed: [],
        workspace: {
          timelineStartMs: 2400,
          timelineEndMs: 5600,
          activeSelection: {
            id: "selection-persisted",
            startMs: 2400,
            endMs: 5600,
            type: "focus",
            label: "Door latch",
            roi: {
              x: 0.1,
              y: 0.2,
              width: 0.35,
              height: 0.4,
            },
            createdAt: 1700000000000,
          },
        },
      },
    });

    assert.deepEqual(store.getState().ui.workspace.activeSelection, {
      id: "selection-persisted",
      startMs: 2400,
      endMs: 5600,
      type: "focus",
      label: "Door latch",
      roi: {
        x: 0.1,
        y: 0.2,
        width: 0.35,
        height: 0.4,
      },
      createdAt: 1700000000000,
    });
  });
  void test("laboratory hydrate drops legacy pixel-like persisted selection roi values", () => {
    const store = createLabStore();

    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: null,
          projects: [],
        },
        workbench: {},
        sourceProbeStatus: "idle",
        reports: {
          user: null,
          ai: null,
          emptyReason: "Rapor henüz üretilmedi.",
        },
        activityFeed: [],
        workspace: {
          timelineStartMs: 2400,
          timelineEndMs: 5600,
          activeSelection: {
            id: "selection-persisted",
            startMs: 2400,
            endMs: 5600,
            type: "focus",
            roi: {
              x: 10,
              y: 20,
              width: 80,
              height: 60,
            },
            createdAt: 1700000000000,
          },
        },
      },
    });

    assert.equal(store.getState().ui.workspace.activeSelection?.roi, undefined);
  });
  void test("laboratory hydrate rebuilds selection identity from the primitive bridge on rehydrate", () => {
    const store = createLabStore();
    const originalDateNow = Date.now;

    try {
      Date.now = () => 1700000000000;
      store.dispatch({
        type: "workspace-timeline-updated",
        startMs: 1000,
        endMs: 3000,
      });

      const initialSelection = store.getState().ui.workspace.activeSelection;
      assert.ok(initialSelection);

      Date.now = () => 1700000005000;
      store.dispatch({
        type: "hydrate",
        payload: {
          featureId: "media-analysis",
          projectIndex: {
            activeProjectId: null,
            projects: [],
          },
          workbench: {},
          sourceProbeStatus: "idle",
          reports: {
            user: null,
            ai: null,
            emptyReason: "Rapor henüz üretilmedi.",
          },
          activityFeed: [],
          workspace: {
            timelineStartMs: 2400,
            timelineEndMs: 5600,
          },
        },
      });

      const rehydratedSelection = store.getState().ui.workspace.activeSelection;
      assert.ok(rehydratedSelection);
      assert.equal(rehydratedSelection.startMs, 2400);
      assert.equal(rehydratedSelection.endMs, 5600);
      assert.equal(rehydratedSelection.type, "clip");
      assert.equal("intent" in rehydratedSelection, false);
      assert.notEqual(rehydratedSelection.id, initialSelection.id);
      assert.equal(rehydratedSelection.createdAt, 1700000005000);
    } finally {
      Date.now = originalDateNow;
    }
  });
  void test("laboratory hydrate drops malformed persisted selection metadata fields", () => {
    const store = createLabStore();

    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: null,
          projects: [],
        },
        workbench: {},
        sourceProbeStatus: "idle",
        reports: {
          user: null,
          ai: null,
          emptyReason: "Rapor henüz üretilmedi.",
        },
        activityFeed: [],
        workspace: {
          timelineStartMs: 1500,
          timelineEndMs: 3600,
          activeSelection: {
            id: "selection-persisted-invalid-intent",
            startMs: 1500,
            endMs: 3600,
            type: "inspect",
            createdAt: 1700000000042,
          },
        },
      },
    });

    const selection = store.getState().ui.workspace.activeSelection;
    assert.ok(selection);
    assert.equal("intent" in selection, false);
  });
  void test("laboratory hydrate suppresses persisted selection entities when the primitive range is invalid", () => {
    const store = createLabStore();

    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: null,
          projects: [],
        },
        workbench: {},
        sourceProbeStatus: "idle",
        reports: {
          user: null,
          ai: null,
          emptyReason: "Rapor henüz üretilmedi.",
        },
        activityFeed: [],
        workspace: {
          timelineStartMs: 5600,
          timelineEndMs: 2400,
          activeSelection: {
            id: "selection-invalid",
            startMs: 5600,
            endMs: 2400,
            type: "inspect",
            createdAt: 1700000000001,
          },
        },
      },
    });

    assert.equal(store.getState().ui.workspace.timelineStartMs, 5600);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
    assert.equal(store.getState().ui.workspace.activeSelection, null);
  });
});
