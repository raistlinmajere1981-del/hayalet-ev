import { escapeHtml } from "../models/lab-types.js";
const WORKSPACE_AUDIO_MEDIA_SELECTORS = [
  'audio[data-lab-preserve-media="workspace-preview-dual-audio"]',
  'audio[data-lab-preserve-media="workspace-preview"]',
  'video[data-lab-preserve-media="workspace-preview"]'
];
const WAVEFORM_CANVAS_SELECTOR = "#lab-audio-viz";
function formatTimePrecise(ms) {
  const totalMs = Math.round(ms);
  const minutes = Math.floor(totalMs / 6e4);
  const seconds = Math.floor(totalMs % 6e4 / 1e3);
  const millis = totalMs % 1e3;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
function formatTimeShort(ms) {
  const totalSeconds = Math.round(ms / 1e3);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function formatDuration(ms) {
  if (ms < 1e3) {
    return `${ms}ms`;
  }
  const totalSeconds = ms / 1e3;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${minutes}m ${seconds}s`;
}
function formatSelectionType(type) {
  return {
    clip: "Clip",
    focus: "Focus",
    inspect: "Inspect",
    unknown: "Unknown"
  }[type ?? "unknown"];
}
function renderFineTuneButtons(prefix, msValue) {
  return `
    <div class="labx-timeline__finetune">
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:-1000" title="-1s">&#9664;&#9664;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:-100" title="-100ms">&#9664;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:-10" title="-10ms">&#8249;</button>
      <span class="labx-timeline__finetune-value">${formatTimePrecise(msValue)}</span>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:+10" title="+10ms">&#8250;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:+100" title="+100ms">&#9654;</button>
      <button class="labx-timeline__finetune-btn" type="button" data-lab-action="timeline-finetune" data-lab-value="${prefix}:+1000" title="+1s">&#9654;&#9654;</button>
    </div>
  `;
}
export function renderLabWaveformTimeline(model) {
  const durationMs = Math.max(1, model.durationMs);
  const rawStartMs = model.startMs ?? 0;
  const rawEndMs = model.endMs ?? durationMs;
  const hasSelection = model.startMs !== null && model.endMs !== null && model.endMs > model.startMs;
  const activeSelection = hasSelection === true ? model.activeSelection ?? {
    id: "selection-preview",
    startMs: rawStartMs,
    endMs: rawEndMs,
    type: "clip",
    createdAt: 0
  } : null;
  const startMs = hasSelection ? rawStartMs : 0;
  const endMs = hasSelection ? rawEndMs : durationMs;
  const startPct = hasSelection ? Math.max(0, Math.min(100, startMs / durationMs * 100)) : 0;
  const endPct = hasSelection ? Math.max(0, Math.min(100, endMs / durationMs * 100)) : 100;
  const selectionCenterPct = hasSelection ? startPct + (endPct - startPct) / 2 : 0;
  const selectionDurationMs = hasSelection ? Math.max(0, endMs - startMs) : 0;
  const waveformWindowStartPct = Math.max(
    0,
    Math.min(100, model.waveformWindowStartMs / durationMs * 100)
  );
  const waveformWindowWidthPct = Math.max(
    0,
    Math.min(100 - waveformWindowStartPct, model.waveformWindowDurationMs / durationMs * 100)
  );
  const hasVisibleWaveform = waveformWindowWidthPct > 0;
  const bookmarkPins = model.bookmarks.map(function(bookmark) {
    const pct = Math.max(0, Math.min(100, bookmark.timeMs / durationMs * 100));
    return `
        <div
          class="labx-timeline__pin"
          style="left: ${String(pct)}%"
          title="${escapeHtml(bookmark.note || formatTimePrecise(bookmark.timeMs))}"
          data-lab-action="timeline-seek"
          data-lab-value="${String(bookmark.timeMs)}"
        ></div>
      `;
  }).join("");
  const hintLabel = hasVisibleWaveform === true ? model.startMs !== null && model.endMs !== null && hasSelection !== true ? "End must be greater than start to create a valid selection." : "Click to seek, drag to create a selection." : "Waveform falls outside the visible master range.";
  return `
    <div class="labx-timeline" id="lab-timeline" data-duration="${String(durationMs)}" data-waveform-mode="${model.dualPreviewActive ? "linked-audio" : "source-audio"}">
      <div class="labx-timeline__header">
        <div class="labx-timeline__header-copy">
          <p class="labx-card__eyebrow">TIMELINE</p>
          <strong>${escapeHtml(model.waveformSourceLabel)}</strong>
        </div>
        <span class="labx-timeline__sync">${escapeHtml(model.waveformSyncLabel)}</span>
      </div>
      <div class="labx-timeline__track">
        <div class="labx-timeline__waveform-bed"></div>
        ${hasVisibleWaveform ? `
          <div
            class="labx-timeline__waveform-window"
            style="left: ${String(waveformWindowStartPct)}%; width: ${String(waveformWindowWidthPct)}%"
          >
            <canvas
              id="lab-audio-viz"
              class="labx-audio-viz labx-audio-viz--timeline"
              width="960"
              height="112"
              data-lab-viz="audio-waveform-timeline"
              data-waveform-crop-start="${String(model.waveformCropStartRatio ?? 0)}"
              data-waveform-crop-end="${String(model.waveformCropEndRatio ?? 1)}"
            ></canvas>
          </div>
        ` : ""}
        <div class="labx-timeline__playhead" data-lab-role="timeline-playhead" style="left: 0%">
          <span class="labx-timeline__playhead-label" data-lab-role="timeline-playhead-label">00:00.000</span>
        </div>
        <div class="labx-timeline__rail" data-lab-action="timeline-interact"></div>
        ${hasSelection ? `
          <div class="lab-selection-panel" style="left: ${String(selectionCenterPct)}%">
            <div class="lab-selection-panel__eyebrow">Selection</div>
            <div class="lab-selection-panel__range">
              ${formatTimePrecise(startMs)} &#8594; ${formatTimePrecise(endMs)}
              <span class="lab-selection-panel__duration">(${formatDuration(selectionDurationMs)})</span>
            </div>
            <div class="lab-selection-panel__meta">Type: ${escapeHtml(formatSelectionType(activeSelection?.type))}</div>
            ${typeof activeSelection?.label === "string" && activeSelection.label.trim() !== "" ? `<div class="lab-selection-panel__label">${escapeHtml(activeSelection.label)}</div>` : ""}
            <div class="lab-selection-panel__actions">
              <button class="lab-selection-panel__action" type="button" disabled>Analyze this</button>
              <button class="lab-selection-panel__action" type="button" disabled>Extract clip</button>
              <button class="lab-selection-panel__action" type="button" disabled>Focus region</button>
            </div>
          </div>
          <div
            class="labx-timeline__selection lab-selection-overlay"
            style="left: ${String(startPct)}%; width: ${String(endPct - startPct)}%"
          >
            <div class="labx-timeline__handle labx-timeline__handle--start" data-lab-action="timeline-drag-start"></div>
            <div class="labx-timeline__handle labx-timeline__handle--end" data-lab-action="timeline-drag-end"></div>
            <div class="labx-timeline__selection-body" data-lab-action="timeline-drag-body"></div>
            <div class="labx-timeline__selection-duration">${formatDuration(selectionDurationMs)}</div>
          </div>
        ` : `<div class="labx-timeline__hint">${escapeHtml(hintLabel)}</div>`}
        ${bookmarkPins}
      </div>
      <div class="labx-timeline__controls">
        <div class="labx-timeline__range-info">
          <span class="labx-timeline__duration">${formatTimeShort(durationMs)}</span>
          ${hasSelection ? `
            <span class="labx-timeline__range-label">
              ${formatTimePrecise(startMs)} — ${formatTimePrecise(endMs)}
            </span>
            <span class="labx-timeline__range-duration">(${formatDuration(selectionDurationMs)})</span>
          ` : ""}
        </div>
        <div class="labx-timeline__actions">
          ${hasSelection ? `<button class="labx-timeline__clear-btn" type="button" data-lab-action="timeline-clear">Clear</button>
                 <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-export-clip" title="Export selected range as video clip">Export Clip</button>` : ""}
          <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-grab-frame" title="Capture current frame as image">Grab Frame</button>
          <button class="labx-timeline__export-btn" type="button" data-lab-action="timeline-extract-audio" title="Extract source audio">Extract Audio</button>
        </div>
      </div>
      ${hasSelection ? `
        <div class="labx-timeline__finetune-row">
          <label class="labx-timeline__finetune-label">Start</label>
          ${renderFineTuneButtons("start", startMs)}
        </div>
        <div class="labx-timeline__finetune-row">
          <label class="labx-timeline__finetune-label">End</label>
          ${renderFineTuneButtons("end", endMs)}
        </div>
      ` : ""}
      <div class="labx-timeline__numeric">
        <label class="labx-field labx-field--compact">
          <span>Start (ms)</span>
          <input class="labx-input labx-input--compact" type="number" min="0" max="${String(durationMs)}" data-lab-field="workspace.timelineStartMs" value="${model.startMs !== null ? String(model.startMs) : ""}" placeholder="ms" />
        </label>
        <label class="labx-field labx-field--compact">
          <span>End (ms)</span>
          <input class="labx-input labx-input--compact" type="number" min="0" max="${String(durationMs)}" data-lab-field="workspace.timelineEndMs" value="${model.endMs !== null ? String(model.endMs) : ""}" placeholder="ms" />
        </label>
      </div>
    </div>
  `;
}
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
function createWaveformBuffer(length) {
  return new Uint8Array(new ArrayBuffer(length));
}
function getEffectiveAudioVisualizationMode(mode) {
  if (mode === "spectrum") {
    return "waveform";
  }
  return "waveform";
}
export function createLabWaveformTimelineVisualizer(deps) {
  let boundWorkspaceAudioPreview = null;
  let audioVisualizerContext = null;
  let audioVisualizerAnalyser = null;
  let audioVisualizerSourceMedia = null;
  let audioVisualizerSourceNode = null;
  let audioVisualizerWaveformBuffer = null;
  let audioVisualizerFrameId = null;
  let audioVisualizerActivatedByPlay = false;
  let audioVisualizerSourceRoute = null;
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
  function getAudioVisualizerCanvas() {
    const querySelector = getDocumentQuerySelector();
    if (querySelector === null) {
      return null;
    }
    const candidate = querySelector(WAVEFORM_CANVAS_SELECTOR);
    return isAudioVisualizerCanvas(candidate) ? candidate : null;
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
  function disconnectAudioVisualizerAnalyser() {
    if (audioVisualizerAnalyser) {
      try {
        audioVisualizerAnalyser.disconnect();
      } catch {
      }
    }
  }
  function disconnectAudioVisualizerSource() {
    if (audioVisualizerSourceNode) {
      try {
        audioVisualizerSourceNode.disconnect();
      } catch {
      }
    }
    disconnectAudioVisualizerAnalyser();
    audioVisualizerSourceRoute = null;
    audioVisualizerSourceNode = null;
    audioVisualizerSourceMedia = null;
  }
  function cancelAudioVisualizerFrame() {
    if (audioVisualizerFrameId !== null) {
      deps.windowRef.cancelAnimationFrame(audioVisualizerFrameId);
      audioVisualizerFrameId = null;
    }
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
  function routeAudioVisualizerSourceToAnalyser() {
    const context = audioVisualizerContext;
    const analyser = audioVisualizerAnalyser;
    const sourceNode = audioVisualizerSourceNode;
    if (context === null || analyser === null || sourceNode === null) {
      return false;
    }
    if (audioVisualizerSourceRoute === "analyser") {
      return true;
    }
    if (audioVisualizerSourceRoute !== null) {
      try {
        sourceNode.disconnect();
      } catch {
      }
    }
    disconnectAudioVisualizerAnalyser();
    try {
      analyser.connect(context.destination);
      sourceNode.connect(analyser);
      audioVisualizerSourceRoute = "analyser";
      return true;
    } catch {
      audioVisualizerSourceRoute = null;
      return false;
    }
  }
  function routeAudioVisualizerSourceToDestination() {
    const context = audioVisualizerContext;
    const sourceNode = audioVisualizerSourceNode;
    if (context === null || sourceNode === null) {
      return false;
    }
    if (audioVisualizerSourceRoute === "destination") {
      return true;
    }
    if (audioVisualizerSourceRoute !== null) {
      try {
        sourceNode.disconnect();
      } catch {
      }
    }
    disconnectAudioVisualizerAnalyser();
    try {
      sourceNode.connect(context.destination);
      audioVisualizerSourceRoute = "destination";
      audioVisualizerWaveformBuffer = null;
      return true;
    } catch {
      audioVisualizerSourceRoute = null;
      return false;
    }
  }
  function deactivateLiveAudioVisualizerForArtifact() {
    cancelAudioVisualizerFrame();
    routeAudioVisualizerSourceToDestination();
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
    const scale = Math.max(1, Math.min(2, deps.windowRef.devicePixelRatio || 1));
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
  function drawStaticWaveformPeaks(renderKey, peaks) {
    const canvas = getAudioVisualizerCanvas();
    if (canvas === null) {
      return false;
    }
    const preparedCanvas = prepareAudioVisualizerCanvas(canvas);
    if (preparedCanvas === null) {
      return false;
    }
    const model = getTimelineModel();
    const cropStartRatio = Math.max(0, Math.min(1, model.waveformCropStartRatio ?? 0));
    const cropEndRatio = Math.max(cropStartRatio, Math.min(1, model.waveformCropEndRatio ?? 1));
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
    renderedDecodedWaveformKey = renderKey;
    return true;
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
        return drawStaticWaveformPeaks(renderKey, cachedPeaks);
      }
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
  async function ensureAudioVisualizerGraph(media) {
    const audioContextCtor = getAudioContextCtor();
    if (audioContextCtor === null) {
      return false;
    }
    if (audioVisualizerContext === null || audioVisualizerContext.state === "closed") {
      const nextContext = new audioContextCtor();
      const nextAnalyser = nextContext.createAnalyser();
      nextAnalyser.fftSize = 2048;
      nextAnalyser.smoothingTimeConstant = 0.82;
      audioVisualizerContext = nextContext;
      audioVisualizerAnalyser = nextAnalyser;
      audioVisualizerWaveformBuffer = createWaveformBuffer(nextAnalyser.fftSize);
    }
    const context = audioVisualizerContext;
    const analyser = audioVisualizerAnalyser;
    if (analyser === null) {
      return false;
    }
    if (audioVisualizerSourceMedia !== media || audioVisualizerSourceNode === null) {
      disconnectAudioVisualizerSource();
      try {
        audioVisualizerSourceNode = context.createMediaElementSource(media);
        audioVisualizerSourceNode.connect(analyser);
        audioVisualizerSourceMedia = media;
      } catch {
        disconnectAudioVisualizerSource();
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
    if (routeAudioVisualizerSourceToAnalyser() !== true) {
      return false;
    }
    return true;
  }
  function drawAudioVisualizerFrame() {
    audioVisualizerFrameId = null;
    if (renderAudioVisualizationArtifactIfAvailable() === true) {
      return;
    }
    const media = getWorkspaceAudioPreview();
    if (media !== null && renderDecodedWaveformIfAvailable(media) === true) {
      return;
    }
    const canvas = getAudioVisualizerCanvas();
    const analyser = audioVisualizerAnalyser;
    const effectiveMode = getEffectiveAudioVisualizationMode(getVisualizationMode());
    if (canvas === null || media === null || analyser === null || audioVisualizerSourceMedia !== media || media.paused === true || effectiveMode === "none") {
      drawAudioVisualizerIdle();
      return;
    }
    const preparedCanvas = prepareAudioVisualizerCanvas(canvas);
    if (preparedCanvas === null) {
      return;
    }
    if (audioVisualizerWaveformBuffer === null || audioVisualizerWaveformBuffer.length !== audioVisualizerAnalyser?.fftSize) {
      audioVisualizerWaveformBuffer = createWaveformBuffer(analyser.fftSize);
    }
    analyser.getByteTimeDomainData(audioVisualizerWaveformBuffer);
    const { context, height, width } = preparedCanvas;
    const colors = readAudioVisualizerColors(canvas);
    const midline = height / 2;
    const bucketCount = Math.max(32, Math.min(160, Math.round(width / 5)));
    const bucketSpan = Math.max(1, Math.floor(audioVisualizerWaveformBuffer.length / bucketCount));
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
      const end = index === bucketCount - 1 ? audioVisualizerWaveformBuffer.length : Math.min(audioVisualizerWaveformBuffer.length, start + bucketSpan);
      let peak = 0;
      for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
        const sample = audioVisualizerWaveformBuffer[sampleIndex] ?? 128;
        peak = Math.max(peak, Math.abs((sample - 128) / 128));
      }
      const x = (index + 0.5) / bucketCount * width;
      const amplitude = Math.max(height * 0.04, peak * height * 0.42);
      context.moveTo(x, midline - amplitude);
      context.lineTo(x, midline + amplitude);
    }
    context.stroke();
    audioVisualizerFrameId = deps.windowRef.requestAnimationFrame(drawAudioVisualizerFrame);
  }
  function startAudioVisualizerLoop() {
    cancelAudioVisualizerFrame();
    audioVisualizerFrameId = deps.windowRef.requestAnimationFrame(drawAudioVisualizerFrame);
  }
  function stopAudioVisualizerLoop() {
    cancelAudioVisualizerFrame();
  }
  async function activateAudioVisualizer(media) {
    if (renderAudioVisualizationArtifactIfAvailable() === true) {
      deactivateLiveAudioVisualizerForArtifact();
      return;
    }
    if (renderDecodedWaveformIfAvailable(media) === true) {
      deactivateLiveAudioVisualizerForArtifact();
      return;
    }
    if (getEffectiveAudioVisualizationMode(getVisualizationMode()) === "none" || getAudioVisualizerCanvas() === null) {
      stopAudioVisualizerLoop();
      drawAudioVisualizerIdle();
      return;
    }
    if (await ensureAudioVisualizerGraph(media) !== true) {
      return;
    }
    startAudioVisualizerLoop();
  }
  function handleWorkspaceAudioPreviewPlay() {
    const media = getWorkspaceAudioPreview();
    if (media === null) {
      return;
    }
    audioVisualizerActivatedByPlay = true;
    void activateAudioVisualizer(media);
  }
  function handleWorkspaceAudioPreviewPause() {
    stopAudioVisualizerLoop();
    sync();
  }
  function handleWorkspaceAudioPreviewEnded() {
    stopAudioVisualizerLoop();
    sync();
  }
  function bindWorkspaceAudioPreviewListeners() {
    const nextPreview = getWorkspaceAudioPreview();
    if (boundWorkspaceAudioPreview === nextPreview) {
      return;
    }
    if (boundWorkspaceAudioPreview?.removeEventListener) {
      boundWorkspaceAudioPreview.removeEventListener("play", handleWorkspaceAudioPreviewPlay);
      boundWorkspaceAudioPreview.removeEventListener("pause", handleWorkspaceAudioPreviewPause);
      boundWorkspaceAudioPreview.removeEventListener("ended", handleWorkspaceAudioPreviewEnded);
    }
    if (audioVisualizerSourceMedia !== null && audioVisualizerSourceMedia !== nextPreview) {
      stopAudioVisualizerLoop();
      disconnectAudioVisualizerSource();
      audioVisualizerActivatedByPlay = false;
      resetArtifactRenderState();
      resetDecodedWaveformRenderState();
    }
    if (nextPreview?.addEventListener) {
      nextPreview.addEventListener("play", handleWorkspaceAudioPreviewPlay);
      nextPreview.addEventListener("pause", handleWorkspaceAudioPreviewPause);
      nextPreview.addEventListener("ended", handleWorkspaceAudioPreviewEnded);
    }
    boundWorkspaceAudioPreview = nextPreview;
  }
  function sync() {
    bindWorkspaceAudioPreviewListeners();
    const canvas = getAudioVisualizerCanvas();
    const effectiveMode = getEffectiveAudioVisualizationMode(getVisualizationMode());
    if (canvas === null || effectiveMode === "none") {
      resetArtifactRenderState();
      resetDecodedWaveformRenderState();
      stopAudioVisualizerLoop();
      return;
    }
    if (renderAudioVisualizationArtifactIfAvailable() === true) {
      deactivateLiveAudioVisualizerForArtifact();
      return;
    }
    const media = getWorkspaceAudioPreview();
    if (media === null) {
      resetArtifactRenderState({ preserveFailure: true });
      resetDecodedWaveformRenderState({ preserveFailure: true });
      stopAudioVisualizerLoop();
      drawAudioVisualizerIdle();
      return;
    }
    if (renderDecodedWaveformIfAvailable(media) === true) {
      deactivateLiveAudioVisualizerForArtifact();
      return;
    }
    if (media.paused === false && audioVisualizerActivatedByPlay === true) {
      resetArtifactRenderState({ preserveFailure: true });
      if (audioVisualizerSourceMedia === media && audioVisualizerAnalyser !== null) {
        if (routeAudioVisualizerSourceToAnalyser() === true) {
          startAudioVisualizerLoop();
          return;
        }
      }
      void activateAudioVisualizer(media);
      return;
    }
    resetArtifactRenderState({ preserveFailure: true });
    stopAudioVisualizerLoop();
    drawAudioVisualizerIdle();
  }
  function dispose() {
    cancelAudioVisualizerFrame();
    if (boundWorkspaceAudioPreview?.removeEventListener) {
      boundWorkspaceAudioPreview.removeEventListener("play", handleWorkspaceAudioPreviewPlay);
      boundWorkspaceAudioPreview.removeEventListener("pause", handleWorkspaceAudioPreviewPause);
      boundWorkspaceAudioPreview.removeEventListener("ended", handleWorkspaceAudioPreviewEnded);
    }
    disconnectAudioVisualizerSource();
    resetArtifactRenderState();
    resetDecodedWaveformRenderState();
    audioVisualizerActivatedByPlay = false;
    boundWorkspaceAudioPreview = null;
  }
  return {
    dispose,
    sync
  };
}
