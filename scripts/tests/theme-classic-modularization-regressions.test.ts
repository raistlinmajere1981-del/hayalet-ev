import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("classic theme normalization is centralized and reused by settings schema", () => {
  const normalizerSource = readFileSync("src/js/ui/theme/appearance-normalizer.ts", "utf8");
  const settingsSchemaSource = readFileSync("src/js/modules/settings/settings-schema.ts", "utf8");
  const classicThemeManagerSource = readFileSync(
    "src/js/ui/theme/classic-theme-manager.ts",
    "utf8"
  );
  const themeManagerFacadeSource = readFileSync("src/js/ui/theme-manager.ts", "utf8");
  const themeIndexSource = readFileSync("src/js/ui/theme/index.ts", "utf8");

  assert.match(normalizerSource, /export function normalizeThemeAppearance/);
  assert.match(normalizerSource, /export function areThemeAppearanceSettingsEqual/);
  assert.match(normalizerSource, /export function resolveThemeFromAppearance/);
  assert.match(
    settingsSchemaSource,
    /import \{ normalizeThemeAppearance \} from "\.\.\/\.\.\/ui\/theme\/appearance-normalizer\.js"/
  );
  assert.match(classicThemeManagerSource, /from "\.\/appearance-normalizer\.js"/);
  assert.match(classicThemeManagerSource, /from "\.\/theme-persistence\.js"/);
  assert.match(classicThemeManagerSource, /from "\.\/theme-settings-ui\.js"/);
  assert.match(classicThemeManagerSource, /from "\.\/theme-settings-bindings\.js"/);
  assert.match(
    themeManagerFacadeSource,
    /export \{ THEMES, ThemeManager \} from "\.\/theme\/classic-theme-manager\.js"/
  );
  assert.match(
    themeManagerFacadeSource,
    /export type \{ ThemeId \} from "\.\/theme\/classic-theme-manager\.js"/
  );
  assert.match(themeIndexSource, /export \{ ThemeManager \} from "\.\/classic-theme-manager\.js"/);
  assert.match(themeIndexSource, /export type \{ ThemeId \} from "\.\/classic-theme-manager\.js"/);
  assert.doesNotMatch(themeManagerFacadeSource, /appearance-normalizer/);
});

test("classic theme host propagation uses dedicated host sync helpers", () => {
  const hostSyncSource = readFileSync("src/js/ui/theme/theme-host-sync.ts", "utf8");
  const opencodeUiSource = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");
  const assistantSource = readFileSync("src/js/pages/assistant/assistant.ts", "utf8");

  assert.match(hostSyncSource, /export function resolveThemeFromSearchParams/);
  assert.match(hostSyncSource, /export function isOpencodeUiThemeHost/);
  assert.match(hostSyncSource, /export function buildInlineThemeSyncScript/);
  assert.match(opencodeUiSource, /resolveThemeFromSearchParams/);
  assert.match(assistantSource, /buildInlineThemeSyncScript/);
  assert.match(assistantSource, /isOpencodeUiThemeHost/);
});
