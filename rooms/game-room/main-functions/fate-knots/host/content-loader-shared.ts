import { getFateKnotsAsset, type FateKnotsAssetRegistry } from "./asset-registry.js";

export const featureDir = "main-functions/fate-knots";
export const dataDir = `${featureDir}/data`;

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readGeneratedManifest(relativePath: string, value: unknown, fallback: unknown) {
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

export function attachAsset(
  assetRegistry: FateKnotsAssetRegistry | null | undefined,
  assetId: unknown,
  expectedKind: unknown
) {
  const asset = getFateKnotsAsset(
    assetRegistry,
    normalizeText(assetId),
    typeof expectedKind === "string" ? normalizeText(expectedKind) : undefined
  );
  return {
    assetId: normalizeText(assetId),
    asset,
    uiSrc: asset.uiSrc,
    src: asset.src,
  };
}
