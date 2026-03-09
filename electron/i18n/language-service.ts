import { join } from "node:path";

import type { LanguageDescriptor, LoadedLanguagePack } from "../../src/types/i18n.js";
import { listInstalledLanguages, loadInstalledLanguage } from "../../shared/i18n/node-loader.js";
import { Paths } from "../paths.ts";

function getLanguageRootDir(): string {
  return join(Paths.getDataDir(), "shared", "languages");
}

export async function listAvailableLanguages(): Promise<LanguageDescriptor[]> {
  return await listInstalledLanguages(getLanguageRootDir());
}

export async function loadAvailableLanguage(locale: unknown): Promise<LoadedLanguagePack | null> {
  return await loadInstalledLanguage(getLanguageRootDir(), locale);
}
