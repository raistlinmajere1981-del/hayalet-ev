import test from "node:test";
import assert from "node:assert/strict";
import type {
  LabArtifactProjection,
  LabSelection,
} from "../../rooms/laboratory/models/lab-types.ts";
import { createLabEventBus } from "../../rooms/laboratory/runtime/lab-event-bus.ts";
import { createLabRunController } from "../../rooms/laboratory/runtime/lab-run-controller.ts";
import { createLabHostBridge } from "../../rooms/laboratory/runtime/lab-host-bridge.ts";
import {
  getActualOutputs,
  getActionOutputs,
  getActiveSelection,
  getAudioVisualizationArtifact,
  getAssetById,
  getAssets,
  getAssetsByRun,
  getAssetsBySource,
  getAssetsByType,
  getCurrentSourceAsset,
  getDualPreviewVolume,
  getExpectedOutputs,
  getIntentDirtyMap,
  getLinkedAudioAssets,
  getParentSourceForAsset,
  getReportFreshness,
  getRunSnapshotSummary,
  getSelectionDuration,
  getSelectedDualPreviewAudioAsset,
  getWaveformTimelineModel,
  getWorkspaceDiff,
  isDualPreviewActive,
  isDualPreviewAvailable,
  isExpectedOutputMatched,
  isSelectionValid,
} from "../../rooms/laboratory/runtime/lab-selectors.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS } from "../../rooms/laboratory/runtime/lab-user-actions.ts";
import { extractFindings } from "../../rooms/laboratory/services/finding-engine.ts";
import { parseProcessOutput } from "../../rooms/laboratory/services/process-output-parser.ts";
import {
  createLabWaveformTimelineVisualizer,
  renderLabWaveformTimeline,
} from "../../rooms/laboratory/ui/lab-waveform-timeline.ts";
import {
  renderWorkspaceAudioFocus,
} from "../../rooms/laboratory/ui/workspace-audio-focus.ts";

type TimeoutFn = typeof globalThis.setTimeout;
type ClearTimeoutFn = typeof globalThis.clearTimeout;

function installTimerMock(): {
  scheduled: Array<{ fn: () => void; delay: number }>;
  restore: () => void;
} {
  const originalSetTimeout: TimeoutFn = globalThis.setTimeout;
  const originalClearTimeout: ClearTimeoutFn = globalThis.clearTimeout;
  const scheduled: Array<{ fn: () => void; delay: number }> = [];

  globalThis.setTimeout = ((fn: (...args: unknown[]) => void, delay?: number) => {
    scheduled.push({ fn: () => fn(), delay: delay ?? 0 });
    return scheduled.length as unknown as ReturnType<typeof setTimeout>;
  }) as TimeoutFn;

  globalThis.clearTimeout = (() => {}) as ClearTimeoutFn;

  return {
    scheduled,
    restore() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

class FakeActionElement {
  dataset: Record<string, string>;

  constructor(action: string, value?: string) {
    this.dataset = {
      labAction: action,
      ...(value === undefined ? {} : { labValue: value }),
    };
  }

  closest(selector: string): FakeActionElement | null {
    if (selector === "[data-lab-stage]") {
      return null;
    }
    if (selector === "[data-lab-action]") {
      return this;
    }
    return null;
  }
}

class FakeControllerDocument {
  listeners = new Map<string, (event: Event) => void>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(
      type,
      typeof listener === "function"
        ? (listener as (event: Event) => void)
        : (event: Event) => listener.handleEvent(event)
    );
  }
}

class FakeMediaElement {
  currentTime = 0;
  currentSrc = "";
  duration = 0;
  readyState = 1;
  muted = false;
  paused = true;
  volume = 1;
  playCalls = 0;
  pauseCalls = 0;
  failPlay = false;
  src = "";
  private listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const handler =
      typeof listener === "function"
        ? (listener as (event: Event) => void)
        : (event: Event) => listener.handleEvent(event);
    const existing = this.listeners.get(type) || new Set<(event: Event) => void>();
    existing.add(handler);
    this.listeners.set(type, existing);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const existing = this.listeners.get(type);
    if (!existing) {
      return;
    }
    const handler =
      typeof listener === "function"
        ? (listener as (event: Event) => void)
        : (event: Event) => listener.handleEvent(event);
    existing.delete(handler);
  }

  play() {
    this.paused = false;
    this.playCalls += 1;
    if (this.failPlay) {
      this.paused = true;
      return Promise.reject(new Error("Autoplay blocked"));
    }
    this.dispatch("play");
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.pauseCalls += 1;
    this.dispatch("pause");
  }

  dispatch(type: string) {
    const handlers = Array.from(this.listeners.get(type) || []);
    handlers.forEach(function (handler) {
      handler({ type } as Event);
    });
  }
}

class FakeRangeElement {
  constructor(
    public value: string,
    public max = "0"
  ) {}
}

class FakeTextElement {
  constructor(public textContent: string | null = null) {}
}

class FakePlayheadElement {
  style: Record<string, string> = {};
  attributes = new Map<string, string>();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

class FakeWindowEventTarget {
  listeners = new Map<string, (event: Event) => void>();
  roomAPI = {
    sendEvent() {},
  };

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(
      type,
      typeof listener === "function"
        ? (listener as (event: Event) => void)
        : (event: Event) => listener.handleEvent(event)
    );
  }

  removeEventListener(type: string): void {
    this.listeners.delete(type);
  }
}

class FakeTimelineTrack {
  constructor(
    private readonly left: number,
    private readonly width: number
  ) {}

  getBoundingClientRect() {
    return {
      left: this.left,
      width: this.width,
    };
  }
}

class FakeTimelineRoot {
  dataset: Record<string, string>;

  constructor(
    private readonly track: FakeTimelineTrack,
    durationMs: number
  ) {
    this.dataset = {
      duration: String(durationMs),
    };
  }

  querySelector(selector: string) {
    return selector === ".labx-timeline__track" ? this.track : null;
  }
}

class FakeTimelineActionElement {
  dataset: Record<string, string>;

  constructor(
    action: string,
    private readonly timeline: FakeTimelineRoot,
    value?: string
  ) {
    this.dataset = {
      labAction: action,
      ...(value === undefined ? {} : { labValue: value }),
    };
  }

  closest(selector: string) {
    if (selector === ".labx-timeline") {
      return this.timeline;
    }
    if (selector === "[data-lab-action]") {
      return this;
    }
    return selector.includes(this.dataset.labAction) ? this : null;
  }
}

class FakeMouseEvent {
  constructor(
    public target: EventTarget | null,
    public clientX: number,
    public shiftKey = false
  ) {}

  preventDefault() {}

  stopPropagation() {}
}

class FakeHtmlInputElement {
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

class FakeHtmlSelectElement {
  constructor(public value = "") {}
}

class FakeHtmlTextAreaElement {
  constructor(public value = "") {}
}

class FakeDualPreviewDocument extends FakeControllerDocument {
  constructor(
    private readonly queryMap: Map<string, unknown>,
    private readonly mediaElements: unknown[] = []
  ) {
    super();
  }

  querySelector(selector: string) {
    return this.queryMap.get(selector) || null;
  }

  querySelectorAll(selector: string) {
    if (selector === ".labx-preview-media") {
      return this.mediaElements as HTMLMediaElement[];
    }
    return [] as HTMLMediaElement[];
  }
}

class FakeCanvasContext {
  clearRectCalls = 0;
  drawImageCalls = 0;
  lastDrawImageArgs: unknown[] | null = null;
  lineWidth = 0;
  lastDrawnImageSrc: string | null = null;
  shadowBlur = 0;
  shadowColor = "";
  strokeCalls = 0;
  strokeStyle = "";
  strokeStyleHistory: string[] = [];

  beginPath() {}

  clearRect() {
    this.clearRectCalls += 1;
  }

  drawImage(...args: unknown[]) {
    const image = args[0] as { src?: string } | undefined;
    this.drawImageCalls += 1;
    this.lastDrawImageArgs = args;
    this.lastDrawnImageSrc = typeof image.src === "string" ? image.src : null;
  }

  lineTo() {}

  moveTo() {}

  setTransform() {}

  stroke() {
    this.strokeCalls += 1;
    this.strokeStyleHistory.push(this.strokeStyle);
  }
}

class FakeCanvasElement {
  width = 320;
  height = 80;
  clientWidth = 320;
  clientHeight = 80;
  readonly context = new FakeCanvasContext();

  getContext(type: string) {
    return type === "2d" ? (this.context as unknown as CanvasRenderingContext2D) : null;
  }
}

class FakeVisualizerSourceNode {
  connectedTargets: unknown[] = [];
  disconnectCalls = 0;

  connect(target: unknown) {
    this.connectedTargets.push(target);
  }

  disconnect() {
    this.disconnectCalls += 1;
  }
}

class FakeVisualizerAnalyserNode {
  connectedTargets: unknown[] = [];
  fftSize = 2048;
  smoothingTimeConstant = 0;

  connect(target: unknown) {
    this.connectedTargets.push(target);
  }

  getByteTimeDomainData(buffer: Uint8Array) {
    for (let index = 0; index < buffer.length; index += 1) {
      buffer[index] = 128 + Math.round(Math.sin(index / 6) * 28);
    }
  }
}

class FakeVisualizerAudioContext {
  static constructed: FakeVisualizerAudioContext[] = [];

  state: AudioContextState = "suspended";
  readonly analyser = new FakeVisualizerAnalyserNode();
  readonly destination = { kind: "destination" };
  readonly sourceNodes: FakeVisualizerSourceNode[] = [];
  closeCalls = 0;
  resumeCalls = 0;

  constructor() {
    FakeVisualizerAudioContext.constructed.push(this);
  }

  createAnalyser() {
    return this.analyser as unknown as AnalyserNode;
  }

  createMediaElementSource() {
    const sourceNode = new FakeVisualizerSourceNode();
    this.sourceNodes.push(sourceNode);
    return sourceNode as unknown as MediaElementAudioSourceNode;
  }

  decodeAudioData() {
    const sampleCount = 4096;
    const samples = new Float32Array(sampleCount);
    for (let index = 0; index < sampleCount; index += 1) {
      samples[index] = Math.sin(index / 18) * 0.7;
    }
    return Promise.resolve({
      length: sampleCount,
      numberOfChannels: 1,
      getChannelData() {
        return samples;
      },
    } as unknown as AudioBuffer);
  }

  close() {
    this.closeCalls += 1;
    this.state = "closed";
    return Promise.resolve();
  }

  resume() {
    this.resumeCalls += 1;
    this.state = "running";
    return Promise.resolve();
  }
}

class FakeVisualizerWindow {
  static imageLoadBehavior = new Map<string, "load" | "error" | "defer">();

