import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  icon: "GM",
  iconPath: "/workspace/data/rooms/game-room/shared/assets/nav-icon.svg",
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

const workshopRoom: InstalledRoomRecord = {
  id: "workshop",
  name: "Workshop",
  version: "1.0.0",
  sourceDir: "/workspace/rooms/workshop",
  installedDir: "/workspace/data/rooms/workshop",
  manifestPath: "/workspace/data/rooms/workshop/manifest.json",
  runtimeEntryPath: "/workspace/data/rooms/workshop/ui/index.html",
  hostEntryPath: "/workspace/data/rooms/workshop/host/index.js",
  defaultFeatureId: "assembler",
  features: [{ id: "assembler", name: "Assembler" }],
  installedAt: "2026-03-22T00:00:00.000Z",
  updatedAt: "2026-03-22T00:00:00.000Z",
};

test("getRoomPageName derives deterministic page names", () => {
  assert.equal(getRoomPageName("game-room"), "room-game-room");
});

test("buildRoomNavMarkup renders room nav button metadata", () => {
  const markup = buildRoomNavMarkup(room);
  assert.match(markup, /data-room-nav="true"/);
  assert.match(markup, /data-page="room-game-room"/);
  assert.match(markup, /data-side-nav-icon-fallback="GM"/);
  assert.match(
    markup,
    /data-side-nav-icon-src="\/workspace\/data\/rooms\/game-room\/shared\/assets\/nav-icon\.svg"/
  );
  assert.match(markup, /Game Room/);
});

test("buildRoomPageMarkup renders room page shell id", () => {
  const markup = buildRoomPageMarkup(room);
  assert.match(markup, /id="page-room-game-room"/);
  assert.match(markup, /data-room-page="true"/);
  assert.match(markup, /data-room-id="game-room"/);
});

test("secondary room markup renders deterministic nav and page metadata", () => {
  const navMarkup = buildRoomNavMarkup(workshopRoom);
  const pageMarkup = buildRoomPageMarkup(workshopRoom);

  assert.equal(getRoomPageName("workshop"), "room-workshop");
  assert.match(navMarkup, /data-page="room-workshop"/);
  assert.match(navMarkup, /Workshop/);
  assert.match(pageMarkup, /id="page-room-workshop"/);
  assert.match(pageMarkup, /data-room-id="workshop"/);
});

test("room webview preload delays the fallback room-ready signal when runtimes self-report readiness", () => {
  const preloadSource = readFileSync("electron/room-webview-preload.cjs", "utf8");

  assert.match(preloadSource, /let pendingAutoRoomReadyTimer = null;/);
  assert.match(preloadSource, /let explicitRoomReadySent = false;/);
  assert.match(preloadSource, /explicitRoomReadySent = true;/);
  assert.match(preloadSource, /clearPendingAutoRoomReady\(\);/);
  assert.match(preloadSource, /pendingAutoRoomReadyTimer = globalThis\.setTimeout\(/);
  assert.match(preloadSource, /if \(explicitRoomReadySent\) \{\s*return;\s*\}/);
});
