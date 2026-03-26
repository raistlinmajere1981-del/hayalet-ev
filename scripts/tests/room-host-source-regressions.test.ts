import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildRoomHostModuleDataUrl,
  decodeRoomHostSource,
} from "../../src/js/modules/rooms/room-host-source.ts";

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
  const laboratoryHostPath = resolve("rooms/laboratory/host/index.js");
  const gameRoomHostPath = resolve("rooms/game-room/host/index.js");

  const laboratoryModuleUrl = await buildRoomHostModuleDataUrl(laboratoryHostPath, loadSource);
  const gameRoomModuleUrl = await buildRoomHostModuleDataUrl(gameRoomHostPath, loadSource);

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
});