  AudioContext = FakeVisualizerAudioContext as unknown as typeof AudioContext;
  Image: typeof Image;
  devicePixelRatio = 1;
  fetchCalls: string[] = [];
  nextFrameId = 1;
  private readonly deferredImages = new Map<
    string,
    Array<{ onerror: null | (() => void); onload: null | (() => void) }>
  >();
  roomAPI = {
    sendEvent() {},
  };
  scheduledFrames = new Map<number, FrameRequestCallback>();

  constructor() {
    const windowRef = this;
    this.Image = class FakeImage {
      height = 120;
      naturalHeight = 120;
      naturalWidth = 1200;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;
      private _src = "";
      width = 1200;

      get src() {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        queueMicrotask(() => {
          const behavior = FakeVisualizerWindow.imageLoadBehavior.get(value) || "load";
          if (behavior === "defer") {
            const pending = windowRef.deferredImages.get(value) || [];
            pending.push(this);
            windowRef.deferredImages.set(value, pending);
            return;
          }
          if (behavior === "error") {
            this.onerror?.();
            return;
          }
          this.onload?.();
        });
      }
    } as unknown as typeof Image;
  }

  addEventListener() {}

  fetch(url: string) {
    this.fetchCalls.push(url);
    return Promise.resolve({
      arrayBuffer: async () => new ArrayBuffer(16),
      ok: true,
    } as Response);
  }

  cancelAnimationFrame(id: number) {
    this.scheduledFrames.delete(id);
  }

  flushFrame(timestamp = 16) {
    const nextFrame = this.scheduledFrames.entries().next();
    if (nextFrame.done) {
      return;
    }
    const [frameId, callback] = nextFrame.value;
    this.scheduledFrames.delete(frameId);
    callback(timestamp);
  }

  flushDeferredImage(url: string) {
    const pending = this.deferredImages.get(url) || [];
    this.deferredImages.delete(url);
    pending.forEach(function (image) {
      image.onload?.();
    });
  }

  getComputedStyle() {
    return {
      getPropertyValue(name: string) {
        switch (name) {
          case "--labx-accent":
            return "#5cd7df";
          case "--labx-border":
            return "rgba(116, 155, 193, 0.18)";
          case "--labx-text-dim":
            return "#6d8197";
          default:
            return "";
        }
      },
    } as CSSStyleDeclaration;
  }

  requestAnimationFrame(callback: FrameRequestCallback) {
    const frameId = this.nextFrameId;
    this.nextFrameId += 1;
    this.scheduledFrames.set(frameId, callback);
    return frameId;
  }
}

class FakeVisualizerDocument {
  constructor(
    public primaryMediaPreview: FakeMediaElement | null,
    public dualAudioPreview: FakeMediaElement | null,
    public canvas: FakeCanvasElement | null
  ) {}

  querySelector(selector: string) {
    if (selector === 'audio[data-lab-preserve-media="workspace-preview-dual-audio"]') {
      return this.dualAudioPreview;
    }
    if (
      selector === 'audio[data-lab-preserve-media="workspace-preview"]' ||
      selector === 'video[data-lab-preserve-media="workspace-preview"]'
    ) {
      return this.primaryMediaPreview;
    }
    if (selector === "#lab-audio-viz") {
      return this.canvas;
    }
    return null;
  }
}

test("laboratory workspace audio focus defaults to waveform visualization", () => {
  const store = createLabStore();
  assert.equal(store.getState().ui.workspace.audioFocus.visualizationMode, "waveform");
});

test("laboratory hydration upgrades deprecated audio visualization none mode to waveform", () => {
  const store = createLabStore();
  store.dispatch({
    type: "hydrate-complete",
    payload: {
      workspace: {
        audioFocus: {
          ...store.getState().ui.workspace.audioFocus,
          visualizationMode: "none",
        },
      },
    },
  });

  assert.equal(store.getState().ui.workspace.audioFocus.visualizationMode, "waveform");
});

test("laboratory audio focus updates preserve an existing spectrogram preference", () => {
  const store = createLabStore();
  store.dispatch({
    type: "workspace-audio-updated",
    patch: {
      visualizationMode: "spectrum",
    },
  });
  store.dispatch({
    type: "workspace-audio-updated",
    patch: {
      filterType: "highpass",
    },
  });

  assert.equal(store.getState().ui.workspace.audioFocus.visualizationMode, "spectrum");
});

test("audio visualization selector prefers renderable current-run artifacts by mode", () => {
  const store = createLabStore();
  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };
  state.run = {
    id: "run-audio-visualization",
    state: "completed",
    startedAt: Date.now() - 1000,
    endedAt: Date.now(),
    modules: {},
    moduleOrder: [],
    events: [],
    rawLog: [],
    artifacts: [
      {
        id: "artifact-waveform-final",
        kind: "waveform",
        previewUrl: "file:///tmp/final-waveform.png",
        path: "/tmp/final-waveform.png",
        createdAt: new Date(Date.now() - 4000).toISOString(),
        active: false,
      },
      {
        id: "artifact-spectrogram-file-url",
        kind: "spectrogram",
        previewUrl: null,
        fileUrl: "file:///tmp/file-url-spectrogram.png",
        path: "/tmp/file-url-spectrogram.png",
        createdAt: new Date(Date.now() - 500).toISOString(),
        active: true,
      },
      {
        id: "artifact-spectrogram-raw-path-only",
        kind: "spectrogram",
        previewUrl: null,
        path: "/tmp/raw-path-only-spectrogram.png",
        createdAt: new Date(Date.now() - 50).toISOString(),
        active: true,
      },
    ],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: null,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [
      {
        id: "artifact-waveform-preview",
        kind: "waveform",
        previewUrl: "file:///tmp/preview-waveform.png",
        path: "/tmp/preview-waveform.png",
        createdAt: new Date(Date.now() - 100).toISOString(),
        active: true,
        status: "ready",
        variantId: null,
        reference: null,
        metadata: {},
      },
      {
        id: "artifact-spectrogram-preview",
        kind: "spectrogram",
        previewUrl: "file:///tmp/preview-spectrogram.png",
        path: "/tmp/preview-spectrogram.png",
        createdAt: new Date(Date.now() - 200).toISOString(),
        active: true,
        status: "ready",
        variantId: null,
        reference: null,
        metadata: {},
      },
    ],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  state.ui.workspace.audioFocus.visualizationMode = "waveform";
  assert.equal(getAudioVisualizationArtifact(store.getState())?.id, "artifact-waveform-final");

  state.ui.workspace.audioFocus.visualizationMode = "spectrum";
  assert.equal(getAudioVisualizationArtifact(store.getState())?.id, "artifact-spectrogram-file-url");

  state.ui.workspace.audioFocus.visualizationMode = "none";
  assert.equal(getAudioVisualizationArtifact(store.getState())?.id, "artifact-waveform-final");
});

test("audio visualization selector keeps stable input order when artifact priority ties", () => {
  const store = createLabStore();
  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };
  const sharedCreatedAt = new Date().toISOString();
  state.run = {
    id: "run-audio-visualization-stable-order",
    state: "completed",
    startedAt: Date.now() - 1000,
    endedAt: Date.now(),
    modules: {},
    moduleOrder: [],
    events: [],
    rawLog: [],
    artifacts: [
      {
        id: "artifact-waveform-second-by-id",
        kind: "waveform",
        previewUrl: "file:///tmp/waveform-second.png",
        path: "/tmp/waveform-second.png",
        createdAt: sharedCreatedAt,
        active: false,
      },
      {
        id: "artifact-waveform-first-by-id",
        kind: "waveform",
        previewUrl: "file:///tmp/waveform-first.png",
        path: "/tmp/waveform-first.png",
        createdAt: sharedCreatedAt,
        active: false,
      },
    ],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: null,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  state.ui.workspace.audioFocus.visualizationMode = "waveform";
  assert.equal(getAudioVisualizationArtifact(store.getState())?.id, "artifact-waveform-second-by-id");
});

test("workspace audio focus points users to the unified waveform timeline", () => {
  const markup = renderWorkspaceAudioFocus({
    gain: 1,
    filterType: "none",
    filterFrequency: 1000,
    filterQ: 1,
    visualizationMode: "spectrum",
    eqBands: [
      { frequency: 60, gain: 0, Q: 1, type: "lowshelf" },
      { frequency: 250, gain: 0, Q: 1, type: "peaking" },
      { frequency: 1000, gain: 0, Q: 1, type: "peaking" },
      { frequency: 4000, gain: 0, Q: 1, type: "peaking" },
      { frequency: 12000, gain: 0, Q: 1, type: "highshelf" },
    ],
  });

  assert.match(markup, /Timeline preview altinda tek waveform katmani kullanilir\./);
  assert.doesNotMatch(markup, /workspace\.audioFocus\.visualizationMode/);
  assert.doesNotMatch(markup, /lab-audio-viz/);
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

  assert.doesNotMatch(zeroWidthMarkup, /timeline-export-clip/);
  assert.doesNotMatch(zeroWidthMarkup, /labx-timeline__selection/);
  assert.match(zeroWidthMarkup, /End must be greater than start/);
  assert.doesNotMatch(invertedMarkup, /timeline-export-clip/);
  assert.doesNotMatch(invertedMarkup, /labx-timeline__selection/);
});

test("waveform timeline renders a passive selection entity panel alongside live actions", () => {
  const selection: LabSelection = {
    id: "selection-clip",
    startMs: 12300,
    endMs: 18900,
    type: "clip",
    createdAt: 1700000000000,
  };
  const markup = renderLabWaveformTimeline({
    activeSelection: selection,
    bookmarks: [],
    dualPreviewActive: false,
    durationMs: 60000,
    endMs: selection.endMs,
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
  assert.match(markup, /Analyze this/);
  assert.match(markup, /Extract clip/);
  assert.match(markup, /Focus region/);
  assert.match(markup, /disabled>Analyze this/);
  assert.doesNotMatch(markup, /data-lab-action="[^"]*">Analyze this/);
  assert.doesNotMatch(markup, /data-lab-action="[^"]*">Extract clip/);
  assert.doesNotMatch(markup, /data-lab-action="[^"]*">Focus region/);
  assert.match(markup, /timeline-export-clip/);
  assert.match(markup, /timeline-grab-frame/);
});

test("waveform timeline model maps linked audio offset onto the shared master axis", () => {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(250),
  });
  store.dispatch({
    type: "workspace-dual-preview-toggled",
    force: true,
    audioAssetId: "asset-audio-linked",
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 800,
    endMs: 1800,
  });

  const model = getWaveformTimelineModel(store.getState());
  const markup = renderLabWaveformTimeline(model);

  assert.equal(model.waveformWindowStartMs, 250);
  assert.equal(model.waveformWindowDurationMs, 5750);
  assert.equal(Number((model.waveformCropEndRatio || 0).toFixed(6)), Number((5750 / 6000).toFixed(6)));
  assert.match(markup, /id="lab-audio-viz"/);
  assert.match(markup, /data-lab-role="timeline-playhead"/);
  assert.match(markup, /Linked audio offset \+250 ms/);
});

test("waveform timeline model clips negative linked audio offsets against the master range", () => {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(-500),
  });
  store.dispatch({
    type: "workspace-dual-preview-toggled",
    force: true,
    audioAssetId: "asset-audio-linked",
  });

