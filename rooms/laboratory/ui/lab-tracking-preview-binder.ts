type TrackingPreviewDeps = {
  documentRef: Document;
  windowRef: Window;
};

type PreviewRoi = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type SimilarityTransform = {
  dx: number;
  dy: number;
  rotationDegrees: number;
  scale: number;
};

type TrackingPoint = {
  confidence: number;
  forwardBackwardRatio: number;
  inlierRatio: number;
  quality: string;
  residualErrorPx: number;
  timeSeconds: number;
  transform: SimilarityTransform;
};

type TrackingCache = {
  algorithm: string;
  anchorSeconds: number;
  cacheId: string;
  fallbackUsed: boolean;
  mode: string;
  quality: string;
  sourceHeight: number | null;
  sourceWidth: number | null;
  transforms: TrackingPoint[];
};

type PreviewRois = {
  background: PreviewRoi | null;
  control: PreviewRoi | null;
  target: PreviewRoi | null;
};

type VisualStressRole = keyof PreviewRois;
type PreviewBoxKind = "raw" | "stabilized";

const ROLE_LABELS: Record<VisualStressRole, string> = {
  target: "Target",
  control: "Control",
  background: "Background",
};

let attached = false;

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asTransform(value: unknown): SimilarityTransform | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const dx = finite(record["dx"]);
  const dy = finite(record["dy"]);
  const rotationDegrees = finite(record["rotationDegrees"]);
  const scale = finite(record["scale"]);
  if (dx === null || dy === null || rotationDegrees === null || scale === null) return null;
  return { dx, dy, rotationDegrees, scale };
}

function readTrackingPoint(value: unknown): TrackingPoint | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const timeSeconds = finite(record["timeSeconds"]);
  const confidence = finite(record["confidence"]);
  const inlierRatio = finite(record["inlierRatio"]);
  const forwardBackwardRatio = finite(record["forwardBackwardRatio"]);
  const residualErrorPx = finite(record["residualErrorPx"]);
  const transform = asTransform(record["transform"]);
  if (
    timeSeconds === null ||
    confidence === null ||
    inlierRatio === null ||
    forwardBackwardRatio === null ||
    residualErrorPx === null ||
    transform === null
  ) {
    return null;
  }
  return {
    timeSeconds,
    confidence,
    inlierRatio,
    forwardBackwardRatio,
    residualErrorPx,
    quality: typeof record["quality"] === "string" ? record["quality"] : "unreliable",
    transform,
  };
}

function readCache(surface: HTMLElement | null): TrackingCache | null {
  const raw = surface?.getAttribute("data-lab-tracking-preview-cache-json");
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const anchorSeconds = finite(record["anchorSeconds"]);
  const rawTransforms = Array.isArray(record["transforms"])
    ? record["transforms"]
    : Array.isArray(record["transformSeries"])
      ? record["transformSeries"]
      : [];
  const transforms = rawTransforms
    .map(readTrackingPoint)
    .filter((entry): entry is TrackingPoint => entry !== null)
    .sort(function (left, right) {
      return left.timeSeconds - right.timeSeconds;
    });
  if (
    record["algorithm"] !== "feature-similarity-ransac-v2" ||
    anchorSeconds === null ||
    transforms.length === 0
  ) {
    return null;
  }
  return {
    algorithm: "feature-similarity-ransac-v2",
    anchorSeconds,
    cacheId: typeof record["cacheId"] === "string" ? record["cacheId"] : "unknown",
    fallbackUsed: record["fallbackUsed"] === true,
    mode: typeof record["mode"] === "string" ? record["mode"] : "unknown",
    quality: typeof record["quality"] === "string" ? record["quality"] : "unreliable",
    sourceHeight: finite(record["sourceHeight"]),
    sourceWidth: finite(record["sourceWidth"]),
    transforms,
  };
}

function readRoi(value: unknown): PreviewRoi | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const x = finite(record["x"]);
  const y = finite(record["y"]);
  const width = finite(record["width"]);
  const height = finite(record["height"]);
  if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

function readRois(surface: HTMLElement): PreviewRois {
  const raw = surface.getAttribute("data-lab-tracking-preview-rois-json");
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw ?? "null") as unknown;
  } catch {
    // Malformed UI attributes are treated as an empty ROI set.
  }
  const record =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return {
    target: readRoi(record["target"]),
    control: readRoi(record["control"]),
    background: readRoi(record["background"]),
  };
}

function interpolateAngle(left: number, right: number, ratio: number) {
  let delta = right - left;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return left + delta * ratio;
}

