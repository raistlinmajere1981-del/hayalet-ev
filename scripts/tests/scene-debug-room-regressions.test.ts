import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSceneRoomDefinition,
  DEFAULT_ANALYZE_SCENE_MAP,
  DEFAULT_ASSISTANT_SCENE_MAP,
  DEFAULT_ENTRANCE_SCENE_MAP,
  DEFAULT_ROOMS_SCENE_MAP,
  DEFAULT_SERVER_SCENE_MAP,
  DEFAULT_SETTINGS_SCENE_MAP,
  getSceneBackObjectForView,
  listSceneDebugNodes,
  normalizeAnalyzeSceneMap,
  normalizeAssistantSceneMap,
  normalizeEntranceSceneMap,
  normalizeRoomsSceneMap,
  normalizeServerSceneMap,
  normalizeSettingsSceneMap,
} from "../../src/js/scene/layout/index.ts";
import { SCENE_DEBUG_ROOMS } from "../../src/js/scene/debug/index.ts";

test("scene debug room registry includes all unified scene rooms", () => {
  assert.deepEqual(
    SCENE_DEBUG_ROOMS.map((room) => room.id),
    ["entrance", "analyze", "assistant", "server", "rooms", "settings"]
  );
});

test("entrance scene map keeps room targets and whisper return zone in one object list", () => {
  assert.deepEqual(
    DEFAULT_ENTRANCE_SCENE_MAP.objects.filter((node) => node.viewId === null).map((node) => node.id),
    ["door-analyze", "door-assistant", "door-server", "door-settings", "hatch-rooms", "board-whisper"]
  );
  assert.equal(getSceneBackObjectForView(DEFAULT_ENTRANCE_SCENE_MAP, "whisper")?.id, "back-whisper");
  assert.equal(
    DEFAULT_ENTRANCE_SCENE_MAP.objects.find((node) => node.id === "board-whisper")?.action.type,
    "whisper"
  );

  const normalized = normalizeEntranceSceneMap({
    objects: [
      { id: "board-whisper", rect: { leftPx: 408 } },
      { id: "back-whisper", rect: { widthPx: 140 } },
    ],
  });

  assert.equal(normalized.objects.find((node) => node.id === "board-whisper")?.rect.leftPx, 408);
  assert.equal(normalized.objects.find((node) => node.id === "back-whisper")?.rect.widthPx, 140);
});

test("assistant scene map uses object hotspots plus one view-scoped back object", () => {
  assert.deepEqual(
    DEFAULT_ASSISTANT_SCENE_MAP.objects.filter((node) => node.viewId === null).map((node) => node.id),
    ["door-entrance", "screen-primary"]
  );
  assert.equal(getSceneBackObjectForView(DEFAULT_ASSISTANT_SCENE_MAP, "primary")?.id, "back-primary");
  assert.deepEqual(DEFAULT_ASSISTANT_SCENE_MAP.characters.map((node) => node.id), ["anchor-ai0"]);

  const normalized = normalizeAssistantSceneMap({
    objects: [{ id: "screen-primary", rect: { leftPx: 900 } }],
    characters: [{ id: "anchor-ai0", bottomPx: 144 }],
  });

  assert.equal(normalized.objects.find((node) => node.id === "screen-primary")?.rect.leftPx, 900);
  assert.equal(normalized.characters.find((node) => node.id === "anchor-ai0")?.bottomPx, 144);
});

test("analyze scene map keeps its table and archive returns on the shared object contract", () => {
  assert.deepEqual(
    DEFAULT_ANALYZE_SCENE_MAP.objects.filter((node) => node.viewId === null).map((node) => node.id),
    ["door-entrance", "screen-primary", "screen-archive"]
  );
  assert.equal(getSceneBackObjectForView(DEFAULT_ANALYZE_SCENE_MAP, "table")?.id, "back-table");
  assert.equal(getSceneBackObjectForView(DEFAULT_ANALYZE_SCENE_MAP, "archive")?.id, "back-archive");

  const normalized = normalizeAnalyzeSceneMap({
    objects: [
      { id: "screen-archive", rect: { leftPx: 1280 } },
      { id: "back-archive", rect: { widthPx: 128 } },
    ],
  });

  assert.equal(normalized.objects.find((node) => node.id === "screen-archive")?.rect.leftPx, 1280);
  assert.equal(normalized.objects.find((node) => node.id === "back-archive")?.rect.widthPx, 128);

  const room = buildSceneRoomDefinition("analyze", DEFAULT_ANALYZE_SCENE_MAP);
  assert.equal(room.id, "analyze");
  assert.ok(room.nodes.some((node) => node.kind === "object" && node.id === "screen-primary"));
  assert.ok(room.nodes.some((node) => node.kind === "object" && node.id === "back-table"));
  assert.ok(room.nodes.some((node) => node.kind === "character" && node.id === "anchor-ai1-primary"));
});

