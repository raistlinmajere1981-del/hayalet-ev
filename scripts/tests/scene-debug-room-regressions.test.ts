import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSceneRoomDefinition,
  DEFAULT_ENTRANCE_SCENE_MAP,
  DEFAULT_ANALYZE_SCENE_MAP,
  DEFAULT_ASSISTANT_SCENE_MAP,
  DEFAULT_SERVER_SCENE_MAP,
  DEFAULT_SETTINGS_SCENE_MAP,
  getSceneNodeKindForHotspot,
  listSceneDebugNodes,
  normalizeAnalyzeSceneMap,
  normalizeEntranceSceneMap,
  normalizeAssistantSceneMap,
  normalizeServerSceneMap,
  normalizeSettingsSceneMap,
} from "../../src/js/pages/entrance/scene/scene-map.ts";
import { SCENE_DEBUG_ROOMS } from "../../src/js/scene/scene-debug-rooms.ts";

test("scene debug room registry includes all scene rooms", () => {
  assert.deepEqual(
    SCENE_DEBUG_ROOMS.map((room) => room.id),
    ["entrance", "analyze", "assistant", "server", "settings"]
  );
});

test("entrance scene map keeps navigation points as labeled door nodes", () => {
  assert.deepEqual(
    DEFAULT_ENTRANCE_SCENE_MAP.hotspots.map((hotspot) => hotspot.id),
    ["door-analyze", "door-assistant", "door-server", "door-settings"]
  );
  assert.ok(DEFAULT_ENTRANCE_SCENE_MAP.hotspots.every((hotspot) => hotspot.showLabel));
  assert.ok(
    DEFAULT_ENTRANCE_SCENE_MAP.hotspots.every(
      (hotspot) => getSceneNodeKindForHotspot(hotspot) === "door"
    )
  );

  const normalized = normalizeEntranceSceneMap({
    hotspots: [{ id: "door-server", leftPx: 1400 }],
  });

  assert.equal(normalized.hotspots.find((hotspot) => hotspot.id === "door-server")?.leftPx, 1400);
});

test("assistant scene map keeps all click targets as unlabeled objects", () => {
  assert.deepEqual(
    DEFAULT_ASSISTANT_SCENE_MAP.hotspots.map((hotspot) => hotspot.id),
    ["door-entrance", "screen-primary"]
  );
  assert.ok(
    DEFAULT_ASSISTANT_SCENE_MAP.hotspots.every(
      (hotspot) => getSceneNodeKindForHotspot(hotspot) === "object" && hotspot.showLabel === false
    )
  );
  assert.deepEqual(
    DEFAULT_ASSISTANT_SCENE_MAP.characterAnchors.map((anchor) => anchor.id),
    ["anchor-ai0"]
  );

  const normalized = normalizeAssistantSceneMap({
    hotspots: [{ id: "screen-primary", leftPx: 900 }],
    characterAnchors: [{ id: "anchor-ai0", bottomPx: 144 }],
  });

  assert.equal(normalized.hotspots.find((hotspot) => hotspot.id === "screen-primary")?.leftPx, 900);
  assert.equal(
    normalized.characterAnchors.find((anchor) => anchor.id === "anchor-ai0")?.bottomPx,
    144
  );
});

test("analyze scene map builds object-only room interactions plus archive object and characters", () => {
  assert.deepEqual(
    DEFAULT_ANALYZE_SCENE_MAP.hotspots.map((hotspot) => hotspot.id),
    ["door-entrance", "screen-primary", "screen-archive"]
  );
  assert.ok(
    DEFAULT_ANALYZE_SCENE_MAP.hotspots.every(
      (hotspot) => getSceneNodeKindForHotspot(hotspot) === "object" && hotspot.showLabel === false
    )
  );

  const normalized = normalizeAnalyzeSceneMap({
    hotspots: [{ id: "screen-archive", leftPx: 1280 }],
  });

  assert.equal(
    normalized.hotspots.find((hotspot) => hotspot.id === "screen-archive")?.leftPx,
    1280
  );

  const room = buildSceneRoomDefinition("analyze", DEFAULT_ANALYZE_SCENE_MAP);

  assert.equal(room.id, "analyze");
  assert.equal(room.page, "analyze");
  assert.deepEqual(
    room.nodes.filter((node) => node.kind === "object").map((node) => node.id),
    ["door-entrance", "screen-primary", "screen-archive"]
  );
  assert.ok(room.nodes.every((node) => node.kind !== "door"));
  assert.ok(room.nodes.every((node) => node.kind !== "label"));
  assert.ok(room.nodes.some((node) => node.kind === "character"));
});

