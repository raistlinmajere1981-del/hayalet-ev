import assert from "node:assert/strict";
import test from "node:test";

import { config as grokConfig } from "../../src/js/modules/webview/providers/grok/config.ts";

test("grok input selector includes ProseMirror composer root", () => {
  assert.equal(grokConfig.selectors.inputField.includes(".ProseMirror"), true);
  assert.equal(grokConfig.selectors.inputField.includes('contenteditable="true"'), true);
});

test("grok critical selectors include current TR/EN placeholder nodes", () => {
  assert.equal(grokConfig.criticalSelectors.includes('p[data-placeholder="Ask Grok"]'), true);
  assert.equal(grokConfig.criticalSelectors.includes('p[data-placeholder="Grok\'a Sor"]'), true);
});
