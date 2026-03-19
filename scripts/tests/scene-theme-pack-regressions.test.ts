import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("castle scene theme pack centralizes room art and unified debug defaults", () => {
  const manifestSource = readFileSync("src/assets/themes/castle/scene/manifest.ts", "utf8");
  const themePackSource = readFileSync("src/js/scene/theme-pack.ts", "utf8");

  assert.match(manifestSource, /themeId:\s*"castle"/);
  assert.match(manifestSource, /loading:\s*\{[\s\S]*frames:\s*\[/);
  assert.match(manifestSource, /debug:\s*\{[\s\S]*draftStorageKeys:/);
  assert.match(
    manifestSource,
    /editableRoomIds:\s*\["entrance",\s*"analyze",\s*"assistant",\s*"server",\s*"rooms",\s*"settings"\]/
  );
  assert.match(manifestSource, /entrance:\s*\{[\s\S]*whisper:/);
  assert.match(manifestSource, /analyze:\s*\{[\s\S]*archive:[\s\S]*table:/);
  assert.match(manifestSource, /assistant:\s*\{[\s\S]*primary:/);
  assert.match(manifestSource, /server:\s*\{[\s\S]*primary:/);
  assert.match(manifestSource, /rooms:\s*\{[\s\S]*backgroundSrc:/);
  assert.match(manifestSource, /settings:\s*\{[\s\S]*"live-log":/);
  assert.doesNotMatch(manifestSource, /backZones/);
  assert.match(themePackSource, /export function getSceneDebugDraftStorageKey/);
  assert.match(themePackSource, /export function getSceneRoomBackgroundSrc/);
  assert.match(themePackSource, /export function getSceneRoomViewPanelArtSrc/);
  assert.doesNotMatch(themePackSource, /getSceneBackZonePolicy/);
});

test("scene runtime files resolve theme assets and use generated back layers instead of the legacy helper", () => {
  const backLayerSource = readFileSync("src/js/scene/renderers/back-layer.ts", "utf8");
  const assistantSource = readFileSync("src/js/pages/assistant/assistant.ts", "utf8");
  const analyzeSource = readFileSync("src/js/pages/analyze.ts", "utf8");
  const serverSource = readFileSync("src/js/pages/server.ts", "utf8");
  const settingsSource = readFileSync("src/js/app/topbar-settings-overlay.ts", "utf8");
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
  assert.match(assistantSource, /scene\/theme-pack\.js/);
  assert.match(analyzeSource, /scene\/theme-pack\.js/);
  assert.match(serverSource, /scene\/theme-pack\.js/);
  assert.match(settingsSource, /scene\/theme-pack\.js/);
  assert.match(entranceSource, /scene\/theme-pack\.js/);
  assert.match(splashSource, /scene\/theme-pack\.js/);
  assert.doesNotMatch(htmlSource, /loading_door_0[1-4]\.webp/);
});
