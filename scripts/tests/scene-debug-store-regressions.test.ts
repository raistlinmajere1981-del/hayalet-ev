import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("scene editor store keys drafts by active theme and writes back to canonical theme map sources", () => {
  const debugStoreSource = readFileSync("src/js/scene-editor/scene-editor-store.ts", "utf8");
  const registrySource = readFileSync("src/js/scene-system/scene-theme-registry.ts", "utf8");
  const serializationSource = readFileSync("src/js/scene/layout/scene-layout-serialization.ts", "utf8");

  assert.match(debugStoreSource, /scene-editor:\$\{getSceneThemeId\(\)\}:\$\{roomId\}:draft:/);
  assert.match(debugStoreSource, /getSourcePath\(\): string/);
  assert.match(debugStoreSource, /cloneDefault\(\): SceneLayoutConfig/);
  assert.match(debugStoreSource, /serialize\(sceneLayout: SceneLayoutConfig\): string/);
  assert.match(debugStoreSource, /saveSource\(sceneLayout: SceneLayoutConfig\): Promise<boolean>/);
  assert.match(debugStoreSource, /FileManager\.writeFileAtomic/);
  assert.match(debugStoreSource, /from "\.\.\/scene\/layout\/index\.js"/);
  assert.match(debugStoreSource, /from "\.\.\/scene-system\/index\.js"/);
  assert.match(
    registrySource,
    /shared\/themes\/\$\{getSceneThemeId\(\)\}\/maps\/\$\{roomId\}\.scene\.json/
  );
  assert.match(serializationSource, /export function parseSceneLayoutDraft/);
  assert.doesNotMatch(debugStoreSource, /draftStorageKeys/);
  assert.equal(existsSync("src/js/scene/debug-store.ts"), false);
  assert.equal(existsSync("src/js/scene/debug"), false);
});

test("scene layout defaults now resolve from shared theme json maps instead of inlined room builders", () => {
  const layoutStateSource = readFileSync("src/js/scene/layout/scene-layout-state.ts", "utf8");
  const layoutSource = readFileSync("src/js/scene/layout/index.ts", "utf8");

  assert.match(layoutStateSource, /@theme-source\/castle\/maps\/analyze\.scene\.json/);
  assert.match(layoutStateSource, /DEFAULT_SCENE_LAYOUTS/);
  assert.doesNotMatch(layoutStateSource, /draftStorageKeys/);
  assert.match(layoutSource, /scene-layout-state\.js/);
  assert.match(layoutSource, /scene-layout-serialization\.js/);
  assert.equal(existsSync("src/js/pages/entrance/scene/scene-map.ts"), false);
  assert.equal(existsSync("src/assets/themes/castle/scene/debug.ts"), false);
});