  const model = getWaveformTimelineModel(store.getState());
  const markup = renderLabWaveformTimeline(model);

  assert.equal(model.waveformWindowStartMs, 0);
  assert.equal(model.waveformWindowDurationMs, 5500);
  assert.equal(Number((model.waveformCropStartRatio || 0).toFixed(6)), Number((500 / 6000).toFixed(6)));
  assert.match(markup, /data-waveform-crop-start="0\.08333333333333333"/);
});

test("workspace audio visualizer renders a loadable artifact before live analyser init", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getVisualizationArtifact() {
      return {
        id: "artifact-waveform",
        kind: "waveform",
        previewUrl: null,
        fileUrl: "file:///tmp/waveform-artifact.png",
        path: "/tmp/waveform-artifact.png",
        fileName: "waveform-artifact.png",
        createdAt: new Date().toISOString(),
      } as LabArtifactProjection & { fileUrl: string };
    },
    getVisualizationMode() {
      return "waveform";
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 0);
  assert.equal(windowRef.scheduledFrames.size, 0);
  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/waveform-artifact.png");
});

test("workspace audio visualizer crops artifact rendering to the shared waveform window", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getTimelineModel() {
      return {
        bookmarks: [],
        dualPreviewActive: true,
        durationMs: 6000,
        endMs: null,
        linkedAudioAssetId: "asset-audio-linked",
        sourceKind: "video",
        startMs: null,
        visualizationArtifact: {
          id: "artifact-waveform-cropped",
          kind: "waveform",
          previewUrl: "file:///tmp/waveform-cropped.png",
          path: "/tmp/waveform-cropped.png",
          fileName: "waveform-cropped.png",
          createdAt: new Date().toISOString(),
        },
        visualizationMode: "waveform",
        waveformContentDurationMs: 6000,
        waveformCropEndRatio: 11 / 12,
        waveformCropStartRatio: 1 / 12,
        waveformOffsetMs: -500,
        waveformSourceLabel: "audio.wav",
        waveformSyncLabel: "Linked audio offset -500 ms",
        waveformWindowDurationMs: 5500,
        waveformWindowStartMs: 0,
      };
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/waveform-cropped.png");
  assert.equal(canvas.context.lastDrawImageArgs?.length, 9);
  assert.equal(canvas.context.lastDrawImageArgs?.[1], 100);
  assert.equal(canvas.context.lastDrawImageArgs?.[3], 1000);
  assert.equal(canvas.context.lastDrawImageArgs?.[4], 120);
  assert.equal(canvas.context.lastDrawImageArgs?.[7], 320);
  assert.equal(canvas.context.lastDrawImageArgs?.[8], 80);
});

test("workspace audio visualizer redraws when the shared waveform crop changes without changing the artifact", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  let cropStartRatio = 0;
  let cropEndRatio = 1;
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getTimelineModel() {
      return {
        bookmarks: [],
        dualPreviewActive: true,
        durationMs: 6000,
        endMs: null,
        linkedAudioAssetId: "asset-audio-linked",
        sourceKind: "video",
        startMs: null,
        visualizationArtifact: {
          id: "artifact-waveform-cropped-live",
          kind: "waveform",
          previewUrl: "file:///tmp/waveform-cropped-live.png",
          path: "/tmp/waveform-cropped-live.png",
          fileName: "waveform-cropped-live.png",
          createdAt: new Date().toISOString(),
        },
        visualizationMode: "waveform",
        waveformContentDurationMs: 6000,
        waveformCropEndRatio: cropEndRatio,
        waveformCropStartRatio: cropStartRatio,
        waveformOffsetMs: 0,
        waveformSourceLabel: "audio.wav",
        waveformSyncLabel: "Linked audio is aligned to the master axis.",
        waveformWindowDurationMs: 6000,
        waveformWindowStartMs: 0,
      };
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawImageArgs?.[1], 0);
  assert.equal(canvas.context.lastDrawImageArgs?.[3], 1200);

  cropStartRatio = 1 / 12;
  cropEndRatio = 11 / 12;
  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(canvas.context.drawImageCalls, 2);
  assert.equal(canvas.context.lastDrawImageArgs?.[1], 100);
  assert.equal(canvas.context.lastDrawImageArgs?.[3], 1000);
});

test("workspace audio visualizer binds to the dual preview companion audio element when present", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const primaryVideo = new FakeMediaElement();
  const dualAudio = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(primaryVideo, dualAudio, canvas);
  const windowRef = new FakeVisualizerWindow();
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getVisualizationArtifact() {
      return null;
    },
    getVisualizationMode() {
      return "waveform";
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  assert.equal(FakeVisualizerAudioContext.constructed.length, 0);

  await dualAudio.play();
  await Promise.resolve();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(windowRef.scheduledFrames.size, 1);
});

test("workspace audio visualizer initializes lazily and disconnects on source changes", async () => {
  FakeVisualizerAudioContext.constructed = [];
  const firstAudio = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(firstAudio, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getVisualizationArtifact() {
      return null;
    },
    getVisualizationMode() {
      return "waveform";
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  assert.equal(FakeVisualizerAudioContext.constructed.length, 0);
  assert.equal(windowRef.scheduledFrames.size, 0);

  await firstAudio.play();
  await Promise.resolve();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  const audioContext = FakeVisualizerAudioContext.constructed[0];
  assert.equal(audioContext?.resumeCalls, 1);
  assert.equal(audioContext?.sourceNodes.length, 1);
  assert.equal(windowRef.scheduledFrames.size, 1);

  windowRef.flushFrame();
  assert.ok(canvas.context.clearRectCalls > 0);
  assert.ok(canvas.context.strokeCalls > 0);
  assert.equal(windowRef.scheduledFrames.size, 1);

  const secondAudio = new FakeMediaElement();
  documentRef.primaryMediaPreview = secondAudio;
  visualizer.sync();

  assert.equal(audioContext?.sourceNodes[0]?.disconnectCalls, 1);
  assert.equal(windowRef.scheduledFrames.size, 0);

  visualizer.dispose();
});

test("workspace audio visualizer can resume live waveform after artifact mode exits mid-playback", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  let artifact: LabArtifactProjection | null = {
    id: "artifact-spectrogram",
    kind: "spectrogram",
    previewUrl: "file:///tmp/spectrogram-artifact.png",
    path: "/tmp/spectrogram-artifact.png",
    fileName: "spectrogram-artifact.png",
    createdAt: new Date().toISOString(),
  };
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getVisualizationArtifact() {
      return artifact;
    },
    getVisualizationMode() {
      return "spectrum";
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(canvas.context.drawImageCalls, 1);

  await audioPreview.play();
  await Promise.resolve();
  assert.equal(FakeVisualizerAudioContext.constructed.length, 0);

  artifact = null;
  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(windowRef.scheduledFrames.size, 1);
});

test("workspace audio visualizer ignores stale artifact image loads after the selection changes", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  FakeVisualizerWindow.imageLoadBehavior.set("file:///tmp/slow-waveform.png", "defer");
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new FakeVisualizerDocument(audioPreview, null, canvas);
  const windowRef = new FakeVisualizerWindow();
  let artifact: LabArtifactProjection | null = {
    id: "artifact-waveform-slow",
    kind: "waveform",
    previewUrl: "file:///tmp/slow-waveform.png",
    path: "/tmp/slow-waveform.png",
    fileName: "slow-waveform.png",
    createdAt: new Date(Date.now() - 1000).toISOString(),
  };
  const visualizer = createLabWaveformTimelineVisualizer({
    documentRef: documentRef as unknown as Document,
    getVisualizationArtifact() {
      return artifact;
    },
    getVisualizationMode() {
      return "waveform";
    },
    windowRef: windowRef as unknown as Window,
  });

  visualizer.sync();
  await Promise.resolve();
  assert.equal(canvas.context.drawImageCalls, 0);

  artifact = {
    id: "artifact-waveform-fast",
    kind: "waveform",
    previewUrl: "file:///tmp/fast-waveform.png",
    path: "/tmp/fast-waveform.png",
    fileName: "fast-waveform.png",
    createdAt: new Date().toISOString(),
  };
  visualizer.sync();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/fast-waveform.png");

  windowRef.flushDeferredImage("file:///tmp/slow-waveform.png");
  await Promise.resolve();

  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/fast-waveform.png");
});

test("laboratory run controller renders loadable audio visualization artifacts before play", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new (class extends FakeControllerDocument {
    querySelector(selector: string) {
      if (selector === 'audio[data-lab-preserve-media="workspace-preview"]') {
        return audioPreview;
      }
      if (selector === "#lab-audio-viz") {
        return canvas;
      }
      return null;
    }
  })();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const windowRef = new FakeVisualizerWindow();

  eventBus.subscribe(function (event) {
    store.dispatch(event);
  });

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio-artifact",
      kind: "module-artifact",
      severity: "info",
      message: "Waveform artifact ready",
      detail: "Audio waveform rendered",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: "spectral-artifacts",
      rawLine: null,
      artifact: {
        id: "artifact-waveform-controller",
        moduleId: "spectral-artifacts",
        kind: "waveform",
        path: "/tmp/controller-waveform.png",
        fileName: "controller-waveform.png",
        previewUrl: "file:///tmp/controller-waveform.png",
        createdAt: new Date().toISOString(),
      },
    },
  });

  const controller = createLabRunController({
    documentRef: documentRef as unknown as Document,
    eventBus,
    store,
    windowRef: windowRef as unknown as Window,
  });

  controller.attach();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 0);
  assert.equal(windowRef.scheduledFrames.size, 0);
  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/controller-waveform.png");
});

test("laboratory run controller renders decoded waveform peaks before play when the preview source is available", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  audioPreview.currentSrc = "file:///tmp/controller-waveform-source.wav";
  const canvas = new FakeCanvasElement();
  const documentRef = new (class extends FakeControllerDocument {
    querySelector(selector: string) {
      if (selector === 'audio[data-lab-preserve-media="workspace-preview"]') {
        return audioPreview;
      }
      if (selector === "#lab-audio-viz") {
        return canvas;
      }
      return null;
    }
  })();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const windowRef = new FakeVisualizerWindow();

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
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.deepEqual(windowRef.fetchCalls, ["file:///tmp/controller-waveform-source.wav"]);
  assert.equal(windowRef.scheduledFrames.size, 0);
  assert.equal(canvas.context.strokeStyleHistory.at(-1), "#5cd7df");
});

