import { isCameraTrackingCache } from "../domain/lab-analysis-results.js";
import type { CameraTrackingCache } from "../domain/lab-analysis-results.js";

type RecordValue = Record<string, unknown>;

export type LaboratoryTrackingPreviewCache = CameraTrackingCache;

export function isLaboratoryTrackingPreviewCacheUsable(
  cache: LaboratoryTrackingPreviewCache | null
) {
  return (
    cache !== null &&
    cache.fallbackUsed !== true &&
    cache.quality !== "unreliable" &&
    cache.transforms.length > 0
  );
}

function asRecord(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

export function resolveLaboratoryTrackingPreviewCache(
  editConfig: unknown
): LaboratoryTrackingPreviewCache | null {
  const caches = asRecord(editConfig)["cameraTrackingCaches"];
  if (!Array.isArray(caches)) return null;
  for (const value of caches) {
    if (isCameraTrackingCache(value)) return value;
  }
  return null;
}
