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

describe("selection suggestion accept and click", () => {
  void test("selection suggestion accept checks the mapped analysis without auto-running it", () => {
    class FakeExecutionIntentAcceptTrigger {
      constructor(private readonly suggestionId: string | null) {}

      getAttribute(name: string) {
        return name === "data-lab-execution-intent-accept" ? this.suggestionId : null;
      }
    }

    class FakeExecutionIntentAcceptTarget extends FakeDomElement {
      constructor(private readonly trigger: FakeExecutionIntentAcceptTrigger | null) {
        super();
      }

      override closest(selector?: string): any {
        return selector === "[data-lab-execution-intent-accept]" ? this.trigger : null;
      }
    }

    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    const sentActions: string[] = [];
    const prompts: string[] = [];

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
    createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent(_eventName: string, payload: Record<string, unknown>) {
            if (typeof payload["action"] === "string") {
              sentActions.push(payload["action"]);
            }
          },
        },
        addEventListener() {},
        prompt(message: string) {
          prompts.push(message);
          return "tamamı";
        },
      } as unknown as Window,
    });

    store.dispatch({
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: "project-audio-source",
          projects: [],
        },
        workbench: {
          analysisScope: {
            focus: "visual",
            lifecycle: {
              frozenAt: "2026-05-09T00:00:00.000Z",
              mutable: false,
              processId: "stale-process",
            },
            region: {
              height: 90,
              width: 120,
              x: 10,
              y: 20,
            },
            timeRange: {
              endMs: 9999,
              startMs: 8888,
            },
          },
        },
        source: {
          status: "ready",
          kind: "audio",
          mode: "local",
          routeLabel: "Local Copy",
          storedPath: "/tmp/source.wav",
          metadata: { durationSeconds: 4 },
        },
        sourceProbeStatus: "completed",
        toolState: {
          tools: {
            ffmpeg: { installed: true },
            pyaudioanalysis: { installed: true },
          },
        },
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
    clickListener?.(
      new FakeClickEvent(
        new FakeSelectionSuggestionTarget(
          new FakeSelectionSuggestionTrigger("audio-inspect")
        ) as unknown as EventTarget
      ) as unknown as Event
    );

    const acceptEvent = new FakeClickEvent(
      new FakeExecutionIntentAcceptTarget(
        new FakeExecutionIntentAcceptTrigger("audio-inspect")
      ) as unknown as EventTarget
    );
    clickListener?.(acceptEvent as unknown as Event);

    const state = store.getState();
    assert.equal(acceptEvent.defaultPrevented, true);
    assert.deepEqual(state.selectedCapabilities, ["audio-signal"]);
    assert.equal(state.ui.workspace.selectionTabActive, false);
    assert.equal(sentActions.includes("audio-process-run"), false);
    assert.equal(sentActions.includes("profile-run-preflight"), false);
    assert.equal(prompts.length, 0);
    assert.equal(state.run, null);
  });
  void test("selection suggestion binder ignores invalid preview ids while keeping passive click history", () => {
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

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    const clickEvent = new FakeClickEvent(
      new FakeSelectionSuggestionTarget(
        new FakeSelectionSuggestionTrigger("stale-suggestion-id")
      ) as unknown as EventTarget
    );
    clickListener?.(clickEvent as unknown as Event);

    assert.equal(clickEvent.defaultPrevented, true);
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
    assert.equal(getActiveSuggestionPreview(store.getState()), null);
    assert.equal(
      eventBus.getHistory().some(function (event) {
        return (
          event.type === "workspace-selection-suggestion-clicked" &&
          event.suggestionId === "stale-suggestion-id"
        );
      }),
      true
    );
    assert.equal(
      eventBus.getHistory().some(function (event) {
        return event.type === "workspace-selection-suggestion-preview-set";
      }),
      false
    );
  });
  void test("laboratory store rejects invalid selection preview-set events", () => {
    const store = createLabStore();

    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);

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
      suggestionId: "enhance-visual",
    });
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);

    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });
    assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");
  });
  void test("selection suggestion clicks stay fenced from analysis selection and run execution", () => {
    const documentRef = new FakeControllerDocument();
    const eventBus = createLabEventBus();
    const store = createLabStore();
    const baseWorkspace = store.getState().ui.workspace;

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
      type: "hydrate",
      payload: {
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: "project-1",
          projects: [],
        },
        workbench: {},
        source: {
          kind: "audio",
          mode: "local",
          storedPath: "/tmp/source.wav",
        },
        sourceProbeStatus: "completed",
        workspace: {
          ...baseWorkspace,
          timelineStartMs: 2400,
          timelineEndMs: 5600,
        },
        reports: {
          user: null,
          ai: null,
          emptyReason: null,
        },
        activityFeed: [],
        lastRun: {
          id: "run-1",
          state: "completed",
          startedAt: Date.now() - 5000,
          endedAt: Date.now() - 1000,
          modules: {},
          moduleOrder: [],
          events: [],
          rawLog: [],
          artifacts: [],
          findings: [],
          liveFindings: [],
          warnings: [],
          error: null,
          targetLabel: null,
          progress: 100,
          emptyReason: null,
          analysisScope: {
            focus: "visual",
            timeRange: {
              startMs: 2400,
              endMs: 5600,
            },
            hypothesis: "frozen clue",
          },
          previewArtifacts: [],
          confidence: "medium",
          moduleTrace: [],
          comparisonVariants: [],
          hypothesisSummary: "frozen clue",
        },
      },
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

    const state = store.getState();
    assert.equal(clickEvent.defaultPrevented, true);
    assert.equal(getInspectionMode(state), "audio");
    assert.equal(state.ui.activeSuggestionPreviewId, "audio-inspect");
    assert.deepEqual(state.selectedCapabilities, []);
    assert.equal(state.run?.state, "completed");
  });
});
