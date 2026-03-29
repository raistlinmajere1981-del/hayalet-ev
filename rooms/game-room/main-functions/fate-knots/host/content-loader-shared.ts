import { getFateKnotsAsset } from "./asset-registry.js";

export const featureDir = "main-functions/fate-knots";
export const dataDir = `${featureDir}/data`;

export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function readGeneratedManifest(relativePath, value, fallback) {
  const manifestPath = `${dataDir}/${relativePath}`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      path: manifestPath,
      value: fallback,
      error: `missing-generated-manifest:${relativePath}`,
    };
  }
  return {
    path: manifestPath,
    value,
    error: null,
  };
}

export function attachAsset(assetRegistry, assetId, expectedKind) {
  const asset = getFateKnotsAsset(assetRegistry, assetId, expectedKind);
  return {
    assetId: normalizeText(assetId),
    asset,
    uiSrc: asset.uiSrc,
    src: asset.src,
  };
}
