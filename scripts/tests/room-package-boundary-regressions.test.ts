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
