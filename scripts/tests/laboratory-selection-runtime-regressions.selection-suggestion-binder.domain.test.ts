import { assert, bindLabPreviewInspectionInteractions, bindLabSelectionRoiInteractions, bindLabSelectionSuggestionClicks, createLabEventBus, createLabStore, FakeClickEvent, FakeControllerDocument, FakeDomElement, FakeInspectionModeTarget, FakeInspectionModeTrigger, FakeRoiClearTarget, FakeRoiDrawTarget, FakeRoiStage, getActiveExecutionIntent, getActiveSelection, getActiveSuggestionPreviewId, getInspectionMode, getSelectionSuggestions, test } from "./laboratory-runtime-truth.helpers.ts";


describe("selection suggestion binder", () => {
  void test("selection suggestion binder gates soft execution intent actions by the exact active preview id", () => {
    class FakeClosestTarget extends FakeDomElement {
      constructor(private readonly selectors: Record<string, object | null>) {
        super();
      }

      override closest(selector?: string): any {
        return this.selectors[selector ?? ""] ?? null;
      }
    }

    class FakeExecutionIntentTrigger {
      constructor(
        private readonly attrName: string,
        private readonly suggestionId: string | null
      ) {}

      getAttribute(name: string) {
        return name === this.attrName ? this.suggestionId : null;
      }
    }

    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(store.dispatch);
    bindLabSelectionSuggestionClicks({
      canPreviewSuggestion(suggestionId) {
        return getSelectionSuggestions(store.getState()).some(function (suggestion) {
          return suggestion.id === suggestionId;
        });
      },
      documentRef: documentRef,
      emit: eventBus.emit,
      getActivePreviewSuggestionId() {
        return getActiveSuggestionPreviewId(store.getState());
      },
    });

    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "audio",
        mode: "local",
        storedPath: "/tmp/source.wav",
      },
    });
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1200,
      endMs: 2600,
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "audio",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({
      target: new FakeClosestTarget({
        "[data-lab-execution-intent-accept]": new FakeExecutionIntentTrigger(
          "data-lab-execution-intent-accept",
          "extract-clip"
        ),
      }) as unknown as EventTarget,
      preventDefault() {
        throw new Error("mismatched preview ids should not be consumed");
      },
    } as unknown as Event);
    assert.equal(getActiveExecutionIntent(store.getState()), null);

    const acceptEvent = new FakeClickEvent(
      new FakeClosestTarget({
        "[data-lab-execution-intent-accept]": new FakeExecutionIntentTrigger(
          "data-lab-execution-intent-accept",
          "audio-inspect"
        ),
      }) as unknown as EventTarget
    );
    clickListener?.(acceptEvent as unknown as Event);
    assert.equal(acceptEvent.defaultPrevented, true);
    assert.equal(getActiveExecutionIntent(store.getState())?.id, "audio-inspect");

    const queueEvent = new FakeClickEvent(
      new FakeClosestTarget({
        "[data-lab-execution-intent-queue]": new FakeExecutionIntentTrigger(
          "data-lab-execution-intent-queue",
          "audio-inspect"
        ),
      }) as unknown as EventTarget
    );
    clickListener?.(queueEvent as unknown as Event);
    assert.equal(queueEvent.defaultPrevented, true);
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });

    const dismissEvent = new FakeClickEvent(
      new FakeClosestTarget({
        "[data-lab-execution-intent-dismiss]": new FakeExecutionIntentTrigger(
          "data-lab-execution-intent-dismiss",
          "audio-inspect"
        ),
      }) as unknown as EventTarget
    );
    clickListener?.(dismissEvent as unknown as Event);
    assert.equal(dismissEvent.defaultPrevented, true);
    assert.equal(getActiveExecutionIntent(store.getState()), null);
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);

    const clearEvent = new FakeClickEvent(
      new FakeClosestTarget({
        "[data-lab-execution-intent-clear]": {},
      }) as unknown as EventTarget
    );
    clickListener?.(clearEvent as unknown as Event);
    assert.equal(clearEvent.defaultPrevented, true);

    assert.equal(
      eventBus.getHistory().some(function (event) {
        return (
          event.type === "workspace-selection-suggestion-accepted" &&
          event.suggestionId === "audio-inspect"
        );
      }),
      true
    );
    assert.equal(
      eventBus.getHistory().some(function (event) {
        return (
          event.type === "workspace-selection-suggestion-dismissed" &&
          event.suggestionId === "audio-inspect"
        );
      }),
      true
    );
    assert.equal(
      eventBus.getHistory().some(function (event) {
        return (
          event.type === "workspace-selection-suggestion-queued" &&
          event.suggestionId === "audio-inspect"
        );
      }),
      true
    );
    assert.equal(
      eventBus.getHistory().some(function (event) {
        return event.type === "workspace-execution-intent-cleared";
      }),
      true
    );
  });
  void test("selection roi binder enforces minimum drag size and emits passive roi + inspection events", () => {
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(store.dispatch);
    bindLabSelectionRoiInteractions({
      documentRef: documentRef,
      emit: eventBus.emit,
      getActiveSelection() {
        return store.getState().ui.workspace.activeSelection;
      },
      getSourceKind() {
        return "video";
      },
    });

    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "video",
        mode: "local",
        storedPath: "/tmp/source.mp4",
      },
    });
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });

    const mouseDownListener = documentRef.listeners.get("mousedown");
    const mouseMoveListener = documentRef.listeners.get("mousemove");
    const mouseUpListener = documentRef.listeners.get("mouseup");
    const clickListener = documentRef.listeners.get("click");
    assert.ok(mouseDownListener);
    assert.ok(mouseMoveListener);
    assert.ok(mouseUpListener);
    assert.ok(clickListener);

    const stage = new FakeRoiStage(
      {
        "data-lab-selection-roi-controls-reserve": "0",
      },
      {
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        bottom: 100,
      }
    );

    mouseDownListener?.({
      button: 0,
      clientX: 10,
      clientY: 10,
      preventDefault() {},
      target: new FakeRoiDrawTarget(stage) as unknown as EventTarget,
    } as unknown as Event);
    mouseMoveListener?.({
      clientX: 14,
      clientY: 15,
      preventDefault() {},
    } as unknown as Event);

    assert.equal(store.getState().ui.workspace.activeSelection?.roi, undefined);

    mouseMoveListener?.({
      clientX: 70,
      clientY: 60,
      preventDefault() {},
    } as unknown as Event);
    mouseUpListener?.({} as unknown as Event);

    assert.deepEqual(store.getState().ui.workspace.activeSelection?.roi, {
      x: 0.05,
      y: 0.1,
      width: 0.3,
      height: 0.5,
    });

    clickListener?.(
      new FakeClickEvent(
        new FakeInspectionModeTarget(
          new FakeInspectionModeTrigger("motion")
        ) as unknown as EventTarget
      ) as unknown as Event
    );
    assert.equal(getInspectionMode(store.getState()), "motion");

    clickListener?.(
      new FakeClickEvent(new FakeRoiClearTarget() as unknown as EventTarget) as unknown as Event
    );
    assert.equal(store.getState().ui.workspace.activeSelection?.roi, undefined);
  });
  void test("selection roi binder tags comparison side roi updates from the active image pane", () => {
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(store.dispatch);
    bindLabSelectionRoiInteractions({
      documentRef: documentRef,
      emit: eventBus.emit,
      getActiveSelection() {
        return store.getState().ui.workspace.activeSelection;
      },
      getComparisonRoi(side) {
        return store.getState().ui.workspace.comparisonRois[side];
      },
      getSourceKind() {
        return "image";
      },
    });
    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "image",
        mode: "local",
        storedPath: "/tmp/comparison-primary.png",
      },
    });

    const mouseDownListener = documentRef.listeners.get("mousedown");
    const mouseMoveListener = documentRef.listeners.get("mousemove");
    const mouseUpListener = documentRef.listeners.get("mouseup");
    assert.ok(mouseDownListener);
    assert.ok(mouseMoveListener);
    assert.ok(mouseUpListener);

    const primaryStage = new FakeRoiStage(
      {
        "data-lab-comparison-roi-side": "primary",
        "data-lab-selection-roi-controls-reserve": "0",
      },
      {
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        bottom: 100,
      }
    );
    mouseDownListener?.({
      button: 0,
      clientX: 20,
      clientY: 10,
      preventDefault() {},
      target: new FakeRoiDrawTarget(primaryStage) as unknown as EventTarget,
    } as unknown as Event);
    mouseMoveListener?.({
      clientX: 100,
      clientY: 60,
      preventDefault() {},
    } as unknown as Event);
    mouseUpListener?.({} as unknown as Event);

    assert.equal(store.getState().ui.workspace.comparisonRois.activeSide, "primary");
    assert.deepEqual(store.getState().ui.workspace.comparisonRois.primary, {
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.5,
    });

    const referenceStage = new FakeRoiStage(
      {
        "data-lab-comparison-roi-side": "reference",
        "data-lab-selection-roi-controls-reserve": "0",
      },
      {
        left: 0,
        top: 0,
        width: 200,
        height: 100,
        bottom: 100,
      }
    );
    mouseDownListener?.({
      button: 0,
      clientX: 30,
      clientY: 20,
      preventDefault() {},
      target: new FakeRoiDrawTarget(referenceStage) as unknown as EventTarget,
    } as unknown as Event);
    mouseUpListener?.({} as unknown as Event);

    assert.equal(store.getState().ui.workspace.comparisonRois.activeSide, "reference");
    assert.equal(store.getState().ui.workspace.activeSelection, null);

    mouseDownListener?.({
      button: 0,
      clientX: 30,
      clientY: 20,
      preventDefault() {},
      target: new FakeRoiDrawTarget(referenceStage) as unknown as EventTarget,
    } as unknown as Event);
    mouseMoveListener?.({
      clientX: 120,
      clientY: 70,
      preventDefault() {},
    } as unknown as Event);
    mouseUpListener?.({} as unknown as Event);

    assert.equal(store.getState().ui.workspace.comparisonRois.activeSide, "reference");
    assert.deepEqual(store.getState().ui.workspace.comparisonRois.reference, {
      x: 0.15,
      y: 0.2,
      width: 0.45,
      height: 0.5,
    });
    assert.deepEqual(store.getState().ui.workspace.activeSelection?.roi, {
      x: 0.15,
      y: 0.2,
      width: 0.45,
      height: 0.5,
    });
  });
  void test("selection roi redraw binder ignores the existing roi so double-click focus wins precedence", () => {
    class FakeExistingSelectionRoiTarget extends FakeDomElement {
      override closest(selector?: string): any {
        if (selector === "[data-lab-selection-roi-ignore='true']") {
          return {} as object;
        }
        if (selector === "[data-lab-selection-roi='true']") {
          return {} as object;
        }
        return null;
      }
    }

    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(store.dispatch);
    const calls: string[] = [];

    bindLabSelectionRoiInteractions({
      documentRef: documentRef,
      emit: eventBus.emit,
      getActiveSelection() {
        return store.getState().ui.workspace.activeSelection;
      },
      getSourceKind() {
        return "video";
      },
    });
    bindLabPreviewInspectionInteractions({
      controller: {
        captureSnapshot() {
          return false;
        },
        clearFocus() {
          return false;
        },
        clearSnapshot() {
          return false;
        },
        stepFrame() {
          return false;
        },
        toggleFocus() {
          calls.push("toggle-focus");
          return true;
        },
      },
      documentRef: documentRef,
    });

    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "video",
        mode: "local",
        storedPath: "/tmp/source.mp4",
      },
    });
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1_000,
      endMs: 3_000,
    });
    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        x: 0.1,
        y: 0.1,
        width: 0.25,
        height: 0.3,
      },
    });

    const initialRoi = store.getState().ui.workspace.activeSelection?.roi;
    const mouseDownListener = documentRef.listeners.get("mousedown");
    const mouseMoveListener = documentRef.listeners.get("mousemove");
    const dblClickListener = documentRef.listeners.get("dblclick");
    assert.ok(mouseDownListener);
    assert.ok(mouseMoveListener);
    assert.ok(dblClickListener);

    mouseDownListener?.({
      button: 0,
      clientX: 24,
      clientY: 24,
      preventDefault() {},
      target: new FakeExistingSelectionRoiTarget() as unknown as EventTarget,
    } as unknown as Event);
    mouseMoveListener?.({
      clientX: 80,
      clientY: 64,
      preventDefault() {},
    } as unknown as Event);
    dblClickListener?.({
      target: new FakeExistingSelectionRoiTarget() as unknown as EventTarget,
      preventDefault() {},
      stopImmediatePropagation() {},
    } as unknown as Event);

    assert.deepEqual(store.getState().ui.workspace.activeSelection?.roi, initialRoi);
    assert.deepEqual(calls, ["toggle-focus"]);
  });
});
