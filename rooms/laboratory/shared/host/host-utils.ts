// @ts-nocheck
export function createLaboratoryHostUtils(deps) {
  const audioFeatureId = deps.audioFeatureId;
  const getDefaultSourceType = deps.getDefaultSourceType;
  const toRecord = deps.toRecord;

  function getPreferredFeatureSourceKind(featureId, sourcePresets) {
    if (featureId === audioFeatureId) {
      return Object.prototype.hasOwnProperty.call(toRecord(sourcePresets).sourceTypes, "audio")
        ? "audio"
        : getDefaultSourceType(sourcePresets);
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
    clampNumber: clampNumber,
    getPreferredFeatureSourceKind: getPreferredFeatureSourceKind,
    toFileUrl: toFileUrl,
  };
}
