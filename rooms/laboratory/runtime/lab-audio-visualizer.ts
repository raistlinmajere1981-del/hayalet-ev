import type { LabAudioFocusSettings } from "../models/lab-types.js";
import {
  DEFAULT_AUDIO_FOCUS_SETTINGS,
  createAudioFocusSignature,
  getDefaultAudioFocusEqBand,
  normalizeAudioFocusSettings,
} from "./lab-audio-focus-normalization.js";

type AudioVisualizationMode = LabAudioFocusSettings["visualizationMode"];
type EffectiveAudioVisualizationMode = "none" | "waveform" | "spectrum";
type VisualizerWindow = Window & {
  AudioContext?: typeof AudioContext;
  cancelAnimationFrame: (handle: number) => void;
  devicePixelRatio?: number;
  getComputedStyle: (element: Element) => CSSStyleDeclaration;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  webkitAudioContext?: typeof AudioContext;
};
type VisualizerDocument = Pick<Document, "addEventListener" | "removeEventListener"> & {
  defaultView?: Window | null;
  hidden?: boolean;
};
type SharedAudioGraph = {
  analyser: AnalyserNode | null;
  audioContext: AudioContext | null;
  eqNodes: BiquadFilterNode[];
  filterBypassed: boolean | null;
  filterNode: BiquadFilterNode | null;
  frequencyData: Uint8Array<ArrayBuffer> | null;
  gainNode: GainNode | null;
  lastAppliedAudioFocusSignature: string | null;
  lastAppliedPlaybackSignature: string | null;
  sourceNode: MediaElementAudioSourceNode | null;
  sourceRoute: "analyser" | "destination" | null;
  timeDomainData: Uint8Array<ArrayBuffer> | null;
};
type AudioVisualizerOptions = {
  getAudioFocus?: () => LabAudioFocusSettings | null | undefined;
  documentRef?: Document;
  getMode?: () => AudioVisualizationMode;
  getTemporalAudioEnabled?: () => boolean;
  windowRef?: Window;
};

const AUDIO_VISUALIZER_FFT_SIZE = 2048;
const AUDIO_FOCUS_SMOOTHING_TIME = 0.01;
const MEDIA_AUDIO_GRAPH_CACHE = new WeakMap<HTMLMediaElement, SharedAudioGraph>();

function createByteBuffer(length: number) {
  return new Uint8Array(new ArrayBuffer(length));
}

function getEffectiveAudioVisualizationMode(
  mode: AudioVisualizationMode | null | undefined
): EffectiveAudioVisualizationMode {
  if (mode === "spectrum") {
    return "spectrum";
  }
  if (mode === "waveform") {
    return "waveform";
  }
  return "none";
}

function getAudioContextCtor(windowRef: VisualizerWindow) {
  return typeof windowRef.AudioContext === "function"
    ? windowRef.AudioContext
    : typeof windowRef.webkitAudioContext === "function"
      ? windowRef.webkitAudioContext
      : null;
}

function getSharedAudioGraph(mediaElement: HTMLMediaElement) {
  const existingGraph = MEDIA_AUDIO_GRAPH_CACHE.get(mediaElement);
  if (existingGraph) {
    return existingGraph;
  }
  const graph: SharedAudioGraph = {
    analyser: null,
    audioContext: null,
    eqNodes: [],
    filterBypassed: null,
    filterNode: null,
    frequencyData: null,
    gainNode: null,
    lastAppliedAudioFocusSignature: null,
    lastAppliedPlaybackSignature: null,
    sourceNode: null,
    sourceRoute: null,
    timeDomainData: null,
  };
  MEDIA_AUDIO_GRAPH_CACHE.set(mediaElement, graph);
  return graph;
}

function setSmoothedAudioParam(
  param: AudioParam | null | undefined,
  value: number,
  currentTime: number,
  timeConstant = AUDIO_FOCUS_SMOOTHING_TIME
) {
  if (!param) {
    return;
  }
  param.setTargetAtTime(value, currentTime, timeConstant);
}

