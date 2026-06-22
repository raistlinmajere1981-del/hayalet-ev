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


describe("workspace room packages stay free of generated bundle artifacts", () => {
void test("workspace room packages stay free of generated bundle artifacts", async () => {
  const workspaceRoot = resolve("rooms");
  const roomIds = (await readdir(workspaceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const roomChecks = await Promise.all(
    roomIds.map(async (roomId) => {
      const roomDir = join(workspaceRoot, roomId);
      const roomDirectories = await walkDirectories(roomDir);
      const roomFiles = await walkFiles(roomDir);
      return {
        roomId,
        roomDir,
        roomDirectories,
        roomFiles,
        hasDist: existsSync(join(roomDir, "dist")),
        leakedCaches: roomDirectories.filter(
          (dirPath) => dirPath.endsWith("/__pycache__") || dirPath.endsWith("\\__pycache__")
        ),
        leakedBundles: roomFiles.filter(
          (filePath) => filePath.endsWith(".hevroom") || filePath.endsWith(".hevroom.json")
        ),
      };
    })
  );

  for (const { roomId, hasDist, leakedCaches, leakedBundles } of roomChecks) {
    assert.equal(
      hasDist,
      false,
      `${roomId} should not keep dist outputs in workspace`
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
void test("workspace-only room operations do not recreate installed room roots", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-source-boundary-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const installedRoot = join(tempRoot, "data", "rooms");
  const runtimeBuildRoot = join(workspaceRoot, ".build");
  const runtimeBuildDir = join(runtimeBuildRoot, "workspace-room", "runtime");
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
      runtimeBuildRoot,
      dataRoot: join(tempRoot, "data"),
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
      false,
      "workspace packaging should not materialize generated room builds under room-storage"
    );
    assert.equal(
      existsSync(runtimeBuildDir),
      true,
      "workspace packaging should materialize a generated room build under rooms/.build"
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
void test("room runtime residue is preserved by default and only cleared by explicit deleteData cleanup", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-runtime-residue-policy-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const dataRoot = join(tempRoot, "data");
  const runtimeBuildRoot = join(workspaceRoot, ".build");
  const runtimeArtifactRoot = join(runtimeBuildRoot, "workspace-room");
  const runtimeBuildDir = join(runtimeArtifactRoot, "runtime");
  const roomStorageRoot = join(tempRoot, "data", "room-storage", "workspace-room");
  const roomToolRuntimeRoot = join(roomStorageRoot, "tools", "runtime", "linux-x64", "ffmpeg");
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
      runtimeBuildRoot,
      dataRoot,
      registryPath,
    });

    const installResult = await manager.installFromWorkspace("workspace-room");
    assert.equal(installResult.success, true, installResult.error);
    assert.equal(
      existsSync(join(runtimeBuildDir, "manifest.json")),
      true,
      "workspace installs should generate runtime package artifacts under rooms/.build"
    );

    await mkdir(roomStorageRoot, { recursive: true });
    await mkdir(roomToolRuntimeRoot, { recursive: true });
    await mkdir(roomPartitionRoot, { recursive: true });
    await writeFile(
      join(roomStorageRoot, "state.json"),
      JSON.stringify({ roomId: "workspace-room" }),
      "utf8"
    );
    await writeFile(join(roomToolRuntimeRoot, "ffmpeg"), "binary", "utf8");
    await writeFile(
      join(roomPartitionRoot, "session.json"),
      JSON.stringify({ roomId: "workspace-room" }),
      "utf8"
    );

    const removeWithoutData = await manager.removeInstalledRoom("workspace-room");
    assert.equal(removeWithoutData.success, true, removeWithoutData.error);
    assert.equal(
      existsSync(runtimeArtifactRoot),
      false,
      "uninstall should remove the generated runtime artifact even when data is preserved"
    );
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
    assert.equal(
      existsSync(join(runtimeBuildDir, "manifest.json")),
      true,
      "reinstall should regenerate runtime package artifacts from rooms/<room-id>"
    );

    const removeWithData = await manager.removeInstalledRoom("workspace-room", {
      deleteData: true,
    });
    assert.equal(removeWithData.success, true, removeWithData.error);
    assert.equal(
      existsSync(runtimeArtifactRoot),
      false,
      "deleteData uninstall should also remove generated runtime package artifacts"
    );
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
void test("delete workspace room removes source and generated artifacts without deleting data by default", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-delete-workspace-artifacts-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const dataRoot = join(tempRoot, "data");
  const runtimeBuildRoot = join(workspaceRoot, ".build");
  const runtimeArtifactRoot = join(runtimeBuildRoot, "workspace-room");
  const roomStorageRoot = join(dataRoot, "room-storage", "workspace-room");
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

    await mkdir(roomStorageRoot, { recursive: true });
    await writeFile(
      join(roomStorageRoot, "state.json"),
      JSON.stringify({ roomId: "workspace-room" }),
      "utf8"
    );

    const deleteResult = await manager.deleteWorkspaceRoom("workspace-room");
    assert.equal(deleteResult.success, true, deleteResult.error);
    assert.equal(
      existsSync(join(workspaceRoot, "workspace-room")),
      false,
      "delete workspace should remove the editable source room"
    );
    assert.equal(
      existsSync(runtimeArtifactRoot),
      false,
      "delete workspace should remove generated runtime package artifacts"
    );
    assert.equal(
      existsSync(join(roomStorageRoot, "state.json")),
      true,
      "delete workspace should preserve room data unless deleteData is explicit"
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
});
