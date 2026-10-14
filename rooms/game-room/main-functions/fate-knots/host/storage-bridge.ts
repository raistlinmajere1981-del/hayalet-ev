type FateKnotsRoomToolResult = {
  success: boolean;
  error?: string;
  paths?: {
    storageDir?: string;
  };
};

type FateKnotsWriteResult = {
  success?: boolean;
  error?: string;
  message?: string;
  path?: string;
};

type FateKnotsStorageElectronApi = {
  roomToolsCall: (request: Record<string, unknown>) => Promise<FateKnotsRoomToolResult>;
  fmWriteFileAtomic: (payload: {
    path: string;
    data: string;
    encoding?: string;
  }) => Promise<FateKnotsWriteResult>;
  readFile: (path: string) => Promise<string | null>;
};

export interface FateKnotsDurableStoragePaths {
  rootDir: string;
  statePath: string;
  universesPath: string;
  runsPath: string;
  forgeDraftPath: string;
}

export interface FateKnotsManagedAssetCandidate {
  assetId: string;
  path: string;
  mimeType?: string | null;
}

export interface FateKnotsManagedAssetVerificationFailure {
  assetId: string;
  message: string;
}

export interface FateKnotsManagedAssetVerificationResult {
  valid: boolean;
  failures: FateKnotsManagedAssetVerificationFailure[];
}

export interface FateKnotsManagedImageWriteRequest {
  jobId: string;
  fileId: string;
  base64: string;
  mimeType: string;
}

let cachedPaths: FateKnotsDurableStoragePaths | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function isStorageElectronApi(value: unknown): value is FateKnotsStorageElectronApi {
  return (
    isRecord(value) &&
    typeof value["roomToolsCall"] === "function" &&
    typeof value["fmWriteFileAtomic"] === "function" &&
    typeof value["readFile"] === "function"
  );
}

function getElectronApi(): FateKnotsStorageElectronApi | null {
  if (typeof window === "undefined" || isStorageElectronApi(window.electronAPI) !== true) {
    return null;
  }
  return window.electronAPI;
}

function joinRuntimePath(base: string, ...segments: string[]): string {
  const separator = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  const trimmedBase = base.replace(/[\\/]+$/, "");
  const cleanSegments = segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, ""));
  return [trimmedBase, ...cleanSegments].join(separator);
}

function normalizeComparablePath(value: string): string | null {
  const raw = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");
  if (
    raw === "" ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    /^https?:\/\//i.test(raw)
  ) {
    return null;
  }
  const segments = raw.split("/");
  if (segments.some((segment) => segment === "..")) return null;
  const normalized = segments
    .filter((segment, index) => segment !== "." || index === 0)
    .join("/")
    .replace(/\/$/, "");
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

function decodeBase64Text(value: string): string {
  if (value.trim() === "") return "";
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function stableSegmentHash(value: string): string {
  let hash = 17;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2_147_483_647;
  }
  return hash.toString(36);
}

function sanitizeManagedSegment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 72);
  const stem = normalized || fallback;
  return `${stem}-${stableSegmentHash(value)}`;
}

function normalizeImageMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase().split(";", 1)[0] ?? "";
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

function imageExtensionForMimeType(mimeType: string): string | null {
  const normalized = normalizeImageMimeType(mimeType);
  if (normalized === "image/png") return "png";
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/bmp") return "bmp";
  if (normalized === "image/avif") return "avif";
  if (normalized === "image/svg+xml") return "svg";
  return null;
}

