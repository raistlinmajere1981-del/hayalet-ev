import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const entrancePath = "src/js/pages/entrance/webview-panel.ts";
const asistanPath = "src/js/pages/asistan/index.ts";
const providerTesterPath = "electron/provider-tester/index.ts";

test("entrance scenario completion keeps results in the overlay instead of reopening the modal", () => {
  const content = readFileSync(entrancePath, "utf8");

  assert.doesNotMatch(content, /this\.showTestResultsModal\(results\);/);
});

test("asistan scenario completion keeps results in the side panel instead of reopening the modal", () => {
  const content = readFileSync(asistanPath, "utf8");

  assert.doesNotMatch(content, /await openTestResultsModal\(results\);/);
});

test("provider tester collapses entrance settings instead of opening them for the scenario", () => {
  const content = readFileSync(providerTesterPath, "utf8");

  assert.doesNotMatch(content, /classList\.remove\('open'\)/);
  assert.doesNotMatch(content, /classList\.add\('open'\)/);
});

test("entrance test button click collapses the settings accordion before opening the launcher", () => {
  const content = readFileSync(entrancePath, "utf8");

  assert.match(content, /collapseSettingsAccordion\(\);/);
});

test("overlay and panel styles keep the result list scrollable", () => {
  const entranceCss = readFileSync("src/styles/entrance/test.css", "utf8");
  const asistanCss = readFileSync("src/styles/asistan.css", "utf8");

  assert.match(entranceCss, /\.scenario-overlay__steps\s*\{[^}]*overflow:\s*auto/s);
  assert.match(asistanCss, /\.asistan-test-panel__steps\s*\{[^}]*overflow:\s*auto/s);
});
