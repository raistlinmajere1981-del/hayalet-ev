import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ProviderTester } from "../../electron/provider-tester/index.ts";
import type { WebviewTag } from "../../electron/provider-tester/types.ts";

const preloadPath = "electron/preload.cjs";
const handlerPath = "electron/handlers/ipc-provider.ts";
const testerPath = "electron/provider-tester/index.ts";
const globalTypesPath = "src/js/global.d.ts";
const scenarioRunnerPath = "electron/provider-tester/scenario-runner.ts";
const testerTypesPath = "electron/provider-tester/types.ts";
const testerUtilsPath = "electron/provider-tester/utils.ts";
const testerInteractivePath = "electron/provider-tester/interactive-tests.ts";
const sharedScenarioPath = "src/js/modules/webview/providers/shared/scenarios.ts";
const pathsPath = "electron/paths.ts";
const opencodeServerManagerPath = "electron/opencode-server-manager.ts";


describe("preload exposes generic provider scenario APIs alongside test compatibility alia", () => {
void test("preload exposes generic provider scenario APIs alongside test compatibility aliases", () => {
  const content = readFileSync(preloadPath, "utf8");

  assert.match(
    content,
    /runProviderScenario:\s*\(params\) => ipcRenderer\.invoke\("run-provider-scenario", params\)/
  );
  assert.match(
    content,
    /cancelProviderScenario:\s*\(params\) => ipcRenderer\.invoke\("cancel-provider-scenario", params\)/
  );
  assert.match(content, /onProviderScenarioProgress:\s*\(callback\) =>/);
  assert.match(
    content,
    /testProvider:\s*\(params\) => ipcRenderer\.invoke\("test-provider", params\)/
  );
});
void test("ipc provider handler registers a generic scenario entry point", () => {
  const content = readFileSync(handlerPath, "utf8");

  assert.match(content, /registerHandler\("run-provider-scenario"/);
  assert.match(content, /registerHandler\(\s*"cancel-provider-scenario"/);
  assert.match(content, /registerHandler\("test-provider"/);
  assert.match(content, /activeScenarioRuns = new Map<string, AbortController>\(\)/);
  assert.match(content, /abortSignal:\s*abortController\.signal/);
  assert.match(content, /syncMode: request\.syncMode \?\? "full"/);
  assert.match(content, /defaultUrlOverride/);
  assert.match(
    content,
    /scenarioId === "webview-test" && slot === "ai0" && providerId === "opencode-ui"/
  );
  assert.match(content, /const results = await tester\.runScenario\(scenarioId\);/);
  assert.doesNotMatch(content, /runTestSuite\(/);
});
void test("provider config paths resolve against the projected source tree for packaged mirrors", () => {
  const content = readFileSync(pathsPath, "utf8");

  assert.match(
    content,
    /return join\(cfg\.projectRoot, "src\/js\/modules\/webview\/providers", providerId, "config\.ts"\);/
  );
});
void test("opencode serve startup assigns the project root as the default workspace", () => {
  const content = readFileSync(opencodeServerManagerPath, "utf8");

  assert.match(content, /const workspacePath = Paths\.getProjectRoot\(\)\.trim\(\)/);
  assert.match(content, /args\.push\(workspacePath\)/);
  assert.match(content, /cwd: workspacePath/);
});
});
