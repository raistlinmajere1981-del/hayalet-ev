import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  buildInstalledRoomRecord,
  RoomPackageManager,
} from "../../electron/room-package-manager.ts";
import { ROOM_SCHEMA_VERSION } from "../../src/types/rooms.ts";

async function walkFiles(baseDir: string): Promise<string[]> {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const pairs = entries.map((entry) => {
    const absolutePath = join(baseDir, entry.name);
    if (entry.isDirectory()) {
      return { kind: "dir" as const, absolutePath };
    }
    return { kind: "file" as const, absolutePath };
  });
  const subResults = await Promise.all(
    pairs
      .filter((p) => p.kind === "dir")
      .map(async (p) => await walkFiles(p.absolutePath))
  );
  const files = pairs
    .filter((p) => p.kind === "file")
    .map((p) => p.absolutePath)
    .concat(...subResults.flat());
  return files.sort((left, right) => left.localeCompare(right));
}

async function walkDirectories(baseDir: string): Promise<string[]> {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const subDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(baseDir, entry.name));
  const subResults = await Promise.all(subDirs.map(async (dir) => await walkDirectories(dir)));
  return [...subDirs, ...subResults.flat()].sort((left, right) => left.localeCompare(right));
}

async function writeWorkspaceRoomFixture(baseDir: string, roomId: string): Promise<void> {
  await mkdir(join(baseDir, roomId, "ui"), { recursive: true });
  await mkdir(join(baseDir, roomId, "host"), { recursive: true });

  await writeFile(
    join(baseDir, roomId, "manifest.json"),
    JSON.stringify(
      {
        schemaVersion: ROOM_SCHEMA_VERSION,
        id: roomId,
        name: "Workspace Room",
        version: "1.0.0",
        menu: { label: "Workspace Room" },
        runtime: {
          uiEntry: "ui/index.html",
          hostEntry: "host/index.js",
        },
        defaultFeatureId: "primary",
        features: [{ id: "primary", name: "Primary" }],
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    join(baseDir, roomId, "ui", "index.html"),
    "<!doctype html><html></html>",
    "utf8"
  );
  await writeFile(join(baseDir, roomId, "host", "index.js"), "export {};\n", "utf8");
}


describe("startup sync repairs registry records whose generated runtime manifest was remov", () => {
void test("startup sync repairs registry records whose generated runtime manifest was removed", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-startup-sync-repair-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const dataRoot = join(tempRoot, "data");
  const runtimeBuildRoot = join(workspaceRoot, ".build");
  const runtimeManifestPath = join(runtimeBuildRoot, "workspace-room", "runtime", "manifest.json");
  const registryPath = join(tempRoot, "config", "rooms.json");

  try {
    await writeWorkspaceRoomFixture(workspaceRoot, "workspace-room");

    const manager = new RoomPackageManager({
      workspaceRoot,
      runtimeBuildRoot,
      dataRoot,
      registryPath,
    });

    const installResult = await manager.installFromWorkspace("workspace-room");
    assert.equal(installResult.success, true, installResult.error);
    await rm(runtimeManifestPath, { force: true });

    const syncResult = await manager.syncLinkedWorkspaceRoomsOnStartup();
    assert.equal(syncResult.success, true, syncResult.error);
    assert.deepEqual(syncResult.syncedRoomIds, ["workspace-room"]);
    assert.equal(
      existsSync(runtimeManifestPath),
      true,
      "startup sync should rebuild missing generated runtime manifests before hydration"
    );
    assert.equal(syncResult.snapshot?.rooms.length, 1);
    assert.equal(syncResult.snapshot.rooms[0]?.id, "workspace-room");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
void test("startup sync restores legacy installed-only room sources before hydration", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-legacy-source-restore-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const dataRoot = join(tempRoot, "data");
  const legacyInstalledRoot = join(dataRoot, "rooms");
  const legacyRoomDir = join(legacyInstalledRoot, "legacy-room");
  const runtimeBuildRoot = join(workspaceRoot, ".build");
  const runtimeManifestPath = join(runtimeBuildRoot, "legacy-room", "runtime", "manifest.json");
  const registryPath = join(tempRoot, "config", "rooms.json");
  const now = "2026-04-25T00:00:00.000Z";

  try {
    await writeWorkspaceRoomFixture(legacyInstalledRoot, "legacy-room");
    await mkdir(join(legacyRoomDir, "tools", "runtime", "linux-x64"), { recursive: true });
    await writeFile(join(legacyRoomDir, ".room-install-files.json"), "{}", "utf8");
    await writeFile(
      join(legacyRoomDir, "tools", "runtime", "linux-x64", "ffmpeg"),
      "binary",
      "utf8"
    );

    const manifest = JSON.parse(await readFile(join(legacyRoomDir, "manifest.json"), "utf8")) as Record<string, unknown>;
    const legacyRecord = buildInstalledRoomRecord(manifest as unknown as Parameters<typeof buildInstalledRoomRecord>[0], {
      installedAt: now,
      installedDir: legacyRoomDir,
      sourceDir: legacyRoomDir,
      updatedAt: now,
    });
    await mkdir(join(tempRoot, "config"), { recursive: true });
    await writeFile(
      registryPath,
      JSON.stringify(
        {
          rooms: [legacyRecord],
          updatedAt: now,
          version: ROOM_SCHEMA_VERSION,
        },
        null,
        2
      ),
      "utf8"
    );

    const manager = new RoomPackageManager({
      workspaceRoot,
      runtimeBuildRoot,
      dataRoot,
      registryPath,
    });

    const syncResult = await manager.syncLinkedWorkspaceRoomsOnStartup();
    assert.equal(syncResult.success, true, syncResult.error);
    assert.deepEqual(syncResult.syncedRoomIds, ["legacy-room"]);
    assert.equal(existsSync(join(workspaceRoot, "legacy-room", "manifest.json")), true);
    assert.equal(existsSync(join(workspaceRoot, "legacy-room", ".room-install-files.json")), false);
    assert.equal(
      existsSync(join(workspaceRoot, "legacy-room", "tools", "runtime", "linux-x64", "ffmpeg")),
      false
    );
    assert.equal(existsSync(runtimeManifestPath), true);

    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      rooms: Array<{ installedDir?: string; sourceDir?: string }>;
    };
    assert.equal(registry.rooms[0]?.sourceDir, join(workspaceRoot, "legacy-room"));
    assert.equal(registry.rooms[0].installedDir, join(runtimeBuildRoot, "legacy-room", "runtime"));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
void test("generated room cleanup script targets only generated legacy room roots", async () => {
  const cleanupSource = await readFile(
    resolve("scripts/rooms/clean-generated-room-artifacts.ts"),
    "utf8"
  );

  assert.match(cleanupSource, /Paths\.getGeneratedRoomsDir\(\)/);
  assert.match(cleanupSource, /restoreLegacyRoomSource\(roomId\)/);
  assert.match(cleanupSource, /installFromWorkspace\(roomId\)/);
  assert.match(cleanupSource, /syncLinkedWorkspaceRoomsOnStartup\(\)/);
  assert.match(cleanupSource, /join\(roomStorageRoot, roomId, "build"\)/);
  assert.match(cleanupSource, /migrateLegacyToolRuntime\(roomId\)/);
  assert.match(cleanupSource, /Paths\.getInstalledRoomsDir\(\)/);
  assert.doesNotMatch(cleanupSource, /rm\(storageDir/);
});
void test("legacy installed room copies stay absent and runtime bundle exports live under data/room-storage", async () => {
  const installedRoot = resolve("data/rooms");
  const storageRoot = resolve("data/room-storage");
  const installedDirectories = existsSync(installedRoot)
    ? await walkDirectories(installedRoot)
    : [];
  const installedFiles = existsSync(installedRoot) ? await walkFiles(installedRoot) : [];
  const storageFiles = existsSync(storageRoot) ? await walkFiles(storageRoot) : [];

  const installedDistDirs = installedDirectories
    .filter((dirPath) => dirPath.endsWith("/dist") || dirPath.endsWith("\\dist"))
    .map((dirPath) => relative(installedRoot, dirPath));
  const installedRuntimeCaches = installedDirectories
    .filter((dirPath) => dirPath.endsWith("/__pycache__") || dirPath.endsWith("\\__pycache__"))
    .map((dirPath) => relative(installedRoot, dirPath));
  const installedBundleFiles = installedFiles
    .filter((filePath) => filePath.endsWith(".hevroom") || filePath.endsWith(".hevroom.json"))
    .map((filePath) => relative(installedRoot, filePath));
  const storageBundleFiles = storageFiles
    .filter((filePath) => filePath.endsWith(".hevroom") || filePath.endsWith(".hevroom.json"))
    .map((filePath) => relative(storageRoot, filePath));

  assert.deepEqual(
    installedDistDirs,
    [],
    "installed room copies should not contain dist directories"
  );
  assert.deepEqual(
    installedRuntimeCaches,
    [],
    "installed room copies should not contain runtime cache directories"
  );
  assert.deepEqual(
    installedBundleFiles,
    [],
    "installed room copies should not contain exported bundles"
  );
  assert.equal(
    storageBundleFiles.every(
      (filePath) => filePath.includes("/exports/") || filePath.includes("\\exports\\")
    ),
    true,
    "room bundle exports must live under data/room-storage/<room>/exports"
  );
});
});
