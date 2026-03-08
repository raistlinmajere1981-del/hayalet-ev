import test from "node:test";
import assert from "node:assert/strict";
import type { InstalledRoomRecord } from "../../src/types/rooms.ts";
import {
  buildRoomNavMarkup,
  buildRoomPageMarkup,
  getRoomPageName,
} from "../../src/js/modules/rooms/room-markup.ts";

const room: InstalledRoomRecord = {
  id: "xox-room",
  name: "XOX Room",
  version: "1.0.0",
  sourceDir: "/workspace/rooms/xox-room",
  installedDir: "/workspace/data/rooms/xox-room",
  manifestPath: "/workspace/data/rooms/xox-room/manifest.json",
  runtimeEntryPath: "/workspace/data/rooms/xox-room/ui/index.html",
  hostEntryPath: "/workspace/data/rooms/xox-room/host/index.js",
  installedAt: "2026-03-08T00:00:00.000Z",
  updatedAt: "2026-03-08T00:00:00.000Z",
};

test("getRoomPageName derives deterministic page names", () => {
  assert.equal(getRoomPageName("xox-room"), "room-xox-room");
});

test("buildRoomNavMarkup renders room nav button metadata", () => {
  const markup = buildRoomNavMarkup(room);
  assert.match(markup, /data-room-nav="true"/);
  assert.match(markup, /data-page="room-xox-room"/);
  assert.match(markup, /XOX Room/);
});

test("buildRoomPageMarkup renders room page shell id", () => {
  const markup = buildRoomPageMarkup(room);
  assert.match(markup, /id="page-room-xox-room"/);
  assert.match(markup, /data-room-page="true"/);
  assert.match(markup, /data-room-id="xox-room"/);
});
