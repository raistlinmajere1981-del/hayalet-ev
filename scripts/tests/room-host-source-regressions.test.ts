import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildRoomHostModuleDataUrl,
  decodeRoomHostSource,
} from "../../src/js/modules/rooms/room-host-source.ts";
import { createRoomBuiltArtifact } from "./helpers/room-installed-copy.ts";

test("decodeRoomHostSource decodes base64 room host source", () => {
  const rawSource = 'module.exports = function () { return { dispose() {} }; };';
  const encoded = Buffer.from(rawSource, "utf8").toString("base64");

  assert.equal(decodeRoomHostSource(encoded), rawSource);
});

test("decodeRoomHostSource keeps plain javascript source unchanged", () => {
  const rawSource = 'module.exports = function () { return { dispose() {} }; };';

  assert.equal(decodeRoomHostSource(rawSource), rawSource);
});

test("buildRoomHostModuleDataUrl imports mixed room host module graphs through data urls", async () => {
  const loadSource = async (filePath: string) => await readFile(filePath, "utf8");
  const laboratoryBuildArtifact = await createRoomBuiltArtifact("laboratory");
  const gameRoomBuildArtifact = await createRoomBuiltArtifact("game-room");

  try {
    const laboratoryModuleUrl = await buildRoomHostModuleDataUrl(
      `${laboratoryBuildArtifact.rootDir}/host/index.js`,
      loadSource
    );
    const gameRoomModuleUrl = await buildRoomHostModuleDataUrl(
      `${gameRoomBuildArtifact.rootDir}/host/index.js`,
      loadSource
    );

    const laboratoryModule = (await import(laboratoryModuleUrl)) as {
      default?: { activate?: unknown };
    };
    const gameRoomModule = (await import(gameRoomModuleUrl)) as {
      default?: unknown;
      teamTetrisEngine?: unknown;
    };

    assert.match(laboratoryModuleUrl, /^data:text\/javascript;base64,/);
    assert.match(gameRoomModuleUrl, /^data:text\/javascript;base64,/);
    assert.equal(typeof laboratoryModule.default?.activate, "function");
    assert.ok(gameRoomModule.default);
    assert.ok(gameRoomModule.teamTetrisEngine);
  } finally {
    await Promise.all([laboratoryBuildArtifact.cleanup(), gameRoomBuildArtifact.cleanup()]);
  }
});

test("buildRoomHostModuleDataUrl rejects host imports that escape the room root", async () => {
  const entryPath = resolve("tmp-room/host/index.js");
  const loadSource = async (filePath: string) => {
    if (filePath === entryPath) {
      return 'import "../../outside.js";\nexport default { activate() {} };';
    }
    throw new Error(`Unexpected file read: ${filePath}`);
  };

  await assert.rejects(
    async () => {
      await buildRoomHostModuleDataUrl(entryPath, loadSource);
    },
    /escaped room root/i
  );
});
