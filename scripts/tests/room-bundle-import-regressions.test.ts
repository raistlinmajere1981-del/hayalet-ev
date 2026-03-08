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
  const bundlePath = join(tempRoot, "imports", "xox-import.hevroom.json");

  try {
    await mkdir(join(tempRoot, "imports"), { recursive: true });

    const bundle = {
      schemaVersion: ROOM_SCHEMA_VERSION,
      manifest: {
        schemaVersion: ROOM_SCHEMA_VERSION,
        id: "xox-import",
        name: "XOX Import",
        version: "1.0.0",
        menu: { label: "XOX Import" },
        uiEntry: "ui/index.html",
        hostEntry: "host/index.js",
      },
      files: {
        "ui/index.html": {
          encoding: "base64",
          content: encodeBase64("<!doctype html><html><body>XOX</body></html>"),
        },
        "ui/index.js": {
          encoding: "base64",
          content: encodeBase64('console.log("xox-import");'),
        },
        "host/index.js": {
          encoding: "base64",
          content: encodeBase64("module.exports = () => ({ dispose() {} });"),
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
    assert.equal(result.room?.id, "xox-import");
    assert.equal(result.path, join(workspaceRoot, "xox-import"));
    assert.equal(existsSync(join(workspaceRoot, "xox-import", "manifest.json")), true);
    assert.equal(existsSync(join(installedRoot, "xox-import", "ui", "index.html")), true);

    const workspaceManifest = JSON.parse(
      await readFile(join(workspaceRoot, "xox-import", "manifest.json"), "utf8")
    ) as { id: string; uiEntry: string };
    assert.equal(workspaceManifest.id, "xox-import");
    assert.equal(workspaceManifest.uiEntry, "ui/index.html");

    const installedRooms = await manager.listInstalledRooms();
    assert.equal(installedRooms.length, 1);
    assert.equal(installedRooms[0]?.id, "xox-import");
    assert.equal(installedRooms[0]?.sourceDir, join(workspaceRoot, "xox-import"));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("RoomPackageManager rejects bundles with missing runtime files", async () => {
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
        version: "1.0.0",
        menu: { label: "Broken" },
        uiEntry: "ui/index.html",
        hostEntry: "host/index.js",
      },
      files: {
        "ui/index.js": {
          encoding: "base64",
          content: encodeBase64('console.log("missing runtime");'),
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
    assert.match(result.error ?? "", /files missing uiEntry/);
    assert.equal(existsSync(join(workspaceRoot, "broken-room")), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
