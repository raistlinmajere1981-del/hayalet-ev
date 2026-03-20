import assert from "node:assert/strict";
import test from "node:test";

import { SCENE_NODE_KINDS, SCENE_ROOM_IDS } from "../../src/js/scene/schema.ts";
import {
  buildSceneNodesFromLayout,
  buildSceneRoomDefinition,
  DEFAULT_ASSISTANT_SCENE_LAYOUT,
  DEFAULT_ENTRANCE_SCENE_LAYOUT,
  DEFAULT_ROOMS_SCENE_LAYOUT,
  DEFAULT_SERVER_SCENE_LAYOUT,
} from "../../src/js/scene/layout/index.ts";

test("scene schema exposes the canonical room and node registries", () => {
  assert.deepEqual(SCENE_ROOM_IDS, ["entrance", "analyze", "assistant", "server", "rooms", "settings"]);
  assert.deepEqual(SCENE_NODE_KINDS, ["interactive", "back", "character"]);
});

test("entrance scene layout can be represented through the shared node schema", () => {
  const nodes = buildSceneNodesFromLayout(DEFAULT_ENTRANCE_SCENE_LAYOUT);

  assert.ok(nodes.some((node) => node.kind === "interactive" && node.id === "door-analyze"));
  assert.ok(nodes.some((node) => node.kind === "interactive" && node.id === "door-settings"));
  assert.ok(nodes.some((node) => node.kind === "interactive" && node.id === "hatch-rooms"));
  assert.ok(
    nodes.some(
      (node) =>
        node.kind === "interactive" && node.id === "board-whisper" && node.action.type === "whisper"
    )
  );
  assert.ok(nodes.some((node) => node.kind === "back" && node.id === "back-whisper"));
  assert.ok(nodes.some((node) => node.kind === "character" && node.id === "anchor-assistant"));
});

test("assistant room definition keeps room metadata alongside shared scene nodes", () => {
  const room = buildSceneRoomDefinition("assistant", DEFAULT_ASSISTANT_SCENE_LAYOUT);

  assert.equal(room.referenceSize.width, 1920);
  assert.equal(room.referenceSize.height, 1080);
  assert.ok(room.nodes.some((node) => node.kind === "interactive" && node.id === "door-entrance"));
  assert.ok(room.nodes.some((node) => node.kind === "interactive" && node.id === "screen-primary"));
  assert.ok(room.nodes.some((node) => node.kind === "back" && node.id === "back-primary"));
  assert.ok(room.nodes.some((node) => node.kind === "character" && node.id === "anchor-ai0"));
  assert.ok(room.nodes.every((node) => SCENE_NODE_KINDS.includes(node.kind)));
});

test("server room definition participates in the shared scene schema", () => {
  const room = buildSceneRoomDefinition("server", DEFAULT_SERVER_SCENE_LAYOUT);

  assert.equal(room.referenceSize.width, 1920);
  assert.equal(room.referenceSize.height, 1080);
  assert.ok(room.nodes.some((node) => node.kind === "interactive" && node.id === "door-entrance"));
  assert.ok(room.nodes.some((node) => node.kind === "interactive" && node.id === "screen-primary"));
  assert.ok(room.nodes.some((node) => node.kind === "back" && node.id === "back-primary"));
  assert.ok(room.nodes.some((node) => node.kind === "character" && node.id === "anchor-ai1-primary"));
  assert.ok(room.nodes.every((node) => SCENE_NODE_KINDS.includes(node.kind)));
});

test("rooms room definition keeps a single interactive entrance link", () => {
  const room = buildSceneRoomDefinition("rooms", DEFAULT_ROOMS_SCENE_LAYOUT);

  assert.equal(room.referenceSize.width, 1920);
  assert.equal(room.referenceSize.height, 1080);
  assert.deepEqual(room.nodes.map((node) => node.kind), ["interactive"]);
  assert.ok(room.nodes.some((node) => node.kind === "interactive" && node.id === "door-entrance"));
});