function interpolatePoint(cache: TrackingCache, timeSeconds: number): TrackingPoint | null {
  const points = cache.transforms;
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return null;
  if (timeSeconds <= first.timeSeconds) {
    return Math.abs(timeSeconds - first.timeSeconds) <= 0.35 ? first : null;
  }
  if (timeSeconds >= last.timeSeconds) {
    return Math.abs(timeSeconds - last.timeSeconds) <= 0.35 ? last : null;
  }
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    const left = points[index - 1];
    if (left === undefined || right === undefined || timeSeconds > right.timeSeconds) continue;
    const span = Math.max(1e-6, right.timeSeconds - left.timeSeconds);
    const ratio = Math.max(0, Math.min(1, (timeSeconds - left.timeSeconds) / span));
    const mix = function (a: number, b: number) {
      return a + (b - a) * ratio;
    };
    return {
      timeSeconds,
      confidence: mix(left.confidence, right.confidence),
      inlierRatio: mix(left.inlierRatio, right.inlierRatio),
      forwardBackwardRatio: mix(left.forwardBackwardRatio, right.forwardBackwardRatio),
      residualErrorPx: mix(left.residualErrorPx, right.residualErrorPx),
      quality: left.confidence <= right.confidence ? left.quality : right.quality,
      transform: {
        dx: mix(left.transform.dx, right.transform.dx),
        dy: mix(left.transform.dy, right.transform.dy),
        rotationDegrees: interpolateAngle(
          left.transform.rotationDegrees,
          right.transform.rotationDegrees,
          ratio
        ),
        scale: mix(left.transform.scale, right.transform.scale),
      },
    };
  }
  return null;
}

export function applyTrackingPreviewTransform(
  roi: PreviewRoi,
  transform: SimilarityTransform,
  sourceWidth: number,
  sourceHeight: number
): PreviewRoi {
  const angle = (transform.rotationDegrees * Math.PI) / 180;
  const cosScale = Math.cos(angle) * transform.scale;
  const sinScale = Math.sin(angle) * transform.scale;
  const corners = [
    { x: roi.x * sourceWidth, y: roi.y * sourceHeight },
    { x: (roi.x + roi.width) * sourceWidth, y: roi.y * sourceHeight },
    { x: roi.x * sourceWidth, y: (roi.y + roi.height) * sourceHeight },
    { x: (roi.x + roi.width) * sourceWidth, y: (roi.y + roi.height) * sourceHeight },
  ].map(function (point) {
    return {
      x: cosScale * point.x - sinScale * point.y + transform.dx,
      y: sinScale * point.x + cosScale * point.y + transform.dy,
    };
  });
  const minX = Math.max(0, Math.min(sourceWidth - 1, Math.min(...corners.map((point) => point.x))));
  const maxX = Math.max(
    minX + 1,
    Math.min(sourceWidth, Math.max(...corners.map((point) => point.x)))
  );
  const minY = Math.max(
    0,
    Math.min(sourceHeight - 1, Math.min(...corners.map((point) => point.y)))
  );
  const maxY = Math.max(
    minY + 1,
    Math.min(sourceHeight, Math.max(...corners.map((point) => point.y)))
  );
  return {
    x: minX / sourceWidth,
    y: minY / sourceHeight,
    width: (maxX - minX) / sourceWidth,
    height: (maxY - minY) / sourceHeight,
  };
}

function setElementText(element: HTMLElement | null, value: string) {
  if (element !== null && element.textContent !== value) element.textContent = value;
}

function boxSelector(role: VisualStressRole, kind: PreviewBoxKind) {
  return `[data-lab-tracking-preview-box="${kind}"][data-lab-tracking-preview-role="${role}"]`;
}

function ensureBox(
  documentRef: Document,
  frame: HTMLElement,
  role: VisualStressRole,
  kind: PreviewBoxKind
) {
  let box = frame.querySelector<HTMLElement>(boxSelector(role, kind));
  if (box !== null) return box;
  box = documentRef.createElement("div");
  box.className = `labx-tracking-preview-box labx-tracking-preview-box--${role} labx-tracking-preview-box--${kind}`;
  box.setAttribute("data-lab-tracking-preview-box", kind);
  box.setAttribute("data-lab-tracking-preview-role", role);
  const label = documentRef.createElement("span");
  label.className = "labx-tracking-preview-box__label";
  label.textContent = `${ROLE_LABELS[role]} ${kind}`;
  box.appendChild(label);
  frame.appendChild(box);
  return box;
}

