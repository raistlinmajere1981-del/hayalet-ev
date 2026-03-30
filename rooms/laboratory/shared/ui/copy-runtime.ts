export function createLaboratoryCopyRuntime(deps: any) {
  const {
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
    audioFeatureId,
  } = deps;

  function text(path: any) {
    const localized = readValue(state.translations, path);
    if (typeof localized === "string") {
      return localized;
    }
    const fallback = readValue(bootstrapCopy[state.locale], path);
    if (typeof fallback === "string") {
      return fallback;
    }
    const englishFallback = readValue(bootstrapCopy.en, path);
    if (typeof englishFallback === "string") {
      return englishFallback;
    }
    return path[path.length - 1] || "";
  }

  function textFromKey(key: any) {
    if (typeof key !== "string" || key.trim() === "") {
      return "";
    }
    return text(key.split("."));
  }

  function list(path: any) {
    const value = readValue(state.translations, path);
    return Array.isArray(value) ? value.filter((item: any) => typeof item === "string") : [];
  }

  function getActiveFeatureId() {
    return typeof state.context.featureId === "string" && state.context.featureId.trim() !== ""
      ? state.context.featureId
      : defaultFeatureId;
  }

  function isSubtitleAnalysisFeature() {
    return getActiveFeatureId() === subtitleFeatureId;
  }

  function isAudioAnalysisFeature() {
    return getActiveFeatureId() === audioFeatureId;
  }

  function getFeatureNamespace() {
    return featureNamespaces[getActiveFeatureId()] || featureNamespaces[defaultFeatureId];
  }

  function getFeaturePreviewImage() {
    return featurePreviewImages[getActiveFeatureId()] || featurePreviewImages[defaultFeatureId];
  }

  function featureText(path: any) {
    const localized = readValue(state.translations, [getFeatureNamespace()].concat(path));
    if (typeof localized === "string") {
      return localized;
    }
    return text(["mediaAnalysis"].concat(path));
  }

  function getAvailableSourceFormats() {
    if (isAudioAnalysisFeature()) {
      const presets = getAudioAnalysisPresets();
      const capabilities = getAudioAnalysisCapabilities();
      const configuredFormats = Array.isArray(presets.allowedSourceKinds)
        ? presets.allowedSourceKinds
        : Array.isArray(capabilities.allowedSourceKinds)
          ? capabilities.allowedSourceKinds
          : [];
      const filteredFormats = configuredFormats.filter(function (entry: any) {
        return typeof entry === "string" && sourceFormats.includes(entry);
      });
      return filteredFormats.length > 0 ? filteredFormats : ["audio", "video"];
    }

    return sourceFormats.slice();
  }

  function getDefaultSourceKind() {
    if (isAudioAnalysisFeature()) {
      const configuredKind = getAudioAnalysisPresets().defaultSourceKind;
      if (
        typeof configuredKind === "string" &&
        getAvailableSourceFormats().includes(configuredKind)
      ) {
        return configuredKind;
      }
      return "audio";
    }

    return "video";
  }

  function bootstrapText(key: any) {
    return (
      readValue(bootstrapCopy[state.locale], [key]) || readValue(bootstrapCopy.en, [key]) || key
    );
  }

  function subtitleCopy(trValue: any, enValue: any) {
    return state.locale === "tr" ? trValue : enValue;
  }

  function subtitleText(path: any, trFallback: any, enFallback: any) {
    const localized = readValue(state.translations, ["subtitleAnalysis"].concat(path));
    if (typeof localized === "string") {
      return localized;
    }
    return subtitleCopy(trFallback, enFallback);
  }

  function subtitleTemplate(path: any, replacements: any, trFallback: any, enFallback: any) {
    const template = subtitleText(path, trFallback, enFallback);
    return Object.keys(replacements && typeof replacements === "object" ? replacements : {}).reduce(
      function (message: any, key: any) {
        return message.replaceAll(`{${key}}`, String(replacements[key]));
      },
      template
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
    textFromKey,
  };
}
