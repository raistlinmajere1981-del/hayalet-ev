import { asLabRecord, asNonEmptyString, asNumber } from "../models/lab-types.js";
import type { LabAsset } from "../models/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";

export function getLabAssetPath(asset: LabAsset): string | null {
  return asNonEmptyString(asset.localPath) || asNonEmptyString(asset.url);
}

export function getLabAssetPathLeaf(asset: LabAsset): string | null {
  const path = getLabAssetPath(asset);
  if (path === null) {
    return null;
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function buildLabAssetMetadataTitle(asset: LabAsset): string {
  const lines = [
    `${asset.type}: ${asset.name}`,
    asset.sourceId ? `sourceId: ${asset.sourceId}` : "",
    asset.derivedFromAssetId ? `derivedFromAssetId: ${asset.derivedFromAssetId}` : "",
    asset.derivedFromSourceId ? `derivedFromSourceId: ${asset.derivedFromSourceId}` : "",
    asset.runId ? `runId: ${asset.runId}` : "",
    asset.localPath ? `path: ${asset.localPath}` : "",
    asset.url ? `url: ${asset.url}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function getLabAssetSyncLabel(asset: LabAsset, copy?: LabI18n): string | null {
  if (asset.type !== "audio") {
    return null;
  }
  const metadata = asLabRecord(asset.metadata);
  const durationMs = asNumber(metadata["durationMs"]);
  const startOffsetMs = asNumber(metadata["startOffsetMs"]);
  if (durationMs === null && startOffsetMs === null) {
    return null;
  }
  if (startOffsetMs === null || startOffsetMs === 0) {
    return (
      copy?.t("mediaAnalysis.assets.sync.sameAxis", "Senkron: ✓ Aynı zaman ekseni") ??
      "Senkron: ✓ Aynı zaman ekseni"
    );
  }
  return (
    copy?.t("mediaAnalysis.assets.sync.offset", "Senkron: Ofset {offset} ms", {
      offset: Math.round(startOffsetMs),
    }) ?? `Senkron: Ofset ${String(Math.round(startOffsetMs))} ms`
  );
}