function positionBox(box: HTMLElement, roi: PreviewRoi) {
  box.style.left = `${String(roi.x * 100)}%`;
  box.style.top = `${String(roi.y * 100)}%`;
  box.style.width = `${String(roi.width * 100)}%`;
  box.style.height = `${String(roi.height * 100)}%`;
}

function removeStabilizedBoxes(frame: HTMLElement) {
  frame
    .querySelectorAll<HTMLElement>('[data-lab-tracking-preview-box="stabilized"]')
    .forEach(function (box) {
      box.remove();
    });
}

function syncVideoFrame(video: HTMLVideoElement, shell: HTMLElement, frame: HTMLElement) {
  const width = shell.clientWidth;
  const height = shell.clientHeight;
  const intrinsicWidth = video.videoWidth;
  const intrinsicHeight = video.videoHeight;
  if (width <= 0 || height <= 0 || intrinsicWidth <= 0 || intrinsicHeight <= 0) return false;
  const scale = Math.min(width / intrinsicWidth, height / intrinsicHeight);
  const renderedWidth = intrinsicWidth * scale;
  const renderedHeight = intrinsicHeight * scale;
  frame.style.left = `${String((width - renderedWidth) / 2)}px`;
  frame.style.top = `${String((height - renderedHeight) / 2)}px`;
  frame.style.width = `${String(renderedWidth)}px`;
  frame.style.height = `${String(renderedHeight)}px`;
  return true;
}

