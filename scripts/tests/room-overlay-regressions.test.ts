import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    dirName: "workshop",
    dirPath: "/workspace/rooms/workshop",
    valid: true,
    manifest: {
      schemaVersion: 2,
      id: "workshop",
      name: "Workshop",
      version: "1.0.0",
      menu: { label: "Workshop" },
      runtime: { uiEntry: "ui/index.html", hostEntry: "host/index.js" },
      defaultFeatureId: "assembler",
      features: [{ id: "assembler", name: "Assembler" }],
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
    installedDir: "/workspace/rooms/.build/game-room/runtime",
    manifestPath: "/workspace/rooms/.build/game-room/runtime/manifest.json",
    runtimeEntryPath: "/workspace/rooms/.build/game-room/runtime/ui/index.html",
    hostEntryPath: "/workspace/rooms/.build/game-room/runtime/host/index.js",
    defaultFeatureId: "chess",
    features: [{ id: "chess", name: "Chess" }],
    installedAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
  },
  {
    id: "workshop",
    name: "Workshop",
    version: "1.0.0",
    sourceDir: "/workspace/rooms/workshop",
    installedDir: "/workspace/rooms/.build/workshop/runtime",
    manifestPath: "/workspace/rooms/.build/workshop/runtime/manifest.json",
    runtimeEntryPath: "/workspace/rooms/.build/workshop/runtime/ui/index.html",
    hostEntryPath: "/workspace/rooms/.build/workshop/runtime/host/index.js",
    defaultFeatureId: "assembler",
    features: [{ id: "assembler", name: "Assembler" }],
    installedAt: "2026-03-22T00:00:00.000Z",
    updatedAt: "2026-03-22T00:00:00.000Z",
  },
];

void test("room overlay summary reports workspace and installed counts", () => {
  const markup = buildRoomOverlaySummary(workspaceRooms, installedRooms);

  assert.match(markup, /Workspace: <strong>4<\/strong>/);
  assert.match(markup, /Hazır: <strong>3<\/strong>/);
  assert.match(markup, /Yüklü: <strong>2<\/strong>/);
});

void test("workspace room list renders install and package actions", () => {
  const markup = buildWorkspaceRoomListMarkup(workspaceRooms, installedRooms);

  assert.match(markup, /data-room-action="install"/);
  assert.match(markup, /data-room-action="package"/);
  assert.match(markup, /data-room-action="delete"/);
  assert.match(markup, /data-room-action="delete" data-room-id="game-room" disabled/);
  assert.match(markup, /data-room-action="delete" data-room-id="observatory" disabled/);
  assert.match(markup, /Güncelle/);
  assert.match(markup, /Workshop/);
  assert.match(markup, /Observatory/);
  assert.match(markup, /manifest\.json missing/);
});

void test("installed room list renders remove action without export", () => {
  const markup = buildInstalledRoomListMarkup(installedRooms, workspaceRooms);

  assert.match(markup, /data-room-action="remove"/);
  assert.doesNotMatch(markup, /data-room-action="export"/);
  assert.match(markup, /Workspace bağlı/);
  assert.match(markup, /Workshop/);
});

void test("workspace fallback entries stay out of installed summary and list markup", () => {
  const fallbackInstalledRooms: InstalledRoomRecord[] = [
    {
      id: "fallback-room",
      name: "Fallback Room",
      version: "1.0.0",
      isWorkspaceFallback: true,
      sourceDir: "/workspace/rooms/fallback-room",
      installedDir: "/workspace/rooms/.build/fallback-room/runtime",
      manifestPath: "/workspace/rooms/.build/fallback-room/runtime/manifest.json",
      runtimeEntryPath: "/workspace/rooms/.build/fallback-room/runtime/ui/index.html",
      hostEntryPath: "/workspace/rooms/.build/fallback-room/runtime/host/index.js",
      defaultFeatureId: "primary",
      features: [{ id: "primary", name: "Primary" }],
      installedAt: "2026-03-29T00:00:00.000Z",
      updatedAt: "2026-03-29T00:00:00.000Z",
    },
  ];

  const summaryMarkup = buildRoomOverlaySummary([], fallbackInstalledRooms);
  const installedMarkup = buildInstalledRoomListMarkup(fallbackInstalledRooms, []);
  const workspaceMarkup = buildWorkspaceRoomListMarkup(
    workspaceRooms.slice(0, 1),
    fallbackInstalledRooms
  );

  assert.match(summaryMarkup, /Yüklü: <strong>0<\/strong>/);
  assert.match(installedMarkup, /room-manager-empty/);
  assert.doesNotMatch(workspaceMarkup, /Güncelle/);
  assert.doesNotMatch(
    workspaceMarkup,
    /data-room-action="delete" data-room-id="game-room" disabled/
  );
});

void test("room confirmation copy keeps remove and delete actions distinct", () => {
  const tr = JSON.parse(
    readFileSync(new URL("../../shared/languages/tr/index.json", import.meta.url), "utf8")
  ) as {
    shell: {
      rooms: {
        confirm: Record<string, string>;
      };
    };
  };

  const en = JSON.parse(
    readFileSync(new URL("../../shared/languages/en/index.json", import.meta.url), "utf8")
  ) as {
    shell: {
      rooms: {
        confirm: Record<string, string>;
      };
    };
  };

  assert.equal(tr.shell.rooms.confirm["deleteAction"], "Sil");
  assert.equal(tr.shell.rooms.confirm["removeAction"], "Kaldır");
  assert.match(tr.shell.rooms.confirm["removeDataHint"] ?? "", /rooms klasörüne dokunulmaz/);
  assert.equal(en.shell.rooms.confirm["deleteAction"], "Delete");
  assert.equal(en.shell.rooms.confirm["removeAction"], "Remove");
  assert.match(en.shell.rooms.confirm["removeDataHint"] ?? "", /rooms folder is untouched/i);
});
