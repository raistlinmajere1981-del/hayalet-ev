import { asNonEmptyString } from "../models/lab-types.js";
export function getLabAssetPath(asset) {
  return asNonEmptyString(asset.localPath) || asNonEmptyString(asset.url);
}
export function getLabAssetPathLeaf(asset) {
  const path = getLabAssetPath(asset);
  if (path === null) {
    return null;
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
export function buildLabAssetMetadataTitle(asset) {
  const lines = [
    `${asset.type}: ${asset.name}`,
    asset.sourceId ? `sourceId: ${asset.sourceId}` : "",
    asset.runId ? `runId: ${asset.runId}` : "",
    asset.localPath ? `path: ${asset.localPath}` : "",
    asset.url ? `url: ${asset.url}` : ""
  ].filter(Boolean);
  return lines.join("\n");
}
