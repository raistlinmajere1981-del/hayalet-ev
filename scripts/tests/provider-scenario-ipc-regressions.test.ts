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
