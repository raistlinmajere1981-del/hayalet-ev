import { LogCategory } from "@shared/logging-core";
import { Logger } from "../modules/logger/index.js";
import { MINIMUM_DISPLAY_TIME, HIDE_ANIMATION_DURATION } from "@ui-constants";
import { AppI18n } from "../modules/i18n/index.js";

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

function getElements(): SplashElements {
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

  splash.innerHTML = `
    <div class="splash-content">
      <div class="splash-logo-container">
        <img src="/assets/logo.jpg" alt="Hayalet Ev" class="splash-logo" id="${ELEMENT_IDS.logo}" />
        <div class="splash-logo-glow"></div>
      </div>
      <h1 class="splash-title">Hayalet Ev</h1>
      <p class="splash-version">v5.4.0</p>
      <div class="splash-loader">
        <div class="splash-progress" id="${ELEMENT_IDS.progress}"></div>
      </div>
      <p class="splash-status" id="${ELEMENT_IDS.status}">${AppI18n.t("app.startup.starting")}</p>
    </div>
  `;

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

    container.classList.remove("hidden", "splash-hiding");
    showTime = Date.now();
    isVisible = true;
    currentProgress = 0;

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

    progress.style.width = `${value}%`;

    logSplashDebug("splashProgressUpdated", undefined, { percent: value });
  },

  setIndeterminate(): void {
    const { progress } = getElements();
    if (!progress) return;

    progress.style.width = "";
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
      if (container && !container.classList.contains("hidden")) {
        isVisible = true;
        showTime = Date.now();
      }
    }
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
    splashScreen.setProgress(0);
    splashScreen.setStatus(AppI18n.t("app.startup.starting"));
    currentProgress = 0;
  },
};

export { splashScreen as SplashScreen };
