import { existsSync } from "fs";
import { rm, stat } from "fs/promises";
import { join } from "path";
import type { RoomRegistryState, RoomWorkspaceEntry } from "@shared/index.js";
import { buildInstalledRoomRecord } from "./installed-room-builder.ts";
import {
  copyDirectoryContents,
  deleteInstalledRoomCopies,
  INSTALLED_ROOM_FILE_SNAPSHOT,
  resolveInstalledRoomTrackedFiles,
  writeInstalledRoomFileSnapshot,
} from "./room-install-files.ts";
import type {
  RoomOperationResult,
  RoomPackageTranslator,
} from "./room-package-types.ts";
import type { BuildWorkspaceRoomArtifactResult } from "./workspace-room-build.ts";

function normalizeRoomId(rawValue: string): string {
  return rawValue.trim();
}

interface InstallRoomFromWorkspaceParams {
  installedRoot: string;
  ensureRoots: () => Promise<void>;
  prepareWorkspaceRoomBuild: () => Promise<BuildWorkspaceRoomArtifactResult>;
  readRegistry: () => Promise<RoomRegistryState>;
  writeRegistry: (registry: RoomRegistryState) => Promise<void>;
  roomPackageT: RoomPackageTranslator;
}

export async function installRoomFromWorkspace({
  installedRoot,
  ensureRoots,
  prepareWorkspaceRoomBuild,
  readRegistry,
  writeRegistry,
  roomPackageT,
}: InstallRoomFromWorkspaceParams): Promise<RoomOperationResult> {
  const buildResult = await prepareWorkspaceRoomBuild();
  if (buildResult.success !== true) {
    return { success: false, error: buildResult.error };
  }

  const target = buildResult.artifact.workspaceRoom;
  if (target.manifest === undefined) {
    return { success: false, error: await roomPackageT("roomIdRequired") };
  }

  const roomInstalledDir = join(installedRoot, target.manifest.id);
  await ensureRoots();
  const trackedFiles = await copyDirectoryContents(buildResult.artifact.buildDir, roomInstalledDir);
  await writeInstalledRoomFileSnapshot(roomInstalledDir, trackedFiles);

  const now = new Date().toISOString();
  const record = buildInstalledRoomRecord(target.manifest, {
    sourceDir: target.dirPath,
    installedDir: roomInstalledDir,
    installedAt: now,
    updatedAt: now,
  });

  const runtimeStat = await stat(record.runtimeEntryPath).catch(() => null);
  const hostStat = await stat(record.hostEntryPath).catch(() => null);
  if (runtimeStat?.isFile() !== true) {
    return {
      success: false,
      error: await roomPackageT("installedRuntimeEntryMissing", {
        path: record.runtimeEntryPath,
      }),
    };
  }
  if (hostStat?.isFile() !== true) {
    return {
      success: false,
      error: await roomPackageT("installedHostEntryMissing", { path: record.hostEntryPath }),
    };
  }

  const registry = await readRegistry();
  registry.rooms = registry.rooms.filter((item) => item.id !== record.id);
  registry.rooms.push(record);
  registry.updatedAt = now;
  await writeRegistry(registry);

  return {
    success: true,
    room: record,
    restartRequired: true,
  };
}

interface RemoveInstalledRoomParams {
  roomId: string;
  options?: { deleteData?: boolean };
  readRegistry: () => Promise<RoomRegistryState>;
  writeRegistry: (registry: RoomRegistryState) => Promise<void>;
  deletePersistentRoomData: (roomId: string) => Promise<void>;
  roomPackageT: RoomPackageTranslator;
}

export async function removeInstalledRoomOperation({
  roomId,
  options = {},
  readRegistry,
  writeRegistry,
  deletePersistentRoomData,
  roomPackageT,
}: RemoveInstalledRoomParams): Promise<RoomOperationResult> {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (normalizedRoomId === "") {
    return { success: false, error: await roomPackageT("roomIdRequired") };
  }

  const registry = await readRegistry();
  const current = registry.rooms.find((item) => item.id === normalizedRoomId);
  if (current === undefined) {
    return {
      success: false,
      error: await roomPackageT("installedRoomNotFound", { roomId: normalizedRoomId }),
    };
  }

  if (options.deleteData === true) {
    await Promise.all([
      rm(current.installedDir, { recursive: true, force: true }),
      deletePersistentRoomData(current.id),
    ]);
  } else {
    const trackedFiles = await resolveInstalledRoomTrackedFiles(current);
    await deleteInstalledRoomCopies(current.installedDir, trackedFiles);
  }

  registry.rooms = registry.rooms.filter((item) => item.id !== normalizedRoomId);
  registry.updatedAt = new Date().toISOString();
  await writeRegistry(registry);

  return {
    success: true,
    room: current,
    restartRequired: true,
  };
}

