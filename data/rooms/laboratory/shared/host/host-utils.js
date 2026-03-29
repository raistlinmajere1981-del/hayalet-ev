export function createLaboratoryHostUtils(deps) {
  const audioFeatureId = deps.audioFeatureId;
  const getDefaultSourceType = deps.getDefaultSourceType;
  const toRecord = deps.toRecord;
  const getPreferredFeatureSourceKind = function getPreferredFeatureSourceKind2(featureId, sourcePresets) {
    if (featureId === audioFeatureId) {
      return Object.prototype.hasOwnProperty.call(toRecord(sourcePresets).sourceTypes, "audio") ? "audio" : getDefaultSourceType(sourcePresets);
    }
    return getDefaultSourceType(sourcePresets);
  };
  const toFileUrl = function toFileUrl2(filePath) {
    if (typeof filePath !== "string" || filePath.trim() === "") {
      return null;
    }
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.startsWith("/")) {
      return encodeURI(`file://${normalized}`);
    }
    return encodeURI(`file:///${normalized}`);
  };
  const clampNumber = function clampNumber2(value, minimum, maximum, fallback) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) !== true) {
      return fallback;
    }
    return Math.min(maximum, Math.max(minimum, numericValue));
  };
  return {
    clampNumber,
    getPreferredFeatureSourceKind,
    toFileUrl
  };
}
