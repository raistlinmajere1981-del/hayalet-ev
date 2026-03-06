import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("opencode-ui page scaffold contains providers tab and provider panel anchors", () => {
  const html = readFileSync("src/pages/opencode-ui.html", "utf8");

  assert.match(html, /id="rtab-btn-providers"/);
  assert.match(html, /id="rtab-providers"/);
  assert.match(html, /id="providers-connected-list"/);
  assert.match(html, /id="providers-available-list"/);
});

test("opencode-ui periodic refresh does not reload provider or model lists", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(content, /function startPeriodicRefresh\(\): void {[\s\S]*setInterval\(/);
  assert.doesNotMatch(content, /startPeriodicRefresh\(\): void {[\s\S]*loadProviderContext\(\)/);
  assert.doesNotMatch(content, /startPeriodicRefresh\(\): void {[\s\S]*loadModels\(\)/);
});

test("opencode-ui app wires providers connect\/disconnect actions and post-action refresh", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(content, /data-provider-action/);
  assert.match(content, /refreshProvidersAndModels\(\)/);
});

test("opencode-ui provider action fallback retries only on compatibility errors", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(content, /function isProviderCompatibilityError\(error: Error\): boolean/);
  assert.match(content, /if \(isProviderCompatibilityError\(resolvedError\)\) {\s*compatibilityFailures \+= 1;\s*continue;\s*}/);
});

test("opencode-ui provider actions reject HTML fallback payloads", () => {
  const appContent = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");
  const apiContent = readFileSync("src/js/pages/opencode-ui/api.ts", "utf8");

  assert.match(apiContent, /export function isHtmlDocumentPayload\(data: unknown\): boolean {/);
  assert.match(appContent, /Provider action endpoint returned HTML fallback instead of API result/);
  assert.match(appContent, /if \(isProviderActionCompatibilityPayload\(response\)\) {/);
  assert.match(appContent, /Provider \$\{action\} is not supported by this OpenCode server/);
});

test("opencode-ui validates provider action changed server state after refresh", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(content, /function didProviderActionTakeEffect\(/);
  assert.match(content, /if \(!didProviderActionTakeEffect\(action, providerId, connectedIds\)\) {/);
  assert.match(content, /Provider \$\{action\} did not change server state for \$\{providerId\}/);
});

test("opencode-ui keeps action success separate from refresh failure messaging", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(content, /Provider action succeeded but refresh failed/);
});
