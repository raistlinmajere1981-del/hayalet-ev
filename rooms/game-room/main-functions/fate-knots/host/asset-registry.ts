import { fateKnotsRuntimeAssetsManifest } from "../data/runtime-content.module.js";

const featureDir = "main-functions/fate-knots";
const dataDir = `${featureDir}/data`;
const runtimeAssetManifestPath = `${dataDir}/runtime-assets.manifest.json`;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isSafeRelativePath(value) {
  const normalized = normalizeText(value).replace(/\\/g, "/");
  if (normalized === "" || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    return false;
  }
  return normalized.split("/").every(function (segment) {
    return segment !== "" && segment !== "." && segment !== "..";
  });
}

function createFallbackAsset(id, kind) {
  return {
    id: normalizeText(id) || "unknown-asset",
    kind: normalizeText(kind) || "unknown",
    sourcePath: null,
    sourceSize: 0,
    src: null,
    uiSrc: null,
    placeholder: true,
  };
}

function normalizeAssetRecord(candidate) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : {};
  const id = normalizeText(source.id);
  const kind = normalizeText(source.kind) || "unknown";
  const src = isSafeRelativePath(source.src) ? normalizeText(source.src).replace(/\\/g, "/") : null;
  const uiSrc =
    typeof source.uiSrc === "string" && normalizeText(source.uiSrc) !== ""
      ? normalizeText(source.uiSrc).replace(/\\/g, "/")
      : null;

  if (id === "") {
    return null;
  }

  if (src === null || (uiSrc !== null && isSafeRelativePath(uiSrc.replace(/^\.\.\//, "")) !== true)) {
    return null;
  }

  return {
    id,
    kind,
    sourcePath: normalizeText(source.sourcePath) || null,
    sourceSize:
      typeof source.sourceSize === "number" && Number.isFinite(source.sourceSize) && source.sourceSize >= 0
        ? Math.trunc(source.sourceSize)
        : 0,
    src,
    uiSrc,
    placeholder: false,
  };
}

export function getFateKnotsFeatureDir() {
  return featureDir;
}

export function getFateKnotsRuntimeAssetManifestPath() {
  return runtimeAssetManifestPath;
}

export function loadFateKnotsAssetRegistry() {
  const fallback = {
    manifestPath: runtimeAssetManifestPath,
    generatedFrom: null,
    version: 1,
    assets: [],
    assetMap: new Map(),
    byKind: new Map(),
    duplicateIds: [],
    errors: [],
  };

  const parsed =
    fateKnotsRuntimeAssetsManifest &&
    typeof fateKnotsRuntimeAssetsManifest === "object" &&
    Array.isArray(fateKnotsRuntimeAssetsManifest) === false
      ? fateKnotsRuntimeAssetsManifest
      : null;

  if (parsed === null) {
    fallback.errors.push(`missing-runtime-asset-manifest:${runtimeAssetManifestPath}`);
    return fallback;
  }

  const seenIds = new Set();
  const assets = [];
  const assetMap = new Map();
  const byKind = new Map();
  const duplicateIds = [];
  const errors = [];
  const sourceAssets = Array.isArray(parsed.assets) ? parsed.assets : [];

  sourceAssets.forEach(function (entry, index) {
    const normalized = normalizeAssetRecord(entry);
    if (normalized === null) {
      errors.push(`invalid-asset-entry:${index}`);
      return;
    }
    if (seenIds.has(normalized.id)) {
      duplicateIds.push(normalized.id);
      return;
    }
    seenIds.add(normalized.id);
    assets.push(normalized);
    assetMap.set(normalized.id, normalized);
    const kindAssets = byKind.get(normalized.kind) || [];
    kindAssets.push(normalized);
    byKind.set(normalized.kind, kindAssets);
  });

  return {
    manifestPath: runtimeAssetManifestPath,
    generatedFrom: normalizeText(parsed.generatedFrom) || null,
    version:
      typeof parsed.version === "number" && Number.isInteger(parsed.version) ? parsed.version : 1,
    assets,
    assetMap,
    byKind,
    duplicateIds,
    errors,
  };
}

export function getFateKnotsAsset(assetRegistry, assetId, expectedKind) {
  if (!assetRegistry || !assetRegistry.assetMap) {
    return createFallbackAsset(assetId, expectedKind);
  }
  const normalizedId = normalizeText(assetId);
  if (normalizedId === "") {
    return createFallbackAsset(assetId, expectedKind);
  }
  const asset = assetRegistry.assetMap.get(normalizedId);
  if (!asset) {
    return createFallbackAsset(normalizedId, expectedKind);
  }
  if (expectedKind && normalizeText(expectedKind) !== "" && asset.kind !== expectedKind) {
    return {
      ...asset,
      expectedKind,
      kindMismatch: true,
    };
  }
  return asset;
}

export function listFateKnotsAssetsByKind(assetRegistry, kind) {
  if (!assetRegistry || !assetRegistry.byKind) {
    return [];
  }
  return (assetRegistry.byKind.get(normalizeText(kind)) || []).slice();
}
