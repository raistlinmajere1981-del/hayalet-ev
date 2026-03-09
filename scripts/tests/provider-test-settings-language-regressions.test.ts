import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("entrance settings UI exposes app language selector", () => {
  const html = readFileSync("src/pages/entrance.html", "utf8");

  assert.match(html, /id="app-language-select"/);
  assert.match(html, /id="app-language-label"/);
  assert.match(html, /id="app-language-restart-hint"/);
});

test("user panel persists app language to general.language", () => {
  const source = readFileSync("src/js/pages/entrance/user-panel.ts", "utf8");

  assert.match(source, /general:\s*\{\s*\.\.\.current\.general,\s*language:/s);
  assert.match(source, /normalizeAppLanguage\(language\)/);
});

test("provider test handler sources promotion locale from app settings", () => {
  const source = readFileSync("electron/handlers/ipc-provider.ts", "utf8");

  assert.match(source, /loadSettings\(/);
  assert.match(source, /general\?\.language|resolvePromotionLocaleFromSettings/);
});
