import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("ui mode orchestration centralizes option definitions and shared dropdown rendering", () => {
  const stateSource = readFileSync("src/js/app/ui-mode/state.ts", "utf8");
  const dropdownSource = readFileSync("src/js/app/ui-mode/dropdown.ts", "utf8");
  const navigationSource = readFileSync("src/js/app/navigation.ts", "utf8");
  const windowControlsSource = readFileSync("src/js/scene/window-controls.ts", "utf8");

  assert.match(stateSource, /state:\s*"classic"/);
  assert.match(stateSource, /state:\s*"scene"/);
  assert.match(stateSource, /state:\s*"scene-debug"/);
  assert.match(stateSource, /state:\s*"ghost-agent"/);
  assert.match(stateSource, /function getUiModeRestartOptions/);
  assert.match(dropdownSource, /function buildUiModeOptionMarkup/);
  assert.match(dropdownSource, /export function renderUiModeDropdowns/);
  assert.match(navigationSource, /from "\.\/ui-mode\/index\.js"/);
  assert.match(navigationSource, /renderUiModeDropdowns\(\)/);
  assert.match(windowControlsSource, /buildUiModeOptionsMarkup/);
});

test("scene and debug legacy entry files remain compatibility facades to canonical roots", () => {
  const themePackSource = readFileSync("src/js/scene/theme-pack.ts", "utf8");
  const debugStoreSource = readFileSync("src/js/scene/debug-store.ts", "utf8");
  const debugRoomsSource = readFileSync("src/js/scene/scene-debug-rooms.ts", "utf8");
  const debugFlagSource = readFileSync("src/js/pages/entrance/scene/scene-debug.ts", "utf8");
  const sceneMapFacadeSource = readFileSync("src/js/pages/entrance/scene/scene-map.ts", "utf8");
  const uiIndexSource = readFileSync("src/js/ui/index.ts", "utf8");

  assert.match(themePackSource, /export \* from "\.\/theme\/scene-theme-pack\.js"/);
  assert.match(debugStoreSource, /export \* from "\.\/debug\/scene-debug-store\.js"/);
  assert.match(debugRoomsSource, /export \* from "\.\/debug\/scene-debug-room-registry\.js"/);
  assert.match(debugFlagSource, /export \* from "\.\.\/\.\.\/\.\.\/scene\/debug\/scene-debug-flag\.js"/);
  assert.match(sceneMapFacadeSource, /export \* from "\.\.\/\.\.\/\.\.\/scene\/layout\/index\.js"/);
  assert.match(uiIndexSource, /export \{ ThemeManager \} from "\.\/theme\/index"/);
});
