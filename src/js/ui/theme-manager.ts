/**
 * Theme Manager
 *
 * Manages application themes with 3 palettes:
 * - Obsidian (dark, cyan accents)
 * - Midnight (dark, violet accents)
 * - Aurora (light, teal accents)
 *
 * @example
 * ```typescript
 * import { ThemeManager } from './ui/theme-manager';
 *
 * // Set theme
 * ThemeManager.set('midnight');
 *
 * // Cycle through themes
 * ThemeManager.next();
 *
 * // Get available themes
 * ThemeManager.getAvailableThemes();
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

export type ThemeId = 'obsidian' | 'midnight' | 'aurora';

type ThemeChangeCallback = (theme: ThemeId) => void;

interface ThemeInfo {
  id: ThemeId;
  name: string;
  icon: string;
  isDark: boolean;
}

interface ThemeConfig {
  storageKey: string;
  defaultTheme: ThemeId;
  attribute: string;
  transitionDuration: number;
}

// ============================================================================
// Theme Definitions
// ============================================================================

export const THEMES: Record<ThemeId, ThemeInfo> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    icon: '🌑',
    isDark: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    icon: '🌙',
    isDark: true,
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    icon: '❄️',
    isDark: false,
  },
};

const THEME_ORDER: ThemeId[] = ['obsidian', 'midnight', 'aurora'];

// ============================================================================
// Configuration
// ============================================================================

const CONFIG: ThemeConfig = {
  storageKey: 'hayalet-ev-theme',
  defaultTheme: 'obsidian',
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
 * Validate if a string is a valid theme ID
 */
function isValidTheme(theme: string): theme is ThemeId {
  return theme in THEMES;
}

/**
 * Get stored theme from localStorage
 */
function getStoredTheme(): ThemeId | null {
  try {
    const stored = localStorage.getItem(CONFIG.storageKey);
    if (stored && isValidTheme(stored)) {
      return stored;
    }
  } catch {
    // localStorage not available
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
    // localStorage not available
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme: ThemeId, animate: boolean = true): void {
  const root = document.documentElement;

  if (animate) {
    root.style.transition = `background-color ${CONFIG.transitionDuration}ms ease, color ${CONFIG.transitionDuration}ms ease`;
    setTimeout(() => {
      root.style.transition = '';
    }, CONFIG.transitionDuration);
  }

  root.setAttribute(CONFIG.attribute, theme);

  // Update theme dropdown UI if exists
  updateThemeDropdownUI(theme);
}

/**
 * Update theme dropdown UI elements
 */
function updateThemeDropdownUI(theme: ThemeId): void {
  const themeInfo = THEMES[theme];
  
  // Update current theme display
  const currentIcon = document.getElementById('theme-current-icon');
  const currentName = document.getElementById('theme-current-name');
  
  if (currentIcon) currentIcon.textContent = themeInfo.icon;
  if (currentName) currentName.textContent = themeInfo.name;
  
  // Update active state in dropdown menu
  const menuItems = document.querySelectorAll('.theme-dropdown-item');
  menuItems.forEach((item) => {
    const itemTheme = item.getAttribute('data-theme');
    item.classList.toggle('is-active', itemTheme === theme);
  });
}

/**
 * Notify all listeners of theme change
 */
function notifyListeners(theme: ThemeId): void {
  listeners.forEach((callback) => {
    try {
      callback(theme);
    } catch (err) {
      LogManager.addEvent('ThemeManager', 'error', 'Listener error', { error: err });
    }
  });
}

/**
 * Setup dropdown event listeners
 */
function setupDropdownListeners(): void {
  const dropdown = document.getElementById('theme-dropdown');
  const btn = document.getElementById('theme-dropdown-btn');
  const menu = document.getElementById('theme-dropdown-menu');

  if (!dropdown || !btn || !menu) return;

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('is-open');
  });

  // Close on outside click
  document.addEventListener('click', () => {
    dropdown.classList.remove('is-open');
  });

  // Theme selection
  menu.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.theme-dropdown-item') as HTMLElement;
    
    if (item) {
      const theme = item.getAttribute('data-theme');
      if (theme && isValidTheme(theme)) {
        ThemeManager.set(theme);
        dropdown.classList.remove('is-open');
      }
    }
  });
}

// ============================================================================
// Public API
// ============================================================================

export const ThemeManager = {
  /**
   * Current theme ID
   */
  get current(): ThemeId {
    return currentTheme;
  },

  /**
   * Current theme info object
   */
  get currentInfo(): ThemeInfo {
    return THEMES[currentTheme];
  },

  /**
   * Check if current theme is dark
   */
  get isDark(): boolean {
    return THEMES[currentTheme].isDark;
  },

  /**
   * Check if current theme is light
   */
  get isLight(): boolean {
    return !THEMES[currentTheme].isDark;
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

    // Setup dropdown listeners after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupDropdownListeners);
    } else {
      setupDropdownListeners();
    }

    isInitialized = true;
    LogManager.addEvent('ThemeManager', 'info', 'Initialized', { theme: currentTheme, visibility: 2 });
  },

  /**
   * Set theme
   * @param theme - Theme ID to set
   * @param persist - Whether to persist to localStorage (default: true)
   */
  set(theme: ThemeId, persist: boolean = true): void {
    if (!isValidTheme(theme)) {
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
   * Cycle to next theme
   */
  next(): void {
    const currentIndex = THEME_ORDER.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
    const nextTheme = THEME_ORDER[nextIndex];
    if (nextTheme) {
      ThemeManager.set(nextTheme);
    }
  },

  prev(): void {
    const currentIndex = THEME_ORDER.indexOf(currentTheme);
    const prevIndex = (currentIndex - 1 + THEME_ORDER.length) % THEME_ORDER.length;
    const prevTheme = THEME_ORDER[prevIndex];
    if (prevTheme) {
      ThemeManager.set(prevTheme);
    }
  },

  /**
   * Toggle between dark themes (obsidian/midnight) or to light (aurora)
   */
  toggle(): void {
    ThemeManager.next();
  },

  /**
   * Get all available themes
   */
  getAvailableThemes(): ThemeInfo[] {
    return THEME_ORDER.map((id) => THEMES[id]);
  },

  /**
   * Get theme info by ID
   */
  getTheme(id: ThemeId): ThemeInfo {
    return THEMES[id];
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
    return THEMES[currentTheme].icon;
  },

  /**
   * Get theme name
   */
  getName(): string {
    return THEMES[currentTheme].name;
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
