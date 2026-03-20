import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("scene editor store keys drafts by active theme and writes back to canonical theme map sources", () => {
  const debugStoreSource = readFileSync("src/js/scene-editor/scene-editor-store.ts", "utf8");
  const layoutRegistrySource = readFileSync("src/js/scene-system/scene-layout-registry.ts", "utf8");
  const serializationSource = readFileSync("src/js/scene/layout/scene-layout-serialization.ts", "utf8");
  const clickableThemeSource = readFileSync("src/js/scene-system/scene-clickable-theme.ts", "utf8");

  assert.match(debugStoreSource, /scene-editor:\$\{getSceneThemeId\(\)\}:\$\{roomId\}:draft:/);
  assert.match(debugStoreSource, /clickable-defaults:draft/);
  assert.match(debugStoreSource, /getSourcePath\(\): string/);
  assert.match(debugStoreSource, /cloneDefault\(\): SceneLayoutConfig/);
  assert.match(debugStoreSource, /cloneDefault\(\): SceneClickableThemeDefinition/);
  assert.match(debugStoreSource, /serialize\(sceneLayout: SceneLayoutConfig\): string/);
  assert.match(debugStoreSource, /saveSource\(sceneLayout: SceneLayoutConfig\): Promise<boolean>/);
  assert.match(debugStoreSource, /createSceneDebugThemeStore/);
  assert.match(debugStoreSource, /serializeSceneClickableThemeSource/);
  assert.match(debugStoreSource, /FileManager\.writeFileAtomic/);
  assert.match(debugStoreSource, /from "\.\.\/scene\/layout\/index\.js"/);
  assert.match(debugStoreSource, /from "\.\.\/scene-system\/scene-layout-registry\.js"/);
  assert.match(
    layoutRegistrySource,
    /shared\/themes\/\$\{getSceneThemeId\(\)\}\/maps\/\$\{roomId\}\.scene\.json/
  );
  assert.match(
    layoutRegistrySource,
    /shared\/themes\/\$\{getSceneThemeId\(\)\}\/scene-clickable-defaults\.ts/
  );
  assert.match(serializationSource, /export function parseSceneLayoutDraft/);
  assert.match(clickableThemeSource, /export function parseSceneClickableThemeDraft/);
  assert.doesNotMatch(debugStoreSource, /draftStorageKeys/);
  assert.equal(existsSync("src/js/scene/debug-store.ts"), false);
  assert.equal(existsSync("src/js/scene/debug"), false);
});

test("scene layout defaults now resolve from shared theme json maps instead of inlined room builders", () => {
  const layoutStateSource = readFileSync("src/js/scene/layout/scene-layout-state.ts", "utf8");
  const layoutSource = readFileSync("src/js/scene/layout/index.ts", "utf8");
  const layoutRegistrySource = readFileSync("src/js/scene-system/scene-layout-registry.ts", "utf8");

  assert.match(layoutStateSource, /getSceneRoomLayout/);
  assert.match(layoutStateSource, /getSceneRoomLayoutConfig/);
  assert.doesNotMatch(layoutStateSource, /@theme-source\/castle\/maps\/analyze\.scene\.json/);
  assert.doesNotMatch(layoutStateSource, /DEFAULT_SCENE_LAYOUTS/);
  assert.doesNotMatch(layoutStateSource, /draftStorageKeys/);
  assert.match(layoutSource, /scene-layout-state\.js/);
  assert.match(layoutSource, /scene-layout-serialization\.js/);
  assert.match(layoutRegistrySource, /CASTLE_SCENE_LAYOUTS/);
  assert.match(layoutRegistrySource, /return ACTIVE_SCENE_LAYOUTS\[roomId\];/);
  assert.equal(existsSync("src/js/pages/entrance/scene/scene-map.ts"), false);
  assert.equal(existsSync("src/assets/themes/castle/scene/debug.ts"), false);
});
