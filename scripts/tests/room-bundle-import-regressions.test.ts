import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RoomPackageManager } from "../../electron/room-package-manager.ts";
import { ROOM_SCHEMA_VERSION } from "../../src/types/rooms.ts";

function encodeBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

test("RoomPackageManager imports a .hevroom bundle into workspace and installed registry", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-bundle-import-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const installedRoot = join(tempRoot, "data", "rooms");
  const registryPath = join(tempRoot, "config", "rooms.json");
  const bundlePath = join(tempRoot, "imports", "game-room-import.hevroom.json");

  try {
    await mkdir(join(tempRoot, "imports"), { recursive: true });

    const bundle = {
      schemaVersion: ROOM_SCHEMA_VERSION,
      manifest: {
        schemaVersion: ROOM_SCHEMA_VERSION,
        id: "game-room-import",
        name: "Game Room Import",
        version: "2.0.0",
        menu: { label: "Game Room Import" },
        runtime: {
          uiEntry: "ui/index.html",
          hostEntry: "host/index.js",
        },
        defaultFeatureId: "chess",
        features: [
          {
            id: "chess",
            name: "Chess",
            scene: {
              hotspot: {
                id: "import-chess",
                rect: { leftPx: 100, topPx: 120, widthPx: 180, heightPx: 120 },
              },
              view: {
                id: "chess-closeup",
                backgroundSrc: "assets/chess-view.svg",
              },
            },
          },
        ],
        scene: {
          referenceSize: { width: 1600, height: 900 },
          roomBackgroundSrc: "assets/room-background.svg",
          roomsHotspot: {
            id: "game-room-import-door",
            rect: { leftPx: 720, topPx: 240, widthPx: 150, heightPx: 320 },
          },
          backHotspot: {
            id: "game-room-import-back",
            rect: { leftPx: 70, topPx: 180, widthPx: 120, heightPx: 240 },
          },
        },
      },
      files: {
        "ui/index.html": {
          encoding: "base64",
          content: encodeBase64("<!doctype html><html><body>Game Room</body></html>"),
        },
        "host/index.js": {
          encoding: "base64",
          content: encodeBase64("module.exports = { activate() { return {}; } };"),
        },
        "assets/room-background.svg": {
          encoding: "base64",
          content: encodeBase64("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
        },
        "assets/chess-view.svg": {
          encoding: "base64",
          content: encodeBase64("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
        },
      },
      exportedAt: "2026-03-08T00:00:00.000Z",
    };

    await writeFile(bundlePath, JSON.stringify(bundle, null, 2), "utf8");

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const result = await manager.importBundleFile(bundlePath, { overwriteWorkspace: true });

    assert.equal(result.success, true, result.error);
    assert.equal(result.restartRequired, true);
    assert.equal(result.room?.id, "game-room-import");
    assert.equal(result.path, join(workspaceRoot, "game-room-import"));
    assert.equal(existsSync(join(workspaceRoot, "game-room-import", "manifest.json")), true);
    assert.equal(existsSync(join(installedRoot, "game-room-import", "ui", "index.html")), true);

    const workspaceManifest = JSON.parse(
      await readFile(join(workspaceRoot, "game-room-import", "manifest.json"), "utf8")
    ) as { id: string; runtime: { uiEntry: string } };
    assert.equal(workspaceManifest.id, "game-room-import");
    assert.equal(workspaceManifest.runtime.uiEntry, "ui/index.html");

    const installedRooms = await manager.listInstalledRooms();
    assert.equal(installedRooms.length, 1);
    assert.equal(installedRooms[0]?.id, "game-room-import");
    assert.equal(installedRooms[0]?.defaultFeatureId, "chess");
    assert.equal(installedRooms[0]?.sourceDir, join(workspaceRoot, "game-room-import"));
    assert.equal(
      installedRooms[0]?.scene?.roomBackgroundPath,
      join(installedRoot, "game-room-import", "assets", "room-background.svg")
    );
    assert.equal(
      installedRooms[0]?.features[0]?.scene?.view.backgroundPath,
      join(installedRoot, "game-room-import", "assets", "chess-view.svg")
    );

    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      rooms: Array<{
        scene?: { roomBackgroundPath?: string };
        features?: Array<{ scene?: { view?: { backgroundPath?: string } } }>;
      }>;
    };
    assert.equal(
      registry.rooms[0]?.scene?.roomBackgroundPath,
      join(installedRoot, "game-room-import", "assets", "room-background.svg")
    );
    assert.equal(
      registry.rooms[0]?.features?.[0]?.scene?.view?.backgroundPath,
      join(installedRoot, "game-room-import", "assets", "chess-view.svg")
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("RoomPackageManager rejects bundles with missing scene assets", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "room-bundle-invalid-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const installedRoot = join(tempRoot, "data", "rooms");
  const registryPath = join(tempRoot, "config", "rooms.json");
  const bundlePath = join(tempRoot, "imports", "broken.hevroom.json");

  try {
    await mkdir(join(tempRoot, "imports"), { recursive: true });

    const bundle = {
      schemaVersion: ROOM_SCHEMA_VERSION,
      manifest: {
        schemaVersion: ROOM_SCHEMA_VERSION,
        id: "broken-room",
        name: "Broken Room",
        version: "2.0.0",
        menu: { label: "Broken" },
        runtime: {
          uiEntry: "ui/index.html",
          hostEntry: "host/index.js",
        },
        defaultFeatureId: "chess",
        features: [
          {
            id: "chess",
            name: "Chess",
            scene: {
              hotspot: {
                id: "broken-chess",
                rect: { leftPx: 100, topPx: 100, widthPx: 120, heightPx: 120 },
              },
              view: {
                id: "chess-closeup",
                backgroundSrc: "assets/chess-view.svg",
              },
            },
          },
        ],
        scene: {
          referenceSize: { width: 1600, height: 900 },
          roomBackgroundSrc: "assets/room-background.svg",
          roomsHotspot: {
            id: "broken-door",
            rect: { leftPx: 700, topPx: 240, widthPx: 160, heightPx: 300 },
          },
          backHotspot: {
            id: "broken-back",
            rect: { leftPx: 70, topPx: 180, widthPx: 120, heightPx: 240 },
          },
        },
      },
      files: {
        "ui/index.html": {
          encoding: "base64",
          content: encodeBase64("<!doctype html><html><body>Broken</body></html>"),
        },
        "host/index.js": {
          encoding: "base64",
          content: encodeBase64("module.exports = { activate() { return {}; } };"),
        },
      },
      exportedAt: "2026-03-08T00:00:00.000Z",
    };

    await writeFile(bundlePath, JSON.stringify(bundle, null, 2), "utf8");

    const manager = new RoomPackageManager({
      workspaceRoot,
      installedRoot,
      registryPath,
    });

    const result = await manager.importBundleFile(bundlePath, { overwriteWorkspace: true });

    assert.equal(result.success, false);
    assert.match(result.error ?? "", /required asset/i);
    assert.equal(existsSync(join(workspaceRoot, "broken-room")), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
