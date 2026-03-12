import { AppI18n } from "../modules/i18n/index.js";

export type ThemeId = "obsidian" | "ivory-lab" | "ember-console";

type ThemeChangeCallback = (theme: ThemeId) => void;

interface ThemeInfo {
  id: ThemeId;
  icon: string;
  isDark: boolean;
}

interface ThemeConfig {
  storageKey: string;
  defaultTheme: ThemeId;
  attribute: string;
  transitionDuration: number;
  channelName: string;
}

export const THEMES: Record<ThemeId, ThemeInfo> = {
  obsidian: {
    id: "obsidian",
    icon: "🌑",
    isDark: true,
  },
  "ivory-lab": {
    id: "ivory-lab",
    icon: "☀️",
    isDark: false,
  },
  "ember-console": {
    id: "ember-console",
    icon: "🔥",
    isDark: true,
  },
};

const THEME_ORDER: ThemeId[] = ["obsidian", "ivory-lab", "ember-console"];

const CONFIG: ThemeConfig = {
  storageKey: "app-theme",
  defaultTheme: "obsidian",
  attribute: "data-theme",
  transitionDuration: 200,
  channelName: "hayalet-ev-theme",
};

let currentTheme: ThemeId = CONFIG.defaultTheme;
const listeners: Set<ThemeChangeCallback> = new Set();
let isInitialized = false;
let themeChannel: BroadcastChannel | null = null;
let i18nUnsubscribe: (() => void) | null = null;

function themeT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.logs.themeManager.${key}`, params);
}

function getThemeName(theme: ThemeId): string {
  return AppI18n.t(`shell.themes.${theme}.name`);
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

function createThemeChannel(): BroadcastChannel | null {
  if (themeChannel != null || typeof BroadcastChannel === "undefined") {
    return themeChannel;
  }

  try {
    themeChannel = new BroadcastChannel(CONFIG.channelName);
  } catch {
    themeChannel = null;
  }

  return themeChannel;
}

function broadcastTheme(theme: ThemeId): void {
  try {
    createThemeChannel()?.postMessage({ theme });
  } catch {}
}

function applyTheme(theme: ThemeId, animate: boolean = true): void {
  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transition");
    setTimeout(() => {
      root.classList.remove("theme-transition");
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
  if (currentName) currentName.textContent = getThemeName(theme);

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

function applyManagedTheme(
  theme: ThemeId,
  options: { animate?: boolean; persist?: boolean; broadcast?: boolean } = {}
): void {
  if (theme === currentTheme && isInitialized) {
    return;
  }

  currentTheme = theme;
  applyTheme(theme, options.animate ?? true);

  if (options.persist !== false) {
    storeTheme(theme);
  }

  if (options.broadcast !== false) {
    broadcastTheme(theme);
  }

  notifyListeners(theme);
}

function syncThemeFromExternal(theme: string | null | undefined): void {
  if (theme == null || theme === "" || !isValidTheme(theme) || theme === currentTheme) {
    return;
  }

  applyManagedTheme(theme, { animate: true, persist: false, broadcast: false });
}

function setupSyncListeners(): void {
  window.addEventListener("storage", (event) => {
    if (event.key !== CONFIG.storageKey) {
      return;
    }

    syncThemeFromExternal(event.newValue);
  });

  const channel = createThemeChannel();
  if (channel == null) {
    return;
  }

  channel.onmessage = (event: MessageEvent<{ theme?: ThemeId }>): void => {
    syncThemeFromExternal(event.data.theme);
  };
}

function setupDropdownListeners(): void {
  const dropdown = document.getElementById("theme-dropdown");
  const btn = document.getElementById("theme-dropdown-btn");
  const menu = document.getElementById("theme-dropdown-menu");

  if (!dropdown || !btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("is-expanded");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("is-expanded");
  });

  menu.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".theme-dropdown-item");

    if (item != null) {
      const theme = item.getAttribute("data-theme");
      if (theme != null && theme !== "" && isValidTheme(theme)) {
        themeManager.set(theme);
        dropdown.classList.remove("is-expanded");
      }
    }
  });
}

function setupSettingsPanelListeners(): void {
  const list = document.getElementById("theme-settings-list");
  if (list == null) {
    return;
  }

  list.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const item = target.closest(".theme-dropdown-item");

    if (item != null) {
      const theme = item.getAttribute("data-theme");
      if (theme != null && theme !== "" && isValidTheme(theme)) {
        themeManager.set(theme);
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
      document.addEventListener("DOMContentLoaded", () => {
        setupDropdownListeners();
        setupSettingsPanelListeners();
      });
    } else {
      setupDropdownListeners();
      setupSettingsPanelListeners();
    }

    setupSyncListeners();
    i18nUnsubscribe ??= AppI18n.subscribe(() => {
      updateThemeDropdownUI(currentTheme);
    });
    isInitialized = true;
  },

  set(theme: ThemeId, persist: boolean = true): void {
    if (!isValidTheme(theme)) {
      console.warn(themeT("invalidTheme", { theme }));
      return;
    }

    applyManagedTheme(theme, { animate: true, persist, broadcast: true });
    // NOTE: Avoid Logger.debug() here to prevent init issues during startup.
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
    return getThemeName(currentTheme);
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

  // NOTE: Expose to window for consistent access across Vite HMR reloads.
  window.__ThemeManager = themeManager;
}

export { themeManager as ThemeManager };
