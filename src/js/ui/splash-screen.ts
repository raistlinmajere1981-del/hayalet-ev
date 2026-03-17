import { LogCategory } from "@shared/logging-core";
import { Logger } from "../modules/logger/index.js";
import { MINIMUM_DISPLAY_TIME, HIDE_ANIMATION_DURATION } from "@ui-constants";
import { AppI18n } from "../modules/i18n/index.js";
import { SCENE_THEME_CONFIG } from "../scene/scene-config.js";
import { getCurrentUiMode, isSceneUiMode, type UiMode } from "./ui-mode.js";

interface SplashElements {
  container: HTMLElement | null;
  progress: HTMLElement | null;
  status: HTMLElement | null;
  logo: HTMLElement | null;
}

const ELEMENT_IDS = {
  container: "splash-screen",
  progress: "splash-progress",
  status: "splash-status",
  logo: "splash-logo",
};

let elements: SplashElements = {
  container: null,
  progress: null,
  status: null,
  logo: null,
};

let showTime: number = 0;
let currentProgress: number = 0;
let isVisible: boolean = false;
let isInitialized: boolean = false;
let sceneAnimationTimer: ReturnType<typeof setInterval> | null = null;
let sceneFrameIndex: number = 0;
let sceneAnimationCompleted: boolean = false;

function createClassicSplashMarkup(): string {
  const title = AppI18n.t("app.documentTitle");
  const versionLabel = AppI18n.t("app.splash.version");

  return `
    <div class="splash-content">
      <div class="splash-logo-container">
        <img src="/assets/logo.jpg" alt="${title}" class="splash-logo" id="${ELEMENT_IDS.logo}" />
        <div class="splash-logo-glow"></div>
      </div>
      <h1 class="splash-title">${title}</h1>
      <p class="splash-version">${versionLabel}</p>
      <div class="splash-loader">
        <div class="splash-progress" id="${ELEMENT_IDS.progress}"></div>
      </div>
      <p class="splash-status" id="${ELEMENT_IDS.status}">${AppI18n.t("app.startup.starting")}</p>
    </div>
  `;
}

function createSceneSplashMarkup(): string {
  const title = AppI18n.t("app.documentTitle");
  const versionLabel = AppI18n.t("app.splash.version");
  const frameMarkup = SCENE_THEME_CONFIG.loading.frames
    .map(
      (frameSrc, index) => `
        <img
          src="${frameSrc}"
          alt=""
          class="splash-scene-frame${index === 0 ? " is-active" : ""}"
          data-scene-frame-index="${index}"
        />
      `
    )
    .join("");

  return `
    <div class="splash-content splash-content--scene">
      <div class="splash-scene-stage" id="${ELEMENT_IDS.logo}">
        <div class="splash-scene-door">${frameMarkup}</div>
      </div>
      <div class="splash-scene-copy">
        <p class="splash-scene-kicker">${SCENE_THEME_CONFIG.themeId}</p>
        <h1 class="splash-title">${title}</h1>
        <p class="splash-version">${versionLabel}</p>
        <div class="splash-loader">
          <div class="splash-progress" id="${ELEMENT_IDS.progress}"></div>
        </div>
        <p class="splash-status" id="${ELEMENT_IDS.status}">${AppI18n.t("app.startup.starting")}</p>
      </div>
    </div>
  `;
}

function buildSplashMarkup(uiMode: UiMode): string {
  return uiMode === "scene" ? createSceneSplashMarkup() : createClassicSplashMarkup();
}

function stopSceneAnimation(): void {
  if (sceneAnimationTimer !== null) {
    clearInterval(sceneAnimationTimer);
    sceneAnimationTimer = null;
  }
}

function resetSceneAnimation(): void {
  stopSceneAnimation();
  sceneFrameIndex = 0;
  sceneAnimationCompleted = false;
  setSceneFrame(sceneFrameIndex);
}

function setSceneFrame(index: number): void {
  const frames = Array.from(document.querySelectorAll<HTMLImageElement>(".splash-scene-frame"));
  frames.forEach((frame, frameIndex) => {
    frame.classList.toggle("is-active", frameIndex === index);
  });
}

function startSceneAnimation(): void {
  if (!isSceneUiMode()) {
    stopSceneAnimation();
    return;
  }

  const frameCount = Number(SCENE_THEME_CONFIG.loading.frames.length);
  if (frameCount <= 1) {
    setSceneFrame(0);
    sceneAnimationCompleted = true;
    return;
  }

  if (sceneAnimationTimer !== null || sceneAnimationCompleted) {
    return;
  }

  setSceneFrame(sceneFrameIndex);
  sceneAnimationTimer = setInterval(() => {
    if (sceneFrameIndex >= frameCount - 1) {
      sceneAnimationCompleted = true;
      stopSceneAnimation();
      return;
    }

    sceneFrameIndex += 1;
    setSceneFrame(sceneFrameIndex);

    if (sceneFrameIndex >= frameCount - 1) {
      sceneAnimationCompleted = true;
      stopSceneAnimation();
    }
  }, SCENE_THEME_CONFIG.loading.frameDurationMs);
}

