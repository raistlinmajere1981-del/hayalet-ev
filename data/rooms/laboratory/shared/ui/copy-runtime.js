export function createLaboratoryCopyRuntime(deps) {
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
    subtitleFeatureId
  } = deps;
  function toString(value) {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      return toString(entry);
    }).filter((entry) => entry !== null);
  }
  function getBootstrapLocaleCopy(locale) {
    return bootstrapCopy[locale] || bootstrapCopy["en"] || {};
  }
  function getCurrentLocale() {
    return typeof state.locale === "string" && state.locale.trim() !== "" ? state.locale : "en";
  }
  function text(path) {
    const localized = readValue(state.translations, path);
    if (typeof localized === "string") {
      return localized;
    }
    const localeFallback = readValue(getBootstrapLocaleCopy(getCurrentLocale()), path);
    if (typeof localeFallback === "string") {
      return localeFallback;
    }
    const englishFallback = readValue(getBootstrapLocaleCopy("en"), path);
    if (typeof englishFallback === "string") {
      return englishFallback;
    }
    return path[path.length - 1] || "";
  }
  function textFromKey(key) {
    if (key.trim() === "") {
      return "";
    }
    return text(key.split("."));
  }
  function list(path) {
    return toStringArray(readValue(state.translations, path));
  }
  function getActiveFeatureId() {
    return toString(state.context.featureId) || defaultFeatureId;
  }
  function isSubtitleAnalysisFeature() {
    return getActiveFeatureId() === subtitleFeatureId;
  }
  function isAudioAnalysisFeature() {
    return getActiveFeatureId() === audioFeatureId;
  }
  function getFeatureNamespace() {
    return featureNamespaces[getActiveFeatureId()] || featureNamespaces[defaultFeatureId] || "";
  }
  function getFeaturePreviewImage() {
    return featurePreviewImages[getActiveFeatureId()] || featurePreviewImages[defaultFeatureId] || "";
  }
  function featureText(path) {
    const localized = readValue(state.translations, [getFeatureNamespace(), ...path]);
    if (typeof localized === "string") {
      return localized;
    }
    return text(["mediaAnalysis", ...path]);
  }
  function getAvailableSourceFormats() {
    if (!isAudioAnalysisFeature()) {
      return sourceFormats.slice();
    }
    const presets = getAudioAnalysisPresets();
    const capabilities = getAudioAnalysisCapabilities();
    const configuredFormats = toStringArray(presets.allowedSourceKinds).length > 0 ? toStringArray(presets.allowedSourceKinds) : toStringArray(capabilities.allowedSourceKinds);
    const filteredFormats = configuredFormats.filter(function(entry) {
      return sourceFormats.includes(entry);
    });
    return filteredFormats.length > 0 ? filteredFormats : ["audio", "video"];
  }
  function getDefaultSourceKind() {
    if (!isAudioAnalysisFeature()) {
      return "video";
    }
    const configuredKind = toString(getAudioAnalysisPresets().defaultSourceKind);
    if (configuredKind !== null && getAvailableSourceFormats().includes(configuredKind)) {
      return configuredKind;
    }
    return "audio";
  }
  function bootstrapText(key) {
    const localized = readValue(getBootstrapLocaleCopy(getCurrentLocale()), [key]);
    if (typeof localized === "string") {
      return localized;
    }
    const englishFallback = readValue(getBootstrapLocaleCopy("en"), [key]);
    return typeof englishFallback === "string" ? englishFallback : key;
  }
  function subtitleCopy(trValue, enValue) {
    return state.locale === "tr" ? trValue : enValue;
  }
  function subtitleText(path, trFallback, enFallback) {
    const localized = readValue(state.translations, ["subtitleAnalysis", ...path]);
    if (typeof localized === "string") {
      return localized;
    }
    return subtitleCopy(trFallback, enFallback);
  }
  function subtitleTemplate(path, replacements, trFallback, enFallback) {
    return Object.keys(replacements).reduce(
      function(message, key) {
        return message.replaceAll(`{${key}}`, String(replacements[key]));
      },
      subtitleText(path, trFallback, enFallback)
    );
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
    textFromKey
  };
}
