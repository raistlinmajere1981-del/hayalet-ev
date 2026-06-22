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

describe("interpretation engine", () => {
  void test("interpretation engine explains audio focus and selection rules with deterministic guidance", () => {
    const context = {
      activeSelection: {
        id: "selection-short",
        startMs: 120,
        endMs: 420,
        type: "clip",
        createdAt: 1,
      },
      audioFocus: createTestAudioFocusSettings({
        gain: 1.8,
        playbackRate: 0.4,
        filterType: "lowpass",
        filterFrequency: 900,
        eqBands: DEFAULT_AUDIO_FOCUS_SETTINGS.eqBands.map(function (band, index) {
          return index === 4 ? { ...band, gain: 9 } : { ...band };
        }),
      }),
      inspectionMode: "audio",
      sourceKind: "audio",
    } as const;

    const items = buildInterpretationItems(context);
    const repeatedItems = buildInterpretationItems(context);

    assert.deepEqual(
      items.map(function (item) {
        return item.id;
      }),
      [
        "audio-high-gain",
        "audio-slow-playback",
        "audio-lowpass-suppressed-highs",
        "audio-extreme-eq-boost",
        "selection-short-context",
      ]
    );

    assert.deepEqual(items, repeatedItems);
    assert.deepEqual(
      items.map(function (item) {
        return {
          id: item.id,
          recommendation: item.recommendation,
          severity: item.severity,
        };
      }),
      [
        {
          id: "audio-high-gain",
          recommendation: "Reduce gain or apply EQ balancing",
          severity: "high",
        },
        {
          id: "audio-slow-playback",
          recommendation: "Use slow playback to inspect transient details",
          severity: "medium",
        },
        {
          id: "audio-lowpass-suppressed-highs",
          recommendation: "Try increasing cutoff to restore clarity",
          severity: "low",
        },
        {
          id: "audio-extreme-eq-boost",
          recommendation: "Reduce boost to avoid distortion",
          severity: "high",
        },
        {
          id: "selection-short-context",
          recommendation: "Expand selection for better context",
          severity: "medium",
        },
      ]
    );
  });
  void test("waveform timeline keeps interpretation guidance out of the player controls", () => {
    const store = createLabStore();
    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(0),
    });
    store.dispatch({
      type: "workspace-audio-updated",
      patch: {
        gain: 1.8,
        playbackRate: 0.4,
        preservePitch: false,
      },
    });

    const model = getWaveformTimelineModel(store.getState());
    const markup = renderLabWaveformTimeline(model);

    assert.ok((model.interpretationItems?.length || 0) >= 2);
    assert.doesNotMatch(markup, /data-lab-interpretation-panel="true"/);
    assert.doesNotMatch(markup, /High gain may introduce clipping or noise amplification/);
    assert.doesNotMatch(markup, /Slow playback can reveal temporal anomalies/);
    assert.match(markup, /labx-timeline__player-row/);
    assert.match(markup, /labx-timeline__selection-row/);
    assert.match(markup, /workspace\.audioFocus\.playbackRate/);
    assert.match(markup, /data-lab-action="timeline-play-selection"[^>]*disabled/);
    assert.match(markup, /data-lab-action="timeline-set-selection-boundary"/);
  });
  void test("interpretation engine maps fast playback and wide selection guidance deterministically", () => {
    const items = buildInterpretationItems({
      activeSelection: {
        id: "selection-wide",
        startMs: 0,
        endMs: 14_000,
        type: "clip",
        createdAt: 2,
      },
      audioFocus: createTestAudioFocusSettings({
        playbackRate: 1.8,
      }),
      inspectionMode: "audio",
      sourceKind: "audio",
    });

    assert.deepEqual(
      items.map(function (item) {
        return {
          id: item.id,
          recommendation: item.recommendation,
          severity: item.severity,
        };
      }),
      [
        {
          id: "audio-fast-playback",
          recommendation: "Use fast playback to detect repetition patterns",
          severity: "medium",
        },
        {
          id: "selection-wide-context",
          recommendation: "Narrow selection for focused analysis",
          severity: "low",
        },
      ]
    );
  });
  void test("interpretation engine reacts to semantic roi size and fast motion playback", () => {
    const items = buildInterpretationItems({
      activeSelection: {
        id: "selection-roi",
        startMs: 1000,
        endMs: 4000,
        type: "inspect",
        roi: {
          x: 0.1,
          y: 0.1,
          width: 0.1,
          height: 0.1,
        },
        createdAt: 3,
      },
      audioFocus: createTestAudioFocusSettings({
        playbackRate: 1.8,
      }),
      inspectionMode: "motion",
      sourceKind: "video",
    });

    assert.deepEqual(
      items.map(function (item) {
        return item.id;
      }),
      ["audio-fast-playback", "selection-roi-limited-context", "selection-roi-motion-ambiguity"]
    );

    const wideItems = buildInterpretationItems({
      activeSelection: {
        id: "selection-roi-wide",
        startMs: 0,
        endMs: 4000,
        type: "inspect",
        roi: {
          x: 0.05,
          y: 0.05,
          width: 0.85,
          height: 0.75,
        },
        createdAt: 4,
      },
      audioFocus: createTestAudioFocusSettings(),
      inspectionMode: "visual",
      sourceKind: "image",
    });

    assert.deepEqual(
      wideItems.map(function (item) {
        return item.id;
      }),
      ["selection-roi-wide-focus"]
    );
  });
  void test("interpretation engine flags extreme roi aspect ratios deterministically", () => {
    const items = buildInterpretationItems({
      activeSelection: {
        id: "selection-roi-aspect",
        startMs: 0,
        endMs: 4_000,
        type: "inspect",
        roi: {
          x: 0.1,
          y: 0.2,
          width: 0.72,
          height: 0.16,
        },
        createdAt: 5,
      },
      audioFocus: createTestAudioFocusSettings(),
      inspectionMode: "visual",
      sourceKind: "image",
    });

    assert.deepEqual(
      items.map(function (item) {
        return item.id;
      }),
      ["selection-roi-extreme-aspect"]
    );
  });
});
