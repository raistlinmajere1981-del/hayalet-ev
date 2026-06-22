import { assert, createLabStore, getSelectionSuggestions, getWaveformTimelineModel, renderLabWaveformTimeline, test } from "./laboratory-runtime-truth.helpers.ts";


describe("selection suggestions and waveform store", () => {
  void test("selection suggestions and waveform model deepen when semantic roi inspection is active", () => {
    const store = createLabStore();
    store.dispatch({
      type: "snapshot-received",
      payload: {
        ready: true,
        featureId: "media-analysis",
        activeProjectId: "project-micro-zoom",
        projects: [{ id: "project-micro-zoom", name: "lab-demo.mp4", hasSource: true }],
        activeProject: {
          id: "project-micro-zoom",
          name: "lab-demo.mp4",
          createdAt: "2026-04-23T19:00:00.000Z",
          source: {
            status: "ready",
            kind: "video",
            mode: "local",
            previewUrl: "file:///tmp/lab-demo.mp4",
            storedFileName: "lab-demo.mp4",
            storedPath: "/tmp/lab-demo.mp4",
            routeLabel: "Local Copy",
            metadata: {
              durationSeconds: 20,
              sizeBytes: 2048,
            },
            drafts: {},
          },
          edit: {},
          profile: {
            preflight: {},
          },
          process: {
            records: {},
          },
          report: {
            records: {},
          },
          assets: [
            {
              id: "source-active",
              type: "source",
              name: "lab-demo.mp4",
              localPath: "/tmp/lab-demo.mp4",
              createdAt: 100,
              sourceId: "source-active",
            },
          ],
        },
        workbench: {},
        sourceProbeStatus: "completed",
        profileModels: [],
        reports: {
          user: null,
          ai: null,
          emptyReason: "Rapor henüz üretilmedi.",
        },
        activityFeed: [],
      },
    });
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 8_000,
      endMs: 16_000,
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "visual",
    });
    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        x: 0.14,
        y: 0.18,
        width: 0.22,
        height: 0.24,
      },
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "motion",
    });

    const suggestions = getSelectionSuggestions(store.getState());
    const toolHintLabels = suggestions
      .map(function (suggestion) {
        return suggestion.toolHint ?? null;
      })
      .filter((entry): entry is string => entry !== null);
    const model = getWaveformTimelineModel(store.getState());
    const markup = renderLabWaveformTimeline(model);

    assert.deepEqual(toolHintLabels, [
      "Inspect motion",
      "Enhance clarity",
      "Focus region",
      "Stabilize segment",
    ]);
    assert.equal(model.waveformInspectionLens?.enabled, true);
    assert.ok(
      (model.waveformInspectionLens?.cropEndRatio ?? 0) >
        (model.waveformInspectionLens?.cropStartRatio ?? 0)
    );
    assert.match(markup, /Inspection tools/);
    assert.match(markup, /Focus region/);
    assert.equal(model.selectionMicroZoomOpen, false);
    assert.match(markup, /data-lab-action="timeline-toggle-micro-zoom"/);
    assert.match(markup, /aria-pressed="false"/);
    assert.doesNotMatch(markup, /lab-audio-viz-inspection/);

    store.dispatch({
      type: "workspace-selection-micro-zoom-toggled",
    });

    const openModel = getWaveformTimelineModel(store.getState());
    const openMarkup = renderLabWaveformTimeline(openModel);
    assert.equal(openModel.selectionMicroZoomOpen, true);
    assert.match(openMarkup, /aria-pressed="true"/);
    assert.match(openMarkup, /lab-audio-viz-inspection/);
  });
  void test("lab root preserves protected details state while syncing source drawer details", async () => {
    class FakeElement {
      attributes = new Map<string, string>();
      childNodes: unknown[] = [];

      constructor(attributes: Record<string, string> = {}) {
        Object.entries(attributes).forEach(([key, value]) => {
          this.attributes.set(key, value);
        });
      }

      getAttributeNames() {
        return Array.from(this.attributes.keys());
      }

      hasAttribute(name: string) {
        return this.attributes.has(name);
      }

      getAttribute(name: string) {
        return this.attributes.get(name) ?? null;
      }

      setAttribute(name: string, value: string) {
        this.attributes.set(name, value);
      }

      removeAttribute(name: string) {
        this.attributes.delete(name);
      }
    }

    class FakeDetailsElement extends FakeElement {
      open = false;

      constructor(attributes: Record<string, string> = {}) {
        super(attributes);
        this.open = Object.prototype.hasOwnProperty.call(attributes, "open");
      }

      override setAttribute(name: string, value: string) {
        super.setAttribute(name, value);
        if (name === "open") {
          this.open = true;
        }
      }

      override removeAttribute(name: string) {
        super.removeAttribute(name);
        if (name === "open") {
          this.open = false;
        }
      }
    }

    const descriptors = {
      document: Object.getOwnPropertyDescriptor(globalThis, "document"),
      window: Object.getOwnPropertyDescriptor(globalThis, "window"),
      HTMLElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLElement"),
      HTMLDetailsElement: Object.getOwnPropertyDescriptor(globalThis, "HTMLDetailsElement"),
    };

    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: FakeElement,
    });
    Object.defineProperty(globalThis, "HTMLDetailsElement", {
      configurable: true,
      value: FakeDetailsElement,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        getElementById() {
          return null;
        },
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });

    try {
      const labRootModule = (await import("../../rooms/laboratory/ui/lab-root.ts")) as {
        __testOnlyLabRootDomSync: {
          syncElement: (currentElement: Element, nextElement: Element) => void;
        };
      };

      const embeddedCurrent = new FakeDetailsElement({
        class: "lab-interpretation-panel lab-interpretation-panel--embedded",
        "data-lab-interpretation-panel": "true",
      });
      const embeddedNext = new FakeDetailsElement({
        class: "lab-interpretation-panel lab-interpretation-panel--embedded",
        "data-lab-interpretation-panel": "true",
        open: "",
      });
      embeddedCurrent.open = false;
      embeddedNext.open = true;

      labRootModule.__testOnlyLabRootDomSync.syncElement(
        embeddedCurrent as unknown as Element,
        embeddedNext as unknown as Element
      );

      const standaloneCurrent = new FakeDetailsElement({
        class: "lab-interpretation-panel lab-interpretation-panel--standalone",
        "data-lab-interpretation-panel": "true",
        open: "",
      });
      const standaloneNext = new FakeDetailsElement({
        class: "lab-interpretation-panel lab-interpretation-panel--standalone",
        "data-lab-interpretation-panel": "true",
      });
      standaloneCurrent.open = true;
      standaloneNext.open = false;

      labRootModule.__testOnlyLabRootDomSync.syncElement(
        standaloneCurrent as unknown as Element,
        standaloneNext as unknown as Element
      );

      const openSourceDrawer = new FakeDetailsElement({
        class: "labx-sp-group",
        "data-group-type": "source",
        open: "",
      });
      const closedSourceDrawer = new FakeDetailsElement({
        class: "labx-sp-group",
        "data-group-type": "source",
      });

      labRootModule.__testOnlyLabRootDomSync.syncElement(
        openSourceDrawer as unknown as Element,
        closedSourceDrawer as unknown as Element
      );

      const closedFrameDrawer = new FakeDetailsElement({
        class: "labx-sp-group",
        "data-group-type": "frame",
      });
      const openFrameDrawer = new FakeDetailsElement({
        class: "labx-sp-group",
        "data-group-type": "frame",
        open: "",
      });

      labRootModule.__testOnlyLabRootDomSync.syncElement(
        closedFrameDrawer as unknown as Element,
        openFrameDrawer as unknown as Element
      );

      assert.equal(embeddedCurrent.open, false);
      assert.equal(standaloneCurrent.open, true);
      assert.equal(openSourceDrawer.open, false);
      assert.equal(closedFrameDrawer.open, true);
    } finally {
      Object.entries(descriptors).forEach(([key, descriptor]) => {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      });
    }
  });
  void test("laboratory store treats reused local assets as ready sources during snapshot sync", () => {
    const store = createLabStore();

    store.dispatch({
      type: "snapshot-received",
      payload: {
        ready: true,
        featureId: "media-analysis",
        activeProjectId: "project-asset-reuse",
        projects: [{ id: "project-asset-reuse", name: "asset-reuse.png", hasSource: true }],
        activeProject: {
          id: "project-asset-reuse",
          name: "asset-reuse.png",
          createdAt: "2026-04-25T11:55:00.000Z",
          source: {
            status: "ready",
            kind: "image",
            mode: "local",
            previewUrl: "file:///tmp/asset-reuse.png",
            storedFileName: "asset-reuse.png",
            storedPath: "/tmp/project/sources/asset-reuse.png",
            routeLabel: "Asset reuse",
            metadata: {
              width: 1920,
              height: 1080,
              durationSeconds: 0,
            },
            drafts: {},
          },
          edit: {},
          profile: {
            preflight: {},
          },
          process: {
            records: {},
          },
          report: {
            records: {},
          },
          assets: [],
        },
        workbench: {},
        profileModels: [],
        toolState: {},
        activityFeed: [],
      },
    });

    const state = store.getState();
    assert.equal(state.sourceProbeStatus, "completed");
    assert.equal(state.ui.workspace.sourceIntakeCollapsed, true);
  });
});
