import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js"

type LaboratoryRecord = Record<string, unknown>
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"]

type LaboratoryAudioSourceConfigRecord = LaboratoryRecord & {
  allowedSourceKinds?: unknown
  defaultSourceKind?: unknown
}

type LaboratoryCopyRuntimeDeps = {
  audioFeatureId: string
  bootstrapCopy: Record<string, LaboratoryRecord>
  defaultFeatureId: string
  featureNamespaces: Record<string, string>
  featurePreviewImages: Record<string, string>
  getAudioAnalysisCapabilities: () => LaboratoryAudioSourceConfigRecord
  getAudioAnalysisPresets: () => LaboratoryAudioSourceConfigRecord
  readValue: (source: unknown, path: readonly string[]) => unknown
  sourceFormats: string[]
  state: LaboratoryUiState
  subtitleFeatureId: string
}

export function createLaboratoryCopyRuntime(deps: LaboratoryCopyRuntimeDeps) {
  const {
    audioFeatureId,
    bootstrapCopy,
    defaultFeatureId,
    featureNamespaces,
    featurePreviewImages,
    getAudioAnalysisCapabilities,
    getAudioAnalysisPresets,
    readValue,
    sourceFormats,
    state,
    subtitleFeatureId,
  } = deps

  function toString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return []
    }
    return value
      .map(function (entry) {
        return toString(entry)
      })
      .filter((entry): entry is string => entry !== null)
  }

  function getBootstrapLocaleCopy(locale: string): LaboratoryRecord {
    return bootstrapCopy[locale] || bootstrapCopy["en"] || {}
  }

  function getCurrentLocale(): string {
    return typeof state.locale === "string" && state.locale.trim() !== "" ? state.locale : "en"
  }

  function text(path: string[]): string {
    const localized = readValue(state.translations, path)
    if (typeof localized === "string") {
      return localized
    }

    const localeFallback = readValue(getBootstrapLocaleCopy(getCurrentLocale()), path)
    if (typeof localeFallback === "string") {
      return localeFallback
    }

    const englishFallback = readValue(getBootstrapLocaleCopy("en"), path)
    if (typeof englishFallback === "string") {
      return englishFallback
    }

    return path[path.length - 1] || ""
  }

  function textFromKey(key: string): string {
    if (key.trim() === "") {
      return ""
    }
    return text(key.split("."))
  }

  function list(path: string[]): string[] {
    return toStringArray(readValue(state.translations, path))
  }

  function getActiveFeatureId(): string {
    return toString(state.context.featureId) || defaultFeatureId
  }

  function isSubtitleAnalysisFeature(): boolean {
    return getActiveFeatureId() === subtitleFeatureId
  }

  function isAudioAnalysisFeature(): boolean {
    return getActiveFeatureId() === audioFeatureId
  }

  function getFeatureNamespace(): string {
    return featureNamespaces[getActiveFeatureId()] || featureNamespaces[defaultFeatureId] || ""
  }

  function getFeaturePreviewImage(): string {
    return featurePreviewImages[getActiveFeatureId()] || featurePreviewImages[defaultFeatureId] || ""
  }

  function featureText(path: string[]): string {
    const localized = readValue(state.translations, [getFeatureNamespace(), ...path])
    if (typeof localized === "string") {
      return localized
    }
    return text(["mediaAnalysis", ...path])
  }

  function getAvailableSourceFormats(): string[] {
    if (!isAudioAnalysisFeature()) {
      return sourceFormats.slice()
    }

    const presets = getAudioAnalysisPresets()
    const capabilities = getAudioAnalysisCapabilities()
    const configuredFormats =
      toStringArray(presets.allowedSourceKinds).length > 0
        ? toStringArray(presets.allowedSourceKinds)
        : toStringArray(capabilities.allowedSourceKinds)
    const filteredFormats = configuredFormats.filter(function (entry) {
      return sourceFormats.includes(entry)
    })
    return filteredFormats.length > 0 ? filteredFormats : ["audio", "video"]
  }

  function getDefaultSourceKind(): string {
    if (!isAudioAnalysisFeature()) {
      return "video"
    }

    const configuredKind = toString(getAudioAnalysisPresets().defaultSourceKind)
    if (configuredKind !== null && getAvailableSourceFormats().includes(configuredKind)) {
      return configuredKind
    }

    return "audio"
  }

  function bootstrapText(key: string): string {
    const localized = readValue(getBootstrapLocaleCopy(getCurrentLocale()), [key])
    if (typeof localized === "string") {
      return localized
    }
    const englishFallback = readValue(getBootstrapLocaleCopy("en"), [key])
    return typeof englishFallback === "string" ? englishFallback : key
  }

  function subtitleCopy(trValue: string, enValue: string): string {
    return state.locale === "tr" ? trValue : enValue
  }

  function subtitleText(path: string[], trFallback: string, enFallback: string): string {
    const localized = readValue(state.translations, ["subtitleAnalysis", ...path])
    if (typeof localized === "string") {
      return localized
    }
    return subtitleCopy(trFallback, enFallback)
  }

  function subtitleTemplate(
    path: string[],
    replacements: Record<string, string | number>,
    trFallback: string,
    enFallback: string
  ): string {
    return Object.keys(replacements).reduce(function (message, key) {
      return message.replaceAll(`{${key}}`, String(replacements[key]))
    }, subtitleText(path, trFallback, enFallback))
  }

  return {
    bootstrapText,
    featureText,
    getActiveFeatureId,
    getAvailableSourceFormats,
    getDefaultSourceKind,
    getFeatureNamespace,
    getFeaturePreviewImage,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    list,
    subtitleText,
    subtitleTemplate,
    text,
    textFromKey,
  }
}
