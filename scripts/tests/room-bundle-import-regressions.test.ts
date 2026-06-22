import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
