import { LogCategory } from "@shared/logging-core";
/**
 * Splash Screen Manager
 *
 * Full-screen loading splash with progress indication.
 * Shows during app initialization with minimum display time.
 *
 * @example
 * ```typescript
 * import { SplashScreen } from './ui';
 *
 * // Show splash (usually already visible from HTML)
 * SplashScreen.show();
 *
 * // Update progress
 * SplashScreen.setStatus('Ayarlar yükleniyor...');
 * SplashScreen.setProgress(25);
 *
 * // Continue with loading...
 * SplashScreen.setStatus('Modüller başlatılıyor...');
 * SplashScreen.setProgress(50);
 *
 * // Complete and hide (waits minimum time)
 * SplashScreen.setStatus('Hazır!');
 * SplashScreen.setProgress(100);
 * await SplashScreen.hide(); // Waits min 2s, then fades out
 * ```
 */

import { Logger } from "../modules/logger/index.js";
import { MINIMUM_DISPLAY_TIME, HIDE_ANIMATION_DURATION } from "@ui-constants";

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
      <p class="splash-status" id="${ELEMENT_IDS.status}">Başlatılıyor...</p>
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
      isInitialized = false; // Force re-fetch elements
      getElements();
    }

    container.classList.remove("hidden", "splash-hiding");
    showTime = Date.now();
    isVisible = true;
    currentProgress = 0;

    Logger.debug(LogCategory.UI_SPLASH, "Shown", { timestamp: showTime });
  },

  /**
   * Hide splash screen with fade animation
   * Waits for minimum display time before hiding
   * @returns Promise that resolves when fully hidden
   */
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

    Logger.debug(LogCategory.UI_SPLASH, "Removed from DOM", { totalTime: Date.now() - showTime });
  },

  /**
   * Set progress bar percentage
   * @param percent - Progress value (0-100)
   */
  setProgress(percent: number): void {
    const { progress } = getElements();
    if (!progress) return;

    const value = Math.max(0, Math.min(100, percent));
    currentProgress = value;

    progress.classList.remove("indeterminate");

    progress.style.width = `${value}%`;

    Logger.debug(LogCategory.UI_SPLASH, "Progress updated", { percent: value });
  },

  setIndeterminate(): void {
    const { progress } = getElements();
    if (!progress) return;

    progress.style.width = "";
    progress.classList.add("indeterminate");
  },

  /**
   * Set status message
   * @param message - Status text to display
   */
  setStatus(message: string): void {
    const { status } = getElements();
    if (!status) return;

    status.textContent = message;

    Logger.debug(LogCategory.UI_SPLASH, "Status updated", { message });
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
    splashScreen.setStatus("Hazır!");
  },

  reset(): void {
    splashScreen.setProgress(0);
    splashScreen.setStatus("Başlatılıyor...");
    currentProgress = 0;
  },
};

export { splashScreen as SplashScreen };
