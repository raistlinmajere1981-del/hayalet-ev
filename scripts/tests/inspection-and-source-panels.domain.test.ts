import { assert, createLabEventBus, createLabRunController, createLabStore, FakeActionElement, FakeControllerDocument, getActiveInspectionSnapshot, getInspectionMode, getRoiFocusActive, importLabRootModuleWithDomStub, test } from "./laboratory-runtime-truth.helpers.ts";

describe("inspection and source panels", () => {
  void test("laboratory store keeps inspection mode without requiring an active selection", () => {
    const store = createLabStore();

    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "visual",
    });

    assert.equal(store.getState().ui.workspace.activeSelection, null);
    assert.equal(getInspectionMode(store.getState()), "visual");
  });

  void test("laboratory store can synthesize and clear an image inspection selection from semantic roi updates", () => {
    const store = createLabStore();

    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "image",
        mode: "local",
        storedPath: "/tmp/source.png",
      },
    });

    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        x: 0.2,
        y: 0.1,
        width: 0.4,
        height: 0.5,
      },
    });

    assert.deepEqual(store.getState().ui.workspace.activeSelection, {
      id: store.getState().ui.workspace.activeSelection?.id,
      startMs: 0,
      endMs: 1,
      type: "inspect",
      roi: {
        x: 0.2,
        y: 0.1,
        width: 0.4,
        height: 0.5,
      },
      createdAt: store.getState().ui.workspace.activeSelection?.createdAt,
    });

    store.dispatch({
      type: "selection-roi-cleared",
    });

    assert.equal(store.getState().ui.workspace.activeSelection, null);
  });

  void test("laboratory inspection micro state stays UI-scoped and resets on hydrate", async () => {
    const store = createLabStore();
    const labRootModule = await importLabRootModuleWithDomStub<{
      __testOnlyLabRootPersistence: {
        readPersistableState: (state: ReturnType<typeof store.getState>) => Record<string, unknown>;
      };
    }>();

    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "image",
        mode: "local",
        storedPath: "/tmp/source.png",
      },
    });
    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        x: 0.2,
        y: 0.2,
        width: 0.24,
        height: 0.26,
      },
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "motion",
    });
    store.dispatch({
      type: "selection-roi-focus-set",
      active: true,
    });
    store.dispatch({
      type: "selection-roi-snapshot-set",
      snapshot: {
        id: "snapshot-1",
        objectUrl: "blob:roi-snapshot-1",
        width: 240,
        height: 180,
        sourceKind: "image",
        roi: {
          x: 0.2,
          y: 0.2,
          width: 0.24,
          height: 0.26,
        },
        createdAt: 1,
        timeMs: null,
      },
    });

    assert.equal(getInspectionMode(store.getState()), "motion");
    assert.equal(getRoiFocusActive(store.getState()), true);
    assert.equal(getActiveInspectionSnapshot(store.getState())?.id, "snapshot-1");

    const persistedState = labRootModule.__testOnlyLabRootPersistence.readPersistableState(
      store.getState()
    );

    assert.equal("inspectionMode" in persistedState, false);
    assert.equal("roiFocusActive" in persistedState, false);
    assert.equal("activeInspectionSnapshot" in persistedState, false);
    assert.equal(
      "inspectionMode" in ((persistedState["workspace"] ?? {}) as Record<string, unknown>),
      false
    );
    assert.equal(
      "roiFocusActive" in ((persistedState["workspace"] ?? {}) as Record<string, unknown>),
      false
    );
    assert.equal(
      "activeInspectionSnapshot" in
        ((persistedState["workspace"] ?? {}) as Record<string, unknown>),
      false
    );

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
        workspace: {},
      },
    });

    assert.equal(getInspectionMode(store.getState()), "none");
    assert.equal(getRoiFocusActive(store.getState()), false);
    assert.equal(getActiveInspectionSnapshot(store.getState()), null);
  });

  void test("laboratory source changes clear semantic roi and reset inspection mode", () => {
    const store = createLabStore();

    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "video",
        mode: "local",
        storedPath: "/tmp/source-a.mp4",
      },
    });
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });
    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        x: 0.2,
        y: 0.2,
        width: 0.25,
        height: 0.25,
      },
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "visual",
    });
    store.dispatch({
      type: "selection-roi-focus-set",
      active: true,
    });
    store.dispatch({
      type: "selection-roi-snapshot-set",
      snapshot: {
        id: "snapshot-reset",
        objectUrl: "blob:roi-reset",
        width: 120,
        height: 120,
        sourceKind: "video",
        roi: {
          x: 0.2,
          y: 0.2,
          width: 0.25,
          height: 0.25,
        },
        createdAt: 2,
        timeMs: 1400,
      },
    });

    store.dispatch({
      type: "source-config-patched",
      patch: {
        storedPath: "/tmp/source-b.mp4",
      },
    });

    assert.equal(store.getState().ui.workspace.activeSelection, null);
    assert.equal(getInspectionMode(store.getState()), "none");
    assert.equal(getRoiFocusActive(store.getState()), false);
    assert.equal(getActiveInspectionSnapshot(store.getState()), null);
  });

  void test("laboratory source panel delete action removes a confirmed asset", () => {
    const originalElement = globalThis.Element;
    const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
    const confirmMessages: string[] = [];
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();

    class TestElement extends FakeActionElement {}

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: TestElement,
    });

    try {
      eventBus.subscribe(function (event) {
        store.dispatch(event);
      });
      store.dispatch({
        type: "asset-added",
        asset: {
          id: "asset-source-1",
          type: "source",
          name: "source.mp4",
          localPath: "/tmp/source.mp4",
          createdAt: 100,
        },
      });

      const controller = createLabRunController({
        documentRef: documentRef as unknown as Document,
        eventBus,
        store,
        windowRef: {
          roomAPI: {
            sendEvent(eventName: string, payload: Record<string, unknown>) {
              sentEvents.push({ eventName, payload });
            },
          },
          confirm(message: string) {
            confirmMessages.push(message);
            return true;
          },
          addEventListener() {},
        } as unknown as Window,
      });
      controller.attach();

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);

      clickListener({
        target: new TestElement("asset-remove", "asset-source-1"),
      } as unknown as Event);

      assert.equal(confirmMessages.length, 1);
      assert.match(confirmMessages[0] ?? "", /source\.mp4/);
      assert.deepEqual(
        sentEvents.map(function (event) {
          return {
            action: event.payload["action"],
            assetId: (event.payload["payload"] as Record<string, unknown>)["assetId"],
            eventName: event.eventName,
          };
        }),
        [{ eventName: "media-action", action: "asset-remove", assetId: "asset-source-1" }]
      );
    } finally {
      if (typeof originalElement === "undefined") {
        delete (globalThis as Record<string, unknown>)["Element"];
      } else {
        Object.defineProperty(globalThis, "Element", {
          configurable: true,
          value: originalElement,
        });
      }
    }
  });

  void test("laboratory asset delete actions stop when confirmation is rejected", () => {
    const originalElement = globalThis.Element;
    const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
    const confirmMessages: string[] = [];
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();

    class TestElement extends FakeActionElement {}

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: TestElement,
    });

    try {
      eventBus.subscribe(function (event) {
        store.dispatch(event);
      });
      store.dispatch({
        type: "asset-added",
        asset: {
          id: "asset-cancel-delete",
          type: "report",
          name: "keep-report.md",
          localPath: "/tmp/keep-report.md",
          createdAt: 300,
        },
      });

      const controller = createLabRunController({
        documentRef: documentRef as unknown as Document,
        eventBus,
        store,
        windowRef: {
          roomAPI: {
            sendEvent(eventName: string, payload: Record<string, unknown>) {
              sentEvents.push({ eventName, payload });
            },
          },
          confirm(message: string) {
            confirmMessages.push(message);
            return false;
          },
          addEventListener() {},
        } as unknown as Window,
      });
      controller.attach();

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);

      clickListener({
        target: new TestElement("asset-remove", "asset-cancel-delete"),
      } as unknown as Event);

      assert.deepEqual(sentEvents, []);
      assert.equal(confirmMessages.length, 1);
      assert.match(confirmMessages[0] ?? "", /keep-report\.md/);
    } finally {
      if (typeof originalElement === "undefined") {
        delete (globalThis as Record<string, unknown>)["Element"];
      } else {
        Object.defineProperty(globalThis, "Element", {
          configurable: true,
          value: originalElement,
        });
      }
    }
  });

  void test("laboratory source panel media click opens workspace content without host source activation", () => {
    const originalElement = globalThis.Element;
    const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();

    class TestElement extends FakeActionElement {}

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: TestElement,
    });

    try {
      eventBus.subscribe(function (event) {
        store.dispatch(event);
      });
      store.dispatch({
        type: "asset-added",
        asset: {
          id: "asset-source-1",
          type: "source",
          name: "source.mp4",
          localPath: "/tmp/source.mp4",
          createdAt: 100,
        },
      });

      const controller = createLabRunController({
        documentRef: documentRef as unknown as Document,
        eventBus,
        store,
        windowRef: {
          roomAPI: {
            sendEvent(eventName: string, payload: Record<string, unknown>) {
              sentEvents.push({ eventName, payload });
            },
          },
          addEventListener() {},
        } as unknown as Window,
      });
      controller.attach();

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);

      clickListener({
        target: new TestElement("workspace-asset-select", "asset-source-1"),
      } as unknown as Event);

      assert.equal(sentEvents.length, 0);
      assert.equal(store.getState().ui.activeWorkspaceAssetId, "asset-source-1");
    } finally {
      if (typeof originalElement === "undefined") {
        delete (globalThis as Record<string, unknown>)["Element"];
      } else {
        Object.defineProperty(globalThis, "Element", {
          configurable: true,
          value: originalElement,
        });
      }
    }
  });
});
