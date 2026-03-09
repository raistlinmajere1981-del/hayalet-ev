import type {
  BuiltInAppLanguage,
  ExternalLanguageManifest,
  LanguageDescriptor,
  LoadedLanguagePack,
  TranslationCatalog,
} from "../../src/types/i18n.js";
import { BUILT_IN_APP_LANGUAGES } from "../../src/types/i18n.js";
import { isBuiltInAppLanguage, normalizeAppLanguage, resolveSelectorLanguage } from "./locale.js";

import trCatalogJson from "../languages/tr/index.json";
import trManifestJson from "../languages/tr/manifest.json";
import enCatalogJson from "../languages/en/index.json";
import enManifestJson from "../languages/en/manifest.json";

interface BuiltInManifestJson extends Omit<ExternalLanguageManifest, "description"> {
  description?: string | null;
}

const BUILT_IN_CATALOGS: Record<BuiltInAppLanguage, TranslationCatalog> = {
  tr: trCatalogJson as TranslationCatalog,
  en: enCatalogJson as TranslationCatalog,
};

const BUILT_IN_MANIFESTS: Record<BuiltInAppLanguage, BuiltInManifestJson> = {
  tr: trManifestJson as BuiltInManifestJson,
  en: enManifestJson as BuiltInManifestJson,
};

function createBuiltInDescriptor(locale: BuiltInAppLanguage): LanguageDescriptor {
  const manifest = BUILT_IN_MANIFESTS[locale];
  const nativeName =
    typeof manifest.nativeName === "string" && manifest.nativeName.trim() !== ""
      ? manifest.nativeName.trim()
      : locale;
  const englishName =
    typeof manifest.englishName === "string" && manifest.englishName.trim() !== ""
      ? manifest.englishName.trim()
      : undefined;
  const description =
    typeof manifest.description === "string" && manifest.description.trim() !== ""
      ? manifest.description.trim()
      : undefined;

  return {
    locale,
    nativeName,
    ...(englishName !== undefined ? { englishName } : {}),
    ...(description !== undefined ? { description } : {}),
    selectorLanguage: manifest.selectorLanguage ?? resolveSelectorLanguage(locale),
    direction: manifest.direction ?? "ltr",
    source: "builtin",
  };
}

const BUILT_IN_DESCRIPTORS = Object.fromEntries(
  BUILT_IN_APP_LANGUAGES.map((locale) => [locale, createBuiltInDescriptor(locale)])
) as Record<BuiltInAppLanguage, LanguageDescriptor>;

export function getBuiltInLanguageDescriptors(): LanguageDescriptor[] {
  return BUILT_IN_APP_LANGUAGES.map((locale) => BUILT_IN_DESCRIPTORS[locale]);
}

export function getBuiltInLanguageDescriptor(locale: unknown): LanguageDescriptor | null {
  const normalized = normalizeAppLanguage(locale);
  if (isBuiltInAppLanguage(normalized) === false) {
    return null;
  }

  return BUILT_IN_DESCRIPTORS[normalized];
}

export function getBuiltInLanguagePack(locale: unknown): LoadedLanguagePack | null {
  const normalized = normalizeAppLanguage(locale);
  if (isBuiltInAppLanguage(normalized) === false) {
    return null;
  }

  return {
    ...BUILT_IN_DESCRIPTORS[normalized],
    catalog: BUILT_IN_CATALOGS[normalized],
  };
}
