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


describe("RoomPackageManager lists bundled rooms and installs them without deleting the bu", () => {
void test("RoomPackageManager lists bundled rooms and installs them without deleting the bundle source", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-bundle-workspace-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const bundledWorkspaceRoot = join(tempRoot, "app.asar", "rooms");
  const dataRoot = join(tempRoot, "data");
  const runtimeBuildRoot = join(workspaceRoot, ".build");
  const runtimeRoomDir = join(runtimeBuildRoot, "workshop", "runtime");
  const registryPath = join(tempRoot, "config", "rooms.json");

  try {
    await writeRoomFixture(bundledWorkspaceRoot, "game-room", "Game Room");
    await writeRoomFixture(bundledWorkspaceRoot, "workshop", "Workshop");

    const manager = new RoomPackageManager({
      workspaceRoot,
      bundledWorkspaceRoot,
      runtimeBuildRoot,
      dataRoot,
      registryPath,
    });

    const workspaceRooms = await manager.listWorkspaceRooms();
    assert.equal(workspaceRooms.length, 2);
    assert.equal(workspaceRooms[0]?.sourceKind, "bundle");
    assert.equal(workspaceRooms[0].readOnly, true);
    assert.equal(workspaceRooms[1]?.sourceKind, "bundle");
    assert.equal(workspaceRooms[1].readOnly, true);

    const installResult = await manager.installFromWorkspace("workshop");
    assert.equal(installResult.success, true, installResult.error);
    assert.equal(installResult.room?.sourceDir, join(bundledWorkspaceRoot, "workshop"));
    assert.equal(existsSync(join(runtimeRoomDir, "ui", "index.html")), true);
    assert.equal(
      existsSync(
        join(dataRoot, "room-storage", "workshop", "build", "workspace", "ui", "index.html")
      ),
      false
    );
    assert.equal(existsSync(join(workspaceRoot, "workshop")), false);

    const roomRuntimeData = await writeRoomRuntimeDataFixture(dataRoot, "workshop");
    const removeResult = await manager.removeInstalledRoom("workshop", { deleteData: true });
    assert.equal(removeResult.success, true, removeResult.error);
    assert.equal(existsSync(join(bundledWorkspaceRoot, "workshop", "manifest.json")), true);
    assert.equal(existsSync(roomRuntimeData.roomStorageDir), false);
    assert.equal(existsSync(roomRuntimeData.roomPartitionDir), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
void test("RoomPackageManager removeInstalledRoom preserves user files inside installed room data", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-remove-installed-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const dataRoot = join(tempRoot, "data");
  const installedRoot = join(dataRoot, "rooms");
  const registryPath = join(tempRoot, "config", "rooms.json");
  const roomDir = join(workspaceRoot, "game-room");

  try {
    await mkdir(join(roomDir, "ui"), { recursive: true });
    await mkdir(join(roomDir, "host"), { recursive: true });
    await mkdir(join(roomDir, "assets"), { recursive: true });

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
    await writeFile(join(roomDir, "assets", "readme.txt"), "tracked", "utf8");

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const installResult = await manager.installFromWorkspace("game-room");
    assert.equal(installResult.success, true, installResult.error);

    const installedDir = join(installedRoot, "game-room");
    const roomRuntimeData = await writeRoomRuntimeDataFixture(dataRoot, "game-room");
    await mkdir(join(installedDir, "user-notes"), { recursive: true });
    await writeFile(join(installedDir, "user-notes", "custom.txt"), "keep me", "utf8");

    const removeResult = await manager.removeInstalledRoom("game-room");
    assert.equal(removeResult.success, true, removeResult.error);
    assert.equal(existsSync(roomDir), true);
    assert.equal(existsSync(join(installedDir, "manifest.json")), false);
    assert.equal(existsSync(join(installedDir, "ui", "index.html")), false);
    assert.equal(existsSync(join(installedDir, "host", "index.js")), false);
    assert.equal(existsSync(join(installedDir, "assets", "readme.txt")), false);
    assert.equal(existsSync(join(installedDir, "user-notes", "custom.txt")), true);
    assert.equal(existsSync(join(roomRuntimeData.roomStorageDir, "state.json")), true);
    assert.equal(existsSync(join(roomRuntimeData.roomPartitionDir, "session.json")), true);

    const installedRooms = await manager.listInstalledRooms();
    assert.equal(installedRooms.length, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
void test("RoomPackageManager exportInstalledRoomToWorkspace skips runtime tool payloads", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-export-installed-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const dataRoot = join(tempRoot, "data");
  const installedRoot = join(dataRoot, "rooms");
  const registryPath = join(tempRoot, "config", "rooms.json");

  try {
    await writeRoomFixture(workspaceRoot, "game-room", "Game Room");

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const installResult = await manager.installFromWorkspace("game-room");
    assert.equal(installResult.success, true, installResult.error);

    const installedDir = join(installedRoot, "game-room");
    await mkdir(join(installedDir, "tools", "runtime", "linux-x64"), { recursive: true });
    await writeFile(
      join(installedDir, "tools", "toolchain.manifest.json"),
      JSON.stringify({ roomId: "game-room", tools: { "yt-dlp": {} } }, null, 2),
      "utf8"
    );
    await writeFile(
      join(installedDir, "tools", "runtime", "linux-x64", "yt-dlp"),
      "binary",
      "utf8"
    );

    const exportResult = await manager.exportInstalledRoomToWorkspace("game-room", {
      overwrite: true,
    });

    assert.equal(exportResult.success, true, exportResult.error);
    assert.equal(existsSync(join(workspaceRoot, "game-room", "manifest.json")), true);
    assert.equal(
      existsSync(join(workspaceRoot, "game-room", "tools", "toolchain.manifest.json")),
      true
    );
    assert.equal(
      existsSync(join(workspaceRoot, "game-room", "tools", "runtime", "linux-x64", "yt-dlp")),
      false
    );
    assert.equal(existsSync(join(workspaceRoot, "game-room", ".room-install-files.json")), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
void test("RoomPackageManager install and export keep Team Tetris assets and protocols intact", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-team-tetris-export-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const dataRoot = join(tempRoot, "data");
  const installedRoot = join(dataRoot, "rooms");
  const registryPath = join(tempRoot, "config", "rooms.json");
  const roomDir = join(workspaceRoot, "game-room");

  try {
    await mkdir(join(roomDir, "ui"), { recursive: true });
    await mkdir(join(roomDir, "host"), { recursive: true });
    await mkdir(join(roomDir, "assets"), { recursive: true });
    await mkdir(join(roomDir, "protocols"), { recursive: true });

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
          defaultFeatureId: "backgammon",
          features: [
            {
              id: "backgammon",
              name: "Tavla",
            },
            {
              id: "team-tetris",
              name: "Team Tetris",
              protocolSpecs: [
                {
                  key: "game-room-team-tetris-ai-opening",
                  room: "game-room",
                  scenario: "team-tetris-ai-opening",
                  title: "[TURN][GAME-ROOM][TEAM-TETRIS][AI][OPENING]",
                },
                {
                  key: "game-room-team-tetris-ai-followup",
                  room: "game-room",
                  scenario: "team-tetris-ai-followup",
                  title: "[TURN][GAME-ROOM][TEAM-TETRIS][AI][FOLLOWUP]",
                },
                {
                  key: "game-room-team-tetris-us1-transport",
                  room: "game-room",
                  scenario: "team-tetris-us1-transport",
                  title: "[INFO][GAME-ROOM][TEAM-TETRIS][US1-TRANSPORT]",
                },
              ],
              scene: {
                hotspot: {
                  id: "game-room-team-tetris",
                  rect: { leftPx: 100, topPx: 120, widthPx: 180, heightPx: 120 },
                },
                view: {
                  id: "team-tetris-closeup",
                  backgroundSrc: "assets/team-tetris-view.webp",
                },
              },
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(join(roomDir, "ui", "index.html"), "<html></html>", "utf8");
    await writeFile(
      join(roomDir, "host", "index.js"),
      "module.exports = { activate() { return {}; } };\n",
      "utf8"
    );
    await writeFile(join(roomDir, "assets", "team-tetris-view.webp"), "placeholder", "utf8");
    await writeFile(
      join(roomDir, "protocols", "game-room-team-tetris-ai-opening.md"),
      "# opening\n",
      "utf8"
    );
    await writeFile(
      join(roomDir, "protocols", "game-room-team-tetris-ai-followup.md"),
      "# followup\n",
      "utf8"
    );
    await writeFile(
      join(roomDir, "protocols", "game-room-team-tetris-us1-transport.md"),
      "# transport\n",
      "utf8"
    );

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const installResult = await manager.installFromWorkspace("game-room");
    assert.equal(installResult.success, true, installResult.error);
    assert.equal(
      existsSync(join(installedRoot, "game-room", "assets", "team-tetris-view.webp")),
      true
    );
    assert.equal(
      existsSync(
        join(installedRoot, "game-room", "protocols", "game-room-team-tetris-ai-opening.md")
      ),
      true
    );

    await rm(join(roomDir, "assets", "team-tetris-view.webp"), { force: true });
    await rm(join(roomDir, "protocols", "game-room-team-tetris-ai-opening.md"), { force: true });
    await rm(join(roomDir, "protocols", "game-room-team-tetris-ai-followup.md"), { force: true });
    await rm(join(roomDir, "protocols", "game-room-team-tetris-us1-transport.md"), { force: true });

    const exportResult = await manager.exportInstalledRoomToWorkspace("game-room", {
      overwrite: true,
    });

    assert.equal(exportResult.success, true, exportResult.error);
    assert.equal(existsSync(join(roomDir, "assets", "team-tetris-view.webp")), true);
    assert.equal(
      existsSync(join(roomDir, "protocols", "game-room-team-tetris-ai-opening.md")),
      true
    );
    assert.equal(
      existsSync(join(roomDir, "protocols", "game-room-team-tetris-ai-followup.md")),
      true
    );
    assert.equal(
      existsSync(join(roomDir, "protocols", "game-room-team-tetris-us1-transport.md")),
      true
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
});
