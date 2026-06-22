import {
  assert,
  createLabEventBus,
  createLabRunController,
  createLabStore,
  FakeActionElement,
  FakeControllerDocument,
  FakeDualPreviewDocument,
  FakeMediaElement,
  FakeMouseEvent,
  FakePlayheadElement,
  FakeTextElement,
  FakeTimelineActionElement,
  FakeTimelineRoot,
  FakeTimelineTrack,
  FakeWindowEventTarget,
  getActiveInspectionSnapshot,
  getActiveSelection,
  getInspectionMode,
  getRoiFocusActive,
  getSelectionDuration,
  importLabRootModuleWithDomStub,
  installTimerMock,
  isSelectionValid,
  LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { closeLabAssetMenusForClick } from "../../rooms/laboratory/runtime/controller/lab-asset-context-menu-controller.ts";
import { resolveDrawerMode } from "../../rooms/laboratory/runtime/lab-selectors.ts";

describe("workspace media and finding focus", () => {
  void test("laboratory run controller replaces workspace media from enhanced frame outputs", () => {
    const originalElement = globalThis.Element;

    class TestElement extends FakeActionElement {}

    function createScenario() {
      const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
      const documentRef = new FakeControllerDocument();
      const eventBus = createLabEventBus();
      const store = createLabStore();
      eventBus.subscribe(function (event) {
        store.dispatch(event);
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
      return {
        click(action: string) {
          clickListener({ target: new TestElement(action) } as unknown as Event);
        },
        eventBus,
        sentEvents,
        store,
      };
    }

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: TestElement,
    });

    try {
      const single = createScenario();
      single.store.dispatch({
        type: "source-config-patched",
        patch: {
          kind: "image",
          mode: "local",
          storedPath: "/tmp/single.png",
        },
      });
      single.store.dispatch({ type: "workspace-asset-selected", assetId: "asset-single" });

      single.click("workspace-enhanced-frame-export");

      assert.equal(single.sentEvents.length, 1);
      assert.equal(single.sentEvents[0]?.payload["action"], "export-enhanced-frame");
      const singlePayload = single.sentEvents[0].payload["payload"] as Record<string, unknown>;
      assert.equal(singlePayload["workspaceTargetAssetId"], "asset-single");
      assert.equal(singlePayload["workspaceResultMode"], "replace-workspace-media");
      assert.equal(singlePayload["workspaceResultTargetSide"], "single");

      const singleRequestId = single.sentEvents[0].payload["requestId"] as string;
      single.eventBus.emit({
        type: "host-event-received",
        event: {
          id: "evt-single-enhanced-frame",
          kind: "job",
          severity: "success",
          message: "Enhanced frame completed",
          detail: null,
          action: "export-enhanced-frame",
          stage: "completed",
          timestamp: Date.now(),
          source: "host",
          scope: "global",
          moduleId: null,
          rawLine: null,
          requestId: singleRequestId,
          resultAssetIds: ["asset-single-enhanced"],
        } as never,
      });
      single.eventBus.emit({
        type: "asset-added",
        asset: {
          id: "asset-single-enhanced",
          type: "image",
          name: "single-enhanced.png",
          localPath: "/tmp/single-enhanced.png",
          createdAt: 300,
        },
      });
      assert.equal(single.store.getState().ui.activeWorkspaceAssetId, "asset-single-enhanced");
      assert.equal(single.store.getState().ui.workspace.comparisonReferenceAssetId, null);

      const comparison = createScenario();
      comparison.store.dispatch({
        type: "source-config-patched",
        patch: {
          kind: "image",
          mode: "local",
          storedPath: "/tmp/primary.png",
        },
      });
      comparison.store.dispatch({ type: "workspace-asset-selected", assetId: "asset-primary" });
      comparison.store.dispatch({
        type: "workspace-comparison-reference-set",
        assetId: "asset-reference",
      });
      comparison.store.dispatch({
        type: "selection-roi-updated",
        comparisonSide: "primary",
        roi: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      });

      comparison.click("workspace-enhanced-frame-export");

      assert.equal(comparison.sentEvents.length, 2);
      const primaryPayload = comparison.sentEvents[0]?.payload["payload"] as Record<
        string,
        unknown
      >;
      const referencePayload = comparison.sentEvents[1]?.payload["payload"] as Record<
        string,
        unknown
      >;
      assert.equal(primaryPayload["workspaceTargetAssetId"], "asset-primary");
      assert.equal(primaryPayload["workspaceResultMode"], "replace-workspace-media");
      assert.equal(primaryPayload["workspaceResultTargetSide"], "primary");
      assert.equal(primaryPayload["allowParallelWorkspaceOperation"], true);
      assert.deepEqual(primaryPayload["normalizedRoi"], {
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
      });
      assert.equal(referencePayload["workspaceTargetAssetId"], "asset-reference");
      assert.equal(referencePayload["workspaceResultMode"], "replace-workspace-media");
      assert.equal(referencePayload["workspaceResultTargetSide"], "reference");
      assert.equal(referencePayload["allowParallelWorkspaceOperation"], true);
      assert.equal(referencePayload["normalizedRoi"], null);

      const primaryRequestId = comparison.sentEvents[0]?.payload["requestId"] as string;
      const referenceRequestId = comparison.sentEvents[1]?.payload["requestId"] as string;
      comparison.eventBus.emit({
        type: "host-event-received",
        event: {
          id: "evt-primary-enhanced-frame",
          kind: "job",
          severity: "success",
          message: "Primary enhanced frame completed",
          detail: null,
          action: "export-enhanced-frame",
          stage: "completed",
          timestamp: Date.now(),
          source: "host",
          scope: "global",
          moduleId: null,
          rawLine: null,
          requestId: primaryRequestId,
          resultAssetIds: ["asset-primary-enhanced"],
        } as never,
      });
      comparison.eventBus.emit({
        type: "asset-added",
        asset: {
          id: "asset-primary-enhanced",
          type: "image",
          name: "primary-enhanced.png",
          localPath: "/tmp/primary-enhanced.png",
          createdAt: 301,
        },
      });
      comparison.eventBus.emit({
        type: "asset-added",
        asset: {
          id: "asset-reference-enhanced",
          type: "image",
          name: "reference-enhanced.png",
          localPath: "/tmp/reference-enhanced.png",
          createdAt: 302,
        },
      });
      comparison.eventBus.emit({
        type: "host-event-received",
        event: {
          id: "evt-reference-enhanced-frame",
          kind: "job",
          severity: "success",
          message: "Reference enhanced frame completed",
          detail: null,
          action: "export-enhanced-frame",
          stage: "completed",
          timestamp: Date.now(),
          source: "host",
          scope: "global",
          moduleId: null,
          rawLine: null,
          requestId: referenceRequestId,
          resultAssetIds: ["asset-reference-enhanced"],
        } as never,
      });
      assert.equal(comparison.store.getState().ui.activeWorkspaceAssetId, "asset-primary-enhanced");
      assert.equal(
        comparison.store.getState().ui.workspace.comparisonReferenceAssetId,
        "asset-reference-enhanced"
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

  void test("laboratory run controller restores comparison finding focus from inspector actions", () => {
    const originalElement = globalThis.Element;
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

      const controller = createLabRunController({
        documentRef: documentRef as unknown as Document,
        eventBus,
        store,
        windowRef: {
          addEventListener() {},
        } as unknown as Window,
      });
      controller.attach();

      store.dispatch({
        type: "source-config-patched",
        patch: {
          kind: "image",
          mode: "local",
          storedPath: "/tmp/source.png",
        },
      });
      store.dispatch({
        type: "asset-added",
        asset: {
          id: "asset-primary",
          type: "image",
          name: "primary.png",
          localPath: "/tmp/primary.png",
          createdAt: 10,
          metadata: { kind: "image" },
        },
      });
      store.dispatch({
        type: "asset-added",
        asset: {
          id: "asset-reference",
          type: "image",
          name: "reference.png",
          localPath: "/tmp/reference.png",
          createdAt: 11,
          metadata: { kind: "image" },
        },
      });
      store.dispatch({
        type: "asset-added",
        asset: {
          id: "asset-manifest",
          type: "artifact",
          name: "comparison-finding.json",
          localPath: "/tmp/comparison-finding.json",
          createdAt: 12,
          metadata: {
            artifactKind: "comparison-finding-manifest",
            captureContext: {
              comparisonRois: {
                activeSide: "reference",
                primary: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
                reference: { x: 0.2, y: 0.1, width: 0.25, height: 0.35 },
              },
              comparisonViewMode: "roi-detail",
              primaryAssetId: "asset-primary",
              referenceAssetId: "asset-reference",
              splitPercent: 44,
            },
            findingId: "finding-restore",
            primaryAssetId: "asset-primary",
            referenceAssetId: "asset-reference",
          },
        },
      });

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);
      clickListener({
        target: new TestElement("workspace-comparison-finding-focus", "finding-restore"),
      } as unknown as Event);

      const workspace = store.getState().ui.workspace;
      assert.equal(store.getState().ui.activeWorkspaceAssetId, "asset-primary");
      assert.equal(workspace.comparisonReferenceAssetId, "asset-reference");
      assert.equal(workspace.comparisonViewMode, "roi-detail");
      assert.equal(workspace.comparisonSplitPercent, 44);
      assert.equal(workspace.activeIconRailSlot, "image-comparison");
      assert.equal(workspace.controlsDrawerTab, "audio");
      assert.equal(workspace.comparisonRois.activeSide, "reference");
      assert.deepEqual(workspace.comparisonRois.primary, {
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
      });
      assert.deepEqual(workspace.comparisonRois.reference, {
        x: 0.2,
        y: 0.1,
        width: 0.25,
        height: 0.35,
      });
      assert.deepEqual(workspace.activeSelection?.roi, {
        x: 0.2,
        y: 0.1,
        width: 0.25,
        height: 0.35,
      });
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
