import { createAudioVisualizer } from "../runtime/lab-audio-visualizer.js";
const WORKSPACE_AUDIO_MEDIA_SELECTORS = [
  'audio[data-lab-preserve-media="workspace-preview-dual-audio"]',
  'audio[data-lab-preserve-media="workspace-preview"]',
  'video[data-lab-preserve-media="workspace-preview"]'
];
const WAVEFORM_CANVAS_SELECTOR = "#lab-audio-viz";
const INSPECTION_WAVEFORM_CANVAS_SELECTOR = "#lab-audio-viz-inspection";
function isWorkspaceAudioPreview(value) {
  if (typeof HTMLMediaElement === "function" && value instanceof HTMLMediaElement) {
    return true;
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  return typeof candidate.play === "function" && typeof candidate.pause === "function" && typeof candidate.paused === "boolean" && typeof candidate.addEventListener === "function";
}
function isAudioVisualizerCanvas(value) {
  if (typeof HTMLCanvasElement === "function" && value instanceof HTMLCanvasElement) {
    return true;
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return typeof value.getContext === "function";
}
function getEffectiveAudioVisualizationMode(mode) {
  if (mode === "spectrum") {
    return "spectrum";
  }
  if (mode === "waveform") {
    return "waveform";
  }
  return "none";
}
export function createLabWaveformTimelineVisualizer(deps) {
  let boundWorkspaceAudioPreview = null;
  let audioVisualizer = null;
  let audioVisualizerCanvas = null;
  let audioVisualizerMedia = null;
  let audioVisualizationArtifactRequestId = 0;
  let failedArtifactRenderKey = null;
  let loadingArtifactRenderKey = null;
  const decodedWaveformPeakCache = /* @__PURE__ */ new Map();
  let decodedWaveformRequestId = 0;
  let failedDecodedWaveformSourceUrl = null;
  let loadingDecodedWaveformSourceUrl = null;
  let renderedDecodedWaveformKey = null;
  let renderedArtifactKey = null;
  function getDocumentQuerySelector() {
    return typeof deps.documentRef.querySelector === "function" ? deps.documentRef.querySelector.bind(deps.documentRef) : null;
  }
  function getTimelineModel() {
    if (typeof deps.getTimelineModel === "function") {
      return deps.getTimelineModel();
    }
    return {
      activeSelection: null,
      bookmarks: [],
      dualPreviewActive: false,
      durationMs: 0,
      endMs: null,
      startMs: null,
      visualizationArtifact: typeof deps.getVisualizationArtifact === "function" ? deps.getVisualizationArtifact() : null,
      visualizationMode: typeof deps.getVisualizationMode === "function" ? deps.getVisualizationMode() : "waveform",
      waveformCropEndRatio: 1,
      waveformCropStartRatio: 0,
      waveformSourceLabel: "Waveform",
      waveformSyncLabel: "Preview and waveform share the same master axis.",
      waveformWindowDurationMs: 0,
      waveformWindowStartMs: 0
    };
  }
  function getVisualizationMode() {
    return getTimelineModel().visualizationMode ?? "waveform";
  }
  function getWorkspaceAudioPreview() {
    const querySelector = getDocumentQuerySelector();
    if (querySelector === null) {
      return null;
    }
    for (const selector of WORKSPACE_AUDIO_MEDIA_SELECTORS) {
      const candidate = querySelector(selector);
      if (isWorkspaceAudioPreview(candidate)) {
        return candidate;
      }
    }
    return null;
  }
  function getAudioVisualizerCanvasBySelector(selector, mode) {
    const querySelector = getDocumentQuerySelector();
    if (querySelector === null) {
      return null;
    }
    const candidate = querySelector(selector);
    if (!isAudioVisualizerCanvas(candidate)) {
      return null;
    }
    candidate.dataset["labVizMode"] = mode;
    return candidate;
  }
  function getAudioVisualizerCanvas() {
    return getAudioVisualizerCanvasBySelector(
      WAVEFORM_CANVAS_SELECTOR,
      getEffectiveAudioVisualizationMode(getVisualizationMode())
    );
  }
  function getInspectionLensCanvas() {
    return getAudioVisualizerCanvasBySelector(INSPECTION_WAVEFORM_CANVAS_SELECTOR, "waveform");
  }
  function getLoadableVisualizationArtifactUrl(artifact) {
    if (typeof artifact.previewUrl === "string" && artifact.previewUrl.trim() !== "") {
      return artifact.previewUrl;
    }
    const fileUrl = artifact.fileUrl;
    return typeof fileUrl === "string" && fileUrl.trim() !== "" ? fileUrl : null;
  }
  function createRenderableVisualizationArtifactKey(model, artifact, imageUrl) {
    return [
      model.visualizationMode ?? "waveform",
      artifact.id,
      artifact.kind,
      imageUrl,
      artifact.createdAt || "",
      model.linkedAudioAssetId || "",
      String(Number((model.waveformCropStartRatio ?? 0).toFixed(6))),
      String(Number((model.waveformCropEndRatio ?? 1).toFixed(6))),
      String(model.waveformOffsetMs ?? 0)
    ].join(":");
  }
  function getRenderableVisualizationArtifact() {
    const model = getTimelineModel();
    const artifact = model.visualizationArtifact ?? null;
    if (artifact === null) {
      return null;
    }
    const imageUrl = getLoadableVisualizationArtifactUrl(artifact);
    if (imageUrl === null) {
      return null;
    }
    const key = createRenderableVisualizationArtifactKey(model, artifact, imageUrl);
    return {
      artifact,
      imageUrl,
      key
    };
  }
  function getAudioContextCtor() {
    return typeof deps.windowRef.AudioContext === "function" ? deps.windowRef.AudioContext : typeof deps.windowRef.webkitAudioContext === "function" ? deps.windowRef.webkitAudioContext : null;
  }
  function getFetchFn() {
    return typeof deps.windowRef.fetch === "function" ? deps.windowRef.fetch.bind(deps.windowRef) : typeof fetch === "function" ? fetch : null;
  }
  function destroyLiveAudioVisualizer() {
    audioVisualizer?.destroy();
    audioVisualizer = null;
    audioVisualizerCanvas = null;
    audioVisualizerMedia = null;
  }
  function stopLiveAudioVisualizer() {
    audioVisualizer?.stop();
  }
  function ensureLiveAudioVisualizer(media, canvas) {
    if (audioVisualizer !== null && audioVisualizerMedia === media && audioVisualizerCanvas === canvas) {
      return audioVisualizer;
    }
    destroyLiveAudioVisualizer();
    audioVisualizer = createAudioVisualizer(media, canvas, {
      getAudioFocus() {
        return getTimelineModel().audioFocus;
      },
      documentRef: deps.documentRef,
      getMode() {
        return getVisualizationMode();
      },
      getTemporalAudioEnabled() {
        return getTimelineModel().dualPreviewActive !== true;
      },
      windowRef: deps.windowRef
    });
    audioVisualizerCanvas = canvas;
    audioVisualizerMedia = media;
    return audioVisualizer;
  }
  function resetArtifactRenderState(options = {}) {
    audioVisualizationArtifactRequestId += 1;
    loadingArtifactRenderKey = null;
    renderedArtifactKey = null;
    if (options.preserveFailure !== true) {
      failedArtifactRenderKey = null;
    }
  }
  function resetDecodedWaveformRenderState(options = {}) {
    decodedWaveformRequestId += 1;
    loadingDecodedWaveformSourceUrl = null;
    renderedDecodedWaveformKey = null;
    if (options.preserveFailure !== true) {
      failedDecodedWaveformSourceUrl = null;
    }
  }
  function getWorkspaceAudioPreviewSourceUrl(media) {
    const mediaWithSource = media;
    if (typeof mediaWithSource.currentSrc === "string" && mediaWithSource.currentSrc.trim() !== "") {
      return mediaWithSource.currentSrc;
    }
    if (typeof mediaWithSource.src === "string" && mediaWithSource.src.trim() !== "") {
      return mediaWithSource.src;
    }
    return null;
  }
  function prepareAudioVisualizerCanvas(canvas) {
    const context = canvas.getContext("2d");
    if (context === null) {
      return null;
    }
    const width = Math.max(1, Math.round(canvas.clientWidth || canvas.width || 320));
    const height = Math.max(1, Math.round(canvas.clientHeight || canvas.height || 80));
    const scale = Math.max(1, deps.windowRef.devicePixelRatio || 1);
    const scaledWidth = Math.max(1, Math.round(width * scale));
    const scaledHeight = Math.max(1, Math.round(height * scale));
    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    return {
      context,
      height,
      width
    };
  }
  function readAudioVisualizerColors(canvas) {
    const styles = deps.windowRef.getComputedStyle(canvas);
    const accent = styles.getPropertyValue("--labx-accent").trim() || "rgba(92, 215, 223, 0.92)";
    const border = styles.getPropertyValue("--labx-border").trim() || "rgba(255, 255, 255, 0.12)";
    const textDim = styles.getPropertyValue("--labx-text-dim").trim() || "rgba(208, 220, 235, 0.42)";
    return {
      guide: border,
      idle: textDim,
      waveform: accent
    };
  }
  function extractDownsampledWaveformPeaks(audioBuffer, bucketCount = 1024) {
    const normalizedBucketCount = Math.max(64, bucketCount);
    const peaks = new Float32Array(normalizedBucketCount);
    const frameCount = Math.max(1, audioBuffer.length);
    const channelCount = Math.max(1, audioBuffer.numberOfChannels);
    const bucketSpan = Math.max(1, Math.floor(frameCount / normalizedBucketCount));
    for (let bucketIndex = 0; bucketIndex < normalizedBucketCount; bucketIndex += 1) {
      const start = bucketIndex * bucketSpan;
      const end = bucketIndex === normalizedBucketCount - 1 ? frameCount : Math.min(frameCount, start + bucketSpan);
      let peak = 0;
      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        const samples = audioBuffer.getChannelData(channelIndex);
        for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
          peak = Math.max(peak, Math.abs(samples[sampleIndex] ?? 0));
        }
      }
      peaks[bucketIndex] = peak;
    }
    return peaks;
  }
  function createDecodedWaveformRenderKey(model, sourceUrl) {
    return [
      sourceUrl,
      model.linkedAudioAssetId || "",
      String(Number((model.waveformCropStartRatio ?? 0).toFixed(6))),
      String(Number((model.waveformCropEndRatio ?? 1).toFixed(6))),
      String(model.waveformOffsetMs ?? 0)
    ].join(":");
  }
  function drawStaticWaveformPeaksToCanvas(canvas, cropStartRatio, cropEndRatio, peaks) {
    const preparedCanvas = prepareAudioVisualizerCanvas(canvas);
    if (preparedCanvas === null) {
      return false;
    }
    const { context, height, width } = preparedCanvas;
    const colors = readAudioVisualizerColors(canvas);
    const midline = height / 2;
    const startIndex = Math.max(0, Math.floor(peaks.length * cropStartRatio));
    const endIndex = Math.max(
      startIndex + 1,
      Math.min(peaks.length, Math.ceil(peaks.length * cropEndRatio))
    );
    const visiblePeaks = peaks.subarray(startIndex, endIndex);
    const bucketCount = Math.max(16, Math.min(visiblePeaks.length, Math.round(width / 3)));
    const bucketSpan = Math.max(1, Math.floor(visiblePeaks.length / bucketCount));
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;
    context.strokeStyle = colors.guide;
    context.beginPath();
    context.moveTo(0, midline);
    context.lineTo(width, midline);
    context.stroke();
    context.lineWidth = Math.max(1, Math.min(3, width / bucketCount));
    context.strokeStyle = colors.waveform;
    context.beginPath();
    for (let index = 0; index < bucketCount; index += 1) {
      const start = index * bucketSpan;
      const end = index === bucketCount - 1 ? visiblePeaks.length : Math.min(visiblePeaks.length, start + bucketSpan);
      let peak = 0;
      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        peak = Math.max(peak, visiblePeaks[sampleIndex] ?? 0);
      }
      const x = (index + 0.5) / bucketCount * width;
      const amplitude = Math.max(height * 0.04, peak * height * 0.42);
      context.moveTo(x, midline - amplitude);
      context.lineTo(x, midline + amplitude);
    }
    context.stroke();
    return true;
  }
  function drawStaticWaveformPeaks(renderKey, peaks) {
    const canvas = getAudioVisualizerCanvas();
    if (canvas === null) {
      return false;
    }
    const model = getTimelineModel();
    const cropStartRatio = Math.max(0, Math.min(1, model.waveformCropStartRatio ?? 0));
    const cropEndRatio = Math.max(cropStartRatio, Math.min(1, model.waveformCropEndRatio ?? 1));
    if (!drawStaticWaveformPeaksToCanvas(canvas, cropStartRatio, cropEndRatio, peaks)) {
      return false;
    }
    renderedDecodedWaveformKey = renderKey;
    return true;
  }
  function clearInspectionLensCanvas() {
    const canvas = getInspectionLensCanvas();
    if (canvas === null) {
      return;
    }
    const preparedCanvas = prepareAudioVisualizerCanvas(canvas);
    if (preparedCanvas === null) {
      return;
    }
    preparedCanvas.context.clearRect(0, 0, preparedCanvas.width, preparedCanvas.height);
  }
  function drawInspectionLensPeaks(peaks) {
    const canvas = getInspectionLensCanvas();
    const lens = getTimelineModel().waveformInspectionLens;
    if (canvas === null || lens?.enabled !== true) {
      clearInspectionLensCanvas();
      return false;
    }
    const cropStartRatio = Math.max(0, Math.min(1, lens.cropStartRatio));
    const cropEndRatio = Math.max(cropStartRatio, Math.min(1, lens.cropEndRatio));
    return drawStaticWaveformPeaksToCanvas(canvas, cropStartRatio, cropEndRatio, peaks);
  }
  function renderDecodedWaveformIfAvailable(media) {
    const sourceUrl = getWorkspaceAudioPreviewSourceUrl(media);
    if (sourceUrl === null) {
      return false;
    }
    const model = getTimelineModel();
    const renderKey = createDecodedWaveformRenderKey(model, sourceUrl);
    const cachedPeaks = decodedWaveformPeakCache.get(sourceUrl) || null;
    if (cachedPeaks !== null) {
      if (renderedDecodedWaveformKey !== renderKey) {
        drawStaticWaveformPeaks(renderKey, cachedPeaks);
      }
      drawInspectionLensPeaks(cachedPeaks);
      return true;
    }
    if (loadingDecodedWaveformSourceUrl === sourceUrl || failedDecodedWaveformSourceUrl === sourceUrl) {
      return false;
    }
    const fetchFn = getFetchFn();
    const audioContextCtor = getAudioContextCtor();
    if (fetchFn === null || audioContextCtor === null) {
      return false;
    }
    const requestId = decodedWaveformRequestId + 1;
    decodedWaveformRequestId = requestId;
    loadingDecodedWaveformSourceUrl = sourceUrl;
    void (async () => {
      const decodeContext = new audioContextCtor();
      try {
        const response = await fetchFn(sourceUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
        if (requestId !== decodedWaveformRequestId) {
          return;
        }
        decodedWaveformPeakCache.set(sourceUrl, extractDownsampledWaveformPeaks(audioBuffer));
        loadingDecodedWaveformSourceUrl = null;
        failedDecodedWaveformSourceUrl = null;
        sync();
      } catch {
        if (requestId !== decodedWaveformRequestId) {
          return;
        }
        loadingDecodedWaveformSourceUrl = null;
        failedDecodedWaveformSourceUrl = sourceUrl;
        sync();
      } finally {
        if (typeof decodeContext.close === "function") {
          try {
            await decodeContext.close();
          } catch {
          }
        }
      }
    })();
    return false;
  }
  function drawAudioVisualizationArtifactImage(renderKey, image) {
    const canvas = getAudioVisualizerCanvas();
    if (canvas === null) {
      return;
    }
    const preparedCanvas = prepareAudioVisualizerCanvas(canvas);
    if (preparedCanvas === null) {
      return;
    }
    const { context, height, width } = preparedCanvas;
    const model = getTimelineModel();
    const cropStartRatio = Math.max(0, Math.min(1, model.waveformCropStartRatio ?? 0));
    const cropEndRatio = Math.max(cropStartRatio, Math.min(1, model.waveformCropEndRatio ?? 1));
    const sourceWidth = typeof image.naturalWidth === "number" && image.naturalWidth > 0 ? image.naturalWidth : typeof image.width === "number" && image.width > 0 ? image.width : 0;
    const sourceHeight = typeof image.naturalHeight === "number" && image.naturalHeight > 0 ? image.naturalHeight : typeof image.height === "number" && image.height > 0 ? image.height : 0;
    context.clearRect(0, 0, width, height);
    if (sourceWidth > 0 && sourceHeight > 0 && cropEndRatio > cropStartRatio) {
      const sourceX = Math.round(sourceWidth * cropStartRatio);
      const sourceWidthSlice = Math.max(
        1,
        Math.round(sourceWidth * (cropEndRatio - cropStartRatio))
      );
      context.drawImage(image, sourceX, 0, sourceWidthSlice, sourceHeight, 0, 0, width, height);
    } else {
      context.drawImage(image, 0, 0, width, height);
    }
    renderedArtifactKey = renderKey;
  }
  function renderAudioVisualizationArtifactIfAvailable() {
    const renderableArtifact = getRenderableVisualizationArtifact();
    if (renderableArtifact === null) {
      resetArtifactRenderState({ preserveFailure: true });
      return false;
    }
    if (failedArtifactRenderKey === renderableArtifact.key) {
      return false;
    }
    if (renderedArtifactKey === renderableArtifact.key || loadingArtifactRenderKey === renderableArtifact.key) {
      return true;
    }
    if (typeof deps.windowRef.Image !== "function") {
      return false;
    }
    const image = new deps.windowRef.Image();
    const requestId = audioVisualizationArtifactRequestId + 1;
    audioVisualizationArtifactRequestId = requestId;
    loadingArtifactRenderKey = renderableArtifact.key;
    renderedArtifactKey = null;
    image.onload = function() {
      if (requestId !== audioVisualizationArtifactRequestId || loadingArtifactRenderKey !== renderableArtifact.key) {
        return;
      }
      loadingArtifactRenderKey = null;
      failedArtifactRenderKey = null;
      drawAudioVisualizationArtifactImage(renderableArtifact.key, image);
    };
    image.onerror = function() {
      if (requestId !== audioVisualizationArtifactRequestId || loadingArtifactRenderKey !== renderableArtifact.key) {
        return;
      }
      loadingArtifactRenderKey = null;
      renderedArtifactKey = null;
      failedArtifactRenderKey = renderableArtifact.key;
      sync();
    };
    image.src = renderableArtifact.imageUrl;
    return true;
  }
  function drawAudioVisualizerIdle() {
    const canvas = getAudioVisualizerCanvas();
    if (canvas === null) {
      return;
    }
    const preparedCanvas = prepareAudioVisualizerCanvas(canvas);
    if (preparedCanvas === null) {
      return;
    }
    const { context, height, width } = preparedCanvas;
    const colors = readAudioVisualizerColors(canvas);
    const midline = height / 2;
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;
    context.strokeStyle = colors.guide;
    context.beginPath();
    context.moveTo(0, midline);
    context.lineTo(width, midline);
    context.stroke();
    context.lineWidth = 1.2;
    context.strokeStyle = colors.idle;
    context.beginPath();
    context.moveTo(0, midline);
    for (let index = 0; index <= 24; index += 1) {
      const x = width / 24 * index;
      const direction = index % 2 === 0 ? -1 : 1;
      const y = midline + direction * height * 0.03;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  function handleWorkspaceAudioPreviewPlaybackChange() {
    sync();
  }
  function bindWorkspaceAudioPreviewListeners() {
    const nextPreview = getWorkspaceAudioPreview();
    if (boundWorkspaceAudioPreview === nextPreview) {
      return;
    }
    if (boundWorkspaceAudioPreview?.removeEventListener) {
      boundWorkspaceAudioPreview.removeEventListener(
        "play",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "pause",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "ended",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "seeking",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "seeked",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "loadedmetadata",
        handleWorkspaceAudioPreviewPlaybackChange
      );
    }
    if (audioVisualizerMedia !== null && audioVisualizerMedia !== nextPreview) {
      destroyLiveAudioVisualizer();
      resetArtifactRenderState();
      resetDecodedWaveformRenderState();
    }
    if (nextPreview?.addEventListener) {
      nextPreview.addEventListener("play", handleWorkspaceAudioPreviewPlaybackChange);
      nextPreview.addEventListener("pause", handleWorkspaceAudioPreviewPlaybackChange);
      nextPreview.addEventListener("ended", handleWorkspaceAudioPreviewPlaybackChange);
      nextPreview.addEventListener("seeking", handleWorkspaceAudioPreviewPlaybackChange);
      nextPreview.addEventListener("seeked", handleWorkspaceAudioPreviewPlaybackChange);
      nextPreview.addEventListener("loadedmetadata", handleWorkspaceAudioPreviewPlaybackChange);
    }
    boundWorkspaceAudioPreview = nextPreview;
  }
  function sync() {
    bindWorkspaceAudioPreviewListeners();
    const canvas = getAudioVisualizerCanvas();
    const effectiveMode = getEffectiveAudioVisualizationMode(getVisualizationMode());
    if (effectiveMode === "none") {
      resetArtifactRenderState();
      resetDecodedWaveformRenderState();
      destroyLiveAudioVisualizer();
      const media2 = getWorkspaceAudioPreview();
      if (media2 !== null) {
        renderDecodedWaveformIfAvailable(media2);
      } else {
        clearInspectionLensCanvas();
      }
      return;
    }
    if (canvas === null) {
      return;
    }
    const media = getWorkspaceAudioPreview();
    if (media !== null && media.paused === false) {
      resetArtifactRenderState({ preserveFailure: true });
      resetDecodedWaveformRenderState({ preserveFailure: true });
      ensureLiveAudioVisualizer(media, canvas).start();
      renderDecodedWaveformIfAvailable(media);
      return;
    }
    if (renderAudioVisualizationArtifactIfAvailable() === true) {
      stopLiveAudioVisualizer();
      if (media !== null) {
        renderDecodedWaveformIfAvailable(media);
      } else {
        clearInspectionLensCanvas();
      }
      return;
    }
    stopLiveAudioVisualizer();
    if (media !== null && renderDecodedWaveformIfAvailable(media) === true) {
      return;
    }
    clearInspectionLensCanvas();
    drawAudioVisualizerIdle();
  }
  function dispose() {
    if (boundWorkspaceAudioPreview?.removeEventListener) {
      boundWorkspaceAudioPreview.removeEventListener(
        "play",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "pause",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "ended",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "seeking",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "seeked",
        handleWorkspaceAudioPreviewPlaybackChange
      );
      boundWorkspaceAudioPreview.removeEventListener(
        "loadedmetadata",
        handleWorkspaceAudioPreviewPlaybackChange
      );
    }
    destroyLiveAudioVisualizer();
    resetArtifactRenderState();
    resetDecodedWaveformRenderState();
    boundWorkspaceAudioPreview = null;
  }
  return {
    dispose,
    sync
  };
}
