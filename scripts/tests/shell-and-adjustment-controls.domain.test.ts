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

describe("shell and adjustment controls", () => {
  void test("laboratory run controller wires v2 shell action buttons into workspace state", () => {
    const originalElement = globalThis.Element;
    const originalInput = globalThis.HTMLInputElement;
    const originalSelect = globalThis.HTMLSelectElement;
    const originalTextarea = globalThis.HTMLTextAreaElement;
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();

    class TestElement extends FakeActionElement {}
    class TestInputElement {}
    class TestSelectElement {}
    class TestTextareaElement {}

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: TestElement,
    });
    Object.defineProperty(globalThis, "HTMLInputElement", {
      configurable: true,
      value: TestInputElement,
    });
    Object.defineProperty(globalThis, "HTMLSelectElement", {
      configurable: true,
      value: TestSelectElement,
    });
    Object.defineProperty(globalThis, "HTMLTextAreaElement", {
      configurable: true,
      value: TestTextareaElement,
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

      const clickListener = documentRef.listeners.get("click");
      const keyListener = documentRef.listeners.get("keydown");
      assert.ok(clickListener);
      assert.ok(keyListener);

      clickListener({ target: new TestElement("drawer-collapsed-toggled") } as unknown as Event);
      assert.equal(store.getState().ui.workspace.drawerCollapsed, true);

      let prevented = false;
      keyListener({
        ctrlKey: true,
        key: "b",
        target: new TestElement("not-a-text-control"),
        preventDefault() {
          prevented = true;
        },
      } as unknown as Event);
      assert.equal(prevented, true);
      assert.equal(store.getState().ui.workspace.drawerCollapsed, false);

      clickListener({
        target: new TestElement("analysis-prep-group-toggle", "visual-structure"),
      } as unknown as Event);
      assert.deepEqual(store.getState().selectedCapabilities, ["visual-structure"]);
      assert.equal(
        (store.getState().workbench["moduleToggles"] as Record<string, unknown>)[
          "frame-consistency"
        ],
        true
      );

      clickListener({
        target: new TestElement("module-toggle", "audio-signal::signal-health"),
      } as unknown as Event);
      assert.equal(
        (store.getState().workbench["moduleToggles"] as Record<string, unknown>)["signal-health"],
        true
      );
      assert.ok(store.getState().selectedCapabilities.includes("audio-signal"));

      clickListener({
        target: new TestElement("workspace-process-view-toggled"),
      } as unknown as Event);
      assert.equal(store.getState().ui.workspace.processViewActive, true);
    } finally {
      if (typeof originalElement === "undefined") {
        delete (globalThis as Record<string, unknown>)["Element"];
      } else {
        Object.defineProperty(globalThis, "Element", {
          configurable: true,
          value: originalElement,
        });
      }
      if (typeof originalInput === "undefined") {
        delete (globalThis as Record<string, unknown>)["HTMLInputElement"];
      } else {
        Object.defineProperty(globalThis, "HTMLInputElement", {
          configurable: true,
          value: originalInput,
        });
      }
      if (typeof originalSelect === "undefined") {
        delete (globalThis as Record<string, unknown>)["HTMLSelectElement"];
      } else {
        Object.defineProperty(globalThis, "HTMLSelectElement", {
          configurable: true,
          value: originalSelect,
        });
      }
      if (typeof originalTextarea === "undefined") {
        delete (globalThis as Record<string, unknown>)["HTMLTextAreaElement"];
      } else {
        Object.defineProperty(globalThis, "HTMLTextAreaElement", {
          configurable: true,
          value: originalTextarea,
        });
      }
    }
  });

  void test("laboratory run controller applies fine adjustment controls for audio and visual panels", () => {
    const originalElement = globalThis.Element;
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();

    class TestElement extends FakeActionElement {
      constructor(dataset: Record<string, string>) {
        super(dataset["labAction"] ?? "workspace-setting-adjust");
        this.dataset = dataset;
      }
    }

    function settingButton(field: string, attrs: Record<string, string>) {
      return new TestElement({
        labAction: "workspace-setting-adjust",
        labField: field,
        ...attrs,
      });
    }

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

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);

      clickListener({
        target: settingButton("workspace.interactive.brightness", {
          labDelta: "1",
          labMin: "0",
          labMax: "200",
          labStep: "1",
          labResetValue: "100",
        }),
      } as unknown as Event);
      assert.equal(store.getState().ui.workspace.interactiveSettings.brightness, 101);

      store.dispatch({
        type: "workspace-comparison-reference-set",
        assetId: "asset-reference",
      });
      clickListener({
        target: settingButton("workspace.interactive.brightness", {
          labDelta: "1",
          labMin: "0",
          labMax: "200",
          labStep: "1",
          labResetValue: "100",
        }),
      } as unknown as Event);
      assert.equal(store.getState().ui.workspace.interactiveSettings.brightness, 101);
      assert.equal(
        store.getState().ui.workspace.comparisonInteractiveSettings.primary.brightness,
        101
      );
      assert.equal(
        store.getState().ui.workspace.comparisonInteractiveSettings.reference.brightness,
        102
      );

      store.dispatch({ type: "workspace-comparison-side-activated", side: "primary" });
      clickListener({
        target: settingButton("workspace.interactive.brightness", {
          labMin: "0",
          labMax: "200",
          labReset: "true",
          labStep: "1",
          labResetValue: "100",
        }),
      } as unknown as Event);
      assert.equal(
        store.getState().ui.workspace.comparisonInteractiveSettings.primary.brightness,
        100
      );
      assert.equal(
        store.getState().ui.workspace.comparisonInteractiveSettings.reference.brightness,
        102
      );

      clickListener({
        target: settingButton("workspace.audioFocus.gain", {
          labDelta: "-0.1",
          labMin: "0",
          labMax: "3",
          labStep: "0.1",
          labResetValue: "1",
        }),
      } as unknown as Event);
      assert.equal(store.getState().ui.workspace.audioFocus.gain, 0.9);

      clickListener({
        target: settingButton("workspace.audioFocus.filterType", {
          labDelta: "1",
          labOptions: "none|lowpass|highpass|bandpass",
          labResetValue: "none",
        }),
      } as unknown as Event);
      assert.equal(store.getState().ui.workspace.audioFocus.filterType, "lowpass");

      clickListener({
        target: settingButton("workspace.audioFocus.filterType", {
          labReset: "true",
          labOptions: "none|lowpass|highpass|bandpass",
          labResetValue: "none",
        }),
      } as unknown as Event);
      assert.equal(store.getState().ui.workspace.audioFocus.filterType, "none");

      store.dispatch({
        type: "workspace-audio-updated",
        patch: {
          eqBands: store.getState().ui.workspace.audioFocus.eqBands.map(function (band, index) {
            return index === 1 ? { ...band, gain: 4 } : band;
          }),
        },
      });
      clickListener({
        target: settingButton("workspace.audioFocus.eqBands.1.gain", {
          labReset: "true",
          labMin: "-12",
          labMax: "12",
          labStep: "0.5",
          labResetValue: "0",
        }),
      } as unknown as Event);
      assert.equal(store.getState().ui.workspace.audioFocus.eqBands[1]?.gain, 0);

      clickListener({
        target: new TestElement({ labAction: "workspace-reset-audio-focus" }),
      } as unknown as Event);
      assert.equal(store.getState().ui.workspace.audioFocus.gain, 1);
      assert.equal(store.getState().ui.workspace.audioFocus.playbackRate, 1);
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
