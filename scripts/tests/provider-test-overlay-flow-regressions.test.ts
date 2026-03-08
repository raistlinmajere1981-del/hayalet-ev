import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const entrancePath = "src/js/pages/entrance/webview-panel.ts";
const asistanPath = "src/js/pages/asistan/index.ts";
const providerTesterPath = "electron/provider-tester/index.ts";
const entranceHtmlPath = "src/pages/entrance.html";
const asistanHtmlPath = "src/pages/asistan.html";

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

test("renderers use generic scenario APIs for webview-test launch and progress", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");
  const asistanContent = readFileSync(asistanPath, "utf8");

  assert.match(entranceContent, /const scenarioRequest =/);
  assert.match(entranceContent, /syncMode: state\.syncMode/);
  assert.match(entranceContent, /runProviderScenario\(scenarioRequest\)/);
  assert.match(entranceContent, /onProviderScenarioProgress\(handler\)/);
  assert.match(
    asistanContent,
    /runProviderScenario\(\{\s*slot: "ai0",\s*scenarioId: state\.scenarioId/s
  );
  assert.match(asistanContent, /onProviderScenarioProgress\(handler\)/);
});

test("renderers expose stop controls wired to cancel the active scenario run", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");
  const asistanContent = readFileSync(asistanPath, "utf8");

  assert.match(entranceContent, /scenario-overlay__stop/);
  assert.match(entranceContent, /void this\.stopScenarioTest\(\)/);
  assert.match(entranceContent, /cancelProviderScenario\(\{\s*runId: state\.runId\s*\}\)/);

  assert.match(asistanContent, /asistan-test-panel__stop/);
  assert.match(asistanContent, /void this\._stopScenarioTest\(\)/);
  assert.match(asistanContent, /cancelProviderScenario\(\{\s*runId: state\.runId\s*\}\)/);
});

test("renderers dismiss scenario surfaces when the tested slot becomes unavailable", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");
  const asistanContent = readFileSync(asistanPath, "utf8");

  assert.match(entranceContent, /dismissScenarioOverlayForUnavailableSlot/);
  assert.match(entranceContent, /shouldDismissScenarioOverlayForSlotState\(testedState\)/);
  assert.match(entranceContent, /shouldDismissScenarioOverlayForSlotState\(hostState\)/);
  assert.match(entranceContent, /cancelActiveRun: overlayState\.phase === "running"/);

  assert.match(asistanContent, /_dismissScenarioPanelForUnavailableSlot/);
  assert.match(asistanContent, /const shouldDismissScenarioPanel = !hasAccount \|\| \(!isConnected && !isConnecting\)/);
  assert.match(asistanContent, /this\._dismissScenarioPanelForUnavailableSlot\(\);/);
});

test("scenario JSON copy uses guarded helper flows instead of raw clipboard writes", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");
  const asistanContent = readFileSync(asistanPath, "utf8");

  assert.match(entranceContent, /copyScenarioSuiteJson/);
  assert.match(asistanContent, /_copyScenarioSuiteJson/);
});

test("entrance overlay exposes an Asistan delivery action for completed webview-test results", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");

  assert.match(entranceContent, /scenario-overlay__send-asistan/);
  assert.match(entranceContent, /state\.scenarioId === "webview-test"/);
  assert.match(entranceContent, /deliverScenarioResultsToAsistan/);
  assert.match(entranceContent, /deliverToAsistan\(\{/);
});

test("only entrance page exposes sync buttons beside test buttons", () => {
  const entranceHtml = readFileSync(entranceHtmlPath, "utf8");
  const asistanHtml = readFileSync(asistanHtmlPath, "utf8");

  assert.match(entranceHtml, /id="ai1-sync-btn"/);
  assert.match(entranceHtml, /id="ai2-sync-btn"/);
  assert.doesNotMatch(asistanHtml, /id="ai0-sync-btn"/);
});

test("only entrance renderer wires sync buttons to the webview-sync launcher flow", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");
  const asistanContent = readFileSync(asistanPath, "utf8");

  assert.match(entranceContent, /handleSyncClick\("ai1"\)/);
  assert.match(entranceContent, /handleSyncClick\("ai2"\)/);
  assert.match(entranceContent, /openScenarioLauncher\(slot, "webview-sync", "webview-sync"\)/);

  assert.doesNotMatch(asistanContent, /_handleSyncClick\(\)/);
  assert.doesNotMatch(asistanContent, /_openScenarioPanel\("webview-sync", "webview-sync"\)/);
});

