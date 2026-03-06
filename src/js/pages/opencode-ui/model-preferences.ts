import { SettingsManager } from "../../modules/settings-manager.js";
import type { OpencodeUiModelPreferences } from "./types.js";

export const DEFAULT_OPENCODE_UI_MODEL_PREFERENCES: OpencodeUiModelPreferences = {
  hiddenProviders: [],
  hiddenModels: [],
  favoriteModels: [],
  defaultModelKey: null,
  lastSelectedModelKey: null,
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item !== "")
    )
  );
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed !== "" ? trimmed : null;
}

export function normalizeOpencodeUiModelPreferences(raw: unknown): OpencodeUiModelPreferences {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_OPENCODE_UI_MODEL_PREFERENCES };
  }

  const record = raw as Record<string, unknown>;
  return {
    hiddenProviders: normalizeStringArray(record["hiddenProviders"]),
    hiddenModels: normalizeStringArray(record["hiddenModels"]),
    favoriteModels: normalizeStringArray(record["favoriteModels"]),
    defaultModelKey: normalizeNullableString(record["defaultModelKey"]),
    lastSelectedModelKey: normalizeNullableString(record["lastSelectedModelKey"]),
  };
}

export async function loadOpencodeUiModelPreferences(): Promise<OpencodeUiModelPreferences> {
  try {
    const settings = await SettingsManager.load();
    return normalizeOpencodeUiModelPreferences(settings.assistants?.opencodeUi);
  } catch {
    return { ...DEFAULT_OPENCODE_UI_MODEL_PREFERENCES };
  }
}

export async function saveOpencodeUiModelPreferences(
  preferences: OpencodeUiModelPreferences
): Promise<OpencodeUiModelPreferences> {
  const normalized = normalizeOpencodeUiModelPreferences(preferences);
  try {
    await SettingsManager.set("assistants.opencodeUi", normalized);
  } catch {
    return normalized;
  }
  return normalized;
}
