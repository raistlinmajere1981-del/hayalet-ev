import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSceneRoomDefinition,
  DEFAULT_ANALYZE_SCENE_MAP,
  DEFAULT_ASSISTANT_SCENE_MAP,
  DEFAULT_ENTRANCE_SCENE_MAP,
  DEFAULT_ROOMS_SCENE_MAP,
  DEFAULT_SERVER_SCENE_MAP,
  DEFAULT_SETTINGS_SCENE_MAP,
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

test("entrance scene map keeps all room click targets as interactives with one whisper back node", () => {
  assert.deepEqual(
    DEFAULT_ENTRANCE_SCENE_MAP.interactives.map((node) => node.id),
    ["door-analyze", "door-assistant", "door-server", "door-settings", "hatch-rooms", "board-whisper"]
  );
  assert.deepEqual(DEFAULT_ENTRANCE_SCENE_MAP.backs.map((node) => node.id), ["back-whisper"]);
  assert.equal(
    DEFAULT_ENTRANCE_SCENE_MAP.interactives.find((node) => node.id === "board-whisper")?.action.type,
    "whisper"
  );

  const normalized = normalizeEntranceSceneMap({
    interactives: [{ id: "board-whisper", rect: { leftPx: 408 } }],
    backs: [{ id: "back-whisper", rect: { widthPx: 140 } }],
  });

  assert.equal(
    normalized.interactives.find((node) => node.id === "board-whisper")?.rect.leftPx,
    408
  );
  assert.equal(normalized.backs.find((node) => node.id === "back-whisper")?.rect.widthPx, 140);
});

test("assistant scene map uses one interactive room exit, one interactive screen, and one back node", () => {
  assert.deepEqual(
    DEFAULT_ASSISTANT_SCENE_MAP.interactives.map((node) => node.id),
    ["door-entrance", "screen-primary"]
  );
  assert.deepEqual(DEFAULT_ASSISTANT_SCENE_MAP.backs.map((node) => node.id), ["back-primary"]);
  assert.deepEqual(DEFAULT_ASSISTANT_SCENE_MAP.characters.map((node) => node.id), ["anchor-ai0"]);

  const normalized = normalizeAssistantSceneMap({
    interactives: [{ id: "screen-primary", rect: { leftPx: 900 } }],
    characters: [{ id: "anchor-ai0", bottomPx: 144 }],
  });

  assert.equal(
    normalized.interactives.find((node) => node.id === "screen-primary")?.rect.leftPx,
    900
  );
  assert.equal(normalized.characters.find((node) => node.id === "anchor-ai0")?.bottomPx, 144);
});

test("analyze scene map keeps two scene views behind the shared back-node contract", () => {
  assert.deepEqual(
    DEFAULT_ANALYZE_SCENE_MAP.interactives.map((node) => node.id),
    ["door-entrance", "screen-primary", "screen-archive"]
  );
  assert.deepEqual(
    DEFAULT_ANALYZE_SCENE_MAP.backs.map((node) => node.id),
    ["back-table", "back-archive"]
  );

  const normalized = normalizeAnalyzeSceneMap({
    interactives: [{ id: "screen-archive", rect: { leftPx: 1280 } }],
    backs: [{ id: "back-archive", rect: { widthPx: 128 } }],
  });

  assert.equal(
    normalized.interactives.find((node) => node.id === "screen-archive")?.rect.leftPx,
    1280
  );
  assert.equal(normalized.backs.find((node) => node.id === "back-archive")?.rect.widthPx, 128);

  const room = buildSceneRoomDefinition("analyze", DEFAULT_ANALYZE_SCENE_MAP);
  assert.equal(room.id, "analyze");
  assert.ok(room.nodes.some((node) => node.kind === "interactive" && node.id === "screen-primary"));
  assert.ok(room.nodes.some((node) => node.kind === "back" && node.id === "back-table"));
  assert.ok(room.nodes.some((node) => node.kind === "character" && node.id === "anchor-ai1-primary"));
});

test("settings scene map defines one close interactive, panel interactives, one back node, and one user character", () => {
  assert.deepEqual(
    DEFAULT_SETTINGS_SCENE_MAP.interactives.map((node) => node.id),
    ["door-close", "panel-theme", "panel-accounts", "panel-backup", "panel-rooms", "panel-live-log"]
  );
  assert.equal(DEFAULT_SETTINGS_SCENE_MAP.interactives[0]?.action.type, "settings-scene-close");
  assert.deepEqual(DEFAULT_SETTINGS_SCENE_MAP.backs.map((node) => node.id), ["back-panel"]);
  assert.deepEqual(DEFAULT_SETTINGS_SCENE_MAP.characters.map((node) => node.id), ["anchor-user"]);

  const normalized = normalizeSettingsSceneMap({
    interactives: [{ id: "panel-live-log", rect: { leftPx: 1100 } }],
    backs: [{ id: "back-panel", rect: { widthPx: 132 } }],
    characters: [{ id: "anchor-user", bottomPx: 140 }],
  });

  assert.equal(
    normalized.interactives.find((node) => node.id === "panel-live-log")?.rect.leftPx,
    1100
  );
  assert.equal(normalized.backs.find((node) => node.id === "back-panel")?.rect.widthPx, 132);
  assert.equal(normalized.characters.find((node) => node.id === "anchor-user")?.bottomPx, 140);
});

