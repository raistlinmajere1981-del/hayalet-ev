const LAB_ASSET_TYPES = [
  "source",
  "clip",
  "frame",
  "audio",
  "image",
  "report",
  "artifact"
];
function toRecord(value) {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value;
  }
  return {};
}
function asString(value) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}
function asNonEmptyString(value) {
  const text = asString(value).trim();
  return text !== "" ? text : null;
}
function asTimestamp(value, fallback = Date.now()) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = asNonEmptyString(value);
  if (text !== null) {
    const parsed = Date.parse(text);
    if (Number.isNaN(parsed) !== true) {
      return parsed;
    }
  }
  return fallback;
}
function isLabAssetType(value) {
  return LAB_ASSET_TYPES.includes(value);
}
function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  const entries = value.map(function(entry) {
    return asNonEmptyString(entry);
  }).filter((entry) => entry !== null);
  return entries.length > 0 ? Array.from(new Set(entries)) : void 0;
}
function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function basename(value) {
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}
function deriveProjectId(project) {
  return asNonEmptyString(project["id"]) || "project";
}
function getProjectSource(project) {
  return toRecord(project["source"]);
}
export function deriveLabSourceId(project) {
  const source = getProjectSource(project);
  const storedPath = asNonEmptyString(source["storedPath"]);
  const sourceUrl = asNonEmptyString(source["sourceUrl"]);
  const sourceKind = asNonEmptyString(source["kind"]) || "unknown";
  const identity = storedPath || sourceUrl;
  if (identity === null) {
    return null;
  }
  return `source-${hashText([deriveProjectId(project), sourceKind, identity].join("|"))}`;
}
export function normalizeLabAsset(value) {
  const record = toRecord(value);
  const id = asNonEmptyString(record["id"]);
  const type = record["type"];
  if (id === null || isLabAssetType(type) !== true) {
    return null;
  }
  const name = asNonEmptyString(record["name"]);
  if (name === null) {
    return null;
  }
  const localPath = asNonEmptyString(record["localPath"]);
  const url = asNonEmptyString(record["url"]);
  const sourceId = asNonEmptyString(record["sourceId"]);
  const runId = asNonEmptyString(record["runId"]);
  const intentIds = normalizeStringArray(record["intentIds"]);
  const metadata = toRecord(record["metadata"]);
  return {
    id,
    type,
    name,
    ...url === null ? {} : { url },
    ...localPath === null ? {} : { localPath },
    createdAt: asTimestamp(record["createdAt"]),
    ...sourceId === null ? {} : { sourceId },
    ...runId === null ? {} : { runId },
    ...intentIds === void 0 ? {} : { intentIds },
    ...Object.keys(metadata).length === 0 ? {} : { metadata }
  };
}
export function normalizeLabAssets(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const assets = [];
  value.forEach(function(entry) {
    const asset = normalizeLabAsset(entry);
    if (asset === null || assets.some((existing) => existing.id === asset.id)) {
      return;
    }
    assets.push(asset);
  });
  return assets;
}
export function upsertLabAsset(assetsValue, assetValue) {
  const assets = normalizeLabAssets(assetsValue);
  const asset = normalizeLabAsset(assetValue);
  if (asset === null) {
    return assets;
  }
  const index = assets.findIndex(function(entry) {
    return entry.id === asset.id;
  });
  if (index === -1) {
    return assets.concat(asset);
  }
  const nextAssets = assets.slice();
  nextAssets[index] = {
    ...nextAssets[index],
    ...asset
  };
  return nextAssets;
}
export function removeLabAssetById(assetsValue, assetId) {
  const id = asNonEmptyString(assetId);
  if (id === null) {
    return normalizeLabAssets(assetsValue);
  }
  return normalizeLabAssets(assetsValue).filter(function(asset) {
    return asset.id !== id;
  });
}
export function findLabAssetById(project, assetId) {
  const id = asNonEmptyString(assetId);
  if (id === null) {
    return null;
  }
  return normalizeLabAssets(project["assets"]).find(function(asset) {
    return asset.id === id;
  }) || null;
}
export function buildSourceLabAsset(project) {
  const source = getProjectSource(project);
  const localPath = asNonEmptyString(source["storedPath"]);
  const sourceUrl = asNonEmptyString(source["sourceUrl"]);
  const identity = localPath || sourceUrl;
  const sourceId = deriveLabSourceId(project);
  if (identity === null || sourceId === null) {
    return null;
  }
  const sourceKind = asNonEmptyString(source["kind"]) || "video";
  const routeLabel = asNonEmptyString(source["routeLabel"]);
  const storedFileName = asNonEmptyString(source["storedFileName"]);
  const sourceMetadata = toRecord(source["metadata"]);
  const name = storedFileName || (localPath === null ? null : basename(localPath)) || (sourceUrl === null ? null : sourceUrl) || "Source";
  return {
    id: sourceId,
    type: "source",
    name,
    ...sourceUrl === null ? {} : { url: sourceUrl },
    ...localPath === null ? {} : { localPath },
    createdAt: asTimestamp(sourceMetadata["extractedAt"], asTimestamp(project["createdAt"])),
    sourceId,
    metadata: {
      ...sourceMetadata,
      kind: sourceKind,
      mode: asNonEmptyString(source["mode"]) || "local",
      mimeType: asNonEmptyString(source["mimeType"]),
      routeLabel,
      storedFileName,
      projectId: deriveProjectId(project)
    }
  };
}
export function syncSourceLabAssetForProject(project, assetsValue) {
  const sourceAsset = buildSourceLabAsset(project);
  if (sourceAsset === null) {
    return normalizeLabAssets(assetsValue);
  }
  return upsertLabAsset(assetsValue, sourceAsset);
}
export function createLabOutputAsset(project, input) {
  const localPath = asNonEmptyString(input.localPath);
  const url = asNonEmptyString(input.url);
  const name = asNonEmptyString(input.name) || (localPath === null ? null : basename(localPath)) || (url === null ? null : url) || input.type;
  const sourceId = asNonEmptyString(input.sourceId) || deriveLabSourceId(project) || void 0;
  const runId = asNonEmptyString(input.runId) || void 0;
  const id = asNonEmptyString(input.id) || `asset-${input.type}-${hashText([deriveProjectId(project), input.type, localPath || url || name].join("|"))}`;
  return {
    id,
    type: input.type,
    name,
    ...url === null ? {} : { url },
    ...localPath === null ? {} : { localPath },
    createdAt: typeof input.createdAt === "number" ? input.createdAt : Date.now(),
    ...sourceId === void 0 ? {} : { sourceId },
    ...runId === void 0 ? {} : { runId },
    ...input.intentIds && input.intentIds.length > 0 ? { intentIds: Array.from(new Set(input.intentIds)) } : {},
    ...input.metadata && Object.keys(input.metadata).length > 0 ? { metadata: input.metadata } : {}
  };
}
export function serializeLabAssetForSnapshot(value, toFileUrl) {
  const asset = normalizeLabAsset(value);
  if (asset === null) {
    return null;
  }
  const fileUrl = asset.localPath ? toFileUrl(asset.localPath) : asset.url || "";
  return {
    ...asset,
    ...fileUrl === "" ? {} : { url: fileUrl }
  };
}