function syncSplashVariant(): void {
  const container = document.getElementById(ELEMENT_IDS.container);
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const uiMode = getCurrentUiMode();
  if (container.dataset["uiMode"] === uiMode) {
    return;
  }

  container.dataset["uiMode"] = uiMode;
  container.innerHTML = buildSplashMarkup(uiMode);
  resetSceneAnimation();
  if (uiMode !== "scene") {
    stopSceneAnimation();
  }
  isInitialized = false;
}

function getElements(): SplashElements {
  syncSplashVariant();
  if (!isInitialized) {
    elements = {
      container: document.getElementById(ELEMENT_IDS.container),
      progress: document.getElementById(ELEMENT_IDS.progress),
      status: document.getElementById(ELEMENT_IDS.status),
      logo: document.getElementById(ELEMENT_IDS.logo) as HTMLImageElement | null,
    };
    isInitialized = true;
  }
  return elements;
}

function logSplashDebug(
  key: string,
  params?: Record<string, string | number>,
  context?: Record<string, unknown>
): void {
  Logger.debugT(LogCategory.UI_SPLASH, `app.logs.${key}`, params, context);
}

function createSplashElement(): HTMLElement {
  const splash = document.createElement("div");
  splash.id = ELEMENT_IDS.container;
  splash.className = "splash";
  splash.dataset["uiMode"] = getCurrentUiMode();
  splash.innerHTML = buildSplashMarkup(getCurrentUiMode());

  return splash;
}

const splashScreen = {
  show(): void {
    let container = getElements().container;

    if (!container) {
      container = createSplashElement();
      document.body.insertBefore(container, document.body.firstChild);
      isInitialized = false; // NOTE: Force re-fetch after injecting DOM.
      getElements();
    }

    container.classList.remove("is-hidden", "splash-hiding");
    showTime = Date.now();
    isVisible = true;
    currentProgress = 0;
    resetSceneAnimation();
    startSceneAnimation();

    logSplashDebug("splashShown", undefined, { timestamp: showTime });
  },

  async hide(): Promise<void> {
    const { container } = getElements();
    if (!container || !isVisible) return;

    const elapsed = Date.now() - showTime;
    const remainingTime = Math.max(0, MINIMUM_DISPLAY_TIME - elapsed);

    if (remainingTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
    }

    container.classList.add("splash-hiding");

    await new Promise((resolve) => setTimeout(resolve, HIDE_ANIMATION_DURATION));

    stopSceneAnimation();
    container.remove();
    isVisible = false;
    isInitialized = false;
    elements = { container: null, progress: null, status: null, logo: null };

    logSplashDebug("splashRemoved", undefined, {
      totalTime: Date.now() - showTime,
    });
  },

  setProgress(percent: number): void {
    const { progress } = getElements();
    if (!progress) return;

    const value = Math.max(0, Math.min(100, percent));
    currentProgress = value;

    progress.classList.remove("indeterminate");

    // NOTE: Progress is runtime-driven via CSS var to avoid width injection.
    progress.style.setProperty("--splash-progress", `${value}%`);

    logSplashDebug("splashProgressUpdated", undefined, { percent: value });
  },

  setIndeterminate(): void {
    const { progress } = getElements();
    if (!progress) return;

    progress.style.removeProperty("--splash-progress");
    progress.classList.add("indeterminate");
  },

  setStatus(message: string): void {
    const { status } = getElements();
    if (!status) return;

    status.textContent = message;

    logSplashDebug("splashStatusUpdated", undefined, { message });
  },

  update(percent: number, message: string): void {
    if (!isVisible) {
      const { container } = getElements();
      if (container && !container.classList.contains("is-hidden")) {
        isVisible = true;
        showTime = Date.now();
      }
    }
    startSceneAnimation();
    splashScreen.setProgress(percent);
    splashScreen.setStatus(message);
  },

  get isVisible(): boolean {
    return isVisible;
  },

  get progress(): number {
    return currentProgress;
  },

  complete(): void {
    splashScreen.setProgress(100);
    splashScreen.setStatus(AppI18n.t("app.startup.ready"));
  },

  reset(): void {
    syncSplashVariant();
    resetSceneAnimation();
    splashScreen.setProgress(0);
    splashScreen.setStatus(AppI18n.t("app.startup.starting"));
    currentProgress = 0;
  },
};

export { splashScreen as SplashScreen };
