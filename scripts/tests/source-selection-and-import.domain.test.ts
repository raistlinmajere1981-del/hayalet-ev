import { assert, createLabEventBus, createLabRunController, createLabStore, FakeActionElement, FakeControllerDocument, test } from "./laboratory-runtime-truth.helpers.ts";

describe("source selection and import", () => {
  void test("laboratory run controller routes YouTube source selection without import mode or downloads", () => {
    const originalElement = globalThis.Element;
    const originalInput = globalThis.HTMLInputElement;
    const originalSelect = globalThis.HTMLSelectElement;
    const originalTextarea = globalThis.HTMLTextAreaElement;
    const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "video",
        mode: "local",
        status: "ready",
        storedPath: "/tmp/existing-lab-source.mp4",
        storedFileName: "existing-lab-source.mp4",
        sourceUrl: null,
        previewUrl: "file:///tmp/existing-lab-source.mp4",
        routeLabel: "Local Copy",
        metadata: {
          durationSeconds: 42,
        },
      },
    });

    class TestElement extends FakeActionElement {}
    class TestInputElement {
      checked: boolean;
      dataset: Record<string, string>;

      constructor(
        field: string,
        public value: string,
        public type = "url",
        checked = false
      ) {
        this.checked = checked;
        this.dataset = {
          labField: field,
        };
      }
    }
    class TestSelectElement {
      dataset: Record<string, string>;

      constructor(
        field: string,
        public value: string
      ) {
        this.dataset = {
          labField: field,
        };
      }
    }
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
            sendEvent(eventName: string, payload: Record<string, unknown>) {
              sentEvents.push({ eventName, payload });
            },
          },
          addEventListener() {},
        } as unknown as Window,
      });
      controller.attach();

      const clickListener = documentRef.listeners.get("click");
      const changeListener = documentRef.listeners.get("change");
      const inputListener = documentRef.listeners.get("input");
      assert.ok(clickListener);
      assert.ok(changeListener);
      assert.ok(inputListener);

      changeListener({
        target: new TestSelectElement("source.mode", "youtube"),
      } as unknown as Event);

      assert.equal(store.getState().ui.labMode, "normal");
      assert.equal(store.getState().source?.["mode"], "youtube");
      assert.equal(store.getState().source?.["storedPath"], null);
      assert.equal(sentEvents.length, 1);
      assert.equal(sentEvents[0]?.eventName, "media-action");
      assert.equal(sentEvents[0].payload["action"], "source-set-mode");
      const sourceAfterModeSelection = JSON.parse(
        JSON.stringify(store.getState().source)
      ) as Record<string, unknown>;

      inputListener({
        target: new TestInputElement("source.youtubeUrl", "https://youtube.com/watch?v=focus"),
      } as unknown as Event);
      assert.equal(
        store.getState().ui.sourceDrafts.youtubeUrl,
        "https://youtube.com/watch?v=focus"
      );
      assert.deepEqual(store.getState().source, sourceAfterModeSelection);

      store.dispatch({
        type: "youtube-import-set-url",
        url: "https://www.youtube.com/watch?v=abc123DEF45",
      });
      store.dispatch({
        type: "youtube-import-parse-success",
        url: "https://www.youtube.com/watch?v=abc123DEF45",
        preview: {
          title: "Sample Video Title",
          duration: 154,
          thumbnail: "https://img.youtube.com/vi/abc123DEF45/hqdefault.jpg",
        },
        formats: [
          {
            formatId: "137",
            label: "Video 1080p",
            kind: "video",
            extension: "mp4",
          },
          {
            formatId: "248",
            label: "Video 1080p webm",
            kind: "video",
            extension: "webm",
          },
          {
            formatId: "140",
            label: "Audio m4a",
            kind: "audio",
            extension: "m4a",
          },
          {
            formatId: "251",
            label: "Audio opus",
            kind: "audio",
            extension: "webm",
          },
        ],
        selectedVideoFormatId: "137",
        selectedAudioFormatId: "140",
      });
      assert.equal(store.getState().ui.youtubeImport.status, "ready");
      assert.equal(store.getState().ui.youtubeImport.selectedVideoFormatId, "137");
      assert.equal(store.getState().ui.youtubeImport.selectedAudioFormatId, "140");

      changeListener({
        target: new TestSelectElement("project-import.youtubeVideoFormat", "248"),
      } as unknown as Event);
      assert.equal(store.getState().ui.youtubeImport.selectedVideoFormatId, "248");

      changeListener({
        target: new TestSelectElement("project-import.youtubeAudioFormat", "251"),
      } as unknown as Event);
      assert.equal(store.getState().ui.youtubeImport.selectedAudioFormatId, "251");

      changeListener({
        target: new TestSelectElement("project-import.youtubeCaptureMode", "audio-only"),
      } as unknown as Event);
      assert.equal(store.getState().ui.projectImport.drafts.video.youtubeCaptureMode, "audio-only");

      assert.equal(sentEvents.length, 1);
      clickListener({ target: new TestElement("youtube-import-clear") } as unknown as Event);
      assert.deepEqual(store.getState().ui.youtubeImport, {
        url: null,
        status: "idle",
        preview: null,
        formats: [],
        selectedVideoFormatId: null,
        selectedAudioFormatId: null,
      });

      assert.equal(
        sentEvents.some(function (entry) {
          return entry.payload["action"] === "source-download-youtube";
        }),
        false
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

  void test("laboratory run controller sends project import draft fields without mutating committed source", () => {
    const originalElement = globalThis.Element;
    const originalInput = globalThis.HTMLInputElement;
    const originalSelect = globalThis.HTMLSelectElement;
    const originalTextarea = globalThis.HTMLTextAreaElement;
    const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    store.dispatch({
      type: "source-config-patched",
      patch: {
        kind: "video",
        mode: "local",
        status: "ready",
        storedPath: "/tmp/existing-lab-source.mp4",
        storedFileName: "existing-lab-source.mp4",
        sourceUrl: null,
        routeLabel: "Local Copy",
        metadata: {},
      },
    });
    const committedSourceBeforeImport = JSON.parse(
      JSON.stringify(store.getState().source)
    ) as Record<string, unknown>;

    class TestElement extends FakeActionElement {}
    class TestInputElement {
      checked = false;
      dataset: Record<string, string>;
      type = "text";

      constructor(
        field: string,
        public value: string
      ) {
        this.dataset = {
          labField: field,
        };
      }
    }
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
            sendEvent(eventName: string, payload: Record<string, unknown>) {
              sentEvents.push({ eventName, payload });
            },
          },
          addEventListener() {},
        } as unknown as Window,
      });
      controller.attach();

      const clickListener = documentRef.listeners.get("click");
      const inputListener = documentRef.listeners.get("input");
      assert.ok(clickListener);
      assert.ok(inputListener);

      inputListener({
        target: new TestInputElement("project-import.urlInput", "https://example.com/evidence.png"),
      } as unknown as Event);

      assert.deepEqual(store.getState().source, committedSourceBeforeImport);

      clickListener({ target: new TestElement("project-import-check-url") } as unknown as Event);

      assert.equal(sentEvents.length, 1);
      assert.equal(sentEvents[0]?.eventName, "media-action");
      assert.equal(sentEvents[0].payload["action"], "project-import-check-url");
      store.dispatch({
        type: "host-event-received",
        event: {
          id: "evt-url-check",
          kind: "request-result",
          severity: "success",
          message: "URL check completed",
          detail: null,
          action: "project-import-check-url",
          stage: "completed",
          timestamp: Date.now(),
          source: "host",
          scope: "global",
          moduleId: null,
          rawLine: null,
          result: {
            url: "https://example.com/evidence.png",
            isYoutube: false,
            kind: "image",
          },
        } as never,
      });
      assert.equal(store.getState().ui.projectImport.activeKind, "image");
      assert.equal(store.getState().ui.projectImport.methods.image, "url");

      clickListener({ target: new TestElement("project-import-url-add") } as unknown as Event);

      assert.equal(sentEvents.length, 2);
      assert.equal(sentEvents[1]?.eventName, "media-action");
      assert.equal(sentEvents[1].payload["action"], "source-download-url");
      const mediaPayload = sentEvents[1].payload["payload"] as Record<string, unknown>;
      const fields = mediaPayload["fields"] as Record<string, unknown>;
      assert.equal(fields["kind"], "image");
      assert.equal(fields["mode"], "url");
      assert.equal(fields["urlInput"], "https://example.com/evidence.png");
      assert.equal(Object.prototype.hasOwnProperty.call(fields, "file" + "NameHint"), false);
      assert.deepEqual(store.getState().source, committedSourceBeforeImport);
      assert.equal(store.getState().ui.projectImport.reviewFocus, "running");
      assert.equal(store.getState().ui.projectImport.lastAction, "source-download-url");
      assert.equal(
        store.getState().ui.projectImport.lastRequestId,
        sentEvents[1].payload["requestId"]
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
});
