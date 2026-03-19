interface AlphaWindowBounds {
  sourceWidth: number;
  sourceHeight: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface FrameInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SceneAlphaWindowFrameControllerOptions {
  image: HTMLImageElement;
  container: HTMLElement;
  target: HTMLElement;
  variablePrefix: string;
  alphaThreshold?: number;
}

const DEFAULT_ALPHA_THRESHOLD = 24;
const MIN_WIDTH_COVERAGE = 0.18;
const MIN_HEIGHT_COVERAGE = 0.14;
const MAX_COVERAGE = 0.98;
const MIN_DENSITY = 0.68;

const alphaWindowBoundsCache = new Map<string, Promise<AlphaWindowBounds | null>>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getImageSource(image: HTMLImageElement): string {
  const resolved = image.currentSrc || image.src || image.getAttribute("src") || "";
  return resolved.trim();
}

function clearFrameVariables(target: HTMLElement, prefix: string): void {
  target.style.removeProperty(`--${prefix}-frame-left`);
  target.style.removeProperty(`--${prefix}-frame-top`);
  target.style.removeProperty(`--${prefix}-frame-right`);
  target.style.removeProperty(`--${prefix}-frame-bottom`);
}

function applyFrameVariables(target: HTMLElement, prefix: string, frame: FrameInsets): void {
  target.style.setProperty(`--${prefix}-frame-left`, `${frame.left}%`);
  target.style.setProperty(`--${prefix}-frame-top`, `${frame.top}%`);
  target.style.setProperty(`--${prefix}-frame-right`, `${frame.right}%`);
  target.style.setProperty(`--${prefix}-frame-bottom`, `${frame.bottom}%`);
}

function projectBoundsToCoverFrame(
  container: HTMLElement,
  bounds: AlphaWindowBounds
): FrameInsets | null {
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  if (containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }

  const scale = Math.max(
    containerWidth / bounds.sourceWidth,
    containerHeight / bounds.sourceHeight
  );
  const renderedWidth = bounds.sourceWidth * scale;
  const renderedHeight = bounds.sourceHeight * scale;
  const offsetX = (containerWidth - renderedWidth) / 2;
  const offsetY = (containerHeight - renderedHeight) / 2;

  const leftPx = clamp(offsetX + bounds.left * scale, 0, containerWidth);
  const topPx = clamp(offsetY + bounds.top * scale, 0, containerHeight);
  const rightPx = clamp(offsetX + bounds.right * scale, 0, containerWidth);
  const bottomPx = clamp(offsetY + bounds.bottom * scale, 0, containerHeight);

  if (rightPx - leftPx < 1 || bottomPx - topPx < 1) {
    return null;
  }

  return {
    left: (leftPx / containerWidth) * 100,
    top: (topPx / containerHeight) * 100,
    right: ((containerWidth - rightPx) / containerWidth) * 100,
    bottom: ((containerHeight - bottomPx) / containerHeight) * 100,
  };
}

function scanTransparentBounds(
  pixels: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  alphaThreshold: number
): AlphaWindowBounds | null {
  let left = sourceWidth;
  let top = sourceHeight;
  let right = -1;
  let bottom = -1;
  let transparentCount = 0;

  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      const alpha = pixels[(y * sourceWidth + x) * 4 + 3] ?? 255;
      if (alpha > alphaThreshold) {
        continue;
      }

      transparentCount += 1;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (
    transparentCount === 0 ||
    right < left ||
    bottom < top ||
    transparentCount === sourceWidth * sourceHeight
  ) {
    return null;
  }

  const width = right - left + 1;
  const height = bottom - top + 1;
  const density = transparentCount / (width * height);
  const widthCoverage = width / sourceWidth;
  const heightCoverage = height / sourceHeight;

  if (
    widthCoverage < MIN_WIDTH_COVERAGE ||
    heightCoverage < MIN_HEIGHT_COVERAGE ||
    widthCoverage > MAX_COVERAGE ||
    heightCoverage > MAX_COVERAGE ||
    density < MIN_DENSITY
  ) {
    return null;
  }

  return {
    sourceWidth,
    sourceHeight,
    left,
    top,
    right: right + 1,
    bottom: bottom + 1,
  };
}

function loadAlphaWindowBounds(src: string, alphaThreshold: number): Promise<AlphaWindowBounds | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = (): void => {
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      if (sourceWidth <= 0 || sourceHeight <= 0) {
        resolve(null);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) {
        resolve(null);
        return;
      }

      context.clearRect(0, 0, sourceWidth, sourceHeight);
      context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
      const imageData = context.getImageData(0, 0, sourceWidth, sourceHeight);
      resolve(scanTransparentBounds(imageData.data, sourceWidth, sourceHeight, alphaThreshold));
    };

    image.onerror = (): void => {
      resolve(null);
    };

    image.src = src;
  });
}

function resolveAlphaWindowBounds(
  src: string,
  alphaThreshold: number
): Promise<AlphaWindowBounds | null> {
  const cacheKey = `${alphaThreshold}:${src}`;
  const cached = alphaWindowBoundsCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const promise = loadAlphaWindowBounds(src, alphaThreshold);
  alphaWindowBoundsCache.set(cacheKey, promise);
  return promise;
}

export class SceneAlphaWindowFrameController {
  private image: HTMLImageElement;
  private container: HTMLElement;
  private target: HTMLElement;
  private variablePrefix: string;
  private alphaThreshold: number;
  private resizeObserver: ResizeObserver | null;
  private rafId: number;
  private refreshToken: number;

  constructor(options: SceneAlphaWindowFrameControllerOptions) {
    this.image = options.image;
    this.container = options.container;
    this.target = options.target;
    this.variablePrefix = options.variablePrefix;
    this.alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
    this.resizeObserver = null;
    this.rafId = 0;
    this.refreshToken = 0;

    this.image.addEventListener("load", this.handleImageLoad);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.refresh();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  refresh(): void {
    if (this.rafId !== 0) {
      return;
    }

    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = 0;
      void this.sync();
    });
  }

  clear(): void {
    clearFrameVariables(this.target, this.variablePrefix);
  }

  disconnect(): void {
    this.image.removeEventListener("load", this.handleImageLoad);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.rafId !== 0) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private handleImageLoad = (): void => {
    this.refresh();
  };

  private async sync(): Promise<void> {
    const src = getImageSource(this.image);
    if (src === "") {
      this.clear();
      return;
    }

    const token = ++this.refreshToken;
    const bounds = await resolveAlphaWindowBounds(src, this.alphaThreshold);
    if (token !== this.refreshToken) {
      return;
    }

    if (bounds === null) {
      this.clear();
      return;
    }

    const frame = projectBoundsToCoverFrame(this.container, bounds);
    if (frame === null) {
      return;
    }

    applyFrameVariables(this.target, this.variablePrefix, frame);
  }
}
