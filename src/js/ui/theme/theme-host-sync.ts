import type { ThemeAppearanceSettings, ThemeId } from "@shared/settings.js";

import { THEME_CONFIG } from "./theme-constants.js";
import type { ThemeInfo } from "./theme-contract.js";

export function resolveThemeFromSearchParams(
  search: string,
  availableThemes: readonly ThemeInfo[]
): ThemeId | null {
  const themeParam = new URLSearchParams(search).get("theme");
  if (themeParam == null || themeParam === "") {
    return null;
  }

  return availableThemes.find((item) => item.id === themeParam)?.id ?? null;
}

export function isOpencodeUiThemeHost(activeProviderId: string, currentUrl: string): boolean {
  return activeProviderId === "opencode-ui" || currentUrl.includes("/pages/opencode-ui.html");
}

export function buildInlineThemeSyncScript(
  theme: ThemeId,
  appearance: Required<ThemeAppearanceSettings>
): string {
  return `(function() {
    try {
      const nextTheme = ${JSON.stringify(theme)};
      const nextAppearance = ${JSON.stringify(appearance)};
      if (window.__ThemeManager && typeof window.__ThemeManager.set === "function") {
        window.__ThemeManager.set(nextTheme, false);
        return true;
      }

      document.documentElement.setAttribute(${JSON.stringify(THEME_CONFIG.attribute)}, nextTheme);
      document.documentElement.setAttribute("data-theme-mode", nextAppearance.mode);
      document.documentElement.setAttribute("data-theme-motion", nextAppearance.motion);
      document.documentElement.setAttribute("data-theme-scale", nextAppearance.textScale);
      document.documentElement.setAttribute("data-theme-surface", nextAppearance.surface);
      document.documentElement.setAttribute("data-theme-contrast", nextAppearance.contrast);
      document.documentElement.setAttribute("data-app-ui-scale", String(nextAppearance.uiScale));
      document.documentElement.style.setProperty(
        "--app-ui-scale-factor",
        String(nextAppearance.uiScale / 100)
      );
      try {
        localStorage.setItem(
          ${JSON.stringify(THEME_CONFIG.appearanceStorageKey)},
          JSON.stringify(nextAppearance)
        );
      } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  })();`;
}
