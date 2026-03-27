import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("settings theme panel wires scene theme management UI", () => {
  const htmlSource = readFileSync("src/pages/settings.html", "utf8");
  const appSource = readFileSync("src/js/pages/settings/app.ts", "utf8");
  const controllerSource = readFileSync("src/js/pages/settings/controller.ts", "utf8");
  const initSource = readFileSync("src/js/pages/settings/panels/init.ts", "utf8");
  const panelSource = readFileSync("src/js/pages/settings/panels/theme.ts", "utf8");

  assert.match(htmlSource, /id="scene-theme-current-name"/);
  assert.match(htmlSource, /id="scene-theme-current-meta"/);
  assert.match(htmlSource, /id="scene-theme-selection-hint"/);
  assert.match(htmlSource, /id="scene-theme-import"/);
  assert.match(htmlSource, /id="scene-theme-refresh"/);
  assert.match(htmlSource, /id="scene-theme-export"/);
  assert.match(htmlSource, /id="scene-theme-apply"/);
  assert.match(htmlSource, /id="scene-theme-settings-list"/);

  assert.match(appSource, /import\s+\{\s*setupSettingsPanels\s*\}\s+from\s+"\.\/panels\/init\.js"/);
  assert.match(appSource, /setupSettingsPanels\(\);/);
  assert.match(initSource, /import\s+\{\s*setupSettingsThemePanel\s*\}\s+from\s+"\.\/theme\.js"/);
  assert.match(initSource, /setupSettingsThemePanel\(\);/);

  assert.match(panelSource, /registerSettingsPanelLifecycle\("theme"/);
  assert.match(panelSource, /SceneThemeManager\.setCurrentTheme/);
  assert.match(panelSource, /syncInstalledSceneThemeRegistrationsFromElectron/);
  assert.match(panelSource, /sceneThemesImportBundle/);
  assert.match(panelSource, /sceneThemesPackageInstalled/);
  assert.match(controllerSource, /SceneUiScaleManager\.onChange\(\(\) => \{/);
  assert.match(controllerSource, /this\.sync\(this\.state\);/);
});

test("settings language panel wires tab, panel, and renderer bootstrap", () => {
  const htmlSource = readFileSync("src/pages/settings.html", "utf8");
  const appSource = readFileSync("src/js/pages/settings/app.ts", "utf8");
  const pageInitSource = readFileSync("src/js/app/page-init.ts", "utf8");
  const initSource = readFileSync("src/js/pages/settings/panels/init.ts", "utf8");
  const panelSource = readFileSync("src/js/pages/settings/panels/languages.ts", "utf8");

  assert.match(htmlSource, /id="settings-tab-languages"/);
  assert.match(htmlSource, /data-settings-panel="languages"/);
  assert.match(htmlSource, /id="settings-panel-languages"/);
  assert.match(htmlSource, /id="language-editor-entry-list"/);
  assert.match(htmlSource, /id="language-editor-meta"/);

  assert.match(appSource, /import\s+\{\s*setupSettingsPanels\s*\}\s+from\s+"\.\/panels\/init\.js"/);
  assert.match(appSource, /setupSettingsPanels\(\);/);
  assert.match(
    pageInitSource,
    /import\s+\{\s*setupSettingsPanels\s*\}\s+from\s+"\.\.\/pages\/settings\/panels\/init\.js"/
  );
  assert.match(pageInitSource, /setupSettingsPanels\(\);/);

  assert.match(
    initSource,
    /import\s+\{\s*setupSettingsLanguagesPanel\s*\}\s+from\s+"\.\/languages\.js"/
  );
  assert.match(initSource, /setupSettingsLanguagesPanel\(\);/);
  assert.match(initSource, /setupSettingsThemePanel\(\);/);

  assert.match(panelSource, /registerSettingsPanelLifecycle\("languages"/);
  assert.match(panelSource, /state\.scope === "app" \? languageEditorT\("scope\.app"\) : languageEditorT\("scope\.rooms"\)/);
  assert.match(
    panelSource,
    /if \(action === "refresh"\) \{[\s\S]*void refreshSources\(refs, state, \{\s*forceRoomRefresh: state\.scope === "room",\s*reloadData: true,\s*\}\);/
  );
  assert.match(
    panelSource,
    /registerSettingsPanelLifecycle\("languages", \{[\s\S]*onActivate: \(\) => \{[\s\S]*void refreshSources\(refs, state, \{ reloadData: true \}\);[\s\S]*onDeactivate:/
  );
  assert.match(panelSource, /joinPath\(selectedRoom\.i18nBaseDir, `\$\{locale\}\.json`\)/);
});
