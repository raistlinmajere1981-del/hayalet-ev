import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("castle scene theme pack centralizes room art and unified debug defaults", () => {
  const manifestSource = readFileSync("src/assets/themes/castle/scene/manifest.ts", "utf8");
  const debugThemeSource = readFileSync("src/assets/themes/castle/scene/debug.ts", "utf8");
  const assetsSource = readFileSync("src/js/scene/theme/scene-theme-assets.ts", "utf8");
  const loadingSource = readFileSync("src/js/scene/theme/scene-loading-theme.ts", "utf8");
  const characterSource = readFileSync("src/js/scene/theme/scene-character-theme.ts", "utf8");
  const registrySource = readFileSync("src/js/scene/theme/scene-theme-registry.ts", "utf8");
  const themePackSource = readFileSync("src/js/scene/theme/scene-theme-pack.ts", "utf8");
  const themePackFacadeSource = readFileSync("src/js/scene/theme-pack.ts", "utf8");

  assert.match(manifestSource, /themeId:\s*"castle"/);
  assert.match(manifestSource, /loading:\s*\{[\s\S]*frames:\s*\[/);
  assert.match(manifestSource, /entrance:\s*\{[\s\S]*whisper:/);
  assert.match(manifestSource, /analyze:\s*\{[\s\S]*archive:[\s\S]*table:/);
  assert.match(manifestSource, /assistant:\s*\{[\s\S]*primary:/);
  assert.match(manifestSource, /server:\s*\{[\s\S]*primary:/);
  assert.match(manifestSource, /rooms:\s*\{[\s\S]*backgroundSrc:/);
  assert.match(manifestSource, /settings:\s*\{[\s\S]*"live-log":/);
  assert.doesNotMatch(manifestSource, /backZones/);
  assert.doesNotMatch(manifestSource, /draftStorageKeys/);
  assert.match(
    debugThemeSource,
    /editableRoomIds:\s*\["entrance",\s*"analyze",\s*"assistant",\s*"server",\s*"rooms",\s*"settings"\]/
  );
  assert.match(debugThemeSource, /draftStorageKeys:\s*\{[\s\S]*entrance:[\s\S]*settings:/);
  assert.match(registrySource, /export const ACTIVE_SCENE_THEME_PACK/);
  assert.match(loadingSource, /export function getSceneLoadingTheme/);
  assert.match(characterSource, /export function getSceneCharacterRoleConfig/);
  assert.match(assetsSource, /export function getSceneRoomBackgroundSrc/);
  assert.match(assetsSource, /export function getSceneRoomViewPanelArtSrc/);
  assert.match(assetsSource, /export function getSceneRoomPanelSrc/);
  assert.match(themePackSource, /getSceneRoomBackgroundSrc/);
  assert.match(themePackSource, /scene-loading-theme\.js/);
  assert.match(themePackSource, /scene-theme-assets\.js/);
  assert.doesNotMatch(themePackSource, /getSceneDebugDraftStorageKey/);
  assert.match(themePackFacadeSource, /export \* from "\.\/theme\/scene-theme-pack\.js"/);
});

test("scene runtime files resolve theme assets and use generated back layers instead of the legacy helper", () => {
  const backLayerSource = readFileSync("src/js/scene/renderers/back-layer.ts", "utf8");
  const assistantSource = readFileSync("src/js/pages/assistant/assistant.ts", "utf8");
  const analyzeSource = readFileSync("src/js/pages/analyze.ts", "utf8");
  const serverSource = readFileSync("src/js/pages/server.ts", "utf8");
  const settingsSource = readFileSync("src/js/pages/settings/controller.ts", "utf8");
  const entranceSource = readFileSync("src/js/pages/entrance/scene/scene-controller.ts", "utf8");
  const splashSource = readFileSync("src/js/ui/splash-screen.ts", "utf8");
  const htmlSource = readFileSync("src/index.html", "utf8");

  assert.match(backLayerSource, /scene-back-zone--single/);
  assert.match(backLayerSource, /getSceneHotspotLabelFontFamily/);
  assert.equal(existsSync("src/js/scene/back-zone.ts"), false);
  assert.doesNotMatch(assistantSource, /SCENE_THEME_CONFIG/);
  assert.doesNotMatch(analyzeSource, /SCENE_THEME_CONFIG/);
  assert.doesNotMatch(serverSource, /SCENE_THEME_CONFIG/);
  assert.doesNotMatch(settingsSource, /SCENE_THEME_CONFIG/);
  assert.doesNotMatch(entranceSource, /SCENE_THEME_CONFIG/);
  assert.doesNotMatch(splashSource, /SCENE_THEME_CONFIG/);
  assert.match(assistantSource, /scene\/theme\/scene-theme-assets\.js/);
  assert.match(analyzeSource, /scene\/theme\/scene-theme-assets\.js/);
  assert.match(serverSource, /scene\/theme\/scene-theme-assets\.js/);
  assert.match(settingsSource, /scene\/theme\/scene-theme-assets\.js/);
  assert.match(entranceSource, /scene\/theme\/scene-theme-assets\.js/);
  assert.match(splashSource, /scene\/theme\/scene-loading-theme\.js/);
  assert.doesNotMatch(htmlSource, /loading_door_0[1-4]\.webp/);
});
