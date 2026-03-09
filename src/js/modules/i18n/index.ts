import type {
  AppLanguage,
  LanguageDescriptor,
  LoadedLanguagePack,
  TranslationCatalog,
  TranslationParams,
} from "@shared/i18n.js";
import { DEFAULT_APP_LANGUAGE } from "@shared/i18n.js";
import { translateCatalog } from "../../../../shared/i18n/catalog.js";
import {
  getBuiltInLanguageDescriptors,
  getBuiltInLanguagePack,
} from "../../../../shared/i18n/bundled-languages.js";
import { normalizeAppLanguage } from "../../../../shared/i18n/locale.js";

interface I18nSettingsSnapshot {
  general?: {
    language?: unknown;
  };
}

interface I18nSettingsEvent {
  settings: unknown;
  changedPaths: string[];
}

interface I18nSettingsManager {
  getSnapshot(): I18nSettingsSnapshot | null;
  subscribe(listener: (event: I18nSettingsEvent) => void): () => void;
}

function formatLanguageLabel(language: LanguageDescriptor): string {
  const englishName = language.englishName?.trim();
  if (!englishName || englishName === language.nativeName) {
    return language.nativeName;
  }

  return `${language.nativeName} (${englishName})`;
}

class AppI18nManager {
  private currentLocale: AppLanguage = DEFAULT_APP_LANGUAGE;
  private activePack: LoadedLanguagePack =
    getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE) ?? {
      locale: DEFAULT_APP_LANGUAGE,
      nativeName: "Türkçe",
      source: "builtin",
      catalog: {},
    };
  private activeCatalog: TranslationCatalog = this.activePack.catalog;
  private fallbackCatalog: TranslationCatalog = this.activePack.catalog;
  private availableLanguages: LanguageDescriptor[] = getBuiltInLanguageDescriptors();
  private listeners = new Set<(pack: LoadedLanguagePack) => void>();
  private settingsUnsubscribe: (() => void) | null = null;

  private applyDocumentLocale(pack: LoadedLanguagePack): void {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = pack.locale;
    document.documentElement.dir = pack.direction ?? "ltr";
    document.body?.setAttribute("data-app-language", pack.locale);
  }

  private emitChange(pack: LoadedLanguagePack): void {
    for (const listener of this.listeners) {
      listener(pack);
    }
  }

  async bootstrap(settingsManager: I18nSettingsManager): Promise<void> {
    await this.setLocale(settingsManager.getSnapshot()?.general?.language);

    if (this.settingsUnsubscribe !== null) {
      return;
    }

    this.settingsUnsubscribe = settingsManager.subscribe((event) => {
      if (
        event.changedPaths.includes("*") === false &&
        event.changedPaths.some((path) => path.startsWith("general")) === false
      ) {
        return;
      }

      const settings = event.settings as I18nSettingsSnapshot | null;
      void this.setLocale(settings?.general?.language);
    });
  }

  async listLanguages(): Promise<LanguageDescriptor[]> {
    const api = window.electronAPI;
    if (!api?.i18nListLanguages) {
      return this.availableLanguages;
    }

    try {
      const languages = await api.i18nListLanguages();
      if (Array.isArray(languages) && languages.length > 0) {
        this.availableLanguages = languages;
      }
    } catch {
      this.availableLanguages = getBuiltInLanguageDescriptors();
    }

    return this.availableLanguages;
  }

  async setLocale(locale: unknown): Promise<void> {
    const normalized = normalizeAppLanguage(locale);
    const api = window.electronAPI;
    const previousLocale = this.currentLocale;
    let nextPack: LoadedLanguagePack | null = null;

    try {
      nextPack = api?.i18nLoadLanguage ? await api.i18nLoadLanguage(normalized) : null;
    } catch {
      nextPack = null;
    }

    this.currentLocale = normalized;
    this.activePack = nextPack ?? getBuiltInLanguagePack(normalized) ?? this.activePack;
    this.activeCatalog = this.activePack.catalog;
    this.applyDocumentLocale(this.activePack);

    if (previousLocale !== this.currentLocale) {
      this.emitChange(this.activePack);
    }
  }

  getLocale(): AppLanguage {
    return this.currentLocale;
  }

  subscribe(listener: (pack: LoadedLanguagePack) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  t(key: string, params?: TranslationParams): string {
    return translateCatalog(this.activeCatalog, key, params, this.fallbackCatalog);
  }
}

export { formatLanguageLabel };
export const AppI18n = new AppI18nManager();
