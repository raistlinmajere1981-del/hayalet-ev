import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildRoomHostModuleDataUrl } from "../../src/js/modules/rooms/room-host-source.ts";

async function importRoomHostModule(targetPath: string) {
  const absolutePath = resolve(targetPath);
  const moduleUrl = await buildRoomHostModuleDataUrl(absolutePath, async (filePath) => {
    return await readFile(filePath, "utf8");
  });
  return await import(`${moduleUrl}#game-room-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test("game-room workspace host imports cleanly through the room host loader graph", async () => {
  const moduleNamespace = (await importRoomHostModule("rooms/game-room/host/index.js")) as {
    default?: { activate?: unknown };
  };

  assert.equal(typeof moduleNamespace.default?.activate, "function");
});

test("game-room installed host imports cleanly through the portable room host loader graph", async () => {
  const moduleNamespace = (await importRoomHostModule("data/rooms/game-room/host/index.js")) as {
    default?: { activate?: unknown };
  };

  assert.equal(typeof moduleNamespace.default?.activate, "function");
});