test("settings scene map defines close, panels, one back object, and one user character", () => {
  assert.deepEqual(
    DEFAULT_SETTINGS_SCENE_MAP.objects.filter((node) => node.viewId === null).map((node) => node.id),
    ["door-close", "panel-theme", "panel-accounts", "panel-backup", "panel-rooms", "panel-live-log"]
  );
  assert.equal(DEFAULT_SETTINGS_SCENE_MAP.objects[0]?.action.type, "settings-scene-close");
  assert.equal(getSceneBackObjectForView(DEFAULT_SETTINGS_SCENE_MAP, "panel")?.id, "back-panel");
  assert.deepEqual(DEFAULT_SETTINGS_SCENE_MAP.characters.map((node) => node.id), ["anchor-user"]);

  const normalized = normalizeSettingsSceneMap({
    objects: [
      { id: "panel-live-log", rect: { leftPx: 1100 } },
      { id: "back-panel", rect: { widthPx: 132 } },
    ],
    characters: [{ id: "anchor-user", bottomPx: 140 }],
  });

  assert.equal(normalized.objects.find((node) => node.id === "panel-live-log")?.rect.leftPx, 1100);
  assert.equal(normalized.objects.find((node) => node.id === "back-panel")?.rect.widthPx, 132);
  assert.equal(normalized.characters.find((node) => node.id === "anchor-user")?.bottomPx, 140);
});

test("server scene map stays on the same unified contract with one back object", () => {
  assert.deepEqual(
    DEFAULT_SERVER_SCENE_MAP.objects.filter((node) => node.viewId === null).map((node) => node.id),
    ["door-entrance", "screen-primary"]
  );
  assert.equal(getSceneBackObjectForView(DEFAULT_SERVER_SCENE_MAP, "primary")?.id, "back-primary");
  assert.deepEqual(
    DEFAULT_SERVER_SCENE_MAP.characters.map((node) => node.id),
    ["anchor-ai1-primary", "anchor-ai2-primary"]
  );

  const normalized = normalizeServerSceneMap({
    objects: [{ id: "screen-primary", rect: { topPx: 360 } }],
    characters: [{ id: "anchor-ai2-primary", leftPx: 1240 }],
  });

  assert.equal(normalized.objects.find((node) => node.id === "screen-primary")?.rect.topPx, 360);
  assert.equal(normalized.characters.find((node) => node.id === "anchor-ai2-primary")?.leftPx, 1240);
});

test("rooms scene map ships with one object entrance and no character nodes", () => {
  assert.deepEqual(DEFAULT_ROOMS_SCENE_MAP.objects.map((node) => node.id), ["door-entrance"]);
  assert.deepEqual(DEFAULT_ROOMS_SCENE_MAP.characters, []);

  const normalized = normalizeRoomsSceneMap({
    objects: [{ id: "door-entrance", rect: { topPx: 188 } }],
  });

  assert.equal(normalized.objects.find((node) => node.id === "door-entrance")?.rect.topPx, 188);

  const room = buildSceneRoomDefinition("rooms", DEFAULT_ROOMS_SCENE_MAP);
  assert.equal(room.id, "rooms");
  assert.deepEqual(room.nodes.map((node) => node.kind), ["object"]);
});

test("scene editor renders unified section labels", () => {
  const editorSource = readFileSync("src/js/scene/debug/scene-debug-editor.ts", "utf8");
  assert.match(editorSource, /data-editor-action="room"/);
  assert.match(editorSource, /entrance-scene__editor-room-list/);
  assert.match(editorSource, /Objects/);
  assert.match(editorSource, /Characters/);
  assert.doesNotMatch(editorSource, /Interactives/);
  assert.doesNotMatch(editorSource, /Back Areas/);
  assert.doesNotMatch(editorSource, /Doors/);
  assert.doesNotMatch(editorSource, /Labels/);
  assert.equal(existsSync("src/js/pages/entrance/scene/scene-editor.ts"), false);
});

test("scene debug node list exposes only object and character nodes", () => {
  const entranceNodes = listSceneDebugNodes(DEFAULT_ENTRANCE_SCENE_MAP);
  const analyzeNodes = listSceneDebugNodes(DEFAULT_ANALYZE_SCENE_MAP);
  const roomsNodes = listSceneDebugNodes(DEFAULT_ROOMS_SCENE_MAP);

  assert.ok(entranceNodes.some((node) => node.kind === "object" && node.id === "door-analyze"));
  assert.ok(entranceNodes.some((node) => node.kind === "object" && node.id === "back-whisper"));
  assert.ok(entranceNodes.some((node) => node.kind === "character" && node.id === "anchor-assistant"));
  assert.ok(analyzeNodes.some((node) => node.kind === "object" && node.id === "screen-archive"));
  assert.ok(analyzeNodes.some((node) => node.kind === "object" && node.id === "back-archive"));
  assert.ok(analyzeNodes.some((node) => node.kind === "character" && node.id === "anchor-ai1-primary"));
  assert.ok(roomsNodes.some((node) => node.kind === "object" && node.id === "door-entrance"));
  assert.ok(roomsNodes.every((node) => node.kind !== "character"));
});
