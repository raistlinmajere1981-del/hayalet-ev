import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSceneRoomDefinition,
  cloneSceneLayout,
  DEFAULT_ANALYZE_SCENE_LAYOUT,
  DEFAULT_ASSISTANT_SCENE_LAYOUT,
  DEFAULT_ENTRANCE_SCENE_LAYOUT,
  DEFAULT_ROOMS_SCENE_LAYOUT,
  DEFAULT_SERVER_SCENE_LAYOUT,
  DEFAULT_SETTINGS_SCENE_LAYOUT,
  getSceneBackNodeForView,
  listSceneDebugNodes,
} from "../../src/js/scene/layout/index.ts";
import { SCENE_DEBUG_ROOMS } from "../../src/js/scene/debug/index.ts";

test("scene debug room registry includes all unified scene rooms", () => {
  assert.deepEqual(
    SCENE_DEBUG_ROOMS.map((room) => room.id),
    ["entrance", "analyze", "assistant", "server", "rooms", "settings"]
  );
});

test("entrance scene layout keeps room targets and whisper return in one layout registry", () => {
  assert.deepEqual(
    DEFAULT_ENTRANCE_SCENE_LAYOUT.interactives.map((node) => node.id),
    ["door-analyze", "door-assistant", "door-server", "door-settings", "hatch-rooms", "board-whisper"]
  );
  assert.equal(getSceneBackNodeForView(DEFAULT_ENTRANCE_SCENE_LAYOUT, "whisper")?.id, "back-whisper");
  assert.equal(
    DEFAULT_ENTRANCE_SCENE_LAYOUT.interactives.find((node) => node.id === "board-whisper")?.action.type,
    "whisper"
  );

  const cloned = cloneSceneLayout(DEFAULT_ENTRANCE_SCENE_LAYOUT);
  cloned.interactives.find((node) => node.id === "board-whisper")!.rect.leftPx = 408;
  cloned.backs.find((node) => node.id === "back-whisper")!.rect.widthPx = 140;

  assert.equal(
    DEFAULT_ENTRANCE_SCENE_LAYOUT.interactives.find((node) => node.id === "board-whisper")?.rect.leftPx,
    362
  );
  assert.equal(cloned.interactives.find((node) => node.id === "board-whisper")?.rect.leftPx, 408);
  assert.equal(cloned.backs.find((node) => node.id === "back-whisper")?.rect.widthPx, 140);
});

test("assistant scene layout uses interactives plus one view-scoped back node", () => {
  assert.deepEqual(
    DEFAULT_ASSISTANT_SCENE_LAYOUT.interactives.map((node) => node.id),
    ["door-entrance", "screen-primary"]
  );
  assert.equal(getSceneBackNodeForView(DEFAULT_ASSISTANT_SCENE_LAYOUT, "primary")?.id, "back-primary");
  assert.deepEqual(DEFAULT_ASSISTANT_SCENE_LAYOUT.characters.map((node) => node.id), ["anchor-ai0"]);
});

test("analyze scene layout keeps table and archive returns on the shared contract", () => {
  assert.deepEqual(
    DEFAULT_ANALYZE_SCENE_LAYOUT.interactives.map((node) => node.id),
    ["door-entrance", "screen-primary", "screen-archive"]
  );
  assert.equal(getSceneBackNodeForView(DEFAULT_ANALYZE_SCENE_LAYOUT, "table")?.id, "back-table");
  assert.equal(getSceneBackNodeForView(DEFAULT_ANALYZE_SCENE_LAYOUT, "archive")?.id, "back-archive");

  const room = buildSceneRoomDefinition("analyze", DEFAULT_ANALYZE_SCENE_LAYOUT);
  assert.equal(room.id, "analyze");
  assert.ok(room.nodes.some((node) => node.kind === "interactive" && node.id === "screen-primary"));
  assert.ok(room.nodes.some((node) => node.kind === "back" && node.id === "back-table"));
  assert.ok(room.nodes.some((node) => node.kind === "character" && node.id === "anchor-ai1-primary"));
});

