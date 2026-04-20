import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildRoomHostModuleDataUrl } from "../../src/js/modules/rooms/room-host-source.ts";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";

async function importRoomHostModule(targetPath: string) {
  const absolutePath = resolve(targetPath);
  const moduleUrl = await buildRoomHostModuleDataUrl(absolutePath, async (filePath) => {
    return await readFile(filePath, "utf8");
  });
  return await import(`${moduleUrl}#smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test("forge-room build artifact host imports cleanly through the room host loader graph", async () => {
  const buildArtifact = await createRoomBuiltArtifact("forge-room");

  try {
    const moduleNamespace = (await importRoomHostModule(`${buildArtifact.rootDir}/host/index.js`)) as {
      default?: { activate?: unknown };
    };
    assert.equal(typeof moduleNamespace.default?.activate, "function");
  } finally {
    await buildArtifact.cleanup();
  }
});

test("forge-room installed host imports cleanly through the portable room host loader graph", async () => {
  const installedCopy = await createRoomInstalledCopy("forge-room");

  try {
    const moduleNamespace = (await importRoomHostModule(`${installedCopy.rootDir}/host/index.js`)) as {
      default?: { activate?: unknown };
    };
    assert.equal(typeof moduleNamespace.default?.activate, "function");
  } finally {
    await installedCopy.cleanup();
  }
});

test("forge-room live installed host artifact imports cleanly from the repo data copy", async (t) => {
  const repoDataCopyPath = resolve("data/rooms/forge-room/host/index.js");
  try {
    await access(repoDataCopyPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      t.skip("forge-room repo data copy is not installed in this workspace");
      return;
    }
    throw error;
  }

  const moduleNamespace = (await importRoomHostModule(repoDataCopyPath)) as {
    default?: { activate?: unknown };
  };
  assert.equal(typeof moduleNamespace.default?.activate, "function");
});
