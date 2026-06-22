import { assert, createLabEventBus, createLabRunController, createLabStore, FakeActionElement, FakeControllerDocument, test } from "./laboratory-runtime-truth.helpers.ts";
import { closeLabAssetMenusForClick } from "../../rooms/laboratory/runtime/controller/lab-asset-context-menu-controller.ts";

describe("UI controls and menus", () => {
  void test("laboratory run controller toggles selection micro zoom from the timeline action", () => {
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
        type: "workspace-timeline-updated",
        startMs: 1200,
        endMs: 3600,
      });

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);

      clickListener({ target: new TestElement("timeline-toggle-micro-zoom") } as unknown as Event);
      assert.equal(store.getState().ui.workspace.selectionMicroZoomOpen, true);

      clickListener({ target: new TestElement("timeline-toggle-micro-zoom") } as unknown as Event);
      assert.equal(store.getState().ui.workspace.selectionMicroZoomOpen, false);

      store.dispatch({ type: "workspace-timeline-updated", startMs: null, endMs: null });
      clickListener({ target: new TestElement("timeline-toggle-micro-zoom") } as unknown as Event);
      assert.equal(store.getState().ui.workspace.selectionMicroZoomOpen, false);
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

  void test("laboratory asset menus close on menu actions and outside clicks", () => {
    const originalElement = (globalThis as Record<string, unknown>)["Element"];

    class TestElement {
      constructor(
        private readonly menu: HTMLDetailsElement | null,
        private readonly action = false
      ) {}

      closest(selector: string) {
        if (selector === "details.labx-sp-asset__menu") {
          return this.menu;
        }
        if (selector === "[data-lab-action]" && this.action) {
          return this;
        }
        return null;
      }
    }

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: TestElement,
    });

    try {
      const sourceMenu = { open: true } as HTMLDetailsElement;
      const projectMenu = { open: true } as HTMLDetailsElement;
      const documentRef = {
        querySelectorAll(selector: string) {
          assert.equal(selector, "details.labx-sp-asset__menu");
          return [sourceMenu, projectMenu];
        },
      } as unknown as Document;

      closeLabAssetMenusForClick(
        { target: new TestElement(sourceMenu, true) } as unknown as Event,
        documentRef
      );
      assert.equal(sourceMenu.open, false);
      assert.equal(projectMenu.open, false);

      sourceMenu.open = true;
      projectMenu.open = true;
      closeLabAssetMenusForClick(
        { target: new TestElement(sourceMenu, false) } as unknown as Event,
        documentRef
      );
      assert.equal(sourceMenu.open, true);
      assert.equal(projectMenu.open, false);

      sourceMenu.open = true;
      projectMenu.open = true;
      closeLabAssetMenusForClick(
        { target: new TestElement(null, false) } as unknown as Event,
        documentRef
      );
      assert.equal(sourceMenu.open, false);
      assert.equal(projectMenu.open, false);
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

  void test("laboratory run controller focuses the source preview through explicit source-preview actions", () => {
    const originalElement = globalThis.Element;
    const previewCalls: string[] = [];
    const previewElement = {
      scrollIntoView() {
        previewCalls.push("scroll");
      },
      focus() {
        previewCalls.push("focus");
      },
    };
    const documentRef = {
      listeners: new Map<string, (event: Event) => void>(),
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        this.listeners.set(
          type,
          typeof listener === "function"
            ? listener
            : (event: Event) => {
                listener.handleEvent(event);
              }
        );
      },
      querySelector(selector: string) {
        return selector === "#lab-workspace-preview" ? previewElement : null;
      },
    };
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
        target: new TestElement("focus-source-preview", "source-active"),
      } as unknown as Event);

      assert.deepEqual(previewCalls, ["scroll", "focus"]);
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
