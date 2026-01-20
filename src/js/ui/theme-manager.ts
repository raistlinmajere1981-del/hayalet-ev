/**
 * Theme Manager
 *
 * Manages application theme (dark/light) with persistence.
 * Integrates with the design system CSS variables.
 *
 * @example
 * ```typescript
 * import { ThemeManager } from './ui/theme-manager';
 *
 * // Set theme
 * ThemeManager.set('light');
 *
 * // Toggle between dark/light
 * ThemeManager.toggle();
 *
 * // Listen for changes
 * const unsubscribe = ThemeManager.onChange((theme) => {
 *   console.log('Theme changed to:', theme);
 * });
 * ```
 */

import { LogManager } from '../modules/log-manager';

// ============================================================================
// Types
// ============================================================================

export type ThemeId = 'dark' | 'light';

type ThemeChangeCallback = (theme: ThemeId) => void;

interface ThemeConfig {
  storageKey: string;
  defaultTheme: ThemeId;
  attribute: string;
  transitionDuration: number;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG: ThemeConfig = {
  storageKey: 'hayalet-ev-theme',
  defaultTheme: 'dark',
  attribute: 'data-theme',
  transitionDuration: 200,
};

// ============================================================================
// State
// ============================================================================

let currentTheme: ThemeId = CONFIG.defaultTheme;
const listeners: Set<ThemeChangeCallback> = new Set();
let isInitialized = false;

// ============================================================================
// Private Functions
// ============================================================================

/**
 * Get stored theme from localStorage
 */
function getStoredTheme(): ThemeId | null {
  try {
    const stored = localStorage.getItem(CONFIG.storageKey);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // localStorage might not be available
  }
  return null;
}

/**
 * Store theme in localStorage
 */
function storeTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(CONFIG.storageKey, theme);
  } catch {
    // localStorage might not be available
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme: ThemeId, animate: boolean = true): void {
  const root = document.documentElement;

  if (animate) {
    // Add transition class for smooth color changes
    root.style.setProperty('--theme-transition', `${CONFIG.transitionDuration}ms`);
    root.classList.add('theme-transitioning');
  }

  // Set theme attribute
  root.setAttribute(CONFIG.attribute, theme);

  if (animate) {
    // Remove transition class after animation
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
      root.style.removeProperty('--theme-transition');
    }, CONFIG.transitionDuration);
  }
}

/**
 * Notify all listeners of theme change
 */
function notifyListeners(theme: ThemeId): void {
  listeners.forEach((callback) => {
    try {
      callback(theme);
    } catch (error) {
      LogManager.addEvent('ThemeManager', 'error', 'Listener callback error', { error });
    }
  });
}

// ============================================================================
// Public API
// ============================================================================

export const ThemeManager = {
  /**
   * Current theme
   */
  get current(): ThemeId {
    return currentTheme;
  },

  /**
   * Check if dark theme is active
   */
  get isDark(): boolean {
    return currentTheme === 'dark';
  },

  /**
   * Check if light theme is active
   */
  get isLight(): boolean {
    return currentTheme === 'light';
  },

  /**
   * Initialize theme manager
   * Call this once when the app starts
   */
  init(): void {
    if (isInitialized) {
      return;
    }

    // Get stored theme or use default
    const storedTheme = getStoredTheme();
    currentTheme = storedTheme ?? CONFIG.defaultTheme;

    // Apply theme without animation on init
    applyTheme(currentTheme, false);

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't set a preference
      if (!getStoredTheme()) {
        const newTheme: ThemeId = e.matches ? 'dark' : 'light';
        ThemeManager.set(newTheme, false); // Don't store auto-detected theme
      }
    });

    isInitialized = true;
    LogManager.addEvent('ThemeManager', 'info', 'Initialized', { theme: currentTheme, visibility: 2 });
  },

  /**
   * Set theme
   * @param theme - Theme to set ('dark' or 'light')
   * @param persist - Whether to persist to localStorage (default: true)
   */
  set(theme: ThemeId, persist: boolean = true): void {
    if (theme !== 'dark' && theme !== 'light') {
      LogManager.addEvent('ThemeManager', 'warn', 'Invalid theme', { theme });
      return;
    }

    if (theme === currentTheme) {
      return;
    }

    currentTheme = theme;
    applyTheme(theme, true);

    if (persist) {
      storeTheme(theme);
    }

    notifyListeners(theme);
    LogManager.addEvent('ThemeManager', 'info', 'Theme changed', { theme, visibility: 3 });
  },

  /**
   * Toggle between dark and light theme
   */
  toggle(): void {
    const newTheme: ThemeId = currentTheme === 'dark' ? 'light' : 'dark';
    ThemeManager.set(newTheme);
  },

  /**
   * Subscribe to theme changes
   * @param callback - Function to call when theme changes
   * @returns Unsubscribe function
   */
  onChange(callback: ThemeChangeCallback): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },

  /**
   * Get theme icon emoji
   */
  getIcon(): string {
    return currentTheme === 'dark' ? '🌙' : '☀️';
  },

  /**
   * Get opposite theme
   */
  getOpposite(): ThemeId {
    return currentTheme === 'dark' ? 'light' : 'dark';
  },
};

// Auto-initialize when module is imported
if (typeof document !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
  } else {
    ThemeManager.init();
  }
  
  // Expose to window for consistent access across Vite HMR reloads
  (window as unknown as Record<string, unknown>).__ThemeManager = ThemeManager;
}