async function ensureSharedAudioGraph(
  graph: SharedAudioGraph,
  mediaElement: HTMLMediaElement,
  windowRef: VisualizerWindow
) {
  const audioContextCtor = getAudioContextCtor(windowRef);
  if (audioContextCtor === null) {
    return false;
  }

  if (graph.audioContext === null || graph.audioContext.state === "closed") {
    graph.audioContext = new audioContextCtor();
    graph.gainNode = graph.audioContext.createGain();
    graph.filterNode = graph.audioContext.createBiquadFilter();
    graph.eqNodes = DEFAULT_AUDIO_FOCUS_SETTINGS.eqBands
      .map(function () {
        return graph.audioContext?.createBiquadFilter() || null;
      })
      .filter((entry): entry is BiquadFilterNode => entry !== null);
    graph.analyser = graph.audioContext.createAnalyser();
    graph.analyser.fftSize = AUDIO_VISUALIZER_FFT_SIZE;
    graph.analyser.smoothingTimeConstant = 0.82;
    graph.timeDomainData = createByteBuffer(graph.analyser.fftSize);
    graph.frequencyData = createByteBuffer(graph.analyser.frequencyBinCount);
    graph.lastAppliedAudioFocusSignature = null;
    graph.lastAppliedPlaybackSignature = null;
    graph.sourceNode = null;
    graph.sourceRoute = null;
  }

  const context = graph.audioContext;
  const analyser = graph.analyser;
  const filterNode = graph.filterNode;
  const gainNode = graph.gainNode;
  if (context === null || analyser === null || filterNode === null || gainNode === null) {
    return false;
  }

  if (graph.sourceNode === null) {
    try {
      graph.sourceNode = context.createMediaElementSource(mediaElement);
      graph.sourceRoute = null;
    } catch {
      return false;
    }
  }

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }

  return true;
}

function setOptionalPitchProperty(
  mediaElement: HTMLMediaElement,
  propertyName: "preservesPitch" | "mozPreservesPitch" | "webkitPreservesPitch",
  preservePitch: boolean
) {
  const candidate = mediaElement as HTMLMediaElement & Record<string, unknown>;
  if (propertyName in candidate) {
    candidate[propertyName] = preservePitch;
  }
}

function createPlaybackSettingsSignature(audioFocus: LabAudioFocusSettings) {
  return JSON.stringify({
    playbackRate: Number(audioFocus.playbackRate.toFixed(4)),
    preservePitch: audioFocus.preservePitch === true,
  });
}

function applyPlaybackSettings(mediaElement: HTMLMediaElement, audioFocus: LabAudioFocusSettings) {
  const graph = MEDIA_AUDIO_GRAPH_CACHE.get(mediaElement) || null;
  const signature = createPlaybackSettingsSignature(audioFocus);
  if (graph?.lastAppliedPlaybackSignature === signature) {
    return;
  }
  if (mediaElement.playbackRate !== audioFocus.playbackRate) {
    mediaElement.playbackRate = audioFocus.playbackRate;
  }
  setOptionalPitchProperty(mediaElement, "preservesPitch", audioFocus.preservePitch);
  setOptionalPitchProperty(mediaElement, "mozPreservesPitch", audioFocus.preservePitch);
  setOptionalPitchProperty(mediaElement, "webkitPreservesPitch", audioFocus.preservePitch);
  if (graph !== null) {
    graph.lastAppliedPlaybackSignature = signature;
  }
}

function disconnectAnalyser(graph: SharedAudioGraph) {
  if (graph.analyser) {
    try {
      graph.analyser.disconnect();
    } catch {
      // Disconnect can overlap with graph reroutes during sync.
    }
  }
}

function disconnectProcessingChain(graph: SharedAudioGraph) {
  if (graph.gainNode) {
    try {
      graph.gainNode.disconnect();
    } catch {
      // Disconnect can overlap with route swaps during sync.
    }
  }
  if (graph.filterNode) {
    try {
      graph.filterNode.disconnect();
    } catch {
      // Disconnect can overlap with route swaps during sync.
    }
  }
  graph.eqNodes.forEach(function (node) {
    try {
      node.disconnect();
    } catch {
      // Disconnect can overlap with route swaps during sync.
    }
  });
  disconnectAnalyser(graph);
}

