import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

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

test("workspace room packages stay free of generated bundle artifacts", async () => {
  const workspaceRoot = resolve("rooms");
  const roomIds = (await readdir(workspaceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  for (const roomId of roomIds) {
    const roomDir = join(workspaceRoot, roomId);
    assert.equal(existsSync(join(roomDir, "dist")), false, `${roomId} should not keep dist outputs in workspace`);

    const roomDirectories = await walkDirectories(roomDir);
    const roomFiles = await walkFiles(roomDir);
    const leakedCaches = roomDirectories.filter(
      (dirPath) => dirPath.endsWith("/__pycache__") || dirPath.endsWith("\\__pycache__")
    );
    const leakedBundles = roomFiles.filter((filePath) =>
      filePath.endsWith(".hevroom") || filePath.endsWith(".hevroom.json")
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

test("installed room copies stay package-shaped and runtime bundle exports live under data/room-storage", async () => {
  const installedRoot = resolve("data/rooms");
  const storageRoot = resolve("data/room-storage");
  const installedDirectories = existsSync(installedRoot) ? await walkDirectories(installedRoot) : [];
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

  assert.deepEqual(installedDistDirs, [], "installed room copies should not contain dist directories");
  assert.deepEqual(installedRuntimeCaches, [], "installed room copies should not contain runtime cache directories");
  assert.deepEqual(installedBundleFiles, [], "installed room copies should not contain exported bundles");
  assert.equal(
    storageBundleFiles.every((filePath) => filePath.includes("/exports/") || filePath.includes("\\exports\\")),
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
