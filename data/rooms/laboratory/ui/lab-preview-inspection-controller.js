import { asNonEmptyString, createLabEventId } from "../models/lab-types.js";
const MIN_SELECTION_ROI_SIZE_PX = 8;
const FALLBACK_FRAME_DURATION_SECONDS = 1 / 30;
function isQueryCapableElement(value) {
  return typeof value === "object" && value !== null && typeof value.querySelector === "function" && typeof value.getAttribute === "function" && typeof value.getBoundingClientRect === "function";
}
function isVideoSnapshotSource(value) {
  return typeof value === "object" && value !== null && typeof value.pause === "function" && typeof value.currentTime === "number" && typeof value.videoWidth === "number";
}
function isImageSnapshotSource(value) {
  return typeof value === "object" && value !== null && typeof value.naturalWidth === "number" && typeof value.naturalHeight === "number";
}
function isCanvasLike(value) {
  return typeof value === "object" && value !== null && typeof value.getContext === "function";
}
function getStageRect(stage) {
  const rect = stage.getBoundingClientRect();
  return {
    height: Math.max(0, rect.height),
    left: rect.left,
    top: rect.top,
    width: Math.max(0, rect.width)
  };
}
function meetsSelectionRoiSizeGuard(stageRect, roi) {
  return roi.width * stageRect.width >= MIN_SELECTION_ROI_SIZE_PX && roi.height * stageRect.height >= MIN_SELECTION_ROI_SIZE_PX;
}
function computeFocusTransform(stageRect, roi) {
  if (stageRect.width <= 0 || stageRect.height <= 0) {
    return null;
  }
  if (!meetsSelectionRoiSizeGuard(stageRect, roi)) {
    return null;
  }
  const roiWidthPx = roi.width * stageRect.width;
  const roiHeightPx = roi.height * stageRect.height;
  const scale = Math.min(stageRect.width / roiWidthPx, stageRect.height / roiHeightPx);
  const roiCenterX = (roi.x + roi.width / 2) * stageRect.width;
  const roiCenterY = (roi.y + roi.height / 2) * stageRect.height;
  return {
    scale,
    translateX: stageRect.width / 2 - roiCenterX * scale,
    translateY: stageRect.height / 2 - roiCenterY * scale
  };
}
function computeSnapshotCropRect(roi, sourceWidth, sourceHeight) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }
  const left = Math.max(0, Math.min(sourceWidth - 1, Math.round(roi.x * sourceWidth)));
  const top = Math.max(0, Math.min(sourceHeight - 1, Math.round(roi.y * sourceHeight)));
  const width = Math.max(1, Math.round(roi.width * sourceWidth));
  const height = Math.max(1, Math.round(roi.height * sourceHeight));
  const clampedWidth = Math.min(sourceWidth - left, width);
  const clampedHeight = Math.min(sourceHeight - top, height);
  if (clampedWidth <= 0 || clampedHeight <= 0) {
    return null;
  }
  return {
    height: clampedHeight,
    left,
    top,
    width: clampedWidth
  };
}
function getFocusableSelectionRoi(selection) {
  if (selection === null || selection.endMs <= selection.startMs || selection.roi === void 0) {
    return null;
  }
  return selection.roi;
}
async function canvasToPreviewUrl(canvas, windowRef) {
  const createObjectUrl = typeof windowRef.URL?.createObjectURL === "function" ? windowRef.URL.createObjectURL.bind(windowRef.URL) : null;
  if (createObjectUrl !== null && typeof canvas.toBlob === "function") {
    const blob = await new Promise(function(resolve) {
      canvas.toBlob(function(value) {
        resolve(value);
      }, "image/png");
    });
    if (blob !== null) {
      return createObjectUrl(blob);
    }
  }
  if (typeof canvas.toDataURL === "function") {
    return canvas.toDataURL("image/png");
  }
  return null;
}
function inferFrameDurationSeconds(videoElement) {
  const withPlaybackQuality = videoElement;
  const getPlaybackQuality = withPlaybackQuality.getVideoPlaybackQuality;
  const totalFrames = typeof getPlaybackQuality === "function" ? getPlaybackQuality.call(withPlaybackQuality).totalVideoFrames ?? 0 : 0;
  if (totalFrames > 1 && videoElement.currentTime > 0) {
    const inferredFps = totalFrames / videoElement.currentTime;
    if (Number.isFinite(inferredFps) && inferredFps >= 12 && inferredFps <= 240) {
      return 1 / inferredFps;
    }
  }
  return FALLBACK_FRAME_DURATION_SECONDS;
}
export const __testOnlyLabPreviewInspectionController = {
  computeFocusTransform,
  computeSnapshotCropRect
};
export function createLabPreviewInspectionController(deps) {
  let lastInspectionTopologyKey = null;
  let lastSnapshotUrl = null;
  let lastFocusedContent = null;
  let lastFocusedStage = null;
  function getInspectionStage() {
    const stage = deps.documentRef.querySelector("[data-lab-preview-inspection-stage='true']");
    return isQueryCapableElement(stage) ? stage : null;
  }
  function getInspectionContent(stage) {
    if (stage === null) {
      return null;
    }
    const content = stage.querySelector("[data-lab-preview-inspection-content='true']");
    return isQueryCapableElement(content) ? content : null;
  }
  function getInspectionMedia(stage) {
    if (stage === null) {
      return null;
    }
    const media = stage.querySelector(
      "video[data-lab-preserve-media], img[data-lab-preserve-media]"
    );
    if (isVideoSnapshotSource(media) || isImageSnapshotSource(media)) {
      return media;
    }
    return null;
  }
  function readInspectionTopologyKey(stage, media) {
    if (stage === null) {
      return "none";
    }
    const stageKey = asNonEmptyString(stage.getAttribute("data-lab-preview-inspection-topology")) || "visual";
    const mediaSource = isVideoSnapshotSource(media) || isImageSnapshotSource(media) ? asNonEmptyString(media.currentSrc) || asNonEmptyString(media.getAttribute("src")) || "local" : "no-media";
    return `${stageKey}:${mediaSource}`;
  }
  function clearFocusTransform() {
    if (lastFocusedContent?.style) {
      lastFocusedContent.style.transform = "";
      lastFocusedContent.style.transformOrigin = "";
    }
    if (lastFocusedStage) {
      lastFocusedStage.setAttribute("data-lab-roi-focus-active", "false");
    }
    lastFocusedContent = null;
    lastFocusedStage = null;
  }
  function syncSnapshotUrl(snapshot) {
    const nextUrl = snapshot?.objectUrl ?? null;
    if (lastSnapshotUrl !== null && lastSnapshotUrl !== nextUrl && lastSnapshotUrl.startsWith("blob:")) {
      try {
        deps.windowRef.URL?.revokeObjectURL?.(lastSnapshotUrl);
      } catch {
      }
    }
    lastSnapshotUrl = nextUrl;
  }
  function setFocusActive(active) {
    const selectionRoi = getFocusableSelectionRoi(deps.getActiveSelection());
    if (active !== true || selectionRoi === null) {
      deps.emit({
        type: "selection-roi-focus-cleared"
      });
      return false;
    }
    const stage = getInspectionStage();
    const content = getInspectionContent(stage);
    const transform = stage !== null && content !== null ? computeFocusTransform(getStageRect(stage), selectionRoi) : null;
    if (stage === null || content === null || transform === null) {
      return false;
    }
    deps.emit({
      type: "selection-roi-focus-set",
      active: true
    });
    return true;
  }
  function clearFocus() {
    if (deps.getRoiFocusActive() !== true) {
      return false;
    }
    deps.emit({
      type: "selection-roi-focus-cleared"
    });
    return true;
  }
  function clearSnapshot() {
    if (deps.getActiveSnapshot() === null) {
      return false;
    }
    deps.emit({
      type: "selection-roi-snapshot-cleared"
    });
    return true;
  }
  async function captureSnapshot() {
    const selectionRoi = getFocusableSelectionRoi(deps.getActiveSelection());
    const stage = getInspectionStage();
    const media = getInspectionMedia(stage);
    if (selectionRoi === null || media === null) {
      return false;
    }
    if (stage === null || !meetsSelectionRoiSizeGuard(getStageRect(stage), selectionRoi)) {
      return false;
    }
    let sourceWidth;
    let sourceHeight;
    let snapshotSourceKind = "image";
    let snapshotTimeMs = null;
    if (isVideoSnapshotSource(media)) {
      sourceWidth = media.videoWidth;
      sourceHeight = media.videoHeight;
      snapshotSourceKind = "video";
      snapshotTimeMs = Math.max(0, Math.round(media.currentTime * 1e3));
    } else {
      sourceWidth = media.naturalWidth;
      sourceHeight = media.naturalHeight;
    }
    const crop = computeSnapshotCropRect(selectionRoi, sourceWidth, sourceHeight);
    if (crop === null) {
      return false;
    }
    const canvas = deps.documentRef.createElement("canvas");
    if (!isCanvasLike(canvas)) {
      return false;
    }
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext("2d");
    if (context === null) {
      return false;
    }
    context.drawImage(
      media,
      crop.left,
      crop.top,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );
    const previewUrl = await canvasToPreviewUrl(canvas, deps.windowRef);
    if (previewUrl === null) {
      return false;
    }
    deps.emit({
      type: "selection-roi-snapshot-set",
      snapshot: {
        id: createLabEventId("roi-snapshot"),
        objectUrl: previewUrl,
        width: crop.width,
        height: crop.height,
        sourceKind: snapshotSourceKind,
        roi: selectionRoi,
        createdAt: Date.now(),
        timeMs: snapshotTimeMs
      }
    });
    return true;
  }
  function stepFrame(direction) {
    const stage = getInspectionStage();
    const media = getInspectionMedia(stage);
    if (!isVideoSnapshotSource(media)) {
      return false;
    }
    const videoElement = media;
    if (videoElement.paused !== true) {
      videoElement.pause();
    }
    const delta = inferFrameDurationSeconds(videoElement) * direction;
    const duration = Number.isFinite(videoElement.duration) && videoElement.duration > 0 ? videoElement.duration : null;
    const nextTime = Math.max(
      0,
      duration === null ? videoElement.currentTime + delta : Math.min(duration, videoElement.currentTime + delta)
    );
    videoElement.currentTime = nextTime;
    return true;
  }
  function sync() {
    const stage = getInspectionStage();
    const content = getInspectionContent(stage);
    const media = getInspectionMedia(stage);
    const topologyKey = readInspectionTopologyKey(stage, media);
    const focusActive = deps.getRoiFocusActive();
    const snapshot = deps.getActiveSnapshot();
    const selectionRoi = getFocusableSelectionRoi(deps.getActiveSelection());
    if (lastInspectionTopologyKey !== null && lastInspectionTopologyKey !== topologyKey) {
      if (focusActive === true) {
        deps.emit({
          type: "selection-roi-focus-cleared"
        });
      }
      if (snapshot !== null) {
        deps.emit({
          type: "selection-roi-snapshot-cleared"
        });
      }
    }
    lastInspectionTopologyKey = topologyKey;
    syncSnapshotUrl(snapshot);
    if (stage === null || content === null || selectionRoi === null) {
      clearFocusTransform();
      if (focusActive === true) {
        deps.emit({
          type: "selection-roi-focus-cleared"
        });
      }
      return;
    }
    const transform = computeFocusTransform(getStageRect(stage), selectionRoi);
    if (focusActive !== true || transform === null) {
      clearFocusTransform();
      if (focusActive === true && transform === null) {
        deps.emit({
          type: "selection-roi-focus-cleared"
        });
      }
      return;
    }
    if (lastFocusedContent !== null && lastFocusedContent !== content) {
      clearFocusTransform();
    }
    if (content.style) {
      content.style.transformOrigin = "0 0";
      content.style.transform = `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`;
    }
    stage.setAttribute("data-lab-roi-focus-active", "true");
    lastFocusedContent = content;
    lastFocusedStage = stage;
  }
  function dispose() {
    clearFocusTransform();
    syncSnapshotUrl(null);
  }
  return {
    captureSnapshot,
    clearFocus,
    clearSnapshot,
    dispose,
    setFocusActive,
    stepFrame,
    sync,
    toggleFocus() {
      return setFocusActive(deps.getRoiFocusActive() !== true);
    }
  };
}
