import {
  BUILT_IN_APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  type AppLanguage,
  type BuiltInAppLanguage,
  type SelectorLanguage,
} from "../../src/types/i18n.js";

export function canonicalizeLocaleTag(input: string): string {
  const trimmed = input.trim().replace(/_/g, "-");
  if (trimmed === "") {
    return DEFAULT_APP_LANGUAGE;
  }

  try {
    return new Intl.Locale(trimmed).toString();
  } catch {
    return trimmed;
  }
}

export function normalizeAppLanguage(value: unknown): AppLanguage {
  if (typeof value !== "string") {
    return DEFAULT_APP_LANGUAGE;
  }

  const normalized = canonicalizeLocaleTag(value);
  return normalized === "" ? DEFAULT_APP_LANGUAGE : (normalized as AppLanguage);
}

export function isBuiltInAppLanguage(value: unknown): value is BuiltInAppLanguage {
  return typeof value === "string" && BUILT_IN_APP_LANGUAGES.includes(value as BuiltInAppLanguage);
}

export function resolveSelectorLanguage(value: unknown): SelectorLanguage {
  const normalized = normalizeAppLanguage(value).toLowerCase();
  return normalized === "tr" || normalized.startsWith("tr-") ? "tr" : "en";
}

export function resolveIntlLocale(value: unknown): string {
  const normalized = normalizeAppLanguage(value);
  if (normalized === "en") {
    return "en-US";
  }
  if (normalized === "tr") {
    return "tr-TR";
  }
  return canonicalizeLocaleTag(normalized);
}
