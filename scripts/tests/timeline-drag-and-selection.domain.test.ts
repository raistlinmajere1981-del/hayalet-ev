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

describe("timeline drag and selection", () => {
  void test("laboratory run controller keeps timeline drag selection stable after timeline rerender", () => {
    const originalElement = globalThis.Element;
    const originalMouseEvent = globalThis.MouseEvent;
    const preview = new FakeMediaElement();
    preview.duration = 10;
    const documentRef = new FakeDualPreviewDocument(
      new Map<string, unknown>([['video[data-lab-preserve-media="workspace-preview"]', preview]]),
      [preview]
    );
    const windowRef = new FakeWindowEventTarget();
    const eventBus = createLabEventBus();
    const store = createLabStore();

    class RelayoutTimelineTrack extends FakeTimelineTrack {
      private collapsed = false;

      collapse() {
        this.collapsed = true;
      }

      override getBoundingClientRect() {
        return {
          left: 100,
          width: this.collapsed ? 0 : 1000,
        };
      }
    }

    const track = new RelayoutTimelineTrack(100, 1000);
    const timeline = new FakeTimelineRoot(track, 10000);

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: FakeTimelineActionElement,
    });
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: FakeMouseEvent,
    });

    try {
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

      const mouseDownListener = documentRef.listeners.get("mousedown");
      const mouseMoveListener = windowRef.listeners.get("mousemove");
      const mouseUpListener = windowRef.listeners.get("mouseup");
      assert.ok(mouseDownListener);
      assert.ok(mouseMoveListener);
      assert.ok(mouseUpListener);

      const railTarget = new FakeTimelineActionElement("timeline-interact", timeline);

      mouseDownListener(
        new FakeMouseEvent(railTarget as unknown as EventTarget, 350) as unknown as Event
      );
      track.collapse();
      mouseMoveListener(
        new FakeMouseEvent(railTarget as unknown as EventTarget, 550) as unknown as Event
      );
      mouseUpListener({} as unknown as Event);

      assert.equal(preview.currentTime, 4.5);
      assert.equal(store.getState().ui.workspace.timelineStartMs, 2500);
      assert.equal(store.getState().ui.workspace.timelineEndMs, 4500);
    } finally {
      if (typeof originalElement === "undefined") {
        delete (globalThis as Record<string, unknown>)["Element"];
      } else {
        Object.defineProperty(globalThis, "Element", {
          configurable: true,
          value: originalElement,
        });
      }
      if (typeof originalMouseEvent === "undefined") {
        delete (globalThis as Record<string, unknown>)["MouseEvent"];
      } else {
        Object.defineProperty(globalThis, "MouseEvent", {
          configurable: true,
          value: originalMouseEvent,
        });
      }
    }
  });

  void test("laboratory run controller drags timeline start and end handles independently", () => {
    const originalElement = globalThis.Element;
    const originalMouseEvent = globalThis.MouseEvent;
    const preview = new FakeMediaElement();
    preview.duration = 10;
    const documentRef = new FakeDualPreviewDocument(
      new Map<string, unknown>([['video[data-lab-preserve-media="workspace-preview"]', preview]]),
      [preview]
    );
    const windowRef = new FakeWindowEventTarget();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    const track = new FakeTimelineTrack(100, 1000);
    const timeline = new FakeTimelineRoot(track, 10000);

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: FakeTimelineActionElement,
    });
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: FakeMouseEvent,
    });

    try {
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
      store.dispatch({
        type: "workspace-timeline-updated",
        startMs: 1000,
        endMs: 3000,
      });

      const mouseDownListener = documentRef.listeners.get("mousedown");
      const mouseMoveListener = windowRef.listeners.get("mousemove");
      const mouseUpListener = windowRef.listeners.get("mouseup");
      assert.ok(mouseDownListener);
      assert.ok(mouseMoveListener);
      assert.ok(mouseUpListener);

      mouseDownListener(
        new FakeMouseEvent(
          new FakeTimelineActionElement("timeline-drag-start", timeline) as unknown as EventTarget,
          200
        ) as unknown as Event
      );
      mouseMoveListener({ clientX: 150 } as MouseEvent);
      mouseUpListener({} as unknown as Event);

      assert.equal(store.getState().ui.workspace.timelineStartMs, 500);
      assert.equal(store.getState().ui.workspace.timelineEndMs, 3000);
      assert.equal(preview.currentTime, 0.5);

      mouseDownListener(
        new FakeMouseEvent(
          new FakeTimelineActionElement("timeline-drag-end", timeline) as unknown as EventTarget,
          400
        ) as unknown as Event
      );
      mouseMoveListener({ clientX: 650 } as MouseEvent);
      mouseUpListener({} as unknown as Event);

      assert.equal(store.getState().ui.workspace.timelineStartMs, 500);
      assert.equal(store.getState().ui.workspace.timelineEndMs, 5500);
      assert.equal(preview.currentTime, 5.5);
    } finally {
      if (typeof originalElement === "undefined") {
        delete (globalThis as Record<string, unknown>)["Element"];
      } else {
        Object.defineProperty(globalThis, "Element", {
          configurable: true,
          value: originalElement,
        });
      }
      if (typeof originalMouseEvent === "undefined") {
        delete (globalThis as Record<string, unknown>)["MouseEvent"];
      } else {
        Object.defineProperty(globalThis, "MouseEvent", {
          configurable: true,
          value: originalMouseEvent,
        });
      }
    }
  });

  void test("laboratory run controller drags the timeline selection body from the pointer-down offset", () => {
    const originalElement = globalThis.Element;
    const originalMouseEvent = globalThis.MouseEvent;
    const preview = new FakeMediaElement();
    preview.duration = 10;
    const documentRef = new FakeDualPreviewDocument(
      new Map<string, unknown>([['video[data-lab-preserve-media="workspace-preview"]', preview]]),
      [preview]
    );
    const windowRef = new FakeWindowEventTarget();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    const track = new FakeTimelineTrack(100, 1000);
    const timeline = new FakeTimelineRoot(track, 10000);

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: FakeTimelineActionElement,
    });
    Object.defineProperty(globalThis, "MouseEvent", {
      configurable: true,
      value: FakeMouseEvent,
    });

    try {
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
      store.dispatch({
        type: "workspace-timeline-updated",
        startMs: 1000,
        endMs: 3000,
      });

      const mouseDownListener = documentRef.listeners.get("mousedown");
      const mouseMoveListener = windowRef.listeners.get("mousemove");
      const mouseUpListener = windowRef.listeners.get("mouseup");
      assert.ok(mouseDownListener);
      assert.ok(mouseMoveListener);
      assert.ok(mouseUpListener);

      const actionTarget = new FakeTimelineActionElement("timeline-drag-body", timeline);

      mouseDownListener(
        new FakeMouseEvent(actionTarget as unknown as EventTarget, 250) as unknown as Event
      );
      mouseMoveListener(
        new FakeMouseEvent(actionTarget as unknown as EventTarget, 650) as unknown as Event
      );

      assert.equal(store.getState().ui.workspace.timelineStartMs, 5000);
      assert.equal(store.getState().ui.workspace.timelineEndMs, 7000);

      mouseUpListener({} as unknown as Event);
      assert.equal(preview.currentTime, 5);
    } finally {
      if (typeof originalElement === "undefined") {
        delete (globalThis as Record<string, unknown>)["Element"];
      } else {
        Object.defineProperty(globalThis, "Element", {
          configurable: true,
          value: originalElement,
        });
      }
      if (typeof originalMouseEvent === "undefined") {
        delete (globalThis as Record<string, unknown>)["MouseEvent"];
      } else {
        Object.defineProperty(globalThis, "MouseEvent", {
          configurable: true,
          value: originalMouseEvent,
        });
      }
    }
  });

  void test("laboratory run controller applies timeline finetune and clear actions from the unified timeline", () => {
    const originalElement = globalThis.Element;
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    const timeline = new FakeTimelineRoot(new FakeTimelineTrack(100, 1000), 10000);

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: FakeTimelineActionElement,
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
          roomAPI: {
            sendEvent() {},
          },
          addEventListener() {},
        } as unknown as Window,
      });

      controller.attach();
      store.dispatch({
        type: "workspace-timeline-updated",
        startMs: 1000,
        endMs: 3000,
      });
      store.dispatch({
        type: "selection-inspection-mode-updated",
        mode: "audio",
      });

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);

      clickListener(
        new FakeMouseEvent(
          new FakeTimelineActionElement(
            "timeline-finetune",
            timeline,
            "start:+100"
          ) as unknown as EventTarget,
          0
        ) as unknown as Event
      );
      clickListener(
        new FakeMouseEvent(
          new FakeTimelineActionElement(
            "timeline-finetune",
            timeline,
            "end:-500"
          ) as unknown as EventTarget,
          0
        ) as unknown as Event
      );

      assert.equal(store.getState().ui.workspace.timelineStartMs, 1100);
      assert.equal(store.getState().ui.workspace.timelineEndMs, 2500);
      assert.equal(getInspectionMode(store.getState()), "audio");

      clickListener(
        new FakeMouseEvent(
          new FakeTimelineActionElement("timeline-clear", timeline) as unknown as EventTarget,
          0
        ) as unknown as Event
      );

      assert.equal(store.getState().ui.workspace.timelineStartMs, null);
      assert.equal(store.getState().ui.workspace.timelineEndMs, null);
      assert.equal(getInspectionMode(store.getState()), "audio");
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

  void test("laboratory store promotes timeline ranges into stable selection entities", () => {
    const store = createLabStore();

    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });

    const firstSelection = store.getState().ui.workspace.activeSelection;
    assert.ok(firstSelection);
    assert.equal(firstSelection.type, "clip");
    assert.equal(firstSelection.startMs, 1000);
    assert.equal(firstSelection.endMs, 3000);
    assert.ok(typeof firstSelection.id === "string" && firstSelection.id.length > 0);
    assert.equal(getActiveSelection(store.getState())?.id, firstSelection.id);
    assert.equal(isSelectionValid(store.getState()), true);
    assert.equal(getSelectionDuration(store.getState()), 2000);
    assert.equal(getInspectionMode(store.getState()), "none");

    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "audio",
    });

    assert.equal(getInspectionMode(store.getState()), "audio");

    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        x: 0.1,
        y: 0.15,
        width: 0.3,
        height: 0.35,
      },
    });

    assert.deepEqual(store.getState().ui.workspace.activeSelection?.roi, {
      x: 0.1,
      y: 0.15,
      width: 0.3,
      height: 0.35,
    });
    store.dispatch({
      type: "selection-roi-focus-set",
      active: true,
    });
    store.dispatch({
      type: "selection-roi-snapshot-set",
      snapshot: {
        id: "selection-snapshot",
        objectUrl: "blob:selection-snapshot",
        width: 200,
        height: 120,
        sourceKind: "video",
        roi: {
          x: 0.1,
          y: 0.15,
          width: 0.3,
          height: 0.35,
        },
        createdAt: 3,
        timeMs: 1_400,
      },
    });

    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1200,
      endMs: 3400,
    });

    const evolvedSelection = store.getState().ui.workspace.activeSelection;
    assert.ok(evolvedSelection);
    assert.equal(evolvedSelection.id, firstSelection.id);
    assert.equal(evolvedSelection.createdAt, firstSelection.createdAt);
    assert.equal(evolvedSelection.startMs, 1200);
    assert.equal(evolvedSelection.endMs, 3400);
    assert.equal(evolvedSelection.roi, undefined);
    assert.equal(getRoiFocusActive(store.getState()), false);
    assert.equal(getActiveInspectionSnapshot(store.getState()), null);

    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1200,
      endMs: 1100,
    });

    assert.equal(store.getState().ui.workspace.activeSelection, null);
    assert.equal(isSelectionValid(store.getState()), false);
    assert.equal(getSelectionDuration(store.getState()), 0);
    assert.equal(getInspectionMode(store.getState()), "audio");
  });
});
