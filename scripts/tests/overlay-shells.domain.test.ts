import { assert, createLabEventBus, createLabRunController, createLabStore, FakeActionElement, FakeControllerDocument, test } from "./laboratory-runtime-truth.helpers.ts";

describe("overlay shells", () => {
  void test("laboratory report overlay action opens the report overlay", () => {
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
          roomAPI: {
            sendEvent() {},
          },
          addEventListener() {},
        } as unknown as Window,
      });
      controller.attach();

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);

      clickListener({
        target: new TestElement("open-report-overlay", "ai"),
      } as unknown as Event);

      assert.equal(store.getState().ui.workspace.reportOverlayOpen, true);
      assert.equal(store.getState().ui.reportView, "ai");
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

  void test("laboratory document overlay action opens the shared overlay shell", () => {
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
          roomAPI: {
            sendEvent() {},
          },
          addEventListener() {},
        } as unknown as Window,
      });
      controller.attach();

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);

      clickListener({
        target: new TestElement("open-document-overlay", "artifact-json-1"),
      } as unknown as Event);

      assert.equal(store.getState().ui.workspace.reportOverlayOpen, true);
      assert.equal(store.getState().ui.activeDocumentOverlayAssetId, "artifact-json-1");
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