test("laboratory run controller swaps from live waveform to artifact rendering when a loadable artifact arrives", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new (class extends FakeControllerDocument {
    querySelector(selector: string) {
      if (selector === 'audio[data-lab-preserve-media="workspace-preview"]') {
        return audioPreview;
      }
      if (selector === "#lab-audio-viz") {
        return canvas;
      }
      return null;
    }
  })();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const windowRef = new FakeVisualizerWindow();

  eventBus.subscribe(function (event) {
    store.dispatch(event);
  });

  audioPreview.paused = false;
  const controller = createLabRunController({
    documentRef: documentRef as unknown as Document,
    eventBus,
    store,
    windowRef: windowRef as unknown as Window,
  });

  controller.attach();
  await Promise.resolve();
  await audioPreview.play();
  await Promise.resolve();
  await Promise.resolve();

  const audioContext = FakeVisualizerAudioContext.constructed[0];
  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(windowRef.scheduledFrames.size, 1);

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio-artifact-arrival",
      kind: "module-artifact",
      severity: "info",
      message: "Spectrogram artifact ready",
      detail: "Audio spectrogram rendered",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: "spectral-artifacts",
      rawLine: null,
      artifact: {
        id: "artifact-spectrogram-controller",
        moduleId: "spectral-artifacts",
        kind: "spectrogram",
        path: "/tmp/controller-spectrogram.png",
        fileName: "controller-spectrogram.png",
        previewUrl: "file:///tmp/controller-spectrogram.png",
        createdAt: new Date().toISOString(),
      },
    },
  });
  store.getState().ui.workspace.audioFocus.visualizationMode = "spectrum";

  await Promise.resolve();
  await Promise.resolve();

  assert.equal(windowRef.scheduledFrames.size, 0);
  assert.equal(canvas.context.drawImageCalls, 1);
  assert.equal(canvas.context.lastDrawnImageSrc, "file:///tmp/controller-spectrogram.png");
  assert.equal(audioContext?.sourceNodes[0]?.disconnectCalls, 1);
  assert.equal(
    audioContext?.sourceNodes[0]?.connectedTargets[audioContext.sourceNodes[0].connectedTargets.length - 1],
    audioContext?.destination
  );
});

test("laboratory run controller resumes live waveform after artifact load failure while media keeps playing", async () => {
  FakeVisualizerAudioContext.constructed = [];
  FakeVisualizerWindow.imageLoadBehavior.clear();
  FakeVisualizerWindow.imageLoadBehavior.set("file:///tmp/controller-failing-spectrogram.png", "error");
  const audioPreview = new FakeMediaElement();
  const canvas = new FakeCanvasElement();
  const documentRef = new (class extends FakeControllerDocument {
    querySelector(selector: string) {
      if (selector === 'audio[data-lab-preserve-media="workspace-preview"]') {
        return audioPreview;
      }
      if (selector === "#lab-audio-viz") {
        return canvas;
      }
      return null;
    }
  })();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const windowRef = new FakeVisualizerWindow();

  eventBus.subscribe(function (event) {
    store.dispatch(event);
  });

  audioPreview.paused = false;
  const controller = createLabRunController({
    documentRef: documentRef as unknown as Document,
    eventBus,
    store,
    windowRef: windowRef as unknown as Window,
  });

  controller.attach();
  await Promise.resolve();
  await audioPreview.play();
  await Promise.resolve();
  await Promise.resolve();

  const audioContext = FakeVisualizerAudioContext.constructed[0];
  assert.equal(FakeVisualizerAudioContext.constructed.length, 1);
  assert.equal(windowRef.scheduledFrames.size, 1);

  store.getState().ui.workspace.audioFocus.visualizationMode = "spectrum";
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio-artifact-failing-arrival",
      kind: "module-artifact",
      severity: "info",
      message: "Spectrogram artifact ready",
      detail: "Audio spectrogram rendered",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: "spectral-artifacts",
      rawLine: null,
      artifact: {
        id: "artifact-spectrogram-controller-failing",
        moduleId: "spectral-artifacts",
        kind: "spectrogram",
        path: "/tmp/controller-failing-spectrogram.png",
        fileName: "controller-failing-spectrogram.png",
        previewUrl: "file:///tmp/controller-failing-spectrogram.png",
        createdAt: new Date().toISOString(),
      },
    },
  });

  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(canvas.context.drawImageCalls, 0);
  assert.equal(windowRef.scheduledFrames.size, 1);
  assert.equal(audioContext?.sourceNodes[0]?.disconnectCalls, 2);
  assert.equal(
    audioContext?.sourceNodes[0]?.connectedTargets[audioContext.sourceNodes[0].connectedTargets.length - 1],
    audioContext?.analyser
  );
});

function createDualPreviewSnapshot(startOffsetMs = 0) {
  return {
    ready: true,
    featureId: "media-analysis",
    activeProjectId: "project-dual-preview",
    projects: [{ id: "project-dual-preview", name: "lab-demo.mp4", hasSource: true }],
    activeProject: {
      id: "project-dual-preview",
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
          durationSeconds: 6,
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
          metadata: {
            storedFileName: "lab-demo.mp4",
          },
        },
        {
          id: "asset-audio-linked",
          type: "audio",
          name: "audio.wav",
          localPath: "/tmp/audio.wav",
          createdAt: 200,
          sourceId: "source-active",
          derivedFromAssetId: "source-active",
          derivedFromSourceId: "source-active",
          metadata: {
            durationMs: 6000,
            startOffsetMs,
          },
        },
      ],
    },
    workbench: {
      activeModuleId: "media-analysis",
      availableModuleIds: ["media-analysis"],
      selectedModuleIds: ["media-analysis"],
    },
    sourceProbeStatus: "completed",
    profileModels: [],
    reports: {
      user: null,
      ai: null,
      emptyReason: "Rapor henüz üretilmedi.",
    },
    activityFeed: [],
  };
}

test("laboratory process output parser translates known ffmpeg and download lines", () => {
  const blackdetectEvent = parseProcessOutput("blackdetect=duration:0.42");
  const frameEvent = parseProcessOutput("frame= 248 fps=24");
  const downloadEvent = parseProcessOutput("[download] 42.1% of 12.31MiB");
  const subtitleEvent = parseProcessOutput("subtitle stream has 12 entries");
  const mergeEvent = parseProcessOutput('Merging formats into "clip.mp4"');

  assert.equal(blackdetectEvent?.message, "Siyah sahne tespiti calisiyor");
  assert.equal(blackdetectEvent?.moduleId, "motion");
  assert.equal(frameEvent?.detail, "248 kare incelendi");
  assert.equal(downloadEvent?.message, "Kaynak indiriliyor");
  assert.equal(downloadEvent?.scope, "global");
  assert.equal(subtitleEvent?.message, "Altyazi girdisi taraniyor");
  assert.equal(mergeEvent?.message, "Kaynak birlestiriliyor");
});

test("laboratory process output parser leaves unknown lines in raw-log only flow", () => {
  const unknownEvent = parseProcessOutput("totally unknown tool output");
  assert.equal(unknownEvent, null);
});

