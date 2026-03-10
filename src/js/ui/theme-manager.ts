/**
 * Theme Manager
 *
 * Manages application themes.
 * Currently only Obsidian (dark, cyan accents) is active.
 * Theme infrastructure is preserved for future expansion.
 *
 * @example
 * ```typescript
 * import { ThemeManager } from './ui/theme-manager';
 *
 * // Set theme
 * ThemeManager.set('obsidian');
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

import { AppI18n } from "../modules/i18n/index.js";

export type ThemeId = "obsidian";

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

export const THEMES: Record<ThemeId, ThemeInfo> = {
  obsidian: {
    id: "obsidian",
    name: "Obsidian",
    icon: "🌑",
    isDark: true,
  },
};

const THEME_ORDER: ThemeId[] = ["obsidian"];

const CONFIG: ThemeConfig = {
  storageKey: "hayalet-ev-theme",
  defaultTheme: "obsidian",
  attribute: "data-theme",
  transitionDuration: 200,
};

let currentTheme: ThemeId = CONFIG.defaultTheme;
const listeners: Set<ThemeChangeCallback> = new Set();
let isInitialized = false;

function themeT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.logs.themeManager.${key}`, params);
}

function isValidTheme(theme: string): theme is ThemeId {
  return theme in THEMES;
}

function getStoredTheme(): ThemeId | null {
  try {
    const stored = localStorage.getItem(CONFIG.storageKey);
    if (stored != null && stored !== "" && isValidTheme(stored)) {
      return stored;
    }
  } catch {}
  return null;
}

function storeTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(CONFIG.storageKey, theme);
  } catch {}
}

function applyTheme(theme: ThemeId, animate: boolean = true): void {
  const root = document.documentElement;

  if (animate) {
    root.style.transition = `background-color ${CONFIG.transitionDuration}ms ease, color ${CONFIG.transitionDuration}ms ease`;
    setTimeout(() => {
      root.style.transition = "";
    }, CONFIG.transitionDuration);
  }

  root.setAttribute(CONFIG.attribute, theme);

  updateThemeDropdownUI(theme);
}

function updateThemeDropdownUI(theme: ThemeId): void {
  const themeInfo = THEMES[theme];

  const currentIcon = document.getElementById("theme-current-icon");
  const currentName = document.getElementById("theme-current-name");

  if (currentIcon) currentIcon.textContent = themeInfo.icon;
  if (currentName) currentName.textContent = themeInfo.name;

  const menuItems = document.querySelectorAll(".theme-dropdown-item");
  menuItems.forEach((item) => {
    const itemTheme = item.getAttribute("data-theme");
    item.classList.toggle("is-active", itemTheme === theme);
  });
}

function notifyListeners(theme: ThemeId): void {
  listeners.forEach((callback) => {
    try {
      callback(theme);
    } catch (err) {
      console.error(
        themeT("listenerError", { message: err instanceof Error ? err.message : String(err) }),
        err
      );
    }
  });
}

function setupDropdownListeners(): void {
  const dropdown = document.getElementById("theme-dropdown");
  const btn = document.getElementById("theme-dropdown-btn");
  const menu = document.getElementById("theme-dropdown-menu");

  if (!dropdown || !btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("is-open");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("is-open");
  });

  menu.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".theme-dropdown-item");

    if (item != null) {
      const theme = item.getAttribute("data-theme");
      if (theme != null && theme !== "" && isValidTheme(theme)) {
        themeManager.set(theme);
        dropdown.classList.remove("is-open");
      }
    }
  });
}

const themeManager = {
  get current(): ThemeId {
    return currentTheme;
  },

  get currentInfo(): ThemeInfo {
    return THEMES[currentTheme];
  },

  get isDark(): boolean {
    return THEMES[currentTheme].isDark;
  },

  get isLight(): boolean {
    return !THEMES[currentTheme].isDark;
  },

  init(): void {
    if (isInitialized) {
      return;
    }

    const storedTheme = getStoredTheme();
    currentTheme = storedTheme ?? CONFIG.defaultTheme;

    applyTheme(currentTheme, false);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupDropdownListeners);
    } else {
      setupDropdownListeners();
    }

    isInitialized = true;
  },

  /**
   * Set theme
   * @param theme - Theme ID to set
   * @param persist - Whether to persist to localStorage (default: true)
   */
  set(theme: ThemeId, persist: boolean = true): void {
    if (!isValidTheme(theme)) {
      console.warn(themeT("invalidTheme", { theme }));
      return;
    }

    currentTheme = theme;
    applyTheme(theme, true);

    if (persist) {
      storeTheme(theme);
    }

    notifyListeners(theme);
    // Logger.debug() - omitted to avoid init issues at startup
  },

  next(): void {
    const currentIndex = THEME_ORDER.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
    const nextTheme = THEME_ORDER[nextIndex];
    if (nextTheme !== undefined) {
      themeManager.set(nextTheme);
    }
  },

  prev(): void {
    const currentIndex = THEME_ORDER.indexOf(currentTheme);
    const prevIndex = (currentIndex - 1 + THEME_ORDER.length) % THEME_ORDER.length;
    const prevTheme = THEME_ORDER[prevIndex];
    if (prevTheme !== undefined) {
      themeManager.set(prevTheme);
    }
  },

  toggle(): void {
    themeManager.next();
  },

  getAvailableThemes(): ThemeInfo[] {
    return THEME_ORDER.map((id) => THEMES[id]);
  },

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

  getIcon(): string {
    return THEMES[currentTheme].icon;
  },

  getName(): string {
    return THEMES[currentTheme].name;
  },
};

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      themeManager.init();
    });
  } else {
    themeManager.init();
  }

  // Expose to window for consistent access across Vite HMR reloads
  window.__ThemeManager = themeManager;
}

export { themeManager as ThemeManager };
