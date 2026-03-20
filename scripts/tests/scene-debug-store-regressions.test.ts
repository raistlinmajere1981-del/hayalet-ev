import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("scene debug store defines room defaults through one generic layout config map", () => {
  const debugStoreSource = readFileSync("src/js/scene/debug/scene-debug-store.ts", "utf8");

  assert.match(
    debugStoreSource,
    /assistant:\s*\{[\s\S]*DEFAULT_ASSISTANT_SCENE_LAYOUT[\s\S]*storageKey/
  );
  assert.match(debugStoreSource, /server:\s*\{[\s\S]*DEFAULT_SERVER_SCENE_LAYOUT[\s\S]*storageKey/);
  assert.match(debugStoreSource, /rooms:\s*\{[\s\S]*DEFAULT_ROOMS_SCENE_LAYOUT[\s\S]*storageKey/);
  assert.match(
    debugStoreSource,
    /settings:\s*\{[\s\S]*DEFAULT_SETTINGS_SCENE_LAYOUT[\s\S]*storageKey/
  );
  assert.match(debugStoreSource, /cloneDefault\(\): SceneLayoutConfig/);
  assert.match(debugStoreSource, /serialize\(sceneLayout: SceneLayoutConfig\): string/);
  assert.match(debugStoreSource, /parseSceneLayoutDraft/);
  assert.doesNotMatch(debugStoreSource, /normalizer:/);
  assert.doesNotMatch(debugStoreSource, /normalize[A-Z]/);
  assert.equal(existsSync("src/js/scene/debug-store.ts"), false);
});

test("scene debug store owns draft persistence and reads storage keys from dedicated debug theme config", () => {
  const debugStoreSource = readFileSync("src/js/scene/debug/scene-debug-store.ts", "utf8");
  const layoutSource = readFileSync("src/js/scene/layout/index.ts", "utf8");
  const debugThemeSource = readFileSync("src/js/scene/debug/castle-scene-debug-theme.ts", "utf8");
  const debugThemeModuleSource = readFileSync("src/js/scene/debug/scene-debug-theme.ts", "utf8");
  const serializationSource = readFileSync("src/js/scene/layout/scene-layout-serialization.ts", "utf8");

  assert.match(debugStoreSource, /getSceneDebugDraftStorageKey/);
  assert.match(debugStoreSource, /from "\.\.\/layout\/index\.js"/);
  assert.match(debugThemeModuleSource, /CASTLE_SCENE_DEBUG_THEME/);
  assert.match(
    debugThemeSource,
    /editableRoomIds:\s*\["entrance",\s*"analyze",\s*"assistant",\s*"server",\s*"rooms",\s*"settings"\]/
  );
  assert.match(
    debugThemeSource,
    /draftStorageKeys:\s*\{[\s\S]*entrance:[\s\S]*server:[\s\S]*rooms:[\s\S]*settings:/
  );
  assert.match(layoutSource, /scene-layout-state\.js/);
  assert.match(layoutSource, /scene-layout-serialization\.js/);
  assert.match(serializationSource, /export function parseSceneLayoutDraft/);
  assert.match(serializationSource, /Array\.isArray\(value\["interactives"\]\)/);
  assert.match(serializationSource, /Array\.isArray\(value\["backs"\]\)/);
  assert.match(serializationSource, /Array\.isArray\(value\["characters"\]\)/);
  assert.doesNotMatch(serializationSource, /Array\.isArray\(parsed\.objects\)/);
  assert.equal(existsSync("src/js/pages/entrance/scene/scene-map.ts"), false);
  assert.equal(existsSync("src/assets/themes/castle/scene/debug.ts"), false);
});
