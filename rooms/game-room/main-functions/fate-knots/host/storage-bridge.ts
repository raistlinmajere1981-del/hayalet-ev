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

function decodeBase64Text(value: string): string {
  if (value.trim() === "") return "";
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder("utf-8").decode(bytes);
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
