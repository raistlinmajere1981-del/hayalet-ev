type LaboratoryHostUtilsRecord = Record<string, unknown>;

type LaboratoryHostUtilsDeps = {
  audioFeatureId: string;
  getDefaultSourceType: (sourcePresets: LaboratoryHostUtilsRecord) => string;
  toRecord: (value: unknown) => LaboratoryHostUtilsRecord;
};

export function createLaboratoryHostUtils(deps: LaboratoryHostUtilsDeps) {
  const { audioFeatureId, getDefaultSourceType, toRecord } = deps;

  function getPreferredFeatureSourceKind(
    featureId: string,
    sourcePresets: LaboratoryHostUtilsRecord
  ): string {
    const sourceTypes = toRecord(toRecord(sourcePresets)["sourceTypes"]);
    if (
      featureId === audioFeatureId &&
      Object.prototype.hasOwnProperty.call(sourceTypes, "audio")
    ) {
      return "audio";
    }
    return getDefaultSourceType(sourcePresets);
  }

  function toFileUrl(filePath: string | null | undefined): string | null {
    if (typeof filePath !== "string" || filePath.trim() === "") {
      return null;
    }

    const normalized = filePath.trim().replace(/\\/g, "/");
    const url = new URL("file:///");
    url.pathname = normalized.startsWith("/") ? normalized : `/${normalized}`;
    return url.toString();
  }

  function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) !== true) {
      return fallback;
    }
    return Math.min(maximum, Math.max(minimum, numericValue));
  }

  return {
    clampNumber,
    getPreferredFeatureSourceKind,
    toFileUrl,
  };
}