test("laboratory finding engine derives findings from semantic events and stays quiet on thin runs", () => {
  const anomalyFindings = extractFindings([
    {
      id: "evt-1",
      kind: "activity",
      severity: "info",
      message: "Siyah sahne segmenti bulundu",
      detail: "black_start:12.5",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "stdout",
      scope: "run",
      moduleId: "motion",
      rawLine: "black_start:12.5",
    },
    {
      id: "evt-2",
      kind: "activity",
      severity: "info",
      message: "Freeze segmenti bulundu",
      detail: "freeze_duration:1.2",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "stdout",
      scope: "run",
      moduleId: "motion",
      rawLine: "freeze_duration:1.2",
    },
  ]);

  assert.equal(anomalyFindings.length >= 2, true);
  assert.equal(
    anomalyFindings.some((entry) => entry.title.includes("Siyah sahne")),
    true
  );
  assert.equal(
    anomalyFindings.some((entry) => entry.title.includes("Freeze")),
    true
  );

  const noAnomalyFindings = extractFindings([
    {
      id: "evt-coverage",
      kind: "activity",
      severity: "info",
      message: "Kare analizi aktif",
      detail: "248 kare incelendi",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "stdout",
      scope: "run",
      moduleId: "motion",
      rawLine: "frame=248",
    },
    {
      id: "evt-3",
      kind: "activity",
      severity: "success",
      message: "Analiz tamamlandi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  ]);

  assert.equal(noAnomalyFindings.length, 1);
  assert.equal(noAnomalyFindings[0]?.title, "Belirgin anomali tespit edilmedi");

  const thinRunFindings = extractFindings([
    {
      id: "evt-4",
      kind: "activity",
      severity: "success",
      message: "Analiz tamamlandi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  ]);

  assert.equal(thinRunFindings.length, 0);
});

test("laboratory bridge forwards only canonical lab events into the store", () => {
  const emitted: string[] = [];
  const bridge = createLabHostBridge({
    emit(event) {
      emitted.push(event.type);
    },
  });

  bridge.handleHostMessage({
    type: "media-job",
    payload: {
      action: "process-run",
      stage: "queued",
      toolId: "ffmpeg",
      featureStage: "process",
    },
  });

  bridge.handleHostMessage({
    type: "lab-event",
    payload: {
      id: "evt-run-1",
      kind: "activity",
      severity: "info",
      message: "Analiz basladi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "queued",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  assert.deepEqual(emitted, ["host-event-received"]);
});

test("laboratory store derives run state from canonical events without inventing modules", () => {
  const store = createLabStore();
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-run",
      kind: "activity",
      severity: "info",
      message: "Analiz basladi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  const state = store.getState();
  assert.equal(state.run?.state, "running");
  assert.deepEqual(state.run?.moduleOrder, []);
});

test("laboratory store keeps export user actions separate from analysis run state", () => {
  const store = createLabStore();

  store.dispatch({
    type: "user-action-added",
    actionEvent: {
      id: "user-action-1",
      type: "export-clip",
      label: "Klip çıkarılıyor",
      status: "running",
      startedAt: Date.now() - 1000,
      projectId: "project-1",
      requestId: "req-export-1",
      sourceAction: "export-timeline-clip",
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-export",
      kind: "activity",
      severity: "success",
      message: "Klip çıkarılıyor tamamlandı",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "export-timeline-clip",
      stage: "completed",
      scope: "global",
      moduleId: null,
      rawLine: null,
      requestId: "req-export-1",
      jobId: "job-export-1",
      projectId: "project-1",
      resultAssetIds: ["asset-clip-export-1"],
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-run",
      kind: "activity",
      severity: "info",
      message: "Analiz basladi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  const state = store.getState();
  assert.equal(state.userActions[0]?.status, "success");
  assert.equal(state.userActions[0]?.message, "Klip hazır");
  assert.deepEqual(state.userActions[0]?.resultAssetIds, ["asset-clip-export-1"]);
  assert.equal(state.run?.state, "running");
  assert.equal(state.run?.events.length, 1);
  assert.equal(state.run?.events[0]?.action, "process-run");
});

test("laboratory store hydrates project assets and selectors keep registry lookups scoped", () => {
  const store = createLabStore();

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-asset-1",
      projects: [],
      activeProject: {
        id: "project-asset-1",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          storedPath: "/tmp/source.mp4",
          drafts: {},
        },
        edit: {},
        profile: {},
        process: {
          records: {},
        },
        report: {
          records: {},
        },
        assets: [
          {
            id: "asset-source-1",
            type: "source",
            name: "source.mp4",
            localPath: "/tmp/source.mp4",
            createdAt: 100,
            sourceId: "source-1",
          },
          {
            id: "asset-clip-1",
            type: "clip",
            name: "clip_01.mp4",
            localPath: "/tmp/clip_01.mp4",
            createdAt: 200,
            sourceId: "source-1",
            runId: "run-1",
          },
          {
            id: "asset-frame-1",
            type: "frame",
            name: "frame_001.png",
            localPath: "/tmp/frame_001.png",
            createdAt: 300,
            sourceId: "source-1",
            runId: "run-2",
          },
        ],
      },
    },
  });

  const state = store.getState();
  const assets = getAssets(state);
  assert.equal(assets.length, 3);
  assets.pop();
  assert.equal(getAssets(store.getState()).length, 3);
  assert.deepEqual(
    getAssetsByType(state, "clip").map((asset) => asset.id),
    ["asset-clip-1"]
  );
  assert.deepEqual(
    getAssetsBySource(state, "source-1").map((asset) => asset.id),
    ["asset-source-1", "asset-clip-1", "asset-frame-1"]
  );
  assert.deepEqual(
    getAssetsByRun(state, "run-1").map((asset) => asset.id),
    ["asset-clip-1"]
  );

  store.dispatch({
    type: "asset-updated",
    id: "asset-clip-1",
    patch: {
      name: "clip_renamed.mp4",
    },
  });
  assert.equal(getAssetsByType(store.getState(), "clip")[0]?.name, "clip_renamed.mp4");

  store.dispatch({ type: "asset-removed", id: "asset-frame-1" });
  assert.deepEqual(
    getAssets(store.getState()).map((asset) => asset.id),
    ["asset-source-1", "asset-clip-1"]
  );
  assert.equal(getAssetById(store.getState(), "asset-clip-1")?.name, "clip_renamed.mp4");
  assert.equal(getAssetById(store.getState(), "asset-missing"), null);
});

test("laboratory action output selector resolves linked assets and ignores stale ids", () => {
  const store = createLabStore();

  store.dispatch({
    type: "asset-added",
    asset: {
      id: "asset-frame-result",
      type: "frame",
      name: "frame_01.png",
      localPath: "/tmp/frame_01.png",
      createdAt: 200,
    },
  });
  store.dispatch({
    type: "asset-added",
    asset: {
      id: "asset-report-result",
      type: "report",
      name: "report.md",
      localPath: "/tmp/report.md",
      createdAt: 300,
    },
  });
  store.dispatch({
    type: "user-action-added",
    actionEvent: {
      id: "user-action-result",
      type: "grab-frame",
      label: "Frame alınıyor",
      status: "success",
      startedAt: Date.now() - 1000,
      finishedAt: Date.now(),
      message: "Frame alındı",
      requestId: "req-frame-result",
      projectId: null,
      resultAssetIds: ["asset-frame-result", "asset-missing", "asset-report-result"],
      sourceAction: "export-frame-grab",
    },
  });

  assert.deepEqual(
    getActionOutputs(store.getState(), "user-action-result").map((asset) => asset.id),
    ["asset-frame-result", "asset-report-result"]
  );
  assert.deepEqual(getActionOutputs(store.getState(), "user-action-missing"), []);
});

test("laboratory lineage selectors resolve current source, linked audio, and parent assets", () => {
  const store = createLabStore();

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-lineage",
      projects: [],
      activeProject: {
        id: "project-lineage",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          storedPath: "/tmp/source-active.mp4",
          storedFileName: "source-active.mp4",
          drafts: {},
        },
        edit: {},
        profile: {},
        process: {
          records: {},
        },
        report: {
          records: {},
        },
        assets: [
          {
            id: "source-old",
            type: "source",
            name: "source-old.mp4",
            localPath: "/tmp/source-old.mp4",
            createdAt: 100,
            sourceId: "source-old",
          },
          {
            id: "source-active",
            type: "source",
            name: "source-active.mp4",
            localPath: "/tmp/source-active.mp4",
            createdAt: 200,
            sourceId: "source-active",
            metadata: {
              storedFileName: "source-active.mp4",
            },
          },
          {
            id: "asset-audio-linked",
            type: "audio",
            name: "audio.wav",
            localPath: "/tmp/audio.wav",
            createdAt: 300,
            sourceId: "source-active",
            derivedFromAssetId: "source-active",
            derivedFromSourceId: "source-active",
            metadata: {
              durationMs: 1400,
              startOffsetMs: 0,
            },
          },
          {
            id: "asset-audio-stale",
            type: "audio",
            name: "stale.wav",
            localPath: "/tmp/stale.wav",
            createdAt: 400,
            sourceId: "source-active",
            derivedFromAssetId: "asset-missing",
            derivedFromSourceId: "source-missing",
          },
        ],
      },
    },
  });

  const state = store.getState();
  assert.equal(getCurrentSourceAsset(state)?.id, "source-active");
  assert.deepEqual(
    getLinkedAudioAssets(state, "source-active").map((asset) => asset.id),
    ["asset-audio-linked"]
  );
  assert.equal(getParentSourceForAsset(state, "asset-audio-linked")?.id, "source-active");
  assert.equal(getParentSourceForAsset(state, "asset-audio-stale"), null);
  assert.equal(isDualPreviewAvailable(state), true);
  assert.equal(isDualPreviewActive(state), false);
  assert.equal(getSelectedDualPreviewAudioAsset(state)?.id, "asset-audio-linked");
  assert.equal(getDualPreviewVolume(state), 1);

  store.dispatch({
    type: "asset-updated",
    id: "asset-audio-linked",
    patch: {
      name: "audio-linked.wav",
    },
  });
  assert.equal(
    getAssetById(store.getState(), "asset-audio-linked")?.derivedFromAssetId,
    "source-active"
  );
  assert.equal(
    getAssetById(store.getState(), "asset-audio-linked")?.derivedFromSourceId,
    "source-active"
  );
});

test("laboratory workspace dual preview state heals across source churn and stale selections", () => {
  const store = createLabStore();

  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(),
  });
  store.dispatch({
    type: "workspace-dual-preview-toggled",
    force: true,
    audioAssetId: "asset-missing",
  });

  assert.equal(isDualPreviewActive(store.getState()), true);
  assert.equal(getSelectedDualPreviewAudioAsset(store.getState())?.id, "asset-audio-linked");

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "image",
      status: "idle",
      storedPath: null,
      previewUrl: null,
    },
  });

  assert.equal(isDualPreviewAvailable(store.getState()), false);
  assert.equal(isDualPreviewActive(store.getState()), false);
  assert.equal(getSelectedDualPreviewAudioAsset(store.getState()), null);
});

test("laboratory hydrate restores dual preview workspace fields with valid linked audio fallback", () => {
  const store = createLabStore();

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-dual-preview",
        projects: [{ id: "project-dual-preview", name: "lab-demo.mp4", hasSource: true }],
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
      source: {
        status: "ready",
        kind: "video",
        mode: "local",
        previewUrl: "file:///tmp/lab-demo.mp4",
        storedFileName: "lab-demo.mp4",
        storedPath: "/tmp/lab-demo.mp4",
        routeLabel: "Local Copy",
      },
      sourceProbeStatus: "completed",
      assets: [
        {
          id: "source-active",
          type: "source",
          name: "lab-demo.mp4",
          localPath: "/tmp/lab-demo.mp4",
          createdAt: 100,
          sourceId: "source-active",
          metadata: {
            storedFileName: "lab-demo.mp4",
          },
        },
        {
          id: "asset-audio-linked",
          type: "audio",
          name: "audio.wav",
          localPath: "/tmp/audio.wav",
          createdAt: 200,
          sourceId: "source-active",
          derivedFromAssetId: "source-active",
          derivedFromSourceId: "source-active",
          metadata: {
            durationMs: 6000,
            startOffsetMs: 0,
          },
        },
      ],
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      workspace: {
        dualPreviewEnabled: true,
        dualPreviewAudioAssetId: "asset-missing",
        dualPreviewVolume: 0.35,
      },
    },
  });

  assert.equal(isDualPreviewActive(store.getState()), true);
  assert.equal(getSelectedDualPreviewAudioAsset(store.getState())?.id, "asset-audio-linked");
  assert.equal(getDualPreviewVolume(store.getState()), 0.35);
});

test("laboratory hydrate reconstructs an active selection from a valid persisted primitive range", () => {
  const store = createLabStore();

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: null,
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      workspace: {
        timelineStartMs: 2400,
        timelineEndMs: 5600,
        activeSelection: {
          id: "selection-persisted",
          startMs: 2400,
          endMs: 5600,
          type: "focus",
          label: "Door latch",
          roi: {
            x: 10,
            y: 20,
            width: 80,
            height: 60,
          },
          createdAt: 1700000000000,
        },
      },
    },
  });

  assert.deepEqual(store.getState().ui.workspace.activeSelection, {
    id: "selection-persisted",
    startMs: 2400,
    endMs: 5600,
    type: "focus",
    label: "Door latch",
    roi: {
      x: 10,
      y: 20,
      width: 80,
      height: 60,
    },
    createdAt: 1700000000000,
  });
});

test("laboratory hydrate rebuilds selection identity from the primitive bridge on rehydrate", () => {
  const store = createLabStore();
  const originalDateNow = Date.now;

  try {
    Date.now = () => 1700000000000;
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });

    const initialSelection = store.getState().ui.workspace.activeSelection;
    assert.ok(initialSelection);

    Date.now = () => 1700000005000;
    store.dispatch({
      type: "hydrate",
      payload: {
        currentStage: "source",
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: null,
          projects: [],
        },
        workbench: {},
        sourceProbeStatus: "idle",
        reports: {
          user: null,
          ai: null,
          emptyReason: "Rapor henüz üretilmedi.",
        },
        activityFeed: [],
        workspace: {
          timelineStartMs: 2400,
          timelineEndMs: 5600,
        },
      },
    });

    const rehydratedSelection = store.getState().ui.workspace.activeSelection;
    assert.ok(rehydratedSelection);
    assert.equal(rehydratedSelection?.startMs, 2400);
    assert.equal(rehydratedSelection?.endMs, 5600);
    assert.equal(rehydratedSelection?.type, "clip");
    assert.notEqual(rehydratedSelection?.id, initialSelection?.id);
    assert.equal(rehydratedSelection?.createdAt, 1700000005000);
  } finally {
    Date.now = originalDateNow;
  }
});

