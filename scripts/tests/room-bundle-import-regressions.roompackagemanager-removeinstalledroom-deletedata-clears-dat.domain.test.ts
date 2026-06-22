import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RoomPackageManager } from "../../electron/room-package-manager.ts";
import { ROOM_SCHEMA_VERSION } from "../../src/types/rooms.ts";

interface RoomPackageManagerTestAccess {
  buildWorkspaceInstalledRoomRecord(
    room: { manifest: { id: string }; dirPath: string }
  ): Promise<{ id: string; isWorkspaceFallback?: boolean } | null>;
}


function encodeBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

async function writeRoomFixture(baseDir: string, roomId: string, roomName: string): Promise<void> {
  await mkdir(join(baseDir, roomId, "ui"), { recursive: true });
  await mkdir(join(baseDir, roomId, "host"), { recursive: true });
  await mkdir(join(baseDir, roomId, "assets"), { recursive: true });

  await writeFile(
    join(baseDir, roomId, "manifest.json"),
    JSON.stringify(
      {
        schemaVersion: ROOM_SCHEMA_VERSION,
        id: roomId,
        name: roomName,
        version: "1.0.0",
        menu: { label: roomName },
        runtime: {
          uiEntry: "ui/index.html",
          hostEntry: "host/index.js",
        },
        defaultFeatureId: "primary",
        features: [
          {
            id: "primary",
            name: "Primary",
          },
        ],
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    join(baseDir, roomId, "ui", "index.html"),
    `<!doctype html><html><body>${roomName}</body></html>`,
    "utf8"
  );
  await writeFile(join(baseDir, roomId, "host", "index.js"), "export {};\n", "utf8");
  await writeFile(join(baseDir, roomId, "assets", "readme.txt"), `${roomId} asset`, "utf8");
}

async function writeRoomRuntimeDataFixture(
  dataRoot: string,
  roomId: string
): Promise<{ roomStorageDir: string; roomPartitionDir: string }> {
  const roomStorageDir = join(dataRoot, "room-storage", roomId);
  const roomPartitionDir = join(dataRoot, "electron-user-data", "Partitions", `room-${roomId}`);

  await mkdir(roomStorageDir, { recursive: true });
  await mkdir(roomPartitionDir, { recursive: true });
  await writeFile(join(roomStorageDir, "state.json"), JSON.stringify({ roomId }), "utf8");
  await writeFile(join(roomPartitionDir, "session.json"), JSON.stringify({ roomId }), "utf8");

  return {
    roomStorageDir,
    roomPartitionDir,
  };
}

async function waitForFsTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 25));
}


describe("RoomPackageManager removeInstalledRoom deleteData clears data without deleting w", () => {
void test("RoomPackageManager removeInstalledRoom deleteData clears data without deleting workspace room", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-remove-installed-delete-data-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const dataRoot = join(tempRoot, "data");
  const installedRoot = join(dataRoot, "rooms");
  const registryPath = join(tempRoot, "config", "rooms.json");
  const roomDir = join(workspaceRoot, "game-room");
  const installedDir = join(installedRoot, "game-room");

  try {
    await writeRoomFixture(workspaceRoot, "game-room", "Game Room");

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const installResult = await manager.installFromWorkspace("game-room");
    assert.equal(installResult.success, true, installResult.error);

    const roomRuntimeData = await writeRoomRuntimeDataFixture(dataRoot, "game-room");
    const removeResult = await manager.removeInstalledRoom("game-room", { deleteData: true });
    assert.equal(removeResult.success, true, removeResult.error);
    assert.equal(existsSync(join(roomDir, "manifest.json")), true);
    assert.equal(existsSync(installedDir), false);
    assert.equal(existsSync(roomRuntimeData.roomStorageDir), false);
    assert.equal(existsSync(roomRuntimeData.roomPartitionDir), false);

    const installedRooms = await manager.listInstalledRooms();
    assert.equal(installedRooms.length, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
void test("RoomPackageManager marks dev fallback installed rooms so settings can avoid uninstall actions", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-installed-fallback-"));
  const dataRoot = join(tempRoot, "data");
  const workspaceRoot = join(tempRoot, "rooms");
  const installedRoot = join(dataRoot, "rooms");
  const registryPath = join(tempRoot, "config", "rooms.json");

  try {
    await writeRoomFixture(workspaceRoot, "game-room", "Game Room");

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const workspaceRooms = await manager.listWorkspaceRooms();
    assert.equal(workspaceRooms.length, 1);
    assert.ok(workspaceRooms[0] != null);
    const roomEntry = workspaceRooms[0];
    const fallbackRoom = await (manager as unknown as RoomPackageManagerTestAccess).buildWorkspaceInstalledRoomRecord(
      roomEntry as { manifest: { id: string }; dirPath: string }
    );

    assert.equal(fallbackRoom?.id, "game-room");
    assert.equal(fallbackRoom.isWorkspaceFallback, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
void test("RoomPackageManager deleteWorkspaceRoom can remove workspace and data folders together", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-delete-workspace-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const dataRoot = join(tempRoot, "data");
  const installedRoot = join(dataRoot, "rooms");
  const registryPath = join(tempRoot, "config", "rooms.json");
  const roomDir = join(workspaceRoot, "game-room");
  const installedDir = join(installedRoot, "game-room");

  try {
    await mkdir(join(roomDir, "ui"), { recursive: true });
    await mkdir(join(roomDir, "host"), { recursive: true });
    await mkdir(installedDir, { recursive: true });

    await writeFile(
      join(roomDir, "manifest.json"),
      JSON.stringify(
        {
          schemaVersion: ROOM_SCHEMA_VERSION,
          id: "game-room",
          name: "Game Room",
          version: "1.0.0",
          menu: { label: "Game Room" },
          runtime: {
            uiEntry: "ui/index.html",
            hostEntry: "host/index.js",
          },
          defaultFeatureId: "chess",
          features: [{ id: "chess", name: "Chess" }],
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(join(roomDir, "ui", "index.html"), "<html></html>", "utf8");
    await writeFile(join(roomDir, "host", "index.js"), "export {};\n", "utf8");
    await writeFile(join(installedDir, "orphan.txt"), "remove me", "utf8");
    const roomRuntimeData = await writeRoomRuntimeDataFixture(dataRoot, "game-room");

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const deleteResult = await manager.deleteWorkspaceRoom("game-room", { deleteData: true });
    assert.equal(deleteResult.success, true, deleteResult.error);
    assert.equal(existsSync(roomDir), false);
    assert.equal(existsSync(installedDir), false);
    assert.equal(existsSync(roomRuntimeData.roomStorageDir), false);
    assert.equal(existsSync(roomRuntimeData.roomPartitionDir), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
});
