import {
  __testOnlyLabPreviewInspectionController,
  assert,
  bindLabPreviewInspectionInteractions,
  bindLabSelectionRoiInteractions,
  bindLabSelectionSuggestionClicks,
  buildInterpretationItems,
  createDualPreviewSnapshot,
  createLabEventBus,
  createLabPreviewInspectionController,
  createLabRunController,
  createLabStore,
  createTestAudioFocusSettings,
  DEFAULT_AUDIO_FOCUS_SETTINGS,
  FakeClickEvent,
  FakeControllerDocument,
  FakeDomElement,
  FakeInspectionModeTarget,
  FakeInspectionModeTrigger,
  FakeKeyboardEvent,
  FakeOutsideTarget,
  FakePanelOnlyTarget,
  FakeRoiClearTarget,
  FakeRoiDrawTarget,
  FakeRoiStage,
  FakeSelectionSuggestionTarget,
  FakeSelectionSuggestionTrigger,
  FakeWindowEventTarget,
  getActiveExecutionIntent,
  getActiveInspectionSnapshot,
  getActiveSelection,
  getActiveSuggestionPreview,
  getActiveSuggestionPreviewId,
  getInspectionMode,
  getRoiFocusActive,
  getSelectionSuggestions,
  getWaveformTimelineModel,
  renderLabWaveformTimeline,
  renderWorkspaceSurface,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { getReadyAnalysisPreparationGroups } from "../../rooms/laboratory/runtime/lab-selectors.ts";

import type { LabSelection } from "./laboratory-runtime-truth.helpers.ts";

describe("preview inspection controller", () => {
  void test("preview inspection binder routes focus, stepping, capture, and escape without touching form fields", () => {
    class FakeClosestTarget extends FakeDomElement {
      constructor(private readonly selectors: Record<string, object | null>) {
        super();
      }

      override closest(selector?: string): any {
        return this.selectors[selector ?? ""] ?? null;
      }
    }

    const documentRef = new FakeControllerDocument();
    const calls: string[] = [];
    bindLabPreviewInspectionInteractions({
      controller: {
        captureSnapshot() {
          calls.push("capture");
          return true;
        },
        clearFocus() {
          calls.push("clear-focus");
          return true;
        },
        clearSnapshot() {
          calls.push("clear-snapshot");
          return true;
        },
        stepFrame(direction) {
          calls.push(direction < 0 ? "step-backward" : "step-forward");
          return true;
        },
        toggleFocus() {
          calls.push("toggle-focus");
          return true;
        },
      },
      documentRef: documentRef,
    });

    const clickListener = documentRef.listeners.get("click");
    const dblClickListener = documentRef.listeners.get("dblclick");
    const keydownListener = documentRef.listeners.get("keydown");
    assert.ok(clickListener);
    assert.ok(dblClickListener);
    assert.ok(keydownListener);

    clickListener?.({
      target: new FakeClosestTarget({
        "[data-lab-selection-roi-focus-toggle]": {},
      }) as unknown as EventTarget,
      preventDefault() {},
      stopImmediatePropagation() {},
    } as unknown as Event);
    clickListener?.({
      target: new FakeClosestTarget({
        "[data-lab-selection-roi-capture]": {},
      }) as unknown as EventTarget,
      preventDefault() {},
      stopImmediatePropagation() {},
    } as unknown as Event);
    clickListener?.({
      target: new FakeClosestTarget({
        "[data-lab-preview-inspection-stage='true']": {},
      }) as unknown as EventTarget,
      preventDefault() {},
      stopImmediatePropagation() {},
    } as unknown as Event);
    dblClickListener?.({
      target: new FakeClosestTarget({
        "[data-lab-selection-roi='true']": {},
      }) as unknown as EventTarget,
      preventDefault() {},
      stopImmediatePropagation() {},
    } as unknown as Event);
    keydownListener?.({
      key: "ArrowRight",
      target: new FakeOutsideTarget() as unknown as EventTarget,
      preventDefault() {},
      stopImmediatePropagation() {},
    } as unknown as Event);
    keydownListener?.({
      key: "Escape",
      target: new FakeOutsideTarget() as unknown as EventTarget,
      preventDefault() {},
      stopImmediatePropagation() {},
    } as unknown as Event);
    keydownListener?.({
      key: "ArrowLeft",
      target: new FakeClosestTarget({
        "input, textarea, select, [contenteditable='true']": {},
      }) as unknown as EventTarget,
      preventDefault() {
        throw new Error("editable targets should be ignored");
      },
      stopImmediatePropagation() {
        throw new Error("editable targets should be ignored");
      },
    } as unknown as Event);

    assert.deepEqual(calls, [
      "toggle-focus",
      "capture",
      "toggle-focus",
      "step-forward",
      "clear-focus",
    ]);
  });
  void test("preview inspection controller focuses roi, captures a snapshot, and clears stale state on topology loss", async () => {
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(store.dispatch);

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
        x: 0.2,
        y: 0.15,
        width: 0.3,
        height: 0.35,
      },
    });

    const capturedDrawCalls: unknown[][] = [];
    const fakeCanvas = {
      height: 0,
      width: 0,
      getContext() {
        return {
          drawImage(...args: unknown[]) {
            capturedDrawCalls.push(args);
          },
        };
      },
      toDataURL() {
        return "data:image/png;base64,roi";
      },
    };

    const contentStyle = {
      transform: "",
      transformOrigin: "",
    };
    const content = {
      getAttribute() {
        return null;
      },
      getBoundingClientRect() {
        return {
          height: 200,
          left: 0,
          top: 0,
          width: 400,
        };
      },
      querySelector() {
        return null;
      },
      setAttribute() {},
      style: contentStyle,
    };
    const video = {
      currentSrc: "file:///tmp/source.mp4",
      currentTime: 1,
      duration: 8,
      getAttribute(name: string) {
        return name === "src" ? this.currentSrc : null;
      },
      pauseCalls: 0,
      pause() {
        this.pauseCalls += 1;
        this.paused = true;
      },
      paused: false,
      videoHeight: 400,
      videoWidth: 800,
    };

    let stageAvailable = true;
    const stageAttributes = new Map<string, string>([
      ["data-lab-preview-inspection-topology", "single-video"],
    ]);
    const stage = {
      getAttribute(name: string) {
        return stageAttributes.get(name) ?? null;
      },
      getBoundingClientRect() {
        return {
          height: 200,
          left: 0,
          top: 0,
          width: 400,
        };
      },
      querySelector(selector: string) {
        if (selector === "[data-lab-preview-inspection-content='true']") {
          return content as unknown as Element;
        }
        if (selector === "video[data-lab-preserve-media], img[data-lab-preserve-media]") {
          return video as unknown as Element;
        }
        return null;
      },
      setAttribute(name: string, value: string) {
        stageAttributes.set(name, value);
      },
      style: undefined,
    };

    const controller = createLabPreviewInspectionController({
      documentRef: {
        createElement() {
          return fakeCanvas as unknown as HTMLElement;
        },
        querySelector(selector: string) {
          if (selector === "[data-lab-preview-inspection-stage='true']" && stageAvailable) {
            return stage as unknown as Element;
          }
          return null;
        },
      } as unknown as Document,
      emit: eventBus.emit,
      getActiveSelection() {
        return getActiveSelection(store.getState());
      },
      getActiveSnapshot() {
        return getActiveInspectionSnapshot(store.getState());
      },
      getRoiFocusActive() {
        return getRoiFocusActive(store.getState());
      },
      windowRef: {
        URL,
      } as unknown as Window,
    });

    assert.equal(controller.setFocusActive(true), true);
    controller.sync();
    assert.equal(getRoiFocusActive(store.getState()), true);
    assert.match(contentStyle.transform, /scale/);
    assert.equal(
      __testOnlyLabPreviewInspectionController.computeFocusTransform(
        {
          width: 400,
          height: 200,
        },
        store.getState().ui.workspace.activeSelection!["roi"]!
      )?.scale,
      2.857142857142857
    );

    assert.equal(controller.stepFrame(1), true);
    assert.equal(video.pauseCalls, 1);
    assert.ok(video.currentTime > 1);

    assert.equal(await controller.captureSnapshot(), true);
    assert.equal(getActiveInspectionSnapshot(store.getState())?.width, 240);
    assert.equal(getActiveInspectionSnapshot(store.getState())?.height, 140);
    assert.deepEqual(capturedDrawCalls[0]?.slice(1, 5), [160, 60, 240, 140]);

    stageAvailable = false;
    controller.sync();

    assert.equal(getRoiFocusActive(store.getState()), false);
    assert.equal(getActiveInspectionSnapshot(store.getState()), null);
  });
  void test("preview inspection controller ignores snapshot capture when roi is below the minimum size guard", async () => {
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(store.dispatch);

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
        width: 0.05,
        height: 0.05,
      },
    });

    let createElementCalls = 0;
    const stage = {
      getAttribute(name: string) {
        return name === "data-lab-preview-inspection-topology" ? "single-video" : null;
      },
      getBoundingClientRect() {
        return {
          height: 100,
          left: 0,
          top: 0,
          width: 100,
        };
      },
      querySelector(selector: string) {
        if (selector === "[data-lab-preview-inspection-content='true']") {
          return {
            getAttribute() {
              return null;
            },
            getBoundingClientRect() {
              return {
                height: 100,
                left: 0,
                top: 0,
                width: 100,
              };
            },
            querySelector() {
              return null;
            },
            setAttribute() {},
            style: {
              transform: "",
              transformOrigin: "",
            },
          } as unknown as Element;
        }
        if (selector === "video[data-lab-preserve-media], img[data-lab-preserve-media]") {
          return {
            currentSrc: "file:///tmp/source.mp4",
            currentTime: 1,
            duration: 8,
            getAttribute(sourceName: string) {
              return sourceName === "src" ? (this as any).currentSrc : null;
            },
            pause() {},
            paused: true,
            videoHeight: 400,
            videoWidth: 800,
          } as unknown as Element;
        }
        return null;
      },
      setAttribute() {},
      style: undefined,
    };

    const controller = createLabPreviewInspectionController({
      documentRef: {
        createElement() {
          createElementCalls += 1;
          throw new Error("snapshot capture should stop before canvas allocation");
        },
        querySelector(selector: string) {
          if (selector === "[data-lab-preview-inspection-stage='true']") {
            return stage as unknown as Element;
          }
          return null;
        },
      },
      emit: eventBus.emit,
      getActiveSelection() {
        return getActiveSelection(store.getState());
      },
      getActiveSnapshot() {
        return getActiveInspectionSnapshot(store.getState());
      },
      getRoiFocusActive() {
        return getRoiFocusActive(store.getState());
      },
      windowRef: {
        URL: {
          createObjectURL() {
            return "blob:ignored";
          },
          revokeObjectURL() {},
        },
      } as unknown as Window,
    });

    assert.equal(await controller.captureSnapshot(), false);
    assert.equal(createElementCalls, 0);
    assert.equal(getActiveInspectionSnapshot(store.getState()), null);
  });
  void test("selection suggestion preview dismissal stays stable with stacked document listeners", () => {
    const originalElement = globalThis.Element;
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: new FakeWindowEventTarget() as unknown as Window,
    });

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: FakeDomElement,
    });
    try {
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
      controller.attach();

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

      const clickListener = documentRef.listeners.get("click");
      const keydownListener = documentRef.listeners.get("keydown");
      assert.ok(clickListener);
      assert.ok(keydownListener);

      clickListener?.(
        new FakeClickEvent(
          new FakeSelectionSuggestionTarget(
            new FakeSelectionSuggestionTrigger("audio-inspect")
          ) as unknown as EventTarget
        ) as unknown as Event
      );
      assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");

      clickListener?.(
        new FakeClickEvent(new FakePanelOnlyTarget() as unknown as EventTarget) as unknown as Event
      );
      assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");

      clickListener?.(
        new FakeClickEvent(new FakeOutsideTarget() as unknown as EventTarget) as unknown as Event
      );
      assert.equal(store.getState().ui.activeSuggestionPreviewId, null);

      clickListener?.(
        new FakeClickEvent(
          new FakeSelectionSuggestionTarget(
            new FakeSelectionSuggestionTrigger("audio-inspect")
          ) as unknown as EventTarget
        ) as unknown as Event
      );
      assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");

      const escapeEvent = new FakeKeyboardEvent("Escape");
      keydownListener?.(escapeEvent as unknown as Event);
      assert.equal(escapeEvent.defaultPrevented, true);
      assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
    } finally {
      if (originalElement === undefined) {
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
