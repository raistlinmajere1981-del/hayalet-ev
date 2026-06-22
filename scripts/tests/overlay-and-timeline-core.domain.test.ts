import { assert, createLabEventBus, createLabRunController, createLabStore, FakeActionElement, FakeControllerDocument, FakeDualPreviewDocument, FakeMediaElement, FakeMouseEvent, FakePlayheadElement, FakeTextElement, FakeTimelineActionElement, FakeTimelineRoot, FakeTimelineTrack, FakeWindowEventTarget, test } from "./laboratory-runtime-truth.helpers.ts";

describe("overlay and timeline core", () => {
  void test("laboratory run controller opens an in-room scope overlay for selected ranges", () => {
    const originalElement = globalThis.Element;
    const sentActions: string[] = [];
    const prompts: string[] = [];
    class FakeScopeOverlayElement {
      className = "";
      dataset: Record<string, string> = {};
      innerHTML = "";
      removed = false;
      attributes: Record<string, string> = {};
      focused = false;

      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      }

      querySelector(selector: string) {
        return selector.includes("analysis-scope-choice")
          ? { focus: () => (this.focused = true) }
          : null;
      }

      remove() {
        this.removed = true;
      }
    }

    const documentRef = new FakeControllerDocument() as FakeControllerDocument & {
      body: {
        appended: FakeScopeOverlayElement[];
        appendChild: (child: FakeScopeOverlayElement) => void;
      };
      createElement: (tagName: string) => FakeScopeOverlayElement;
    };
    const eventBus = createLabEventBus();
    const store = createLabStore();

    class TestElement extends FakeActionElement {}

    documentRef.body = {
      appended: [],
      appendChild(child: FakeScopeOverlayElement) {
        this.appended.push(child);
      },
    };
    documentRef.createElement = function () {
      return new FakeScopeOverlayElement();
    };

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
            sendEvent(eventName: string, payload: Record<string, unknown>) {
              if (eventName === "media-action" && typeof payload["action"] === "string") {
                sentActions.push(payload["action"]);
              }
            },
          },
          addEventListener() {},
          prompt(message: string) {
            prompts.push(message);
            return "1";
          },
        } as unknown as Window,
      });
      controller.attach();

      store.dispatch({
        type: "hydrate",
        payload: {
          featureId: "media-analysis",
          source: {
            kind: "video",
            mode: "local",
            previewUrl: "preview://video",
            storedPath: "/tmp/lab-demo.mp4",
          },
          sourceProbeStatus: "completed",
          toolState: {
            tools: {
              ffmpeg: { installed: true },
            },
          },
          workspace: {
            preflightAutoRunEnabled: false,
            timelineStartMs: 1200,
            timelineEndMs: 2600,
          },
          selectedCapabilities: ["visual-forensics"],
          reports: {
            user: null,
            ai: null,
            emptyReason: null,
          },
          activityFeed: [],
          lastRun: null,
        },
      });

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);
      clickListener({ target: new TestElement("run-deep-analysis") } as unknown as Event);

      const overlay = documentRef.body.appended[0];
      assert.ok(overlay);
      assert.equal(prompts.length, 0);
      assert.equal(sentActions.includes("process-run"), false);
      assert.equal(overlay.attributes["data-open"], "true");
      assert.match(overlay.innerHTML, /data-lab-action="analysis-scope-choice"/);

      clickListener({
        target: new TestElement("analysis-scope-choice", "selected"),
      } as unknown as Event);

      const analysisScope = store.getState().run?.analysisScope;
      assert.equal(overlay.removed, true);
      assert.ok(sentActions.includes("process-run"));
      assert.deepEqual(analysisScope?.timeRange, {
        startMs: 1200,
        endMs: 2600,
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

  void test("laboratory run controller syncs the unified timeline playhead to the active preview media", async () => {
    const preview = new FakeMediaElement();
    preview.duration = 5;
    preview.currentTime = 1.25;
    const playhead = new FakePlayheadElement();
    const playheadLabel = new FakeTextElement(null);
    const timelineRoot = { dataset: { duration: "5000" } };
    const documentRef = new FakeDualPreviewDocument(
      new Map<string, unknown>([
        ['video[data-lab-preserve-media="workspace-preview"]', preview],
        ['[data-lab-role="timeline-playhead"]', playhead],
        ['[data-lab-role="timeline-playhead-label"]', playheadLabel],
        [".labx-timeline", timelineRoot],
      ]),
      [preview]
    );
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
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });

    controller.attach();
    await Promise.resolve();

    assert.equal(playhead.style["left"], "25%");
    assert.equal(playhead.attributes.get("data-active"), "true");
    assert.equal(playheadLabel.textContent, "00:01.250");

    preview.currentTime = 2.5;
    preview.dispatch("timeupdate");

    assert.equal(playhead.style["left"], "50%");
    assert.equal(playheadLabel.textContent, "00:02.500");
  });

  void test("laboratory run controller updates focus layer from user workspace interactions", async () => {
    const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
    const preview = new FakeMediaElement();
    const documentRef = new FakeDualPreviewDocument(
      new Map<string, unknown>([['video[data-lab-preserve-media="workspace-preview"]', preview]]),
      [preview]
    );
    const eventBus = createLabEventBus();
    const store = createLabStore();

    class FakeFocusTarget {
      dataset: Record<string, string>;

      constructor(
        options: {
          action?: string;
          surface?: "inspector" | "preview" | "timeline";
          value?: string;
        } = {}
      ) {
        this.dataset = {
          ...(options.action === undefined ? {} : { labAction: options.action }),
          ...(options.value === undefined ? {} : { labValue: options.value }),
        };
        this.surface = options.surface ?? null;
      }

      private readonly surface: "inspector" | "preview" | "timeline" | null;

      closest(selector: string): FakeFocusTarget | null {
        if (selector === "[data-lab-action]" && this.dataset["labAction"] !== undefined) {
          return this;
        }
        if (selector === ".labx-workspace-preview" && this.surface === "preview") {
          return this;
        }
        if (selector === ".labx-timeline" && this.surface === "timeline") {
          return this;
        }
        if (selector === "[data-lab-workspace-inspector='true']" && this.surface === "inspector") {
          return this;
        }
        return null;
      }
    }

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: FakeFocusTarget,
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
      await Promise.resolve();

      const clickListener = documentRef.listeners.get("click");
      const pointerDownListener = documentRef.listeners.get("pointerdown");
      assert.ok(clickListener);
      assert.ok(pointerDownListener);

      clickListener({
        target: new FakeFocusTarget({ action: "timeline-shift-playhead", surface: "timeline" }),
      } as unknown as Event);
      assert.equal(store.getState().ui.labFocusLayer, "timeline");

      pointerDownListener({
        target: new FakeFocusTarget({ surface: "preview" }),
      } as unknown as Event);
      assert.equal(store.getState().ui.labFocusLayer, "preview");

      clickListener({
        target: new FakeFocusTarget({
          action: "workspace-controls-drawer-toggle",
          surface: "inspector",
        }),
      } as unknown as Event);
      assert.equal(store.getState().ui.labFocusLayer, "inspector");

      await preview.play();
      preview.dispatch("timeupdate");
      assert.equal(store.getState().ui.labFocusLayer, "inspector");
    } finally {
      if (originalElement) {
        Object.defineProperty(globalThis, "Element", originalElement);
      } else {
        Reflect.deleteProperty(globalThis, "Element");
      }
    }
  });

  void test("laboratory run controller shifts normal playback from timeline step controls", async () => {
    const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
    const preview = new FakeMediaElement();
    preview.duration = 12;
    preview.currentTime = 4.321;
    preview.paused = false;
    const playhead = new FakePlayheadElement();
    const playheadLabel = new FakeTextElement(null);
    const currentTimeLabel = new FakeTextElement(null);
    const totalDurationLabel = new FakeTextElement(null);
    const playToggleLabel = new FakeTextElement(null);
    const timelineRoot = { dataset: { duration: "12000" } };
    const documentRef = new FakeDualPreviewDocument(
      new Map<string, unknown>([
        ['video[data-lab-preserve-media="workspace-preview"]', preview],
        ['[data-lab-role="timeline-playhead"]', playhead],
        ['[data-lab-role="timeline-playhead-label"]', playheadLabel],
        ['[data-lab-role="timeline-current-time-label"]', currentTimeLabel],
        ['[data-lab-role="timeline-total-duration-label"]', totalDurationLabel],
        ['[data-lab-role="timeline-play-toggle-label"]', playToggleLabel],
        [".labx-timeline", timelineRoot],
      ]),
      [preview]
    );
    const eventBus = createLabEventBus();
    const store = createLabStore();

    Object.defineProperty(globalThis, "Element", {
      configurable: true,
      value: FakeActionElement,
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
      await Promise.resolve();

      assert.equal(currentTimeLabel.textContent, "00:04.321");
      assert.equal(totalDurationLabel.textContent, "00:12.000");
      assert.equal(playToggleLabel.textContent, "❚❚");

      const clickListener = documentRef.listeners.get("click");
      assert.ok(clickListener);
      clickListener({
        target: new FakeActionElement("timeline-shift-playhead", "+1000"),
      } as unknown as Event);

      assert.equal(preview.currentTime, 5.321);
      assert.equal(preview.pauseCalls, 0);
      assert.equal(currentTimeLabel.textContent, "00:05.321");

      clickListener({
        target: new FakeActionElement("timeline-shift-playhead", "-frame"),
      } as unknown as Event);

      assert.equal(preview.currentTime, 5.288);
      assert.equal(preview.pauseCalls, 1);
      assert.equal(preview.paused, true);
      assert.equal(currentTimeLabel.textContent, "00:05.288");
      assert.equal(playToggleLabel.textContent, "▶");
    } finally {
      if (originalElement === undefined) {
        delete (globalThis as Record<string, unknown>)["Element"];
      } else {
        Object.defineProperty(globalThis, "Element", originalElement);
      }
    }
  });

  void test("laboratory run controller keeps click-to-seek and drag-to-select separated by the rail threshold", () => {
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
      mouseMoveListener(
        new FakeMouseEvent(railTarget as unknown as EventTarget, 352) as unknown as Event
      );
      mouseUpListener({} as unknown as Event);

      assert.equal(preview.currentTime, 2.5);
      assert.equal(store.getState().ui.workspace.timelineStartMs, null);
      assert.equal(store.getState().ui.workspace.timelineEndMs, null);

      mouseDownListener(
        new FakeMouseEvent(railTarget as unknown as EventTarget, 350) as unknown as Event
      );
      mouseMoveListener(
        new FakeMouseEvent(railTarget as unknown as EventTarget, 550) as unknown as Event
      );
      assert.equal(preview.currentTime, 2.5);
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
});
