type RecordValue = Record<string, unknown>;

export type LaboratoryTrackingPreviewCache = RecordValue & {
  algorithm: string;
  anchorSeconds: number;
  cacheId: string;
  fallbackUsed: boolean;
  mode: string;
  quality: string;
  sourceHeight: number | null;
  sourceWidth: number | null;
  transforms: unknown[];
};

function asRecord(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeCandidate(
  value: unknown,
  fallbackSourceWidth: number | null,
  fallbackSourceHeight: number | null
): LaboratoryTrackingPreviewCache | null {
  const record = asRecord(value);
  const algorithm = stringValue(record["algorithm"]);
  const anchorSeconds = finite(record["anchorSeconds"]);
  const cacheId = stringValue(record["cacheId"]);
  const rawTransforms = Array.isArray(record["transforms"])
    ? (record["transforms"] as unknown[])
    : Array.isArray(record["transformSeries"])
      ? (record["transformSeries"] as unknown[])
      : [];
  if (
    algorithm !== "feature-similarity-ransac-v2" ||
    anchorSeconds === null ||
    cacheId === null ||
    rawTransforms.length === 0
  ) {
    return null;
  }
  return {
    ...record,
    algorithm,
    anchorSeconds,
    cacheId,
    fallbackUsed: record["fallbackUsed"] === true,
    mode: stringValue(record["mode"]) ?? "fixed-roi-fallback",
    quality: stringValue(record["quality"]) ?? "unreliable",
    sourceWidth: finite(record["sourceWidth"]) ?? fallbackSourceWidth,
    sourceHeight: finite(record["sourceHeight"]) ?? fallbackSourceHeight,
    transforms: rawTransforms,
  };
}

export function resolveLaboratoryTrackingPreviewCache(
  editConfig: unknown,
  options: {
    sourceHeight?: number | null;
    sourceWidth?: number | null;
  } = {}
): LaboratoryTrackingPreviewCache | null {
  const edit = asRecord(editConfig);
  const sourceWidth = options.sourceWidth ?? null;
  const sourceHeight = options.sourceHeight ?? null;
  const caches = Array.isArray(edit["cameraTrackingCaches"])
    ? (edit["cameraTrackingCaches"] as unknown[])
    : [];
  for (const value of caches) {
    const normalized = normalizeCandidate(value, sourceWidth, sourceHeight);
    if (normalized !== null) return normalized;
  }

  const history = Array.isArray(edit["temporalStressTests"])
    ? (edit["temporalStressTests"] as unknown[])
    : [];
  for (const value of history) {
    const entry = asRecord(value);
    const tracking = asRecord(entry["trackingV2"]);
    if (tracking["status"] !== "completed") continue;
    const normalized = normalizeCandidate(tracking, sourceWidth, sourceHeight);
    if (normalized !== null) return normalized;
  }
  return null;
}
