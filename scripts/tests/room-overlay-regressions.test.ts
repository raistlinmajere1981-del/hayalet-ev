import test from "node:test";
import assert from "node:assert/strict";
import type { InstalledRoomRecord, RoomWorkspaceEntry } from "../../src/types/rooms.ts";
import {
  buildInstalledRoomListMarkup,
  buildRoomOverlaySummary,
  buildWorkspaceRoomListMarkup,
} from "../../src/js/modules/rooms/room-overlay-markup.ts";

const workspaceRooms: RoomWorkspaceEntry[] = [
  {
    dirName: "game-room",
    dirPath: "/workspace/rooms/game-room",
    valid: true,
    manifest: {
      schemaVersion: 2,
      id: "game-room",
      name: "Game Room",
      version: "2.0.0",
      menu: { label: "Game Room" },
      runtime: { uiEntry: "ui/index.html", hostEntry: "host/index.js" },
      defaultFeatureId: "chess",
      features: [{ id: "chess", name: "Chess" }],
    },
    errors: [],
  },
  {
    dirName: "broken-room",
    dirPath: "/workspace/rooms/broken-room",
    valid: false,
    errors: ["manifest.json missing"],
  },
];

const installedRooms: InstalledRoomRecord[] = [
  {
    id: "game-room",
    name: "Game Room",
    version: "2.0.0",
    sourceDir: "/workspace/rooms/game-room",
    installedDir: "/workspace/data/rooms/game-room",
    manifestPath: "/workspace/data/rooms/game-room/manifest.json",
    runtimeEntryPath: "/workspace/data/rooms/game-room/ui/index.html",
    hostEntryPath: "/workspace/data/rooms/game-room/host/index.js",
    defaultFeatureId: "chess",
    features: [{ id: "chess", name: "Chess" }],
    installedAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
  },
];

test("room overlay summary reports workspace and installed counts", () => {
  const markup = buildRoomOverlaySummary(workspaceRooms, installedRooms);

  assert.match(markup, /Workspace: <strong>2<\/strong>/);
  assert.match(markup, /Hazır: <strong>1<\/strong>/);
  assert.match(markup, /Yüklü: <strong>1<\/strong>/);
});

test("workspace room list renders install and package actions", () => {
  const markup = buildWorkspaceRoomListMarkup(workspaceRooms, installedRooms);

  assert.match(markup, /data-room-action="install"/);
  assert.match(markup, /data-room-action="package"/);
  assert.match(markup, /Güncelle/);
  assert.match(markup, /manifest\.json missing/);
});

test("installed room list renders export and remove actions", () => {
  const markup = buildInstalledRoomListMarkup(installedRooms, workspaceRooms);

  assert.match(markup, /data-room-action="export"/);
  assert.match(markup, /data-room-action="remove"/);
  assert.match(markup, /Workspace bağlı/);
});
