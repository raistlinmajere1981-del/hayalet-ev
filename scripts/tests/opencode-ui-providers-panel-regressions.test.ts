import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("opencode-ui page scaffold contains providers tab and list anchor", () => {
  const html = readFileSync("src/pages/opencode-ui.html", "utf8");

  assert.match(html, /id="rtab-btn-providers"/);
  assert.match(html, /id="rtab-providers"/);
  assert.match(html, /id="providers-list"/);
});

test("opencode-ui periodic refresh does not reload provider or model lists", () => {
  const appContent = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");
  const content = readFileSync("src/js/pages/opencode-ui/bootstrap-actions.ts", "utf8");

  assert.match(appContent, /startPeriodicRefreshFromModule\(bootstrapContext\(\)\);/);
  assert.match(content, /export function startPeriodicRefresh\(context: BootstrapContext\): void {/);
  assert.match(content, /setInterval\(/);
  assert.doesNotMatch(content, /startPeriodicRefresh[\s\S]*loadProviderContextAndModels\(/);
  assert.doesNotMatch(content, /startPeriodicRefresh[\s\S]*loadModels\(/);
});

test("opencode-ui bootstrap loads provider catalog during initial page setup", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app-bootstrap.ts", "utf8");

  assert.match(
    content,
    /await Promise\.all\(\[options\.loadAgents\(\), options\.loadProviderContextAndModels\(\)\]\)/
  );
});

test("opencode-ui provider panel merges runtime connection state with provider catalog", () => {
  const appContent = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");
  const providerContent = readFileSync("src/js/pages/opencode-ui/provider-actions.ts", "utf8");

  assert.match(appContent, /loadProviderContextAndModelsFromModule/);
  assert.match(providerContent, /function renderProvidersPanel\(context: ProviderContext, markup: string\): void {/);
  assert.match(providerContent, /const listEl = context\.byId<HTMLElement>\("providers-list"\);/);
  assert.match(providerContent, /const connectedIds = normalizeConnectedProviderIds\(providerPayload\);/);
  assert.match(providerContent, /const catalog = normalizeProviderItemsFromConfig\(configPayload\);/);
  assert.match(
    providerContent,
    /badge: connectedSet\.has\(item\.id\) \? t\("provider\.connected"\) : t\("provider\.available"\)/
  );
  assert.match(providerContent, /renderProvidersPanel\(context, renderProviderRows\(items\)\);/);
});

test("opencode-ui provider panel falls back to empty render when runtime refresh fails", () => {
  const content = readFileSync("src/js/pages/opencode-ui/provider-actions.ts", "utf8");

  assert.match(content, /renderProvidersPanel\(context, renderProviderRows\(\[\]\)\);/);
  assert.match(content, /await loadModels\(context, configPayloadOverride\);/);
});

test("opencode-ui api still detects html fallback payloads", () => {
  const apiContent = readFileSync("src/js/pages/opencode-ui/api.ts", "utf8");

  assert.match(apiContent, /export function isHtmlDocumentPayload\(data: unknown\): boolean {/);
  assert.match(apiContent, /text\.startsWith\("<!doctype html"\)/);
});