test("server scene map stays on the same unified contract with one back node", () => {
  assert.deepEqual(
    DEFAULT_SERVER_SCENE_MAP.interactives.map((node) => node.id),
    ["door-entrance", "screen-primary"]
  );
  assert.deepEqual(DEFAULT_SERVER_SCENE_MAP.backs.map((node) => node.id), ["back-primary"]);
  assert.deepEqual(
    DEFAULT_SERVER_SCENE_MAP.characters.map((node) => node.id),
    ["anchor-ai1-primary", "anchor-ai2-primary"]
  );

  const normalized = normalizeServerSceneMap({
    interactives: [{ id: "screen-primary", rect: { topPx: 360 } }],
    characters: [{ id: "anchor-ai2-primary", leftPx: 1240 }],
  });

  assert.equal(
    normalized.interactives.find((node) => node.id === "screen-primary")?.rect.topPx,
    360
  );
  assert.equal(
    normalized.characters.find((node) => node.id === "anchor-ai2-primary")?.leftPx,
    1240
  );
});

test("rooms scene map ships with one interactive entrance and no back or character nodes", () => {
  assert.deepEqual(DEFAULT_ROOMS_SCENE_MAP.interactives.map((node) => node.id), ["door-entrance"]);
  assert.deepEqual(DEFAULT_ROOMS_SCENE_MAP.backs, []);
  assert.deepEqual(DEFAULT_ROOMS_SCENE_MAP.characters, []);

  const normalized = normalizeRoomsSceneMap({
    interactives: [{ id: "door-entrance", rect: { topPx: 188 } }],
  });

  assert.equal(normalized.interactives.find((node) => node.id === "door-entrance")?.rect.topPx, 188);

  const room = buildSceneRoomDefinition("rooms", DEFAULT_ROOMS_SCENE_MAP);
  assert.equal(room.id, "rooms");
  assert.deepEqual(room.nodes.map((node) => node.kind), ["interactive"]);
});

test("scene editor renders unified section labels", () => {
  const editorSource = readFileSync("src/js/scene/debug/scene-debug-editor.ts", "utf8");
  const editorFacadeSource = readFileSync("src/js/pages/entrance/scene/scene-editor.ts", "utf8");
  assert.match(editorSource, /data-editor-action="room"/);
  assert.match(editorSource, /entrance-scene__editor-room-list/);
  assert.match(editorSource, /Interactives/);
  assert.match(editorSource, /Back Areas/);
  assert.match(editorSource, /Characters/);
  assert.doesNotMatch(editorSource, /Doors/);
  assert.doesNotMatch(editorSource, /Labels/);
  assert.match(
    editorFacadeSource,
    /export \* from "\.\.\/\.\.\/\.\.\/scene\/debug\/scene-debug-editor\.js"/
  );
});

test("scene debug node list exposes only interactive, back, and character nodes", () => {
  const entranceNodes = listSceneDebugNodes(DEFAULT_ENTRANCE_SCENE_MAP);
  const analyzeNodes = listSceneDebugNodes(DEFAULT_ANALYZE_SCENE_MAP);
  const roomsNodes = listSceneDebugNodes(DEFAULT_ROOMS_SCENE_MAP);

  assert.ok(entranceNodes.some((node) => node.kind === "interactive" && node.id === "door-analyze"));
  assert.ok(entranceNodes.some((node) => node.kind === "back" && node.id === "back-whisper"));
  assert.ok(entranceNodes.some((node) => node.kind === "character" && node.id === "anchor-assistant"));
  assert.ok(analyzeNodes.some((node) => node.kind === "interactive" && node.id === "screen-archive"));
  assert.ok(analyzeNodes.some((node) => node.kind === "back" && node.id === "back-archive"));
  assert.ok(analyzeNodes.some((node) => node.kind === "character" && node.id === "anchor-ai1-primary"));
  assert.ok(roomsNodes.some((node) => node.kind === "interactive" && node.id === "door-entrance"));
  assert.ok(roomsNodes.every((node) => node.kind !== "back" && node.kind !== "character"));
});