test("laboratory hydrate suppresses persisted selection entities when the primitive range is invalid", () => {
  const store = createLabStore();

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: null,
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      workspace: {
        timelineStartMs: 5600,
        timelineEndMs: 2400,
        activeSelection: {
          id: "selection-invalid",
          startMs: 5600,
          endMs: 2400,
          type: "inspect",
          createdAt: 1700000000001,
        },
      },
    },
  });

  assert.equal(store.getState().ui.workspace.timelineStartMs, 5600);
  assert.equal(store.getState().ui.workspace.timelineEndMs, null);
  assert.equal(store.getState().ui.workspace.activeSelection, null);
});

test("laboratory intent output selectors map expected outputs and filter actual assets", () => {
  const store = createLabStore();

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-output-trace",
      projects: [],
      activeProject: {
        id: "project-output-trace",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          storedPath: "/tmp/source.mp4",
          drafts: {},
        },
        edit: {},
        profile: {},
        process: {
          records: {},
        },
        report: {
          records: {},
        },
        assets: [
          {
            id: "asset-source-tagged",
            type: "source",
            name: "source.mp4",
            localPath: "/tmp/source.mp4",
            createdAt: 100,
            intentIds: ["visual-inspection"],
          },
          {
            id: "asset-frame-visual",
            type: "frame",
            name: "frame_01.png",
            localPath: "/tmp/frame_01.png",
            createdAt: 200,
            intentIds: ["visual-inspection"],
          },
          {
            id: "asset-audio",
            type: "audio",
            name: "audio.wav",
            localPath: "/tmp/audio.wav",
            createdAt: 300,
            intentIds: ["audio-investigation"],
          },
          {
            id: "asset-unscoped",
            type: "artifact",
            name: "unscoped.json",
            localPath: "/tmp/unscoped.json",
            createdAt: 400,
          },
        ],
      },
    },
  });

  const visualExpected = getExpectedOutputs("visual-inspection");
  const audioExpected = getExpectedOutputs("audio-investigation");
  const visualActual = getActualOutputs(store.getState(), "visual-inspection");

  assert.deepEqual(
    visualExpected.map((entry) => entry.label),
    ["Frame çıktıları", "Anomali verileri"]
  );
  assert.deepEqual(audioExpected, [
    {
      intentId: "audio-investigation",
      label: "Ses çıktısı",
      assetTypes: ["audio"],
    },
  ]);
  assert.deepEqual(getExpectedOutputs("detail-enhancement"), []);
  assert.deepEqual(
    visualActual.map((asset) => asset.id),
    ["asset-source-tagged", "asset-frame-visual"]
  );
  assert.equal(isExpectedOutputMatched(visualExpected[0]!, visualActual), true);
  assert.equal(isExpectedOutputMatched(visualExpected[1]!, visualActual), false);
  assert.deepEqual(
    getActualOutputs(store.getState(), "audio-investigation").map((asset) => asset.id),
    ["asset-audio"]
  );
});

test("laboratory run controller dismisses successful user actions from the topbar after the success window", () => {
  const timerMock = installTimerMock();

  try {
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });
    createLabRunController({
      documentRef: {} as Document,
      eventBus,
      store,
      windowRef: {} as Window,
    });

    eventBus.emit({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-success",
        type: "export-clip",
        label: "Klip çıkarılıyor",
        status: "running",
        startedAt: Date.now() - 1000,
        dismissedFromHubAt: null,
        projectId: "project-1",
        requestId: "req-export-1",
        sourceAction: "export-timeline-clip",
      },
    });

    assert.equal(timerMock.scheduled.length, 0);

    eventBus.emit({
      type: "user-action-updated",
      id: "user-action-success",
      patch: {
        status: "success",
        finishedAt: Date.now(),
        message: "Klip hazır",
      },
    });

    assert.equal(timerMock.scheduled.length, 1);
    assert.equal(timerMock.scheduled[0]?.delay, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS);
    assert.equal(store.getState().userActions[0]?.dismissedFromHubAt, null);

    timerMock.scheduled[0]?.fn();

    assert.equal(typeof store.getState().userActions[0]?.dismissedFromHubAt, "number");
  } finally {
    timerMock.restore();
  }
});

test("laboratory run controller waits for linked assets before dismissing success chips", () => {
  const timerMock = installTimerMock();

  try {
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });
    createLabRunController({
      documentRef: {} as Document,
      eventBus,
      store,
      windowRef: {} as Window,
    });

    eventBus.emit({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-success-pending-output",
        type: "grab-frame",
        label: "Frame alınıyor",
        status: "success",
        startedAt: Date.now() - 3000,
        finishedAt: Date.now() - 1000,
        message: "Frame alındı",
        requestId: "req-frame-success",
        resultAssetIds: ["asset-frame-result"],
        sourceAction: "export-frame-grab",
      },
    });

    assert.equal(timerMock.scheduled.length, 0);

    eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-frame-result",
        type: "frame",
        name: "frame_01.png",
        localPath: "/tmp/frame_01.png",
        createdAt: Date.now(),
      },
    });

    assert.equal(timerMock.scheduled.length, 1);
    assert.equal(timerMock.scheduled[0]?.delay, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS);
  } finally {
    timerMock.restore();
  }
});

test("laboratory run controller threads frozen run intent ids into tracked export actions", () => {
  const originalElement = globalThis.Element;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
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
          sendEvent(eventName: string, payload: Record<string, unknown>) {
            sentEvents.push({ eventName, payload });
          },
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const state = store.getState() as ReturnType<typeof store.getState> & {
      run: Record<string, unknown>;
    };
    state.run = {
      id: "run-controller-intents",
      state: "running",
      startedAt: Date.now() - 1000,
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
      progress: 10,
      emptyReason: null,
      analysisScope: {
        focus: "visual",
        intentIds: ["visual-inspection"],
      },
      previewArtifacts: [],
      confidence: null,
      moduleTrace: [],
      comparisonVariants: [],
      hypothesisSummary: null,
    };
    state.ui.workspace.roiRegions = [
      {
        id: "face",
        label: "Face",
        x: 8,
        y: 12,
        width: 120,
        height: 80,
      },
    ];
    state.ui.workspace.timelineStartMs = 1200;
    state.ui.workspace.timelineEndMs = 2400;

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("workspace-roi-export", "face") } as Event);
    clickListener?.({ target: new TestElement("timeline-export-clip") } as Event);
    clickListener?.({ target: new TestElement("timeline-grab-frame") } as Event);
    clickListener?.({ target: new TestElement("timeline-extract-audio") } as Event);

    const mediaActions = sentEvents.filter(function (entry) {
      return entry.eventName === "media-action";
    });
    assert.equal(mediaActions.length, 4);
    assert.deepEqual(
      mediaActions.map(function (entry) {
        return (entry.payload["action"] as string) || null;
      }),
      ["export-roi-image", "export-timeline-clip", "export-frame-grab", "export-audio-track"]
    );
    mediaActions.forEach(function (entry) {
      const payload = entry.payload["payload"] as Record<string, unknown>;
      assert.deepEqual(payload["intentIds"], ["visual-inspection"]);
    });
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

test("laboratory run controller previews action-linked output assets through asset-preview clicks", () => {
  const originalElement = globalThis.Element;
  const openedUrls: string[] = [];
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

    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-frame-result",
        type: "frame",
        name: "frame_01.png",
        localPath: "/tmp/frame_01.png",
        createdAt: Date.now(),
      },
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        open(url: string) {
          openedUrls.push(url);
          return null;
        },
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("asset-preview", "asset-frame-result") } as Event);

    assert.deepEqual(openedUrls, ["/tmp/frame_01.png"]);
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

test("laboratory run controller focuses the source preview through explicit source-preview actions", () => {
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
          ? (listener as (event: Event) => void)
          : (event: Event) => listener.handleEvent(event)
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

    clickListener?.({ target: new TestElement("focus-source-preview", "source-active") } as Event);

    assert.deepEqual(previewCalls, ["scroll", "focus"]);
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

test("laboratory run controller syncs the unified timeline playhead to the active preview media", async () => {
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

  assert.equal(playhead.style.left, "25%");
  assert.equal(playhead.attributes.get("data-active"), "true");
  assert.equal(playheadLabel.textContent, "00:01.250");

  preview.currentTime = 2.5;
  preview.dispatch("timeupdate");

  assert.equal(playhead.style.left, "50%");
  assert.equal(playheadLabel.textContent, "00:02.500");
});

test("laboratory run controller rebinds the unified timeline playhead between single preview and dual preview master", async () => {
  const singlePreview = new FakeMediaElement();
  singlePreview.duration = 6;
  singlePreview.currentTime = 1;
  const master = new FakeMediaElement();
  master.duration = 6;
  master.currentTime = 2;
  const slave = new FakeMediaElement();
  slave.duration = 8;
  const playhead = new FakePlayheadElement();
  const playheadLabel = new FakeTextElement(null);
  const timelineRoot = { dataset: { duration: "6000" } };
  const queryMap = new Map<string, unknown>([
    ['video[data-lab-preserve-media="workspace-preview"]', singlePreview],
    ['[data-lab-role="dual-preview-master"]', master],
    ['[data-lab-role="dual-preview-slave"]', slave],
    ['[data-lab-role="timeline-playhead"]', playhead],
    ['[data-lab-role="timeline-playhead-label"]', playheadLabel],
    [".labx-timeline", timelineRoot],
  ]);
  const documentRef = new FakeDualPreviewDocument(queryMap, [singlePreview, master, slave]);
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

  assert.equal(playhead.style.left, "16.666666666666664%");
  assert.equal(playheadLabel.textContent, "00:01.000");

  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(),
  });
  store.dispatch({
    type: "workspace-dual-preview-toggled",
    force: true,
    audioAssetId: "asset-audio-linked",
  });
  await Promise.resolve();

  assert.equal(playhead.style.left, "33.33333333333333%");
  assert.equal(playheadLabel.textContent, "00:02.000");

  singlePreview.currentTime = 4;
  singlePreview.dispatch("timeupdate");
  assert.equal(playhead.style.left, "33.33333333333333%");

  master.currentTime = 3;
  master.dispatch("timeupdate");
  assert.equal(playhead.style.left, "50%");
  assert.equal(playheadLabel.textContent, "00:03.000");

  store.dispatch({
    type: "workspace-dual-preview-toggled",
    force: false,
  });
  await Promise.resolve();

  singlePreview.dispatch("timeupdate");
  assert.equal(playhead.style.left, "66.66666666666666%");
  assert.equal(playheadLabel.textContent, "00:04.000");
});

