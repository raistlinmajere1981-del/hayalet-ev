import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("asistan webview config injection resolves provider dynamically for ai0", () => {
  const content = readFileSync("src/js/pages/asistan/index.ts", "utf8");

  assert.match(content, /this\.providerSelect\?\.value \?\? AppState\.getProviderIdForSlot\("ai0"\)/);
  assert.doesNotMatch(content, /const providerId = AppState\.getProviderIdForSlot\("ai0"\);\s*webviewEl\.addEventListener\("did-stop-loading"/);
});
