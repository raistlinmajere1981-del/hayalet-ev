import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_ASSISTANT_SCENE_MAP,
  normalizeAssistantSceneMap,
} from "../../src/js/pages/entrance/scene/scene-map.ts";
import { SCENE_DEBUG_ROOMS } from "../../src/js/scene/scene-debug-rooms.ts";

test("scene debug room registry includes entrance and assistant pages", () => {
  assert.deepEqual(
    SCENE_DEBUG_ROOMS.map((room) => room.id),
    ["entrance", "assistant"]
  );
});

test("assistant scene map defines entrance door, screen hotspot, and ai0 anchor", () => {
  assert.deepEqual(
    DEFAULT_ASSISTANT_SCENE_MAP.hotspots.map((hotspot) => hotspot.id),
    ["door-entrance", "screen-primary"]
  );
  assert.equal(DEFAULT_ASSISTANT_SCENE_MAP.hotspots[0]?.action.type, "navigate");
  assert.equal(DEFAULT_ASSISTANT_SCENE_MAP.hotspots[1]?.action.type, "screen");
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

test("scene editor renders room switcher controls", () => {
  const editorSource = readFileSync("src/js/pages/entrance/scene/scene-editor.ts", "utf8");
  assert.match(editorSource, /data-editor-action="room"/);
  assert.match(editorSource, /entrance-scene__editor-room-list/);
});
