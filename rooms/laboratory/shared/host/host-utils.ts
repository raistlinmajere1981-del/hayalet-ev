type LaboratoryHostUtilsRecord = Record<string, unknown>;

type LaboratoryHostUtilsDeps = {
  audioFeatureId: string;
  getDefaultSourceType: (sourcePresets: LaboratoryHostUtilsRecord) => string;
  toRecord: (value: unknown) => LaboratoryHostUtilsRecord;
};

export function createLaboratoryHostUtils(deps: LaboratoryHostUtilsDeps) {
  const audioFeatureId = deps.audioFeatureId;
  const getDefaultSourceType = deps.getDefaultSourceType;
  const toRecord = deps.toRecord;

  const getPreferredFeatureSourceKind: (
    featureId: string,
    sourcePresets: LaboratoryHostUtilsRecord,
  ) => string = function getPreferredFeatureSourceKind(featureId, sourcePresets) {
    if (featureId === audioFeatureId) {
      return Object.prototype.hasOwnProperty.call(toRecord(sourcePresets).sourceTypes, "audio")
        ? "audio"
        : getDefaultSourceType(sourcePresets);
    }
    return getDefaultSourceType(sourcePresets);
  };

  const toFileUrl: (
    filePath: string | null | undefined,
  ) => string | null = function toFileUrl(filePath) {
    if (typeof filePath !== "string" || filePath.trim() === "") {
      return null;
    }

    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.startsWith("/")) {
      return encodeURI(`file://${normalized}`);
    }
    return encodeURI(`file:///${normalized}`);
  };

  const clampNumber: (
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number,
  ) => number = function clampNumber(value, minimum, maximum, fallback) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) !== true) {
      return fallback;
    }
    return Math.min(maximum, Math.max(minimum, numericValue));
  };

  return {
    clampNumber: clampNumber,
    getPreferredFeatureSourceKind: getPreferredFeatureSourceKind,
    toFileUrl: toFileUrl,
  };
}
