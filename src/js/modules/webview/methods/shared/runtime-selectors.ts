import { resolveSelectorCandidates } from "../../../../../../shared/provider-selector-resolution";
import { SettingsManager } from "../../../settings-manager.js";

import type { AppLanguage } from "../../../../../types/settings.js";

type RuntimeProviderConfig = {
  selectors?: Record<string, unknown>;
  selectorMatrix?: {
    selectors?: Record<string, unknown>;
  };
  fileInputSelectors?: unknown;
  uploadTargetSelectors?: unknown;
};

type RuntimeWebviewLike = {
  executeJavaScript?: (script: string) => Promise<unknown>;
};

function resolveAppLanguage(value: unknown): AppLanguage {
  return value === "en" ? "en" : "tr";
}

function getCurrentAppLanguage(): AppLanguage {
  const settings = SettingsManager.getSnapshot() as { general?: { language?: unknown } } | null;
  return resolveAppLanguage(settings?.general?.language);
}

export async function getRuntimeProviderConfig(
  webview: RuntimeWebviewLike
): Promise<RuntimeProviderConfig | null> {
  const config = await webview.executeJavaScript?.(
    "(function() { return window.__hayalet_provider_config ?? null; })();"
  );

  return config && typeof config === "object" ? (config as RuntimeProviderConfig) : null;
}

export function getRuntimeSelectorCandidates(
  config: RuntimeProviderConfig | null,
  key: string
): string[] {
  const entry = config?.selectorMatrix?.selectors?.[key] ?? config?.selectors?.[key];
  return resolveSelectorCandidates(
    entry as string | string[] | Record<string, unknown>,
    getCurrentAppLanguage()
  );
}

export function getRuntimeConfigCandidates(entry: unknown): string[] {
  return resolveSelectorCandidates(
    entry as string | string[] | Record<string, unknown>,
    getCurrentAppLanguage()
  );
}
