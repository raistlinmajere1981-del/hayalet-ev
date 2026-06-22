import {
  assert,
  createDualPreviewSnapshot,
  createLabEventBus,
  createLabRunController,
  createLabStore,
  FakeActionElement,
  FakeControllerDocument,
  FakeDualPreviewDocument,
  FakeHtmlInputElement,
  FakeHtmlSelectElement,
  FakeHtmlTextAreaElement,
  FakeMediaElement,
  FakeRangeElement,
  FakeTextElement,
  getActiveExecutionIntent,
  getReportFreshness,
  getRunSnapshotSummary,
  getWorkspaceDiff,
  test,
} from "./laboratory-runtime-truth.helpers.ts";
import { getBookmarks, resolveDrawerMode } from "../../rooms/laboratory/runtime/lab-selectors.ts";

function createReadySourceStore(reportStatus: "ready" | "stale" | null = null) {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      featureId: "media-analysis",
      ready: true,
      activeProjectId: "project-1",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [{ id: "project-1", name: "lab-demo.mp4", hasSource: true }],
      },
      activeProject: {
        id: "project-1",
        name: "lab-demo.mp4",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          storedPath: "/tmp/lab-demo.mp4",
          storedFileName: "lab-demo.mp4",
          previewUrl: "file:///tmp/lab-demo.mp4",
          metadata: {
            durationSeconds: 12,
          },
        },
        edit: {},
        profile: {
          preflight: {},
        },
        process: {
          records: {},
        },
        report: {
          records:
            reportStatus === null
              ? {}
              : {
                  "media-analysis": {
                    status: reportStatus,
                  },
                },
        },
        assets: [],
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
      sourceProbeStatus: "completed",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
    },
  });
  return store;
}


