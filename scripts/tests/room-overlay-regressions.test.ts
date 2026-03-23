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
    dirName: "laboratory",
    dirPath: "/workspace/rooms/laboratory",
    valid: true,
    manifest: {
      schemaVersion: 2,
      id: "laboratory",
      name: "Laboratory",
      version: "1.0.0",
      menu: { label: "Laboratory" },
      runtime: { uiEntry: "ui/index.html", hostEntry: "host/index.js" },
      defaultFeatureId: "video-analysis",
      features: [{ id: "video-analysis", name: "Video Analysis" }],
    },
    errors: [],
  },
  {
    dirName: "observatory",
    dirPath: "/bundle/rooms/observatory",
    valid: true,
    sourceKind: "bundle",
    readOnly: true,
    manifest: {
      schemaVersion: 2,
      id: "observatory",
      name: "Observatory",
      version: "1.1.0",
      menu: { label: "Observatory" },
      runtime: { uiEntry: "ui/index.html", hostEntry: "host/index.js" },
      defaultFeatureId: "stargazer",
      features: [{ id: "stargazer", name: "Stargazer" }],
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
  {
    id: "laboratory",
    name: "Laboratory",
    version: "1.0.0",
    sourceDir: "/workspace/rooms/laboratory",
    installedDir: "/workspace/data/rooms/laboratory",
    manifestPath: "/workspace/data/rooms/laboratory/manifest.json",
    runtimeEntryPath: "/workspace/data/rooms/laboratory/ui/index.html",
    hostEntryPath: "/workspace/data/rooms/laboratory/host/index.js",
    defaultFeatureId: "video-analysis",
    features: [{ id: "video-analysis", name: "Video Analysis" }],
    installedAt: "2026-03-22T00:00:00.000Z",
    updatedAt: "2026-03-22T00:00:00.000Z",
  },
];

test("room overlay summary reports workspace and installed counts", () => {
  const markup = buildRoomOverlaySummary(workspaceRooms, installedRooms);

  assert.match(markup, /Workspace: <strong>4<\/strong>/);
  assert.match(markup, /Hazır: <strong>3<\/strong>/);
  assert.match(markup, /Yüklü: <strong>2<\/strong>/);
});

test("workspace room list renders install and package actions", () => {
  const markup = buildWorkspaceRoomListMarkup(workspaceRooms, installedRooms);

  assert.match(markup, /data-room-action="install"/);
  assert.match(markup, /data-room-action="package"/);
  assert.match(markup, /data-room-action="delete"/);
  assert.match(markup, /data-room-action="delete" data-room-id="game-room" disabled/);
  assert.match(markup, /data-room-action="delete" data-room-id="observatory" disabled/);
  assert.match(markup, /Güncelle/);
  assert.match(markup, /Laboratory/);
  assert.match(markup, /Observatory/);
  assert.match(markup, /manifest\.json missing/);
});

test("installed room list renders export and remove actions", () => {
  const markup = buildInstalledRoomListMarkup(installedRooms, workspaceRooms);

  assert.match(markup, /data-room-action="export"/);
  assert.match(markup, /data-room-action="remove"/);
  assert.match(markup, /Workspace bağlı/);
  assert.match(markup, /Laboratory/);
});