test("entrance renderer only enables sync for verified provider configs", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");

  assert.match(entranceContent, /webviewSync\?\.readiness === "verified"/);
});

test("overlay and panel styles keep the result list scrollable", () => {
  const entranceCss = readFileSync("src/styles/entrance/test.css", "utf8");
  const asistanCss = readFileSync("src/styles/asistan.css", "utf8");
  const slotCss = readFileSync("src/styles/entrance/slot.css", "utf8");

  assert.match(entranceCss, /\.scenario-overlay__steps\s*\{[^}]*overflow:\s*auto/s);
  assert.match(entranceCss, /\.scenario-overlay\s*\{[^}]*margin:\s*0/s);
  assert.match(entranceCss, /\.scenario-slot-overlay\s*\{/);
  assert.match(asistanCss, /\.asistan-test-panel__steps\s*\{[^}]*overflow:\s*auto/s);
  assert.match(slotCss, /\.slot-card\s*\{[^}]*position:\s*relative/s);
});

test("entrance overlay auto-scrolls scenario results to the latest row", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");

  assert.match(entranceContent, /scrollScenarioOverlayToBottom\(overlayEl\);/);
  assert.match(entranceContent, /`\$\{state\.hostSlot\}-scenario-overlay`/);
  assert.match(entranceContent, /stepsEl\.scrollTop\s*=\s*stepsEl\.scrollHeight/);
  assert.match(entranceContent, /requestAnimationFrame\(scrollToBottom\)/);
});

test("entrance page provides dedicated scenario overlay hosts for full-slot coverage", () => {
  const entranceHtml = readFileSync(entranceHtmlPath, "utf8");

  assert.match(entranceHtml, /id="ai1-scenario-overlay"/);
  assert.match(entranceHtml, /id="ai2-scenario-overlay"/);
});

test("entrance overlay renders a structured session preview list for sync results", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");
  const entranceCss = readFileSync("src/styles/entrance/test.css", "utf8");

  assert.match(entranceContent, /sessionPreview\?\.sessions\.length/);
  assert.match(entranceContent, /sessionPreview\.sessions\s*\.map/s);
  assert.match(entranceContent, /scenario-step__preview-list/);
  assert.match(entranceCss, /\.scenario-step__preview-list\s*\{/);
  assert.match(entranceCss, /\.scenario-step__preview-item\s*\{/);
});

test("entrance overlay gives sync URL progress messages dedicated styling", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");
  const entranceCss = readFileSync("src/styles/entrance/test.css", "utf8");

  assert.match(entranceContent, /scenario-step__message--sync-progress/);
  assert.match(entranceContent, /row\.id\.startsWith\("navigate-session"\)/);
  assert.match(entranceContent, /row\.id\.startsWith\("sync-session"\)/);
  assert.match(entranceCss, /\.scenario-step__message--sync-progress\s*\{/);
  assert.match(entranceCss, /overflow-wrap:\s*anywhere/);
});

test("entrance overlay offers soft full clean mode selection for webview-sync", () => {
  const entranceContent = readFileSync(entrancePath, "utf8");
  const entranceCss = readFileSync("src/styles/entrance/test.css", "utf8");

  assert.match(entranceContent, /syncMode:\s*"full"/);
  assert.match(entranceContent, /data-sync-mode="soft"/);
  assert.match(entranceContent, /data-sync-mode="full"/);
  assert.match(entranceContent, /data-sync-mode="clean"/);
  assert.match(entranceContent, /scenario-sync-mode/);
  assert.match(entranceCss, /\.scenario-sync-mode\s*\{/);
  assert.match(entranceCss, /\.scenario-sync-mode__option\.is-active\s*\{/);
});