function routeSourceToAnalyser(graph: SharedAudioGraph, bypassFilter = false) {
  const context = graph.audioContext;
  const analyser = graph.analyser;
  const filterNode = graph.filterNode;
  const gainNode = graph.gainNode;
  const sourceNode = graph.sourceNode;
  if (
    context === null ||
    analyser === null ||
    filterNode === null ||
    gainNode === null ||
    sourceNode === null
  ) {
    return false;
  }
  if (graph.sourceRoute === "analyser" && graph.filterBypassed === bypassFilter) {
    return true;
  }
  if (graph.sourceRoute !== null) {
    try {
      sourceNode.disconnect();
    } catch {
      // Re-routing can overlap with teardown of a previous owner.
    }
  }
  disconnectProcessingChain(graph);
  try {
    analyser.connect(context.destination);
    sourceNode.connect(gainNode);
    let previousNode: AudioNode = gainNode;
    if (bypassFilter !== true) {
      gainNode.connect(filterNode);
      previousNode = filterNode;
    }
    graph.eqNodes.forEach(function (node) {
      previousNode.connect(node);
      previousNode = node;
    });
    previousNode.connect(analyser);
    graph.sourceRoute = "analyser";
    graph.filterBypassed = bypassFilter;
    return true;
  } catch {
    graph.sourceRoute = null;
    graph.filterBypassed = null;
    return false;
  }
}

function routeSourceToDestination(graph: SharedAudioGraph) {
  const context = graph.audioContext;
  const sourceNode = graph.sourceNode;
  if (context === null || sourceNode === null) {
    return false;
  }
  if (graph.sourceRoute === "destination") {
    return true;
  }
  if (graph.sourceRoute !== null) {
    try {
      sourceNode.disconnect();
    } catch {
      // Re-routing can overlap with teardown of a previous owner.
    }
  }
  disconnectProcessingChain(graph);
  try {
    sourceNode.connect(context.destination);
    graph.sourceRoute = "destination";
    graph.filterBypassed = null;
    return true;
  } catch {
    graph.sourceRoute = null;
    graph.filterBypassed = null;
    return false;
  }
}

function prepareCanvas(canvasElement: HTMLCanvasElement, windowRef: VisualizerWindow) {
  const context = canvasElement.getContext("2d");
  if (context === null) {
    return null;
  }
  const width = Math.max(1, Math.round(canvasElement.clientWidth || canvasElement.width || 320));
  const height = Math.max(1, Math.round(canvasElement.clientHeight || canvasElement.height || 80));
  const scale = Math.max(1, windowRef.devicePixelRatio || 1);
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  if (canvasElement.width !== scaledWidth || canvasElement.height !== scaledHeight) {
    canvasElement.width = scaledWidth;
    canvasElement.height = scaledHeight;
  }
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return {
    context,
    height,
    width,
  };
}

function readVisualizerColors(canvasElement: HTMLCanvasElement, windowRef: VisualizerWindow) {
  const styles = windowRef.getComputedStyle(canvasElement);
  const accent = styles.getPropertyValue("--labx-accent").trim() || "#5cd7df";
  const accentAlt = styles.getPropertyValue("--labx-accent-alt").trim() || "#6aa6eb";
  const border = styles.getPropertyValue("--labx-border").trim() || "rgba(255, 255, 255, 0.12)";
  const textDim = styles.getPropertyValue("--labx-text-dim").trim() || "rgba(208, 220, 235, 0.42)";
  return {
    accent,
    accentAlt,
    border,
    textDim,
  };
}

function drawIdleFrame(canvasElement: HTMLCanvasElement, windowRef: VisualizerWindow) {
  const preparedCanvas = prepareCanvas(canvasElement, windowRef);
  if (preparedCanvas === null) {
    return;
  }
  const { context, height, width } = preparedCanvas;
  const colors = readVisualizerColors(canvasElement, windowRef);
  const midline = height / 2;

  context.clearRect(0, 0, width, height);
  context.lineWidth = 1;
  context.strokeStyle = colors.border;
  context.beginPath();
  context.moveTo(0, midline);
  context.lineTo(width, midline);
  context.stroke();

  context.lineWidth = 1.2;
  context.strokeStyle = colors.textDim;
  context.beginPath();
  context.moveTo(0, midline);
  for (let index = 0; index <= 24; index += 1) {
    const x = (width / 24) * index;
    const direction = index % 2 === 0 ? -1 : 1;
    context.lineTo(x, midline + direction * height * 0.03);
  }
  context.stroke();
}

