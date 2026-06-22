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


describe("provider tester exposes a scenario-oriented entry point", () => {
void test("provider tester exposes a scenario-oriented entry point", () => {
  const content = readFileSync(testerPath, "utf8");

  assert.match(content, /async runScenario\(/);
  assert.match(content, /scenarioId/);
});
void test("runtime-loaded provider scenario sources avoid tsconfig alias imports", () => {
  const dynamicSourceFiles = [
    testerPath,
    scenarioRunnerPath,
    testerTypesPath,
    testerUtilsPath,
    testerInteractivePath,
    sharedScenarioPath,
  ];

  for (const filePath of dynamicSourceFiles) {
    const content = readFileSync(filePath, "utf8");
    assert.doesNotMatch(content, /from "@timeouts"/, `${filePath} should use runtime-safe imports`);
  }
});
void test("provider tester resolves webview-test from provider config scenario definitions", async () => {
  const executed: string[] = [];

  const fakeWebview = {
    getURL: () => "https://chatgpt.com/c/test",
    loadURL: async () => {},
    executeJavaScript: () => null,
    addEventListener: () => {},
  };

  const config = {
    id: "chatgpt",
    name: "ChatGPT",
    baseUrl: "https://chatgpt.com",
    loginUrl: "https://chatgpt.com/auth/login",
    lastVerified: "2026-03-07",
    selectors: {
      sendButton: "button",
      stopButton: "button.stop",
      inputField: "textarea",
      messageContainer: "main",
    },
    inputType: "direct",
    scrollerSelectors: [],
    scrapeSelectors: {
      preferred: "main",
      fallback: "main",
    },
    fileInputSelectors: [],
    uploadTargetSelectors: [],
    criticalSelectors: [],
    contentContainers: [],
    excludedUrls: [],
    filters: {
      selectors: [],
      hosts: [],
      blockResourceTypes: [],
    },
    telemetry: {
      endpoints: [],
      tokenPaths: [],
    },
    scenarios: {
      webviewTest: {
        id: "webview-test",
        title: "Injected Scenario",
        commands: [
          {
            id: "first-custom-step",
            label: "Injected Reset",
            action: "navigate-default",
            onFail: "abort",
          },
          {
            id: "last-custom-step",
            label: "Injected Capabilities",
            action: "assert-provider-capabilities",
            onFail: "warn",
          },
        ],
      },
    },
  };

  const tester = new ProviderTester(fakeWebview as unknown as WebviewTag, config as never, "ai1");
  const testerOverrides = tester as unknown as Record<string, () => Promise<unknown>>;

  testerOverrides["runResetDefaultPageStep"] = async () => {
    await Promise.resolve();
    executed.push("navigate-default");
    return { status: "pass", message: "reset ok" };
  };
  testerOverrides["runDisabledSendStep"] = async () => {
    await Promise.resolve();
    executed.push("unexpected-disabled-send");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides["runDragDropStep"] = async () => {
    await Promise.resolve();
    executed.push("unexpected-drag-drop");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides["runInjectMessageStep"] = async () => {
    await Promise.resolve();
    executed.push("unexpected-inject-message");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides["runEnabledSendStep"] = async () => {
    await Promise.resolve();
    executed.push("unexpected-enabled-send");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides["runAttachFileStep"] = async () => {
    await Promise.resolve();
    executed.push("unexpected-attach-file");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides["runSendThinkingStep"] = async () => {
    await Promise.resolve();
    executed.push("unexpected-send-thinking");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides["runFinalBubblesStep"] = async () => {
    await Promise.resolve();
    executed.push("unexpected-final-bubbles");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides["runScrollStep"] = async () => {
    await Promise.resolve();
    executed.push("unexpected-scroll-behavior");
    return { status: "pass", message: "unexpected" };
  };
  testerOverrides["runProviderCapabilitiesStep"] = async () => {
    await Promise.resolve();
    executed.push("assert-provider-capabilities");
    return { status: "warning", message: "capabilities warning" };
  };

  const result = await tester.runScenario("webview-test");

  assert.deepEqual(executed, ["navigate-default", "assert-provider-capabilities"]);
  assert.deepEqual(
    result.commands.map((command) => [command.id, command.name, command.status]),
    [
      ["first-custom-step", "Injected Reset", "pass"],
      ["last-custom-step", "Injected Capabilities", "warning"],
    ]
  );
});
void test("provider tester dispatches generated image archive scenario actions", async () => {
  const executed: string[] = [];
  const fakeWebview = {
    getURL: () => "https://chatgpt.com/c/test",
    loadURL: async () => {},
    executeJavaScript: () => null,
    addEventListener: () => {},
  };

  const config = {
    id: "chatgpt",
    name: "ChatGPT",
    baseUrl: "https://chatgpt.com",
    loginUrl: "https://chatgpt.com/auth/login",
    lastVerified: "2026-03-31",
    selectors: {
      sendButton: "button",
      stopButton: "button.stop",
      inputField: "textarea",
      messageContainer: "main",
      generatedImage: "img.generated",
    },
    inputType: "direct",
    scrollerSelectors: [],
    scrapeSelectors: {
      preferred: "main",
      fallback: "main",
    },
    fileInputSelectors: [],
    uploadTargetSelectors: [],
    criticalSelectors: [],
    contentContainers: [],
    excludedUrls: [],
    filters: {
      selectors: [],
      hosts: [],
      blockResourceTypes: [],
    },
    telemetry: {
      endpoints: [],
      tokenPaths: [],
    },
    scenarios: {
      webviewTest: {
        id: "webview-test",
        title: "Archive Scenario",
        commands: [
          {
            id: "generated-image-archive",
            label: "Generated Image Archive",
            action: "assert-generated-image-archive",
            onFail: "warn",
          },
        ],
      },
    },
  };

  const tester = new ProviderTester(fakeWebview as unknown as WebviewTag, config as never, "ai1");
  const testerOverrides = tester as unknown as Record<string, () => Promise<unknown>>;
  testerOverrides["runGeneratedImageArchiveStep"] = async () => {
    await Promise.resolve();
    executed.push("assert-generated-image-archive");
    return { status: "pass", message: "archive ok" };
  };

  const result = await tester.runScenario("webview-test");

  assert.deepEqual(executed, ["assert-generated-image-archive"]);
  assert.deepEqual(
    result.commands.map((command) => [command.id, command.status]),
    [["generated-image-archive", "pass"]]
  );
});
});
