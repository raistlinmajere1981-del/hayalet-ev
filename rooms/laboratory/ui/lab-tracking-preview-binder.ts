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
  sourceHeight: number;
  sourceWidth: number;
  transforms: TrackingPoint[];
};

type VisualStressRole = "target" | "control" | "background";

const PREVIEW_SELECTOR = "[data-lab-tracking-preview-stabilized='true']";
const ROLE_SELECTOR = "[data-lab-visual-stress-roi-role]";

let attached = false;

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parsePercent(value: string) {
  const trimmed = value.trim();
  if (!trimmed.endsWith("%")) return null;
  const numeric = Number(trimmed.slice(0, -1));
  return Number.isFinite(numeric) ? numeric / 100 : null;
}

function readRoi(element: HTMLElement): PreviewRoi | null {
  const x = parsePercent(element.style.left);
  const y = parsePercent(element.style.top);
  const width = parsePercent(element.style.width);
  const height = parsePercent(element.style.height);
  if (x === null || y === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
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

function readCache(root: HTMLElement): TrackingCache | null {
  const raw = root.getAttribute("data-lab-camera-tracking-cache-json");
  if (raw === null || raw.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const sourceWidth = finite(record["sourceWidth"]);
  const sourceHeight = finite(record["sourceHeight"]);
  const anchorSeconds = finite(record["anchorSeconds"]);
  const transforms = Array.isArray(record["transforms"])
    ? record["transforms"]
        .map(readTrackingPoint)
        .filter((entry): entry is TrackingPoint => entry !== null)
        .sort(function (left, right) {
          return left.timeSeconds - right.timeSeconds;
        })
    : [];
  if (
    sourceWidth === null ||
    sourceHeight === null ||
    anchorSeconds === null ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    transforms.length === 0
  ) {
    return null;
  }
  return {
    algorithm: typeof record["algorithm"] === "string" ? record["algorithm"] : "unknown",
    anchorSeconds,
    cacheId: typeof record["cacheId"] === "string" ? record["cacheId"] : "unknown",
    fallbackUsed: record["fallbackUsed"] === true,
    mode: typeof record["mode"] === "string" ? record["mode"] : "unknown",
    quality: typeof record["quality"] === "string" ? record["quality"] : "unreliable",
    sourceHeight,
    sourceWidth,
    transforms,
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
    if (left === undefined || right === undefined) continue;
    if (timeSeconds > right.timeSeconds) continue;
    const span = Math.max(1e-6, right.timeSeconds - left.timeSeconds);
    const ratio = Math.max(0, Math.min(1, (timeSeconds - left.timeSeconds) / span));
    const mix = function (a: number, b: number) {
      return a + (b - a) * ratio;
    };
    const quality = left.confidence <= right.confidence ? left.quality : right.quality;
    return {
      timeSeconds,
      confidence: mix(left.confidence, right.confidence),
      inlierRatio: mix(left.inlierRatio, right.inlierRatio),
      forwardBackwardRatio: mix(left.forwardBackwardRatio, right.forwardBackwardRatio),
      residualErrorPx: mix(left.residualErrorPx, right.residualErrorPx),
      quality,
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
  const minX = Math.max(0, Math.min(sourceWidth - 1, Math.min(...corners.map((p) => p.x))));
  const maxX = Math.max(minX + 1, Math.min(sourceWidth, Math.max(...corners.map((p) => p.x))));
  const minY = Math.max(0, Math.min(sourceHeight - 1, Math.min(...corners.map((p) => p.y))));
  const maxY = Math.max(minY + 1, Math.min(sourceHeight, Math.max(...corners.map((p) => p.y))));
  return {
    x: minX / sourceWidth,
    y: minY / sourceHeight,
    width: (maxX - minX) / sourceWidth,
    height: (maxY - minY) / sourceHeight,
  };
}

function roleOf(element: HTMLElement): VisualStressRole | null {
  const role = element.getAttribute("data-lab-visual-stress-roi-role");
  return role === "target" || role === "control" || role === "background" ? role : null;
}

function createPreviewElement(
  deps: TrackingPreviewDeps,
  overlay: HTMLElement,
  raw: HTMLElement,
  role: VisualStressRole
) {
  const preview = deps.documentRef.createElement("div");
  preview.setAttribute("data-lab-tracking-preview-stabilized", "true");
  preview.setAttribute("data-lab-tracking-preview-role", role);
  preview.setAttribute("aria-hidden", "true");
  preview.style.position = "absolute";
  preview.style.pointerEvents = "none";
  preview.style.boxSizing = "border-box";
  preview.style.border = "2px dashed";
  preview.style.zIndex = "14";
  preview.style.opacity = "0.95";
  preview.style.borderColor = deps.windowRef.getComputedStyle(raw).borderTopColor;
  overlay.appendChild(preview);
  return preview;
}

function removePreviewElements(documentRef: Document) {
  documentRef.querySelectorAll<HTMLElement>(PREVIEW_SELECTOR).forEach(function (element) {
    element.remove();
  });
}

export function bindLaboratoryTrackingPreview(deps: TrackingPreviewDeps) {
  if (attached) return function noop() {};
  attached = true;
  let active = false;
  let mutationObserver: MutationObserver | null = null;

  function getRoot() {
    return deps.documentRef.querySelector<HTMLElement>(
      '[data-lab-transform-stack="visual"][data-lab-transform-source-kind="video"]'
    );
  }

  function getVideo() {
    return deps.documentRef.querySelector<HTMLVideoElement>(
      'video[data-lab-preserve-media="workspace-preview"]'
    );
  }

  function setButtonState() {
    const root = getRoot();
    const button = root?.querySelector<HTMLButtonElement>(
      '[data-lab-action="workspace-tracking-preview-toggle"]'
    );
    if (button !== null && button !== undefined) {
      button.textContent = active ? "Tracking Preview Kapat" : "Tracking Preview";
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function setStatus(message: string) {
    const status = getRoot()?.querySelector<HTMLElement>("[data-lab-tracking-preview-status='true']");
    if (status !== null && status !== undefined && status.textContent !== message) {
      status.textContent = message;
    }
  }

  function render() {
    if (!active) {
      removePreviewElements(deps.documentRef);
      return;
    }
    const root = getRoot();
    const video = getVideo();
    const overlay = deps.documentRef.querySelector<HTMLElement>(
      "[data-lab-selection-roi-overlay='true']"
    );
    if (root === null || video === null || overlay === null) return;
    const cache = readCache(root);
    if (cache === null || cache.fallbackUsed) {
      removePreviewElements(deps.documentRef);
      setStatus("Tracking Preview kullanılamıyor: güvenilir v2 transform cache yok.");
      return;
    }
    const point = interpolatePoint(cache, video.currentTime);
    if (point === null || point.quality === "unreliable" || point.confidence < 0.38) {
      removePreviewElements(deps.documentRef);
      setStatus(`t=${video.currentTime.toFixed(3)} s · tracking bu anda güvenilir değil`);
      return;
    }
    const rawElements = Array.from(
      overlay.querySelectorAll<HTMLElement>(`${ROLE_SELECTOR}:not([hidden])`)
    );
    const liveRoles = new Set<VisualStressRole>();
    rawElements.forEach(function (raw) {
      const role = roleOf(raw);
      const roi = readRoi(raw);
      if (role === null || roi === null) return;
      liveRoles.add(role);
      const corrected = applyTrackingPreviewTransform(
        roi,
        point.transform,
        cache.sourceWidth,
        cache.sourceHeight
      );
      let preview = overlay.querySelector<HTMLElement>(
        `${PREVIEW_SELECTOR}[data-lab-tracking-preview-role="${role}"]`
      );
      if (preview === null) preview = createPreviewElement(deps, overlay, raw, role);
      preview.style.left = `${String(corrected.x * 100)}%`;
      preview.style.top = `${String(corrected.y * 100)}%`;
      preview.style.width = `${String(corrected.width * 100)}%`;
      preview.style.height = `${String(corrected.height * 100)}%`;
    });
    overlay.querySelectorAll<HTMLElement>(PREVIEW_SELECTOR).forEach(function (preview) {
      const role = roleOf(preview) ??
        (preview.getAttribute("data-lab-tracking-preview-role") as VisualStressRole | null);
      if (role === null || !liveRoles.has(role)) preview.remove();
    });
    setStatus(
      `t=${video.currentTime.toFixed(3)} s · ${point.quality.toUpperCase()} · confidence ${Math.round(point.confidence * 100)}% · inlier ${Math.round(point.inlierRatio * 100)}% · FB ${Math.round(point.forwardBackwardRatio * 100)}% · dx/dy ${point.transform.dx.toFixed(1)}/${point.transform.dy.toFixed(1)} px · rot ${point.transform.rotationDegrees.toFixed(2)}° · scale ${point.transform.scale.toFixed(4)} · residual ${point.residualErrorPx.toFixed(2)} px`
    );
  }

  function handleClick(event: Event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLElement>(
      '[data-lab-action="workspace-tracking-preview-toggle"]'
    );
    if (button === null) return;
    event.preventDefault();
    active = !active;
    if (!active) removePreviewElements(deps.documentRef);
    setButtonState();
    render();
  }

  function handleMediaEvent(event: Event) {
    if (!active || !(event.target instanceof HTMLVideoElement)) return;
    if (event.target.getAttribute("data-lab-preserve-media") !== "workspace-preview") return;
    render();
  }

  deps.documentRef.addEventListener("click", handleClick);
  deps.documentRef.addEventListener("timeupdate", handleMediaEvent, true);
  deps.documentRef.addEventListener("seeking", handleMediaEvent, true);
  deps.documentRef.addEventListener("seeked", handleMediaEvent, true);
  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver(function () {
      setButtonState();
      if (active) render();
    });
    mutationObserver.observe(deps.documentRef.documentElement, { childList: true, subtree: true });
  }
  setButtonState();

  return function detach() {
    deps.documentRef.removeEventListener("click", handleClick);
    deps.documentRef.removeEventListener("timeupdate", handleMediaEvent, true);
    deps.documentRef.removeEventListener("seeking", handleMediaEvent, true);
    deps.documentRef.removeEventListener("seeked", handleMediaEvent, true);
    mutationObserver?.disconnect();
    mutationObserver = null;
    removePreviewElements(deps.documentRef);
    active = false;
    attached = false;
  };
}