function drawWaveformFrame(
  canvasElement: HTMLCanvasElement,
  windowRef: VisualizerWindow,
  buffer: Uint8Array<ArrayBuffer>
) {
  const preparedCanvas = prepareCanvas(canvasElement, windowRef);
  if (preparedCanvas === null) {
    return;
  }
  const { context, height, width } = preparedCanvas;
  const colors = readVisualizerColors(canvasElement, windowRef);
  const midline = height / 2;
  const step = Math.max(1, Math.floor(buffer.length / width));

  context.clearRect(0, 0, width, height);
  context.lineWidth = 1;
  context.strokeStyle = colors.border;
  context.beginPath();
  context.moveTo(0, midline);
  context.lineTo(width, midline);
  context.stroke();

  context.lineWidth = 1.4;
  context.strokeStyle = colors.accent;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const sampleIndex = Math.min(buffer.length - 1, x * step);
    const sample = buffer[sampleIndex] ?? 128;
    const normalized = (sample - 128) / 128;
    const y = midline + normalized * height * 0.34;
    if (x === 0) {
      context.moveTo(x, y);
      continue;
    }
    context.lineTo(x, y);
  }
  context.stroke();
}

function drawSpectrumFrame(
  canvasElement: HTMLCanvasElement,
  windowRef: VisualizerWindow,
  buffer: Uint8Array<ArrayBuffer>
) {
  const preparedCanvas = prepareCanvas(canvasElement, windowRef);
  if (preparedCanvas === null) {
    return;
  }
  const { context, height, width } = preparedCanvas;
  const colors = readVisualizerColors(canvasElement, windowRef);
  const bucketCount = Math.max(24, Math.min(96, Math.round(width / 6)));
  const bucketWidth = Math.max(1, width / bucketCount);
  const bucketSpan = Math.max(1, Math.floor(buffer.length / bucketCount));

  context.clearRect(0, 0, width, height);
  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = bucketIndex * bucketSpan;
    const end =
      bucketIndex === bucketCount - 1 ? buffer.length : Math.min(buffer.length, start + bucketSpan);
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, buffer[sampleIndex] ?? 0);
    }
    const intensity = Math.max(0, Math.min(1, peak / 255));
    const barHeight = Math.max(height * 0.06, intensity * height);
    const x = bucketIndex * bucketWidth;
    const y = height - barHeight;

    context.fillStyle =
      intensity > 0.72 ? colors.accent : intensity > 0.38 ? colors.accentAlt : colors.textDim;
    context.fillRect(x, y, Math.max(1, bucketWidth - 1), barHeight);
  }

  context.lineWidth = 1;
  context.strokeStyle = colors.border;
  context.beginPath();
  context.moveTo(0, height - 0.5);
  context.lineTo(width, height - 0.5);
  context.stroke();
}

