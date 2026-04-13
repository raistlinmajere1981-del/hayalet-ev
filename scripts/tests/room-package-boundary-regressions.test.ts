import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { RoomPackageManager } from "../../electron/room-package-manager.ts";
import { ROOM_SCHEMA_VERSION } from "../../src/types/rooms.ts";

async function walkFiles(baseDir: string): Promise<string[]> {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(baseDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolutePath)));
      continue;
    }
    files.push(absolutePath);
  }

  return files.sort((left, right) => left.localeCompare(right));
}

async function walkDirectories(baseDir: string): Promise<string[]> {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const directories: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const absolutePath = join(baseDir, entry.name);
    directories.push(absolutePath);
    directories.push(...(await walkDirectories(absolutePath)));
  }

  return directories.sort((left, right) => left.localeCompare(right));
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

test("workspace room packages stay free of generated bundle artifacts", async () => {
  const workspaceRoot = resolve("rooms");
  const roomIds = (await readdir(workspaceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  for (const roomId of roomIds) {
    const roomDir = join(workspaceRoot, roomId);
    assert.equal(
      existsSync(join(roomDir, "dist")),
      false,
      `${roomId} should not keep dist outputs in workspace`
    );

    const roomDirectories = await walkDirectories(roomDir);
    const roomFiles = await walkFiles(roomDir);
    const leakedCaches = roomDirectories.filter(
      (dirPath) => dirPath.endsWith("/__pycache__") || dirPath.endsWith("\\__pycache__")
    );
    const leakedBundles = roomFiles.filter(
      (filePath) => filePath.endsWith(".hevroom") || filePath.endsWith(".hevroom.json")
    );

    assert.deepEqual(
      leakedCaches.map((dirPath) => relative(workspaceRoot, dirPath)),
      [],
      `${roomId} should not keep runtime cache directories in workspace`
    );
    assert.deepEqual(
      leakedBundles.map((filePath) => relative(workspaceRoot, filePath)),
      [],
      `${roomId} should not keep exported bundles inside rooms/`
    );
  }
});

test("workspace-only room operations do not recreate installed room roots", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-source-boundary-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const installedRoot = join(tempRoot, "data", "rooms");
  const roomPartitionRoot = join(
    tempRoot,
    "data",
    "electron-user-data",
    "Partitions",
    "room-workspace-room"
  );
  const roomBuildRoot = join(
    tempRoot,
    "data",
    "room-storage",
    "workspace-room",
    "build",
    "workspace"
  );
  const registryPath = join(tempRoot, "config", "rooms.json");

  try {
    await writeWorkspaceRoomFixture(workspaceRoot, "workspace-room");

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const workspaceRooms = await manager.listWorkspaceRooms();
    assert.equal(workspaceRooms.length, 1);
    assert.equal(workspaceRooms[0]?.manifest?.id, "workspace-room");
    assert.equal(
      existsSync(installedRoot),
      false,
      "workspace discovery should not recreate generated installed room roots"
    );
    assert.equal(
      existsSync(roomPartitionRoot),
      false,
      "workspace discovery should not create room runtime partitions"
    );

    const packageResult = await manager.packageWorkspaceRoom("workspace-room");
    assert.equal(packageResult.success, true, packageResult.error);
    assert.equal(
      existsSync(installedRoot),
      false,
      "workspace packaging should not recreate generated installed room roots"
    );
    assert.equal(
      existsSync(roomPartitionRoot),
      false,
      "workspace packaging should not create room runtime partitions"
    );
    assert.equal(
      existsSync(roomBuildRoot),
      true,
      "workspace packaging should materialize a generated room build under room-storage"
    );
    assert.equal(
      existsSync(
        join(
          tempRoot,
          "data",
          "room-storage",
          "workspace-room",
          "exports",
          "workspace-room.hevroom.json"
        )
      ),
      true
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("room runtime residue is preserved by default and only cleared by explicit deleteData cleanup", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-runtime-residue-policy-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const installedRoot = join(tempRoot, "data", "rooms");
  const roomStorageRoot = join(tempRoot, "data", "room-storage", "workspace-room");
  const roomToolRuntimeRoot = join(
    roomStorageRoot,
    "tools",
    "runtime",
    "linux-x64",
    "ffmpeg"
  );
  const roomPartitionRoot = join(
    tempRoot,
    "data",
    "electron-user-data",
    "Partitions",
    "room-workspace-room"
  );
  const registryPath = join(tempRoot, "config", "rooms.json");

  try {
    await writeWorkspaceRoomFixture(workspaceRoot, "workspace-room");

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const installResult = await manager.installFromWorkspace("workspace-room");
    assert.equal(installResult.success, true, installResult.error);

    await mkdir(roomStorageRoot, { recursive: true });
    await mkdir(roomToolRuntimeRoot, { recursive: true });
    await mkdir(roomPartitionRoot, { recursive: true });
    await writeFile(join(roomStorageRoot, "state.json"), JSON.stringify({ roomId: "workspace-room" }), "utf8");
    await writeFile(join(roomToolRuntimeRoot, "ffmpeg"), "binary", "utf8");
    await writeFile(join(roomPartitionRoot, "session.json"), JSON.stringify({ roomId: "workspace-room" }), "utf8");

    const removeWithoutData = await manager.removeInstalledRoom("workspace-room");
    assert.equal(removeWithoutData.success, true, removeWithoutData.error);
    assert.equal(
      existsSync(join(roomStorageRoot, "state.json")),
      true,
      "room-storage residue should be preserved until deleteData is requested"
    );
    assert.equal(
      existsSync(join(roomToolRuntimeRoot, "ffmpeg")),
      true,
      "room-local tool runtimes should stay available across reinstall until deleteData is requested"
    );
    assert.equal(
      existsSync(join(roomPartitionRoot, "session.json")),
      true,
      "room partition residue should be preserved until deleteData is requested"
    );

    const reinstallResult = await manager.installFromWorkspace("workspace-room");
    assert.equal(reinstallResult.success, true, reinstallResult.error);

    const removeWithData = await manager.removeInstalledRoom("workspace-room", { deleteData: true });
    assert.equal(removeWithData.success, true, removeWithData.error);
    assert.equal(
      existsSync(roomStorageRoot),
      false,
      "deleteData cleanup should remove room-storage runtime residue"
    );
    assert.equal(
      existsSync(roomPartitionRoot),
      false,
      "deleteData cleanup should remove room partition runtime residue"
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("installed room copies stay package-shaped and runtime bundle exports live under data/room-storage", async () => {
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

test("generic room core sources do not hardcode room-specific package ids", async () => {
  const coreRoots = [resolve("src"), resolve("electron"), resolve("scripts/rooms")];
  const roomSpecificTokens = ["laboratory", "game-room"];
  const allowedPathSuffixes = [
    "scripts/rooms/build-room-bundle.mjs",
    "scripts/rooms/migrate-room-layouts.mjs",
  ];
  const leaks: string[] = [];

  for (const rootPath of coreRoots) {
    if (!existsSync(rootPath)) {
      continue;
    }

    const files = await walkFiles(rootPath);
    for (const filePath of files) {
      const relativePath = relative(resolve("."), filePath).replace(/\\/g, "/");
      if (allowedPathSuffixes.includes(relativePath)) {
        continue;
      }

      const content = await readFile(filePath, "utf8");
      if (roomSpecificTokens.some((token) => content.includes(token))) {
        leaks.push(relativePath);
      }
    }
  }

  assert.deepEqual(
    leaks,
    [],
    "generic room core should not hardcode current room ids outside explicit room package code"
  );
});
