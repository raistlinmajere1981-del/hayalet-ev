import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { initPaths, Paths } from "../../electron/paths.ts";
import { RoomPackageManager } from "../../electron/room-package-manager.ts";
import {
  copyDirectoryContents,
  INSTALLED_ROOM_FILE_SNAPSHOT,
} from "../../electron/rooms/room-install-files.ts";

async function listDirectories(root: string): Promise<string[]> {
  if (existsSync(root) !== true) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function copyIfPresent(sourcePath: string, targetPath: string): Promise<boolean> {
  if (existsSync(sourcePath) !== true) {
    return false;
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, {
    errorOnExist: false,
    force: false,
    recursive: true,
  });
  return true;
}

async function migrateLegacyToolRuntime(roomId: string): Promise<string[]> {
  const legacyRoomDir = Paths.getInstalledRoomDir(roomId);
  const storageDir = Paths.getRoomStorageDir(roomId);
  const migrated: string[] = [];
  const candidates = [
    {
      source: join(legacyRoomDir, "tools", "runtime"),
      target: join(storageDir, "tools", "runtime"),
    },
    {
      source: join(legacyRoomDir, "shared", "data", "tools", "runtime"),
      target: join(storageDir, "shared", "data", "tools", "runtime"),
    },
  ];

  for (const candidate of candidates) {
    if (await copyIfPresent(candidate.source, candidate.target)) {
      migrated.push(candidate.source);
    }
  }

  return migrated;
}

function isLegacyRoomSourceRestorePath(relativePath: string): boolean {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  return (
    normalizedPath !== INSTALLED_ROOM_FILE_SNAPSHOT &&
    normalizedPath.startsWith("tools/runtime/") === false &&
    normalizedPath.startsWith("shared/data/tools/runtime/") === false &&
    normalizedPath.split("/").includes("__pycache__") === false
  );
}

async function restoreLegacyRoomSource(roomId: string): Promise<string | null> {
  const legacyRoomDir = Paths.getInstalledRoomDir(roomId);
  const sourceRoomDir = join(Paths.getRoomsWorkspaceDir(), roomId);

  if (existsSync(sourceRoomDir) || existsSync(join(legacyRoomDir, "manifest.json")) !== true) {
    return null;
  }

  await copyDirectoryContents(legacyRoomDir, sourceRoomDir, {
    includeRelativePath: isLegacyRoomSourceRestorePath,
  });
  return sourceRoomDir;
}

async function main(): Promise<void> {
  initPaths(join(process.cwd(), "electron"));

  const removed: string[] = [];
  const migrated: string[] = [];
  const restoredLegacyRoomSources: string[] = [];
  const rebuiltRoomIds: string[] = [];
  const errors: string[] = [];

  const generatedRoomsDir = Paths.getGeneratedRoomsDir();
  if (existsSync(generatedRoomsDir)) {
    await rm(generatedRoomsDir, { recursive: true, force: true });
    removed.push(generatedRoomsDir);
  }

  const roomStorageRoot = join(Paths.getDataDir(), "room-storage");
  for (const roomId of await listDirectories(roomStorageRoot)) {
    const staleBuildDir = join(roomStorageRoot, roomId, "build");
    if (existsSync(staleBuildDir)) {
      await rm(staleBuildDir, { recursive: true, force: true });
      removed.push(staleBuildDir);
    }
  }

  const legacyRoomIds = await listDirectories(Paths.getInstalledRoomsDir());
  for (const roomId of legacyRoomIds) {
    try {
      migrated.push(...(await migrateLegacyToolRuntime(roomId)));
      const restoredSource = await restoreLegacyRoomSource(roomId);
      if (restoredSource !== null) {
        restoredLegacyRoomSources.push(restoredSource);
      }
    } catch (error) {
      errors.push(`${roomId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (legacyRoomIds.length > 0) {
    const roomPackageManager = new RoomPackageManager();
    for (const sourcePath of restoredLegacyRoomSources) {
      const roomId = sourcePath.split(/[\\/]/u).at(-1) ?? "";
      const installResult = await roomPackageManager.installFromWorkspace(roomId);
      if (installResult.success === true) {
        rebuiltRoomIds.push(roomId);
      } else {
        errors.push(`${roomId}: ${installResult.error ?? "legacy room rebuild failed"}`);
      }
    }

    const syncResult = await roomPackageManager.syncLinkedWorkspaceRoomsOnStartup();
    if (syncResult.success === true) {
      rebuiltRoomIds.push(...syncResult.syncedRoomIds);
    } else {
      errors.push(syncResult.error ?? "startup room sync failed");
    }
  }

  if (existsSync(Paths.getInstalledRoomsDir()) && errors.length === 0) {
    await rm(Paths.getInstalledRoomsDir(), { recursive: true, force: true });
    removed.push(Paths.getInstalledRoomsDir());
  }

  console.log(
    JSON.stringify(
      {
        errors,
        migratedLegacyToolRuntimePaths: migrated,
        rebuiltRoomIds: Array.from(new Set(rebuiltRoomIds)).sort((left, right) =>
          left.localeCompare(right)
        ),
        removedGeneratedPaths: removed,
        restoredLegacyRoomSources,
      },
      null,
      2
    )
  );

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

await main();