test("laboratory run controller keeps click-to-seek and drag-to-select separated by the rail threshold", () => {
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

    mouseDownListener?.(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 350) as unknown as Event
    );
    mouseMoveListener?.(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 352) as unknown as Event
    );
    mouseUpListener?.({} as Event);

    assert.equal(preview.currentTime, 2.5);
    assert.equal(store.getState().ui.workspace.timelineStartMs, null);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);

    mouseDownListener?.(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 350) as unknown as Event
    );
    mouseMoveListener?.(
      new FakeMouseEvent(railTarget as unknown as EventTarget, 550) as unknown as Event
    );
    mouseUpListener?.({} as Event);

    assert.equal(preview.currentTime, 2.5);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 2500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 4500);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (originalMouseEvent === undefined) {
      delete (globalThis as Record<string, unknown>).MouseEvent;
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

test("laboratory run controller drags timeline start and end handles independently", () => {
  const originalElement = globalThis.Element;
  const originalMouseEvent = globalThis.MouseEvent;
  const documentRef = new FakeControllerDocument();
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
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });

    const mouseDownListener = documentRef.listeners.get("mousedown");
    const mouseMoveListener = windowRef.listeners.get("mousemove");
    const mouseUpListener = windowRef.listeners.get("mouseup");
    assert.ok(mouseDownListener);
    assert.ok(mouseMoveListener);
    assert.ok(mouseUpListener);

    mouseDownListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-drag-start", timeline) as unknown as EventTarget,
        200
      ) as unknown as Event
    );
    mouseMoveListener?.({ clientX: 150 } as MouseEvent);
    mouseUpListener?.({} as Event);

    assert.equal(store.getState().ui.workspace.timelineStartMs, 500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 3000);

    mouseDownListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-drag-end", timeline) as unknown as EventTarget,
        400
      ) as unknown as Event
    );
    mouseMoveListener?.({ clientX: 650 } as MouseEvent);
    mouseUpListener?.({} as Event);

    assert.equal(store.getState().ui.workspace.timelineStartMs, 500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 5500);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (originalMouseEvent === undefined) {
      delete (globalThis as Record<string, unknown>).MouseEvent;
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

test("laboratory run controller drags the timeline selection body from the pointer-down offset", () => {
  const originalElement = globalThis.Element;
  const originalMouseEvent = globalThis.MouseEvent;
  const documentRef = new FakeControllerDocument();
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
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });

    const mouseDownListener = documentRef.listeners.get("mousedown");
    const mouseMoveListener = windowRef.listeners.get("mousemove");
    const mouseUpListener = windowRef.listeners.get("mouseup");
    assert.ok(mouseDownListener);
    assert.ok(mouseMoveListener);
    assert.ok(mouseUpListener);

    const actionTarget = new FakeTimelineActionElement("timeline-drag-body", timeline);

    mouseDownListener?.(
      new FakeMouseEvent(actionTarget as unknown as EventTarget, 250) as unknown as Event
    );
    mouseMoveListener?.(
      new FakeMouseEvent(actionTarget as unknown as EventTarget, 650) as unknown as Event
    );

    assert.equal(store.getState().ui.workspace.timelineStartMs, 5000);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 7000);

    mouseUpListener?.({} as Event);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
    if (originalMouseEvent === undefined) {
      delete (globalThis as Record<string, unknown>).MouseEvent;
    } else {
      Object.defineProperty(globalThis, "MouseEvent", {
        configurable: true,
        value: originalMouseEvent,
      });
    }
  }
});

test("laboratory run controller applies timeline finetune and clear actions from the unified timeline", () => {
  const originalElement = globalThis.Element;
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();
  const timeline = new FakeTimelineRoot(new FakeTimelineTrack(100, 1000), 10000);

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeTimelineActionElement,
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

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-finetune", timeline, "start:+100") as unknown as EventTarget,
        0
      ) as unknown as Event
    );
    clickListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-finetune", timeline, "end:-500") as unknown as EventTarget,
        0
      ) as unknown as Event
    );

    assert.equal(store.getState().ui.workspace.timelineStartMs, 1100);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 2500);

    clickListener?.(
      new FakeMouseEvent(
        new FakeTimelineActionElement("timeline-clear", timeline) as unknown as EventTarget,
        0
      ) as unknown as Event
    );

    assert.equal(store.getState().ui.workspace.timelineStartMs, null);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
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

test("laboratory store promotes timeline ranges into stable selection entities", () => {
  const store = createLabStore();

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });

  const firstSelection = store.getState().ui.workspace.activeSelection;
  assert.ok(firstSelection);
  assert.equal(firstSelection?.type, "clip");
  assert.equal(firstSelection?.startMs, 1000);
  assert.equal(firstSelection?.endMs, 3000);
  assert.ok(typeof firstSelection?.id === "string" && firstSelection.id.length > 0);
  assert.equal(getActiveSelection(store.getState())?.id, firstSelection?.id);
  assert.equal(isSelectionValid(store.getState()), true);
  assert.equal(getSelectionDuration(store.getState()), 2000);

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1200,
    endMs: 3400,
  });

  const evolvedSelection = store.getState().ui.workspace.activeSelection;
  assert.ok(evolvedSelection);
  assert.equal(evolvedSelection?.id, firstSelection?.id);
  assert.equal(evolvedSelection?.createdAt, firstSelection?.createdAt);
  assert.equal(evolvedSelection?.startMs, 1200);
  assert.equal(evolvedSelection?.endMs, 3400);

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1200,
    endMs: 1100,
  });

  assert.equal(store.getState().ui.workspace.activeSelection, null);
  assert.equal(isSelectionValid(store.getState()), false);
  assert.equal(getSelectionDuration(store.getState()), 0);
});

test("laboratory store resets semantic and primitive selection state on source changes", () => {
  const store = createLabStore();

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1500,
    endMs: 3600,
  });

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      storedPath: "/tmp/new-source.mp4",
    },
  });

  assert.equal(store.getState().ui.workspace.timelineStartMs, null);
  assert.equal(store.getState().ui.workspace.timelineEndMs, null);
  assert.equal(store.getState().ui.workspace.activeSelection, null);
});

test("laboratory store clears semantic and primitive selection state when the active project changes", () => {
  const store = createLabStore();

  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1800,
    endMs: 4200,
  });

  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(0),
  });

  assert.equal(store.getState().ui.workspace.timelineStartMs, null);
  assert.equal(store.getState().ui.workspace.timelineEndMs, null);
  assert.equal(store.getState().ui.workspace.activeSelection, null);
});

test("laboratory run controller accepts numeric timeline input edits and normalizes invalid ranges", () => {
  const originalInput = Object.getOwnPropertyDescriptor(globalThis, "HTMLInputElement");
  const originalSelect = Object.getOwnPropertyDescriptor(globalThis, "HTMLSelectElement");
  const originalTextArea = Object.getOwnPropertyDescriptor(globalThis, "HTMLTextAreaElement");
  const documentRef = new FakeControllerDocument();
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
    inputListener?.({ target: startInput } as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, 3000);

    const invalidEndInput = new FakeHtmlInputElement("workspace.timelineEndMs", "1400");
    invalidEndInput.type = "number";
    inputListener?.({ target: invalidEndInput } as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);

    const endInput = new FakeHtmlInputElement("workspace.timelineEndMs", "");
    endInput.type = "number";
    inputListener?.({ target: endInput } as Event);
    assert.equal(store.getState().ui.workspace.timelineStartMs, 1500);
    assert.equal(store.getState().ui.workspace.timelineEndMs, null);
  } finally {
    if (originalInput) {
      Object.defineProperty(globalThis, "HTMLInputElement", originalInput);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLInputElement;
    }
    if (originalSelect) {
      Object.defineProperty(globalThis, "HTMLSelectElement", originalSelect);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLSelectElement;
    }
    if (originalTextArea) {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", originalTextArea);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLTextAreaElement;
    }
  }
});

test("laboratory run controller keeps invalid scope time ranges out of the analysis draft", () => {
  const originalInput = Object.getOwnPropertyDescriptor(globalThis, "HTMLInputElement");
  const originalSelect = Object.getOwnPropertyDescriptor(globalThis, "HTMLSelectElement");
  const originalTextArea = Object.getOwnPropertyDescriptor(globalThis, "HTMLTextAreaElement");
  const documentRef = new FakeControllerDocument();
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

    const inputListener = documentRef.listeners.get("input");
    assert.ok(inputListener);

    const scopeStart = new FakeHtmlInputElement("scope.timeStartMs", "2500");
    scopeStart.type = "number";
    inputListener?.({ target: scopeStart } as Event);

    const scopeEnd = new FakeHtmlInputElement("scope.timeEndMs", "2000");
    scopeEnd.type = "number";
    inputListener?.({ target: scopeEnd } as Event);

    const analysisScope = (store.getState().workbench["analysisScope"] || {}) as Record<
      string,
      unknown
    >;
    assert.equal((analysisScope["timeRange"] as Record<string, unknown> | undefined) ?? null, null);
  } finally {
    if (originalInput) {
      Object.defineProperty(globalThis, "HTMLInputElement", originalInput);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLInputElement;
    }
    if (originalSelect) {
      Object.defineProperty(globalThis, "HTMLSelectElement", originalSelect);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLSelectElement;
    }
    if (originalTextArea) {
      Object.defineProperty(globalThis, "HTMLTextAreaElement", originalTextArea);
    } else {
      delete (globalThis as Record<string, unknown>).HTMLTextAreaElement;
    }
  }
});

