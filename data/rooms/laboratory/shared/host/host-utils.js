export function createLaboratoryHostUtils(deps) {
  const { audioFeatureId, getDefaultSourceType, toRecord } = deps;
  function getPreferredFeatureSourceKind(featureId, sourcePresets) {
    const sourceTypes = toRecord(toRecord(sourcePresets)["sourceTypes"]);
    if (featureId === audioFeatureId && Object.prototype.hasOwnProperty.call(sourceTypes, "audio")) {
      return "audio";
    }
    return getDefaultSourceType(sourcePresets);
  }
  function toFileUrl(filePath) {
    if (typeof filePath !== "string" || filePath.trim() === "") {
      return null;
    }
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.startsWith("/")) {
      return encodeURI(`file://${normalized}`);
    }
    return encodeURI(`file:///${normalized}`);
  }
  function clampNumber(value, minimum, maximum, fallback) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) !== true) {
      return fallback;
    }
    return Math.min(maximum, Math.max(minimum, numericValue));
  }
  return {
    clampNumber,
    getPreferredFeatureSourceKind,
    toFileUrl
  };
}