describe("laboratory store clears semantic and primitive selection state when the active p", () => {
void test("laboratory store clears semantic and primitive selection state when the active project changes", () => {
  const store = createLabStore();

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      storedPath: "/tmp/original.mp4",
    },
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1800,
    endMs: 4200,
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "extract-clip",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "extract-clip",
  });

  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(0),
  });

  assert.equal(store.getState().ui.workspace.timelineStartMs, null);
  assert.equal(store.getState().ui.workspace.timelineEndMs, null);
  assert.equal(store.getState().ui.workspace.activeSelection, null);
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  assert.equal(store.getState().ui.activeExecutionIntentId, null);
  assert.equal(getActiveExecutionIntent(store.getState()), null);
});
void test("laboratory timeline bookmarks stay scoped to the active project source", () => {
  const store = createLabStore();
  const firstSnapshot = createDualPreviewSnapshot(0);
  store.dispatch({
    type: "snapshot-received",
    payload: firstSnapshot,
  });
  store.dispatch({
    type: "workspace-bookmark-added",
    bookmark: {
      id: "scoped-bookmark",
      timeMs: 2100,
      frameIndex: null,
      note: "First project note",
      createdAt: 1,
    },
  });

  assert.equal(store.getState().ui.workspace.bookmarks.length, 1);
  assert.equal(store.getState().ui.workspace.bookmarks[0]?.projectId, "project-dual-preview");
  assert.equal(getBookmarks(store.getState()).length, 1);

  const secondSnapshot = createDualPreviewSnapshot(0);
  secondSnapshot.activeProjectId = "project-second";
  secondSnapshot.projects = [{ id: "project-second", name: "second.mp4", hasSource: true }];
  secondSnapshot.activeProject = {
    ...secondSnapshot.activeProject,
    id: "project-second",
    name: "second.mp4",
    source: {
      ...secondSnapshot.activeProject.source,
      previewUrl: "file:///tmp/second.mp4",
      storedFileName: "second.mp4",
      storedPath: "/tmp/second.mp4",
    },
  };
  store.dispatch({
    type: "snapshot-received",
    payload: secondSnapshot,
  });

  assert.equal(store.getState().ui.workspace.bookmarks.length, 1);
  assert.equal(getBookmarks(store.getState()).length, 0);

  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(0),
  });

  assert.equal(getBookmarks(store.getState()).length, 1);
});
void test("laboratory run controller accepts numeric timeline input edits and normalizes invalid ranges", () => {
  const originalInput = Object.getOwnPropertyDescriptor(globalThis, "HTMLInputElement");
  const originalSelect = Object.getOwnPropertyDescriptor(globalThis, "HTMLSelectElement");
  const originalTextArea = Object.getOwnPropertyDescriptor(globalThis, "HTMLTextAreaElement");
  const preview = new FakeMediaElement();
  preview.duration = 10;
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([['video[data-lab-preserve-media="workspace-preview"]', preview]]),
    [preview]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "HTMLInputElement", {
    configurable: true,
    value: FakeHtmlInputElement,
  });
  Object.defineProperty(globalThis, "HTMLSelectElement", {
    configurable: true,
    value: FakeHtmlSelectElement,
  });
  Object.defineProperty(globalThis, "HTMLTextAreaElement", {
    configurable: true,
    value: FakeHtmlTextAreaElement,
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

    const inputListener = documentRef.listeners.get("input");
    assert.ok(inputListener);

    const startInput = new FakeHtmlInputElement("workspace.timelineStartMs", "1500");
    startInput.type = "number";
    inputListener({ target: startInput } as unknown as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 3000);
    assert.equal(preview.currentTime, 1.5);

    const validEndInput = new FakeHtmlInputElement("workspace.timelineEndMs", "4200");
    validEndInput.type = "number";
    inputListener({ target: validEndInput } as unknown as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 4200);
    assert.equal(preview.currentTime, 4.2);

    const invalidEndInput = new FakeHtmlInputElement("workspace.timelineEndMs", "1400");
    invalidEndInput.type = "number";
    inputListener({ target: invalidEndInput } as unknown as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
    assert.equal(preview.currentTime, 4.2);

    const endInput = new FakeHtmlInputElement("workspace.timelineEndMs", "");
    endInput.type = "number";
    inputListener({ target: endInput } as unknown as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
    assert.equal(preview.currentTime, 4.2);
  } finally {
    if (originalInput) {
      Object.defineProperty(globalThis, "HTMLInputElement", originalInput);
    } else {
      delete (globalThis as Record<string, unknown>)["HTMLInputElement"];
    }
    if (originalSelect) {
      Object.defineProperty(globalThis, "HTMLSelectElement", originalSelect);
    } else {
      delete (globalThis as Record<string, unknown>)["HTMLSelectElement"];
    }
    if (originalTextArea) {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", originalTextArea);
    } else {
      delete (globalThis as Record<string, unknown>)["HTMLTextAreaElement"];
    }
  }
});
void test("laboratory run controller wires compact timeline transport to primary preview media", async () => {
  const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
  const originalInput = Object.getOwnPropertyDescriptor(globalThis, "HTMLInputElement");
  const originalSelect = Object.getOwnPropertyDescriptor(globalThis, "HTMLSelectElement");
  const originalTextArea = Object.getOwnPropertyDescriptor(globalThis, "HTMLTextAreaElement");
  const preview = new FakeMediaElement();
  const playLabel = new FakeTextElement(null);
  const volumeRoleInput = new FakeRangeElement("0", "1");
  const bookmarkNoteInput = { value: "red flash" };
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['video[data-lab-preserve-media="workspace-preview"]', preview],
      ['[data-lab-role="timeline-play-toggle-label"]', playLabel],
      ['[data-lab-role="timeline-volume"]', volumeRoleInput],
      ['[data-lab-role="timeline-bookmark-note"]', bookmarkNoteInput],
    ]),
    [preview]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });
  Object.defineProperty(globalThis, "HTMLInputElement", {
    configurable: true,
    value: FakeHtmlInputElement,
  });
  Object.defineProperty(globalThis, "HTMLSelectElement", {
    configurable: true,
    value: FakeHtmlSelectElement,
  });
  Object.defineProperty(globalThis, "HTMLTextAreaElement", {
    configurable: true,
    value: FakeHtmlTextAreaElement,
  });

  try {
    preview.duration = 12;
    preview.currentTime = 4.321;
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

    assert.equal(playLabel.textContent, "▶");
    assert.equal(volumeRoleInput.value, "1");

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener({ target: new TestElement("timeline-toggle-playback") } as unknown as Event);
    await Promise.resolve();

    assert.equal(preview.playCalls, 1);
    assert.equal(preview.paused, false);
    assert.equal(playLabel.textContent, "❚❚");

    clickListener({ target: new TestElement("timeline-toggle-playback") } as unknown as Event);
    assert.equal(preview.pauseCalls, 1);
    assert.equal(preview.paused, true);
    assert.equal(playLabel.textContent, "▶");

    clickListener({ target: new TestElement("timeline-add-bookmark") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.bookmarks.length, 1);
    assert.equal(store.getState().ui.workspace.bookmarks[0]?.timeMs, 4321);
    assert.equal(store.getState().ui.workspace.bookmarks[0]?.note, "red flash");
    assert.equal(bookmarkNoteInput.value, "");

    preview.currentTime = 5.5;
    clickListener({ target: new TestElement("timeline-add-bookmark") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.bookmarks.length, 2);
    assert.equal(store.getState().ui.workspace.bookmarks[1]?.timeMs, 5500);
    assert.equal(store.getState().ui.workspace.bookmarks[1]?.note, "Mark 00:05.500");
    const firstBookmarkId = store.getState().ui.workspace.bookmarks[0]?.id;
    assert.ok(firstBookmarkId != null);
    clickListener({
      target: new TestElement("timeline-remove-bookmark", firstBookmarkId),
    } as unknown as Event);
    assert.equal(store.getState().ui.workspace.bookmarks.length, 1);
    assert.equal(store.getState().ui.workspace.bookmarks[0]?.timeMs, 5500);

    const inputListener = documentRef.listeners.get("input");
    assert.ok(inputListener);
    const volumeInput = new FakeHtmlInputElement("workspace.previewVolume", "0.35");
    volumeInput.type = "range";
    inputListener({ target: volumeInput } as unknown as Event);

    assert.equal(preview.volume, 0.35);
    assert.equal(preview.muted, false);
    assert.equal(volumeRoleInput.value, "0.35");

    const muteInput = new FakeHtmlInputElement("workspace.previewVolume", "0");
    muteInput.type = "range";
    inputListener({ target: muteInput } as unknown as Event);
    assert.equal(preview.volume, 0);
    assert.equal(preview.muted, true);
    assert.equal(volumeRoleInput.value, "0");

    preview.currentTime = 2;
    clickListener({ target: new TestElement("timeline-set-selection-boundary", "start") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 2000);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);

    preview.currentTime = 6;
    clickListener({ target: new TestElement("timeline-set-selection-boundary", "end") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 2000);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 6000);

    clickListener({ target: new TestElement("timeline-play-selection") } as unknown as Event);
    assert.equal(preview.currentTime, 2);
    assert.equal(preview.playCalls, 2);
    preview.currentTime = 6.1;
    preview.dispatch("timeupdate");
    assert.equal(preview.currentTime, 6);
    assert.equal(preview.pauseCalls, 2);

    clickListener({ target: new TestElement("timeline-toggle-selection-loop") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.selectionLoopEnabled, true);
    clickListener({ target: new TestElement("timeline-play-selection") } as unknown as Event);
    preview.currentTime = 6.2;
    preview.dispatch("timeupdate");
    assert.equal(preview.currentTime, 2);
    assert.equal(store.getState().ui.workspace.selectionLoopEnabled, true);

    clickListener({ target: new TestElement("timeline-clear") } as unknown as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, null);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
    assert.equal(store.getState().ui.workspace.selectionLoopEnabled, false);
    preview.pause();

    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-enhanced-frame-running",
        type: "custom",
        label: "İyileştirilmiş frame hazırlanıyor",
        status: "running",
        startedAt: Date.now() - 1000,
        sourceAction: "export-enhanced-frame",
        progress: 50,
      },
    });

    clickListener({ target: new TestElement("timeline-toggle-playback") } as unknown as Event);
    assert.equal(preview.playCalls, 4);
    assert.equal(preview.paused, true);

    const lockedVolumeInput = new FakeHtmlInputElement("workspace.previewVolume", "0.75");
    lockedVolumeInput.type = "range";
    inputListener({ target: lockedVolumeInput } as unknown as Event);
    assert.equal(store.getState().ui.workspace.previewVolume, 0);
    assert.equal(preview.volume, 0);
    assert.equal(volumeRoleInput.value, "0");
  } finally {
    if (originalElement) {
      Object.defineProperty(globalThis, "Element", originalElement);
    } else {
      delete (globalThis as Record<string, unknown>)["Element"];
    }
    if (originalInput) {
      Object.defineProperty(globalThis, "HTMLInputElement", originalInput);
    } else {
      delete (globalThis as Record<string, unknown>)["HTMLInputElement"];
    }
    if (originalSelect) {
      Object.defineProperty(globalThis, "HTMLSelectElement", originalSelect);
    } else {
      delete (globalThis as Record<string, unknown>)["HTMLSelectElement"];
    }
    if (originalTextArea) {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", originalTextArea);
    } else {
      delete (globalThis as Record<string, unknown>)["HTMLTextAreaElement"];
    }
  }
});
});