export function bindLaboratoryTrackingPreview(deps: TrackingPreviewDeps) {
  if (attached) return function noop() {};
  attached = true;
  let mutationObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let observedShell: HTMLElement | null = null;

  function getSurface() {
    return deps.documentRef.querySelector<HTMLElement>(
      '[data-lab-tracking-preview-surface="true"]'
    );
  }

  function getMainVideo() {
    return deps.documentRef.querySelector<HTMLVideoElement>(
      'video[data-lab-preserve-media="workspace-preview"]'
    );
  }

  function getTrackingVideo(surface: HTMLElement | null) {
    return (
      surface?.querySelector<HTMLVideoElement>('[data-lab-tracking-preview-video="true"]') ?? null
    );
  }

  function isCacheUsable(cache: TrackingCache | null) {
    return (
      cache !== null &&
      cache.fallbackUsed !== true &&
      cache.quality !== "unreliable" &&
      cache.transforms.length > 0
    );
  }

  function isActive(surface: HTMLElement | null) {
    return (
      surface !== null &&
      surface.hidden !== true &&
      surface.getAttribute("data-lab-tracking-preview-active") === "true"
    );
  }

  function syncInitialTime(video: HTMLVideoElement, cache: TrackingCache) {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    const mainVideo = getMainVideo();
    const mainTime = mainVideo?.currentTime;
    const candidate = typeof mainTime === "number" ? mainTime : cache.anchorSeconds;
    if (Number.isFinite(candidate)) {
      const duration = Number.isFinite(video.duration) ? video.duration : candidate;
      const boundedCandidate = Math.max(0, Math.min(candidate, duration));
      try {
        if (Math.abs(video.currentTime - boundedCandidate) > 0.04) {
          video.currentTime = boundedCandidate;
        }
      } catch {
        return;
      }
    }
    if (mainVideo !== null) {
      video.playbackRate = mainVideo.playbackRate;
      if (mainVideo.paused) {
        if (!video.paused) video.pause();
      } else if (video.paused) {
        void video.play().catch(function () {});
      }
    }
    video.setAttribute("data-lab-tracking-preview-synced-cache-id", cache.cacheId);
  }

  function render() {
    const surface = getSurface();
    if (!isActive(surface)) return;
    const cache = readCache(surface);
    const video = getTrackingVideo(surface);
    const shell =
      surface?.querySelector<HTMLElement>('[data-lab-tracking-preview-media-shell="true"]') ?? null;
    const frame =
      surface?.querySelector<HTMLElement>('[data-lab-tracking-preview-frame="true"]') ?? null;
    const detail =
      surface?.querySelector<HTMLElement>('[data-lab-tracking-preview-detail="true"]') ?? null;
    if (
      surface === null ||
      cache === null ||
      video === null ||
      shell === null ||
      frame === null ||
      !isCacheUsable(cache)
    ) {
      return;
    }
    syncInitialTime(video, cache);
    if (!syncVideoFrame(video, shell, frame)) return;
    const sourceWidth = cache.sourceWidth ?? (video.videoWidth > 0 ? video.videoWidth : null);
    const sourceHeight = cache.sourceHeight ?? (video.videoHeight > 0 ? video.videoHeight : null);
    if (sourceWidth === null || sourceHeight === null) return;
    const rois = readRois(surface);
    (Object.keys(rois) as VisualStressRole[]).forEach(function (role) {
      const roi = rois[role];
      const existingRaw = frame.querySelector<HTMLElement>(boxSelector(role, "raw"));
      if (roi === null) {
        existingRaw?.remove();
        frame.querySelector<HTMLElement>(boxSelector(role, "stabilized"))?.remove();
        return;
      }
      positionBox(ensureBox(deps.documentRef, frame, role, "raw"), roi);
    });

    const point = interpolatePoint(cache, video.currentTime);
    if (point === null || point.quality === "unreliable" || point.confidence < 0.38) {
      removeStabilizedBoxes(frame);
      setElementText(
        detail,
        `t=${video.currentTime.toFixed(3)} s · bu zaman cache aralığı dışında veya tracking güvenilir değil.`
      );
      return;
    }
    (Object.keys(rois) as VisualStressRole[]).forEach(function (role) {
      const roi = rois[role];
      if (roi === null) return;
      const corrected = applyTrackingPreviewTransform(
        roi,
        point.transform,
        sourceWidth,
        sourceHeight
      );
      positionBox(ensureBox(deps.documentRef, frame, role, "stabilized"), corrected);
    });
    setElementText(
      detail,
      `t=${video.currentTime.toFixed(3)} s · ${point.quality.toUpperCase()} · confidence ${Math.round(point.confidence * 100)}% · inlier ${Math.round(point.inlierRatio * 100)}% · FB ${Math.round(point.forwardBackwardRatio * 100)}% · dx/dy ${point.transform.dx.toFixed(1)}/${point.transform.dy.toFixed(1)} px · rot ${point.transform.rotationDegrees.toFixed(2)}° · scale ${point.transform.scale.toFixed(4)} · residual ${point.residualErrorPx.toFixed(2)} px`
    );
  }

  function handleMediaEvent(event: Event) {
    if (!(event.target instanceof HTMLVideoElement)) return;
    if (event.target.getAttribute("data-lab-tracking-preview-video") === "true") {
      render();
      return;
    }
    if (event.target.getAttribute("data-lab-preserve-media") !== "workspace-preview") return;
    const surface = getSurface();
    const trackingVideo = getTrackingVideo(surface);
    const cache = readCache(surface);
    if (!isActive(surface) || trackingVideo === null || cache === null) return;
    syncInitialTime(trackingVideo, cache);
    render();
  }

  function handleResize() {
    render();
  }

  function syncResizeTarget() {
    if (resizeObserver === null) return;
    const shell =
      getSurface()?.querySelector<HTMLElement>('[data-lab-tracking-preview-media-shell="true"]') ??
      null;
    if (shell === observedShell) return;
    resizeObserver.disconnect();
    observedShell = shell;
    if (shell !== null) resizeObserver.observe(shell);
  }

  deps.documentRef.addEventListener("timeupdate", handleMediaEvent, true);
  deps.documentRef.addEventListener("seeking", handleMediaEvent, true);
  deps.documentRef.addEventListener("seeked", handleMediaEvent, true);
  deps.documentRef.addEventListener("loadedmetadata", handleMediaEvent, true);
  deps.documentRef.addEventListener("play", handleMediaEvent, true);
  deps.documentRef.addEventListener("pause", handleMediaEvent, true);
  deps.documentRef.addEventListener("ratechange", handleMediaEvent, true);
  deps.windowRef.addEventListener("resize", handleResize);
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(handleResize);
    syncResizeTarget();
  }
  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver(function () {
      syncResizeTarget();
      render();
    });
    mutationObserver.observe(deps.documentRef.documentElement, {
      attributeFilter: ["data-lab-tracking-preview-active", "hidden", "src"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }
  syncResizeTarget();
  render();

  return function detach() {
    deps.documentRef.removeEventListener("timeupdate", handleMediaEvent, true);
    deps.documentRef.removeEventListener("seeking", handleMediaEvent, true);
    deps.documentRef.removeEventListener("seeked", handleMediaEvent, true);
    deps.documentRef.removeEventListener("loadedmetadata", handleMediaEvent, true);
    deps.documentRef.removeEventListener("play", handleMediaEvent, true);
    deps.documentRef.removeEventListener("pause", handleMediaEvent, true);
    deps.documentRef.removeEventListener("ratechange", handleMediaEvent, true);
    deps.windowRef.removeEventListener("resize", handleResize);
    mutationObserver?.disconnect();
    mutationObserver = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    observedShell = null;
    attached = false;
  };
}
