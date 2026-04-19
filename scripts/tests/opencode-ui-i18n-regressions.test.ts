import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("opencode-ui Turkish panel labels stay localized on the visible shell", () => {
  const tr = JSON.parse(readFileSync("shared/languages/tr/index.json", "utf8")) as {
    opencodeUi?: {
      panel?: Record<string, string>;
    };
  };
  const panel = tr.opencodeUi?.panel ?? {};

  assert.equal(panel["providersTitle"], "Sağlayıcılar");
  assert.equal(panel["providersEyebrow"], "Çalışma Durumu");
  assert.equal(panel["toolsTitle"], "ARAÇLAR");
});

test("opencode-ui html keeps provider and tool anchors wired to panel i18n keys", () => {
  const html = readFileSync("src/pages/opencode-ui.html", "utf8");

  assert.match(html, /data-i18n-text="panel\.providersTitle"/u);
  assert.match(html, /data-i18n-text="panel\.providersEyebrow"/u);
  assert.match(html, /data-i18n-text="panel\.toolsTitle"/u);
});
