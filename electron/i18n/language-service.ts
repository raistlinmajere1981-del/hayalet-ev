import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  AppLanguage,
  LanguageDescriptor,
  LoadedLanguagePack,
  TranslationParams,
} from "../../src/types/i18n.js";
import { DEFAULT_APP_LANGUAGE } from "../../src/types/i18n.js";
import { translateCatalog } from "../../shared/i18n/catalog.js";
import { getBuiltInLanguagePack } from "../../shared/i18n/bundled-languages.js";
import { normalizeAppLanguage } from "../../shared/i18n/locale.js";
import { listInstalledLanguages, loadInstalledLanguage } from "../../shared/i18n/node-loader.js";
import { Paths } from "../paths.ts";

function getLanguageRootDir(): string {
  return join(Paths.getDataDir(), "shared", "languages");
}

function getSettingsPath(): string {
  return join(Paths.getConfigDir(), "settings.json");
}

type SettingsSnapshot = {
  general?: {
    language?: unknown;
  };
};

export async function listAvailableLanguages(): Promise<LanguageDescriptor[]> {
  return await listInstalledLanguages(getLanguageRootDir());
}

export async function loadAvailableLanguage(locale: unknown): Promise<LoadedLanguagePack | null> {
  return await loadInstalledLanguage(getLanguageRootDir(), locale);
}

export async function readElectronAppLanguage(): Promise<AppLanguage> {
  try {
    const raw = await readFile(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw) as SettingsSnapshot;
    return normalizeAppLanguage(parsed.general?.language);
  } catch {
    return DEFAULT_APP_LANGUAGE;
  }
}

export function readElectronAppLanguageSync(): AppLanguage {
  try {
    const raw = readFileSync(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw) as SettingsSnapshot;
    return normalizeAppLanguage(parsed.general?.language);
  } catch {
    return DEFAULT_APP_LANGUAGE;
  }
}

export async function loadResolvedLanguage(locale?: unknown): Promise<LoadedLanguagePack> {
  const resolvedLocale = normalizeAppLanguage(locale ?? (await readElectronAppLanguage()));
  return (
    (await loadAvailableLanguage(resolvedLocale)) ??
    getBuiltInLanguagePack(resolvedLocale) ??
    getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)!
  );
}

export async function createElectronTranslator(
  locale?: unknown
): Promise<{
  locale: AppLanguage;
  t: (key: string, params?: TranslationParams) => string;
}> {
  const activePack = await loadResolvedLanguage(locale);
  const fallbackCatalog = getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)?.catalog;

  return {
    locale: activePack.locale,
    t: (key: string, params?: TranslationParams) =>
      translateCatalog(activePack.catalog, key, params, fallbackCatalog),
  };
}

export async function translateElectronMessage(
  key: string,
  params?: TranslationParams,
  locale?: unknown
): Promise<string> {
  const translator = await createElectronTranslator(locale);
  return translator.t(key, params);
}