test("settings scene map defines object-only close and panel hotspots plus user anchor", () => {
  assert.deepEqual(
    DEFAULT_SETTINGS_SCENE_MAP.hotspots.map((hotspot) => hotspot.id),
    ["door-close", "panel-theme", "panel-accounts", "panel-backup", "panel-rooms", "panel-live-log"]
  );
  assert.equal(DEFAULT_SETTINGS_SCENE_MAP.hotspots[0]?.action.type, "settings-scene-close");
  assert.ok(
    DEFAULT_SETTINGS_SCENE_MAP.hotspots.every(
      (hotspot) => getSceneNodeKindForHotspot(hotspot) === "object" && hotspot.showLabel === false
    )
  );
  assert.deepEqual(
    DEFAULT_SETTINGS_SCENE_MAP.characterAnchors.map((anchor) => anchor.id),
    ["anchor-user"]
  );

  const normalized = normalizeSettingsSceneMap({
    hotspots: [{ id: "panel-live-log", leftPx: 1100 }],
    characterAnchors: [{ id: "anchor-user", bottomPx: 140 }],
  });

  assert.equal(
    normalized.hotspots.find((hotspot) => hotspot.id === "panel-live-log")?.leftPx,
    1100
  );
  assert.equal(
    normalized.characterAnchors.find((anchor) => anchor.id === "anchor-user")?.bottomPx,
    140
  );
});

test("server scene map is available through the same debug contract", () => {
  assert.deepEqual(
    DEFAULT_SERVER_SCENE_MAP.hotspots.map((hotspot) => hotspot.id),
    ["door-entrance", "screen-primary"]
  );
  assert.ok(
    DEFAULT_SERVER_SCENE_MAP.hotspots.every(
      (hotspot) => getSceneNodeKindForHotspot(hotspot) === "object" && hotspot.showLabel === false
    )
  );
  assert.deepEqual(
    DEFAULT_SERVER_SCENE_MAP.characterAnchors.map((anchor) => anchor.id),
    ["anchor-ai1-primary", "anchor-ai2-primary"]
  );

  const normalized = normalizeServerSceneMap({
    hotspots: [{ id: "screen-primary", topPx: 360 }],
    characterAnchors: [{ id: "anchor-ai2-primary", leftPx: 1240 }],
  });

  assert.equal(normalized.hotspots.find((hotspot) => hotspot.id === "screen-primary")?.topPx, 360);
  assert.equal(
    normalized.characterAnchors.find((anchor) => anchor.id === "anchor-ai2-primary")?.leftPx,
    1240
  );
});

test("scene editor renders room switcher controls", () => {
  const editorSource = readFileSync("src/js/pages/entrance/scene/scene-editor.ts", "utf8");
  assert.match(editorSource, /data-editor-action="room"/);
  assert.match(editorSource, /entrance-scene__editor-room-list/);
  assert.match(editorSource, /Doors/);
  assert.match(editorSource, /Objects/);
  assert.match(editorSource, /Labels/);
  assert.match(editorSource, /Characters/);
});

test("scene debug node list keeps labels only for entrance door nodes", () => {
  const entranceNodes = listSceneDebugNodes(DEFAULT_ENTRANCE_SCENE_MAP);
  const nodes = listSceneDebugNodes(DEFAULT_ANALYZE_SCENE_MAP);

  assert.ok(entranceNodes.some((node) => node.kind === "door" && node.id === "door-analyze"));
  assert.ok(entranceNodes.some((node) => node.kind === "label" && node.id === "door-server-label"));
  assert.ok(nodes.some((node) => node.kind === "object" && node.id === "door-entrance"));
  assert.ok(nodes.some((node) => node.kind === "object" && node.id === "screen-primary"));
  assert.ok(nodes.some((node) => node.kind === "object" && node.id === "screen-archive"));
  assert.ok(nodes.every((node) => node.kind !== "label"));
  assert.ok(nodes.some((node) => node.kind === "character" && node.id === "anchor-ai1-primary"));
});
