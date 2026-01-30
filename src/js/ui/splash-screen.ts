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

import { LogManager } from '../modules/log-manager';

// ============================================================================
// Types
// ============================================================================

interface SplashElements {
  container: HTMLElement | null;
  progress: HTMLElement | null;
  status: HTMLElement | null;
  logo: HTMLElement | null;
}

// ============================================================================
// Constants
// ============================================================================

const MINIMUM_DISPLAY_TIME = 2000; // 2 seconds minimum
const HIDE_ANIMATION_DURATION = 400; // Match CSS --duration-slow
const ELEMENT_IDS = {
  container: 'splash-screen',
  progress: 'splash-progress',
  status: 'splash-status',
  logo: 'splash-logo',
};

// ============================================================================
// State
// ============================================================================

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

// ============================================================================
// Private Functions
// ============================================================================

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
  const splash = document.createElement('div');
  splash.id = ELEMENT_IDS.container;
  splash.className = 'splash';

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

// ============================================================================
// Public API
// ============================================================================

export const SplashScreen = {
  /**
   * Show splash screen
   * Creates the element if it doesn't exist
   */
  show(): void {
    let container = getElements().container;

    // Create if doesn't exist
    if (!container) {
      container = createSplashElement();
      document.body.insertBefore(container, document.body.firstChild);
      isInitialized = false; // Force re-fetch elements
      getElements();
    }

    // Show
    container.classList.remove('hidden', 'splash-hiding');
    showTime = Date.now();
    isVisible = true;
    currentProgress = 0;

    LogManager.addEvent('SplashScreen', 'info', 'Shown', { visibility: 3 });
  },

  /**
   * Hide splash screen with fade animation
   * Waits for minimum display time before hiding
   * @returns Promise that resolves when fully hidden
   */
  async hide(): Promise<void> {
    const { container } = getElements();
    if (!container || !isVisible) return;

    // Calculate remaining wait time
    const elapsed = Date.now() - showTime;
    const remainingTime = Math.max(0, MINIMUM_DISPLAY_TIME - elapsed);

    // Wait for minimum time
    if (remainingTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
    }

    // Start hide animation
    container.classList.add('splash-hiding');

    // Wait for animation to complete
    await new Promise((resolve) => setTimeout(resolve, HIDE_ANIMATION_DURATION));

    // Remove from DOM
    container.classList.add('hidden');
    container.classList.remove('splash-hiding');
    isVisible = false;

    LogManager.addEvent('SplashScreen', 'info', 'Hidden', {
      totalTime: Date.now() - showTime,
    });
  },

  /**
   * Set progress bar percentage
   * @param percent - Progress value (0-100)
   */
  setProgress(percent: number): void {
    const { progress } = getElements();
    if (!progress) return;

    // Clamp value
    const value = Math.max(0, Math.min(100, percent));
    currentProgress = value;

    // Remove indeterminate mode if was active
    progress.classList.remove('indeterminate');

    // Update width
    progress.style.width = `${value}%`;

    LogManager.addEvent('SplashScreen', 'debug', 'Progress updated', { percent: value });
  },

  /**
   * Set indeterminate progress (animated bar)
   */
  setIndeterminate(): void {
    const { progress } = getElements();
    if (!progress) return;

    progress.style.width = '';
    progress.classList.add('indeterminate');
  },

  /**
   * Set status message
   * @param message - Status text to display
   */
  setStatus(message: string): void {
    const { status } = getElements();
    if (!status) return;

    status.textContent = message;

    LogManager.addEvent('SplashScreen', 'debug', 'Status updated', { message, visibility: 3 });
  },

  /**
   * Update both progress and status in one call
   */
  update(percent: number, message: string): void {
    // Auto-initialize visibility state if splash is already in DOM
    if (!isVisible) {
      const { container } = getElements();
      if (container && !container.classList.contains('hidden')) {
        isVisible = true;
        showTime = Date.now();
      }
    }
    SplashScreen.setProgress(percent);
    SplashScreen.setStatus(message);
  },

  /**
   * Check if splash is currently visible
   */
  get isVisible(): boolean {
    return isVisible;
  },

  /**
   * Get current progress value
   */
  get progress(): number {
    return currentProgress;
  },

  /**
   * Complete splash - set to 100% with "Hazır!" message
   * Useful shorthand before calling hide()
   */
  complete(): void {
    SplashScreen.setProgress(100);
    SplashScreen.setStatus('Hazır!');
  },

  /**
   * Reset splash to initial state
   */
  reset(): void {
    SplashScreen.setProgress(0);
    SplashScreen.setStatus('Başlatılıyor...');
    currentProgress = 0;
  },
};