function decodeBase64Prefix(value: string, maxBytes = 4096): Uint8Array | null {
  try {
    const binary = atob(value.trim());
    if (binary.length === 0) return null;
    const length = Math.min(binary.length, maxBytes);
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function asciiSlice(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function matchesImagePayload(base64: string, mimeType: string): boolean {
  const normalized = normalizeImageMimeType(mimeType);
  const bytes = decodeBase64Prefix(base64);
  if (bytes === null) return false;

  if (normalized === "image/png") {
    return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (normalized === "image/jpeg") {
    return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (normalized === "image/gif") {
    const header = asciiSlice(bytes, 0, 6);
    return header === "GIF87a" || header === "GIF89a";
  }
  if (normalized === "image/webp") {
    return asciiSlice(bytes, 0, 4) === "RIFF" && asciiSlice(bytes, 8, 12) === "WEBP";
  }
  if (normalized === "image/bmp") {
    return asciiSlice(bytes, 0, 2) === "BM";
  }
  if (normalized === "image/avif") {
    const header = asciiSlice(bytes, 0, Math.min(bytes.length, 64));
    return header.slice(4, 8) === "ftyp" && (header.includes("avif") || header.includes("avis"));
  }
  if (normalized === "image/svg+xml") {
    const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "").trimStart();
    return /<svg(?:\s|>)/i.test(text);
  }
  return false;
}

function pathMatchesImageMimeType(filePath: string, mimeType: string): boolean {
  const extension = imageExtensionForMimeType(mimeType);
  return extension !== null && filePath.trim().toLowerCase().endsWith(`.${extension}`);
}

async function ensureFateKnotsManagedDirectory(directoryPath: string, requestId: string): Promise<void> {
  const api = getElectronApi();
  if (api === null) throw new Error("Fate Knots durable Electron storage bridge is unavailable.");
  const ensured = await api.roomToolsCall({
    operation: "ensure-dir",
    roomId: "game-room",
    requestId,
    targetPath: directoryPath,
  });
  if (ensured.success !== true) {
    throw new Error(ensured.error ?? "Fate Knots managed asset directory could not be created.");
  }
}

export async function resolveFateKnotsDurableStoragePaths(): Promise<FateKnotsDurableStoragePaths> {
  if (cachedPaths !== null) return { ...cachedPaths };
  const api = getElectronApi();
  if (api === null) throw new Error("Fate Knots durable Electron storage bridge is unavailable.");

  const resolved = await api.roomToolsCall({
    operation: "resolve-paths",
    roomId: "game-room",
    requestId: "fate-knots-storage-paths",
  });
  const storageDir = resolved.paths?.storageDir?.trim() ?? "";
  if (resolved.success !== true || storageDir === "") {
    throw new Error(resolved.error ?? "Game Room storage directory could not be resolved.");
  }

  const rootDir = joinRuntimePath(storageDir, "fate-knots");
  const ensured = await api.roomToolsCall({
    operation: "ensure-dir",
    roomId: "game-room",
    requestId: "fate-knots-storage-ensure",
    targetPath: rootDir,
  });
  if (ensured.success !== true) {
    throw new Error(ensured.error ?? "Fate Knots storage directory could not be created.");
  }

  cachedPaths = {
    rootDir,
    statePath: joinRuntimePath(rootDir, "state-v1.json"),
    // Legacy split stores remain readable only as a one-time migration source.
    universesPath: joinRuntimePath(rootDir, "universes-v1.json"),
    runsPath: joinRuntimePath(rootDir, "runs-v1.json"),
    forgeDraftPath: joinRuntimePath(rootDir, "forge-draft-v1.json"),
  };
  return { ...cachedPaths };
}

export async function readFateKnotsJsonFile(filePath: string): Promise<unknown | null> {
  const api = getElectronApi();
  if (api === null) throw new Error("Fate Knots durable Electron storage bridge is unavailable.");
  const encoded = await api.readFile(filePath);
  if (encoded === null || encoded.trim() === "") return null;
  const raw = decodeBase64Text(encoded);
  if (raw.trim() === "") return null;
  return JSON.parse(raw) as unknown;
}

export async function writeFateKnotsJsonFile(filePath: string, value: unknown): Promise<void> {
  const api = getElectronApi();
  if (api === null) throw new Error("Fate Knots durable Electron storage bridge is unavailable.");
  const result = await api.fmWriteFileAtomic({
    path: filePath,
    data: `${JSON.stringify(value, null, 2)}\n`,
    encoding: "utf8",
  });
  if (result.success !== true) {
    throw new Error(result.error ?? result.message ?? "Fate Knots durable write failed.");
  }
}

/** Reads an already archived provider artifact without teaching Fate Knots any provider DOM rules. */
export async function readFateKnotsLocalFileBase64(filePath: string): Promise<string> {
  const api = getElectronApi();
  if (api === null) throw new Error("Fate Knots durable Electron storage bridge is unavailable.");
  if (normalizeComparablePath(filePath) === null) {
    throw new Error("Fate Knots provider artifact path is not a usable local file path.");
  }
  const encoded = await api.readFile(filePath);
  if (encoded === null || encoded.trim() === "") {
    throw new Error("Fate Knots provider artifact is missing or empty.");
  }
  return encoded.trim();
}

/**
 * Promotes real image bytes into Fate Knots-owned storage. The returned path is
 * always below `<game-room storage>/fate-knots/assets/` and can therefore pass
 * the final World Forge containment/readability gate.
 */
export async function writeFateKnotsManagedImageFile(
  request: FateKnotsManagedImageWriteRequest
): Promise<string> {
  const api = getElectronApi();
  if (api === null) throw new Error("Fate Knots durable Electron storage bridge is unavailable.");
  const base64 = request.base64.trim();
  if (base64 === "") throw new Error("Fate Knots managed image write received empty bytes.");
  const mimeType = normalizeImageMimeType(request.mimeType);
  if (!mimeType.startsWith("image/")) {
    throw new Error("Fate Knots managed image write requires an image MIME type.");
  }
  const extension = imageExtensionForMimeType(mimeType);
  if (extension === null) {
    throw new Error(`Fate Knots managed image MIME type is unsupported: ${mimeType}`);
  }
  if (matchesImagePayload(base64, mimeType) !== true) {
    throw new Error(`Fate Knots managed image bytes do not match declared MIME type ${mimeType}.`);
  }

  const paths = await resolveFateKnotsDurableStoragePaths();
  const assetsRoot = joinRuntimePath(paths.rootDir, "assets");
  const jobDirectory = joinRuntimePath(
    assetsRoot,
    sanitizeManagedSegment(request.jobId, "job")
  );
  await ensureFateKnotsManagedDirectory(
    jobDirectory,
    `fate-knots-assets-${stableSegmentHash(request.jobId)}`
  );

  const filePath = joinRuntimePath(
    jobDirectory,
    `${sanitizeManagedSegment(request.fileId, "image")}.${extension}`
  );
  const result = await api.fmWriteFileAtomic({
    path: filePath,
    data: base64,
    encoding: "base64",
  });
  if (result.success !== true) {
    throw new Error(result.error ?? result.message ?? "Fate Knots managed image write failed.");
  }
  return filePath;
}

/**
 * Final World Forge gate for provider-produced runtime assets. The planner is
 * provider-neutral, but canonical paths must resolve to non-empty image files
 * physically stored under Fate Knots' managed assets directory.
 */
export async function verifyFateKnotsManagedAssetFiles(
  assets: readonly FateKnotsManagedAssetCandidate[]
): Promise<FateKnotsManagedAssetVerificationResult> {
  const api = getElectronApi();
  if (api === null) {
    return {
      valid: false,
      failures: assets.map((asset) => ({
        assetId: asset.assetId,
        message: "Electron storage bridge is unavailable.",
      })),
    };
  }

  const paths = await resolveFateKnotsDurableStoragePaths();
  const managedRoot = normalizeComparablePath(joinRuntimePath(paths.rootDir, "assets"));
  if (!managedRoot) {
    return {
      valid: false,
      failures: assets.map((asset) => ({
        assetId: asset.assetId,
        message: "Managed asset root is invalid.",
      })),
    };
  }

  const failures: FateKnotsManagedAssetVerificationFailure[] = [];
  for (const asset of assets) {
    const candidate = normalizeComparablePath(asset.path);
    if (!candidate || !candidate.startsWith(`${managedRoot}/`)) {
      failures.push({
        assetId: asset.assetId,
        message: "Asset path is outside managed Fate Knots assets storage.",
      });
      continue;
    }
    const mimeType =
      typeof asset.mimeType === "string" ? normalizeImageMimeType(asset.mimeType) : "";
    if (!mimeType.startsWith("image/") || imageExtensionForMimeType(mimeType) === null) {
      failures.push({
        assetId: asset.assetId,
        message: "Materialized runtime asset must declare a supported image MIME type.",
      });
      continue;
    }
    if (pathMatchesImageMimeType(asset.path, mimeType) !== true) {
      failures.push({
        assetId: asset.assetId,
        message: "Materialized asset extension does not match its declared MIME type.",
      });
      continue;
    }
    try {
      // readFile returns base64 for binary files; a directory/nonexistent path is not a valid stored asset.
      // eslint-disable-next-line no-await-in-loop
      const encoded = await api.readFile(asset.path);
      if (encoded === null || encoded.trim() === "") {
        failures.push({
          assetId: asset.assetId,
          message: "Materialized asset file is missing or empty.",
        });
      } else if (matchesImagePayload(encoded, mimeType) !== true) {
        failures.push({
          assetId: asset.assetId,
          message: "Materialized asset bytes do not match its declared MIME type.",
        });
      }
    } catch {
      failures.push({
        assetId: asset.assetId,
        message: "Materialized asset file is not readable.",
      });
    }
  }

  return { valid: failures.length === 0, failures };
}