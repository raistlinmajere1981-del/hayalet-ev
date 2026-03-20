import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("settings theme panel wires scene theme management UI", () => {
  const htmlSource = readFileSync("src/pages/settings.html", "utf8");
  const appSource = readFileSync("src/js/pages/settings/app.ts", "utf8");
  const panelSource = readFileSync("src/js/pages/settings/panels/theme.ts", "utf8");

  assert.match(htmlSource, /id="scene-theme-source-badge"/);
  assert.match(htmlSource, /id="scene-theme-import"/);
  assert.match(htmlSource, /id="scene-theme-export"/);
  assert.match(htmlSource, /id="scene-theme-apply"/);
  assert.match(htmlSource, /id="scene-theme-settings-list"/);

  assert.match(appSource, /import\s+\{\s*setupSettingsThemePanel\s*\}\s+from\s+"\.\/panels\/theme\.js"/);
  assert.match(appSource, /setupSettingsThemePanel\(\);/);

  assert.match(panelSource, /registerSettingsPanelLifecycle\("theme"/);
  assert.match(panelSource, /SceneThemeManager\.setCurrentTheme/);
  assert.match(panelSource, /syncInstalledSceneThemeRegistrationsFromElectron/);
  assert.match(panelSource, /sceneThemesImportBundle/);
  assert.match(panelSource, /sceneThemesPackageInstalled/);
});
