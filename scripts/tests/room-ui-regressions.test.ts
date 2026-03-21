import test from "node:test";
import assert from "node:assert/strict";
import type { InstalledRoomRecord } from "../../src/types/rooms.ts";
import {
  buildRoomNavMarkup,
  buildRoomPageMarkup,
  getRoomPageName,
} from "../../src/js/modules/rooms/room-markup.ts";

const room: InstalledRoomRecord = {
  id: "game-room",
  name: "Game Room",
  version: "2.1.0",
  sourceDir: "/workspace/rooms/game-room",
  installedDir: "/workspace/data/rooms/game-room",
  manifestPath: "/workspace/data/rooms/game-room/manifest.json",
  runtimeEntryPath: "/workspace/data/rooms/game-room/ui/index.html",
  hostEntryPath: "/workspace/data/rooms/game-room/host/index.js",
  defaultFeatureId: "xox",
  features: [{ id: "xox", name: "XOX" }],
  installedAt: "2026-03-08T00:00:00.000Z",
  updatedAt: "2026-03-08T00:00:00.000Z",
};

test("getRoomPageName derives deterministic page names", () => {
  assert.equal(getRoomPageName("game-room"), "room-game-room");
});

test("buildRoomNavMarkup renders room nav button metadata", () => {
  const markup = buildRoomNavMarkup(room);
  assert.match(markup, /data-room-nav="true"/);
  assert.match(markup, /data-page="room-game-room"/);
  assert.match(markup, /Game Room/);
});

test("buildRoomPageMarkup renders room page shell id", () => {
  const markup = buildRoomPageMarkup(room);
  assert.match(markup, /id="page-room-game-room"/);
  assert.match(markup, /data-room-page="true"/);
  assert.match(markup, /data-room-id="game-room"/);
});