test("laboratory run controller keeps dual preview media in sync and timeline seeks honor audio offset", async () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  const progress = new FakeRangeElement("0", "6000");
  const volume = new FakeRangeElement("1", "1");
  const playLabel = new FakeTextElement("▶");
  const timeLabel = new FakeTextElement("00:00 / 00:06");
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
      ['[data-lab-role="dual-preview-progress"]', progress],
      ['[data-lab-role="dual-preview-volume"]', volume],
      ['[data-lab-role="dual-preview-play-label"]', playLabel],
      ['[data-lab-role="dual-preview-time"]', timeLabel],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    master.duration = 6;
    slave.duration = 8;

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
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(250),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    await Promise.resolve();

    assert.equal(master.muted, true);
    assert.equal(slave.volume, 1);
    assert.equal(slave.currentTime, 0.25);

    master.currentTime = 1;
    await master.play();
    assert.equal(slave.playCalls > 0, true);
    assert.equal(slave.currentTime, 1.25);

    store.dispatch({
      type: "workspace-dual-preview-volume-updated",
      volume: 0.4,
    });
    assert.equal(slave.volume, 0.4);

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener?.({ target: new TestElement("timeline-seek", "2000") } as Event);

    assert.equal(master.currentTime, 2);
    assert.equal(slave.currentTime, 2.25);
    assert.equal(progress.value, "2000");
    assert.match(timeLabel.textContent || "", /00:02 \/ 00:06/);

    master.pause();
    assert.equal(slave.pauseCalls > 0, true);
    assert.equal(playLabel.textContent, "▶");
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

test("laboratory run controller fences legacy timeline seek fallback while dual preview is active", () => {
  const originalElement = globalThis.Element;
  const standaloneMedia = new FakeMediaElement();
  const documentRef = new FakeDualPreviewDocument(new Map<string, unknown>(), [standaloneMedia]);
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

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("timeline-seek", "2000") } as Event);

    assert.equal(standaloneMedia.currentTime, 0);
    assert.equal(
      store.getState().activityFeed.some((entry) =>
        entry.message.includes("Dual preview seek is unavailable")
      ),
      true
    );
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

test("laboratory run controller waits for slave metadata before applying dual preview seeks", async () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  slave.readyState = 0;
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    master.duration = 6;
    slave.duration = 8;

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
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(500),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    master.currentTime = 2;
    master.dispatch("seeked");
    assert.equal(slave.currentTime, 0);

    slave.readyState = 1;
    slave.dispatch("loadedmetadata");
    await Promise.resolve();

    assert.equal(slave.currentTime, 2.5);
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

test("laboratory run controller pauses the master if the dual preview slave ends early", () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeActionElement,
  });

  try {
    master.duration = 6;
    slave.duration = 3;

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
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    master.paused = false;
    slave.dispatch("ended");

    assert.equal(master.pauseCalls > 0, true);
    assert.equal(master.paused, true);
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

test("laboratory run controller does not spam slave autoplay retries after a blocked attempt", async () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  slave.failPlay = true;
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeActionElement,
  });

  try {
    master.duration = 6;
    slave.duration = 6;

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
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    await master.play();
    await Promise.resolve();
    const firstPlayCalls = slave.playCalls;

    master.dispatch("timeupdate");
    await Promise.resolve();
    assert.equal(slave.playCalls, firstPlayCalls);

    slave.failPlay = false;
    master.pause();
    await master.play();
    await Promise.resolve();
    assert.equal(slave.playCalls > firstPlayCalls, true);
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

test("laboratory store wires live findings and preview artifacts from custom runtime events", () => {
  const store = createLabStore();
  const eventTimestamp = Date.now();
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-scope",
      kind: "analysis-scope-updated",
      severity: "info",
      message: "Analysis scope locked",
      detail: "Visual ROI active",
      timestamp: eventTimestamp,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
      analysisScope: {
        focus: "visual",
        hypothesis: "gorunmeyen obje olabilir",
        region: {
          x: 12,
          y: 18,
          width: 160,
          height: 90,
        },
      },
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-live",
      kind: "live-finding",
      severity: "warning",
      message: "Live finding emitted",
      detail: "Edge cluster batched",
      timestamp: eventTimestamp + 1,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
      finding: {
        id: "finding-live-1",
        moduleId: "motion",
        title: "Edge cluster anomaly",
        detail: "Contrast window exposed a hidden contour.",
        level: "medium",
        confidence: "medium",
        kind: "derived",
        evidenceCount: 3,
        artifactIds: ["preview-live-1"],
        frameRange: {
          startFrame: 12,
          endFrame: 24,
        },
      },
      moduleTrace: {
        id: "trace-live-1",
        moduleId: "motion",
        stage: "process",
        status: "finding",
        timestamp: new Date(eventTimestamp + 1).toISOString(),
        message: "Live finding emitted",
        detail: "Edge cluster batched",
      },
      throttleWindow: "motion-module-batch",
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-preview",
      kind: "preview-artifact",
      severity: "info",
      message: "Preview artifact ready",
      detail: "Frame preview",
      timestamp: eventTimestamp + 2,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
      artifact: {
        id: "preview-live-1",
        moduleId: "motion",
        kind: "frame-preview",
        label: "Frame preview",
        path: "/tmp/frame-preview.png",
        fileName: "frame-preview.png",
        previewUrl: "file:///tmp/frame-preview.png",
        createdAt: new Date(eventTimestamp + 2).toISOString(),
        active: true,
      },
    },
  });

  const state = store.getState();
  assert.equal(state.run?.analysisScope?.focus, "visual");
  assert.equal(state.run?.analysisScope?.hypothesis, "gorunmeyen obje olabilir");
  assert.equal(state.run?.liveFindings[0]?.id, "finding-live-1");
  assert.equal(state.run?.liveFindings[0]?.windowKey, "motion-module-batch");
  assert.equal(state.run?.previewArtifacts[0]?.id, "preview-live-1");
  assert.equal(state.ui.activePreviewArtifactId, "preview-live-1");
  assert.equal(
    state.run?.moduleTrace.some(function (entry) {
      return entry.id === "trace-live-1";
    }),
    true
  );
});

test("laboratory store hydration normalizes live runs into safe persisted summaries", () => {
  const store = createLabStore();
  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "process",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor yok.",
      },
      activityFeed: [],
      lastRun: {
        id: "run-1",
        state: "running",
        startedAt: Date.now() - 1000,
        modules: {
          motion: {
            id: "motion",
            status: "running",
            progress: null,
            progressMode: "none",
            message: "Analiz suruyor",
          },
        },
        moduleOrder: ["motion"],
        events: [
          {
            id: "evt-persisted",
            kind: "activity",
            severity: "info",
            message: "Analiz basladi",
            detail: null,
            timestamp: Date.now() - 900,
            source: "host",
            action: "process-run",
            stage: "running",
            scope: "run",
            moduleId: null,
            rawLine: null,
          },
          {
            id: "evt-raw",
            kind: "raw-log",
            severity: "info",
            message: "frame= 24",
            detail: null,
            timestamp: Date.now() - 800,
            source: "host",
            action: "process-run",
            stage: "stdout",
            scope: "run",
            moduleId: "motion",
            rawLine: "frame= 24",
          },
        ],
        rawLog: [
          {
            id: "evt-raw",
            kind: "raw-log",
            severity: "info",
            message: "frame= 24",
            detail: null,
            timestamp: Date.now() - 800,
            source: "host",
            action: "process-run",
            stage: "stdout",
            scope: "run",
            moduleId: "motion",
            rawLine: "frame= 24",
          },
        ],
        artifacts: [],
        findings: [],
        liveFindings: [
          {
            id: "live-1",
            moduleId: "motion",
            title: "Scope-local anomaly",
            detail: "Frame window highlighted an unstable edge cluster.",
            level: "medium",
            severity: "warning",
            confidence: "medium",
            kind: "derived",
            evidenceCount: 2,
            artifactIds: [],
            emittedAt: Date.now() - 850,
            windowKey: "frame-window-1",
            streamId: "media-analysis",
            frameRange: {
              startFrame: 24,
              endFrame: 48,
            },
          },
        ],
        warnings: [],
        error: null,
        targetLabel: null,
        progress: null,
        emptyReason: null,
        analysisScope: {
          frameRange: {
            startFrame: 24,
            endFrame: 48,
          },
          focus: "visual",
          hypothesis: "Gorunmeyen obje olabilir",
        },
        previewArtifacts: [
          {
            id: "preview-1",
            moduleId: "motion",
            kind: "frame-preview",
            label: "Frame preview",
            path: "/tmp/frame-preview.png",
            fileName: "frame-preview.png",
            previewUrl: "file:///tmp/frame-preview.png",
            createdAt: new Date(Date.now() - 750).toISOString(),
            status: "ready",
            active: true,
            region: {
              x: 10,
              y: 20,
              width: 120,
              height: 90,
            },
          },
        ],
        confidence: "medium",
        moduleTrace: [
          {
            id: "trace-1",
            moduleId: "motion",
            stage: "process",
            status: "running",
            timestamp: new Date(Date.now() - 950).toISOString(),
            message: "Frame batch analyzed",
            detail: "Window aggregation active",
            eventId: "evt-persisted",
          },
        ],
        comparisonVariants: [
          {
            id: "variant-1",
            kind: "gamma-scan",
            label: "Gamma Scan",
            status: "ready",
            summary: "Mid-band emphasis",
            artifactIds: ["preview-1"],
          },
        ],
        hypothesisSummary: "Gorunmeyen obje olabilir",
      },
    },
  });

  const state = store.getState();
  assert.equal(state.run?.state, "cancelled");
  assert.equal(state.run?.modules["motion"]?.status, "cancelled");
  assert.equal(state.run?.events.length, 1);
  assert.equal(state.run?.events[0]?.kind, "activity");
  assert.equal(state.run?.rawLog.length, 1);
  assert.equal(state.run?.analysisScope?.focus, "visual");
  assert.equal(state.run?.analysisScope?.lifecycle?.mutable, false);
  assert.equal(state.run?.liveFindings[0]?.windowKey, "frame-window-1");
  assert.equal(state.run?.previewArtifacts[0]?.kind, "frame-preview");
  assert.equal(state.run?.comparisonVariants[0]?.kind, "gamma-scan");
  assert.equal(state.run?.hypothesisSummary, "Gorunmeyen obje olabilir");
});

test("laboratory selectors expose frozen snapshot summary and live workspace drift separately", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "report",
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
        hypothesis: "live workspace clue",
        selectedIntents: ["visual-inspection"],
      },
      reports: {
        user: {
          summary: "ready",
          confidence: "medium",
          topFindings: [],
          suspiciousFrames: [],
          hypothesisResult: "frozen clue",
          elapsedSeconds: 5,
          moduleSummary: [],
        },
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
            startMs: 1200,
            endMs: 5400,
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

  const state = store.getState();
  assert.deepEqual(getRunSnapshotSummary(state), {
    focus: "visual",
    timelineStartMs: 1200,
    timelineEndMs: 5400,
    hypothesis: "frozen clue",
    intentIds: ["visual-inspection", "anomaly-detection"],
  });
  assert.deepEqual(getIntentDirtyMap(state), {
    "visual-inspection": {
      intentId: "visual-inspection",
      inSnapshot: true,
      inWorkspace: true,
      dirty: true,
      changedKeys: ["timeline", "hypothesis"],
    },
    "anomaly-detection": {
      intentId: "anomaly-detection",
      inSnapshot: true,
      inWorkspace: false,
      dirty: true,
      changedKeys: ["selection", "timeline", "hypothesis"],
    },
  });
  assert.deepEqual(getWorkspaceDiff(state), {
    timelineChanged: true,
    hypothesisChanged: true,
    intentsChanged: true,
    workspaceDirty: true,
    changedKeys: ["timeline", "hypothesis", "intents"],
  });
  assert.deepEqual(getReportFreshness(state), {
    state: "current",
    workspaceDirty: true,
  });
  assert.deepEqual(state.run?.analysisScope?.intentIds, ["visual-inspection", "anomaly-detection"]);
  assert.deepEqual(state.ui.workspace.selectedIntents, ["visual-inspection"]);
});