interface DeleteWorkspaceRoomParams {
  installedRoot: string;
  roomId: string;
  options?: { deleteData?: boolean };
  listWorkspaceRooms: () => Promise<RoomWorkspaceEntry[]>;
  readRegistry: () => Promise<RoomRegistryState>;
  writeRegistry: (registry: RoomRegistryState) => Promise<void>;
  deletePersistentRoomData: (roomId: string) => Promise<void>;
  roomPackageT: RoomPackageTranslator;
}

export async function deleteWorkspaceRoomOperation({
  installedRoot,
  roomId,
  options = {},
  listWorkspaceRooms,
  readRegistry,
  writeRegistry,
  deletePersistentRoomData,
  roomPackageT,
}: DeleteWorkspaceRoomParams): Promise<RoomOperationResult> {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (normalizedRoomId === "") {
    return { success: false, error: await roomPackageT("roomIdRequired") };
  }

  const workspaceRooms = await listWorkspaceRooms();
  const target = workspaceRooms.find(
    (entry) => entry.dirName === normalizedRoomId || entry.manifest?.id === normalizedRoomId
  );
  if (target === undefined) {
    return {
      success: false,
      error: await roomPackageT("roomNotFoundInWorkspace", { roomId: normalizedRoomId }),
    };
  }

  if (target.readOnly === true) {
    return {
      success: false,
      error: await roomPackageT("workspaceReadOnly", { path: target.dirPath }),
    };
  }

  await rm(target.dirPath, { recursive: true, force: true });

  let restartRequired = false;
  if (options.deleteData === true) {
    const installedRoomId = target.manifest?.id ?? target.dirName;
    await Promise.all([
      rm(join(installedRoot, installedRoomId), { recursive: true, force: true }),
      deletePersistentRoomData(installedRoomId),
    ]);

    const registry = await readRegistry();
    const nextRooms = registry.rooms.filter((item) => item.id !== installedRoomId);
    if (nextRooms.length !== registry.rooms.length) {
      registry.rooms = nextRooms;
      registry.updatedAt = new Date().toISOString();
      await writeRegistry(registry);
      restartRequired = true;
    }
  }

  return {
    success: true,
    path: target.dirPath,
    restartRequired,
  };
}

interface ExportInstalledRoomToWorkspaceParams {
  workspaceRoot: string;
  roomId: string;
  options?: { overwrite?: boolean };
  ensureRoots: () => Promise<void>;
  readRegistry: () => Promise<RoomRegistryState>;
  roomPackageT: RoomPackageTranslator;
}

export async function exportInstalledRoomToWorkspaceOperation({
  workspaceRoot,
  roomId,
  options = {},
  ensureRoots,
  readRegistry,
  roomPackageT,
}: ExportInstalledRoomToWorkspaceParams): Promise<RoomOperationResult> {
  const normalizedRoomId = normalizeRoomId(roomId);
  if (normalizedRoomId === "") {
    return { success: false, error: await roomPackageT("roomIdRequired") };
  }

  const registry = await readRegistry();
  const current = registry.rooms.find((item) => item.id === normalizedRoomId);
  if (current === undefined) {
    return {
      success: false,
      error: await roomPackageT("installedRoomNotFound", { roomId: normalizedRoomId }),
    };
  }

  const exportDir = join(workspaceRoot, current.id);
  await ensureRoots();
  if (existsSync(exportDir) && options.overwrite !== true) {
    return {
      success: false,
      error: await roomPackageT("workspaceRoomExists", { path: exportDir }),
    };
  }

  if (options.overwrite === true) {
    await rm(exportDir, { recursive: true, force: true });
  }
  await copyDirectoryContents(current.installedDir, exportDir, {
    includeRelativePath: (relativePath) =>
      relativePath !== INSTALLED_ROOM_FILE_SNAPSHOT &&
      relativePath !== "tools/runtime" &&
      relativePath.startsWith("tools/runtime/") === false &&
      relativePath !== "shared/data/tools/runtime" &&
      relativePath.startsWith("shared/data/tools/runtime/") === false,
  });

  return { success: true, room: current, path: exportDir };
}
