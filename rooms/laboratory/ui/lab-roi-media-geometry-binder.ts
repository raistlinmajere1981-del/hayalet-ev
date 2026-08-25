type LaboratoryRoiMediaGeometryDeps = {
  documentRef: Document;
  windowRef: Window;
};

type Rect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

const SINGLE_STAGE_SELECTOR =
  "[data-lab-preview-inspection-stage='true'][data-lab-preview-inspection-topology^='single-']";
const MEDIA_SELECTOR =
  "video.labx-preview-media--workspace-video, img.labx-preview-media--workspace-image";
const OVERLAY_SELECTOR = "[data-lab-selection-roi-overlay='true']";
const CONTENT_SELECTOR = "[data-lab-preview-inspection-content='true']";
const FRAME_PROXY_SELECTOR = "[data-lab-roi-media-frame-proxy='true']";

function getIntrinsicAspectRatio(media: Element) {
  if (media instanceof HTMLVideoElement) {
    return media.videoWidth > 0 && media.videoHeight > 0 ? media.videoWidth / media.videoHeight : null;
  }
  if (media instanceof HTMLImageElement) {
    return media.naturalWidth > 0 && media.naturalHeight > 0
      ? media.naturalWidth / media.naturalHeight
      : null;
  }
  return null;
}

export function calculateLaboratoryContainedMediaRect(
  bounds: Rect,
  intrinsicAspectRatio: number | null
): Rect {
  if (
    intrinsicAspectRatio === null ||
    Number.isFinite(intrinsicAspectRatio) !== true ||
    intrinsicAspectRatio <= 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return { ...bounds };
  }

  const boundsAspectRatio = bounds.width / bounds.height;
  if (boundsAspectRatio > intrinsicAspectRatio) {
    const height = bounds.height;
    const width = height * intrinsicAspectRatio;
    const left = bounds.left + (bounds.width - width) / 2;
    return {
      bottom: bounds.top + height,
      height,
      left,
      right: left + width,
      top: bounds.top,
      width,
    };
  }

  const width = bounds.width;
  const height = width / intrinsicAspectRatio;
  const top = bounds.top + (bounds.height - height) / 2;
  return {
    bottom: top + height,
    height,
    left: bounds.left,
    right: bounds.left + width,
    top,
    width,
  };
}

function setPixelStyle(element: HTMLElement, property: "height" | "left" | "top" | "width", value: number) {
  const next = `${String(Math.max(0, value))}px`;
  if (element.style[property] !== next) {
    element.style[property] = next;
  }
}

function ensureFrameProxy(content: HTMLElement) {
  const existing = content.querySelector<HTMLElement>(FRAME_PROXY_SELECTOR);
  if (existing !== null) {
    return existing;
  }
  const proxy = content.ownerDocument.createElement("span");
  proxy.setAttribute("data-lab-roi-media-frame-proxy", "true");
  proxy.setAttribute("data-lab-selection-roi-frame", "true");
  proxy.setAttribute("aria-hidden", "true");
  proxy.style.position = "absolute";
  proxy.style.pointerEvents = "none";
  proxy.style.zIndex = "5";
  content.appendChild(proxy);
  return proxy;
}

export function bindLaboratoryRoiMediaGeometry(deps: LaboratoryRoiMediaGeometryDeps) {
  let mutationObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let syncFrame: number | null = null;
  const mediaListeners = new WeakSet<Element>();
  const observedElements = new WeakSet<Element>();

  function scheduleSync() {
    if (syncFrame !== null) {
      return;
    }
    syncFrame = deps.windowRef.requestAnimationFrame(function () {
      syncFrame = null;
      syncAll();
    });
  }

  function observeResize(element: Element) {
    if (resizeObserver === null || observedElements.has(element)) {
      return;
    }
    observedElements.add(element);
    resizeObserver.observe(element);
  }

  function watchMedia(media: Element) {
    if (mediaListeners.has(media)) {
      return;
    }
    mediaListeners.add(media);
    if (media instanceof HTMLVideoElement) {
      media.addEventListener("loadedmetadata", scheduleSync);
      media.addEventListener("loadeddata", scheduleSync);
    } else if (media instanceof HTMLImageElement) {
      media.addEventListener("load", scheduleSync);
    }
  }

  function syncStage(stage: HTMLElement) {
    const content = stage.querySelector<HTMLElement>(CONTENT_SELECTOR);
    const media = stage.querySelector<Element>(MEDIA_SELECTOR);
    const overlay = stage.querySelector<HTMLElement>(OVERLAY_SELECTOR);
    if (content === null || media === null || overlay === null) {
      return;
    }

    watchMedia(media);
    observeResize(stage);
    observeResize(content);
    observeResize(media);

    const contentRect = content.getBoundingClientRect();
    const mediaBounds = media.getBoundingClientRect();
    const renderedRect = calculateLaboratoryContainedMediaRect(
      mediaBounds,
      getIntrinsicAspectRatio(media)
    );
    const proxy = ensureFrameProxy(content);
    setPixelStyle(proxy, "left", renderedRect.left - contentRect.left);
    setPixelStyle(proxy, "top", renderedRect.top - contentRect.top);
    setPixelStyle(proxy, "width", renderedRect.width);
    setPixelStyle(proxy, "height", renderedRect.height);

    if (overlay.parentElement !== proxy) {
      proxy.appendChild(overlay);
    }
  }

  function syncAll() {
    deps.documentRef.querySelectorAll<HTMLElement>(SINGLE_STAGE_SELECTOR).forEach(function (stage) {
      syncStage(stage);
    });
  }

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(scheduleSync);
  }
  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver(scheduleSync);
    mutationObserver.observe(deps.documentRef.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  deps.windowRef.addEventListener("resize", scheduleSync);
  scheduleSync();

  return function detachLaboratoryRoiMediaGeometry() {
    if (syncFrame !== null) {
      deps.windowRef.cancelAnimationFrame(syncFrame);
      syncFrame = null;
    }
    mutationObserver?.disconnect();
    resizeObserver?.disconnect();
    deps.windowRef.removeEventListener("resize", scheduleSync);
  };
}
