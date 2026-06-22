import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

import { validateRoomManifest } from "../../src/types/rooms.ts";
import { loadWorkspaceScriptForVm } from "./helpers/room-workspace-script.ts";

describe("Tavla package and manifest", () => {
  void test("game-room workspace keeps the required Tavla package files", () => {
    requiredFiles.forEach((filePath) => {
      assert.equal(existsSync(filePath), true, filePath);
    });
  });
  void test("game-room manifest validates with the Tavla-first room contract", () => {
    const manifest = JSON.parse(readFileSync("rooms/game-room/manifest.json", "utf8")) as Record<
      string,
      unknown
    >;
    const validation = validateRoomManifest(manifest);

    assert.equal(validation.valid, true);
    assert.equal(validation.manifest?.id, "game-room");
    assert.equal(validation.manifest.defaultFeatureId, "backgammon");
    assert.deepEqual(
      validation.manifest.features.map((feature) => feature.id),
      ["backgammon", "team-tetris", "fate-knots"]
    );
    assert.equal(validation.manifest.runtime.uiEntry, "ui/index.html");
    assert.equal(validation.manifest.runtime.hostEntry, "host/index.js");
    assert.equal(validation.manifest.scene?.characterRosterPreset, "connected-plus-user");
    assert.equal(validation.manifest.scene.characters?.length, 3);
    assert.equal(validation.manifest.scene.chrome?.pageShellVariant, "immersive-stage");
  });
});
