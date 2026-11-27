import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { session, type IpcMainInvokeEvent, type BrowserWindow } from "electron";
import { roomStorageCaller, type RoomStorageCaller } from "./storage-caller.ts";
import { Paths } from "../paths.ts";
import { flattenRoomCommandSpecs, validateRoomManifest } from "@shared/index.js";

interface StorageProvider {
  roomId: string;
  commands: readonly string[];
  execute: (
    context: RoomStorageCaller & { storageRoot: string },
    command: string,
    request: unknown
  ) => Promise<unknown>;
}

const providers = new Map<string, StorageProvider>();
export function registerStorageProvider(provider: StorageProvider): void {
  for (const name of provider.commands) {
    if (providers.has(name)) throw new Error("Duplicate room storage command: " + name);
    providers.set(name, provider);
  }
}

export async function executeRoomStorage(
  getWindow: () => BrowserWindow | null,
  event: IpcMainInvokeEvent,
  command: string,
  request: unknown
): Promise<{ success: true; data: unknown }> {
  const provider = providers.get(command);
  if (!provider) throw new Error("Unauthorized room storage caller");
  const caller = roomStorageCaller(
    event,
    getWindow,
    session.fromPartition("persist:room-" + provider.roomId)
  );
  const runtime = Paths.getRoomRuntimeBuildDir(provider.roomId);
  const { manifest } = validateRoomManifest(
    JSON.parse(await readFile(join(runtime, "manifest.json"), "utf8"))
  );
  if (manifest?.id !== provider.roomId) throw new Error("Invalid room storage manifest");
  const entry = join(runtime, manifest.runtime.uiEntry);
  if (
    (await realpath(entry)) !== entry ||
    caller.url !== pathToFileURL(entry).href ||
    !flattenRoomCommandSpecs(manifest).some(
      (spec) => spec.name === command && spec.scope === "room-ui"
    )
  )
    throw new Error("Unauthorized room storage command");
  const storageRoot = Paths.getRoomStorageDir(provider.roomId);
  if (!(await lstat(Paths.getDataDir())).isDirectory()) throw new Error("Unsafe data directory");
  const ensure = async (dir: string): Promise<void> => {
    await mkdir(dir, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    if (!(await lstat(dir)).isDirectory()) throw new Error("Unsafe room storage root");
  };
  await ensure(dirname(storageRoot));
  await ensure(storageRoot);
  caller.assertCurrent();
  const data = await provider.execute({ storageRoot, ...caller }, command, request);
  caller.assertCurrent();
  return { success: true, data };
}
