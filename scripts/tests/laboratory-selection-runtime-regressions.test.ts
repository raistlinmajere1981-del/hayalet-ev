import {
  __testOnlyLabPreviewInspectionController,
  assert,
  bindLabPreviewInspectionInteractions,
  bindLabSelectionIntentClicks,
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
  FakeSelectionIntentTarget,
  FakeSelectionIntentTrigger,
  FakeSelectionSuggestionTarget,
  FakeSelectionSuggestionTrigger,
  FakeWindowEventTarget,
  getActiveExecutionIntent,
  getActiveInspectionSnapshot,
  getActiveSelection,
  getActiveSuggestionPreview,
  getActiveSuggestionPreviewId,
  getEffectivePreviewAudioFocusSettings,
  getInspectionMode,
  getInterpretationItems,
  getRoiFocusActive,
  getRunSnapshotSummary,
  getSelectionIntent,
  getSelectionSuggestions,
  getWaveformTimelineModel,
  renderLabWaveformTimeline,
  renderWorkspaceSurface,
  test,
} from "./laboratory-runtime-truth.helpers.ts";

import type { LabSelection } from "./laboratory-runtime-truth.helpers.ts";

test("interpretation engine explains audio focus and selection rules with deterministic guidance", () => {
  const context = {
    activeSelection: {
      id: "selection-short",
      startMs: 120,
      endMs: 420,
      type: "clip",
      intent: "audio",
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

test("waveform timeline keeps interpretation guidance out of the player controls", () => {
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

test("interpretation engine maps fast playback and wide selection guidance deterministically", () => {
  const items = buildInterpretationItems({
    activeSelection: {
      id: "selection-wide",
      startMs: 0,
      endMs: 14_000,
      type: "clip",
      intent: "audio",
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

test("interpretation engine reacts to semantic roi size and fast motion playback", () => {
  const items = buildInterpretationItems({
    activeSelection: {
      id: "selection-roi",
      startMs: 1000,
      endMs: 4000,
      type: "inspect",
      intent: "motion",
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
      intent: "visual",
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

test("interpretation engine flags extreme roi aspect ratios deterministically", () => {
  const items = buildInterpretationItems({
    activeSelection: {
      id: "selection-roi-aspect",
      startMs: 0,
      endMs: 4_000,
      type: "inspect",
      intent: "visual",
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

test("selection suggestions and waveform model deepen when semantic roi inspection is active", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "visual",
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
    "Enhance clarity",
    "Focus region",
    "Inspect motion",
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

test("lab root preserves interpretation panel details state across embedded and standalone rerenders", async () => {
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

    setAttribute(name: string, value: string) {
      super.setAttribute(name, value);
      if (name === "open") {
        this.open = true;
      }
    }

    removeAttribute(name: string) {
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

    const collapsibleCurrent = new FakeDetailsElement({
      class: "lab-execution-collapsible",
      "data-lab-collapsible-panel": "true",
      "data-panel-id": "simulation",
      open: "",
    });
    const collapsibleNextSame = new FakeDetailsElement({
      class: "lab-execution-collapsible",
      "data-lab-collapsible-panel": "true",
      "data-panel-id": "simulation",
    });
    collapsibleCurrent.open = true;
    collapsibleNextSame.open = false;

    labRootModule.__testOnlyLabRootDomSync.syncElement(
      collapsibleCurrent as unknown as Element,
      collapsibleNextSame as unknown as Element
    );

    const swappedCurrent = new FakeDetailsElement({
      class: "lab-execution-collapsible",
      "data-lab-collapsible-panel": "true",
      "data-panel-id": "simulation",
      open: "",
    });
    const swappedNext = new FakeDetailsElement({
      class: "lab-execution-collapsible",
      "data-lab-collapsible-panel": "true",
      "data-panel-id": "candidate",
    });
    swappedCurrent.open = true;
    swappedNext.open = false;

    labRootModule.__testOnlyLabRootDomSync.syncElement(
      swappedCurrent as unknown as Element,
      swappedNext as unknown as Element
    );

    assert.equal(embeddedCurrent.open, false);
    assert.equal(standaloneCurrent.open, true);
    assert.equal(collapsibleCurrent.open, true);
    assert.equal(swappedCurrent.open, false);
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

test("laboratory store treats reused local assets as ready sources during snapshot sync", () => {
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
          storedPath: "/tmp/project/source/asset-reuse.png",
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

test("waveform timeline hides selection affordances for invalid numeric ranges", () => {
  const baseModel = {
    bookmarks: [],
    dualPreviewActive: false,
    durationMs: 6000,
    waveformSourceLabel: "Source audio",
    waveformSyncLabel: "Preview and waveform share the same master axis.",
    waveformWindowDurationMs: 6000,
    waveformWindowStartMs: 0,
  };

  const zeroWidthMarkup = renderLabWaveformTimeline({
    ...baseModel,
    endMs: 2400,
    startMs: 2400,
  });
  const invertedMarkup = renderLabWaveformTimeline({
    ...baseModel,
    endMs: 1800,
    startMs: 2400,
  });

  assert.match(zeroWidthMarkup, /data-lab-action="timeline-set-selection-boundary"/);
  assert.match(zeroWidthMarkup, /data-lab-action="timeline-clear"[^>]*disabled/);
  assert.doesNotMatch(zeroWidthMarkup, /labx-timeline__selection lab-selection-overlay/);
  assert.match(zeroWidthMarkup, /End must be greater than start/);
  assert.match(invertedMarkup, /data-lab-action="timeline-set-selection-boundary"/);
  assert.match(invertedMarkup, /data-lab-action="timeline-clear"[^>]*disabled/);
  assert.doesNotMatch(invertedMarkup, /labx-timeline__selection lab-selection-overlay/);
});

test("waveform timeline renders selector-driven suggested actions alongside live actions", () => {
  const selection: LabSelection = {
    id: "selection-clip",
    startMs: 12300,
    endMs: 18900,
    type: "clip",
    intent: "general",
    createdAt: 1700000000000,
  };
  const markup = renderLabWaveformTimeline({
    activeSelection: selection,
    bookmarks: [],
    dualPreviewActive: false,
    durationMs: 60000,
    endMs: selection.endMs,
    activeSuggestionPreview: {
      suggestionId: "audio-inspect",
      title: "Ses analizi yapilacak",
      steps: [
        "6.6s secim hazirlanacak",
        "Ses track izole edilecek",
        "Frekans ve yogunluk taramasi hazirlanacak",
      ],
      expectedOutputs: ["Ses analizi raporu", "Olasi anomali noktalari"],
      estimatedCost: "low",
    },
    selectionSuggestions: [
      {
        id: "audio-inspect",
        label: "Ses detaylarini incele",
        actionType: "inspect-audio",
        confidence: 0.9,
      },
      {
        id: "extract-clip",
        label: "Bu bolumu kes",
        actionType: "extract-clip",
        confidence: 0.6,
      },
    ],
    startMs: selection.startMs,
    waveformSourceLabel: "Source audio",
    waveformSyncLabel: "Preview and waveform share the same master axis.",
    waveformWindowDurationMs: 60000,
    waveformWindowStartMs: 0,
  });

  assert.match(markup, /class="lab-selection-panel"/);
  assert.match(markup, /Selection/);
  assert.match(markup, /00:12\.300/);
  assert.match(markup, /00:18\.900/);
  assert.match(markup, /Type: Clip/);
  assert.match(markup, /Intent: General/);
  assert.match(markup, /Region inactive/);
  assert.match(markup, /Inspection mode/);
  assert.match(markup, /Selection intent/);
  assert.match(markup, /data-lab-selection-inspection-mode="none"/);
  assert.match(markup, /This selection will guide future analysis/);
  assert.match(markup, /data-selection-intent="general"/);
  assert.match(markup, /data-lab-selection-intent="anomaly"/);
  assert.match(markup, /data-lab-selection-intent="general"/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /Suggested actions/);
  assert.match(markup, /Ses detaylarini incele/);
  assert.match(markup, /Bu bolumu kes/);
  assert.match(markup, /data-lab-selection-suggestion="audio-inspect"/);
  assert.match(markup, /data-lab-selection-suggestion="extract-clip"/);
  assert.match(markup, /data-suggestion-priority="primary"/);
  assert.match(markup, /data-suggestion-priority="secondary"/);
  assert.match(markup, /Preview/);
  assert.match(markup, /Ses analizi yapilacak/);
  assert.match(markup, /Steps/);
  assert.match(markup, /Outputs/);
  assert.match(markup, /Estimated cost: Low/);
  assert.match(markup, /data-lab-selection-preview="true"/);
  assert.doesNotMatch(markup, /Analyze this/);
  assert.doesNotMatch(markup, /Focus region/);
  assert.doesNotMatch(markup, /data-lab-action="[^"]*">Ses detaylarini incele/);
  assert.doesNotMatch(markup, /data-lab-action="[^"]*">Bu bolumu kes/);
  assert.doesNotMatch(markup, /data-lab-action="workspace-intent-toggle"/);
  assert.doesNotMatch(markup, /timeline-export-clip/);
  assert.doesNotMatch(markup, /timeline-grab-frame/);
});

test("waveform timeline does not render suggested actions from fallback-only selection markup", () => {
  const markup = renderLabWaveformTimeline({
    bookmarks: [],
    dualPreviewActive: false,
    durationMs: 60000,
    endMs: 18900,
    activeSuggestionPreview: {
      suggestionId: "audio-inspect",
      title: "Ses analizi yapilacak",
      steps: ["Secilen zaman araligi hazirlanacak"],
      expectedOutputs: ["Ses analizi raporu"],
      estimatedCost: "low",
    },
    selectionSuggestions: [
      {
        id: "audio-inspect",
        label: "Ses detaylarini incele",
        actionType: "inspect-audio",
        confidence: 0.9,
      },
    ],
    startMs: 12300,
    waveformSourceLabel: "Source audio",
    waveformSyncLabel: "Preview and waveform share the same master axis.",
    waveformWindowDurationMs: 60000,
    waveformWindowStartMs: 0,
  });

  assert.match(markup, /class="lab-selection-panel"/);
  assert.doesNotMatch(markup, /Suggested actions/);
  assert.doesNotMatch(markup, /data-lab-selection-suggestion=/);
  assert.doesNotMatch(markup, /data-lab-selection-preview=/);
  assert.doesNotMatch(markup, /Ses analizi yapilacak/);
});

test("workspace surface renders semantic roi overlay and focus mask inside the visual preview stage", () => {
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

test("workspace surface keeps image roi controls out of the visual preview stage", () => {
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

test("selection intent binder emits a dedicated semantic selection event", () => {
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  eventBus.subscribe(store.dispatch);
  bindLabSelectionIntentClicks({
    documentRef: documentRef as unknown as Document,
    emit: eventBus.emit,
  });

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1200,
    endMs: 2600,
  });

  const clickListener = documentRef.listeners.get("click");
  assert.ok(clickListener);

  const clickEvent = new FakeClickEvent(
    new FakeSelectionIntentTarget(new FakeSelectionIntentTrigger("audio")) as unknown as EventTarget
  );
  clickListener?.(clickEvent as unknown as Event);

  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(getSelectionIntent(store.getState()), "audio");
  assert.equal(
    eventBus.getHistory().some(function (event) {
      return event.type === "workspace-selection-intent-updated" && event.intent === "audio";
    }),
    true
  );
});

test("selection suggestion binder emits a passive selection suggestion event", () => {
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
    documentRef: documentRef as unknown as Document,
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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
  assert.equal(store.getState().ui.workspace.activeSelection?.intent, "audio");
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

test("selection suggestion binder previews expanded timeline suggestions shown in the panel", () => {
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
    documentRef: documentRef as unknown as Document,
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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
  assert.equal(store.getState().ui.activeSuggestionPreviewId, "clean-audio");
  assert.equal(
    getActiveSuggestionPreview(store.getState())?.title,
    "Ses temizleme onizlemesi hazirlanacak"
  );
});

test("selection suggestion binder gates soft execution intent actions by the exact active preview id", () => {
  class FakeClosestTarget extends FakeDomElement {
    constructor(private readonly selectors: Record<string, object | null>) {
      super();
    }

    closest(selector: string) {
      return (this.selectors[selector] ?? null) as object | null;
    }
  }

  class FakeExecutionIntentTrigger {
    constructor(
      private readonly attrName: string,
      private readonly suggestionId: string | null
    ) {}

    getAttribute(name: string) {
      return name === this.attrName ? this.suggestionId : null;
    }
  }

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
    documentRef: documentRef as unknown as Document,
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });

  const clickListener = documentRef.listeners.get("click");
  assert.ok(clickListener);

  clickListener?.({
    target: new FakeClosestTarget({
      "[data-lab-execution-intent-accept]": new FakeExecutionIntentTrigger(
        "data-lab-execution-intent-accept",
        "extract-clip"
      ),
    }) as unknown as EventTarget,
    preventDefault() {
      throw new Error("mismatched preview ids should not be consumed");
    },
  } as Event);
  assert.equal(getActiveExecutionIntent(store.getState()), null);

  const acceptEvent = new FakeClickEvent(
    new FakeClosestTarget({
      "[data-lab-execution-intent-accept]": new FakeExecutionIntentTrigger(
        "data-lab-execution-intent-accept",
        "audio-inspect"
      ),
    }) as unknown as EventTarget
  );
  clickListener?.(acceptEvent as unknown as Event);
  assert.equal(acceptEvent.defaultPrevented, true);
  assert.equal(getActiveExecutionIntent(store.getState())?.id, "audio-inspect");

  const queueEvent = new FakeClickEvent(
    new FakeClosestTarget({
      "[data-lab-execution-intent-queue]": new FakeExecutionIntentTrigger(
        "data-lab-execution-intent-queue",
        "audio-inspect"
      ),
    }) as unknown as EventTarget
  );
  clickListener?.(queueEvent as unknown as Event);
  assert.equal(queueEvent.defaultPrevented, true);
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });

  const dismissEvent = new FakeClickEvent(
    new FakeClosestTarget({
      "[data-lab-execution-intent-dismiss]": new FakeExecutionIntentTrigger(
        "data-lab-execution-intent-dismiss",
        "audio-inspect"
      ),
    }) as unknown as EventTarget
  );
  clickListener?.(dismissEvent as unknown as Event);
  assert.equal(dismissEvent.defaultPrevented, true);
  assert.equal(getActiveExecutionIntent(store.getState()), null);
  assert.equal(store.getState().ui.activeSuggestionPreviewId, null);

  const clearEvent = new FakeClickEvent(
    new FakeClosestTarget({
      "[data-lab-execution-intent-clear]": {},
    }) as unknown as EventTarget
  );
  clickListener?.(clearEvent as unknown as Event);
  assert.equal(clearEvent.defaultPrevented, true);

  assert.equal(
    eventBus.getHistory().some(function (event) {
      return (
        event.type === "workspace-selection-suggestion-accepted" &&
        event.suggestionId === "audio-inspect"
      );
    }),
    true
  );
  assert.equal(
    eventBus.getHistory().some(function (event) {
      return (
        event.type === "workspace-selection-suggestion-dismissed" &&
        event.suggestionId === "audio-inspect"
      );
    }),
    true
  );
  assert.equal(
    eventBus.getHistory().some(function (event) {
      return (
        event.type === "workspace-selection-suggestion-queued" &&
        event.suggestionId === "audio-inspect"
      );
    }),
    true
  );
  assert.equal(
    eventBus.getHistory().some(function (event) {
      return event.type === "workspace-execution-intent-cleared";
    }),
    true
  );
});

test("selection roi binder enforces minimum drag size and emits passive roi + inspection events", () => {
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  eventBus.subscribe(store.dispatch);
  bindLabSelectionRoiInteractions({
    documentRef: documentRef as unknown as Document,
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
      mode: "local",
      storedPath: "/tmp/source.mp4",
    },
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });

  const mouseDownListener = documentRef.listeners.get("mousedown");
  const mouseMoveListener = documentRef.listeners.get("mousemove");
  const mouseUpListener = documentRef.listeners.get("mouseup");
  const clickListener = documentRef.listeners.get("click");
  assert.ok(mouseDownListener);
  assert.ok(mouseMoveListener);
  assert.ok(mouseUpListener);
  assert.ok(clickListener);

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
    clientX: 10,
    clientY: 10,
    preventDefault() {},
    target: new FakeRoiDrawTarget(stage) as unknown as EventTarget,
  } as Event);
  mouseMoveListener?.({
    clientX: 14,
    clientY: 15,
    preventDefault() {},
  } as Event);

  assert.equal(store.getState().ui.workspace.activeSelection?.roi, undefined);

  mouseMoveListener?.({
    clientX: 70,
    clientY: 60,
    preventDefault() {},
  } as Event);
  mouseUpListener?.({} as Event);

  assert.deepEqual(store.getState().ui.workspace.activeSelection?.roi, {
    x: 0.05,
    y: 0.1,
    width: 0.3,
    height: 0.5,
  });

  clickListener?.(
    new FakeClickEvent(
      new FakeInspectionModeTarget(
        new FakeInspectionModeTrigger("motion")
      ) as unknown as EventTarget
    ) as unknown as Event
  );
  assert.equal(getInspectionMode(store.getState()), "motion");

  clickListener?.(
    new FakeClickEvent(new FakeRoiClearTarget() as unknown as EventTarget) as unknown as Event
  );
  assert.equal(store.getState().ui.workspace.activeSelection?.roi, undefined);
});

test("selection roi redraw binder ignores the existing roi so double-click focus wins precedence", () => {
  class FakeExistingSelectionRoiTarget extends FakeDomElement {
    closest(selector: string) {
      if (selector === "[data-lab-selection-roi-ignore='true']") {
        return {} as object;
      }
      if (selector === "[data-lab-selection-roi='true']") {
        return {} as object;
      }
      return null;
    }
  }

  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  eventBus.subscribe(store.dispatch);
  const calls: string[] = [];

  bindLabSelectionRoiInteractions({
    documentRef: documentRef as unknown as Document,
    emit: eventBus.emit,
    getActiveSelection() {
      return store.getState().ui.workspace.activeSelection;
    },
    getSourceKind() {
      return "video";
    },
  });
  bindLabPreviewInspectionInteractions({
    controller: {
      captureSnapshot() {
        return false;
      },
      clearFocus() {
        return false;
      },
      clearSnapshot() {
        return false;
      },
      stepFrame() {
        return false;
      },
      toggleFocus() {
        calls.push("toggle-focus");
        return true;
      },
    },
    documentRef: documentRef as unknown as Document,
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
    startMs: 1_000,
    endMs: 3_000,
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

  const initialRoi = store.getState().ui.workspace.activeSelection?.roi;
  const mouseDownListener = documentRef.listeners.get("mousedown");
  const mouseMoveListener = documentRef.listeners.get("mousemove");
  const dblClickListener = documentRef.listeners.get("dblclick");
  assert.ok(mouseDownListener);
  assert.ok(mouseMoveListener);
  assert.ok(dblClickListener);

  mouseDownListener?.({
    button: 0,
    clientX: 24,
    clientY: 24,
    preventDefault() {},
    target: new FakeExistingSelectionRoiTarget() as unknown as EventTarget,
  } as Event);
  mouseMoveListener?.({
    clientX: 80,
    clientY: 64,
    preventDefault() {},
  } as Event);
  dblClickListener?.({
    target: new FakeExistingSelectionRoiTarget() as unknown as EventTarget,
    preventDefault() {},
    stopImmediatePropagation() {},
  } as Event);

  assert.deepEqual(store.getState().ui.workspace.activeSelection?.roi, initialRoi);
  assert.deepEqual(calls, ["toggle-focus"]);
});

test("preview inspection binder routes focus, stepping, capture, and escape without touching form fields", () => {
  class FakeClosestTarget extends FakeDomElement {
    constructor(private readonly selectors: Record<string, object | null>) {
      super();
    }

    closest(selector: string) {
      return (this.selectors[selector] ?? null) as object | null;
    }
  }

  const documentRef = new FakeControllerDocument();
  const calls: string[] = [];
  bindLabPreviewInspectionInteractions({
    controller: {
      captureSnapshot() {
        calls.push("capture");
        return true;
      },
      clearFocus() {
        calls.push("clear-focus");
        return true;
      },
      clearSnapshot() {
        calls.push("clear-snapshot");
        return true;
      },
      stepFrame(direction) {
        calls.push(direction < 0 ? "step-backward" : "step-forward");
        return true;
      },
      toggleFocus() {
        calls.push("toggle-focus");
        return true;
      },
    },
    documentRef: documentRef as unknown as Document,
  });

  const clickListener = documentRef.listeners.get("click");
  const dblClickListener = documentRef.listeners.get("dblclick");
  const keydownListener = documentRef.listeners.get("keydown");
  assert.ok(clickListener);
  assert.ok(dblClickListener);
  assert.ok(keydownListener);

  clickListener?.({
    target: new FakeClosestTarget({
      "[data-lab-selection-roi-focus-toggle]": {},
    }) as unknown as EventTarget,
    preventDefault() {},
    stopImmediatePropagation() {},
  } as Event);
  clickListener?.({
    target: new FakeClosestTarget({
      "[data-lab-selection-roi-capture]": {},
    }) as unknown as EventTarget,
    preventDefault() {},
    stopImmediatePropagation() {},
  } as Event);
  clickListener?.({
    target: new FakeClosestTarget({
      "[data-lab-preview-inspection-stage='true']": {},
    }) as unknown as EventTarget,
    preventDefault() {},
    stopImmediatePropagation() {},
  } as Event);
  dblClickListener?.({
    target: new FakeClosestTarget({
      "[data-lab-selection-roi='true']": {},
    }) as unknown as EventTarget,
    preventDefault() {},
    stopImmediatePropagation() {},
  } as Event);
  keydownListener?.({
    key: "ArrowRight",
    target: new FakeOutsideTarget() as unknown as EventTarget,
    preventDefault() {},
    stopImmediatePropagation() {},
  } as Event);
  keydownListener?.({
    key: "Escape",
    target: new FakeOutsideTarget() as unknown as EventTarget,
    preventDefault() {},
    stopImmediatePropagation() {},
  } as Event);
  keydownListener?.({
    key: "ArrowLeft",
    target: new FakeClosestTarget({
      "input, textarea, select, [contenteditable='true']": {},
    }) as unknown as EventTarget,
    preventDefault() {
      throw new Error("editable targets should be ignored");
    },
    stopImmediatePropagation() {
      throw new Error("editable targets should be ignored");
    },
  } as Event);

  assert.deepEqual(calls, [
    "toggle-focus",
    "capture",
    "toggle-focus",
    "step-forward",
    "clear-focus",
  ]);
});

test("preview inspection controller focuses roi, captures a snapshot, and clears stale state on topology loss", async () => {
  const eventBus = createLabEventBus();
  const store = createLabStore();
  eventBus.subscribe(store.dispatch);

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
    startMs: 1_000,
    endMs: 3_000,
  });
  store.dispatch({
    type: "selection-roi-updated",
    roi: {
      x: 0.2,
      y: 0.15,
      width: 0.3,
      height: 0.35,
    },
  });

  const capturedDrawCalls: unknown[][] = [];
  const fakeCanvas = {
    height: 0,
    width: 0,
    getContext() {
      return {
        drawImage(...args: unknown[]) {
          capturedDrawCalls.push(args);
        },
      };
    },
    toDataURL() {
      return "data:image/png;base64,roi";
    },
  };

  const contentStyle = {
    transform: "",
    transformOrigin: "",
  };
  const content = {
    getAttribute() {
      return null;
    },
    getBoundingClientRect() {
      return {
        height: 200,
        left: 0,
        top: 0,
        width: 400,
      };
    },
    querySelector() {
      return null;
    },
    setAttribute() {},
    style: contentStyle,
  };
  const video = {
    currentSrc: "file:///tmp/source.mp4",
    currentTime: 1,
    duration: 8,
    getAttribute(name: string) {
      return name === "src" ? this.currentSrc : null;
    },
    pauseCalls: 0,
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    },
    paused: false,
    videoHeight: 400,
    videoWidth: 800,
  };

  let stageAvailable = true;
  const stageAttributes = new Map<string, string>([
    ["data-lab-preview-inspection-topology", "single-video"],
  ]);
  const stage = {
    getAttribute(name: string) {
      return stageAttributes.get(name) ?? null;
    },
    getBoundingClientRect() {
      return {
        height: 200,
        left: 0,
        top: 0,
        width: 400,
      };
    },
    querySelector(selector: string) {
      if (selector === "[data-lab-preview-inspection-content='true']") {
        return content as unknown as Element;
      }
      if (selector === "video[data-lab-preserve-media], img[data-lab-preserve-media]") {
        return video as unknown as Element;
      }
      return null;
    },
    setAttribute(name: string, value: string) {
      stageAttributes.set(name, value);
    },
    style: undefined,
  };

  const controller = createLabPreviewInspectionController({
    documentRef: {
      createElement() {
        return fakeCanvas as unknown as HTMLElement;
      },
      querySelector(selector: string) {
        if (selector === "[data-lab-preview-inspection-stage='true']" && stageAvailable) {
          return stage as unknown as Element;
        }
        return null;
      },
    } as unknown as Document,
    emit: eventBus.emit,
    getActiveSelection() {
      return getActiveSelection(store.getState());
    },
    getActiveSnapshot() {
      return getActiveInspectionSnapshot(store.getState());
    },
    getRoiFocusActive() {
      return getRoiFocusActive(store.getState());
    },
    windowRef: {
      URL,
    } as unknown as Window,
  });

  assert.equal(controller.setFocusActive(true), true);
  controller.sync();
  assert.equal(getRoiFocusActive(store.getState()), true);
  assert.match(contentStyle.transform, /scale/);
  assert.equal(
    __testOnlyLabPreviewInspectionController.computeFocusTransform(
      {
        width: 400,
        height: 200,
      },
      store.getState().ui.workspace.activeSelection?.roi!
    )?.scale,
    2.857142857142857
  );

  assert.equal(controller.stepFrame(1), true);
  assert.equal(video.pauseCalls, 1);
  assert.ok(video.currentTime > 1);

  assert.equal(await controller.captureSnapshot(), true);
  assert.equal(getActiveInspectionSnapshot(store.getState())?.width, 240);
  assert.equal(getActiveInspectionSnapshot(store.getState())?.height, 140);
  assert.deepEqual(capturedDrawCalls[0]?.slice(1, 5), [160, 60, 240, 140]);

  stageAvailable = false;
  controller.sync();

  assert.equal(getRoiFocusActive(store.getState()), false);
  assert.equal(getActiveInspectionSnapshot(store.getState()), null);
});

test("preview inspection controller ignores snapshot capture when roi is below the minimum size guard", async () => {
  const eventBus = createLabEventBus();
  const store = createLabStore();
  eventBus.subscribe(store.dispatch);

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
    startMs: 1_000,
    endMs: 3_000,
  });
  store.dispatch({
    type: "selection-roi-updated",
    roi: {
      x: 0.1,
      y: 0.1,
      width: 0.05,
      height: 0.05,
    },
  });

  let createElementCalls = 0;
  const stage = {
    getAttribute(name: string) {
      return name === "data-lab-preview-inspection-topology" ? "single-video" : null;
    },
    getBoundingClientRect() {
      return {
        height: 100,
        left: 0,
        top: 0,
        width: 100,
      };
    },
    querySelector(selector: string) {
      if (selector === "[data-lab-preview-inspection-content='true']") {
        return {
          getAttribute() {
            return null;
          },
          getBoundingClientRect() {
            return {
              height: 100,
              left: 0,
              top: 0,
              width: 100,
            };
          },
          querySelector() {
            return null;
          },
          setAttribute() {},
          style: {
            transform: "",
            transformOrigin: "",
          },
        } as unknown as Element;
      }
      if (selector === "video[data-lab-preserve-media], img[data-lab-preserve-media]") {
        return {
          currentSrc: "file:///tmp/source.mp4",
          currentTime: 1,
          duration: 8,
          getAttribute(sourceName: string) {
            return sourceName === "src" ? this.currentSrc : null;
          },
          pause() {},
          paused: true,
          videoHeight: 400,
          videoWidth: 800,
        } as unknown as Element;
      }
      return null;
    },
    setAttribute() {},
    style: undefined,
  };

  const controller = createLabPreviewInspectionController({
    documentRef: {
      createElement() {
        createElementCalls += 1;
        throw new Error("snapshot capture should stop before canvas allocation");
      },
      querySelector(selector: string) {
        if (selector === "[data-lab-preview-inspection-stage='true']") {
          return stage as unknown as Element;
        }
        return null;
      },
    } as unknown as Document,
    emit: eventBus.emit,
    getActiveSelection() {
      return getActiveSelection(store.getState());
    },
    getActiveSnapshot() {
      return getActiveInspectionSnapshot(store.getState());
    },
    getRoiFocusActive() {
      return getRoiFocusActive(store.getState());
    },
    windowRef: {
      URL: {
        createObjectURL() {
          return "blob:ignored";
        },
        revokeObjectURL() {},
      },
    } as unknown as Window,
  });

  assert.equal(await controller.captureSnapshot(), false);
  assert.equal(createElementCalls, 0);
  assert.equal(getActiveInspectionSnapshot(store.getState()), null);
});

test("selection suggestion preview dismissal stays stable with stacked document listeners", () => {
  const originalElement = globalThis.Element;
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const controller = createLabRunController({
    documentRef: documentRef as unknown as Document,
    eventBus,
    store,
    windowRef: new FakeWindowEventTarget() as unknown as Window,
  });

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeDomElement,
  });
  try {
    eventBus.subscribe(store.dispatch);
    bindLabSelectionIntentClicks({
      documentRef: documentRef as unknown as Document,
      emit: eventBus.emit,
    });
    bindLabSelectionSuggestionClicks({
      canPreviewSuggestion(suggestionId) {
        return getSelectionSuggestions(store.getState()).some(function (suggestion) {
          return suggestion.id === suggestionId;
        });
      },
      documentRef: documentRef as unknown as Document,
      emit: eventBus.emit,
      getActivePreviewSuggestionId() {
        return getActiveSuggestionPreviewId(store.getState());
      },
    });
    controller.attach();

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
      type: "workspace-selection-intent-updated",
      intent: "audio",
    });

    const clickListener = documentRef.listeners.get("click");
    const keydownListener = documentRef.listeners.get("keydown");
    assert.ok(clickListener);
    assert.ok(keydownListener);

    clickListener?.(
      new FakeClickEvent(
        new FakeSelectionSuggestionTarget(
          new FakeSelectionSuggestionTrigger("audio-inspect")
        ) as unknown as EventTarget
      ) as unknown as Event
    );
    assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");

    clickListener?.(
      new FakeClickEvent(new FakePanelOnlyTarget() as unknown as EventTarget) as unknown as Event
    );
    assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");

    clickListener?.(
      new FakeClickEvent(new FakeOutsideTarget() as unknown as EventTarget) as unknown as Event
    );
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);

    clickListener?.(
      new FakeClickEvent(
        new FakeSelectionSuggestionTarget(
          new FakeSelectionSuggestionTrigger("audio-inspect")
        ) as unknown as EventTarget
      ) as unknown as Event
    );
    assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");

    const escapeEvent = new FakeKeyboardEvent("Escape");
    keydownListener?.(escapeEvent as unknown as Event);
    assert.equal(escapeEvent.defaultPrevented, true);
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("selection suggestion binder ignores invalid preview ids while keeping passive click history", () => {
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
    documentRef: documentRef as unknown as Document,
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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

test("laboratory store rejects invalid selection preview-set events", () => {
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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

test("selection intent updates stay fenced from workspace analysis intents", () => {
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  eventBus.subscribe(store.dispatch);
  bindLabSelectionIntentClicks({
    documentRef: documentRef as unknown as Document,
    emit: eventBus.emit,
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
      sourceProbeStatus: "completed",
      workspace: {
        ...baseWorkspace,
        timelineStartMs: 2400,
        timelineEndMs: 5600,
        selectedIntents: ["visual-inspection"],
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
          intentIds: ["visual-inspection", "anomaly-detection"],
        },
        previewArtifacts: [],
        confidence: "medium",
        moduleTrace: [],
        comparisonVariants: [],
        hypothesisSummary: "frozen clue",
      },
    },
  });

  const clickListener = documentRef.listeners.get("click");
  assert.ok(clickListener);

  const clickEvent = new FakeClickEvent(
    new FakeSelectionIntentTarget(new FakeSelectionIntentTrigger("audio")) as unknown as EventTarget
  );
  clickListener?.(clickEvent as unknown as Event);

  const state = store.getState();
  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(state.ui.workspace.activeSelection?.intent, "audio");
  assert.deepEqual(state.ui.workspace.selectedIntents, ["visual-inspection"]);
  assert.deepEqual(state.run?.analysisScope?.intentIds, ["visual-inspection", "anomaly-detection"]);
  assert.deepEqual(getRunSnapshotSummary(state), {
    focus: "visual",
    timelineStartMs: 2400,
    timelineEndMs: 5600,
    hypothesis: "frozen clue",
    intentIds: ["visual-inspection", "anomaly-detection"],
  });
});

test("selection suggestion clicks stay fenced from analysis intents and run execution", () => {
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
    documentRef: documentRef as unknown as Document,
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
        selectedIntents: ["visual-inspection"],
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
          intentIds: ["visual-inspection", "anomaly-detection"],
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
    type: "workspace-selection-intent-updated",
    intent: "audio",
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
  assert.equal(state.ui.workspace.activeSelection?.intent, "audio");
  assert.equal(state.ui.activeSuggestionPreviewId, "audio-inspect");
  assert.deepEqual(state.ui.workspace.selectedIntents, ["visual-inspection"]);
  assert.deepEqual(state.run?.analysisScope?.intentIds, ["visual-inspection", "anomaly-detection"]);
  assert.equal(state.run?.state, "completed");
});
