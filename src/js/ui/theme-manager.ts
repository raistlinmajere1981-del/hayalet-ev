import {
  DEFAULT_THEME_APPEARANCE_SETTINGS,
  type AppSettings,
  type ThemeAppearanceMode,
  type ThemeAppearanceSettings,
  type ThemeId,
  THEME_IDS,
  isThemeId,
} from "@shared/settings.js";
import { AppI18n } from "../modules/i18n/index.js";
import { SettingsManager } from "../modules/settings-manager.js";

type ThemeChangeCallback = (theme: ThemeId) => void;

interface ThemeInfo {
  id: ThemeId;
  icon: string;
  isDark: boolean;
}

interface ThemeConfig {
  appearanceStorageKey: string;
  legacyThemeStorageKey: string;
  attribute: string;
  transitionDuration: number;
  channelName: string;
}

interface ThemeSyncPayload {
  theme?: ThemeId;
  appearance?: ThemeAppearanceSettings;
}

interface ApplyAppearanceOptions {
  animate?: boolean;
  persistLocal?: boolean;
  persistSettings?: boolean;
  broadcast?: boolean;
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

const THEME_ORDER: ThemeId[] = [...THEME_IDS];

const CONFIG: ThemeConfig = {
  appearanceStorageKey: "app-theme-appearance",
  legacyThemeStorageKey: "app-theme",
  attribute: "data-theme",
  transitionDuration: 200,
  channelName: "hayalet-ev-theme",
};

let currentTheme: ThemeId = DEFAULT_THEME_APPEARANCE_SETTINGS.manualTheme;
let currentAppearance: Required<ThemeAppearanceSettings> = { ...DEFAULT_THEME_APPEARANCE_SETTINGS };
const listeners: Set<ThemeChangeCallback> = new Set();
let isInitialized = false;
let themeChannel: BroadcastChannel | null = null;
let i18nUnsubscribe: (() => void) | null = null;
let settingsUnsubscribe: (() => void) | null = null;
let scheduleTimer: ReturnType<typeof setInterval> | null = null;
let colorSchemeQuery: MediaQueryList | null = null;
let themeTransitionTimer: ReturnType<typeof setTimeout> | null = null;

function themeT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.logs.themeManager.${key}`, params);
}

function getThemeName(theme: ThemeId): string {
  return AppI18n.t(`shell.themes.${theme}.name`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value)
  );
}

function isValidTheme(theme: string): theme is ThemeId {
  return isThemeId(theme);
}

function isTimeString(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function cloneAppearanceDefaults(): Required<ThemeAppearanceSettings> {
  return { ...DEFAULT_THEME_APPEARANCE_SETTINGS };
}

function normalizeAppearance(
  raw: unknown,
  legacyTheme?: unknown
): Required<ThemeAppearanceSettings> {
  const defaults = cloneAppearanceDefaults();
  const next = isPlainObject(raw) ? { ...defaults, ...raw } : defaults;

  if (legacyTheme === "system") {
    next.mode = "system";
  } else if (legacyTheme === "light") {
    next.mode = "manual";
    next.manualTheme = "ivory-lab";
    next.lightTheme = "ivory-lab";
  } else if (legacyTheme === "dark") {
    next.mode = "manual";
    next.manualTheme = "obsidian";
    next.darkTheme = "obsidian";
  }

  const mode: unknown = next.mode;
  const manualTheme: unknown = next.manualTheme;
  const lightTheme: unknown = next.lightTheme;
  const darkTheme: unknown = next.darkTheme;
  next.mode = mode === "manual" || mode === "system" || mode === "schedule" ? mode : defaults.mode;
  next.manualTheme =
    typeof manualTheme === "string" && isValidTheme(manualTheme)
      ? manualTheme
      : defaults.manualTheme;
  next.lightTheme =
    typeof lightTheme === "string" && isValidTheme(lightTheme) ? lightTheme : defaults.lightTheme;
  next.darkTheme =
    typeof darkTheme === "string" && isValidTheme(darkTheme) ? darkTheme : defaults.darkTheme;
  next.dayStart = isTimeString(next.dayStart) ? next.dayStart : defaults.dayStart;
  next.nightStart = isTimeString(next.nightStart) ? next.nightStart : defaults.nightStart;
  const motion: unknown = next.motion;
  const textScale: unknown = next.textScale;
  const surface: unknown = next.surface;
  const contrast: unknown = next.contrast;
  next.motion =
    motion === "full" || motion === "reduced" || motion === "off" ? motion : defaults.motion;
  next.textScale =
    textScale === "sm" || textScale === "md" || textScale === "lg" ? textScale : defaults.textScale;
  next.surface =
    surface === "glass" || surface === "soft" || surface === "solid" ? surface : defaults.surface;
  next.contrast = contrast === "normal" || contrast === "high" ? contrast : defaults.contrast;

  return next;
}

function areAppearanceSettingsEqual(
  left: ThemeAppearanceSettings,
  right: ThemeAppearanceSettings
): boolean {
  return (
    left.mode === right.mode &&
    left.manualTheme === right.manualTheme &&
    left.lightTheme === right.lightTheme &&
    left.darkTheme === right.darkTheme &&
    left.dayStart === right.dayStart &&
    left.nightStart === right.nightStart &&
    left.motion === right.motion &&
    left.textScale === right.textScale &&
    left.surface === right.surface &&
    left.contrast === right.contrast
  );
}

function getStoredLegacyTheme(): ThemeId | null {
  try {
    const stored = localStorage.getItem(CONFIG.legacyThemeStorageKey);
    if (stored != null && stored !== "" && isValidTheme(stored)) {
      return stored;
    }
  } catch {}
  return null;
}

function getStoredAppearance(): Required<ThemeAppearanceSettings> | null {
  try {
    const stored = localStorage.getItem(CONFIG.appearanceStorageKey);
    if (stored == null || stored === "") {
      return null;
    }
    return normalizeAppearance(JSON.parse(stored));
  } catch {
    return null;
  }
}

function clearStoredLegacyTheme(): void {
  try {
    localStorage.removeItem(CONFIG.legacyThemeStorageKey);
  } catch {}
}

function storeAppearance(appearance: Required<ThemeAppearanceSettings>): void {
  try {
    localStorage.setItem(CONFIG.appearanceStorageKey, JSON.stringify(appearance));
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

function broadcastThemeState(): void {
  try {
    createThemeChannel()?.postMessage({
      theme: currentTheme,
      appearance: currentAppearance,
    } satisfies ThemeSyncPayload);
  } catch {}
}

function parseTimeToMinutes(value: string): number {
  const parts = value.split(":");
  const hours = Number.parseInt(parts[0] ?? "0", 10);
  const minutes = Number.parseInt(parts[1] ?? "0", 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}

function prefersDarkMode(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  colorSchemeQuery ??= window.matchMedia("(prefers-color-scheme: dark)");
  return colorSchemeQuery.matches;
}

function isDayWindowActive(appearance: Required<ThemeAppearanceSettings>): boolean {
  const dayStart = parseTimeToMinutes(appearance.dayStart);
  const nightStart = parseTimeToMinutes(appearance.nightStart);
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (dayStart === nightStart) {
    return true;
  }

  if (dayStart < nightStart) {
    return minutes >= dayStart && minutes < nightStart;
  }

  return minutes >= dayStart || minutes < nightStart;
}

function resolveThemeFromAppearance(appearance: Required<ThemeAppearanceSettings>): ThemeId {
  if (appearance.mode === "system") {
    return prefersDarkMode() ? appearance.darkTheme : appearance.lightTheme;
  }

  if (appearance.mode === "schedule") {
    return isDayWindowActive(appearance) ? appearance.lightTheme : appearance.darkTheme;
  }

  return appearance.manualTheme;
}

function applyAppearanceAttributes(appearance: Required<ThemeAppearanceSettings>): void {
  const root = document.documentElement;

  root.setAttribute("data-theme-mode", appearance.mode);
  root.setAttribute("data-theme-motion", appearance.motion);
  root.setAttribute("data-theme-scale", appearance.textScale);
  root.setAttribute("data-theme-surface", appearance.surface);
  root.setAttribute("data-theme-contrast", appearance.contrast);
}

function parseDurationMs(value: string): number | null {
  const normalized = value.trim();
  if (normalized === "") {
    return null;
  }

  if (normalized.endsWith("ms")) {
    const numeric = Number.parseFloat(normalized.slice(0, -2));
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (normalized.endsWith("s")) {
    const numeric = Number.parseFloat(normalized.slice(0, -1));
    return Number.isFinite(numeric) ? numeric * 1000 : null;
  }

  return null;
}

function getThemeTransitionDuration(): number {
  const root = document.documentElement;
  const motionMode = root.getAttribute("data-theme-motion");
  if (motionMode === "off") {
    return 0;
  }

  const duration = parseDurationMs(
    getComputedStyle(root).getPropertyValue("--duration-theme-transition")
  );
  return duration ?? CONFIG.transitionDuration;
}

function applyTheme(theme: ThemeId, animate: boolean = true): void {
  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transition");
    if (themeTransitionTimer != null) {
      clearTimeout(themeTransitionTimer);
      themeTransitionTimer = null;
    }
    const transitionDuration = getThemeTransitionDuration();
    if (transitionDuration <= 0) {
      root.classList.remove("theme-transition");
    } else {
      themeTransitionTimer = setTimeout(() => {
        root.classList.remove("theme-transition");
        themeTransitionTimer = null;
      }, transitionDuration);
    }
  }

  root.setAttribute(CONFIG.attribute, theme);
  updateThemeDropdownUI(theme);
}

function getModeLabel(mode: ThemeAppearanceMode): string {
  return AppI18n.t(`shell.theme.mode.options.${mode}`);
}

function getModeHint(mode: ThemeAppearanceMode): string {
  return AppI18n.t(`shell.theme.mode.hints.${mode}`);
}

function getThemeDescription(theme: ThemeId): string {
  return AppI18n.t(`shell.themes.${theme}.description`);
}

function renderThemeOption(theme: ThemeId): HTMLButtonElement {
  const item = document.createElement("button");
  item.className = "theme-dropdown-item settings-theme-option";
  item.type = "button";
  item.dataset["theme"] = theme;

  const icon = document.createElement("span");
  icon.className = "theme-dropdown-icon";
  icon.textContent = THEMES[theme].icon;

  const copy = document.createElement("span");
  copy.className = "theme-dropdown-copy";

  const title = document.createElement("strong");
  title.textContent = getThemeName(theme);

  const description = document.createElement("small");
  description.textContent = getThemeDescription(theme);

  copy.append(title, description);
  item.append(icon, copy);
  return item;
}

function renderThemeSelectOptions(select: HTMLSelectElement): void {
  const previousValue = select.value;
  const fragment = document.createDocumentFragment();

  THEME_ORDER.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = getThemeName(theme);
    fragment.append(option);
  });

  select.replaceChildren(fragment);
  if (previousValue !== "") {
    select.value = previousValue;
  }
}

function renderThemeSettingsPanel(): void {
  const list = document.getElementById("theme-settings-list");
  if (list != null) {
    list.replaceChildren(...THEME_ORDER.map((theme) => renderThemeOption(theme)));
  }

  const lightSelect = document.getElementById("theme-light-select") as HTMLSelectElement | null;
  if (lightSelect != null) {
    renderThemeSelectOptions(lightSelect);
  }

  const darkSelect = document.getElementById("theme-dark-select") as HTMLSelectElement | null;
  if (darkSelect != null) {
    renderThemeSelectOptions(darkSelect);
  }
}

function updateThemePanelUI(theme: ThemeId, appearance: Required<ThemeAppearanceSettings>): void {
  const themeInfo = THEMES[theme];
  const currentIcon = document.getElementById("theme-current-icon");
  const currentName = document.getElementById("theme-current-name");
  const currentMeta = document.getElementById("theme-current-meta");
  const modeBadge = document.getElementById("theme-mode-badge");
  const modeHint = document.getElementById("theme-mode-hint");
  const modeSelect = document.getElementById("theme-behavior-select") as HTMLSelectElement | null;
  const lightSelect = document.getElementById("theme-light-select") as HTMLSelectElement | null;
  const darkSelect = document.getElementById("theme-dark-select") as HTMLSelectElement | null;
  const dayStartInput = document.getElementById("theme-day-start") as HTMLInputElement | null;
  const nightStartInput = document.getElementById("theme-night-start") as HTMLInputElement | null;
  const motionSelect = document.getElementById("theme-motion-select") as HTMLSelectElement | null;
  const textScaleSelect = document.getElementById(
    "theme-text-scale-select"
  ) as HTMLSelectElement | null;
  const surfaceSelect = document.getElementById("theme-surface-select") as HTMLSelectElement | null;
  const contrastToggle = document.getElementById(
    "theme-contrast-toggle"
  ) as HTMLInputElement | null;
  const scheduleFields = document.querySelectorAll<HTMLElement>("[data-theme-schedule-field]");

  if (currentIcon) currentIcon.textContent = themeInfo.icon;
  if (currentName) currentName.textContent = getThemeName(theme);
  if (currentMeta) currentMeta.textContent = getModeLabel(appearance.mode);
  if (modeBadge) modeBadge.textContent = getModeLabel(appearance.mode);
  if (modeHint) modeHint.textContent = getModeHint(appearance.mode);

  if (modeSelect) modeSelect.value = appearance.mode;
  if (lightSelect) lightSelect.value = appearance.lightTheme;
  if (darkSelect) darkSelect.value = appearance.darkTheme;
  if (dayStartInput) dayStartInput.value = appearance.dayStart;
  if (nightStartInput) nightStartInput.value = appearance.nightStart;
  if (motionSelect) motionSelect.value = appearance.motion;
  if (textScaleSelect) textScaleSelect.value = appearance.textScale;
  if (surfaceSelect) surfaceSelect.value = appearance.surface;
  if (contrastToggle) contrastToggle.checked = appearance.contrast === "high";

  scheduleFields.forEach((field) => {
    const hidden = appearance.mode !== "schedule";
    field.hidden = hidden;
    field.setAttribute("aria-hidden", String(hidden));
  });
}

function updateThemeDropdownUI(theme: ThemeId): void {
  const menuItems = document.querySelectorAll<HTMLElement>(".theme-dropdown-item[data-theme]");
  menuItems.forEach((item) => {
    const itemTheme = item.getAttribute("data-theme");
    const active = itemTheme === theme;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  });

  updateThemePanelUI(theme, currentAppearance);
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

function persistAppearanceSettings(appearance: Required<ThemeAppearanceSettings>): void {
  void SettingsManager.patch((settings) => {
    if (!isPlainObject(settings["general"])) {
      settings["general"] = {};
    }

    const general = settings["general"] as Record<string, unknown>;
    general["appearance"] = { ...appearance };
    delete general["theme"];
  });
}

function applyManagedAppearance(
  appearance: ThemeAppearanceSettings,
  options: ApplyAppearanceOptions = {}
): void {
  const nextAppearance = normalizeAppearance(appearance);
  const nextTheme = resolveThemeFromAppearance(nextAppearance);
  const themeChanged = nextTheme !== currentTheme;
  const appearanceChanged = !areAppearanceSettingsEqual(nextAppearance, currentAppearance);

  currentAppearance = nextAppearance;
  currentTheme = nextTheme;

  applyAppearanceAttributes(currentAppearance);
  applyTheme(currentTheme, (options.animate ?? true) && themeChanged);

  if (options.persistLocal !== false) {
    storeAppearance(currentAppearance);
  }

  if (options.broadcast !== false) {
    broadcastThemeState();
  }

  if (options.persistSettings === true && appearanceChanged) {
    persistAppearanceSettings(currentAppearance);
  }

  if (themeChanged || !isInitialized) {
    notifyListeners(currentTheme);
  }
}

function applyExactTheme(
  theme: ThemeId,
  options: { animate?: boolean; persistLocal?: boolean; broadcast?: boolean } = {}
): void {
  currentAppearance = normalizeAppearance({
    ...currentAppearance,
    mode: "manual",
    manualTheme: theme,
  });
  const themeChanged = theme !== currentTheme;
  currentTheme = theme;

  applyAppearanceAttributes(currentAppearance);
  applyTheme(currentTheme, options.animate ?? true);

  if (options.persistLocal === true) {
    storeAppearance(currentAppearance);
  }

  if (options.broadcast === true) {
    broadcastThemeState();
  }

  if (themeChanged || !isInitialized) {
    notifyListeners(currentTheme);
  }
}

function syncManagedTheme(animate: boolean = true): void {
  applyManagedAppearance(currentAppearance, {
    animate,
    persistLocal: true,
    persistSettings: false,
    broadcast: true,
  });
}

function setupSyncListeners(): void {
  window.addEventListener("storage", (event) => {
    if (event.key === CONFIG.appearanceStorageKey) {
      let nextAppearance = cloneAppearanceDefaults();
      if (event.newValue != null && event.newValue !== "") {
        try {
          nextAppearance = normalizeAppearance(JSON.parse(event.newValue));
        } catch {
          nextAppearance = cloneAppearanceDefaults();
        }
      }
      applyManagedAppearance(nextAppearance, {
        animate: true,
        persistLocal: false,
        persistSettings: false,
        broadcast: false,
      });
      return;
    }
  });

  const channel = createThemeChannel();
  if (channel != null) {
    channel.onmessage = (event: MessageEvent<ThemeSyncPayload>): void => {
      const payload = event.data;
      if (payload.appearance != null) {
        applyManagedAppearance(payload.appearance, {
          animate: true,
          persistLocal: false,
          persistSettings: false,
          broadcast: false,
        });
        return;
      }

      if (payload.theme != null && isValidTheme(payload.theme)) {
        applyExactTheme(payload.theme, {
          animate: true,
          persistLocal: false,
          broadcast: false,
        });
      }
    };
  }
}

function setupAppearanceWatchers(): void {
  if (typeof window.matchMedia === "function") {
    colorSchemeQuery ??= window.matchMedia("(prefers-color-scheme: dark)");
    const handleColorSchemeChange = (): void => {
      if (currentAppearance.mode === "system") {
        syncManagedTheme(true);
      }
    };

    if (typeof colorSchemeQuery.addEventListener === "function") {
      colorSchemeQuery.addEventListener("change", handleColorSchemeChange);
    } else if (typeof colorSchemeQuery.addListener === "function") {
      colorSchemeQuery.addListener(handleColorSchemeChange);
    }
  }

  scheduleTimer ??= setInterval(() => {
    if (currentAppearance.mode === "schedule") {
      syncManagedTheme(true);
    }
  }, 30000);
}

function setupSettingsSync(): void {
  settingsUnsubscribe ??= SettingsManager.subscribe(
    ({ settings, changedPaths }: { settings: unknown; changedPaths: string[] }) => {
      const shouldSync =
        changedPaths.includes("*") ||
        changedPaths.includes("general") ||
        changedPaths.some((path) => path.startsWith("general.appearance"));

      if (!shouldSync) {
        return;
      }

      const typedSettings = settings as AppSettings | null;
      const nextAppearance = normalizeAppearance(typedSettings?.general?.appearance);

      applyManagedAppearance(nextAppearance, {
        animate: true,
        persistLocal: true,
        persistSettings: false,
        broadcast: false,
      });
    }
  );
}

function setupDropdownListeners(): void {
  const dropdown = document.getElementById("theme-dropdown");
  const btn = document.getElementById("theme-dropdown-btn");
  const menu = document.getElementById("theme-dropdown-menu");

  if (!dropdown || !btn || !menu) return;

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    dropdown.classList.toggle("is-expanded");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("is-expanded");
  });

  menu.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const item = target.closest<HTMLElement>(".theme-dropdown-item[data-theme]");

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
  const modeSelect = document.getElementById("theme-behavior-select") as HTMLSelectElement | null;
  const lightSelect = document.getElementById("theme-light-select") as HTMLSelectElement | null;
  const darkSelect = document.getElementById("theme-dark-select") as HTMLSelectElement | null;
  const dayStartInput = document.getElementById("theme-day-start") as HTMLInputElement | null;
  const nightStartInput = document.getElementById("theme-night-start") as HTMLInputElement | null;
  const motionSelect = document.getElementById("theme-motion-select") as HTMLSelectElement | null;
  const textScaleSelect = document.getElementById(
    "theme-text-scale-select"
  ) as HTMLSelectElement | null;
  const surfaceSelect = document.getElementById("theme-surface-select") as HTMLSelectElement | null;
  const contrastToggle = document.getElementById(
    "theme-contrast-toggle"
  ) as HTMLInputElement | null;

  list?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const item = target.closest<HTMLElement>(".theme-dropdown-item[data-theme]");
    const theme = item?.getAttribute("data-theme");

    if (theme != null && theme !== "" && isValidTheme(theme)) {
      themeManager.set(theme);
    }
  });

  modeSelect?.addEventListener("change", () => {
    const mode = modeSelect.value;
    if (mode === "manual" || mode === "system" || mode === "schedule") {
      themeManager.updateAppearance({ mode });
    }
  });

  lightSelect?.addEventListener("change", () => {
    const theme = lightSelect.value;
    if (isValidTheme(theme)) {
      themeManager.updateAppearance({ lightTheme: theme });
    }
  });

  darkSelect?.addEventListener("change", () => {
    const theme = darkSelect.value;
    if (isValidTheme(theme)) {
      themeManager.updateAppearance({ darkTheme: theme });
    }
  });

  dayStartInput?.addEventListener("change", () => {
    themeManager.updateAppearance({ dayStart: dayStartInput.value });
  });

  nightStartInput?.addEventListener("change", () => {
    themeManager.updateAppearance({ nightStart: nightStartInput.value });
  });

  motionSelect?.addEventListener("change", () => {
    const motion = motionSelect.value;
    if (motion === "full" || motion === "reduced" || motion === "off") {
      themeManager.updateAppearance({ motion });
    }
  });

  textScaleSelect?.addEventListener("change", () => {
    const textScale = textScaleSelect.value;
    if (textScale === "sm" || textScale === "md" || textScale === "lg") {
      themeManager.updateAppearance({ textScale });
    }
  });

  surfaceSelect?.addEventListener("change", () => {
    const surface = surfaceSelect.value;
    if (surface === "glass" || surface === "soft" || surface === "solid") {
      themeManager.updateAppearance({ surface });
    }
  });

  contrastToggle?.addEventListener("change", () => {
    themeManager.updateAppearance({
      contrast: contrastToggle.checked ? "high" : "normal",
    });
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

    const storedAppearance = getStoredAppearance();
    const legacyTheme = getStoredLegacyTheme();
    currentAppearance =
      storedAppearance ??
      normalizeAppearance(
        legacyTheme != null ? { mode: "manual", manualTheme: legacyTheme } : undefined
      );
    if (legacyTheme != null) {
      if (storedAppearance == null) {
        storeAppearance(currentAppearance);
      }
      clearStoredLegacyTheme();
    }
    currentTheme = resolveThemeFromAppearance(currentAppearance);

    applyAppearanceAttributes(currentAppearance);
    applyTheme(currentTheme, false);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        renderThemeSettingsPanel();
        setupDropdownListeners();
        setupSettingsPanelListeners();
        updateThemePanelUI(currentTheme, currentAppearance);
      });
    } else {
      renderThemeSettingsPanel();
      setupDropdownListeners();
      setupSettingsPanelListeners();
      updateThemePanelUI(currentTheme, currentAppearance);
    }

    setupSyncListeners();
    setupAppearanceWatchers();
    setupSettingsSync();
    i18nUnsubscribe ??= AppI18n.subscribe(() => {
      renderThemeSettingsPanel();
      updateThemeDropdownUI(currentTheme);
    });
    isInitialized = true;
  },

  set(theme: ThemeId, persist: boolean = true): void {
    if (!isValidTheme(theme)) {
      console.warn(themeT("invalidTheme", { theme }));
      return;
    }

    if (persist === false) {
      applyExactTheme(theme, { animate: true, persistLocal: false, broadcast: false });
      return;
    }

    themeManager.updateAppearance({
      mode: "manual",
      manualTheme: theme,
    });
  },

  updateAppearance(patch: Partial<Required<ThemeAppearanceSettings>>): void {
    const nextAppearance = normalizeAppearance({
      ...currentAppearance,
      ...patch,
    });

    applyManagedAppearance(nextAppearance, {
      animate: true,
      persistLocal: true,
      persistSettings: true,
      broadcast: true,
    });
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

  getAppearance(): Required<ThemeAppearanceSettings> {
    return { ...currentAppearance };
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

  window.__ThemeManager = themeManager;
}

export type { ThemeId } from "@shared/settings.js";
export { themeManager as ThemeManager };
