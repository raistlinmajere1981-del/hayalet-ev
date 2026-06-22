import { assert, bindLabSelectionRoiInteractions, bindLabSelectionSuggestionClicks, createDualPreviewSnapshot, createLabEventBus, createLabStore, FakeClickEvent, FakeControllerDocument, FakeRoiDrawTarget, FakeRoiStage, FakeSelectionSuggestionTarget, FakeSelectionSuggestionTrigger, getActiveSelection, getActiveSuggestionPreview, getActiveSuggestionPreviewId, getInspectionMode, getSelectionSuggestions, getWaveformTimelineModel, renderWorkspaceSurface, test } from "./laboratory-runtime-truth.helpers.ts";
import { getReadyAnalysisPreparationGroups } from "../../rooms/laboratory/runtime/lab-selectors.ts";


describe("workspace surface and roi overlay", () => {
  void test("workspace surface renders semantic roi overlay and focus mask inside the visual preview stage", () => {
    const store = createLabStore();
    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(0),
    });
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
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

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.main, /data-lab-selection-roi-stage="true"/);
    assert.match(surface.main, /data-lab-selection-roi-overlay="true"/);
    assert.match(surface.main, /data-lab-selection-roi="true"/);
    assert.match(surface.main, /labx-selection-roi-mask/);
  });
  void test("selection roi binder stores a full-video ROI without an explicit timeline range", () => {
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
        metadata: {
          durationMs: 4200,
        },
        mode: "local",
        storedPath: "/tmp/source.mp4",
      },
    });

    const mouseDownListener = documentRef.listeners.get("mousedown");
    const mouseMoveListener = documentRef.listeners.get("mousemove");
    const mouseUpListener = documentRef.listeners.get("mouseup");
    assert.ok(mouseDownListener);
    assert.ok(mouseMoveListener);
    assert.ok(mouseUpListener);

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
      clientX: 20,
      clientY: 10,
      preventDefault() {},
      target: new FakeRoiDrawTarget(stage) as unknown as EventTarget,
    } as unknown as Event);
    mouseMoveListener?.({
      clientX: 100,
      clientY: 60,
      preventDefault() {},
    } as unknown as Event);
    mouseUpListener?.({} as unknown as Event);

    const selection = store.getState().ui.workspace.activeSelection;
    assert.equal(selection?.id, "selection-default:full-video");
    assert.equal(selection?.startMs, 0);
    assert.equal(selection?.endMs, 4200);
    assert.deepEqual(selection?.roi, {
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.5,
    });
    assert.equal(store.getState().ui.workspace.timelineStartMs, null);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
    assert.equal(getWaveformTimelineModel(store.getState()).startMs, null);
    assert.equal(getWaveformTimelineModel(store.getState()).endMs, null);

    store.dispatch({
      type: "selection-roi-cleared",
    });
    assert.equal(store.getState().ui.workspace.activeSelection, null);

    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 500,
      endMs: 1500,
    });
    assert.notEqual(
      store.getState().ui.workspace.activeSelection?.id,
      "selection-default:full-video"
    );
  });
  void test("workspace surface keeps image roi controls out of the visual preview stage", () => {
    const store = createLabStore();
    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: "project-image-roi",
          projects: [],
        },
        workbench: {},
        source: {
          status: "ready",
          kind: "image",
          mode: "local",
          previewUrl: "file:///tmp/source.png",
          routeLabel: "Local Copy",
          storedPath: "/tmp/source.png",
          metadata: {
            width: 1534,
            height: 1024,
          },
        },
        sourceProbeStatus: "completed",
        workspace: {},
        reports: {
          user: null,
          ai: null,
          emptyReason: null,
        },
        activityFeed: [],
        lastRun: null,
      },
    });
    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        x: 0.32,
        y: 0.35,
        width: 0.18,
        height: 0.28,
      },
    });

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.main, /data-lab-selection-roi-overlay="true"/);
    assert.match(surface.main, /data-lab-selection-roi="true"/);
    assert.doesNotMatch(surface.main, /labx-roi-selection-toolbar/);
    assert.doesNotMatch(surface.main, /data-lab-selection-inspection-mode=/);
    assert.match(surface.side, /data-lab-selection-inspection-mode=/);
  });
  void test("image sources keep visual inspection ready for analysis setup", () => {
    const store = createLabStore();
    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: "project-image-analysis",
          projects: [],
        },
        workbench: {},
        source: {
          status: "ready",
          kind: "image",
          mode: "local",
          previewUrl: "file:///tmp/source.png",
          routeLabel: "Local Copy",
          storedPath: "/tmp/source.png",
          metadata: {
            width: 1534,
            height: 1024,
          },
        },
        sourceProbeStatus: "completed",
        workspace: {},
        reports: {
          user: null,
          ai: null,
          emptyReason: null,
        },
        activityFeed: [],
        lastRun: null,
      },
    });

    const readyCapabilityIds = getReadyAnalysisPreparationGroups(store.getState()).map(
      function (group) {
        return group.capabilityId;
      }
    );

    assert.ok(readyCapabilityIds.includes("visual-forensics"));
  });
  void test("selection suggestion binder emits a passive selection suggestion event", () => {
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
      type: "workspace-timeline-updated",
      startMs: 1200,
      endMs: 2600,
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "audio",
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    const clickEvent = new FakeClickEvent(
      new FakeSelectionSuggestionTarget(
        new FakeSelectionSuggestionTrigger("audio-inspect")
      ) as unknown as EventTarget
    );
    clickListener?.(clickEvent as unknown as Event);

    assert.equal(clickEvent.defaultPrevented, true);
    assert.equal(getInspectionMode(store.getState()), "audio");
    assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");
    assert.equal(getActiveSuggestionPreview(store.getState())?.title, "Ses analizi yapilacak");
    assert.equal(store.getState().run, null);
    assert.equal(
      eventBus.getHistory().some(function (event) {
        return (
          event.type === "workspace-selection-suggestion-clicked" &&
          event.suggestionId === "audio-inspect"
        );
      }),
      true
    );
    assert.equal(
      eventBus.getHistory().some(function (event) {
        return (
          event.type === "workspace-selection-suggestion-preview-set" &&
          event.suggestionId === "audio-inspect"
        );
      }),
      true
    );
  });
  void test("selection suggestion binder previews expanded timeline suggestions shown in the panel", () => {
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(store.dispatch);
    bindLabSelectionSuggestionClicks({
      canPreviewSuggestion(suggestionId) {
        const visibleSuggestions = getWaveformTimelineModel(store.getState()).selectionSuggestions;
        return visibleSuggestions.some(function (suggestion) {
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
        kind: "video",
        mode: "local",
        storedPath: "/tmp/source.mp4",
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
    assert.ok(clickListener);

    const clickEvent = new FakeClickEvent(
      new FakeSelectionSuggestionTarget(
        new FakeSelectionSuggestionTrigger("clean-audio")
      ) as unknown as EventTarget
    );
    clickListener?.(clickEvent as unknown as Event);

    assert.equal(clickEvent.defaultPrevented, true);
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
    assert.equal(getActiveSuggestionPreview(store.getState()), null);
  });
});
