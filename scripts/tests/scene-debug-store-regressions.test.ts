import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("scene debug store defines assistant, server, and settings defaults through one generic config map", () => {
  const debugStoreSource = readFileSync("src/js/scene/debug-store.ts", "utf8");

  assert.match(
    debugStoreSource,
    /assistant:\s*\{[\s\S]*DEFAULT_ASSISTANT_SCENE_MAP[\s\S]*normalizeAssistantSceneMap/
  );
  assert.match(
    debugStoreSource,
    /server:\s*\{[\s\S]*DEFAULT_SERVER_SCENE_MAP[\s\S]*normalizeServerSceneMap/
  );
  assert.match(
    debugStoreSource,
    /settings:\s*\{[\s\S]*DEFAULT_SETTINGS_SCENE_MAP[\s\S]*normalizeSettingsSceneMap/
  );
  assert.match(debugStoreSource, /cloneDefault\(\): EntranceSceneMap/);
  assert.match(debugStoreSource, /serialize\(sceneMap: EntranceSceneMap\): string/);
});

test("scene debug store owns draft persistence and reads storage keys from the theme pack", () => {
  const debugStoreSource = readFileSync("src/js/scene/debug-store.ts", "utf8");
  const sceneMapSource = readFileSync("src/js/pages/entrance/scene/scene-map.ts", "utf8");
  const manifestSource = readFileSync("src/assets/themes/castle/scene/manifest.ts", "utf8");

  assert.match(debugStoreSource, /getSceneDebugDraftStorageKey/);
  assert.match(
    manifestSource,
    /editableRoomIds:\s*\["entrance",\s*"analyze",\s*"assistant",\s*"server",\s*"settings"\]/
  );
  assert.match(
    manifestSource,
    /draftStorageKeys:\s*\{[\s\S]*entrance:[\s\S]*server:[\s\S]*settings:/
  );
  assert.doesNotMatch(sceneMapSource, /loadEntranceSceneMapDraft/);
  assert.doesNotMatch(sceneMapSource, /saveEntranceSceneMapDraft/);
  assert.doesNotMatch(sceneMapSource, /clearEntranceSceneMapDraft/);
  assert.doesNotMatch(sceneMapSource, /scene-map-draft-v1/);
});
