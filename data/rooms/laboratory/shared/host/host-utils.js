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
    const normalized = filePath.trim().replace(/\\/g, "/");
    const url = new URL("file:///");
    url.pathname = normalized.startsWith("/") ? normalized : `/${normalized}`;
    return url.toString();
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