test("settings scene layout defines close, panels, one back, and one user character", () => {
  assert.deepEqual(
    DEFAULT_SETTINGS_SCENE_LAYOUT.interactives.map((node) => node.id),
    ["door-close", "panel-theme", "panel-accounts", "panel-backup", "panel-rooms", "panel-live-log"]
  );
  assert.equal(DEFAULT_SETTINGS_SCENE_LAYOUT.interactives[0]?.action.type, "settings-scene-close");
  assert.equal(getSceneBackNodeForView(DEFAULT_SETTINGS_SCENE_LAYOUT, "panel")?.id, "back-panel");
  assert.deepEqual(DEFAULT_SETTINGS_SCENE_LAYOUT.characters.map((node) => node.id), ["anchor-user"]);
});

test("server scene layout stays on the same contract with one back node", () => {
  assert.deepEqual(
    DEFAULT_SERVER_SCENE_LAYOUT.interactives.map((node) => node.id),
    ["door-entrance", "screen-primary"]
  );
  assert.equal(getSceneBackNodeForView(DEFAULT_SERVER_SCENE_LAYOUT, "primary")?.id, "back-primary");
  assert.deepEqual(
    DEFAULT_SERVER_SCENE_LAYOUT.characters.map((node) => node.id),
    ["anchor-ai1-primary", "anchor-ai2-primary"]
  );
});

test("rooms scene layout ships with one interactive entrance and no extra nodes", () => {
  assert.deepEqual(DEFAULT_ROOMS_SCENE_LAYOUT.interactives.map((node) => node.id), ["door-entrance"]);
  assert.deepEqual(DEFAULT_ROOMS_SCENE_LAYOUT.backs, []);
  assert.deepEqual(DEFAULT_ROOMS_SCENE_LAYOUT.characters, []);

  const room = buildSceneRoomDefinition("rooms", DEFAULT_ROOMS_SCENE_LAYOUT);
  assert.equal(room.id, "rooms");
  assert.deepEqual(room.nodes.map((node) => node.kind), ["interactive"]);
});

test("scene editor renders unified section labels", () => {
  const editorSource = readFileSync("src/js/scene/debug/scene-debug-editor.ts", "utf8");
  assert.match(editorSource, /data-editor-action="room"/);
  assert.match(editorSource, /entrance-scene__editor-room-list/);
  assert.match(editorSource, /Interactives/);
  assert.match(editorSource, /Backs/);
  assert.match(editorSource, /Characters/);
  assert.doesNotMatch(editorSource, /Objects/);
  assert.doesNotMatch(editorSource, /Interactives\/Backs/);
  assert.equal(existsSync("src/js/pages/entrance/scene/scene-editor.ts"), false);
});

test("scene debug node list exposes interactive, back, and character nodes", () => {
  const entranceNodes = listSceneDebugNodes(DEFAULT_ENTRANCE_SCENE_LAYOUT);
  const analyzeNodes = listSceneDebugNodes(DEFAULT_ANALYZE_SCENE_LAYOUT);
  const roomsNodes = listSceneDebugNodes(DEFAULT_ROOMS_SCENE_LAYOUT);

  assert.ok(entranceNodes.some((node) => node.kind === "interactive" && node.id === "door-analyze"));
  assert.ok(entranceNodes.some((node) => node.kind === "back" && node.id === "back-whisper"));
  assert.ok(entranceNodes.some((node) => node.kind === "character" && node.id === "anchor-assistant"));
  assert.ok(analyzeNodes.some((node) => node.kind === "interactive" && node.id === "screen-archive"));
  assert.ok(analyzeNodes.some((node) => node.kind === "back" && node.id === "back-archive"));
  assert.ok(analyzeNodes.some((node) => node.kind === "character" && node.id === "anchor-ai1-primary"));
  assert.ok(roomsNodes.some((node) => node.kind === "interactive" && node.id === "door-entrance"));
  assert.ok(roomsNodes.every((node) => node.kind !== "character"));
});
