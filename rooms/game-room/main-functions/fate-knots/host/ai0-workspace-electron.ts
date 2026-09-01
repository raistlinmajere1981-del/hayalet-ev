import type { FateKnotsAi0WorkspaceIo } from "./ai0-workspace.js";

const GAME_ROOM_ID = "game-room";

type UnknownRecord = Record<string, unknown>;

type FateKnotsRoomToolsResult = UnknownRecord & {
  success?: boolean;
  error?: string;
  paths?: UnknownRecord;
};

type FateKnotsFileWriteResult = {
  success?: boolean;
  error?: string;
  message?: string;
};

type FateKnotsElectronApi = {
  roomToolsCall(request: UnknownRecord): Promise<FateKnotsRoomToolsResult>;
  fmWriteFileAtomic(payload: { path: string; data: string }): Promise<FateKnotsFileWriteResult>;
};

function readElectronApi(): FateKnotsElectronApi | null {
  if (typeof window === "undefined") return null;
  const host = window as unknown as { electronAPI?: unknown };
  const value = host.electronAPI;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as UnknownRecord;
  if (typeof record["roomToolsCall"] !== "function") return null;
  if (typeof record["fmWriteFileAtomic"] !== "function") return null;
  return value as FateKnotsElectronApi;
}

async function callRoomTools(request: UnknownRecord): Promise<FateKnotsRoomToolsResult> {
  const electronApi = readElectronApi();
  if (electronApi === null) throw new Error("Fate Knots room tools bridge is unavailable.");
  const result = await electronApi.roomToolsCall(request);
  if (result.success !== true) {
    throw new Error(result.error || "Fate Knots room tools call failed.");
  }
  return result;
}

function readStorageDir(result: FateKnotsRoomToolsResult): string {
  const storageDir = result.paths?.["storageDir"];
  if (typeof storageDir !== "string" || storageDir.trim() === "") {
    throw new Error("Fate Knots room storage path is unavailable.");
  }
  return storageDir.trim();
}

/**
 * Uses the existing room-tools boundary so AI0 workspace paths stay inside the
 * Game Room managed app-data storage root. No repository path is requested or
 * derived here.
 */
export function createFateKnotsAi0WorkspaceElectronIo(): FateKnotsAi0WorkspaceIo | null {
  if (readElectronApi() === null) return null;

  return {
    async resolveRoomStorageDir() {
      const result = await callRoomTools({
        operation: "resolve-paths",
        roomId: GAME_ROOM_ID,
      });
      return readStorageDir(result);
    },

    async deleteDirectory(path: string) {
      await callRoomTools({
        operation: "delete-path",
        roomId: GAME_ROOM_ID,
        targetPath: path,
        recursive: true,
      });
    },

    async ensureDirectory(path: string) {
      await callRoomTools({
        operation: "ensure-dir",
        roomId: GAME_ROOM_ID,
        targetPath: path,
      });
    },

    async writeTextFile(path: string, content: string) {
      const electronApi = readElectronApi();
      if (electronApi === null) throw new Error("Fate Knots file bridge is unavailable.");
      const result = await electronApi.fmWriteFileAtomic({ path, data: content });
      if (result.success !== true) {
        throw new Error(result.error || result.message || "Fate Knots workspace write failed.");
      }
    },
  };
}