export function createAudioVisualizer(
  mediaElement: HTMLMediaElement,
  canvasElement: HTMLCanvasElement,
  options: AudioVisualizerOptions = {}
) {
  const documentRef = (options.documentRef ||
    canvasElement.ownerDocument ||
    null) as VisualizerDocument | null;
  const windowRef = (options.windowRef ||
    documentRef?.defaultView ||
    (typeof window !== "undefined" ? window : null)) as VisualizerWindow | null;
  const sharedGraph = getSharedAudioGraph(mediaElement);
  let frameId: number | null = null;
  let started = false;
  let destroyed = false;
  let listenersBound = false;
  let frameGeneration = 0;
  let renderInFlight = false;

  function getMode() {
    const fromOptions = options.getMode?.();
    if (fromOptions) {
      return getEffectiveAudioVisualizationMode(fromOptions);
    }
    const fromDataset = canvasElement.dataset?.["labVizMode"];
    return getEffectiveAudioVisualizationMode(
      fromDataset === "spectrum" || fromDataset === "waveform" || fromDataset === "none"
        ? fromDataset
        : "waveform"
    );
  }

  function getAudioFocus() {
    const normalizedSettings = normalizeAudioFocusSettings(options.getAudioFocus?.());
    if (options.getTemporalAudioEnabled?.() === false) {
      return {
        ...normalizedSettings,
        playbackRate: DEFAULT_AUDIO_FOCUS_SETTINGS.playbackRate,
        preservePitch: DEFAULT_AUDIO_FOCUS_SETTINGS.preservePitch,
      };
    }
    return normalizedSettings;
  }

  function applyAudioFocusSettings(audioFocus: LabAudioFocusSettings, force = false) {
    const context = sharedGraph.audioContext;
    const filterNode = sharedGraph.filterNode;
    const gainNode = sharedGraph.gainNode;
    const analyser = sharedGraph.analyser;
    if (context === null || filterNode === null || gainNode === null || analyser === null) {
      return false;
    }
    applyPlaybackSettings(mediaElement, audioFocus);
    const signature = createAudioFocusSignature(audioFocus);
    if (force !== true && sharedGraph.lastAppliedAudioFocusSignature === signature) {
      return true;
    }

    const currentTime = typeof context.currentTime === "number" ? context.currentTime : 0;
    setSmoothedAudioParam(gainNode.gain, audioFocus.gain, currentTime);
    filterNode.type = audioFocus.filterType === "none" ? "allpass" : audioFocus.filterType;
    setSmoothedAudioParam(filterNode.frequency, audioFocus.filterFrequency, currentTime);
    setSmoothedAudioParam(filterNode.Q, audioFocus.filterQ, currentTime);

    sharedGraph.eqNodes.forEach(function (node, index) {
      const band = audioFocus.eqBands[index] ?? getDefaultAudioFocusEqBand(index);
      node.type = band.type;
      setSmoothedAudioParam(node.frequency, band.frequency, currentTime);
      setSmoothedAudioParam(node.Q, band.Q, currentTime);
      setSmoothedAudioParam(node.gain, band.gain, currentTime);
    });

    sharedGraph.lastAppliedAudioFocusSignature = signature;
    return true;
  }

  async function refreshLiveRouteAndParams(forceParamApply = false) {
    if (destroyed === true || started !== true || windowRef === null) {
      return false;
    }
    const audioFocus = getAudioFocus();
    if ((await ensureSharedAudioGraph(sharedGraph, mediaElement, windowRef)) !== true) {
      return false;
    }
    if (routeSourceToAnalyser(sharedGraph, audioFocus.filterType === "none") !== true) {
      return false;
    }
    return applyAudioFocusSettings(audioFocus, forceParamApply);
  }

  function cancelFrame() {
    if (frameId !== null && windowRef !== null) {
      windowRef.cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function teardownLiveRoute() {
    cancelFrame();
    routeSourceToDestination(sharedGraph);
  }

  function shouldAnimate() {
    return (
      destroyed !== true &&
      started === true &&
      windowRef !== null &&
      getMode() !== "none" &&
      mediaElement.paused !== true &&
      documentRef?.hidden !== true
    );
  }

  async function renderFrame(runContinuous: boolean) {
    frameId = null;
    renderInFlight = true;
    const renderGeneration = ++frameGeneration;
    try {
      if (destroyed === true || started !== true || windowRef === null) {
        return;
      }
      const mode = getMode();
      if (mode === "none") {
        teardownLiveRoute();
        drawIdleFrame(canvasElement, windowRef);
        return;
      }
      if ((await refreshLiveRouteAndParams()) !== true) {
        if (started === true) {
          drawIdleFrame(canvasElement, windowRef);
        }
        return;
      }
      if (renderGeneration !== frameGeneration || started !== true) {
        return;
      }
      if (sharedGraph.analyser === null) {
        drawIdleFrame(canvasElement, windowRef);
        return;
      }
      if (mode === "spectrum") {
        if (
          sharedGraph.frequencyData === null ||
          sharedGraph.frequencyData.length !== sharedGraph.analyser.frequencyBinCount
        ) {
          sharedGraph.frequencyData = createByteBuffer(sharedGraph.analyser.frequencyBinCount);
        }
        sharedGraph.analyser.getByteFrequencyData(sharedGraph.frequencyData);
        drawSpectrumFrame(canvasElement, windowRef, sharedGraph.frequencyData);
      } else {
        if (
          sharedGraph.timeDomainData === null ||
          sharedGraph.timeDomainData.length !== sharedGraph.analyser.fftSize
        ) {
          sharedGraph.timeDomainData = createByteBuffer(sharedGraph.analyser.fftSize);
        }
        sharedGraph.analyser.getByteTimeDomainData(sharedGraph.timeDomainData);
        drawWaveformFrame(canvasElement, windowRef, sharedGraph.timeDomainData);
      }
      if (runContinuous === true && shouldAnimate()) {
        frameId = windowRef.requestAnimationFrame(function () {
          void renderFrame(true);
        });
      }
    } finally {
      renderInFlight = false;
    }
  }

  function scheduleContinuousFrame() {
    if (windowRef === null || shouldAnimate() !== true || frameId !== null) {
      return;
    }
    frameId = windowRef.requestAnimationFrame(function () {
      void renderFrame(true);
    });
  }

  function renderSnapshotFrame(resumeContinuous = false) {
    if (destroyed === true || started !== true || windowRef === null) {
      return;
    }
    cancelFrame();
    const continueAfterSnapshot = resumeContinuous === true && shouldAnimate() === true;
    void renderFrame(continueAfterSnapshot);
  }

  function handleMediaPlay() {
    cancelFrame();
    void renderFrame(true);
  }

  function handleMediaPause() {
    cancelFrame();
  }

  function handleMediaEnded() {
    cancelFrame();
  }

  function handleMediaSeek() {
    renderSnapshotFrame(true);
  }

  function handleVisibilityChange() {
    if (documentRef?.hidden === true) {
      cancelFrame();
      return;
    }
    if (mediaElement.paused === true) {
      renderSnapshotFrame();
      return;
    }
    scheduleContinuousFrame();
  }

  function bindListeners() {
    if (listenersBound === true) {
      return;
    }
    mediaElement.addEventListener("play", handleMediaPlay);
    mediaElement.addEventListener("pause", handleMediaPause);
    mediaElement.addEventListener("ended", handleMediaEnded);
    mediaElement.addEventListener("seeking", handleMediaSeek);
    mediaElement.addEventListener("seeked", handleMediaSeek);
    documentRef?.addEventListener?.("visibilitychange", handleVisibilityChange);
    listenersBound = true;
  }

  function unbindListeners() {
    if (listenersBound !== true) {
      return;
    }
    mediaElement.removeEventListener("play", handleMediaPlay);
    mediaElement.removeEventListener("pause", handleMediaPause);
    mediaElement.removeEventListener("ended", handleMediaEnded);
    mediaElement.removeEventListener("seeking", handleMediaSeek);
    mediaElement.removeEventListener("seeked", handleMediaSeek);
    documentRef?.removeEventListener?.("visibilitychange", handleVisibilityChange);
    listenersBound = false;
  }

  function start() {
    if (destroyed === true) {
      return;
    }
    const wasStarted = started;
    started = true;
    bindListeners();
    if (mediaElement.paused === true) {
      if (wasStarted !== true) {
        renderSnapshotFrame();
      }
      return;
    }
    if (wasStarted === true) {
      void refreshLiveRouteAndParams();
      if (frameId === null && renderInFlight !== true && shouldAnimate()) {
        scheduleContinuousFrame();
      }
      return;
    }
    cancelFrame();
    void renderFrame(true);
  }

  function stop() {
    started = false;
    frameGeneration += 1;
    cancelFrame();
    routeSourceToDestination(sharedGraph);
  }

  function destroy() {
    if (destroyed === true) {
      return;
    }
    destroyed = true;
    stop();
    unbindListeners();
  }

  return {
    destroy,
    start,
    stop,
  };
}
