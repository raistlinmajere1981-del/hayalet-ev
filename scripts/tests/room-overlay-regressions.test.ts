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
    dirName: "xox",
    dirPath: "/workspace/rooms/xox",
    valid: true,
    manifest: {
      schemaVersion: 1,
      id: "xox",
      name: "XOX Room",
      version: "1.0.0",
      menu: { label: "XOX" },
      uiEntry: "ui/index.html",
      hostEntry: "host/index.js",
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
    id: "xox",
    name: "XOX Room",
    version: "1.0.0",
    sourceDir: "/workspace/rooms/xox",
    installedDir: "/workspace/data/rooms/xox",
    manifestPath: "/workspace/data/rooms/xox/manifest.json",
    runtimeEntryPath: "/workspace/data/rooms/xox/ui/index.html",
    hostEntryPath: "/workspace/data/rooms/xox/host/index.js",
    installedAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
  },
];

test("room overlay summary reports workspace and installed counts", () => {
  const markup = buildRoomOverlaySummary(workspaceRooms, installedRooms);

  assert.match(markup, /Workspace: <strong>2<\/strong>/);
  assert.match(markup, /Hazir: <strong>1<\/strong>/);
  assert.match(markup, /Yuklu: <strong>1<\/strong>/);
});

test("workspace room list renders install and package actions", () => {
  const markup = buildWorkspaceRoomListMarkup(workspaceRooms, installedRooms);

  assert.match(markup, /data-room-action="install"/);
  assert.match(markup, /data-room-action="package"/);
  assert.match(markup, /Guncelle/);
  assert.match(markup, /manifest\.json missing/);
});

test("installed room list renders open, export, and remove actions", () => {
  const markup = buildInstalledRoomListMarkup(installedRooms, workspaceRooms);

  assert.match(markup, /data-room-action="open"/);
  assert.match(markup, /data-room-action="export"/);
  assert.match(markup, /data-room-action="remove"/);
  assert.match(markup, /Workspace bagli/);
});
