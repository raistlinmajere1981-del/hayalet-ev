import { asNonEmptyString } from "../models/lab-types.js";
import type { LabAsset } from "../models/lab-types.js";

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
    asset.runId ? `runId: ${asset.runId}` : "",
    asset.localPath ? `path: ${asset.localPath}` : "",
    asset.url ? `url: ${asset.url}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}
